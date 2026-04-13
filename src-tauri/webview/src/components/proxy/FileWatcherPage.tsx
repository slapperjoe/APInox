import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { listen } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { MonacoRequestEditorWithToolbar, MonacoResponseViewer, DEFAULT_EDITOR_SETTINGS } from '@apinox/request-editor';
import type { EditorSettings } from '@apinox/request-editor';
import { invokeTauriCommand } from '../../utils/bridge';
import { ConditionPickerModal, suggestConditionsFromSoapXml } from './ConditionPickerModel';
import { tokens } from './tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileWatch {
  id: string;
  name: string;
  enabled: boolean;
  requestFile: string;
  responseFile: string;
  correlationIdElements: string[];
}

interface SoapMessage {
  id: string;
  watchId: string;
  timestamp: number;
  messageType: string;
  filePath: string;
  content: string;
  operationName?: string;
  correlationId?: string;
}

interface SoapPair {
  id: string;
  watchId: string;
  operationName?: string;
  request?: SoapMessage;
  response?: SoapMessage;
  status: 'pending' | 'matched';
  createdAt: number;
  updatedAt: number;
}

interface WatcherSoapEvent {
  eventType: string;
  pair: SoapPair;
}

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const Container = styled.div`
  display: flex;
  height: 100%;
  background: ${tokens.surface.base};
  color: ${tokens.text.primary};
  font-size: 13px;
`;

const WatchSidebar = styled.div`
  width: 240px;
  min-width: 200px;
  background: ${tokens.surface.panel};
  border-right: 1px solid ${tokens.border.default};
  display: flex;
  flex-direction: column;
`;

const SidebarHeader = styled.div`
  padding: 4px 14px;
  height: 44px;
  border-bottom: 1px solid ${tokens.border.default};
  display: flex;
  justify-content: space-between;
  align-items: center;
  h3 {
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: var(--apinox-sideBarTitle-foreground);
  }
`;

const WatchList = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const WatchItem = styled.div<{ $active: boolean }>`
  padding: 10px 14px;
  border-bottom: 1px solid ${tokens.surface.elevated};
  cursor: pointer;
  background: ${p => p.$active ? tokens.surface.active : 'transparent'};
  &:hover { background: ${p => p.$active ? tokens.surface.active : tokens.surface.stripe}; }
`;

const WatchName = styled.div`
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
`;

const WatchPath = styled.div`
  font-size: 10px;
  color: ${tokens.text.muted};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StatusBadge = styled.span<{ $enabled: boolean }>`
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 10px;
  background: ${p => p.$enabled ? 'rgba(14,99,156,0.25)' : 'rgba(100,100,100,0.2)'};
  color: ${p => p.$enabled ? 'var(--apinox-focusBorder, #6db3e8)' : tokens.text.muted};
  border: 1px solid ${p => p.$enabled ? 'rgba(14,99,156,0.5)' : 'rgba(100,100,100,0.4)'};
  user-select: none;
  pointer-events: none;
`;

const WatchActions = styled.div`
  margin-top: 6px;
  display: flex;
  gap: 6px;
`;

const MainArea = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const PairList = styled.div`
  width: 280px;
  min-width: 220px;
  border-right: 1px solid ${tokens.border.default};
  display: flex;
  flex-direction: column;
`;

const PairListHeader = styled.div`
  padding: 4px 14px;
  height: 44px;
  border-bottom: 1px solid ${tokens.border.default};
  display: flex;
  justify-content: space-between;
  align-items: center;
  h3 {
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: var(--apinox-sideBarTitle-foreground);
  }
`;

const PairScroll = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const PairRow = styled.div<{ $active: boolean }>`
  padding: 10px 14px;
  border-bottom: 1px solid ${tokens.surface.elevated};
  cursor: pointer;
  background: ${p => p.$active ? tokens.surface.active : 'transparent'};
  &:hover { background: ${p => p.$active ? tokens.surface.active : tokens.surface.stripe}; }
`;

const PairRowHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 3px;
`;

const OperationName = styled.div`
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
`;

