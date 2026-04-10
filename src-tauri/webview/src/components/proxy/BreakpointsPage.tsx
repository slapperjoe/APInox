import React, { useState, useEffect, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invokeTauriCommand } from '../../utils/bridge';
import { tokens } from './tokens';
import { MonacoRequestEditorWithToolbar, HeadersPanel } from '@apinox/request-editor';

interface BreakpointCondition {
  type: 'url' | 'method' | 'statusCode' | 'header' | 'contains';
  pattern: string;
  isRegex?: boolean;
  headerName?: string;
}

export interface BreakpointRule {
  id: string;
  name: string;
  enabled: boolean;
  target: 'request' | 'response' | 'both';
  conditions: BreakpointCondition[];
}

interface PausedTraffic {
  id: string;
  timestamp: number;
  pauseType: 'request' | 'response';
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: string;
  statusCode?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  matchedRule: string;
}

export function BreakpointsPage({ initialRule, onInitialRuleConsumed }: {
  initialRule?: BreakpointRule | null;
  onInitialRuleConsumed?: () => void;
} = {}) {
  const [rules, setRules] = useState<BreakpointRule[]>([]);
  const [queue, setQueue] = useState<PausedTraffic[]>([]);
  const [editingRule, setEditingRule] = useState<BreakpointRule | null>(null);
  const [editingTraffic, setEditingTraffic] = useState<PausedTraffic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editedBody, setEditedBody] = useState<string>('');
  const [rawBody, setRawBody] = useState<string>('');
  const [formattedOriginalBody, setFormattedOriginalBody] = useState<string>('');
  const [editedHeaders, setEditedHeaders] = useState<Record<string, string>>({});
  const [autoTimeoutSecs, setAutoTimeoutSecs] = useState<number>(() => {
    const saved = localStorage.getItem('apiprox-bp-timeout');
    return saved ? parseInt(saved, 10) : 90;
  });
  const [autoTimeoutAction, setAutoTimeoutAction] = useState<'allow' | 'drop'>(() => {
    const saved = localStorage.getItem('apiprox-bp-timeout-action');
    return (saved === 'drop') ? 'drop' : 'allow';
  });
  const [now, setNow] = useState<number>(Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Open edit modal pre-filled when a rule is passed in from traffic context menu
  useEffect(() => {
    if (initialRule) {
      setEditingRule(initialRule);
      onInitialRuleConsumed?.();
    }
  }, [initialRule]);

  useEffect(() => {
    loadRules();
    loadQueue();

    const unlisten = listen<PausedTraffic[]>('breakpoint-paused', (event) => {
      setQueue(event.payload);
    });

    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Tick every 500 ms to drive progress bars
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 500);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  // Auto-continue or auto-drop timed-out items
  useEffect(() => {
    const totalMs = autoTimeoutSecs * 1000;
    queue.forEach((item) => {
      if (now - item.timestamp >= totalMs) {
        if (autoTimeoutAction === 'drop') {
          handleDrop(item.id);
        } else {
          handleContinue(item.id);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, autoTimeoutAction]);

  async function loadRules() {
    try {
      const response = await invokeTauriCommand<BreakpointRule[] | { rules: BreakpointRule[] }>('get_breakpoint_rules');
      setRules(Array.isArray(response) ? response : (response.rules || []));
    } catch (error) {
      console.error('Failed to load breakpoint rules:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadQueue() {
    try {
      const response = await invokeTauriCommand<PausedTraffic[] | { queue: PausedTraffic[] }>('get_paused_traffic');
      setQueue(Array.isArray(response) ? response : (response.queue || []));
    } catch (error) {
      console.error('Failed to load breakpoint queue:', error);
    }
  }

  async function handleAddRule() {
    const newRule: BreakpointRule = {
      id: `bp-${Date.now()}`,
      name: 'New Breakpoint',
      enabled: true,
      target: 'request',
      conditions: [{ type: 'url', pattern: '/api/*', isRegex: false }]
    };
    setEditingRule(newRule);
  }

  async function handleSaveRule() {
    if (!editingRule) return;

    try {
      const isNew = !rules.find(r => r.id === editingRule.id);

      if (isNew) {
        await invokeTauriCommand('add_breakpoint_rule', { rule: editingRule });
      } else {
        await invokeTauriCommand('update_breakpoint_rule', { id: editingRule.id, rule: editingRule });
      }

      await loadRules();
      setEditingRule(null);
    } catch (error) {
      console.error('Failed to save rule:', error);
      alert('Failed to save rule: ' + (error as Error).message);
    }
  }

  async function handleDeleteRule(id: string) {
    if (!confirm('Delete this breakpoint?')) return;

    try {
      await invokeTauriCommand('delete_breakpoint_rule', { id });
      await loadRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  }

  async function handleToggleRule(id: string) {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;

    try {
      await invokeTauriCommand('update_breakpoint_rule', { id, rule: { ...rule, enabled: !rule.enabled } });
      await loadRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  }

  async function handleContinue(id: string, modifications?: { body?: string; headers?: Record<string, string> }) {
    try {
      await invokeTauriCommand('continue_breakpoint', {
        id,
        modifiedBody: modifications?.body ?? null,
        modifiedHeaders: modifications?.headers ?? null,
        modifiedStatusCode: null,
      });
      await loadQueue();
      setEditingTraffic(null);
    } catch (error) {
      console.error('Failed to continue traffic:', error);
    }
  }

  async function handleDrop(id: string) {
    try {
      await invokeTauriCommand('drop_breakpoint', { id });
      await loadQueue();
      setEditingTraffic(null);
    } catch (error) {
      console.error('Failed to drop traffic:', error);
    }
  }

  function addCondition() {
    if (!editingRule) return;
    setEditingRule({
      ...editingRule,
      conditions: [...editingRule.conditions, { type: 'url', pattern: '', isRegex: false }]
    });
  }

  function removeCondition(index: number) {
    if (!editingRule) return;
    setEditingRule({
      ...editingRule,
      conditions: editingRule.conditions.filter((_, i) => i !== index)
    });
  }

  function updateCondition(index: number, updates: Partial<BreakpointCondition>) {
    if (!editingRule) return;
    const newConditions = [...editingRule.conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setEditingRule({ ...editingRule, conditions: newConditions });
  }

  function detectLanguage(headers: Record<string, string> = {}): string {
    const ct = headers['content-type'] || headers['Content-Type'] || '';
    if (ct.includes('xml') || ct.includes('soap')) return 'xml';
    if (ct.includes('json')) return 'json';
    return 'text';
  }

  function getDirectText(el: Element): string {
    let text = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent || '';
    }
    return text;
  }

  function collectXmlChanges(
    orig: Element,
    edit: Element,
    changes: Array<{ localName: string; oldText: string; newText: string }>
  ) {
    const origText = getDirectText(orig).trim();
    const editText = getDirectText(edit).trim();
    if (origText !== editText && origText) {
      changes.push({ localName: orig.localName, oldText: origText, newText: editText });
    }
    const origKids = Array.from(orig.children);
    const editKids = Array.from(edit.children);
    for (let i = 0; i < Math.min(origKids.length, editKids.length); i++) {
      collectXmlChanges(origKids[i], editKids[i], changes);
    }
  }

  function patchXmlBody(raw: string, fmtOrig: string, fmtEdited: string): string {
    if (!raw || fmtOrig === fmtEdited) return raw;
    const parser = new DOMParser();
    const origDoc = parser.parseFromString(fmtOrig, 'text/xml');
    const editDoc = parser.parseFromString(fmtEdited, 'text/xml');
    if (origDoc.querySelector('parsererror') || editDoc.querySelector('parsererror')) {
      return fmtEdited;
    }
    const changes: Array<{ localName: string; oldText: string; newText: string }> = [];
    collectXmlChanges(origDoc.documentElement, editDoc.documentElement, changes);
    if (changes.length === 0) return raw;
    let result = raw;
    for (const { localName, oldText, newText } of changes) {
      const escapedOld = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(>)${escapedOld}(<\\/[^:>]*:?${localName}>)`, 'g');
      result = result.replace(re, `$1${newText}$2`);
    }
    return result;
  }

  function formatXmlForDisplay(xml: string): string {
    if (!xml.trim()) return xml;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml.trim(), 'text/xml');
      if (doc.querySelector('parsererror')) return xml;
      const indent = (node: Node, depth: number): string => {
        const PAD = '  ';
        if (node.nodeType === Node.TEXT_NODE) return (node.textContent || '').trim();
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const el = node as Element;
        const attrs = Array.from(el.attributes).map(a => ` ${a.name}="${a.value}"`).join('');
        const children = Array.from(el.childNodes);
        const hasEl = children.some(c => c.nodeType === Node.ELEMENT_NODE);
        const text = children.filter(c => c.nodeType === Node.TEXT_NODE).map(c => (c.textContent || '').trim()).join('');
        if (!hasEl && text) return `${PAD.repeat(depth)}<${el.tagName}${attrs}>${text}</${el.tagName}>`;
        if (!hasEl) return `${PAD.repeat(depth)}<${el.tagName}${attrs}/>`;
        const inner = children.map(c => indent(c, depth + 1)).filter(s => s.length > 0);
        return [`${PAD.repeat(depth)}<${el.tagName}${attrs}>`, ...inner, `${PAD.repeat(depth)}</${el.tagName}>`].join('\n');
      };
      const declMatch = xml.match(/^<\?xml[^?]*\?>/);
      return (declMatch ? declMatch[0] + '\n' : '') + indent(doc.documentElement, 0);
    } catch {
      return xml;
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ color: tokens.text.muted }}>Loading breakpoints...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px', overflow: 'auto' }}>
      {/* Paused Traffic Queue */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 500 }}>
            Paused Traffic ({queue.length})
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space['4'], fontSize: tokens.fontSize.sm, color: tokens.text.muted }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: tokens.space['2'] }}>
              Auto-timeout:
              <input
                type="number"
                min={5}
                max={600}
                value={autoTimeoutSecs}
                onChange={(e) => {
                  const v = Math.max(5, parseInt(e.target.value, 10) || 90);
                  setAutoTimeoutSecs(v);
                  localStorage.setItem('apiprox-bp-timeout', String(v));
                }}
                style={{
                  width: '56px',
                  padding: `2px ${tokens.space['2']}`,
                  background: tokens.surface.input,
                  border: `1px solid ${tokens.border.subtle}`,
                  borderRadius: tokens.radius.sm,
                  color: tokens.text.secondary,
                  fontSize: tokens.fontSize.sm,
                  textAlign: 'center',
                }}
              />
              s
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0', borderRadius: tokens.radius.sm, overflow: 'hidden', border: `1px solid ${tokens.border.subtle}` }}>
              <button
                onClick={() => { setAutoTimeoutAction('allow'); localStorage.setItem('apiprox-bp-timeout-action', 'allow'); }}
                style={{
                  padding: `2px ${tokens.space['3']}`,
                  fontSize: tokens.fontSize.sm,
                  border: 'none',
                  cursor: 'pointer',
                  background: autoTimeoutAction === 'allow' ? tokens.status.success : tokens.surface.input,
                  color: autoTimeoutAction === 'allow' ? tokens.text.white : tokens.text.muted,
                  fontWeight: autoTimeoutAction === 'allow' ? 600 : 400,
                }}
              >
                Allow
              </button>
              <button
                onClick={() => { setAutoTimeoutAction('drop'); localStorage.setItem('apiprox-bp-timeout-action', 'drop'); }}
                style={{
                  padding: `2px ${tokens.space['3']}`,
                  fontSize: tokens.fontSize.sm,
                  border: 'none',
                  borderLeft: `1px solid ${tokens.border.subtle}`,
                  cursor: 'pointer',
                  background: autoTimeoutAction === 'drop' ? tokens.status.error : tokens.surface.input,
                  color: autoTimeoutAction === 'drop' ? tokens.text.white : tokens.text.muted,
                  fontWeight: autoTimeoutAction === 'drop' ? 600 : 400,
                }}
              >
                Drop
              </button>
            </div>
          </div>
        </div>

        {queue.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: tokens.text.muted, fontSize: tokens.fontSize.base }}>
            No traffic paused. Enable breakpoint rules to start intercepting.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {queue.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '16px',
                  background: tokens.surface.base,
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${tokens.border.default}`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Auto-timeout progress bar */}
                {(() => {
                  const totalMs = autoTimeoutSecs * 1000;
                  const elapsed = now - item.timestamp;
                  const fraction = Math.max(0, 1 - elapsed / totalMs);
                  const pct = fraction * 100;
                  const color = fraction > 0.5 ? tokens.status.success : fraction > 0.25 ? tokens.status.warning : tokens.status.error;
                  return (
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      height: '4px',
                      width: `${pct}%`,
                      background: color,
                      transition: 'width 0.4s linear, background 0.4s ease',
                      borderRadius: '0 0 0 4px',
                    }} />
                  );
                })()}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>
                      <span style={{ color: item.pauseType === 'request' ? tokens.syntax.request : tokens.syntax.response }}>
                        {item.pauseType.toUpperCase()}
                      </span>
                      {' '}
                      <span style={{ color: tokens.text.primary }}>{item.method} {item.url}</span>
                    </div>
                    <div style={{ fontSize: tokens.fontSize.sm, color: tokens.text.muted, marginTop: '4px' }}>
                      Rule: {item.matchedRule} • {new Date(item.timestamp).toLocaleTimeString()}
                      {item.statusCode && ` • Status: ${item.statusCode}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        setEditingTraffic(item);
                        const body = item.pauseType === 'request' ? item.requestBody : (item.responseBody ?? '');
                        const headers = item.pauseType === 'request' ? (item.requestHeaders ?? {}) : (item.responseHeaders ?? {});
                        const lang = detectLanguage(headers);
                        const fmtBody = lang === 'xml' ? formatXmlForDisplay(body) : body;
                        setRawBody(body);
                        setFormattedOriginalBody(fmtBody);
                        setEditedBody(fmtBody);
                        setEditedHeaders({ ...headers });
                      }}
                      style={{
                        padding: '4px 12px',
                        background: tokens.status.accentDark,
                        border: 'none',
                        borderRadius: tokens.radius.md,
                        color: tokens.text.white,
                        fontSize: tokens.fontSize.sm,
                        cursor: 'pointer'
                      }}
                    >
                      Edit & Continue
                    </button>
                    <button
                      onClick={() => handleContinue(item.id)}
                      style={{
                        padding: '4px 12px',
                        background: tokens.surface.successDark,
                        border: 'none',
                        borderRadius: tokens.radius.md,
                        color: tokens.text.white,
                        fontSize: tokens.fontSize.sm,
                        cursor: 'pointer'
                      }}
                    >
                      Continue
                    </button>
                    <button
                      onClick={() => handleDrop(item.id)}
                      style={{
                        padding: '4px 12px',
                        background: tokens.surface.dangerDark,
                        border: 'none',
                        borderRadius: tokens.radius.md,
                        color: tokens.text.white,
                        fontSize: tokens.fontSize.sm,
                        cursor: 'pointer'
                      }}
                    >
                      Drop
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Breakpoint Rules */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 500 }}>
            Breakpoint Rules
          </h2>
          <button
            onClick={handleAddRule}
            style={{
              padding: '8px 16px',
              background: tokens.status.accentDark,
              border: 'none',
              borderRadius: tokens.radius.md,
              color: tokens.text.white,
              fontSize: tokens.fontSize.base,
              cursor: 'pointer'
            }}
          >
            + Add Breakpoint
          </button>
        </div>

        {rules.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            background: tokens.surface.panel,
            borderRadius: tokens.radius.lg,
            color: tokens.text.muted
          }}>
            <p style={{ margin: 0, fontSize: '14px' }}>No breakpoints configured</p>
            <p style={{ margin: '8px 0 0', fontSize: '12px' }}>
              Create breakpoints to pause traffic and inspect/edit requests and responses
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {rules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  padding: '16px',
                  background: tokens.surface.panel,
                  borderRadius: tokens.radius.lg,
                  border: `1px solid ${rule.enabled ? tokens.status.accentDark : tokens.border.subtle}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => handleToggleRule(rule.id)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '14px' }}>{rule.name}</div>
                      <div style={{ fontSize: tokens.fontSize.sm, color: tokens.text.muted, marginTop: '4px' }}>
                        Target: {rule.target} • {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setEditingRule(rule)}
                      style={{
                        padding: '4px 12px',
                        background: 'transparent',
                        border: `1px solid ${tokens.status.accentDark}`,
                        borderRadius: tokens.radius.md,
                        color: tokens.status.accentDark,
                        fontSize: tokens.fontSize.sm,
                        cursor: 'pointer'
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      style={{
                        padding: '4px 12px',
                        background: 'transparent',
                        border: `1px solid ${tokens.border.subtle}`,
                        borderRadius: tokens.radius.md,
                        color: tokens.text.secondary,
                        fontSize: tokens.fontSize.sm,
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '12px' }}>
                  <div style={{ color: tokens.text.muted, marginBottom: '4px' }}>Conditions:</div>
                  {rule.conditions.map((cond, idx) => (
                    <div key={idx} style={{ marginLeft: '12px', marginBottom: '4px' }}>
                      • {cond.type}: <code style={{ background: tokens.surface.base, padding: '2px 6px', borderRadius: tokens.radius.sm }}>
                        {cond.pattern}
                      </code>
                      {cond.isRegex && <span style={{ color: tokens.text.muted, marginLeft: '6px' }}>(regex)</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Rule Modal */}
      {editingRule && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: tokens.space['6']
        }}>
          <div style={{
            background: tokens.surface.panel, padding: '24px',
            borderRadius: tokens.radius.lg,
            maxWidth: '700px', width: '100%', maxHeight: '90vh', overflow: 'auto'
          }}>
            <h3 style={{ margin: `0 0 ${tokens.space['6']} 0`, fontSize: tokens.fontSize.lg }}>
              {rules.find(r => r.id === editingRule.id) ? 'Edit' : 'Add'} Breakpoint
            </h3>

            {/* Name */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: tokens.fontSize.base, marginBottom: '6px', color: tokens.text.secondary }}>
                Name
              </label>
              <input
                type="text"
                value={editingRule.name}
                onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: `${tokens.space['3']} ${tokens.space['4']}`,
                  background: tokens.surface.input,
                  border: `1px solid ${tokens.border.subtle}`,
                  borderRadius: tokens.radius.md,
                  color: tokens.text.secondary,
                  fontSize: tokens.fontSize.base
                }}
              />
            </div>

            {/* Target */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: tokens.fontSize.base, marginBottom: '6px', color: tokens.text.secondary }}>
                Pause on
              </label>
              <select
                value={editingRule.target}
                onChange={(e) => setEditingRule({ ...editingRule, target: e.target.value as BreakpointRule['target'] })}
                style={{
                  width: '100%',
                  padding: `${tokens.space['3']} ${tokens.space['4']}`,
                  background: tokens.surface.input,
                  border: `1px solid ${tokens.border.subtle}`,
                  borderRadius: tokens.radius.md,
                  color: tokens.text.secondary,
                  fontSize: tokens.fontSize.base
                }}
              >
                <option value="request">Request (before forwarding)</option>
                <option value="response">Response (after receiving)</option>
                <option value="both">Both Request and Response</option>
              </select>
            </div>

            {/* Conditions */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: tokens.fontSize.base, color: tokens.text.secondary }}>Match Conditions (ALL must match)</label>
                <button
                  onClick={addCondition}
                  style={{
                    padding: `4px ${tokens.space['2']}`,
                    background: tokens.status.accentDark,
                    border: 'none',
                    borderRadius: tokens.radius.sm,
                    color: tokens.text.white,
                    fontSize: tokens.fontSize.xs,
                    cursor: 'pointer'
                  }}
                >
                  + Add Condition
                </button>
              </div>

              {editingRule.conditions.map((condition, idx) => (
                <div key={idx} style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 80px 40px',
                  gap: '8px',
                  marginBottom: '8px',
                  alignItems: 'center'
                }}>
                  <select
                    value={condition.type}
                    onChange={(e) => updateCondition(idx, { type: e.target.value as BreakpointCondition['type'] })}
                    style={{
                      padding: '6px',
                      background: tokens.surface.input,
                      border: `1px solid ${tokens.border.subtle}`,
                      borderRadius: tokens.radius.md,
                      color: tokens.text.secondary,
                      fontSize: tokens.fontSize.sm
                    }}
                  >
                    <option value="url">URL</option>
                    <option value="method">Method</option>
                    <option value="statusCode">Status Code</option>
                    <option value="header">Header</option>
                    <option value="contains">Body Contains</option>
                  </select>

                  <input
                    type="text"
                    value={condition.pattern}
                    onChange={(e) => updateCondition(idx, { pattern: e.target.value })}
                    placeholder={condition.type === 'url' ? '/api/*' : 'pattern'}
                    style={{
                      padding: `6px ${tokens.space['2']}`,
                      background: tokens.surface.input,
                      border: `1px solid ${tokens.border.subtle}`,
                      borderRadius: tokens.radius.md,
                      color: tokens.text.secondary,
                      fontSize: tokens.fontSize.sm
                    }}
                  />

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={condition.isRegex || false}
                      onChange={(e) => updateCondition(idx, { isRegex: e.target.checked })}
                      style={{ width: '14px', height: '14px' }}
                    />
                    Regex
                  </label>

                  <button
                    onClick={() => removeCondition(idx)}
                    style={{
                      padding: '6px',
                      background: tokens.surface.danger,
                      border: 'none',
                      borderRadius: tokens.radius.md,
                      color: tokens.text.danger,
                      fontSize: tokens.fontSize.sm,
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingRule(null)}
                style={{
                  padding: `${tokens.space['3']} ${tokens.space['5']}`,
                  background: 'transparent',
                  border: `1px solid ${tokens.border.subtle}`,
                  borderRadius: tokens.radius.md,
                  color: tokens.text.secondary,
                  fontSize: tokens.fontSize.base,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                style={{
                  padding: `${tokens.space['3']} ${tokens.space['5']}`,
                  background: tokens.status.accentDark,
                  border: 'none',
                  borderRadius: tokens.radius.md,
                  color: tokens.text.white,
                  fontSize: tokens.fontSize.base,
                  cursor: 'pointer'
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Traffic Modal */}
      {editingTraffic && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: tokens.space['6']
        }}>
          <div style={{
            background: tokens.surface.panel, padding: '24px',
            borderRadius: tokens.radius.lg,
            maxWidth: '900px', width: '100%', maxHeight: '90vh', overflow: 'auto'
          }}>
            <h3 style={{ margin: `0 0 ${tokens.space['4']} 0`, fontSize: tokens.fontSize.lg }}>
              Edit {editingTraffic.pauseType === 'request' ? 'Request' : 'Response'}
            </h3>

            <div style={{ fontSize: tokens.fontSize.base, color: tokens.text.muted, marginBottom: tokens.space['6'] }}>
              {editingTraffic.method} {editingTraffic.url}
            </div>

            {/* Headers */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: tokens.fontSize.base, marginBottom: '6px', color: tokens.text.secondary, fontWeight: 600 }}>
                {editingTraffic.pauseType === 'request' ? 'Request Headers' : 'Response Headers'}
              </label>
              <div style={{ height: '160px', border: `1px solid ${tokens.border.subtle}`, borderRadius: tokens.radius.md, overflow: 'hidden' }}>
                <HeadersPanel
                  headers={editedHeaders}
                  onChange={setEditedHeaders}
                />
              </div>
            </div>

            {/* Body Editor */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: tokens.fontSize.base, marginBottom: '6px', color: tokens.text.secondary, fontWeight: 600 }}>
                {editingTraffic.pauseType === 'request' ? 'Request Body' : 'Response Body'}
              </label>
              <div style={{ height: '320px', border: `1px solid ${tokens.border.subtle}`, borderRadius: tokens.radius.md, overflow: 'hidden' }}>
                <MonacoRequestEditorWithToolbar
                  value={editedBody}
                  onChange={setEditedBody}
                  language={detectLanguage(editedHeaders)}
                  autoFormat={false}
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => handleDrop(editingTraffic.id)}
                style={{
                  padding: `${tokens.space['3']} ${tokens.space['5']}`,
                  background: tokens.surface.dangerDark,
                  border: 'none',
                  borderRadius: tokens.radius.md,
                  color: tokens.text.white,
                  fontSize: tokens.fontSize.base,
                  cursor: 'pointer'
                }}
              >
                Drop
              </button>
              <button
                onClick={() => setEditingTraffic(null)}
                style={{
                  padding: `${tokens.space['3']} ${tokens.space['5']}`,
                  background: 'transparent',
                  border: `1px solid ${tokens.border.subtle}`,
                  borderRadius: tokens.radius.md,
                  color: tokens.text.secondary,
                  fontSize: tokens.fontSize.base,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const lang = detectLanguage(editedHeaders);
                  const finalBody = lang === 'xml'
                    ? patchXmlBody(rawBody, formattedOriginalBody, editedBody)
                    : editedBody;
                  handleContinue(editingTraffic.id, {
                    body: finalBody,
                    headers: editedHeaders,
                  });
                }}
                style={{
                  padding: `${tokens.space['3']} ${tokens.space['5']}`,
                  background: tokens.surface.successDark,
                  border: 'none',
                  borderRadius: tokens.radius.md,
                  color: tokens.text.white,
                  fontSize: tokens.fontSize.base,
                  cursor: 'pointer'
                }}
              >
                Continue with Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
