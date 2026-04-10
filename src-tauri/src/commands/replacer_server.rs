use tauri::State;
use uuid::Uuid;

use crate::proxy_models::ReplaceRule;
use crate::ProxyAppState;

#[tauri::command]
pub async fn get_replace_rules(state: State<'_, ProxyAppState>) -> Result<Vec<ReplaceRule>, String> {
    Ok(state.replacer.lock().unwrap().get_rules())
}

#[tauri::command]
pub async fn add_replace_rule(
    rule: ReplaceRule,
    state: State<'_, ProxyAppState>,
) -> Result<ReplaceRule, String> {
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
    state: State<'_, ProxyAppState>,
) -> Result<ReplaceRule, String> {
    let updated = state.replacer.lock().unwrap().update_rule(&id, rule.clone());
    if updated {
        save_rules(&state)?;
        Ok(rule)
    } else {
        Err(format!("Replace rule '{}' not found", id))
    }
}

#[tauri::command]
pub async fn delete_replace_rule(id: String, state: State<'_, ProxyAppState>) -> Result<(), String> {
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
