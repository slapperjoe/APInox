use anyhow::{Context, Result};
use reqwest::{Client, Method, Proxy};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use once_cell::sync::Lazy;
use tokio::sync::Notify;
use futures_util::StreamExt as _;

use crate::utils::error_detail::{describe_request_failure, format_error_chain};

/// M5: response bodies larger than this are truncated and flagged on the
/// HttpResponse (surfaced to the UI) instead of buffered whole into memory.
pub const RESPONSE_BODY_LIMIT: usize = 32 * 1024 * 1024; // 32 MiB

type ClientKey = (u64, bool, bool, String, Option<String>, Option<String>);

static CLIENT_CACHE: Lazy<Mutex<HashMap<ClientKey, Client>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// A lightweight cancellation token backed by `tokio::sync::Notify`.
/// Create one with `CancelToken::new()`, pass an `Arc<CancelToken>` to
/// `HttpClient::execute_with_cancel`, and call `.cancel()` to abort an
/// in-flight request.
#[derive(Debug, Clone)]
pub struct CancelToken {
    notify: Arc<Notify>,
}

impl CancelToken {
    pub fn new() -> Self {
        Self {
            notify: Arc::new(Notify::new()),
        }
    }

    pub fn cancel(&self) {
        self.notify.notify_waiters();
    }

    pub async fn wait(&self) {
        self.notify.notified().await;
    }
}

impl Default for CancelToken {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HttpErrorKind {
    Dns,
    ConnectionRefused,
    Tls,
    Timeout,
    InvalidUrl,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub timeout_ms: Option<u64>,
    pub follow_redirects: Option<bool>,
    pub verify_ssl: Option<bool>,
    pub proxy_url: Option<String>,
    pub proxy_username: Option<String>,
    pub proxy_password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpResponse {
    pub success: bool,
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub time_taken_ms: u64,
    pub error: Option<String>,
    pub error_kind: Option<HttpErrorKind>,
    /// M5: true when the response body was truncated at RESPONSE_BODY_LIMIT.
    #[serde(default)]
    pub truncated: bool,
}

pub struct HttpClient;

impl HttpClient {
    /// Create a new HTTP client.
    ///
    /// No per-client state is held: requests execute through the cached,
    /// per-config `reqwest::Client` built in `build_reqwest_client`.
    pub fn new() -> Self {
        Self
    }

    /// Execute an HTTP request
    pub async fn execute(&self, request: HttpRequest) -> HttpResponse {
        self.execute_with_cancel(request, None).await
    }

    /// Execute an HTTP request with an optional cancellation token.
    pub async fn execute_with_cancel(
        &self,
        request: HttpRequest,
        cancel_token: Option<Arc<CancelToken>>,
    ) -> HttpResponse {
        let start = Instant::now();
        // Kept for the failure report: `request` is consumed by
        // `execute_internal`, and the caller needs to see WHICH url failed.
        let url = request.url.clone();

        match self.execute_internal(request, cancel_token).await {
            Ok(response) => response,
            Err(e) => {
                let kind = classify_reqwest_error(&e);
                // Flatten the source chain: `e.to_string()` alone reports only
                // "error sending request for url (...)", dropping the actual
                // cause (certificate/handshake/DNS/connection).
                let detail = describe_request_failure(&url, e.as_ref());
                log::error!("HTTP request to {} failed:\n{}", url, detail);
                HttpResponse {
                    success: false,
                    status: 0,
                    status_text: "Error".to_string(),
                    headers: HashMap::new(),
                    body: String::new(),
                    time_taken_ms: start.elapsed().as_millis() as u64,
                    error: Some(detail),
                    error_kind: Some(kind),
                    truncated: false,
                }
            }
        }
    }

