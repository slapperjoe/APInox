/// WS-Security Implementation
/// 
/// Implements WS-Security 1.1 headers for SOAP envelopes:
/// - UsernameToken (PasswordText and PasswordDigest)
/// - Timestamp (Created/Expires)
/// - Nonce generation
/// - X.509 certificate support (stub for Phase 6)

use anyhow::Result;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use chrono::{DateTime, Utc, Duration};
use rand::Rng;
use sha1::{Sha1, Digest};

/// WS-Security namespace constants
pub const WSSE_NS: &str = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd";
pub const WSU_NS: &str = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd";
pub const PASSWORD_TEXT_TYPE: &str = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText";
pub const PASSWORD_DIGEST_TYPE: &str = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest";

/// Password type for UsernameToken
#[derive(Debug, Clone, PartialEq)]
pub enum PasswordType {
    /// Plain text password
    Text,
    /// SHA-1 digest of (Nonce + Created + Password)
    Digest,
}

/// UsernameToken credentials
#[derive(Debug, Clone)]
pub struct UsernameToken {
    pub username: String,
    pub password: String,
    pub password_type: PasswordType,
}

impl UsernameToken {
    pub fn new(username: String, password: String, password_type: PasswordType) -> Self {
        Self {
            username,
            password,
            password_type,
        }
    }
    
    pub fn text(username: String, password: String) -> Self {
        Self::new(username, password, PasswordType::Text)
    }
    
    pub fn digest(username: String, password: String) -> Self {
        Self::new(username, password, PasswordType::Digest)
    }
}

/// Timestamp configuration
#[derive(Debug, Clone)]
pub struct Timestamp {
    /// When the security context was created
    pub created: DateTime<Utc>,
    /// When the security context expires
    pub expires: DateTime<Utc>,
}

impl Timestamp {
    /// Create a timestamp valid for the specified duration (default: 5 minutes)
    pub fn new(duration_seconds: i64) -> Self {
        let created = Utc::now();
        let expires = created + Duration::seconds(duration_seconds);
        Self { created, expires }
    }
    
    /// Create a timestamp with default 5-minute validity
    pub fn default_config() -> Self {
        Self::new(300)
    }
}

impl Default for Timestamp {
    fn default() -> Self {
        Self::default_config()
    }
}

/// WS-Security configuration
#[derive(Debug, Clone, Default)]
pub struct WsSecurityConfig {
    pub username_token: Option<UsernameToken>,
    pub timestamp: Option<Timestamp>,
    pub add_nonce: bool,
    // Future: X.509 certificate support
    // pub certificate: Option<Certificate>,
}

impl WsSecurityConfig {
    pub fn new() -> Self {
        Self::default()
    }
    
    pub fn with_username_token(mut self, token: UsernameToken) -> Self {
        self.username_token = Some(token);
        self
    }
    
    pub fn with_timestamp(mut self, timestamp: Timestamp) -> Self {
        self.timestamp = Some(timestamp);
        self
    }
    
    pub fn with_default_timestamp(mut self) -> Self {
        self.timestamp = Some(Timestamp::default());
        self
    }
    
    pub fn with_nonce(mut self) -> Self {
        self.add_nonce = true;
        self
    }
}

/// Generate a random nonce (16 bytes, base64-encoded)
pub fn generate_nonce() -> String {
    let mut rng = rand::thread_rng();
    let nonce_bytes: [u8; 16] = rng.gen();
    BASE64.encode(nonce_bytes)
}

/// Generate password digest: Base64(SHA-1(Nonce + Created + Password))
pub fn generate_password_digest(nonce: &str, created: &str, password: &str) -> Result<String> {
    // Decode nonce from base64
    let nonce_bytes = BASE64.decode(nonce)?;
    
    // Concatenate: Nonce + Created + Password
    let mut hasher = Sha1::new();
    hasher.update(&nonce_bytes);
    hasher.update(created.as_bytes());
    hasher.update(password.as_bytes());
    
    // Get SHA-1 hash and encode to base64
    let digest = hasher.finalize();
    Ok(BASE64.encode(digest))
}

