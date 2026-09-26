use chrono::Utc;
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::proxy_models::{MockRule, MockRuleCollection};
use crate::{ensure_proxy_state, LazyProxyAppState, ProxyAppState};

#[tauri::command]
pub async fn get_mock_rules(state: State<'_, LazyProxyAppState>, app: AppHandle) -> Result<Vec<MockRule>, String> {
    let state = ensure_proxy_state(state, &app).await?;
    let rules = state.mock.lock().await.config.rules.clone();
    Ok(rules)
}

#[tauri::command]
pub async fn add_mock_rule(
    rule: MockRule,
    state: State<'_, LazyProxyAppState>,
    app: AppHandle,
) -> Result<MockRule, String> {
    let state = ensure_proxy_state(state, &app).await?;
    let rule = if rule.id.is_empty() {
        MockRule { id: Uuid::new_v4().to_string(), ..rule }
    } else {
        rule
    };
    state.mock.lock().await.config.rules.push(rule.clone());
    save_rules(&state).await?;
    Ok(rule)
}

#[tauri::command]
pub async fn update_mock_rule(
    id: String,
    rule: MockRule,
    state: State<'_, LazyProxyAppState>,
    app: AppHandle,
) -> Result<MockRule, String> {
    let state = ensure_proxy_state(state, &app).await?;
    let mut ms = state.mock.lock().await;
    match ms.config.rules.iter_mut().find(|r| r.id == id) {
        Some(r) => {
            *r = rule.clone();
            drop(ms);
            save_rules(&state).await?;
            Ok(rule)
        }
        None => Err(format!("Mock rule '{}' not found", id)),
    }
}

#[tauri::command]
pub async fn delete_mock_rule(id: String, state: State<'_, LazyProxyAppState>, app: AppHandle) -> Result<(), String> {
    let state = ensure_proxy_state(state, &app).await?;
    let mut ms = state.mock.lock().await;
    let before = ms.config.rules.len();
    ms.config.rules.retain(|r| r.id != id);
    if ms.config.rules.len() == before {
        Err(format!("Mock rule '{}' not found", id))
    } else {
        drop(ms);
        save_rules(&state).await?;
        Ok(())
    }
}

async fn save_rules(state: &ProxyAppState) -> Result<(), String> {
    let rules = state.mock.lock().await.config.rules.clone();
    state.storage.save_mock_rules(&rules).map_err(|e| e.to_string())
}

/// Export a subset of mock rules to a portable JSON collection file on disk.
#[tauri::command]
pub async fn export_mock_collection(
    ids: Vec<String>,
    name: String,
    description: String,
    file_path: String,
    state: State<'_, LazyProxyAppState>,
    app: AppHandle,
) -> Result<(), String> {
    let state = ensure_proxy_state(state, &app).await?;
    let ms = state.mock.lock().await;
    let rules: Vec<MockRule> = if ids.is_empty() {
        ms.config.rules.clone()
    } else {
        ms.config.rules.iter()
            .filter(|r| ids.contains(&r.id))
            .cloned()
            .collect()
    };

    let collection = MockRuleCollection {
        name,
        description,
        version: "1.0".to_string(),
        exported_at: Utc::now().timestamp(),
        rules,
    };

    let json = serde_json::to_string_pretty(&collection)
        .map_err(|e| e.to_string())?;

    std::fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write collection file: {}", e))?;

    log::info!("[Mock] Exported collection to {}", file_path);
    Ok(())
}

/// Import a mock rule collection from disk, replacing all current rules.
/// Accepts either a `MockRuleCollection` wrapper object or a bare `Vec<MockRule>` array.
/// Returns the new rule list so the frontend can refresh without an extra round-trip.
#[tauri::command]
pub async fn import_mock_collection(
    file_path: String,
    state: State<'_, LazyProxyAppState>,
    app: AppHandle,
) -> Result<Vec<MockRule>, String> {
    let state = ensure_proxy_state(state, &app).await?;
    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Try wrapper object first, fall back to bare array for interop.
    let mut rules: Vec<MockRule> =
        if let Ok(col) = serde_json::from_str::<MockRuleCollection>(&content) {
            col.rules
        } else {
            serde_json::from_str::<Vec<MockRule>>(&content)
                .map_err(|e| format!("Failed to parse mock collection: {}", e))?
        };

    // Regenerate IDs and reset hit counts to avoid collisions.
    for rule in &mut rules {
        rule.id = Uuid::new_v4().to_string();
        rule.hit_count = 0;
    }

    {
        let mut ms = state.mock.lock().await;
        ms.config.rules = rules.clone();
    }

    save_rules(&state).await?;
    log::info!("[Mock] Imported {} rules from {}", rules.len(), file_path);
    Ok(rules)
}
