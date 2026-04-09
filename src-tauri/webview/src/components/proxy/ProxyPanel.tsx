import React, { useState, useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { ServerControl } from './ServerControl';
import { TrafficViewer, type TrafficLog } from './TrafficViewer';
import { TrafficDetails } from './TrafficDetails';
import { BreakpointsPage } from './BreakpointsPage';
import { useIgnoreList } from '../../utils/useIgnoreList';
import { tokens } from './tokens';

type ProxyTab = 'traffic' | 'breakpoints';

interface ProxyPanelProps {
  onNavigateTo?: (view: string) => void;
}

export function ProxyPanel({ onNavigateTo }: ProxyPanelProps) {
  const [activeTab, setActiveTab] = useState<ProxyTab>('traffic');
  const [logs, setLogs] = useState<TrafficLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<TrafficLog | null>(null);
  const { rules: ignoreRules, addRule: addIgnoreRule, removeRule: removeIgnoreRule } = useIgnoreList();

  useEffect(() => {
    const unlisten = listen<TrafficLog>('traffic-event', (event) => {
      setLogs(prev => [...prev, event.payload]);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const handleClearTraffic = useCallback(() => {
    setLogs([]);
    setSelectedLog(null);
  }, []);

  const handleCreateMockRule = useCallback((_log: TrafficLog) => {
    if (onNavigateTo) onNavigateTo('mock');
  }, [onNavigateTo]);

  const handleCreateReplaceRule = useCallback((_log: TrafficLog) => {
    if (onNavigateTo) onNavigateTo('mock');
  }, [onNavigateTo]);

  const handleCreateBreakpoint = useCallback((_log: TrafficLog) => {
    setActiveTab('breakpoints');
  }, []);

  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    background: tokens.surface.panel,
    borderBottom: `1px solid ${tokens.border.default}`,
    padding: '0 12px',
    flexShrink: 0,
    gap: 4,
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    color: active ? tokens.text.primary : tokens.text.muted,
    cursor: 'pointer',
    borderBottom: active ? `2px solid ${tokens.status.accentDark}` : '2px solid transparent',
    background: 'transparent',
    border: 'none',
    borderBottomWidth: 2,
    borderBottomStyle: 'solid',
    borderBottomColor: active ? tokens.status.accentDark : 'transparent',
    marginBottom: -1,
    userSelect: 'none',
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: tokens.surface.base }}>
      {/* Server control bar */}
      <div style={{ flexShrink: 0, borderBottom: `1px solid ${tokens.border.default}` }}>
        <ServerControl />
      </div>

      {/* Tab bar */}
      <div style={tabBarStyle}>
        {(['traffic', 'breakpoints'] as ProxyTab[]).map(tab => (
          <button key={tab} style={tabStyle(activeTab === tab)} onClick={() => setActiveTab(tab)}>
            {tab === 'traffic' ? 'Traffic' : 'Breakpoints'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {activeTab === 'traffic' && (
          <>
            <div style={{ flex: selectedLog ? '0 0 45%' : 1, overflow: 'hidden', minWidth: 0 }}>
              <TrafficViewer
                logs={logs}
                onSelectLog={setSelectedLog}
                ignoreRules={ignoreRules}
                onAddIgnoreRule={addIgnoreRule}
                onCreateMockRule={handleCreateMockRule}
                onCreateReplaceRule={handleCreateReplaceRule}
                onCreateBreakpoint={handleCreateBreakpoint}
                onClearTraffic={handleClearTraffic}
              />
            </div>
            {selectedLog && (
              <div style={{ flex: 1, borderLeft: `1px solid ${tokens.border.default}`, overflow: 'hidden', minWidth: 0 }}>
                <TrafficDetails log={selectedLog} />
              </div>
            )}
          </>
        )}
        {activeTab === 'breakpoints' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <BreakpointsPage />
          </div>
        )}
      </div>
    </div>
  );
}
