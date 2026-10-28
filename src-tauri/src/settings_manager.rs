use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use crate::utils::{blocking, resolve_config_dir};

/// APInox configuration structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApinoxConfig {
    pub version: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network: Option<NetworkConfig>,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_timeout: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strict_ssl: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
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
    pub splashscreen_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub split_ratio: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_fold_elements: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub editor_font_size: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub editor_font_family: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ui_font_family: Option<String>,
    /// Editor settings that had no config field and lived only in localStorage.
    /// `hide_causality_data` was already being sent by `saveUiState` but had no
    /// field, so the write was silently dropped.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_minimap: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pretty_print: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hide_causality_data: Option<bool>,
}

impl Default for ApinoxConfig {
    fn default() -> Self {
        Self {
            version: 1,
            network: Some(NetworkConfig {
                default_timeout: Some(30),
                proxy: Some(String::new()),
                strict_ssl: Some(true),
            }),
            ui: Some(UiConfig {
                layout_mode: Some("vertical".to_string()),
                show_line_numbers: Some(true),
                align_attributes: Some(false),
                inline_element_values: Some(false),
                show_debug_indicator: None,
                splashscreen_enabled: None,
                split_ratio: Some(0.5),
                auto_fold_elements: None,
                editor_font_size: None,
                editor_font_family: None,
                ui_font_family: None,
                // Match the frontend's DEFAULT_EDITOR_SETTINGS so a fresh config and a
                // fresh provider agree.
                show_minimap: Some(false),
                pretty_print: Some(true),
                hide_causality_data: Some(false),
            }),
            active_environment: Some("Build".to_string()),
            environments: Some(Self::default_environments()),
            globals: Some(Self::default_globals()),
            recent_workspaces: Some(Vec::new()),
            last_config_path: Some(String::new()),
            last_proxy_target: None,
            open_projects: None,
            performance_suites: None,
            performance_history: None,
            performance_schedules: None,
        }
    }
}

