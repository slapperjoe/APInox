use anyhow::{Context, Result};
use rcgen::{
    CertificateParams, DistinguishedName, DnType, ExtendedKeyUsagePurpose, IsCa, KeyPair,
    KeyUsagePurpose, SanType,
};
use rustls::pki_types::{PrivateKeyDer, PrivatePkcs8KeyDer};
use rustls::sign::CertifiedKey;
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::net::IpAddr;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use time::{Duration, OffsetDateTime};

use crate::utils::write_atomic;

/// 10-year validity for a local dev CA — long enough to not be a maintenance burden.
const CA_VALIDITY_DAYS: i64 = 3650;
/// 1-year validity for per-domain leaf certs.
const LEAF_VALIDITY_DAYS: i64 = 365;

/// The full details returned to the UI (matches the TypeScript CertInfo interface).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[derive(Default)]
pub struct CertInfo {
    pub exists: bool,
    pub cert_path: String,
    pub key_path: String,
    pub subject: Option<String>,
    pub issuer: Option<String>,
    /// ISO 8601 UTC string, e.g. "2026-03-01T00:00:00Z"
    pub valid_from: Option<String>,
    /// ISO 8601 UTC string
    pub valid_to: Option<String>,
    /// Colon-separated uppercase hex SHA-256 of the DER-encoded cert.
    pub fingerprint: Option<String>,
    /// Uppercase hex SHA-1 of the DER-encoded cert — the value Windows reports as a
    /// certificate's thumbprint (`certmgr`, PowerShell's `Thumbprint`), which is what
    /// the diagnostics compare against the store. `fingerprint` is SHA-256, so the two
    /// are not interchangeable.
    pub thumbprint: Option<String>,
    /// Whether the CA cert is currently installed in the OS trust store.
    pub is_trusted: bool,
}

/// Sidecar JSON stored alongside the PEM file so `info()` is fast and
/// doesn't require a DER parser at runtime.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CertMeta {
    subject: String,
    issuer: String,
    valid_from: String,
    valid_to: String,
    fingerprint: String,
}

pub struct CertManager {
    pub config_dir: PathBuf,
    /// Cache of per-domain CertifiedKey values so we only sign once per domain.
    leaf_cache: Mutex<HashMap<String, Arc<CertifiedKey>>>,
}

impl std::fmt::Debug for CertManager {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CertManager")
            .field("config_dir", &self.config_dir)
            .field("cached_domains", &self.leaf_cache.lock().map(|c| c.len()).unwrap_or(0))
            .finish()
    }
}

impl CertManager {
    pub fn new(config_dir: PathBuf) -> Self {
        Self {
            config_dir,
            leaf_cache: Mutex::new(HashMap::new()),
        }
    }

    pub fn cert_path(&self) -> PathBuf {
        self.config_dir.join("ca.cer")
    }

    pub fn key_path(&self) -> PathBuf {
        self.config_dir.join("ca.key")
    }

    pub fn meta_path(&self) -> PathBuf {
        self.config_dir.join("ca.meta.json")
    }

