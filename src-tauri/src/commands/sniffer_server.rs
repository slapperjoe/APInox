use serde::{Deserialize, Serialize};
#[cfg(any(target_os = "macos", target_os = "windows"))]
use std::process::Command;
use tauri::State;

use crate::ProxyAppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemProxyStatus {
    pub enabled: bool,
    pub host: String,
    pub port: Option<u16>,
    /// "windows" | "macos" | "linux" | "unknown"
    pub platform: String,
    /// Whether set/clear automation is supported on this platform
    pub automation_supported: bool,
    /// macOS only: whether elevation (Touch ID / password) is required to change settings
    pub requires_elevation: bool,
    /// macOS only: the network service(s) the proxy will be applied to
    pub network_services: Vec<String>,
}

/// Get the current system HTTP proxy configuration.
#[tauri::command]
pub async fn get_system_proxy_status(_state: State<'_, ProxyAppState>) -> Result<SystemProxyStatus, String> {
    #[cfg(target_os = "windows")]
    {
        get_system_proxy_windows()
    }
    #[cfg(target_os = "macos")]
    {
        get_system_proxy_macos()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let proxy_env = std::env::var("HTTPS_PROXY")
            .or_else(|_| std::env::var("HTTP_PROXY"))
            .unwrap_or_default();
        let enabled = !proxy_env.is_empty();
        Ok(SystemProxyStatus {
            enabled,
            host: proxy_env,
            port: None,
            platform: "linux".to_string(),
            automation_supported: false,
            requires_elevation: false,
            network_services: vec![],
        })
    }
}

/// Set the system HTTP+HTTPS proxy to 127.0.0.1:{port}.
/// On macOS this triggers a Touch ID / password prompt via osascript.
#[tauri::command]
pub async fn set_system_proxy(port: u16, _state: State<'_, ProxyAppState>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        set_proxy_windows(port)
    }
    #[cfg(target_os = "macos")]
    {
        set_proxy_macos(port)
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = port;
        Err("System proxy automation is not supported on this platform. Set HTTPS_PROXY=http://127.0.0.1:<port> manually.".to_string())
    }
}

/// Clear the system HTTP+HTTPS proxy.
/// On macOS this triggers a Touch ID / password prompt via osascript.
#[tauri::command]
pub async fn clear_system_proxy(_state: State<'_, ProxyAppState>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        clear_proxy_windows()
    }
    #[cfg(target_os = "macos")]
    {
        clear_proxy_macos()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err("System proxy automation is not supported on this platform.".to_string())
    }
}

