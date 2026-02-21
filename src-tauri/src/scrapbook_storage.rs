use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Scrapbook request (API Explorer quick request)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrapbookRequest {
    pub id: String,
    pub name: String,
    pub method: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_modified: Option<String>,
}

/// Scrapbook state
#[derive(Debug, Serialize, Deserialize)]
struct ScrapbookState {
    requests: Vec<ScrapbookRequest>,
}

impl Default for ScrapbookState {
    fn default() -> Self {
        Self {
            requests: Vec::new(),
        }
    }
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
pub async fn get_scrapbook() -> Result<Vec<ScrapbookRequest>, String> {
    let scrapbook_path = get_scrapbook_path()?;
    let data = load_scrapbook(&scrapbook_path);
    Ok(data.requests)
}

/// Add a new request to scrapbook
#[tauri::command]
pub async fn add_scrapbook_request(request: ScrapbookRequest) -> Result<Vec<ScrapbookRequest>, String> {
    let scrapbook_path = get_scrapbook_path()?;
    let mut data = load_scrapbook(&scrapbook_path);
    
    // Ensure timestamps are set
    let now = chrono::Utc::now().to_rfc3339();
    let new_request = ScrapbookRequest {
        created_at: Some(request.created_at.unwrap_or_else(|| now.clone())),
        last_modified: Some(now),
        ..request
    };
    
    data.requests.push(new_request);
    save_scrapbook(&scrapbook_path, &data)?;
    
    Ok(data.requests)
}

/// Update an existing scrapbook request
#[tauri::command]
pub async fn update_scrapbook_request(
    id: String,
    updates: serde_json::Value,
) -> Result<Vec<ScrapbookRequest>, String> {
    let scrapbook_path = get_scrapbook_path()?;
    let mut data = load_scrapbook(&scrapbook_path);
    
    let request = data.requests.iter_mut()
        .find(|r| r.id == id)
        .ok_or_else(|| format!("Request with id {} not found", id))?;
    
    // Apply updates (merge with existing)
    if let Some(name) = updates.get("name").and_then(|v| v.as_str()) {
        request.name = name.to_string();
    }
    if let Some(method) = updates.get("method").and_then(|v| v.as_str()) {
        request.method = method.to_string();
    }
    if let Some(url) = updates.get("url").and_then(|v| v.as_str()) {
        request.url = url.to_string();
    }
    if let Some(headers) = updates.get("headers") {
        request.headers = Some(headers.clone());
    }
    if let Some(body) = updates.get("body").and_then(|v| v.as_str()) {
        request.body = Some(body.to_string());
    }
    
    // Update lastModified
    request.last_modified = Some(chrono::Utc::now().to_rfc3339());
    
    save_scrapbook(&scrapbook_path, &data)?;
    Ok(data.requests)
}

/// Delete a scrapbook request
#[tauri::command]
pub async fn delete_scrapbook_request(id: String) -> Result<Vec<ScrapbookRequest>, String> {
    let scrapbook_path = get_scrapbook_path()?;
    let mut data = load_scrapbook(&scrapbook_path);
    
    data.requests.retain(|r| r.id != id);
    save_scrapbook(&scrapbook_path, &data)?;
    
    Ok(data.requests)
}

/// Get a specific scrapbook request by ID
#[tauri::command]
pub async fn get_scrapbook_request(id: String) -> Result<Option<ScrapbookRequest>, String> {
    let scrapbook_path = get_scrapbook_path()?;
    let data = load_scrapbook(&scrapbook_path);
    Ok(data.requests.into_iter().find(|r| r.id == id))
}
