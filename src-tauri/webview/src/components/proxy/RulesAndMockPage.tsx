import React, { useRef, useState } from 'react';
import { SPACING_MD, SPACING_SM } from "../../styles/spacing";
import { MockRulesPage, MockRulesPageHandle, MockRulesMeta } from './MockRulesPage';
import { RulesPage, RulesPageHandle } from './RulesPage';
import { tokens } from './tokens';

/**
 * Combined page showing Mock Rules (top half) and Replace Rules (bottom half),
 * each independently scrollable.
 */
export function RulesAndMockPage() {
  const mockRef = useRef<MockRulesPageHandle>(null);
  const rulesRef = useRef<RulesPageHandle>(null);

  const [mockSearch, setMockSearch] = useState('');
  const [mockTagFilter, setMockTagFilter] = useState('');
  const [mockMeta, setMockMeta] = useState<MockRulesMeta>({ allTags: [], total: 0, filtered: 0 });

  const barStyle: React.CSSProperties = {
    padding: '0 16px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    gap: SPACING_SM,
    fontSize: '11px',
    fontWeight: 'var(--fw-bold)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    color: 'var(--apinox-sideBarTitle-foreground)',
    background: tokens.surface.elevated,
    borderBottom: `1px solid ${tokens.border.default}`,
    fontFamily: tokens.fontFamily,
    flexShrink: 0,
    userSelect: 'none',
  };

  const btnStyle: React.CSSProperties = {
    padding: `3px ${SPACING_MD}`,
    background: 'transparent',
    border: `1px solid ${tokens.border.subtle}`,
    borderRadius: tokens.radius.md,
    color: tokens.text.secondary,
    fontSize: tokens.fontSize.sm,
    cursor: 'pointer',
    fontWeight: 'var(--fw-regular)',
    textTransform: 'none',
    letterSpacing: 0,
    userSelect: 'none',
  };

  const primaryBtnStyle: React.CSSProperties = {
    ...btnStyle,
    background: tokens.status.accentDark,
    border: 'none',
    color: tokens.text.white,
  };

  const inputStyle: React.CSSProperties = {
    padding: `3px 8px`,
    background: tokens.surface.input,
    border: `1px solid ${tokens.border.subtle}`,
    borderRadius: tokens.radius.md,
    color: tokens.text.secondary,
    fontSize: tokens.fontSize.sm,
    width: '160px',
    fontWeight: 'var(--fw-regular)',
    letterSpacing: 0,
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Mock Rules — top half */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderBottom: `2px solid ${tokens.border.default}` }}>
        <div style={barStyle}>
          <span>Mock Rules</span>
          <input
            value={mockSearch}
            onChange={(e) => setMockSearch(e.target.value)}
            placeholder="Search…"
            style={inputStyle}
          />
          {mockMeta.allTags.length > 0 && (
            <select
              value={mockTagFilter}
              onChange={(e) => setMockTagFilter(e.target.value)}
              style={{ ...inputStyle, width: 'auto' }}
            >
              <option value="">All tags</option>
              {mockMeta.allTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <span style={{ flex: 1 }} />
          {(mockMeta.total > 0) && (
            <span style={{ fontSize: tokens.fontSize.xs, color: tokens.text.faint, fontWeight: 'var(--fw-regular)', letterSpacing: 0 }}>
              {mockMeta.filtered}/{mockMeta.total}
            </span>
          )}
          <button style={btnStyle} onClick={() => mockRef.current?.openImport()}>Import</button>
          <button
            style={{ ...btnStyle, color: mockMeta.total === 0 ? tokens.text.faint : tokens.text.secondary, cursor: mockMeta.total === 0 ? 'default' : 'pointer' }}
            disabled={mockMeta.total === 0}
            onClick={() => mockRef.current?.openExport()}
          >Export</button>
          <button style={primaryBtnStyle} onClick={() => mockRef.current?.addRule()}>+ Add Rule</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <MockRulesPage
            ref={mockRef}
            searchText={mockSearch}
            tagFilter={mockTagFilter}
            onMetaChange={setMockMeta}
          />
        </div>
      </div>

      {/* Replace Rules — bottom half */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={barStyle}>
          <span>Replace Rules</span>
          <span style={{ flex: 1 }} />
          <button style={primaryBtnStyle} onClick={() => rulesRef.current?.addRule()}>+ Add Rule</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <RulesPage ref={rulesRef} />
        </div>
      </div>
    </div>
  );
}
