//! Global test-suite store (C: suites are no longer per-project).
//!
//! Test suites live in a single `~/.apinox/test-suites.json` (mirroring the
//! scrapbook: one global JSON file, whole suite objects as opaque blobs).
//! This is safe because a test step embeds a full `ApiRequest` copy in
//! `config.request` — suites are self-contained and never resolve against a
//! project at runtime.
//!
//! Historical layout: suites used to live in each project's `tests/` subdir
//! (`UnifiedProject.testSuites`). `migrate_all_project_suites_to_global`
//! moves them into the global store once, idempotently by suite id, and the
//! caller is expected to drop them from the project (the webview rewires its
//! suite reads/writes to this store).
use std::fs;
use std::path::{Path, PathBuf};

/// Global test-suite file — stores suites as raw JSON to preserve all
/// frontend fields (testCases/steps/config round-trip byte-for-byte).
#[derive(Debug, serde::Serialize, serde::Deserialize, Default)]
struct TestSuiteStore {
    suites: Vec<serde_json::Value>,
}

/// Get path to test-suites.json (same config-dir resolution as scrapbook).
fn get_test_suites_path() -> Result<PathBuf, String> {
    let home_dir = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory")?;

    // Test override: honor APINOX_CONFIG_DIR if set (mirrors resolve_config_dir).
    if let Ok(dir) = std::env::var("APINOX_CONFIG_DIR") {
        let trimmed = dir.trim().to_string();
        if !trimmed.is_empty() {
            let p = PathBuf::from(trimmed);
            if !p.exists() {
                fs::create_dir_all(&p).map_err(|e| format!("Failed to create config directory: {}", e))?;
            }
            return Ok(p.join("test-suites.json"));
        }
    }

    let config_dir = PathBuf::from(&home_dir).join(".apinox");

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    Ok(config_dir.join("test-suites.json"))
}

/// Load the global store from disk (missing/corrupt → empty, no error).
fn load_store(path: &PathBuf) -> TestSuiteStore {
    if !path.exists() {
        return TestSuiteStore::default();
    }
    match fs::read_to_string(path) {
        Ok(content) => match serde_json::from_str(&content) {
            Ok(data) => data,
            Err(e) => {
                log::error!("Failed to parse test-suites file: {}. Starting empty.", e);
                TestSuiteStore::default()
            }
        },
        Err(e) => {
            log::error!("Failed to read test-suites file: {}. Starting empty.", e);
            TestSuiteStore::default()
        }
    }
}

/// Save the global store to disk.
fn save_store(path: &PathBuf, data: &TestSuiteStore) -> Result<(), String> {
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize test suites: {}", e))?;
    fs::write(path, content)
        .map_err(|e| format!("Failed to write test-suites file: {}", e))?;
    log::info!("Saved global test suites ({} suite(s))", data.suites.len());
    Ok(())
}

/// Read the global test-suite store as the raw `{ "suites": [...] }` document
/// the file actually holds, for the startup workflow migration (no per-suite
/// deserialization — the store is an opaque blob).
pub(crate) fn load_suites_document() -> Result<serde_json::Value, String> {
    let path = get_test_suites_path()?;
    let store = load_store(&path);
    Ok(serde_json::json!({ "suites": store.suites }))
}

/// Write a raw `{ "suites": [...] }` document back through the store's own
/// save path so the on-disk shape is unchanged (straight replacement).
pub(crate) fn save_suites_document(document: &serde_json::Value) -> Result<(), String> {
    let path = get_test_suites_path()?;
    let suites = document
        .get("suites")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    save_store(&path, &TestSuiteStore { suites })
}

/// Get all global test suites.
#[tauri::command]
pub async fn get_test_suites() -> Result<Vec<serde_json::Value>, String> {
    let path = get_test_suites_path()?;
    let data = load_store(&path);
    Ok(data.suites)
}

