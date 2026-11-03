use serde::Serialize;
use tauri::{AppHandle, State};

use crate::certificates::manager::CertInfo;
use crate::utils::blocking;
use crate::{ensure_proxy_state, LazyProxyAppState};

#[tauri::command]
pub async fn get_ca_certificate_info(state: State<'_, LazyProxyAppState>, app: AppHandle) -> Result<CertInfo, String> {
    let state = ensure_proxy_state(state, &app).await?;
    // `info()` is not just a stat: it reads the metadata sidecar and spawns
    // `security find-certificate` (or the Windows equivalent) to check trust.
    let mgr = state.cert_manager.clone();
    blocking(move || Ok(mgr.info())).await
}

#[tauri::command]
pub async fn generate_ca_certificate(state: State<'_, LazyProxyAppState>, app: AppHandle) -> Result<CertInfo, String> {
    let state = ensure_proxy_state(state, &app).await?;
    // Key generation is CPU-bound and the writes follow — this is the slowest
    // of the four commands.
    let mgr = state.cert_manager.clone();
    blocking(move || mgr.generate().map_err(|e| e.to_string())).await
}

/// Remove the CA certificate from the OS trust store (useful for testing the trust flow).
#[tauri::command]
pub async fn untrust_ca_certificate(state: State<'_, LazyProxyAppState>, app: AppHandle) -> Result<TrustResult, String> {
    let state = ensure_proxy_state(state, &app).await?;
    let mgr = state.cert_manager.clone();
    blocking(move || {
        #[cfg(target_os = "macos")]
        let mut result = remove_macos();

        #[cfg(target_os = "windows")]
        let mut result = remove_windows();

        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let mut result = TrustResult {
            success: false,
            message: "Certificate removal not supported on this platform".to_string(),
            firefox_note: String::new(),
            manual_steps: vec![],
            cert_info: CertInfo::default(),
        };

        result.cert_info = mgr.info();
        Ok(result)
    })
    .await
}

/// Attempt to install the CA certificate into the OS trust store.
///
/// Platform strategy (all chosen to avoid requiring sudo/admin elevation):
///   macOS   — login keychain via `security add-trusted-cert` (user-level, no sudo)
///   Windows — current-user cert store via PowerShell `Import-Certificate` (no elevation needed)
///   Linux   — instructions only; no writable user-level trust store exists
///
/// Firefox on all platforms uses its own NSS store and is NOT affected by
/// these commands. Manual steps are always included.
#[tauri::command]
pub async fn trust_ca_certificate(state: State<'_, LazyProxyAppState>, app: AppHandle) -> Result<TrustResult, String> {
    let state = ensure_proxy_state(state, &app).await?;
    // The platform installers shell out to `security` / PowerShell, which can
    // take seconds — the longest thing any of these commands does.
    let mgr = state.cert_manager.clone();
    blocking(move || {
        let cert_path = mgr.cert_path();
        if !cert_path.exists() {
            return Err("CA certificate not found — generate it first".to_string());
        }

        let path_str = cert_path.to_string_lossy().into_owned();

        #[cfg(target_os = "macos")]
        let mut result = install_macos(&path_str);

        #[cfg(target_os = "windows")]
        let mut result = install_windows(&path_str);

        #[cfg(target_os = "linux")]
        let mut result = install_linux(&path_str);

        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        let mut result = TrustResult {
            success: false,
            message: "Certificate trust not supported on this platform".to_string(),
            firefox_note: firefox_note(),
            manual_steps: vec!["Manually add the certificate to your system trust store.".to_string()],
            cert_info: CertInfo::default(),
        };

        // Re-read cert info (including updated is_trusted) after the trust attempt.
        result.cert_info = mgr.info();
        Ok(result)
    })
    .await
}

/// Result of a diagnostics action — the shape the panel reads for its buttons
/// (`success`, `error`, `details`, `manualSteps`).
#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DiagAction {
    pub success: bool,
    pub error: Option<String>,
    pub details: Option<String>,
    pub manual_steps: Vec<String>,
}

fn action_ok(details: String) -> DiagAction {
    DiagAction { success: true, error: None, details: Some(details), manual_steps: vec![] }
}

fn action_err(error: String, manual_steps: Vec<String>) -> DiagAction {
    DiagAction { success: false, error: Some(error), details: None, manual_steps }
}

