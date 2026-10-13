use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Deserialize a JSON null or missing value as an empty Vec.
fn null_as_empty_vec<'de, D, T>(deserializer: D) -> Result<Vec<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: serde::Deserialize<'de>,
{
    Ok(Option::<Vec<T>>::deserialize(deserializer)?.unwrap_or_default())
}

/// Deserialize a JSON null or missing value as an empty HashMap.
fn null_as_empty_map<'de, D>(deserializer: D) -> Result<HashMap<String, String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    Ok(Option::<HashMap<String, String>>::deserialize(deserializer)?.unwrap_or_default())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceSuite {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default, deserialize_with = "null_as_empty_vec")]
    pub requests: Vec<PerformanceRequest>,
    #[serde(default = "default_iterations")]
    pub iterations: u32,
    #[serde(default)]
    pub delay_between_requests: u64,
    #[serde(default)]
    pub warmup_runs: u32,
    #[serde(default = "default_concurrency")]
    pub concurrency: u32,
    /// When set, the suite load-tests this workflow's request steps instead of
    /// its own `requests` collection (an alternative, not additive). The
    /// frontend resolves the workflow and embeds its steps/variables so the
    /// runner is self-contained; otherwise the runner falls back to a config
    /// lookup by `workflow_id`.
    #[serde(default)]
    pub workflow: Option<PerformanceWorkflowRef>,
}

/// A workflow referenced by a performance suite. `steps`/`variables` are the
/// optional embedded payload the frontend attaches (the flat `Workflow` model
/// from the webview) so the run does not depend on the persisted config being
/// in sync; when absent the runner resolves the workflow by `workflow_id`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceWorkflowRef {
    pub workflow_id: String,
    #[serde(default)]
    pub workflow_name: Option<String>,
    #[serde(default)]
    pub steps: Option<Vec<serde_json::Value>>,
    #[serde(default)]
    pub variables: Option<HashMap<String, String>>,
}

fn default_iterations() -> u32 {
    1
}
fn default_concurrency() -> u32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceRequest {
    pub id: String,
    pub name: String,
    pub endpoint: String,
    #[serde(default = "default_method")]
    pub method: String,
    pub soap_action: Option<String>,
    #[serde(default)]
    pub request_body: String,
    #[serde(default, deserialize_with = "null_as_empty_map")]
    pub headers: HashMap<String, String>,
    #[serde(default, deserialize_with = "null_as_empty_vec")]
    pub extractors: Vec<RequestExtractor>,
    pub sla_threshold: Option<f64>,
    #[serde(default)]
    pub order: u32,
}

