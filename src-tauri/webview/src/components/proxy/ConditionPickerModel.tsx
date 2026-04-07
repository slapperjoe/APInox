import React, { useMemo, useState } from 'react';
import { tokens } from './tokens';

// ---------------------------------------------------------------------------
// Shared types (re-exported so importers don't need a separate import)
// ---------------------------------------------------------------------------

export interface MockCondition {
  type: 'url' | 'xpath' | 'soapAction' | 'header' | 'method' | 'queryParam' | 'contains';
  pattern: string;
  isRegex?: boolean;
  headerName?: string;
}

export interface SuggestedCondition {
  label: string;
  condition: MockCondition;
  recommended: boolean;
  group: 'Operation' | 'Body Parameters' | 'SOAP Headers' | 'HTTP';
}

// ---------------------------------------------------------------------------
// XML / SOAP suggestion derivation (runs in the webview via DOMParser)
// ---------------------------------------------------------------------------

function findLocalName(root: Element, name: string): Element | null {
  for (const child of Array.from(root.children)) {
    if (child.localName === name) return child;
    for (const grandchild of Array.from(child.children)) {
      if (grandchild.localName === name) return grandchild;
    }
  }
  return null;
}

function deriveOperationName(doc: Document | null): string | null {
  if (!doc) return null;
  const bodyEl = findLocalName(doc.documentElement, 'Body');
  if (!bodyEl) return null;
  const firstChild = Array.from(bodyEl.children)[0];
  return firstChild?.localName ?? null;
}

/**
 * Parse SOAP/XML request content with DOMParser and derive suggested
 * mock conditions from the operation name, body parameters, and SOAP headers.
 * Falls back gracefully on parse errors — always returns at least the
 * operation-level suggestions when an operationName is provided.
 */
