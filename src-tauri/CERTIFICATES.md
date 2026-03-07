# Certificate Management

The APInox certificate manager handles X.509 certificate generation, loading, and usage in SOAP WS-Security scenarios.

## Features

- **Self-Signed Certificate Generation**: Create X.509 certificates for testing
- **Certificate Storage**: Save and load certificates from PEM files
- **Binary Security Token**: Generate WS-Security BinarySecurityToken XML
- **Certificate Listing**: List all available certificates

## Usage

### Creating a Certificate Manager

```rust
use apinox_lib::soap::CertificateManager;
use std::path::PathBuf;

let certs_dir = PathBuf::from("/path/to/certificates");
let manager = CertificateManager::new(certs_dir)?;
```

### Generating a Self-Signed Certificate

```rust
let cert = manager.generate_self_signed(
    "myservice.example.com",  // Common name
    Some("My Organization"),   // Organization (optional)
    Some("US"),                // Country code (optional)
    365,                       // Validity in days
)?;

println!("Certificate: {}", cert.certificate);
println!("Private Key: {}", cert.private_key);
```

**Output**:
```
Certificate: -----BEGIN CERTIFICATE-----
MIIBZDCCAQqgAwIBAgIU...
-----END CERTIFICATE-----

Private Key: -----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49...
-----END PRIVATE KEY-----
```

### Saving and Loading Certificates

```rust
// Save to files
let (cert_path, key_path) = manager.save_certificate("my_cert", &cert)?;
// Saves to:
//   /path/to/certificates/my_cert.crt
//   /path/to/certificates/my_cert.key

// Load from files
let loaded_cert = manager.load_certificate_pem(&cert_path, &key_path)?;
```

### Listing Certificates

```rust
let certs = manager.list_certificates()?;
for cert_name in certs {
    println!("Found certificate: {}", cert_name);
}
```

### Binary Security Token (WS-Security)

Generate a `<wsse:BinarySecurityToken>` for SOAP requests:

```rust
let token_xml = manager.build_binary_security_token(&cert)?;
```

**Output**:
```xml
<wsse:BinarySecurityToken 
    xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" 
    xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" 
    EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary" 
    ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" 
    wsu:Id="X509Token">MIIBZDCCAQqgAwIBAgIU...</wsse:BinarySecurityToken>
```

This XML can be embedded in the `<soap:Header>` section for certificate-based authentication.

## Certificate Formats

### CertificateFormat

```rust
pub enum CertificateFormat {
    Pem,    // PEM format (Base64-encoded with headers)
    Der,    // DER format (binary)
}
```

### CertificateWithKey

```rust
pub struct CertificateWithKey {
    pub certificate: String,      // PEM-encoded certificate
    pub private_key: String,       // PEM-encoded private key
    pub format: CertificateFormat,
}
```

## Integration with WS-Security

Certificates can be used with the WS-Security module for SOAP authentication:

```rust
use apinox_lib::soap::{CertificateManager, EnvelopeBuilder};

// Generate certificate
let manager = CertificateManager::new(certs_dir)?;
let cert = manager.generate_self_signed("api.example.com", None, None, 365)?;

// Build binary security token
let token_xml = manager.build_binary_security_token(&cert)?;

// Embed in SOAP envelope (manual approach)
let envelope = format!(
    r#"<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      {}
    </wsse:Security>
  </soap:Header>
  <soap:Body>
    <!-- Your request here -->
  </soap:Body>
</soap:Envelope>"#,
    token_xml
);
```

## Limitations

**Current Implementation**:
- ✅ Self-signed certificate generation
- ✅ PEM format support
- ✅ Certificate save/load
- ✅ Binary security token generation
- ✅ Certificate listing

**Future Enhancements** (not yet implemented):
- [ ] PKCS#12 (.pfx, .p12) support
- [ ] Certificate signing with private CA
- [ ] XML signature generation (currently only provides BinarySecurityToken)
- [ ] Certificate chain validation
- [ ] CRL (Certificate Revocation List) support
- [ ] Custom distinguished name fields
- [ ] Custom validity periods (currently defaults from rcgen)

## Implementation Details

### Dependencies

- **rcgen**: X.509 certificate generation
- **pem**: PEM encoding/decoding
- **base64**: Base64 encoding for DER certificates
- **time**: Date/time handling for validity periods

### Certificate Generation

Uses `rcgen::generate_simple_self_signed()` for quick self-signed certificate creation. The certificate includes:
- Common name in Subject Alternative Name (SAN)
- Elliptic Curve (EC) private key
- 365-day validity (default from rcgen)
- No CA capabilities

### Storage Format

Certificates are stored as:
- `{name}.crt` - PEM-encoded certificate
- `{name}.key` - PEM-encoded private key

Both files are plain text and can be inspected with:
```bash
openssl x509 -in cert.crt -text -noout
openssl ec -in cert.key -text -noout
```

## Testing

Run the unit tests:
```bash
cd src-tauri
cargo test certificate_manager
```

Run the demo example:
```bash
cd src-tauri
cargo run --example certificate_demo
```

## Security Considerations

**For Testing Only**: Self-signed certificates generated by this module are suitable for **development and testing** only. For production use:

1. Use certificates from a trusted Certificate Authority (CA)
2. Protect private keys with appropriate file permissions
3. Never commit private keys to version control
4. Rotate certificates before expiry
5. Use strong key algorithms (RSA 2048+, EC P-256+)

**Private Key Storage**: Private keys are stored unencrypted in PEM files. Consider:
- Setting restrictive file permissions (chmod 600)
- Using OS keychain/keystore for sensitive environments
- Encrypting at rest with tools like HashiCorp Vault

## Examples

See `src-tauri/examples/certificate_demo.rs` for comprehensive examples of:
- Certificate generation
- Save/load operations
- Binary security token generation
- Certificate listing

## API Reference

### CertificateManager Methods

| Method | Description |
|--------|-------------|
| `new(certs_dir)` | Create certificate manager with storage directory |
| `generate_self_signed(cn, org, country, days)` | Generate self-signed X.509 certificate |
| `save_certificate(name, cert)` | Save certificate and private key to files |
| `load_certificate_pem(cert_path, key_path)` | Load certificate from PEM files |
| `list_certificates()` | List all certificate names in storage directory |
| `get_certificate_der_base64(cert)` | Get base64-encoded DER certificate |
| `build_binary_security_token(cert)` | Generate WS-Security BinarySecurityToken XML |

### Types

- `CertificateManager` - Main manager struct
- `CertificateWithKey` - Certificate + private key pair
- `CertificateFormat` - Enum: Pem, Der

## Related Documentation

- [WS-SECURITY.md](./WS-SECURITY.md) - WS-Security implementation
- [SOAP-EXECUTION.md](./SOAP-EXECUTION.md) - SOAP client usage
- [certificate_demo.rs](./examples/certificate_demo.rs) - Example code
