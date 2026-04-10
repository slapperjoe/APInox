use std::sync::Arc;
use tokio::sync::Mutex;
use crate::proxy_models::ProxyConfig;

/// Runtime state for the forward proxy server.
#[derive(Debug, Default)]
pub struct ProxyState {
    pub config: ProxyConfig,
    pub running: bool,
    /// tokio task abort handle, set when server is running
    pub task: Option<tokio::task::AbortHandle>,
}

pub type SharedProxyState = Arc<Mutex<ProxyState>>;

pub fn new_shared() -> SharedProxyState {
    Arc::new(Mutex::new(ProxyState::default()))
}
