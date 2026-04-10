/// Shared HTTP utilities for proxy and mock servers.

use tauri::{AppHandle, Emitter};
use crate::proxy_models::TrafficEvent;

/// Default content type for SOAP / XML requests and responses.
pub const CONTENT_TYPE_XML: &str = "text/xml; charset=utf-8";
/// Plain-text fallback content type used in error responses.
pub const CONTENT_TYPE_PLAIN: &str = "text/plain";

/// Emit a `traffic-event` to the frontend.
/// Both the proxy and mock servers call this after each transaction.
pub fn emit_traffic_event(app: &AppHandle, event: &TrafficEvent, source: &str) {
    if let Err(e) = app.emit("traffic-event", event) {
        log::warn!("[{}] Failed to emit traffic-event: {}", source, e);
    }
}

/// Return `true` if `text` matches `pattern`.
/// When `is_regex` is `true`, the pattern is compiled as a regular expression;
/// otherwise a simple substring search is used.
pub fn match_pattern(text: &str, pattern: &str, is_regex: bool) -> bool {
    if is_regex {
        regex::Regex::new(pattern)
            .map(|re| re.is_match(text))
            .unwrap_or(false)
    } else {
        text.contains(pattern)
    }
}
