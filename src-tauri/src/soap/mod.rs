// SOAP module
// Handles SOAP envelope building, WS-Security, and SOAP client operations

pub mod client;
pub mod ws_security;
pub mod envelope_builder;
pub mod commands;
pub mod certificate_manager;

pub use envelope_builder::{EnvelopeBuilder, SoapVersion};
pub use ws_security::{WsSecurityConfig, UsernameToken, PasswordType, Timestamp, generate_nonce, generate_password_digest};
pub use client::{SoapClient, SoapResponse, SoapFault};
pub use commands::execute_soap_request;
pub use certificate_manager::{CertificateManager, CertificateWithKey, CertificateFormat};

