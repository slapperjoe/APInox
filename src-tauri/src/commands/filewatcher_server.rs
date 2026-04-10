use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::proxy_models::{FileWatch, SoapMessage, SoapPair, WatcherSoapEvent};
use crate::ProxyAppState;
use crate::filewatcher::xml_parser;

#[tauri::command]
pub async fn get_file_watches(state: State<'_, ProxyAppState>) -> Result<Vec<FileWatch>, String> {
    Ok(state.filewatcher.lock().await.get_watches())
}

#[tauri::command]
pub async fn add_file_watch(
    watch: FileWatch,
    state: State<'_, ProxyAppState>,
    app: AppHandle,
) -> Result<FileWatch, String> {
    let watch = if watch.id.is_empty() {
        FileWatch { id: Uuid::new_v4().to_string(), ..watch }
    } else {
        watch
    };
    let mut svc = state.filewatcher.lock().await;
    svc.add_watch(watch.clone());
    let watches = svc.get_watches();
    drop(svc);
    state.storage.save_file_watches(&watches).map_err(|e| e.to_string())?;
    spawn_watcher(watch.clone(), state.filewatcher.clone(), app);
    Ok(watch)
}

#[tauri::command]
pub async fn update_file_watch(
    id: String,
    watch: FileWatch,
    state: State<'_, ProxyAppState>,
    app: AppHandle,
) -> Result<FileWatch, String> {
    let mut svc = state.filewatcher.lock().await;
    let updated = svc.update_watch(&id, watch.clone());
    if updated {
        // If re-enabling, clear stale pairs so the initial re-read starts fresh.
        if watch.enabled {
            svc.clear_pairs(Some(&watch.id));
        }
        let watches = svc.get_watches();
        drop(svc);
        state.storage.save_file_watches(&watches).map_err(|e| e.to_string())?;
        // Re-spawn the watcher (spawn_watcher is a no-op when enabled=false).
        spawn_watcher(watch.clone(), state.filewatcher.clone(), app);
        Ok(watch)
    } else {
        Err(format!("File watch '{}' not found", id))
    }
}

#[tauri::command]
pub async fn delete_file_watch(id: String, state: State<'_, ProxyAppState>) -> Result<(), String> {
    let mut svc = state.filewatcher.lock().await;
    let deleted = svc.delete_watch(&id);
    if deleted {
        svc.clear_pairs(Some(&id));
        let watches = svc.get_watches();
        drop(svc);
        state.storage.save_file_watches(&watches).map_err(|e| e.to_string())
    } else {
        Err(format!("File watch '{}' not found", id))
    }
}

/// Returns all in-memory SOAP pairs, optionally filtered by watch ID.
/// Used on component mount to restore state after navigation.
#[tauri::command]
pub async fn get_soap_pairs(
    watch_id: Option<String>,
    state: State<'_, ProxyAppState>,
) -> Result<Vec<SoapPair>, String> {
    let svc = state.filewatcher.lock().await;
    Ok(svc.get_pairs(watch_id.as_deref()))
}

/// Kept for backward compatibility but returns empty — pairs replace events.
#[tauri::command]
pub async fn get_watcher_events(
    _limit: Option<usize>,
    _state: State<'_, ProxyAppState>,
) -> Result<Vec<serde_json::Value>, String> {
    Ok(vec![])
}

/// Kept for backward compatibility — clears all in-memory pairs.
#[tauri::command]
pub async fn clear_watcher_events(state: State<'_, ProxyAppState>) -> Result<(), String> {
    state.filewatcher.lock().await.clear_pairs(None);
    Ok(())
}

// ---------------------------------------------------------------------------
// Watcher spawn
// ---------------------------------------------------------------------------

