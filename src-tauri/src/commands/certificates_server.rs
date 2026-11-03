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

        #[cfg(any(target_os = "windows", target_os = "macos"))]
        let tp = mgr.thumbprint().unwrap_or_default();

        #[cfg(target_os = "windows")]
        let result = apply_machine_store(&path_str, &tp, false, "Certificate added to LocalMachine\\Root.");

        #[cfg(target_os = "macos")]
        let result = apply_machine_store(&path_str, &tp, false, "Certificate added to the System keychain.");

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
        #[cfg(any(target_os = "windows", target_os = "macos"))]
        let tp = thumbprint.unwrap_or_else(|| mgr.thumbprint().unwrap_or_default());
        let path_str = path.to_string_lossy().into_owned();

        #[cfg(target_os = "windows")]
        let result = apply_machine_store(&path_str, &tp, true, "Certificate moved to LocalMachine\\Root.");

        #[cfg(target_os = "macos")]
        let result = apply_machine_store(&path_str, &tp, true, "Certificate moved to the System keychain.");

        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        let result = action_err(
            format!(
                "The machine trust store needs root on this platform. Requested thumbprint: {tp}",
                tp = thumbprint.unwrap_or_else(|| mgr.thumbprint().unwrap_or_default())
            ),
            linux_manual_steps(&path_str),
        );

        Ok(result)
    })
    .await
}

// ── Machine trust store ─────────────────────────────────────────────────────
//
// The machine store is what a Windows service, an IIS app pool or any other user validates
// against, and an ordinary process cannot write to it for itself. The old code had two faults:
// it removed the user-store copy *before* the machine add, so a refused add left the CA in
// neither store; and it judged success on PowerShell's exit code, which a failed .NET call does
// not set. It also named `install_machine_macos` without defining it, so the macOS build could
// not compile.
//
// Every path writes its outcome to a result file, because that is the only reliable channel: an
// elevated child is detached — `Start-Process -Verb RunAs` on Windows, `osascript … with
// administrator privileges` on macOS (the same mechanism `sniffer_server` uses for networksetup)
// — and its output never comes back to the parent.

#[derive(Debug, PartialEq)]
pub enum StoreOutcome {
    Ok,
    Failed(String),
}

pub fn parse_store_outcome(raw: &str) -> StoreOutcome {
    let t = raw.trim();
    if t == "OK" {
        return StoreOutcome::Ok;
    }
    if t.is_empty() {
        return StoreOutcome::Failed("the elevation prompt was declined — no result was written".to_string());
    }
    StoreOutcome::Failed(t.trim().trim_start_matches("FAILED: ").to_string())
}

/// True when the failure is one an elevation prompt can answer.
pub fn is_elevation_failure(detail: &str) -> bool {
    let d = detail.to_lowercase();
    d.contains("access denied") || d.contains("administrator") || d.contains("permission denied")
}

/// Windows operation. The order is the guard: confirm the machine store kept the certificate
/// before removing the user-store copy, never the other way round.
pub fn windows_store_script(cert_path: &str, thumbprint: &str, result_file: &str, move_from_user: bool) -> String {
    let q = |s: &str| s.replace("'", "''");
    let store = |scope: &str| format!("New-Object System.Security.Cryptography.X509Certificates.X509Store('Root', '{scope}')");
    let mut parts = vec![
        "$ErrorActionPreference='Stop'".to_string(),
        "try {".to_string(),
        format!("$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('{}')", q(cert_path)),
        format!("$m = {}; $m.Open('ReadWrite'); $m.Add($cert); $m.Close();", store("LocalMachine")),
        format!(
            "$v = {}; $v.Open('ReadOnly'); if (-not ($v.Certificates | Where-Object {{ $_.Thumbprint -eq '{}' }})) {{ throw 'the machine store did not keep the certificate' }}; $v.Close();",
            store("LocalMachine"),
            q(thumbprint)
        ),
    ];
    if move_from_user {
        parts.push(format!(
            "$u = {}; $u.Open('ReadWrite'); $found = $u.Certificates | Where-Object {{ $_.Thumbprint -eq '{}' }}; if ($found) {{ $u.Remove($found) }}; $u.Close();",
            store("CurrentUser"),
            q(thumbprint)
        ));
    }
    parts.push(format!("Set-Content -Path '{}' -Value 'OK'", q(result_file)));
    parts.push(format!("}} catch {{ Set-Content -Path '{}' -Value ('FAILED: ' + $_.Exception.Message) }}", q(result_file)));
    // Statements have to be separated. Joined with a space this is
    // `$ErrorActionPreference='Stop' try { …`, which PowerShell reports as
    // "Unexpected token 'try' in expression or statement" — the parser error the panel showed
    // as "Failed to install certificate", before any store was touched.
    parts.join("\n")
}

