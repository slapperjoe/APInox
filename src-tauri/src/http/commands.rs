// HTTP commands for Tauri
// Exposes HTTP client functionality to the frontend

use super::client::{HttpClient, HttpRequest, HttpResponse};
use std::collections::HashMap;

#[tauri::command]
pub async fn execute_http_request(
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<String>,
    timeout_ms: Option<u64>,
    follow_redirects: Option<bool>,
    verify_ssl: Option<bool>,
    proxy_url: Option<String>,
    proxy_username: Option<String>,
    proxy_password: Option<String>,
) -> Result<HttpResponse, String> {
    log::info!("Executing HTTP request: {} {}", method, url);
    
    let client = HttpClient::new()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let request = HttpRequest {
        method,
        url,
        headers,
        body,
        timeout_ms,
        follow_redirects,
        verify_ssl,
        proxy_url,
        proxy_username,
        proxy_password,
    };

    Ok(client.execute(request).await)
}

#[tauri::command]
pub async fn execute_rest_request(
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<String>,
) -> Result<HttpResponse, String> {
    log::info!("Executing REST request: {} {}", method, url);
    
    execute_http_request(
        method,
        url,
        headers,
        body,
        None,  // timeout
        Some(true),  // follow redirects
        Some(true),  // verify SSL
        None,  // proxy
        None,
        None,
    ).await
}