/// Regenerate the CA. The old Node server's `regenerateCertificate`; here it is the same
/// `generate`, kept under the name the panel calls.
#[tauri::command]
pub async fn regenerate_certificate(state: State<'_, LazyProxyAppState>, app: AppHandle) -> Result<DiagAction, String> {
    let state = ensure_proxy_state(state, &app).await?;
    let mgr = state.cert_manager.clone();
    blocking(move || match mgr.generate() {
        Ok(info) => Ok(action_ok(format!("Regenerated: {}", info.fingerprint.unwrap_or_default()))),
        Err(e) => Ok(action_err(e.to_string(), vec![])),
    })
    .await
}

/// Remove the CA files and the store entry — the panel's "Reset Certificates".
#[tauri::command]
pub async fn reset_certificates(state: State<'_, LazyProxyAppState>, app: AppHandle) -> Result<DiagAction, String> {
    let state = ensure_proxy_state(state, &app).await?;
    let mgr = state.cert_manager.clone();
    blocking(move || {
        if !mgr.cert_path().exists() && !mgr.key_path().exists() {
            return Ok(action_err("nothing to reset — no CA on disk".to_string(), vec![]));
        }
        for path in [mgr.cert_path(), mgr.key_path(), mgr.meta_path()] {
            if path.exists() {
                if let Err(e) = std::fs::remove_file(&path) {
                    return Ok(action_err(format!("could not remove {}: {e}", path.display()), vec![]));
                }
            }
        }
        Ok(action_ok("Certificate files removed. Regenerate and install a new CA.".to_string()))
    })
    .await
}

/// Install the CA into the machine store.
///
/// This is the store a service, an IIS app pool, or any other user validates against, and
/// it needs elevation — which is why `install_windows` writes to CurrentUser\Root instead.
/// The attempt is made so the failure is reported rather than assumed, and the manual steps
/// are always included.
#[tauri::command]
pub async fn install_certificate_to_local_machine(
    state: State<'_, LazyProxyAppState>,
    app: AppHandle,
) -> Result<DiagAction, String> {
    let state = ensure_proxy_state(state, &app).await?;
    let mgr = state.cert_manager.clone();
    blocking(move || {
        let path = mgr.cert_path();
        if !path.exists() {
            return Ok(action_err("CA certificate not found — generate it first".to_string(), vec![]));
        }
        let path_str = path.to_string_lossy().into_owned();

        #[cfg(target_os = "windows")]
        let tp = mgr.thumbprint().unwrap_or_default();

        #[cfg(target_os = "windows")]
        let result = install_machine_windows(&path_str, &tp);

        #[cfg(target_os = "macos")]
        let result = install_machine_macos(&path_str);

        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let result = action_err(
            "The machine trust store needs root on this platform.".to_string(),
            linux_manual_steps(&path_str),
        );

        Ok(result)
    })
    .await
}

/// Move the CA from the user store to the machine store — the panel's "Fix Certificate
/// Location", which is the fix for a client that validates against `LocalMachine\Root`.
#[tauri::command]
pub async fn move_certificate_to_local_machine(
    state: State<'_, LazyProxyAppState>,
    app: AppHandle,
    thumbprint: Option<String>,
) -> Result<DiagAction, String> {
    let state = ensure_proxy_state(state, &app).await?;
    let mgr = state.cert_manager.clone();
    blocking(move || {
        let path = mgr.cert_path();
        if !path.exists() {
            return Ok(action_err("CA certificate not found — generate it first".to_string(), vec![]));
        }
        let tp = thumbprint.unwrap_or_else(|| mgr.thumbprint().unwrap_or_default());

        #[cfg(target_os = "windows")]
        let result = move_machine_windows(&path.to_string_lossy(), &tp);

        #[cfg(not(target_os = "windows"))]
        let result = DiagAction {
            success: false,
            error: Some("The machine store is not writable without elevation on this platform.".to_string()),
            details: Some(format!("Requested thumbprint: {tp}")),
            #[cfg(target_os = "macos")]
            manual_steps: macos_manual_steps(&path.to_string_lossy()),
            #[cfg(target_os = "linux")]
            manual_steps: linux_manual_steps(&path.to_string_lossy()),
            #[cfg(not(any(target_os = "macos", target_os = "linux")))]
            manual_steps: vec!["Manually add the certificate to the machine trust store.".to_string()],
        };

        Ok(result)
    })
    .await
}

