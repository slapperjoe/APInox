//! Type definitions for WSDL structures
//! 
//! Public types that represent the parsed WSDL structure.
//! These types are serializable and can be used by consumers of the parser.

use serde::{Deserialize, Serialize};

/// Schema node representing XSD element structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaNode {
    pub name: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub kind: String, // "complex" or "simple"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_occurs: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_occurs: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub documentation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<SchemaNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>, // For enums
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_optional: Option<bool>,
}

/// Service operation (method) definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceOperation {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input: Option<serde_json::Value>,
    pub output: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_namespace: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_endpoint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub full_schema: Option<SchemaNode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action: Option<String>, // SOAPAction header value
}

/// API Service (collection of operations)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiService {
    pub name: String,
    pub ports: Vec<String>,
    pub operations: Vec<ServiceOperation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_namespace: Option<String>,
}
