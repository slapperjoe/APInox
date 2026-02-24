/// Tauri Commands for Certificate Management
/// 
/// Frontend-facing commands for certificate operations

use anyhow::Result;
use serde::{Deserialize, Serialize};
use crate::soap::{CertificateManager, CertificateWithKey};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateCertificateRequest {
    pub common_name: String,
    pub organization: Option<String>,
    pub country: Option<String>,
    pub validity_days: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveCertificateRequest {
    pub name: String,
    pub certificate: String,
    pub private_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CertificateInfo {
    pub name: String,
    pub certificate: String,
    pub private_key: String,
}

/// Generate a self-signed certificate
#[tauri::command]
pub async fn generate_certificate(
    request: GenerateCertificateRequest,
    config_dir: tauri::State<'_, String>,
) -> Result<CertificateInfo, String> {
    log::info!("Generating certificate: {}", request.common_name);
    
    let certs_dir = PathBuf::from(config_dir.inner()).join("certificates");
    let manager = CertificateManager::new(certs_dir)
        .map_err(|e| format!("Failed to create certificate manager: {}", e))?;
    
    let cert = manager.generate_self_signed(
        &request.common_name,
        request.organization.as_deref(),
        request.country.as_deref(),
        request.validity_days,
    ).map_err(|e| format!("Failed to generate certificate: {}", e))?;
    
    Ok(CertificateInfo {
        name: request.common_name.clone(),
        certificate: cert.certificate,
        private_key: cert.private_key,
    })
}

/// Save a certificate to the certificate store
#[tauri::command]
pub async fn save_certificate(
    request: SaveCertificateRequest,
    config_dir: tauri::State<'_, String>,
) -> Result<String, String> {
    log::info!("Saving certificate: {}", request.name);
    
    let certs_dir = PathBuf::from(config_dir.inner()).join("certificates");
    let manager = CertificateManager::new(certs_dir)
        .map_err(|e| format!("Failed to create certificate manager: {}", e))?;
    
    let cert = CertificateWithKey {
        certificate: request.certificate,
        private_key: request.private_key,
        format: crate::soap::CertificateFormat::Pem,
    };
    
    let (cert_path, _) = manager.save_certificate(&request.name, &cert)
        .map_err(|e| format!("Failed to save certificate: {}", e))?;
    
    Ok(cert_path.to_string_lossy().to_string())
}

/// List all available certificates
#[tauri::command]
pub async fn list_certificates(
    config_dir: tauri::State<'_, String>,
) -> Result<Vec<String>, String> {
    let certs_dir = PathBuf::from(config_dir.inner()).join("certificates");
    let manager = CertificateManager::new(certs_dir)
        .map_err(|e| format!("Failed to create certificate manager: {}", e))?;
    
    let certs = manager.list_certificates()
        .map_err(|e| format!("Failed to list certificates: {}", e))?;
    
    Ok(certs)
}

/// Load a certificate from the store
#[tauri::command]
pub async fn load_certificate(
    name: String,
    config_dir: tauri::State<'_, String>,
) -> Result<CertificateInfo, String> {
    log::info!("Loading certificate: {}", name);
    
    let certs_dir = PathBuf::from(config_dir.inner()).join("certificates");
    let manager = CertificateManager::new(certs_dir)
        .map_err(|e| format!("Failed to create certificate manager: {}", e))?;
    
    let cert_path = PathBuf::from(config_dir.inner()).join("certificates").join(format!("{}.crt", name));
    let key_path = PathBuf::from(config_dir.inner()).join("certificates").join(format!("{}.key", name));
    
    let cert = manager.load_certificate_pem(&cert_path, &key_path)
        .map_err(|e| format!("Failed to load certificate: {}", e))?;
    
    Ok(CertificateInfo {
        name,
        certificate: cert.certificate,
        private_key: cert.private_key,
    })
}
