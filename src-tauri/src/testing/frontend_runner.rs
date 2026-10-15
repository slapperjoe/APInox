/// Frontend Test Runner
///
/// Executes test cases in the TypeScript format (FrontendTestCase) that the
/// webview sends.
use anyhow::Result;
use once_cell::sync::Lazy;
use reqwest::Client;
use serde_json::Value;
use std::collections::HashMap;
use std::time::Instant;

/// Shared reqwest client for test-step execution. Reusing one client pools
/// TCP/TLS connections across workflow/test steps instead of building a fresh
/// connection pool (and background threads) per step.
static TEST_CLIENT: Lazy<Client> = Lazy::new(Client::new);

/// Max workflow<->testCase reference nesting during a run. The webview
/// already bounds embedding (MAX_EMBED_DEPTH); this is the defense-in-depth
/// cap for payloads that bypass it (sync mode, hand-built requests).
pub(crate) const MAX_REFERENCE_DEPTH: u32 = 10;

use crate::utils::{RegexExtractor, XPathEvaluator, WildcardProcessor, substitute_variables, CONTENT_TYPE_XML};

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
/// `depth` is the reference nesting level (0 = top-level run); guarded by
/// `MAX_REFERENCE_DEPTH` inside the loop/embedded-step executors.
pub async fn run_step(
    step: &FrontendTestStep,
    fallback_endpoint: Option<&str>,
    context: &mut HashMap<String, Value>,
    emit: Option<&mut (dyn FnMut(Value) + Send)>,
    depth: u32,
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
                stop_remaining: false,
            })
        }
        "workflow" => run_workflow_step(step, context, emit, depth).await,
        "condition" => {
            // Assertion semantics (user decision): true -> pass & continue;
            // false -> FAIL this step and STOP the rest of the case/workflow.
            let met = step
                .config
                .condition
                .as_ref()
                .map(|c| evaluate_condition(c, context))
                .unwrap_or(false);
            Ok(StepExecutionResult {
                passed: met,
                request_body: None,
                response_body: None,
                status_code: None,
                duration_ms: start.elapsed().as_millis() as u64,
                assertion_results: vec![],
                extracted_variables: HashMap::new(),
                error: if met {
                    None
                } else {
                    Some("condition failed — stopping run".to_string())
                },
                stop_remaining: !met,
            })
        }
        "loop" => {
            // Rebuild the flat 'loop' WorkflowStep shape the shared executor
            // expects, then run its body N / while times.
            let ws = serde_json::json!({
                "id": step.id,
                "name": step.name,
                "type": "loop",
                "loop": step.config.loop_config.clone().unwrap_or(Value::Null),
                "loopSteps": step.config.loop_steps.clone().unwrap_or_default()
            });
            let (passed, error, duration) =
                execute_loop_body(&ws, context, emit, &step.id, depth).await;
            Ok(StepExecutionResult {
                passed,
                request_body: None,
                response_body: None,
                status_code: None,
                duration_ms: duration,
                assertion_results: vec![],
                extracted_variables: HashMap::new(),
                error,
                stop_remaining: false,
            })
        }
        "testCase" => {
            // A 'testCase' step runs the referenced case's self-contained
            // embedded steps (webview-built payload). Missing embedding means
            // the reference was deleted, unset, or cut as a cycle/depth cap.
            let id = step.config.test_case_id.clone().filter(|s| !s.is_empty());
            let embedded = step.config.test_case_steps.clone().unwrap_or_default();
            if embedded.is_empty() {
                Ok(fail_result(
                    start,
                    format!(
                        "Test case '{}' not available (missing id, deleted, or reference cycle)",
                        id.as_deref().unwrap_or("(unspecified)")
                    ),
                ))
            } else {
                // The case's own variables are folded UNDER the step's
                // overrides into `test_case_variables` at embed time (parent
                // decision) — one map, applied to the sub-context copy.
                Ok(run_test_case_steps(
                    &embedded,
                    step.config.test_case_variables.as_ref(),
                    fallback_endpoint,
                    context,
                    emit,
                    &step.id,
                    depth + 1,
                )
                .await)
            }
        }
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
                stop_remaining: false,
            })
        }
    }
}

/// Resolve the referenced workflow's steps + initial variables.
///
/// Steps come from the self-contained payload the webview embedded
/// (`config.workflowSteps`). There is no persisted workflow store to fall back
/// to any more — workflows were absorbed into test cases (see
/// `workflow_migration.rs`), so an un-embedded `workflow` step has no steps.
fn resolve_workflow(
    step: &FrontendTestStep,
) -> (Vec<Value>, HashMap<String, String>, Option<String>) {
    let workflow_id = step
        .config
        .workflow_id
        .as_deref()
        .filter(|s| !s.is_empty());

    let steps = step
        .config
        .workflow_steps
        .clone()
        .unwrap_or_default();

    (steps, HashMap::new(), workflow_id.map(String::from))
}

/// Execute a 'workflow' test step: run the referenced workflow's steps in
/// order, sharing a variable context seeded from the test-case context, the
/// workflow's own initial variables, and the step's variable overrides
/// (highest priority). Emits per-workflow-step events so the webview can show
/// which inner requests succeeded. Mirrors `run_workflow`'s execution rules
/// (request/delay/condition/loop executed; script skipped).
async fn run_workflow_step(
    step: &FrontendTestStep,
    context: &mut HashMap<String, Value>,
    emit: Option<&mut (dyn FnMut(Value) + Send)>,
    depth: u32,
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
        stop_remaining: false,
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

    // Snapshot of the context before the run, so the result only reports
    // variables this workflow actually produced.
    let pre_run: std::collections::HashSet<String> = context.keys().cloned().collect();

    // The shared flat-step executor streams the same `workflowStep*` events
    // and mutates `variables` in place (request steps' extracted vars land
    // there). `stopped` is set when a 'condition' step failed inside the
    // workflow — the outer case must then stop too.
    let (all_passed, outcomes, stopped) =
        run_flat_steps(&wf_steps, &mut variables, emit, &step.id, depth + 1).await;

    // Propagate produced variables into the outer test-case context so later
    // top-level steps can use them.
    let mut extracted: HashMap<String, String> = HashMap::new();
    for o in &outcomes {
        for (k, v) in &o.extracted {
            extracted.insert(k.clone(), v.clone());
            context.insert(k.clone(), Value::String(v.clone()));
        }
    }

    // Report only variables this workflow produced (new or changed keys).
    extracted.retain(|k, _| !pre_run.contains(k));

    let mut errors: Vec<String> = Vec::new();
    for o in &outcomes {
        if !o.passed {
            if let Some(e) = &o.error {
                errors.push(format!("{}: {}", o.name, e));
            }
        }
    }

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
        stop_remaining: stopped,
    })
}

