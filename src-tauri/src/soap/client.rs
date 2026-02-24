/// SOAP Client
/// 
/// Executes SOAP requests with proper headers and response parsing

use anyhow::{Result, anyhow};
use reqwest::Client;
use quick_xml::events::Event;
use quick_xml::Reader;

use super::{EnvelopeBuilder, SoapVersion};
use super::ws_security::WsSecurityConfig;
use crate::parsers::wsdl::types::ServiceOperation;

/// SOAP Fault information
#[derive(Debug, Clone)]
pub struct SoapFault {
    pub faultcode: String,
    pub faultstring: String,
    pub faultactor: Option<String>,
    pub detail: Option<String>,
}

/// SOAP Response
#[derive(Debug, Clone)]
pub struct SoapResponse {
    pub status_code: u16,
    pub headers: Vec<(String, String)>,
    pub body: Option<String>,
    pub fault: Option<SoapFault>,
    pub raw_xml: String,
}

impl SoapResponse {
    /// Check if the response contains a SOAP Fault
    pub fn is_fault(&self) -> bool {
        self.fault.is_some()
    }
    
    /// Check if the response was successful (no fault)
    pub fn is_success(&self) -> bool {
        self.fault.is_none()
    }
}

/// SOAP Client for executing SOAP requests
pub struct SoapClient {
    http_client: Client,
}

impl SoapClient {
    /// Create a new SOAP client
    pub fn new() -> Self {
        Self {
            http_client: Client::new(),
        }
    }
    
    /// Create a SOAP client with a custom HTTP client
    pub fn with_client(client: Client) -> Self {
        Self {
            http_client: client,
        }
    }
    
    /// Execute a SOAP request
    /// 
    /// # Arguments
    /// * `operation` - The WSDL operation to execute
    /// * `soap_version` - SOAP 1.1 or 1.2
    /// * `values` - Field values for the request
    /// * `security` - Optional WS-Security configuration
    /// * `endpoint_override` - Optional endpoint URL (overrides operation.original_endpoint)
    pub async fn execute(
        &self,
        operation: &ServiceOperation,
        soap_version: SoapVersion,
        values: std::collections::HashMap<String, String>,
        security: Option<WsSecurityConfig>,
        endpoint_override: Option<String>,
    ) -> Result<SoapResponse> {
        // Build the SOAP envelope
        let mut builder = EnvelopeBuilder::new(soap_version, operation.clone());
        
        for (path, value) in values {
            builder.set_value(&path, value);
        }
        
        if let Some(sec) = security {
            builder.set_security(sec);
        }
        
        let envelope = builder.build()?;
        
        // Determine endpoint
        let endpoint = endpoint_override
            .or_else(|| operation.original_endpoint.clone())
            .ok_or_else(|| anyhow!("No endpoint specified for operation"))?;
        
        // Prepare headers
        let content_type = soap_version.content_type();
        let mut request = self.http_client
            .post(&endpoint)
            .header("Content-Type", content_type)
            .body(envelope.clone());
        
        // Add SOAPAction header for SOAP 1.1
        if soap_version == SoapVersion::Soap11 {
            let soap_action = operation.action.as_deref().unwrap_or("");
            log::info!("Setting SOAPAction header: \"{}\"", soap_action);
            request = request.header("SOAPAction", format!("\"{}\"", soap_action));
        }
        
        // Execute the request
        log::info!("Sending SOAP request to: {}", endpoint);
        log::debug!("Request body: {}", envelope);
        let response = request.send().await?;
        
        let status_code = response.status().as_u16();
        
        // Extract response headers
        let headers: Vec<(String, String)> = response.headers()
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
            .collect();
        
        // Get response body
        let raw_xml = response.text().await?;
        
        // Parse the SOAP response
        let (body, fault) = parse_soap_response(&raw_xml)?;
        
        Ok(SoapResponse {
            status_code,
            headers,
            body,
            fault,
            raw_xml,
        })
    }
}

impl Default for SoapClient {
    fn default() -> Self {
        Self::new()
    }
}

