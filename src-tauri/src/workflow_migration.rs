//! Pure workflow -> test-case migration transforms.
//!
//! This module is Phase 1 of the workflow absorption: it converts the flat
//! `WorkflowStep` shape into the `TestStep` shape, migrates a whole workflow
//! into one (suite, case) pair, rewrites in-store `workflow` test steps into
//! `testCase` steps, and materializes a performance suite's workflow reference
//! into ordinary `requests` entries.
//!
//! Everything here is a pure function over `serde_json::Value`: the stores are
//! opaque JSON and both sides of the migration are untyped documents. The
//! document-level driver and the startup wiring live in Task 2.

use serde_json::{Map, Value};

/// Deterministic suite id for a migrated workflow: `suite-wf-<workflowId>`.
/// Determinism makes the migration idempotent and re-runnable after a crash.
pub fn migrated_suite_id(workflow_id: &str) -> String {
    format!("suite-wf-{}", workflow_id)
}

/// Deterministic case id for a migrated workflow: `case-wf-<workflowId>`.
pub fn migrated_case_id(workflow_id: &str) -> String {
    format!("case-wf-{}", workflow_id)
}

fn get_str<'a>(step: &'a Value, key: &str) -> Option<&'a str> {
    step.get(key)
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
}

fn step_id(step: &Value) -> String {
    step.get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

fn step_name(step: &Value) -> String {
    step.get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

/// Map a flat `WorkflowExtractor` ({ id, variable, type, pattern, source,
/// defaultValue, headerName }) onto the `RequestExtractor` shape the runner
/// deserializes ({ id, variable, type, source, path, defaultValue }).
///
/// Mirrors `workflow::commands::build_frontend_request` exactly so a migrated
/// request step extracts the same variables as the workflow step did:
/// - `type` is lowercased on the wire (`xpath`/`jsonpath`/`regex`/`header`) and
///   the runner matches the capitalized form (`XPath`/`JSONPath`/`Regex`/`Header`),
///   so the case is normalized here.
/// - the extraction target is `path`; for a `Header` extractor the lookup name
///   lives in `headerName` (falling back to `pattern`), else it is `pattern`.
/// - `source` and `defaultValue` have homes on the target and are carried
///   through. `headerName` has no target field: for header extractors its value
///   is folded into `path`, so header extraction still works.
fn map_extractor(e: &Value) -> Option<Value> {
    let variable = e.get("variable").and_then(|v| v.as_str()).unwrap_or("");
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
    };
    let source = e.get("source").and_then(|v| v.as_str());
    let pattern = e.get("pattern").and_then(|v| v.as_str());
    let header_name = e.get("headerName").and_then(|v| v.as_str());
    let path = if extractor_type == "Header" {
        header_name.or(pattern)
    } else {
        pattern
    };

    let mut m = Map::new();
    m.insert(
        "id".to_string(),
        Value::String(
            e.get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        ),
    );
    m.insert("variable".to_string(), Value::String(variable.to_string()));
    m.insert(
        "type".to_string(),
        Value::String(extractor_type.to_string()),
    );
    m.insert(
        "path".to_string(),
        Value::String(path.unwrap_or("").to_string()),
    );
    if let Some(s) = source {
        m.insert("source".to_string(), Value::String(s.to_string()));
    }
    if let Some(d) = e.get("defaultValue").and_then(|v| v.as_str()) {
        m.insert("defaultValue".to_string(), Value::String(d.to_string()));
    }
    Some(Value::Object(m))
}

/// Build the self-contained `ApiRequest` (`config.request`) for a workflow
/// request step. The body/endpoint/method/etc. are read from the step's own
/// customization fields, falling back to a legacy full `request` copy.
fn build_request_config(step: &Value) -> Value {
    let embedded = step.get("request");

    let get = |key: &str| get_str(step, key).map(|s| s.to_string());

    let body = get("requestBody")
        .or_else(|| {
            embedded
                .and_then(|r| r.get("request"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_default();
    let endpoint = get("endpoint").or_else(|| {
        embedded
            .and_then(|r| r.get("endpoint"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    });
    let method = get("httpMethod")
        .or_else(|| get("method"))
        .or_else(|| {
            embedded
                .and_then(|r| r.get("method"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| "POST".to_string());
    let content_type = get("contentType").or_else(|| {
        embedded
            .and_then(|r| r.get("contentType"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    });

    let headers: Value = step
        .get("headers")
        .or_else(|| embedded.and_then(|r| r.get("headers")))
        .cloned()
        .unwrap_or_else(|| Value::Object(Map::new()));

    let extractors: Vec<Value> = step
        .get("extractors")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(map_extractor).collect())
        .unwrap_or_default();

    let mut api = Map::new();
    api.insert("id".to_string(), Value::String(step_id(step)));
    api.insert("name".to_string(), Value::String(step_name(step)));
    api.insert("request".to_string(), Value::String(body));
    if let Some(ep) = endpoint {
        api.insert("endpoint".to_string(), Value::String(ep));
    }
    api.insert("method".to_string(), Value::String(method));
    if let Some(ct) = content_type {
        api.insert("contentType".to_string(), Value::String(ct));
    }
    api.insert("headers".to_string(), headers);
    if !extractors.is_empty() {
        api.insert("extractors".to_string(), Value::Array(extractors));
    }

    api.into()
}

/// Translate one flat `WorkflowStep` into a `TestStep`.
pub fn translate_workflow_step(step: &Value) -> Value {
    let id = step_id(step);
    let name = step_name(step);
    let kind = step.get("type").and_then(|v| v.as_str()).unwrap_or("");

    let (out_type, config): (&str, Value) = match kind {
        "request" => {
            let mut cfg = Map::new();
            cfg.insert("request".to_string(), build_request_config(step));
            if let Some(rid) = step
                .get("request")
                .and_then(|r| r.get("id"))
                .and_then(|v| v.as_str())
            {
                cfg.insert("requestId".to_string(), Value::String(rid.to_string()));
            }
            ("request", Value::Object(cfg))
        }
        "delay" => {
            let mut cfg = Map::new();
            cfg.insert(
                "delayMs".to_string(),
                step.get("delayMs").cloned().unwrap_or(Value::from(0)),
            );
            ("delay", Value::Object(cfg))
        }
        "condition" => {
            let mut cfg = Map::new();
            cfg.insert(
                "condition".to_string(),
                step.get("condition").cloned().unwrap_or(Value::Null),
            );
            ("condition", Value::Object(cfg))
        }
        "loop" => {
            let mut cfg = Map::new();
            cfg.insert(
                "loop".to_string(),
                step.get("loop").cloned().unwrap_or(Value::Null),
            );
            let loop_steps: Vec<Value> = step
                .get("loopSteps")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().map(translate_workflow_step).collect())
                .unwrap_or_default();
            cfg.insert("loopSteps".to_string(), Value::Array(loop_steps));
            ("loop", Value::Object(cfg))
        }
        "script" => {
            let mut cfg = Map::new();
            cfg.insert("scriptName".to_string(), Value::String(name.clone()));
            cfg.insert(
                "scriptContent".to_string(),
                Value::String(get_str(step, "script").unwrap_or("").to_string()),
            );
            ("script", Value::Object(cfg))
        }
        "testCase" => {
            let mut cfg = Map::new();
            cfg.insert(
                "testCaseId".to_string(),
                Value::String(get_str(step, "testCaseId").unwrap_or("").to_string()),
            );
            cfg.insert(
                "testCaseVariables".to_string(),
                step.get("testCaseVariables")
                    .cloned()
                    .unwrap_or_else(|| Value::Object(Map::new())),
            );
            ("testCase", Value::Object(cfg))
        }
        other => {
            // Never silently drop a step. A step with an endpoint is treated as
            // a request; anything else is carried through as a script step.
            if step.get("endpoint").and_then(|v| v.as_str()).is_some() {
                let mut cfg = Map::new();
                cfg.insert("request".to_string(), build_request_config(step));
                ("request", Value::Object(cfg))
            } else {
                log::warn!(
                    "workflow_migration: unknown step type '{}' (id '{}') carried through as a script step",
                    other,
                    id
                );
                let mut cfg = Map::new();
                cfg.insert("scriptName".to_string(), Value::String(name.clone()));
                cfg.insert(
                    "scriptContent".to_string(),
                    Value::String(get_str(step, "script").unwrap_or("").to_string()),
                );
                ("script", Value::Object(cfg))
            }
        }
    };

    let mut out = Map::new();
    out.insert("id".to_string(), Value::String(id));
    out.insert("name".to_string(), Value::String(name));
    out.insert("type".to_string(), Value::String(out_type.to_string()));
    out.insert("config".to_string(), config);
    Value::Object(out)
}

/// Migrate a whole workflow into one suite and one case. The suite's
/// `testCases` array is populated by the caller (the document driver) so the
/// name-collision check can see the existing suites.
pub fn migrate_workflow(workflow: &Value, existing_suites: &[Value]) -> (Value, Value) {
    let wf_id = workflow
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let base_name = workflow
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // Decision 1: one suite per workflow, named after it; on a name collision
    // append " (migrated)".
    let name_taken = existing_suites
        .iter()
        .any(|s| s.get("name").and_then(|v| v.as_str()) == Some(base_name.as_str()));
    let suite_name = if name_taken {
        format!("{} (migrated)", base_name)
    } else {
        base_name.clone()
    };

    let steps: Vec<Value> = workflow
        .get("steps")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().map(translate_workflow_step).collect())
        .unwrap_or_default();

    let variables = workflow
        .get("variables")
        .cloned()
        .unwrap_or_else(|| Value::Object(Map::new()));

    let mut suite = Map::new();
    suite.insert("id".to_string(), Value::String(migrated_suite_id(&wf_id)));
    suite.insert("name".to_string(), Value::String(suite_name));
    if let Some(desc) = workflow.get("description") {
        suite.insert("description".to_string(), desc.clone());
    }
    // Decision 3: the workflow's variables become the migrated suite's
    // variables (one case per suite, so suite scope == workflow scope).
    suite.insert("variables".to_string(), variables);
    suite.insert("testCases".to_string(), Value::Array(Vec::new()));

    let mut case = Map::new();
    case.insert("id".to_string(), Value::String(migrated_case_id(&wf_id)));
    case.insert("name".to_string(), Value::String(base_name));
    case.insert("steps".to_string(), Value::Array(steps));

    (Value::Object(suite), Value::Object(case))
}

/// Rewrite the `workflow` step type inside a case (and inside nested loop
/// bodies) into a `testCase` step pointing at the migrated case id.
pub fn rewrite_case_workflow_steps(case: &Value) -> Value {
    let mut out = case.clone();
    if let Some(map) = out.as_object_mut() {
        if let Some(steps) = map.get_mut("steps").and_then(|v| v.as_array_mut()) {
            for step in steps.iter_mut() {
                rewrite_step_in_place(step);
            }
        }
    }
    out
}

fn rewrite_step_in_place(step: &mut Value) {
    let is_workflow = step.get("type").and_then(|v| v.as_str()) == Some("workflow");

    if is_workflow {
        let wf_id = step
            .get("config")
            .and_then(|c| c.get("workflowId"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let vars = step
            .get("config")
            .and_then(|c| c.get("workflowVariables"))
            .cloned()
            .unwrap_or_else(|| Value::Object(Map::new()));

        if let Some(s) = step.as_object_mut() {
            s.insert("type".to_string(), Value::String("testCase".to_string()));
        }
        let config = step
            .as_object_mut()
            .and_then(|s| s.get_mut("config"))
            .and_then(|c| c.as_object_mut());
        if let Some(cfg) = config {
            cfg.remove("workflowId");
            cfg.remove("workflowVariables");
            cfg.remove("workflowSteps");
            cfg.insert(
                "testCaseId".to_string(),
                Value::String(migrated_case_id(&wf_id)),
            );
            cfg.insert("testCaseVariables".to_string(), vars);
        }
    }

    // Recurse into loop bodies (WorkflowStep shape) — a loop step may itself
    // contain a nested workflow step.
    if let Some(loop_steps) = step
        .get_mut("config")
        .and_then(|c| c.get_mut("loopSteps"))
        .and_then(|v| v.as_array_mut())
    {
        for ls in loop_steps.iter_mut() {
            rewrite_step_in_place(ls);
        }
    }
}

/// Materialize a performance suite's workflow reference into ordinary
/// `requests` entries. Only acts when a `workflow` key is present; the ref is
/// dropped afterwards (the requests list becomes the single source).
pub fn migrate_perf_suite(suite: &Value) -> Value {
    let mut out = suite.clone();
    let wf_ref = match suite.get("workflow") {
        Some(w) if !w.is_null() => w.clone(),
        _ => return out,
    };

    let steps = wf_ref
        .get("steps")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut materialized: Vec<Value> = Vec::new();
    for (idx, step) in steps.iter().enumerate() {
        let kind = step.get("type").and_then(|v| v.as_str()).unwrap_or("");
        if kind != "request" {
            log::warn!(
                "workflow_migration: skipping non-request step '{}' (type '{}') in performance workflow ref",
                step.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                kind
            );
            continue;
        }
        materialized.push(perf_request_from_step(step, idx as u64));
    }

    // Append to any existing requests (an alternative is now additive).
    let mut requests = suite
        .get("requests")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    requests.extend(materialized);

    if let Some(map) = out.as_object_mut() {
        map.remove("workflow");
        map.insert("requests".to_string(), Value::Array(requests));
    }
    out
}

fn perf_request_from_step(step: &Value, idx: u64) -> Value {
    let embedded = step.get("request");
    let body = get_str(step, "requestBody")
        .or_else(|| {
            embedded
                .and_then(|r| r.get("request"))
                .and_then(|v| v.as_str())
        })
        .unwrap_or("")
        .to_string();
    let endpoint = get_str(step, "endpoint")
        .or_else(|| {
            embedded
                .and_then(|r| r.get("endpoint"))
                .and_then(|v| v.as_str())
        })
        .unwrap_or("")
        .to_string();
    let method = get_str(step, "httpMethod")
        .or_else(|| get_str(step, "method"))
        .or_else(|| {
            embedded
                .and_then(|r| r.get("method"))
                .and_then(|v| v.as_str())
        })
        .unwrap_or("POST")
        .to_string();
    let headers = step
        .get("headers")
        .cloned()
        .unwrap_or_else(|| Value::Object(Map::new()));

    // The performance `RequestExtractor` has only { variable, type, path };
    // `source`/`defaultValue`/`headerName` have no home there and the runner
    // matches `type` case-insensitively (`runner.rs`), so `type` is kept raw.
    let extractors: Vec<Value> = step
        .get("extractors")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|e| {
                    let variable = e.get("variable").and_then(|v| v.as_str())?;
                    let extractor_type = e.get("type").and_then(|v| v.as_str()).unwrap_or("xpath");
                    let raw_type = extractor_type.to_lowercase();
                    let header_name = e.get("headerName").and_then(|v| v.as_str());
                    let pattern = e.get("pattern").and_then(|v| v.as_str());
                    let path = if raw_type == "header" {
                        header_name.or(pattern)
                    } else {
                        pattern
                    };
                    let mut m = Map::new();
                    m.insert("variable".to_string(), Value::String(variable.to_string()));
                    m.insert(
                        "type".to_string(),
                        Value::String(extractor_type.to_string()),
                    );
                    m.insert(
                        "path".to_string(),
                        Value::String(path.unwrap_or("").to_string()),
                    );
                    Some(Value::Object(m))
                })
                .collect()
        })
        .unwrap_or_default();

    let order = step.get("order").and_then(|v| v.as_u64()).unwrap_or(idx);

    let mut req = Map::new();
    req.insert("id".to_string(), Value::String(step_id(step)));
    req.insert("name".to_string(), Value::String(step_name(step)));
    req.insert("endpoint".to_string(), Value::String(endpoint));
    req.insert("method".to_string(), Value::String(method));
    req.insert("requestBody".to_string(), Value::String(body));
    req.insert("headers".to_string(), headers);
    req.insert("extractors".to_string(), Value::Array(extractors));
    req.insert("order".to_string(), Value::from(order));
    Value::Object(req)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn wf_step_request(id: &str) -> Value {
        json!({
            "id": id, "name": "Get Token", "type": "request", "order": 0,
            "endpoint": "http://api/token", "method": "POST",
            "requestBody": "<Req/>", "contentType": "text/xml",
            "headers": { "SOAPAction": "urn:token" },
            "extractors": [
                { "id": "e1", "variable": "token", "type": "xpath",
                  "pattern": "//Token", "source": "body" }
            ]
        })
    }

    #[test]
    fn translates_a_request_step_into_a_self_contained_request() {
        let out = translate_workflow_step(&wf_step_request("s1"));
        assert_eq!(out["type"], "request");
        assert_eq!(out["name"], "Get Token");
        let req = &out["config"]["request"];
        assert_eq!(req["endpoint"], "http://api/token");
        assert_eq!(req["request"], "<Req/>");
        assert_eq!(req["method"], "POST");
        assert_eq!(req["headers"]["SOAPAction"], "urn:token");
        // Extractors must survive (variable chaining is the whole point).
        assert_eq!(req["extractors"][0]["variable"], "token");
        assert_eq!(req["extractors"][0]["path"], "//Token");
    }

    #[test]
    fn extractor_type_and_source_survive_the_move() {
        let out = translate_workflow_step(&wf_step_request("s1"));
        let ex = &out["config"]["request"]["extractors"][0];
        // `xpath` (wire) -> `XPath` (what run_extractors matches on).
        assert_eq!(ex["type"], "XPath");
        assert_eq!(ex["source"], "body");
        assert_eq!(ex["id"], "e1");
    }

    #[test]
    fn header_extractor_folds_header_name_into_path() {
        // A header extractor carries its lookup name in `headerName`; the target
        // RequestExtractor has no `headerName`, but the runner resolves a
        // `Header` extractor by `path`, so headerName must land in `path`.
        let step = json!({
            "id": "s2", "name": "Get Cookie", "type": "request",
            "endpoint": "http://api/login",
            "extractors": [
                { "id": "e2", "variable": "session", "type": "header",
                  "source": "header", "headerName": "Set-Cookie",
                  "defaultValue": "none" }
            ]
        });
        let out = translate_workflow_step(&step);
        let ex = &out["config"]["request"]["extractors"][0];
        assert_eq!(ex["type"], "Header");
        assert_eq!(ex["path"], "Set-Cookie");
        assert_eq!(ex["source"], "header");
        assert_eq!(ex["defaultValue"], "none");
    }

    #[test]
    fn translates_delay_condition_loop_and_testcase_steps() {
        let delay = translate_workflow_step(
            &json!({ "id": "d", "name": "D", "type": "delay", "delayMs": 250 }),
        );
        assert_eq!(delay["type"], "delay");
        assert_eq!(delay["config"]["delayMs"], 250);

        let cond = translate_workflow_step(&json!({
            "id": "c", "name": "C", "type": "condition",
            "condition": { "id": "c1", "expression": "{{token}}", "operator": "exists", "expectedValue": "" }
        }));
        assert_eq!(cond["type"], "condition");
        assert_eq!(cond["config"]["condition"]["operator"], "exists");

        let lp = translate_workflow_step(&json!({
            "id": "l", "name": "L", "type": "loop",
            "loop": { "type": "count", "count": 2, "maxIterations": 50, "iteratorVariable": "i" },
            "loopSteps": [ { "id": "b", "name": "B", "type": "delay", "delayMs": 1 } ]
        }));
        assert_eq!(lp["type"], "loop");
        assert_eq!(lp["config"]["loop"]["count"], 2);
        assert_eq!(lp["config"]["loopSteps"][0]["type"], "delay");
    }

    #[test]
    fn translates_a_script_step() {
        let out = translate_workflow_step(&json!({
            "id": "sc", "name": "Calc", "type": "script", "script": "return 1;"
        }));
        assert_eq!(out["type"], "script");
        assert_eq!(out["config"]["scriptContent"], "return 1;");
        assert_eq!(out["config"]["scriptName"], "Calc");
    }

    #[test]
    fn translates_a_workflow_reference_step_into_a_testcase_step() {
        let out = translate_workflow_step(&json!({
            "id": "w", "name": "W", "type": "testCase",
            "testCaseId": "old-inner", "testCaseVariables": { "a": "b" }
        }));
        assert_eq!(out["type"], "testCase");
        assert_eq!(out["config"]["testCaseId"], "old-inner");
        assert_eq!(out["config"]["testCaseVariables"]["a"], "b");
    }

    #[test]
    fn migrates_a_whole_workflow_into_one_suite_with_one_case() {
        let wf = json!({
            "id": "wf-1", "name": "Nightly", "description": "d",
            "variables": { "env": "sit01" },
            "steps": [ wf_step_request("s1"), { "id": "d1", "name": "wait", "type": "delay", "delayMs": 5 } ]
        });
        let (suite, case) = migrate_workflow(&wf, &[]);
        assert_eq!(suite["id"], "suite-wf-wf-1");
        assert_eq!(suite["name"], "Nightly");
        assert_eq!(suite["variables"]["env"], "sit01");
        assert_eq!(case["id"], "case-wf-wf-1");
        assert_eq!(case["name"], "Nightly");
        assert_eq!(case["steps"].as_array().unwrap().len(), 2);
        assert_eq!(case["steps"][0]["type"], "request");
    }

    #[test]
    fn suite_name_collision_gets_a_migrated_suffix() {
        let wf = json!({ "id": "wf-2", "name": "Nightly", "steps": [] });
        let existing = vec![json!({ "id": "s0", "name": "Nightly", "testCases": [] })];
        let (suite, _case) = migrate_workflow(&wf, &existing);
        assert_eq!(suite["name"], "Nightly (migrated)");
    }

    #[test]
    fn rewrites_workflow_steps_inside_existing_test_cases() {
        let case = json!({
            "id": "case-x", "name": "X",
            "steps": [
                { "id": "st1", "name": "call wf", "type": "workflow",
                  "config": { "workflowId": "wf-1", "workflowVariables": { "k": "v" } } }
            ]
        });
        let out = rewrite_case_workflow_steps(&case);
        let s = &out["steps"][0];
        assert_eq!(s["type"], "testCase");
        assert_eq!(s["config"]["testCaseId"], "case-wf-wf-1");
        assert_eq!(s["config"]["testCaseVariables"]["k"], "v");
        assert!(s["config"].get("workflowId").is_none(), "old ref removed");
    }

    #[test]
    fn rewrites_workflow_steps_nested_in_loop_bodies() {
        let case = json!({
            "id": "case-y", "name": "Y",
            "steps": [{
                "id": "lp", "name": "loop", "type": "loop",
                "config": {
                    "loop": { "type": "count", "count": 1, "maxIterations": 2 },
                    "loopSteps": [
                        { "id": "st2", "name": "call wf", "type": "workflow",
                          "config": { "workflowId": "wf-9" } }
                    ]
                }
            }]
        });
        let out = rewrite_case_workflow_steps(&case);
        let s = &out["steps"][0]["config"]["loopSteps"][0];
        assert_eq!(s["type"], "testCase");
        assert_eq!(s["config"]["testCaseId"], "case-wf-wf-9");
    }

    #[test]
    fn materializes_a_perf_suite_workflow_ref_into_requests() {
        let suite = json!({
            "id": "p1", "name": "Perf", "requests": [],
            "workflow": { "workflowId": "wf-1", "workflowName": "Nightly", "steps": [ wf_step_request("s1") ] }
        });
        let out = migrate_perf_suite(&suite);
        assert!(out.get("workflow").is_none(), "workflow ref dropped");
        let reqs = out["requests"].as_array().unwrap();
        assert_eq!(reqs.len(), 1);
        assert_eq!(reqs[0]["endpoint"], "http://api/token");
        assert_eq!(reqs[0]["requestBody"], "<Req/>");
        assert_eq!(reqs[0]["method"], "POST");
        assert_eq!(reqs[0]["extractors"][0]["variable"], "token");
    }

    #[test]
    fn perf_migration_appends_to_existing_requests_and_skips_non_request_steps() {
        let suite = json!({
            "id": "p2", "name": "Perf2",
            "requests": [{ "id": "r0", "name": "Existing", "endpoint": "http://x", "method": "GET", "requestBody": "", "headers": {}, "extractors": [], "order": 0 }],
            "workflow": { "workflowId": "wf-3", "steps": [
                wf_step_request("s1"),
                { "id": "d1", "name": "wait", "type": "delay", "delayMs": 5 }
            ] }
        });
        let out = migrate_perf_suite(&suite);
        assert!(out.get("workflow").is_none());
        let reqs = out["requests"].as_array().unwrap();
        assert_eq!(reqs.len(), 2, "existing request kept + one materialized");
        assert_eq!(reqs[0]["id"], "r0");
        assert_eq!(reqs[1]["id"], "s1");
    }

    #[test]
    fn perf_migration_without_a_ref_is_a_noop() {
        let suite = json!({ "id": "p3", "name": "Perf3", "requests": [] });
        let out = migrate_perf_suite(&suite);
        assert_eq!(out, suite);
    }
}
