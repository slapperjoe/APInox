use anyhow::{Context, Result};
use reqwest::{Client, Method, Proxy};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub timeout_ms: Option<u64>,
    pub follow_redirects: Option<bool>,
    pub verify_ssl: Option<bool>,
    pub proxy_url: Option<String>,
    pub proxy_username: Option<String>,
    pub proxy_password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpResponse {
    pub success: bool,
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub time_taken_ms: u64,
    pub error: Option<String>,
}

pub struct HttpClient {
    client: Client,
}

impl HttpClient {
    /// Create a new HTTP client with default settings
    pub fn new() -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to create HTTP client")?;
        
        Ok(Self { client })
    }

    /// Create a custom HTTP client with specific settings
    pub fn with_settings(
        timeout_ms: Option<u64>,
        follow_redirects: bool,
        verify_ssl: bool,
        proxy_url: Option<String>,
        proxy_username: Option<String>,
        proxy_password: Option<String>,
    ) -> Result<Self> {
        let mut builder = Client::builder()
            .danger_accept_invalid_certs(!verify_ssl);

        if let Some(timeout) = timeout_ms {
            builder = builder.timeout(Duration::from_millis(timeout));
        }

        if follow_redirects {
            builder = builder.redirect(reqwest::redirect::Policy::limited(10));
        } else {
            builder = builder.redirect(reqwest::redirect::Policy::none());
        }

        // Configure proxy if provided
        if let Some(proxy_url_str) = proxy_url {
            let mut proxy = Proxy::all(&proxy_url_str)
                .context("Failed to configure proxy")?;
            
            if let (Some(username), Some(password)) = (proxy_username, proxy_password) {
                proxy = proxy.basic_auth(&username, &password);
            }
            
            builder = builder.proxy(proxy);
        }

        let client = builder.build()
            .context("Failed to create HTTP client")?;
        
        Ok(Self { client })
    }

    /// Execute an HTTP request
    pub async fn execute(&self, request: HttpRequest) -> HttpResponse {
        let start = Instant::now();
        
        match self.execute_internal(request).await {
            Ok(response) => response,
            Err(e) => HttpResponse {
                success: false,
                status: 0,
                status_text: "Error".to_string(),
                headers: HashMap::new(),
                body: String::new(),
                time_taken_ms: start.elapsed().as_millis() as u64,
                error: Some(e.to_string()),
            }
        }
    }

    async fn execute_internal(&self, request: HttpRequest) -> Result<HttpResponse> {
        let start = Instant::now();
        
        // Parse HTTP method
        let method = Method::from_bytes(request.method.as_bytes())
            .context("Invalid HTTP method")?;

        // Build client for this request if custom settings needed
        let client = if request.timeout_ms.is_some() 
            || request.follow_redirects.is_some() 
            || request.verify_ssl.is_some()
            || request.proxy_url.is_some() 
        {
            Self::with_settings(
                request.timeout_ms,
                request.follow_redirects.unwrap_or(true),
                request.verify_ssl.unwrap_or(true),
                request.proxy_url,
                request.proxy_username,
                request.proxy_password,
            )?
        } else {
            Self::new()?
        };

        // Build request
        let mut req_builder = client.client.request(method, &request.url);

        // Add headers
        for (key, value) in &request.headers {
            req_builder = req_builder.header(key, value);
        }

        // Add body if present
        if let Some(body) = &request.body {
            req_builder = req_builder.body(body.clone());
        }

        // Execute request
        let response = req_builder.send().await
            .context("Failed to send HTTP request")?;

        let status = response.status();
        let status_code = status.as_u16();
        let status_text = status.canonical_reason().unwrap_or("Unknown").to_string();

        // Extract headers
        let mut headers = HashMap::new();
        for (key, value) in response.headers() {
            if let Ok(value_str) = value.to_str() {
                headers.insert(key.to_string(), value_str.to_string());
            }
        }

        // Read body
        let body = response.text().await
            .context("Failed to read response body")?;

        let time_taken_ms = start.elapsed().as_millis() as u64;

        Ok(HttpResponse {
            success: status.is_success(),
            status: status_code,
            status_text,
            headers,
            body,
            time_taken_ms,
            error: None,
        })
    }

    /// Convenience method for GET request
    pub async fn get(&self, url: &str, headers: HashMap<String, String>) -> HttpResponse {
        self.execute(HttpRequest {
            method: "GET".to_string(),
            url: url.to_string(),
            headers,
            body: None,
            timeout_ms: None,
            follow_redirects: None,
            verify_ssl: None,
            proxy_url: None,
            proxy_username: None,
            proxy_password: None,
        }).await
    }

    /// Convenience method for POST request
    pub async fn post(
        &self,
        url: &str,
        headers: HashMap<String, String>,
        body: String,
    ) -> HttpResponse {
        self.execute(HttpRequest {
            method: "POST".to_string(),
            url: url.to_string(),
            headers,
            body: Some(body),
            timeout_ms: None,
            follow_redirects: None,
            verify_ssl: None,
            proxy_url: None,
            proxy_username: None,
            proxy_password: None,
        }).await
    }

    /// Convenience method for PUT request
    pub async fn put(
        &self,
        url: &str,
        headers: HashMap<String, String>,
        body: String,
    ) -> HttpResponse {
        self.execute(HttpRequest {
            method: "PUT".to_string(),
            url: url.to_string(),
            headers,
            body: Some(body),
            timeout_ms: None,
            follow_redirects: None,
            verify_ssl: None,
            proxy_url: None,
            proxy_username: None,
            proxy_password: None,
        }).await
    }

    /// Convenience method for DELETE request
    pub async fn delete(&self, url: &str, headers: HashMap<String, String>) -> HttpResponse {
        self.execute(HttpRequest {
            method: "DELETE".to_string(),
            url: url.to_string(),
            headers,
            body: None,
            timeout_ms: None,
            follow_redirects: None,
            verify_ssl: None,
            proxy_url: None,
            proxy_username: None,
            proxy_password: None,
        }).await
    }

    /// Convenience method for PATCH request
    pub async fn patch(
        &self,
        url: &str,
        headers: HashMap<String, String>,
        body: String,
    ) -> HttpResponse {
        self.execute(HttpRequest {
            method: "PATCH".to_string(),
            url: url.to_string(),
            headers,
            body: Some(body),
            timeout_ms: None,
            follow_redirects: None,
            verify_ssl: None,
            proxy_url: None,
            proxy_username: None,
            proxy_password: None,
        }).await
    }
}

impl Default for HttpClient {
    fn default() -> Self {
        Self::new().expect("Failed to create default HTTP client")
    }
}
