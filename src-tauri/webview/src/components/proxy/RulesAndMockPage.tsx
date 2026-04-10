import React from 'react';
import { MockRulesPage } from './MockRulesPage';
import { RulesPage } from './RulesPage';
import { tokens } from './tokens';

/**
 * Combined page showing Mock Rules (top half) and Replace Rules (bottom half),
 * each independently scrollable.
 */
export function RulesAndMockPage() {
  const sectionHeaderStyle: React.CSSProperties = {
    padding: '8px 16px',
    fontSize: tokens.fontSize.sm,
    fontWeight: 600,
    color: tokens.text.secondary,
    background: tokens.surface.elevated,
    borderBottom: `1px solid ${tokens.border.default}`,
    fontFamily: tokens.fontFamily,
    flexShrink: 0,
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Mock Rules — top half */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderBottom: `2px solid ${tokens.border.default}` }}>
        <div style={sectionHeaderStyle}>Mock Rules</div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <MockRulesPage />
        </div>
      </div>

      {/* Replace Rules — bottom half */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={sectionHeaderStyle}>Replace Rules</div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <RulesPage />
        </div>
      </div>
    </div>
  );
}