/// macOS operation: System keychain, then read it back.
pub fn macos_store_script(cert_path: &str, result_file: &str) -> String {
    let q = |s: &str| s.replace("'", "'\''");
    format!(
        "if security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain '{cert}'; then\n\
         if security find-certificate -c APIprox /Library/Keychains/System.keychain >/dev/null; then\n\
         echo OK > '{out}'\n\
         else echo 'FAILED: the System keychain did not keep the certificate' > '{out}'; fi\n\
         else echo 'FAILED: the System keychain needs administrator privileges' > '{out}'; fi",
        cert = q(cert_path),
        out = q(result_file)
    )
}

#[allow(dead_code)] // only reached from the Windows and macOS branches
fn read_outcome(path: &std::path::Path) -> StoreOutcome {
    parse_store_outcome(&std::fs::read_to_string(path).unwrap_or_default())
}

#[allow(dead_code)] // only reached from the Windows and macOS branches
fn outcome_detail(o: &StoreOutcome) -> String {
    match o {
        StoreOutcome::Ok => String::new(),
        StoreOutcome::Failed(d) => d.clone(),
    }
}

#[cfg(target_os = "windows")]
fn apply_machine_store(cert_path: &str, thumbprint: &str, move_from_user: bool, success_text: &str) -> DiagAction {
    let dir = std::env::temp_dir();
    let stem = format!("apinox-cert-{}", std::process::id());
    let result = dir.join(format!("{stem}.out"));
    let script = windows_store_script(cert_path, thumbprint, &result.to_string_lossy(), move_from_user);

    // Pass 1, in process — free for anyone already running elevated.
    if let Err(e) = run_powershell(&script) {
        return action_err(e, windows_manual_steps(cert_path));
    }
    let outcome = read_outcome(&result);
    if outcome == StoreOutcome::Ok {
        return action_ok(success_text.to_string());
    }
    let detail = outcome_detail(&outcome);
    if !is_elevation_failure(&detail) {
        return action_err(detail, windows_manual_steps(cert_path));
    }

    // Pass 2: ask. The result file is cleared first so a declined prompt reads as no result
    // rather than as pass 1's failure.
    let _ = std::fs::remove_file(&result);
    let ps1 = dir.join(format!("{stem}.ps1"));
    if let Err(e) = std::fs::write(&ps1, &script) {
        return action_err(format!("could not stage the elevated script: {e}"), windows_manual_steps(cert_path));
    }
    let command = format!(
        "$ErrorActionPreference='Stop'; Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile','-NonInteractive','-File','{}'",
        ps1.to_string_lossy().replace("'", "''")
    );
    if let Err(e) = run_powershell(&command) {
        if e.to_lowercase().contains("canceled by the user") {
            return action_err("Elevation declined".to_string(), windows_manual_steps(cert_path));
        }
        return action_err(format!("the elevation prompt failed: {e}"), windows_manual_steps(cert_path));
    }
    finish(read_outcome(&result), success_text, cert_path)
}

