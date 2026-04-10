import React, { useState, useEffect, useMemo } from 'react';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { MonacoRequestEditor } from '@apinox/request-editor';
import { invokeTauriCommand } from '../../utils/bridge';
import { tokens } from './tokens';
import { ConditionPickerModal, suggestConditionsFromSoapXml } from './ConditionPickerModel';
import type { MockCondition } from './ConditionPickerModel';

export interface MockRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: MockCondition[];
  statusCode: number;
  responseBody: string;
  responseHeaders?: Record<string, string>;
  contentType?: string;
  delayMs?: number;
  tags?: string[];
  hitCount?: number;
}

const CONTENT_TYPES = [
  { label: 'XML (text/xml)', value: 'text/xml; charset=utf-8' },
  { label: 'JSON (application/json)', value: 'application/json; charset=utf-8' },
  { label: 'Plain text (text/plain)', value: 'text/plain; charset=utf-8' },
  { label: 'HTML (text/html)', value: 'text/html; charset=utf-8' },
  { label: 'Custom…', value: '' },
];

function contentTypeToLanguage(ct: string): string {
  if (!ct) return 'plaintext';
  if (ct.includes('json')) return 'json';
  if (ct.includes('xml')) return 'xml';
  if (ct.includes('html')) return 'html';
  return 'plaintext';
}

function statusColor(code: number): string {
  if (code >= 200 && code < 300) return tokens.httpStatus.success;
  if (code >= 300 && code < 400) return tokens.httpStatus.redirect;
  if (code >= 400 && code < 500) return tokens.httpStatus.clientError;
  if (code >= 500) return tokens.httpStatus.serverError;
  return tokens.httpStatus.unknown;
}

/** Tag input: shows pill chips and a text input; press Enter or comma to add. */
function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [inputValue, setInputValue] = useState('');

  function addTag(raw: string) {
    const trimmed = raw.trim();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setInputValue('');
  }

  function removeTag(idx: number) { onChange(tags.filter((_, i) => i !== idx)); }

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: tokens.space['2'], alignItems: 'center',
      padding: `${tokens.space['2']} ${tokens.space['3']}`,
      background: tokens.surface.input, border: `1px solid ${tokens.border.subtle}`,
      borderRadius: tokens.radius.md, minHeight: '36px',
    }}>
      {tags.map((tag, i) => (
        <span key={i} style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          background: tokens.surface.tag, color: tokens.text.tag,
          padding: `2px ${tokens.space['3']}`,
          borderRadius: '12px', fontSize: tokens.fontSize.xs,
        }}>
          {tag}
          <button
            onClick={() => removeTag(i)}
            style={{ background: 'none', border: 'none', color: tokens.text.tag, cursor: 'pointer', padding: '0', lineHeight: 1, fontSize: tokens.fontSize.md }}
          >×</button>
        </span>
      ))}
      <input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(inputValue); }
          if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) removeTag(tags.length - 1);
        }}
        placeholder={tags.length === 0 ? 'Type a tag and press Enter…' : ''}
        style={{
          background: 'none', border: 'none', outline: 'none',
          color: tokens.text.secondary, fontSize: tokens.fontSize.sm,
          minWidth: '130px', flex: 1,
        }}
      />
    </div>
  );
}

