//! Notes storage: `index.json` plus the note files themselves under the config
//! directory.
//!
//! Two kinds of note:
//! - **managed** — created by the app, stored under `<config_dir>/notes/`.
//! - **external** — a file the user picked in the open dialog, which lives
//!   wherever they picked it and is only referenced from the index.
//!
//! Because `file_path` arrives from the frontend, the backend decides managed-ness
//! from the path itself rather than trusting the `isManaged` flag the client sent:
//! a path is managed only if it resolves inside the notes directory. See
//! `is_managed_path` and `guard_note_path`.
//!
//! Every command returns `CommandError` so the frontend can branch on the failure
//! kind (`utils/bridge.ts` `commandErrorText` / `commandErrorKind`).
//!
//! Index mutations also push a `notesUpdated` message on the `backend_command`
//! channel, so the UI re-syncs from the authoritative index rather than hand-
//! mutating its own copy — which is what made an external index edit invisible.

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};

use chrono::{DateTime, Utc};
use tauri::{AppHandle, Emitter};

use crate::error::CommandError;
use crate::project_storage::sanitize_name;
use crate::utils::{blocking, resolve_config_dir, write_atomic};

/// Largest file the notes UI will load into memory as a JSON string.
///
/// `load_note_bytes` base64-encodes the whole file into a string payload and
/// `load_note_content` decodes it — an unbounded file here means an unbounded
/// JSON string on the command channel. Same reasoning as `utils/body_reader.rs`'s
/// `max_body_bytes` spooling and `updater.rs`'s `MAX_ZIP_ENTRY_BYTES`.
const MAX_NOTE_BYTES: u64 = 10 * 1024 * 1024;

// ── Directory helpers ────────────────────────────────────────────────────────

fn get_notes_dir() -> Result<PathBuf, CommandError> {
    let config_dir = resolve_config_dir().map_err(CommandError::from)?;

    let notes_dir = config_dir.join("notes");
    if !notes_dir.exists() {
        fs::create_dir_all(&notes_dir)
            .map_err(|e| CommandError::from(e).with_prefix("Failed to create notes directory"))?;
    }
    Ok(notes_dir)
}

/// True when `path` sits inside the notes directory — i.e. it is a managed note.
fn is_managed_path(notes_dir: &Path, path: &Path) -> bool {
    path.starts_with(notes_dir)
}

/// Reject a client-supplied path that presents as a managed note but escapes the
/// notes directory through `..`.
///
/// `Path::starts_with` compares components, so `<notes>/../evil.txt` still
/// "starts with" the notes directory while resolving outside it. Without this
/// guard `delete_note` could remove a file anywhere the process can reach, and
/// `save_note` would happily `create_dir_all` on an arbitrary path. External
/// notes are legitimately outside the notes directory, so the guard applies only
/// to paths that claim to be inside it.
fn guard_note_path(notes_dir: &Path, file_path: &str) -> Result<PathBuf, CommandError> {
    let path = PathBuf::from(file_path);
    if is_managed_path(notes_dir, &path)
        && path.components().any(|c| matches!(c, Component::ParentDir))
    {
        return Err(CommandError::invalid_input(format!(
            "Invalid note path (must not contain '..'): {}",
            file_path
        )));
    }
    Ok(path)
}

fn get_index_path(notes_dir: &Path) -> PathBuf {
    notes_dir.join("index.json")
}

// ── Index model (mirrors TypeScript NotesIndex) ──────────────────────────────

#[derive(Debug, serde::Serialize, serde::Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NoteEntry {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub language: String,
    pub is_binary: bool,
    pub is_managed: bool,
    pub last_modified: String,
    pub created_at: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NotesIndex {
    entries: Vec<NoteEntry>,
    #[serde(default)]
    recent_paths: Vec<String>,
}

/// Serializes read-modify-write on `index.json`. These commands run on the
/// blocking pool, so two autosaves (or an open + a delete) can otherwise
/// interleave `load → mutate → save` and lose an update.
static INDEX_LOCK: Mutex<()> = Mutex::new(());

/// Load the index.
///
/// A corrupt file used to be replaced with a default index and logged — the next
/// write then persisted that default, clobbering the user's file. Read failures
/// now surface as an error so the file survives for recovery.
fn load_index(index_path: &Path) -> Result<NotesIndex, CommandError> {
    if !index_path.exists() {
        return Ok(NotesIndex::default());
    }
    let content = fs::read_to_string(index_path)
        .map_err(|e| CommandError::from(e).with_prefix("Failed to read notes index"))?;
    serde_json::from_str(&content)
        .map_err(|e| CommandError::from(e).with_prefix("Failed to parse notes index"))
}

