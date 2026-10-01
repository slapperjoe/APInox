use std::collections::HashMap;

use chrono::Utc;
use serde::Serialize;
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::proxy_models::{ProxyConfig, TrafficEvent};
use crate::proxy::server::run_proxy;
use crate::utils::emit_traffic_event;
use crate::{ensure_proxy_state, LazyProxyAppState};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub mode: String,
    pub target_url: String,
}

#[tauri::command]
pub async fn start_proxy(
    port: u16,
    mode: String,
    target_url: String,
    max_body_bytes: Option<u64>,
    state: State<'_, LazyProxyAppState>,
    app: AppHandle,
) -> Result<(), String> {
    let state = ensure_proxy_state(state, &app).await?;
    let mut ps = state.proxy.lock().await;

    if ps.running {
        return Err("Proxy is already running".to_string());
    }

    // Block startup if the CA cert has not been generated yet — the MITM TLS acceptor
    // needs it and there's no sensible fallback.
    if !state.cert_manager.info().exists {
        return Err(
            "CA certificate not found. Please generate it in Settings before starting the proxy."
                .to_string(),
        );
    }

    let config = ProxyConfig {
        enabled: true,
        port,
        target_url,
        mode,
        max_body_bytes,
    };
    ps.config = config.clone();

    let replacer = state.replacer.clone();
    let cert_manager = state.cert_manager.clone();
    let mock_state = state.mock.clone();
    let breakpoints = state.breakpoint.clone();

    // Spawn the server task and keep an abort handle
    let handle = tokio::spawn(async move {
        if let Err(e) = run_proxy(config, replacer, app, cert_manager, mock_state, breakpoints).await {
            log::error!("[Proxy] Server error: {}", e);
        }
    });

    ps.task = Some(handle.abort_handle());
    tokio::spawn(async move {
        if let Err(e) = handle.await {
            log::error!("[Proxy] Proxy server background task panicked: {:?}", e);
        }
    });
    ps.running = true;

    log::info!("[Proxy] Started on port {}", ps.config.port);
    Ok(())
}


#[tauri::command]
pub async fn stop_proxy(state: State<'_, LazyProxyAppState>, app: AppHandle) -> Result<(), String> {
    let state = ensure_proxy_state(state, &app).await?;
    let mut ps = state.proxy.lock().await;

    if let Some(handle) = ps.task.take() {
        handle.abort();
    }
    ps.running = false;

    log::info!("[Proxy] Stopped");
    Ok(())
}

#[tauri::command]
pub async fn get_proxy_status(state: State<'_, LazyProxyAppState>, app: AppHandle) -> Result<ProxyStatus, String> {
    let state = ensure_proxy_state(state, &app).await?;
    let ps = state.proxy.lock().await;
    Ok(ProxyStatus {
        running: ps.running,
        port: if ps.running { Some(ps.config.port) } else { None },
        mode: ps.config.mode.clone(),
        target_url: ps.config.target_url.clone(),
    })
}

/// A captured traffic request to re-send, as picked from the Traffic viewer.
/// Mirrors the frontend `TrafficLog` shape for the fields a replay needs.
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayRequest {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub request_headers: HashMap<String, String>,
    #[serde(default)]
    pub request_body: String,
}

/// Re-send a captured traffic request to its original endpoint, identically.
///
/// This is the right-click "Replay Request" action from the Traffic viewer: it
/// fires the same method/URL/headers/body the client originally sent, directly
/// to the upstream (not through the proxy listener — the webview has no TLS
/// trust for the proxy's self-signed MITM CA), then emits a `traffic-event`
/// so the new exchange appears at the top of the Traffic list.
///
/// Hop-by-hop and proxy-specific headers are stripped (the proxy already fully
/// buffered the body, so the original `transfer-encoding`/`content-length` are
/// no longer valid for a fresh request) — mirroring the proxy forward path.
#[tauri::command]
pub async fn replay_traffic_request(
    request: ReplayRequest,
    app: AppHandle,
) -> Result<TrafficEvent, String> {
    let start = std::time::Instant::now();
    let event_id = Uuid::new_v4().to_string();

    // reqwest must not route this request back through APInox's own proxy
    // listener (set as the OS system proxy while the proxy runs) — it would
    // loop back into the MITM path. A direct connection to the real upstream.
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| format!("Failed to build replay client: {}", e))?;

    let method = request.method.trim().to_uppercase();
    let url = request.url.trim().to_string();
    if method.is_empty() {
        return Err("Replay request has no method".to_string());
    }
    if url.is_empty() {
        return Err("Replay request has no URL".to_string());
    }

    let req_method = reqwest::Method::from_bytes(method.as_bytes())
        .map_err(|e| format!("Invalid HTTP method {}: {}", method, e))?;

    let mut rb = client.request(req_method, &url);

    const HOP_BY_HOP: &[&str] = &[
        "host",
        "connection",
        "keep-alive",
        "proxy-connection",
        "proxy-authorization",
        "proxy-authenticate",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
        "content-length", // let reqwest recalculate from the actual body
        "expect",
    ];

    for (k, v) in &request.request_headers {
        let lk = k.to_lowercase();
        if !HOP_BY_HOP.contains(&lk.as_str()) {
            rb = rb.header(k.as_str(), v.as_str());
        }
    }

    if !request.request_body.is_empty() {
        rb = rb.body(request.request_body.clone());
    }

    let (status, response_headers, response_body) = match rb.send().await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            // Strip response hop-by-hop headers so the emitted traffic entry
            // records the headers the user actually sees (no
            // transfer-encoding / content-length), matching the proxy path.
            let response_headers: HashMap<String, String> = resp
                .headers()
                .iter()
                .filter_map(|(k, v)| {
                    let lk = k.as_str().to_lowercase();
                    if matches!(
                        lk.as_str(),
                        "transfer-encoding"
                            | "content-length"
                            | "connection"
                            | "keep-alive"
                            | "te"
                            | "trailers"
                            | "upgrade"
                    ) {
                        None
                    } else {
                        v.to_str().ok().map(|v| (k.to_string(), v.to_string()))
                    }
                })
                .collect();
            let body_bytes = resp.bytes().await.unwrap_or_default();
            (status, response_headers, String::from_utf8_lossy(&body_bytes).into_owned())
        }
        Err(e) => {
            let msg = format!("Replay request error: {}", e);
            log::warn!("[Proxy] {}", msg);
            (502, HashMap::new(), msg)
        }
    };

    let duration_ms = start.elapsed().as_millis() as u64;
    let now = Utc::now();

    let event = TrafficEvent {
        id: event_id,
        timestamp: now.timestamp_millis(),
        timestamp_label: now.to_rfc3339(),
        method,
        url,
        request_headers: request.request_headers,
        request_body: request.request_body,
        status: Some(status),
        response_headers: Some(response_headers),
        response_body: Some(response_body.clone()),
        duration_ms: Some(duration_ms),
        matched_rule: None,
        passthrough: Some(true),
        source: "replay".to_string(),
    };

    // Surface the replayed exchange in the Traffic viewer (newest first).
    emit_traffic_event(&app, &event, "Replay");

    Ok(event)
}