/// Replace the entire global store with the given suites (the webview owns
/// the suite list and persists atomically — mirroring how `save_unified_project`
/// takes a whole project).
#[tauri::command]
pub async fn save_test_suites(suites: Vec<serde_json::Value>) -> Result<Vec<serde_json::Value>, String> {
    let path = get_test_suites_path()?;
    let data = TestSuiteStore { suites };
    save_store(&path, &data)?;
    // Return the value we just persisted instead of re-reading + re-parsing the
    // whole file back (which serializes full embedded request copies per suite).
    Ok(data.suites)
}

// ============================================================================
// File import/export (right-click menu: "Export Suite" / "Export Test Case" /
// "Import Suite" / "Import Test Case").
//
// Mirrors the workflow file IO split (workflow/commands.rs): the webview owns
// the native save/open dialogs and the in-app store; Rust only reads/writes
// the standalone JSON file. Exports re-source the object from the global
// store by id (canonical persisted blob, same as export_workflow_to_file);
// imports parse + shape-check only — the webview re-keys ids and adds to the
// store (so an import is always an ADD, never a silent replace).
// ============================================================================

/// Export a single test suite to a file.
///
/// Looks the suite up by id in the global store and writes its JSON to the
/// target path as a standalone `.json` (for version control / sharing)
/// without touching the in-app store.
#[tauri::command]
pub async fn export_test_suite_to_file(suite_id: String, file_path: String) -> Result<(), String> {
    log::info!(
        "export_test_suite_to_file: Exporting suite '{}' to {}",
        suite_id,
        file_path
    );

    if suite_id.is_empty() {
        return Err("Suite ID required".to_string());
    }

    let path = get_test_suites_path()?;
    let data = load_store(&path);

    let suite = data
        .suites
        .iter()
        .find(|s| s.get("id").and_then(|v| v.as_str()) == Some(suite_id.as_str()))
        .ok_or_else(|| format!("Test suite '{}' not found", suite_id))?;

    let json_content = serde_json::to_string_pretty(suite)
        .map_err(|e| format!("Failed to serialize test suite: {}", e))?;

    std::fs::write(&file_path, json_content)
        .map_err(|e| format!("Failed to write test suite file: {}", e))?;

    log::info!(
        "export_test_suite_to_file: Wrote suite '{}' to {}",
        suite_id,
        file_path
    );
    Ok(())
}

/// Export a single test case to a file.
///
/// Finds the case by id across the global store's suites (cases are unique
/// by id) and writes the case object (steps included) to the target path.
#[tauri::command]
pub async fn export_test_case_to_file(case_id: String, file_path: String) -> Result<(), String> {
    log::info!(
        "export_test_case_to_file: Exporting case '{}' to {}",
        case_id,
        file_path
    );

    if case_id.is_empty() {
        return Err("Case ID required".to_string());
    }

    let path = get_test_suites_path()?;
    let data = load_store(&path);

    let case = data
        .suites
        .iter()
        .find_map(|suite| {
            suite
                .get("testCases")
                .and_then(|v| v.as_array())
                .and_then(|cases| {
                    cases
                        .iter()
                        .find(|c| c.get("id").and_then(|v| v.as_str()) == Some(case_id.as_str()))
                })
        })
        .ok_or_else(|| format!("Test case '{}' not found", case_id))?;

    let json_content = serde_json::to_string_pretty(case)
        .map_err(|e| format!("Failed to serialize test case: {}", e))?;

    std::fs::write(&file_path, json_content)
        .map_err(|e| format!("Failed to write test case file: {}", e))?;

    log::info!(
        "export_test_case_to_file: Wrote case '{}' to {}",
        case_id,
        file_path
    );
    Ok(())
}