fn save_index(index_path: &Path, index: &NotesIndex) -> Result<(), CommandError> {
    let content = serde_json::to_string_pretty(index)
        .map_err(|e| CommandError::from(e).with_prefix("Failed to serialize notes index"))?;
    write_atomic(index_path, content.as_bytes())
        .map_err(|e| CommandError::from(e).with_prefix("Failed to write notes index"))?;
    Ok(())
}

/// Load, mutate, and save the index under the lock, then push the authoritative
/// index through `emit`.
///
/// The emitter is a closure rather than an `AppHandle` so the mutation logic stays
/// testable — the commands pass `&|index| emit_notes_update(&app, index)`, and the
/// tests pass a no-op.
fn update_index<T>(
    notes_dir: &Path,
    emit: &dyn Fn(&NotesIndex),
    f: impl FnOnce(&mut NotesIndex) -> Result<T, CommandError>,
) -> Result<T, CommandError> {
    let index_path = get_index_path(notes_dir);
    let guard = INDEX_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let mut index = load_index(&index_path)?;
    let value = f(&mut index)?;
    save_index(&index_path, &index)?;
    emit(&index);
    drop(guard);
    Ok(value)
}

/// Build the `notesUpdated` payload. Kept separate from the emit so the shape the
/// frontend reads is testable.
fn notes_updated_payload(index: &NotesIndex) -> serde_json::Value {
    serde_json::json!({
        "command": "notesUpdated",
        "entries": index.entries,
    })
}

fn emit_notes_update(app: &AppHandle, index: &NotesIndex) {
    if let Err(e) = app.emit("backend_command", notes_updated_payload(index)) {
        log::warn!("[notes] Failed to emit notesUpdated: {}", e);
    }
}

// ── Atomic writes ─────────────────────────────────────────────────────────────

// Writes go through `utils::atomic_write::write_atomic` — the app-wide helper, so a
// failed save cannot leave a half-written `index.json` (the corruption `load_index`
// refuses to clobber).

/// Reject a write larger than the load cap. The same bound applies in both
/// directions — otherwise a client could push an arbitrarily large payload
/// through the command channel even though reads are capped.
fn check_write_size(len: usize, path: &Path) -> Result<(), CommandError> {
    if len as u64 > MAX_NOTE_BYTES {
        return Err(CommandError::invalid_input(format!(
            "Note is too large to save ({} bytes, limit {} bytes): {}",
            len, MAX_NOTE_BYTES, path.display()
        )));
    }
    Ok(())
}

