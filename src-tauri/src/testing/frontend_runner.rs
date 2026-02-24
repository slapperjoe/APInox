/// Frontend Test Runner
///
/// Executes test cases in the TypeScript format (FrontendTestCase) that the
/// webview sends. This mirrors the logic in sidecar/src/services/TestRunnerService.ts.

use anyhow::Result;
use reqwest::Client;
use serde_json::Value;
use std::collections::HashMap;
use std::time::Instant;

use super::frontend_types::{
    AssertionResult, FrontendAssertion, FrontendExtractor, FrontendRequest,
    FrontendTestStep, StepExecutionResult,
};

/// Execute a single test step and return its result.
///
/// `context` holds variables extracted by previous steps (for substitution).
pub async fn run_step(
    step: &FrontendTestStep,
    fallback_endpoint: Option<&str>,
    context: &mut HashMap<String, Value>,
) -> Result<StepExecutionResult> {
    let start = Instant::now();

    match step.step_type.as_str() {
        "request" => {
            let req = step.config.request.as_ref().ok_or_else(|| {
                anyhow::anyhow!("Step '{}' has type 'request' but no request config", step.name)
            })?;
            run_request_step(req, fallback_endpoint, context, start).await
        }
        "delay" => {
            let ms = step.config.delay_ms.unwrap_or(0);
            tokio::time::sleep(tokio::time::Duration::from_millis(ms)).await;
            Ok(StepExecutionResult {
                passed: true,
                response_body: None,
                status_code: None,
                duration_ms: start.elapsed().as_millis() as u64,
                assertion_results: vec![],
                extracted_variables: HashMap::new(),
                error: None,
            })
        }
        other => {
            // script, transfer, workflow — not yet implemented in Rust, skip with pass
            log::warn!("[FrontendRunner] Step type '{}' not yet implemented, skipping", other);
            Ok(StepExecutionResult {
                passed: true,
                response_body: None,
                status_code: None,
                duration_ms: 0,
                assertion_results: vec![],
                extracted_variables: HashMap::new(),
                error: None,
            })
        }
    }
}

async fn run_request_step(
    req: &FrontendRequest,
    fallback_endpoint: Option<&str>,
    context: &HashMap<String, Value>,
    start: Instant,
) -> Result<StepExecutionResult> {
    let endpoint = req
        .endpoint
        .as_deref()
        .filter(|s| !s.is_empty())
        .or(fallback_endpoint)
        .unwrap_or("")
        .to_string();

    let endpoint = substitute_variables(&endpoint, context);

    if endpoint.is_empty() {
        return Ok(StepExecutionResult {
            passed: false,
            response_body: None,
            status_code: None,
            duration_ms: start.elapsed().as_millis() as u64,
            assertion_results: vec![],
            extracted_variables: HashMap::new(),
            error: Some("No endpoint specified".to_string()),
        });
    }

    let body = req
        .request
        .as_deref()
        .unwrap_or("")
        .to_string();
    let body = substitute_variables(&body, context);

    let method = req.method.as_deref().unwrap_or("POST").to_uppercase();
    let content_type = req
        .content_type
        .as_deref()
        .unwrap_or("text/xml;charset=UTF-8")
        .to_string();

    let client = Client::new();
    let mut builder = match method.as_str() {
        "GET" => client.get(&endpoint),
        "PUT" => client.put(&endpoint),
        "PATCH" => client.patch(&endpoint),
        "DELETE" => client.delete(&endpoint),
        _ => client.post(&endpoint),
    };

    // Apply extra headers from the request config, skipping empty/invalid names
    // and letting Content-Type be overridden by any explicit header entry.
    let mut content_type_overridden = false;
    if let Some(headers) = &req.headers {
        for (k, v) in headers {
            let k = k.trim();
            if k.is_empty() {
                continue; // skip blank header names (common when user leaves a row empty)
            }
            if k.eq_ignore_ascii_case("content-type") {
                // Override the default Content-Type we set above
                builder = builder.header("Content-Type", v.as_str());
                content_type_overridden = true;
            } else {
                builder = builder.header(k, v.as_str());
            }
        }
    }

    if !content_type_overridden {
        builder = builder.header("Content-Type", &content_type);
    }

    if method != "GET" && method != "DELETE" {
        builder = builder.body(body.clone());
    }

    log::info!("[FrontendRunner] {} {}", method, endpoint);

    let response = match builder.send().await {
        Ok(r) => r,
        Err(e) => {
            let duration_ms = start.elapsed().as_millis() as u64;
            return Ok(StepExecutionResult {
                passed: false,
                response_body: None,
                status_code: None,
                duration_ms,
                assertion_results: vec![],
                extracted_variables: HashMap::new(),
                error: Some(format!("HTTP request failed: {}", e)),
            });
        }
    };

    let status_code = response.status().as_u16();
    let response_body = response.text().await.unwrap_or_default();
    let duration_ms = start.elapsed().as_millis() as u64;

    log::info!("[FrontendRunner] Response {} ({}ms)", status_code, duration_ms);

    // Run assertions
    let assertion_results = run_assertions(
        req.assertions.as_deref().unwrap_or(&[]),
        &response_body,
        status_code,
        duration_ms,
    );
    let has_failures = assertion_results.iter().any(|r| r.status == "FAIL");

    // Extract variables
    let extracted_variables = run_extractors(
        req.extractors.as_deref().unwrap_or(&[]),
        &response_body,
    );

    let passed = !has_failures;
    let error = if !passed {
        Some(
            assertion_results
                .iter()
                .filter(|r| r.status == "FAIL")
                .map(|r| {
                    format!(
                        "{}: {}",
                        r.name,
                        r.message.as_deref().unwrap_or("failed")
                    )
                })
                .collect::<Vec<_>>()
                .join("; "),
        )
    } else {
        None
    };

    Ok(StepExecutionResult {
        passed,
        response_body: Some(response_body),
        status_code: Some(status_code),
        duration_ms,
        assertion_results,
        extracted_variables,
        error,
    })
}