#[cfg(target_os = "windows")]
fn install_machine_windows(cert_path: &str, thumbprint: &str) -> DiagAction {
    // Add, then read the store back. An `Add` that throws — access denied without
    // Administrator rights — does not change PowerShell's exit code, so the exit status alone
    // used to report success for a store that never received the certificate.
    let command = format!(
        "$ErrorActionPreference = 'Stop'; try {{ \
         $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('{path}'); \
         $s = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root', 'LocalMachine'); \
         $s.Open('ReadWrite'); $s.Add($cert); $s.Close(); \
         $v = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root', 'LocalMachine'); \
         $v.Open('ReadOnly'); \
         if (-not ($v.Certificates | Where-Object {{ $_.Thumbprint -eq '{tp}' }})) {{ throw 'the store did not keep the certificate' }}; \
         $v.Close(); 'OK' }} catch {{ throw $_ }}",
        path = cert_path.replace('\'', "''"),
        tp = thumbprint
    );
    run_store_command(&command, cert_path, "Certificate added to LocalMachine\\Root.")
}

#[cfg(target_os = "windows")]
fn move_machine_windows(cert_path: &str, thumbprint: &str) -> DiagAction {
    // Add to the machine store and confirm it landed *before* removing it from the user
    // store. The order used to be remove-then-add, so a machine store that refused the add
    // left the CA in neither store — the panel said "moved successfully" while the next
    // diagnostic reported "not installed in any trust store".
    let command = format!(
        "$ErrorActionPreference = 'Stop'; try {{ \
         $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('{path}'); \
         $m = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root', 'LocalMachine'); \
         $m.Open('ReadWrite'); $m.Add($cert); $m.Close(); \
         $v = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root', 'LocalMachine'); \
         $v.Open('ReadOnly'); \
         if (-not ($v.Certificates | Where-Object {{ $_.Thumbprint -eq '{tp}' }})) {{ throw 'the machine store did not keep the certificate' }}; \
         $v.Close(); \
         $u = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root', 'CurrentUser'); \
         $u.Open('ReadWrite'); \
         $found = $u.Certificates | Where-Object {{ $_.Thumbprint -eq '{tp}' }}; \
         if ($found) {{ $u.Remove($found) }}; \
         $u.Close(); 'OK' }} catch {{ throw $_ }}",
        path = cert_path.replace('\'', "''"),
        tp = thumbprint
    );
    run_store_command(&command, cert_path, "Certificate moved to LocalMachine\\Root.")
}

#[cfg(target_os = "windows")]
fn run_store_command(command: &str, cert_path: &str, success_text: &str) -> DiagAction {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", command])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout).into_owned();
            let stderr = String::from_utf8_lossy(&o.stderr).into_owned();
            match store_action_error(o.status.success(), &stdout, &stderr) {
                None => action_ok(success_text.to_string()),
                Some(detail) => action_err(
                    format!("LocalMachine\\Root needs Administrator rights: {detail}"),
                    windows_manual_steps(cert_path),
                ),
            }
        }
        Err(e) => action_err(format!("could not run PowerShell: {e}"), windows_manual_steps(cert_path)),
    }
}

/// The exit code alone is not evidence the store changed: a failed .NET call inside a
/// PowerShell script is reported as an error record without setting the exit code, so the
/// panel previously claimed success for a store that never received the certificate. The
/// scripts print `OK` only after reading the store back, and this requires both.
#[cfg(any(test, target_os = "windows"))]
fn store_action_error(exit_ok: bool, stdout: &str, stderr: &str) -> Option<String> {
    let detail = {
        let s = stderr.trim();
        if !s.is_empty() { s.to_string() } else { stdout.trim().to_string() }
    };
    if !exit_ok {
        return Some(if detail.is_empty() { "the store operation failed".to_string() } else { detail });
    }
    if stdout.trim() != "OK" {
        return Some(if detail.is_empty() { "the store did not confirm the certificate is present".to_string() } else { detail });
    }
    None
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustResult {
    /// Whether the OS-level installation succeeded.
    pub success: bool,
    /// Human-readable result message.
    pub message: String,
    /// Always populated — Firefox requires separate manual steps on all platforms.
    pub firefox_note: String,
    /// Populated on failure (or always on Linux) with step-by-step instructions.
    pub manual_steps: Vec<String>,
    /// Updated cert info after the trust action — lets the UI react without a separate call.
    pub cert_info: CertInfo,
}

fn firefox_note() -> String {
    concat!(
        "Firefox uses its own certificate store and ignores the OS trust store. ",
        "To trust this CA in Firefox: open Preferences → Privacy & Security → ",
        "Certificates → View Certificates → Authorities → Import, then select ",
        "the ca.cer file and check 'Trust this CA to identify websites'."
    ).to_string()
}

// ── macOS ──────────────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
fn remove_macos() -> TrustResult {
    // delete-certificate removes by common name from the login keychain.
    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => return TrustResult {
            success: false,
            message: "Could not determine HOME directory".to_string(),
            firefox_note: String::new(),
            manual_steps: vec![],
            cert_info: CertInfo::default(),
        },
    };
    let keychain = format!("{}/Library/Keychains/login.keychain-db", home);
    let output = std::process::Command::new("security")
        .args(["delete-certificate", "-c", "APIprox", "-t", &keychain])
        .output();
    match output {
        Ok(out) if out.status.success() => TrustResult {
            success: true,
            message: "Certificate removed from login keychain.".to_string(),
            firefox_note: String::new(),
            manual_steps: vec![],
            cert_info: CertInfo::default(),
        },
        Ok(out) => {
            let detail = String::from_utf8_lossy(&out.stderr).into_owned();
            TrustResult {
                success: false,
                message: format!("security delete-certificate failed: {}", detail.trim()),
                firefox_note: String::new(),
                manual_steps: vec![],
                cert_info: CertInfo::default(),
            }
        }
        Err(e) => TrustResult {
            success: false,
            message: format!("Could not run security command: {}", e),
            firefox_note: String::new(),
            manual_steps: vec![],
            cert_info: CertInfo::default(),
        },
    }
}

