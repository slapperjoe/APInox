import React, { useState, useEffect, useRef } from 'react';
import { invokeTauriCommand } from '../../utils/bridge';
import { tokens } from './tokens';
import { SystemProxyPanel, SystemProxyStatus } from './SystemProxyPanel';
import { ProxySetupGuide } from './ProxySetupGuide';

type ProxyMode = 'proxy' | 'mock' | 'both' | 'sniffer' | 'sniffer-mock';
type SetupTab = 'env' | 'httpclient' | 'iisexpress' | 'wcf';

interface ServerControlProps {
  onStatusChange?: (info: { running: boolean; port: number; mode: string }) => void;
}

export function ServerControl({ onStatusChange }: ServerControlProps) {
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyPort, setProxyPort] = useState<number>(
    () => parseInt(localStorage.getItem('apiprox-default-port') ?? '8888')
  );
  const [targetUrl, setTargetUrl] = useState('http://localhost:3000');
  // Mode is a frontend concept — backend only knows 'proxy'/'mock'/'both'.
  // Persist to localStorage so it survives app restarts.
  const [mode, setModeState] = useState<ProxyMode>(
    () => (localStorage.getItem('apiprox-mode') as ProxyMode) ?? 'proxy'
  );
  const setMode = (m: ProxyMode) => { setModeState(m); localStorage.setItem('apiprox-mode', m); };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);
  // Prevent the background poll from interfering with in-progress start/stop operations.
  const operationInProgress = useRef(false);

  // Sniffer-specific state — only active when a sniffer mode is selected
  const [sysProxyStatus, setSysProxyStatus] = useState<SystemProxyStatus | null>(null);
  const [sysProxyLoading, setSysProxyLoading] = useState(false);
  const [sysProxyError, setSysProxyError] = useState<string | null>(null);
  const [certTrusted, setCertTrusted] = useState<boolean | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeSetupTab, setActiveSetupTab] = useState<SetupTab>('env');

  const isSniffer = mode === 'sniffer' || mode === 'sniffer-mock';

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Poll system proxy status and cert trust only when in a sniffer mode
  useEffect(() => {
    if (!isSniffer) return;
    loadSysProxyStatus();
    loadCertStatus();
    const interval = setInterval(loadSysProxyStatus, 5000);
    return () => clearInterval(interval);
  }, [isSniffer]);

  async function loadStatus() {
    // Skip polling while handleStart/handleStop is running to avoid state flickering.
    if (operationInProgress.current) return;
    try {
      const s = await invokeTauriCommand<any>('get_proxy_status');
      setStatus(s);
      setProxyEnabled(s.running);
      if (s.port) setProxyPort(s.port);
      // Never overwrite the frontend mode from the backend — sniffer/sniffer-mock are
      // frontend-only concepts; the backend only returns 'proxy' or 'both' for those.
      if (s.running && s.targetUrl !== undefined) setTargetUrl(s.targetUrl);
      onStatusChange?.({ running: s.running, port: s.port ?? proxyPort, mode });
    } catch (err: any) {
      console.error('Failed to load proxy status:', err);
    }
  }

  async function loadSysProxyStatus() {
    try {
      const s = await invokeTauriCommand<SystemProxyStatus>('get_system_proxy_status');
      setSysProxyStatus(s);
    } catch (err: any) {
      console.error('[Sniffer] Failed to load system proxy status:', err);
    }
  }

  async function loadCertStatus() {
    try {
      const info = await invokeTauriCommand<any>('get_ca_certificate_info');
      setCertTrusted(info?.isTrusted ?? false);
    } catch {
      setCertTrusted(false);
    }
  }

  async function handleStart() {
    operationInProgress.current = true;
    setLoading(true);
    setError(null);
    try {
      // Map sniffer modes to the underlying proxy mode
      const backendMode = mode === 'sniffer' ? 'proxy' : mode === 'sniffer-mock' ? 'both' : mode;
      // In sniffer mode there is no fixed target — each request is forwarded to its
      // own destination. Pass an empty targetUrl so the backend uses the request URI.
      const effectiveTargetUrl = isSniffer ? '' : targetUrl;
      await invokeTauriCommand('start_proxy', { port: proxyPort, mode: backendMode, targetUrl: effectiveTargetUrl });
      setProxyEnabled(true);
      onStatusChange?.({ running: true, port: proxyPort, mode });

      // Sniffer modes also set the OS system proxy automatically
      if (isSniffer) {
        setSysProxyLoading(true);
        setSysProxyError(null);
        try {
          await invokeTauriCommand('set_system_proxy', { port: proxyPort });
          await loadSysProxyStatus();
          await loadCertStatus();
        } catch (sysErr: any) {
          // System proxy failure is non-fatal — surface as a warning
          setSysProxyError(sysErr?.message ?? String(sysErr));
        } finally {
          setSysProxyLoading(false);
        }
      }
    } catch (err: any) {
      setError(err.message || String(err) || 'Failed to start proxy');
    } finally {
      operationInProgress.current = false;
      setLoading(false);
    }
  }

  async function handleStop() {
    operationInProgress.current = true;
    setLoading(true);
    setError(null);
    try {
      // Clear system proxy first (non-blocking on failure — e.g. macOS Touch ID cancelled)
      if (isSniffer) {
        setSysProxyLoading(true);
        setSysProxyError(null);
        try {
          await invokeTauriCommand('clear_system_proxy');
          await loadSysProxyStatus();
        } catch (sysErr: any) {
          setSysProxyError(sysErr?.message ?? String(sysErr));
        } finally {
          setSysProxyLoading(false);
        }
      }
      await invokeTauriCommand('stop_proxy');
      setProxyEnabled(false);
      onStatusChange?.({ running: false, port: proxyPort, mode });
    } catch (err: any) {
      setError(err.message || String(err) || 'Failed to stop proxy');
    } finally {
      operationInProgress.current = false;
      setLoading(false);
    }
  }

  // Manual OS proxy toggle (shown inside SystemProxyPanel when proxy is already running)
  async function handleEnableSysProxy() {
    setSysProxyLoading(true);
    setSysProxyError(null);
    try {
      await invokeTauriCommand('set_system_proxy', { port: proxyPort });
      await loadSysProxyStatus();
      await loadCertStatus();
    } catch (err: any) {
      setSysProxyError(err?.message ?? String(err));
    } finally {
      setSysProxyLoading(false);
    }
  }

  async function handleDisableSysProxy() {
    setSysProxyLoading(true);
    setSysProxyError(null);
    try {
      await invokeTauriCommand('clear_system_proxy');
      await loadSysProxyStatus();
    } catch (err: any) {
      setSysProxyError(err?.message ?? String(err));
    } finally {
      setSysProxyLoading(false);
    }
  }

  const modeLabelMap: Record<ProxyMode, string> = {
    proxy: 'Proxy Only',
    mock: 'Mock Only',
    both: 'Proxy + Mock',
    sniffer: 'Sniffer (System Proxy)',
    'sniffer-mock': 'Sniffer + Mock',
  };

  return (
    <div style={{
      padding: '20px',
      background: tokens.surface.panel,
      borderRadius: tokens.radius.lg,
      marginBottom: '20px'
    }}>
      <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 500 }}>
        Proxy Server Control
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Main controls — all in one row */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Mode dropdown */}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ProxyMode)}
            disabled={proxyEnabled || loading}
            title="Mode"
            style={{
              flexShrink: 0,
              width: '190px',
              padding: '8px 12px',
              background: tokens.surface.input,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: tokens.radius.md,
              color: tokens.text.secondary,
              fontSize: tokens.fontSize.base,
              appearance: 'none',
              WebkitAppearance: 'none',
            }}
          >
            <option value="proxy">Proxy Only</option>
            <option value="mock">Mock Only</option>
            <option value="both">Proxy + Mock</option>
            <option value="sniffer">Sniffer (System Proxy)</option>
            <option value="sniffer-mock">Sniffer + Mock</option>
          </select>

          {/* Target URL — hidden in sniffer mode (system proxy routes by request destination) */}
          {!isSniffer && (
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              disabled={proxyEnabled || loading}
              placeholder="Target URL (e.g. http://localhost:3000)"
              title="Upstream server to forward requests to"
              style={{
                flex: 1,
                padding: '8px 12px',
                background: tokens.surface.input,
                border: `1px solid ${tokens.border.subtle}`,
                borderRadius: tokens.radius.md,
                color: tokens.text.secondary,
                fontSize: tokens.fontSize.base,
              }}
            />
          )}

          {/* Port */}
          <input
            type="number"
            value={proxyPort}
            onChange={(e) => setProxyPort(parseInt(e.target.value))}
            disabled={proxyEnabled || loading}
            title="Proxy port"
            style={{
              flexShrink: 0,
              width: '90px',
              padding: '8px 12px',
              background: tokens.surface.input,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: tokens.radius.md,
              color: tokens.text.secondary,
              fontSize: tokens.fontSize.base,
            }}
          />

          {/* Start / Stop */}
          {!proxyEnabled ? (
            <button
              onClick={handleStart}
              disabled={loading}
              style={{
                flexShrink: 0,
                padding: '8px 20px',
                background: tokens.status.accentDark,
                border: 'none',
                borderRadius: tokens.radius.md,
                color: tokens.text.white,
                fontSize: tokens.fontSize.base,
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Starting…' : isSniffer ? '▶ Start Sniffer' : '▶ Start Proxy'}
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading}
              style={{
                flexShrink: 0,
                padding: '8px 20px',
                background: '#c5000b',
                border: 'none',
                borderRadius: tokens.radius.md,
                color: tokens.text.white,
                fontSize: tokens.fontSize.base,
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Stopping…' : isSniffer ? '■ Stop Sniffer' : '■ Stop Proxy'}
            </button>
          )}
        </div>

        {/* Sniffer mode hint */}
        {isSniffer && (
          <div style={{ fontSize: tokens.fontSize.xs, color: tokens.text.muted }}>
            In sniffer mode the OS system proxy is set automatically — all HTTP/HTTPS traffic is captured without a fixed target URL.
          </div>
        )}

        {/* Running status banner */}
        {proxyEnabled && (
          <div style={{
            padding: '12px',
            background: '#1a3d1a',
            border: '1px solid #2d6a2d',
            borderRadius: tokens.radius.md,
            fontSize: tokens.fontSize.base,
            color: '#6fbf6f',
          }}>
            🟢 {modeLabelMap[mode]} running on port {proxyPort}
          </div>
        )}

        {error && (
          <div style={{
            padding: '12px',
            background: '#3d1a1a',
            border: '1px solid #6a2d2d',
            borderRadius: tokens.radius.md,
            fontSize: tokens.fontSize.base,
            color: '#bf6f6f',
          }}>
            ❌ {error}
          </div>
        )}

        {/* System proxy panel — only in sniffer modes */}
        {isSniffer && (
          <div style={{
            padding: '16px',
            background: tokens.surface.elevated,
            border: `1px solid ${tokens.border.default}`,
            borderRadius: tokens.radius.md,
          }}>
            <div style={{ fontSize: tokens.fontSize.sm, fontWeight: 600, color: tokens.text.secondary, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              System Proxy
            </div>
            <SystemProxyPanel
              status={sysProxyStatus}
              loading={sysProxyLoading}
              error={sysProxyError}
              certTrusted={certTrusted}
              onEnable={handleEnableSysProxy}
              onDisable={handleDisableSysProxy}
            />
          </div>
        )}
      </div>

      {/* Advanced setup guide — collapsed by default */}
      <div style={{ marginTop: '16px', borderTop: `1px solid ${tokens.border.default}`, paddingTop: '8px' }}>
        <button
          onClick={() => setShowAdvanced(v => !v)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: tokens.space['3'],
            padding: `${tokens.space['3']} 0`,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: tokens.text.muted,
            fontSize: tokens.fontSize.sm,
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: '10px', transition: 'transform 0.15s', transform: showAdvanced ? 'rotate(90deg)' : 'none' }}>▶</span>
          Advanced: manual proxy setup (for apps that don't use the system proxy)
        </button>
        {showAdvanced && (
          <div style={{ paddingBottom: '8px' }}>
            <ProxySetupGuide activeTab={activeSetupTab} onTabChange={setActiveSetupTab} />
          </div>
        )}
      </div>
    </div>
  );
}