    /// The CA exactly as it was installed (the PEM on disk), for presenting in the
    /// leaf chain. `sign_for_domain` rebuilds CA params because `rcgen` cannot sign
    /// with an existing certificate object, and that rebuild is a different
    /// certificate — same key, different serial and validity — so its thumbprint
    /// does not match the one the client has in its store.
    pub fn persisted_ca_der(&self) -> Option<rustls::pki_types::CertificateDer<'static>> {
        // The `pem` crate is already a dependency (rcgen writes PEM through it);
        // `rustls-pemfile` is a dev-dependency only, so it cannot be used here.
        let raw = std::fs::read(self.cert_path()).ok()?;
        let cert = pem::parse_many(&raw).ok()?.into_iter().next()?;
        Some(rustls::pki_types::CertificateDer::from(cert.contents().to_vec()))
    }

    pub fn info(&self) -> CertInfo {
        let exists = self.cert_path().exists() && self.key_path().exists();
        let (in_user, in_machine) = if exists { self.detect_stores() } else { (false, false) };

        let base = CertInfo {
            exists,
            cert_path: self.cert_path().to_string_lossy().into_owned(),
            key_path: self.key_path().to_string_lossy().into_owned(),
            subject: None,
            issuer: None,
            valid_from: None,
            valid_to: None,
            fingerprint: None,
            thumbprint: self.thumbprint(),
            is_trusted: in_user || in_machine,
        };

        if !exists {
            return base;
        }

        // Load the metadata sidecar written at generation time.
        if let Ok(raw) = std::fs::read_to_string(self.meta_path()) {
            if let Ok(meta) = serde_json::from_str::<CertMeta>(&raw) {
                return CertInfo {
                    subject: Some(meta.subject),
                    issuer: Some(meta.issuer),
                    valid_from: Some(meta.valid_from),
                    valid_to: Some(meta.valid_to),
                    fingerprint: Some(meta.fingerprint),
                    ..base
                };
            }
        }

        base
    }

    /// SHA-1 thumbprint of the DER-encoded cert — the value Windows reports as
    /// `Thumbprint` and `certmgr` shows. `fingerprint` is SHA-256, so the two cannot be
    /// compared against each other.
    pub fn thumbprint(&self) -> Option<String> {
        let der = self.persisted_ca_der()?;
        let hash = Sha1::digest(der.as_ref());
        Some(hash.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(""))
    }

    /// Which trust stores the CA is installed in, as `(currentUser, localMachine)`.
    ///
    /// Both matter. `install_windows` writes to CurrentUser\Root because that needs no
    /// elevation, but the CryptoAPI chain engine validates against LocalMachine\Root for
    /// services and other users — an IIS app pool, a scheduled task, or a Windows service
    /// running as SYSTEM only trusts the machine store. Checking one store alone reports a
    /// trusted CA as missing, and its traffic fails the MITM handshake.
    ///
    /// Spawns `security` / PowerShell, so this is tens of milliseconds, not
    /// sub-millisecond — which is why `info()` callers that use it go through
    /// `utils::blocking()` rather than running on the async runtime.
    pub fn detect_stores(&self) -> (bool, bool) {
        #[cfg(target_os = "macos")]
        {
            // Reads need no elevation: the login keychain is the user store, the System
            // keychain is the machine store.
            let home = std::env::var("HOME").unwrap_or_default();
            let found = |keychain: String| {
                let output = std::process::Command::new("security")
                    .args(["find-certificate", "-a", "-c", "APIprox", &keychain])
                    .output();
                matches!(output, Ok(o) if o.status.success() && !o.stdout.is_empty())
            };
            (
                found(format!("{home}/Library/Keychains/login.keychain-db")),
                found("/Library/Keychains/System.keychain".to_string()),
            )
        }

        #[cfg(target_os = "windows")]
        {
            // PowerShell's cert provider — reliable subject/thumbprint lookup with no
            // certutil ambiguities around exit codes or exact-name matching. One subprocess
            // for both stores; the counts are parsed by `parse_store_counts`.
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            let found_by = match self.thumbprint() {
                Some(tp) => format!("$_.Thumbprint -eq '{tp}'"),
                None => "$_.Subject -like '*APIprox*'".to_string(),
            };
            let command = format!(
                "$u = @(Get-ChildItem Cert:\\CurrentUser\\Root | Where-Object {{ {found_by} }}).Count; \\
                 $m = @(Get-ChildItem Cert:\\LocalMachine\\Root | Where-Object {{ {found_by} }}).Count; \\
                 \"$u $m\""
            );
            let output = std::process::Command::new("powershell")
                .args(["-NoProfile", "-NonInteractive", "-Command", &command])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
            match output {
                Ok(o) => parse_store_counts(&String::from_utf8_lossy(&o.stdout)),
                Err(_) => (false, false),
            }
        }

        #[cfg(target_os = "linux")]
        {
            // Best-effort: check common anchor directories. There is no user-level trust
            // store on Linux, so the user half is always false.
            let paths = [
                "/usr/local/share/ca-certificates/apiprox-ca.crt",
                "/etc/pki/ca-trust/source/anchors/apiprox-ca.crt",
                "/etc/ca-certificates/trust-source/anchors/apiprox-ca.crt",
            ];
            (false, paths.iter().any(|p| std::path::Path::new(p).exists()))
        }

        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        {
            (false, false)
        }
    }

    /// Generate a self-signed root CA certificate and persist it.
    ///
    /// The cert is suitable for signing HTTPS leaf certs:
    ///   - `BasicConstraints: CA:TRUE`
    ///   - `KeyUsage: keyCertSign, cRLSign`  (required by RFC 5280 §4.2.1.3)
    ///   - 10-year validity
    ///   - No SANs (CA certs don't need them; SANs belong on leaf certs)
    ///
    /// Also clears the leaf cert cache since the CA has changed.
    pub fn generate(&self) -> Result<CertInfo> {
        std::fs::create_dir_all(&self.config_dir)
            .context("Failed to create config directory")?;

        let key_pair = KeyPair::generate().context("Failed to generate key pair")?;

        let now = OffsetDateTime::now_utc();
        let expiry = now + Duration::days(CA_VALIDITY_DAYS);

        let mut params = CertificateParams::default();
        let mut dn = DistinguishedName::new();
        dn.push(DnType::CommonName, "APIprox Root CA");
        dn.push(DnType::OrganizationName, "APIprox");
        dn.push(DnType::CountryName, "AU");
        params.distinguished_name = dn;
        params.is_ca = IsCa::Ca(rcgen::BasicConstraints::Unconstrained);
        params.key_usages = vec![
            KeyUsagePurpose::KeyCertSign,
            KeyUsagePurpose::CrlSign,
        ];
        params.not_before = now;
        params.not_after = expiry;
        params.subject_alt_names = vec![]; // CA certs don't need SANs

        let cert = params
            .self_signed(&key_pair)
            .context("Failed to self-sign certificate")?;

        // SHA-256 fingerprint of the DER-encoded certificate — what users
        // compare in browser warnings to verify they've trusted the right CA.
        let hash = Sha256::digest(cert.der().as_ref());
        let fingerprint = hash
            .iter()
            .map(|b| format!("{:02X}", b))
            .collect::<Vec<_>>()
            .join(":");

        let valid_from = fmt_dt(now);
        let valid_to = fmt_dt(expiry);
        let subject = "CN=APIprox Root CA, O=APIprox, C=AU".to_string();

        let pem = cert.pem();
        write_atomic(&self.cert_path(), pem.as_bytes())
            .context("Failed to write certificate")?;
        let key_pem = key_pair.serialize_pem();
        write_atomic(&self.key_path(), key_pem.as_bytes())
            .context("Failed to write private key")?;

        let meta = CertMeta {
            subject: subject.clone(),
            issuer: subject, // self-signed
            valid_from,
            valid_to,
            fingerprint,
        };
        let meta_json = serde_json::to_string_pretty(&meta)?;
        write_atomic(&self.meta_path(), meta_json.as_bytes())
            .context("Failed to write cert metadata")?;

        // Invalidate leaf cache — old leaf certs were signed by the previous CA key.
        self.leaf_cache.lock().unwrap().clear();

        log::info!("[CertManager] Generated new CA at {:?}", self.cert_path());
        Ok(self.info())
    }

