use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// APInox configuration structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApinoxConfig {
    pub version: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network: Option<NetworkConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_watcher: Option<FileWatcherConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ui: Option<UiConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_environment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_config_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_proxy_target: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub open_projects: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environments: Option<HashMap<String, HashMap<String, Value>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub globals: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recent_workspaces: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub performance_suites: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub performance_history: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub performance_schedules: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workflows: Option<Vec<Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_timeout: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strict_ssl: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileWatcherConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layout_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_line_numbers: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub align_attributes: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inline_element_values: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_debug_indicator: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub split_ratio: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_fold_elements: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub editor_font_size: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub editor_font_family: Option<String>,
}

impl Default for ApinoxConfig {
    fn default() -> Self {
        Self {
            version: 1,
            network: Some(NetworkConfig {
                default_timeout: Some(30),
                retry_count: Some(3),
                proxy: Some(String::new()),
                strict_ssl: Some(true),
            }),
            ui: Some(UiConfig {
                layout_mode: Some("vertical".to_string()),
                show_line_numbers: Some(true),
                align_attributes: Some(false),
                inline_element_values: Some(false),
                show_debug_indicator: None,
                split_ratio: Some(0.5),
                auto_fold_elements: None,
                editor_font_size: None,
                editor_font_family: None,
            }),
            active_environment: Some("Build".to_string()),
            environments: Some(Self::default_environments()),
            globals: Some(Self::default_globals()),
            recent_workspaces: Some(Vec::new()),
            last_config_path: Some(String::new()),
            file_watcher: None,
            last_proxy_target: None,
            open_projects: None,
            performance_suites: None,
            performance_history: None,
            performance_schedules: None,
            workflows: None,
        }
    }
}

impl ApinoxConfig {
    fn default_environments() -> HashMap<String, HashMap<String, Value>> {
        let mut envs = HashMap::new();
        
        let mut build = HashMap::new();
        build.insert("endpoint_url".to_string(), Value::String("http://bld02.acme.com".to_string()));
        build.insert("env".to_string(), Value::String("bld02".to_string()));
        envs.insert("Build".to_string(), build);
        
        let mut dit = HashMap::new();
        dit.insert("endpoint_url".to_string(), Value::String("http://dit.example.com".to_string()));
        dit.insert("env".to_string(), Value::String("dit01".to_string()));
        envs.insert("DIT".to_string(), dit);
        
        let mut sit = HashMap::new();
        sit.insert("endpoint_url".to_string(), Value::String("http://sit.example.com".to_string()));
        sit.insert("env".to_string(), Value::String("sit01".to_string()));
        envs.insert("SIT".to_string(), sit);
        
        let mut perf = HashMap::new();
        perf.insert("endpoint_url".to_string(), Value::String("http://perf.example.com".to_string()));
        perf.insert("env".to_string(), Value::String("pft01".to_string()));
        envs.insert("Perf".to_string(), perf);
        
        let mut prod = HashMap::new();
        prod.insert("endpoint_url".to_string(), Value::String("http://prod.example.com".to_string()));
        prod.insert("env".to_string(), Value::String("prd01".to_string()));
        envs.insert("Prod".to_string(), prod);
        
        envs
    }
    
    fn default_globals() -> HashMap<String, String> {
        let mut globals = HashMap::new();
        globals.insert("apiKey".to_string(), "12345".to_string());
        globals
    }
}

/// Get config directory path
fn get_config_dir() -> Result<PathBuf, String> {
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

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    Ok(config_dir)
}

/// Get config file path
fn get_config_path() -> Result<PathBuf, String> {
    Ok(get_config_dir()?.join("config.jsonc"))
}

/// Load config from disk (supports JSONC with comments)
fn load_config() -> Result<ApinoxConfig, String> {
    let config_path = get_config_path()?;
    
    if !config_path.exists() {
        return Ok(ApinoxConfig::default());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    // Use json5 to parse JSONC (JSON with comments)
    let config: ApinoxConfig = json5::from_str(&content)
        .map_err(|e| format!("Failed to parse config: {}", e))?;

    Ok(config)
}

/// Save config to disk (JSONC format with 2-space indentation)
fn save_config(config: &ApinoxConfig) -> Result<(), String> {
    let config_path = get_config_path()?;
    
    // Serialize with pretty printing
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config file: {}", e))?;
    
    Ok(())
}

/// Get full config
#[tauri::command]
pub async fn get_settings() -> Result<ApinoxConfig, String> {
    load_config()
}

/// Get raw config content (for text editor)
#[tauri::command]
pub async fn get_raw_settings() -> Result<String, String> {
    let config_path = get_config_path()?;
    
    if !config_path.exists() {
        let default_config = ApinoxConfig::default();
        save_config(&default_config)?;
    }
    
    fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))
}

/// Save raw config content (from text editor)
#[tauri::command]
pub async fn save_raw_settings(content: String) -> Result<(), String> {
    let config_path = get_config_path()?;
    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config file: {}", e))
}

/// Save full config
#[tauri::command]
pub async fn save_settings(config: ApinoxConfig) -> Result<(), String> {
    save_config(&config)
}