/// Execute a referenced test case's embedded steps against a scoped copy of
/// the caller's context.
///
/// `variables` is the referenced case's variable layer: the webview folds the
/// case's own variables UNDER the step's overrides into
/// `config.testCaseVariables` at embed time, so one map carries both and is
/// seeded into the sub-context after the copy. The key set is snapshotted
/// AFTER seeding, and only keys the run produced that were not already present
/// are merged back into `context` — so neither the case's configured variables
/// nor unrelated outer keys leak out. Variables the case's steps extract DO
/// become available to later outer steps.
pub(crate) async fn run_test_case_steps(
    embedded_steps: &[Value],
    variables: Option<&HashMap<String, String>>,
    fallback_endpoint: Option<&str>,
    context: &mut HashMap<String, Value>,
    mut emit: Option<&mut (dyn FnMut(Value) + Send)>,
    _parent_step_id: &str,
    depth: u32,
) -> StepExecutionResult {
    let start = Instant::now();
    if depth >= MAX_REFERENCE_DEPTH {
        return fail_result(start, "reference depth exceeded (possible cycle)".to_string());
    }

    let steps: Vec<FrontendTestStep> = match embedded_steps
        .iter()
        .map(|v| serde_json::from_value(v.clone()))
        .collect::<Result<Vec<_>, _>>()
    {
        Ok(s) => s,
        Err(e) => return fail_result(start, format!("invalid embedded test case steps: {e}")),
    };

    let mut sub: HashMap<String, Value> = context.clone();
    if let Some(vars) = variables {
        for (k, v) in vars {
            sub.insert(k.clone(), Value::String(v.clone()));
        }
    }
    // Snapshot AFTER seeding: the case's own variables must not merge back out.
    let pre_run: std::collections::HashSet<String> = sub.keys().cloned().collect();

    let mut all_passed = true;
    let mut errors: Vec<String> = Vec::new();
    for ts in &steps {
        // `run_step` <-> `run_test_case_steps` are mutually recursive async
        // fns; box the recursive link so the future has a finite size.
        match Box::pin(run_step(
            ts,
            fallback_endpoint,
            &mut sub,
            emitter_ref(&mut emit),
            depth + 1,
        ))
        .await
        {
            Ok(r) => {
                for (k, v) in &r.extracted_variables {
                    sub.insert(k.clone(), Value::String(v.clone()));
                }
                if !r.passed {
                    all_passed = false;
                    if let Some(e) = &r.error {
                        errors.push(format!("{}: {e}", ts.name));
                    }
                }
                if r.stop_remaining {
                    // A failed condition inside the referenced case already
                    // recorded its error above; just stop the remaining steps.
                    break;
                }
            }
            Err(e) => {
                all_passed = false;
                errors.push(format!("{}: {e}", ts.name));
                break;
            }
        }
    }

    // Merge back only what this case produced (keys absent after seeding).
    let mut extracted: HashMap<String, String> = HashMap::new();
    for (k, v) in &sub {
        if !pre_run.contains(k) {
            let s = v
                .as_str()
                .map(|s| s.to_string())
                .unwrap_or_else(|| v.to_string());
            extracted.insert(k.clone(), s);
            context.insert(k.clone(), v.clone());
        }
    }

    let error = if errors.is_empty() {
        None
    } else {
        Some(errors.join("; "))
    };
    StepExecutionResult {
        passed: all_passed,
        request_body: None,
        response_body: None,
        status_code: None,
        duration_ms: start.elapsed().as_millis() as u64,
        assertion_results: vec![],
        extracted_variables: extracted,
        error,
        stop_remaining: false,
    }
}

/// Build a failed `StepExecutionResult` for the testCase depth / parse guards.
fn fail_result(start: Instant, msg: String) -> StepExecutionResult {
    StepExecutionResult {
        passed: false,
        request_body: None,
        response_body: None,
        status_code: None,
        duration_ms: start.elapsed().as_millis() as u64,
        assertion_results: vec![],
        extracted_variables: HashMap::new(),
        error: Some(msg),
        stop_remaining: false,
    }
}

/// Outcome of executing one flat (workflow-shaped) step.
///
/// `id`/`r#type`/`response`/`duration_ms`/`stop` are part of the shared shape
/// used by the embedded testCase executor; not all are read on every path yet.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub(crate) struct FlatStepOutcome {
    pub id: String,
    pub name: String,
    pub r#type: String,
    pub passed: bool,
    pub error: Option<String>,
    /// (status, duration_ms, body) for request steps.
    pub response: Option<(Option<u16>, u64, Option<String>)>,
    pub duration_ms: u64,
    pub extracted: HashMap<String, String>,
    /// True when a 'condition' step FAILED: the caller must stop the list
    /// (the whole case/workflow is already marked failed via `passed`).
    pub stop: bool,
}

/// Reborrow a streaming emitter so it can be handed down to a nested
/// executor repeatedly. A `&mut dyn FnMut` is invariant, so the compiler will
/// not accept a second `as_deref_mut()` while a nested call holds the first;
/// an explicit `&mut **e` reborrow hands out a fresh, shorter-lived borrow
/// each time.
fn emitter_ref<'a>(
    emit: &'a mut Option<&mut (dyn FnMut(Value) + Send)>,
) -> Option<&'a mut (dyn FnMut(Value) + Send)> {
    match emit {
        Some(e) => Some(&mut **e),
        None => None,
    }
}

