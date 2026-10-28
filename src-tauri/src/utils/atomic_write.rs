// Atomic file writes for storage code.
//
// `std::fs::write` truncates the target before writing, so a crash, a full disk, or a
// concurrent reader mid-write leaves a half-written file. Writing to a sibling temp
// file and renaming means the target is either the old contents or the new ones,
// never a partial — which is what makes a failed save recoverable rather than
// destructive.
//
// Every storage module that persists user data should write through this helper.
//
// Two constraints worth knowing:
//   - The temp file must be on the same filesystem as the target, otherwise the
//     rename is not atomic but a copy-and-delete. Hence `new_in(path.parent())`
//     rather than the system temp dir.
//   - `tempfile` creates with exclusive permissions. When the target already exists
//     its mode is carried over, so saving a file the user owns does not silently
//     tighten it to owner-only.

use std::fs;
use std::io::Write;
use std::path::Path;

use tempfile::NamedTempFile;

/// Write `contents` to `path` through a temp file in the same directory, then rename.
///
/// Returns `io::Error` rather than a module-specific error type so every storage
/// module can map it in its own style — `CommandError`, `anyhow`, or the plain
/// `String` errors the older modules use.
pub fn write_atomic(path: &Path, contents: &[u8]) -> std::io::Result<()> {
    // A bare relative name like `file.json` has `Some("")` as its parent, which means
    // the process's current directory — not a place any storage module should write.
    // Storage code always resolves to an absolute config path, so an empty parent is a
    // bug rather than a valid target.
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!(
                    "Cannot write to a path with no parent directory: {}",
                    path.display()
                ),
            )
        })?;

    let tmp = NamedTempFile::new_in(parent)?;

    if let Ok(meta) = fs::metadata(path) {
        let _ = fs::set_permissions(tmp.path(), meta.permissions());
    }

    tmp.as_file().write_all(contents)?;
    // `flush()` on an unbuffered `File` is a no-op; `sync_all()` is what actually
    // guarantees the bytes are on disk before the rename, so a crash after the rename
    // cannot leave a zero-length file at the target path.
    tmp.as_file().sync_all()?;

    // `PersistError` wraps the io error; unwrap it so the caller's error mapping keeps
    // the kind.
    tmp.persist(path).map_err(|e| e.error)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn fresh_dir() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("apinox-atomic-write-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn renames_and_leaves_no_temp_file_behind() {
        let dir = fresh_dir();
        let target = dir.join("file.json");

        write_atomic(&target, b"{ }").expect("write_atomic");

        assert_eq!(fs::read(&target).unwrap(), b"{ }");
        // The rename committed, so the directory holds the target and nothing else.
        let left: Vec<_> = fs::read_dir(&dir).unwrap().collect();
        assert_eq!(left.len(), 1, "a temp file was left behind");
    }

    #[cfg(unix)]
    #[test]
    fn preserves_the_existing_file_mode() {
        use std::os::unix::fs::PermissionsExt;

        let dir = fresh_dir();
        let target = dir.join("file.json");

        // A file the user owns must not change mode when the app saves it. `tempfile`
        // creates with 0600, so without the carry-over this would silently tighten an
        // existing 0644 file to owner-only.
        fs::write(&target, "old").expect("write");
        fs::set_permissions(&target, fs::Permissions::from_mode(0o644)).expect("chmod");

        write_atomic(&target, b"new").expect("write_atomic");

        assert_eq!(fs::read(&target).unwrap(), b"new");
        assert_eq!(
            fs::metadata(&target).unwrap().permissions().mode() & 0o777,
            0o644
        );
    }

    #[cfg(unix)]
    #[test]
    fn replaces_the_file_rather_than_truncating_it_in_place() {
        use std::os::unix::fs::MetadataExt;

        let dir = fresh_dir();
        let target = dir.join("file.json");
        fs::write(&target, "old").expect("write");

        // The observable consequence of a two-step write: a hard link keeps the old
        // contents, because the target path is renamed onto rather than truncated.
        // This is the property that makes a mid-write failure non-destructive — the
        // target is never observed half-written. `fs::write` truncates in place, so
        // the link would see "new" and this test fails.
        let link = dir.join("link.json");
        fs::hard_link(&target, &link).expect("hard link");

        write_atomic(&target, b"new").expect("write_atomic");

        assert_eq!(fs::read(&target).unwrap(), b"new");
        assert_eq!(fs::read(&link).unwrap(), b"old");
        assert_ne!(
            fs::metadata(&target).unwrap().ino(),
            fs::metadata(&link).unwrap().ino()
        );
    }

    #[test]
    fn a_failed_commit_does_not_damage_the_target_or_leave_a_temp_file() {
        let dir = fresh_dir();

        // A directory at the target path makes the commit fail *after* the temp file
        // has been written and synced. The target is only ever changed by the rename,
        // so a failure leaves it untouched.
        let target = dir.join("file.json");
        fs::create_dir_all(&target).expect("create target dir");

        assert!(write_atomic(&target, b"new").is_err());
        assert!(target.is_dir());

        let left: Vec<_> = fs::read_dir(&dir).unwrap().collect();
        assert_eq!(left.len(), 1, "the failed write left a temp file behind");
    }

    #[test]
    fn a_path_with_no_parent_is_rejected_before_anything_is_written() {
        let err = write_atomic(Path::new("file.json"), b"new").unwrap_err();
        assert_eq!(err.kind(), std::io::ErrorKind::InvalidInput);
    }

    /// Guard the whole class this helper exists for: storage modules must persist
    /// through `write_atomic`, not `fs::write`, which truncates the target before
    /// writing and so makes a failed save destructive.
    ///
    /// Only production code counts — test code legitimately uses `fs::write` to seed
    /// fixtures, so the file is cut at its `mod tests`.
    #[test]
    fn storage_modules_persist_through_the_helper_not_fs_write() {
        let root = env!("CARGO_MANIFEST_DIR");
        let modules = [
            "project_storage.rs",
            "history_storage.rs",
            "storage/rules.rs",
            "certificates/manager.rs",
            "soap/certificate_manager.rs",
            "commands/mock_server.rs",
            "notes_storage.rs",
        ];

        let offenders = modules
            .iter()
            .filter_map(|file| {
                let src = fs::read_to_string(format!("{}/src/{}", root, file))
                    .expect("read storage module");
                let production = match src.find("mod tests") {
                    Some(pos) => &src[..pos],
                    None => &src[..],
                };
                if production.contains("fs::write(") {
                    Some(file.to_string())
                } else {
                    None
                }
            })
            .collect::<Vec<_>>();

        assert_eq!(offenders, Vec::<String>::new());
    }
}
