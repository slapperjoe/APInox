/// Variable Extractor
/// 
/// Extracts values from responses using XPath, JSONPath, regex, etc.

use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use crate::utils::{RegexExtractor, XPathEvaluator};

/// Variable extraction method
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ExtractorType {
    /// Extract using XPath
    XPath {
        xpath: String,
    },
    /// Extract using JSONPath
    #[serde(rename = "jsonpath")]
    JsonPath {
        path: String,
    },
    /// Extract using regex (first capture group)
    Regex {
        pattern: String,
    },
    /// Extract entire response
    Full,
}

/// Variable extractor
pub struct VariableExtractor;

impl VariableExtractor {
    /// Extract a value from response
    pub fn extract(extractor: &ExtractorType, response: &str) -> Result<String> {
        match extractor {
            ExtractorType::XPath { xpath } => Self::extract_xpath(response, xpath),
            ExtractorType::JsonPath { path } => Self::extract_jsonpath(response, path),
            ExtractorType::Regex { pattern } => Self::extract_regex(response, pattern),
            ExtractorType::Full => Ok(response.to_string()),
        }
    }
    
    fn extract_xpath(xml: &str, xpath: &str) -> Result<String> {
        XPathEvaluator::evaluate(xml, xpath)
            .ok_or_else(|| anyhow!("XPath expression '{}' returned no results", xpath))
    }
    
    fn extract_jsonpath(json: &str, path: &str) -> Result<String> {
        let value: JsonValue = serde_json::from_str(json)
            .map_err(|e| anyhow!("Failed to parse JSON: {}", e))?;
        
        // Simple JSONPath implementation
        let parts: Vec<&str> = path.trim_start_matches('$').trim_start_matches('.').split('.').collect();
        let mut current = &value;
        
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
    
    fn extract_regex(text: &str, pattern: &str) -> Result<String> {
        RegexExtractor::extract(text, pattern)
            .ok_or_else(|| anyhow!("Regex '{}' did not match", pattern))
    }
}

/// Convenience function for extracting variables
pub fn extract_variable(extractor: &ExtractorType, response: &str) -> Result<String> {
    VariableExtractor::extract(extractor, response)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_extract_xpath() {
        let xml = r#"<root><user><id>12345</id></user></root>"#;
        let extractor = ExtractorType::XPath {
            xpath: "/root/user/id".to_string(),
        };
        
        let value = extract_variable(&extractor, xml).unwrap();
        assert_eq!(value, "12345");
    }
    
    #[test]
    fn test_extract_jsonpath() {
        let json = r#"{"user":{"id":"67890"}}"#;
        let extractor = ExtractorType::JsonPath {
            path: "$.user.id".to_string(),
        };
        
        let value = extract_variable(&extractor, json).unwrap();
        assert_eq!(value, "67890");
    }
    
    #[test]
    fn test_extract_regex() {
        let text = "Session ID: ABC123XYZ";
        let extractor = ExtractorType::Regex {
            pattern: r"Session ID: (\w+)".to_string(),
        };
        
        let value = extract_variable(&extractor, text).unwrap();
        assert_eq!(value, "ABC123XYZ");
    }
    
    #[test]
    fn test_extract_full() {
        let text = "Complete response";
        let extractor = ExtractorType::Full;
        
        let value = extract_variable(&extractor, text).unwrap();
        assert_eq!(value, "Complete response");
    }
}
