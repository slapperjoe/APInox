// Prevent additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::Manager;

mod project_storage;
mod history_storage;
mod scrapbook_storage;
mod secret_storage;
pub mod settings_manager;
mod workspace_export;

// Rust backend modules
pub mod utils;
pub mod http;
pub mod soap;
pub mod parsers;
pub mod testing;
pub mod workflow;

#[cfg(target_os = "macos")]
use tauri_plugin_decorum::WebviewWindowExt;

#[cfg(windows)]
use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_BORDER_COLOR};
#[cfg(windows)]
use windows::Win32::Foundation::HWND;

static LOG_FILE_PATH: Mutex<Option<String>> = Mutex::new(None);

#[tauri::command]
fn close_splashscreen(app: tauri::AppHandle) {
    if let Some(splash) = app.get_webview_window("splashscreen") {
        splash.close().ok();
        log::info!("Splashscreen closed");
    }
    if let Some(main) = app.get_webview_window("main") {
        main.show().ok();
        main.set_focus().ok();
        log::info!("Main window shown");
    }
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    log::info!("Quit command received, exiting...");
    app.exit(0);
}

#[tauri::command]
fn set_border_color(window: tauri::Window, color: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use raw_window_handle::{HasWindowHandle, RawWindowHandle};
        
        // Parse hex color string (e.g., "#1e1e1e" or "1e1e1e")
        let color_str = color.trim_start_matches('#');
        let rgb = u32::from_str_radix(color_str, 16)
            .map_err(|e| format!("Invalid color format: {}", e))?;
        
        // Convert RGB to BGR (Windows uses BGR format)
        let r = (rgb >> 16) & 0xFF;
        let g = (rgb >> 8) & 0xFF;
        let b = rgb & 0xFF;
        let bgr = (b << 16) | (g << 8) | r;
        
        if let Ok(handle) = window.window_handle() {
            if let RawWindowHandle::Win32(win32_handle) = handle.as_ref() {
                let hwnd = HWND(win32_handle.hwnd.get() as _);
                
                unsafe {
                    DwmSetWindowAttribute(
                        hwnd,
                        DWMWA_BORDER_COLOR,
                        &bgr as *const _ as *const _,
                        std::mem::size_of::<u32>() as u32,
                    ).map_err(|e| format!("Failed to set border color: {:?}", e))?;
                }
                
                log::info!("Updated window border color to: {}", color);
                return Ok(());
            }
        }
    }
    
    #[cfg(not(windows))]
    {
        let _ = (window, color);
    }
    
    Ok(())
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn get_platform_os() -> String {
    #[cfg(target_os = "macos")]
    return "macos".to_string();
    
    #[cfg(target_os = "windows")]
    return "windows".to_string();
    
    #[cfg(target_os = "linux")]
    return "linux".to_string();
    
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    return "unknown".to_string();
}

/// Compute the config directory path using the same logic as settings_manager.
fn resolve_config_dir() -> Option<String> {
    std::env::var("APINOX_CONFIG_DIR")
        .ok()
        .and_then(|dir| if dir.trim().is_empty() { None } else { Some(dir) })
        .or_else(|| {
            let home = std::env::var("HOME")
                .or_else(|_| std::env::var("USERPROFILE"))
                .ok()?;
            Some(format!("{}/.apinox", home))
        })
}

#[tauri::command]
fn get_config_dir() -> Option<String> {
    resolve_config_dir()
}

