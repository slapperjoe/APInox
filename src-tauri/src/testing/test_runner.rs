/// Test Runner
/// 
/// Executes test cases and test suites with variable context and assertions

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};

use super::assertion_runner::{AssertionType, AssertionResult, run_assertion};
use super::variable_extractor::{ExtractorType, extract_variable};
use crate::soap::{SoapClient, SoapVersion, WsSecurityConfig};
use crate::parsers::wsdl::types::ServiceOperation;

/// Test step type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum TestStepType {
    /// SOAP request step
    Soap {
        operation: ServiceOperation,
        soap_version: String,
        values: HashMap<String, String>,
        endpoint: Option<String>,
        security: Option<SecurityConfig>,
    },
    /// HTTP request step
    Http {
        method: String,
        url: String,
        headers: HashMap<String, String>,
        body: Option<String>,
    },
    /// Delay step (milliseconds)
    Delay {
        ms: u64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub username: Option<String>,
    pub password: Option<String>,
    pub password_type: Option<String>,
    pub add_timestamp: bool,
}

/// Variable extraction configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VariableExtraction {
    pub name: String,
    pub extractor: ExtractorType,
}

/// Test step
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestStep {
    pub name: String,
    pub step_type: TestStepType,
    #[serde(default)]
    pub assertions: Vec<AssertionType>,
    #[serde(default)]
    pub extractions: Vec<VariableExtraction>,
}

/// Test step result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestStepResult {
    pub step_name: String,
    pub passed: bool,
    pub duration_ms: u64,
    pub response_body: Option<String>,
    pub status_code: Option<u16>,
    pub assertion_results: Vec<AssertionResult>,
    pub extracted_variables: HashMap<String, String>,
    pub error: Option<String>,
}

/// Test case
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestCase {
    pub name: String,
    pub description: Option<String>,
    pub steps: Vec<TestStep>,
}

/// Test case result
#[derive(Debug, Clone, Serialize)]
pub struct TestCaseResult {
    pub test_name: String,
    pub passed: bool,
    pub total_duration_ms: u64,
    pub step_results: Vec<TestStepResult>,
}

/// Test runner
pub struct TestRunner {
    soap_client: SoapClient,
    pub variables: HashMap<String, String>,
}

impl TestRunner {
    pub fn new() -> Self {
        Self {
            soap_client: SoapClient::new(),
            variables: HashMap::new(),
        }
    }
    
    /// Set a variable in the context
    pub fn set_variable(&mut self, name: String, value: String) {
        self.variables.insert(name, value);
    }
    
    /// Get a variable from the context
    pub fn get_variable(&self, name: &str) -> Option<&String> {
        self.variables.get(name)
    }
    
    /// Replace variables in a string (e.g., "User {{userId}}" -> "User 12345")
    fn replace_variables(&self, text: &str) -> String {
        let mut result = text.to_string();
        
        for (name, value) in &self.variables {
            let placeholder = format!("{{{{{}}}}}", name);
            result = result.replace(&placeholder, value);
        }
        
        result
    }
    
    /// Execute a test case
    pub async fn run_test_case(&mut self, test_case: &TestCase) -> Result<TestCaseResult> {
        let start = Instant::now();
        let mut step_results = Vec::new();
        let mut all_passed = true;
        
        for step in &test_case.steps {
            let step_result = self.run_test_step(step).await?;
            
            if !step_result.passed {
                all_passed = false;
            }
            
            // Extract variables from this step
            for (name, value) in &step_result.extracted_variables {
                self.set_variable(name.clone(), value.clone());
            }
            
            step_results.push(step_result);
        }
        
        let total_duration_ms = start.elapsed().as_millis() as u64;
        
        Ok(TestCaseResult {
            test_name: test_case.name.clone(),
            passed: all_passed,
            total_duration_ms,
            step_results,
        })
    }
    
    /// Execute a single test step
    async fn run_test_step(&self, step: &TestStep) -> Result<TestStepResult> {
        let start = Instant::now();
        
        match &step.step_type {
            TestStepType::Soap { operation, soap_version, values, endpoint, security } => {
                self.run_soap_step(step, operation, soap_version, values, endpoint.as_deref(), security.as_ref(), start).await
            }
            TestStepType::Http { method, url, headers, body } => {
                self.run_http_step(step, method, url, headers, body.as_deref(), start).await
            }
            TestStepType::Delay { ms } => {
                self.run_delay_step(step, *ms, start).await
            }
        }
    }
    