#[cfg(target_os = "macos")]
fn install_macos(cert_path: &str) -> TrustResult {
    // Use the login keychain — writable by the current user without sudo.
    // Chrome and Safari on macOS respect login-keychain trust.
    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => {
            return TrustResult {
                success: false,
                message: "Could not determine HOME directory".to_string(),
                firefox_note: firefox_note(),
                manual_steps: macos_manual_steps(cert_path),
                cert_info: CertInfo::default(),
            }
        }
    };
    let keychain = format!("{}/Library/Keychains/login.keychain-db", home);

    let output = std::process::Command::new("security")
        .args([
            "add-trusted-cert",
            "-r", "trustRoot",
            "-k", &keychain,
            cert_path,
        ])
        .output();

    match output {
        Ok(out) if out.status.success() => TrustResult {
            success: true,
            message: format!(
                "Certificate added to your login keychain. \
                 Chrome and Safari will trust it after restart. \
                 Keychain: {}",
                keychain
            ),
            firefox_note: firefox_note(),
            manual_steps: vec![],
            cert_info: CertInfo::default(),
        },
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr).into_owned();
            let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
            let detail = if !stderr.is_empty() { stderr } else { stdout };
            TrustResult {
                success: false,
                message: format!("security command failed: {}", detail.trim()),
                firefox_note: firefox_note(),
                manual_steps: macos_manual_steps(cert_path),
                cert_info: CertInfo::default(),
            }
        }
        Err(e) => TrustResult {
            success: false,
            message: format!("Could not run security command: {}", e),
            firefox_note: firefox_note(),
            manual_steps: macos_manual_steps(cert_path),
            cert_info: CertInfo::default(),
        },
    }
}

#[cfg(target_os = "macos")]
fn macos_manual_steps(cert_path: &str) -> Vec<String> {
    vec![
        format!("Open Keychain Access (Spotlight → 'Keychain Access')"),
        format!("File → Import Items → select: {}", cert_path),
        format!("Double-click the imported 'APIprox Root CA' certificate"),
        format!("Expand 'Trust' → set 'When using this certificate' to 'Always Trust'"),
        format!("Close and enter your password when prompted"),
        format!("Restart Chrome and Safari"),
    ]
}

// ── Windows ────────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn remove_windows() -> TrustResult {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-ChildItem Cert:\\CurrentUser\\Root | Where-Object { $_.Subject -like '*APIprox*' } | Remove-Item",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
    match output {
        Ok(out) if out.status.success() => TrustResult {
            success: true,
            message: "Certificate removed from user certificate store.".to_string(),
            firefox_note: String::new(),
            manual_steps: vec![],
            cert_info: CertInfo::default(),
        },
        Ok(out) => {
            let detail = String::from_utf8_lossy(&out.stderr).into_owned();
            TrustResult {
                success: false,
                message: format!("Failed to remove certificate: {}", detail.trim()),
                firefox_note: String::new(),
                manual_steps: vec![],
                cert_info: CertInfo::default(),
            }
        }
        Err(e) => TrustResult {
            success: false,
            message: format!("Could not run PowerShell: {}", e),
            firefox_note: String::new(),
            manual_steps: vec![],
            cert_info: CertInfo::default(),
        },
    }
}

