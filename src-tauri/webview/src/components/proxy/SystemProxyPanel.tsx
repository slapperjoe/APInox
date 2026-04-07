import React from 'react';
import { tokens } from './tokens';

export interface SystemProxyStatus {
  enabled: boolean;
  host: string;
  port: number | null;
  /** "windows" | "macos" | "linux" | "unknown" */
  platform: string;
  /** Whether set/clear automation is supported on this platform */
  automationSupported: boolean;
  /** macOS only: whether Touch ID / password is required to change settings */
  requiresElevation: boolean;
  /** macOS only: network services the proxy will be applied to */
  networkServices: string[];
}

export interface SystemProxyPanelProps {
  status: SystemProxyStatus | null;
  loading: boolean;
  error: string | null;
  certTrusted: boolean | null;
  onEnable: () => void;
  onDisable: () => void;
}

export function SystemProxyPanel({ status, loading, error, certTrusted, onEnable, onDisable }: SystemProxyPanelProps) {
  const isWindows = status?.platform === 'windows';
  const isMacos = status?.platform === 'macos';
  const isEnabled = status?.enabled ?? false;
  const canAutomate = status?.automationSupported ?? false;
  const needsElevation = status?.requiresElevation ?? false;
  const services = status?.networkServices ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space['4'] }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space['5'], flexWrap: 'wrap' }}>
        {/* Status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space['3'] }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: isEnabled ? tokens.status.success : tokens.status.error,
            boxShadow: isEnabled ? `0 0 5px ${tokens.status.successGlow}` : `0 0 5px ${tokens.status.errorGlow}`,
            flexShrink: 0,
          }} />
          <span style={{ fontSize: tokens.fontSize.base, color: tokens.text.secondary }}>
            {status == null
              ? 'Checking…'
              : isEnabled
                ? `System proxy active → ${status.host}${status.port ? `:${status.port}` : ''}`
                : 'System proxy not set'}
          </span>
        </div>

        {/* Toggle button — only shown when not managed by ServerControl start/stop */}
        {canAutomate && (
          isEnabled ? (
            <button onClick={onDisable} disabled={loading} style={dangerButtonStyle(loading)}>
              {loading ? 'Disabling…' : 'Disable System Proxy'}
            </button>
          ) : (
            <button onClick={onEnable} disabled={loading} style={primaryButtonStyle(loading)}>
              {loading
                ? (needsElevation ? 'Waiting for authorisation…' : 'Enabling…')
                : (needsElevation ? '🔐 Enable System Proxy (port 8888)' : 'Enable System Proxy (port 8888)')}
            </button>
          )
        )}

        {/* No automation support (Linux) */}
        {status && !canAutomate && (
          <div style={{ fontSize: tokens.fontSize.sm, color: tokens.text.muted, fontStyle: 'italic' }}>
            Automatic proxy configuration is not supported on this platform. Use the setup guide below.
          </div>
        )}
      </div>

      {/* macOS elevation notice — changes based on whether proxy is active */}
      {isMacos && canAutomate && (
        isEnabled ? (
          <div style={{
            display: 'flex',
            gap: tokens.space['3'],
            padding: tokens.space['4'],
            background: '#1a2d1a',
            border: `1px solid #2d5a2d`,
            borderRadius: tokens.radius.md,
            fontSize: tokens.fontSize.sm,
            color: '#6fbf6f',
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>🔐</span>
            <div>
              <strong style={{ color: tokens.text.primary }}>Administrator access granted</strong>
              {' '}— proxy is active on{' '}
              {services.length > 0
                ? <em>{services.join(', ')}</em>
                : 'all network services'}.
              {' '}Disable does not require another prompt.
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            gap: tokens.space['3'],
            padding: tokens.space['4'],
            background: tokens.surface.elevated,
            border: `1px solid ${tokens.border.subtle}`,
            borderRadius: tokens.radius.md,
            fontSize: tokens.fontSize.sm,
            color: tokens.text.secondary,
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>🔐</span>
            <div>
              <strong style={{ color: tokens.text.primary }}>macOS requires administrator access</strong> to change system proxy settings.
              Clicking Enable will show a native <strong style={{ color: tokens.text.primary }}>Touch ID or password prompt</strong>.
              {services.length > 0 && (
                <span style={{ color: tokens.text.muted }}>
                  {' '}Will apply to: <em>{services.join(', ')}</em>.
                </span>
              )}
            </div>
          </div>
        )
      )}

      {/* Cert trust — show reminder only when not yet trusted, confirmation when trusted */}
      {isMacos && canAutomate && (
        certTrusted === true ? (
          <div style={{
            display: 'flex',
            gap: tokens.space['3'],
            padding: tokens.space['4'],
            background: '#1a2d3d',
            border: `1px solid #2d5a8a`,
            borderRadius: tokens.radius.md,
            fontSize: tokens.fontSize.sm,
            color: '#6f9fbf',
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>✓</span>
            <div>
              <strong style={{ color: tokens.text.primary }}>HTTPS interception ready</strong>
              {' '}— CA certificate is trusted by this Mac.
            </div>
          </div>
        ) : certTrusted === false ? (
          <div style={{
            display: 'flex',
            gap: tokens.space['3'],
            padding: tokens.space['4'],
            background: tokens.surface.elevated,
            border: `1px solid ${tokens.border.subtle}`,
            borderRadius: tokens.radius.md,
            fontSize: tokens.fontSize.sm,
            color: tokens.text.muted,
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>💡</span>
            <div>
              For <strong style={{ color: tokens.text.secondary }}>HTTPS traffic</strong>, also trust the CA certificate
              so apps don't reject the intercepted connection.
              Go to <strong style={{ color: tokens.text.secondary }}>Settings → Certificate Management → Install to System Trust Store</strong> first.
            </div>
          </div>
        ) : null
      )}

      {/* Windows — simpler, no elevation needed */}
      {isWindows && canAutomate && (
        <>
          <div style={{ fontSize: tokens.fontSize.xs, color: tokens.text.muted }}>
            Sets the system proxy via registry (HKCU Internet Settings). No administrator rights required.
            Applies to Chrome, Edge, and .NET HttpClient (WinHTTP).
          </div>
          {certTrusted === true ? (
            <div style={{
              display: 'flex', gap: tokens.space['3'], padding: tokens.space['3'],
              background: '#1a2d3d', border: `1px solid #2d5a8a`,
              borderRadius: tokens.radius.md, fontSize: tokens.fontSize.sm, color: '#6f9fbf',
            }}>
              ✓ CA certificate trusted — HTTPS interception ready
            </div>
          ) : certTrusted === false ? (
            <div style={{
              display: 'flex', gap: tokens.space['3'], padding: tokens.space['3'],
              background: tokens.surface.elevated, border: `1px solid ${tokens.border.subtle}`,
              borderRadius: tokens.radius.md, fontSize: tokens.fontSize.sm, color: tokens.text.muted,
            }}>
              💡 For HTTPS traffic, go to <strong style={{ color: tokens.text.secondary }}>Settings → Certificate Management → Install to System Trust Store</strong>
            </div>
          ) : null}
        </>
      )}

      {error && (
        <div style={{
          padding: tokens.space['4'],
          background: tokens.surface.danger,
          border: `1px solid #6a2d2d`,
          borderRadius: tokens.radius.md,
          fontSize: tokens.fontSize.sm,
          color: tokens.text.danger,
        }}>
          {error === 'Authentication cancelled'
            ? '🔐 Authentication cancelled — system proxy was not changed.'
            : `❌ ${error}`}
        </div>
      )}
    </div>
  );
}

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: `8px ${tokens.space['5']}`,
    background: disabled ? tokens.surface.input : tokens.status.accentDark,
    border: 'none',
    borderRadius: tokens.radius.md,
    color: tokens.text.white,
    fontSize: tokens.fontSize.base,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}

function dangerButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: `8px ${tokens.space['5']}`,
    background: disabled ? tokens.surface.input : '#c5000b',
    border: 'none',
    borderRadius: tokens.radius.md,
    color: tokens.text.white,
    fontSize: tokens.fontSize.base,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}
