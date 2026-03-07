/// Frontend-compatible types for test execution
///
/// These types match the TypeScript `TestCase`, `TestStep`, and `ApiRequest`
/// interfaces from shared/src/models.ts, allowing the Rust backend to receive
/// and execute test cases sent from the webview.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Matches TypeScript `TestCase`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendTestCase {
    pub id: String,
    pub name: String,
    pub steps: Vec<FrontendTestStep>,
}

/// Matches TypeScript `TestStep`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendTestStep {
    pub id: String,
    pub name: String,
    /// "request" | "delay" | "transfer" | "script" | "workflow"
    #[serde(rename = "type")]
    pub step_type: String,
    pub config: FrontendStepConfig,
}

/// Matches TypeScript `TestStep.config`
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FrontendStepConfig {
    /// For 'request' steps
    pub request: Option<FrontendRequest>,
    /// For 'delay' steps
    pub delay_ms: Option<u64>,
    /// For 'script' steps
    pub script_content: Option<String>,
}

/// Matches TypeScript `ApiRequest`
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FrontendRequest {
    pub name: Option<String>,
    /// The raw XML/JSON body
    pub request: Option<String>,
    pub endpoint: Option<String>,
    pub method: Option<String>,
    pub content_type: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub assertions: Option<Vec<FrontendAssertion>>,
    pub extractors: Option<Vec<FrontendExtractor>>,
}

/// Matches TypeScript `Assertion`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendAssertion {
    #[serde(rename = "type")]
    pub assertion_type: String,
    pub name: Option<String>,
    pub configuration: Option<AssertionConfiguration>,
}

/// Matches TypeScript `Assertion.configuration`
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AssertionConfiguration {
    /// For Contains / Not Contains
    pub token: Option<String>,
    pub ignore_case: Option<bool>,
    /// For SLA (milliseconds as string)
    pub sla: Option<String>,
    /// For XPath Match
    pub xpath: Option<String>,
    pub expected_content: Option<String>,
    /// For SOAP Fault
    pub expect_fault: Option<bool>,
    pub fault_code: Option<String>,
    /// For HTTP Status (comma-separated e.g. "200,201")
    pub expected_status: Option<String>,
    /// For Script assertions
    pub script: Option<String>,
}

/// Matches TypeScript `RequestExtractor`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendExtractor {
    pub id: String,
    pub variable: String,
    /// "XPath" | "JSONPath" | "Regex" | "Header"
    #[serde(rename = "type")]
    pub extractor_type: Option<String>,
    /// "body" | "header"
    pub source: Option<String>,
    pub path: Option<String>,
    pub default_value: Option<String>,
}

/// Result of a single assertion check
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssertionResult {
    pub name: String,
    pub status: String, // "PASS" | "FAIL" | "SKIP"
    pub message: Option<String>,
}

/// Result of executing a single step
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StepExecutionResult {
    pub passed: bool,
    pub response_body: Option<String>,
    pub status_code: Option<u16>,
    pub duration_ms: u64,
    pub assertion_results: Vec<AssertionResult>,
    pub extracted_variables: HashMap<String, String>,
    pub error: Option<String>,
}