/// Reject a file too large to load as a note, and return its size when it fits.
fn check_note_size(path: &Path) -> Result<u64, CommandError> {
    let size = fs::metadata(path)
        .map_err(|e| CommandError::from(e).with_prefix("Failed to stat file"))?
        .len();
    if size > MAX_NOTE_BYTES {
        return Err(CommandError::invalid_input(format!(
            "File is too large to open as a note ({} bytes, limit {} bytes)",
            size, MAX_NOTE_BYTES
        )));
    }
    Ok(size)
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

/// The file's mtime as an RFC 3339 timestamp — the same format every other
/// storage module uses (`chrono::Utc::now().to_rfc3339()`), so `lastModified` in
/// the index no longer mixes second-precision strings with the full millisecond
/// ISO strings the frontend writes.
fn file_last_modified(path: &Path) -> String {
    fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .map(|t| DateTime::<Utc>::from(t).to_rfc3339())
        .unwrap_or_else(now_iso)
}

// ── Binary sniff ─────────────────────────────────────────────────────────────

/// Returns true if the file appears to be binary (>10% null/non-UTF8 control
/// bytes in the first 512).
///
/// A read failure is reported rather than swallowed: the old version returned
/// `false` on any error, so an unreadable file was classified as text and then
/// failed later as a decode error with no indication of the real cause.
fn sniff_is_binary(path: &Path) -> Result<bool, CommandError> {
    use std::io::Read;
    let mut file = fs::File::open(path)
        .map_err(|e| CommandError::from(e).with_prefix("Failed to open file"))?;
    let mut buf = [0u8; 512];
    let n = file
        .read(&mut buf)
        .map_err(|e| CommandError::from(e).with_prefix("Failed to read file header"))?;
    if n == 0 {
        return Ok(false);
    }
    let sample = &buf[..n];
    let non_text = sample.iter().filter(|&&b| b < 9 || (b > 13 && b < 32)).count();
    Ok(non_text * 10 > n)
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn load_notes_index() -> Result<NotesIndex, CommandError> {
    blocking(load_notes_index_sync).await
}

fn load_notes_index_sync() -> Result<NotesIndex, CommandError> {
    let dir = get_notes_dir()?;
    load_index(&get_index_path(&dir))
}

#[tauri::command]
pub async fn load_note_content(file_path: String) -> Result<String, CommandError> {
    blocking(move || load_note_content_sync(file_path)).await
}

fn load_note_content_sync(file_path: String) -> Result<String, CommandError> {
    let dir = get_notes_dir()?;
    let path = guard_note_path(&dir, &file_path)?;
    if !path.exists() {
        return Err(CommandError::not_found(format!("File not found: {}", file_path)));
    }
    check_note_size(&path)?;
    if sniff_is_binary(&path)? {
        return Err(CommandError::invalid_input(
            "File is binary; use load_note_bytes",
        ));
    }
    // Lossy decode rather than a hard failure: the repo's convention for
    // possibly-invalid bytes (see e2e_unified_explorer.rs), and a note opened as
    // text may legitimately contain them.
    let bytes = fs::read(&path)
        .map_err(|e| CommandError::from(e).with_prefix("Failed to read file"))?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[tauri::command]
pub async fn load_note_bytes(file_path: String) -> Result<String, CommandError> {
    blocking(move || load_note_bytes_sync(file_path)).await
}

fn load_note_bytes_sync(file_path: String) -> Result<String, CommandError> {
    let dir = get_notes_dir()?;
    let path = guard_note_path(&dir, &file_path)?;
    if !path.exists() {
        return Err(CommandError::not_found(format!("File not found: {}", file_path)));
    }
    check_note_size(&path)?;
    let bytes = fs::read(&path)
        .map_err(|e| CommandError::from(e).with_prefix("Failed to read file"))?;
    Ok(BASE64.encode(&bytes))
}

#[tauri::command]
pub async fn save_note(file_path: String, content: String) -> Result<String, CommandError> {
    blocking(move || save_note_sync(file_path, content)).await
}

fn save_note_sync(file_path: String, content: String) -> Result<String, CommandError> {
    let dir = get_notes_dir()?;
    let path = guard_note_path(&dir, &file_path)?;
    check_write_size(content.len(), &path)?;
    ensure_note_parent(&dir, &path)?;
    write_atomic(&path, content.as_bytes())
        .map_err(|e| CommandError::from(e).with_prefix("Failed to write file"))?;
    log::info!("Note saved: {}", path.display());
    Ok(file_last_modified(&path))
}

#[tauri::command]
pub async fn save_note_bytes(file_path: String, data_base64: String) -> Result<String, CommandError> {
    blocking(move || save_note_bytes_sync(file_path, data_base64)).await
}

fn save_note_bytes_sync(file_path: String, data_base64: String) -> Result<String, CommandError> {
    let dir = get_notes_dir()?;
    let path = guard_note_path(&dir, &file_path)?;
    ensure_note_parent(&dir, &path)?;
    let bytes = BASE64.decode(&data_base64).map_err(|e| {
        CommandError::serialization(format!("Failed to decode base64: {}", e))
    })?;
    check_write_size(bytes.len(), &path)?;
    write_atomic(&path, &bytes)
        .map_err(|e| CommandError::from(e).with_prefix("Failed to write file"))?;
    log::info!("Binary note saved: {}", path.display());
    Ok(file_last_modified(&path))
}

/// Create the parent directory only for managed notes. An external note's parent
/// is a directory the user chose in the dialog and must already exist — creating
/// one on an arbitrary client-supplied path is not something the backend should do.
fn ensure_note_parent(notes_dir: &Path, path: &Path) -> Result<(), CommandError> {
    if !is_managed_path(notes_dir, path) {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| CommandError::from(e).with_prefix("Failed to create directory"))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_note(app: AppHandle, id: String) -> Result<(), CommandError> {
    blocking(move || delete_note_sync(&id, &|index| emit_notes_update(&app, index))).await
}

fn delete_note_sync(id: &str, emit: &dyn Fn(&NotesIndex)) -> Result<(), CommandError> {
    let dir = get_notes_dir()?;

    update_index(&dir, emit, |index| {
        let pos = index
            .entries
            .iter()
            .position(|e| e.id == id)
            .ok_or_else(|| CommandError::not_found(format!("Note not found: {}", id)))?;
        let entry = index.entries.remove(pos);

        // Managed-ness is decided from the path, not from the `isManaged` flag the
        // client sent: only files inside the notes directory are ever removed here.
        let path = guard_note_path(&dir, &entry.file_path)?;
        if is_managed_path(&dir, &path) {
            if path.exists() {
                fs::remove_file(&path)
                    .map_err(|e| CommandError::from(e).with_prefix("Failed to delete file"))?;
            }
        } else if entry.is_managed {
            log::warn!(
                "Note {} claims to be managed but its path is outside the notes directory; index entry removed, file left in place",
                entry.name
            );
        }
        log::info!("Note deleted: {} ({})", entry.name, entry.file_path);
        Ok(())
    })
}

#[tauri::command]
pub async fn rename_note(app: AppHandle, id: String, new_name: String) -> Result<NoteEntry, CommandError> {
    blocking(move || rename_note_sync(&id, &new_name, &|index| emit_notes_update(&app, index))).await
}

fn rename_note_sync(
    id: &str,
    new_name: &str,
    emit: &dyn Fn(&NotesIndex),
) -> Result<NoteEntry, CommandError> {
    let dir = get_notes_dir()?;

    update_index(&dir, emit, |index| {
        let entry = index
            .entries
            .iter_mut()
            .find(|e| e.id == id)
            .ok_or_else(|| CommandError::not_found(format!("Note not found: {}", id)))?;

        // Managed-ness comes from the path, not the client-supplied flag.
        let old_path = guard_note_path(&dir, &entry.file_path)?;
        if is_managed_path(&dir, &old_path) {
            // The new name is joined onto the notes directory, so it must go through
            // the shared sanitizer — otherwise a name containing `/`, `\` or `..`
            // resolves outside it.
            let ext = old_path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| format!(".{}", e))
                .unwrap_or_default();
            let new_path = dir.join(format!("{}{}", sanitize_name(new_name), ext));
            if old_path.exists() {
                fs::rename(&old_path, &new_path)
                    .map_err(|e| CommandError::from(e).with_prefix("Failed to rename file"))?;
            }
            entry.file_path = new_path.to_string_lossy().to_string();
        }
        entry.name = new_name.to_string();
        Ok(entry.clone())
    })
}

#[tauri::command]
pub async fn upsert_note_index(app: AppHandle, entry: NoteEntry) -> Result<(), CommandError> {
    blocking(move || upsert_note_index_sync(&entry, &|index| emit_notes_update(&app, index))).await
}

fn upsert_note_index_sync(entry: &NoteEntry, emit: &dyn Fn(&NotesIndex)) -> Result<(), CommandError> {
    let dir = get_notes_dir()?;

    update_index(&dir, emit, |index| {
        if let Some(pos) = index.entries.iter().position(|e| e.id == entry.id) {
            index.entries[pos] = entry.clone();
        } else {
            index.entries.push(entry.clone());
        }
        Ok(())
    })
}

/// How many recently-opened external paths the index keeps.
const RECENT_NOTE_LIMIT: usize = 20;

#[tauri::command]
pub async fn add_recent_note_path(app: AppHandle, file_path: String) -> Result<(), CommandError> {
    blocking(move || add_recent_note_path_sync(&file_path, &|index| emit_notes_update(&app, index))).await
}

fn add_recent_note_path_sync(file_path: &str, emit: &dyn Fn(&NotesIndex)) -> Result<(), CommandError> {
    let dir = get_notes_dir()?;

    update_index(&dir, emit, |index| {
        index.recent_paths.retain(|p| p != file_path);
        index.recent_paths.insert(0, file_path.to_string());
        index.recent_paths.truncate(RECENT_NOTE_LIMIT);
        Ok(())
    })
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SniffResult {
    pub is_binary: bool,
    pub file_size: u64,
    pub last_modified: String,
}

#[tauri::command]
pub async fn sniff_file_type(file_path: String) -> Result<SniffResult, CommandError> {
    blocking(move || sniff_file_type_sync(file_path)).await
}

fn sniff_file_type_sync(file_path: String) -> Result<SniffResult, CommandError> {
    let dir = get_notes_dir()?;
    let path = guard_note_path(&dir, &file_path)?;
    if !path.exists() {
        return Err(CommandError::not_found(format!("File not found: {}", file_path)));
    }
    let is_binary = sniff_is_binary(&path)?;
    let size = fs::metadata(&path)
        .map_err(|e| CommandError::from(e).with_prefix("Failed to stat file"))?
        .len();
    Ok(SniffResult {
        is_binary,
        file_size: size,
        last_modified: file_last_modified(&path),
    })
}

#[tauri::command]
pub async fn get_notes_dir_path() -> Result<String, CommandError> {
    blocking(get_notes_dir_path_sync).await
}

fn get_notes_dir_path_sync() -> Result<String, CommandError> {
    get_notes_dir().map(|p| p.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ErrorKind;
    use crate::utils::config::CONFIG_DIR_TEST_LOCK;
    use uuid::Uuid;

    /// Holds the process-wide config-dir lock and points APINOX_CONFIG_DIR at a
    /// fresh temp directory. `resolve_config_dir()` reads a process-global env
    /// var, so the lock must be held for the whole test (`scrapbook_storage` uses
    /// the same pattern).
    struct NotesTestEnv {
        _guard: std::sync::MutexGuard<'static, ()>,
        dir: PathBuf,
    }

    impl NotesTestEnv {
        fn new() -> Self {
            let _guard = CONFIG_DIR_TEST_LOCK
                .lock()
                .unwrap_or_else(|p| p.into_inner());
            let dir = std::env::temp_dir().join(format!("apinox-notes-test-{}", Uuid::new_v4()));
            fs::create_dir_all(&dir).expect("create temp config dir");
            std::env::set_var("APINOX_CONFIG_DIR", &dir);
            fs::create_dir_all(dir.join("notes")).expect("create notes dir");
            Self { _guard, dir }
        }

        fn notes_dir(&self) -> PathBuf {
            self.dir.join("notes")
        }
    }

    /// The emitter is a closure seam so the mutation logic is testable without an
    /// `AppHandle`.
    fn no_emit(_: &NotesIndex) {}

    fn entry(id: &str, file_path: &Path, is_managed: bool) -> NoteEntry {
        NoteEntry {
            id: id.to_string(),
            name: file_path.file_name().unwrap().to_string_lossy().to_string(),
            file_path: file_path.to_string_lossy().to_string(),
            language: "plaintext".to_string(),
            is_binary: false,
            is_managed,
            last_modified: String::new(),
            created_at: String::new(),
        }
    }

    #[test]
    fn guard_rejects_a_managed_path_that_escapes_through_dot_dot() {
        let env = NotesTestEnv::new();
        let notes = env.notes_dir();
        let escaped = notes.join("..").join("evil.txt");

        // The premise of the guard: component comparison still presents this as
        // managed, even though it resolves outside the notes directory.
        assert!(escaped.starts_with(&notes));

        let err = guard_note_path(&notes, &escaped.to_string_lossy()).unwrap_err();
        // The kind is what the frontend branches on, so it must survive — a plain
        // String error would have landed as `Internal`.
        assert_eq!(err.kind, ErrorKind::InvalidInput);
        assert!(
            err.message.contains(".."),
            "guard must name the traversal component: {}",
            err.message
        );
    }

    #[test]
    fn guard_allows_plain_managed_paths_and_genuine_external_notes() {
        let env = NotesTestEnv::new();
        let notes = env.notes_dir();

        assert!(guard_note_path(&notes, &notes.join("Design.md").to_string_lossy()).is_ok());
        // An external note is deliberately outside the notes directory — that is
        // the feature, so it must not be rejected.
        assert!(guard_note_path(&notes, "/home/mark/scratch.md").is_ok());
    }

    #[test]
    fn delete_note_never_removes_a_file_outside_the_notes_dir() {
        let env = NotesTestEnv::new();
        let outside = env.dir.join("not-a-note.txt");
        fs::write(&outside, "keep me").expect("write outside file");

        // The client claims this entry is managed; the path says otherwise, and
        // the path wins.
        upsert_note_index_sync(&entry("note-1", &outside, true), &no_emit).expect("seed index");
        delete_note_sync("note-1", &no_emit).expect("delete must not error");

        assert!(outside.exists(), "a file outside the notes dir must survive");
    }

    #[test]
    fn delete_note_removes_a_file_that_really_is_managed() {
        let env = NotesTestEnv::new();
        let notes = env.notes_dir();
        let managed = notes.join("Design.md");
        fs::write(&managed, "# hi").expect("write managed note");

        upsert_note_index_sync(&entry("note-2", &managed, true), &no_emit).expect("seed index");
        delete_note_sync("note-2", &no_emit).expect("delete");

        assert!(!managed.exists(), "managed note must be removed");
    }

    #[test]
    fn rename_note_sanitizes_the_name_so_it_cannot_escape_the_notes_dir() {
        let env = NotesTestEnv::new();
        let notes = env.notes_dir();
        let managed = notes.join("Design.md");
        fs::write(&managed, "# hi").expect("write managed note");

        upsert_note_index_sync(&entry("note-3", &managed, true), &no_emit).expect("seed index");
        let updated = rename_note_sync("note-3", "../escaped", &no_emit).expect("rename");

        let new_path = PathBuf::from(&updated.file_path);
        assert!(new_path.starts_with(&notes), "renamed file must stay inside the notes dir: {}", new_path.display());
        assert!(!new_path.components().any(|c| matches!(c, Component::ParentDir)));
        assert!(new_path.exists(), "the file must have been moved to the sanitized name");
    }

    #[test]
    fn rename_note_leaves_an_external_note_on_disk_where_it_is() {
        let env = NotesTestEnv::new();
        let external = env.dir.join("scratch.md");
        fs::write(&external, "hi").expect("write external note");

        upsert_note_index_sync(&entry("note-4", &external, false), &no_emit).expect("seed index");
        let updated = rename_note_sync("note-4", "Renamed", &no_emit).expect("rename");

        // Only the index name changes; the user's file is not moved.
        assert_eq!(updated.file_path, external.to_string_lossy());
        assert_eq!(updated.name, "Renamed");
        assert!(external.exists(), "external file must not be moved");
    }

    #[test]
    fn delete_note_errors_for_an_unknown_id() {
        // The binding must be named: it holds the config-dir lock for the whole
        // test, and redirects APINOX_CONFIG_DIR.
        let _env = NotesTestEnv::new();
        // A missing id used to be a silent Ok(()) — the caller could not tell a
        // no-op from a delete.
        let err = delete_note_sync("nope", &no_emit).unwrap_err();
        assert_eq!(err.kind, ErrorKind::NotFound);
    }

    #[test]
    fn a_corrupt_index_errors_instead_of_being_replaced_and_clobbered() {
        let env = NotesTestEnv::new();
        let notes = env.notes_dir();
        let index_path = notes.join("index.json");
        fs::write(&index_path, "{ this is not valid json ]").expect("write corrupt index");

        let err = load_index(&index_path).unwrap_err();
        assert_eq!(err.kind, ErrorKind::Serialization);

        // The read path must not write the default index back over the user's file.
        let still_corrupt = fs::read_to_string(&index_path).expect("re-read");
        assert_eq!(still_corrupt, "{ this is not valid json ]");
    }

    #[test]
    fn concurrent_index_writes_do_not_lose_updates() {
        let env = NotesTestEnv::new();
        let notes = env.notes_dir();

        // These commands run on the blocking pool. Without the index lock each
        // writer loads the same starting index and the last save drops the
        // others' entries.
        let handles: Vec<_> = (1..=8)
            .map(|i| {
                let dir = notes.clone();
                std::thread::spawn(move || {
                    let path = dir.join(format!("note-{}.md", i));
                    update_index(&dir, &no_emit, |index| {
                        index.entries.push(entry(&format!("note-{}", i), &path, true));
                        Ok(())
                    })
                })
            })
            .collect();

        for h in handles {
            h.join().expect("thread panicked").expect("update_index failed");
        }

        let index = load_index(&notes.join("index.json")).expect("read index");
        assert_eq!(index.entries.len(), 8, "every concurrent write must survive");
    }

    #[test]
    fn update_index_pushes_the_authoritative_index_through_the_emitter() {
        let env = NotesTestEnv::new();
        let notes = env.notes_dir();
        let emitted = std::sync::Mutex::new(Vec::new());

        update_index(
            &notes,
            &|index| emitted.lock().unwrap().push(index.entries.len()),
            |index| {
                index.entries.push(entry("note-5", &notes.join("x.md"), true));
                Ok(())
            },
        )
        .expect("update");

        assert_eq!(emitted.lock().unwrap().as_slice(), &[1usize]);
    }

    #[test]
    fn notes_updated_payload_matches_the_shape_the_frontend_reads() {
        let mut index = NotesIndex::default();
        index.entries.push(entry("note-6", &PathBuf::from("/x/y.md"), true));

        let payload = notes_updated_payload(&index);
        // bridge.ts dispatches on `message.command`; NotesContext reads
        // `message.entries`, and the entry fields are camelCase.
        assert_eq!(payload["command"], "notesUpdated");
        assert_eq!(payload["entries"].as_array().unwrap().len(), 1);
        assert_eq!(payload["entries"][0]["filePath"], "/x/y.md");
    }

    #[test]
    fn load_note_bytes_rejects_a_file_over_the_cap() {
        let env = NotesTestEnv::new();
        let notes = env.notes_dir();
        let big = notes.join("big.bin");
        fs::write(&big, vec![0u8; (MAX_NOTE_BYTES + 1) as usize]).expect("write big file");

        let err = load_note_bytes_sync(big.to_string_lossy().to_string()).unwrap_err();
        assert_eq!(err.kind, ErrorKind::InvalidInput);
        assert!(err.message.contains("too large"), "{}", err.message);
    }

    #[test]
    fn load_note_content_rejects_a_file_over_the_cap() {
        let env = NotesTestEnv::new();
        let notes = env.notes_dir();
        let big = notes.join("big.md");
        fs::write(&big, vec![b'a'; (MAX_NOTE_BYTES + 1) as usize]).expect("write big file");

        let err = load_note_content_sync(big.to_string_lossy().to_string()).unwrap_err();
        assert_eq!(err.kind, ErrorKind::InvalidInput);
        assert!(err.message.contains("too large"), "{}", err.message);
    }

    #[test]
    fn save_rejects_a_payload_over_the_cap() {
        let env = NotesTestEnv::new();
        let notes = env.notes_dir();

        let err = check_write_size(MAX_NOTE_BYTES as usize + 1, &notes.join("x.md")).unwrap_err();
        assert_eq!(err.kind, ErrorKind::InvalidInput);
        assert!(check_write_size(1024, &notes.join("x.md")).is_ok());
    }

    #[test]
    fn sniff_reports_the_true_size_even_when_over_the_cap() {
        let env = NotesTestEnv::new();
        let notes = env.notes_dir();
        let big = notes.join("big.bin");
        fs::write(&big, vec![0u8; (MAX_NOTE_BYTES + 1) as usize]).expect("write big file");

        // Sniffing only stats + reads 512 bytes, so it must still report the real
        // size — the UI needs it to explain why the load was refused.
        let result = sniff_file_type_sync(big.to_string_lossy().to_string()).expect("sniff");
        assert!(result.is_binary);
        assert_eq!(result.file_size, MAX_NOTE_BYTES + 1);
    }

    // ── Atomic writes ─────────────────────────────────────────────────────────
    //
    // The helper itself is tested in `utils/atomic_write.rs`; these guard the
    // notes call sites, which is where a regression would actually happen.

    #[test]
    fn save_index_writes_atomically_and_leaves_only_index_json() {
        let env = NotesTestEnv::new();
        let notes = env.notes_dir();
        let index_path = get_index_path(&notes);

        let mut index = NotesIndex::default();
        index.entries.push(entry("id-1", &notes.join("a.md"), true));
        save_index(&index_path, &index).expect("save_index");

        let left: Vec<_> = fs::read_dir(&notes).unwrap().collect();
        assert_eq!(left.len(), 1, "a temp file was left behind");

        let reloaded = load_index(&index_path).expect("load_index");
        assert_eq!(reloaded.entries.len(), 1);
    }

    #[test]
    fn save_note_writes_atomically_and_leaves_only_the_note() {
        let env = NotesTestEnv::new();
        let notes = env.notes_dir();
        let target = notes.join("note.md");

        save_note_sync(target.to_string_lossy().to_string(), "# hello".to_string())
            .expect("save_note");

        assert_eq!(fs::read(&target).unwrap(), b"# hello");
        let left: Vec<_> = fs::read_dir(&notes).unwrap().collect();
        assert_eq!(left.len(), 1, "a temp file was left behind");
    }
}
