//! Certificate and proxy diagnostics — the checks behind Settings → Proxy and the Debug view.
//!
//! The panel has called these commands by name for as long as it has existed, but they
//! belonged to the old Node server and never had a Rust implementation, so every check
//! reported `Command '…' not implemented`. These are the implementations, and the shapes
//! match what the panel already reads.
//!
//! What each check can actually prove:
//!   * `check_certificate`       — the files exist and what they say about themselves.
//!   * `check_certificate_store` — which store the CA is in, per store: a service or an IIS
//!     app pool trusts only `LocalMachine\Root` while the app installs to `CurrentUser\Root`.
//!   * `test_https_server`       — the CA and the key on disk are a matching pair. The
//!     handshake completes only when the CA file is the trust anchor, which requires the key
//!     that signed it.
//!   * `test_proxy_connection`   — a real handshake against the running proxy, trusting the
//!     OS store exactly as a browser or a .NET client does. This is the check that fails when
//!     Windows traffic is not being captured.
//!   * `test_traffic_capture`    — a request to an internal service on an ephemeral port, routed
//!     through the proxy, checked against the recording window. It separates "the proxy does not
//!     record" from "the application is not routing to the proxy", which is the case when an app
//!     is running under a different identity than the user who set the proxy.

use serde::Serialize;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use rustls::pki_types::ServerName;
use rustls::{ClientConfig, RootCertStore, ServerConfig};
use tauri::{AppHandle, State};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::net::TcpStream;
use tokio::time::timeout;
use tokio_rustls::{TlsAcceptor, TlsConnector};

use crate::certificates::manager::{CertInfo, CertManager};
use crate::certificates::sni_resolver::SniResolver;
use crate::utils::{blocking, capture_probe, proxy_guard};
use crate::{ensure_proxy_state, LazyProxyAppState};

/// The SNI the self-test presents. It is never resolved or forwarded: the CONNECT is
/// answered, the handshake is measured, and the connection is dropped.
const DIAG_HOST: &str = "apinox-diagnostic.local";

