/// Frontend Test Runner
///
/// Executes test cases in the TypeScript format (FrontendTestCase) that the
/// webview sends.
use anyhow::Result;
use reqwest::Client;
use serde_json::Value;
use std::collections::HashMap;
use std::time::Instant;

use crate::settings_manager;
use crate::utils::{RegexExtractor, XPathEvaluator, substitute_variables, CONTENT_TYPE_XML};
use crate::workflow::commands::build_frontend_request;

use super::frontend_types::{
    AssertionResult, FrontendAssertion, FrontendExtractor, FrontendRequest,
    FrontendTestStep, StepExecutionResult,
};

/// Executes a single test step and returns its result.
///
/// `context` holds variables extracted by previous steps (for substitution).
/// `emit` (streaming mode) receives live sub-update events — for 'workflow'
/// steps these are the per-workflow-step `workflowStepStart/Pass/Fail/Skip`
/// events the webview uses to show which inner requests succeeded.
pub async fn run_step(
    step: &FrontendTestStep,
    fallback_endpoint: Option<&str>,
    context: &mut HashMap<String, Value>,
    emit: Option<&mut (dyn FnMut(Value) + Send)>,
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
                request_body: None,
                response_body: None,
                status_code: None,
                duration_ms: start.elapsed().as_millis() as u64,
                assertion_results: vec![],
                extracted_variables: HashMap::new(),
                error: None,
            })
        }
        "workflow" => run_workflow_step(step, context, emit).await,
        other => {
            // script, transfer — not yet implemented in Rust, skip with pass
            log::warn!("[FrontendRunner] Step type '{}' not yet implemented, skipping", other);
            Ok(StepExecutionResult {
                passed: true,
                request_body: None,
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

/// Resolve the referenced workflow's steps + initial variables.
///
/// Steps prefer the self-contained payload the webview embedded
/// (`config.workflowSteps`); variables and (when un-embedded) steps fall back
/// to the persisted config by `workflowId`.
fn resolve_workflow(
    step: &FrontendTestStep,
) -> (Vec<Value>, HashMap<String, String>, Option<String>) {
    let workflow_id = step
        .config
        .workflow_id
        .as_deref()
        .filter(|s| !s.is_empty());

    let mut steps = step
        .config
        .workflow_steps
        .clone()
        .unwrap_or_default();
    let mut wf_vars: HashMap<String, String> = HashMap::new();

    if let Some(id) = workflow_id {
        if let Ok(cfg) = settings_manager::load_config_internal() {
            if let Some(w) = cfg
                .workflows
                .unwrap_or_default()
                .into_iter()
                .find(|w| w.get("id").and_then(|v| v.as_str()) == Some(id))
            {
                if steps.is_empty() {
                    steps = w
                        .get("steps")
                        .and_then(|v| v.as_array())
                        .cloned()
                        .unwrap_or_default();
                }
                if let Some(vars) = w.get("variables").and_then(|v| v.as_object()) {
                    for (k, v) in vars {
                        if let Some(s) = v.as_str() {
                            wf_vars.insert(k.clone(), s.to_string());
                        }
                    }
                }
            }
        }
    }

    (steps, wf_vars, workflow_id.map(String::from))
}

/// Execute a 'workflow' test step: run the referenced workflow's steps in
/// order, sharing a variable context seeded from the test-case context, the
/// workflow's own initial variables, and the step's variable overrides
/// (highest priority). Emits per-workflow-step events so the webview can show
/// which inner requests succeeded. Mirrors `run_workflow`'s execution rules
/// (request/delay executed; condition/loop/script skipped, not failures).
async fn run_workflow_step(
    step: &FrontendTestStep,
    context: &mut HashMap<String, Value>,
    emit: Option<&mut (dyn FnMut(Value) + Send)>,
) -> Result<StepExecutionResult> {
    let start = Instant::now();
    let (wf_steps, wf_vars, workflow_id) = resolve_workflow(step);

    let fail = |message: String| StepExecutionResult {
        passed: false,
        request_body: None,
        response_body: None,
        status_code: None,
        duration_ms: start.elapsed().as_millis() as u64,
        assertion_results: vec![],
        extracted_variables: HashMap::new(),
        error: Some(message),
    };

    if wf_steps.is_empty() {
        return match &workflow_id {
            Some(id) => Ok(fail(format!(
                "Workflow '{}' not found or has no steps",
                id
            ))),
            None => Ok(fail("No workflow selected for this step".to_string())),
        };
    }

    // Variable context: test-case context as the base, the workflow's own
    // initial variables layered on top, then the step's overrides (highest).
    let mut variables = context.clone();
    for (k, v) in &wf_vars {
        variables.insert(k.clone(), Value::String(v.clone()));
    }
    if let Some(overrides) = &step.config.workflow_variables {
        for (k, v) in overrides {
            variables.insert(k.clone(), Value::String(v.clone()));
        }
    }

    let mut all_passed = true;
    let mut errors: Vec<String> = Vec::new();
    let mut extracted: HashMap<String, String> = HashMap::new();
    // Snapshot of the context before the run, so the result only reports
    // variables this workflow actually produced.
    let pre_run: std::collections::HashSet<String> = context.keys().cloned().collect();

    let mut emit = emit;
    for ws in &wf_steps {
        let ws_id = ws.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let ws_name = ws.get("name").and_then(|v| v.as_str()).unwrap_or("step").to_string();
        let ws_type = ws
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("request")
            .to_string();
        let ws_start = Instant::now();

        if let Some(emitter) = emit.as_deref_mut() {
            emitter(serde_json::json!({
                "type": "workflowStepStart",
                "stepId": step.id,
                "workflowStepId": ws_id,
                "name": ws_name
            }));
        }

        let (sub_passed, sub_error, sub_response, sub_duration) = match ws_type.as_str() {
            "delay" => {
                let ms = ws.get("delayMs").and_then(|v| v.as_u64()).unwrap_or(0);
                tokio::time::sleep(tokio::time::Duration::from_millis(ms)).await;
                (true, None, None, ws_start.elapsed().as_millis() as u64)
            }
            "request" => {
                let req = build_frontend_request(ws);
                match run_request_step(&req, None, &variables, ws_start).await {
                    Ok(r) => {
                        for (k, v) in &r.extracted_variables {
                            variables.insert(k.clone(), Value::String(v.clone()));
                            extracted.insert(k.clone(), v.clone());
                        }
                        (
                            r.passed,
                            r.error,
                            Some((r.status_code, r.duration_ms, r.response_body)),
                            r.duration_ms,
                        )
                    }
                    Err(e) => (false, Some(e.to_string()), None, ws_start.elapsed().as_millis() as u64),
                }
            }
            other => {
                // condition / loop / script: not executed by the backend
                // (mirrors run_workflow) — surfaced as skipped, not failed.
                log::warn!(
                    "[FrontendRunner] workflow step '{}' type '{}' not executed in test run",
                    ws_name,
                    other
                );
                (true, None, None, 0)
            }
        };

        if let Some(emitter) = emit.as_deref_mut() {
            let event_type = if !sub_passed {
                "workflowStepFail"
            } else {
                match ws_type.as_str() {
                    "condition" | "loop" | "script" => "workflowStepSkip",
                    _ => "workflowStepPass",
                }
            };
            emitter(serde_json::json!({
                "type": event_type,
                "stepId": step.id,
                "workflowStepId": ws_id,
                "name": ws_name,
                "durationMs": sub_duration,
                "error": sub_error,
                "response": sub_response.map(|(status_code, duration_ms, body)| {
                    serde_json::json!({
                        "rawResponse": body,
                        "duration": duration_ms as f64 / 1000.0,
                        "statusCode": status_code
                    })
                })
            }));
        }

        // Propagate produced variables into the outer test-case context so
        // later top-level steps can use them.
        for (k, v) in &extracted {
            context.insert(k.clone(), Value::String(v.clone()));
        }

        if !sub_passed {
            all_passed = false;
            if let Some(e) = sub_error {
                errors.push(format!("{}: {}", ws_name, e));
            }
        }
    }

    // Report only variables this workflow produced (new or changed keys).
    extracted.retain(|k, _| !pre_run.contains(k));

    let error = if errors.is_empty() { None } else { Some(errors.join("; ")) };
    Ok(StepExecutionResult {
        passed: all_passed,
        request_body: None,
        response_body: None,
        status_code: None,
        duration_ms: start.elapsed().as_millis() as u64,
        assertion_results: vec![],
        extracted_variables: extracted,
        error,
    })
}

pub(crate) async fn run_request_step(
    req: &FrontendRequest,
    fallback_endpoint: Option<&str>,
    context: &HashMap<String, Value>,
    start: Instant,
) -> Result<StepExecutionResult> {
    // Convert context values to strings for template substitution
    let str_context: HashMap<String, String> = context
        .iter()
        .map(|(k, v)| (k.clone(), match v { Value::String(s) => s.clone(), other => other.to_string() }))
        .collect();

    let endpoint = req
        .endpoint
        .as_deref()
        .filter(|s| !s.is_empty())
        .or(fallback_endpoint)
        .unwrap_or("")
        .to_string();

    let endpoint = substitute_variables(&endpoint, &str_context);

    if endpoint.is_empty() {
        return Ok(StepExecutionResult {
            passed: false,
            request_body: None,
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
    let body = substitute_variables(&body, &str_context);

    let method = req.method.as_deref().unwrap_or("POST").to_uppercase();
    let content_type = req
        .content_type
        .as_deref()
        .unwrap_or(CONTENT_TYPE_XML)
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
                request_body: Some(body.clone()),
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
    let response_headers: HashMap<String, String> = response
        .headers()
        .iter()
        .filter_map(|(k, v)| v.to_str().ok().map(|vs| (k.to_string(), vs.to_string())))
        .collect();
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
        &response_headers,
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
        request_body: Some(body.clone()),
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
            match XPathEvaluator::evaluate(body, xpath_expr) {
                Some(actual) => {
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
                None => AssertionResult {
                    name,
                    status: "FAIL".to_string(),
                    message: Some(format!("XPath '{}' returned no results or failed to evaluate", xpath_expr)),
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
    headers: &HashMap<String, String>,
) -> HashMap<String, String> {
    let mut vars = HashMap::new();
    for ext in extractors {
        let value = match ext.extractor_type.as_deref().unwrap_or("XPath") {
            "XPath" => {
                let path = ext.path.as_deref().unwrap_or("");
                XPathEvaluator::evaluate(body, path)
            }
            "Regex" => {
                let path = ext.path.as_deref().unwrap_or("");
                RegexExtractor::extract(body, path)
            }
            "Header" => {
                let name = ext.path.as_deref().unwrap_or("");
                // Case-insensitive header lookup
                headers.iter()
                    .find(|(k, _)| k.eq_ignore_ascii_case(name))
                    .map(|(_, v)| v.clone())
            }
            _ => None,
        };
        if let Some(v) = value.or_else(|| ext.default_value.clone()) {
            vars.insert(ext.variable.clone(), v);
        }
    }
    vars
}
