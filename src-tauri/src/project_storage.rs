use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use crate::utils::resolve_config_dir;

/// Returns the ~/.apinox/projects/ directory, creating it if needed.
fn projects_dir() -> Result<PathBuf, String> {
    let dir = resolve_config_dir()?.join("projects");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create projects directory: {}", e))?;
    Ok(dir)
}

/// Project metadata stored in properties.json
#[derive(Debug, Serialize, Deserialize)]
struct ProjectProperties {
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<String>,
    format: String,
}

/// Sanitize a name for use as a folder/file name
fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect()
}

/// Remove any subdirectories under `parent` whose names are not in `keep`.
fn cleanup_orphan_dirs(parent: &Path, keep: &std::collections::HashSet<String>) {
    if let Ok(entries) = fs::read_dir(parent) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    if !keep.contains(name) {
                        let _ = fs::remove_dir_all(path);
                    }
                }
            }
        }
    }
}

/// Collect the sanitized names of all items in a JSON array that have the given key.
fn sanitized_names(array: &[serde_json::Value], key: &str) -> std::collections::HashSet<String> {
    array
        .iter()
        .filter_map(|v| v[key].as_str())
        .map(sanitize_name)
        .collect()
}

/// Write `data` as pretty-printed JSON to `path`.
fn write_json(path: &Path, data: &serde_json::Value) -> Result<(), String> {
    let json = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize {}: {}", path.display(), e))?;
    fs::write(path, json)
        .map_err(|e| format!("Failed to write {}: {}", path.display(), e))
}

/// Save a project to disk.
///
/// The save location is always `~/.apinox/projects/{sanitized_name}/`.
/// Returns the absolute path to the project directory.
#[tauri::command]
pub async fn save_project(project: serde_json::Value) -> Result<String, String> {
    let name = project["name"]
        .as_str()
        .ok_or("Missing project name")?;
    let dir = projects_dir()?.join(sanitize_name(name));
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create project directory: {}", e))?;

    save_properties(&dir, &project)?;
    save_interfaces(&dir, &project)?;
    save_test_suites(&dir, &project)?;
    save_folders(&dir, &project)?;

    Ok(dir.to_string_lossy().to_string())
}

/// Write properties.json for a project.
fn save_properties(dir: &Path, project: &serde_json::Value) -> Result<(), String> {
    let props = ProjectProperties {
        name: project["name"]
            .as_str()
            .ok_or("Missing project name")?
            .to_string(),
        description: project["description"].as_str().map(|s| s.to_string()),
        id: project["id"].as_str().map(|s| s.to_string()),
        format: "APInox-v1".to_string(),
    };
    let props_val = serde_json::to_value(&props)
        .map_err(|e| format!("Failed to build properties value: {}", e))?;
    write_json(&dir.join("properties.json"), &props_val)
}

/// Save all interfaces, cleaning up orphaned directories.
fn save_interfaces(dir: &Path, project: &serde_json::Value) -> Result<(), String> {
    let interfaces_dir = dir.join("interfaces");
    fs::create_dir_all(&interfaces_dir)
        .map_err(|e| format!("Failed to create interfaces directory: {}", e))?;

    let interfaces = project["interfaces"]
        .as_array()
        .ok_or("Missing or invalid interfaces array")?;

    cleanup_orphan_dirs(&interfaces_dir, &sanitized_names(interfaces, "name"));

    for iface in interfaces {
        save_interface(iface, &interfaces_dir)?;
    }
    Ok(())
}

/// Save all test suites, cleaning up orphaned directories.
fn save_test_suites(dir: &Path, project: &serde_json::Value) -> Result<(), String> {
    let tests_dir = dir.join("tests");
    fs::create_dir_all(&tests_dir)
        .map_err(|e| format!("Failed to create tests directory: {}", e))?;

    if let Some(test_suites) = project["testSuites"].as_array() {
        cleanup_orphan_dirs(&tests_dir, &sanitized_names(test_suites, "name"));
        for suite in test_suites {
            save_test_suite(suite, &tests_dir)?;
        }
    }
    Ok(())
}

/// Save all folders, replacing any previously written folder files.
fn save_folders(dir: &Path, project: &serde_json::Value) -> Result<(), String> {
    let folders_dir = dir.join("folders");
    fs::create_dir_all(&folders_dir)
        .map_err(|e| format!("Failed to create folders directory: {}", e))?;

    // Replace all folder files on every save.
    if let Ok(entries) = fs::read_dir(&folders_dir) {
        for entry in entries.flatten() {
            if entry.path().is_file() {
                let _ = fs::remove_file(entry.path());
            }
        }
    }

    if let Some(folders) = project["folders"].as_array() {
        for (i, folder) in folders.iter().enumerate() {
            let path = folders_dir.join(format!("{:03}_folder.json", i + 1));
            write_json(&path, folder)?;
        }
    }
    Ok(())
}