/// Execute a list of flat workflow-shaped steps in order, sharing `context`.
/// Emits the same `workflowStep*` events `run_workflow_step` used to emit
/// (callers that don't stream pass None). `depth` is the reference nesting
/// level (0 = top-level run); guarded by MAX_REFERENCE_DEPTH.
///
/// Returns (all_passed, per-step outcomes, stopped_by_condition).
pub(crate) async fn run_flat_steps(
    steps: &[Value],
    context: &mut HashMap<String, Value>,
    mut emit: Option<&mut (dyn FnMut(Value) + Send)>,
    parent_step_id: &str,
    depth: u32,
) -> (bool, Vec<FlatStepOutcome>, bool) {
    if depth >= MAX_REFERENCE_DEPTH {
        return (
            false,
            vec![FlatStepOutcome {
                id: String::new(),
                name: String::new(),
                r#type: String::new(),
                passed: false,
                error: Some("reference depth exceeded (possible cycle)".to_string()),
                response: None,
                duration_ms: 0,
                extracted: HashMap::new(),
                stop: false,
            }],
            false,
        );
    }

    let mut all_passed = true;
    let mut outcomes: Vec<FlatStepOutcome> = Vec::new();
    let mut stopped = false;

    for ws in steps {
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
                "stepId": parent_step_id,
                "workflowStepId": ws_id,
                "name": ws_name
            }));
        }

        let mut step_extracted: HashMap<String, String> = HashMap::new();

        let (sub_passed, sub_error, sub_response, sub_duration, step_stop) =
            match ws_type.as_str() {
                "delay" => {
                    let ms = ws.get("delayMs").and_then(|v| v.as_u64()).unwrap_or(0);
                    tokio::time::sleep(tokio::time::Duration::from_millis(ms)).await;
                    (true, None, None, ws_start.elapsed().as_millis() as u64, false)
                }
                "request" => {
                    let req = build_frontend_request(ws);
                    match run_request_step(&req, None, &*context, ws_start).await {
                        Ok(r) => {
                            for (k, v) in &r.extracted_variables {
                                context.insert(k.clone(), Value::String(v.clone()));
                                step_extracted.insert(k.clone(), v.clone());
                            }
                            (
                                r.passed,
                                r.error,
                                Some((r.status_code, r.duration_ms, r.response_body)),
                                r.duration_ms,
                                false,
                            )
                        }
                        Err(e) => (
                            false,
                            Some(e.to_string()),
                            None,
                            ws_start.elapsed().as_millis() as u64,
                            false,
                        ),
                    }
                }
                "condition" => {
                    let met = ws
                        .get("condition")
                        .map(|c| evaluate_condition(c, context))
                        .unwrap_or(false);
                    // Assertion semantics (user decision): true -> pass &
                    // continue; false -> FAIL this step and stop the list.
                    (
                        met,
                        if met {
                            None
                        } else {
                            Some("condition failed — stopping run".to_string())
                        },
                        None,
                        ws_start.elapsed().as_millis() as u64,
                        !met,
                    )
                }
                "loop" => {
                    let (passed, error, duration) = execute_loop_body(
                        ws,
                        context,
                        emitter_ref(&mut emit),
                        parent_step_id,
                        depth + 1,
                    )
                    .await;
                    (passed, error, None, duration, false)
                }
                "testCase" => {
                    // A workflow-embedded testCase step carries its referenced
                    // case as `testCase: { id, name, steps }` (webview embed).
                    let embedded = ws
                        .get("testCase")
                        .and_then(|v| v.get("steps"))
                        .and_then(|v| v.as_array())
                        .cloned()
                        .unwrap_or_default();
                    if embedded.is_empty() {
                        (
                            false,
                            Some(
                                "Test case not available (missing id, deleted, or reference cycle)"
                                    .to_string(),
                            ),
                            None,
                            0,
                            false,
                        )
                    } else {
                        let overrides: Option<HashMap<String, String>> = ws
                            .get("testCaseVariables")
                            .and_then(|v| v.as_object())
                            .map(|o| {
                                o.iter()
                                    .filter_map(|(k, v)| {
                                        v.as_str().map(|s| (k.clone(), s.to_string()))
                                    })
                                    .collect()
                            });
                        let r = run_test_case_steps(
                            &embedded,
                            overrides.as_ref(),
                            None,
                            context,
                            emitter_ref(&mut emit),
                            parent_step_id,
                            depth + 1,
                        )
                        .await;
                        for (k, v) in &r.extracted_variables {
                            step_extracted.insert(k.clone(), v.clone());
                        }
                        (r.passed, r.error, None, r.duration_ms, false)
                    }
                }
                other => {
                    // script (and other non-executed types): surfaced as
                    // skipped, not failed.
                    log::warn!(
                        "[FrontendRunner] workflow step '{}' type '{}' not executed in test run",
                        ws_name,
                        other
                    );
                    (true, None, None, 0, false)
                }
            };

        if let Some(emitter) = emit.as_deref_mut() {
            let event_type = if !sub_passed {
                "workflowStepFail"
            } else {
                match ws_type.as_str() {
                    "script" => "workflowStepSkip",
                    _ => "workflowStepPass",
                }
            };
            emitter(serde_json::json!({
                "type": event_type,
                "stepId": parent_step_id,
                "workflowStepId": ws_id,
                "name": ws_name,
                "durationMs": sub_duration,
                "error": sub_error.clone(),
                "response": sub_response.clone().map(|(status_code, duration_ms, body)| {
                    serde_json::json!({
                        "rawResponse": body,
                        "duration": duration_ms as f64 / 1000.0,
                        "statusCode": status_code
                    })
                })
            }));
        }

        if !sub_passed {
            all_passed = false;
        }

        outcomes.push(FlatStepOutcome {
            id: ws_id,
            name: ws_name,
            r#type: ws_type,
            passed: sub_passed,
            error: sub_error,
            response: sub_response,
            duration_ms: sub_duration,
            extracted: step_extracted,
            stop: step_stop,
        });

        if step_stop {
            stopped = true;
            break;
        }
    }

    (all_passed, outcomes, stopped)
}

