# Testing Framework

Complete testing framework with assertions, variable extraction, and test execution.

## Features

- ✅ **Multiple Assertion Types**: XPath, JSONPath, Regex, Contains, Equals, StatusCode, ResponseTime
- ✅ **Variable Extraction**: Extract values from responses for use in later steps
- ✅ **Variable Context**: Replace {{variable}} placeholders in requests
- ✅ **Test Steps**: SOAP, HTTP, Delay steps
- ✅ **Test Cases**: Multi-step test scenarios
- ✅ **Performance Metrics**: Duration tracking for assertions

## Assertion Types

### XPath Assertion

Validates XML responses using XPath expressions.

```rust
use apinox_lib::testing::{AssertionType, run_assertion};

let assertion = AssertionType::XPath {
    xpath: "/root/user/name".to_string(),
    expected: "John".to_string(),
};

let xml = r#"<root><user><name>John</name></user></root>"#;
let result = run_assertion(&assertion, xml, 200, None)?;

assert!(result.passed);
```

### JSONPath Assertion

Validates JSON responses using JSONPath.

```rust
let assertion = AssertionType::JsonPath {
    path: "$.user.name".to_string(),
    expected: "John".to_string(),
};

let json = r#"{"user":{"name":"John"}}"#;
let result = run_assertion(&assertion, json, 200, None)?;
```

### Regex Assertion

Matches response against regex pattern.

```rust
let assertion = AssertionType::Regex {
    pattern: r"User ID: (\d+)".to_string(),
    expected: Some("12345".to_string()),
};

let text = "User ID: 12345";
let result = run_assertion(&assertion, text, 200, None)?;
```

### Contains Assertion

Checks if response contains a specific string.

```rust
let assertion = AssertionType::Contains {
    value: "Success".to_string(),
};
```

### Equals Assertion

Exact match assertion.

```rust
let assertion = AssertionType::Equals {
    expected: "OK".to_string(),
};
```

### StatusCode Assertion

Validates HTTP status code.

```rust
let assertion = AssertionType::StatusCode {
    code: 200,
};
```

### ResponseTime Assertion

Validates response time is within limit.

```rust
let assertion = AssertionType::ResponseTime {
    max_ms: 1000,
};
```

## Variable Extraction

Extract values from responses for use in subsequent test steps.

### XPath Extraction

```rust
use apinox_lib::testing::{ExtractorType, extract_variable};

let extractor = ExtractorType::XPath {
    xpath: "/root/user/id".to_string(),
};

let xml = r#"<root><user><id>12345</id></user></root>"#;
let user_id = extract_variable(&extractor, xml)?;

assert_eq!(user_id, "12345");
```

### JSONPath Extraction

```rust
let extractor = ExtractorType::JsonPath {
    path: "$.user.token".to_string(),
};

let json = r#"{"user":{"token":"ABC123"}}"#;
let token = extract_variable(&extractor, json)?;
```

### Regex Extraction

```rust
let extractor = ExtractorType::Regex {
    pattern: r"Session: (\w+)".to_string(),
};

let text = "Session: XYZ789";
let session = extract_variable(&extractor, text)?;
```

## Test Runner

Execute multi-step test cases with variable context.

### Basic Test Case

```rust
use apinox_lib::testing::{TestRunner, TestCase, TestStep, TestStepType};
use std::collections::HashMap;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut runner = TestRunner::new();
    
    let test_case = TestCase {
        name: "Login Test".to_string(),
        description: Some("Test user login flow".to_string()),
        steps: vec![
            TestStep {
                name: "Login".to_string(),
                step_type: TestStepType::Soap {
                    operation: /* ... */,
                    soap_version: "1.1".to_string(),
                    values: HashMap::new(),
                    endpoint: None,
                    security: None,
                },
                assertions: vec![
                    AssertionType::StatusCode { code: 200 },
                    AssertionType::XPath {
                        xpath: "/response/status".to_string(),
                        expected: "success".to_string(),
                    },
                ],
                extractions: vec![
                    VariableExtraction {
                        name: "sessionId".to_string(),
                        extractor: ExtractorType::XPath {
                            xpath: "/response/sessionId".to_string(),
                        },
                    },
                ],
            },
        ],
    };
    
    let result = runner.run_test_case(&test_case).await?;
    
    println!("Test passed: {}", result.passed);
    println!("Duration: {}ms", result.total_duration_ms);
    
    Ok(())
}
```

### Variable Context

The test runner maintains a variable context that persists across test steps.