#[tauri::command]
fn get_debug_info() -> serde_json::Value {
    let config_dir = resolve_config_dir();
    let log_path = LOG_FILE_PATH.lock().ok().and_then(|p| p.clone());

    let platform = {
        #[cfg(target_os = "macos")]
        { "macos" }
        #[cfg(target_os = "windows")]
        { "windows" }
        #[cfg(target_os = "linux")]
        { "linux" }
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        { "unknown" }
    };

    let arch = std::env::consts::ARCH;

    serde_json::json!({
        "mode": "Tauri",
        "version": env!("CARGO_PKG_VERSION"),
        "platform": platform,
        "arch": arch,
        "configDir": config_dir,
        "logPath": log_path,
        "debug": cfg!(debug_assertions),
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

/// Apply custom window styling on Windows
#[cfg(windows)]
fn apply_window_styling(window: &tauri::WebviewWindow) {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    
    if let Ok(handle) = window.window_handle() {
        if let RawWindowHandle::Win32(win32_handle) = handle.as_ref() {
            let hwnd = HWND(win32_handle.hwnd.get() as _);
            
            // Set initial border color to dark theme
            // The frontend will update this based on actual theme
            let color: u32 = 0x001e1e1e; // Dark theme default
            
            unsafe {
                let _ = DwmSetWindowAttribute(
                    hwnd,
                    DWMWA_BORDER_COLOR,
                    &color as *const _ as *const _,
                    std::mem::size_of::<u32>() as u32,
                );
            }
            
            log::info!("Applied initial window border styling (theme will update it)");
        }
    }
}

#[cfg(not(windows))]
#[cfg(target_os = "macos")]
fn apply_window_styling(_window: &tauri::WebviewWindow) {
    // No-op on non-Windows platforms
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_decorum::init()) // Initialize decorum plugin
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            close_splashscreen,
            quit_app,
            set_border_color,
            get_app_version,
            get_platform_os,
            get_config_dir,
            get_debug_info,
            get_tauri_logs,
            project_storage::save_project,
            project_storage::load_project,
            project_storage::delete_project,
            history_storage::get_history,
            history_storage::add_history_entry,
            history_storage::clear_history,
            history_storage::delete_history_entry,
            history_storage::toggle_star_history,
            history_storage::get_starred_history,
            history_storage::clear_history_older_than,
            history_storage::update_history_config,
            history_storage::get_history_config,
            scrapbook_storage::get_scrapbook,
            scrapbook_storage::add_scrapbook_request,
            scrapbook_storage::update_scrapbook_request,
            scrapbook_storage::delete_scrapbook_request,
            scrapbook_storage::get_scrapbook_request,
            secret_storage::store_secret,
            secret_storage::get_secret,
            secret_storage::delete_secret,
            secret_storage::resolve_secret_value,
            secret_storage::is_secret_ref,
            secret_storage::list_secret_keys,
            settings_manager::get_settings,
            settings_manager::get_raw_settings,
            settings_manager::save_raw_settings,
            settings_manager::save_settings,
            settings_manager::update_ui_settings,
            settings_manager::update_active_environment,
            settings_manager::update_open_projects,
            settings_manager::update_workflows,
            settings_manager::get_config_dir_path,
            settings_manager::get_config_file_path,
            settings_manager::get_resolved_environment,
            settings_manager::get_global_variables,
            http::commands::execute_http_request,
            http::commands::execute_rest_request,
            parsers::commands::parse_openapi_spec,
            parsers::wsdl_commands::parse_wsdl,
            parsers::wsdl_commands::refresh_wsdl,
            parsers::wsdl_commands::apply_wsdl_sync,
            soap::commands::build_soap_envelope,
            soap::commands::execute_soap_request,
            soap::commands::cancel_request,
            soap::cert_commands::generate_certificate,
            soap::cert_commands::save_certificate,
            soap::cert_commands::list_certificates,
            soap::cert_commands::load_certificate,
            testing::commands::run_test_case,
            testing::commands::run_test_suite,
            testing::commands::get_test_run_updates,
            workflow::commands::run_workflow,
            workflow::commands::get_workflows,
            workflow::commands::save_workflow,
            workflow::commands::delete_workflow,
            workspace_export::export_workspace,
            workspace_export::import_workspace,
            project_storage::close_project,
        ])
        .setup(|app| {
            // Initialize logging for both debug and production
            // This helps diagnose issues on user machines
            let _log_level = if cfg!(debug_assertions) {
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
                    .level(log::LevelFilter::Debug)  // Enable DEBUG level for detailed logs
                    .targets([
                        tauri_plugin_log::Target::new(
                            tauri_plugin_log::TargetKind::LogDir { file_name: Some("apinox.log".to_string()) }
                        ),
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                        // Add Webview target for DevTools console
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
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

            // Size and center the splashscreen to half the primary monitor dimensions.
            // The window is hidden (visible: false in config) and will be shown by the
            // splashscreen HTML once the image has finished loading, ensuring the image
            // is visible the instant the window appears.
            if let Some(splash) = app.get_webview_window("splashscreen") {
                if let Ok(Some(monitor)) = splash.primary_monitor() {
                    let scale = monitor.scale_factor();
                    let phys = monitor.size();
                    let logical_w = (phys.width as f64 / scale / 2.0) as u32;
                    let logical_h = (phys.height as f64 / scale / 2.0) as u32;
                    if let Err(e) = splash.set_size(tauri::LogicalSize::new(logical_w, logical_h)) {
                        log::warn!("Failed to resize splashscreen: {:?}", e);
                    }
                    if let Err(e) = splash.center() {
                        log::warn!("Failed to center splashscreen: {:?}", e);
                    }
                    log::info!("Splashscreen sized to {}x{} logical px (monitor: {}x{} physical, scale: {})",
                        logical_w, logical_h, phys.width, phys.height, scale);
                } else {
                    // No monitor info — just center with default size and show immediately
                    let _ = splash.center();
                    let _ = splash.show();
                }
            }

            // Apply custom window styling for Windows
            #[cfg(windows)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    // Remove native Windows titlebar - we use our own custom React titlebar
                    if let Err(e) = window.set_decorations(false) {
                        log::error!("Failed to remove Windows decorations: {:?}", e);
                    }
                    apply_window_styling(&window);
                }
            }

            // Set window icon explicitly (required on Linux for taskbar/dock)
            #[cfg(target_os = "linux")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let icon_bytes = include_bytes!("../icons/128x128.png");
                    if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
                        if let Err(e) = window.set_icon(icon) {
                            log::error!("Failed to set window icon: {:?}", e);
                        }
                    }
                }
            }

            // Remove native titlebar on Linux - we use our own custom React titlebar
            #[cfg(target_os = "linux")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    if let Err(e) = window.set_decorations(false) {
                        log::error!("Failed to remove Linux decorations: {:?}", e);
                    }
                }
            }
            
            // Apply decorum plugin for macOS traffic lights
            #[cfg(target_os = "macos")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    log::info!("Applying decorum plugin for macOS traffic lights");
                    match window.create_overlay_titlebar() {
                        Ok(_) => {
                            log::info!("Successfully created overlay titlebar");
                            // Set traffic lights inset to align with our custom titlebar
                            if let Err(e) = window.set_traffic_lights_inset(12.0, 16.0) {
                                log::error!("Failed to set traffic lights inset: {:?}", e);
                            }
                        },
                        Err(e) => {
                            log::error!("Failed to create overlay titlebar: {:?}", e);
                        }
                    }
                } else {
                    log::error!("Failed to get main window for decorum setup");
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
