use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use serde_json::Value;

use crate::http::client::{CancelToken, HttpClient, HttpRequest};
use crate::performance::types::{PerformanceRequest, PerformanceResult};
use crate::testing::frontend_runner::{run_step, MAX_REFERENCE_DEPTH};
use crate::testing::frontend_types::FrontendTestStep;
use crate::utils::{substitute_variables, CONTENT_TYPE_XML};

/// Execute a single performance request and return a `PerformanceResult`.
/// M1: an optional cancel token lets abort_performance_suite interrupt an
/// in-flight request (raced against both the request send and body read).
pub async fn execute_request(
    req: &PerformanceRequest,
    iteration: u32,
    variables: &HashMap<String, String>,
    cancel_token: Option<Arc<CancelToken>>,
) -> PerformanceResult {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let endpoint = substitute_variables(&req.endpoint, variables);
    let body = substitute_variables(&req.request_body, variables);

    let start = Instant::now();
    let mut error: Option<String> = None;
    let mut extracted_values: HashMap<String, String> = HashMap::new();

    let client = HttpClient::new();
    let mut headers = req.headers.clone();
    if let Some(ref action) = req.soap_action {
        headers
            .entry("SOAPAction".to_string())
            .or_insert_with(|| format!("\"{}\"", action));
        headers
            .entry("Content-Type".to_string())
            .or_insert_with(|| CONTENT_TYPE_XML.to_string());
    }

    let http_req = HttpRequest {
        method: req.method.clone(),
        url: endpoint.clone(),
        headers,
        body: if body.is_empty() { None } else { Some(body) },
        timeout_ms: Some(30_000),
        follow_redirects: Some(true),
        verify_ssl: Some(false),
        proxy_url: None,
        proxy_username: None,
        proxy_password: None,
    };

    let resp = client.execute_with_cancel(http_req, cancel_token).await;
    let status = resp.status;
    let success = status >= 200 && status < 300;
    let response_body = resp.body;
    if !success {
        error = resp.error;
    }

    let duration = start.elapsed().as_secs_f64() * 1000.0;

    for extractor in &req.extractors {
        if extractor.extractor_type.to_lowercase() == "xpath" {
            if let Some(value) = extract_xpath(&response_body, &extractor.path) {
                extracted_values.insert(extractor.variable.clone(), value);
            }
        }
    }

    let sla_breached = req.sla_threshold.map(|t| duration > t).unwrap_or(false);

    PerformanceResult {
        request_id: req.id.clone(),
        request_name: req.name.clone(),
        parent_step_id: None,
        parent_step_name: None,
        interface_name: None,
        operation_name: None,
        iteration,
        duration,
        status,
        success,
        sla_breached,
        error,
        extracted_values: if extracted_values.is_empty() {
            None
        } else {
            Some(extracted_values)
        },
        timestamp,
    }
}

/// Execute one performance step and return the result rows it produced.
///
/// A `request` step produces exactly one row. A `testCase` step produces one
/// row per inner step that made an HTTP call, plus one for any inner step that
/// failed — so percentiles, SLA and success rate reflect the real calls inside
/// the case rather than one opaque number for the whole case.
///
/// `variables` is the run's live variable map; values extracted inside the case
/// are merged back into it so later steps can consume them.
pub async fn execute_step(
    step: &PerformanceRequest,
    iteration: u32,
    variables: &mut HashMap<String, String>,
    cancel_token: Option<Arc<CancelToken>>,
    aborted: &(dyn Fn() -> bool + Send + Sync),
) -> Vec<PerformanceResult> {
    if step.step_type == "testCase" {
        return execute_case_step(step, iteration, variables, aborted).await;
    }
    vec![execute_request(step, iteration, variables, cancel_token).await]
}

