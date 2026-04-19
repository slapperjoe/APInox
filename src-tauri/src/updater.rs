//! Self-update mechanism for APInox.
//!
//! Checks GitHub Releases for newer versions, downloads the Windows NSIS
//! installer, and launches it so the user can update without leaving the app.

use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::io::AsyncWriteExt;
use crate::settings_manager::load_config_internal;

const GITHUB_API_URL: &str =
    "https://api.github.com/repos/slapperjoe/apinox/releases/latest";
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

// ── Serializable result returned to the frontend ───────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    /// Windows NSIS installer download URL, or `None` when not on Windows or
    /// when no matching asset was found in the release.
    pub download_url: Option<String>,
    /// HTML URL of the release page — used for browser-open on non-Windows.
    pub release_url: String,
    /// Trimmed release body (first 2 000 chars).
    pub release_notes: String,
}

// ── Internal GitHub API shapes ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
    body: Option<String>,
    assets: Vec<GitHubAsset>,
}

#[derive(Debug, Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

// ── Version comparison helper ──────────────────────────────────────────────

/// Returns `true` when `latest` is strictly newer than `current`.
/// Strips a leading `v`, then compares `[major, minor, patch]` numerically.
fn is_newer(latest: &str, current: &str) -> bool {
    let parse = |v: &str| -> [u64; 3] {
        let s = v.trim_start_matches('v');
        let parts: Vec<u64> = s
            .split('.')
            .filter_map(|p| p.parse().ok())
            .collect();
        [
            parts.first().copied().unwrap_or(0),
            parts.get(1).copied().unwrap_or(0),
            parts.get(2).copied().unwrap_or(0),
        ]
    };
    parse(latest) > parse(current)
}

// ── Shared reqwest client factory ──────────────────────────────────────────

/// Reads the Windows system proxy from the Internet Settings registry key.
/// Returns `Some("http://host:port")` when a *manual* proxy is enabled, `None` otherwise.
/// Note: this does NOT handle WPAD/PAC-only setups — use `resolve_wpad_proxy` for those.
#[cfg(target_os = "windows")]
fn read_windows_system_proxy() -> Option<String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let settings = hkcu
        .open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Internet Settings")
        .ok()?;

    let enabled: u32 = settings.get_value("ProxyEnable").ok()?;
    if enabled == 0 {
        return None;
    }

    let server: String = settings.get_value("ProxyServer").ok()?;
    if server.is_empty() {
        return None;
    }

    // The registry value may be bare `host:port` or already `http://host:port`.
    // reqwest requires a full URL scheme.
    if server.contains("://") {
        Some(server)
    } else {
        Some(format!("http://{}", server))
    }
}

/// Asks .NET (via a PowerShell subprocess) for the effective proxy for a given URL.
/// This handles WPAD auto-detect, PAC files, and Group Policy — the same path
/// that Edge and IE use.  Returns the proxy URL string, or `None` if direct or
/// if the lookup fails.
///
/// The PowerShell one-liner is intentionally minimal and non-interactive so it
/// starts fast (~200–300 ms).  It is only called when no manual proxy is found.
#[cfg(target_os = "windows")]
fn resolve_wpad_proxy(target_url: &str) -> Option<String> {
    use std::process::Command;

    // Ask .NET for the proxy.  GetSystemWebProxy() honours WPAD/PAC/env-var
    // chains the same way the Windows HTTP stack does.
    let script = format!(
        "[System.Net.WebRequest]::GetSystemWebProxy().GetProxy('{}').AbsoluteUri",
        target_url
    );

    let output = Command::new("powershell")
        .args(["-NonInteractive", "-NoProfile", "-Command", &script])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let proxy = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // .NET returns the original URL unchanged when no proxy is needed (direct).
    if proxy.is_empty() || proxy == target_url {
        return None;
    }

    log::debug!("[Updater] WPAD resolved proxy for {}: {}", target_url, proxy);
    Some(proxy)
}

/// Builds an HTTP client that honours (in priority order):
///   1. The proxy configured in APInox settings (`network.proxy`)
///   2. The Windows manual system proxy (Internet Settings registry)
///   3. WPAD / PAC file via .NET's GetSystemWebProxy() (PowerShell shim)
///   4. Environment variables `HTTPS_PROXY` / `HTTP_PROXY` (reqwest default)
fn build_client() -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder()
        .user_agent(format!("APInox/{}", APP_VERSION));

    // 1. APInox configured proxy takes highest priority.
    let apinox_proxy = load_config_internal()
        .ok()
        .and_then(|c| c.network)
        .and_then(|n| n.proxy)
        .filter(|p| !p.is_empty());

    if let Some(proxy_url) = apinox_proxy {
        log::debug!("[Updater] Using APInox configured proxy: {}", proxy_url);
        match reqwest::Proxy::all(&proxy_url) {
            Ok(proxy) => { builder = builder.proxy(proxy); }
            Err(e) => { log::warn!("[Updater] Invalid APInox proxy URL '{}': {}", proxy_url, e); }
        }
    } else {
        // 2. Windows manual system proxy (works when ProxyEnable = 1).
        #[cfg(target_os = "windows")]
        let manual_proxy = read_windows_system_proxy();
        #[cfg(not(target_os = "windows"))]
        let manual_proxy: Option<String> = None;

        if let Some(sys_proxy) = manual_proxy {
            log::debug!("[Updater] Using Windows manual system proxy: {}", sys_proxy);
            match reqwest::Proxy::all(&sys_proxy) {
                Ok(proxy) => { builder = builder.proxy(proxy); }
                Err(e) => { log::warn!("[Updater] Invalid system proxy URL '{}': {}", sys_proxy, e); }
            }
        } else {
            // 3. WPAD / PAC — ask .NET for the effective proxy.
            #[cfg(target_os = "windows")]
            if let Some(wpad_proxy) = resolve_wpad_proxy("https://github.com") {
                log::debug!("[Updater] Using WPAD/PAC proxy: {}", wpad_proxy);
                match reqwest::Proxy::all(&wpad_proxy) {
                    Ok(proxy) => { builder = builder.proxy(proxy); }
                    Err(e) => { log::warn!("[Updater] Invalid WPAD proxy URL '{}': {}", wpad_proxy, e); }
                }
            }
            // 4. reqwest will automatically pick up HTTPS_PROXY / HTTP_PROXY env vars.
        }
    }

    builder.build().map_err(|e| format!("Failed to build HTTP client: {}", e))
}

