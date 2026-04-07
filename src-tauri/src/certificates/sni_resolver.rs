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
#[derive(Debug)]
pub struct SniResolver {
    pub cert_manager: Arc<CertManager>,
}

impl ResolvesServerCert for SniResolver {
    fn resolve(&self, hello: ClientHello<'_>) -> Option<Arc<CertifiedKey>> {
        let domain = hello.server_name()?;
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
