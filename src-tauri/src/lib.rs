use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::Mutex;
use std::thread;
use tauri::Manager;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

// Global sidecar state
static SIDECAR_PORT: AtomicU16 = AtomicU16::new(0);
static SIDECAR_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
static CONFIG_DIR: Mutex<Option<String>> = Mutex::new(None);
static STARTUP_ERROR: Mutex<Option<String>> = Mutex::new(None);
static LOG_FILE_PATH: Mutex<Option<String>> = Mutex::new(None);

#[tauri::command]
fn get_sidecar_port() -> u16 {
    SIDECAR_PORT.load(Ordering::Relaxed)
}

#[tauri::command]
fn is_sidecar_ready() -> bool {
    SIDECAR_PORT.load(Ordering::Relaxed) > 0
}

#[tauri::command]
fn get_config_dir() -> Option<String> {
    CONFIG_DIR.lock().ok().and_then(|dir| dir.clone())
}

#[tauri::command]
fn get_sidecar_diagnostics() -> serde_json::Value {
    serde_json::json!({
        "port": SIDECAR_PORT.load(Ordering::Relaxed),
        "ready": SIDECAR_PORT.load(Ordering::Relaxed) > 0,
        "configDir": CONFIG_DIR.lock().ok().and_then(|dir| dir.clone()),
        "processRunning": SIDECAR_PROCESS.lock()
            .ok()
            .and_then(|guard| guard.as_ref().map(|_| true))
            .unwrap_or(false),
        "nodeCheck": check_node_availability(),
        "startupError": STARTUP_ERROR.lock().ok().and_then(|err| err.clone()),
        "logFilePath": LOG_FILE_PATH.lock().ok().and_then(|path| path.clone())
    })
}

#[tauri::command]
fn get_tauri_logs(lines: Option<usize>) -> Result<Vec<String>, String> {
    let log_path = LOG_FILE_PATH.lock()
        .ok()
        .and_then(|path| path.clone())
        .ok_or_else(|| "Log file path not available".to_string())?;
    
    let content = std::fs::read_to_string(&log_path)
        .map_err(|e| format!("Failed to read log file: {}", e))?;
    
    let all_lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
    
    let result = if let Some(count) = lines {
        all_lines.iter().rev().take(count).rev().cloned().collect()
    } else {
        all_lines
    };
    
    Ok(result)
}

fn check_node_availability() -> serde_json::Value {
    match std::process::Command::new("node").arg("--version").output() {
        Ok(output) => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            serde_json::json!({
                "available": true,
                "version": version
            })
        }
        Err(e) => {
            serde_json::json!({
                "available": false,
                "error": e.to_string()
            })
        }
    }
}

