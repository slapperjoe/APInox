use std::fs;
use std::path::PathBuf;

/// Scrapbook state — stores requests as raw JSON to preserve all frontend fields
#[derive(Debug, serde::Serialize, serde::Deserialize, Default)]
struct ScrapbookState {
    requests: Vec<serde_json::Value>,
}

/// Get path to scrapbook.json file
fn get_scrapbook_path() -> Result<PathBuf, String> {
    let config_dir = std::env::var("APINOX_CONFIG_DIR")
        .ok()
        .and_then(|dir| if dir.trim().is_empty() { None } else { Some(PathBuf::from(dir)) })
        .or_else(|| {
            let home = std::env::var("HOME")
                .or_else(|_| std::env::var("USERPROFILE"))
                .ok()?;
            Some(PathBuf::from(home).join(".apinox"))
        })
        .ok_or("Could not determine config directory")?;

    // Ensure directory exists
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    Ok(config_dir.join("scrapbook.json"))
}

/// Load scrapbook from disk
fn load_scrapbook(scrapbook_path: &PathBuf) -> ScrapbookState {
    if !scrapbook_path.exists() {
        return ScrapbookState::default();
    }

    match fs::read_to_string(scrapbook_path) {
        Ok(content) => match serde_json::from_str(&content) {
            Ok(data) => data,
            Err(e) => {
                log::error!("Failed to parse scrapbook file: {}. Starting with empty scrapbook.", e);
                ScrapbookState::default()
            }
        },
        Err(e) => {
            log::error!("Failed to read scrapbook file: {}. Starting with empty scrapbook.", e);
            ScrapbookState::default()
        }
    }
}

/// Save scrapbook to disk
fn save_scrapbook(scrapbook_path: &PathBuf, data: &ScrapbookState) -> Result<(), String> {
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize scrapbook: {}", e))?;
    
    fs::write(scrapbook_path, content)
        .map_err(|e| format!("Failed to write scrapbook file: {}", e))?;
    
    log::info!("Saved scrapbook with {} request(s)", data.requests.len());
    Ok(())
}

/// Get all scrapbook requests
#[tauri::command]
pub async fn get_scrapbook() -> Result<Vec<serde_json::Value>, String> {
    let scrapbook_path = get_scrapbook_path()?;
    let data = load_scrapbook(&scrapbook_path);
    Ok(data.requests)
}

/// Add a new request to scrapbook
#[tauri::command]
pub async fn add_scrapbook_request(request: serde_json::Value) -> Result<Vec<serde_json::Value>, String> {
    let scrapbook_path = get_scrapbook_path()?;
    let mut data = load_scrapbook(&scrapbook_path);

    let mut req = request;
    let now = chrono::Utc::now().to_rfc3339();
    if req.get("createdAt").is_none() {
        req["createdAt"] = serde_json::Value::String(now.clone());
    }
    req["lastModified"] = serde_json::Value::String(now);

    data.requests.push(req);
    save_scrapbook(&scrapbook_path, &data)?;
    Ok(data.requests)
}

/// Update an existing scrapbook request (merges fields)
#[tauri::command]
pub async fn update_scrapbook_request(
    id: String,
    updates: serde_json::Value,
) -> Result<Vec<serde_json::Value>, String> {
    let scrapbook_path = get_scrapbook_path()?;
    let mut data = load_scrapbook(&scrapbook_path);

    let req = data.requests.iter_mut()
        .find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id))
        .ok_or_else(|| format!("Request with id {} not found", id))?;

    if let (serde_json::Value::Object(req_map), serde_json::Value::Object(updates_map)) = (req, &updates) {
        for (k, v) in updates_map {
            req_map.insert(k.clone(), v.clone());
        }
        req_map.insert("lastModified".to_string(), serde_json::Value::String(chrono::Utc::now().to_rfc3339()));
    }

    save_scrapbook(&scrapbook_path, &data)?;
    Ok(data.requests)
}

/// Delete a scrapbook request
#[tauri::command]
pub async fn delete_scrapbook_request(id: String) -> Result<Vec<serde_json::Value>, String> {
    let scrapbook_path = get_scrapbook_path()?;
    let mut data = load_scrapbook(&scrapbook_path);

    data.requests.retain(|r| r.get("id").and_then(|v| v.as_str()) != Some(&id));
    save_scrapbook(&scrapbook_path, &data)?;
    Ok(data.requests)
}

/// Get a specific scrapbook request by ID
#[tauri::command]
pub async fn get_scrapbook_request(id: String) -> Result<Option<serde_json::Value>, String> {
    let scrapbook_path = get_scrapbook_path()?;
    let data = load_scrapbook(&scrapbook_path);
    Ok(data.requests.into_iter().find(|r| r.get("id").and_then(|v| v.as_str()) == Some(&id)))
}
