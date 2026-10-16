/// Tauri Commands for Testing
/// 
/// Frontend-facing commands for test execution
use serde::{Deserialize, Serialize};
use crate::testing::frontend_types::{FrontendTestCase, FrontendTestSuite};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;

/// Request accepted from the webview for running a single test case.
/// Field names match the TypeScript/camelCase format sent by bridge.ts.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunTestCaseRequest {
    pub test_case: FrontendTestCase,
    pub variables: Option<HashMap<String, String>>,
    #[serde(default)]
    pub stream: bool,
    pub fallback_endpoint: Option<String>,
}

/// Response for a streaming run — returns a run ID for polling.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunTestCaseResponse {
    pub run_id: Option<String>,
    pub passed: Option<bool>,
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RunTestSuiteRequest {
    pub test_suite: FrontendTestSuite,
    pub variables: Option<HashMap<String, String>>,
    #[serde(default)]
    pub stream: bool,
}

#[derive(Debug, Serialize)]
pub struct RunTestSuiteResponse {
    pub run_id: Option<String>,
    pub passed: Option<bool>,
    pub results: Option<Vec<TestCaseRunResult>>,
}

/// Sync-mode per-case result. Step results are the frontend runner's
/// execution results (serialized with the step name) — the sync path is not
/// used by the webview (it always streams), so this shape is internal.
#[derive(Debug, Serialize, Clone)]
pub struct TestCaseRunResult {
    pub test_case_name: String,
    pub passed: bool,
    pub step_results: Vec<serde_json::Value>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone)]
struct TestRunData {
    updates: Vec<serde_json::Value>,
    done: bool,
    error: Option<String>,
}

// Global test run store for streaming updates
static TEST_RUN_STORE: Lazy<Arc<Mutex<HashMap<String, TestRunData>>>> = 
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

