use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::soap::{EnvelopeBuilder, SoapVersion, SoapClient, WsSecurityConfig, UsernameToken, PasswordType};
use crate::parsers::wsdl::types::ServiceOperation;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildEnvelopeRequest {
    pub operation: ServiceOperation,
    pub soap_version: String, // "1.1" or "1.2"
    #[serde(default)]
    pub values: HashMap<String, String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildEnvelopeResponse {
    pub success: bool,
    pub envelope: Option<String>,
    pub error: Option<String>,
}

/// Build a SOAP envelope from an operation schema
#[tauri::command]
pub async fn build_soap_envelope(
    request: BuildEnvelopeRequest,
) -> Result<BuildEnvelopeResponse, String> {
    // Parse SOAP version
    let version = match request.soap_version.as_str() {
        "1.1" => SoapVersion::Soap11,
        "1.2" => SoapVersion::Soap12,
        _ => return Ok(BuildEnvelopeResponse {
            success: false,
            envelope: None,
            error: Some(format!("Invalid SOAP version: {}", request.soap_version)),
        }),
    };
    
    // Create envelope builder
    let mut builder = EnvelopeBuilder::new(version, request.operation);
    
    // Set user-provided values
    for (path, value) in request.values {
        builder.set_value(&path, value);
    }
    
    // Build the envelope
    match builder.build() {
        Ok(envelope) => Ok(BuildEnvelopeResponse {
            success: true,
            envelope: Some(envelope),
            error: None,
        }),
        Err(e) => Ok(BuildEnvelopeResponse {
            success: false,
            envelope: None,
            error: Some(e.to_string()),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    
    #[tokio::test]
    async fn test_build_envelope_command() {
        let operation = ServiceOperation {
            name: "GetUser".to_string(),
            target_namespace: Some("http://example.com/service".to_string()),
            original_endpoint: Some("http://example.com/service".to_string()),
            action: Some("http://example.com/service/GetUser".to_string()),
            input: Some(json!("GetUserRequest")),
            output: json!("GetUserResponse"),
            full_schema: None,
            description: None,
            port_name: None,
        };
        
        let request = BuildEnvelopeRequest {
            operation,
            soap_version: "1.1".to_string(),
            values: HashMap::new(),
        };
        
        let response = build_soap_envelope(request).await.unwrap();
        
        assert!(response.success);
        assert!(response.envelope.is_some());
        
        let envelope = response.envelope.unwrap();
        assert!(envelope.contains("<soap:Envelope"));
        assert!(envelope.contains("</soap:Envelope>"));
    }
}

/// Request to execute a SOAP operation
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteSoapRequest {
    pub operation: ServiceOperation,
    pub soap_version: String, // "1.1" or "1.2"
    #[serde(default)]
    pub values: HashMap<String, String>,
    pub endpoint: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub password_type: Option<String>, // "text" or "digest"
    pub add_timestamp: Option<bool>,
}

/// Response from SOAP execution
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteSoapResponse {
    pub success: bool,
    pub status_code: u16,
    pub headers: Vec<(String, String)>,
    pub body: Option<String>,
    pub fault: Option<SoapFaultResponse>,
    pub raw_xml: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SoapFaultResponse {
    pub faultcode: String,
    pub faultstring: String,
    pub faultactor: Option<String>,
    pub detail: Option<String>,
}

/// Execute a SOAP request
#[tauri::command]
pub async fn execute_soap_request(
    request: ExecuteSoapRequest,
) -> Result<ExecuteSoapResponse, String> {
    log::info!("Executing SOAP request for operation: {}", request.operation.name);
    log::debug!("Operation target_namespace: {:?}", request.operation.target_namespace);
    log::debug!("Operation action: {:?}", request.operation.action);
    
    // Parse SOAP version
    let version = match request.soap_version.as_str() {
        "1.1" => SoapVersion::Soap11,
        "1.2" => SoapVersion::Soap12,
        _ => return Ok(ExecuteSoapResponse {
            success: false,
            status_code: 0,
            headers: vec![],
            body: None,
            fault: None,
            raw_xml: String::new(),
            error: Some(format!("Invalid SOAP version: {}", request.soap_version)),
        }),
    };
    
    // Build security config
    let security = if let (Some(username), Some(password)) = (request.username, request.password) {
        let mut config = WsSecurityConfig::new();
        
        // Determine password type
        let password_type = match request.password_type.as_deref() {
            Some("digest") => PasswordType::Digest,
            _ => PasswordType::Text,
        };
        
        config = config.with_username_token(UsernameToken::new(
            username,
            password,
            password_type,
        ));
        
        // Add timestamp if requested
        if request.add_timestamp.unwrap_or(false) {
            config = config.with_default_timestamp();
        }
        
        Some(config)
    } else if request.add_timestamp.unwrap_or(false) {
        Some(WsSecurityConfig::new().with_default_timestamp())
    } else {
        None
    };
    
    // Execute the request
    let client = SoapClient::new();
    
    match client.execute(
        &request.operation,
        version,
        request.values,
        security,
        request.endpoint,
    ).await {
        Ok(response) => {
            let fault = response.fault.as_ref().map(|f| SoapFaultResponse {
                faultcode: f.faultcode.clone(),
                faultstring: f.faultstring.clone(),
                faultactor: f.faultactor.clone(),
                detail: f.detail.clone(),
            });
            
            Ok(ExecuteSoapResponse {
                success: response.is_success(),
                status_code: response.status_code,
                headers: response.headers,
                body: response.body,
                fault,
                raw_xml: response.raw_xml,
                error: None,
            })
        }
        Err(e) => Ok(ExecuteSoapResponse {
            success: false,
            status_code: 0,
            headers: vec![],
            body: None,
            fault: None,
            raw_xml: String::new(),
            error: Some(e.to_string()),
        }),
    }
}

/// Cancel an in-flight request
/// 
/// NOTE: Currently a no-op stub. The frontend handles cancellation by setting loading state to false.
/// In the future, we could implement proper request tracking with tokio::CancellationToken
/// to abort in-flight HTTP requests, but for now the UI cancellation is sufficient.
#[tauri::command]
pub async fn cancel_request() -> Result<serde_json::Value, String> {
    log::debug!("Request cancellation called (no-op - frontend handles UI state)");
    Ok(serde_json::json!({ "success": true }))
}