    async fn execute_internal(
        &self,
        request: HttpRequest,
        cancel_token: Option<Arc<CancelToken>>,
    ) -> Result<HttpResponse> {
        let start = Instant::now();
        
        // Parse HTTP method
        let method = Method::from_bytes(request.method.as_bytes())
            .context("Invalid HTTP method")?;

        let timeout_ms = request.timeout_ms.unwrap_or(30_000);
        let follow_redirects = request.follow_redirects.unwrap_or(true);
        let verify_ssl = request.verify_ssl.unwrap_or(true);
        let proxy_url = request.proxy_url.clone().unwrap_or_default();

        // M3: include proxy credentials in the cache key — two requests that
        // share a proxy URL but use different credentials must not share a
        // reqwest Client (the first request's basic-auth would win).
        let key: ClientKey = (
            timeout_ms,
            follow_redirects,
            verify_ssl,
            proxy_url.clone(),
            request.proxy_username.clone(),
            request.proxy_password.clone(),
        );

        let client = {
            // Fast path: look up under the lock, cloning the handle so the guard
            // is released HERE — the scrutinee `if let` would otherwise keep the
            // guard alive into the `else` and the insert below would deadlock on
            // the same (non-reentrant) mutex.
            let cached = {
                let guard = CLIENT_CACHE.lock().unwrap();
                guard.get(&key).cloned()
            };
            if let Some(c) = cached {
                c
            } else {
                // Slow path: build OUTSIDE the lock so a cold client construction
                // (TLS stack, threadpool wiring) doesn't block every other request
                // on the same mutex. A duplicate build on a race is tolerated.
                let c = build_reqwest_client(
                    timeout_ms,
                    follow_redirects,
                    verify_ssl,
                    proxy_url.clone(),
                    request.proxy_username.clone(),
                    request.proxy_password.clone(),
                )?;
                CLIENT_CACHE.lock().unwrap().insert(key, c.clone());
                c
            }
        };

        // Build request
        let mut req_builder = client.request(method, &request.url);

        // Add headers
        for (key, value) in &request.headers {
            req_builder = req_builder.header(key, value);
        }

        // Add body if present
        if let Some(body) = &request.body {
            req_builder = req_builder.body(body.clone());
        }

        // Execute request with optional cancellation
        let response = if let Some(ref token) = cancel_token {
            tokio::select! {
                res = req_builder.send() => res.context("Failed to send HTTP request")?,
                _ = token.wait() => {
                    return Err(anyhow::anyhow!("Request cancelled"));
                }
            }
        } else {
            req_builder.send().await.context("Failed to send HTTP request")?
        };

        let status = response.status();
        let status_code = status.as_u16();
        let status_text = status.canonical_reason().unwrap_or("Unknown").to_string();

        // Extract headers
        let mut headers = HashMap::new();
        for (key, value) in response.headers() {
            if let Ok(value_str) = value.to_str() {
                headers.insert(key.to_string(), value_str.to_string());
            }
        }

        // Read body — M4: also race the cancel token against the body read,
        // not just the request send. A huge/slow response body should be
        // aborted promptly on cancel.
        // M5: cap the body at RESPONSE_BODY_LIMIT; flag truncation on the result.
        let body_opt = if let Some(ref token) = cancel_token {
            tokio::select! {
                res = read_capped_body(response) => Some(res),
                _ = token.wait() => {
                    return Err(anyhow::anyhow!("Request cancelled"));
                }
            }
        } else {
            Some(read_capped_body(response).await)
        };

        let (body, truncated) = match body_opt {
            Some((body, truncated)) => (body, truncated),
            None => return Err(anyhow::anyhow!("Request cancelled")),
        };

        let time_taken_ms = start.elapsed().as_millis() as u64;

        Ok(HttpResponse {
            success: status.is_success(),
            status: status_code,
            status_text,
            headers,
            body,
            time_taken_ms,
            error: None,
            error_kind: None,
            truncated,
        })
    }

    /// Convenience method for GET request
    pub async fn get(&self, url: &str, headers: HashMap<String, String>) -> HttpResponse {
        self.execute(HttpRequest {
            method: "GET".to_string(),
            url: url.to_string(),
            headers,
            body: None,
            timeout_ms: None,
            follow_redirects: None,
            verify_ssl: None,
            proxy_url: None,
            proxy_username: None,
            proxy_password: None,
        }).await
    }

    /// Convenience method for POST request
    pub async fn post(
        &self,
        url: &str,
        headers: HashMap<String, String>,
        body: String,
    ) -> HttpResponse {
        self.execute(HttpRequest {
            method: "POST".to_string(),
            url: url.to_string(),
            headers,
            body: Some(body),
            timeout_ms: None,
            follow_redirects: None,
            verify_ssl: None,
            proxy_url: None,
            proxy_username: None,
            proxy_password: None,
        }).await
    }