export function suggestConditionsFromSoapXml(
  requestXml: string,
  operationName?: string,
): SuggestedCondition[] {
  const suggestions: SuggestedCondition[] = [];

  let doc: Document | null = null;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(requestXml, 'application/xml');
    if (doc.querySelector('parsererror')) doc = null;
  } catch {
    doc = null;
  }

  const opName = operationName ?? deriveOperationName(doc);

  // --- Operation group (always recommended) ---
  if (opName) {
    suggestions.push({
      label: 'XPath — operation present',
      condition: { type: 'xpath', pattern: `//*[local-name()='${opName}']`, isRegex: false },
      recommended: true,
      group: 'Operation',
    });
    suggestions.push({
      label: `SOAP Action contains "${opName}"`,
      condition: { type: 'soapAction', pattern: opName, isRegex: false },
      recommended: true,
      group: 'Operation',
    });
  }

  if (!doc) return suggestions;

  // --- Body Parameters ---
  const bodyEl = findLocalName(doc.documentElement, 'Body');
  const opEl = bodyEl ? (Array.from(bodyEl.children)[0] ?? null) : null;
  if (opEl) {
    for (const child of Array.from(opEl.children)) {
      const localName = child.localName;
      const text = child.textContent?.trim() ?? '';
      suggestions.push({
        label: `XPath — ${localName} present`,
        condition: { type: 'xpath', pattern: `//*[local-name()='${localName}']`, isRegex: false },
        recommended: false,
        group: 'Body Parameters',
      });
      if (text && !text.includes('\n')) {
        suggestions.push({
          label: `XPath — ${localName} = "${text}"`,
          condition: {
            type: 'xpath',
            pattern: `//*[local-name()='${localName}'][text()='${text}']`,
            isRegex: false,
          },
          recommended: false,
          group: 'Body Parameters',
        });
      }
    }
  }

  // --- SOAP Headers ---
  const headerEl = findLocalName(doc.documentElement, 'Header');
  if (headerEl) {
    for (const child of Array.from(headerEl.children)) {
      const localName = child.localName;
      const text = child.textContent?.trim() ?? '';
      suggestions.push({
        label: `XPath — ${localName} present`,
        condition: { type: 'xpath', pattern: `//*[local-name()='${localName}']`, isRegex: false },
        recommended: false,
        group: 'SOAP Headers',
      });
      if (text && !text.includes('\n')) {
        suggestions.push({
          label: `XPath — ${localName} = "${text}"`,
          condition: {
            type: 'xpath',
            pattern: `//*[local-name()='${localName}'][text()='${text}']`,
            isRegex: false,
          },
          recommended: false,
          group: 'SOAP Headers',
        });
      }
    }
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ConditionPickerModalProps {
  suggestions: SuggestedCondition[];
  onConfirm: (selected: MockCondition[]) => void;
  onCancel: () => void;
}

const GROUP_ORDER: SuggestedCondition['group'][] = [
  'Operation',
  'Body Parameters',
  'SOAP Headers',
  'HTTP',
];

export const ConditionPickerModal: React.FC<ConditionPickerModalProps> = ({
  suggestions,
  onConfirm,
  onCancel,
}) => {
  // Pre-select all recommended conditions
  const [selected, setSelected] = useState<Set<number>>(() => {
    const s = new Set<number>();
    suggestions.forEach((sg, i) => { if (sg.recommended) s.add(i); });
    return s;
  });
  // Allow inline editing of pattern values before confirming
  const [editedPatterns, setEditedPatterns] = useState<Record<number, string>>({});

  const grouped = useMemo(() => {
    const map = new Map<SuggestedCondition['group'], { sg: SuggestedCondition; idx: number }[]>();
    suggestions.forEach((sg, idx) => {
      if (!map.has(sg.group)) map.set(sg.group, []);
      map.get(sg.group)!.push({ sg, idx });
    });
    return GROUP_ORDER.filter(g => map.has(g)).map(g => ({ group: g, items: map.get(g)! }));
  }, [suggestions]);

  function toggle(idx: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function handleConfirm() {
    const conditions: MockCondition[] = [];
    suggestions.forEach((sg, i) => {
      if (!selected.has(i)) return;
      const pattern = editedPatterns[i] ?? sg.condition.pattern;
      conditions.push({ ...sg.condition, pattern });
    });
    onConfirm(conditions);
  }

  const selectedCount = selected.size;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '3px 7px', background: tokens.surface.input,
    border: `1px solid ${tokens.border.subtle}`, borderRadius: tokens.radius.sm,
    color: tokens.text.secondary, fontSize: tokens.fontSize.xs, fontFamily: 'Consolas, monospace',
    marginTop: '5px',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1100, padding: '20px',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: tokens.surface.panel, borderRadius: '8px', border: `1px solid ${tokens.border.default}`,
          width: '640px', maxWidth: '100%', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${tokens.border.default}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: tokens.text.secondary }}>
              Choose Match Conditions
            </div>
            <div style={{ fontSize: '11px', color: tokens.text.hint, marginTop: '3px' }}>
              Derived from the captured request. Edit values inline before confirming.
            </div>
          </div>
          <button onClick={onCancel} style={{
            background: 'none', border: 'none', color: tokens.text.hint, fontSize: '20px',
            cursor: 'pointer', lineHeight: 1, padding: '0 0 0 12px',
          }}>&#x2715;</button>
        </div>

        {/* Suggestion list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {suggestions.length === 0 ? (
            <div style={{ color: tokens.text.hint, fontSize: '12px', padding: '16px 0' }}>
              No conditions could be derived from the request XML.
            </div>
          ) : (
            grouped.map(({ group, items }) => (
              <div key={group} style={{ marginBottom: '16px' }}>
                {/* Group heading */}
                <div style={{
                  fontSize: '10px', fontWeight: 700, color: tokens.text.muted,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  {group}
                  <div style={{ flex: 1, height: '1px', background: tokens.surface.stripe }} />
                </div>

                {items.map(({ sg, idx }) => {
                  const isSelected = selected.has(idx);
                  const pattern = editedPatterns[idx] ?? sg.condition.pattern;
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex', flexDirection: 'column',
                        padding: '7px 10px', marginBottom: '4px',
                        borderRadius: '4px', cursor: 'pointer',
                        background: isSelected ? 'rgba(14,99,156,0.15)' : tokens.surface.base,
                        border: `1px solid ${isSelected ? tokens.status.accentDark : '#2d2d2d'}`,
                      }}
                      onClick={() => toggle(idx)}
                    >
                      {/* Top row: checkbox + label + recommended badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(idx)}
                          onClick={e => e.stopPropagation()}
                          style={{ flexShrink: 0, cursor: 'pointer' }}
                        />
                        <div style={{
                          flex: 1, fontSize: '12px',
                          color: isSelected ? tokens.text.secondary : tokens.text.muted,
                          fontWeight: isSelected ? 500 : 400,
                          wordBreak: 'break-all',
                        }}>
                          {sg.label}
                          {sg.recommended && (
                            <span style={{
                              marginLeft: '6px', fontSize: '9px', background: '#1e3a5a',
                              color: '#6db3e8', padding: '1px 5px', borderRadius: '8px',
                            }}>recommended</span>
                          )}
                        </div>
                      </div>
                      {/* Pattern input — full width below the label */}
                      <input
                        type="text"
                        value={pattern}
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          setEditedPatterns(prev => ({ ...prev, [idx]: e.target.value }));
                          if (!isSelected) {
                            setSelected(prev => { const n = new Set(prev); n.add(idx); return n; });
                          }
                        }}
                        style={inputStyle}
                      />
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: `1px solid ${tokens.border.default}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '11px', color: tokens.text.hint }}>
            {selectedCount} condition{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onCancel} style={{
              padding: '7px 16px', background: 'transparent', border: `1px solid ${tokens.border.subtle}`,
              borderRadius: tokens.radius.md, color: tokens.text.secondary, fontSize: tokens.fontSize.base, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={handleConfirm} style={{
              padding: '7px 16px', background: tokens.status.accentDark, border: 'none',
              borderRadius: tokens.radius.md, color: tokens.text.white, fontSize: tokens.fontSize.base, cursor: 'pointer',
            }}>
              {selectedCount === 0
                ? 'Continue with no conditions'
                : `Use ${selectedCount} condition${selectedCount !== 1 ? 's' : ''} \u2192`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