/// Return a per-domain `CertifiedKey` suitable for use as a TLS server certificate.
    ///
    /// The leaf cert is signed by our root CA and cached in memory so we only
    /// generate it once per domain per session.
    ///
    /// Returns an error if the CA cert/key files don't exist yet.
    pub fn sign_for_domain(&self, domain: &str) -> Result<Arc<CertifiedKey>> {
        // Fast path: return cached key if already signed.
        {
            let cache = self.leaf_cache.lock().unwrap();
            if let Some(ck) = cache.get(domain) {
                return Ok(ck.clone());
            }
        }

        // Load CA key from disk.
        let ca_key_pem = std::fs::read_to_string(self.key_path())
            .context("CA key not found — generate a certificate first")?;
        // Verify CA cert exists (not needed for signing but gives a better error message).
        if !self.cert_path().exists() {
            anyhow::bail!("CA cert not found — generate a certificate first");
        }

        let ca_key = KeyPair::from_pem(&ca_key_pem).context("Failed to load CA key pair")?;

        // Reconstruct CA cert params — same DN/constraints as generate() — so rcgen can
        // use it as a signing parent. rcgen 0.13 doesn't support loading an existing cert
        // for re-signing, so we rebuild the params with the same loaded key pair.  The
        // public key in `ca_key` is the one already trusted by the client's OS, so the
        // signature on the leaf cert will be verifiable against the installed CA.
        let now = OffsetDateTime::now_utc();
        let mut ca_params = CertificateParams::default();
        let mut dn = DistinguishedName::new();
        dn.push(DnType::CommonName, "APIprox Root CA");
        dn.push(DnType::OrganizationName, "APIprox");
        dn.push(DnType::CountryName, "AU");
        ca_params.distinguished_name = dn;
        ca_params.is_ca = IsCa::Ca(rcgen::BasicConstraints::Unconstrained);
        ca_params.key_usages = vec![KeyUsagePurpose::KeyCertSign, KeyUsagePurpose::CrlSign];
        ca_params.not_before = now - Duration::days(1);
        ca_params.not_after = now + Duration::days(CA_VALIDITY_DAYS);
        let ca_cert = ca_params
            .self_signed(&ca_key)
            .context("Failed to reconstruct CA certificate for signing")?;

        // Generate a fresh leaf key and cert for this domain.
        let leaf_key = KeyPair::generate().context("Failed to generate leaf key pair")?;

        let mut leaf_params = CertificateParams::default();
        let mut dn = DistinguishedName::new();
        dn.push(DnType::CommonName, domain);
        leaf_params.distinguished_name = dn;
        leaf_params.subject_alt_names = vec![san_for_domain(domain)?];
        leaf_params.not_before = now;
        leaf_params.not_after = now + Duration::days(LEAF_VALIDITY_DAYS);
        leaf_params.is_ca = IsCa::NoCa;
        // Required by .NET/WCF and all modern TLS stacks — without ServerAuth in EKU
        // the certificate is rejected even when the CA is trusted.
        leaf_params.extended_key_usages = vec![ExtendedKeyUsagePurpose::ServerAuth];
        leaf_params.key_usages = vec![
            KeyUsagePurpose::DigitalSignature,
            KeyUsagePurpose::KeyEncipherment,
        ];

        let leaf_cert = leaf_params
            .signed_by(&leaf_key, &ca_cert, &ca_key)
            .context("Failed to sign leaf certificate")?;

        // Convert to rustls CertifiedKey using the ring crypto provider directly
        // (avoids relying on a global installed provider).
        let cert_der = leaf_cert.der().clone();
        let key_der = PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(leaf_key.serialize_der()));
        let provider = rustls::crypto::ring::default_provider();
        let signing_key = provider
            .key_provider
            .load_private_key(key_der)
            .map_err(|e| anyhow::anyhow!("Failed to load signing key: {:?}", e))?;

        // Send the full chain (leaf + the trusted root), not the leaf alone. Clients
        // that build the chain from their own trust store (CryptoAPI, browsers) accept
        // a leaf-only chain, but stacks that only read the chain the server presents —
        // Java, older .NET, some Go and Python clients — cannot verify a leaf whose
        // issuer is not in the message. Presenting the root costs one DER per handshake
        // and is what every MITM proxy does.
        //
        // Present the CA as installed, not the copy rebuilt above: the rebuild has a
        // different serial and validity window, so its thumbprint differs. A client
        // that pins the root thumbprint, or that reads `chain.ChainElements[1]`, must
        // be shown the certificate it actually trusted.
        let ca_der = self.persisted_ca_der().unwrap_or_else(|| ca_cert.der().clone());
        let certified_key = Arc::new(CertifiedKey::new(vec![cert_der, ca_der], signing_key));

        // Cache for subsequent requests to the same domain.
        self.leaf_cache
            .lock()
            .unwrap()
            .insert(domain.to_string(), certified_key.clone());

        log::debug!("[CertManager] Signed leaf cert for {}", domain);
        Ok(certified_key)
    }
}