/// Run a `testCase` step: walk the webview-embedded steps and turn each
/// HTTP-calling (or failed) inner step into a `PerformanceResult` row.
async fn execute_case_step(
    step: &PerformanceRequest,
    iteration: u32,
    variables: &mut HashMap<String, String>,
    aborted: &(dyn Fn() -> bool + Send + Sync),
) -> Vec<PerformanceResult> {
    let timestamp = now_ms();

    if step.test_case_steps.is_empty() {
        return vec![row(
            step.id.clone(),
            step.name.clone(),
            None,
            None,
            iteration,
            0.0,
            0,
            false,
            false,
            Some(format!(
                "Test case '{}' not available (missing id, deleted, or reference cycle)",
                step.test_case_id.as_deref().unwrap_or("(unspecified)")
            )),
            None,
            timestamp,
        )];
    }

    // The case runs against a copy of the run's variables, seeded with its own
    // variable layer (the webview folds the case's variables UNDER the step's
    // overrides into one map at embed time).
    let mut context: HashMap<String, Value> = variables
        .iter()
        .map(|(k, v)| (k.clone(), Value::String(v.clone())))
        .collect();

    let mut rows: Vec<PerformanceResult> = Vec::new();
    let parent_id = step.id.clone();
    let parent_name = step.name.clone();

    {
        let mut record = |event: Value| {
            let event_type = event.get("type").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let failed = event_type == "workflowStepFail";
            let response = event.get("response");
            let has_response = response.map(|r| !r.is_null()).unwrap_or(false);
            // Delay/script/loop containers produce no HTTP row; only failures
            // are reported when they did not call anything.
            if !has_response && !failed {
                return;
            }

            let extracted = event
                .get("extracted")
                .and_then(|e| e.as_object())
                .map(|o| {
                    o.iter()
                        .map(|(k, v)| (k.clone(), value_to_string(v)))
                        .collect::<HashMap<String, String>>()
                });

            rows.push(row(
                event
                    .get("workflowStepId")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                event.get("name").and_then(|v| v.as_str()).unwrap_or("step").to_string(),
                Some(parent_id.clone()),
                Some(parent_name.clone()),
                iteration,
                event.get("durationMs").and_then(|v| v.as_u64()).unwrap_or(0) as f64,
                response
                    .and_then(|r| r.get("statusCode"))
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0) as u16,
                !failed,
                event.get("slaBreached").and_then(|v| v.as_bool()).unwrap_or(false),
                event.get("error").and_then(|v| v.as_str()).map(|s| s.to_string()),
                extracted,
                timestamp,
            ));
        };

        let case_start = Instant::now();
        run_case_steps(
            &step.test_case_steps,
            step.test_case_variables.as_ref(),
            &mut context,
            &mut record,
            aborted,
            0,
        )
        .await;

        // Case-level SLA (when set) applies to the whole case. It is reported as
        // one aggregate row only when breached, so normal runs keep the
        // per-inner-request rows the results view groups under the case.
        if let Some(threshold) = step.sla_threshold {
            let total = case_start.elapsed().as_secs_f64() * 1000.0;
            if total > threshold {
                rows.push(row(
                    step.id.clone(),
                    step.name.clone(),
                    None,
                    None,
                    iteration,
                    total,
                    0,
                    false,
                    true,
                    Some(format!(
                        "SLA breached — case total {:.0}ms > {:.0}ms",
                        total, threshold
                    )),
                    None,
                    timestamp,
                ));
            }
        }
    }

    // Merge what the case produced back into the run's variables. Keys the case
    // itself configured (seeded before its steps ran) are excluded by
    // `run_case_steps`, so only genuine extractions leak out.
    for (k, v) in &context {
        variables.insert(k.clone(), value_to_string(v));
    }

    rows
}