#[cfg(target_os = "windows")]
fn install_windows(cert_path: &str) -> TrustResult {
    // Import-Certificate triggers a UI confirmation dialog for CurrentUser\Root, which
    // fails when running non-interactively. Use the .NET X509Store API instead — it
    // adds to CurrentUser\Root silently with no dialog and no elevation required.
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let command = format!(
        "\
        $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('{path}'); \
        $store = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root', 'CurrentUser'); \
        $store.Open('ReadWrite'); \
        $store.Add($cert); \
        $store.Close()",
        path = cert_path.replace('\'', "''")
    );
    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &command])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    match output {
        Ok(out) if out.status.success() => TrustResult {
            success: true,
            message: "Certificate added to your user certificate store. \
                      Chrome and Edge will trust it after restart."
                .to_string(),
            firefox_note: firefox_note(),
            manual_steps: vec![],
            cert_info: CertInfo::default(),
        },
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr).into_owned();
            let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
            let detail = if !stderr.is_empty() { stderr } else { stdout };
            TrustResult {
                success: false,
                message: format!("X509Store add failed: {}", detail.trim()),
                firefox_note: firefox_note(),
                manual_steps: windows_manual_steps(cert_path),
                cert_info: CertInfo::default(),
            }
        }
        Err(e) => TrustResult {
            success: false,
            message: format!("Could not run PowerShell: {}", e),
            firefox_note: firefox_note(),
            manual_steps: windows_manual_steps(cert_path),
            cert_info: CertInfo::default(),
        },
    }
}

#[cfg(target_os = "windows")]
fn windows_manual_steps(cert_path: &str) -> Vec<String> {
    vec![
        format!("Open the file: {}", cert_path),
        "Click 'Install Certificate'".to_string(),
        "Choose 'Current User' → 'Place all certificates in the following store'".to_string(),
        "Browse → select 'Trusted Root Certification Authorities'".to_string(),
        "Click Next → Finish → Yes to the security warning".to_string(),
        "Restart Chrome and Edge".to_string(),
    ]
}

// ── Linux ──────────────────────────────────────────────────────────────────

#[cfg(target_os = "linux")]
fn install_linux(cert_path: &str) -> TrustResult {
    // There is no user-writable system trust store on Linux.
    // We provide instructions for common distributions.
    TrustResult {
        success: false,
        message: "Linux system trust requires root. Please follow the manual steps below."
            .to_string(),
        firefox_note: firefox_note(),
        manual_steps: linux_manual_steps(cert_path),
        cert_info: CertInfo::default(),
    }
}

#[cfg(target_os = "linux")]
fn linux_manual_steps(cert_path: &str) -> Vec<String> {
    vec![
        "# Debian / Ubuntu / Mint:".to_string(),
        format!("  sudo cp {} /usr/local/share/ca-certificates/apiprox-ca.crt", cert_path),
        "  sudo update-ca-certificates".to_string(),
        "".to_string(),
        "# Fedora / RHEL / CentOS:".to_string(),
        format!("  sudo cp {} /etc/pki/ca-trust/source/anchors/apiprox-ca.crt", cert_path),
        "  sudo update-ca-trust".to_string(),
        "".to_string(),
        "# Arch Linux:".to_string(),
        format!("  sudo cp {} /etc/ca-certificates/trust-source/anchors/apiprox-ca.crt", cert_path),
        "  sudo trust extract-compat".to_string(),
        "".to_string(),
        "After running the appropriate commands, restart Chrome/Chromium.".to_string(),
    ]
}


#[cfg(test)]
mod tests {
    use super::*;

    /// The bug this guards: a machine-store `Add` that throws — access denied without
    /// Administrator rights — is a PowerShell error record, not a non-zero exit code, so the
    /// panel reported "moved successfully" for a store that never received the certificate.
    /// Success now requires the read-back sentinel as well as a clean exit.
    #[test]
    fn a_clean_exit_is_not_evidence_the_store_changed() {
        assert!(store_action_error(true, "", "Access denied is requested.").is_some());
        assert!(store_action_error(true, "", "").is_some());
        assert_eq!(store_action_error(true, "OK", ""), None);
        assert!(store_action_error(false, "", "Access denied is requested.").is_some());
    }

    #[test]
    fn the_failure_keeps_the_detail_the_reader_can_act_on() {
        let err = store_action_error(true, "", "Access denied is requested.").unwrap();
        assert!(err.contains("Access denied is requested"), "{err}");
        // When the sentinel is missing there is no stderr, so the stdout detail is used.
        let fallback = store_action_error(true, "the machine store did not keep the certificate", "").unwrap();
        assert!(fallback.contains("did not keep"), "{fallback}");
    }
}
