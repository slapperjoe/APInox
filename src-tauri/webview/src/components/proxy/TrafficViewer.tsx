import React, { useState, useMemo, useRef, useEffect } from 'react';
import { tokens } from './tokens';
import { IgnoreRule, matchesAnyIgnoreRule, ignorePatternFor } from '../../utils/useIgnoreList';

export interface TrafficLog {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  status?: number;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  duration?: number;
}

const HTTP_METHODS = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

// ── Status group definitions ───────────────────────────────────────────────
type StatusGroupKey = '1xx' | '2xx' | '3xx' | '4xx' | '5xx' | 'none';

const STATUS_GROUPS: Array<{
  key: StatusGroupKey; label: string; desc: string; fg: string; bg: string; border: string;
}> = [
  { key: '1xx',  label: '1xx', desc: 'Informational', fg: '#a0aec0', bg: 'rgba(160,174,192,0.15)', border: 'rgba(160,174,192,0.35)' },
  { key: '2xx',  label: '2xx', desc: 'Success',       fg: '#89d185', bg: 'rgba(58,110,58,0.2)',    border: 'rgba(58,110,58,0.45)'   },
  { key: '3xx',  label: '3xx', desc: 'Redirect',      fg: '#6db3e8', bg: 'rgba(14,99,156,0.2)',    border: 'rgba(14,99,156,0.45)'   },
  { key: '4xx',  label: '4xx', desc: 'Client Error',  fg: '#ddb165', bg: 'rgba(122,90,30,0.2)',    border: 'rgba(122,90,30,0.45)'   },
  { key: '5xx',  label: '5xx', desc: 'Server Error',  fg: '#f28b82', bg: 'rgba(156,14,14,0.2)',    border: 'rgba(156,14,14,0.45)'   },
  { key: 'none', label: '···', desc: 'No Response',   fg: '#6b7280', bg: 'rgba(60,60,60,0.15)',    border: 'rgba(100,100,100,0.35)' },
];

const ALL_STATUS_KEYS = new Set<StatusGroupKey>(STATUS_GROUPS.map(g => g.key) as StatusGroupKey[]);
const DEFAULT_STATUS_GROUPS = new Set<StatusGroupKey>(['2xx']);

