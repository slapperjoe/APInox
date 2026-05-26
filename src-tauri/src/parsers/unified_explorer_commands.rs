//! Unified Explorer Commands
//!
//! Handles WSDL/OpenAPI parsing, project creation, and refresh/sync logic.
//! The WSDL service is the top-level entity — no wrapper project layer.

use crate::parsers::wsdl_commands::{parse_wsdl, ParseWsdlRequest};
use crate::parsers::wsdl::{ApiService, ServiceOperation};
use crate::project_storage;
use serde_json::json;
use uuid::Uuid;

/// Parse a WSDL URL and create/save a unified project.
/// If a project with the same sourceUrl already exists, triggers a refresh/sync.
#[tauri::command]
pub async fn parse_wsdl_as_project(url: String) -> Result<serde_json::Value, String> {
    // List existing projects and check for duplicate sourceUrl
    let projects = project_storage::list_unified_projects()
        .map_err(|e| format!("Failed to list projects: {}", e))?;

    for p in &projects {
        if let Some(existing_url) = p.get("sourceUrl").and_then(|v| v.as_str()) {
            if existing_url == &url {
                // Duplicate WSDL URL — trigger refresh instead
                let project_name = p["name"].as_str().unwrap_or("<unknown>").to_string();
                return refresh_unified_project(project_name).await;
            }
        }
    }

    // Parse WSDL
    let result = parse_wsdl(ParseWsdlRequest {
        url: url.clone(),
        resolve_imports: Some(true),
    }).await.map_err(|e| e.to_string())?;

    if result.services.is_empty() {
        return Err("No services found in WSDL".to_string());
    }

    let service = &result.services[0];
    let now = chrono::Utc::now().to_rfc3339();

    // Build operations array from parsed service
    let operations = build_operations_json(service);

    let project = json!({
        "name": service.name,
        "description": serde_json::Value::Null,
        "source": "wsdl",
        "sourceUrl": url,
        "parsedAt": now,
        "lastRefreshedAt": serde_json::Value::Null,
        "id": Uuid::new_v4().to_string(),
        "operations": operations,
    });

    // Auto-save to disk
    let project_dir = project_storage::projects_dir()
        .map_err(|e| format!("Failed to get projects dir: {}", e))?
        .join(sanitize_name(&service.name));
    project_storage::save_unified_project(
        project_dir.to_string_lossy().to_string(),
        project.clone(),
    ).map_err(|e| format!("Failed to save project: {}", e))?;

    Ok(project)
}

/// Refresh a unified project's WSDL source
#[tauri::command]
pub async fn refresh_unified_project(service_name: String) -> Result<serde_json::Value, String> {
    // Load existing project
    let project_dir = project_storage::projects_dir()
        .map_err(|e| format!("Failed to get projects dir: {}", e))?
        .join(sanitize_name(&service_name));

    let existing = project_storage::load_unified_project(
        project_dir.to_string_lossy().to_string(),
    ).map_err(|e| format!("Failed to load project: {}", e))?;

    // Ensure it has a source URL
    let source_url = existing.get("sourceUrl")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("Project '{}' has no source URL to refresh", service_name))?;

    // Re-parse the WSDL
    let result = parse_wsdl(ParseWsdlRequest {
        url: source_url.to_string(),
        resolve_imports: Some(true),
    }).await.map_err(|e| e.to_string())?;

    if result.services.is_empty() {
        return Err("No services found after re-parse".to_string());
    }

    let new_service = &result.services[0];
    let now = chrono::Utc::now().to_rfc3339();

    // Get existing operations
    let existing_operations: Vec<&serde_json::Value> = existing.get("operations")
        .and_then(|a| a.as_array())
        .map(|a| a.iter().collect())
        .unwrap_or_default();

    let mut merged_operations: Vec<serde_json::Value> = Vec::new();

    // Process new operations from WSDL
    for new_op in &new_service.operations {
        let existing_op = existing_operations.iter().find(|eo| {
            eo.get("name").and_then(|v| v.as_str()) == Some(&new_op.name)
        });

        let requests = if let Some(eo) = existing_op {
            // Preserve user-created requests from existing operation
            eo.get("requests").cloned().unwrap_or_else(|| json!([]))
        } else {
            // New operation — create sample request
            json!([
                json!({
                    "name": format!("sample_{}", new_op.name),
                    "endpoint": new_op.original_endpoint,
                    "method": "POST",
                    "contentType": "text/xml",
                })
            ])
        };

        merged_operations.push(json!({
            "name": new_op.name,
            "action": new_op.action,
            "input": new_op.input.as_ref().map(|v| json!(v)).unwrap_or(json!(null)),
            "targetNamespace": new_op.target_namespace,
            "originalEndpoint": new_op.original_endpoint,
            "requests": requests,
        }));
    }

    // Handle operations that were removed from WSDL — keep user requests as legacy
    for eo in &existing_operations {
        let eo_name = eo.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let still_exists = new_service.operations.iter().any(|nop| nop.name == eo_name);
        if !still_exists {
            let legacy_name = format!("[Legacy] {}", eo_name);
            let requests = eo.get("requests").cloned().unwrap_or(json!([]));
            merged_operations.push(json!({
                "name": legacy_name,
                "action": eo.get("action"),
                "input": eo.get("input"),
                "targetNamespace": eo.get("targetNamespace"),
                "originalEndpoint": eo.get("originalEndpoint"),
                "requests": requests,
            }));
        }
    }

    // Build updated project
    let updated = json!({
        "name": existing["name"],
        "description": existing["description"],
        "source": existing["source"],
        "sourceUrl": existing["sourceUrl"],
        "parsedAt": existing["parsedAt"],
        "lastRefreshedAt": now,
        "id": existing["id"],
        "operations": merged_operations,
    });

    // Save updated project
    project_storage::save_unified_project(
        project_dir.to_string_lossy().to_string(),
        updated.clone(),
    ).map_err(|e| format!("Failed to save updated project: {}", e))?;

    Ok(updated)
}

/// Convert an ApiService to a JSON array of operations
fn build_operations_json(service: &ApiService) -> Vec<serde_json::Value> {
    service.operations.iter().map(|op| build_operation_json(op)).collect()
}

/// Convert a ServiceOperation to JSON
fn build_operation_json(op: &ServiceOperation) -> serde_json::Value {
    json!({
        "name": op.name,
        "action": op.action,
        "input": op.input.as_ref().map(|v| json!(v)).unwrap_or(json!(null)),
        "targetNamespace": op.target_namespace,
        "originalEndpoint": op.original_endpoint,
        "requests": json!([
            json!({
                "name": format!("sample_{}", op.name),
                "endpoint": op.original_endpoint,
                "method": "POST",
                "contentType": "text/xml",
            })
        ]),
    })
}

/// Sanitize a name for use as a folder/file name
fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect()
}
