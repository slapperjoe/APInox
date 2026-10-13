/// Shared data models for APIprox.
/// These mirror the TypeScript definitions that were in shared/src/models.ts.
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// Proxy / Traffic
// ---------------------------------------------------------------------------

/// A single captured traffic event (request + response pair).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrafficEvent {
    pub id: String,
    pub timestamp: i64,
    pub timestamp_label: String,
    pub method: String,
    pub url: String,
    pub request_headers: HashMap<String, String>,
    pub request_body: String,
    pub status: Option<u16>,
    pub response_headers: Option<HashMap<String, String>>,
    pub response_body: Option<String>,
    pub duration_ms: Option<u64>,
    pub matched_rule: Option<String>,
    pub passthrough: Option<bool>,
    /// "proxy" | "mock"
    pub source: String,
}

/// Configuration for the proxy server.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyConfig {
    pub enabled: bool,
    pub port: u16,
    pub target_url: String,
    /// "proxy" | "mock" | "both"
    pub mode: String,
    /// Maximum request body size in bytes. None = unlimited (backward compatible).
    #[serde(default)]
    pub max_body_bytes: Option<u64>,
}

impl Default for ProxyConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            port: 8888,
            target_url: String::new(),
            mode: "proxy".to_string(),
            max_body_bytes: None,
        }
    }
}

// ---------------------------------------------------------------------------
// Mock Rules
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockMatchCondition {
    /// "url" | "operation" | "soapAction" | "header" | "contains" | "xpath" | "templateName"
    pub r#type: String,
    pub pattern: String,
    #[serde(default)]
    pub is_regex: bool,
    /// For type == "header"
    pub header_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockRule {
    #[serde(default)]
    pub id: String,
    pub name: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub conditions: Vec<MockMatchCondition>,
    pub status_code: u16,
    pub response_body: String,
    pub content_type: Option<String>,
    pub response_headers: Option<HashMap<String, String>>,
    pub delay_ms: Option<u64>,
    #[serde(default)]
    pub hit_count: u64,
    pub recorded_at: Option<i64>,
    pub recorded_from: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

/// A portable collection of mock rules that can be shared between developers.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockRuleCollection {
    pub name: String,
    pub description: String,
    pub version: String,
    pub exported_at: i64,
    pub rules: Vec<MockRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockConfig {
    #[serde(default)]
    pub enabled: bool,
    pub port: u16,
    pub target_url: String,
    #[serde(default)]
    pub rules: Vec<MockRule>,
    #[serde(default = "default_true")]
    pub passthrough_enabled: bool,
    #[serde(default)]
    pub route_through_proxy: bool,
    #[serde(default)]
    pub record_mode: bool,
    /// Maximum request body size in bytes. None = unlimited (backward compatible).
    #[serde(default)]
    pub max_body_bytes: Option<u64>,
}

impl Default for MockConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            port: 9001,
            target_url: "http://localhost:8080".to_string(),
            rules: Vec::new(),
            passthrough_enabled: true,
            route_through_proxy: false,
            record_mode: false,
            max_body_bytes: None,
        }
    }
}

// ---------------------------------------------------------------------------
// Replace Rules
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceRule {
    #[serde(default)]
    pub id: String,
    pub name: String,
    /// Serialized as `"enabled"` to match the TypeScript interface.
    #[serde(rename = "enabled", default = "default_true")]
    pub active: bool,
    /// "request" | "response" | "both".  Serialized as `"target"`.
    #[serde(rename = "target", default)]
    pub match_type: String,
    /// Serialized as `"matchText"` to match the TypeScript interface.
    #[serde(rename = "matchText", default)]
    pub match_pattern: String,
    #[serde(default)]
    pub replace_with: String,
    #[serde(default)]
    pub is_regex: bool,
    #[serde(default)]
    pub xpath: Option<String>,
}

// ---------------------------------------------------------------------------
// Breakpoints
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakpointCondition {
    /// "url" | "method" | "statusCode" | "header" | "contains"
    pub r#type: String,
    pub pattern: String,
    #[serde(default)]
    pub is_regex: bool,
    /// For type == "header"
    pub header_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakpointRule {
    pub id: String,
    pub name: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// "request" | "response" | "both"
    pub target: String,
    #[serde(default)]
    pub conditions: Vec<BreakpointCondition>,
}

/// A traffic item that is currently paused waiting for user action.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PausedTraffic {
    pub id: String,
    pub timestamp: i64,
    /// "request" | "response"
    pub pause_type: String,
    pub method: String,
    pub url: String,
    pub request_headers: HashMap<String, String>,
    pub request_body: String,
    pub status_code: Option<u16>,
    pub response_headers: Option<HashMap<String, String>>,
    pub response_body: Option<String>,
    pub matched_rule: String,
}

/// User's chosen action when resuming a paused request/response.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakpointResolution {
    /// "continue" | "drop"
    pub action: String,
    pub modified_headers: Option<HashMap<String, String>>,
    pub modified_body: Option<String>,
    pub modified_status_code: Option<u16>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn default_true() -> bool {
    true
}
