/// Tauri Commands for Workflow Execution
/// 
/// Frontend-facing commands for workflow operations
use anyhow::Result;
use serde::{Deserialize, Serialize};
use crate::settings_manager;
use crate::testing::frontend_runner::run_request_step;
use crate::testing::frontend_types::{FrontendExtractor, FrontendRequest};
use serde_json::Value;
use std::collections::HashMap;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

/// Request accepted from the webview for executing a workflow.
///
/// The webview sends the flat `Workflow` model (shared/src/models.ts) — each
/// step is a `WorkflowStep` (`{ id, name, type, requestBody, endpoint, ... }`).
/// This intentionally does NOT use the workflow engine's node-tree
/// `WorkflowStep`: that engine never had a request-execution leaf, so the
/// frontend/backend contracts never matched. We execute the frontend's
/// self-contained request steps through the same path as test cases
/// (`frontend_runner::run_request_step`).
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunWorkflowRequest {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub steps: Vec<Value>,
    #[serde(default)]
    pub variables: Option<HashMap<String, String>>,
    /// Environment selector from the webview — not resolved by the backend.
    #[serde(default)]
    pub environment: Option<Value>,
}

/// Result of a workflow execution (matches frontend `WorkflowExecutionResult`).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRunResult {
    pub workflow_id: String,
    pub workflow_name: String,
    /// "completed" | "failed"
    pub status: String,
    pub start_time: u64,
    pub end_time: u64,
    pub step_results: Vec<WorkflowRunStepResult>,
    pub variables: HashMap<String, String>,
    pub error: Option<String>,
}

/// Result of a single workflow step (matches frontend `WorkflowStepResult`).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRunStepResult {
    pub step_id: String,
    pub step_name: String,
    pub start_time: u64,
    pub end_time: u64,
    pub duration: u64,
    /// "success" | "failed" | "skipped"
    pub status: String,
    /// The request body actually sent (after variable substitution).
    pub request: Option<String>,
    pub response: Option<String>,
    pub status_code: Option<u16>,
    pub extracted_values: Option<HashMap<String, String>>,
    pub error: Option<String>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Build a `FrontendRequest` from a flat frontend `WorkflowStep`.
