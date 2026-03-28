import React, { useState, type ReactNode } from 'react';
import styled from 'styled-components';
import { MonacoResponseViewer } from './MonacoResponseViewer';
import {
  TabsHeader,
  TabButton,
  TabMeta,
} from './RequestWorkspace.styles';
import { SPACING_SM, SPACING_XS } from '../styles/spacing';

import type { ExtraTab } from './MonacoRequestEditorWithToolbar';

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const ViewerWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

const ViewerContent = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

// Read-only headers tab
const HeadersContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  color: var(--apinox-foreground);
  background: var(--apinox-editor-background);
  padding: ${SPACING_SM};
  gap: ${SPACING_XS};
  overflow-y: auto;
`;

const HeadersTitle = styled.div`
  font-weight: 600;
  font-size: 0.95em;
  color: var(--apinox-foreground);
  margin-bottom: ${SPACING_XS};
`;

const HeaderRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: ${SPACING_SM};
  align-items: stretch;
`;

const HeaderCell = styled.div`
  padding: 5px ${SPACING_SM};
  background: var(--apinox-input-background);
  border: 1px solid var(--apinox-input-border);
  border-radius: ${SPACING_XS};
  color: var(--apinox-disabledForeground);
  font-family: monospace;
  font-size: 12px;
  word-break: break-word;
`;

const HeaderKey = styled(HeaderCell)`
  color: var(--apinox-foreground);
  font-weight: 500;
`;

const EmptyState = styled.div`
  opacity: 0.6;
  font-style: italic;
  padding: ${SPACING_SM};
  text-align: center;
`;

// ---------------------------------------------------------------------------
// Props interface
// ---------------------------------------------------------------------------

export interface MonacoResponseViewerWithToolbarProps {
  /** Response body content */
  value: string;
  /** Language for syntax highlighting (default: 'xml') */
  language?: string;
  /** Show line numbers (default: true) */
  showLineNumbers?: boolean;
  /** Show minimap (default: false) */
  showMinimap?: boolean;
  /** Font size (default: 14) */
  fontSize?: number;
  /** Font family */
  fontFamily?: string;
  /** Elements to auto-fold in the viewer */
  autoFoldElements?: string[];
  /** Callback when text is selected in the viewer */
  onSelectionChange?: (data: { text: string; offset: number } | null) => void;
  /** Response headers shown in read-only Headers tab */
  headers?: Record<string, string>;
  /** Additional tabs injected by the parent */
  extraTabs?: ExtraTab[];
}

type InternalTab = 'body' | 'headers' | string;

// ---------------------------------------------------------------------------
// Read-only headers view
// ---------------------------------------------------------------------------

const ReadOnlyHeadersPanel: React.FC<{ headers: Record<string, string> }> = ({ headers }) => {
  const entries = Object.entries(headers);
  return (
    <HeadersContainer>
      <HeadersTitle>Response Headers</HeadersTitle>
      {entries.length === 0 ? (
        <EmptyState>No response headers.</EmptyState>
      ) : (
        entries.map(([key, value]) => (
          <HeaderRow key={key}>
            <HeaderKey>{key}</HeaderKey>
            <HeaderCell>{value}</HeaderCell>
          </HeaderRow>
        ))
      )}
    </HeadersContainer>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const MonacoResponseViewerWithToolbar: React.FC<MonacoResponseViewerWithToolbarProps> = ({
  value,
  language = 'xml',
  showLineNumbers = true,
  showMinimap = false,
  fontSize = 14,
  fontFamily = 'Consolas, "Courier New", monospace',
  autoFoldElements,
  onSelectionChange,
  headers,
  extraTabs = [],
}) => {
  const [activeTab, setActiveTab] = useState<InternalTab>('body');

  const hasHeaders = headers !== undefined;
  const headerCount = headers ? Object.keys(headers).length : 0;

  const renderTabContent = (): ReactNode => {
    if (activeTab === 'body') {
      return (
        <MonacoResponseViewer
          value={value}
          language={language}
          showLineNumbers={showLineNumbers}
          showMinimap={showMinimap}
          fontSize={fontSize}
          fontFamily={fontFamily}
          autoFoldElements={autoFoldElements}
          onSelectionChange={onSelectionChange}
        />
      );
    }

    if (activeTab === 'headers' && hasHeaders && headers) {
      return <ReadOnlyHeadersPanel headers={headers} />;
    }

    const extra = extraTabs.find(t => t.id === activeTab);
    return extra ? extra.render() : null;
  };

  return (
    <ViewerWrapper>
      <TabsHeader>
        <TabButton $active={activeTab === 'body'} onClick={() => setActiveTab('body')}>
          Body
        </TabButton>
        {hasHeaders && (
          <TabButton $active={activeTab === 'headers'} onClick={() => setActiveTab('headers')}>
            Headers
            {headerCount > 0 && <TabMeta>{headerCount}</TabMeta>}
          </TabButton>
        )}
        {extraTabs.map(tab => (
          <TabButton key={tab.id} $active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <TabMeta>{tab.badge}</TabMeta>
            )}
          </TabButton>
        ))}
      </TabsHeader>

      <ViewerContent>
        {renderTabContent()}
      </ViewerContent>
    </ViewerWrapper>
  );
};

MonacoResponseViewerWithToolbar.displayName = 'MonacoResponseViewerWithToolbar';