/// Execute a test case.
///
/// When `stream = true` (the default from the webview), the command spawns a
/// background task and immediately returns a `run_id` that the frontend uses to
/// poll `get_test_run_updates` for per-step progress events.
#[tauri::command]
pub async fn run_test_case(request: RunTestCaseRequest) -> Result<RunTestCaseResponse, String> {
    log::info!("[run_test_case] Starting: '{}' (stream={})", request.test_case.name, request.stream);

    if request.stream {
        // --- Streaming mode ---
        let run_id = format!(
            "tc-{}-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis(),
            uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("")
        );

        TEST_RUN_STORE.lock().unwrap().insert(
            run_id.clone(),
            TestRunData { updates: Vec::new(), done: false, error: None },
        );

        let run_id_clone = run_id.clone();
        let test_case = request.test_case;
        let fallback_endpoint = request.fallback_endpoint;
        let mut initial_vars: HashMap<String, serde_json::Value> = request
            .variables
            .unwrap_or_default()
            .into_iter()
            .map(|(k, v)| (k, serde_json::Value::String(v)))
            .collect();
        // Case-level variables overlay the caller's merged map (the case's
        // own scope wins over suite / environment variables).
        if let Some(vars) = &test_case.variables {
            for (k, v) in vars {
                initial_vars.insert(k.clone(), serde_json::Value::String(v.clone()));
            }
        }

        let tc_handle = tokio::spawn(async move {
            use crate::testing::frontend_runner::run_step;

            let case_id = test_case.id.clone();

            // Emit testCaseStart
            push_update(&run_id_clone, serde_json::json!({
                "type": "testCaseStart",
                "id": case_id
            }));

            let mut context = initial_vars;
            let mut all_passed = true;

            for step in &test_case.steps {
                let step_id = step.id.clone();

                // Emit stepStart
                push_update(&run_id_clone, serde_json::json!({
                    "type": "stepStart",
                    "caseId": case_id,
                    "stepId": step_id
                }));

                match run_step(step, fallback_endpoint.as_deref(), &mut context, Some(&mut |update: serde_json::Value| {
                    // Sub-step events (workflowStep*) emitted from inside a
                    // loop body don't carry the case id — stamp it on so the
                    // webview can nest them under the right case.
                    let mut u = update;
                    if let Some(obj) = u.as_object_mut() {
                        if !obj.contains_key("caseId") {
                            obj.insert("caseId".to_string(), serde_json::json!(&case_id));
                        }
                    }
                    push_update(&run_id_clone, u);
                }), 0).await {
                    Ok(result) => {
                        // Merge extracted variables into context for next steps
                        for (k, v) in &result.extracted_variables {
                            context.insert(k.clone(), serde_json::Value::String(v.clone()));
                        }

                        let update_type = if result.passed { "stepPass" } else { "stepFail" };
                        if !result.passed {
                            all_passed = false;
                        }

                        push_update(&run_id_clone, serde_json::json!({
                            "type": update_type,
                            "caseId": case_id,
                            "stepId": step_id,
                            "response": {
                                "rawResponse": result.response_body,
                                "duration": result.duration_ms,
                                "statusCode": result.status_code
                            },
                            "assertionResults": result.assertion_results,
                            "error": result.error
                        }));

                        if !result.passed {
                            break; // Stop on first failure
                        }
                    }
                    Err(e) => {
                        all_passed = false;
                        push_update(&run_id_clone, serde_json::json!({
                            "type": "stepFail",
                            "caseId": case_id,
                            "stepId": step_id,
                            "error": e.to_string()
                        }));
                        break;
                    }
                }
            }

            log::info!("[run_test_case] '{}' {} (streamed)",
                test_case.name, if all_passed { "PASSED" } else { "FAILED" });

            mark_done(&run_id_clone);
        });
        tokio::spawn(async move {
            if let Err(e) = tc_handle.await {
                log::error!("[testing] Test case runner background task panicked: {:?}", e);
            }
        });

        Ok(RunTestCaseResponse {
            run_id: Some(run_id),
            passed: None,
            duration_ms: None,
        })
    } else {
        // --- Synchronous mode (not used by webview but kept for completeness) ---
        use crate::testing::frontend_runner::run_step;

        let start = std::time::Instant::now();
        let mut context: HashMap<String, serde_json::Value> = request
            .variables
            .unwrap_or_default()
            .into_iter()
            .map(|(k, v)| (k, serde_json::Value::String(v)))
            .collect();
        if let Some(vars) = &request.test_case.variables {
            for (k, v) in vars {
                context.insert(k.clone(), serde_json::Value::String(v.clone()));
            }
        }

        let mut all_passed = true;
        for step in &request.test_case.steps {
            // Sync mode has no run id to stream into — no emitter.
            match run_step(step, request.fallback_endpoint.as_deref(), &mut context, None, 0).await {
                Ok(result) => {
                    for (k, v) in &result.extracted_variables {
                        context.insert(k.clone(), serde_json::Value::String(v.clone()));
                    }
                    if !result.passed {
                        all_passed = false;
                        break;
                    }
                }
                Err(e) => {
                    return Err(format!("Step failed: {}", e));
                }
            }
        }

        let duration_ms = start.elapsed().as_millis() as u64;
        log::info!("[run_test_case] '{}' {} ({}ms)",
            request.test_case.name,
            if all_passed { "PASSED" } else { "FAILED" },
            duration_ms);

        Ok(RunTestCaseResponse {
            run_id: None,
            passed: Some(all_passed),
            duration_ms: Some(duration_ms),
        })
    }
}

fn push_update(run_id: &str, update: serde_json::Value) {
    if let Ok(mut store) = TEST_RUN_STORE.lock() {
        if let Some(run) = store.get_mut(run_id) {
            run.updates.push(update);
        }
    }
}

fn mark_done(run_id: &str) {
    if let Ok(mut store) = TEST_RUN_STORE.lock() {
        if let Some(run) = store.get_mut(run_id) {
            run.done = true;
        }
    }
}