/// Read a test-suite JSON file from disk, shape-check it and return it so the
/// webview can import it into the global store (right-click "Import Suite").
///
/// Thin by design (parse + shape check only, mirrors import_workflow_from_file):
/// the webview re-keys every id and adds the suite to the store. `name` must
/// be a string; a missing/non-array `testCases` is normalized to `[]` and a
/// missing `variables` stays absent (the webview treats it as `Record<string,string>`).
#[tauri::command]
pub async fn import_test_suite_from_file(file_path: String) -> Result<serde_json::Value, String> {
    log::info!("import_test_suite_from_file: Loading suite from {}", file_path);

    let json_content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read test suite file: {}", e))?;

    let mut suite: serde_json::Value = serde_json::from_str(&json_content)
        .map_err(|e| format!("Failed to parse test suite JSON: {}", e))?;

    if !suite.is_object() {
        return Err("Test suite file must contain a JSON object".to_string());
    }
    let name = suite
        .get("name")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .ok_or_else(|| "Test suite file must have a string 'name' field".to_string())?;

    // Normalize `testCases` to an array (a hand-edited file may omit it).
    if suite.get("testCases").map_or(true, |v| !v.is_array()) {
        suite["testCases"] = serde_json::Value::Array(Vec::new());
    }

    log::info!(
        "import_test_suite_from_file: Loaded suite '{}' with {} case(s)",
        name,
        suite.get("testCases").and_then(|v| v.as_array()).map_or(0, |a| a.len())
    );
    Ok(suite)
}

/// Read a test-case JSON file from disk, shape-check it and return it so the
/// webview can add it to a suite (right-click "Import Test Case"). Same thin
/// contract as `import_test_suite_from_file` — the webview re-keys ids.
#[tauri::command]
pub async fn import_test_case_from_file(file_path: String) -> Result<serde_json::Value, String> {
    log::info!("import_test_case_from_file: Loading case from {}", file_path);

    let json_content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read test case file: {}", e))?;

    let mut case: serde_json::Value = serde_json::from_str(&json_content)
        .map_err(|e| format!("Failed to parse test case JSON: {}", e))?;

    if !case.is_object() {
        return Err("Test case file must contain a JSON object".to_string());
    }
    let name = case
        .get("name")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .ok_or_else(|| "Test case file must have a string 'name' field".to_string())?;

    // Normalize `steps` to an array (a hand-edited file may omit it).
    if case.get("steps").map_or(true, |v| !v.is_array()) {
        case["steps"] = serde_json::Value::Array(Vec::new());
    }

    log::info!(
        "import_test_case_from_file: Loaded case '{}' with {} step(s)",
        name,
        case.get("steps").and_then(|v| v.as_array()).map_or(0, |a| a.len())
    );
    Ok(case)
}

/// Read one project's suites from its `tests/` subdir (the historical layout):
/// `tests/{suite}/suite.json` plus per-case `case.json` bodies, merged into the
/// same `TestSuite` shape the webview used to receive.
fn read_project_suites_dir(tests_dir: &Path) -> Vec<serde_json::Value> {
    let mut suites = Vec::new();
    let Ok(entries) = fs::read_dir(tests_dir) else {
        return suites;
    };
    let mut suite_dirs: Vec<PathBuf> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.is_dir())
        .collect();
    suite_dirs.sort();
    for suite_dir in suite_dirs {
        let suite_json = suite_dir.join("suite.json");
        let Ok(content) = fs::read_to_string(&suite_json) else {
            continue;
        };
        let Ok(mut suite) = serde_json::from_str::<serde_json::Value>(&content) else {
            log::warn!("Skipping unparseable suite.json: {}", suite_json.display());
            continue;
        };
        // suite.json historically carries only {id, name}; test case bodies
        // live in per-case case.json files. Merge them in so the migrated
        // suite is complete (the webview's old load path did the same merge
        // inside `load_test_suites_from_dir`).
        let mut cases: Vec<serde_json::Value> = suite
            .get("testCases")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        if let Ok(case_entries) = fs::read_dir(&suite_dir) {
            let mut case_dirs: Vec<PathBuf> = case_entries
                .flatten()
                .map(|e| e.path())
                .filter(|p| p.is_dir())
                .collect();
            case_dirs.sort();
            for case_dir in case_dirs {
                let case_json = case_dir.join("case.json");
                let Ok(c_content) = fs::read_to_string(&case_json) else {
                    continue;
                };
                let Ok(mut case) = serde_json::from_str::<serde_json::Value>(&c_content) else {
                    continue;
                };
                // Keep any steps/fields the case file carries; fill name/id
                // defaults if absent (defensive — the layout always writes them).
                if case.get("name").is_none() {
                    case["name"] = case_dir
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("case")
                        .to_string()
                        .into();
                }
                cases.push(case);
            }
        }
        suite["testCases"] = serde_json::Value::Array(cases);
        suites.push(suite);
    }
    suites
}

