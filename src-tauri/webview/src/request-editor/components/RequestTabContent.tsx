import React, { useCallback, useRef, useEffect, memo } from 'react';
import * as S from './RequestWorkspace.styles';
import { EmptyState } from './common/EmptyState';
import { MonacoRequestEditor } from './MonacoRequestEditor';
import { HeadersPanel } from './HeadersPanel';
import { AssertionsPanel } from './AssertionsPanel';
import { ExtractorsPanel } from './ExtractorsPanel';
import { QueryParamsPanel } from './QueryParamsPanel';
import { SecurityPanel } from './SecurityPanel';
import { AttachmentsPanel } from './AttachmentsPanel';
import { FormDataPanel } from './FormDataPanel';
import { BinaryBodyPanel } from './BinaryBodyPanel';
import type { FormField, BinaryFile, EditorVariable } from '../types';
import { useEditorSettings } from '../contexts/EditorSettingsContext';
import type { MonacoRequestEditorHandle } from './MonacoRequestEditor';
import type { ExtraTab } from './MonacoRequestEditorWithToolbar';

type BuiltinTabType = 'request' | 'headers' | 'params' | 'assertions' | 'extractors' | 'auth' | 'attachments' | 'variables';
export type TabType = BuiltinTabType | string;

interface ApiRequest {
  id?: string;
  name: string;
  requestType: 'soap' | 'rest' | 'graphql';
  method: string;
  endpoint: string;
  bodyType?: 'xml' | 'json' | 'text' | 'graphql' | 'form-data' | 'binary' | 'none';
  contentType?: string;
  request: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  graphqlConfig?: { variables?: Record<string, any>; operationName?: string };
  assertions?: any[];
  extractors?: any[];
  wsSecurity?: any;
  attachments?: any[];
  formFields?: FormField[];
  binaryFile?: BinaryFile;
}

interface Variable {
  name: string;
  value: string | null;
  source: string;
}

export interface RequestTabContentProps {
  activeTab: TabType;
  request: ApiRequest;
  onUpdateRequest: (updated: ApiRequest) => void;
  readOnly: boolean;
  /** Whether the Content-Type header row is locked (default `true`). */
  contentTypeLocked?: boolean;
  availableVariables: Variable[];
  /** Environment/global variables, forwarded to the panels for {{...}} tooltips. */
  availableEnvVariables?: EditorVariable[];
  requestEditorRef: React.RefObject<MonacoRequestEditorHandle>;
  editorForceUpdateKey: number;
  onLog?: (message: string, level?: 'info' | 'warn' | 'error' | 'debug') => void;
  onPickFile?: () => Promise<{ name: string; content: string; contentType: string; size: number } | null>;
  extraTabs: ExtraTab[];
}

