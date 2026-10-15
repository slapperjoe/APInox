//! Self-proxy loop protection for APInox's own outbound HTTP clients.
//!
//! While APInox is "reading calls" the OS system proxy points at one of its
//! own listeners (`127.0.0.1:8888` forward proxy / `127.0.0.1:9001` mock —
//! see `commands::sniffer_server::set_system_proxy`). Any reqwest client that
//! falls back to proxy auto-detection (env vars + OS store — reqwest's
//! default "system" matcher) would then route its upstream requests back
//! into APInox itself: the sniffer forwards a request, the forward dials the
//! auto-discovered proxy, the proxy IS APInox, APInox forwards again … an
//! infinite self-proxy loop in which no response ever arrives and the caller
//! just times out (traffic events are only emitted after the upstream
//! completes, so the UI shows the request but never a response).
//!
//! The updater hit the same bug for update traffic (its self-proxy guard and
//! the tests there); this module is the shared detection used by the proxy
//! forward path, the mock passthrough and the traffic replay command:
//!
//!   * `is_self_proxy` — is this proxy URL one of APInox's own listeners?
//!   * `effective_proxy` — what would reqwest's default system matcher pick
//!     for a given URL scheme (env vars first, then the OS store), so the
//!     caller can spot the collision before dialing.
//!
//! When the collision is detected the client dials the upstream directly
//! (`.no_proxy()`); every other configuration keeps reqwest's default
//! auto-discovery (explicit/corporate proxies are still honoured).

use std::sync::Mutex;
use std::time::{Duration, Instant};

use once_cell::sync::Lazy;

/// In-app listener ports that APInox traffic must never be routed *through*.
///
/// The forward proxy and the mock server are the two listeners that MITM or
/// terminate traffic; the defaults match `proxy_models` (`8888` / `9001`).
pub fn in_app_listener_ports() -> Vec<u16> {
    vec![
        crate::proxy_models::ProxyConfig::default().port,
        crate::proxy_models::MockConfig::default().port,
    ]
}

/// Parses a proxy URL (`http://host:port`) into its host and port components.
pub fn parse_proxy_target(url: &str) -> Option<(&str, u16)> {
    let rest = url
        .trim()
        .strip_prefix("socks5://")
        .or_else(|| url.trim().strip_prefix("socks5h://"))
        .or_else(|| url.trim().strip_prefix("https://"))
        .or_else(|| url.trim().strip_prefix("http://"))
        .unwrap_or(url.trim());
    // Drop any path component (e.g. "http://proxy:3128/" from PAC scripts)
    // so only the host[:port] authority is parsed.
    let authority = rest.split('/').next().unwrap_or("");
    let (host, port_part) = authority.rsplit_once(':')?;
    let port = port_part.parse().ok()?;
    // Normalise IPv6 hosts ("[::1]" → "::1") so the loopback check below works.
    let host = host.trim_start_matches('[').trim_end_matches(']');
    Some((host, port))
}

/// True when a proxy URL points at a loopback/wildcard address that is a
/// candidate for one of APInox's own listeners.
///
/// Keying on loopback *addresses* (not on the port alone) keeps a legit
/// `127.0.0.1:3128` Squid/Clash working: only its *port* is then checked
/// against the in-app listener ports below.
pub fn proxy_host_is_loopback_like(host: &str) -> bool {
    matches!(host, "localhost" | "127.0.0.1" | "::1" | "0.0.0.0")
}

/// True when `proxy_url` is an auto-discovered proxy that collides with an
/// APInox in-app listener (the "self-proxy loop" — e.g. the OS proxy pointing
/// at APInox's own proxy while it reads calls, *and* the port matching).
pub fn is_self_proxy(proxy_url: &str) -> bool {
    match parse_proxy_target(proxy_url) {
        Some((host, port)) => {
            proxy_host_is_loopback_like(host) && in_app_listener_ports().contains(&port)
        }
        None => false,
    }
}

/// TTL for the cached OS-store read. The sniffer toggles the OS proxy rarely
/// relative to the request rate, and the OS read is the only non-trivially-
/// cheap source. A stale-10s decision can at worst route a request direct
/// (the safe direction) for up to 10 seconds.
const OS_PROXY_CACHE_TTL: Duration = Duration::from_secs(10);

/// Cached `(read_at, http_proxy, https_proxy)` from the OS store.
type OsProxyCacheEntry = (Instant, Option<String>, Option<String>);
static OS_PROXY_CACHE: Lazy<Mutex<OsProxyCacheEntry>> =
    Lazy::new(|| Mutex::new((Instant::now(), None, None)));

