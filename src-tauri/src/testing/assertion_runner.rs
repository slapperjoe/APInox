/// Assertion Runner
/// 
/// Validates response content against assertions using XPath, JSONPath, regex, etc.

use anyhow::{Result, anyhow};
use regex::Regex;
use serde::{Deserialize, Serialize};
use sxd_document::parser;
use sxd_xpath::{evaluate_xpath, Value};
use serde_json::Value as JsonValue;

/// Assertion type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum AssertionType {
    /// XPath assertion on XML response
    XPath {
        xpath: String,
        expected: String,
    },
    /// JSONPath assertion on JSON response
    #[serde(rename = "jsonpath")]
    JsonPath {
        path: String,
        expected: String,
    },
    /// Regex match assertion
    Regex {
        pattern: String,
        expected: Option<String>,
    },
    /// Contains string assertion
    Contains {
        value: String,
    },
    /// Equals assertion (exact match)
    Equals {
        expected: String,
    },
    /// Status code assertion
    StatusCode {
        code: u16,
    },
    /// Response time assertion (milliseconds)
    ResponseTime {
        max_ms: u64,
    },
}

/// Assertion result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssertionResult {
    pub assertion_type: String,
    pub passed: bool,
    pub message: String,
    pub actual: Option<String>,
    pub expected: Option<String>,
}

impl AssertionResult {
    pub fn success(assertion_type: String, message: String) -> Self {
        Self {
            assertion_type,
            passed: true,
            message,
            actual: None,
            expected: None,
        }
    }
    
    pub fn failure(
        assertion_type: String,
        message: String,
        actual: Option<String>,
        expected: Option<String>,
    ) -> Self {
        Self {
            assertion_type,
            passed: false,
            message,
            actual,
            expected,
        }
    }
}

/// Run an assertion against response data
pub fn run_assertion(
    assertion: &AssertionType,
    response_body: &str,
    status_code: u16,
    response_time_ms: Option<u64>,
) -> Result<AssertionResult> {
    match assertion {
        AssertionType::XPath { xpath, expected } => {
            run_xpath_assertion(response_body, xpath, expected)
        }
        AssertionType::JsonPath { path, expected } => {
            run_jsonpath_assertion(response_body, path, expected)
        }
        AssertionType::Regex { pattern, expected } => {
            run_regex_assertion(response_body, pattern, expected.as_deref())
        }
        AssertionType::Contains { value } => {
            run_contains_assertion(response_body, value)
        }
        AssertionType::Equals { expected } => {
            run_equals_assertion(response_body, expected)
        }
        AssertionType::StatusCode { code } => {
            run_status_code_assertion(status_code, *code)
        }
        AssertionType::ResponseTime { max_ms } => {
            run_response_time_assertion(response_time_ms, *max_ms)
        }
    }
}

fn run_xpath_assertion(xml: &str, xpath: &str, expected: &str) -> Result<AssertionResult> {
    let package = parser::parse(xml)
        .map_err(|e| anyhow!("Failed to parse XML: {}", e))?;
    let document = package.as_document();
    
    let value = evaluate_xpath(&document, xpath)
        .map_err(|e| anyhow!("XPath evaluation failed: {}", e))?;
    
    let actual = match value {
        Value::String(s) => s,
        Value::Number(n) => n.to_string(),
        Value::Boolean(b) => b.to_string(),
        Value::Nodeset(nodes) => {
            if nodes.size() == 0 {
                String::new()
            } else {
                nodes.document_order()
                    .iter()
                    .map(|n| n.string_value())
                    .collect::<Vec<_>>()
                    .join(", ")
            }
        }
    };
    
    if actual == expected {
        Ok(AssertionResult::success(
            "xpath".to_string(),
            format!("XPath '{}' matched expected value", xpath),
        ))
    } else {
        Ok(AssertionResult::failure(
            "xpath".to_string(),
            format!("XPath '{}' did not match", xpath),
            Some(actual),
            Some(expected.to_string()),
        ))
    }
}

fn run_jsonpath_assertion(json: &str, path: &str, expected: &str) -> Result<AssertionResult> {
    let value: JsonValue = serde_json::from_str(json)
        .map_err(|e| anyhow!("Failed to parse JSON: {}", e))?;
    
    // Simple JSONPath implementation (supports basic paths like $.user.name)
    let actual = extract_json_path(&value, path)?;
    
    if actual == expected {
        Ok(AssertionResult::success(
            "jsonpath".to_string(),
            format!("JSONPath '{}' matched expected value", path),
        ))
    } else {
        Ok(AssertionResult::failure(
            "jsonpath".to_string(),
            format!("JSONPath '{}' did not match", path),
            Some(actual),
            Some(expected.to_string()),
        ))
    }
}

fn extract_json_path(value: &JsonValue, path: &str) -> Result<String> {
    let parts: Vec<&str> = path.trim_start_matches('$').trim_start_matches('.').split('.').collect();
    let mut current = value;
    
    for part in parts {
        if part.is_empty() {
            continue;
        }
        
        current = current.get(part)
            .ok_or_else(|| anyhow!("Path '{}' not found", part))?;
    }
    
    Ok(match current {
        JsonValue::String(s) => s.clone(),
        JsonValue::Number(n) => n.to_string(),
        JsonValue::Bool(b) => b.to_string(),
        JsonValue::Null => "null".to_string(),
        _ => current.to_string(),
    })
}

