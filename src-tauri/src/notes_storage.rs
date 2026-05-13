use std::fs;
use std::path::{Path, PathBuf};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};

// ── Directory helpers ────────────────────────────────────────────────────────

fn get_notes_dir() -> Result<PathBuf, String> {
    let config_dir = std::env::var("APINOX_CONFIG_DIR")
        .ok()
        .and_then(|d| if d.trim().is_empty() { None } else { Some(PathBuf::from(d)) })
        .or_else(|| {
            let home = std::env::var("HOME")
                .or_else(|_| std::env::var("USERPROFILE"))
                .ok()?;
            Some(PathBuf::from(home).join(".apinox"))
        })
        .ok_or("Could not determine config directory")?;

    let notes_dir = config_dir.join("notes");
    if !notes_dir.exists() {
        fs::create_dir_all(&notes_dir)
            .map_err(|e| format!("Failed to create notes directory: {}", e))?;
    }
    Ok(notes_dir)
}

fn get_index_path(notes_dir: &Path) -> PathBuf {
    notes_dir.join("index.json")
}

// ── Index model (mirrors TypeScript NotesIndex) ──────────────────────────────

#[derive(Debug, serde::Serialize, serde::Deserialize, Default, Clone)]
pub struct NoteEntry {
    pub id: String,
    pub name: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub language: String,
    #[serde(rename = "isBinary")]
    pub is_binary: bool,
    #[serde(rename = "isManaged")]
    pub is_managed: bool,
    #[serde(rename = "lastModified")]
    pub last_modified: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Default)]
struct NotesIndex {
    entries: Vec<NoteEntry>,
    #[serde(rename = "recentPaths", default)]
    recent_paths: Vec<String>,
}

fn load_index(index_path: &Path) -> NotesIndex {
    if !index_path.exists() {
        return NotesIndex::default();
    }
    match fs::read_to_string(index_path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_else(|e| {
            log::error!("Failed to parse notes index: {}. Starting fresh.", e);
            NotesIndex::default()
        }),
        Err(e) => {
            log::error!("Failed to read notes index: {}. Starting fresh.", e);
            NotesIndex::default()
        }
    }
}

fn save_index(index_path: &Path, index: &NotesIndex) -> Result<(), String> {
    let content = serde_json::to_string_pretty(index)
        .map_err(|e| format!("Failed to serialize notes index: {}", e))?;
    fs::write(index_path, content)
        .map_err(|e| format!("Failed to write notes index: {}", e))?;
    Ok(())
}

fn now_iso() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // Simple ISO-8601 UTC string: YYYY-MM-DDTHH:MM:SSZ
    let s = secs;
    let sec = s % 60;
    let min = (s / 60) % 60;
    let hour = (s / 3600) % 24;
    let days = s / 86400;
    // Approximate date from epoch days
    let (year, month, day) = epoch_days_to_ymd(days);
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", year, month, day, hour, min, sec)
}

fn epoch_days_to_ymd(days: u64) -> (u64, u64, u64) {
    // Gregorian calendar approximation from epoch (1970-01-01)
    let z = days + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

fn file_last_modified(path: &Path) -> String {
    fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .map(|t| {
            use std::time::UNIX_EPOCH;
            let secs = t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
            let sec = secs % 60;
            let min = (secs / 60) % 60;
            let hour = (secs / 3600) % 24;
            let days = secs / 86400;
            let (year, month, day) = epoch_days_to_ymd(days);
            format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", year, month, day, hour, min, sec)
        })
        .unwrap_or_else(now_iso)
}

// ── Binary sniff ─────────────────────────────────────────────────────────────

/// Returns true if the file appears to be binary (>10% null/non-UTF8 control bytes in first 512)
fn sniff_is_binary(path: &Path) -> bool {
    use std::io::Read;
    let mut file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return false,
    };
    let mut buf = [0u8; 512];
    let n = file.read(&mut buf).unwrap_or(0);
    if n == 0 {
        return false;
    }
    let sample = &buf[..n];
    let non_text = sample.iter().filter(|&&b| b == 0 || (b < 9 && b != 0) || (b > 13 && b < 32)).count();
    non_text * 10 > n
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn load_notes_index() -> Result<serde_json::Value, String> {
    let dir = get_notes_dir()?;
    let index = load_index(&get_index_path(&dir));
    serde_json::to_value(&index).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_note_content(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }
    if sniff_is_binary(&path) {
        return Err("File is binary; use load_note_bytes".to_string());
    }
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn load_note_bytes(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }
    let bytes = fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    Ok(BASE64.encode(&bytes))
}

#[tauri::command]
pub fn save_note(file_path: String, content: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }
    fs::write(&path, &content).map_err(|e| format!("Failed to write file: {}", e))?;
    log::info!("Note saved: {}", file_path);
    Ok(file_last_modified(&path))
}