/// Parse SOAP response and extract body or fault
fn parse_soap_response(xml: &str) -> Result<(Option<String>, Option<SoapFault>)> {
    let mut reader = Reader::from_str(xml);
    reader.trim_text(true);
    
    let mut buf = Vec::new();
    let mut in_body = false;
    let mut in_fault = false;
    let mut body_content = String::new();
    let mut body_depth = 0;
    
    // Fault fields
    let mut faultcode = String::new();
    let mut faultstring = String::new();
    let mut faultactor = None;
    let mut detail = None;
    
    let mut current_element = String::new();
    
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let name = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                
                if name == "Body" {
                    in_body = true;
                    body_depth = 0;
                } else if in_body {
                    if body_depth == 0 && name == "Fault" {
                        in_fault = true;
                    } else if !in_fault {
                        // Capture body content
                        body_content.push('<');
                        body_content.push_str(&name);
                        
                        // Add attributes
                        for attr in e.attributes() {
                            if let Ok(attr) = attr {
                                body_content.push(' ');
                                body_content.push_str(&String::from_utf8_lossy(attr.key.as_ref()));
                                body_content.push_str("=\"");
                                body_content.push_str(&String::from_utf8_lossy(&attr.value));
                                body_content.push('"');
                            }
                        }
                        
                        body_content.push('>');
                    }
                    
                    body_depth += 1;
                    current_element = name;
                }
            }
            Ok(Event::End(e)) => {
                let name = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                
                if name == "Body" {
                    in_body = false;
                } else if in_body {
                    body_depth -= 1;
                    
                    if !in_fault {
                        body_content.push_str("</");
                        body_content.push_str(&name);
                        body_content.push('>');
                    }
                    
                    if body_depth == 0 && name == "Fault" {
                        in_fault = false;
                    }
                }
            }
            Ok(Event::Text(e)) => {
                if in_body && in_fault {
                    let text = e.unescape()?.to_string();
                    match current_element.as_str() {
                        "faultcode" => faultcode = text,
                        "faultstring" => faultstring = text,
                        "faultactor" => faultactor = Some(text),
                        "detail" => detail = Some(text),
                        _ => {}
                    }
                } else if in_body && !in_fault {
                    let text = e.unescape()?.to_string();
                    body_content.push_str(&text);
                }
            }
            Ok(Event::Empty(e)) => {
                if in_body && !in_fault {
                    let name = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                    body_content.push('<');
                    body_content.push_str(&name);
                    
                    // Add attributes
                    for attr in e.attributes() {
                        if let Ok(attr) = attr {
                            body_content.push(' ');
                            body_content.push_str(&String::from_utf8_lossy(attr.key.as_ref()));
                            body_content.push_str("=\"");
                            body_content.push_str(&String::from_utf8_lossy(&attr.value));
                            body_content.push('"');
                        }
                    }
                    
                    body_content.push_str("/>");
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(anyhow!("Error parsing SOAP response: {}", e)),
            _ => {}
        }
        
        buf.clear();
    }
    
    let fault = if !faultcode.is_empty() {
        Some(SoapFault {
            faultcode,
            faultstring,
            faultactor,
            detail,
        })
    } else {
        None
    };
    
    let body = if !body_content.is_empty() {
        Some(body_content)
    } else {
        None
    };
    
    Ok((body, fault))
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_successful_response() {
        let xml = r#"<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetUserResponse>
      <UserId>12345</UserId>
      <Name>John Doe</Name>
    </GetUserResponse>
  </soap:Body>
</soap:Envelope>"#;
        
        let (body, fault) = parse_soap_response(xml).unwrap();
        
        assert!(fault.is_none());
        assert!(body.is_some());
        
        let body = body.unwrap();
        assert!(body.contains("<GetUserResponse>"));
        assert!(body.contains("<UserId>12345</UserId>"));
        assert!(body.contains("<Name>John Doe</Name>"));
    }
    
    #[test]
    fn test_parse_fault_response() {
        let xml = r#"<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:Client</faultcode>
      <faultstring>Invalid credentials</faultstring>
      <faultactor>http://example.com/auth</faultactor>
      <detail>Username or password is incorrect</detail>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>"#;
        
        let (body, fault) = parse_soap_response(xml).unwrap();
        
        assert!(body.is_none());
        assert!(fault.is_some());
        
        let fault = fault.unwrap();
        assert_eq!(fault.faultcode, "soap:Client");
        assert_eq!(fault.faultstring, "Invalid credentials");
        assert_eq!(fault.faultactor.as_deref(), Some("http://example.com/auth"));
        assert_eq!(fault.detail.as_deref(), Some("Username or password is incorrect"));
    }
    
    #[test]
    fn test_soap_response_helpers() {
        let success_response = SoapResponse {
            status_code: 200,
            headers: vec![],
            body: Some("<Response/>".to_string()),
            fault: None,
            raw_xml: "".to_string(),
        };
        
        assert!(success_response.is_success());
        assert!(!success_response.is_fault());
        
        let fault_response = SoapResponse {
            status_code: 500,
            headers: vec![],
            body: None,
            fault: Some(SoapFault {
                faultcode: "soap:Server".to_string(),
                faultstring: "Internal error".to_string(),
                faultactor: None,
                detail: None,
            }),
            raw_xml: "".to_string(),
        };
        
        assert!(!fault_response.is_success());
        assert!(fault_response.is_fault());
    }
}