/// List all projects saved in ~/.apinox/projects/.
/// Returns a sorted list of absolute directory paths.
#[tauri::command]
pub async fn list_projects() -> Result<Vec<String>, String> {
    let dir = projects_dir()?;
    let mut paths = Vec::new();

    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && path.join("properties.json").exists() {
                paths.push(path.to_string_lossy().to_string());
            }
        }
    }

    paths.sort();
    Ok(paths)
}

/// Save an interface to its directory
fn save_interface(iface: &serde_json::Value, interfaces_dir: &Path) -> Result<(), String> {
    let name = iface["name"]
        .as_str()
        .ok_or("Missing interface name")?;
    let safe_name = sanitize_name(name);
    let iface_dir = interfaces_dir.join(&safe_name);

    fs::create_dir_all(&iface_dir)
        .map_err(|e| format!("Failed to create interface directory: {}", e))?;

    write_json(&iface_dir.join("interface.json"), &serde_json::json!({
        "name": name,
        "type": iface["type"],
        "bindingName": iface["bindingName"],
        "soapVersion": iface["soapVersion"],
        "definition": iface["definition"],
        "displayName": iface["displayName"],
    }))?;

    let operations = iface["operations"]
        .as_array()
        .ok_or("Missing or invalid operations array")?;

    cleanup_orphan_dirs(&iface_dir, &sanitized_names(operations, "name"));

    for op in operations {
        save_operation(op, &iface_dir)?;
    }

    Ok(())
}