/// Walk one level of a referenced case's embedded steps.
///
/// `emit` receives the same `workflowStep*` events the test runner uses, so
/// loop bodies are captured without reimplementing loop semantics here. Nested
/// `testCase` references are walked by this function rather than handed to
/// `run_step`, because the test runner does not emit events for the direct
/// steps of a referenced case — perf needs a row for each of them.
async fn run_case_steps(
    steps: &[Value],
    variables_layer: Option<&HashMap<String, String>>,
    context: &mut HashMap<String, Value>,
    emit: &mut (dyn FnMut(Value) + Send),
    aborted: &(dyn Fn() -> bool + Send + Sync),
    depth: u32,
) {
    if depth >= MAX_REFERENCE_DEPTH {
        emit(serde_json::json!({
            "type": "workflowStepFail",
            "name": "(reference)",
            "error": "reference depth exceeded (possible cycle)"
        }));
        return;
    }

    let mut sub = context.clone();
    if let Some(vars) = variables_layer {
        for (k, v) in vars {
            sub.insert(k.clone(), Value::String(v.clone()));
        }
    }
    // Snapshot AFTER seeding: the case's own variables must not merge back out.
    let pre_run: HashSet<String> = sub.keys().cloned().collect();

    for value in steps {
        if aborted() {
            break;
        }

        let ts: FrontendTestStep = match serde_json::from_value(value.clone()) {
            Ok(t) => t,
            Err(e) => {
                emit(serde_json::json!({
                    "type": "workflowStepFail",
                    "name": value.get("name").and_then(|v| v.as_str()).unwrap_or("step"),
                    "error": format!("invalid embedded test case step: {e}")
                }));
                continue;
            }
        };

        if ts.step_type == "testCase" {
            // Recursive async fn — box so the future has a finite size.
            Box::pin(run_case_steps(
                ts.config.test_case_steps.as_ref().map(|v| v.as_slice()).unwrap_or(&[]),
                ts.config.test_case_variables.as_ref(),
                &mut sub,
                emit,
                aborted,
                depth + 1,
            ))
            .await;
            continue;
        }

        let result = match Box::pin(run_step(&ts, None, &mut sub, Some(&mut *emit), depth + 1)).await {
            Ok(r) => r,
            Err(e) => {
                emit(serde_json::json!({
                    "type": "workflowStepFail",
                    "name": ts.name,
                    "workflowStepId": ts.id,
                    "error": e.to_string()
                }));
                break;
            }
        };

        for (k, v) in &result.extracted_variables {
            sub.insert(k.clone(), Value::String(v.clone()));
        }

        if ts.step_type == "request" || !result.passed {
            emit(serde_json::json!({
                "type": if result.passed { "workflowStepPass" } else { "workflowStepFail" },
                "name": ts.name,
                "workflowStepId": ts.id,
                "durationMs": result.duration_ms,
                "error": result.error,
                "response": result.status_code.map(|s| serde_json::json!({ "statusCode": s })),
                "extracted": result.extracted_variables,
                "slaBreached": sla_breached(&result),
            }));
        }

        if result.stop_remaining {
            break;
        }
    }

    for (k, v) in &sub {
        if !pre_run.contains(k) {
            context.insert(k.clone(), v.clone());
        }
    }
}

/// True when the step ran an SLA assertion that failed. Inner case steps carry
/// their own SLA assertions, so breach comes from the case, not the perf row.
fn sla_breached(result: &crate::testing::frontend_types::StepExecutionResult) -> bool {
    result
        .assertion_results
        .iter()
        .any(|a| a.status == "FAIL" && a.name.eq_ignore_ascii_case("SLA"))
}

fn value_to_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}