#[tauri::command]
pub fn save_note_bytes(file_path: String, data_base64: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }
    let bytes = BASE64.decode(&data_base64)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    fs::write(&path, &bytes).map_err(|e| format!("Failed to write file: {}", e))?;
    log::info!("Binary note saved: {}", file_path);
    Ok(file_last_modified(&path))
}

#[tauri::command]
pub fn delete_note(id: String) -> Result<(), String> {
    let dir = get_notes_dir()?;
    let index_path = get_index_path(&dir);
    let mut index = load_index(&index_path);

    if let Some(pos) = index.entries.iter().position(|e| e.id == id) {
        let entry = index.entries.remove(pos);
        if entry.is_managed {
            let path = PathBuf::from(&entry.file_path);
            if path.exists() {
                fs::remove_file(&path)
                    .map_err(|e| format!("Failed to delete file: {}", e))?;
            }
        }
        save_index(&index_path, &index)?;
        log::info!("Note deleted: {} ({})", entry.name, entry.file_path);
    }
    Ok(())
}

#[tauri::command]
pub fn rename_note(id: String, new_name: String) -> Result<NoteEntry, String> {
    let dir = get_notes_dir()?;
    let index_path = get_index_path(&dir);
    let mut index = load_index(&index_path);

    let entry = index.entries.iter_mut()
        .find(|e| e.id == id)
        .ok_or_else(|| format!("Note not found: {}", id))?;

    if entry.is_managed {
        // Rename the file on disk
        let old_path = PathBuf::from(&entry.file_path);
        let ext = old_path.extension()
            .and_then(|e| e.to_str())
            .map(|e| format!(".{}", e))
            .unwrap_or_default();
        let new_file_name = format!("{}{}", new_name, ext);
        let new_path = dir.join(&new_file_name);
        if old_path.exists() {
            fs::rename(&old_path, &new_path)
                .map_err(|e| format!("Failed to rename file: {}", e))?;
        }
        entry.file_path = new_path.to_string_lossy().to_string();
    }
    entry.name = new_name;
    let updated = entry.clone();
    save_index(&index_path, &index)?;
    Ok(updated)
}

#[tauri::command]
pub fn upsert_note_index(entry: NoteEntry) -> Result<(), String> {
    let dir = get_notes_dir()?;
    let index_path = get_index_path(&dir);
    let mut index = load_index(&index_path);

    if let Some(pos) = index.entries.iter().position(|e| e.id == entry.id) {
        index.entries[pos] = entry;
    } else {
        index.entries.push(entry);
    }
    save_index(&index_path, &index)
}

#[tauri::command]
pub fn add_recent_note_path(file_path: String) -> Result<(), String> {
    let dir = get_notes_dir()?;
    let index_path = get_index_path(&dir);
    let mut index = load_index(&index_path);

    index.recent_paths.retain(|p| p != &file_path);
    index.recent_paths.insert(0, file_path);
    index.recent_paths.truncate(20);
    save_index(&index_path, &index)
}

#[tauri::command]
pub fn sniff_file_type(file_path: String) -> Result<serde_json::Value, String> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }
    let is_binary = sniff_is_binary(&path);
    let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    let last_modified = file_last_modified(&path);
    Ok(serde_json::json!({
        "isBinary": is_binary,
        "fileSize": size,
        "lastModified": last_modified
    }))
}

#[tauri::command]
pub fn get_notes_dir_path() -> Result<String, String> {
    get_notes_dir().map(|p| p.to_string_lossy().to_string())
}
