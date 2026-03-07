// Parser commands for Tauri
// Exposes WSDL and OpenAPI parsing to the frontend

use super::openapi_parser::{OpenApiParser, OpenApiSpec};
use crate::http::HttpClient;
use std::collections::HashMap;

fn looks_like_inline_content(s: &str) -> bool {
    let t = s.trim();
    t.starts_with('{') || t.starts_with('[')
        || t.starts_with("---")
        || t.starts_with("openapi:")
        || t.starts_with("swagger:")
}

#[tauri::command]
pub async fn parse_openapi_spec(url_or_json: String) -> Result<OpenApiSpec, String> {
    log::info!("Parsing OpenAPI spec from: {}", url_or_json);

    let content = if looks_like_inline_content(&url_or_json) {
        url_or_json
    } else {
        log::info!("Fetching OpenAPI spec from URL: {}", url_or_json);
        let client = HttpClient::new()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        let response = client.get(&url_or_json, HashMap::new()).await;

        if !response.success {
            return Err(format!("Failed to fetch OpenAPI spec: {}",
                response.error.unwrap_or_else(|| "Unknown error".to_string())));
        }

        response.body
    };

    OpenApiParser::parse_auto(&content)
        .map_err(|e| format!("Failed to parse OpenAPI spec: {}", e))
}