/** Compact single-line row for a mock rule in the list view. */
function RuleRow({
  rule, isLast, onToggle, onEdit, onDelete,
}: {
  rule: MockRule; isLast: boolean;
  onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const condTooltip = rule.conditions
    .map((c) => `${c.type}${c.headerName ? ` [${c.headerName}]` : ''}: ${c.pattern}`)
    .join('\n');

  // Compact summary of first condition for inline display
  const firstCond = rule.conditions[0];
  const condSummary = firstCond
    ? `${firstCond.type}${firstCond.headerName ? `:${firstCond.headerName}` : ''}: ${firstCond.pattern}`
    : '';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '7px 12px',
      borderBottom: isLast ? 'none' : `1px solid ${tokens.surface.stripe}`,
    }}>
      {/* Enabled toggle */}
      <button
        onClick={onToggle}
        title={rule.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: tokens.fontSize.md, lineHeight: 1,
          color: rule.enabled ? tokens.httpStatus.success : tokens.text.faint, flexShrink: 0,
        }}
      >{rule.enabled ? '●' : '○'}</button>

      {/* Name + condition summary (same line) */}
      <div
        title={condTooltip}
        style={{
          flex: 1, minWidth: 0,
          fontSize: tokens.fontSize.base, color: rule.enabled ? tokens.text.secondary : tokens.text.hint,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {rule.name}
        {condSummary && (
          <span style={{ color: tokens.text.faint, marginLeft: '10px' }}>
            {condSummary}{rule.conditions.length > 1 ? ` +${rule.conditions.length - 1}` : ''}
          </span>
        )}
      </div>

      {/* Status code */}
      <span style={{
        fontSize: tokens.fontSize.xs, fontWeight: 600, color: statusColor(rule.statusCode),
        background: tokens.surface.deep, padding: `2px ${tokens.space['3']}`, borderRadius: '10px',
        minWidth: '36px', textAlign: 'center', flexShrink: 0,
      }}>{rule.statusCode}</span>

      {/* Tag chips */}
      {(rule.tags ?? []).length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {(rule.tags ?? []).map((t, i) => (
            <span key={i} style={{
              fontSize: tokens.fontSize.xs, background: tokens.surface.tag, color: tokens.text.tag,
              padding: `2px ${tokens.space['3']}`, borderRadius: '10px',
            }}>{t}</span>
          ))}
        </div>
      )}

      {/* Hit count */}
      {(rule.hitCount ?? 0) > 0 && (
        <span style={{ fontSize: tokens.fontSize.xs, color: tokens.text.faint, flexShrink: 0 }}>×{rule.hitCount}</span>
      )}

      {/* Actions */}
      <button
        onClick={onEdit}
        style={{
          padding: `3px ${tokens.space['2']}`, background: 'transparent',
          border: `1px solid ${tokens.status.accentDark}`,
          borderRadius: tokens.radius.sm, color: tokens.status.accentDark,
          fontSize: tokens.fontSize.xs, cursor: 'pointer', flexShrink: 0,
        }}
      >Edit</button>
      <button
        onClick={onDelete}
        style={{
          padding: `3px ${tokens.space['2']}`, background: 'transparent',
          border: `1px solid ${tokens.border.subtle}`,
          borderRadius: tokens.radius.sm, color: tokens.text.muted,
          fontSize: tokens.fontSize.xs, cursor: 'pointer', flexShrink: 0,
        }}
      >Delete</button>
    </div>
  );
}

