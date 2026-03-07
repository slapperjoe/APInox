/// Certificate Manager Demonstration
/// 
/// Shows X.509 certificate generation, loading, and usage in SOAP WS-Security

use anyhow::Result;
use apinox_lib::soap::CertificateManager;
use std::env;

#[tokio::main]
async fn main() -> Result<()> {
    println!("=== Certificate Manager Demonstration ===\n");
    
    // Create certificate manager with temp directory
    let certs_dir = env::temp_dir().join("apinox_demo_certs");
    let manager = CertificateManager::new(certs_dir)?;
    
    // Demo 1: Generate self-signed certificate
    demo_generate(&manager)?;
    
    // Demo 2: Save and load certificate
    demo_save_load(&manager)?;
    
    // Demo 3: Binary security token
    demo_binary_token(&manager)?;
    
    // Demo 4: List certificates
    demo_list(&manager)?;
    
    println!("\n=== All Demos Complete ===");
    Ok(())
}

fn demo_generate(manager: &CertificateManager) -> Result<()> {
    println!("--- Demo 1: Generate Self-Signed Certificate ---");
    
    let cert = manager.generate_self_signed(
        "demo.apinox.com",
        Some("APInox Demo"),
        Some("US"),
        365,
    )?;
    
    println!("  Common Name: demo.apinox.com");
    println!("  Organization: APInox Demo");
    println!("  Country: US");
    println!("  Validity: 365 days");
    println!("  Format: {:?}", cert.format);
    println!("  Certificate length: {} bytes", cert.certificate.len());
    println!("  Private key length: {} bytes", cert.private_key.len());
    
    // Show first few lines
    let cert_lines: Vec<&str> = cert.certificate.lines().take(3).collect();
    println!("  Certificate preview:");
    for line in cert_lines {
        println!("    {}", line);
    }
    println!("    ...");
    println!();
    
    Ok(())
}

fn demo_save_load(manager: &CertificateManager) -> Result<()> {
    println!("--- Demo 2: Save and Load Certificate ---");
    
    let cert = manager.generate_self_signed(
        "save-demo.apinox.com",
        None,
        None,
        365,
    )?;
    
    let (cert_path, key_path) = manager.save_certificate("demo_cert", &cert)?;
    
    println!("  Saved certificate to: {}", cert_path.display());
    println!("  Saved private key to: {}", key_path.display());
    
    let loaded = manager.load_certificate_pem(&cert_path, &key_path)?;
    
    println!("  Loaded certificate successfully");
    println!("  Certificate matches: {}", loaded.certificate == cert.certificate);
    println!("  Private key matches: {}", loaded.private_key == cert.private_key);
    println!();
    
    // Cleanup
    let _ = std::fs::remove_file(cert_path);
    let _ = std::fs::remove_file(key_path);
    
    Ok(())
}

fn demo_binary_token(manager: &CertificateManager) -> Result<()> {
    println!("--- Demo 3: WS-Security Binary Security Token ---");
    
    let cert = manager.generate_self_signed(
        "token-demo.apinox.com",
        None,
        None,
        365,
    )?;
    
    let token_xml = manager.build_binary_security_token(&cert)?;
    
    println!("  Generated BinarySecurityToken XML:");
    println!("  Length: {} bytes", token_xml.len());
    
    // Show condensed version
    let token_preview = if token_xml.len() > 200 {
        format!("{}... (truncated)", &token_xml[..200])
    } else {
        token_xml.clone()
    };
    
    println!("  Preview:");
    for line in token_preview.lines() {
        println!("    {}", line);
    }
    
    println!("  Contains 'BinarySecurityToken': {}", token_xml.contains("BinarySecurityToken"));
    println!("  Contains 'X509Token': {}", token_xml.contains("X509Token"));
    println!();
    
    Ok(())
}

fn demo_list(manager: &CertificateManager) -> Result<()> {
    println!("--- Demo 4: List Certificates ---");
    
    // Generate a few certificates
    let cert1 = manager.generate_self_signed("list1.apinox.com", None, None, 365)?;
    let cert2 = manager.generate_self_signed("list2.apinox.com", None, None, 365)?;
    
    let (cert1_path, key1_path) = manager.save_certificate("list_cert_1", &cert1)?;
    let (cert2_path, key2_path) = manager.save_certificate("list_cert_2", &cert2)?;
    
    let certs = manager.list_certificates()?;
    
    println!("  Found {} certificate(s):", certs.len());
    for cert_name in &certs {
        println!("    - {}", cert_name);
    }
    println!();
    
    // Cleanup
    let _ = std::fs::remove_file(cert1_path);
    let _ = std::fs::remove_file(key1_path);
    let _ = std::fs::remove_file(cert2_path);
    let _ = std::fs::remove_file(key2_path);
    
    Ok(())
}
