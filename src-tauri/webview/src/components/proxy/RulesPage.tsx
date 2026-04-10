import React, { useState, useEffect } from 'react';
import { invokeTauriCommand } from '../../utils/bridge';
import { tokens } from './tokens';

interface ReplaceRule {
  id: string;
  name: string;
  enabled: boolean;
  xpath?: string;
  matchText: string;
  replaceWith: string;
  target: 'request' | 'response' | 'both';
  isRegex: boolean;
}

interface PendingReplaceForm {
  name: string;
  matchText: string;
  replaceWith: string;
  target: ReplaceRule['target'];
  isRegex: boolean;
  xpath: string;
}

export function RulesPage({ pendingForm, onPendingFormConsumed }: {
  pendingForm?: PendingReplaceForm | null;
  onPendingFormConsumed?: () => void;
}) {
  const [rules, setRules] = useState<ReplaceRule[]>([]);
  const [showAddRule, setShowAddRule] = useState(false);
  const [editingRule, setEditingRule] = useState<ReplaceRule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    matchText: '',
    replaceWith: '',
    target: 'both' as ReplaceRule['target'],
    isRegex: false,
    xpath: '',
  });

  // Open the add modal pre-filled from a traffic log selection
  useEffect(() => {
    if (!pendingForm) return;
    setForm(pendingForm);
    setEditingRule(null);
    setShowAddRule(true);
    onPendingFormConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingForm]);

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    try {
      const loaded = await invokeTauriCommand<ReplaceRule[]>('get_replace_rules');
      setRules(loaded);
    } catch (e: any) {
      setError(String(e));
    }
  }

  function openAddModal() {
    setForm({ name: '', matchText: '', replaceWith: '', target: 'both', isRegex: false, xpath: '' });
    setEditingRule(null);
    setShowAddRule(true);
  }

  function openEditModal(rule: ReplaceRule) {
    setForm({
      name: rule.name,
      matchText: rule.matchText,
      replaceWith: rule.replaceWith,
      target: rule.target,
      isRegex: rule.isRegex,
      xpath: rule.xpath ?? '',
    });
    setEditingRule(rule);
    setShowAddRule(true);
  }

  async function handleSaveRule() {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    const ruleData: Omit<ReplaceRule, 'id'> = {
      name: form.name.trim(),
      enabled: editingRule ? editingRule.enabled : true,
      matchText: form.matchText,
      replaceWith: form.replaceWith,
      target: form.target,
      isRegex: form.isRegex,
      ...(form.xpath.trim() ? { xpath: form.xpath.trim() } : {}),
    };
    try {
      if (editingRule) {
        await invokeTauriCommand('update_replace_rule', { id: editingRule.id, rule: { ...ruleData, id: editingRule.id } });
      } else {
        await invokeTauriCommand('add_replace_rule', { rule: ruleData });
      }
      await loadRules();
      setShowAddRule(false);
      setEditingRule(null);
    } catch (e: any) {
      setError(String(e));
    }
  }

  async function handleDeleteRule(id: string) {
    try {
      await invokeTauriCommand('delete_replace_rule', { id });
      setRules(rules.filter(r => r.id !== id));
    } catch (e: any) {
      setError(String(e));
    }
  }

  async function handleToggleRule(id: string) {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    try {
      await invokeTauriCommand('update_replace_rule', { id, rule: { ...rule, enabled: !rule.enabled } });
      await loadRules();
    } catch (e: any) {
      setError(String(e));
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    background: tokens.surface.input,
    border: `1px solid ${tokens.border.subtle}`,
    borderRadius: tokens.radius.md,
    color: tokens.text.secondary,
    fontSize: tokens.fontSize.base,
    boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: '20px' }}>
      {error && (
        <div style={{ padding: '8px 12px', background: tokens.surface.danger, borderRadius: tokens.radius.md, color: tokens.syntax.error, marginBottom: '12px', fontSize: tokens.fontSize.base }}>
          {error}
        </div>
      )}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 500 }}>
          Replace Rules
        </h2>
        <button
          onClick={openAddModal}
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
          + Add Rule
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
          <p style={{ margin: 0 }}>No replace rules configured</p>
          <p style={{ margin: '8px 0 0', fontSize: '12px' }}>
            Create rules to modify traffic on the fly using XPath or regex patterns
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
                border: `1px solid ${rule.enabled ? tokens.border.default : tokens.border.subtle}`
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
                    <div style={{ fontSize: '12px', color: tokens.text.muted, marginTop: '4px' }}>
                      Target: {rule.target}
                      {rule.isRegex && ' • Regex'}
                      {rule.xpath && ` • XPath: ${rule.xpath}`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => openEditModal(rule)}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                <div>
                  <div style={{ color: tokens.text.muted, marginBottom: '4px' }}>Match:</div>
                  <code style={{ background: tokens.surface.base, padding: '6px', borderRadius: tokens.radius.sm, display: 'block' }}>
                    {rule.matchText || '(empty)'}
                  </code>
                </div>
                <div>
                  <div style={{ color: tokens.text.muted, marginBottom: '4px' }}>Replace with:</div>
                  <code style={{ background: tokens.surface.base, padding: '6px', borderRadius: tokens.radius.sm, display: 'block' }}>
                    {rule.replaceWith || '(empty)'}
                  </code>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddRule && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: tokens.surface.panel,
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0' }}>{editingRule ? 'Edit Replace Rule' : 'Add Replace Rule'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <label style={{ fontSize: '13px' }}>
                <div style={{ color: tokens.text.muted, marginBottom: '4px' }}>Name *</div>
                <input
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={inputStyle}
                  placeholder="e.g. Mask SSN"
                />
              </label>
              <label style={{ fontSize: '13px' }}>
                <div style={{ color: tokens.text.muted, marginBottom: '4px' }}>Match Text</div>
                <input
                  value={form.matchText}
                  onChange={e => setForm(f => ({ ...f, matchText: e.target.value }))}
                  style={inputStyle}
                  placeholder={form.isRegex ? 'e.g. \\d{3}-\\d{2}-\\d{4}' : 'e.g. secret-value'}
                />
              </label>
              <label style={{ fontSize: '13px' }}>
                <div style={{ color: tokens.text.muted, marginBottom: '4px' }}>Replace With</div>
                <input
                  value={form.replaceWith}
                  onChange={e => setForm(f => ({ ...f, replaceWith: e.target.value }))}
                  style={inputStyle}
                  placeholder="e.g. XXX-XX-XXXX"
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <label>
                  <div style={{ color: tokens.text.muted, marginBottom: '4px' }}>Target</div>
                  <select
                    value={form.target}
                    onChange={e => setForm(f => ({ ...f, target: e.target.value as ReplaceRule['target'] }))}
                    style={{ ...inputStyle }}
                  >
                    <option value="both">Both</option>
                    <option value="request">Request</option>
                    <option value="response">Response</option>
                  </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.isRegex}
                    onChange={e => setForm(f => ({ ...f, isRegex: e.target.checked }))}
                    style={{ width: '16px', height: '16px' }}
                  />
                  Use Regex
                </label>
              </div>
              <label style={{ fontSize: '13px' }}>
                <div style={{ color: tokens.text.muted, marginBottom: '4px' }}>XPath (optional)</div>
                <input
                  value={form.xpath}
                  onChange={e => setForm(f => ({ ...f, xpath: e.target.value }))}
                  style={inputStyle}
                  placeholder="e.g. //Customer/SSN"
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddRule(false)}
                style={{
                  padding: '8px 16px',
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
                  padding: '8px 16px',
                  background: tokens.status.accentDark,
                  border: 'none',
                  borderRadius: tokens.radius.md,
                  color: tokens.text.white,
                  fontSize: tokens.fontSize.base,
                  cursor: 'pointer'
                }}
              >
                {editingRule ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