/// Synchronous best-effort cleanup called when the application window closes.
/// Clears the OS system proxy so traffic is not left routing through a dead port.
/// Must not panic — errors are only logged.
pub fn clear_on_exit() {
    #[cfg(target_os = "windows")]
    {
        if let Err(e) = clear_proxy_windows() {
            log::warn!("[Sniffer] Failed to clear system proxy on exit (Windows): {}", e);
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Err(e) = clear_proxy_macos() {
            log::warn!("[Sniffer] Failed to clear system proxy on exit (macOS): {}", e);
        }
    }
    // On other platforms there is nothing to undo.
}

// ── macOS implementation ────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
fn active_network_services() -> Vec<String> {
    // List all network services; lines starting with '*' are disabled.
    let output = Command::new("networksetup")
        .args(["-listallnetworkservices"])
        .output()
        .unwrap_or_else(|_| std::process::Output {
            status: std::process::ExitStatus::default(),
            stdout: vec![],
            stderr: vec![],
        });

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|l| !l.starts_with('*') && !l.contains("An asterisk") && !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .collect()
}

#[cfg(target_os = "macos")]
fn get_system_proxy_macos() -> Result<SystemProxyStatus, String> {
    let services = active_network_services();
    let primary = services.first().cloned().unwrap_or_else(|| "Wi-Fi".to_string());

    // Read web proxy for the primary service (no elevation needed)
    let output = Command::new("networksetup")
        .args(["-getwebproxy", &primary])
        .output()
        .map_err(|e| format!("networksetup failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse output: "Enabled: Yes\nServer: 127.0.0.1\nPort: 8888\n..."
    let enabled = stdout.lines()
        .find(|l| l.starts_with("Enabled:"))
        .map(|l| l.contains("Yes"))
        .unwrap_or(false);

    let host = stdout.lines()
        .find(|l| l.starts_with("Server:"))
        .and_then(|l| l.split(':').nth(1))
        .map(|s| s.trim().to_string())
        .unwrap_or_default();

    let port = stdout.lines()
        .find(|l| l.starts_with("Port:"))
        .and_then(|l| l.split(':').nth(1))
        .and_then(|s| s.trim().parse::<u16>().ok());

    Ok(SystemProxyStatus {
        enabled,
        host,
        port,
        platform: "macos".to_string(),
        automation_supported: true,
        requires_elevation: true,
        network_services: services,
    })
}

#[cfg(target_os = "macos")]
fn set_proxy_macos(port: u16) -> Result<(), String> {
    let services = active_network_services();
    if services.is_empty() {
        return Err("No active network services found".to_string());
    }

    // Build a shell command that sets HTTP + HTTPS proxy on every active service
    let cmds: Vec<String> = services.iter().flat_map(|svc| {
        vec![
            format!("networksetup -setwebproxy '{}' 127.0.0.1 {}", svc, port),
            format!("networksetup -setsecurewebproxy '{}' 127.0.0.1 {}", svc, port),
            format!("networksetup -setwebproxystate '{}' on", svc),
            format!("networksetup -setsecurewebproxystate '{}' on", svc),
        ]
    }).collect();

    run_with_elevation(&cmds.join(" && "))
}

#[cfg(target_os = "macos")]
fn clear_proxy_macos() -> Result<(), String> {
    let services = active_network_services();
    if services.is_empty() {
        return Err("No active network services found".to_string());
    }

    // Try without elevation first — disable is less sensitive than enable and
    // often succeeds without a Touch ID prompt on newer macOS versions.
    let no_elevation_ok = services.iter().all(|svc| {
        let web_ok = Command::new("networksetup")
            .args(["-setwebproxystate", svc, "off"])
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        let https_ok = Command::new("networksetup")
            .args(["-setsecurewebproxystate", svc, "off"])
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        web_ok && https_ok
    });

    if no_elevation_ok {
        return Ok(());
    }

    // Fall back to elevated execution if direct commands were rejected.
    let cmds: Vec<String> = services.iter().flat_map(|svc| {
        vec![
            format!("networksetup -setwebproxystate '{}' off", svc),
            format!("networksetup -setsecurewebproxystate '{}' off", svc),
        ]
    }).collect();

    run_with_elevation(&cmds.join(" && "))
}

/// Execute a shell command with administrator privileges via osascript.
/// On modern Macs this shows the native Touch ID / password prompt.
#[cfg(target_os = "macos")]
fn run_with_elevation(shell_cmd: &str) -> Result<(), String> {
    // Escape single quotes in the shell command for embedding in AppleScript
    let escaped = shell_cmd.replace('\\', "\\\\").replace('"', "\\\"");

    let script = format!(
        r#"do shell script "{}" with administrator privileges"#,
        escaped
    );

    let output = Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| format!("osascript failed to launch: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // User cancelled the auth dialog — provide a friendly message
        if stderr.contains("User canceled") || stderr.contains("-128") {
            Err("Authentication cancelled".to_string())
        } else {
            Err(format!("Elevation failed: {}", stderr.trim()))
        }
    }
}

// ── Windows implementation ──────────────────────────────────────────────────

/// Build a `Command` with CREATE_NO_WINDOW so subprocesses don't flash a
/// console window on screen. Required for all Windows subprocess calls.
#[cfg(target_os = "windows")]
fn win_cmd(program: &str) -> Command {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut cmd = Command::new(program);
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[cfg(target_os = "windows")]
fn get_system_proxy_windows() -> Result<SystemProxyStatus, String> {
    // Read from the Windows registry (HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings)
    // using the `reg` command — no extra crate needed.
    let output = win_cmd("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
            "/v", "ProxyEnable",
        ])
        .output()
        .map_err(|e| format!("Failed to query registry: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let enabled = stdout.contains("0x1");

    let server_output = win_cmd("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
            "/v", "ProxyServer",
        ])
        .output()
        .map_err(|e| format!("Failed to query registry ProxyServer: {}", e))?;

    let server_stdout = String::from_utf8_lossy(&server_output.stdout);
    // Parse "    ProxyServer    REG_SZ    127.0.0.1:8888"
    let proxy_server = server_stdout
        .lines()
        .find(|l| l.contains("ProxyServer"))
        .and_then(|l| l.split_whitespace().last())
        .unwrap_or("")
        .to_string();

    let (host, port) = {
        // Handles "127.0.0.1:8888" or "http=127.0.0.1:8888;https=127.0.0.1:8888"
        let clean = proxy_server
            .split(';')
            .next()
            .unwrap_or(&proxy_server)
            .trim_start_matches("http=")
            .trim_start_matches("https=");
        if let Some((h, p)) = clean.rsplit_once(':') {
            (h.to_string(), p.parse::<u16>().ok())
        } else {
            (clean.to_string(), None)
        }
    };

    Ok(SystemProxyStatus {
        enabled,
        host,
        port,
        platform: "windows".to_string(),
        automation_supported: true,
        requires_elevation: false,
        network_services: vec![],
    })
}

#[cfg(target_os = "windows")]
fn set_proxy_windows(port: u16) -> Result<(), String> {
    let proxy_value = format!("127.0.0.1:{}", port);

    // Enable proxy and set server via registry
    run_reg_add(
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
        "ProxyServer",
        "REG_SZ",
        &proxy_value,
    )?;
    run_reg_add(
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
        "ProxyEnable",
        "REG_DWORD",
        "1",
    )?;

    // Notify WinInet of the change so it takes effect without a reboot
    notify_proxy_change_windows();

    log::info!("[Sniffer] System proxy set to {}", proxy_value);
    Ok(())
}

#[cfg(target_os = "windows")]
fn clear_proxy_windows() -> Result<(), String> {
    run_reg_add(
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
        "ProxyEnable",
        "REG_DWORD",
        "0",
    )?;

    notify_proxy_change_windows();

    log::info!("[Sniffer] System proxy cleared");
    Ok(())
}

#[cfg(target_os = "windows")]
fn run_reg_add(key: &str, value_name: &str, value_type: &str, data: &str) -> Result<(), String> {
    let output = win_cmd("reg")
        .args(["add", key, "/v", value_name, "/t", value_type, "/d", data, "/f"])
        .output()
        .map_err(|e| format!("reg add failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("reg add error: {}", stderr));
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn notify_proxy_change_windows() {
    // Run a tiny PowerShell snippet to call InternetSetOption with
    // INTERNET_OPTION_SETTINGS_CHANGED (39) and INTERNET_OPTION_REFRESH (37)
    // so WinInet / IE-based apps pick up the change immediately.
    let _ = win_cmd("powershell")
        .args([
            "-NoProfile", "-NonInteractive", "-Command",
            r#"
$code = @'
[DllImport("wininet.dll", SetLastError = true, CharSet = CharSet.Auto)]
public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);
'@
$type = Add-Type -MemberDefinition $code -Name WinInet -Namespace Proxy -PassThru
$type::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0) | Out-Null
$type::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0) | Out-Null
"#,
        ])
        .output()
        .ok();
}