// ── Tauri commands ─────────────────────────────────────────────────────────

/// Calls the GitHub Releases API to determine whether a newer version exists.
#[tauri::command]
pub async fn check_for_updates() -> Result<UpdateCheckResult, String> {
    let client = build_client()?;

    let response = client
        .get(GITHUB_API_URL)
        .send()
        .await
        .map_err(|e| format!("Failed to reach GitHub: {}", e))?;

    let status = response.status();
    if status == reqwest::StatusCode::NOT_FOUND {
        // No releases published yet — treat as "up to date"
        log::info!("[Updater] No releases found on GitHub (404) — skipping update check");
        return Ok(UpdateCheckResult {
            current_version: APP_VERSION.to_string(),
            latest_version: APP_VERSION.to_string(),
            has_update: false,
            download_url: None,
            release_url: String::new(),
            release_notes: String::new(),
        });
    }
    if !status.is_success() {
        return Err(format!("GitHub API returned status {}", status));
    }

    let release: GitHubRelease = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {}", e))?;

    let latest_version = release.tag_name.trim_start_matches('v').to_string();
    let current_version = APP_VERSION.to_string();
    let has_update = is_newer(&latest_version, &current_version);

    // Only resolve a download URL when there is actually an update to grab.
    let download_url = if has_update {
        release
            .assets
            .iter()
            .find(|a| a.name.ends_with("_x64-setup.exe"))
            .map(|a| a.browser_download_url.clone())
    } else {
        None
    };

    let release_notes: String = release
        .body
        .unwrap_or_default()
        .trim()
        .chars()
        .take(2000)
        .collect();

    log::info!(
        "[Updater] Current: {} | Latest: {} | Update available: {}",
        current_version,
        latest_version,
        has_update
    );

    Ok(UpdateCheckResult {
        current_version,
        latest_version,
        has_update,
        download_url,
        release_url: release.html_url,
        release_notes,
    })
}

/// Downloads the installer at `download_url` to the system temp directory.
///
/// Emits `update-download-progress` events with payload `{ "percent": u32 }`
/// while streaming the download.  Returns the local file path on completion.
#[tauri::command]
pub async fn download_update(
    app: tauri::AppHandle,
    download_url: String,
) -> Result<String, String> {
    let client = build_client()?;

    let response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to start download: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download server returned status {}",
            response.status()
        ));
    }

    let total_bytes = response.content_length().unwrap_or(0);
    let dest_path = std::env::temp_dir().join("apinox-update.exe");

    let mut file = tokio::fs::File::create(&dest_path)
        .await
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut last_percent: u32 = 0;
    let mut response = response;

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("Download error: {}", e))?
    {
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write chunk: {}", e))?;

        downloaded += chunk.len() as u64;

        if total_bytes > 0 {
            let percent = (downloaded * 100 / total_bytes) as u32;
            if percent != last_percent {
                last_percent = percent;
                app.emit(
                    "update-download-progress",
                    serde_json::json!({ "percent": percent }),
                )
                .ok();
            }
        }
    }

    file.flush()
        .await
        .map_err(|e| format!("Failed to flush file: {}", e))?;

    let path_str = dest_path
        .to_str()
        .ok_or_else(|| "Invalid temp path".to_string())?
        .to_string();

    log::info!("[Updater] Download complete: {}", path_str);
    Ok(path_str)
}

/// Spawns the downloaded NSIS installer and exits the app so the installer
/// can replace the running executable.  Windows-only; returns an error on
/// other platforms.
#[tauri::command]
pub async fn launch_installer(
    app: tauri::AppHandle,
    installer_path: String,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new(&installer_path)
            .spawn()
            .map_err(|e| format!("Failed to launch installer: {}", e))?;
        log::info!("[Updater] Installer launched: {}", installer_path);
        app.exit(0);
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        let _ = installer_path;
        Err("Installer launch is only supported on Windows".to_string())
    }
}

/// Opens a URL in the system default browser.
/// Used on non-Windows platforms to direct users to the GitHub release page.
#[tauri::command]
pub fn open_url_in_browser(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| format!("Failed to open URL: {}", e))
}