/// Execute a test suite (multiple test cases)
#[tauri::command]
pub async fn run_test_suite(request: RunTestSuiteRequest) -> Result<RunTestSuiteResponse, String> {
    log::info!("Running test suite: {} ({} test cases, stream={})", 
        request.test_suite.name, 
        request.test_suite.test_cases.len(),
        request.stream
    );
    
    if request.stream {
        // Streaming mode - run in background and return run ID
        let run_id = format!("run-{}-{}", 
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis(),
            uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("")
        );
        
        let run_data = TestRunData {
            updates: Vec::new(),
            done: false,
            error: None,
        };
        
        TEST_RUN_STORE.lock().unwrap().insert(run_id.clone(), run_data);
        
        let run_id_clone = run_id.clone();
        let suite = request.test_suite;
        // Base variable map for EVERY case (environment + suite variables,
        // already merged by the webview). Each case starts a fresh context
        // seeded here plus its own case-level variables on top (case wins),
        // so variables extracted by one case's steps never leak into the next.
        let base_vars: HashMap<String, String> = request.variables.unwrap_or_default();

        // Spawn background task
        let ts_handle = tokio::spawn(async move {
            use crate::testing::frontend_runner::{run_step, merge_case_variables};

            for test_case in &suite.test_cases {
                let case_id = test_case.id.clone();
                let case_name = test_case.name.clone();

                // Emit testCaseStart (same event vocabulary as run_test_case,
                // so the webview's TestRunnerContext + rail live-status
                // handling work unchanged for suite runs).
                push_update(&run_id_clone, serde_json::json!({
                    "type": "testCaseStart",
                    "id": case_id,
                    "name": case_name
                }));

                // Per-case endpoint fallback: the first request step's
                // endpoint (mirrors the webview's RunTestCase fallbackEndpoint).
                let fallback_endpoint = test_case.steps.iter()
                    .find_map(|s| s.config.request.as_ref().and_then(|r| r.endpoint.clone()));

                let mut context = merge_case_variables(&base_vars, test_case.variables.as_ref());
                let mut all_passed = true;

                for step in &test_case.steps {
                    let step_id = step.id.clone();

                    push_update(&run_id_clone, serde_json::json!({
                        "type": "stepStart",
                        "caseId": case_id,
                        "stepId": step_id
                    }));

                    match run_step(step, fallback_endpoint.as_deref(), &mut context, Some(&mut |update: serde_json::Value| {
                        // Sub-step events (workflowStep*) emitted from inside a
                        // loop body don't carry the case id — stamp it on so
                        // the webview can nest them under the right case.
                        let mut u = update;
                        if let Some(obj) = u.as_object_mut() {
                            if !obj.contains_key("caseId") {
                                obj.insert("caseId".to_string(), serde_json::json!(&case_id));
                            }
                        }
                        push_update(&run_id_clone, u);
                    }), 0).await {
                        Ok(result) => {
                            // Merge extracted variables into this case's
                            // context for the remaining steps.
                            for (k, v) in &result.extracted_variables {
                                context.insert(k.clone(), serde_json::Value::String(v.clone()));
                            }

                            let update_type = if result.passed { "stepPass" } else { "stepFail" };
                            if !result.passed {
                                all_passed = false;
                            }

                            push_update(&run_id_clone, serde_json::json!({
                                "type": update_type,
                                "caseId": case_id,
                                "stepId": step_id,
                                "response": {
                                    "rawResponse": result.response_body,
                                    "duration": result.duration_ms,
                                    "statusCode": result.status_code
                                },
                                "assertionResults": result.assertion_results,
                                "error": result.error
                            }));

                            if !result.passed {
                                break; // Stop this case on first failed step
                            }
                        }
                        Err(e) => {
                            all_passed = false;
                            push_update(&run_id_clone, serde_json::json!({
                                "type": "stepFail",
                                "caseId": case_id,
                                "stepId": step_id,
                                "error": e.to_string()
                            }));
                            break;
                        }
                    }
                }

                // Case-level completion (the previous suite stream emitted this
                // after each case; kept so case-level pass/fail stays visible).
                push_update(&run_id_clone, serde_json::json!({
                    "type": "testCaseComplete",
                    "caseId": case_id,
                    "testCaseName": case_name,
                    "passed": all_passed
                }));
            }

            mark_done(&run_id_clone);

            log::info!("Test suite completed (streamed): {}", suite.name);
        });
        tokio::spawn(async move {
            if let Err(e) = ts_handle.await {
                log::error!("[testing] Test suite runner background task panicked: {:?}", e);
            }
        });

        Ok(RunTestSuiteResponse {
            run_id: Some(run_id),
            passed: None,
            results: None,
        })
    } else {
        // Synchronous mode (not used by the webview but kept for completeness)
        use crate::testing::frontend_runner::{run_step, merge_case_variables};

        let mut results = Vec::new();
        let mut all_passed = true;

        let base_vars: HashMap<String, String> = request.variables.clone().unwrap_or_default();

        for test_case in &request.test_suite.test_cases {
            let start = std::time::Instant::now();

            let fallback_endpoint = test_case.steps.iter()
                .find_map(|s| s.config.request.as_ref().and_then(|r| r.endpoint.clone()));

            let mut context = merge_case_variables(&base_vars, test_case.variables.as_ref());
            let mut case_passed = true;
            let mut step_results: Vec<serde_json::Value> = Vec::new();
            let mut case_error: Option<String> = None;

            for step in &test_case.steps {
                match run_step(step, fallback_endpoint.as_deref(), &mut context, None, 0).await {
                    Ok(result) => {
                        for (k, v) in &result.extracted_variables {
                            context.insert(k.clone(), serde_json::Value::String(v.clone()));
                        }
                        step_results.push(serde_json::json!({
                            "stepName": step.name,
                            "passed": result.passed,
                            "durationMs": result.duration_ms,
                            "statusCode": result.status_code,
                            "assertionResults": result.assertion_results,
                            "error": result.error
                        }));
                        if !result.passed {
                            case_passed = false;
                            break; // Stop this case on first failed step
                        }
                    }
                    Err(e) => {
                        case_passed = false;
                        case_error = Some(e.to_string());
                        break;
                    }
                }
            }

            // A step execution error (not a failed assertion) aborts the
            // suite, mirroring the previous TestRunner behavior.
            if let Some(e) = case_error {
                log::error!("Test case {} failed: {}", test_case.name, e);
                return Err(format!("Test case {} failed: {}", test_case.name, e));
            }

            let duration_ms = start.elapsed().as_millis() as u64;
            results.push(TestCaseRunResult {
                test_case_name: test_case.name.clone(),
                passed: case_passed,
                step_results,
                duration_ms,
            });

            if !case_passed {
                all_passed = false;
            }
        }

        log::info!("Test suite completed: {} ({})",
            request.test_suite.name,
            if all_passed { "PASSED" } else { "FAILED" }
        );

        Ok(RunTestSuiteResponse {
            run_id: None,
            passed: Some(all_passed),
            results: Some(results),
        })
    }
}