/// The proxy reqwest's default system matcher would pick for a URL with the
/// given scheme (`"http"` / `"https"`), or `None` when it would connect
/// directly.
///
/// Sources, in the matcher's order (hyper-util `client-proxy-system`):
/// protocol-specific env var, then `ALL_PROXY`, then the OS store (Windows
/// `Internet Settings` registry / macOS system configuration). The OS store
/// is only consulted when the env vars are empty, exactly as the matcher
/// fills only empty fields. A `NO_PROXY` match on the destination would send
/// the request direct in the matcher; routing direct on our side is the same
/// outcome, so it never changes a bypass decision.
pub fn effective_proxy(scheme: &str) -> Option<String> {
    // 1. Protocol-specific env var (upper-case name first, as the matcher).
    for name in match scheme {
        "http" => ["HTTP_PROXY", "http_proxy"],
        _ => ["HTTPS_PROXY", "https_proxy"],
    } {
        if let Ok(v) = std::env::var(name) {
            let v = v.trim().to_string();
            if !v.is_empty() {
                return Some(v);
            }
        }
    }
    // 2. ALL_PROXY.
    for name in ["ALL_PROXY", "all_proxy"] {
        if let Ok(v) = std::env::var(name) {
            let v = v.trim().to_string();
            if !v.is_empty() {
                return Some(v);
            }
        }
    }
    // 3. OS store (TTL-cached).
    let (http, https) = {
        let mut guard = OS_PROXY_CACHE.lock().unwrap();
        if guard.0.elapsed() >= OS_PROXY_CACHE_TTL {
            let (http, https) = read_os_proxies();
            *guard = (Instant::now(), http, https);
        }
        (guard.1.clone(), guard.2.clone())
    };
    if scheme == "http" {
        http
    } else {
        https
    }
}

/// Reads the OS-level proxy settings reqwest's system matcher would see,
/// as `(http_proxy, https_proxy)` — `None` on each side when no proxy is
/// configured for that protocol.
#[cfg(target_os = "windows")]
fn read_os_proxies() -> (Option<String>, Option<String>) {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    // The matcher reads HKCU only (hyper-util `win::with_system`), so mirror
    // that — Group-Policy (HKLM) proxies are invisible to reqwest and cannot
    // cause a self-proxy loop.
    let Ok(hkcu) = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Internet Settings")
    else {
        return (None, None);
    };
    let Ok(enabled) = hkcu.get_value::<u32, &str>("ProxyEnable") else {
        return (None, None);
    };
    if enabled != 1 {
        return (None, None);
    }
    let Ok(server) = hkcu.get_value::<String, &str>("ProxyServer") else {
        return (None, None);
    };
    // The matcher applies the raw value to both protocols.
    (Some(server.clone()), Some(server))
}