    /// Convenience method for PUT request
    pub async fn put(
        &self,
        url: &str,
        headers: HashMap<String, String>,
        body: String,
    ) -> HttpResponse {
        self.execute(HttpRequest {
            method: "PUT".to_string(),
            url: url.to_string(),
            headers,
            body: Some(body),
            timeout_ms: None,
            follow_redirects: None,
            verify_ssl: None,
            proxy_url: None,
            proxy_username: None,
            proxy_password: None,
        }).await
    }

    /// Convenience method for DELETE request
    pub async fn delete(&self, url: &str, headers: HashMap<String, String>) -> HttpResponse {
        self.execute(HttpRequest {
            method: "DELETE".to_string(),
            url: url.to_string(),
            headers,
            body: None,
            timeout_ms: None,
            follow_redirects: None,
            verify_ssl: None,
            proxy_url: None,
            proxy_username: None,
            proxy_password: None,
        }).await
    }

    /// Convenience method for PATCH request
    pub async fn patch(
        &self,
        url: &str,
        headers: HashMap<String, String>,
        body: String,
    ) -> HttpResponse {
        self.execute(HttpRequest {
            method: "PATCH".to_string(),
            url: url.to_string(),
            headers,
            body: Some(body),
            timeout_ms: None,
            follow_redirects: None,
            verify_ssl: None,
            proxy_url: None,
            proxy_username: None,
            proxy_password: None,
        }).await
    }
}

/// Read a response body, capping at RESPONSE_BODY_LIMIT bytes (M5).
/// Returns `(body_string, truncated)`.
pub(crate) async fn read_capped_body(response: reqwest::Response) -> (String, bool) {
    let mut stream = response.bytes_stream();
    let mut buf: Vec<u8> = Vec::new();
    let mut truncated = false;
    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(chunk) => {
                let remaining = RESPONSE_BODY_LIMIT.saturating_sub(buf.len());
                if chunk.len() > remaining {
                    buf.extend_from_slice(&chunk[..remaining]);
                    truncated = true;
                    break;
                }
                buf.extend_from_slice(&chunk);
            }
            Err(e) => {
                // Surface the read failure as an empty body with the error in
                // the HttpResponse.error field instead of throwing away the
                // whole response. Log the cause chain too: an empty body on a
                // 200 with nothing in the log is exactly the "request failed
                // and said nothing" case this detail exists to prevent.
                log::error!(
                    "Failed to read response body after {} bytes (truncated={}): {}",
                    buf.len(),
                    truncated,
                    format_error_chain(&e)
                );
                return (String::new(), truncated);
            }
        }
    }
    (String::from_utf8_lossy(&buf).into_owned(), truncated)
}

fn build_reqwest_client(
    timeout_ms: u64,
    follow_redirects: bool,
    verify_ssl: bool,
    proxy_url: String,
    proxy_username: Option<String>,
    proxy_password: Option<String>,
) -> Result<Client> {
    let mut builder = Client::builder()
        .danger_accept_invalid_certs(!verify_ssl);

    builder = builder.timeout(Duration::from_millis(timeout_ms));

    if follow_redirects {
        builder = builder.redirect(reqwest::redirect::Policy::limited(10));
    } else {
        builder = builder.redirect(reqwest::redirect::Policy::none());
    }

    if !proxy_url.is_empty() {
        let mut proxy = Proxy::all(&proxy_url)
            .context("Failed to configure proxy")?;
        if let (Some(username), Some(password)) = (proxy_username, proxy_password) {
            proxy = proxy.basic_auth(&username, &password);
        }
        builder = builder.proxy(proxy);
    }

    builder.build().context("Failed to create HTTP client")
}

/// Classify a failed HTTP request. Delegates to the shared chain classifier in
/// `utils::error_detail` so the REST and SOAP paths agree, and so the
/// `error` message and `error_kind` are always derived from the same walk.
fn classify_reqwest_error(e: &anyhow::Error) -> HttpErrorKind {
    crate::utils::error_detail::classify_anyhow_error(e)
}