const MatchBadge = styled.span<{ $matched: boolean }>`
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 10px;
  background: ${p => p.$matched ? 'rgba(58,110,58,0.25)' : 'rgba(122,90,30,0.2)'};
  color: ${p => p.$matched ? 'var(--apinox-testing-iconPassed, #89d185)' : 'var(--apinox-testing-iconQueued, #ddb165)'};
  border: 1px solid ${p => p.$matched ? 'rgba(58,110,58,0.5)' : 'rgba(122,90,30,0.5)'};
  flex-shrink: 0;
  margin-left: 6px;
  user-select: none;
  pointer-events: none;
`;

const PairTime = styled.div`
  font-size: 10px;
  color: ${tokens.text.muted};
`;

const DetailPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const DetailHeader = styled.div`
  padding: 10px 16px;
  border-bottom: 1px solid ${tokens.border.default};
  display: flex;
  align-items: center;
  gap: 12px;
  background: ${tokens.surface.panel};
`;

const DetailTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  flex: 1;
`;

const DetailBody = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const EditorPane = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-bottom: 1px solid ${tokens.border.default};
  &:last-child { border-bottom: none; }
`;

const SplitDivider = styled.div<{ $dragging: boolean }>`
  height: 5px;
  background: ${p => p.$dragging ? tokens.status.accentDark : tokens.surface.elevated};
  cursor: ns-resize;
  flex-shrink: 0;
  transition: background 0.15s;
  user-select: none;
  &:hover { background: ${tokens.status.accentDark}; }
`;

const PaneLabel = styled.div`
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: ${tokens.text.secondary};
  background: ${tokens.surface.panel};
  border-bottom: 1px solid ${tokens.surface.elevated};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const PaneMeta = styled.div`
  padding: 3px 14px;
  font-size: 10px;
  color: ${tokens.text.hint};
  background: ${tokens.surface.panel};
  border-bottom: 1px solid ${tokens.surface.elevated};
`;

const Placeholder = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${tokens.text.faint};
  font-size: 12px;
`;

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: ${tokens.text.faint};
  gap: 6px;
  p { margin: 0; font-size: 12px; }
`;

const Btn = styled.button`
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  padding: 3px 10px;
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const PrimaryBtn = styled(Btn)`
  background: ${tokens.status.accentDark};
  color: white;
  &:hover:not(:disabled) { background: ${tokens.status.accentHover}; }
`;

const SecondaryBtn = styled(Btn)`
  background: transparent;
  color: ${tokens.text.primary};
  border: 1px solid ${tokens.border.default};
  &:hover:not(:disabled) { background: ${tokens.surface.active}; }
`;

const DangerBtn = styled(Btn)`
  background: ${tokens.surface.danger};
  color: ${tokens.text.danger};
  border: 1px solid ${tokens.surface.dangerDark};
  &:hover:not(:disabled) { background: ${tokens.surface.dangerDark}; }
`;

const SuccessBtn = styled(Btn)`
  background: ${tokens.surface.successDark};
  color: ${tokens.status.success};
  border: 1px solid ${tokens.surface.successDark};
  &:hover:not(:disabled) { background: #1a8a2a; }
`;

const AddBtn = styled(Btn)`
  background: ${tokens.status.accentDark};
  color: white;
  padding: 3px 10px;
  &:hover { background: ${tokens.status.accentHover}; }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Modal = styled.div`
  background: ${tokens.surface.panel};
  border: 1px solid ${tokens.border.default};
  border-radius: ${tokens.radius.lg};
  width: 500px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0,0,0,.5);
`;

const ModalHeader = styled.div`
  padding: 14px 18px;
  border-bottom: 1px solid ${tokens.border.default};
  font-size: 14px;
  font-weight: 600;
`;

const ModalBody = styled.div`
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ModalFooter = styled.div`
  padding: 12px 18px;
  border-top: 1px solid ${tokens.border.default};
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;

  label {
    font-size: 11px;
    font-weight: 600;
    color: ${tokens.text.secondary};
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  input, textarea {
    background: ${tokens.surface.input};
    border: 1px solid ${tokens.border.subtle};
    border-radius: ${tokens.radius.sm};
    color: ${tokens.text.primary};
    font-size: 12px;
    padding: 5px 8px;
    font-family: 'Consolas', monospace;
    &:focus { outline: none; border-color: ${tokens.status.accentDark}; }
  }

  .hint {
    font-size: 10px;
    color: ${tokens.text.hint};
    margin-top: 2px;
  }
`;

