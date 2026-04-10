use anyhow::{Context, Result};
use serde_json;
use std::path::PathBuf;
use crate::proxy_models::{MockRule, ReplaceRule, BreakpointRule, FileWatch};

pub struct RulesStorage {
    config_dir: PathBuf,
}

impl RulesStorage {
    pub fn new(config_dir: PathBuf) -> Self {
        Self { config_dir }
    }

    // --- Mock Rules ---

    pub fn load_mock_rules(&self) -> Vec<MockRule> {
        self.load_json("mock-rules.json").unwrap_or_default()
    }

    pub fn save_mock_rules(&self, rules: &[MockRule]) -> Result<()> {
        self.save_json("mock-rules.json", rules)
    }

    // --- Replace Rules ---

    pub fn load_replace_rules(&self) -> Vec<ReplaceRule> {
        self.load_json("replace-rules.json").unwrap_or_default()
    }

    pub fn save_replace_rules(&self, rules: &[ReplaceRule]) -> Result<()> {
        self.save_json("replace-rules.json", rules)
    }

    // --- Breakpoint Rules ---

    pub fn load_breakpoint_rules(&self) -> Vec<BreakpointRule> {
        self.load_json("breakpoint-rules.json").unwrap_or_default()
    }

    pub fn save_breakpoint_rules(&self, rules: &[BreakpointRule]) -> Result<()> {
        self.save_json("breakpoint-rules.json", rules)
    }

    // --- File Watches ---

    pub fn load_file_watches(&self) -> Vec<FileWatch> {
        self.load_json("file-watches.json").unwrap_or_default()
    }

    pub fn save_file_watches(&self, watches: &[FileWatch]) -> Result<()> {
        self.save_json("file-watches.json", watches)
    }

    // --- Helpers ---

    fn load_json<T: serde::de::DeserializeOwned>(&self, filename: &str) -> Result<T> {
        let path = self.config_dir.join(filename);
        let content = std::fs::read_to_string(&path)
            .with_context(|| format!("Failed to read {:?}", path))?;
        serde_json::from_str(&content)
            .with_context(|| format!("Failed to parse {:?}", path))
    }

    fn save_json<T: serde::Serialize + ?Sized>(&self, filename: &str, data: &T) -> Result<()> {
        std::fs::create_dir_all(&self.config_dir)
            .context("Failed to create config directory")?;
        let path = self.config_dir.join(filename);
        let content = serde_json::to_string_pretty(data)
            .context("Failed to serialize JSON")?;
        std::fs::write(&path, content)
            .with_context(|| format!("Failed to write {:?}", path))
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::proxy_models::{MockMatchCondition, MockRule, ReplaceRule, BreakpointRule, BreakpointCondition, FileWatch};
    use tempfile::TempDir;

    fn temp_storage() -> (TempDir, RulesStorage) {
        let dir = TempDir::new().unwrap();
        let storage = RulesStorage::new(dir.path().to_path_buf());
        (dir, storage)
    }

    // --- Mock rules round-trip ---

    #[test]
    fn mock_rules_round_trip() {
        let (_dir, storage) = temp_storage();
        let rules = vec![MockRule {
            id: "m1".to_string(),
            name: "Test Mock".to_string(),
            enabled: true,
            conditions: vec![MockMatchCondition {
                r#type: "url".to_string(),
                pattern: "/api".to_string(),
                is_regex: false,
                header_name: None,
            }],
            status_code: 200,
            response_body: "<OK/>".to_string(),
            content_type: None,
            response_headers: None,
            delay_ms: Some(100),
            hit_count: 0,
            recorded_at: None,
            recorded_from: None,
        }];

        storage.save_mock_rules(&rules).unwrap();
        let loaded = storage.load_mock_rules();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, "m1");
        assert_eq!(loaded[0].delay_ms, Some(100));
        assert_eq!(loaded[0].conditions[0].pattern, "/api");
    }

