import React, { useState, useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { ServerControl } from './ServerControl';
import { TrafficViewer, type TrafficLog } from './TrafficViewer';
import { TrafficDetails } from './TrafficDetails';
import { BreakpointsPage } from './BreakpointsPage';
import { useIgnoreList } from '../../utils/useIgnoreList';
import { tokens } from './tokens';

const SPLIT_KEY = 'apinox-traffic-split-px';
const DEFAULT_SPLIT_PX = 280;
const MIN_SPLIT_PX = 160;
const MAX_SPLIT_RATIO = 0.75;

type ProxyTab = 'traffic' | 'breakpoints';

interface ProxyPanelProps {
  onNavigateTo?: (view: string) => void;
  onAddToApinoxProject?: (log: TrafficLog) => void;
}

export function ProxyPanel({ onNavigateTo, onAddToApinoxProject }: ProxyPanelProps) {
  const [activeTab, setActiveTab] = useState<ProxyTab>('traffic');
  const [logs, setLogs] = useState<TrafficLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<TrafficLog | null>(null);
  const { rules: ignoreRules, addRule: addIgnoreRule, removeRule: removeIgnoreRule } = useIgnoreList();

  // Resizable split pane
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitPx, setSplitPx] = useState<number>(() => {
    const saved = localStorage.getItem(SPLIT_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_SPLIT_PX;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startPx = splitPx;
    setIsDragging(true);

    const onMove = (ev: MouseEvent) => {
      if (!containerRef.current) return;
      const maxW = containerRef.current.getBoundingClientRect().width;
      const maxPx = Math.floor(maxW * MAX_SPLIT_RATIO);
      const delta = ev.clientX - startX;
      const clamped = startPx + delta;
      if (clamped < MIN_SPLIT_PX) {
        setSplitPx(MIN_SPLIT_PX);
      } else if (clamped > maxPx) {
        setSplitPx(maxPx);
      } else {
        setSplitPx(clamped);
      }
    };
    const onUp = () => {
      setIsDragging(false);
      localStorage.setItem(SPLIT_KEY, String(splitPx));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [splitPx]);

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
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {activeTab === 'traffic' && (
          <>
            <div style={{ flex: `0 0 ${splitPx}px`, overflow: 'hidden', minWidth: 0 }}>
              <TrafficViewer
                logs={logs}
                onSelectLog={setSelectedLog}
                ignoreRules={ignoreRules}
                onAddIgnoreRule={addIgnoreRule}
                onCreateMockRule={handleCreateMockRule}
                onCreateReplaceRule={handleCreateReplaceRule}
                onCreateBreakpoint={handleCreateBreakpoint}
                onClearTraffic={handleClearTraffic}
                onAddToApinoxProject={onAddToApinoxProject}
              />
            </div>
            {selectedLog && (
              <>
                <div
                  style={{
                    width: '5px',
                    background: isDragging || isHovering ? tokens.status.accentDark : tokens.surface.elevated,
                    cursor: 'ew-resize',
                    flexShrink: 0,
                    transition: 'background 0.15s',
                    userSelect: 'none',
                  }}
                  onMouseDown={handleDividerMouseDown}
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                />
                <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                  <TrafficDetails log={selectedLog} />
                </div>
              </>
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
