use std::sync::Arc;
use tokio::sync::Mutex;
use crate::proxy_models::MockConfig;

/// Runtime state for the mock HTTP server.
#[derive(Debug, Default)]
pub struct MockState {
    pub config: MockConfig,
    pub running: bool,
    pub task: Option<tokio::task::AbortHandle>,
}

pub type SharedMockState = Arc<Mutex<MockState>>;

pub fn new_shared() -> SharedMockState {
    Arc::new(Mutex::new(MockState::default()))
}