/// Spawn the Node.js sidecar process
fn spawn_sidecar(app_handle: &tauri::AppHandle) -> Result<(), String> {
    log::info!("========== SIDECAR STARTUP ==========");
    
    // Clear any previous startup error
    if let Ok(mut guard) = STARTUP_ERROR.lock() {
        *guard = None;
    }
    
    // Get path to sidecar
    // In development, cwd is src-tauri, so we need to go up one level
    // In production, we'd use a bundled binary

    let exe_path = std::env::current_exe()
        .map_err(|e| {
            let err = format!("Failed to get current exe path: {}", e);
            log::error!("{}", err);
            if let Ok(mut guard) = STARTUP_ERROR.lock() {
                *guard = Some(err.clone());
            }
            err
        })?;
    log::info!("Executable path: {:?}", exe_path);

    let exe_dir = exe_path
        .parent()
        .map(|p| p.to_path_buf())
        .or_else(|| app_handle.path().executable_dir().ok())
        .ok_or_else(|| {
            let err = "Failed to resolve executable dir".to_string();
            log::error!("{}", err);
            if let Ok(mut guard) = STARTUP_ERROR.lock() {
                *guard = Some(err.clone());
            }
            err
        })?;
    log::info!("Executable directory: {:?}", exe_dir);
    
    let preferred_dir = exe_dir.join(".apinox-config");
    log::info!("Preferred config directory: {:?}", preferred_dir);

    let config_dir = match fs::create_dir_all(&preferred_dir) {
        Ok(_) => {
            log::info!("Successfully created/verified preferred config directory");
            preferred_dir
        },
        Err(e) => {
            log::warn!("Failed to create .apinox-config next to exe: {}. Falling back to app config dir.", e);
            let fallback = app_handle
                .path()
                .app_config_dir()
                .or_else(|_| app_handle.path().app_data_dir())
                .map_err(|err| format!("Failed to resolve fallback config dir: {}", err))?;
            log::info!("Fallback config directory: {:?}", fallback);
            fs::create_dir_all(&fallback)
                .map_err(|err| format!("Failed to create fallback config dir: {}", err))?;
            log::info!("Successfully created fallback config directory");
            fallback
        }
    };

    if let Ok(mut guard) = CONFIG_DIR.lock() {
        *guard = Some(config_dir.to_string_lossy().to_string());
    }

    // Only search from exe_dir - current_dir is unreliable when launched from MSI installer
    let current_dir = std::env::current_dir().unwrap_or_else(|_| exe_dir.clone());
    log::info!("Current working directory: {:?}", current_dir);
    if current_dir != exe_dir {
        log::warn!("CWD differs from exe dir (likely launched from installer). Using exe dir only.");
    }

    let exe_dir_clone = exe_dir.clone();
    let sidecar_candidates = [exe_dir.clone()];
    log::info!("Searching for sidecar in {} locations", sidecar_candidates.len());

    let find_sidecar_script = |start: &PathBuf| -> Option<(PathBuf, PathBuf)> {
        let mut cursor = start.clone();
        for depth in 0..6 {
            // Check for bundled sidecar first (production)
            let bundled = cursor.join("sidecar-bundle").join("bundle.js");
            log::info!("  [Depth {}] Checking bundled: {:?}", depth, bundled);
            if bundled.exists() {
                log::info!("  ✓ Found bundled sidecar at: {:?}", bundled);
                return Some((bundled, cursor));
            }
            
            // Fallback to unbundled sidecar (development)
            let dev_bundle = cursor.join("sidecar").join("bundle.js");
            log::info!("  [Depth {}] Checking dev bundle: {:?}", depth, dev_bundle);
            if dev_bundle.exists() {
                log::info!("  ✓ Found dev bundle sidecar at: {:?}", dev_bundle);
                return Some((dev_bundle, cursor));
            }
            
            // Fallback to fully unbundled (development without bundle)
            let candidate = cursor
                .join("sidecar")
                .join("dist")
                .join("sidecar")
                .join("src")
                .join("index.js");
            log::info!("  [Depth {}] Checking unbundled: {:?}", depth, candidate);
            if candidate.exists() {
                log::info!("  ✓ Found unbundled sidecar at: {:?}", candidate);
                return Some((candidate, cursor));
            }
            if let Some(parent) = cursor.parent() {
                cursor = parent.to_path_buf();
            } else {
                log::info!("  ✗ Reached filesystem root, stopping search");
                break;
            }
        }
        None
    };

    let mut sidecar_script: Option<PathBuf> = None;
    let mut project_root: Option<PathBuf> = None;
    for (idx, start) in sidecar_candidates.iter().enumerate() {
        log::info!("Search path {}: {:?}", idx + 1, start);
        if let Some((script, root)) = find_sidecar_script(start) {
            sidecar_script = Some(script);
            project_root = Some(root);
            break;
        }
    }

    let sidecar_script = sidecar_script.ok_or_else(|| {
        log::error!("Sidecar script not found in any search paths!");
        log::error!("Searched locations:");
        for (idx, start) in sidecar_candidates.iter().enumerate() {
            log::error!("  {}: {:?}/sidecar/dist/sidecar/src/index.js", idx + 1, start);
        }
        "Sidecar not found. Run 'npm run build:sidecar' first.".to_string()
    })?;
    let project_root = project_root.ok_or_else(|| "Failed to resolve project root".to_string())?;

    let config_dir_str = config_dir.to_string_lossy().to_string();
    log::info!("Sidecar script: {:?}", sidecar_script);
    log::info!("Project root: {:?}", project_root);
    log::info!("Config directory: {}", config_dir_str);

    // Write config dir to a file that sidecar can read
    let config_dir_file = exe_dir_clone.join(".apinox-sidecar-config");
    log::info!("Writing config file to: {:?}", config_dir_file);
    if let Err(e) = fs::write(&config_dir_file, &config_dir_str) {
        log::warn!("Failed to write sidecar config file: {}", e);
    } else {
        log::info!("Successfully wrote sidecar config file");
    }

    // Check if node is available - simplified to just use PATH
    log::info!("Checking for Node.js availability...");
    
    let mut node_cmd = None;
    
    // Parse PATH manually and search for node.exe
    if let Ok(path_var) = std::env::var("PATH") {
        let paths: Vec<&str> = path_var.split(';').collect();
        log::info!("Searching {} PATH entries for node.exe...", paths.len());
        
        for path_entry in paths {
            if path_entry.is_empty() {
                continue;
            }
            
            let node_path = PathBuf::from(path_entry).join("node.exe");
            if node_path.exists() {
                // Try to execute it
                if let Ok(output) = Command::new(&node_path).arg("--version").output() {
                    if output.status.success() {
                        let version = String::from_utf8_lossy(&output.stdout);
                        log::info!("✓ Found Node.js at: {:?} ({})", node_path, version.trim());
                        node_cmd = Some(node_path.to_string_lossy().to_string());
                        break;
                    }
                }
            }
        }
    }
    
    let node_command = match node_cmd {
        Some(cmd) => cmd,
        None => {
            log::error!("Node.js not found in PATH");
            log::error!("PATH: {:?}", std::env::var("PATH").ok());
            log::error!("Please ensure Node.js is installed and in your system PATH.");
            log::error!("After installation, you may need to restart your computer for PATH changes to take effect.");
            let err = "Node.js not found in PATH. Please install Node.js and restart your computer.".to_string();
            if let Ok(mut guard) = STARTUP_ERROR.lock() {
                *guard = Some(err.clone());
            }
            return Err(err);
        }
    };

    log::info!("Building sidecar command...");
    let mut command = Command::new(&node_command);
    command
        .arg(&sidecar_script)
        .arg("--config-dir")
        .arg(&config_dir_str)
        .current_dir(&project_root)
        .env("APINOX_CONFIG_DIR", &config_dir_str)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());  // Changed to piped to capture stderr

    #[cfg(windows)]
    {
        // CREATE_NO_WINDOW
        command.creation_flags(0x08000000);
        log::info!("Applied Windows CREATE_NO_WINDOW flag");
    }

    log::info!("Spawning sidecar process...");
    let mut child = command
        .spawn()
        .map_err(|e| {
            log::error!("Failed to spawn sidecar process: {}", e);
            let err = format!("Failed to spawn sidecar: {}. Check if Node.js is installed and sidecar is built.", e);
            if let Ok(mut guard) = STARTUP_ERROR.lock() {
                *guard = Some(err.clone());
            }
            err
        })?;
    
    log::info!("Sidecar process spawned successfully (PID: {})", child.id());

    // Read stdout to get the port
    let stdout = child.stdout.take().ok_or_else(|| {
        log::error!("Failed to capture sidecar stdout");
        "Failed to get stdout".to_string()
    })?;
    let stderr = child.stderr.take().ok_or_else(|| {
        log::error!("Failed to capture sidecar stderr");
        "Failed to get stderr".to_string()
    })?;
    
    let reader = BufReader::new(stdout);
    let err_reader = BufReader::new(stderr);

    log::info!("Starting stdout monitoring thread...");
    // Spawn thread to read sidecar output
    thread::spawn(move || {
        for line in reader.lines() {
            if let Ok(line) = line {
                log::info!("[Sidecar] {}", line);

                // Parse port from "SIDECAR_PORT:<port>"
                if line.starts_with("SIDECAR_PORT:") {
                    if let Some(port_str) = line.strip_prefix("SIDECAR_PORT:") {
                        if let Ok(port) = port_str.trim().parse::<u16>() {
                            log::info!("✓ Sidecar port detected: {}", port);
                            SIDECAR_PORT.store(port, Ordering::Relaxed);
                        } else {
                            log::error!("Failed to parse sidecar port from: {}", port_str);
                        }
                    }
                }
            }
        }
        log::warn!("Sidecar stdout stream ended");
    });

    // Spawn thread to read sidecar stderr
    log::info!("Starting stderr monitoring thread...");
    thread::spawn(move || {
        for line in err_reader.lines() {
            if let Ok(line) = line {
                log::error!("[Sidecar STDERR] {}", line);
            }
        }
        log::warn!("Sidecar stderr stream ended");
    });

    log::info!("========== SIDECAR STARTUP COMPLETE ==========");

    // Store process handle for cleanup
    if let Ok(mut guard) = SIDECAR_PROCESS.lock() {
        *guard = Some(child);
    }

    Ok(())
}