const FileInput = styled.div`
  display: flex;
  gap: 6px;
  align-items: stretch;

  input {
    flex: 1;
    min-width: 0;
  }
`;

const BrowseBtn = styled.button`
  background: ${tokens.surface.input};
  border: 1px solid ${tokens.border.subtle};
  border-radius: ${tokens.radius.sm};
  color: ${tokens.text.primary};
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  &:hover { background: ${tokens.surface.hover}; border-color: #777; }
`;

// ---------------------------------------------------------------------------
// Inner editor panes
// ---------------------------------------------------------------------------

interface EditorPanesProps {
  pair: SoapPair;
  requestPanePx: number | undefined;
  isDragging: boolean;
  onDividerMouseDown: (e: React.MouseEvent) => void;
  editorSettings: EditorSettings;
  onSettingsChange: (s: EditorSettings) => void;
  formatTime: (ts: number) => string;
}

const EditorPanes: React.FC<EditorPanesProps> = ({
  pair, requestPanePx, isDragging, onDividerMouseDown,
  editorSettings, onSettingsChange, formatTime,
}) => {
  return (
    <>
      <EditorPane style={requestPanePx !== undefined ? { flex: `0 0 ${requestPanePx}px` } : {}}>
        <PaneLabel>
          <span>Request</span>
        </PaneLabel>
        {pair.request ? (
          <>
            <PaneMeta>
              {pair.request.filePath} · {formatTime(pair.request.timestamp)}
            </PaneMeta>
            <MonacoRequestEditorWithToolbar
              value={pair.request.content}
              onChange={() => {}}
              language="xml"
              readOnly
              initialSettings={editorSettings}
              onSettingsChange={onSettingsChange}
            />
          </>
        ) : (
          <Placeholder>No request captured</Placeholder>
        )}
      </EditorPane>
      <SplitDivider $dragging={isDragging} onMouseDown={onDividerMouseDown} />
      <EditorPane style={{ flex: 1, minHeight: 0 }}>
        <PaneLabel><span>Response</span></PaneLabel>
        {pair.response ? (
          <>
            <PaneMeta>
              {pair.response.filePath} · {formatTime(pair.response.timestamp)}
            </PaneMeta>
            <MonacoResponseViewer
              value={pair.response.content}
              language="xml"
              showLineNumbers={editorSettings.showLineNumbers}
              showMinimap={editorSettings.showMinimap}
              fontSize={editorSettings.fontSize}
              fontFamily={editorSettings.fontFamily}
            />
          </>
        ) : (
          <Placeholder>Waiting for response…</Placeholder>
        )}
      </EditorPane>
    </>
  );
};

// ---------------------------------------------------------------------------
// Editor settings persistence
// ---------------------------------------------------------------------------

const EDITOR_SETTINGS_KEY = 'apiprox-editor-settings';