fn default_method() -> String {
    "POST".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestExtractor {
    pub variable: String,
    #[serde(rename = "type")]
    pub extractor_type: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceResult {
    pub request_id: String,
    pub request_name: String,
    pub interface_name: Option<String>,
    pub operation_name: Option<String>,
    pub iteration: u32,
    pub duration: f64,
    pub status: u16,
    pub success: bool,
    pub sla_breached: bool,
    pub error: Option<String>,
    pub extracted_values: Option<HashMap<String, String>>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceStats {
    pub total_requests: usize,
    pub success_count: usize,
    pub failure_count: usize,
    pub success_rate: f64,
    pub avg_response_time: f64,
    pub min_response_time: f64,
    pub max_response_time: f64,
    pub p50: f64,
    pub p95: f64,
    pub p99: f64,
    pub sla_breach_count: usize,
    pub total_duration: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceRun {
    pub id: String,
    pub suite_id: String,
    pub suite_name: String,
    pub start_time: u64,
    pub end_time: u64,
    pub status: String,
    pub results: Vec<PerformanceResult>,
    pub summary: PerformanceStats,
    pub environment: Option<String>,
}

impl PerformanceStats {
    pub fn calculate(results: &[PerformanceResult]) -> Self {
        if results.is_empty() {
            return Self {
                total_requests: 0,
                success_count: 0,
                failure_count: 0,
                success_rate: 0.0,
                avg_response_time: 0.0,
                min_response_time: 0.0,
                max_response_time: 0.0,
                p50: 0.0,
                p95: 0.0,
                p99: 0.0,
                sla_breach_count: 0,
                total_duration: 0.0,
            };
        }

        let mut durations: Vec<f64> = results.iter().map(|r| r.duration).collect();
        durations.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let success_count = results.iter().filter(|r| r.success).count();
        let sla_breach_count = results.iter().filter(|r| r.sla_breached).count();
        let total = results.len();

        let avg = durations.iter().sum::<f64>() / total as f64;
        let total_duration = results
            .last()
            .map(|r| r.timestamp)
            .unwrap_or(0)
            .saturating_sub(results.first().map(|r| r.timestamp).unwrap_or(0))
            as f64;

        Self {
            total_requests: total,
            success_count,
            failure_count: total - success_count,
            success_rate: success_count as f64 / total as f64,
            avg_response_time: avg,
            min_response_time: durations[0],
            max_response_time: *durations.last().unwrap(),
            p50: percentile(&durations, 50.0),
            p95: percentile(&durations, 95.0),
            p99: percentile(&durations, 99.0),
            sla_breach_count,
            total_duration,
        }
    }
}

pub fn percentile(sorted: &[f64], p: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let idx = (p / 100.0) * (sorted.len() - 1) as f64;
    let lower = idx.floor() as usize;
    let upper = idx.ceil() as usize;
    if lower == upper {
        return sorted[lower];
    }
    sorted[lower] * (upper as f64 - idx) + sorted[upper] * (idx - lower as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A suite JSON with a `workflow` ref (as the webview sends it) must
    /// deserialize with the ref populated — this is what the save/load round
    /// trip relies on.
    #[test]
    fn suite_with_workflow_ref_deserializes() {
        let json = r#"{
            "id": "perf-suite-1",
            "name": "Login load",
            "requests": [],
            "iterations": 20,
            "warmupRuns": 2,
            "concurrency": 1,
            "workflow": {
                "workflowId": "wf-abc",
                "workflowName": "Login flow",
                "steps": [
                    { "id": "s1", "name": "Login", "type": "request", "endpoint": "http://x/login", "requestBody": "<Login/>" },
                    { "id": "s2", "name": "Fetch", "type": "request", "endpoint": "http://x/data", "requestBody": "<Data/>" }
                ],
                "variables": { "base": "http://x" }
            }
        }"#;
        let suite: PerformanceSuite = serde_json::from_str(json).unwrap();
        assert_eq!(suite.id, "perf-suite-1");
        assert!(suite.requests.is_empty());
        let wf = suite.workflow.expect("workflow ref present");
        assert_eq!(wf.workflow_id, "wf-abc");
        assert_eq!(wf.workflow_name.as_deref(), Some("Login flow"));
        assert_eq!(wf.steps.as_ref().map(|s| s.len()), Some(2));
        assert_eq!(wf.variables.as_ref().and_then(|m| m.get("base")), Some(&"http://x".to_string()));
    }

    /// A legacy suite JSON without a `workflow` field must still deserialize,
    /// with `workflow` defaulting to `None` (backward compatibility).
    #[test]
    fn suite_without_workflow_ref_defaults_to_none() {
        let json = r#"{
            "id": "perf-suite-legacy",
            "name": "Legacy",
            "requests": [{ "id": "r1", "name": "R", "endpoint": "http://e", "requestBody": "<x/>", "order": 0 }],
            "iterations": 5
        }"#;
        let suite: PerformanceSuite = serde_json::from_str(json).unwrap();
        assert!(suite.workflow.is_none());
        assert_eq!(suite.requests.len(), 1);
        assert_eq!(suite.iterations, 5);
    }

    /// The ref round-trips through serialization (so config.jsonc keeps it).
    #[test]
    fn workflow_ref_round_trips() {
        let original: PerformanceSuite = serde_json::from_value(serde_json::json!({
            "id": "s", "name": "N", "requests": [],
            "workflow": { "workflowId": "wf-1", "workflowName": "W", "steps": [], "variables": {} }
        })).unwrap();
        let value = serde_json::to_value(&original).unwrap();
        let back: PerformanceSuite = serde_json::from_value(value).unwrap();
        assert_eq!(back.workflow.as_ref().unwrap().workflow_id, "wf-1");
    }
}