/** Export collection dialog. */
function ExportModal({ rules, onClose }: { rules: MockRule[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(rules.map((r) => r.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const allSelected = selectedIds.size === rules.length;

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(rules.map((r) => r.id)));
  }

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  }

  async function doExport() {
    if (!name.trim()) { setError('Collection name is required.'); return; }
    if (selectedIds.size === 0) { setError('Select at least one rule to export.'); return; }
    setError('');
    setBusy(true);
    try {
      const filePath = await saveDialog({
        filters: [{ name: 'Mock Collection', extensions: ['mock.json'] }],
        defaultPath: `${name.trim().replace(/\s+/g, '-').toLowerCase()}.mock.json`,
      });
      if (!filePath) { setBusy(false); return; }
      await invokeTauriCommand('export_mock_collection', {
        ids: [...selectedIds],
        name: name.trim(),
        description: description.trim(),
        filePath: filePath as string,
      });
      onClose();
    } catch (e: any) {
      setError(`Export failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const iStyle: React.CSSProperties = {
    width: '100%', padding: `${tokens.space['3']} ${tokens.space['4']}`,
    background: tokens.surface.input, border: `1px solid ${tokens.border.subtle}`,
    borderRadius: tokens.radius.md, color: tokens.text.secondary,
    fontSize: tokens.fontSize.base, boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: tokens.space['6'],
    }}>
      <div style={{
        background: tokens.surface.panel, padding: '24px',
        borderRadius: tokens.radius.lg,
        width: '520px', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', gap: tokens.space['5'],
      }}>
        <h3 style={{ margin: 0, fontSize: tokens.fontSize.lg, fontWeight: 500 }}>Export Mock Collection</h3>

        <div>
          <label style={{ display: 'block', fontSize: tokens.fontSize.sm, color: tokens.text.muted, marginBottom: '5px' }}>
            Collection name <span style={{ color: tokens.httpStatus.clientError }}>*</span>
          </label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={iStyle}
            placeholder="e.g. Payments API Mocks" autoFocus />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: tokens.fontSize.sm, color: tokens.text.muted, marginBottom: '5px' }}>
            Description
          </label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} style={iStyle}
            placeholder="Optional description for this collection" />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: tokens.fontSize.sm, color: tokens.text.muted }}>
              Rules ({selectedIds.size} of {rules.length} selected)
            </span>
            <button onClick={toggleAll}
              style={{ background: 'none', border: 'none', color: tokens.status.accentDark, fontSize: tokens.fontSize.sm, cursor: 'pointer', padding: 0 }}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, border: `1px solid ${tokens.surface.input}`, borderRadius: tokens.radius.md }}>
            {rules.map((rule) => (
              <label key={rule.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: `${tokens.space['3']} ${tokens.space['4']}`, cursor: 'pointer',
                borderBottom: `1px solid ${tokens.surface.stripe}`,
              }}>
                <input type="checkbox" checked={selectedIds.has(rule.id)} onChange={() => toggle(rule.id)} />
                <span style={{ fontSize: tokens.fontSize.base, flex: 1 }}>{rule.name}</span>
                <span style={{ fontSize: tokens.fontSize.xs, color: statusColor(rule.statusCode) }}>{rule.statusCode}</span>
                <span style={{ fontSize: tokens.fontSize.xs, color: tokens.text.hint }}>
                  {rule.conditions.length} cond{rule.conditions.length !== 1 ? 's' : ''}
                </span>
              </label>
            ))}
          </div>
        </div>

        {error && <div style={{ color: tokens.httpStatus.clientError, fontSize: tokens.fontSize.sm }}>{error}</div>}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: `${tokens.space['3']} ${tokens.space['5']}`, background: 'transparent',
            border: `1px solid ${tokens.border.subtle}`,
            borderRadius: tokens.radius.md, color: tokens.text.secondary,
            fontSize: tokens.fontSize.base, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={doExport} disabled={busy} style={{
            padding: `${tokens.space['3']} ${tokens.space['5']}`,
            background: busy ? tokens.border.subtle : tokens.status.accentDark,
            border: 'none', borderRadius: tokens.radius.md, color: tokens.text.white,
            fontSize: tokens.fontSize.base, cursor: busy ? 'default' : 'pointer',
          }}>{busy ? 'Exporting…' : 'Export'}</button>
        </div>
      </div>
    </div>
  );
}

/** Inline key-value header editor */
function HeadersEditor({
  headers,
  onChange,
}: {
  headers: Record<string, string>;
  onChange: (h: Record<string, string>) => void;
}) {
  const [pairs, setPairs] = React.useState<{ key: string; value: string }[]>(
    () => Object.entries(headers).map(([key, value]) => ({ key, value }))
  );

  function update(next: { key: string; value: string }[]) {
    setPairs(next);
    const record: Record<string, string> = {};
    next.forEach(({ key, value }) => { if (key !== '') record[key] = value; });
    onChange(record);
  }

  function setKey(i: number, newKey: string) {
    update(pairs.map((p, idx) => idx === i ? { ...p, key: newKey } : p));
  }

  function setValue(i: number, newVal: string) {
    update(pairs.map((p, idx) => idx === i ? { ...p, value: newVal } : p));
  }

  function remove(i: number) {
    update(pairs.filter((_, idx) => idx !== i));
  }

  function add() {
    update([...pairs, { key: '', value: '' }]);
  }

  const inputStyle: React.CSSProperties = {
    padding: `${tokens.space['2']} ${tokens.space['3']}`,
    background: tokens.surface.input,
    border: `1px solid ${tokens.border.subtle}`,
    borderRadius: tokens.radius.md,
    color: tokens.text.secondary,
    fontSize: tokens.fontSize.sm,
    width: '100%',
  };

  return (
    <div>
      {pairs.map(({ key, value }, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: '6px', marginBottom: '6px' }}>
          <input
            style={inputStyle}
            placeholder="Header name"
            value={key}
            onChange={(e) => setKey(i, e.target.value)}
          />
          <input
            style={inputStyle}
            placeholder="Value"
            value={value}
            onChange={(e) => setValue(i, e.target.value)}
          />
          <button
            onClick={() => remove(i)}
            style={{ padding: '4px', background: tokens.surface.danger, border: 'none', borderRadius: tokens.radius.md, color: tokens.text.danger, fontSize: tokens.fontSize.sm, cursor: 'pointer' }}
          >✕</button>
        </div>
      ))}
      <button
        onClick={add}
        style={{ padding: `4px ${tokens.space['2']}`, background: tokens.status.accentDark, border: 'none', borderRadius: tokens.radius.sm, color: tokens.text.white, fontSize: tokens.fontSize.xs, cursor: 'pointer' }}
      >
        + Add Header
      </button>
    </div>
  );
}

/** Order-independent comparison key for a set of conditions. */
function normalizeConditions(conditions: MockCondition[]): string {
  return JSON.stringify(
    [...conditions]
      .map(c => ({ type: c.type, pattern: c.pattern, headerName: c.headerName ?? '' }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  );
}

export function MockRulesPage({ initialRule, onInitialRuleConsumed }: {
  initialRule?: MockRule | null;
  onInitialRuleConsumed?: () => void;
}) {
  const [rules, setRules] = useState<MockRule[]>([]);
  const [editingRule, setEditingRule] = useState<MockRule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [customContentType, setCustomContentType] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [duplicateConflict, setDuplicateConflict] = useState<{ existing: MockRule; pending: MockRule } | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  // Open the editor pre-filled from a traffic log selection
  useEffect(() => {
    if (!initialRule) return;
    const isPreset = CONTENT_TYPES.some(o => o.value !== '' && o.value === initialRule.contentType);
    setCustomContentType(isPreset ? '' : (initialRule.contentType || ''));
    setEditingRule({ ...initialRule, tags: initialRule.tags ?? [] });
    onInitialRuleConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRule]);

  async function loadRules() {
    try {
      const response = await invokeTauriCommand<MockRule[] | { rules: MockRule[] }>('get_mock_rules');
      const loaded: MockRule[] = Array.isArray(response) ? response : (response.rules ?? []);
      applyRules(loaded);
    } catch (error) {
      console.error('Failed to load mock rules:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function applyRules(loaded: MockRule[]) {
    setRules(loaded);
    setOpenGroups((prev) => {
      const next = new Set(prev);
      loaded.forEach((r) => {
        const key = r.tags && r.tags.length > 0 ? r.tags[0] : 'Uncategorized';
        next.add(key);
      });
      return next;
    });
  }

  async function reloadRules() {
    const response = await invokeTauriCommand<MockRule[] | { rules: MockRule[] }>('get_mock_rules');
    applyRules(Array.isArray(response) ? response : (response.rules ?? []));
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const allTags = useMemo(() => {
    const s = new Set<string>();
    rules.forEach((r) => (r.tags ?? []).forEach((t) => s.add(t)));
    return [...s].sort();
  }, [rules]);

  const filteredRules = useMemo(() => {
    const q = searchText.toLowerCase();
    return rules.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) &&
        !r.conditions.some((c) => c.pattern.toLowerCase().includes(q))) return false;
      if (tagFilter && !(r.tags ?? []).includes(tagFilter)) return false;
      return true;
    });
  }, [rules, searchText, tagFilter]);

  const groupedRules = useMemo(() => {
    const groups = new Map<string, MockRule[]>();
    filteredRules.forEach((r) => {
      const key = r.tags && r.tags.length > 0 ? r.tags[0] : 'Uncategorized';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });
    const sorted = new Map<string, MockRule[]>();
    [...groups.keys()].filter((k) => k !== 'Uncategorized').sort()
      .forEach((k) => sorted.set(k, groups.get(k)!));
    if (groups.has('Uncategorized')) sorted.set('Uncategorized', groups.get('Uncategorized')!);
    return sorted;
  }, [filteredRules]);

  function toggleGroup(tag: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function handleAddRule() {
    const newRule: MockRule = {
      id: '',
      name: 'New Mock Rule',
      enabled: true,
      conditions: [{ type: 'url', pattern: '/api/*', isRegex: false }],
      statusCode: 200,
      contentType: 'text/xml; charset=utf-8',
      responseBody: '<?xml version="1.0"?>\n<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n  <soap:Body>\n    <Response>\n      <!-- Mock response -->\n    </Response>\n  </soap:Body>\n</soap:Envelope>',
      responseHeaders: {},
      delayMs: 0,
      tags: [],
    };
    setCustomContentType('');
    setEditingRule(newRule);
  }

  async function handleSaveRule() {
    if (!editingRule) return;

    try {
      const isNew = !editingRule.id || !rules.find(r => r.id === editingRule.id);

      if (isNew) {
        if (editingRule.conditions.length > 0) {
          const pendingNorm = normalizeConditions(editingRule.conditions);
          const duplicate = rules.find(r => normalizeConditions(r.conditions) === pendingNorm);
          if (duplicate) {
            setDuplicateConflict({ existing: duplicate, pending: editingRule });
            return;
          }
        }
        await invokeTauriCommand('add_mock_rule', { rule: editingRule });
      } else {
        await invokeTauriCommand('update_mock_rule', { id: editingRule.id, rule: editingRule });
      }

      await reloadRules();
      setEditingRule(null);
    } catch (error) {
      console.error('Failed to save rule:', error);
      alert('Failed to save rule: ' + (error as Error).message);
    }
  }

  async function handleOverwriteDuplicate() {
    if (!duplicateConflict) return;
    try {
      const { existing, pending } = duplicateConflict;
      await invokeTauriCommand('update_mock_rule', { id: existing.id, rule: { ...pending, id: existing.id } });
      await reloadRules();
      setDuplicateConflict(null);
      setEditingRule(null);
    } catch (error) {
      console.error('Failed to overwrite rule:', error);
      alert('Failed to overwrite rule: ' + (error as Error).message);
    }
  }

  async function handleDeleteRule(id: string) {
    if (!confirm('Delete this mock rule?')) return;

    try {
      await invokeTauriCommand('delete_mock_rule', { id });
      await reloadRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  }

  async function handleToggleRule(rule: MockRule) {
    try {
      await invokeTauriCommand('update_mock_rule', { id: rule.id, rule: { ...rule, enabled: !rule.enabled } });
      await reloadRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  }

  async function handleImport() {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: 'Mock Collection', extensions: ['mock.json', 'json'] }],
      });
      if (!selected) return;
      const filePath = typeof selected === 'string' ? selected : (selected as any).path ?? String(selected);
      if (!confirm('Importing a collection will replace ALL current mock rules. Continue?')) return;
      await invokeTauriCommand('import_mock_collection', { filePath });
      await reloadRules();
    } catch (e: any) {
      alert('Import failed: ' + (e?.message ?? String(e)));
    }
  }

  // ── Edit modal helpers ─────────────────────────────────────────────────────

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

  function updateCondition(index: number, updates: Partial<MockCondition>) {
    if (!editingRule) return;
    const newConditions = [...editingRule.conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setEditingRule({ ...editingRule, conditions: newConditions });
  }

  function openEdit(rule: MockRule) {
    const isPreset = CONTENT_TYPES.some(o => o.value !== '' && o.value === rule.contentType);
    setCustomContentType(isPreset ? '' : (rule.contentType || ''));
    setEditingRule({ ...rule, tags: rule.tags ?? [] });
  }

  function handleContentTypeSelect(value: string) {
    if (!editingRule) return;
    if (value === '') {
      setEditingRule({ ...editingRule, contentType: customContentType });
    } else {
      setCustomContentType('');
      setEditingRule({ ...editingRule, contentType: value });
    }
  }

  function getContentTypeSelectValue(ct: string | undefined): string {
    if (!ct) return CONTENT_TYPES[0].value;
    const found = CONTENT_TYPES.find(o => o.value === ct);
    return found ? found.value : '';
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: `${tokens.space['3']} ${tokens.space['4']}`,
    background: tokens.surface.input,
    border: `1px solid ${tokens.border.subtle}`,
    borderRadius: tokens.radius.md,
    color: tokens.text.secondary,
    fontSize: tokens.fontSize.base,
    boxSizing: 'border-box',
  };

  if (isLoading && !editingRule) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ color: tokens.text.muted }}>Loading mock rules...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Toolbar ── */}
      <div style={{
        padding: `${tokens.space['2']} ${tokens.space['5']}`,
        borderBottom: `1px solid ${tokens.surface.stripe}`,
        display: 'flex', alignItems: 'center', gap: tokens.space['3'], flexShrink: 0,
        background: tokens.surface.base,
      }}>
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search rules…"
          style={{
            padding: `5px 10px`, background: tokens.surface.input,
            border: `1px solid ${tokens.border.subtle}`,
            borderRadius: tokens.radius.md, color: tokens.text.secondary,
            fontSize: tokens.fontSize.sm, width: '200px',
          }}
        />
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          style={{
            padding: `5px ${tokens.space['3']}`, background: tokens.surface.input,
            border: `1px solid ${tokens.border.subtle}`,
            borderRadius: tokens.radius.md,
            color: tagFilter ? tokens.text.secondary : tokens.text.muted,
            fontSize: tokens.fontSize.sm,
          }}
        >
          <option value="">All tags</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <span style={{ flex: 1 }} />

        <span style={{ fontSize: tokens.fontSize.xs, color: tokens.text.faint }}>
          {filteredRules.length} / {rules.length}
        </span>

        <button
          onClick={handleImport}
          style={{
            padding: `5px ${tokens.space['4']}`, background: 'transparent',
            border: `1px solid ${tokens.border.subtle}`,
            borderRadius: tokens.radius.md, color: tokens.text.secondary,
            fontSize: tokens.fontSize.sm, cursor: 'pointer',
          }}
        >Import</button>

        <button
          onClick={() => setShowExportModal(true)}
          disabled={rules.length === 0}
          style={{
            padding: `5px ${tokens.space['4']}`, background: 'transparent',
            border: `1px solid ${tokens.border.subtle}`,
            borderRadius: tokens.radius.md,
            color: rules.length === 0 ? tokens.border.subtle : tokens.text.secondary,
            fontSize: tokens.fontSize.sm, cursor: rules.length === 0 ? 'default' : 'pointer',
          }}
        >Export</button>

        <button
          onClick={handleAddRule}
          style={{
            padding: `5px 14px`, background: tokens.status.accentDark, border: 'none',
            borderRadius: tokens.radius.md, color: tokens.text.white,
            fontSize: tokens.fontSize.sm, cursor: 'pointer',
          }}
        >+ Add Rule</button>
      </div>

      {/* ── Template helpers hint ── */}
      <div style={{ padding: `5px ${tokens.space['5']}`, background: tokens.surface.deep, borderBottom: `1px solid ${tokens.surface.stripe}`, flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: tokens.fontSize.xs, color: tokens.text.faint }}>
          Body helpers:{' '}
          {['{{uuid}}', '{{now}}', '{{randomInt 1 100}}', '{{randomElement a b c}}', "{{requestHeader 'name'}}"].map((h) => (
            <code key={h} style={{ background: tokens.surface.base, padding: '1px 5px', borderRadius: tokens.radius.sm, marginRight: '6px', fontSize: '10px' }}>{h}</code>
          ))}
        </p>
      </div>

      {/* ── Rule groups ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {filteredRules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: tokens.text.faint, fontSize: tokens.fontSize.base }}>
            {rules.length === 0
              ? 'No mock rules configured. Click "+ Add Rule" to create one.'
              : 'No rules match the current filter.'}
          </div>
        ) : (
          [...groupedRules.entries()].map(([tag, groupRules]) => (
            <div key={tag} style={{ marginBottom: '14px' }}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(tag)}
                style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '4px 0', marginBottom: '4px', textAlign: 'left',
                }}
              >
                <span style={{ color: tokens.text.faint, fontSize: '10px' }}>
                  {openGroups.has(tag) ? '▼' : '▶'}
                </span>
                <span style={{
                  fontSize: tokens.fontSize.xs, fontWeight: 700, color: tokens.text.muted,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  {tag}
                </span>
                <span style={{ fontSize: '10px', color: tokens.text.faint }}>({groupRules.length})</span>
                <div style={{ flex: 1, height: '1px', background: tokens.surface.stripe, marginLeft: '6px' }} />
              </button>

              {/* Group rows */}
              {openGroups.has(tag) && (
                <div style={{
                  background: tokens.surface.base, borderRadius: tokens.radius.md,
                  border: `1px solid ${tokens.surface.stripe}`, overflow: 'hidden',
                }}>
                  {groupRules.map((rule, idx) => (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      isLast={idx === groupRules.length - 1}
                      onToggle={() => handleToggleRule(rule)}
                      onEdit={() => openEdit(rule)}
                      onDelete={() => handleDeleteRule(rule.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Export modal ── */}
      {showExportModal && (
        <ExportModal rules={rules} onClose={() => setShowExportModal(false)} />
      )}

      {/* ── Duplicate conflict modal ── */}
      {duplicateConflict && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2100, padding: tokens.space['6'],
        }}>
          <div style={{
            background: tokens.surface.panel, borderRadius: tokens.radius.lg,
            border: `1px solid ${tokens.border.default}`,
            padding: '24px', width: '460px', maxWidth: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: tokens.text.secondary, marginBottom: '10px' }}>
              Duplicate Conditions Detected
            </div>
            <div style={{ fontSize: tokens.fontSize.sm, color: tokens.text.muted, marginBottom: tokens.space['5'], lineHeight: 1.6 }}>
              An existing rule named{' '}
              <strong style={{ color: tokens.text.secondary }}>"{duplicateConflict.existing.name}"</strong>{' '}
              has the same match conditions. Overwriting it will replace its name, response,
              headers, and settings with the values you just configured.
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDuplicateConflict(null)}
                style={{
                  padding: `7px ${tokens.space['5']}`, background: 'transparent',
                  border: `1px solid ${tokens.border.subtle}`,
                  borderRadius: tokens.radius.md, color: tokens.text.secondary,
                  fontSize: tokens.fontSize.base, cursor: 'pointer',
                }}
              >Keep Both</button>
              <button
                onClick={handleOverwriteDuplicate}
                style={{
                  padding: `7px ${tokens.space['5']}`, background: '#c0392b',
                  border: 'none', borderRadius: tokens.radius.md,
                  color: tokens.text.white, fontSize: tokens.fontSize.base, cursor: 'pointer',
                }}
              >Overwrite Existing</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit / Add modal ── */}
      {editingRule && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: tokens.space['6'],
        }}>
          <div style={{
            background: tokens.surface.panel, padding: '24px',
            borderRadius: tokens.radius.lg,
            maxWidth: '760px', width: '100%', maxHeight: '90vh', overflow: 'auto',
          }}>
            <h3 style={{ margin: `0 0 ${tokens.space['6']} 0`, fontSize: tokens.fontSize.lg, fontWeight: 500 }}>
              {rules.find(r => r.id === editingRule.id) ? 'Edit' : 'Add'} Mock Rule
            </h3>

            {/* Name */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: tokens.fontSize.base, marginBottom: '6px', color: tokens.text.secondary }}>
                Rule Name
              </label>
              <input
                type="text"
                value={editingRule.name}
                onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                style={inputStyle}
              />
            </div>

            {/* Tags */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: tokens.fontSize.base, marginBottom: '6px', color: tokens.text.secondary }}>
                Tags
                <span style={{ fontSize: tokens.fontSize.xs, color: tokens.text.hint, marginLeft: '8px' }}>
                  Groups related rules. Press Enter or comma to add each tag.
                </span>
              </label>
              <TagInput
                tags={editingRule.tags ?? []}
                onChange={(t) => setEditingRule({ ...editingRule, tags: t })}
              />
            </div>

            {/* Conditions */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: tokens.fontSize.base, color: tokens.text.secondary }}>
                  Match Conditions{' '}
                  <span style={{ fontSize: tokens.fontSize.xs, color: tokens.text.hint }}>(ALL must match)</span>
                </label>
                <button
                  onClick={addCondition}
                  style={{
                    padding: `4px ${tokens.space['2']}`, background: tokens.status.accentDark, border: 'none',
                    borderRadius: tokens.radius.sm, color: tokens.text.white,
                    fontSize: tokens.fontSize.xs, cursor: 'pointer',
                  }}
                >+ Add Condition</button>
              </div>

              {editingRule.conditions.map((condition, idx) => (
                <div key={idx} style={{ marginBottom: '8px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: condition.type === 'header' || condition.type === 'queryParam'
                      ? '130px 140px 1fr 80px 40px'
                      : '130px 1fr 80px 40px',
                    gap: '8px',
                    alignItems: 'center',
                  }}>
                    <select
                      value={condition.type}
                      onChange={(e) => {
                        const newType = e.target.value as MockCondition['type'];
                        const namePreservingTypes = new Set(['header', 'queryParam']);
                        const keepName = namePreservingTypes.has(newType) && namePreservingTypes.has(condition.type);
                        updateCondition(idx, { type: newType, headerName: keepName ? condition.headerName : undefined });
                      }}
                      style={{ padding: '6px', background: tokens.surface.input, border: `1px solid ${tokens.border.subtle}`, borderRadius: tokens.radius.md, color: tokens.text.secondary, fontSize: tokens.fontSize.sm }}
                    >
                      <option value="url">URL Path</option>
                      <option value="method">HTTP Method</option>
                      <option value="header">Header</option>
                      <option value="queryParam">Query Param</option>
                      <option value="xpath">XPath</option>
                      <option value="contains">Body Contains</option>
                      <option value="soapAction">SOAP Action</option>
                    </select>

                    {(condition.type === 'header' || condition.type === 'queryParam') && (
                      <input
                        type="text"
                        value={condition.headerName || ''}
                        onChange={(e) => updateCondition(idx, { headerName: e.target.value })}
                        placeholder={condition.type === 'header' ? 'Header name' : 'Param name'}
                        style={{ padding: `6px ${tokens.space['2']}`, background: tokens.surface.input, border: `1px solid ${tokens.border.subtle}`, borderRadius: tokens.radius.md, color: tokens.text.secondary, fontSize: tokens.fontSize.sm }}
                      />
                    )}

                    <input
                      type="text"
                      value={condition.pattern}
                      onChange={(e) => updateCondition(idx, { pattern: e.target.value })}
                      placeholder={
                        condition.type === 'method' ? 'GET, POST, …'
                          : condition.type === 'xpath' ? '//Body/GetUser'
                            : condition.type === 'header' || condition.type === 'queryParam' ? 'Expected value'
                              : '/api/*'
                      }
                      style={{ padding: `6px ${tokens.space['2']}`, background: tokens.surface.input, border: `1px solid ${tokens.border.subtle}`, borderRadius: tokens.radius.md, color: tokens.text.secondary, fontSize: tokens.fontSize.sm }}
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
                      style={{ padding: '6px', background: tokens.surface.danger, border: 'none', borderRadius: tokens.radius.md, color: tokens.text.danger, fontSize: tokens.fontSize.sm, cursor: 'pointer' }}
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Response Config row */}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 120px', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: tokens.fontSize.base, marginBottom: '6px', color: tokens.text.secondary }}>Status Code</label>
                <input
                  type="number"
                  value={editingRule.statusCode}
                  onChange={(e) => setEditingRule({ ...editingRule, statusCode: parseInt(e.target.value) || 200 })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: tokens.fontSize.base, marginBottom: '6px', color: tokens.text.secondary }}>Content-Type</label>
                <select
                  value={getContentTypeSelectValue(editingRule.contentType)}
                  onChange={(e) => handleContentTypeSelect(e.target.value)}
                  style={{ ...inputStyle, padding: '7px 12px' }}
                >
                  {CONTENT_TYPES.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {getContentTypeSelectValue(editingRule.contentType) === '' && (
                  <input
                    type="text"
                    value={editingRule.contentType || ''}
                    onChange={(e) => {
                      setCustomContentType(e.target.value);
                      setEditingRule({ ...editingRule, contentType: e.target.value });
                    }}
                    placeholder="e.g. application/soap+xml"
                    style={{ ...inputStyle, marginTop: '6px' }}
                  />
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: tokens.fontSize.base, marginBottom: '6px', color: tokens.text.secondary }}>Delay (ms)</label>
                <input
                  type="number"
                  value={editingRule.delayMs || 0}
                  onChange={(e) => setEditingRule({ ...editingRule, delayMs: parseInt(e.target.value) || 0 })}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Response Headers */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: tokens.fontSize.base, marginBottom: '8px', color: tokens.text.secondary }}>
                Response Headers
              </label>
              <HeadersEditor
                headers={editingRule.responseHeaders || {}}
                onChange={(h) => setEditingRule({ ...editingRule, responseHeaders: h })}
              />
            </div>

            {/* Response Body */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: tokens.fontSize.base, color: tokens.text.secondary }}>
                  Response Body
                </label>
                <button
                  title="Format JSON / XML"
                  onClick={() => {
                    const lang = contentTypeToLanguage(editingRule.contentType || '');
                    try {
                      let formatted = editingRule.responseBody;
                      if (lang === 'json') {
                        formatted = JSON.stringify(JSON.parse(formatted), null, 2);
                      } else if (lang === 'xml') {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(formatted, 'application/xml');
                        if (!doc.querySelector('parsererror')) {
                          function indentXml(node: Node, depth: number): string {
                            const indent = '  '.repeat(depth);
                            if (node.nodeType === Node.TEXT_NODE) {
                              const t = node.textContent?.trim() ?? '';
                              return t ? indent + t + '\n' : '';
                            }
                            if (node.nodeType !== Node.ELEMENT_NODE) return '';
                            const el = node as Element;
                            const tag = el.tagName;
                            const attrs = Array.from(el.attributes)
                              .map(a => ` ${a.name}="${a.value}"`).join('');
                            const children = Array.from(el.childNodes);
                            const inner = children.map(c => indentXml(c, depth + 1)).join('');
                            if (!inner.trim()) return `${indent}<${tag}${attrs} />\n`;
                            if (children.length === 1 && children[0].nodeType === Node.TEXT_NODE) {
                              return `${indent}<${tag}${attrs}>${children[0].textContent?.trim()}</${tag}>\n`;
                            }
                            return `${indent}<${tag}${attrs}>\n${inner}${indent}</${tag}>\n`;
                          }
                          const decl = formatted.trimStart().startsWith('<?xml') ? '<?xml version="1.0" encoding="UTF-8"?>\n' : '';
                          formatted = decl + indentXml(doc.documentElement, 0);
                        }
                      }
                      setEditingRule({ ...editingRule, responseBody: formatted });
                    } catch {
                      // Ignore format errors silently
                    }
                  }}
                  style={{
                    padding: '3px 10px', fontSize: '11px', cursor: 'pointer',
                    background: tokens.surface.elevated, border: `1px solid ${tokens.border.subtle}`,
                    borderRadius: tokens.radius.sm, color: tokens.text.muted,
                  }}
                >Format ↩</button>
              </div>
              <div style={{
                height: '280px',
                border: `1px solid ${tokens.border.subtle}`,
                borderRadius: tokens.radius.md,
                overflow: 'hidden',
              }}>
                <MonacoRequestEditor
                  value={editingRule.responseBody}
                  onChange={(value) => setEditingRule({ ...editingRule, responseBody: value })}
                  language={contentTypeToLanguage(editingRule.contentType || '')}
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingRule(null)}
                style={{
                  padding: `${tokens.space['3']} ${tokens.space['5']}`, background: 'transparent',
                  border: `1px solid ${tokens.border.subtle}`,
                  borderRadius: tokens.radius.md, color: tokens.text.secondary,
                  fontSize: tokens.fontSize.base, cursor: 'pointer',
                }}
              >Cancel</button>
              <button
                onClick={handleSaveRule}
                style={{
                  padding: `${tokens.space['3']} ${tokens.space['5']}`,
                  background: tokens.status.accentDark, border: 'none',
                  borderRadius: tokens.radius.md, color: tokens.text.white,
                  fontSize: tokens.fontSize.base, cursor: 'pointer',
                }}
              >Save Rule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