#[cfg(target_os = "macos")]
fn read_os_proxies() -> (Option<String>, Option<String>) {
    use system_configuration::core_foundation::number::CFNumber;
    use system_configuration::core_foundation::string::{CFString, CFStringRef};
    use system_configuration::dynamic_store::SCDynamicStoreBuilder;
    use system_configuration::sys::schema_definitions::{
        kSCPropNetProxiesHTTPEnable, kSCPropNetProxiesHTTPPort, kSCPropNetProxiesHTTPProxy,
        kSCPropNetProxiesHTTPSEnable, kSCPropNetProxiesHTTPSPort, kSCPropNetProxiesHTTPSProxy,
    };

    // Mirror hyper-util `mac::with_system` — the same dynamic-store keys the
    // matcher consults.
    let Some(store) = SCDynamicStoreBuilder::new("apinox-proxy-guard").build() else {
        return (None, None);
    };
    let Some(proxies) = store.get_proxies() else {
        return (None, None);
    };

    let read = |enable: CFStringRef, host: CFStringRef, port: CFStringRef| -> Option<String> {
        let enabled = proxies
            .find(enable)
            .and_then(|f| f.downcast::<CFNumber>())
            .and_then(|f| f.to_i32())
            .unwrap_or(0)
            == 1;
        if !enabled {
            return None;
        }
        let host = proxies
            .find(host)
            .and_then(|h| h.downcast::<CFString>())?
            .to_string();
        let port = proxies
            .find(port)
            .and_then(|p| p.downcast::<CFNumber>())
            .and_then(|p| p.to_i32());
        match port {
            Some(p) => Some(format!("{host}:{p}")),
            None => Some(host),
        }
    };

    (
        read(
            unsafe { kSCPropNetProxiesHTTPEnable },
            unsafe { kSCPropNetProxiesHTTPProxy },
            unsafe { kSCPropNetProxiesHTTPPort },
        ),
        read(
            unsafe { kSCPropNetProxiesHTTPSEnable },
            unsafe { kSCPropNetProxiesHTTPSProxy },
            unsafe { kSCPropNetProxiesHTTPSPort },
        ),
    )
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn read_os_proxies() -> (Option<String>, Option<String>) {
    // No OS proxy automation on other platforms (the sniffer says to set
    // HTTPS_PROXY manually), and reqwest's matcher only reads env vars here.
    (None, None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::MutexGuard;

    /// Tests that touch process-wide env vars must serialize.
    static ENV_TEST_LOCK: Mutex<()> = Mutex::new(());

    fn env_lock() -> MutexGuard<'static, ()> {
        ENV_TEST_LOCK.lock().unwrap_or_else(|p| p.into_inner())
    }

    fn clear_proxy_env() {
        for v in [
            "HTTP_PROXY",
            "http_proxy",
            "HTTPS_PROXY",
            "https_proxy",
            "ALL_PROXY",
            "all_proxy",
        ] {
            std::env::remove_var(v);
        }
    }

    #[test]
    fn test_parse_proxy_target_prefixes() {
        assert_eq!(
            parse_proxy_target("http://10.0.0.5:3128"),
            Some(("10.0.0.5", 3128))
        );
        assert_eq!(
            parse_proxy_target("https://10.0.0.5:3128/some/path"),
            Some(("10.0.0.5", 3128))
        );
        assert_eq!(
            parse_proxy_target("socks5://[::1]:1080"),
            Some(("::1", 1080))
        );
        assert_eq!(
            parse_proxy_target("127.0.0.1:8888"),
            Some(("127.0.0.1", 8888))
        );
    }

    #[test]
    fn test_parse_proxy_target_rejects_garbage() {
        assert_eq!(parse_proxy_target("not a url"), None);
        assert_eq!(parse_proxy_target("http://noport"), None);
        assert_eq!(parse_proxy_target("http://host:99999"), None);
    }

    #[test]
    fn test_is_self_proxy_flags_inapp_listeners_only() {
        for url in [
            "http://127.0.0.1:8888",
            "https://127.0.0.1:9001",
            "localhost:8888",
            "socks5://[::1]:9001",
            "http://0.0.0.0:8888",
        ] {
            assert!(is_self_proxy(url), "{url} should be a self-proxy");
        }
        for url in [
            "http://127.0.0.1:3128",
            "http://10.0.0.5:8888",
            "https://proxy.corp:8888",
            "nope",
        ] {
            assert!(!is_self_proxy(url), "{url} should NOT be a self-proxy");
        }
    }

    #[test]
    fn test_in_app_listener_ports_contains_defaults() {
        let ports = in_app_listener_ports();
        assert!(ports.contains(&8888), "proxy port 8888: {ports:?}");
        assert!(ports.contains(&9001), "mock port 9001: {ports:?}");
    }

    #[test]
    fn test_effective_proxy_prefers_protocol_env() {
        let _g = env_lock();
        clear_proxy_env();
        std::env::set_var("HTTP_PROXY", "http://http.env:3128");
        std::env::set_var("HTTPS_PROXY", "http://https.env:3129");
        std::env::set_var("ALL_PROXY", "http://all.env:3130");
        assert_eq!(
            effective_proxy("https").as_deref(),
            Some("http://https.env:3129")
        );
        assert_eq!(
            effective_proxy("http").as_deref(),
            Some("http://http.env:3128")
        );
        clear_proxy_env();
    }

    #[test]
    fn test_effective_proxy_falls_back_to_all_proxy() {
        let _g = env_lock();
        clear_proxy_env();
        // Set but empty -> skipped, matching the matcher's parse failure.
        std::env::set_var("HTTPS_PROXY", "");
        std::env::set_var("ALL_PROXY", "http://all.env:3130");
        assert_eq!(
            effective_proxy("https").as_deref(),
            Some("http://all.env:3130")
        );
        clear_proxy_env();
    }

    #[test]
    fn test_effective_proxy_env_beats_os_store() {
        // Even on a machine whose OS store is configured (a dev box with a
        // system proxy), a set env var must win — that mirrors the matcher.
        let _g = env_lock();
        clear_proxy_env();
        std::env::set_var("HTTPS_PROXY", "http://env.wins:1234");
        assert_eq!(
            effective_proxy("https").as_deref(),
            Some("http://env.wins:1234")
        );
        clear_proxy_env();
    }
}
