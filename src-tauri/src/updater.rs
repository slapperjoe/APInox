//! Self-update mechanism for APInox.
//!
//! Checks GitHub Releases for newer versions, downloads the Windows NSIS
//! installer, and launches it so the user can update without leaving the app.

use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::io::AsyncWriteExt;

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

fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(format!("APInox/{}", APP_VERSION))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))
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

    if !response.status().is_success() {
        return Err(format!(
            "GitHub API returned status {}",
            response.status()
        ));
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