/// Execute a 'loop' flat step: resolve iterations from its `loop` config and
/// run the `loopSteps` body once per iteration, setting the iterator variable.
/// `list` splits the substituted variable on commas (legacy engine parity);
/// `while` re-evaluates its condition each pass. All bounded by maxIterations.
pub(crate) async fn execute_loop_body(
    ws: &Value,
    context: &mut HashMap<String, Value>,
    mut emit: Option<&mut (dyn FnMut(Value) + Send)>,
    parent_step_id: &str,
    depth: u32,
) -> (bool, Option<String>, u64) {
    let start = Instant::now();
    if depth >= MAX_REFERENCE_DEPTH {
        return (
            false,
            Some("reference depth exceeded (possible cycle)".to_string()),
            0,
        );
    }
    let loop_cfg = ws.get("loop").cloned().unwrap_or(Value::Null);
    let ltype = loop_cfg
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("count")
        .to_string();
    let max_iter = loop_cfg
        .get("maxIterations")
        .and_then(|v| v.as_u64())
        .unwrap_or(100);
    let iter_var = loop_cfg
        .get("iteratorVariable")
        .and_then(|v| v.as_str())
        .unwrap_or("i")
        .to_string();
    let body = ws
        .get("loopSteps")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut all_passed = true;
    let mut errors: Vec<String> = Vec::new();
    let mut iteration: u64 = 0;

    if ltype == "while" {
        let cond = loop_cfg.get("condition").cloned();
        while iteration < max_iter {
            let met = cond
                .as_ref()
                .map(|c| evaluate_condition(c, context))
                .unwrap_or(false);
            if !met {
                break;
            }
            let (passed, stopped) = run_loop_iteration(
                &body,
                context,
                emitter_ref(&mut emit),
                parent_step_id,
                depth,
                &iter_var,
                None,
                iteration,
            )
            .await;
            iteration += 1;
            if stopped {
                // A condition FAILED inside the body (assertion semantics):
                // the body failed — abort the whole loop and report failure.
                errors.push(format!(
                    "iteration {}: condition failed inside loop body",
                    iteration
                ));
                all_passed = false;
                break;
            }
            if !passed {
                errors.push(format!("iteration {}: body failed", iteration));
                all_passed = false;
                break;
            }
        }
    } else {
        let items: Vec<Option<String>> = match ltype.as_str() {
            "count" => {
                let n = loop_cfg
                    .get("count")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(1)
                    .min(max_iter);
                (0..n).map(|_| None).collect()
            }
            "list" => {
                let var = loop_cfg
                    .get("listVariable")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let raw = substitute_step_template(var, &context_to_strings(context));
                raw.split(',')
                    .map(|s| Some(s.trim().to_string()))
                    .filter(|s| s.as_deref().map_or(false, |t| !t.is_empty()))
                    .take(max_iter as usize)
                    .collect()
            }
            _ => vec![],
        };
        for item in items {
            let (passed, stopped) = run_loop_iteration(
                &body,
                context,
                emitter_ref(&mut emit),
                parent_step_id,
                depth,
                &iter_var,
                item,
                iteration,
            )
            .await;
            iteration += 1;
            if stopped {
                errors.push(format!(
                    "iteration {}: condition failed inside loop body",
                    iteration
                ));
                all_passed = false;
                break;
            }
            if !passed {
                errors.push(format!("iteration {}: body failed", iteration));
                all_passed = false;
                break;
            }
        }
    }

    let error = if errors.is_empty() { None } else { Some(errors.join("; ")) };
    (all_passed, error, start.elapsed().as_millis() as u64)
}

/// One loop pass: write the iterator variable + `_index` into the shared
/// context, then run the body through `run_flat_steps`.
/// Returns (body_passed, stopped_by_condition).
async fn run_loop_iteration(
    body: &[Value],
    context: &mut HashMap<String, Value>,
    emit: Option<&mut (dyn FnMut(Value) + Send)>,
    parent_step_id: &str,
    depth: u32,
    iter_var: &str,
    item: Option<String>,
    index: u64,
) -> (bool, bool) {
    if let Some(v) = item {
        context.insert(iter_var.to_string(), Value::String(v));
    }
    context.insert("_index".to_string(), Value::String(index.to_string()));
    // `run_flat_steps` <-> `execute_loop_body` are mutually recursive async
    // fns; box the recursive link so the future has a finite size.
    let (passed, _outcomes, stopped) =
        Box::pin(run_flat_steps(body, context, emit, parent_step_id, depth + 1)).await;
    (passed, stopped)
}

/// Apply template substitution to a step endpoint/body.
///
/// Workflow/context variables first (`{{name}}` / `${name}` — the wizard's
/// manual variables and extractor values), then the `WildcardProcessor`
/// built-in template functions (`{{uuid}}`, `{{now}}`, `{{epoch}}`,
/// `{{randomInt(min,max)}}`, ...), so built-ins work in workflow/test-step
/// endpoints and bodies the same way they do in single-request runs.
/// A user variable named like a built-in (e.g. `uuid`) wins, because the
/// variable pass runs first.
pub(crate) fn substitute_step_template(template: &str, context: &HashMap<String, String>) -> String {
    let substituted = substitute_variables(template, context);
    WildcardProcessor::process(&substituted, &HashMap::new(), &HashMap::new(), None)
}

/// Convert the mutable run context (stringly-typed `Value`s) to the flat
/// string map the template-substitution helpers expect. Shared by
/// `run_request_step` and `evaluate_condition`.
pub(crate) fn context_to_strings(context: &HashMap<String, Value>) -> HashMap<String, String> {
    context
        .iter()
        .map(|(k, v)| {
            let s = match v {
                Value::String(s) => s.clone(),
                other => other.to_string(),
            };
            (k.clone(), s)
        })
        .collect()
}

/// If `raw` is exactly a whole-string variable template (`{{name}}` or
/// `${name}`), return the variable name; otherwise None (literals, mixed
/// text, or complex expressions).
fn template_var_name(raw: &str) -> Option<&str> {
    let inner = if let Some(rest) = raw.strip_prefix("{{").and_then(|s| s.strip_suffix("}}")) {
        rest
    } else if let Some(rest) = raw.strip_prefix("${").and_then(|s| s.strip_suffix('}')) {
        rest
    } else {
        return None;
    };
    let name = inner.trim();
    if name.is_empty() || name.contains('{') || name.contains('}') || name.contains(char::is_whitespace) {
        None
    } else {
        Some(name)
    }
}

