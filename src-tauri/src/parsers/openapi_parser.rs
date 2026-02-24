// OpenAPI/Swagger Parser
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenApiSpec {
    pub title: String,
    pub version: String,
    pub description: Option<String>,
    pub base_url: Option<String>,
    pub paths: Vec<OpenApiPath>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenApiPath {
    pub path: String,
    pub method: String,
    pub operation_id: Option<String>,
    pub summary: Option<String>,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub parameters: Vec<OpenApiParameter>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenApiParameter {
    pub name: String,
    pub location: String, // "query", "path", "header", "body"
    pub required: bool,
    pub param_type: Option<String>,
    pub description: Option<String>,
}

pub struct OpenApiParser;

impl OpenApiParser {
    /// Parse an OpenAPI/Swagger spec from JSON
    pub fn parse_json(json_str: &str) -> Result<OpenApiSpec> {
        let spec: Value = serde_json::from_str(json_str)
            .context("Failed to parse OpenAPI JSON")?;

        Self::parse_spec(spec)
    }

    /// Parse an OpenAPI/Swagger spec from a serde_json::Value
    pub fn parse_spec(spec: Value) -> Result<OpenApiSpec> {
        // Extract info
        let info = spec.get("info")
            .context("Missing 'info' field in OpenAPI spec")?;
        
        let title = info.get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Untitled API")
            .to_string();
        
        let version = info.get("version")
            .and_then(|v| v.as_str())
            .unwrap_or("1.0.0")
            .to_string();
        
        let description = info.get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract base URL
        let base_url = Self::extract_base_url(&spec);

        // Extract paths
        let paths = Self::extract_paths(&spec)?;

        Ok(OpenApiSpec {
            title,
            version,
            description,
            base_url,
            paths,
        })
    }

    fn extract_base_url(spec: &Value) -> Option<String> {
        // OpenAPI 3.x: servers array
        if let Some(servers) = spec.get("servers").and_then(|s| s.as_array()) {
            if let Some(first_server) = servers.first() {
                if let Some(url) = first_server.get("url").and_then(|u| u.as_str()) {
                    return Some(url.to_string());
                }
            }
        }

        // Swagger 2.0: scheme + host + basePath
        let scheme = spec.get("schemes")
            .and_then(|s| s.as_array())
            .and_then(|arr| arr.first())
            .and_then(|s| s.as_str())
            .unwrap_or("http");
        
        let host = spec.get("host").and_then(|h| h.as_str())?;
        let base_path = spec.get("basePath").and_then(|bp| bp.as_str()).unwrap_or("");
        
        Some(format!("{}://{}{}", scheme, host, base_path))
    }

    fn extract_paths(spec: &Value) -> Result<Vec<OpenApiPath>> {
        let paths_obj = spec.get("paths")
            .and_then(|p| p.as_object())
            .context("Missing or invalid 'paths' field")?;

        let mut paths = Vec::new();
        let methods = ["get", "post", "put", "delete", "patch", "head", "options"];

        for (path_key, path_item) in paths_obj {
            let path_obj = path_item.as_object().context("Invalid path item")?;

            for method in &methods {
                if let Some(operation) = path_obj.get(*method) {
                    let op_obj = operation.as_object().context("Invalid operation")?;

                    let operation_id = op_obj.get("operationId")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());

                    let summary = op_obj.get("summary")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());

                    let description = op_obj.get("description")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());

                    let tags = op_obj.get("tags")
                        .and_then(|v| v.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                .collect()
                        })
                        .unwrap_or_default();

                    let parameters = op_obj.get("parameters")
                        .and_then(|v| v.as_array())
                        .map(|arr| Self::extract_parameters(arr))
                        .unwrap_or_default();

                    paths.push(OpenApiPath {
                        path: path_key.clone(),
                        method: method.to_uppercase(),
                        operation_id,
                        summary,
                        description,
                        tags,
                        parameters,
                    });
                }
            }
        }

        Ok(paths)
    }

    fn extract_parameters(params_array: &Vec<Value>) -> Vec<OpenApiParameter> {
        params_array.iter()
            .filter_map(|param| {
                let param_obj = param.as_object()?;
                
                let name = param_obj.get("name")?.as_str()?.to_string();
                let location = param_obj.get("in")?.as_str()?.to_string();
                let required = param_obj.get("required")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                let param_type = param_obj.get("type")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let description = param_obj.get("description")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                Some(OpenApiParameter {
                    name,
                    location,
                    required,
                    param_type,
                    description,
                })
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_basic_openapi() {
        let spec_json = r#"{
            "openapi": "3.0.0",
            "info": {
                "title": "Test API",
                "version": "1.0.0",
                "description": "A test API"
            },
            "servers": [
                { "url": "https://api.example.com/v1" }
            ],
            "paths": {
                "/users": {
                    "get": {
                        "operationId": "getUsers",
                        "summary": "Get all users",
                        "tags": ["Users"],
                        "parameters": []
                    }
                }
            }
        }"#;

        let spec = OpenApiParser::parse_json(spec_json).unwrap();
        assert_eq!(spec.title, "Test API");
        assert_eq!(spec.version, "1.0.0");
        assert_eq!(spec.base_url, Some("https://api.example.com/v1".to_string()));
        assert_eq!(spec.paths.len(), 1);
        assert_eq!(spec.paths[0].method, "GET");
        assert_eq!(spec.paths[0].path, "/users");
    }
}
