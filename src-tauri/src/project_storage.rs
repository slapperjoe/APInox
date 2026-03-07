use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

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

/// Save a project to disk
/// 
/// This command receives the entire project JSON from the frontend
/// and saves it to the folder structure format.
#[tauri::command]
pub async fn save_project(
    project: serde_json::Value,
    dir_path: String,
) -> Result<(), String> {
    let dir = PathBuf::from(&dir_path);
    
    // Create root directory if needed
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create project directory: {}", e))?;
    
    // 1. Save properties.json
    let props = ProjectProperties {
        name: project["name"]
            .as_str()
            .ok_or("Missing project name")?
            .to_string(),
        description: project["description"].as_str().map(|s| s.to_string()),
        id: project["id"].as_str().map(|s| s.to_string()),
        format: "APInox-v1".to_string(),
    };
    
    let props_path = dir.join("properties.json");
    let props_json = serde_json::to_string_pretty(&props)
        .map_err(|e| format!("Failed to serialize properties: {}", e))?;
    fs::write(&props_path, props_json)
        .map_err(|e| format!("Failed to write properties.json: {}", e))?;
    
    // 2. Save interfaces
    let interfaces_dir = dir.join("interfaces");
    fs::create_dir_all(&interfaces_dir)
        .map_err(|e| format!("Failed to create interfaces directory: {}", e))?;
    
    // Cleanup orphan interface directories
    let interfaces = project["interfaces"]
        .as_array()
        .ok_or("Missing or invalid interfaces array")?;
    
    let current_interface_names: std::collections::HashSet<String> = interfaces
        .iter()
        .filter_map(|iface| iface["name"].as_str())
        .map(|name| sanitize_name(name))
        .collect();
    
    if let Ok(entries) = fs::read_dir(&interfaces_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                if let Some(dir_name) = entry.file_name().to_str() {
                    if !current_interface_names.contains(dir_name) {
                        let _ = fs::remove_dir_all(entry.path());
                    }
                }
            }
        }
    }
    
    // Save each interface
    for iface in interfaces {
        save_interface(iface, &interfaces_dir)?;
    }
    
    // 3. Save test suites
    let tests_dir = dir.join("tests");
    fs::create_dir_all(&tests_dir)
        .map_err(|e| format!("Failed to create tests directory: {}", e))?;
    
    if let Some(test_suites) = project["testSuites"].as_array() {
        // Cleanup orphan test suite directories
        let current_suite_names: std::collections::HashSet<String> = test_suites
            .iter()
            .filter_map(|suite| suite["name"].as_str())
            .map(|name| sanitize_name(name))
            .collect();
        
        if let Ok(entries) = fs::read_dir(&tests_dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    if let Some(dir_name) = entry.file_name().to_str() {
                        if !current_suite_names.contains(dir_name) {
                            let _ = fs::remove_dir_all(entry.path());
                        }
                    }
                }
            }
        }
        
        // Save each test suite
        for suite in test_suites {
            save_test_suite(suite, &tests_dir)?;
        }
    }
    
    // 4. Save folders
    let folders_dir = dir.join("folders");
    fs::create_dir_all(&folders_dir)
        .map_err(|e| format!("Failed to create folders directory: {}", e))?;
    
    // Clear existing folder files
    if let Ok(entries) = fs::read_dir(&folders_dir) {
        for entry in entries.flatten() {
            if entry.path().is_file() {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
    
    // Save folders
    if let Some(folders) = project["folders"].as_array() {
        for (i, folder) in folders.iter().enumerate() {
            let filename = format!("{:03}_folder.json", i + 1);
            let folder_path = folders_dir.join(filename);
            let folder_json = serde_json::to_string_pretty(folder)
                .map_err(|e| format!("Failed to serialize folder: {}", e))?;
            fs::write(&folder_path, folder_json)
                .map_err(|e| format!("Failed to write folder: {}", e))?;
        }
    }
    
    Ok(())
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
    
    // Save interface metadata
    let meta = serde_json::json!({
        "name": name,
        "type": iface["type"],
        "bindingName": iface["bindingName"],
        "soapVersion": iface["soapVersion"],
        "definition": iface["definition"],
        "displayName": iface["displayName"],
    });
    
    let meta_path = iface_dir.join("interface.json");
    let meta_json = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("Failed to serialize interface metadata: {}", e))?;
    fs::write(&meta_path, meta_json)
        .map_err(|e| format!("Failed to write interface.json: {}", e))?;
    
    // Cleanup orphan operation directories
    let operations = iface["operations"]
        .as_array()
        .ok_or("Missing or invalid operations array")?;
    
    let current_op_names: std::collections::HashSet<String> = operations
        .iter()
        .filter_map(|op| op["name"].as_str())
        .map(|name| sanitize_name(name))
        .collect();
    
    if let Ok(entries) = fs::read_dir(&iface_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(dir_name) = entry.file_name().to_str() {
                    if dir_name != "interface.json" && !current_op_names.contains(dir_name) {
                        let _ = fs::remove_dir_all(path);
                    }
                }
            }
        }
    }
    
    // Save each operation
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
    
    // Save operation metadata
    let meta = serde_json::json!({
        "name": name,
        "action": op["action"],
        "input": op["input"],
        "targetNamespace": op["targetNamespace"],
        "originalEndpoint": op["originalEndpoint"],
        "fullSchema": op["fullSchema"],
        "displayName": op["displayName"],
    });
    
    let meta_path = op_dir.join("operation.json");
    let meta_json = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("Failed to serialize operation metadata: {}", e))?;
    fs::write(&meta_path, meta_json)
        .map_err(|e| format!("Failed to write operation.json: {}", e))?;
    
    // Cleanup orphan request files
    let requests = op["requests"]
        .as_array()
        .ok_or("Missing or invalid requests array")?;
    
    let current_request_names: std::collections::HashSet<String> = requests
        .iter()
        .filter_map(|req| req["name"].as_str())
        .map(|name| sanitize_name(name))
        .collect();
    
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
        
        // Remove orphaned request files
        for base in existing_bases {
            if !current_request_names.contains(&base) {
                let _ = fs::remove_file(op_dir.join(format!("{}.xml", base)));
                let _ = fs::remove_file(op_dir.join(format!("{}.json", base)));
            }
        }
    }
    
    // Save each request
    for req in requests {
        save_request(req, &op_dir)?;
    }
    
    Ok(())
}

