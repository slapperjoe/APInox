use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, oneshot};
use crate::proxy_models::{BreakpointRule, BreakpointResolution, PausedTraffic};

/// One paused request/response waiting for a user decision.
struct PendingTraffic {
    info: PausedTraffic,
    tx: oneshot::Sender<BreakpointResolution>,
}

/// Manages breakpoint rules and holds currently paused traffic.
pub struct BreakpointService {
    pub rules: Vec<BreakpointRule>,
    pending: HashMap<String, PendingTraffic>,
}

pub type SharedBreakpointService = Arc<Mutex<BreakpointService>>;

impl Default for BreakpointService {
    fn default() -> Self {
        Self {
            rules: Vec::new(),
            pending: HashMap::new(),
        }
    }
}

pub fn new_shared() -> SharedBreakpointService {
    Arc::new(Mutex::new(BreakpointService::default()))
}

impl BreakpointService {
    pub fn get_rules(&self) -> Vec<BreakpointRule> {
        self.rules.clone()
    }

    pub fn set_rules(&mut self, rules: Vec<BreakpointRule>) {
        self.rules = rules;
    }

    pub fn add_rule(&mut self, rule: BreakpointRule) {
        self.rules.push(rule);
    }

    pub fn get_paused_traffic(&self) -> Vec<PausedTraffic> {
        self.pending.values().map(|p| p.info.clone()).collect()
    }

    /// Pause traffic; returns a receiver that resolves when the user acts.
    pub fn pause(&mut self, info: PausedTraffic) -> oneshot::Receiver<BreakpointResolution> {
        let (tx, rx) = oneshot::channel();
        self.pending.insert(info.id.clone(), PendingTraffic { info, tx });
        rx
    }

    pub fn resume(&mut self, id: &str, resolution: BreakpointResolution) -> bool {
        if let Some(pending) = self.pending.remove(id) {
            let _ = pending.tx.send(resolution);
            true
        } else {
            false
        }
    }

    pub fn drop_traffic(&mut self, id: &str) -> bool {
        self.resume(id, BreakpointResolution {
            action: "drop".to_string(),
            modified_headers: None,
            modified_body: None,
            modified_status_code: None,
        })
    }
}
