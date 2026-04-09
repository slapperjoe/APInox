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
  const [mode, setModeState] = useState<ProxyMode>(
    () => (localStorage.getItem('apiprox-mode') as ProxyMode) ?? 'proxy'
  );
  const setMode = (m: ProxyMode) => { setModeState(m); localStorage.setItem('apiprox-mode', m); };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);
  const operationInProgress = useRef(false);

  const [sysProxyStatus, setSysProxyStatus] = useState<SystemProxyStatus | null>(null);
  const [sysProxyLoading, setSysProxyLoading] = useState(false);
  const [sysProxyError, setSysProxyError] = useState<string | null>(null);
  const [certTrusted, setCertTrusted] = useState<boolean | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeSetupTab, setActiveSetupTab] = useState<SetupTab>('env');

  // Minimized state — persisted so it survives navigation
  const [minimized, setMinimized] = useState<boolean>(
    () => localStorage.getItem('apiprox-control-minimized') === 'true'
  );
  const toggleMinimized = () => setMinimized(v => {
    localStorage.setItem('apiprox-control-minimized', String(!v));
    return !v;
  });

  const isSniffer = mode === 'sniffer' || mode === 'sniffer-mock';

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isSniffer) return;
    loadSysProxyStatus();
    loadCertStatus();
    const interval = setInterval(loadSysProxyStatus, 5000);
    return () => clearInterval(interval);
  }, [isSniffer]);

  async function loadStatus() {
    if (operationInProgress.current) return;
    try {
      const s = await invokeTauriCommand<any>('get_proxy_status');
      setStatus(s);
      setProxyEnabled(s.running);
      if (s.port) setProxyPort(s.port);
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
      const backendMode = mode === 'sniffer' ? 'proxy' : mode === 'sniffer-mock' ? 'both' : mode;
      const effectiveTargetUrl = isSniffer ? '' : targetUrl;
      await invokeTauriCommand('start_proxy', { port: proxyPort, mode: backendMode, targetUrl: effectiveTargetUrl });
      setProxyEnabled(true);
      onStatusChange?.({ running: true, port: proxyPort, mode });
      // Collapse to minimized bar so traffic area gets full space
      setMinimized(true);
      localStorage.setItem('apiprox-control-minimized', 'true');

      if (isSniffer) {
        setSysProxyLoading(true);
        setSysProxyError(null);
        try {
          await invokeTauriCommand('set_system_proxy', { port: proxyPort });
          await loadSysProxyStatus();
          await loadCertStatus();
        } catch (sysErr: any) {
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
    proxy: 'Proxy',
    mock: 'Mock',
    both: 'Proxy + Mock',
    sniffer: 'Sniffer',
    'sniffer-mock': 'Sniffer + Mock',
  };

  const modeColors: Record<ProxyMode, string> = {
    proxy: tokens.status.accentDark,
    mock: '#7c5fc5',
    both: '#2a7a4b',
    sniffer: '#b07a20',
    'sniffer-mock': '#7c5fc5',
  };

  // ── Minimized bar ──────────────────────────────────────────────────────────
  if (minimized) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '6px 12px',
        background: tokens.surface.panel,
        borderBottom: `1px solid ${tokens.border.default}`,
        minHeight: '38px',
        flexShrink: 0,
      }}>
        {/* Expand toggle */}
        <button
          onClick={toggleMinimized}
          title="Expand server controls"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: tokens.text.muted, padding: '2px 4px', lineHeight: 1,
            fontSize: '11px', flexShrink: 0,
            display: 'flex', alignItems: 'center',
          }}
        >
          ▼
        </button>

        {/* Status dot */}
        <span
          title={proxyEnabled ? 'Running' : 'Stopped'}
          style={{
            width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
            background: proxyEnabled ? '#4caf50' : tokens.text.hint,
            boxShadow: proxyEnabled ? '0 0 6px #4caf5088' : 'none',
            transition: 'background 0.3s',
          }}
        />

        {/* Mode badge */}
        <span style={{
          fontSize: tokens.fontSize.xs, fontWeight: 600,
          padding: '2px 8px', borderRadius: '10px',
          background: proxyEnabled ? modeColors[mode] + '22' : tokens.surface.elevated,
          color: proxyEnabled ? modeColors[mode] : tokens.text.hint,
          border: `1px solid ${proxyEnabled ? modeColors[mode] + '55' : tokens.border.subtle}`,
          flexShrink: 0, letterSpacing: '0.02em',
        }}>
          {modeLabelMap[mode]}
        </span>

        {/* Port */}
        <span style={{ fontSize: tokens.fontSize.xs, color: tokens.text.muted, flexShrink: 0 }}>
          :{proxyPort}
        </span>

        {/* Target URL — show when not sniffer and not running (running shows status text instead) */}
        {!isSniffer && !proxyEnabled && targetUrl && (
          <span style={{
            fontSize: tokens.fontSize.xs, color: tokens.text.hint,
            fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', flex: 1, minWidth: 0,
          }} title={targetUrl}>
            → {targetUrl}
          </span>
        )}

        {/* Running text */}
        {proxyEnabled && (
          <span style={{ fontSize: tokens.fontSize.xs, color: '#4caf50', flex: 1, minWidth: 0 }}>
            {isSniffer ? 'Intercepting system traffic' : `Forwarding → ${targetUrl}`}
          </span>
        )}

        {/* Sniffer sys-proxy status chip */}
        {isSniffer && proxyEnabled && sysProxyStatus && (
          <span style={{
            fontSize: tokens.fontSize.xs,
            padding: '2px 7px', borderRadius: '10px',
            background: sysProxyStatus.enabled ? 'rgba(76,175,80,0.12)' : 'rgba(180,30,30,0.12)',
            color: sysProxyStatus.enabled ? '#4caf50' : tokens.text.danger,
            border: `1px solid ${sysProxyStatus.enabled ? 'rgba(76,175,80,0.35)' : 'rgba(180,30,30,0.35)'}`,
            flexShrink: 0,
          }}>
            OS proxy {sysProxyStatus.enabled ? 'on' : 'off'}
          </span>
        )}

        {/* Error indicator */}
        {error && (
          <span title={error} style={{
            fontSize: tokens.fontSize.xs, color: tokens.text.danger, flexShrink: 0,
          }}>
            ⚠ error
          </span>
        )}

        {/* Start / Stop */}
        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
          {!proxyEnabled ? (
            <button
              onClick={handleStart}
              disabled={loading}
              style={{
                padding: '4px 14px',
                background: tokens.status.accentDark,
                border: 'none',
                borderRadius: tokens.radius.md,
                color: tokens.text.white,
                fontSize: tokens.fontSize.xs,
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Starting…' : '▶ Start'}
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading}
              style={{
                padding: '4px 14px',
                background: '#c5000b',
                border: 'none',
                borderRadius: tokens.radius.md,
                color: tokens.text.white,
                fontSize: tokens.fontSize.xs,
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Stopping…' : '■ Stop'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Expanded panel ─────────────────────────────────────────────────────────
  return (
    <div style={{
      padding: '12px 16px',
      background: tokens.surface.panel,
    }}>
      {/* Header row with collapse toggle */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <button
          onClick={toggleMinimized}
          title="Collapse server controls"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: tokens.text.muted, padding: '2px 6px 2px 0', lineHeight: 1,
            fontSize: '11px', flexShrink: 0,
            display: 'flex', alignItems: 'center',
          }}
        >
          ▲
        </button>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 500 }}>
          Server Control
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Main controls row */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ProxyMode)}
            disabled={proxyEnabled || loading}
            title="Mode"
            style={{
              flexShrink: 0,
              width: '190px',
              padding: '6px 10px',
              background: tokens.surface.input,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: tokens.radius.md,
              color: tokens.text.secondary,
              fontSize: tokens.fontSize.sm,
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
                padding: '6px 10px',
                background: tokens.surface.input,
                border: `1px solid ${tokens.border.subtle}`,
                borderRadius: tokens.radius.md,
                color: tokens.text.secondary,
                fontSize: tokens.fontSize.sm,
              }}
            />
          )}

          <input
            type="number"
            value={proxyPort}
            onChange={(e) => setProxyPort(parseInt(e.target.value))}
            disabled={proxyEnabled || loading}
            title="Proxy port"
            style={{
              flexShrink: 0,
              width: '90px',
              padding: '6px 10px',
              background: tokens.surface.input,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: tokens.radius.md,
              color: tokens.text.secondary,
              fontSize: tokens.fontSize.sm,
            }}
          />

          {!proxyEnabled ? (
            <button
              onClick={handleStart}
              disabled={loading}
              style={{
                flexShrink: 0,
                padding: '6px 18px',
                background: tokens.status.accentDark,
                border: 'none',
                borderRadius: tokens.radius.md,
                color: tokens.text.white,
                fontSize: tokens.fontSize.sm,
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
                padding: '6px 18px',
                background: '#c5000b',
                border: 'none',
                borderRadius: tokens.radius.md,
                color: tokens.text.white,
                fontSize: tokens.fontSize.sm,
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Stopping…' : isSniffer ? '■ Stop Sniffer' : '■ Stop Proxy'}
            </button>
          )}
        </div>

        {isSniffer && (
          <div style={{ fontSize: tokens.fontSize.xs, color: tokens.text.muted }}>
            In sniffer mode the OS system proxy is set automatically — all HTTP/HTTPS traffic is captured without a fixed target URL.
          </div>
        )}

        {proxyEnabled && (
          <div style={{
            padding: '8px 12px',
            background: '#1a3d1a',
            border: '1px solid #2d6a2d',
            borderRadius: tokens.radius.md,
            fontSize: tokens.fontSize.sm,
            color: '#6fbf6f',
          }}>
            🟢 {modeLabelMap[mode]} running on port {proxyPort}
          </div>
        )}

        {error && (
          <div style={{
            padding: '8px 12px',
            background: '#3d1a1a',
            border: '1px solid #6a2d2d',
            borderRadius: tokens.radius.md,
            fontSize: tokens.fontSize.sm,
            color: '#bf6f6f',
          }}>
            ❌ {error}
          </div>
        )}

        {isSniffer && (
          <div style={{
            padding: '12px',
            background: tokens.surface.elevated,
            border: `1px solid ${tokens.border.default}`,
            borderRadius: tokens.radius.md,
          }}>
            <div style={{ fontSize: tokens.fontSize.xs, fontWeight: 600, color: tokens.text.secondary, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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

      {/* Advanced setup guide */}
      <div style={{ marginTop: '10px', borderTop: `1px solid ${tokens.border.default}`, paddingTop: '6px' }}>
        <button
          onClick={() => setShowAdvanced(v => !v)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: tokens.space['3'],
            padding: `${tokens.space['2']} 0`,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: tokens.text.muted,
            fontSize: tokens.fontSize.xs,
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: '10px', transition: 'transform 0.15s', transform: showAdvanced ? 'rotate(90deg)' : 'none' }}>▶</span>
          Advanced: manual proxy setup
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