/// Stop the sidecar process
fn stop_sidecar() {
    if let Ok(mut guard) = SIDECAR_PROCESS.lock() {
        if let Some(ref mut child) = *guard {
            log::info!("Stopping sidecar...");
            let _ = child.kill();
        }
        *guard = None;
    }
    SIDECAR_PORT.store(0, Ordering::Relaxed);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![get_sidecar_port, is_sidecar_ready, get_config_dir, get_sidecar_diagnostics, get_tauri_logs])
        .setup(|app| {
            // Initialize logging for both debug and production
            // This helps diagnose issues on user machines
            let log_level = if cfg!(debug_assertions) {
                log::LevelFilter::Info
            } else {
                log::LevelFilter::Info  // Keep info level in production for diagnostics
            };
            
            // Configure logging to file for production diagnostics
            let log_dir = app.path().app_log_dir().unwrap_or_else(|_| {
                app.path().app_data_dir().unwrap_or_else(|_| std::env::temp_dir())
            });
            
            std::fs::create_dir_all(&log_dir).ok();
            
            let log_file = log_dir.join("apinox.log");
            
            // Store log file path for diagnostics
            if let Ok(mut guard) = LOG_FILE_PATH.lock() {
                *guard = Some(log_file.to_string_lossy().to_string());
            }
            
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log_level)
                    .targets([
                        tauri_plugin_log::Target::new(
                            tauri_plugin_log::TargetKind::LogDir { file_name: Some("apinox.log".to_string()) }
                        ),
                        // Disable stdout in production to avoid double logging
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    ])
                    .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                    .max_file_size(5_000_000) // 5 MB
                    .build(),
            )?;

            log::info!("APInox starting (version: {})", env!("CARGO_PKG_VERSION"));
            log::info!("Debug mode: {}", cfg!(debug_assertions));
            if let Ok(guard) = LOG_FILE_PATH.lock() {
                if let Some(ref path) = *guard {
                    log::info!("Logs will be written to: {}", path);
                }
            }

            // Launch sidecar
            let handle = app.handle().clone();
            thread::spawn(move || {
                if let Err(e) = spawn_sidecar(&handle) {
                    log::error!("========== SIDECAR STARTUP FAILED ==========");
                    log::error!("Error: {}", e);
                    log::error!("==========================================");
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            // Clean up sidecar when window closes
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    stop_sidecar();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
