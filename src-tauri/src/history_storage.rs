use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// Request history entry stored in history.json
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestHistoryEntry {
    pub id: String,
    pub timestamp: i64,
    #[serde(alias = "requestName")]
    pub request_name: Option<String>,
    pub method: Option<String>,
    /// The endpoint URL (alias "url" for backward compat with older history files)
    #[serde(alias = "url")]
    pub endpoint: Option<String>,
    #[serde(alias = "statusCode")]
    pub status: Option<i32>,
    pub duration: Option<i32>,
    pub starred: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interface_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operation_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_headers: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_size: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub success: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// History configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryConfig {
    pub max_entries: usize,
    pub group_by: String,
    pub auto_clear: bool,
}

impl Default for HistoryConfig {
    fn default() -> Self {
        Self {
            max_entries: 100,
            group_by: "time".to_string(),
            auto_clear: false,
        }
    }
}

/// History file structure
#[derive(Debug, Serialize, Deserialize)]
struct HistoryFile {
    version: i32,
    config: HistoryConfig,
    entries: Vec<RequestHistoryEntry>,
}

impl Default for HistoryFile {
    fn default() -> Self {
        Self {
            version: 1,
            config: HistoryConfig::default(),
            entries: Vec::new(),
        }
    }
}

/// Get path to history.json file
fn get_history_path(_app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
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

    Ok(config_dir.join("history.json"))
}

/// Load history from disk
fn load_history(history_path: &PathBuf) -> HistoryFile {
    if !history_path.exists() {
        return HistoryFile::default();
    }

    match fs::read_to_string(history_path) {
        Ok(content) => match serde_json::from_str(&content) {
            Ok(data) => data,
            Err(e) => {
                log::error!("Failed to parse history file: {}. Starting with empty history.", e);
                HistoryFile::default()
            }
        },
        Err(e) => {
            log::error!("Failed to read history file: {}. Starting with empty history.", e);
            HistoryFile::default()
        }
    }
}

/// Save history to disk
fn save_history(history_path: &PathBuf, data: &HistoryFile) -> Result<(), String> {
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;
    
    fs::write(history_path, content)
        .map_err(|e| format!("Failed to write history file: {}", e))?;
    
    Ok(())
}

/// Get all history entries
#[tauri::command]
pub async fn get_history(app_handle: tauri::AppHandle) -> Result<Vec<RequestHistoryEntry>, String> {
    let history_path = get_history_path(&app_handle)?;
    let data = load_history(&history_path);
    Ok(data.entries)
}

/// Add a new entry to history
#[tauri::command]
pub async fn add_history_entry(
    app_handle: tauri::AppHandle,
    entry: RequestHistoryEntry,
) -> Result<(), String> {
    let history_path = get_history_path(&app_handle)?;
    let mut data = load_history(&history_path);
    
    // Add to beginning (most recent first)
    data.entries.insert(0, entry);
    
    // Trim to max entries
    if data.entries.len() > data.config.max_entries {
        data.entries.truncate(data.config.max_entries);
    }
    
    save_history(&history_path, &data)?;
    Ok(())
}

/// Clear all history
#[tauri::command]
pub async fn clear_history(app_handle: tauri::AppHandle) -> Result<(), String> {
    let history_path = get_history_path(&app_handle)?;
    let mut data = load_history(&history_path);
    data.entries.clear();
    save_history(&history_path, &data)?;
    Ok(())
}

/// Delete a specific history entry
#[tauri::command]
pub async fn delete_history_entry(
    app_handle: tauri::AppHandle,
    id: String,
) -> Result<(), String> {
    let history_path = get_history_path(&app_handle)?;
    let mut data = load_history(&history_path);
    data.entries.retain(|e| e.id != id);
    save_history(&history_path, &data)?;
    Ok(())
}

/// Toggle star status of a history entry
#[tauri::command]
pub async fn toggle_star_history(
    app_handle: tauri::AppHandle,
    id: String,
) -> Result<(), String> {
    let history_path = get_history_path(&app_handle)?;
    let mut data = load_history(&history_path);
    
    if let Some(entry) = data.entries.iter_mut().find(|e| e.id == id) {
        entry.starred = Some(!entry.starred.unwrap_or(false));
        save_history(&history_path, &data)?;
    }
    
    Ok(())
}

/// Get starred entries only
#[tauri::command]
pub async fn get_starred_history(app_handle: tauri::AppHandle) -> Result<Vec<RequestHistoryEntry>, String> {
    let history_path = get_history_path(&app_handle)?;
    let data = load_history(&history_path);
    Ok(data.entries.into_iter().filter(|e| e.starred.unwrap_or(false)).collect())
}

/// Clear entries older than specified days
#[tauri::command]
pub async fn clear_history_older_than(
    app_handle: tauri::AppHandle,
    days: i64,
) -> Result<(), String> {
    let history_path = get_history_path(&app_handle)?;
    let mut data = load_history(&history_path);
    
    let cutoff = chrono::Utc::now().timestamp_millis() - (days * 24 * 60 * 60 * 1000);
    data.entries.retain(|e| e.timestamp > cutoff);
    
    save_history(&history_path, &data)?;
    Ok(())
}

/// Update history configuration
#[tauri::command]
pub async fn update_history_config(
    app_handle: tauri::AppHandle,
    config: HistoryConfig,
) -> Result<(), String> {
    let history_path = get_history_path(&app_handle)?;
    let mut data = load_history(&history_path);
    
    // Update config
    data.config = config.clone();
    
    // Adjust entries if maxEntries changed
    if data.entries.len() > config.max_entries {
        data.entries.truncate(config.max_entries);
    }
    
    save_history(&history_path, &data)?;
    Ok(())
}

/// Get history configuration
#[tauri::command]
pub async fn get_history_config(app_handle: tauri::AppHandle) -> Result<HistoryConfig, String> {
    let history_path = get_history_path(&app_handle)?;
    let data = load_history(&history_path);
    Ok(data.config)
}