/// Save an operation to its directory
fn save_operation(op: &serde_json::Value, iface_dir: &Path) -> Result<(), String> {
    let name = op["name"].as_str().ok_or("Missing operation name")?;
    let safe_name = sanitize_name(name);
    let op_dir = iface_dir.join(&safe_name);

    fs::create_dir_all(&op_dir)
        .map_err(|e| format!("Failed to create operation directory: {}", e))?;

    write_json(&op_dir.join("operation.json"), &serde_json::json!({
        "name": name,
        "action": op["action"],
        "input": op["input"],
        "targetNamespace": op["targetNamespace"],
        "originalEndpoint": op["originalEndpoint"],
        "fullSchema": op["fullSchema"],
        "displayName": op["displayName"],
    }))?;

    let requests = op["requests"]
        .as_array()
        .ok_or("Missing or invalid requests array")?;

    // Cleanup orphaned request files (xml + json pairs by stem)
    let current_request_names = sanitized_names(requests, "name");
    if let Ok(entries) = fs::read_dir(&op_dir) {
        let mut existing_bases = std::collections::HashSet::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
                    if filename != "operation.json" {
                        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                            if ext == "xml" || ext == "json" {
                                if let Some(base) = path.file_stem().and_then(|s| s.to_str()) {
                                    existing_bases.insert(base.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
        for base in existing_bases {
            if !current_request_names.contains(&base) {
                let _ = fs::remove_file(op_dir.join(format!("{}.xml", base)));
                let _ = fs::remove_file(op_dir.join(format!("{}.json", base)));
            }
        }
    }

    for req in requests {
        save_request(req, &op_dir)?;
    }

    Ok(())
}

/// Save a request (body + metadata)
fn save_request(req: &serde_json::Value, op_dir: &Path) -> Result<(), String> {
    let name = req["name"].as_str().ok_or("Missing request name")?;
    let safe_name = sanitize_name(name);

    let body = req["request"].as_str().unwrap_or("");
    fs::write(op_dir.join(format!("{}.xml", safe_name)), body)
        .map_err(|e| format!("Failed to write request body: {}", e))?;

    write_json(&op_dir.join(format!("{}.json", safe_name)), &serde_json::json!({
        "name": name,
        "endpoint": req["endpoint"],
        "method": req["method"],
        "contentType": req["contentType"],
        "headers": req["headers"],
        "assertions": req["assertions"],
        "id": req["id"],
        "requestType": req["requestType"],
        "bodyType": req["bodyType"],
        "restConfig": req["restConfig"],
        "graphqlConfig": req["graphqlConfig"],
        "extractors": req["extractors"],
        "wsSecurity": req["wsSecurity"],
        "attachments": req["attachments"],
    }))
}

/// Save a test suite to its directory
fn save_test_suite(suite: &serde_json::Value, tests_dir: &Path) -> Result<(), String> {
    let name = suite["name"].as_str().ok_or("Missing test suite name")?;
    let safe_name = sanitize_name(name);
    let suite_dir = tests_dir.join(&safe_name);

    fs::create_dir_all(&suite_dir)
        .map_err(|e| format!("Failed to create test suite directory: {}", e))?;

    write_json(&suite_dir.join("suite.json"), &serde_json::json!({
        "id": suite["id"],
        "name": name,
    }))?;

    if let Some(test_cases) = suite["testCases"].as_array() {
        cleanup_orphan_dirs(&suite_dir, &sanitized_names(test_cases, "name"));
        for tc in test_cases {
            save_test_case(tc, &suite_dir)?;
        }
    }

    Ok(())
}

/// Save a test case to its directory
fn save_test_case(tc: &serde_json::Value, suite_dir: &Path) -> Result<(), String> {
    let name = tc["name"].as_str().ok_or("Missing test case name")?;
    let safe_name = sanitize_name(name);
    let case_dir = suite_dir.join(&safe_name);

    fs::create_dir_all(&case_dir)
        .map_err(|e| format!("Failed to create test case directory: {}", e))?;

    write_json(&case_dir.join("case.json"), &serde_json::json!({
        "id": tc["id"],
        "name": name,
    }))?;

    // Remove all existing step files before rewriting them in order.
    if let Ok(entries) = fs::read_dir(&case_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
                    if filename != "case.json" && filename.ends_with(".json") {
                        let _ = fs::remove_file(path);
                    }
                }
            }
        }
    }

    if let Some(steps) = tc["steps"].as_array() {
        for (i, step) in steps.iter().enumerate() {
            let step_name = step["name"].as_str().unwrap_or("step");
            let path = case_dir.join(format!("{:02}_{}.json", i + 1, sanitize_name(step_name)));
            write_json(&path, step)?;
        }
    }

    Ok(())
}

/// Load a project from disk
#[tauri::command]
pub async fn load_project(dir_path: String) -> Result<serde_json::Value, String> {
    load_project_internal(&dir_path).await
}

/// Internal function to load a project (callable from other modules)
pub(crate) async fn load_project_internal(dir_path: &str) -> Result<serde_json::Value, String> {
    let dir = PathBuf::from(dir_path);
    
    if !dir.exists() || !dir.is_dir() {
        return Err(format!("Project directory does not exist: {}", dir_path));
    }
    
    // Load properties.json
    let props_path = dir.join("properties.json");
    let props_json = fs::read_to_string(&props_path)
        .map_err(|e| format!("Failed to read properties.json: {}", e))?;
    let props: ProjectProperties = serde_json::from_str(&props_json)
        .map_err(|e| format!("Failed to parse properties.json: {}", e))?;
    
    // Load interfaces
    let interfaces_dir = dir.join("interfaces");
    let mut interfaces = Vec::new();
    
    if interfaces_dir.exists() {
        if let Ok(entries) = fs::read_dir(&interfaces_dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    if let Ok(iface) = load_interface(&entry.path()) {
                        interfaces.push(iface);
                    }
                }
            }
        }
    }
    
    // Load test suites
    let tests_dir = dir.join("tests");
    let mut test_suites = Vec::new();
    
    if tests_dir.exists() {
        if let Ok(entries) = fs::read_dir(&tests_dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    if let Ok(suite) = load_test_suite(&entry.path()) {
                        test_suites.push(suite);
                    }
                }
            }
        }
    }
    
    // Load folders
    let folders_dir = dir.join("folders");
    let mut folders = Vec::new();
    
    if folders_dir.exists() {
        if let Ok(entries) = fs::read_dir(&folders_dir) {
            let mut folder_files: Vec<_> = entries
                .filter_map(|e| e.ok())
                .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("json"))
                .collect();
            
            folder_files.sort_by_key(|e| e.file_name());
            
            for entry in folder_files {
                if let Ok(folder_json) = fs::read_to_string(entry.path()) {
                    if let Ok(folder) = serde_json::from_str::<serde_json::Value>(&folder_json) {
                        folders.push(folder);
                    }
                }
            }
        }
    }
    
    // Build project object
    let project = serde_json::json!({
        "name": props.name,
        "description": props.description,
        "id": props.id,
        "interfaces": interfaces,
        "testSuites": test_suites,
        "folders": folders,
    });
    
    Ok(project)
}

/// Load an interface from its directory
fn load_interface(iface_dir: &Path) -> Result<serde_json::Value, String> {
    let meta_path = iface_dir.join("interface.json");
    let meta_json = fs::read_to_string(&meta_path)
        .map_err(|e| format!("Failed to read interface.json: {}", e))?;
    let mut meta: serde_json::Value = serde_json::from_str(&meta_json)
        .map_err(|e| format!("Failed to parse interface.json: {}", e))?;
    
    // Load operations
    let mut operations = Vec::new();
    
    if let Ok(entries) = fs::read_dir(iface_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Ok(op) = load_operation(&path) {
                    operations.push(op);
                }
            }
        }
    }
    
    meta["operations"] = serde_json::Value::Array(operations);
    
    Ok(meta)
}