const loadEditorSettings = (): EditorSettings => {
  try {
    const raw = localStorage.getItem(EDITOR_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_EDITOR_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_EDITOR_SETTINGS;
};

const saveEditorSettings = (settings: EditorSettings) => {
  try {
    localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DEFAULT_CORR_ELEMENTS = 'CorrelationId, MessageId, TraceId';

export const FileWatcherPage: React.FC = () => {
  const [watches, setWatches] = useState<FileWatch[]>([]);
  const [pairs, setPairs] = useState<SoapPair[]>([]);
  const [selectedWatchId, setSelectedWatchId] = useState<string | null>(null);
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWatch, setEditingWatch] = useState<FileWatch | null>(null);

  const [formName, setFormName] = useState('');
  const [formRequestFile, setFormRequestFile] = useState('');
  const [formResponseFile, setFormResponseFile] = useState('');
  const [formCorrElements, setFormCorrElements] = useState(DEFAULT_CORR_ELEMENTS);

  const detailBodyRef = useRef<HTMLDivElement>(null);
  const [detailBodyHeight, setDetailBodyHeight] = useState(0);
  const [userRequestPx, setUserRequestPx] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(loadEditorSettings);
  const [pickerPair, setPickerPair] = useState<SoapPair | null>(null);

  const handleSettingsChange = useCallback((settings: EditorSettings) => {
    setEditorSettings(settings);
    saveEditorSettings(settings);
  }, []);

  useEffect(() => {
    const el = detailBodyRef.current;
    if (!el) {
      setDetailBodyHeight(0);
      return;
    }
    setDetailBodyHeight(el.getBoundingClientRect().height);
    const ro = new ResizeObserver(() => {
      setDetailBodyHeight(el.getBoundingClientRect().height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedPairId]);

  useEffect(() => {
    setUserRequestPx(null);
  }, [selectedPairId]);

  useEffect(() => {
    loadWatches();
    loadPairs();
  }, []);

  // Listen for real-time SOAP pair events
  useEffect(() => {
    const unlisten = listen<WatcherSoapEvent>('watcher-soap-event', (event) => {
      const { pair } = event.payload;
      setPairs(prev => {
        const idx = prev.findIndex(p => p.id === pair.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = pair;
          return next;
        }
        return [pair, ...prev];
      });
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const loadWatches = async () => {
    try {
      const result = await invokeTauriCommand<FileWatch[]>('get_file_watches');
      setWatches(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error('Failed to load watches:', err);
    }
  };

  const loadPairs = async () => {
    try {
      const result = await invokeTauriCommand<SoapPair[]>('get_soap_pairs', { watchId: null });
      if (Array.isArray(result) && result.length > 0) {
        setPairs(result.sort((a: SoapPair, b: SoapPair) => b.createdAt - a.createdAt));
      }
    } catch (err) {
      console.error('Failed to load existing pairs:', err);
    }
  };

  const openAddModal = () => {
    setEditingWatch(null);
    setFormName('');
    setFormRequestFile('');
    setFormResponseFile('');
    setFormCorrElements(DEFAULT_CORR_ELEMENTS);
    setShowAddModal(true);
  };

  const openEditModal = (watch: FileWatch) => {
    setEditingWatch(watch);
    setFormName(watch.name);
    setFormRequestFile(watch.requestFile);
    setFormResponseFile(watch.responseFile);
    setFormCorrElements(watch.correlationIdElements.join(', '));
    setShowAddModal(true);
  };

  const parseCorrElements = (raw: string): string[] =>
    raw.split(',').map(s => s.trim()).filter(Boolean);

  const browseFile = async (setter: (path: string) => void) => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: 'XML Files', extensions: ['xml'] }, { name: 'All Files', extensions: ['*'] }],
    });
    if (selected && typeof selected === 'string') {
      setter(selected);
    }
  };

  const handleSaveWatch = async () => {
    if (!formName || !formRequestFile || !formResponseFile) {
      alert('Name, request file, and response file are required.');
      return;
    }
    const watchData = {
      id: editingWatch?.id ?? '',
      name: formName,
      enabled: editingWatch?.enabled ?? true,
      requestFile: formRequestFile,
      responseFile: formResponseFile,
      correlationIdElements: parseCorrElements(formCorrElements),
    };
    try {
      if (editingWatch) {
        await invokeTauriCommand('update_file_watch', { id: editingWatch.id, watch: watchData });
      } else {
        await invokeTauriCommand('add_file_watch', { watch: watchData });
      }
      await loadWatches();
      setShowAddModal(false);
    } catch (err: any) {
      alert(`Failed to save watch: ${err}`);
    }
  };

  const handleToggleWatch = async (watch: FileWatch) => {
    try {
      await invokeTauriCommand('update_file_watch', { id: watch.id, watch: { ...watch, enabled: !watch.enabled } });
      await loadWatches();
    } catch (err: any) {
      alert(`Failed to toggle watch: ${err}`);
    }
  };

  const handleDeleteWatch = async (id: string) => {
    if (!confirm('Delete this watch?')) return;
    try {
      await invokeTauriCommand('delete_file_watch', { id });
      await loadWatches();
      if (selectedWatchId === id) setSelectedWatchId(null);
      setPairs(prev => prev.filter(p => p.watchId !== id));
    } catch (err: any) {
      alert(`Failed to delete watch: ${err}`);
    }
  };

  const handleClearPairs = async () => {
    if (!confirm('Clear all captured pair history?')) return;
    try {
      await invokeTauriCommand('clear_watcher_events');
      setPairs([]);
      setSelectedPairId(null);
    } catch (err) {
      console.error('Failed to clear pairs:', err);
    }
  };

  const handleCreateMockRule = (pair: SoapPair) => {
    if (!pair.request || !pair.response) return;
    setPickerPair(pair);
  };

  const formatTime = (ms: number) => new Date(ms).toLocaleTimeString();

  const visiblePairs = selectedWatchId
    ? pairs.filter(p => p.watchId === selectedWatchId)
    : pairs;

  const selectedPair = pairs.find(p => p.id === selectedPairId) ?? null;
  const selectedWatchName = watches.find(w => w.id === selectedWatchId)?.name;

  const LINE_HEIGHT = 19;
  const PANE_OVERHEAD = 101;
  const requestLineCount = selectedPair?.request?.content
    ? selectedPair.request.content.split('\n').length
    : 0;
  const requestNaturalPx = (requestLineCount + 3) * LINE_HEIGHT + PANE_OVERHEAD;
  const calculatedRequestPx = detailBodyHeight > 0
    ? Math.min(requestNaturalPx, detailBodyHeight * 0.6)
    : undefined;

  const effectiveRequestPx = userRequestPx ?? calculatedRequestPx;

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startPx = effectiveRequestPx ?? 0;
    setIsDragging(true);

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startY;
      const min = 80;
      const max = detailBodyHeight > 0 ? detailBodyHeight * 0.85 : 9999;
      setUserRequestPx(Math.max(min, Math.min(startPx + delta, max)));
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [effectiveRequestPx, detailBodyHeight]);

  return (
    <Container>
      {/* ── Left: Watch list ── */}
      <WatchSidebar>
        <SidebarHeader>
          <h3>Watches</h3>
          <AddBtn onClick={openAddModal}>+ Add</AddBtn>
        </SidebarHeader>
        <WatchList>
          <WatchItem $active={selectedWatchId === null} onClick={() => setSelectedWatchId(null)}>
            <WatchName>
              All Watches
              <StatusBadge $enabled={true}>{pairs.length}</StatusBadge>
            </WatchName>
            <WatchPath>All captured pairs</WatchPath>
          </WatchItem>
          {watches.map(w => (
            <WatchItem
              key={w.id}
              $active={selectedWatchId === w.id}
              onClick={() => setSelectedWatchId(w.id)}
            >
              <WatchName>
                {w.name}
                <StatusBadge $enabled={w.enabled}>{w.enabled ? 'ON' : 'OFF'}</StatusBadge>
              </WatchName>
              <WatchPath title={w.requestFile}>{w.requestFile}</WatchPath>
              <WatchActions>
                <SecondaryBtn onClick={e => { e.stopPropagation(); openEditModal(w); }}>Edit</SecondaryBtn>
                <SecondaryBtn onClick={e => { e.stopPropagation(); handleToggleWatch(w); }}>
                  {w.enabled ? 'Disable' : 'Enable'}
                </SecondaryBtn>
                <DangerBtn onClick={e => { e.stopPropagation(); handleDeleteWatch(w.id); }}>
                  Delete
                </DangerBtn>
              </WatchActions>
            </WatchItem>
          ))}
        </WatchList>
      </WatchSidebar>

      {/* ── Centre: Pair list ── */}
      <MainArea>
        <PairList>
          <PairListHeader>
            <h3>{selectedWatchName ?? 'All Pairs'}</h3>
            <SecondaryBtn onClick={handleClearPairs}>Clear</SecondaryBtn>
          </PairListHeader>
          <PairScroll>
            {visiblePairs.length === 0 ? (
              <EmptyState style={{ padding: '32px 16px' }}>
                <p>{watches.length === 0 ? 'Add a watch to start.' : 'Waiting for file changes…'}</p>
              </EmptyState>
            ) : (
              visiblePairs.map(pair => (
                <PairRow
                  key={pair.id}
                  $active={selectedPairId === pair.id}
                  onClick={() => setSelectedPairId(pair.id)}
                >
                  <PairRowHeader>
                    <OperationName title={pair.operationName}>
                      {pair.operationName ?? '(unknown operation)'}
                    </OperationName>
                    <MatchBadge $matched={pair.status === 'matched'}>
                      {pair.status === 'matched' ? 'Matched' : 'Pending'}
                    </MatchBadge>
                  </PairRowHeader>
                  <PairTime>{formatTime(pair.createdAt)}</PairTime>
                </PairRow>
              ))
            )}
          </PairScroll>
        </PairList>

        {/* ── Right: Detail panel ── */}
        <DetailPanel>
          {selectedPair ? (
            <>
              <DetailHeader>
                <DetailTitle>{selectedPair.operationName ?? '(unknown operation)'}</DetailTitle>
                <MatchBadge $matched={selectedPair.status === 'matched'}>
                  {selectedPair.status === 'matched' ? 'Matched' : 'Pending'}
                </MatchBadge>
                {selectedPair.status === 'matched' && (
                  <SuccessBtn onClick={() => handleCreateMockRule(selectedPair)}>
                    Create Mock Rule
                  </SuccessBtn>
                )}
              </DetailHeader>
              <DetailBody ref={detailBodyRef}>
                <EditorPanes
                  pair={selectedPair}
                  requestPanePx={effectiveRequestPx}
                  isDragging={isDragging}
                  onDividerMouseDown={handleDividerMouseDown}
                  editorSettings={editorSettings}
                  onSettingsChange={handleSettingsChange}
                  formatTime={formatTime}
                />
              </DetailBody>
            </>
          ) : (
            <EmptyState>
              <p>Select a pair to view request &amp; response</p>
            </EmptyState>
          )}
        </DetailPanel>
      </MainArea>

      {/* ── Condition Picker Modal ── */}
      {pickerPair && pickerPair.request && pickerPair.response && (
        <ConditionPickerModal
          suggestions={suggestConditionsFromSoapXml(
            pickerPair.request.content,
            pickerPair.operationName,
          )}
          onConfirm={async (conditions) => {
            const opName = pickerPair.operationName ?? 'UnknownOperation';
            try {
              await invokeTauriCommand('add_mock_rule', {
                rule: {
                  id: `mock-${Date.now()}`,
                  name: `${opName} (from file watcher)`,
                  enabled: true,
                  conditions,
                  statusCode: 200,
                  responseBody: pickerPair.response!.content,
                  delayMs: 0,
                }
              });
              setPickerPair(null);
              alert('Mock rule created!');
            } catch (err: any) {
              alert(`Failed to create mock rule: ${err}`);
            }
          }}
          onCancel={() => setPickerPair(null)}
        />
      )}

      {/* ── Add / Edit Watch Modal ── */}
      {showAddModal && (
        <Overlay onClick={() => setShowAddModal(false)}>
          <Modal onClick={e => e.stopPropagation()}>
            <ModalHeader>{editingWatch ? 'Edit Watch' : 'Add Watch'}</ModalHeader>
            <ModalBody>
              <FormGroup>
                <label>Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Booking Service"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                />
              </FormGroup>
              <FormGroup>
                <label>Request File *</label>
                <FileInput>
                  <input
                    type="text"
                    placeholder="e.g. C:\logs\request.xml or /tmp/request.xml"
                    value={formRequestFile}
                    onChange={e => setFormRequestFile(e.target.value)}
                  />
                  <BrowseBtn onClick={() => browseFile(setFormRequestFile)}>Browse…</BrowseBtn>
                </FileInput>
                <span className="hint">File where SOAP requests are written</span>
              </FormGroup>
              <FormGroup>
                <label>Response File *</label>
                <FileInput>
                  <input
                    type="text"
                    placeholder="e.g. C:\logs\response.xml or /tmp/response.xml"
                    value={formResponseFile}
                    onChange={e => setFormResponseFile(e.target.value)}
                  />
                  <BrowseBtn onClick={() => browseFile(setFormResponseFile)}>Browse…</BrowseBtn>
                </FileInput>
                <span className="hint">File where SOAP responses are written</span>
              </FormGroup>
              <FormGroup>
                <label>Correlation ID Elements <span style={{ color: tokens.text.hint, fontWeight: 400, textTransform: 'none' }}>(comma-separated)</span></label>
                <input
                  type="text"
                  value={formCorrElements}
                  onChange={e => setFormCorrElements(e.target.value)}
                />
                <span className="hint">SOAP header element names used as correlation IDs</span>
              </FormGroup>
            </ModalBody>
            <ModalFooter>
              <SecondaryBtn onClick={() => setShowAddModal(false)}>Cancel</SecondaryBtn>
              <PrimaryBtn onClick={handleSaveWatch}>
                {editingWatch ? 'Save' : 'Add Watch'}
              </PrimaryBtn>
            </ModalFooter>
          </Modal>
        </Overlay>
      )}
    </Container>
  );
};
