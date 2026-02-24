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
    pub sample_body: Option<String>,
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

    /// Parse an OpenAPI/Swagger spec from YAML
    pub fn parse_yaml(yaml_str: &str) -> Result<OpenApiSpec> {
        let spec: Value = serde_yaml::from_str(yaml_str)
            .context("Failed to parse OpenAPI YAML")?;

        Self::parse_spec(spec)
    }

    /// Parse an OpenAPI/Swagger spec from either JSON or YAML (auto-detect)
    pub fn parse_auto(content: &str) -> Result<OpenApiSpec> {
        let trimmed = content.trim();
        if trimmed.starts_with('{') || trimmed.starts_with('[') {
            Self::parse_json(content)
        } else {
            Self::parse_yaml(content)
        }
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

                    // Generate sample body for methods that typically have a body
                    let sample_body = match *method {
                        "post" | "put" | "patch" => Self::extract_sample_body(op_obj, spec),
                        _ => None,
                    };

                    paths.push(OpenApiPath {
                        path: path_key.clone(),
                        method: method.to_uppercase(),
                        operation_id,
                        summary,
                        description,
                        tags,
                        parameters,
                        sample_body,
                    });
                }
            }
        }

        Ok(paths)
    }

    /// Extract and generate a sample JSON body from an operation's requestBody (OAS3) or body parameter (Swagger 2)
    fn extract_sample_body(op_obj: &serde_json::Map<String, Value>, spec: &Value) -> Option<String> {
        // OpenAPI 3.x: requestBody.content['application/json'].schema
        let schema = if let Some(rb) = op_obj.get("requestBody") {
            rb.get("content")
                .and_then(|c| c.get("application/json").or_else(|| c.as_object().and_then(|m| m.values().next())))
                .and_then(|mt| mt.get("schema"))
                .cloned()
        } else {
            // Swagger 2.0: find parameter with in=body
            op_obj.get("parameters")
                .and_then(|v| v.as_array())
                .and_then(|arr| {
                    arr.iter().find(|p| p.get("in").and_then(|v| v.as_str()) == Some("body"))
                })
                .and_then(|p| p.get("schema"))
                .cloned()
        }?;

        let sample = Self::generate_sample(&schema, spec, 0);
        serde_json::to_string_pretty(&sample).ok()
    }

    /// Recursively generate a sample value from a JSON Schema node
    fn generate_sample(schema: &Value, spec: &Value, depth: usize) -> Value {
        if depth > 5 {
            return Value::Null;
        }

        // Resolve $ref
        if let Some(ref_path) = schema.get("$ref").and_then(|v| v.as_str()) {
            if let Some(resolved) = Self::resolve_ref(ref_path, spec) {
                return Self::generate_sample(&resolved, spec, depth + 1);
            }
            return Value::Null;
        }

        // Use example if available
        if let Some(example) = schema.get("example") {
            return example.clone();
        }

        let schema_type = schema.get("type").and_then(|v| v.as_str()).unwrap_or("");

        match schema_type {
            "object" | "" => {
                // Could be object or allOf/oneOf/anyOf
                if let Some(all_of) = schema.get("allOf").and_then(|v| v.as_array()) {
                    let mut merged = serde_json::Map::new();
                    for sub in all_of {
                        if let Value::Object(obj) = Self::generate_sample(sub, spec, depth + 1) {
                            merged.extend(obj);
                        }
                    }
                    return Value::Object(merged);
                }

                if let Some(one_of) = schema.get("oneOf").or_else(|| schema.get("anyOf"))
                    .and_then(|v| v.as_array())
                {
                    if let Some(first) = one_of.first() {
                        return Self::generate_sample(first, spec, depth + 1);
                    }
                }

                let mut obj = serde_json::Map::new();
                if let Some(props) = schema.get("properties").and_then(|v| v.as_object()) {
                    for (key, prop_schema) in props {
                        obj.insert(key.clone(), Self::generate_sample(prop_schema, spec, depth + 1));
                    }
                }
                Value::Object(obj)
            }
            "array" => {
                let item_sample = schema.get("items")
                    .map(|items| Self::generate_sample(items, spec, depth + 1))
                    .unwrap_or(Value::Null);
                Value::Array(vec![item_sample])
            }
            "string" => {
                if let Some(fmt) = schema.get("format").and_then(|v| v.as_str()) {
                    match fmt {
                        "date" => Value::String("2024-01-01".to_string()),
                        "date-time" => Value::String("2024-01-01T00:00:00Z".to_string()),
                        "email" => Value::String("user@example.com".to_string()),
                        "uri" | "url" => Value::String("https://example.com".to_string()),
                        "uuid" => Value::String("00000000-0000-0000-0000-000000000000".to_string()),
                        _ => Value::String("string".to_string()),
                    }
                } else if let Some(enums) = schema.get("enum").and_then(|v| v.as_array()) {
                    enums.first().cloned().unwrap_or(Value::String("string".to_string()))
                } else {
                    Value::String("string".to_string())
                }
            }
            "integer" | "number" => {
                Value::Number(serde_json::Number::from(0))
            }
            "boolean" => Value::Bool(false),
            "null" => Value::Null,
            _ => Value::Null,
        }
    }

    /// Resolve a $ref path like "#/definitions/Foo" or "#/components/schemas/Foo"
    fn resolve_ref(ref_path: &str, spec: &Value) -> Option<Value> {
        if !ref_path.starts_with('#') {
            return None; // External refs not supported
        }
        let parts: Vec<String> = ref_path
            .trim_start_matches('#')
            .split('/')
            .filter(|s| !s.is_empty())
            .map(|s| s.replace("~1", "/").replace("~0", "~"))
            .collect();
        let mut current = spec.clone();
        for part in &parts {
            match current.get(part).cloned() {
                Some(next) => current = next,
                None => return None,
            }
        }
        Some(current)
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