/// One-time, idempotent migration: for every project that still has a
/// `tests/` subdir, move its suites into the global store (deduped by suite
/// id) and return the moved suite names per project. Callers then drop the
/// local suites from the project so they are not persisted twice.
#[tauri::command]
pub async fn migrate_all_project_suites_to_global() -> Result<
    Vec<serde_json::Value>,
    String,
> {
    let base = crate::project_storage::projects_dir()?;
    let path = get_test_suites_path()?;
    let mut data = load_store(&path);
    let mut already: std::collections::HashSet<String> = data
        .suites
        .iter()
        .filter_map(|s| s.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .collect();

    let mut moved: Vec<serde_json::Value> = Vec::new();
    let Ok(entries) = fs::read_dir(&base) else {
        return Ok(moved);
    };
    for entry in entries.flatten() {
        let dir = entry.path();
        if !dir.is_dir() {
            continue;
        }
        let tests_dir = dir.join("tests");
        if !tests_dir.is_dir() {
            continue;
        }
        let suite_dir_name = dir
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let local = read_project_suites_dir(&tests_dir);
        if local.is_empty() {
            continue;
        }
        let mut project_moved = Vec::new();
        for suite in local {
            let id = suite
                .get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| format!("suite-migrated-{}", uuid::Uuid::new_v4()));
            if already.contains(&id) {
                continue; // already in the global store — idempotent skip
            }
            let mut s = suite.clone();
            s["id"] = serde_json::Value::String(id.clone());
            already.insert(id.clone());
            data.suites.push(s);
            project_moved.push(serde_json::json!({
                "suiteId": id,
                "name": suite.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            }));
        }
        if !project_moved.is_empty() {
            moved.push(serde_json::json!({
                "project": suite_dir_name,
                "moved": project_moved,
            }));
            // The suites now live in the global store. Remove the project-local
            // `tests/` dir so it can't be re-migrated next launch and so
            // `save_unified_project` never re-persists stale per-project suites.
            let _ = fs::remove_dir_all(&tests_dir);
        }
    }
    if !moved.is_empty() {
        save_store(&path, &data)?;
    }
    Ok(moved)
}

/// Merge a project's in-memory `testSuites` array into the global store,
/// idempotently by suite id.
///
/// WHY THIS EXISTS: `save_unified_project` no longer writes the project-local
/// `tests/` subdir (the global store owns suites — C). But the legacy→unified
/// migration and the import flows (`save_imported_project_as_unified`) still
/// carry the historical suites in `project["testSuites"]` in memory. Without
/// this merge, a migrated or imported project would LOSE its suites on the
/// next unified save. Merging them into the global store here (before the
/// `tests/` cleanup) makes those paths data-loss-free: every unified save
/// routes the project's suites to the canonical global store, deduped by id.
///
/// No-op when the project carries no new suites (the common post-migration
/// case, where the webview no longer sets `testSuites` on project saves).
pub(crate) fn merge_project_suites_into_global(
    project: &serde_json::Value,
) -> Result<usize, String> {
    let incoming = project
        .get("testSuites")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    if incoming.is_empty() {
        return Ok(0);
    }

    let path = get_test_suites_path()?;
    let mut data = load_store(&path);
    let mut already: std::collections::HashSet<String> = data
        .suites
        .iter()
        .filter_map(|s| s.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .collect();

    let mut added = 0usize;
    for suite in incoming {
        let id = suite
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("suite-merged-{}", uuid::Uuid::new_v4()));
        if already.contains(&id) {
            continue; // already global — idempotent skip
        }
        let mut s = suite.clone();
        s["id"] = serde_json::Value::String(id.clone());
        already.insert(id);
        data.suites.push(s);
        added += 1;
    }

    if added > 0 {
        save_store(&path, &data)?;
        log::info!(
            "merge_project_suites_into_global: moved {} suite(s) into the global store",
            added
        );
    }
    Ok(added)
}

