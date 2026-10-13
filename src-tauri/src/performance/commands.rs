use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use once_cell::sync::Lazy;

use crate::http::client::CancelToken;
use crate::performance::runner::execute_request;
use crate::performance::types::{PerformanceResult, PerformanceRun, PerformanceStats, PerformanceSuite};
use crate::settings_manager;
use crate::testing::frontend_runner::run_request_step;
use crate::workflow::commands::build_frontend_request;
use std::time::Instant;

#[derive(Debug, Clone)]
struct PerfRunData {
    updates: Vec<Value>,
    done: bool,
    error: Option<String>,
}

static PERF_RUN_STORE: Lazy<Arc<Mutex<HashMap<String, PerfRunData>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

static ABORT_FLAGS: Lazy<Arc<Mutex<HashMap<String, bool>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

/// M1: per-run cancel tokens so abort_performance_suite can interrupt an
/// in-flight request (not just wait for the next iteration boundary).
static RUN_CANCEL_TOKENS: Lazy<Arc<Mutex<HashMap<String, Arc<CancelToken>>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

fn push_update(run_id: &str, update: Value) {
    let mut store = PERF_RUN_STORE.lock().unwrap();
    if let Some(data) = store.get_mut(run_id) {
        data.updates.push(update);
    }
}

fn mark_done(run_id: &str) {
    let mut store = PERF_RUN_STORE.lock().unwrap();
    if let Some(data) = store.get_mut(run_id) {
        data.done = true;
    }
}

fn is_aborted(run_id: &str) -> bool {
    ABORT_FLAGS
        .lock()
        .unwrap()
        .get(run_id)
        .copied()
        .unwrap_or(false)
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

// ── Request types ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunPerformanceSuiteRequest {
    pub suite_id: String,
    #[serde(default = "default_true")]
    pub stream: bool,
    pub environment: Option<HashMap<String, String>>,
    /// Optional suite payload from the frontend — used as fallback if the suite
    /// is not found in the persisted config (e.g. due to a save race condition).
    pub suite: Option<Value>,
}

fn default_true() -> bool {
    true
}