    async fn run_soap_step(
        &self,
        step: &TestStep,
        operation: &ServiceOperation,
        soap_version: &str,
        values: &HashMap<String, String>,
        endpoint: Option<&str>,
        security: Option<&SecurityConfig>,
        start: Instant,
    ) -> Result<TestStepResult> {
        // Parse SOAP version
        let version = match soap_version {
            "1.1" => SoapVersion::Soap11,
            "1.2" => SoapVersion::Soap12,
            _ => {
                return Ok(TestStepResult {
                    step_name: step.name.clone(),
                    passed: false,
                    duration_ms: 0,
                    response_body: None,
                    status_code: None,
                    assertion_results: vec![],
                    extracted_variables: HashMap::new(),
                    error: Some(format!("Invalid SOAP version: {}", soap_version)),
                });
            }
        };
        
        // Replace variables in values
        let mut resolved_values = HashMap::new();
        for (k, v) in values {
            resolved_values.insert(k.clone(), self.replace_variables(v));
        }
        
        // Build security config
        let ws_security = security.and_then(|sec| {
            sec.username.as_ref().and_then(|username| {
                sec.password.as_ref().map(|password| {
                    let mut config = WsSecurityConfig::new();
                    
                    let password_type = match sec.password_type.as_deref() {
                        Some("digest") => crate::soap::PasswordType::Digest,
                        _ => crate::soap::PasswordType::Text,
                    };
                    
                    config = config.with_username_token(crate::soap::UsernameToken::new(
                        username.clone(),
                        password.clone(),
                        password_type,
                    ));
                    
                    if sec.add_timestamp {
                        config = config.with_default_timestamp();
                    }
                    
                    config
                })
            })
        });
        
        // Execute SOAP request
        let response = self.soap_client.execute(
            operation,
            version,
            resolved_values,
            ws_security,
            endpoint.map(|e| self.replace_variables(e)),
        ).await?;
        
        let duration_ms = start.elapsed().as_millis() as u64;
        let response_body = response.body.clone().unwrap_or_else(|| response.raw_xml.clone());
        
        // Run assertions
        let mut assertion_results = Vec::new();
        let mut all_assertions_passed = true;
        
        for assertion in &step.assertions {
            let result = run_assertion(assertion, &response_body, response.status_code, Some(duration_ms))?;
            if !result.passed {
                all_assertions_passed = false;
            }
            assertion_results.push(result);
        }
        
        // Extract variables
        let mut extracted_variables = HashMap::new();
        for extraction in &step.extractions {
            if let Ok(value) = extract_variable(&extraction.extractor, &response_body) {
                extracted_variables.insert(extraction.name.clone(), value);
            }
        }
        
        Ok(TestStepResult {
            step_name: step.name.clone(),
            passed: all_assertions_passed && response.is_success(),
            duration_ms,
            response_body: Some(response_body),
            status_code: Some(response.status_code),
            assertion_results,
            extracted_variables,
            error: response.fault.map(|f| format!("{}: {}", f.faultcode, f.faultstring)),
        })
    }
    
    async fn run_http_step(
        &self,
        step: &TestStep,
        _method: &str,
        _url: &str,
        _headers: &HashMap<String, String>,
        _body: Option<&str>,
        _start: Instant,
    ) -> Result<TestStepResult> {
        // HTTP step implementation (placeholder for now)
        Ok(TestStepResult {
            step_name: step.name.clone(),
            passed: true,
            duration_ms: 0,
            response_body: None,
            status_code: None,
            assertion_results: vec![],
            extracted_variables: HashMap::new(),
            error: None,
        })
    }
    
    async fn run_delay_step(
        &self,
        step: &TestStep,
        ms: u64,
        start: Instant,
    ) -> Result<TestStepResult> {
        tokio::time::sleep(Duration::from_millis(ms)).await;
        let duration_ms = start.elapsed().as_millis() as u64;
        
        Ok(TestStepResult {
            step_name: step.name.clone(),
            passed: true,
            duration_ms,
            response_body: None,
            status_code: None,
            assertion_results: vec![],
            extracted_variables: HashMap::new(),
            error: None,
        })
    }
}

impl Default for TestRunner {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_variable_replacement() {
        let mut runner = TestRunner::new();
        runner.set_variable("userId".to_string(), "12345".to_string());
        runner.set_variable("name".to_string(), "John".to_string());
        
        let text = "User {{userId}} is named {{name}}";
        let result = runner.replace_variables(text);
        
        assert_eq!(result, "User 12345 is named John");
    }
    
    #[test]
    fn test_variable_get_set() {
        let mut runner = TestRunner::new();
        runner.set_variable("test".to_string(), "value".to_string());
        
        assert_eq!(runner.get_variable("test"), Some(&"value".to_string()));
        assert_eq!(runner.get_variable("missing"), None);
    }
}