// ============================================================================
// Tests — global test-suites.json schema round-trip + idempotent migration.
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::config::CONFIG_DIR_TEST_LOCK;
    use serde_json::json;
    use uuid::Uuid;

    struct SuiteTestEnv {
        _guard: std::sync::MutexGuard<'static, ()>,
        dir: std::path::PathBuf,
    }

    impl SuiteTestEnv {
        fn new(dir_name: &str, initial_content: Option<&str>) -> Self {
            let _guard = CONFIG_DIR_TEST_LOCK
                .lock()
                .unwrap_or_else(|p| p.into_inner());
            let dir = std::env::temp_dir().join(format!(
                "apinox-test-suites-{}-{}",
                dir_name,
                Uuid::new_v4()
            ));
            std::fs::create_dir_all(&dir).expect("create temp config dir");
            std::env::set_var("APINOX_CONFIG_DIR", &dir);
            if let Some(content) = initial_content {
                std::fs::write(dir.join("test-suites.json"), content).expect("write fixture");
            }
            Self { _guard, dir }
        }

        fn suites_path(&self) -> std::path::PathBuf {
            self.dir.join("test-suites.json")
        }
    }

    fn fixture_suite(id: &str, name: &str) -> serde_json::Value {
        json!({
            "id": id,
            "name": name,
            "testCases": [
                {
                    "id": format!("case-{}", id),
                    "name": "Case 1",
                    "steps": [
                        {
                            "id": "step-1",
                            "name": "Step 1",
                            "type": "request",
                            "config": {
                                "request": {
                                    "name": "Req",
                                    "request": "<GetThing/>",
                                    "endpoint": "http://example.com/svc"
                                }
                            }
                        }
                    ]
                }
            ]
        })
    }

    /// Schema round-trip: suites written to the global file load back UNCHANGED
    /// (opaque-blob passthrough — every nested field preserved).
    #[tokio::test]
    async fn test_suites_round_trip_fixture_loads_unchanged() {
        let env = SuiteTestEnv::new("roundtrip", None);
        let a = fixture_suite("s-a", "Suite A");
        let b = fixture_suite("s-b", "Suite B");
        let saved = save_test_suites(vec![a.clone(), b.clone()])
            .await
            .expect("save");
        assert_eq!(saved.len(), 2);

        let loaded = get_test_suites().await.expect("get");
        assert_eq!(loaded, vec![a, b], "round-trip must preserve every field");

        // A read must not modify the on-disk file.
        let on_disk = serde_json::from_str::<serde_json::Value>(
            &std::fs::read_to_string(env.suites_path()).unwrap(),
        )
        .unwrap();
        assert_eq!(on_disk["suites"][0]["id"], "s-a");
        assert_eq!(on_disk["suites"][1]["testCases"][0]["steps"][0]["config"]["request"]["endpoint"], "http://example.com/svc");
    }

    /// Missing file → empty list, no error.
    #[tokio::test]
    async fn test_missing_store_returns_empty() {
        let env = SuiteTestEnv::new("missing", None);
        assert!(!env.suites_path().exists());
        let suites = get_test_suites().await.expect("get");
        assert!(suites.is_empty());
    }

    /// Corrupt file → empty list, no error, file left in place.
    #[tokio::test]
    async fn test_corrupt_store_returns_empty() {
        let env = SuiteTestEnv::new("corrupt", Some("{ not json ]"));
        let suites = get_test_suites().await.expect("get");
        assert!(suites.is_empty());
        assert_eq!(
            std::fs::read_to_string(env.suites_path()).unwrap(),
            "{ not json ]"
        );
    }

    /// Migration: a project `tests/{suite}/suite.json` (+ per-case case.json)
    /// is read whole and landed in the global store; a second migration run
    /// moves nothing (idempotent by id).
    #[tokio::test]
    async fn test_migrate_project_suites_idempotent() {
        let env = SuiteTestEnv::new("migrate", None);
        // `projects_dir()` = <APINOX_CONFIG_DIR>/projects (created if absent).
        // Point it at a fresh parent and drop a project with a tests/ subtree.
        let cfg_parent = std::env::temp_dir().join(format!(
            "apinox-test-suites-migrate-cfg-{}",
            Uuid::new_v4()
        ));
        let proj = cfg_parent.join("projects").join("ProjX");
        std::fs::create_dir_all(proj.join("tests").join("Suite 1").join("Case 1")).unwrap();
        std::fs::write(
            proj.join("tests").join("Suite 1").join("suite.json"),
            r#"{ "id": "suite-x", "name": "Suite 1" }"#,
        )
        .unwrap();
        std::fs::write(
            proj.join("tests").join("Suite 1").join("Case 1").join("case.json"),
            r#"{ "id": "case-x", "name": "Case 1", "steps": [ { "id": "st-1", "name": "S", "type": "request", "config": { "request": { "name": "R", "request": "<x/>" } } } ] }"#,
        )
        .unwrap();
        std::env::set_var("APINOX_CONFIG_DIR", &cfg_parent);

        let first = migrate_all_project_suites_to_global()
            .await
            .expect("migrate #1");
        assert_eq!(first.len(), 1, "one project with suites");
        assert_eq!(first[0]["project"], "ProjX");
        assert_eq!(first[0]["moved"][0]["suiteId"], "suite-x");

        let stored = get_test_suites().await.expect("get");
        assert_eq!(stored.len(), 1);
        assert_eq!(stored[0]["id"], "suite-x");
        // Case body was merged in (historical layout keeps it in case.json).
        assert_eq!(stored[0]["testCases"][0]["name"], "Case 1");
        assert_eq!(stored[0]["testCases"][0]["steps"][0]["config"]["request"]["request"], "<x/>");

        // Second run: nothing new to move (idempotent by id).
        let second = migrate_all_project_suites_to_global()
            .await
            .expect("migrate #2");
        assert!(second.is_empty(), "second migration must be a no-op");
        assert_eq!(get_test_suites().await.unwrap().len(), 1);
        // The project-local tests/ dir is removed after the move (the
        // per-project suite path is dead — no re-migration, no re-persist).
        assert!(
            !proj.join("tests").exists(),
            "migrated project's tests/ dir must be removed"
        );
        let _ = env; // hold the config lock for the test's lifetime
    }

    /// File round-trip: a stored suite exports to disk and imports back with
    /// every field intact (the webview re-keys ids, so the exported id is
    /// preserved in the file and returned verbatim on import).
    #[tokio::test]
    async fn test_suite_export_import_round_trip() {
        let env = SuiteTestEnv::new("suite-file-rt", None);
        let a = fixture_suite("s-a", "Suite A");
        save_test_suites(vec![a.clone()]).await.expect("save");

        let out = env.dir.join("exported-suite.json");
        export_test_suite_to_file("s-a".into(), out.to_string_lossy().into())
            .await
            .expect("export suite");

        let on_disk: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(&out).unwrap(),
        )
        .unwrap();
        assert_eq!(on_disk, a, "exported file must equal the stored blob");

        let imported = import_test_suite_from_file(out.to_string_lossy().into())
            .await
            .expect("import suite");
        assert_eq!(imported, a, "imported suite must round-trip unchanged");

        // Exporting an unknown id is an error (not a silent empty write).
        let missing = env.dir.join("missing.json");
        let err = export_test_suite_to_file("nope".into(), missing.to_string_lossy().into())
            .await
            .unwrap_err();
        assert!(err.contains("not found"), "unexpected error: {}", err);
        assert!(!missing.exists(), "failed export must not leave a file behind");
    }

    /// File round-trip for a single case: exported from its suite, imported
    /// back with steps + config intact; a case id in another suite is found
    /// by searching all suites.
    #[tokio::test]
    async fn test_case_export_import_round_trip() {
        let env = SuiteTestEnv::new("case-file-rt", None);
        let a = fixture_suite("s-a", "Suite A");
        let b = fixture_suite("s-b", "Suite B");
        save_test_suites(vec![a, b]).await.expect("save");

        let out = env.dir.join("exported-case.json");
        // case-s-b lives in the SECOND suite — the search must span suites.
        export_test_case_to_file("case-s-b".into(), out.to_string_lossy().into())
            .await
            .expect("export case");

        let on_disk: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(&out).unwrap(),
        )
        .unwrap();
        assert_eq!(on_disk["id"], "case-s-b");
        assert_eq!(on_disk["name"], "Case 1");
        assert_eq!(
            on_disk["steps"][0]["config"]["request"]["endpoint"],
            "http://example.com/svc"
        );

        let imported = import_test_case_from_file(out.to_string_lossy().into())
            .await
            .expect("import case");
        assert_eq!(imported, on_disk, "imported case must round-trip unchanged");

        let err = export_test_case_to_file("nope".into(), env.dir.join("missing.json").to_string_lossy().into())
            .await
            .unwrap_err();
        assert!(err.contains("not found"), "unexpected error: {}", err);
    }

    /// Import validation: a file must hold a JSON object with a string
    /// `name`; missing `testCases`/`steps` are normalized to `[]` (a
    /// hand-edited file is still importable).
    #[tokio::test]
    async fn test_import_file_shape_checks() {
        let env = SuiteTestEnv::new("import-shape", None);

        let ok_suite = env.dir.join("suite-ok.json");
        std::fs::write(
            &ok_suite,
            r#"{ "id": "s-x", "name": "Hand Suite" }"#,
        )
        .unwrap();
        let imported = import_test_suite_from_file(ok_suite.to_string_lossy().into())
            .await
            .expect("import");
        assert_eq!(imported["name"], "Hand Suite");
        assert_eq!(
            imported["testCases"],
            serde_json::json!([]),
            "missing testCases must normalize to []"
        );

        let ok_case = env.dir.join("case-ok.json");
        std::fs::write(&ok_case, r#"{ "id": "c-x", "name": "Hand Case" }"#).unwrap();
        let imported = import_test_case_from_file(ok_case.to_string_lossy().into())
            .await
            .expect("import");
        assert_eq!(
            imported["steps"],
            serde_json::json!([]),
            "missing steps must normalize to []"
        );

        // No `name` → clear error.
        let no_name = env.dir.join("suite-noname.json");
        std::fs::write(&no_name, r#"{ "id": "s-y" }"#).unwrap();
        let err = import_test_suite_from_file(no_name.to_string_lossy().into())
            .await
            .unwrap_err();
        assert!(err.contains("'name'"), "unexpected error: {}", err);

        // Non-object → clear error.
        let not_object = env.dir.join("case-array.json");
        std::fs::write(&not_object, r#"[1, 2]"#).unwrap();
        let err = import_test_case_from_file(not_object.to_string_lossy().into())
            .await
            .unwrap_err();
        assert!(err.contains("JSON object"), "unexpected error: {}", err);

        // Unparseable JSON → clear error.
        let bad_json = env.dir.join("case-bad.json");
        std::fs::write(&bad_json, "{ not json ]").unwrap();
        let err = import_test_case_from_file(bad_json.to_string_lossy().into())
            .await
            .unwrap_err();
        assert!(err.contains("parse"), "unexpected error: {}", err);

        let _ = env;
    }
}