/// Get test run updates (for streaming mode)
#[tauri::command]
pub async fn get_test_run_updates(
    run_id: String,
    from_index: Option<usize>,
) -> Result<TestRunUpdatesResponse, String> {
    let from_idx = from_index.unwrap_or(0);
    
    let mut store = TEST_RUN_STORE.lock().unwrap();
    
    if let Some(run) = store.get(&run_id) {
        let safe_index = from_idx.min(run.updates.len());
        let updates: Vec<serde_json::Value> = run.updates[safe_index..].to_vec();
        let next_index = safe_index + updates.len();
        let done = run.done;
        let error = run.error.clone();
        
        // Clean up completed runs
        if done && next_index >= run.updates.len() {
            store.remove(&run_id);
        }
        
        Ok(TestRunUpdatesResponse {
            updates,
            next_index,
            done,
            error,
        })
    } else {
        Ok(TestRunUpdatesResponse {
            updates: Vec::new(),
            next_index: from_idx,
            done: true,
            error: Some("Run not found".to_string()),
        })
    }
}

#[derive(Debug, Serialize)]
pub struct TestRunUpdatesResponse {
    pub updates: Vec<serde_json::Value>,
    pub next_index: usize,
    pub done: bool,
    pub error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::frontend_types::{FrontendStepConfig, FrontendTestStep};

