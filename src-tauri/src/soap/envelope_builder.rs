/// SOAP Envelope Builder
/// 
/// Generates SOAP 1.1 and 1.2 envelopes from WSDL operation schemas.
/// Builds request XML from SchemaNode trees with proper namespaces.

use anyhow::{Result, anyhow};
use std::collections::HashMap;

use crate::parsers::wsdl::types::{SchemaNode, ServiceOperation};
use super::ws_security::{WsSecurityConfig, build_security_header};

/// SOAP version
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SoapVersion {
    Soap11,
    Soap12,
}

impl SoapVersion {
    /// Get the namespace URI for this SOAP version
    pub fn namespace(&self) -> &'static str {
        match self {
            SoapVersion::Soap11 => "http://schemas.xmlsoap.org/soap/envelope/",
            SoapVersion::Soap12 => "http://www.w3.org/2003/05/soap-envelope",
        }
    }
    
    /// Get the Content-Type header for this SOAP version
    pub fn content_type(&self) -> &'static str {
        match self {
            SoapVersion::Soap11 => "text/xml; charset=utf-8",
            SoapVersion::Soap12 => "application/soap+xml; charset=utf-8",
        }
    }
}

/// Builder for SOAP envelopes
pub struct EnvelopeBuilder {
    version: SoapVersion,
    operation: ServiceOperation,
    values: HashMap<String, String>,
    security: Option<WsSecurityConfig>,
}

impl EnvelopeBuilder {
    /// Create a new envelope builder
    pub fn new(version: SoapVersion, operation: ServiceOperation) -> Self {
        Self {
            version,
            operation,
            values: HashMap::new(),
            security: None,
        }
    }
    
    /// Set a value for a specific field path
    /// 
    /// # Arguments
    /// * `path` - Dot-separated path to field (e.g., "Request.Customer.Name")
    /// * `value` - Value to set
    pub fn set_value(&mut self, path: &str, value: String) {
        self.values.insert(path.to_string(), value);
    }
    
    /// Set WS-Security configuration
    pub fn set_security(&mut self, security: WsSecurityConfig) {
        self.security = Some(security);
    }
    