const RequestTabContentBase: React.FC<RequestTabContentProps> = ({
  activeTab,
  request,
  onUpdateRequest,
  readOnly,
  contentTypeLocked = true,
  availableVariables,
  availableEnvVariables,
  requestEditorRef,
  editorForceUpdateKey,
  onLog,
  onPickFile,
  extraTabs,
}) => {
  const editorSettings = useEditorSettings();

  // Stable handlers (review item 3): read the latest request through a ref so
  // the callback identity does not change on every keystroke. Combined with the
  // memoized panels, this lets unchanged panels skip re-render.
  // Synced in an effect rather than during render — writing refs in the render
  // phase is unsafe under concurrent rendering and StrictMode double-invocation.
  const requestRef = useRef(request);
  const onUpdateRef = useRef(onUpdateRequest);
  useEffect(() => { requestRef.current = request; }, [request]);
  useEffect(() => { onUpdateRef.current = onUpdateRequest; }, [onUpdateRequest]);

  const handleBodyChange = useCallback((value: string) => {
    onUpdateRef.current({ ...requestRef.current, request: value });
  }, []);
  const handleFormFieldsChange = useCallback((fields: FormField[]) => {
    onUpdateRef.current({ ...requestRef.current, formFields: fields });
  }, []);
  const handleBinaryChange = useCallback((file: BinaryFile | null) => {
    onUpdateRef.current({ ...requestRef.current, binaryFile: file ?? undefined });
  }, []);
  const handleGraphqlVarsChange = useCallback((vars: Record<string, string>) => {
    const req = requestRef.current;
    onUpdateRef.current({ ...req, graphqlConfig: { ...req.graphqlConfig, variables: vars } });
  }, []);
  const handleHeadersChange = useCallback((headers: Record<string, string>) => {
    onUpdateRef.current({ ...requestRef.current, headers });
  }, []);
  const handleParamsChange = useCallback((params: Record<string, string>) => {
    onUpdateRef.current({ ...requestRef.current, queryParams: params });
  }, []);
  const handleAssertionsChange = useCallback((assertions: any[]) => {
    onUpdateRef.current({ ...requestRef.current, assertions });
  }, []);
  const handleExtractorsChange = useCallback((extractors: any[]) => {
    onUpdateRef.current({ ...requestRef.current, extractors });
  }, []);
  const handleAuthChange = useCallback((security: any) => {
    onUpdateRef.current({ ...requestRef.current, wsSecurity: security });
  }, []);
  const handleAttachmentsChange = useCallback((attachments: any[]) => {
    onUpdateRef.current({ ...requestRef.current, attachments });
  }, []);

  switch (activeTab) {
    case 'request': {
      if (request.bodyType === 'form-data') {
        return (
          <FormDataPanel
            fields={request.formFields || []}
            onChange={handleFormFieldsChange}
            enctype={
              (request.contentType === 'application/x-www-form-urlencoded' ||
                request.contentType === 'multipart/form-data')
                ? request.contentType
                : 'multipart/form-data'
            }
            availableVariables={availableVariables}
            availableEnvVariables={availableEnvVariables}
            onPickFile={onPickFile}
          />
        );
      }

      if (request.bodyType === 'binary') {
        return (
          <BinaryBodyPanel
            file={request.binaryFile ?? null}
            onChange={handleBinaryChange}
            onPickFile={onPickFile}
          />
        );
      }

      if (request.bodyType === 'none') {
        return (
          <EmptyState title="No request body for this request type" />
        );
      }

      const editorLanguage =
        request.bodyType === 'json' ? 'json' :
        request.bodyType === 'graphql' ? 'graphql' :
        'xml';

      if (request.bodyType === 'graphql') {
        const graphqlVars: Record<string, string> = (() => {
          const raw = request.graphqlConfig?.variables;
          if (!raw) return {};
          return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v ?? '')]));
        })();

        return (
          <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            <div style={{ flex: '0 0 67%', minWidth: 0, borderRight: '1px solid var(--apinox-widget-border)', overflow: 'hidden' }}>
              <MonacoRequestEditor
                ref={requestEditorRef}
                value={request.request || ''}
                onChange={handleBodyChange}
                language="graphql"
                readOnly={readOnly}
                availableVariables={availableVariables}
                availableEnvVariables={availableEnvVariables}
                requestId={request.id || request.name}
                fontSize={editorSettings.settings.fontSize}
                fontFamily={editorSettings.settings.fontFamily}
                showLineNumbers={editorSettings.settings.showLineNumbers}
                showMinimap={editorSettings.settings.showMinimap}
                forceUpdateKey={editorForceUpdateKey}
                onLog={onLog}
              />
            </div>
            <div style={{ flex: '0 0 33%', minWidth: 0, overflow: 'hidden' }}>
              <QueryParamsPanel
                params={graphqlVars}
                onChange={handleGraphqlVarsChange}
                title="Variables"
                paramLabel="Variable"
                readOnly={readOnly}
                availableVariables={availableVariables}
                availableEnvVariables={availableEnvVariables}
              />
            </div>
          </div>
        );
      }

      return (
        <MonacoRequestEditor
          ref={requestEditorRef}
          value={request.request || ''}
          onChange={handleBodyChange}
          language={editorLanguage}
          readOnly={readOnly}
          availableVariables={availableVariables}
          availableEnvVariables={availableEnvVariables}
          requestId={request.id || request.name}
          fontSize={editorSettings.settings.fontSize}
          fontFamily={editorSettings.settings.fontFamily}
          showLineNumbers={editorSettings.settings.showLineNumbers}
          showMinimap={editorSettings.settings.showMinimap}
          forceUpdateKey={editorForceUpdateKey}
          onLog={onLog}
        />
      );
    }

    case 'headers':
      return readOnly && request.headers ? (
        <S.HeadersViewer>
          {Object.entries(request.headers).map(([key, value]) => (
            <S.HeadersRow key={key}>
              <S.HeadersKey>{key}</S.HeadersKey>
              <S.HeadersValue>{value}</S.HeadersValue>
            </S.HeadersRow>
          ))}
        </S.HeadersViewer>
      ) : (
        <HeadersPanel
          headers={request.headers || {}}
          onChange={handleHeadersChange}
          contentType={request.contentType}
          contentTypeLocked={contentTypeLocked}
          onContentTypeChange={handleHeadersChange}
          availableVariables={availableVariables}
          availableEnvVariables={availableEnvVariables}
        />
      );

    case 'params':
      return (
        <QueryParamsPanel
          params={request.queryParams || {}}
          onChange={handleParamsChange}
          availableVariables={availableVariables}
          availableEnvVariables={availableEnvVariables}
        />
      );

    case 'assertions':
      return (
        <AssertionsPanel
          assertions={request.assertions || []}
          onChange={handleAssertionsChange}
        />
      );

    case 'extractors':
      return (
        <ExtractorsPanel
          extractors={request.extractors || []}
          onChange={handleExtractorsChange}
        />
      );

    case 'auth':
      return (
        <SecurityPanel
          security={request.wsSecurity}
          onChange={handleAuthChange}
        />
      );

    case 'attachments':
      return (
        <AttachmentsPanel
          attachments={request.attachments || []}
          onChange={handleAttachmentsChange}
        />
      );

    case 'variables':
      return (
        <S.PanelContent>
          {availableVariables.length === 0 ? (
            <S.StatText>No variables available</S.StatText>
          ) : (
            availableVariables.map((v) => (
              <S.HeadersRow key={v.name}>
                <S.HeadersKey>${'{' + v.name + '}'}</S.HeadersKey>
                <S.HeadersValue>{v.value || '(not yet extracted)'}</S.HeadersValue>
              </S.HeadersRow>
            ))
          )}
        </S.PanelContent>
      );

    default: {
      const extra = extraTabs.find(t => t.id === activeTab);
      return extra ? extra.render() : null;
    }
  }
};

// Perf (review item 3): memoize so parent re-renders that do not change the
// active tab or request skip the panel subtree.
export const RequestTabContent = memo(RequestTabContentBase);