fn row(
    request_id: String,
    request_name: String,
    parent_step_id: Option<String>,
    parent_step_name: Option<String>,
    iteration: u32,
    duration: f64,
    status: u16,
    success: bool,
    sla_breached: bool,
    error: Option<String>,
    extracted_values: Option<HashMap<String, String>>,
    timestamp: u64,
) -> PerformanceResult {
    PerformanceResult {
        request_id,
        request_name,
        parent_step_id,
        parent_step_name,
        interface_name: None,
        operation_name: None,
        iteration,
        duration,
        status,
        success,
        sla_breached,
        error,
        extracted_values,
        timestamp,
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Extract a value from XML using the last element name in an XPath-like path.
fn extract_xpath(xml: &str, path: &str) -> Option<String> {
    let element = path.split('/').rfind(|s| !s.is_empty())?;
    let element = element.split(':').next_back().unwrap_or(element);

    let open_tag = format!("<{}", element);
    let close_tag = format!("</{}>", element);

    let start = xml.find(&open_tag)?;
    let content_start = xml[start..].find('>')? + start + 1;
    let end = xml[content_start..].find(&close_tag)? + content_start;

    Some(xml[content_start..end].trim().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn case_step(steps: Vec<Value>, sla: Option<f64>) -> PerformanceRequest {
        PerformanceRequest {
            id: "perf-1".to_string(),
            name: "Login flow".to_string(),
            step_type: "testCase".to_string(),
            test_case_id: Some("tc-1".to_string()),
            test_case_variables: None,
            test_case_steps: steps,
            endpoint: String::new(),
            method: "POST".to_string(),
            soap_action: None,
            request_body: String::new(),
            headers: HashMap::new(),
            extractors: Vec::new(),
            sla_threshold: sla,
            order: 0,
        }
    }

    #[test]
    fn suite_json_saved_before_step_types_deserializes_as_a_request_step() {
        let legacy = serde_json::json!({
            "id": "perf-req-1",
            "name": "Get profile",
            "endpoint": "http://localhost/ping",
            "requestBody": "",
            "headers": {},
            "extractors": [],
            "order": 0
        });
        let step: PerformanceRequest = serde_json::from_value(legacy).unwrap();
        assert_eq!(step.step_type, "request");
        assert!(step.test_case_id.is_none());
    }

    #[tokio::test]
    async fn case_step_without_embedded_steps_reports_a_clear_error_row() {
        let step = case_step(vec![], None);
        let mut vars = HashMap::new();
        let rows = execute_step(&step, 0, &mut vars, None, &|| false).await;

        assert_eq!(rows.len(), 1);
        assert!(!rows[0].success);
        assert_eq!(rows[0].request_name, "Login flow");
        assert!(rows[0]
            .error
            .as_deref()
            .unwrap_or("")
            .contains("Test case 'tc-1' not available"));
    }

    #[tokio::test]
    async fn inner_http_and_failed_steps_get_rows_plain_delays_do_not() {
        let steps = vec![
            serde_json::json!({ "id": "s1", "name": "Wait", "type": "delay", "config": { "delayMs": 1 } }),
            serde_json::json!({
                "id": "s2",
                "name": "Token present",
                "type": "condition",
                "config": { "condition": { "expression": "a", "operator": "equals", "expectedValue": "b" } }
            }),
        ];
        let mut vars = HashMap::new();
        let rows = execute_step(&case_step(steps, None), 0, &mut vars, None, &|| false).await;

        // The delay produced nothing; the failed condition is the only row, and
        // it is attributed to the case step so the results view can group it.
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].request_id, "s2");
        assert!(!rows[0].success);
        assert_eq!(rows[0].parent_step_id.as_deref(), Some("perf-1"));
        assert_eq!(rows[0].parent_step_name.as_deref(), Some("Login flow"));
    }

    #[tokio::test]
    async fn case_variables_are_seeded_for_the_case_but_do_not_leak_into_the_run() {
        let steps = vec![serde_json::json!({
            "id": "s1",
            "name": "Token exists",
            "type": "condition",
            "config": { "condition": { "expression": "{{token}}", "operator": "exists", "expectedValue": "" } }
        })];
        let mut step = case_step(steps, None);
        step.test_case_variables = Some(HashMap::from([("token".to_string(), "TKN-1".to_string())]));

        let mut vars = HashMap::new();
        let rows = execute_step(&step, 0, &mut vars, None, &|| false).await;

        // The condition passed (so no row), which proves the case variable was
        // visible to its steps; it must not survive in the run's variable map.
        assert!(rows.is_empty());
        assert!(!vars.contains_key("token"));
    }

    #[tokio::test]
    async fn abort_stops_before_the_next_inner_step() {
        let steps = vec![serde_json::json!({
            "id": "s1",
            "name": "Token exists",
            "type": "condition",
            "config": { "condition": { "expression": "{{token}}", "operator": "exists", "expectedValue": "" } }
        })];
        let mut vars = HashMap::new();
        let rows = execute_step(&case_step(steps, None), 0, &mut vars, None, &|| true).await;
        assert!(rows.is_empty());
    }

    #[tokio::test]
    async fn case_level_sla_is_reported_as_one_aggregate_row_only_when_breached() {
        let steps = vec![serde_json::json!({
            "id": "s1",
            "name": "Wait",
            "type": "delay",
            "config": { "delayMs": 20 }
        })];
        let mut vars = HashMap::new();
        let rows = execute_step(&case_step(steps, Some(1.0)), 0, &mut vars, None, &|| false).await;

        assert_eq!(rows.len(), 1);
        assert!(rows[0].sla_breached);
        assert_eq!(rows[0].request_id, "perf-1");
        assert!(rows[0].error.as_deref().unwrap_or("").contains("SLA breached"));
    }
}
