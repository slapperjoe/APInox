use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize)]
struct Workspace {
    version: String,
    name: String,
    #[serde(rename = "exportedAt")]
    exported_at: String,
    projects: Vec<serde_json::Value>,
}

/// Export workspace to file (JSON or compressed .apinox format)
/// 
/// This command receives an array of projects and a target file path.
/// If the path ends with .apinox, it writes compressed (gzip) JSON.
/// Otherwise, it writes plain JSON.
#[tauri::command]
pub async fn export_workspace(
    projects: Vec<serde_json::Value>,
    file_path: String,
) -> Result<ExportResult, String> {
    log::info!("export_workspace: Exporting {} project(s) to {}", projects.len(), file_path);
    
    // Extract project names for logging
    let project_names: Vec<String> = projects.iter()
        .filter_map(|p| p["name"].as_str())
        .map(|s| s.to_string())
        .collect();
    
    log::info!("export_workspace: Projects = {:?}", project_names);
    
    // Create workspace structure
    let path = Path::new(&file_path);
    let name = path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("workspace")
        .to_string();

    // The frontend passes the LEGACY nested value of each selected project
    // (from `useProject()`, loaded off the on-disk `interfaces/` tree). But the
    // canonical store for every project created/imported today is the UNIFIED
    // flat layout — whose `interfaces/` tree is empty (it is only written
    // additively by the import path for the PROXY / WORKFLOWS legacy readers).
    // So the passed values carry `interfaces: []` and a naive export would drop
    // every operation and request. Re-source each selected project from the
    // canonical unified store (by name) and build the nested value from that,
    // so the export round-trips with its operations + requests intact. Projects
    // not present in the unified store (genuine legacy-only dirs) fall back to
    // the passed value, so this never loses a legacy export.
    let mut unified_by_name: std::collections::HashMap<String, serde_json::Value> =
        std::collections::HashMap::new();
    if let Ok(unified_projects) = crate::project_storage::list_unified_projects().await {
        for unified in unified_projects {
            let uname = match unified["name"].as_str() {
                Some(n) => n.to_string(),
                None => continue,
            };
            if let Ok(full) =
                crate::project_storage::load_unified_project(uname.clone())
            {
                unified_by_name.insert(uname, full);
            }
        }
    }

    let exported_projects: Vec<serde_json::Value> = projects
        .iter()
        .map(|p| {
            let pname = p["name"].as_str().unwrap_or("").to_string();
            let nested = match unified_by_name.get(&pname) {
                Some(unified) => unified_project_to_nested(unified),
                // Not a unified project (legacy-only dir) — export the nested
                // value the frontend sent.
                None => p.clone(),
            };
            let mut project = nested;
            // Remove fileName if present (it's project-specific)
            if let Some(obj) = project.as_object_mut() {
                obj.remove("fileName");
            }
            project
        })
        .collect();

    let workspace = Workspace {
        version: "1.0".to_string(),
        name,
        exported_at: Utc::now().to_rfc3339(),
        projects: exported_projects,
    };
    
    // Serialize to JSON
    let json_content = serde_json::to_string_pretty(&workspace)
        .map_err(|e| format!("Failed to serialize workspace: {}", e))?;
    
    log::info!("export_workspace: JSON size = {} bytes", json_content.len());
    
    // Check if .apinox extension (compressed format)
    if file_path.ends_with(".apinox") {
        // Write compressed
        use flate2::write::GzEncoder;
        use flate2::Compression;
        
        let file = fs::File::create(&file_path)
            .map_err(|e| format!("Failed to create file: {}", e))?;
        
        let mut encoder = GzEncoder::new(file, Compression::default());
        encoder.write_all(json_content.as_bytes())
            .map_err(|e| format!("Failed to write compressed data: {}", e))?;
        encoder.finish()
            .map_err(|e| format!("Failed to finalize compression: {}", e))?;
        
        log::info!("export_workspace: Wrote compressed workspace to {}", file_path);
    } else {
        // Write plain JSON
        fs::write(&file_path, json_content)
            .map_err(|e| format!("Failed to write file: {}", e))?;
        
        log::info!("export_workspace: Wrote JSON workspace to {}", file_path);
    }
    
    Ok(ExportResult {
        exported: true,
        project_count: projects.len(),
        file_path,
    })
}

