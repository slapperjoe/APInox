import React, { useState, useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import {
  MonacoRequestEditorWithToolbar,
  MonacoResponseViewer,
  MonacoResponseViewerWithToolbar,
  formatXml,
  formatJson,
  useEditorSettings,
} from '@apinox/request-editor';
import type { TrafficLog } from './TrafficViewer';
import { tokens } from './tokens';

// ── Types ──────────────────────────────────────────────────────────────────
type DetailView = 'body' | 'raw';

// ── Helpers ──────────────────────────────────────────────────────────────────
function methodBg(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':    return '#1a5c2a';
    case 'POST':   return '#1a3d5c';
    case 'PUT':    return '#5c4a1a';
    case 'PATCH':  return '#3d1a5c';
    case 'DELETE': return '#5c1a1a';
    default:       return '#3a3a3a';
  }
}

function statusStyle(status?: number) {
  if (!status) return { bg: 'rgba(60,60,60,0.2)', fg: tokens.text.muted, border: 'rgba(100,100,100,0.4)' };
  if (status < 300) return { bg: 'rgba(58,110,58,0.25)',  fg: '#89d185', border: 'rgba(58,110,58,0.5)' };
  if (status < 400) return { bg: 'rgba(14,99,156,0.25)',  fg: '#6db3e8', border: 'rgba(14,99,156,0.5)' };
  if (status < 500) return { bg: 'rgba(122,90,30,0.25)',  fg: '#ddb165', border: 'rgba(122,90,30,0.5)' };
  return                     { bg: 'rgba(156,14,14,0.25)', fg: '#f28b82', border: 'rgba(156,14,14,0.5)' };
}

function getLanguage(headers?: Record<string, string>): string {
  const ct = headers?.['content-type'] ?? headers?.['Content-Type'] ?? '';
  if (ct.includes('xml') || ct.includes('soap')) return 'xml';
  if (ct.includes('json')) return 'json';
  if (ct.includes('html')) return 'html';
  return 'text';
}

function formatBody(content: string | undefined, language: string, settings: { alignAttributes: boolean; inlineValues: boolean; hideCausality: boolean }): string {
  if (!content) return '';
  if (language === 'xml')  return formatXml(content, settings.alignAttributes, settings.inlineValues, settings.hideCausality);
  if (language === 'json') return formatJson(content);
  return content;
}

function getContentType(headers?: Record<string, string>): string | undefined {
  return headers?.['content-type'] ?? headers?.['Content-Type'];
}

// ── Styled components ────────────────────────────────────────────────────────
const Panel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  background: ${tokens.surface.base};
`;

const DetailHeader = styled.div`
  padding: 8px 14px;
  border-bottom: 1px solid ${tokens.border.default};
  display: flex;
  align-items: center;
  gap: 8px;
  background: ${tokens.surface.panel};
  flex-shrink: 0;
`;

const MethodBadge = styled.span`
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 3px;
  font-family: monospace;
  flex-shrink: 0;
  color: white;