```rust
// Extract variable in step 1
VariableExtraction {
    name: "userId".to_string(),
    extractor: ExtractorType::XPath {
        xpath: "/response/userId".to_string(),
    },
}

// Use variable in step 2
values.insert("GetUserDetails.UserId".to_string(), "{{userId}}".to_string());
```

The `{{userId}}` placeholder will be replaced with the extracted value.

## Test Step Types

### SOAP Step

```rust
TestStepType::Soap {
    operation: operation,
    soap_version: "1.1".to_string(),
    values: values,
    endpoint: Some("https://example.com/service".to_string()),
    security: Some(SecurityConfig {
        username: Some("admin".to_string()),
        password: Some("secret".to_string()),
        password_type: Some("digest".to_string()),
        add_timestamp: true,
    }),
}
```

### HTTP Step

```rust
TestStepType::Http {
    method: "GET".to_string(),
    url: "https://api.example.com/users/{{userId}}".to_string(),
    headers: headers,
    body: None,
}
```

### Delay Step

```rust
TestStepType::Delay {
    ms: 1000, // Wait 1 second
}
```

## Test Results

### TestStepResult

```rust
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
```

### TestCaseResult

```rust
pub struct TestCaseResult {
    pub test_name: String,
    pub passed: bool,
    pub total_duration_ms: u64,
    pub step_results: Vec<TestStepResult>,
}
```

### AssertionResult

```rust
pub struct AssertionResult {
    pub assertion_type: String,
    pub passed: bool,
    pub message: String,
    pub actual: Option<String>,
    pub expected: Option<String>,
}
```

## Testing

Run unit tests:
```bash
cargo test testing --lib
```

All 12 tests passing:
- `assertion_runner`: 6 tests (XPath, JSONPath, Contains, Regex, StatusCode, ResponseTime)
- `variable_extractor`: 4 tests (XPath, JSONPath, Regex, Full)
- `test_runner`: 2 tests (variable replacement, get/set)

## Implementation Details

### Files
- `src/testing/assertion_runner.rs` (~350 lines) - Assertion execution
- `src/testing/variable_extractor.rs` (~140 lines) - Variable extraction
- `src/testing/test_runner.rs` (~390 lines) - Test execution
- Total: ~880 lines

### Dependencies
- `sxd-document`, `sxd-xpath` - XPath evaluation
- `serde_json` - JSON parsing
- `regex` - Regular expressions
- `tokio` - Async test execution

### Integration Points
- **SoapClient**: Executes SOAP requests in test steps
- **AssertionRunner**: Validates responses
- **VariableExtractor**: Extracts values for context
- **TestRunner**: Orchestrates test execution

## Example: Complete Test Case

```rust
let test_case = TestCase {
    name: "User CRUD Flow".to_string(),
    description: Some("Test create, read, update, delete user".to_string()),
    steps: vec![
        // Step 1: Create user
        TestStep {
            name: "Create User".to_string(),
            step_type: TestStepType::Soap { /* ... */ },
            assertions: vec![
                AssertionType::StatusCode { code: 200 },
                AssertionType::XPath {
                    xpath: "/response/status".to_string(),
                    expected: "created".to_string(),
                },
            ],
            extractions: vec![
                VariableExtraction {
                    name: "userId".to_string(),
                    extractor: ExtractorType::XPath {
                        xpath: "/response/userId".to_string(),
                    },
                },
            ],
        },
        // Step 2: Get user (uses extracted userId)
        TestStep {
            name: "Get User".to_string(),
            step_type: TestStepType::Soap {
                values: {
                    let mut v = HashMap::new();
                    v.insert("GetUser.UserId".to_string(), "{{userId}}".to_string());
                    v
                },
                // ...
            },
            assertions: vec![
                AssertionType::XPath {
                    xpath: "/response/user/id".to_string(),
                    expected: "{{userId}}".to_string(),
                },
            ],
            extractions: vec![],
        },
    ],
};
```

## Performance Considerations

- **Async execution**: All test steps run asynchronously
- **Streaming XML/JSON parsing**: Efficient for large responses
- **Variable caching**: Variables stored in HashMap for fast access
- **Lazy evaluation**: Assertions only run when needed

## Future Enhancements

- [ ] Test suite execution (multiple test cases)
- [ ] Parallel test execution
- [ ] Data-driven tests (CSV, JSON data sources)
- [ ] Test reporting (HTML, JUnit XML)
- [ ] Mock server integration for testing
- [ ] Performance test support (load, stress tests)

## References

- [XPath 1.0](https://www.w3.org/TR/xpath-10/)
- [JSONPath Specification](https://goessner.net/articles/JsonPath/)
- [Rust Regex Syntax](https://docs.rs/regex/latest/regex/#syntax)