    // --- Replace rules round-trip ---

    #[test]
    fn replace_rules_round_trip() {
        let (_dir, storage) = temp_storage();
        let rules = vec![ReplaceRule {
            id: "r1".to_string(),
            name: "SSN Mask".to_string(),
            active: true,
            match_type: "both".to_string(),
            match_pattern: r"\d{3}-\d{2}-\d{4}".to_string(),
            replace_with: "XXX-XX-XXXX".to_string(),
            is_regex: true,
            xpath: None,
        }];

        storage.save_replace_rules(&rules).unwrap();
        let loaded = storage.load_replace_rules();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, "r1");
        assert!(loaded[0].is_regex);
        assert_eq!(loaded[0].replace_with, "XXX-XX-XXXX");
    }

    // --- Breakpoint rules round-trip ---

    #[test]
    fn breakpoint_rules_round_trip() {
        let (_dir, storage) = temp_storage();
        let rules = vec![BreakpointRule {
            id: "b1".to_string(),
            name: "API Break".to_string(),
            enabled: true,
            target: "request".to_string(),
            conditions: vec![BreakpointCondition {
                r#type: "url".to_string(),
                pattern: "/api".to_string(),
                is_regex: false,
                header_name: None,
            }],
        }];

        storage.save_breakpoint_rules(&rules).unwrap();
        let loaded = storage.load_breakpoint_rules();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, "b1");
        assert_eq!(loaded[0].target, "request");
    }

    // --- File watches round-trip ---

    #[test]
    fn file_watches_round_trip() {
        let (_dir, storage) = temp_storage();
        let watches = vec![FileWatch {
            id: "w1".to_string(),
            name: "Temp Watcher".to_string(),
            enabled: true,
            request_file: "/tmp/request.xml".to_string(),
            response_file: "/tmp/response.xml".to_string(),
            correlation_id_elements: vec!["CorrelationId".to_string()],
        }];

        storage.save_file_watches(&watches).unwrap();
        let loaded = storage.load_file_watches();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, "w1");
        assert_eq!(loaded[0].request_file, "/tmp/request.xml");
        assert!(loaded[0].enabled);
    }

    // --- Empty lists persist and load ---

    #[test]
    fn empty_rules_persist() {
        let (_dir, storage) = temp_storage();
        storage.save_mock_rules(&[]).unwrap();
        assert!(storage.load_mock_rules().is_empty());
    }

    // --- Missing file returns empty vec (no panic) ---

    #[test]
    fn missing_file_returns_empty() {
        let (_dir, storage) = temp_storage();
        // Nothing saved — should return empty, not panic
        assert!(storage.load_mock_rules().is_empty());
        assert!(storage.load_replace_rules().is_empty());
        assert!(storage.load_breakpoint_rules().is_empty());
        assert!(storage.load_file_watches().is_empty());
    }

    // --- Multiple rules all persisted ---

    #[test]
    fn multiple_mock_rules_all_persisted() {
        let (_dir, storage) = temp_storage();
        let rules: Vec<MockRule> = (0..5).map(|i| MockRule {
            id: format!("rule-{}", i),
            name: format!("Rule {}", i),
            enabled: i % 2 == 0,
            conditions: vec![],
            status_code: 200 + i as u16,
            response_body: format!("<R{i}/>"),
            content_type: None,
            response_headers: None,
            delay_ms: None,
            hit_count: i as u64,
            recorded_at: None,
            recorded_from: None,
        }).collect();

        storage.save_mock_rules(&rules).unwrap();
        let loaded = storage.load_mock_rules();
        assert_eq!(loaded.len(), 5);
        for i in 0..5 {
            assert_eq!(loaded[i].id, format!("rule-{}", i));
            assert_eq!(loaded[i].status_code, 200 + i as u16);
            assert_eq!(loaded[i].hit_count, i as u64);
        }
    }
}
