//! The recording window — what the traffic path has actually emitted.
//!
//! `emit_traffic_event` is the only place captured traffic becomes visible, so a check that asks
//! "was this request captured?" has to measure there. Counting the response is not evidence: the
//! proxy can answer a request from a rule or a breakpoint without the panel ever seeing an event,
//! and a request can be recorded without the client being able to read the answer.
//!
//! The window holds the URLs of the last events, so the capture probe can match its own request —
//! identified by a marker in its path — against what the panel would have shown.

use std::sync::Mutex;

/** Events kept. The probe's marker is unique per run, so the window only has to cover the check
 * itself plus whatever else the proxy recorded while it ran. */
const WINDOW: usize = 32;

static EVENTS: Mutex<Vec<String>> = Mutex::new(Vec::new());

/// Called from `utils::http::emit_traffic_event` — the recording path itself.
pub fn record(url: &str) {
    let mut window = EVENTS.lock().unwrap();
    if window.len() >= WINDOW {
        window.remove(0);
    }
    window.push(url.to_string());
}

pub fn saw(marker: &str) -> bool {
    EVENTS.lock().unwrap().iter().any(|url| url.contains(marker))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_window_matches_the_probe_not_any_other_traffic() {
        record("http://127.0.0.1:41871/apinox-capture-probe-9f2c1a");
        assert!(saw("apinox-capture-probe-9f2c1a"));
        assert!(!saw("apinox-capture-probe-000000"));
    }

    #[test]
    fn the_window_still_covers_a_busy_run() {
        for i in 0..60 {
            record(&format!("http://example.test/page{i}"));
        }
        assert!(!saw("page1"), "the oldest events are dropped");
        assert!(saw("page59"));
    }

    /// Wiring guard: the window is written by the recording path, not by the check. Without this
    /// the capture check could report a capture for a request that never went through it.
    #[test]
    fn the_window_is_written_by_the_recording_path() {
        let src = include_str!("http.rs");
        assert!(src.contains("capture_probe::record("), "{src}");
    }
}
