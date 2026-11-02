use rustls::server::{ClientHello, ResolvesServerCert};
use rustls::sign::CertifiedKey;
use std::sync::Arc;

use crate::certificates::manager::CertManager;

/// SNI-based certificate resolver.
///
/// For each TLS ClientHello, extracts the requested server name (SNI) and
/// returns a dynamically signed leaf certificate for that domain.  The
/// `CertManager` caches signed certs in memory so each domain is only signed
/// once per session.
///
/// `fallback_domain` is the host from the CONNECT request, used when the
/// ClientHello carries no SNI. rustls parses an IP address in the SNI extension
/// and then treats it as absent (RFC 6066 §3), so clients that dial by IP — or
/// omit SNI altogether (.NET Framework/Schannel, PowerShell 5, older Java, most
/// WCF bindings) — would otherwise get `None` here and the handshake fails with
/// "no server certificate chain resolved", so the tunnel is never MITM'd and no
/// traffic is recorded for those clients.
#[derive(Debug)]
pub struct SniResolver {
    pub cert_manager: Arc<CertManager>,
    pub fallback_domain: Option<String>,
}

impl ResolvesServerCert for SniResolver {
    fn resolve(&self, hello: ClientHello<'_>) -> Option<Arc<CertifiedKey>> {
        let domain = hello.server_name().or(self.fallback_domain.as_deref())?;
        match self.cert_manager.sign_for_domain(domain) {
            Ok(ck) => Some(ck),
            Err(e) => {
                log::warn!("[SniResolver] Failed to sign cert for {}: {}", domain, e);
                None
            }
        }
    }
}

/// A `rustls` server-certificate verifier that accepts any upstream certificate.
///
/// Used when proxying to upstream HTTPS servers — we don't validate their cert
/// because the user may be testing services with self-signed or expired certs.
/// Signature verification is delegated to the ring crypto provider so that the
/// TLS handshake still completes correctly; only chain/trust validation is skipped.
#[derive(Debug)]
pub struct NoVerify(Arc<rustls::crypto::CryptoProvider>);

impl NoVerify {
    pub fn new() -> Self {
        Self(Arc::new(rustls::crypto::ring::default_provider()))
    }
}

impl Default for NoVerify {
    fn default() -> Self {
        Self::new()
    }
}

impl rustls::client::danger::ServerCertVerifier for NoVerify {
    fn verify_server_cert(
        &self,
        _end_entity: &rustls::pki_types::CertificateDer<'_>,
        _intermediates: &[rustls::pki_types::CertificateDer<'_>],
        _server_name: &rustls::pki_types::ServerName<'_>,
        _ocsp_response: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &rustls::pki_types::CertificateDer<'_>,
        dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls12_signature(
            message,
            cert,
            dss,
            &self.0.signature_verification_algorithms,
        )
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &rustls::pki_types::CertificateDer<'_>,
        dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls13_signature(
            message,
            cert,
            dss,
            &self.0.signature_verification_algorithms,
        )
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        self.0.signature_verification_algorithms.supported_schemes()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustls::pki_types::ServerName;
    use rustls::{ClientConfig, RootCertStore, ServerConfig};
    use std::io::Cursor;
    use tokio::net::{TcpListener, TcpStream};
    use tokio_rustls::{TlsAcceptor, TlsConnector};

    use crate::certificates::manager::CertManager;

    fn trusted_store(mgr: &CertManager) -> RootCertStore {
        let pem = std::fs::read(mgr.cert_path()).unwrap();
        let mut store = RootCertStore::empty();
        let certs: Vec<_> = rustls_pemfile::certs(&mut Cursor::new(&pem))
            .collect::<Result<_, _>>()
            .unwrap();
        store.add(certs[0].clone()).unwrap();
        store
    }

    /// Runs one handshake against a resolver built from `resolver`, with the client
    /// presenting `server_name`. Returns the server-side handshake error, if any.
    async fn handshake(resolver: Arc<SniResolver>, server_name: &str, roots: &RootCertStore) -> Option<String> {
        let cfg = ServerConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
            .with_protocol_versions(rustls::ALL_VERSIONS)
            .unwrap()
            .with_no_client_auth()
            .with_cert_resolver(resolver);
        let acceptor = TlsAcceptor::from(Arc::new(cfg));
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let server = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            acceptor.accept(stream).await
        });

        let client_cfg = ClientConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
            .with_protocol_versions(rustls::ALL_VERSIONS)
            .unwrap()
            .with_root_certificates(roots.clone())
            .with_no_client_auth();
        let connector = TlsConnector::from(Arc::new(client_cfg));
        let tcp = TcpStream::connect(addr).await.unwrap();
        let name = ServerName::try_from(server_name).unwrap().to_owned();
        // The client's own view of the handshake, so a resolver that cannot name a
        // certificate shows up the way it does in the proxy log.
        let client = connector.connect(name, tcp).await;
        let server = server.await.unwrap();

        client.err().or_else(|| server.err()).map(|e| e.to_string())
    }

    /// A client dialing an IP address sends an SNI that rustls discards (RFC 6066),
    /// and .NET Framework/Schannel clients often send no SNI at all. Without the
    /// CONNECT-host fallback the resolver has no name to sign for and the tunnel is
    /// never MITM'd — the traffic is never recorded.
    #[tokio::test]
    async fn no_sni_client_is_served_with_the_connect_host_fallback() {
        let dir = tempfile::TempDir::new().unwrap();
        let mgr = Arc::new(CertManager::new(dir.path().to_path_buf()));
        mgr.generate().unwrap();
        let roots = trusted_store(&mgr);

        let resolver = Arc::new(SniResolver {
            cert_manager: mgr.clone(),
            fallback_domain: Some("127.0.0.1".to_string()),
        });
        assert_eq!(handshake(resolver, "127.0.0.1", &roots).await, None, "fallback must serve the handshake");

        // The same client against a resolver with no fallback: the failure this fixes.
        let no_fallback = Arc::new(SniResolver { cert_manager: mgr.clone(), fallback_domain: None });
        let err = handshake(no_fallback, "127.0.0.1", &roots).await;
        assert!(
            err.is_some(),
            "a no-SNI client must fail without the fallback, got: {err:?}"
        );
    }

    /// The leaf is presented with the CA, so a client that only reads the chain in the
    /// handshake message — and not its own store — can still build it.
    #[tokio::test]
    async fn handshake_with_a_store_only_client_still_verifies() {
        let dir = tempfile::TempDir::new().unwrap();
        let mgr = Arc::new(CertManager::new(dir.path().to_path_buf()));
        mgr.generate().unwrap();
        let resolver = Arc::new(SniResolver { cert_manager: mgr.clone(), fallback_domain: None });
        assert_eq!(handshake(resolver, "example.com", &trusted_store(&mgr)).await, None);
    }
}
