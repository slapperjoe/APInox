// SOAP module
// Handles SOAP envelope building, WS-Security, and SOAP client operations

pub mod client;
pub mod ws_security;

pub use client::SoapClient;