/// Build WS-Security header XML
pub fn build_security_header(config: &WsSecurityConfig) -> Result<String> {
    let mut header = String::new();
    
    header.push_str(&format!(
        r#"<wsse:Security xmlns:wsse="{}" xmlns:wsu="{}">"#,
        WSSE_NS, WSU_NS
    ));
    
    // Add Timestamp if configured
    if let Some(ref timestamp) = config.timestamp {
        header.push_str(&format!(
            r#"
  <wsu:Timestamp wsu:Id="TS-{}">
    <wsu:Created>{}</wsu:Created>
    <wsu:Expires>{}</wsu:Expires>
  </wsu:Timestamp>"#,
            generate_id(),
            timestamp.created.format("%Y-%m-%dT%H:%M:%S%.3fZ"),
            timestamp.expires.format("%Y-%m-%dT%H:%M:%S%.3fZ")
        ));
    }
    
    // Add UsernameToken if configured
    if let Some(ref token) = config.username_token {
        header.push_str(&format!(
            r#"
  <wsse:UsernameToken wsu:Id="UsernameToken-{}">
    <wsse:Username>{}</wsse:Username>"#,
            generate_id(),
            xml_escape(&token.username)
        ));
        
        match token.password_type {
            PasswordType::Text => {
                header.push_str(&format!(
                    r#"
    <wsse:Password Type="{}">{}</wsse:Password>"#,
                    PASSWORD_TEXT_TYPE,
                    xml_escape(&token.password)
                ));
            }
            PasswordType::Digest => {
                // Generate nonce and created timestamp
                let nonce = generate_nonce();
                let created = Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
                
                // Generate password digest
                let digest = generate_password_digest(&nonce, &created, &token.password)?;
                
                header.push_str(&format!(
                    r#"
    <wsse:Password Type="{}">{}</wsse:Password>
    <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">{}</wsse:Nonce>
    <wsu:Created>{}</wsu:Created>"#,
                    PASSWORD_DIGEST_TYPE,
                    digest,
                    nonce,
                    created
                ));
            }
        }
        
        header.push_str("\n  </wsse:UsernameToken>");
    }
    
    header.push_str("\n</wsse:Security>");
    
    Ok(header)
}

/// Generate a unique ID for WS-Security elements
fn generate_id() -> String {
    let mut rng = rand::thread_rng();
    let id: u64 = rng.gen();
    format!("{}", id)
}

/// XML escape helper (duplicated from envelope_builder, could be shared)
fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_generate_nonce() {
        let nonce = generate_nonce();
        assert!(!nonce.is_empty());
        
        // Should be base64 encoded (16 bytes = 24 chars in base64, but padding may vary)
        assert!(nonce.len() >= 20);
        
        // Should be different each time
        let nonce2 = generate_nonce();
        assert_ne!(nonce, nonce2);
    }
    
    #[test]
    fn test_password_digest() {
        let nonce = BASE64.encode(b"test_nonce_12345");
        let created = "2024-01-01T12:00:00.000Z";
        let password = "secret123";
        
        let digest = generate_password_digest(&nonce, created, password).unwrap();
        
        // Should be base64 encoded SHA-1 (20 bytes = 28 chars in base64)
        assert_eq!(digest.len(), 28);
        
        // Same inputs should produce same digest
        let digest2 = generate_password_digest(&nonce, created, password).unwrap();
        assert_eq!(digest, digest2);
        
        // Different password should produce different digest
        let digest3 = generate_password_digest(&nonce, created, "different").unwrap();
        assert_ne!(digest, digest3);
    }
    
    #[test]
    fn test_username_token_text() {
        let config = WsSecurityConfig::new()
            .with_username_token(UsernameToken::text("admin".to_string(), "pass123".to_string()));
        
        let header = build_security_header(&config).unwrap();
        
        assert!(header.contains("<wsse:Security"));
        assert!(header.contains("<wsse:UsernameToken"));
        assert!(header.contains("<wsse:Username>admin</wsse:Username>"));
        assert!(header.contains("<wsse:Password Type=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText\">pass123</wsse:Password>"));
    }
    
    #[test]
    fn test_username_token_digest() {
        let config = WsSecurityConfig::new()
            .with_username_token(UsernameToken::digest("admin".to_string(), "pass123".to_string()));
        
        let header = build_security_header(&config).unwrap();
        
        assert!(header.contains("<wsse:Security"));
        assert!(header.contains("<wsse:UsernameToken"));
        assert!(header.contains("<wsse:Username>admin</wsse:Username>"));
        assert!(header.contains("Type=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest\""));
        assert!(header.contains("<wsse:Nonce"));
        assert!(header.contains("<wsu:Created>"));
        
        // Should NOT contain plain password
        assert!(!header.contains("pass123"));
    }
    
    #[test]
    fn test_timestamp() {
        let config = WsSecurityConfig::new()
            .with_default_timestamp();
        
        let header = build_security_header(&config).unwrap();
        
        assert!(header.contains("<wsu:Timestamp"));
        assert!(header.contains("<wsu:Created>"));
        assert!(header.contains("<wsu:Expires>"));
    }
    
    #[test]
    fn test_combined_security() {
        let config = WsSecurityConfig::new()
            .with_username_token(UsernameToken::text("admin".to_string(), "pass123".to_string()))
            .with_default_timestamp();
        
        let header = build_security_header(&config).unwrap();
        
        // Should have both timestamp and username token
        assert!(header.contains("<wsu:Timestamp"));
        assert!(header.contains("<wsse:UsernameToken"));
        assert!(header.contains("<wsse:Username>admin</wsse:Username>"));
    }
    
    #[test]
    fn test_xml_escaping() {
        let config = WsSecurityConfig::new()
            .with_username_token(UsernameToken::text(
                "user<>&\"'".to_string(),
                "pass<>&\"'".to_string()
            ));
        
        let header = build_security_header(&config).unwrap();
        
        // Should escape special XML characters
        assert!(header.contains("&lt;"));
        assert!(header.contains("&gt;"));
        assert!(header.contains("&amp;"));
        assert!(header.contains("&quot;"));
        assert!(header.contains("&apos;"));
    }
}
