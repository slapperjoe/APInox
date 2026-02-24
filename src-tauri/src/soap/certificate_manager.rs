/// Certificate Manager
/// 
/// Handles X.509 certificate generation, loading, and basic operations for SOAP WS-Security

use anyhow::{Result, anyhow};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use std::path::{Path, PathBuf};
use std::fs;

/// Certificate format
#[derive(Debug, Clone)]
pub enum CertificateFormat {
    /// PEM format (Base64-encoded with headers)
    Pem,
    /// DER format (binary)
    Der,
}

/// Certificate with private key
#[derive(Debug, Clone)]
pub struct CertificateWithKey {
    pub certificate: String,      // PEM-encoded certificate
    pub private_key: String,       // PEM-encoded private key
    pub format: CertificateFormat,
}

/// Certificate manager
pub struct CertificateManager {
    certs_dir: PathBuf,
}

impl CertificateManager {
    /// Create a new certificate manager
    pub fn new(certs_dir: PathBuf) -> Result<Self> {
        // Create directory if it doesn't exist
        fs::create_dir_all(&certs_dir)?;
        
        Ok(Self { certs_dir })
    }
    
    /// Generate a self-signed certificate
    pub fn generate_self_signed(
        &self,
        common_name: &str,
        _organization: Option<&str>,
        _country: Option<&str>,
        _validity_days: u32,
    ) -> Result<CertificateWithKey> {
        // Use simple self-signed generation
        // TODO: Support custom DN, org, country, validity in future
        let cert = rcgen::generate_simple_self_signed(vec![common_name.to_string()])?;
        
        Ok(CertificateWithKey {
            certificate: cert.cert.pem(),
            private_key: cert.key_pair.serialize_pem(),
            format: CertificateFormat::Pem,
        })
    }
    
    /// Save certificate to file
    pub fn save_certificate(
        &self,
        name: &str,
        cert: &CertificateWithKey,
    ) -> Result<(PathBuf, PathBuf)> {
        let cert_path = self.certs_dir.join(format!("{}.crt", name));
        let key_path = self.certs_dir.join(format!("{}.key", name));
        
        fs::write(&cert_path, &cert.certificate)?;
        fs::write(&key_path, &cert.private_key)?;
        
        Ok((cert_path, key_path))
    }
    
    /// Load certificate from PEM files
    pub fn load_certificate_pem(
        &self,
        cert_path: &Path,
        key_path: &Path,
    ) -> Result<CertificateWithKey> {
        let certificate = fs::read_to_string(cert_path)?;
        let private_key = fs::read_to_string(key_path)?;
        
        Ok(CertificateWithKey {
            certificate,
            private_key,
            format: CertificateFormat::Pem,
        })
    }
    
    /// List available certificates
    pub fn list_certificates(&self) -> Result<Vec<String>> {
        let mut certs = Vec::new();
        
        if let Ok(entries) = fs::read_dir(&self.certs_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("crt") {
                    if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                        certs.push(stem.to_string());
                    }
                }
            }
        }
        
        certs.sort();
        Ok(certs)
    }
    
    /// Get certificate as base64-encoded DER (for BinarySecurityToken)
    pub fn get_certificate_der_base64(&self, cert: &CertificateWithKey) -> Result<String> {
        // Parse PEM to get DER
        let pem = pem::parse(&cert.certificate)
            .map_err(|e| anyhow!("Failed to parse certificate PEM: {}", e))?;
        
        // Encode as base64
        Ok(BASE64.encode(pem.contents()))
    }
    
    /// Build WS-Security BinarySecurityToken XML
    pub fn build_binary_security_token(&self, cert: &CertificateWithKey) -> Result<String> {
        let cert_b64 = self.get_certificate_der_base64(cert)?;
        
        Ok(format!(
            concat!(
                "<wsse:BinarySecurityToken ",
                "xmlns:wsse=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\" ",
                "xmlns:wsu=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd\" ",
                "EncodingType=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary\" ",
                "ValueType=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3\" ",
                "wsu:Id=\"X509Token\">{}</wsse:BinarySecurityToken>"
            ),
            cert_b64
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    
    fn get_temp_dir() -> PathBuf {
        env::temp_dir().join("apinox_cert_test")
    }
    
    #[test]
    fn test_generate_self_signed() {
        let manager = CertificateManager::new(get_temp_dir()).unwrap();
        
        let cert = manager.generate_self_signed(
            "test.example.com",
            Some("Test Org"),
            Some("US"),
            365,
        ).unwrap();
        
        assert!(cert.certificate.contains("BEGIN CERTIFICATE"));
        assert!(cert.certificate.contains("END CERTIFICATE"));
        assert!(cert.private_key.contains("BEGIN PRIVATE KEY"));
        assert!(cert.private_key.contains("END PRIVATE KEY"));
    }
    
    #[test]
    fn test_save_and_load_certificate() {
        let manager = CertificateManager::new(get_temp_dir()).unwrap();
        
        let cert = manager.generate_self_signed(
            "test.example.com",
            Some("Test Org"),
            None,
            365,
        ).unwrap();
        
        let (cert_path, key_path) = manager.save_certificate("test_cert", &cert).unwrap();
        assert!(cert_path.exists());
        assert!(key_path.exists());
        
        let loaded = manager.load_certificate_pem(&cert_path, &key_path).unwrap();
        assert_eq!(loaded.certificate, cert.certificate);
        assert_eq!(loaded.private_key, cert.private_key);
        
        // Cleanup
        let _ = fs::remove_file(cert_path);
        let _ = fs::remove_file(key_path);
    }
    
    #[test]
    fn test_list_certificates() {
        let manager = CertificateManager::new(get_temp_dir()).unwrap();
        
        let cert = manager.generate_self_signed(
            "list-test.example.com",
            None,
            None,
            365,
        ).unwrap();
        
        manager.save_certificate("list_test", &cert).unwrap();
        
        let certs = manager.list_certificates().unwrap();
        assert!(certs.contains(&"list_test".to_string()));
        
        // Cleanup
        let _ = fs::remove_file(manager.certs_dir.join("list_test.crt"));
        let _ = fs::remove_file(manager.certs_dir.join("list_test.key"));
    }
    
    #[test]
    fn test_binary_security_token() {
        let manager = CertificateManager::new(get_temp_dir()).unwrap();
        
        let cert = manager.generate_self_signed(
            "token-test.example.com",
            None,
            None,
            365,
        ).unwrap();
        
        let token_xml = manager.build_binary_security_token(&cert).unwrap();
        
        // Check token structure
        assert!(token_xml.contains("BinarySecurityToken"));
        assert!(token_xml.contains("X509Token"));
        assert!(token_xml.contains("Base64Binary"));
        assert!(token_xml.contains("X509v3"));
    }
}