/// Save a request (body + metadata)
fn save_request(req: &serde_json::Value, op_dir: &Path) -> Result<(), String> {
    let name = req["name"].as_str().ok_or("Missing request name")?;
    let safe_name = sanitize_name(name);
    
    // Save request body as .xml
    let body = req["request"].as_str().unwrap_or("");
    let body_path = op_dir.join(format!("{}.xml", safe_name));
    fs::write(&body_path, body)
        .map_err(|e| format!("Failed to write request body: {}", e))?;
    
    // Save request metadata as .json
    let meta = serde_json::json!({
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
    });
    
    let meta_path = op_dir.join(format!("{}.json", safe_name));
    let meta_json = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("Failed to serialize request metadata: {}", e))?;
    fs::write(&meta_path, meta_json)
        .map_err(|e| format!("Failed to write request metadata: {}", e))?;
    
    Ok(())
}

/// Save a test suite to its directory
fn save_test_suite(suite: &serde_json::Value, tests_dir: &Path) -> Result<(), String> {
    let name = suite["name"].as_str().ok_or("Missing test suite name")?;
    let safe_name = sanitize_name(name);
    let suite_dir = tests_dir.join(&safe_name);
    
    fs::create_dir_all(&suite_dir)
        .map_err(|e| format!("Failed to create test suite directory: {}", e))?;
    
    // Save suite metadata
    let meta = serde_json::json!({
        "id": suite["id"],
        "name": name,
    });
    
    let meta_path = suite_dir.join("suite.json");
    let meta_json = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("Failed to serialize suite metadata: {}", e))?;
    fs::write(&meta_path, meta_json)
        .map_err(|e| format!("Failed to write suite.json: {}", e))?;
    
    // Cleanup orphan test case directories
    if let Some(test_cases) = suite["testCases"].as_array() {
        let current_case_names: std::collections::HashSet<String> = test_cases
            .iter()
            .filter_map(|tc| tc["name"].as_str())
            .map(|name| sanitize_name(name))
            .collect();
        
        if let Ok(entries) = fs::read_dir(&suite_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(dir_name) = entry.file_name().to_str() {
                        if dir_name != "suite.json" && !current_case_names.contains(dir_name) {
                            let _ = fs::remove_dir_all(path);
                        }
                    }
                }
            }
        }
        
        // Save each test case
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
    
    // Save case metadata
    let meta = serde_json::json!({
        "id": tc["id"],
        "name": name,
    });
    
    let meta_path = case_dir.join("case.json");
    let meta_json = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("Failed to serialize case metadata: {}", e))?;
    fs::write(&meta_path, meta_json)
        .map_err(|e| format!("Failed to write case.json: {}", e))?;
    
    // Delete existing step files
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
    
    // Save steps
    if let Some(steps) = tc["steps"].as_array() {
        for (i, step) in steps.iter().enumerate() {
            let step_name = step["name"].as_str().unwrap_or("step");
            let safe_step_name = sanitize_name(step_name);
            let filename = format!("{:02}_{}.json", i + 1, safe_step_name);
            let step_path = case_dir.join(filename);
            
            let step_json = serde_json::to_string_pretty(step)
                .map_err(|e| format!("Failed to serialize step: {}", e))?;
            fs::write(&step_path, step_json)
                .map_err(|e| format!("Failed to write step: {}", e))?;
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