///
/// `pub(crate)` so the performance runner can drive workflow-backed suites
/// through the same request-execution path as `run_workflow`.
pub(crate) fn build_frontend_request(step: &Value) -> FrontendRequest {
    let get = |k: &str| {
        step.get(k)
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
    };

    let method = get("httpMethod").or_else(|| get("method"));

    let extractors: Vec<FrontendExtractor> = step
        .get("extractors")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|e| {
                    let variable = e.get("variable").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    if variable.is_empty() {
                        return None;
                    }
                    let raw = e
                        .get("type")
                        .and_then(|v| v.as_str())
                        .unwrap_or("xpath")
                        .to_lowercase();
                    let extractor_type = match raw.as_str() {
                        "jsonpath" => "JSONPath",
                        "regex" => "Regex",
                        "header" => "Header",
                        _ => "XPath",
                    }
                    .to_string();
                    let source = e.get("source").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let pattern = e.get("pattern").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let header_name = e
                        .get("headerName")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    // For header extractors the lookup name is headerName, else the pattern.
                    let path = if extractor_type == "Header" {
                        header_name.or(pattern)
                    } else {
                        pattern
                    };
                    let default_value = e
                        .get("defaultValue")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    Some(FrontendExtractor {
                        id: e.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        variable,
                        extractor_type: Some(extractor_type),
                        source,
                        path,
                        default_value,
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    FrontendRequest {
        name: get("name"),
        request: get("requestBody"),
        endpoint: get("endpoint"),
        method,
        content_type: get("contentType"),
        headers: step.get("headers").and_then(|v| v.as_object()).map(|obj| {
            obj.iter()
                .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                .collect()
        }),
        assertions: None,
        extractors: if extractors.is_empty() {
            None
        } else {
            Some(extractors)
        },
    }
}

/// Execute a workflow (flat frontend `Workflow` model).
#[tauri::command]
pub async fn run_workflow(request: RunWorkflowRequest) -> Result<WorkflowRunResult, String> {
    log::info!("Running workflow: {}", request.name);

    let start_time = now_ms();
    let mut context: HashMap<String, Value> = request
        .variables
        .unwrap_or_default()
        .into_iter()
        .map(|(k, v)| (k, Value::String(v)))
        .collect();

    let mut step_results: Vec<WorkflowRunStepResult> = Vec::new();
    let mut all_passed = true;

    for step in &request.steps {
        let step_id = step.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let step_name = step.get("name").and_then(|v| v.as_str()).unwrap_or("step").to_string();
        let step_type = step.get("type").and_then(|v| v.as_str()).unwrap_or("request").to_string();
        let step_start = Instant::now();
        let step_start_ms = now_ms();

        match step_type.as_str() {
            "delay" => {
                let ms = step.get("delayMs").and_then(|v| v.as_u64()).unwrap_or(0);
                tokio::time::sleep(std::time::Duration::from_millis(ms)).await;
                step_results.push(WorkflowRunStepResult {
                    step_id,
                    step_name,
                    start_time: step_start_ms,
                    end_time: now_ms(),
                    duration: step_start.elapsed().as_millis() as u64,
                    status: "success".to_string(),
                    request: None,
                    response: None,
                    status_code: None,
                    extracted_values: None,
                    error: None,
                });
            }
            "request" => {
                let req = build_frontend_request(step);
                match run_request_step(&req, None, &context, step_start).await {
                    Ok(r) => {
                        // Merge extracted variables so later steps can use them.
                        for (k, v) in &r.extracted_variables {
                            context.insert(k.clone(), Value::String(v.clone()));
                        }
                        if !r.passed {
                            all_passed = false;
                        }
                        step_results.push(WorkflowRunStepResult {
                            step_id,
                            step_name,
                            start_time: step_start_ms,
                            end_time: now_ms(),
                            duration: r.duration_ms,
                            status: if r.passed { "success" } else { "failed" }.to_string(),
                            request: r.request_body,
                            response: r.response_body,
                            status_code: r.status_code,
                            extracted_values: if r.extracted_variables.is_empty() {
                                None
                            } else {
                                Some(r.extracted_variables)
                            },
                            error: r.error,
                        });
                    }
                    Err(e) => {
                        all_passed = false;
                        log::error!("[run_workflow] step '{}' error: {}", step_name, e);
                        step_results.push(WorkflowRunStepResult {
                            step_id,
                            step_name,
                            start_time: step_start_ms,
                            end_time: now_ms(),
                            duration: step_start.elapsed().as_millis() as u64,
                            status: "failed".to_string(),
                            request: None,
                            response: None,
                            status_code: None,
                            extracted_values: None,
                            error: Some(e.to_string()),
                        });
                    }
                }
            }
            other => {
                // condition/loop/script not implemented in the backend — surface as skipped.
                log::warn!(
                    "[run_workflow] step type '{}' not supported by backend, skipping",
                    other
                );
                step_results.push(WorkflowRunStepResult {
                    step_id,
                    step_name,
                    start_time: step_start_ms,
                    end_time: now_ms(),
                    duration: 0,
                    status: "skipped".to_string(),
                    request: None,
                    response: None,
                    status_code: None,
                    extracted_values: None,
                    error: Some(format!("Step type '{}' not supported by backend", other)),
                });
            }
        }
    }

    let end_time = now_ms();
    let status = if all_passed { "completed" } else { "failed" }.to_string();
    let variables: HashMap<String, String> = context
        .into_iter()
        .map(|(k, v)| match v {
            Value::String(s) => (k, s),
            other => (k, other.to_string()),
        })
        .collect();

    log::info!(
        "Workflow '{}' {} ({} steps)",
        request.name,
        status,
        step_results.len()
    );

    let result = WorkflowRunResult {
        workflow_id: request.id,
        workflow_name: request.name,
        status,
        start_time,
        end_time,
        step_results,
        variables,
        error: None,
    };

    // Persist this run to the global workflow run history (mirrors the
    // performance tester's history: config-stored, capped, newest appended).
    if let Ok(mut config) = settings_manager::load_config_internal() {
        if let Ok(run_value) = serde_json::to_value(&result) {
            let mut history: Vec<Value> = config.workflow_run_history.unwrap_or_default();
            history.push(run_value);
            const MAX_HISTORY: usize = 50;
            if history.len() > MAX_HISTORY {
                history = history[history.len() - MAX_HISTORY..].to_vec();
            }
            config.workflow_run_history = Some(history);
            let _ = settings_manager::save_config_internal(&config);
        }
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn json(v: serde_json::Value) -> serde_json::Value {
        v
    }

    #[test]
    fn build_frontend_request_maps_self_contained_request_step() {
        let step = json(serde_json::json!({
            "id": "s1",
            "name": "GetUser",
            "type": "request",
            "requestBody": "<GetUser/>",
            "endpoint": "http://svc/endpoint",
            "httpMethod": "POST",
            "contentType": "text/xml",
            "headers": { "SOAPAction": "getUser" },
            "extractors": [
                { "id": "e1", "variable": "userId", "type": "xpath", "source": "body", "pattern": "//Id" },
                { "id": "e2", "variable": "session", "type": "header", "source": "header", "headerName": "Set-Cookie" }
            ]
        }));

        let req = build_frontend_request(&step);

        assert_eq!(req.name.as_deref(), Some("GetUser"));
        assert_eq!(req.request.as_deref(), Some("<GetUser/>"));
        assert_eq!(req.endpoint.as_deref(), Some("http://svc/endpoint"));
        assert_eq!(req.method.as_deref(), Some("POST"));
        assert_eq!(req.content_type.as_deref(), Some("text/xml"));
        let headers = req.headers.as_ref().unwrap();
        assert_eq!(headers.get("SOAPAction").map(|s| s.as_str()), Some("getUser"));

        let ex = req.extractors.as_ref().unwrap();
        assert_eq!(ex.len(), 2);
        // XPath extractor: pattern feeds `path`.
        assert_eq!(ex[0].extractor_type.as_deref(), Some("XPath"));
        assert_eq!(ex[0].path.as_deref(), Some("//Id"));
        // Header extractor: headerName feeds `path`.
        assert_eq!(ex[1].extractor_type.as_deref(), Some("Header"));
        assert_eq!(ex[1].path.as_deref(), Some("Set-Cookie"));
    }

    #[test]
    fn build_frontend_request_skips_methodless_named_steps_safely() {
        // A step with neither httpMethod nor method falls back to POST (None method).
        let step = json(serde_json::json!({
            "id": "s2",
            "name": "NoMethod",
            "type": "request",
            "requestBody": "<X/>",
            "endpoint": "http://svc/x",
            "extractors": []
        }));
        let req = build_frontend_request(&step);
        assert_eq!(req.method.as_deref(), None);
        assert_eq!(req.extractors.as_ref().map(|e| e.len()), None);
    }
}

/// Get all workflows from global config
#[tauri::command]
pub async fn get_workflows() -> Result<WorkflowsResponse, String> {
    log::info!("Getting workflows from config");
    
    let workflows = settings_manager::get_workflows_internal()
        .map_err(|e| format!("Failed to get workflows: {}", e))?;
    
    Ok(WorkflowsResponse { workflows })
}

/// Save or update a workflow in global config
#[tauri::command]
pub async fn save_workflow(workflow: serde_json::Value) -> Result<SaveResponse, String> {
    log::info!("Saving workflow: {:?}", workflow.get("name"));
    
    if workflow.is_null() {
        return Err("Workflow required".to_string());
    }
    
    let workflow_id = workflow.get("id")
        .and_then(|v| v.as_str())
        .ok_or("Workflow must have an id")?
        .to_string();
    
    settings_manager::save_workflow_internal(workflow)
        .map_err(|e| format!("Failed to save workflow: {}", e))?;
    
    log::info!("Workflow saved successfully: {}", workflow_id);
    
    Ok(SaveResponse { success: true })
}

/// Delete a workflow from global config
#[tauri::command]
pub async fn delete_workflow(workflow_id: String) -> Result<SaveResponse, String> {
    log::info!("Deleting workflow: {}", workflow_id);
    
    if workflow_id.is_empty() {
        return Err("Workflow ID required".to_string());
    }
    
    settings_manager::delete_workflow_internal(&workflow_id)
        .map_err(|e| format!("Failed to delete workflow: {}", e))?;
    
    log::info!("Workflow deleted successfully: {}", workflow_id);

    Ok(SaveResponse { success: true })
}

/// Export a single workflow to a file.
///
/// "Save to disk" action from the workflow sidebar context menu: looks the
/// workflow up by id in the global config and writes its JSON to the target
/// path as a standalone `.json` (for version control / sharing) without
/// touching the in-app config.
#[tauri::command]
pub async fn export_workflow_to_file(
    workflow_id: String,
    file_path: String,
) -> Result<SaveResponse, String> {
    log::info!("export_workflow_to_file: Exporting workflow '{}' to {}", workflow_id, file_path);

    if workflow_id.is_empty() {
        return Err("Workflow ID required".to_string());
    }

    let workflows = settings_manager::get_workflows_internal()
        .map_err(|e| format!("Failed to load workflows: {}", e))?;

    let workflow = workflows
        .iter()
        .find(|w| w.get("id").and_then(|v| v.as_str()) == Some(workflow_id.as_str()))
        .ok_or_else(|| format!("Workflow '{}' not found", workflow_id))?
        .clone();

    let json_content = serde_json::to_string_pretty(&workflow)
        .map_err(|e| format!("Failed to serialize workflow: {}", e))?;

    std::fs::write(&file_path, json_content)
        .map_err(|e| format!("Failed to write workflow file: {}", e))?;

    log::info!("export_workflow_to_file: Wrote workflow '{}' to {}", workflow_id, file_path);

    Ok(SaveResponse { success: true })
}

/// Read a workflow JSON file from disk and return it so the webview can import
/// it into the global config (the "Load workflow from file" action from the
/// workflow sidebar). Thin by design: parse + shape check only — the webview
/// keeps/assigns the id and persists via the standard save path.
#[tauri::command]
pub async fn import_workflow_from_file(file_path: String) -> Result<Value, String> {
    log::info!("import_workflow_from_file: Loading workflow from {}", file_path);

    let json_content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read workflow file: {}", e))?;

    let workflow: Value = serde_json::from_str(&json_content)
        .map_err(|e| format!("Failed to parse workflow JSON: {}", e))?;

    if !workflow.is_object() {
        return Err("Workflow file must contain a JSON object".to_string());
    }

    log::info!(
        "import_workflow_from_file: Loaded workflow '{}'",
        workflow.get("name").and_then(|v| v.as_str()).unwrap_or("(unnamed)")
    );

    Ok(workflow)
}

#[derive(Debug, Serialize)]
pub struct WorkflowsResponse {
    pub workflows: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct SaveResponse {
    pub success: bool,
}
