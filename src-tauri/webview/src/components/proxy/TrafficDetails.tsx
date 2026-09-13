import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import {
  formatXml,
  formatJson,
  useEditorSettings,
} from '@apinox/request-editor/core';
import {
  MonacoRequestEditorWithToolbar,
  MonacoResponseViewer,
  MonacoResponseViewerWithToolbar,
} from '@apinox/request-editor/monaco';
import type { TrafficLog } from './TrafficViewer';
import { tokens } from './tokens';
import { methodBg, statusStyle, languageFromContentType } from './trafficStyles';
import { EditorPane, SplitDivider, naturalPanePx, useSplitPaneDrag } from './splitPane';

// ── Types ──────────────────────────────────────────────────────────────────
type DetailView = 'body' | 'raw';

// ── Helpers ──────────────────────────────────────────────────────────────────
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
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyHeight, setBodyHeight] = useState(0);

  const {
    isDragging,
    userPx: userRequestPx,
    setUserPx: setUserRequestPx,
    handleDividerMouseDown,
  } = useSplitPaneDrag(bodyHeight);

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

  const requestLang = languageFromContentType(log.requestHeaders);
  const responseLang = languageFromContentType(log.responseHeaders);
  const ss = statusStyle(log.status);
  const reqCT = getContentType(log.requestHeaders);
  const resCT = getContentType(log.responseHeaders);

  const formattedRequest  = formatBody(log.requestBody,  requestLang, settings);
  const formattedResponse = formatBody(log.responseBody, responseLang, settings);

  const reqLineCount = formattedRequest ? formattedRequest.split('\n').length : 0;
  const calculatedPx = naturalPanePx(reqLineCount, bodyHeight, 0.5);
  const effectivePx = userRequestPx ?? calculatedPx;

  return (
    <Panel>
      <DetailHeader>
        <MethodBadge style={{ background: methodBg(log.method).bg, color: methodBg(log.method).fg }}>{log.method}</MethodBadge>
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
                key={log.id}
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
            <SplitDivider $dragging={isDragging} onMouseDown={(e) => handleDividerMouseDown(e, effectivePx ?? 0)} />
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
