use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use crate::utils::resolve_config_dir;

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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workflows: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workflow_run_history: Option<Vec<Value>>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type_locked: Option<bool>,
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
                content_type_locked: None,
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
            workflows: None,
            workflow_run_history: None,
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

/// Get full config
#[tauri::command]
pub async fn get_settings() -> Result<ApinoxConfig, String> {
    load_config()
}

/// Save full config.
///
/// `workflows` is owned by the dedicated `save_workflow` / `delete_workflow`
/// commands, which do a read-modify-write on the config file. A whole-config
/// save from the frontend can carry a stale `workflows` snapshot — or omit the
/// field entirely — and writing it back verbatim would clobber workflows that
/// were added/removed in the meantime. When the incoming config does NOT carry
/// a `workflows` value (absent or null), preserve the on-disk `workflows`
/// instead of dropping them. An intentional clear arrives as an empty array
/// (`Some([])`), which is still honored.
#[tauri::command]
pub async fn save_settings(config: ApinoxConfig) -> Result<(), String> {
    let mut config = config;
    if config.workflows.is_none() {
        config.workflows = load_config()?.workflows;
    }
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
            splashscreen_enabled: ui.splashscreen_enabled.or(existing_ui.splashscreen_enabled),
            split_ratio: ui.split_ratio.or(existing_ui.split_ratio),
            auto_fold_elements: ui.auto_fold_elements.or_else(|| existing_ui.auto_fold_elements.clone()),
            editor_font_size: ui.editor_font_size.or(existing_ui.editor_font_size),
            editor_font_family: ui.editor_font_family.or_else(|| existing_ui.editor_font_family.clone()),
            ui_font_family: ui.ui_font_family.or_else(|| existing_ui.ui_font_family.clone()),
            content_type_locked: ui.content_type_locked.or(existing_ui.content_type_locked),
        });
    } else {
        config.ui = Some(ui);
    }
    
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

    /// Hold the process-wide config-dir lock and redirect `APINOX_CONFIG_DIR`
    /// to a fresh temp dir (auto-cleaned on drop). The guard must outlive the
    /// test — keep the returned handle in a binding that lives to the end.
    struct TestConfigEnv {
        _guard: std::sync::MutexGuard<'static, ()>,
        _tmp: tempfile::TempDir,
    }

    impl TestConfigEnv {
        fn new() -> Self {
            let guard = CONFIG_DIR_TEST_LOCK
                .lock()
                .unwrap_or_else(|p| p.into_inner());
            let tmp = tempfile::tempdir().expect("create temp config dir");
            std::env::set_var("APINOX_CONFIG_DIR", tmp.path());
            Self { _guard: guard, _tmp: tmp }
        }
    }

    /// A wizard-shaped workflow payload — the same fields
    /// `assembleWorkflow` emits (id/name/steps/createdAt/modifiedAt).
    fn wizard_workflow() -> serde_json::Value {
        serde_json::json!({
            "id": "wf-1",
            "name": "wizard workflow",
            "steps": [
                {
                    "id": "step-1",
                    "name": "Login",
                    "type": "request",
                    "order": 0,
                    "endpoint": "http://127.0.0.1:9092/login",
                    "method": "POST",
                    "httpMethod": "POST",
                    "requestBody": "<Login/>",
                    "headers": { "content-type": "text/xml" }
                }
            ],
            "createdAt": 1,
            "modifiedAt": 1
        })
    }

    /// The wizard's workflow survives the save → read round-trip (the
    /// "does it persist" half of the bug report).
    #[tokio::test]
    async fn save_workflow_round_trips_through_disk() {
        let _env = TestConfigEnv::new();
        save_workflow_internal(wizard_workflow())
            .expect("save_workflow_internal should not error");

        let loaded = get_workflows_internal().expect("get_workflows_internal should not error");
        assert_eq!(loaded.len(), 1, "one workflow persisted");
        assert_eq!(
            loaded[0].get("name").and_then(|v| v.as_str()),
            Some("wizard workflow"),
            "workflow name round-trips"
        );
        assert_eq!(
            loaded[0]["steps"][0]["endpoint"].as_str(),
            Some("http://127.0.0.1:9092/login"),
            "step endpoint round-trips"
        );
    }

    /// A whole-config save that OMITS `workflows` (a stale frontend snapshot
    /// predating the workflow, or one that dropped the field) must NOT clobber
    /// the on-disk workflows — the "vanish on next boot" clobber.
    #[tokio::test]
    async fn save_settings_preserves_workflows_when_omitted() {
        let _env = TestConfigEnv::new();
        save_workflow_internal(wizard_workflow()).expect("seed workflow");
        assert_eq!(get_workflows_internal().unwrap().len(), 1);

        let stale: ApinoxConfig = serde_json::from_value(serde_json::json!({
            "version": 1,
            "network": { "defaultTimeout": 30 }
        }))
        .expect("parse a stale config without a workflows field");
        save_settings(stale).await.expect("save_settings should not error");

        let after = get_workflows_internal().expect("reload");
        assert_eq!(
            after.len(),
            1,
            "workflows must survive a whole-config save that omits the field"
        );
        assert_eq!(
            after[0].get("name").and_then(|v| v.as_str()),
            Some("wizard workflow")
        );
    }

    /// An INTENTIONAL clear arrives as an empty array (`Some([])`) and is
    /// honored — the preserve-on-None guard must not block it.
    #[tokio::test]
    async fn save_settings_honors_explicit_empty_workflows() {
        let _env = TestConfigEnv::new();
        save_workflow_internal(wizard_workflow()).expect("seed workflow");
        assert_eq!(get_workflows_internal().unwrap().len(), 1);

        let mut cleared: ApinoxConfig =
            serde_json::from_value(serde_json::json!({ "version": 1 })).expect("parse");
        cleared.workflows = Some(vec![]);
        save_settings(cleared).await.expect("save_settings should not error");

        assert_eq!(
            get_workflows_internal().unwrap().len(),
            0,
            "explicit empty workflows array must be honored (not preserved)"
        );
    }
}