/// Update UI state only
#[tauri::command]
pub async fn update_ui_settings(ui: UiConfig) -> Result<(), String> {
    let mut config = load_config()?;
    
    // Merge with existing UI settings instead of replacing
    if let Some(existing_ui) = &config.ui {
        config.ui = Some(UiConfig {
            layout_mode: ui.layout_mode.or(existing_ui.layout_mode.clone()),
            show_line_numbers: ui.show_line_numbers.or(existing_ui.show_line_numbers),
            align_attributes: ui.align_attributes.or(existing_ui.align_attributes),
            inline_element_values: ui.inline_element_values.or(existing_ui.inline_element_values),
            show_debug_indicator: ui.show_debug_indicator.or(existing_ui.show_debug_indicator),
            split_ratio: ui.split_ratio.or(existing_ui.split_ratio),
            auto_fold_elements: ui.auto_fold_elements.or_else(|| existing_ui.auto_fold_elements.clone()),
            editor_font_size: ui.editor_font_size.or(existing_ui.editor_font_size),
            editor_font_family: ui.editor_font_family.or_else(|| existing_ui.editor_font_family.clone()),
        });
    } else {
        config.ui = Some(ui);
    }
    
    save_config(&config)
}

/// Update active environment
#[tauri::command]
pub async fn update_active_environment(env_name: String) -> Result<(), String> {
    let mut config = load_config()?;
    config.active_environment = Some(env_name);
    save_config(&config)
}

/// Update open projects list
#[tauri::command]
pub async fn update_open_projects(paths: Vec<String>) -> Result<(), String> {
    let mut config = load_config()?;
    config.open_projects = Some(paths);
    save_config(&config)
}

/// Update workflows
#[tauri::command]
pub async fn update_workflows(workflows: Vec<Value>) -> Result<(), String> {
    let mut config = load_config()?;
    config.workflows = Some(workflows);
    save_config(&config)
}

/// Internal function to get workflows (callable from other modules)
pub(crate) fn get_workflows_internal() -> Result<Vec<Value>, String> {
    let config = load_config()?;
    Ok(config.workflows.unwrap_or_default())
}

/// Internal function to save a workflow (callable from other modules)
pub(crate) fn save_workflow_internal(workflow: Value) -> Result<(), String> {
    let mut workflows = get_workflows_internal()?;
    
    let workflow_id = workflow.get("id")
        .and_then(|v| v.as_str())
        .ok_or("Workflow must have an id")?;
    
    // Find and update existing, or append new
    if let Some(index) = workflows.iter().position(|w| {
        w.get("id").and_then(|v| v.as_str()) == Some(workflow_id)
    }) {
        workflows[index] = workflow;
    } else {
        workflows.push(workflow);
    }
    
    let mut config = load_config()?;
    config.workflows = Some(workflows);
    save_config(&config)
}

/// Internal function to delete a workflow (callable from other modules)
pub(crate) fn delete_workflow_internal(workflow_id: &str) -> Result<(), String> {
    let mut workflows = get_workflows_internal()?;
    
    workflows.retain(|w| {
        w.get("id").and_then(|v| v.as_str()) != Some(workflow_id)
    });
    
    let mut config = load_config()?;
    config.workflows = Some(workflows);
    save_config(&config)
}

/// Get config directory path
#[tauri::command]
pub async fn get_config_dir_path() -> Result<String, String> {
    Ok(get_config_dir()?.to_string_lossy().to_string())
}

/// Get config file path
#[tauri::command]
pub async fn get_config_file_path() -> Result<String, String> {
    Ok(get_config_path()?.to_string_lossy().to_string())
}

/// Resolve environment variables (including secrets)
#[tauri::command]
pub async fn get_resolved_environment(env_name: String) -> Result<HashMap<String, String>, String> {
    let config = load_config()?;
    
    let environments = config.environments.ok_or("No environments configured")?;
    let env = environments.get(&env_name)
        .ok_or(format!("Environment '{}' not found", env_name))?;
    
    let mut resolved = HashMap::new();
    
    for (key, value) in env {
        // Skip metadata fields
        if key == "_secretFields" || key == "_comment" {
            continue;
        }
        
        // Convert Value to string
        let value_str = match value {
            Value::String(s) => s.clone(),
            Value::Number(n) => n.to_string(),
            Value::Bool(b) => b.to_string(),
            _ => continue,
        };
        
        // Check if it's a secret reference
        if value_str.starts_with("__SECRET__:") {
            // Call secret storage to resolve
            match crate::secret_storage::resolve_secret_value(value_str.clone()).await {
                Ok(decrypted) => resolved.insert(key.clone(), decrypted),
                Err(_) => resolved.insert(key.clone(), value_str),
            };
        } else {
            resolved.insert(key.clone(), value_str);
        }
    }
    
    Ok(resolved)
}

/// Get global variables
#[tauri::command]
pub async fn get_global_variables() -> Result<HashMap<String, String>, String> {
    let config = load_config()?;
    Ok(config.globals.unwrap_or_default())
}