// ── Response types ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunPerformanceSuiteResponse {
    pub run_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceRunUpdatesResponse {
    pub updates: Vec<Value>,
    pub next_index: usize,
    pub done: bool,
    pub error: Option<String>,
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn run_performance_suite(
    request: RunPerformanceSuiteRequest,
) -> Result<RunPerformanceSuiteResponse, String> {
    log::info!(
        "[run_performance_suite] Starting suite: {}",
        request.suite_id
    );

    // Prefer the suite payload supplied directly by the frontend (avoids save-race issues),
    // then fall back to the persisted config on disk.
    let suite: PerformanceSuite = request
        .suite
        .as_ref()
        .and_then(|v| {
            serde_json::from_value::<PerformanceSuite>(v.clone())
                .map_err(|e| {
                    log::warn!(
                        "[run_performance_suite] Frontend suite deserialize failed: {}",
                        e
                    )
                })
                .ok()
        })
        .or_else(|| {
            // Fallback: load from persisted config
            let config = settings_manager::load_config_internal().ok()?;
            let suites: Vec<PerformanceSuite> = config
                .performance_suites
                .unwrap_or_default()
                .into_iter()
                .filter_map(|v| serde_json::from_value(v).ok())
                .collect();
            suites.into_iter().find(|s| s.id == request.suite_id)
        })
        .ok_or_else(|| format!("Performance suite not found: {}", request.suite_id))?;

    let run_id = format!(
        "perf-{}-{}",
        now_ms(),
        uuid::Uuid::new_v4()
            .to_string()
            .split('-')
            .next()
            .unwrap_or("x")
    );

    PERF_RUN_STORE.lock().unwrap().insert(
        run_id.clone(),
        PerfRunData {
            updates: Vec::new(),
            done: false,
            error: None,
        },
    );
    ABORT_FLAGS
        .lock()
        .unwrap()
        .insert(run_id.clone(), false);
    RUN_CANCEL_TOKENS
        .lock()
        .unwrap()
        .insert(run_id.clone(), Arc::new(CancelToken::new()));

    let run_id_clone = run_id.clone();
    let initial_vars = request.environment.unwrap_or_default();

    let perf_handle = tokio::spawn(async move {
        let suite_id = suite.id.clone();
        let suite_name = suite.name.clone();
        let start_time = now_ms();

        push_update(
            &run_id_clone,
            serde_json::json!({
                "type": "runStarted",
                "runId": run_id_clone,
                "suiteId": suite_id,
                "suiteName": suite_name
            }),
        );

        let total_iterations = suite.iterations + suite.warmup_runs;
        let mut all_results = Vec::new();
        let mut status = "completed".to_string();

        if suite.workflow.is_some() {
            // ── Workflow-backed pass ─────────────────────────────────────────
            // The suite load-tests a referenced workflow's request steps instead
            // of its own `requests` collection. Steps run sequentially per
            // iteration (a workflow is an ordered, variable-sharing flow).
            let wf_ref = suite.workflow.as_ref().unwrap();

            // Resolve the steps: prefer the payload the frontend embedded (so
            // the run is self-contained and not subject to a config save-race),
            // otherwise look the workflow up by id in the persisted config.
            let mut steps: Vec<Value> = wf_ref.steps.clone().unwrap_or_default();
            let mut wf_vars: HashMap<String, String> = wf_ref.variables.clone().unwrap_or_default();
            if steps.is_empty() {
                if let Ok(cfg) = settings_manager::load_config_internal() {
                    if let Some(w) = cfg
                        .workflows
                        .unwrap_or_default()
                        .into_iter()
                        .find(|w| w.get("id").and_then(|v| v.as_str()) == Some(wf_ref.workflow_id.as_str()))
                    {
                        steps = w
                            .get("steps")
                            .and_then(|v| v.as_array())
                            .cloned()
                            .unwrap_or_default();
                        if wf_vars.is_empty() {
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
            }
            if steps.is_empty() {
                log::warn!(
                    "[run_performance_suite] workflow-backed suite '{}' has no resolvable steps (workflowId={}) — emitting an empty run",
                    suite.name,
                    wf_ref.workflow_id
                );
            }

            // Variable context: the run environment as the base, with the
            // workflow's own initial variables layered on top. Persisted across
            // iterations (matches the requests path above).
            let mut variables: HashMap<String, Value> = initial_vars
                .iter()
                .map(|(k, v)| (k.clone(), Value::String(v.clone())))
                .collect();
            for (k, v) in &wf_vars {
                variables.insert(k.clone(), Value::String(v.clone()));
            }

            'wf_outer: for iteration in 0..total_iterations {
                if is_aborted(&run_id_clone) {
                    status = "aborted".to_string();
                    break;
                }

                let is_warmup = iteration < suite.warmup_runs;

                for step in &steps {
                    if is_aborted(&run_id_clone) {
                        status = "aborted".to_string();
                        break 'wf_outer;
                    }

                    let step_type = step
                        .get("type")
                        .and_then(|v| v.as_str())
                        .unwrap_or("request")
                        .to_string();
                    let step_id = step
                        .get("id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let step_name = step
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("step")
                        .to_string();

                    match step_type.as_str() {
                        "request" => {
                            let req = build_frontend_request(step);
                            let start = Instant::now();
                            let outcome = run_request_step(&req, None, &variables, start).await;
                            let perf_res = match outcome {
                                Ok(r) => {
                                    // Chain extracted variables into later steps.
                                    for (k, v) in &r.extracted_variables {
                                        variables.insert(k.clone(), Value::String(v.clone()));
                                    }
                                    let status_code = r.status_code.unwrap_or(0);
                                    PerformanceResult {
                                        request_id: step_id.clone(),
                                        request_name: step_name.clone(),
                                        interface_name: None,
                                        operation_name: None,
                                        iteration,
                                        duration: r.duration_ms as f64,
                                        status: status_code,
                                        success: (200..300).contains(&status_code),
                                        sla_breached: false,
                                        error: r.error.clone(),
                                        extracted_values: if r.extracted_variables.is_empty() {
                                            None
                                        } else {
                                            Some(r.extracted_variables.clone())
                                        },
                                        timestamp: now_ms(),
                                    }
                                }
                                Err(e) => {
                                    log::warn!(
                                        "[run_performance_suite] workflow step '{}' error: {}",
                                        step_name,
                                        e
                                    );
                                    PerformanceResult {
                                        request_id: step_id.clone(),
                                        request_name: step_name.clone(),
                                        interface_name: None,
                                        operation_name: None,
                                        iteration,
                                        duration: start.elapsed().as_millis() as f64,
                                        status: 0,
                                        success: false,
                                        sla_breached: false,
                                        error: Some(e.to_string()),
                                        extracted_values: None,
                                        timestamp: now_ms(),
                                    }
                                }
                            };
                            if !is_warmup {
                                all_results.push(perf_res);
                            }

                            if suite.delay_between_requests > 0 {
                                tokio::time::sleep(tokio::time::Duration::from_millis(
                                    suite.delay_between_requests,
                                ))
                                .await;
                            }
                        }
                        "delay" => {
                            let ms = step
                                .get("delayMs")
                                .and_then(|v| v.as_u64())
                                .unwrap_or(0);
                            tokio::time::sleep(tokio::time::Duration::from_millis(ms)).await;
                        }
                        other => {
                            // condition / loop / script: not executed in the perf
                            // runner (mirrors run_workflow, which skips them).
                            log::warn!(
                                "[run_performance_suite] workflow step '{}' type '{}' not executed in perf run",
                                step_name,
                                other
                            );
                        }
                    }
                }

                push_update(
                    &run_id_clone,
                    serde_json::json!({
                        "type": "iterationComplete",
                        "runId": run_id_clone,
                        "iteration": iteration,
                        "total": total_iterations
                    }),
                );
            }
        } else {
        let mut variables = initial_vars;

        'outer: for iteration in 0..total_iterations {
            if is_aborted(&run_id_clone) {
                status = "aborted".to_string();
                break;
            }

            let is_warmup = iteration < suite.warmup_runs;

            let mut requests = suite.requests.clone();
            requests.sort_by_key(|r| r.order);

            // M1: grab this run's cancel token so a single request can be
            // interrupted mid-flight on abort.
            let run_token = RUN_CANCEL_TOKENS.lock().unwrap().get(&run_id_clone).cloned();

            if suite.concurrency <= 1 {
                for req in &requests {
                    if is_aborted(&run_id_clone) {
                        status = "aborted".to_string();
                        break 'outer;
                    }

                    let result = execute_request(req, iteration, &variables, run_token.clone()).await;

                    if let Some(ref extracted) = result.extracted_values {
                        for (k, v) in extracted {
                            variables.insert(k.clone(), v.clone());
                        }
                    }

                    if !is_warmup {
                        all_results.push(result);
                    }

                    if suite.delay_between_requests > 0 {
                        tokio::time::sleep(tokio::time::Duration::from_millis(
                            suite.delay_between_requests,
                        ))
                        .await;
                    }
                }
            } else {
                let concurrency = suite.concurrency as usize;
                for chunk in requests.chunks(concurrency) {
                    if is_aborted(&run_id_clone) {
                        status = "aborted".to_string();
                        break 'outer;
                    }

                    let vars_arc = Arc::new(tokio::sync::RwLock::new(variables.clone()));
                    let mut handles = Vec::new();
                    for req in chunk {
                        let req = req.clone();
                        let vars = Arc::clone(&vars_arc);
                        let token = run_token.clone();
                        handles.push(tokio::spawn(async move {
                            let snapshot = vars.read().await.clone();
                            let result = execute_request(&req, iteration, &snapshot, token).await;
                            if let Some(ref extracted) = result.extracted_values {
                                let mut shared = vars.write().await;
                                for (k, v) in extracted {
                                    shared.entry(k.clone()).or_insert_with(|| v.clone());
                                }
                            }
                            result
                        }));
                    }

                    for handle in handles {
                        match handle.await {
                            Ok(result) => {
                                if !is_warmup {
                                    all_results.push(result);
                                }
                            }
                            Err(e) => {
                                log::warn!("[run_performance_suite] Task join error: {}", e);
                            }
                        }
                    }

                    // Merge extracted values from concurrent tasks back into outer state.
                    {
                        let merged = vars_arc.read().await.clone();
                        for (k, v) in merged {
                            variables.insert(k, v);
                        }
                    }

                    if suite.delay_between_requests > 0 {
                        tokio::time::sleep(tokio::time::Duration::from_millis(
                            suite.delay_between_requests,
                        ))
                        .await;
                    }
                }
            }

            push_update(
                &run_id_clone,
                serde_json::json!({
                    "type": "iterationComplete",
                    "runId": run_id_clone,
                    "iteration": iteration,
                    "total": total_iterations
                }),
            );
        }

        }

        let end_time = now_ms();
        let summary = PerformanceStats::calculate(&all_results);
        let run = PerformanceRun {
            id: run_id_clone.clone(),
            suite_id,
            suite_name,
            start_time,
            end_time,
            status,
            results: all_results,
            summary,
            environment: None,
        };

        if let Ok(mut config) = settings_manager::load_config_internal() {
            if let Ok(run_value) = serde_json::to_value(&run) {
                let mut history: Vec<Value> = config.performance_history.unwrap_or_default();
                history.push(run_value);
                const MAX_HISTORY: usize = 50;
                if history.len() > MAX_HISTORY {
                    history = history[history.len() - MAX_HISTORY..].to_vec();
                }
                config.performance_history = Some(history);
                let _ = settings_manager::save_config_internal(&config);
            }
        }

        push_update(
            &run_id_clone,
            serde_json::json!({
                "type": "runCompleted",
                "runId": run_id_clone,
                "run": run
            }),
        );

        mark_done(&run_id_clone);
        ABORT_FLAGS.lock().unwrap().remove(&run_id_clone);
        RUN_CANCEL_TOKENS.lock().unwrap().remove(&run_id_clone);

        log::info!(
            "[run_performance_suite] Run {} completed",
            run_id_clone
        );
    });

    tokio::spawn(async move {
        if let Err(e) = perf_handle.await {
            log::error!("[performance] Performance suite runner background task panicked: {:?}", e);
        }
    });

    Ok(RunPerformanceSuiteResponse {
        run_id: Some(run_id),
    })
}

#[tauri::command]
pub async fn get_performance_run_updates(
    run_id: String,
    from_index: usize,
) -> Result<PerformanceRunUpdatesResponse, String> {
    let mut store = PERF_RUN_STORE.lock().unwrap();
    if let Some(data) = store.get(&run_id) {
        // Fix: bound-safe indexing to prevent panic when from_index exceeds updates length.
        let safe_index = from_index.min(data.updates.len());
        let updates = data.updates[safe_index..].to_vec();
        let next_index = safe_index + updates.len();
        let done = data.done;
        let error = data.error.clone();
        // Fix: clean up completed runs from the store after the frontend has
        // consumed all updates, preventing unbounded memory growth.
        if done && next_index >= data.updates.len() {
            store.remove(&run_id);
        }
        Ok(PerformanceRunUpdatesResponse {
            updates,
            next_index,
            done,
            error,
        })
    } else {
        Ok(PerformanceRunUpdatesResponse {
            updates: vec![],
            next_index: from_index,
            done: true,
            error: Some(format!("Run not found: {}", run_id)),
        })
    }
}

#[tauri::command]
pub async fn abort_performance_suite(run_id: String) -> Result<(), String> {
    log::info!("[abort_performance_suite] Aborting run: {}", run_id);
    // M1: fire the cancel token so any in-flight request aborts immediately,
    // not just at the next iteration boundary.
    {
        let tokens = RUN_CANCEL_TOKENS.lock().unwrap();
        if !run_id.is_empty() {
            if let Some(token) = tokens.get(&run_id) {
                token.cancel();
            }
        } else {
            for token in tokens.values() {
                token.cancel();
            }
        }
    }
    let mut flags = ABORT_FLAGS.lock().unwrap();
    if run_id.is_empty() {
        for val in flags.values_mut() {
            *val = true;
        }
    } else {
        flags.insert(run_id, true);
    }
    Ok(())
}