#[derive(Debug, Serialize)]
pub struct ExportResult {
    pub exported: bool,
    pub project_count: usize,
    pub file_path: String,
}

/// Build a NESTED (legacy-shape) project value — `interfaces[].operations[].
/// requests[]` — from a FLAT UNIFIED project value (`operations[].requests[]`).
///
/// The `.apinox` / workspace export format is the nested model, but the
/// canonical store for every project the user creates or imports today is the
/// UNIFIED flat layout. The nested `interfaces/` tree on disk is only written
/// by the import path (additively, for the PROXY / WORKFLOWS legacy readers),
/// so for projects created via "Load Definition" it is EMPTY — which is why a
/// naive export of `useProject().projects` produced workspace files whose
/// projects all carried `interfaces: []` (operations and requests silently
/// lost on the round-trip). This helper reconstructs a faithful nested value
/// from the flat source of truth so the export never loses data.
fn unified_project_to_nested(unified: &serde_json::Value) -> serde_json::Value {
    let name = unified["name"].as_str().unwrap_or("Project").to_string();
    let operations = unified["operations"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    let mut nested_ops: Vec<serde_json::Value> = Vec::new();
    for op in &operations {
        let mut reqs: Vec<serde_json::Value> = Vec::new();
        if let Some(reqs_arr) = op["requests"].as_array() {
            for req in reqs_arr {
                let mut r = serde_json::json!({});
                r["name"] = req["name"].clone();
                r["request"] = req.get("request").cloned().unwrap_or(serde_json::Value::String(String::new()));
                for k in [
                    "endpoint",
                    "method",
                    "contentType",
                    "headers",
                    "assertions",
                    "extractors",
                    "wsSecurity",
                    "attachments",
                    "id",
                    "displayName",
                    "requestType",
                    "bodyType",
                    "restConfig",
                    "graphqlConfig",
                    "sampleMetadata",
                ] {
                    if let Some(v) = req.get(k) {
                        if !v.is_null() {
                            r[k] = v.clone();
                        }
                    }
                }
                reqs.push(r);
            }
        }
        let mut o = serde_json::json!({});
        o["name"] = op["name"].clone();
        o["action"] = op.get("action").cloned().unwrap_or(serde_json::Value::String(String::new()));
        o["input"] = op.get("input").cloned().unwrap_or(serde_json::Value::Null);
        o["output"] = op.get("output").cloned().unwrap_or(serde_json::Value::Null);
        o["fullSchema"] = op.get("fullSchema").cloned().unwrap_or(serde_json::Value::Null);
        for k in [
            "targetNamespace",
            "originalEndpoint",
            "displayName",
            "id",
            "description",
            "portName",
            "sampleMetadata",
        ] {
            if let Some(v) = op.get(k) {
                if !v.is_null() {
                    o[k] = v.clone();
                }
            }
        }
        o["requests"] = serde_json::Value::Array(reqs);
        nested_ops.push(o);
    }

    let iface = serde_json::json!({
        "name": name,
        "type": "wsdl",
        "bindingName": unified.get("bindingName").cloned().unwrap_or(serde_json::Value::Null),
        "soapVersion": unified.get("soapVersion").cloned().unwrap_or(serde_json::Value::Null),
        "definition": unified.get("sourceUrl").cloned().unwrap_or(serde_json::Value::Null),
        "operations": nested_ops,
    });

    serde_json::json!({
        "name": name,
        "description": unified.get("description").cloned().unwrap_or(serde_json::Value::Null),
        "id": unified.get("id").cloned().unwrap_or(serde_json::Value::Null),
        "interfaces": [iface],
        "testSuites": unified.get("testSuites").cloned().unwrap_or(serde_json::Value::Array(vec![])),
        "folders": unified.get("folders").cloned().unwrap_or(serde_json::Value::Array(vec![])),
    })
}

/// Import workspace from file (.apinox, .json, or legacy XML)
/// 
/// This command receives a file path and returns the projects contained in the workspace.
/// Supports:
/// - .apinox: Compressed gzip JSON format
/// - .json: Plain JSON format
/// - Directory: Single project folder (loads as one project)
#[tauri::command]
pub async fn import_workspace(
    file_path: String,
) -> Result<ImportResult, String> {
    log::info!("import_workspace: Importing from {}", file_path);
    
    let path = Path::new(&file_path);
    
    // Check if it's a directory or a file
    let metadata = fs::metadata(path)
        .map_err(|e| format!("Failed to read path: {}", e))?;
    
    if metadata.is_dir() {
        // It's a project folder - load as single project
        log::info!("import_workspace: Detected directory, loading as single project");
        
        // Use the existing load_project command
        let project = crate::project_storage::load_project_internal(&file_path)
            .await
            .map_err(|e| format!("Failed to load project: {}", e))?;
        
        return Ok(ImportResult {
            imported: true,
            projects: vec![project],
            project_count: 1,
        });
    }
    
    // It's a file - determine format by extension
    let extension = path.extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    log::info!("import_workspace: File extension = {}", extension);
    
    match extension.as_str() {
        "apinox" => {
            // Compressed APInox workspace format
            log::info!("import_workspace: Decompressing .apinox file");
            
            let compressed = fs::read(path)
                .map_err(|e| format!("Failed to read file: {}", e))?;
            
            use flate2::read::GzDecoder;
            let mut decoder = GzDecoder::new(&compressed[..]);
            let mut json_content = String::new();
            decoder.read_to_string(&mut json_content)
                .map_err(|e| format!("Failed to decompress file: {}", e))?;
            
            let workspace: Workspace = serde_json::from_str(&json_content)
                .map_err(|e| format!("Failed to parse JSON: {}", e))?;
            
            log::info!("import_workspace: Imported .apinox workspace: {} ({} projects)", 
                workspace.name, workspace.projects.len());
            
            let project_count = workspace.projects.len();
            
            Ok(ImportResult {
                imported: true,
                projects: workspace.projects,
                project_count,
            })
        },
        "json" => {
            // Plain JSON workspace format
            log::info!("import_workspace: Reading plain JSON file");
            
            let json_content = fs::read_to_string(path)
                .map_err(|e| format!("Failed to read file: {}", e))?;
            
            let workspace: Workspace = serde_json::from_str(&json_content)
                .map_err(|e| format!("Failed to parse JSON: {}", e))?;
            
            log::info!("import_workspace: Imported JSON workspace: {} ({} projects)", 
                workspace.name, workspace.projects.len());
            
            let project_count = workspace.projects.len();
            
            Ok(ImportResult {
                imported: true,
                projects: workspace.projects,
                project_count,
            })
        },
        "xml" => {
            // SoapUI workspace or project XML
            log::info!("import_workspace: Delegating .xml to SoapUI importer");
            let projects = crate::soapui_importer::import_soapui_xml(&file_path).await?;
            let project_count = projects.len();
            Ok(ImportResult {
                imported: true,
                projects,
                project_count,
            })
        },
        _ => {
            // Unsupported format
            Err(format!(
                "Unsupported workspace format: .{}. Supported formats: .apinox, .json, .xml (SoapUI).",
                extension
            ))
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub imported: bool,
    pub projects: Vec<serde_json::Value>,
    pub project_count: usize,
}

/// Export a single unified project to file.
/// Looks up the project by name, wraps it in a workspace envelope,
/// and writes it to the target path (.apinox = compressed, .json = plain).
#[tauri::command]
pub async fn export_unified_project(
    project_name: String,
    file_path: String,
) -> Result<ExportResult, String> {
    log::info!("export_unified_project: Exporting '{}' to {}", project_name, file_path);

    let projects = crate::project_storage::list_unified_projects().await?;
    let project = projects
        .into_iter()
        .find(|p| p["name"].as_str() == Some(&project_name))
        .ok_or_else(|| format!("Unified project '{}' not found", project_name))?;

    let path = Path::new(&file_path);
    let name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(&project_name)
        .to_string();

    let workspace = Workspace {
        version: "1.0".to_string(),
        name,
        exported_at: Utc::now().to_rfc3339(),
        projects: vec![project],
    };

    let json_content =
        serde_json::to_string_pretty(&workspace).map_err(|e| format!("Failed to serialize: {}", e))?;

    if file_path.ends_with(".apinox") {
        use flate2::write::GzEncoder;
        use flate2::Compression;
        let file = fs::File::create(&file_path)
            .map_err(|e| format!("Failed to create file: {}", e))?;
        let mut encoder = GzEncoder::new(file, Compression::default());
        encoder
            .write_all(json_content.as_bytes())
            .map_err(|e| format!("Failed to write compressed data: {}", e))?;
        encoder
            .finish()
            .map_err(|e| format!("Failed to finalize compression: {}", e))?;
    } else {
        fs::write(&file_path, json_content)
            .map_err(|e| format!("Failed to write file: {}", e))?;
    }

    log::info!("export_unified_project: Wrote '{}' to {}", project_name, file_path);

    Ok(ExportResult {
        exported: true,
        project_count: 1,
        file_path,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A FLAT UNIFIED project value (the canonical on-disk store) with one
    /// operation and one request carrying a body.
    fn sample_unified_project(name: &str) -> serde_json::Value {
        serde_json::json!({
            "name": name,
            "description": null,
            "source": "wsdl",
            "sourceUrl": "http://example.com/svc.wsdl",
            "parsedAt": "2026-01-01T00:00:00Z",
            "id": "unified-1",
            "soapVersion": "1.1",
            "bindingName": "SvcSoap",
            "operations": [
                {
                    "name": "DoWork",
                    "action": "http://example.com/DoWork",
                    "input": null,
                    "targetNamespace": "http://example.com",
                    "originalEndpoint": "http://example.com/svc",
                    "fullSchema": null,
                    "output": null,
                    "requests": [
                        {
                            "name": "DoWork sample",
                            "endpoint": "http://example.com/svc",
                            "method": "POST",
                            "request": "<doWork/>",
                            "id": "req-1"
                        }
                    ]
                }
            ],
            "testSuites": [],
            "folders": []
        })
    }

    /// The nested (legacy) value the frontend hands to `export_workspace`
    /// (`useProject().projects`, loaded off the empty `interfaces/` tree of a
    /// unified project). Note: `interfaces: []` — this is the shape that used
    /// to be exported verbatim, losing all operations.
    fn sample_nested_value_as_frontend_passes(name: &str) -> serde_json::Value {
        serde_json::json!({
            "name": name,
            "description": null,
            "id": "unified-1",
            "interfaces": [],
            "testSuites": [],
            "folders": []
        })
    }

    /// `unified_project_to_nested` must produce a nested value whose single
    /// interface carries the flat project's operations + request bodies, so an
    /// export/import round-trip keeps them.
    #[test]
    fn unified_to_nested_preserves_operations_and_bodies() {
        let unified = sample_unified_project("RTSvc");
        let nested = unified_project_to_nested(&unified);

        let ifaces = nested["interfaces"].as_array().expect("one interface");
        assert_eq!(ifaces.len(), 1);
        let ops = ifaces[0]["operations"].as_array().expect("ops");
        assert_eq!(ops.len(), 1, "the flat op must survive");
        assert_eq!(ops[0]["name"], "DoWork");
        let reqs = ops[0]["requests"].as_array().expect("requests");
        assert_eq!(reqs.len(), 1);
        assert_eq!(reqs[0]["request"], "<doWork/>");
        assert_eq!(reqs[0]["endpoint"], "http://example.com/svc");
    }

    /// End-to-end regression guard for the workspace export bug: exporting a
    /// project that the frontend passes with `interfaces: []` (because the
    /// unified store is the source of truth) must still carry the operations in
    /// the written file, because `export_workspace` re-sources it from the
    /// unified store by name.
    #[tokio::test]
    async fn export_workspace_round_trips_unified_project_operations() {
        use crate::utils::config::CONFIG_DIR_TEST_LOCK;
        let _guard = CONFIG_DIR_TEST_LOCK.lock().unwrap_or_else(|p| p.into_inner());
        let tmp = tempfile::tempdir().expect("tempdir");
        std::env::set_var("APINOX_CONFIG_DIR", tmp.path());

        // Seed the canonical unified store with the project (flat layout).
        crate::project_storage::save_unified_project(
            "RTSvc".to_string(),
            sample_unified_project("RTSvc"),
        )
        .expect("save unified project");

        // The frontend exports the LEGACY nested value (empty interfaces).
        let frontend_value = sample_nested_value_as_frontend_passes("RTSvc");
        let file_path = tmp.path().join("rt.apinox");
        let export = export_workspace(
            vec![frontend_value],
            file_path.to_string_lossy().to_string(),
        )
        .await
        .expect("export");
        assert!(export.exported);

        // Read the file back and confirm the operation survived the round-trip.
        let compressed = fs::read(&file_path).expect("read .apinox");
        use flate2::read::GzDecoder;
        let mut decoder = GzDecoder::new(&compressed[..]);
        let mut json_content = String::new();
        decoder.read_to_string(&mut json_content).expect("decompress");
        let parsed: serde_json::Value = serde_json::from_str(&json_content).expect("parse");

        let projects = parsed["projects"].as_array().expect("projects array");
        assert_eq!(projects.len(), 1);
        let ifaces = &projects[0]["interfaces"];
        assert!(
            ifaces.as_array().map(|a| a.len()) == Some(1),
            "exported project must carry its interface, got: {}",
            ifaces
        );
        let ops = &ifaces[0]["operations"];
        assert_eq!(
            ops.as_array().map(|a| a.len()),
            Some(1),
            "the operation must survive the export round-trip"
        );
        assert_eq!(ops[0]["name"], "DoWork");
        assert_eq!(ops[0]["requests"][0]["request"], "<doWork/>");

        std::env::remove_var("APINOX_CONFIG_DIR");
    }

    /// A project NOT in the unified store (genuine legacy-only dir) must export
    /// the nested value the frontend sent — the fallback path never loses a
    /// legacy export.
    #[tokio::test]
    async fn export_workspace_falls_back_to_passed_value_for_legacy_projects() {
        use crate::utils::config::CONFIG_DIR_TEST_LOCK;
        let _guard = CONFIG_DIR_TEST_LOCK.lock().unwrap_or_else(|p| p.into_inner());
        let tmp = tempfile::tempdir().expect("tempdir");
        std::env::set_var("APINOX_CONFIG_DIR", tmp.path());

        // A legacy nested value with a real interface (NOT present in the
        // unified store).
        let legacy_value = serde_json::json!({
            "name": "LegacyOnly",
            "description": null,
            "id": "legacy-1",
            "interfaces": [
                {
                    "name": "LegacyPort",
                    "type": "wsdl",
                    "bindingName": "LegacySoap",
                    "soapVersion": "1.1",
                    "definition": "http://example.com/legacy.wsdl",
                    "operations": [
                        {
                            "name": "LegacyOp",
                            "action": "http://example.com/LegacyOp",
                            "input": null,
                            "targetNamespace": "http://example.com",
                            "originalEndpoint": "http://example.com/legacy",
                            "fullSchema": null,
                            "output": null,
                            "requests": [
                                { "name": "LegacyReq", "request": "<legacy/>", "id": "lreq-1" }
                            ]
                        }
                    ]
                }
            ],
            "testSuites": [],
            "folders": []
        });

        let file_path = tmp.path().join("legacy.apinox");
        let _ = export_workspace(
            vec![legacy_value.clone()],
            file_path.to_string_lossy().to_string(),
        )
        .await
        .expect("export legacy");

        let compressed = fs::read(&file_path).expect("read");
        use flate2::read::GzDecoder;
        let mut decoder = GzDecoder::new(&compressed[..]);
        let mut json_content = String::new();
        decoder.read_to_string(&mut json_content).expect("decompress");
        let parsed: serde_json::Value = serde_json::from_str(&json_content).expect("parse");

        let projects = parsed["projects"].as_array().unwrap();
        assert_eq!(projects.len(), 1);
        // The legacy value passed through unaltered (its own interface kept).
        assert_eq!(projects[0]["interfaces"][0]["operations"][0]["name"], "LegacyOp");
        assert_eq!(projects[0]["interfaces"][0]["operations"][0]["requests"][0]["request"], "<legacy/>");

        std::env::remove_var("APINOX_CONFIG_DIR");
    }
}