/// Load an operation from its directory
fn load_operation(op_dir: &Path) -> Result<serde_json::Value, String> {
    let meta_path = op_dir.join("operation.json");
    let meta_json = fs::read_to_string(&meta_path)
        .map_err(|e| format!("Failed to read operation.json: {}", e))?;
    let mut meta: serde_json::Value = serde_json::from_str(&meta_json)
        .map_err(|e| format!("Failed to parse operation.json: {}", e))?;
    
    // Load requests
    let mut requests = Vec::new();
    let mut request_bases = std::collections::HashSet::new();
    
    if let Ok(entries) = fs::read_dir(op_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("json") {
                if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
                    if filename != "operation.json" {
                        if let Some(base) = path.file_stem().and_then(|s| s.to_str()) {
                            request_bases.insert(base.to_string());
                        }
                    }
                }
            }
        }
    }
    
    for base in request_bases {
        if let Ok(req) = load_request(op_dir, &base) {
            requests.push(req);
        }
    }
    
    meta["requests"] = serde_json::Value::Array(requests);
    
    Ok(meta)
}

/// Load a request (body + metadata)
fn load_request(op_dir: &Path, base_name: &str) -> Result<serde_json::Value, String> {
    let meta_path = op_dir.join(format!("{}.json", base_name));
    let body_path = op_dir.join(format!("{}.xml", base_name));
    
    let meta_json = fs::read_to_string(&meta_path)
        .map_err(|e| format!("Failed to read request metadata: {}", e))?;
    let mut meta: serde_json::Value = serde_json::from_str(&meta_json)
        .map_err(|e| format!("Failed to parse request metadata: {}", e))?;
    
    let body = fs::read_to_string(&body_path).unwrap_or_default();
    meta["request"] = serde_json::Value::String(body);
    
    Ok(meta)
}

/// Load a test suite from its directory
fn load_test_suite(suite_dir: &Path) -> Result<serde_json::Value, String> {
    let meta_path = suite_dir.join("suite.json");
    let meta_json = fs::read_to_string(&meta_path)
        .map_err(|e| format!("Failed to read suite.json: {}", e))?;
    let mut meta: serde_json::Value = serde_json::from_str(&meta_json)
        .map_err(|e| format!("Failed to parse suite.json: {}", e))?;
    
    // Load test cases
    let mut test_cases = Vec::new();
    
    if let Ok(entries) = fs::read_dir(suite_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Ok(tc) = load_test_case(&path) {
                    test_cases.push(tc);
                }
            }
        }
    }
    
    meta["testCases"] = serde_json::Value::Array(test_cases);
    
    Ok(meta)
}

/// Load a test case from its directory
fn load_test_case(case_dir: &Path) -> Result<serde_json::Value, String> {
    let meta_path = case_dir.join("case.json");
    let meta_json = fs::read_to_string(&meta_path)
        .map_err(|e| format!("Failed to read case.json: {}", e))?;
    let mut meta: serde_json::Value = serde_json::from_str(&meta_json)
        .map_err(|e| format!("Failed to parse case.json: {}", e))?;
    
    // Load steps (ordered by filename)
    let mut steps = Vec::new();
    
    if let Ok(entries) = fs::read_dir(case_dir) {
        let mut step_files: Vec<_> = entries
            .filter_map(|e| e.ok())
            .filter(|e| {
                let path = e.path();
                path.is_file()
                    && path.extension().and_then(|s| s.to_str()) == Some("json")
                    && path.file_name().and_then(|f| f.to_str()) != Some("case.json")
            })
            .collect();
        
        step_files.sort_by_key(|e| e.file_name());
        
        for entry in step_files {
            if let Ok(step_json) = fs::read_to_string(entry.path()) {
                if let Ok(step) = serde_json::from_str::<serde_json::Value>(&step_json) {
                    steps.push(step);
                }
            }
        }
    }
    
    meta["steps"] = serde_json::Value::Array(steps);
    
    Ok(meta)
}

/// Delete a project directory
#[tauri::command]
pub async fn delete_project(dir_path: String) -> Result<(), String> {
    let dir = PathBuf::from(&dir_path);
    
    if !dir.exists() {
        return Err(format!("Project directory does not exist: {}", dir_path));
    }
    
    fs::remove_dir_all(&dir)
        .map_err(|e| format!("Failed to delete project: {}", e))?;
    
    Ok(())
}

/// Close a project
/// 
/// This command doesn't need to do anything on the backend since we don't maintain
/// project "open" state in Rust. The frontend handles clearing selection/state.
/// This command exists for consistency and to avoid "not implemented" errors.
#[tauri::command]
pub async fn close_project(_project_id: String) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({ "success": true }))
}
