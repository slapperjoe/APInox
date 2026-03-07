use regex::Regex;

/// Utility for extracting values from text using regular expressions
/// Used for extracting data from non-XML responses (JSON, HTML, plain text)
pub struct RegexExtractor;

impl RegexExtractor {
    /// Extract value from text using regex pattern
    /// 
    /// # Arguments
    /// * `text` - Source text to extract from
    /// * `pattern` - Regex pattern (use capture groups for precise extraction)
    /// 
    /// # Returns
    /// Extracted value or None if no match
    /// 
    /// # Examples
    /// ```
    /// // Extract token from JSON
    /// extract(r#"{"token":"abc123"}"#, r#""token":"([^"]+)""#) // Returns: Some("abc123")
    /// 
    /// // Extract from HTML
    /// extract("<title>My Page</title>", r"<title>(.*?)</title>") // Returns: Some("My Page")
    /// ```
    pub fn extract(text: &str, pattern: &str) -> Option<String> {
        if text.is_empty() || pattern.is_empty() {
            return None;
        }

        match Regex::new(pattern) {
            Ok(regex) => {
                regex.captures(text).and_then(|caps| {
                    // If there are capture groups, use first group
                    // Otherwise use full match
                    caps.get(1)
                        .or_else(|| caps.get(0))
                        .map(|m| m.as_str().to_string())
                })
            }
            Err(e) => {
                log::error!("Regex extraction failed for pattern '{}': {}", pattern, e);
                None
            }
        }
    }

    /// Extract all matches (for multiple values)
    /// 
    /// # Arguments
    /// * `text` - Source text to extract from
    /// * `pattern` - Regex pattern (automatically treated as global)
    /// 
    /// # Returns
    /// Vector of extracted values
    /// 
    /// # Examples
    /// ```
    /// extractAll("<id>1</id><id>2</id>", r"<id>(\d+)</id>") // Returns: vec!["1", "2"]
    /// ```
    pub fn extract_all(text: &str, pattern: &str) -> Vec<String> {
        if text.is_empty() || pattern.is_empty() {
            return vec![];
        }

        match Regex::new(pattern) {
            Ok(regex) => {
                regex.captures_iter(text)
                    .filter_map(|caps| {
                        // Use first capture group if available, otherwise full match
                        caps.get(1)
                            .or_else(|| caps.get(0))
                            .map(|m| m.as_str().to_string())
                    })
                    .collect()
            }
            Err(e) => {
                log::error!("Regex extraction (all) failed for pattern '{}': {}", pattern, e);
                vec![]
            }
        }
    }

    /// Validate regex pattern syntax
    /// 
    /// # Arguments
    /// * `pattern` - Regex pattern to validate
    /// 
    /// # Returns
    /// true if valid, false otherwise
    pub fn is_valid_pattern(pattern: &str) -> bool {
        Regex::new(pattern).is_ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_with_capture_group() {
        let text = r#"{"token":"abc123"}"#;
        let pattern = r#""token":"([^"]+)""#;
        assert_eq!(RegexExtractor::extract(text, pattern), Some("abc123".to_string()));
    }

    #[test]
    fn test_extract_html_tag() {
        let text = "<title>My Page</title>";
        let pattern = r"<title>(.*?)</title>";
        assert_eq!(RegexExtractor::extract(text, pattern), Some("My Page".to_string()));
    }

    #[test]
    fn test_extract_no_match() {
        let text = "no match here";
        let pattern = r"\d+";
        assert_eq!(RegexExtractor::extract(text, pattern), None);
    }

    #[test]
    fn test_extract_all() {
        let text = "<id>1</id><id>2</id><id>3</id>";
        let pattern = r"<id>(\d+)</id>";
        assert_eq!(RegexExtractor::extract_all(text, pattern), vec!["1", "2", "3"]);
    }

    #[test]
    fn test_extract_all_no_captures() {
        let text = "apple banana cherry";
        let pattern = r"\w+";
        assert_eq!(RegexExtractor::extract_all(text, pattern), vec!["apple", "banana", "cherry"]);
    }

    #[test]
    fn test_is_valid_pattern() {
        assert!(RegexExtractor::is_valid_pattern(r"\d+"));
        assert!(RegexExtractor::is_valid_pattern(r"[a-z]+"));
        assert!(!RegexExtractor::is_valid_pattern(r"[invalid"));
    }
}