fn run_regex_assertion(text: &str, pattern: &str, expected: Option<&str>) -> Result<AssertionResult> {
    let re = Regex::new(pattern)
        .map_err(|e| anyhow!("Invalid regex pattern: {}", e))?;
    
    if let Some(expected_match) = expected {
        // Check if captured group matches expected value
        if let Some(captures) = re.captures(text) {
            let actual = captures.get(1)
                .map(|m| m.as_str())
                .unwrap_or("");
            
            if actual == expected_match {
                Ok(AssertionResult::success(
                    "regex".to_string(),
                    format!("Regex '{}' captured expected value", pattern),
                ))
            } else {
                Ok(AssertionResult::failure(
                    "regex".to_string(),
                    format!("Regex '{}' captured different value", pattern),
                    Some(actual.to_string()),
                    Some(expected_match.to_string()),
                ))
            }
        } else {
            Ok(AssertionResult::failure(
                "regex".to_string(),
                format!("Regex '{}' did not match", pattern),
                None,
                Some(expected_match.to_string()),
            ))
        }
    } else {
        // Just check if pattern matches
        if re.is_match(text) {
            Ok(AssertionResult::success(
                "regex".to_string(),
                format!("Regex '{}' matched", pattern),
            ))
        } else {
            Ok(AssertionResult::failure(
                "regex".to_string(),
                format!("Regex '{}' did not match", pattern),
                None,
                None,
            ))
        }
    }
}

fn run_contains_assertion(text: &str, value: &str) -> Result<AssertionResult> {
    if text.contains(value) {
        Ok(AssertionResult::success(
            "contains".to_string(),
            format!("Response contains '{}'", value),
        ))
    } else {
        Ok(AssertionResult::failure(
            "contains".to_string(),
            format!("Response does not contain '{}'", value),
            Some(text.chars().take(100).collect()),
            Some(value.to_string()),
        ))
    }
}

fn run_equals_assertion(text: &str, expected: &str) -> Result<AssertionResult> {
    if text == expected {
        Ok(AssertionResult::success(
            "equals".to_string(),
            "Response equals expected value".to_string(),
        ))
    } else {
        Ok(AssertionResult::failure(
            "equals".to_string(),
            "Response does not equal expected value".to_string(),
            Some(text.chars().take(100).collect()),
            Some(expected.chars().take(100).collect()),
        ))
    }
}

fn run_status_code_assertion(actual: u16, expected: u16) -> Result<AssertionResult> {
    if actual == expected {
        Ok(AssertionResult::success(
            "status_code".to_string(),
            format!("Status code is {}", expected),
        ))
    } else {
        Ok(AssertionResult::failure(
            "status_code".to_string(),
            format!("Expected status code {}, got {}", expected, actual),
            Some(actual.to_string()),
            Some(expected.to_string()),
        ))
    }
}

fn run_response_time_assertion(actual_ms: Option<u64>, max_ms: u64) -> Result<AssertionResult> {
    let actual = actual_ms.ok_or_else(|| anyhow!("Response time not available"))?;
    
    if actual <= max_ms {
        Ok(AssertionResult::success(
            "response_time".to_string(),
            format!("Response time {}ms is within limit of {}ms", actual, max_ms),
        ))
    } else {
        Ok(AssertionResult::failure(
            "response_time".to_string(),
            format!("Response time {}ms exceeds limit of {}ms", actual, max_ms),
            Some(actual.to_string()),
            Some(max_ms.to_string()),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_xpath_assertion() {
        let xml = r#"<root><user><name>John</name></user></root>"#;
        let assertion = AssertionType::XPath {
            xpath: "/root/user/name".to_string(),
            expected: "John".to_string(),
        };
        
        let result = run_assertion(&assertion, xml, 200, None).unwrap();
        assert!(result.passed);
    }
    
    #[test]
    fn test_jsonpath_assertion() {
        let json = r#"{"user":{"name":"John"}}"#;
        let assertion = AssertionType::JsonPath {
            path: "$.user.name".to_string(),
            expected: "John".to_string(),
        };
        
        let result = run_assertion(&assertion, json, 200, None).unwrap();
        assert!(result.passed);
    }
    
    #[test]
    fn test_contains_assertion() {
        let text = "Hello World";
        let assertion = AssertionType::Contains {
            value: "World".to_string(),
        };
        
        let result = run_assertion(&assertion, text, 200, None).unwrap();
        assert!(result.passed);
    }
    
    #[test]
    fn test_regex_assertion() {
        let text = "User ID: 12345";
        let assertion = AssertionType::Regex {
            pattern: r"User ID: (\d+)".to_string(),
            expected: Some("12345".to_string()),
        };
        
        let result = run_assertion(&assertion, text, 200, None).unwrap();
        assert!(result.passed);
    }
    
    #[test]
    fn test_status_code_assertion() {
        let assertion = AssertionType::StatusCode { code: 200 };
        
        let result = run_assertion(&assertion, "", 200, None).unwrap();
        assert!(result.passed);
        
        let result = run_assertion(&assertion, "", 404, None).unwrap();
        assert!(!result.passed);
    }
    
    #[test]
    fn test_response_time_assertion() {
        let assertion = AssertionType::ResponseTime { max_ms: 1000 };
        
        let result = run_assertion(&assertion, "", 200, Some(500)).unwrap();
        assert!(result.passed);
        
        let result = run_assertion(&assertion, "", 200, Some(1500)).unwrap();
        assert!(!result.passed);
    }
}