/// Spawn a notify watcher for a single FileWatch entry.
///
/// Watches the parent directories of `request_file` and `response_file`.
/// On any create/modify event for those specific paths, reads the file content,
/// extracts SOAP metadata, and runs it through the pairing engine.
///
/// Also performs an immediate read of both files on startup so the UI has
/// an initial state without waiting for a file-system event.
pub fn spawn_watcher(
    watch: FileWatch,
    svc: crate::filewatcher::service::SharedFileWatcherService,
    app: AppHandle,
) {
    use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
    use std::path::PathBuf;

    if !watch.enabled {
        return;
    }

    let req_path = PathBuf::from(&watch.request_file);
    let res_path = PathBuf::from(&watch.response_file);
    let watch_id = watch.id.clone();
    let watch_clone = watch.clone();
    let svc_clone = svc.clone();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        // --- Initial read: emit current file contents immediately ---
        read_and_process_file(
            &req_path,
            &watch_clone,
            true,
            svc_clone.clone(),
            app_clone.clone(),
        ).await;
        read_and_process_file(
            &res_path,
            &watch_clone,
            false,
            svc_clone.clone(),
            app_clone.clone(),
        ).await;

        // --- Set up file-system watcher ---
        let (tx, mut rx) = tokio::sync::mpsc::channel(32);

        let mut watcher = match RecommendedWatcher::new(
            move |res: notify::Result<notify::Event>| {
                if let Ok(event) = res {
                    let _ = tx.blocking_send(event);
                }
            },
            Config::default(),
        ) {
            Ok(w) => w,
            Err(e) => {
                log::warn!("[FileWatcher] Failed to create watcher for {}: {}", watch_id, e);
                return;
            }
        };

        // Watch parent directories (non-recursive) so we catch writes to the files
        let dirs_to_watch: Vec<PathBuf> = {
            let mut dirs = vec![];
            if let Some(p) = req_path.parent() {
                dirs.push(p.to_path_buf());
            }
            if let Some(p) = res_path.parent() {
                if !dirs.contains(&p.to_path_buf()) {
                    dirs.push(p.to_path_buf());
                }
            }
            dirs
        };

        for dir in &dirs_to_watch {
            if let Err(e) = watcher.watch(dir, RecursiveMode::NonRecursive) {
                log::warn!("[FileWatcher] Failed to watch dir {:?}: {}", dir, e);
            }
        }

        log::info!(
            "[FileWatcher] Watching: {} (req: {:?}, res: {:?})",
            watch_id, req_path, res_path
        );

        while let Some(event) = rx.recv().await {
            let is_write = matches!(
                event.kind,
                notify::EventKind::Create(_) | notify::EventKind::Modify(_)
            );
            if !is_write {
                continue;
            }

            for file_path in &event.paths {
                let canon = file_path.canonicalize().unwrap_or(file_path.clone());
                let req_canon = req_path.canonicalize().unwrap_or(req_path.clone());
                let res_canon = res_path.canonicalize().unwrap_or(res_path.clone());

                if canon == req_canon {
                    read_and_process_file(file_path, &watch, true, svc.clone(), app.clone()).await;
                } else if canon == res_canon {
                    read_and_process_file(file_path, &watch, false, svc.clone(), app.clone()).await;
                }
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async fn read_and_process_file(
    path: &std::path::Path,
    watch: &FileWatch,
    is_request: bool,
    svc: crate::filewatcher::service::SharedFileWatcherService,
    app: AppHandle,
) {
    let content = match tokio::fs::read_to_string(path).await {
        Ok(c) if !c.trim().is_empty() => c,
        Ok(_) => return, // empty file — skip
        Err(e) => {
            log::debug!("[FileWatcher] Could not read {:?}: {}", path, e);
            return;
        }
    };

    let operation_name = if is_request {
        xml_parser::extract_operation_name_from_request(&content)
    } else {
        xml_parser::extract_operation_name_from_response(&content)
    };

    let correlation_id = xml_parser::extract_correlation_id(&content, &watch.correlation_id_elements);

    let msg = SoapMessage {
        id: uuid::Uuid::new_v4().to_string(),
        watch_id: watch.id.clone(),
        timestamp: chrono::Utc::now().timestamp_millis(),
        message_type: if is_request { "request" } else { "response" }.to_string(),
        file_path: path.to_string_lossy().into_owned(),
        content,
        operation_name,
        correlation_id,
    };

    let (pair, event_type) = {
        let mut locked = svc.lock().await;
        if is_request {
            let p = locked.engine.process_request(msg);
            (p, "new_request")
        } else {
            let p = locked.engine.process_response(msg);
            let ev = if p.request.is_some() && p.response.is_some() {
                "pair_matched"
            } else {
                "orphan_response"
            };
            (p, ev)
        }
    };

    emit_soap_event(&app, event_type, pair);
}

fn emit_soap_event(app: &AppHandle, event_type: &str, pair: SoapPair) {
    let event = WatcherSoapEvent {
        event_type: event_type.to_string(),
        pair,
    };
    if let Err(e) = app.emit("watcher-soap-event", &event) {
        log::warn!("[FileWatcher] Failed to emit watcher-soap-event: {}", e);
    }
}