function getStatusGroup(status?: number): StatusGroupKey {
  if (status == null) return 'none';
  if (status < 200) return '1xx';
  if (status < 300) return '2xx';
  if (status < 400) return '3xx';
  if (status < 500) return '4xx';
  return '5xx';
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// ── StatusGroupPicker ─────────────────────────────────────────────────────
interface StatusGroupPickerProps {
  selected: Set<StatusGroupKey>;
  onChange: (next: Set<StatusGroupKey>) => void;
}

function StatusGroupPicker({ selected, onChange }: StatusGroupPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAll = selected.size === STATUS_GROUPS.length;

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  function toggle(key: StatusGroupKey) {
    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
      if (next.size === 0) { onChange(new Set(ALL_STATUS_KEYS)); return; }
    } else {
      next.add(key);
    }
    onChange(next);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 7px 3px 9px',
          background: tokens.surface.input,
          border: `1px solid ${open ? tokens.status.accentDark : tokens.border.subtle}`,
          borderRadius: tokens.radius.md,
          cursor: 'pointer', minWidth: 118, outline: 'none',
          boxShadow: open ? `0 0 0 1px ${tokens.status.accentDark}` : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
          {isAll
            ? <span style={{ color: tokens.text.muted, fontSize: 11, lineHeight: '1.6' }}>All statuses</span>
            : STATUS_GROUPS.filter(g => selected.has(g.key)).map(g => (
                <span key={g.key} style={{
                  fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 8,
                  background: g.bg, color: g.fg, border: `1px solid ${g.border}`,
                  fontFamily: 'monospace',
                }}>{g.label}</span>
              ))
          }
        </div>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ flexShrink: 0, color: tokens.text.muted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 9999,
          background: tokens.surface.panel,
          border: `1px solid ${tokens.border.default}`,
          borderRadius: tokens.radius.lg,
          boxShadow: '0 12px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)',
          minWidth: 210, overflow: 'hidden',
        }}>
          {/* Quick actions */}
          <div style={{
            display: 'flex', gap: 5, padding: '7px 10px',
            borderBottom: `1px solid ${tokens.border.default}`,
            background: tokens.surface.elevated,
          }}>
            <QuickBtn label="All"      onClick={() => onChange(new Set(ALL_STATUS_KEYS))} />
            <QuickBtn label="2xx only" onClick={() => onChange(new Set(['2xx']))} />
            <QuickBtn label="Errors"   onClick={() => onChange(new Set(['4xx', '5xx']))} />
          </div>
          {/* Group rows */}
          {STATUS_GROUPS.map(g => (
            <GroupRow key={g.key} group={g} checked={selected.has(g.key)} onClick={() => toggle(g.key)} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuickBtn({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '2px 8px', fontSize: 10, fontWeight: 600,
        background: hov ? tokens.surface.active : 'transparent',
        border: `1px solid ${tokens.border.subtle}`,
        borderRadius: tokens.radius.md,
        color: tokens.text.secondary, cursor: 'pointer',
        transition: 'background 0.12s',
      }}
    >{label}</button>
  );
}

function GroupRow({ group, checked, onClick }: {
  group: typeof STATUS_GROUPS[0]; checked: boolean; onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 12px', cursor: 'pointer',
        background: hov ? tokens.surface.stripe : 'transparent',
        borderLeft: `3px solid ${checked ? group.fg : 'transparent'}`,
        transition: 'background 0.1s, border-color 0.15s',
      }}
    >
      {/* Custom checkbox */}
      <div style={{
        width: 14, height: 14, borderRadius: 3, flexShrink: 0,
        border: `1.5px solid ${checked ? group.fg : tokens.border.subtle}`,
        background: checked ? group.bg : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}>
        {checked && (
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke={group.fg} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      {/* Code pill */}
      <span style={{
        fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 8,
        background: checked ? group.bg : 'rgba(60,60,60,0.12)',
        color: checked ? group.fg : tokens.text.hint,
        border: `1px solid ${checked ? group.border : 'transparent'}`,
        fontFamily: 'monospace', minWidth: 34, textAlign: 'center',
        transition: 'all 0.15s',
      }}>{group.label}</span>
      {/* Description */}
      <span style={{
        fontSize: 11,
        color: checked ? tokens.text.secondary : tokens.text.hint,
        transition: 'color 0.15s',
      }}>{group.desc}</span>
    </div>
  );
}

// ── TrafficViewer ─────────────────────────────────────────────────────────
interface TrafficViewerProps {
  logs: TrafficLog[];
  onSelectLog?: (log: TrafficLog) => void;
  ignoreRules?: IgnoreRule[];
  onAddIgnoreRule?: (url: string, mode: 'host' | 'host+path') => void;
  /** Called when user right-clicks → "Create Mock Rule" */
  onCreateMockRule?: (log: TrafficLog) => void;
  /** Called when user right-clicks → "Create Replace Rule" */
  onCreateReplaceRule?: (log: TrafficLog) => void;
  /** Called when user right-clicks → "Create Breakpoint" */
  onCreateBreakpoint?: (log: TrafficLog) => void;
  /** Called when user right-clicks → "Add to APInox Project..." */
  onAddToApinoxProject?: (log: TrafficLog) => void;
  /** Called when user clicks "Clear Traffic" */
  onClearTraffic?: () => void;
}

export function TrafficViewer({ logs, onSelectLog, ignoreRules = [], onAddIgnoreRule, onCreateMockRule, onCreateReplaceRule, onCreateBreakpoint, onAddToApinoxProject, onClearTraffic }: TrafficViewerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [urlFilter, setUrlFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [statusGroups, setStatusGroups] = useState<Set<StatusGroupKey>>(new Set(DEFAULT_STATUS_GROUPS));
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; log: TrafficLog } | null>(null);

  // Close context menu on any click outside
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [ctxMenu]);

  const filteredLogs = useMemo(() => {
    const isAllStatus = statusGroups.size === STATUS_GROUPS.length;
    return logs.filter((log) => {
      if (ignoreRules.length > 0 && matchesAnyIgnoreRule(log.url, ignoreRules)) return false;
      if (urlFilter && !log.url.toLowerCase().includes(urlFilter.toLowerCase())) return false;
      if (methodFilter !== 'ALL' && log.method !== methodFilter) return false;
      if (!isAllStatus && !statusGroups.has(getStatusGroup(log.status))) return false;
      return true;
    });
  }, [logs, urlFilter, methodFilter, statusGroups, ignoreRules]);

  function handleSelect(log: TrafficLog) {
    setSelectedId(log.id);
    onSelectLog?.(log);
  }

  const isDefaultStatus = setsEqual(statusGroups, DEFAULT_STATUS_GROUPS);
  const hasFilters = !!urlFilter || methodFilter !== 'ALL' || !isDefaultStatus;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: tokens.surface.base }}>
      {/* Filter bar */}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap',
        gap: tokens.space['4'],
        padding: `${tokens.space['3']} ${tokens.space['6']}`,
        background: tokens.surface.elevated,
        borderBottom: `1px solid ${tokens.border.default}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: tokens.fontSize.base, color: tokens.text.secondary, fontWeight: 500, whiteSpace: 'nowrap' }}>
          Traffic ({filteredLogs.length}{logs.length !== filteredLogs.length ? `/${logs.length}` : ''})
        </span>

        {onClearTraffic && logs.length > 0 && (
          <button
            onClick={onClearTraffic}
            title="Clear all captured traffic"
            style={{
              padding: `3px 9px`,
              background: 'transparent',
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: tokens.radius.md,
              color: tokens.text.muted,
              fontSize: tokens.fontSize.sm,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            🗑 Clear
          </button>
        )}

        <input
          type="text"
          placeholder="Filter by URL…"
          value={urlFilter}
          onChange={(e) => setUrlFilter(e.target.value)}
          style={{
            flex: 1, minWidth: 80,
            padding: `4px ${tokens.space['3']}`,
            background: tokens.surface.input,
            border: `1px solid ${tokens.border.subtle}`,
            borderRadius: tokens.radius.md,
            color: tokens.text.primary,
            fontSize: tokens.fontSize.sm,
          }}
        />

        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          style={{
            padding: `4px ${tokens.space['3']}`,
            background: tokens.surface.input,
            border: `1px solid ${tokens.border.subtle}`,
            borderRadius: tokens.radius.md,
            color: tokens.text.secondary,
            fontSize: tokens.fontSize.sm,
          }}
        >
          {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        <StatusGroupPicker selected={statusGroups} onChange={setStatusGroups} />

        {hasFilters && (
          <button
            onClick={() => { setUrlFilter(''); setMethodFilter('ALL'); setStatusGroups(new Set(DEFAULT_STATUS_GROUPS)); }}
            style={{
              padding: `4px ${tokens.space['3']}`,
              background: 'transparent',
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: tokens.radius.md,
              color: tokens.text.muted,
              fontSize: tokens.fontSize.sm,
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Traffic card list */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
        {filteredLogs.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: tokens.space['4'],
            color: tokens.text.muted,
            fontSize: tokens.fontSize.sm,
          }}>
            <div style={{ fontSize: '32px' }}>📡</div>
            <div>{logs.length === 0 ? 'No traffic captured yet. Start the proxy to begin.' : 'No entries match the current filters.'}</div>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <TrafficRow
              key={log.id}
              log={log}
              isSelected={selectedId === log.id}
              onClick={handleSelect}
              onContextMenu={(e, l) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, log: l }); }}
            />
          ))
        )}
      </div>

      {/* Right-click context menu */}
      {ctxMenu && (
        <TrafficContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          log={ctxMenu.log}
          onIgnore={(mode) => {
            onAddIgnoreRule?.(ctxMenu.log.url, mode);
            setCtxMenu(null);
          }}
          onCreateMockRule={onCreateMockRule ? (log) => { onCreateMockRule(log); setCtxMenu(null); } : undefined}
          onCreateReplaceRule={onCreateReplaceRule ? (log) => { onCreateReplaceRule(log); setCtxMenu(null); } : undefined}
          onCreateBreakpoint={onCreateBreakpoint ? (log) => { onCreateBreakpoint(log); setCtxMenu(null); } : undefined}
          onAddToApinoxProject={onAddToApinoxProject ? (log) => { onAddToApinoxProject(log); setCtxMenu(null); } : undefined}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

// ── TrafficContextMenu ────────────────────────────────────────────────────
function TrafficContextMenu({
  x, y, log, onIgnore, onCreateMockRule, onCreateReplaceRule, onCreateBreakpoint, onAddToApinoxProject, onClose,
}: {
  x: number; y: number; log: TrafficLog;
  onIgnore: (mode: 'host' | 'host+path') => void;
  onCreateMockRule?: (log: TrafficLog) => void;
  onCreateReplaceRule?: (log: TrafficLog) => void;
  onCreateBreakpoint?: (log: TrafficLog) => void;
  onAddToApinoxProject?: (log: TrafficLog) => void;
  onClose: () => void;
}) {
  const hostPattern     = ignorePatternFor(log.url, 'host');
  const hostPathPattern = ignorePatternFor(log.url, 'host+path');

  const hasCreate = !!(onCreateMockRule || onCreateReplaceRule || onCreateBreakpoint);
  const hasApinox = !!onAddToApinoxProject;
  const menuH = (hasCreate ? 260 : 0) + (hasApinox ? 55 : 0) + 120;
  const top = y + menuH > window.innerHeight ? y - menuH : y;

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'fixed', top, left: x, zIndex: 99999,
        background: tokens.surface.panel,
        border: `1px solid ${tokens.border.default}`,
        borderRadius: tokens.radius.lg,
        boxShadow: '0 14px 40px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
        minWidth: 260, overflow: 'hidden',
        animation: 'ctxFadeIn 0.1s ease',
      }}
    >
      {/* Create Rule section */}
      {hasCreate && (
        <>
          <div style={{
            padding: '6px 12px',
            background: tokens.surface.elevated,
            borderBottom: `1px solid ${tokens.border.default}`,
            fontSize: 10, fontWeight: 600, color: tokens.text.muted,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>Create Rule From Traffic</div>
          {onCreateMockRule && (
            <CtxItem
              icon="🎭"
              label="Create Mock Rule"
              sub="Pre-fill response from this traffic"
              onClick={() => onCreateMockRule(log)}
            />
          )}
          {onCreateReplaceRule && (
            <CtxItem
              icon="✏️"
              label="Create Replace Rule"
              sub="Open replace rule editor"
              onClick={() => onCreateReplaceRule(log)}
            />
          )}
          {onCreateBreakpoint && (
            <CtxItem
              icon="⏸️"
              label="Create Breakpoint"
              sub="Pause matching traffic for inspection"
              onClick={() => onCreateBreakpoint(log)}
            />
          )}
          <div style={{ borderTop: `1px solid ${tokens.border.default}` }} />
        </>
      )}

      {/* APInox section */}
      {hasApinox && (
        <>
          <div style={{
            padding: '6px 12px',
            background: tokens.surface.elevated,
            borderBottom: `1px solid ${tokens.border.default}`,
            fontSize: 10, fontWeight: 600, color: tokens.text.muted,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>APInox</div>
          <CtxItem
            icon="📥"
            label="Add to APInox Project..."
            sub="Save request to project workspace"
            onClick={() => onAddToApinoxProject!(log)}
          />
          <div style={{ borderTop: `1px solid ${tokens.border.default}` }} />
        </>
      )}

      {/* Ignore section */}
      <div style={{
        padding: '6px 12px',
        background: tokens.surface.elevated,
        borderBottom: `1px solid ${tokens.border.default}`,
        fontSize: 10, fontWeight: 600, color: tokens.text.muted,
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>Ignore Traffic</div>
      <CtxItem
        icon="🌐"
        label="Ignore host"
        sub={hostPattern}
        onClick={() => onIgnore('host')}
      />
      <CtxItem
        icon="🔗"
        label="Ignore host + path"
        sub={hostPathPattern}
        onClick={() => onIgnore('host+path')}
      />
      <div style={{ borderTop: `1px solid ${tokens.border.default}` }} />
      <CtxItem icon="✕" label="Cancel" sub="" onClick={onClose} danger />
    </div>
  );
}

function CtxItem({ icon, label, sub, onClick, danger = false }: {
  icon: string; label: string; sub: string; onClick: () => void; danger?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px', cursor: 'pointer',
        background: hov ? (danger ? 'rgba(156,14,14,0.18)' : tokens.surface.stripe) : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: danger ? tokens.text.danger : tokens.text.primary }}>{label}</div>
        {sub && (
          <div style={{
            fontSize: 10, color: tokens.text.hint,
            fontFamily: 'monospace', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200,
          }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────
function extractPath(url: string): string {
  try { const u = new URL(url); return u.pathname + u.search; } catch { return url; }
}

/**
 * Extract a SOAP action string for display if the request looks like SOAP.
 * Priority: SOAPAction header → soapAction header → first Body child element local name.
 * Returns null if it doesn't appear to be a SOAP request.
 */
function extractSoapAction(log: TrafficLog): string | null {
  const headers = log.requestHeaders ?? {};
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'soapaction') {
      const val = (headers[key] as string).replace(/"/g, '').trim();
      if (val) {
        const hash = val.lastIndexOf('#');
        const slash = val.lastIndexOf('/');
        const idx = Math.max(hash, slash);
        return idx >= 0 && idx < val.length - 1 ? val.slice(idx + 1) : val;
      }
    }
  }
  const body = log.requestBody ?? '';
  if (!body.trim().startsWith('<') || !body.includes('Body')) return null;
  const match = body.match(/<(?:[a-zA-Z0-9_]+:)?Body[^>]*>\s*<(?:[a-zA-Z0-9_]+:)?([a-zA-Z0-9_]+)/);
  return match ? match[1] : null;
}

function methodBg(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':    return '#1a5c2a';
    case 'POST':   return '#1a3d5c';
    case 'PUT':    return '#5c4a1a';
    case 'PATCH':  return '#3d1a5c';
    case 'DELETE': return '#5c1a1a';
    default:       return '#3a3a3a';
  }
}

function statusStyle(status?: number) {
  if (!status) return { bg: 'rgba(60,60,60,0.2)', fg: tokens.text.muted, border: 'rgba(100,100,100,0.4)' };
  if (status < 300) return { bg: 'rgba(58,110,58,0.25)',  fg: '#89d185', border: 'rgba(58,110,58,0.5)' };
  if (status < 400) return { bg: 'rgba(14,99,156,0.25)',  fg: '#6db3e8', border: 'rgba(14,99,156,0.5)' };
  if (status < 500) return { bg: 'rgba(122,90,30,0.25)',  fg: '#ddb165', border: 'rgba(122,90,30,0.5)' };
  return                     { bg: 'rgba(156,14,14,0.25)', fg: '#f28b82', border: 'rgba(156,14,14,0.5)' };
}

// ── TrafficRow card ────────────────────────────────────────────────────────
function TrafficRow({ log, isSelected, onClick, onContextMenu }: {
  log: TrafficLog; isSelected: boolean;
  onClick: (l: TrafficLog) => void;
  onContextMenu: (e: React.MouseEvent, l: TrafficLog) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const ss = statusStyle(log.status);
  const path = extractPath(log.url);
  const soapAction = extractSoapAction(log);
  return (
    <div
      onClick={() => onClick(log)}
      onContextMenu={(e) => onContextMenu(e, log)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={log.url}
      style={{
        padding: '8px 12px',
        cursor: 'pointer',
        background: isSelected ? tokens.surface.active : hovered ? tokens.surface.stripe : 'transparent',
        borderBottom: `1px solid ${tokens.surface.elevated}`,
      }}
    >
      {/* Line 1: method badge + path (no hostname) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: soapAction ? 2 : 4 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '1px 6px',
          borderRadius: 3, fontFamily: 'monospace', flexShrink: 0,
          color: 'white', background: methodBg(log.method),
        }}>
          {log.method}
        </span>
        <span style={{
          fontSize: tokens.fontSize.sm,
          color: tokens.text.primary,
          fontFamily: 'monospace',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}>
          {path}
        </span>
      </div>
      {/* Line 2 (optional): SOAP action */}
      {soapAction && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '1px 6px',
            borderRadius: 3, flexShrink: 0,
            background: 'rgba(120,80,200,0.18)', color: '#b89ee8',
            border: '1px solid rgba(120,80,200,0.35)',
            fontFamily: 'monospace',
          }}>SOAP</span>
          <span style={{
            fontSize: 11, color: '#b89ee8', fontFamily: 'monospace',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
          }}>{soapAction}</span>
        </div>
      )}
      {/* Line 3: time + status chip + duration */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 10, color: tokens.text.hint, flexShrink: 0 }}>
          {new Date(log.timestamp).toLocaleTimeString()}
        </span>
        {log.status != null && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '1px 6px',
            borderRadius: 8, flexShrink: 0,
            background: ss.bg, color: ss.fg, border: `1px solid ${ss.border}`,
          }}>
            {log.status}
          </span>
        )}
        {log.duration != null && (
          <span style={{ fontSize: 10, color: tokens.text.muted }}>{log.duration}ms</span>
        )}
      </div>
    </div>
  );
}