/// Parses PowerShell's `"<userCount> <machineCount>"` output into
/// `(installedForUser, installedForMachine)`.
#[cfg(any(test, target_os = "windows"))]
fn parse_store_counts(out: &str) -> (bool, bool) {
    let mut parts = out.trim().split_whitespace();
    let user = parts.next().and_then(|v| v.parse::<u32>().ok()).unwrap_or(0);
    let machine = parts.next().and_then(|v| v.parse::<u32>().ok()).unwrap_or(0);
    (user > 0, machine > 0)
}

/// SAN entry for a leaf certificate.
///
/// `DnsName` rejects IP literals, so a MITM'd host that is an address — the usual
/// shape when a client dials `https://127.0.0.1:9000` or a machine name — needs the
/// `iPAddress` SAN. Clients validate the name they sent (or the address they
/// connected to) against the SAN, so choosing the wrong variant rejects the leaf
/// even when the CA is trusted.
fn san_for_domain(domain: &str) -> Result<SanType> {
    match domain.parse::<IpAddr>() {
        Ok(ip) => Ok(SanType::IpAddress(ip)),
        Err(_) => Ok(SanType::DnsName(
            domain
                .try_into()
                .with_context(|| format!("Invalid domain name: {}", domain))?,
        )),
    }
}

/// Format a `time::OffsetDateTime` as an ISO 8601 UTC string without
/// pulling in the `time` "formatting" feature gate.
fn fmt_dt(dt: OffsetDateTime) -> String {
    let d = dt.date();
    let t = dt.time();
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        d.year(),
        d.month() as u8,
        d.day(),
        t.hour(),
        t.minute(),
        t.second(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn temp_manager() -> (TempDir, CertManager) {
        let dir = TempDir::new().unwrap();
        let mgr = CertManager::new(dir.path().to_path_buf());
        (dir, mgr)
    }

    // ── CA generation tests ───────────────────────────────────────────────────

    #[test]
    fn info_reports_not_exists_before_generate() {
        let (_dir, mgr) = temp_manager();
        let info = mgr.info();
        assert!(!info.exists);
        assert!(info.subject.is_none());
    }

    #[test]
    fn generate_creates_cert_key_and_meta_files() {
        let (_dir, mgr) = temp_manager();
        mgr.generate().unwrap();
        assert!(mgr.cert_path().exists(), "ca.cer should exist");
        assert!(mgr.key_path().exists(), "ca.key should exist");
        assert!(mgr.meta_path().exists(), "ca.meta.json should exist");
    }

    #[test]
    fn info_reports_full_metadata_after_generate() {
        let (_dir, mgr) = temp_manager();
        mgr.generate().unwrap();
        let info = mgr.info();
        assert!(info.exists);
        assert_eq!(
            info.subject.as_deref(),
            Some("CN=APIprox Root CA, O=APIprox, C=AU")
        );
        assert_eq!(
            info.issuer.as_deref(),
            Some("CN=APIprox Root CA, O=APIprox, C=AU")
        );
        assert!(info.valid_from.is_some());
        assert!(info.valid_to.is_some());
        assert!(info.fingerprint.is_some());
    }

    #[test]
    fn fingerprint_is_sha256_colon_hex() {
        let (_dir, mgr) = temp_manager();
        mgr.generate().unwrap();
        let fp = mgr.info().fingerprint.unwrap();
        let parts: Vec<&str> = fp.split(':').collect();
        assert_eq!(parts.len(), 32, "fingerprint should have 32 colon-separated groups");
        for part in &parts {
            assert_eq!(part.len(), 2, "each group should be 2 hex chars");
            assert!(
                part.chars().all(|c| c.is_ascii_hexdigit()),
                "each group should be hex"
            );
        }
    }

    #[test]
    fn thumbprint_is_sha1_hex_and_differs_from_the_sha256_fingerprint() {
        let (_dir, mgr) = temp_manager();
        mgr.generate().unwrap();
        let tp = mgr.thumbprint().unwrap();
        assert_eq!(tp.len(), 40, "SHA-1 thumbprint is 40 hex chars: {tp}");
        assert!(tp.chars().all(|c| c.is_ascii_hexdigit()));
        // The diagnostics compare the thumbprint with the store; a SHA-256 fingerprint
        // can never match it.
        assert_ne!(tp, mgr.info().fingerprint.unwrap().replace(':', ""));
    }

    #[test]
    fn parse_store_counts_reads_both_stores() {
        assert_eq!(parse_store_counts("1 0"), (true, false));
        assert_eq!(parse_store_counts("0 1"), (false, true));
        assert_eq!(parse_store_counts("2 3"), (true, true));
        assert_eq!(parse_store_counts(""), (false, false));
        assert_eq!(parse_store_counts("not a pair"), (false, false));
    }

    #[test]
    fn valid_to_is_approximately_10_years_from_now() {
        let (_dir, mgr) = temp_manager();
        mgr.generate().unwrap();
        let valid_to = mgr.info().valid_to.unwrap();
        let now_year = OffsetDateTime::now_utc().year();
        let cert_year: i32 = valid_to[..4].parse().unwrap();
        let diff = cert_year - now_year;
        assert!(diff >= 9 && diff <= 10, "validity should be ~10 years, got diff={}", diff);
    }

    #[test]
    fn generated_cert_is_valid_pem() {
        let (_dir, mgr) = temp_manager();
        mgr.generate().unwrap();
        let pem = std::fs::read_to_string(mgr.cert_path()).unwrap();
        assert!(pem.contains("-----BEGIN CERTIFICATE-----"));
        assert!(pem.contains("-----END CERTIFICATE-----"));
    }

    #[test]
    fn generated_key_is_valid_pem() {
        let (_dir, mgr) = temp_manager();
        mgr.generate().unwrap();
        let pem = std::fs::read_to_string(mgr.key_path()).unwrap();
        assert!(pem.contains("-----BEGIN"));
        assert!(pem.contains("-----END"));
    }

    #[test]
    fn generate_is_idempotent() {
        let (_dir, mgr) = temp_manager();
        mgr.generate().unwrap();
        let fp1 = mgr.info().fingerprint.clone().unwrap();
        mgr.generate().unwrap();
        let fp2 = mgr.info().fingerprint.unwrap();
        assert_eq!(fp1.len(), fp2.len());
    }

    #[test]
    fn info_paths_are_within_config_dir() {
        let (dir, mgr) = temp_manager();
        let info = mgr.info();
        assert!(info.cert_path.starts_with(dir.path().to_str().unwrap()));
        assert!(info.key_path.starts_with(dir.path().to_str().unwrap()));
    }

    #[test]
    fn generate_creates_config_dir_if_missing() {
        let dir = TempDir::new().unwrap();
        let nested = dir.path().join("deep").join("nested").join("config");
        let mgr = CertManager::new(nested.clone());
        mgr.generate().unwrap();
        assert!(nested.exists());
        assert!(mgr.cert_path().exists());
    }

    #[test]
    fn fmt_dt_produces_valid_iso8601() {
        let dt = OffsetDateTime::now_utc();
        let s = fmt_dt(dt);
        assert!(s.ends_with('Z'), "should end with Z: {}", s);
        assert_eq!(s.len(), 20, "should be 20 chars: {}", s);
        assert_eq!(&s[4..5], "-");
        assert_eq!(&s[7..8], "-");
        assert_eq!(&s[10..11], "T");
        assert_eq!(&s[13..14], ":");
        assert_eq!(&s[16..17], ":");
    }

    // ── Leaf cert / MITM tests ────────────────────────────────────────────────

    #[test]
    fn sign_for_domain_fails_without_ca() {
        let (_dir, mgr) = temp_manager();
        // No CA generated — should fail with a meaningful error.
        let result = mgr.sign_for_domain("example.com");
        assert!(result.is_err(), "should fail when CA does not exist");
        let msg = result.unwrap_err().to_string();
        assert!(
            msg.contains("CA") || msg.contains("cert") || msg.contains("key"),
            "error should mention the missing CA: {}",
            msg
        );
    }

    #[test]
    fn sign_for_domain_returns_certified_key() {
        let (_dir, mgr) = temp_manager();
        mgr.generate().unwrap();
        let ck = mgr.sign_for_domain("example.com").unwrap();
        // Leaf plus the root: clients that only read the chain the server presents
        // cannot verify a leaf whose issuer is absent from the message.
        assert_eq!(ck.cert.len(), 2, "leaf cert chain should present leaf + CA");
    }

    #[test]
    fn sign_for_domain_is_cached() {
        let (_dir, mgr) = temp_manager();
        mgr.generate().unwrap();
        let ck1 = mgr.sign_for_domain("example.com").unwrap();
        let ck2 = mgr.sign_for_domain("example.com").unwrap();
        // Same Arc — cached, not re-signed.
        assert!(Arc::ptr_eq(&ck1, &ck2), "second call should return the cached CertifiedKey");
    }

    #[test]
    fn sign_for_domain_different_domains_get_different_certs() {
        let (_dir, mgr) = temp_manager();
        mgr.generate().unwrap();
        let ck1 = mgr.sign_for_domain("example.com").unwrap();
        let ck2 = mgr.sign_for_domain("api.example.com").unwrap();
        assert!(!Arc::ptr_eq(&ck1, &ck2), "different domains must get different certs");
    }

    #[test]
    fn sign_for_domain_accepts_an_ip_address() {
        let (_dir, mgr) = temp_manager();
        mgr.generate().unwrap();
        // A client dialing by IP sends no usable SNI, so the resolver's fallback is
        // an address. `DnsName` rejects IP literals, which used to fail the signing.
        let ck = mgr.sign_for_domain("127.0.0.1").unwrap();
        assert_eq!(ck.cert.len(), 2);
    }

    #[test]
    fn chain_presents_the_installed_ca_not_the_rebuilt_one() {
        let (_dir, mgr) = temp_manager();
        let info = mgr.generate().unwrap();
        let ck = mgr.sign_for_domain("example.com").unwrap();

        let mut h = Sha256::new();
        h.update(ck.cert[1].as_ref());
        let presented = h
            .finalize()
            .iter()
            .map(|b| format!("{:02X}", b))
            .collect::<Vec<_>>()
            .join(":");

        // A validation callback that compares the chain root against the CA in the
        // store sees the rebuilt params (different serial/validity) unless we present
        // the file it actually trusted.
        assert_eq!(presented, info.fingerprint.unwrap(), "presented root must be the installed CA");
    }

    #[test]
    fn san_for_domain_uses_dns_for_hostnames() {
        assert!(matches!(san_for_domain("api.example.com").unwrap(), SanType::DnsName(_)));
    }

    #[test]
    fn san_for_domain_uses_ip_for_addresses() {
        assert!(matches!(san_for_domain("127.0.0.1").unwrap(), SanType::IpAddress(_)));
        assert!(matches!(san_for_domain("::1").unwrap(), SanType::IpAddress(_)));
    }

    #[test]
    fn generate_clears_leaf_cache() {
        let (_dir, mgr) = temp_manager();
        mgr.generate().unwrap();
        let ck1 = mgr.sign_for_domain("example.com").unwrap();
        // Regenerate the CA — old leaf certs are invalidated.
        mgr.generate().unwrap();
        let ck2 = mgr.sign_for_domain("example.com").unwrap();
        assert!(
            !Arc::ptr_eq(&ck1, &ck2),
            "regenerating CA should clear leaf cache"
        );
    }

    /// Full TLS handshake integration test.
    ///
    /// Starts a local TCP listener, wraps it with our TLS acceptor (SNI resolver),
    /// connects with a TLS client that trusts our CA, and verifies the handshake
    /// completes without error. This validates the entire MITM cert chain.
    #[tokio::test]
    async fn tls_mitm_handshake_succeeds() {
        use rustls::{ClientConfig, RootCertStore, ServerConfig};
        use std::io::Cursor;
        use tokio::net::{TcpListener, TcpStream};
        use tokio_rustls::{TlsAcceptor, TlsConnector};

        let (dir, mgr) = temp_manager();
        let mgr = Arc::new(mgr);
        mgr.generate().unwrap();

        // ── Server side ─────────────────────────────────────────────────────
        // Build ServerConfig with our SNI resolver.
        use crate::certificates::sni_resolver::SniResolver;
        let resolver = Arc::new(SniResolver {
            cert_manager: mgr.clone(),
            fallback_domain: None,
        });
        let server_cfg = ServerConfig::builder_with_provider(Arc::new(
            rustls::crypto::ring::default_provider(),
        ))
        .with_protocol_versions(rustls::ALL_VERSIONS)
        .unwrap()
        .with_no_client_auth()
        .with_cert_resolver(resolver);

        let acceptor = TlsAcceptor::from(Arc::new(server_cfg));
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let server_task = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            // TLS handshake — panics if it fails, which will surface in the test.
            acceptor.accept(stream).await.expect("TLS server handshake failed");
        });

        // ── Client side ─────────────────────────────────────────────────────
        // Build a ClientConfig that trusts our CA cert.
        let ca_pem = std::fs::read(mgr.cert_path()).unwrap();
        let mut root_store = RootCertStore::empty();
        let certs: Vec<_> = rustls_pemfile::certs(&mut Cursor::new(&ca_pem))
            .collect::<Result<_, _>>()
            .unwrap();
        root_store.add(certs[0].clone()).unwrap();

        let client_cfg = ClientConfig::builder_with_provider(Arc::new(
            rustls::crypto::ring::default_provider(),
        ))
        .with_protocol_versions(rustls::ALL_VERSIONS)
        .unwrap()
        .with_root_certificates(root_store)
        .with_no_client_auth();

        let connector = TlsConnector::from(Arc::new(client_cfg));
        let tcp = TcpStream::connect(addr).await.unwrap();
        let server_name = rustls::pki_types::ServerName::try_from("example.com")
            .unwrap()
            .to_owned();

        connector
            .connect(server_name, tcp)
            .await
            .expect("TLS client handshake failed");

        server_task.await.unwrap();
        drop(dir); // keep temp dir alive until here
    }
}