/// Run all assertions against the response.
fn run_assertions(
    assertions: &[FrontendAssertion],
    body: &str,
    status_code: u16,
    duration_ms: u64,
) -> Vec<AssertionResult> {
    assertions.iter().map(|a| run_assertion(a, body, status_code, duration_ms)).collect()
}

fn run_assertion(
    assertion: &FrontendAssertion,
    body: &str,
    status_code: u16,
    duration_ms: u64,
) -> AssertionResult {
    let name = assertion.name.clone().unwrap_or_else(|| assertion.assertion_type.clone());
    let config = assertion.configuration.as_ref();

    match assertion.assertion_type.as_str() {
        "Simple Contains" => {
            let token = config.and_then(|c| c.token.as_deref()).unwrap_or("");
            let ignore_case = config.and_then(|c| c.ignore_case).unwrap_or(false);
            let found = if ignore_case {
                body.to_lowercase().contains(&token.to_lowercase())
            } else {
                body.contains(token)
            };
            AssertionResult {
                name,
                status: if found { "PASS" } else { "FAIL" }.to_string(),
                message: if !found {
                    Some(format!("Response does not contain '{}'", token))
                } else {
                    None
                },
            }
        }
        "Simple Not Contains" => {
            let token = config.and_then(|c| c.token.as_deref()).unwrap_or("");
            let found = body.contains(token);
            AssertionResult {
                name,
                status: if !found { "PASS" } else { "FAIL" }.to_string(),
                message: if found {
                    Some(format!("Response contains '{}' but should not", token))
                } else {
                    None
                },
            }
        }
        "Response SLA" => {
            let sla: u64 = config
                .and_then(|c| c.sla.as_deref())
                .and_then(|s| s.parse().ok())
                .unwrap_or(u64::MAX);
            let ok = duration_ms <= sla;
            AssertionResult {
                name,
                status: if ok { "PASS" } else { "FAIL" }.to_string(),
                message: if !ok {
                    Some(format!("Response time {}ms exceeded SLA of {}ms", duration_ms, sla))
                } else {
                    None
                },
            }
        }
        "HTTP Status" => {
            let expected = config
                .and_then(|c| c.expected_status.as_deref())
                .unwrap_or("200");
            let ok = expected
                .split(',')
                .map(|s| s.trim())
                .any(|s| s.parse::<u16>().map(|code| code == status_code).unwrap_or(false));
            AssertionResult {
                name,
                status: if ok { "PASS" } else { "FAIL" }.to_string(),
                message: if !ok {
                    Some(format!("Status {} not in expected [{}]", status_code, expected))
                } else {
                    None
                },
            }
        }
        "XPath Match" => {
            let xpath_expr = config.and_then(|c| c.xpath.as_deref()).unwrap_or("");
            let expected = config.and_then(|c| c.expected_content.as_deref()).unwrap_or("");
            match evaluate_xpath(body, xpath_expr) {
                Ok(actual) => {
                    let ok = actual.trim() == expected.trim();
                    AssertionResult {
                        name,
                        status: if ok { "PASS" } else { "FAIL" }.to_string(),
                        message: if !ok {
                            Some(format!("XPath '{}': got '{}', expected '{}'", xpath_expr, actual, expected))
                        } else {
                            None
                        },
                    }
                }
                Err(e) => AssertionResult {
                    name,
                    status: "FAIL".to_string(),
                    message: Some(format!("XPath evaluation failed: {}", e)),
                },
            }
        }
        "SOAP Fault" => {
            let expect_fault = config.and_then(|c| c.expect_fault).unwrap_or(false);
            let is_fault = body.contains("<faultcode>") || body.contains("<soap:Fault>")
                || body.contains("<env:Fault>");
            let ok = is_fault == expect_fault;
            AssertionResult {
                name,
                status: if ok { "PASS" } else { "FAIL" }.to_string(),
                message: if !ok {
                    Some(if expect_fault {
                        "Expected SOAP fault but none found".to_string()
                    } else {
                        "Unexpected SOAP fault in response".to_string()
                    })
                } else {
                    None
                },
            }
        }
        // Script assertions can't run in Rust — skip
        "Script" => AssertionResult {
            name,
            status: "SKIP".to_string(),
            message: Some("Script assertions not supported in Rust backend".to_string()),
        },
        other => AssertionResult {
            name,
            status: "SKIP".to_string(),
            message: Some(format!("Unknown assertion type: {}", other)),
        },
    }
}