/// Evaluate a flat `WorkflowCondition` ({ expression, operator, expectedValue })
/// against the run context. The expression goes through the same template
/// substitution as endpoints/bodies (`{{name}}`/`${name}` then built-ins), so
/// `{{varName}}` compares the current variable value. Mirrors the operators
/// exposed by the webview's ConditionStepEditor. Unknown operators → false.
///
/// `exists` / `notExists` test whether the referenced variable is present in
/// the context (a whole-string `{{name}}`/`${name}` template), falling back to
/// a non-empty/literal-empty check for non-template expressions.
pub(crate) fn evaluate_condition(cond: &Value, context: &HashMap<String, Value>) -> bool {
    let get_str = |k: &str| cond.get(k).and_then(|v| v.as_str()).unwrap_or("").to_string();
    let raw_expression = get_str("expression");
    let expression = substitute_step_template(&raw_expression, &context_to_strings(context));
    let operator = get_str("operator");
    let expected = get_str("expectedValue");

    match operator.as_str() {
        "exists" => match template_var_name(&raw_expression) {
            Some(name) => context.contains_key(name),
            None => !expression.is_empty(),
        },
        "notExists" => match template_var_name(&raw_expression) {
            Some(name) => !context.contains_key(name),
            None => expression.is_empty(),
        },
        _ => {
            if expression.is_empty() {
                return false;
            }
            match operator.as_str() {
                "equals" => expression == expected,
                "notEquals" => expression != expected,
                "contains" => expression.contains(&expected),
                "notContains" => !expression.contains(&expected),
                // Both sides must parse as f64, otherwise false.
                "greaterThan" => match (expression.parse::<f64>(), expected.parse::<f64>()) {
                    (Ok(a), Ok(b)) => a > b,
                    _ => false,
                },
                "lessThan" => match (expression.parse::<f64>(), expected.parse::<f64>()) {
                    (Ok(a), Ok(b)) => a < b,
                    _ => false,
                },
                _ => false,
            }
        }
    }
}

/// Resolve header names and values through the step template (workflow
/// variables first, then built-in wildcards) and drop entries whose name is
/// blank after substitution. Mirrors how endpoints and bodies are
/// substituted, so a captured value the wizard emitted as `{{varName}}` in a
/// header (e.g. `Authorization: Bearer {{sessionToken}}`) is resolved at run
/// time instead of being sent literally.
pub(crate) fn apply_header_substitution(
    headers: &HashMap<String, String>,
    context: &HashMap<String, String>,
) -> Vec<(String, String)> {
    headers
        .iter()
        .map(|(k, v)| {
            (
                substitute_step_template(k, context).trim().to_string(),
                substitute_step_template(v, context),
            )
        })
        .filter(|(k, _)| !k.is_empty())
        .collect()
}

/// Layer case-level variables onto the run's base variable map
/// (environment + suite variables, already merged by the webview) and
/// return the per-case initial substitution context. Case variables win
/// over the base; everything else passes through untouched. Returns a
/// `Value` map to seed `run_step`'s mutable context directly.
pub(crate) fn merge_case_variables(
    base: &HashMap<String, String>,
    case: Option<&HashMap<String, String>>,
) -> HashMap<String, Value> {
    let mut ctx: HashMap<String, Value> = base
        .iter()
        .map(|(k, v)| (k.clone(), Value::String(v.clone())))
        .collect();
    if let Some(case_vars) = case {
        for (k, v) in case_vars {
            ctx.insert(k.clone(), Value::String(v.clone()));
        }
    }
    ctx
}

/// Split substituted request headers into (kept, dropped).
///
/// Stored `Content-Length` / `Transfer-Encoding` headers are never
/// forwarded: the body can have changed length since the header was
/// saved (variable substitution, user edits), and hyper 1.x RESPECTS A
/// USER-SUPPLIED CONTENT-LENGTH OVER THE BODY'S TRUE LENGTH — if it is
/// smaller, it silently truncates the body to it with no client-side
/// error (hyper 1.8.1 `Client::set_length` + `Encoder::Kind::Length`),
/// so the server sees the XML cut off mid-element (e.g. OSB
/// `WstxEOFException: Unexpected EOF`). reqwest recomputes
/// Content-Length from the actual body instead — the same rule the
/// proxy replay path applies.
pub(crate) fn split_wire_headers(
    headers: &[(String, String)],
) -> (Vec<(String, String)>, Vec<String>) {
    let mut kept = Vec::new();
    let mut dropped = Vec::new();
    for (k, v) in headers {
        if k.eq_ignore_ascii_case("content-length") || k.eq_ignore_ascii_case("transfer-encoding") {
            dropped.push(format!("{}: {}", k, v));
        } else {
            kept.push((k.clone(), v.clone()));
        }
    }
    (kept, dropped)
}