impl ApinoxConfig {
    fn default_environments() -> HashMap<String, HashMap<String, Value>> {
        let mut envs = HashMap::new();
        
        let mut build = HashMap::new();
        build.insert("endpoint_url".to_string(), Value::String("http://your-service.example.com".to_string()));
        build.insert("env".to_string(), Value::String("example".to_string()));
        build.insert("color".to_string(), Value::String("#58A6FF".to_string()));
        envs.insert("Build".to_string(), build);
        
        let mut dit = HashMap::new();
        dit.insert("endpoint_url".to_string(), Value::String("http://dit.example.com".to_string()));
        dit.insert("env".to_string(), Value::String("dit01".to_string()));
        dit.insert("color".to_string(), Value::String("#7EE787".to_string()));
        envs.insert("DIT".to_string(), dit);
        
        let mut sit = HashMap::new();
        sit.insert("endpoint_url".to_string(), Value::String("http://sit.example.com".to_string()));
        sit.insert("env".to_string(), Value::String("sit01".to_string()));
        sit.insert("color".to_string(), Value::String("#FFA657".to_string()));
        envs.insert("SIT".to_string(), sit);
        
        let mut perf = HashMap::new();
        perf.insert("endpoint_url".to_string(), Value::String("http://perf.example.com".to_string()));
        perf.insert("env".to_string(), Value::String("pft01".to_string()));
        perf.insert("color".to_string(), Value::String("#D29922".to_string()));
        envs.insert("Perf".to_string(), perf);
        
        let mut prod = HashMap::new();
        prod.insert("endpoint_url".to_string(), Value::String("http://prod.example.com".to_string()));
        prod.insert("env".to_string(), Value::String("prd01".to_string()));
        prod.insert("color".to_string(), Value::String("#FF7B72".to_string()));
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
    let config_dir = resolve_config_dir()?;

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

/// Read `config.jsonc` as an opaque JSON document (JSONC via json5), without
/// deserializing into the typed [`ApinoxConfig`].
///
/// The startup workflow migration must see every key on disk verbatim — the
/// typed struct drops unknown fields and (after Phase 2) the very
/// `workflows`/`workflowRunHistory` keys being migrated. A missing file reads
/// as an empty object (mirrors `load_config`'s default).
pub(crate) fn load_config_document() -> Result<Value, String> {
    let config_path = get_config_path()?;
    if !config_path.exists() {
        return Ok(Value::Object(serde_json::Map::new()));
    }
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;
    let value: Value = json5::from_str(&content)
        .map_err(|e| format!("Failed to parse config document: {}", e))?;
    Ok(value)
}

/// Write a raw config document back as plain JSON (the same format
/// `save_config` produces — `config.jsonc` already loses its comments on any
/// typed save). Writes the whole document verbatim so unrelated keys survive.
pub(crate) fn save_config_document(document: &Value) -> Result<(), String> {
    let config_path = get_config_path()?;
    let content = serde_json::to_string_pretty(document)
        .map_err(|e| format!("Failed to serialize config document: {}", e))?;
    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config file: {}", e))?;
    Ok(())
}

/// Get full config
#[tauri::command]
pub async fn get_settings() -> Result<ApinoxConfig, String> {
    blocking(load_config).await
}

/// Save full config.
#[tauri::command]
pub async fn save_settings(config: ApinoxConfig) -> Result<(), String> {
    blocking(move || save_config(&config)).await
}

/// Update UI state only
#[tauri::command]
pub async fn update_ui_settings(ui: UiConfig) -> Result<(), String> {
    blocking(move || update_ui_settings_sync(ui)).await
}

fn update_ui_settings_sync(ui: UiConfig) -> Result<(), String> {
    let mut config = load_config()?;
    
    // Merge with existing UI settings instead of replacing
    if let Some(existing_ui) = &config.ui {
        config.ui = Some(UiConfig {
            layout_mode: ui.layout_mode.or(existing_ui.layout_mode.clone()),
            show_line_numbers: ui.show_line_numbers.or(existing_ui.show_line_numbers),
            align_attributes: ui.align_attributes.or(existing_ui.align_attributes),
            inline_element_values: ui.inline_element_values.or(existing_ui.inline_element_values),
            show_debug_indicator: ui.show_debug_indicator.or(existing_ui.show_debug_indicator),
            splashscreen_enabled: ui.splashscreen_enabled.or(existing_ui.splashscreen_enabled),
            split_ratio: ui.split_ratio.or(existing_ui.split_ratio),
            auto_fold_elements: ui.auto_fold_elements.or_else(|| existing_ui.auto_fold_elements.clone()),
            editor_font_size: ui.editor_font_size.or(existing_ui.editor_font_size),
            editor_font_family: ui.editor_font_family.or_else(|| existing_ui.editor_font_family.clone()),
            ui_font_family: ui.ui_font_family.or_else(|| existing_ui.ui_font_family.clone()),
            show_minimap: ui.show_minimap.or(existing_ui.show_minimap),
            pretty_print: ui.pretty_print.or(existing_ui.pretty_print),
            hide_causality_data: ui.hide_causality_data.or(existing_ui.hide_causality_data),
        });
    } else {
        config.ui = Some(ui);
    }
    
    save_config(&config)
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

/// Public re-exports for use by other modules (e.g. performance runner)
pub fn load_config_internal() -> Result<ApinoxConfig, String> {
    load_config()
}

pub fn save_config_internal(config: &ApinoxConfig) -> Result<(), String> {
    save_config(config)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::config::CONFIG_DIR_TEST_LOCK;
    use uuid::Uuid;

    /// `resolve_config_dir()` reads a process-global env var, so the lock must be held
    /// for the whole test — the pattern `notes_storage` and `project_storage` use.
    struct ConfigTestEnv {
        _guard: std::sync::MutexGuard<'static, ()>,
    }

    impl ConfigTestEnv {
        fn new() -> Self {
            let _guard = CONFIG_DIR_TEST_LOCK
                .lock()
                .unwrap_or_else(|p| p.into_inner());
            let dir = std::env::temp_dir().join(format!("apinox-settings-test-{}", Uuid::new_v4()));
            fs::create_dir_all(&dir).expect("create temp config dir");
            std::env::set_var("APINOX_CONFIG_DIR", &dir);
            Self { _guard }
        }
    }

    #[test]
    fn ui_settings_merge_keeps_the_editor_fields() {
        let _env = ConfigTestEnv::new();

        // `hideCausalityData` was being sent by `saveUiState` with no matching field on
        // UiConfig, so the write was silently dropped and the setting never survived a
        // restart. `showMinimap` and `prettyPrint` had no config field at all — they
        // lived only in localStorage.
        update_ui_settings_sync(UiConfig {
            show_minimap: Some(true),
            pretty_print: Some(false),
            hide_causality_data: Some(true),
            ..UiConfig::default()
        })
        .expect("update_ui_settings_sync");

        let ui = load_config().expect("load_config").ui.expect("ui section");
        assert_eq!(ui.show_minimap, Some(true));
        assert_eq!(ui.pretty_print, Some(false));
        assert_eq!(ui.hide_causality_data, Some(true));
    }

    #[test]
    fn a_partial_ui_update_does_not_drop_existing_values() {
        let _env = ConfigTestEnv::new();

        update_ui_settings_sync(UiConfig {
            editor_font_size: Some(18),
            ..UiConfig::default()
        })
        .expect("first merge");

        update_ui_settings_sync(UiConfig {
            show_line_numbers: Some(false),
            ..UiConfig::default()
        })
        .expect("second merge");

        let ui = load_config().expect("load_config").ui.expect("ui section");
        assert_eq!(ui.editor_font_size, Some(18));
        assert_eq!(ui.show_line_numbers, Some(false));
    }
}
