/// Tauri Commands for Workflow Execution
/// 
/// Frontend-facing commands for workflow operations

use anyhow::Result;
use serde::{Deserialize, Serialize};
use crate::workflow::{WorkflowExecutor, WorkflowStep, WorkflowResult};
use crate::settings_manager;
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct RunWorkflowRequest {
    pub name: String,
    pub steps: Vec<WorkflowStep>,
    pub variables: Option<HashMap<String, String>>,
}

/// Execute a workflow
#[tauri::command]
pub async fn run_workflow(request: RunWorkflowRequest) -> Result<WorkflowResult, String> {
    log::info!("Running workflow: {}", request.name);
    
    // Create workflow executor
    let mut executor = WorkflowExecutor::new();
    
    // Set initial variables
    if let Some(vars) = request.variables {
        for (key, value) in vars {
            executor.test_runner.set_variable(key, value);
        }
    }
    
    // Execute workflow
    let result = executor.execute_workflow(request.name, request.steps)
        .await
        .map_err(|e| format!("Workflow execution failed: {}", e))?;
    
    log::info!("Workflow completed: {} ({}ms)", 
        if result.passed { "PASSED" } else { "FAILED" },
        result.total_duration_ms
    );
    
    Ok(result)
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

#[derive(Debug, Serialize)]
pub struct WorkflowsResponse {
    pub workflows: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct SaveResponse {
    pub success: bool,
}
