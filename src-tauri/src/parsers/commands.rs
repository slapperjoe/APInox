// Parser commands for Tauri
// Exposes WSDL and OpenAPI parsing to the frontend

use super::openapi_parser::{OpenApiParser, OpenApiSpec};
use crate::http::HttpClient;
use std::collections::HashMap;

#[tauri::command]
pub async fn parse_openapi_spec(url_or_json: String) -> Result<OpenApiSpec, String> {
    log::info!("Parsing OpenAPI spec from: {}", url_or_json);
    
    // Check if it's a URL or JSON string
    let json_str = if url_or_json.trim().starts_with('{') || url_or_json.trim().starts_with("openapi:") {
        // It's JSON content
        url_or_json
    } else {
        // It's a URL - fetch it
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

    OpenApiParser::parse_json(&json_str)
        .map_err(|e| format!("Failed to parse OpenAPI spec: {}", e))
}
