use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::proxy_models::ReplaceRule;
use crate::{ensure_proxy_state, LazyProxyAppState, ProxyAppState};

#[tauri::command]
pub async fn get_replace_rules(state: State<'_, LazyProxyAppState>, app: AppHandle) -> Result<Vec<ReplaceRule>, String> {
    let state = ensure_proxy_state(state, &app).await?;
    let rules = state.replacer.lock().unwrap().get_rules();
    Ok(rules)
}

#[tauri::command]
pub async fn add_replace_rule(
    rule: ReplaceRule,
    state: State<'_, LazyProxyAppState>,
    app: AppHandle,
) -> Result<ReplaceRule, String> {
    let state = ensure_proxy_state(state, &app).await?;
    let rule = if rule.id.is_empty() {
        ReplaceRule { id: Uuid::new_v4().to_string(), ..rule }
    } else {
        rule
    };
    state.replacer.lock().unwrap().add_rule(rule.clone());
    save_rules(&state)?;
    Ok(rule)
}

#[tauri::command]
pub async fn update_replace_rule(
    id: String,
    rule: ReplaceRule,
    state: State<'_, LazyProxyAppState>,
    app: AppHandle,
) -> Result<ReplaceRule, String> {
    let state = ensure_proxy_state(state, &app).await?;
    let updated = state.replacer.lock().unwrap().update_rule(&id, rule.clone());
    if updated {
        save_rules(&state)?;
        Ok(rule)
    } else {
        Err(format!("Replace rule '{}' not found", id))
    }
}

#[tauri::command]
pub async fn delete_replace_rule(id: String, state: State<'_, LazyProxyAppState>, app: AppHandle) -> Result<(), String> {
    let state = ensure_proxy_state(state, &app).await?;
    let deleted = state.replacer.lock().unwrap().delete_rule(&id);
    if deleted {
        save_rules(&state)?;
        Ok(())
    } else {
        Err(format!("Replace rule '{}' not found", id))
    }
}

fn save_rules(state: &ProxyAppState) -> Result<(), String> {
    let rules = state.replacer.lock().unwrap().get_rules();
    state.storage.save_replace_rules(&rules).map_err(|e| e.to_string())
}
