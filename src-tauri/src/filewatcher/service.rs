use std::sync::Arc;
use tokio::sync::Mutex;
use crate::proxy_models::{FileWatch, SoapPair};
use super::pairing_engine::PairingEngine;

/// Manages file watch configurations and the in-memory SOAP pair history.
#[derive(Debug, Default)]
pub struct FileWatcherService {
    pub watches: Vec<FileWatch>,
    pub engine: PairingEngine,
}

pub type SharedFileWatcherService = Arc<Mutex<FileWatcherService>>;

pub fn new_shared() -> SharedFileWatcherService {
    Arc::new(Mutex::new(FileWatcherService::default()))
}

impl FileWatcherService {
    pub fn get_watches(&self) -> Vec<FileWatch> {
        self.watches.clone()
    }

    pub fn add_watch(&mut self, watch: FileWatch) {
        self.watches.push(watch);
    }

    pub fn update_watch(&mut self, id: &str, updated: FileWatch) -> bool {
        if let Some(w) = self.watches.iter_mut().find(|w| w.id == id) {
            *w = updated;
            true
        } else {
            false
        }
    }

    pub fn delete_watch(&mut self, id: &str) -> bool {
        let before = self.watches.len();
        self.watches.retain(|w| w.id != id);
        self.watches.len() != before
    }

    pub fn get_pairs(&self, watch_id: Option<&str>) -> Vec<SoapPair> {
        self.engine.get_pairs(watch_id)
    }

    pub fn clear_pairs(&mut self, watch_id: Option<&str>) {
        self.engine.clear_pairs(watch_id);
    }
}

