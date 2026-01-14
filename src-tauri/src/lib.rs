use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::Mutex;
use std::thread;

// Global sidecar state
static SIDECAR_PORT: AtomicU16 = AtomicU16::new(0);
static SIDECAR_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

#[tauri::command]
fn get_sidecar_port() -> u16 {
    SIDECAR_PORT.load(Ordering::Relaxed)
}

#[tauri::command]
fn is_sidecar_ready() -> bool {
    SIDECAR_PORT.load(Ordering::Relaxed) > 0
}

/// Spawn the Node.js sidecar process
fn spawn_sidecar(_app_handle: &tauri::AppHandle) -> Result<(), String> {
    // Get path to sidecar
    // In development, cwd is src-tauri, so we need to go up one level
    // In production, we'd use a bundled binary

    // Get the project root (parent of src-tauri)
    let current_dir =
        std::env::current_dir().map_err(|e| format!("Failed to get current dir: {}", e))?;

    // Check if we're in src-tauri and need to go up
    let project_root = if current_dir.ends_with("src-tauri") {
        current_dir.parent().unwrap().to_path_buf()
    } else {
        current_dir
    };

    let sidecar_script = project_root
        .join("sidecar")
        .join("dist")
        .join("sidecar")
        .join("src")
        .join("index.js");

    if !sidecar_script.exists() {
        return Err(format!(
            "Sidecar not found at {:?}. Run 'npm run build:sidecar' first.",
            sidecar_script
        ));
    }

    log::info!("Starting sidecar: node {:?}", sidecar_script);

    let mut child = Command::new("node")
        .arg(&sidecar_script)
        .current_dir(&project_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    // Read stdout to get the port
    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
    let reader = BufReader::new(stdout);

    // Spawn thread to read sidecar output
    thread::spawn(move || {
        for line in reader.lines() {
            if let Ok(line) = line {
                log::info!("[Sidecar] {}", line);

                // Parse port from "SIDECAR_PORT:<port>"
                if line.starts_with("SIDECAR_PORT:") {
                    if let Some(port_str) = line.strip_prefix("SIDECAR_PORT:") {
                        if let Ok(port) = port_str.trim().parse::<u16>() {
                            log::info!("Sidecar running on port {}", port);
                            SIDECAR_PORT.store(port, Ordering::Relaxed);
                        }
                    }
                }
            }
        }
    });

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
        .invoke_handler(tauri::generate_handler![get_sidecar_port, is_sidecar_ready])
        .setup(|app| {
            // Initialize logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Launch sidecar
            let handle = app.handle().clone();
            thread::spawn(move || {
                if let Err(e) = spawn_sidecar(&handle) {
                    log::error!("Failed to start sidecar: {}", e);
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