    /// Build the SOAP envelope with the body generated from the schema
    pub fn build(&self) -> Result<String> {
        let soap_ns = self.version.namespace();
        let target_ns = self.operation.target_namespace.as_ref()
            .ok_or_else(|| anyhow!("Operation has no target namespace"))?;
        
        let mut xml = String::new();
        xml.push_str(r#"<?xml version="1.0" encoding="UTF-8"?>"#);
        xml.push('\n');
        
        // SOAP Envelope
        xml.push_str(&format!(
            r#"<soap:Envelope xmlns:soap="{}" xmlns:tns="{}">"#,
            soap_ns, target_ns
        ));
        xml.push('\n');
        
        // SOAP Header
        xml.push_str("  <soap:Header>");
        
        // Add WS-Security header if configured
        if let Some(ref security) = self.security {
            xml.push('\n');
            let security_header = build_security_header(security)?;
            // Indent security header
            for line in security_header.lines() {
                xml.push_str("    ");
                xml.push_str(line);
                xml.push('\n');
            }
            xml.push_str("  ");
        }
        
        xml.push_str("</soap:Header>\n");
        
        // SOAP Body
        xml.push_str("  <soap:Body>\n");
        
        // Generate body content from schema
        if let Some(schema) = &self.operation.full_schema {
            let body_xml = self.build_element(schema, "    ", "")?;
            xml.push_str(&body_xml);
        } else {
            // No schema, just create an empty operation element
            let op_name = &self.operation.name;
            xml.push_str(&format!("    <tns:{}>\n", op_name));
            xml.push_str(&format!("    </tns:{}>\n", op_name));
        }
        
        xml.push_str("  </soap:Body>\n");
        xml.push_str("</soap:Envelope>");
        
        Ok(xml)
    }
    
    /// Build XML for a single element from a SchemaNode
    fn build_element(&self, node: &SchemaNode, indent: &str, path: &str) -> Result<String> {
        let mut xml = String::new();
        
        // Construct the full path for this element
        let current_path = if path.is_empty() {
            node.name.clone()
        } else {
            format!("{}.{}", path, node.name)
        };
        
        // Check if this is optional (minOccurs = "0")
        let is_optional = node.min_occurs.as_ref()
            .map(|m| m == "0")
            .unwrap_or(false);
        
        // Skip optional elements unless we have a value for them
        if is_optional && !self.values.contains_key(&current_path) {
            return Ok(String::new());
        }
        
        // Determine namespace prefix (simplified - always use tns for now)
        let prefix = "tns";
        
        // Start tag
        xml.push_str(&format!("{}<{}:{}>\n", indent, prefix, node.name));
        
        // Content
        if let Some(children) = &node.children {
            // Complex type with children
            let child_indent = format!("{}  ", indent);
            for child in children {
                let child_xml = self.build_element(child, &child_indent, &current_path)?;
                xml.push_str(&child_xml);
            }
        } else {
            // Simple type - generate value
            let value = self.get_or_generate_value(&current_path, &node.node_type);
            if !value.is_empty() {
                xml.push_str(&format!("{}  {}\n", indent, value));
            }
        }
        
        // End tag
        xml.push_str(&format!("{}</{}:{}>\n", indent, prefix, node.name));
        
        Ok(xml)
    }
    
    /// Get a user-provided value or generate a sample value
    fn get_or_generate_value(&self, path: &str, xsd_type: &str) -> String {
        // Check if user provided a value
        if let Some(value) = self.values.get(path) {
            return xml_escape(value);
        }
        
        // Generate sample value based on XSD type
        generate_sample_value(xsd_type)
    }
}

/// Generate a sample value for an XSD type
fn generate_sample_value(xsd_type: &str) -> String {
    // Extract the local name (remove namespace prefix if present)
    let local_type = xsd_type.split(':').last().unwrap_or(xsd_type);
    
    match local_type {
        // String types
        "string" => "string".to_string(),
        "normalizedString" => "normalized string".to_string(),
        "token" => "token".to_string(),
        
        // Numeric types
        "int" | "integer" => "0".to_string(),
        "long" => "0".to_string(),
        "short" => "0".to_string(),
        "byte" => "0".to_string(),
        "decimal" => "0.0".to_string(),
        "float" => "0.0".to_string(),
        "double" => "0.0".to_string(),
        "unsignedInt" => "0".to_string(),
        "unsignedLong" => "0".to_string(),
        "unsignedShort" => "0".to_string(),
        "unsignedByte" => "0".to_string(),
        "positiveInteger" => "1".to_string(),
        "nonNegativeInteger" => "0".to_string(),
        
        // Boolean
        "boolean" => "false".to_string(),
        
        // Date/Time types
        "date" => "2024-01-01".to_string(),
        "time" => "12:00:00".to_string(),
        "dateTime" => "2024-01-01T12:00:00".to_string(),
        "duration" => "P1D".to_string(),
        "gDay" => "---01".to_string(),
        "gMonth" => "--01".to_string(),
        "gMonthDay" => "--01-01".to_string(),
        "gYear" => "2024".to_string(),
        "gYearMonth" => "2024-01".to_string(),
        
        // Binary types
        "base64Binary" => "SGVsbG8gV29ybGQ=".to_string(),
        "hexBinary" => "48656C6C6F".to_string(),
        
        // Other types
        "anyURI" => "http://example.com".to_string(),
        "QName" => "ns:example".to_string(),
        "NOTATION" => "notation".to_string(),
        
        // Default for unknown types
        _ => "".to_string(),
    }
}

/// Escape XML special characters
fn xml_escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_soap_version_namespace() {
        assert_eq!(
            SoapVersion::Soap11.namespace(),
            "http://schemas.xmlsoap.org/soap/envelope/"
        );
        assert_eq!(
            SoapVersion::Soap12.namespace(),
            "http://www.w3.org/2003/05/soap-envelope"
        );
    }
    
    #[test]
    fn test_soap_version_content_type() {
        assert_eq!(
            SoapVersion::Soap11.content_type(),
            "text/xml; charset=utf-8"
        );
        assert_eq!(
            SoapVersion::Soap12.content_type(),
            "application/soap+xml; charset=utf-8"
        );
    }
    
    #[test]
    fn test_sample_value_generation() {
        assert_eq!(generate_sample_value("string"), "string");
        assert_eq!(generate_sample_value("xsd:string"), "string");
        assert_eq!(generate_sample_value("int"), "0");
        assert_eq!(generate_sample_value("boolean"), "false");
        assert_eq!(generate_sample_value("dateTime"), "2024-01-01T12:00:00");
    }
    
    #[test]
    fn test_xml_escape() {
        assert_eq!(xml_escape("Hello & World"), "Hello &amp; World");
        assert_eq!(xml_escape("<tag>"), "&lt;tag&gt;");
        assert_eq!(xml_escape("\"quoted\""), "&quot;quoted&quot;");
    }
    
    #[test]
    fn test_build_simple_envelope() {
        use serde_json::json;
        
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
        
        let builder = EnvelopeBuilder::new(SoapVersion::Soap11, operation);
        let envelope = builder.build().unwrap();
        
        assert!(envelope.contains("soap:Envelope"));
        assert!(envelope.contains("http://schemas.xmlsoap.org/soap/envelope/"));
        assert!(envelope.contains("tns:GetUser"));
    }
}