    fn delay_step(id: &str, ms: u64) -> FrontendTestStep {
        FrontendTestStep {
            id: id.to_string(),
            name: format!("step {id}"),
            step_type: "delay".to_string(),
            config: FrontendStepConfig {
                delay_ms: Some(ms),
                ..Default::default()
            },
        }
    }

    /// Poll a streaming run until it reports done, collecting all updates.
    async fn collect_run_updates(run_id: String) -> (Vec<serde_json::Value>, bool) {
        let mut from_index = 0usize;
        let mut updates: Vec<serde_json::Value> = Vec::new();
        for _ in 0..500 {
            let batch = get_test_run_updates(run_id.clone(), Some(from_index))
                .await
                .expect("updates");
            updates.extend(batch.updates.iter().cloned());
            from_index = batch.next_index;
            if batch.done && batch.next_index >= updates.len() {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
        let drained = from_index >= updates.len();
        (updates, drained)
    }

    #[tokio::test]
    async fn run_test_suite_streams_per_case_events_in_order() {
        let suite = FrontendTestSuite {
            id: "suite-1".to_string(),
            name: "Suite".to_string(),
            test_cases: vec![
                FrontendTestCase {
                    id: "case-1".to_string(),
                    name: "Case 1".to_string(),
                    steps: vec![delay_step("s1", 1)],
                    variables: None,
                },
                FrontendTestCase {
                    id: "case-2".to_string(),
                    name: "Case 2".to_string(),
                    steps: vec![delay_step("s2", 1), delay_step("s3", 1)],
                    variables: None,
                },
            ],
        };

        let response = run_test_suite(RunTestSuiteRequest {
            test_suite: suite,
            variables: Some(
                [("suiteVar".to_string(), "sv".to_string())]
                    .into_iter()
                    .collect(),
            ),
            stream: true,
        })
        .await
        .expect("suite run");

        let run_id = response.run_id.expect("streaming run id");
        let (updates, drained) = collect_run_updates(run_id).await;
        assert!(drained, "run did not complete");

        // Same event vocabulary as run_test_case: per case a testCaseStart,
        // then stepStart/stepPass per step, then a testCaseComplete.
        let types: Vec<&str> = updates
            .iter()
            .map(|u| u["type"].as_str().unwrap_or_default())
            .collect();
        assert_eq!(
            types,
            vec![
                "testCaseStart", "stepStart", "stepPass", "testCaseComplete",
                "testCaseStart", "stepStart", "stepPass", "stepStart", "stepPass", "testCaseComplete"
            ]
        );

        // Step events carry the case id, and the two cases keep their
        // distinct caseIds.
        let case_ids: Vec<String> = updates
            .iter()
            .filter(|u| u["type"] == "stepStart")
            .map(|u| u["caseId"].as_str().unwrap_or_default().to_string())
            .collect();
        assert_eq!(case_ids, vec!["case-1".to_string(), "case-2".to_string(), "case-2".to_string()]);

        let completes: Vec<bool> = updates
            .iter()
            .filter(|u| u["type"] == "testCaseComplete")
            .map(|u| u["passed"].as_bool().unwrap_or(false))
            .collect();
        assert_eq!(completes, vec![true, true]);
    }

    fn condition_step(id: &str, expression: &str, expected: &str) -> FrontendTestStep {
        FrontendTestStep {
            id: id.to_string(),
            name: format!("step {id}"),
            step_type: "condition".to_string(),
            config: FrontendStepConfig {
                condition: Some(serde_json::json!({
                    "id": format!("cond-{id}"),
                    "expression": expression,
                    "operator": "equals",
                    "expectedValue": expected,
                })),
                ..Default::default()
            },
        }
    }

    /// The user's core requirement, end to end through the streaming path the
    /// webview actually consumes: a FALSE condition FAILS at that step, the run
    /// stops there, later steps never execute, and the case is reported failed.
    #[tokio::test]
    async fn run_test_case_stops_and_fails_on_false_condition() {
        let case = FrontendTestCase {
            id: "case-cond".to_string(),
            name: "Case Cond".to_string(),
            steps: vec![
                delay_step("s1", 1),
                condition_step("s2", "{{flag}}", "yes"),
                delay_step("s3", 1),
            ],
            variables: None,
        };

        let response = run_test_case(RunTestCaseRequest {
            test_case: case,
            variables: None,
            stream: true,
            fallback_endpoint: None,
        })
        .await
        .expect("case run");

        let run_id = response.run_id.expect("streaming run id");
        let (updates, drained) = collect_run_updates(run_id).await;
        assert!(drained, "run did not complete");

        let types: Vec<&str> = updates
            .iter()
            .map(|u| u["type"].as_str().unwrap_or_default())
            .collect();
        // NOTE: the single-case stream emits no `testCaseComplete` (that event is
        // suite-level, per case) — `done` on the poll response ends the run.
        assert_eq!(
            types,
            vec![
                "testCaseStart",
                "stepStart",
                "stepPass",
                "stepStart",
                "stepFail"
            ],
            "the run must stop at the failed condition — step s3 must never start"
        );

        let failure = updates
            .iter()
            .find(|u| u["type"] == "stepFail")
            .expect("stepFail event");
        assert_eq!(failure["stepId"], "s2");
        assert!(failure["error"]
            .as_str()
            .unwrap_or_default()
            .contains("condition failed"));
        // No event may carry the third step's id: it never ran.
        assert!(
            !updates
                .iter()
                .any(|u| u["stepId"].as_str() == Some("s3")),
            "step s3 must not be executed after a failed condition"
        );
    }

    /// A TRUE condition passes and the run continues (guards against
    /// over-eager stopping).
    #[tokio::test]
    async fn run_test_case_continues_on_true_condition() {
        let case = FrontendTestCase {
            id: "case-ok".to_string(),
            name: "Case Cond OK".to_string(),
            steps: vec![
                delay_step("s1", 1),
                condition_step("s2", "{{flag}}", "yes"),
                delay_step("s3", 1),
            ],
            variables: Some(
                [("flag".to_string(), "yes".to_string())]
                    .into_iter()
                    .collect(),
            ),
        };

        let response = run_test_case(RunTestCaseRequest {
            test_case: case,
            variables: None,
            stream: true,
            fallback_endpoint: None,
        })
        .await
        .expect("case run");

        let run_id = response.run_id.expect("streaming run id");
        let (updates, drained) = collect_run_updates(run_id).await;
        assert!(drained, "run did not complete");

        let types: Vec<&str> = updates
            .iter()
            .map(|u| u["type"].as_str().unwrap_or_default())
            .collect();
        assert_eq!(
            types,
            vec![
                "testCaseStart",
                "stepStart",
                "stepPass",
                "stepStart",
                "stepPass",
                "stepStart",
                "stepPass"
            ],
            "a true condition passes and the run continues to the last step"
        );
        assert!(
            updates.iter().any(|u| u["stepId"].as_str() == Some("s3")),
            "step s3 must run after a passing condition"
        );
    }
}