#[cfg(target_os = "macos")]
fn apply_machine_store(cert_path: &str, _thumbprint: &str, move_from_user: bool, success_text: &str) -> DiagAction {
    let dir = std::env::temp_dir();
    let result = dir.join(format!("apinox-cert-{}.out", std::process::id()));
    let script = macos_store_script(cert_path, &result.to_string_lossy());

    if let Err(e) = run_shell(&script) {
        return action_err(e, macos_manual_steps(cert_path));
    }
    let outcome = read_outcome(&result);
    if outcome == StoreOutcome::Ok {
        return action_ok(success_text.to_string());
    }
    let detail = outcome_detail(&outcome);
    if !is_elevation_failure(&detail) {
        return action_err(detail, macos_manual_steps(cert_path));
    }

    // Pass 2: the native password / Touch ID prompt, the same mechanism `sniffer_server` uses
    // for `networksetup`.
    let _ = std::fs::remove_file(&result);
    let escaped = script.replace('\\', "\\\\").replace('"', "\\\"");
    let apple = format!(r#"do shell script "{}" with administrator privileges"#, escaped);
    if let Err(e) = run_osascript(&apple) {
        if e.contains("-128") || e.to_lowercase().contains("cancel") {
            return action_err("Elevation cancelled".to_string(), macos_manual_steps(cert_path));
        }
        return action_err(format!("the elevation prompt failed: {e}"), macos_manual_steps(cert_path));
    }
    if move_from_user {
        // The user store is writable without elevation, so the move's second half runs directly.
        let _ = std::process::Command::new("security")
            .args(["delete-certificate", "-c", "APIprox", &format!("{}/Library/Keychains/login.keychain-db", std::env::var("HOME").unwrap_or_default())])
            .output();
    }
    finish(read_outcome(&result), success_text, cert_path)
}

#[cfg(target_os = "windows")]
fn run_powershell(command: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", command])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("could not run PowerShell: {e}"))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

#[cfg(target_os = "macos")]
fn run_shell(script: &str) -> Result<(), String> {
    let output = std::process::Command::new("sh")
        .args(["-c", script])
        .output()
        .map_err(|e| format!("could not run the store script: {e}"))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

#[cfg(target_os = "macos")]
fn run_osascript(script: &str) -> Result<(), String> {
    let output = std::process::Command::new("osascript")
        .args(["-e", script])
        .output()
        .map_err(|e| format!("could not run osascript: {e}"))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

#[allow(dead_code)] // only reached from the Windows and macOS branches
fn finish(outcome: StoreOutcome, success_text: &str, cert_path: &str) -> DiagAction {
    match outcome {
        StoreOutcome::Ok => action_ok(format!("{success_text} (via the elevation prompt).")),
        StoreOutcome::Failed(d) => {
            #[cfg(target_os = "windows")]
            let steps = windows_manual_steps(cert_path);
            #[cfg(target_os = "macos")]
            let steps = macos_manual_steps(cert_path);
            #[cfg(not(any(target_os = "windows", target_os = "macos")))]
            let steps = vec![format!("Add {cert_path} to the machine trust store.")];
            action_err(format!("still refused after the elevation prompt: {d}"), steps)
        }
    }
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
    /// Success now needs the read-back sentinel, not just a clean exit.
    #[test]
    fn the_sentinel_is_what_proves_the_store_changed() {
        assert_eq!(parse_store_outcome("OK"), StoreOutcome::Ok);
        assert!(matches!(
            parse_store_outcome("FAILED: Access denied is requested."),
            StoreOutcome::Failed(d) if d.contains("Access denied")
        ));
        // Declining the UAC prompt writes nothing, which must not read as success.
        assert!(matches!(parse_store_outcome(""), StoreOutcome::Failed(_)));
    }

    #[test]
    fn the_failure_keeps_the_detail_the_reader_can_act_on() {
        let d = parse_store_outcome("FAILED: the machine store did not keep the certificate");
        assert!(matches!(&d, StoreOutcome::Failed(x) if x.contains("did not keep")), "{d:?}");
    }

    /// The order is the guard: the read-back has to come before the user-store `Remove`.
    /// Reversing it is what left the CA in neither store when the machine store refused.
    #[test]
    fn the_machine_store_is_verified_before_the_user_store_is_emptied() {
        let script = windows_store_script("/cfg/ca.cer", "AABB", "/tmp/out", true);
        let verify = script.find("$v.Open('ReadOnly')").unwrap();
        let remove = script.find("$u.Remove($found)").unwrap();
        assert!(verify < remove, "verify must come first:\n{script}");
    }

    #[test]
    fn an_add_does_not_empty_the_user_store() {
        let script = windows_store_script("/cfg/ca.cer", "AABB", "/tmp/out", false);
        assert!(!script.contains("CurrentUser"), "{script}");
    }

    #[test]
    fn only_an_elevation_failure_is_worth_a_prompt() {
        assert!(is_elevation_failure("Access denied is requested."));
        assert!(is_elevation_failure("the System keychain needs administrator privileges"));
        // A store that refused for another reason would just prompt again and fail again.
        assert!(!is_elevation_failure("the machine store did not keep the certificate"));
    }

    /// The parse error that showed up as "Failed to install certificate": joined with a
    /// space, the assignment and `try` ran together, so PowerShell never got as far as the
    /// store. Each part is one statement, so the join has to be a separator.
    #[test]
    fn statements_are_separated_so_powershell_can_parse_the_script() {
        let script = windows_store_script("/cfg/ca.cer", "AABB", "/tmp/out", false);
        let lines: Vec<String> = script.lines().map(|l| l.to_string()).collect();
        assert_eq!(lines[0], "$ErrorActionPreference='Stop'");
        assert_eq!(lines[1], "try {");
        assert!(!script.contains("'Stop' try"), "{script}");
        assert_eq!(
            script.chars().filter(|c| *c == '{').count(),
            script.chars().filter(|c| *c == '}').count(),
            "{script}"
        );
    }

    #[test]
    fn quotes_in_paths_are_escaped_for_powershell() {
        let script = windows_store_script("C:\\it's here\\ca.cer", "AABB", "/tmp/out", false);
        assert!(script.contains("'C:\\it''s here\\ca.cer'"), "{script}");
    }
}