/// Build a `FrontendRequest` from a flat frontend `WorkflowStep`.
///
/// `pub(crate)` so the performance runner can drive workflow-backed suites
/// through the same request-execution path as `run_workflow`.
pub(crate) fn build_frontend_request(step: &Value) -> FrontendRequest {
    let get = |k: &str| {
        step.get(k)
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
    };

    let method = get("httpMethod").or_else(|| get("method"));

    let extractors: Vec<FrontendExtractor> = step
        .get("extractors")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|e| {
                    let variable = e.get("variable").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    if variable.is_empty() {
                        return None;
                    }
                    let raw = e
                        .get("type")
                        .and_then(|v| v.as_str())
                        .unwrap_or("xpath")
                        .to_lowercase();
                    let extractor_type = match raw.as_str() {
                        "jsonpath" => "JSONPath",
                        "regex" => "Regex",
                        "header" => "Header",
                        _ => "XPath",
                    }
                    .to_string();
                    let source = e.get("source").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let pattern = e.get("pattern").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let header_name = e
                        .get("headerName")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    // For header extractors the lookup name is headerName, else the pattern.
                    let path = if extractor_type == "Header" {
                        header_name.or(pattern)
                    } else {
                        pattern
                    };
                    let default_value = e
                        .get("defaultValue")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    Some(FrontendExtractor {
                        id: e.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        variable,
                        extractor_type: Some(extractor_type),
                        source,
                        path,
                        default_value,
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    FrontendRequest {
        name: get("name"),
        request: get("requestBody"),
        endpoint: get("endpoint"),
        method,
        content_type: get("contentType"),
        headers: step.get("headers").and_then(|v| v.as_object()).map(|obj| {
            obj.iter()
                .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                .collect()
        }),
        assertions: None,
        extractors: if extractors.is_empty() {
            None
        } else {
            Some(extractors)
        },
    }
}

pub(crate) async fn run_request_step(
    req: &FrontendRequest,
    fallback_endpoint: Option<&str>,
    context: &HashMap<String, Value>,
    start: Instant,
) -> Result<StepExecutionResult> {
    // Convert context values to strings for template substitution
    let str_context = context_to_strings(context);

    let endpoint = req
        .endpoint
        .as_deref()
        .filter(|s| !s.is_empty())
        .or(fallback_endpoint)
        .unwrap_or("")
        .to_string();

    let endpoint = substitute_step_template(&endpoint, &str_context);

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
            stop_remaining: false,
        });
    }

    let body = req
        .request
        .as_deref()
        .unwrap_or("")
        .to_string();
    let body = substitute_step_template(&body, &str_context);

    let method = req.method.as_deref().unwrap_or("POST").to_uppercase();
    let content_type = req
        .content_type
        .as_deref()
        .unwrap_or(CONTENT_TYPE_XML)
        .to_string();

    let client = &*TEST_CLIENT;
    let mut builder = match method.as_str() {
        "GET" => client.get(&endpoint),
        "PUT" => client.put(&endpoint),
        "PATCH" => client.patch(&endpoint),
        "DELETE" => client.delete(&endpoint),
        _ => client.post(&endpoint),
    };

    // Apply extra headers from the request config. Names/values are resolved
    // through the step template (see apply_header_substitution) so workflow
    // variables work in header values too; blank names are skipped there and
    // Content-Type may be overridden by an explicit header entry.
    let mut content_type_overridden = false;
    let mut applied_headers: Vec<(String, String)> = Vec::new();
    if let Some(headers) = &req.headers {
        let substituted = apply_header_substitution(headers, &str_context);
        let (kept, dropped) = split_wire_headers(&substituted);
        applied_headers = kept;
        for (k, v) in &applied_headers {
            if k.eq_ignore_ascii_case("content-type") {
                // Override the default Content-Type we set above
                builder = builder.header("Content-Type", v.as_str());
                content_type_overridden = true;
            } else {
                builder = builder.header(k.as_str(), v.as_str());
            }
        }
        if !dropped.is_empty() {
            log::info!(
                "[FrontendRunner] Dropped stored header(s), reqwest computes them from the actual body: {}",
                dropped.join("; ")
            );
        }
    }

    if !content_type_overridden {
        builder = builder.header("Content-Type", &content_type);
        applied_headers.push(("Content-Type".to_string(), content_type.clone()));
    }

    if method != "GET" && method != "DELETE" {
        builder = builder.body(body.clone());
    }

    // Log exactly what is about to go out on the wire: the effective
    // (post-substitution) endpoint, every applied header, and the full
    // substituted body. Test-step runs used to log method+URL only, so a
    // server report of "only part of the request arrived" could not be
    // checked against what was actually sent — the single-run SOAP path
    // already logs `Request body:` (soap/client.rs).
    log::info!(
        "[FrontendRunner] {} {} (body {} bytes)",
        method,
        endpoint,
        body.len()
    );
    for (k, v) in &applied_headers {
        log::info!("[FrontendRunner] Request header: {}: {}", k, v);
    }
    log::info!("[FrontendRunner] Request body:\n{}", body);

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
                stop_remaining: false,
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

    log::info!(
        "[FrontendRunner] Response {} ({}ms, {} bytes)",
        status_code,
        duration_ms,
        response_body.len()
    );
    log::info!("[FrontendRunner] Response body:\n{}", response_body);

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
        stop_remaining: false,
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

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    #[test]
    fn substitutes_workflow_variables_in_double_and_dollar_braces() {
        let out = substitute_step_template(
            "http://{{host}}/svc ${token}",
            &ctx(&[("host", "api.example.com"), ("token", "TKN-999")]),
        );
        assert_eq!(out, "http://api.example.com/svc TKN-999");
    }

    #[test]
    fn built_in_functions_expand_in_templates() {
        // {{uuid}} -> a UUID-shaped value (no literal {{uuid}} left behind).
        let out = substitute_step_template("<Id>{{uuid}}</Id>", &ctx(&[]));
        assert!(!out.contains("{{uuid}}"), "got: {}", out);
        let inner = out.trim_start_matches("<Id>").trim_end_matches("</Id>");
        assert_eq!(inner.len(), 36);
        assert_eq!(inner.matches('-').count(), 4);

        // {{epoch}} -> integer seconds.
        let epoch = substitute_step_template("{{epoch}}", &ctx(&[]));
        assert!(epoch.parse::<i64>().is_ok(), "epoch was: {}", epoch);

        // {{randomInt(1,1)}} is deterministic within its range.
        assert_eq!(substitute_step_template("{{randomInt(1,1)}}", &ctx(&[])), "1");

        // {{now}} -> ISO-8601 (contains a 'T' separator, not a literal token).
        let now = substitute_step_template("{{now}}", &ctx(&[]));
        assert!(now.contains('T'), "now was: {}", now);
    }

    #[test]
    fn user_variable_named_like_built_in_wins() {
        // The wizard can legitimately create a variable named `uuid` (element
        // tag); its value must be used instead of generating a fresh UUID.
        let out = substitute_step_template("{{uuid}}", &ctx(&[("uuid", "fixed-value")]));
        assert_eq!(out, "fixed-value");
    }

    #[test]
    fn no_variables_leaves_template_unchanged() {
        let template = "<GetUser><Name>Mark</Name></GetUser>";
        assert_eq!(substitute_step_template(template, &ctx(&[])), template);
    }

    #[test]
    fn merge_case_variables_case_overrides_base() {
        let base = ctx(&[("host", "suit.example.com"), ("token", "suit-token")]);
        let case = ctx(&[("token", "case-token"), ("extra", "case-only")]);
        let merged = merge_case_variables(&base, Some(&case));
        assert_eq!(merged["host"], Value::String("suit.example.com".into()));
        // Same key: case wins.
        assert_eq!(merged["token"], Value::String("case-token".into()));
        // New key only in the case appears.
        assert_eq!(merged["extra"], Value::String("case-only".into()));
        assert_eq!(merged.len(), 3);
    }

    #[test]
    fn merge_case_variables_without_case_keeps_base() {
        let base = ctx(&[("host", "suit.example.com"), ("token", "suit-token")]);
        let merged = merge_case_variables(&base, None);
        assert_eq!(merged["token"], Value::String("suit-token".into()));
        assert_eq!(merged.len(), 2);
    }

    #[test]
    fn apply_header_substitution_resolves_variables_in_names_and_values() {
        let headers: HashMap<String, String> = [
            ("Authorization".to_string(), "Bearer {{sessionToken}}".to_string()),
            ("Content-Type".to_string(), "text/xml; charset=\"utf-8\"".to_string()),
            ("{{suffix}}-X-Custom".to_string(), "v1".to_string()),
            ("   ".to_string(), "dropped".to_string()),
        ]
        .into_iter()
        .collect();
        let out = apply_header_substitution(&headers, &ctx(&[("sessionToken", "TKN-999"), ("suffix", "v1")]));
        // Values are resolved like bodies/endpoints.
        assert!(out.contains(&("Authorization".to_string(), "Bearer TKN-999".to_string())));
        // Plain values pass through untouched.
        assert!(out.contains(&("Content-Type".to_string(), "text/xml; charset=\"utf-8\"".to_string())));
        // Names go through the same template resolution.
        assert!(out.contains(&("v1-X-Custom".to_string(), "v1".to_string())));
        // Blank (post-substitution) names are dropped.
        assert!(out.iter().all(|(k, _)| !k.trim().is_empty()));
        assert_eq!(out.len(), 3);
    }

    #[test]
    fn apply_header_substitution_keeps_literal_template_when_unknown() {
        // An unresolvable variable is left as-is (same as bodies) — never an error.
        let headers: HashMap<String, String> = [("X-A".to_string(), "{{missing}}".to_string())].into_iter().collect();
        let out = apply_header_substitution(&headers, &ctx(&[]));
        assert_eq!(out, vec![("X-A".to_string(), "{{missing}}".to_string())]);
    }

    #[test]
    fn stored_content_length_and_transfer_encoding_are_dropped() {
        // A stale stored Content-Length smaller than the real body would be
        // silently honored by hyper and truncate the wire body — so it (and
        // Transfer-Encoding) must be dropped; everything else is kept.
        let headers = vec![
            ("Content-Length".to_string(), "99".to_string()),
            ("transfer-encoding".to_string(), "chunked".to_string()),
            ("X-Keep".to_string(), "yes".to_string()),
        ];
        let (kept, dropped) = split_wire_headers(&headers);
        assert_eq!(kept, vec![("X-Keep".to_string(), "yes".to_string())]);
        assert_eq!(dropped.len(), 2);
        assert!(dropped[0].contains("Content-Length: 99"));
        assert!(dropped[1].contains("transfer-encoding: chunked"));
    }

    fn cond(expr: &str, op: &str, expected: &str) -> serde_json::Value {
        serde_json::json!({ "id": "c1", "expression": expr, "operator": op, "expectedValue": expected })
    }

    #[test]
    fn condition_equality_resolves_variables_first() {
        let mut ctx: HashMap<String, Value> = HashMap::new();
        ctx.insert("status".to_string(), Value::String("OK".into()));
        assert!(evaluate_condition(&cond("{{status}}", "equals", "OK"), &ctx));
        assert!(!evaluate_condition(&cond("{{status}}", "equals", "NOPE"), &ctx));
    }

    #[test]
    fn condition_contains_and_not_contains() {
        let mut ctx: HashMap<String, Value> = HashMap::new();
        ctx.insert("body".to_string(), Value::String("<Fault/>".into()));
        assert!(evaluate_condition(&cond("{{body}}", "contains", "Fault"), &ctx));
        assert!(evaluate_condition(&cond("{{body}}", "notContains", "Error"), &ctx));
    }

    #[test]
    fn condition_exists_operators() {
        let mut ctx: HashMap<String, Value> = HashMap::new();
        ctx.insert("token".to_string(), Value::String("t".into()));
        assert!(evaluate_condition(&cond("{{token}}", "exists", ""), &ctx));
        assert!(evaluate_condition(&cond("{{missing}}", "notExists", ""), &ctx));
        assert!(!evaluate_condition(&cond("{{missing}}", "exists", ""), &ctx));
    }

    #[test]
    fn condition_numeric_compare_requires_numbers_else_false() {
        let mut ctx: HashMap<String, Value> = HashMap::new();
        ctx.insert("count".to_string(), Value::String("10".into()));
        assert!(evaluate_condition(&cond("{{count}}", "greaterThan", "5"), &ctx));
        assert!(evaluate_condition(&cond("{{count}}", "lessThan", "20"), &ctx));
        ctx.insert("word".to_string(), Value::String("abc".into()));
        assert!(!evaluate_condition(&cond("{{word}}", "greaterThan", "5"), &ctx));
    }

    #[test]
    fn condition_unknown_operator_is_false() {
        let ctx: HashMap<String, Value> = HashMap::new();
        assert!(!evaluate_condition(&cond("{{x}}", "startsWith", "a"), &ctx));
    }

    fn step(type_: &str, name: &str, config: serde_json::Value) -> FrontendTestStep {
        FrontendTestStep {
            id: format!("stp-{name}"),
            name: name.to_string(),
            step_type: type_.to_string(),
            config: serde_json::from_value(config).expect("config"),
        }
    }

    #[tokio::test]
    async fn condition_false_fails_and_stops() {
        let mut ctx: HashMap<String, Value> = HashMap::new();
        let s = step("condition", "guard", serde_json::json!({
            "condition": { "id": "c", "expression": "{{flag}}", "operator": "equals", "expectedValue": "yes" }
        }));
        let r = run_step(&s, None, &mut ctx, None, 0).await.expect("run");
        assert!(!r.passed, "a false condition FAILS the case (assertion semantics)");
        assert!(r.error.as_ref().unwrap().contains("condition failed"));
        assert!(r.stop_remaining, "failed condition must stop the run");
    }

    #[tokio::test]
    async fn condition_true_continues() {
        let mut ctx: HashMap<String, Value> = HashMap::new();
        ctx.insert("flag".to_string(), Value::String("yes".into()));
        let s = step("condition", "guard", serde_json::json!({
            "condition": { "id": "c", "expression": "{{flag}}", "operator": "equals", "expectedValue": "yes" }
        }));
        let r = run_step(&s, None, &mut ctx, None, 0).await.expect("run");
        assert!(r.passed && !r.stop_remaining);
    }

    #[tokio::test]
    async fn loop_count_runs_body_with_iterator_variable() {
        let mut ctx: HashMap<String, Value> = HashMap::new();
        let s = step("loop", "twice", serde_json::json!({
            "loop": { "type": "count", "count": 2, "maxIterations": 100, "iteratorVariable": "i" },
            "loopSteps": [
                { "id": "b1", "name": "d1", "type": "delay", "delayMs": 1 }
            ]
        }));
        let r = run_step(&s, None, &mut ctx, None, 0).await.expect("run");
        assert!(r.passed);
        assert_eq!(ctx.get("_index"), Some(&Value::String("1".into()))); // last index written
    }

    #[tokio::test]
    async fn loop_while_false_condition_runs_zero_iterations() {
        let mut ctx: HashMap<String, Value> = HashMap::new();
        let s = step("loop", "never", serde_json::json!({
            "loop": {
                "type": "while",
                "maxIterations": 100,
                "condition": { "id": "c", "expression": "{{go}}", "operator": "equals", "expectedValue": "yes" }
            },
            "loopSteps": [ { "id": "b1", "name": "d1", "type": "delay", "delayMs": 1 } ]
        }));
        let r = run_step(&s, None, &mut ctx, None, 0).await.expect("run");
        assert!(r.passed);
        assert!(!ctx.contains_key("_index"), "body never ran");
    }

    #[tokio::test]
    async fn test_case_step_runs_embedded_steps_and_scopes_variables() {
        let mut ctx: HashMap<String, Value> = HashMap::new();
        ctx.insert("outer".to_string(), Value::String("keep".into()));
        let s = step("testCase", "inner", serde_json::json!({
            "testCaseId": "tc-x",
            "testCaseVariables": { "innerVar": "iv" },
            "testCaseSteps": [
                { "id": "i1", "name": "d", "type": "delay", "delayMs": 1, "config": {} }
            ]
        }));
        let r = run_step(&s, None, &mut ctx, None, 0).await.expect("run");
        assert!(r.passed);
        // The case's own variable was visible inside but must not leak outward.
        assert!(!ctx.contains_key("innerVar"));
        assert_eq!(ctx.get("outer"), Some(&Value::String("keep".into())));
    }

    #[tokio::test]
    async fn test_case_step_without_embedding_fails_clearly() {
        let mut ctx: HashMap<String, Value> = HashMap::new();
        let s = step("testCase", "ghost", serde_json::json!({ "testCaseId": "gone" }));
        let r = run_step(&s, None, &mut ctx, None, 0).await.expect("run");
        assert!(!r.passed);
        assert!(r.error.unwrap().contains("not available"));
    }

    #[tokio::test]
    async fn test_case_step_depth_exceeded_fails() {
        let mut ctx: HashMap<String, Value> = HashMap::new();
        let s = step("testCase", "deep", serde_json::json!({
            "testCaseId": "tc",
            "testCaseSteps": [ { "id": "i1", "name": "d", "type": "delay", "delayMs": 1, "config": {} } ]
        }));
        let r = run_step(&s, None, &mut ctx, None, MAX_REFERENCE_DEPTH).await.expect("run");
        assert!(!r.passed);
        assert!(r.error.unwrap().contains("depth exceeded"));
    }

    fn json(v: serde_json::Value) -> serde_json::Value {
        v
    }

    #[test]
    fn build_frontend_request_maps_self_contained_request_step() {
        let step = json(serde_json::json!({
            "id": "s1",
            "name": "GetUser",
            "type": "request",
            "requestBody": "<GetUser/>",
            "endpoint": "http://svc/endpoint",
            "httpMethod": "POST",
            "contentType": "text/xml",
            "headers": { "SOAPAction": "getUser" },
            "extractors": [
                { "id": "e1", "variable": "userId", "type": "xpath", "source": "body", "pattern": "//Id" },
                { "id": "e2", "variable": "session", "type": "header", "source": "header", "headerName": "Set-Cookie" }
            ]
        }));

        let req = build_frontend_request(&step);

        assert_eq!(req.name.as_deref(), Some("GetUser"));
        assert_eq!(req.request.as_deref(), Some("<GetUser/>"));
        assert_eq!(req.endpoint.as_deref(), Some("http://svc/endpoint"));
        assert_eq!(req.method.as_deref(), Some("POST"));
        assert_eq!(req.content_type.as_deref(), Some("text/xml"));
        let headers = req.headers.as_ref().unwrap();
        assert_eq!(headers.get("SOAPAction").map(|s| s.as_str()), Some("getUser"));

        let ex = req.extractors.as_ref().unwrap();
        assert_eq!(ex.len(), 2);
        // XPath extractor: pattern feeds `path`.
        assert_eq!(ex[0].extractor_type.as_deref(), Some("XPath"));
        assert_eq!(ex[0].path.as_deref(), Some("//Id"));
        // Header extractor: headerName feeds `path`.
        assert_eq!(ex[1].extractor_type.as_deref(), Some("Header"));
        assert_eq!(ex[1].path.as_deref(), Some("Set-Cookie"));
    }

    #[test]
    fn build_frontend_request_skips_methodless_named_steps_safely() {
        // A step with neither httpMethod nor method falls back to POST (None method).
        let step = json(serde_json::json!({
            "id": "s2",
            "name": "NoMethod",
            "type": "request",
            "requestBody": "<X/>",
            "endpoint": "http://svc/x",
            "extractors": []
        }));
        let req = build_frontend_request(&step);
        assert_eq!(req.method.as_deref(), None);
        assert_eq!(req.extractors.as_ref().map(|e| e.len()), None);
    }
}
