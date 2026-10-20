// Utilities module
// Common utility functions for regex extraction, XPath evaluation, wildcards, etc.

/// Run a blocking operation on tokio's blocking pool instead of an async-runtime
/// worker thread.
///
/// Storage code is synchronous (`std::fs`), but the commands that call it are
/// async — so a file operation holds one of the runtime's worker threads for its
/// whole duration. With enough concurrent work (project save + mock server +
/// performance runner) every worker can be held by file I/O. Handing the work to
/// the blocking pool keeps the runtime free.
///
/// Non-async `#[tauri::command]` functions are worse: Tauri runs them on the
/// main thread, so blocking I/O there freezes the UI. Those commands should be
/// async wrappers around this.
pub async fn blocking<T, E>(f: impl FnOnce() -> Result<T, E> + Send + 'static) -> Result<T, E>
where
    T: Send + 'static,
    E: From<String> + Send + 'static,
{
    tokio::task::spawn_blocking(f)
        .await
        .map_err(|e| E::from(format!("Blocking task failed: {}", e)))?
}

pub mod regex_extractor;
pub mod jsonpath_evaluator;
pub mod wildcard_processor;
pub mod xpath_evaluator;
pub mod body_reader;
pub mod config;
pub mod error_detail;
pub mod http;
pub mod proxy_guard;
pub mod template;

pub use regex_extractor::RegexExtractor;
pub use jsonpath_evaluator::JsonPathEvaluator;
pub use wildcard_processor::WildcardProcessor;
pub use xpath_evaluator::XPathEvaluator;
pub use body_reader::{read_body, SpooledBody};
pub use config::resolve_config_dir;
pub use error_detail::{
    classify_error_chain, describe_request_failure, error_kind_label, format_error_chain,
};
pub use http::{emit_traffic_event, match_pattern, CONTENT_TYPE_XML, CONTENT_TYPE_PLAIN};
pub use template::substitute_variables;