`;

const UrlText = styled.div`
  flex: 1;
  font-size: 12px;
  color: ${tokens.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: monospace;
  min-width: 0;
`;

const StatusChip = styled.span`
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
`;

const DurationText = styled.span`
  font-size: 11px;
  color: ${tokens.text.muted};
  flex-shrink: 0;
  white-space: nowrap;
`;

const ViewTab = styled.button<{ $active: boolean }>`
  padding: 2px 9px;
  border: 1px solid ${p => p.$active ? tokens.status.accentDark : tokens.border.subtle};
  border-radius: 3px;
  background: ${p => p.$active ? tokens.status.accentDark : 'transparent'};
  color: ${p => p.$active ? 'white' : tokens.text.secondary};
  font-size: 11px;
  cursor: pointer;
  flex-shrink: 0;
  line-height: 1.6;
  &:hover { background: ${p => p.$active ? tokens.status.accentHover : tokens.surface.hover}; }
`;

const DetailBody = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const EditorPane = styled.div`
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
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 600;
  color: ${tokens.text.secondary};
  background: ${tokens.surface.panel};
  border-bottom: 1px solid ${tokens.border.default};
  flex-shrink: 0;
`;

const PaneMeta = styled.div`
  padding: 2px 14px;
  font-size: 10px;
  color: ${tokens.text.hint};
  background: ${tokens.surface.panel};
  border-bottom: 1px solid ${tokens.border.default};
  flex-shrink: 0;
`;

// ── Component ─────────────────────────────────────────────────────────────
interface TrafficDetailsProps {
  log: TrafficLog;
}

export function TrafficDetails({ log }: TrafficDetailsProps) {
  const [view, setView] = useState<DetailView>('body');
  const { settings, updateSettings } = useEditorSettings();
  const [isDragging, setIsDragging] = useState(false);
  const [userRequestPx, setUserRequestPx] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyHeight, setBodyHeight] = useState(0);

  // Reset split when switching to a different log entry
  useEffect(() => { setUserRequestPx(null); }, [log.id]);

  // Measure body height; keep live with ResizeObserver
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) { setBodyHeight(0); return; }
    setBodyHeight(el.getBoundingClientRect().height);
    const ro = new ResizeObserver(() => setBodyHeight(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const requestLang = getLanguage(log.requestHeaders);
  const responseLang = getLanguage(log.responseHeaders);
  const ss = statusStyle(log.status);
  const reqCT = getContentType(log.requestHeaders);
  const resCT = getContentType(log.responseHeaders);

  const formattedRequest  = formatBody(log.requestBody,  requestLang, settings);
  const formattedResponse = formatBody(log.responseBody, responseLang, settings);

  const LINE_HEIGHT = 19;
  const PANE_OVERHEAD = 101;
  const reqLineCount = formattedRequest ? formattedRequest.split('\n').length : 0;
  const naturalPx = (reqLineCount + 3) * LINE_HEIGHT + PANE_OVERHEAD;
  const calculatedPx = bodyHeight > 0 ? Math.min(naturalPx, bodyHeight * 0.5) : undefined;
  const effectivePx = userRequestPx ?? calculatedPx;

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startPx = effectivePx ?? 0;
    setIsDragging(true);
    const onMove = (ev: MouseEvent) => {
      const min = 60;
      const max = bodyHeight > 0 ? bodyHeight * 0.85 : 9999;
      setUserRequestPx(Math.max(min, Math.min(startPx + (ev.clientY - startY), max)));
    };
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [effectivePx, bodyHeight]);

  return (
    <Panel>
      <DetailHeader>
        <MethodBadge style={{ background: methodBg(log.method) }}>{log.method}</MethodBadge>
        <UrlText title={log.url}>{log.url}</UrlText>
        {log.status != null && (
          <StatusChip style={{ background: ss.bg, color: ss.fg, border: `1px solid ${ss.border}` }}>
            {log.status}
          </StatusChip>
        )}
        {log.duration != null && <DurationText>{log.duration}ms</DurationText>}
        <ViewTab $active={view === 'body'}    onClick={() => setView('body')}>Body</ViewTab>
        <ViewTab $active={view === 'raw'}     onClick={() => setView('raw')}>Raw</ViewTab>
      </DetailHeader>

      <DetailBody ref={bodyRef}>
        {view === 'body' && (
          <>
            <EditorPane style={effectivePx !== undefined ? { flex: `0 0 ${effectivePx}px` } : { flex: 1 }}>
              <PaneLabel>Request</PaneLabel>
              {reqCT && <PaneMeta>{reqCT}</PaneMeta>}
              <MonacoRequestEditorWithToolbar
                value={formattedRequest}
                onChange={() => {}}
                language={requestLang}
                readOnly
                requestId={log.id}
                headers={log.requestHeaders}
                initialSettings={settings}
                onSettingsChange={updateSettings}
              />
            </EditorPane>
            <SplitDivider $dragging={isDragging} onMouseDown={handleDividerMouseDown} />
            <EditorPane style={{ flex: 1, minHeight: 0 }}>
              <PaneLabel>Response</PaneLabel>
              {resCT && <PaneMeta>{resCT}</PaneMeta>}
              <MonacoResponseViewerWithToolbar
                value={formattedResponse}
                language={responseLang}
                showLineNumbers={settings.showLineNumbers}
                showMinimap={settings.showMinimap}
                fontSize={settings.fontSize}
                fontFamily={settings.fontFamily}
                headers={log.responseHeaders}
              />
            </EditorPane>
          </>
        )}

        {view === 'raw' && (
          <MonacoResponseViewer
            value={JSON.stringify(log, null, 2)}
            language="json"
            showLineNumbers={settings.showLineNumbers}
            showMinimap={settings.showMinimap}
            fontSize={settings.fontSize}
            fontFamily={settings.fontFamily}
          />
        )}
      </DetailBody>
    </Panel>
  );
}