/// Run all extractors and return the extracted variable map.
fn run_extractors(
    extractors: &[FrontendExtractor],
    body: &str,
) -> HashMap<String, String> {
    let mut vars = HashMap::new();
    for ext in extractors {
        let value = match ext.extractor_type.as_deref().unwrap_or("XPath") {
            "XPath" => {
                let path = ext.path.as_deref().unwrap_or("");
                evaluate_xpath(body, path).ok()
            }
            "Regex" => {
                let path = ext.path.as_deref().unwrap_or("");
                extract_regex(body, path)
            }
            _ => None,
        };
        if let Some(v) = value.or_else(|| ext.default_value.clone()) {
            vars.insert(ext.variable.clone(), v);
        }
    }
    vars
}

/// Evaluate an XPath expression against an XML string.
/// Returns the string value of the first matching node.
fn evaluate_xpath(xml: &str, xpath: &str) -> Result<String> {
    use sxd_document::parser;
    use sxd_xpath::{Context, Factory};

    let package = parser::parse(xml)
        .map_err(|e| anyhow::anyhow!("XML parse error: {:?}", e))?;
    let document = package.as_document();

    let factory = Factory::new();
    let expression = factory
        .build(xpath)
        .map_err(|e| anyhow::anyhow!("XPath parse error: {:?}", e))?
        .ok_or_else(|| anyhow::anyhow!("Empty XPath expression"))?;

    let context = Context::new();
    let value = expression
        .evaluate(&context, document.root())
        .map_err(|e| anyhow::anyhow!("XPath evaluation error: {:?}", e))?;

    Ok(value.string())
}

/// Extract the first regex capture group (or whole match) from text.
fn extract_regex(text: &str, pattern: &str) -> Option<String> {
    let re = regex::Regex::new(pattern).ok()?;
    let caps = re.captures(text)?;
    // Return first capture group, or whole match if no groups
    caps.get(1)
        .or_else(|| caps.get(0))
        .map(|m| m.as_str().to_string())
}

/// Substitute `{{variableName}}` placeholders from context.
fn substitute_variables(text: &str, context: &HashMap<String, Value>) -> String {
    let mut result = text.to_string();
    for (key, val) in context {
        let placeholder = format!("{{{{{}}}}}", key);
        let value_str = match val {
            Value::String(s) => s.clone(),
            other => other.to_string(),
        };
        result = result.replace(&placeholder, &value_str);
    }
    result
}