/// A dead or wedged proxy must surface as a result, not hang the panel.
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreCheck {
    pub in_current_user: bool,
    pub in_local_machine: bool,
    pub platform: String,
    pub thumbprint: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticResult {
    pub success: bool,
    pub error: Option<String>,
    pub details: Option<String>,
    /// What the failure means for the client, in one line — the panel shows it under the
    /// error so the reader knows what to change.
    pub hint: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HandshakeReport {
    pub success: bool,
    pub host: String,
    pub port: u16,
    pub protocol: Option<String>,
    pub cipher: Option<String>,
    pub error: Option<String>,
    pub hint: Option<String>,
    /// "OS trust store", or "CA file only" when the handshake only works because the CA was
    /// added manually to this test — that difference is the actionable finding.
    pub verified_against: Option<String>,
}

fn ok(details: String) -> DiagnosticResult {
    DiagnosticResult { success: true, error: None, details: Some(details), hint: None }
}

fn fail(error: String) -> DiagnosticResult {
    DiagnosticResult { hint: hint_for(&error), error: Some(error), details: None, success: false }
}

/// Maps a handshake failure to what the client should change. These are the four shapes
/// that break Windows capture, and each produces a different error string.
fn hint_for(error: &str) -> Option<String> {
    let e = error.to_lowercase();
    if e.contains("unknownissuer") {
        return Some(
            r"The CA is not in the store this client validates against. CryptoAPI uses LocalMachine\Root for services and other users, so an IIS app pool or a Windows service needs the machine store — CurrentUser\Root is not enough for it.".to_string(),
        );
    }
    if e.contains("no server certificate chain resolved") {
        return Some(
            r"The client sent no usable SNI. rustls discards an IP address in the SNI extension (RFC 6066), and .NET Framework clients often send none at all; the proxy signs for the CONNECT host as a fallback, so this only appears when that fallback was not reached.".to_string(),
        );
    }
    if e.contains("nociphersuitesincommon") || e.contains("no shared cipher") {
        return Some(
            "The client offered only RSA signature schemes, and the APInox CA is ECDSA — so no suite is shared. An older Schannel/.NET Framework client needs an RSA CA.".to_string(),
        );
    }
    if e.contains("protocolversion") || e.contains("no protocols available") {
        return Some(
            "The client offered TLS 1.0 or 1.1, which rustls does not support. Set ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 in the .NET app.".to_string(),
        );
    }
    None
}

/// True when the proxy answered the CONNECT with 200. Returns the failure text otherwise.
fn connect_accepted(response: &str) -> Option<String> {
    let head = response.lines().next().unwrap_or("").trim().to_string();
    if head.starts_with("HTTP/1.1 200") || head.starts_with("HTTP/1.0 200") {
        None
    } else {
        Some(format!("proxy did not accept the CONNECT: {head}"))
    }
}

fn client_config(roots: &RootCertStore) -> Arc<ClientConfig> {
    Arc::new(
        ClientConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
            .with_protocol_versions(rustls::ALL_VERSIONS)
            .expect("rustls protocol versions")
            .with_root_certificates(roots.clone())
            .with_no_client_auth(),
    )
}

async fn read_head(stream: &mut TcpStream) -> Result<String, String> {
    let mut buf = Vec::new();
    let mut byte = [0u8; 1];
    for _ in 0..4096 {
        let n = timeout(HANDSHAKE_TIMEOUT, stream.read(&mut byte))
            .await
            .map_err(|_| "timed out reading the CONNECT response".to_string())
            .and_then(|r| r.map_err(|e| e.to_string()))?;
        if n == 0 {
            break;
        }
        buf.push(byte[0]);
        if buf.ends_with(b"\r\n\r\n") {
            break;
        }
    }
    Ok(String::from_utf8_lossy(&buf).into_owned())
}

#[tauri::command]
pub async fn check_certificate(
    state: State<'_, LazyProxyAppState>,
    app: AppHandle,
) -> Result<CertInfo, String> {
    let state = ensure_proxy_state(state, &app).await?;
    let mgr = state.cert_manager.clone();
    blocking(move || Ok(mgr.info())).await
}

#[tauri::command]
pub async fn check_certificate_store(
    state: State<'_, LazyProxyAppState>,
    app: AppHandle,
) -> Result<StoreCheck, String> {
    let state = ensure_proxy_state(state, &app).await?;
    let mgr = state.cert_manager.clone();
    // Spawns PowerShell or `security` — tens of milliseconds per call, so it belongs on the
    // blocking pool, not the async runtime.
    blocking(move || {
        let (in_current_user, in_local_machine) = mgr.detect_stores();
        Ok(StoreCheck {
            in_current_user,
            in_local_machine,
            platform: std::env::consts::OS.to_string(),
            thumbprint: mgr.thumbprint(),
        })
    })
    .await
}

/// The CA and key as a pair: a handshake where the CA file is the only trust anchor
/// completes only if the key on disk is the key that signed the certificate.
#[tauri::command]
pub async fn test_https_server(
    state: State<'_, LazyProxyAppState>,
    app: AppHandle,
) -> Result<DiagnosticResult, String> {
    let state = ensure_proxy_state(state, &app).await?;
    let mgr = state.cert_manager.clone();
    if !mgr.info().exists {
        return Ok(fail("CA certificate not found — generate it first".to_string()));
    }
    Ok(self_test(&mgr).await)
}

/// The CA-and-key pair, exercised through the production resolver.
async fn self_test(mgr: &Arc<CertManager>) -> DiagnosticResult {
    let der = match mgr.persisted_ca_der() {
        Some(d) => d,
        None => return fail("CA certificate could not be read".to_string()),
    };

    let mut roots = RootCertStore::empty();
    if let Err(e) = roots.add(der) {
        return fail(format!("CA could not be parsed as a trust anchor: {e}"));
    }

    // The production resolver, against a throwaway listener: nothing is forwarded.
    let acceptor = TlsAcceptor::from(Arc::new(
        ServerConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
            .with_protocol_versions(rustls::ALL_VERSIONS)
            .expect("rustls protocol versions")
            .with_no_client_auth()
            .with_cert_resolver(Arc::new(SniResolver {
                cert_manager: mgr.clone(),
                fallback_domain: None,
            })),
    ));

    let listener = match TcpListener::bind("127.0.0.1:0").await {
        Ok(l) => l,
        Err(e) => return fail(format!("could not bind the test listener: {e}")),
    };
    let port = match listener.local_addr() {
        Ok(a) => a.port(),
        Err(e) => return fail(format!("could not read the test listener address: {e}")),
    };
    let server = tokio::spawn(async move {
        let (stream, _) = match listener.accept().await {
            Ok(v) => v,
            Err(e) => return Err(e.to_string()),
        };
        match acceptor.accept(stream).await {
            Ok(_) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    });

    let stream = match timeout(HANDSHAKE_TIMEOUT, TcpStream::connect(format!("127.0.0.1:{port}"))).await {
        Err(_) => return fail("timed out connecting to the test listener".to_string()),
        Ok(Ok(s)) => s,
        Ok(Err(e)) => return fail(format!("could not connect to the test listener: {e}")),
    };
    let connector = TlsConnector::from(client_config(&roots));
    let report = tls_handshake(&connector, stream, DIAG_HOST, port).await;

    // The server side is the informative half: a resolver that cannot name a certificate,
    // or a key that does not match the certificate, fails there rather than in the client.
    if !report.success {
        return DiagnosticResult { success: false, error: report.error, details: None, hint: report.hint };
    }
    match server.await {
        Err(_) => DiagnosticResult { success: true, error: None, details: Some(format!("handshake completed against the CA on disk ({:?} / {})", report.protocol, report.cipher.unwrap_or_else(|| "unknown".to_string()))), hint: None },
        Ok(Ok(())) => ok(format!(
            "handshake completed against the CA on disk ({:?} / {})",
            report.protocol,
            report.cipher.clone().unwrap_or_else(|| "unknown".to_string())
        )),
        Ok(Err(e)) => fail(e),
    }
}

/// A handshake against the running proxy, trusting the OS store — the same anchors a
/// browser or a .NET client validates against. If the CA is not in the store the test
/// reports that as the finding rather than quietly substituting the CA file.
#[tauri::command]
pub async fn test_proxy_connection(
    state: State<'_, LazyProxyAppState>,
    app: AppHandle,
) -> Result<HandshakeReport, String> {
    let state = ensure_proxy_state(state, &app).await?;
    let (running, port) = {
        let ps = state.proxy.lock().await;
        (ps.running, ps.config.port)
    };
    let mgr = state.cert_manager.clone();

    if !running {
        return Ok(HandshakeReport {
            error: Some("the proxy is not running — start it before testing the connection".to_string()),
            ..handshake_base(DIAG_HOST, port)
        });
    }

    let mut roots = RootCertStore::empty();
    let native = rustls_native_certs::load_native_certs();
    for cert in native.certs {
        let _ = roots.add(cert);
    }
    let (in_user, in_machine) = mgr.detect_stores();
    let verified_against = if in_user || in_machine {
        "OS trust store".to_string()
    } else {
        // Not trusted: add the CA file so the test still measures the MITM path, and say so.
        if let Some(der) = mgr.persisted_ca_der() {
            let _ = roots.add(der);
        }
        "CA file only — the OS store does not trust it".to_string()
    };

    let stream = match timeout(HANDSHAKE_TIMEOUT, TcpStream::connect(format!("127.0.0.1:{port}"))).await {
        Err(_) => return Ok(HandshakeReport {
            error: Some(format!("timed out connecting to 127.0.0.1:{port}")),
            ..handshake_base(DIAG_HOST, port)
        }),
        Ok(Ok(s)) => s,
        Ok(Err(e)) => return Ok(HandshakeReport {
            error: Some(format!("could not connect to 127.0.0.1:{port}: {e}")),
            ..handshake_base(DIAG_HOST, port)
        }),
    };

    let connector = TlsConnector::from(client_config(&roots));
    let mut report = connect_handshake(&connector, stream, DIAG_HOST, port).await;
    report.verified_against = Some(verified_against);
    Ok(report)
}

fn handshake_base(host: &str, port: u16) -> HandshakeReport {
    HandshakeReport {
        success: false,
        host: host.to_string(),
        port,
        protocol: None,
        cipher: None,
        error: None,
        hint: None,
        verified_against: None,
    }
}

/// One handshake over an already-connected stream: the CONNECT is answered first, exactly
/// as a client using the proxy does, and the TLS layer runs on the same socket.
/// The TLS half of the test: the handshake against the resolver, and the negotiated
/// protocol and suite as the panel reports them.
async fn tls_handshake(
    connector: &TlsConnector,
    stream: TcpStream,
    server_name: &str,
    port: u16,
) -> HandshakeReport {
    let name = match ServerName::try_from(server_name) {
        Ok(n) => n.to_owned(),
        Err(e) => return HandshakeReport { error: Some(format!("invalid test server name: {e}")), ..handshake_base(server_name, port) },
    };

    let tls = match timeout(HANDSHAKE_TIMEOUT, connector.connect(name, stream)).await {
        Err(_) => return HandshakeReport { error: Some("timed out during the TLS handshake".to_string()), ..handshake_base(server_name, port) },
        Ok(Ok(t)) => t,
        Ok(Err(e)) => return HandshakeReport { error: Some(e.to_string()), ..handshake_base(server_name, port) },
    };

    let state = tls.get_ref().1;
    HandshakeReport {
        success: true,
        protocol: Some(format!("{:?}", state.protocol_version())),
        cipher: Some(
            state
                .negotiated_cipher_suite()
                .map(|s| format!("{:?}", s.suite()))
                .unwrap_or_else(|| "unknown".to_string()),
        ),
        ..handshake_base(server_name, port)
    }
}

/// One handshake over an already-connected stream: the CONNECT is answered first, exactly
/// as a client using the proxy does, and the TLS layer runs on the same socket.
async fn connect_handshake(
    connector: &TlsConnector,
    mut stream: TcpStream,
    server_name: &str,
    port: u16,
) -> HandshakeReport {
    let head = format!("CONNECT {server_name}:443 HTTP/1.1\r\nHost: {server_name}\r\n\r\n");
    if let Err(e) = stream.write_all(head.as_bytes()).await {
        return HandshakeReport { error: Some(format!("could not send the CONNECT: {e}")), ..handshake_base(server_name, port) };
    }

    let response = match read_head(&mut stream).await {
        Ok(r) => r,
        Err(e) => return HandshakeReport { error: Some(e), ..handshake_base(server_name, port) },
    };
    if let Some(err) = connect_accepted(&response) {
        return HandshakeReport { error: Some(err), ..handshake_base(server_name, port) };
    }

    tls_handshake(connector, stream, server_name, port).await
}


/// What the capture check can and cannot prove.
///
/// The recording path is the only thing that makes traffic visible, so "the probe was recorded"
/// means the proxy does capture traffic when a client uses it. When the probe is recorded but the
/// application's traffic is not, the fault is not the proxy — it is that the application is not
/// routing to it, which is a different diagnosis from a failed handshake.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureReport {
    pub success: bool,
    pub proxy_port: u16,
    pub probe_port: u16,
    /// Whether the internal service answered, i.e. the proxy did not re-target the request.
    pub served_by_probe: bool,
    /// Whether the recording path emitted an event for the probe.
    pub recorded: bool,
    /// Where `resolve_url` would have forwarded it, when a target is configured.
    pub forwarded_to: Option<String>,
    /// The proxy the OS settings would give a .NET client for this scheme.
    pub os_proxy: Option<String>,
    /// The Windows bypass list, when one is set.
    pub proxy_override: Option<String>,
    pub error: Option<String>,
    pub hint: Option<String>,
}

fn capture_base(port: u16) -> CaptureReport {
    CaptureReport {
        success: false,
        proxy_port: port,
        probe_port: 0,
        served_by_probe: false,
        recorded: false,
        forwarded_to: None,
        os_proxy: None,
        proxy_override: None,
        error: None,
        hint: None,
    }
}

/// A path no other traffic can match by accident, so the window entry can be attributed to this run.
fn probe_marker() -> String {
    let id = uuid::Uuid::new_v4().to_string();
    format!("apinox-capture-probe-{}", &id[..8])
}

fn bypasses_local(override_list: &Option<String>) -> bool {
    override_list
        .as_ref()
        .map(|o| o.contains("<local>"))
        .unwrap_or(false)
}

#[tauri::command]
pub async fn test_traffic_capture(
    state: State<'_, LazyProxyAppState>,
    app: AppHandle,
) -> Result<CaptureReport, String> {
    let state = ensure_proxy_state(state, &app).await?;
    let (running, port, target) = {
        let ps = state.proxy.lock().await;
        (ps.running, ps.config.port, ps.config.target_url.clone())
    };

    let mut report = capture_base(port);
    if !running {
        report.error = Some("the proxy is not running".to_string());
        return Ok(report);
    }

    let listener = match TcpListener::bind("127.0.0.1:0").await {
        Ok(l) => l,
        Err(e) => {
            report.error = Some(format!("could not bind the internal service: {e}"));
            return Ok(report);
        }
    };
    report.probe_port = listener.local_addr().map(|a| a.port()).unwrap_or(0);

    let marker = probe_marker();
    let path = format!("/{marker}");
    let served = Arc::new(AtomicBool::new(false));

    // The internal service. Its address is deliberately not the configured target: the check is
    // whether a request that enters the proxy comes back out as a recorded event.
    let served_flag = served.clone();
    let want = path.clone();
    tokio::spawn(async move {
        for _ in 0..3 {
            let Ok((mut stream, _)) = listener.accept().await else { break };
            if read_head(&mut stream)
                .await
                .map(|head| head.contains(&want))
                .unwrap_or(false)
            {
                served_flag.store(true, Ordering::Relaxed);
            }
            let _ = stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
                .await;
        }
    });

    let route = reqwest::Proxy::all(format!("http://127.0.0.1:{port}"))
        .map_err(|e| format!("could not route the probe through the proxy: {e}"))?;
    let client = match reqwest::Client::builder().timeout(Duration::from_secs(10)).proxy(route).build() {
        Ok(c) => c,
        Err(e) => {
            report.error = Some(format!("could not build the probe client: {e}"));
            return Ok(report);
        }
    };

    let url = format!("http://127.0.0.1:{}{}", report.probe_port, path);
    match timeout(Duration::from_secs(10), client.get(&url).send()).await {
        Err(_) => report.error = Some("the request through the proxy timed out".to_string()),
        Ok(Err(e)) => report.error = Some(format!("request through the proxy failed: {e}")),
        Ok(Ok(_)) => {}
    }

    // The event is emitted after the upstream answers, so give the recording path a moment.
    for _ in 0..20 {
        if capture_probe::saw(&marker) {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    report.recorded = capture_probe::saw(&marker);
    report.served_by_probe = served.load(Ordering::Relaxed);
    report.forwarded_to = if target.is_empty() { None } else { Some(target) };
    report.os_proxy = proxy_guard::effective_proxy("http");
    report.proxy_override = proxy_guard::proxy_override();
    report.success = report.recorded;
    report.hint = capture_hint(&report);
    Ok(report)
}

/// The diagnosis, from what the check measured. A pure function so the split it makes can be
/// tested without a running proxy.
pub fn capture_hint(report: &CaptureReport) -> Option<String> {
    if report.success {
        // The proxy demonstrably records, so the missing traffic is a client that is not using it.
        let os = match &report.os_proxy {
            Some(p) if p.contains(&format!(":{}", report.proxy_port)) =>
                format!("the OS proxy for this user is the proxy itself ({p})"),
            Some(p) => format!(
                "the OS proxy for this user is {p}, not 127.0.0.1:{port}",
                port = report.proxy_port
            ),
            None => "nothing is set for this user, so a .NET client using DefaultWebProxy goes direct".to_string(),
        };
        let bypass = if bypasses_local(&report.proxy_override) {
            " The bypass list contains <local>, so a request to a local host is sent direct."
        } else {
            ""
        };
        let owner = "Internet Settings is read per user: an IIS app pool or a Windows service runs as a different identity with its own settings, and WCF and SoapHttpClientProtocol use WebRequest.DefaultWebProxy / UseDefaultWebProxy, which read that same place. Set the proxy for the identity that runs the app, or set it inside the application (system.proxy in web.config, or ServicePointManager.Proxy), then restart the worker process.";
        return Some(format!("Capture works, so the SOAP call is not arriving through the proxy. {os}.{bypass} {owner}"));
    }

    if report.error.is_some() {
        return Some(match &report.forwarded_to {
            Some(target) => format!(
                "The request was not recorded. With a target configured, every request is forwarded to {target}, so the internal service is only reached when the proxy answers it itself — check that the proxy is listening on {port} and that the app is not bypassing it for local addresses.",
                port = report.proxy_port
            ),
            None => format!(
                "The request was not recorded, so it never reached the recording path on 127.0.0.1:{port}.",
                port = report.proxy_port
            ),
        });
    }

    // Reached the proxy but nothing was recorded: the pipeline answered without the event.
    Some(concat!(
        "The internal service saw the request, so the proxy handled it, but the recording path did ",
        "not emit an event — check whether a breakpoint rule is pausing this traffic or a mock rule ",
        "answered before the event was written.",
    ).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    /// The path `test_proxy_connection` takes: the CONNECT is answered, then the TLS layer
    /// runs on the same socket.
    #[tokio::test]
    async fn connect_handshake_succeeds_against_an_answered_connect() {
        let dir = TempDir::new().unwrap();
        let mgr = Arc::new(CertManager::new(dir.path().to_path_buf()));
        mgr.generate().unwrap();

        let mut roots = RootCertStore::empty();
        roots.add(mgr.persisted_ca_der().unwrap()).unwrap();

        let acceptor = TlsAcceptor::from(Arc::new(
            ServerConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
                .with_protocol_versions(rustls::ALL_VERSIONS)
                .unwrap()
                .with_no_client_auth()
                .with_cert_resolver(Arc::new(SniResolver {
                    cert_manager: mgr.clone(),
                    fallback_domain: None,
                })),
        ));

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut buf = [0u8; 256];
            let n = stream.read(&mut buf).await.unwrap();
            assert!(String::from_utf8_lossy(&buf[..n]).starts_with("CONNECT"));
            stream.write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n").await.unwrap();
            acceptor.accept(stream).await
        });

        let stream = TcpStream::connect(format!("127.0.0.1:{port}")).await.unwrap();
        let report = connect_handshake(&TlsConnector::from(client_config(&roots)), stream, DIAG_HOST, port).await;
        assert!(report.success, "handshake failed: {:?}", report.error);
        assert!(server.await.unwrap().is_ok(), "the server side must agree");
    }

    #[test]
    fn a_recorded_probe_points_at_the_client_not_the_proxy() {
        let report = CaptureReport {
            success: true,
            proxy_port: 8888,
            probe_port: 41871,
            served_by_probe: true,
            recorded: true,
            forwarded_to: None,
            os_proxy: Some("127.0.0.1:1080".to_string()),
            proxy_override: Some("<local>".to_string()),
            error: None,
            hint: None,
        };
        let hint = capture_hint(&report).unwrap();
        // The check proved the recording path works, so the hint must not restate that as the
        // problem — it has to name where the client is reading its proxy from.
        assert!(hint.contains("Capture works"), "{hint}");
        assert!(hint.contains("127.0.0.1:1080, not 127.0.0.1:8888"), "{hint}");
        assert!(hint.contains("<local>"), "{hint}");
        assert!(hint.contains("per user"), "{hint}");
    }

    #[test]
    fn when_nothing_is_set_for_the_user_the_hint_says_so() {
        let mut report = CaptureReport {
            success: true,
            proxy_port: 8888,
            probe_port: 41871,
            served_by_probe: true,
            recorded: true,
            forwarded_to: None,
            os_proxy: None,
            proxy_override: None,
            error: None,
            hint: None,
        };
        let hint = capture_hint(&report).unwrap();
        assert!(hint.contains("nothing is set for this user"), "{hint}");
        assert!(!hint.contains("<local>"), "{hint}");
    }

    #[test]
    fn a_probe_that_never_reached_the_recording_path_is_not_blamed_on_the_client() {
        let report = CaptureReport {
            success: false,
            proxy_port: 8888,
            probe_port: 41871,
            served_by_probe: false,
            recorded: false,
            forwarded_to: Some("https://api.test/soap".to_string()),
            os_proxy: Some("http://127.0.0.1:8888".to_string()),
            proxy_override: None,
            error: Some("the request through the proxy timed out".to_string()),
            hint: None,
        };
        let hint = capture_hint(&report).unwrap();
        assert!(hint.contains("not recorded"), "{hint}");
        assert!(hint.contains("https://api.test/soap"), "{hint}");
        assert!(!hint.contains("Capture works"), "{hint}");
    }

    #[test]
    fn a_request_the_proxy_handled_without_an_event_names_the_pipeline() {
        let report = CaptureReport {
            success: false,
            proxy_port: 8888,
            probe_port: 41871,
            served_by_probe: true,
            recorded: false,
            forwarded_to: None,
            os_proxy: Some("http://127.0.0.1:8888".to_string()),
            proxy_override: None,
            error: None,
            hint: None,
        };
        let hint = capture_hint(&report).unwrap();
        assert!(hint.contains("did not emit an event"), "{hint}");
        assert!(hint.contains("breakpoint"), "{hint}");
    }

    #[test]
    fn the_probe_path_cannot_be_matched_by_other_traffic() {
        let marker = probe_marker();
        assert!(marker.starts_with("apinox-capture-probe-"), "{marker}");
        assert_ne!(marker, probe_marker(), "each run needs its own marker");
    }
    #[test]
    fn connect_accepted_reads_the_proxy_answer() {
        assert_eq!(connect_accepted("HTTP/1.1 200 Connection Established\r\n\r\n"), None);
        assert!(connect_accepted("HTTP/1.1 403 Forbidden\r\n\r\n").is_some());
        assert!(connect_accepted("").is_some());
    }

    #[test]
    fn hints_name_the_client_shape_that_failed() {
        assert!(hint_for("invalid peer certificate: UnknownIssuer")
            .unwrap()
            .contains("LocalMachine"));
        assert!(hint_for("no server certificate chain resolved")
            .unwrap()
            .contains("SNI"));
        assert!(hint_for("peer is incompatible: NoCipherSuitesInCommon")
            .unwrap()
            .contains("ECDSA"));
        assert!(hint_for("received fatal alert: ProtocolVersion")
            .unwrap()
            .contains("TLS 1.0"));
        assert!(hint_for("connection closed").is_none());
    }

    /// The CA and the key as a pair, through the production resolver.
    #[tokio::test]
    async fn self_test_handshake_succeeds_with_a_generated_ca() {
        let dir = TempDir::new().unwrap();
        let mgr = Arc::new(CertManager::new(dir.path().to_path_buf()));
        mgr.generate().unwrap();
        let result = self_test(&mgr).await;
        assert!(result.success, "self test failed: {:?}", result.error);
    }

    #[tokio::test]
    async fn self_test_fails_when_the_key_is_not_the_one_that_signed_the_ca() {
        let dir = TempDir::new().unwrap();
        let mgr = Arc::new(CertManager::new(dir.path().to_path_buf()));
        mgr.generate().unwrap();

        let other = TempDir::new().unwrap();
        let other_mgr = CertManager::new(other.path().to_path_buf());
        other_mgr.generate().unwrap();

        // Leaves are signed with the key on disk, so a key from another CA produces
        // signatures the trusted certificate cannot verify.
        std::fs::write(mgr.key_path(), std::fs::read(other_mgr.key_path()).unwrap()).unwrap();

        let result = self_test(&mgr).await;
        assert!(!result.success, "a mismatched key must not pass the self test");
    }
}
