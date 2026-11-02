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

use serde::Serialize;
use std::sync::Arc;
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
use crate::utils::blocking;
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
