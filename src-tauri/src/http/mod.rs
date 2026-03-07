// HTTP client module
// Handles REST/HTTP requests with proxy support

pub mod client;
pub mod commands;

pub use client::{HttpClient, HttpRequest, HttpResponse};
