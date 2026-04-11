import React from 'react';
import * as S from './RequestWorkspace.styles';
import { MonacoRequestEditor } from './MonacoRequestEditor';
import { HeadersPanel } from './HeadersPanel';
import { AssertionsPanel } from './AssertionsPanel';
import { ExtractorsPanel } from './ExtractorsPanel';
import { QueryParamsPanel } from './QueryParamsPanel';
import { SecurityPanel } from './SecurityPanel';
import { AttachmentsPanel } from './AttachmentsPanel';
import { FormDataPanel } from './FormDataPanel';
import { BinaryBodyPanel } from './BinaryBodyPanel';
import type { FormField, BinaryFile } from '../types';
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
  availableVariables: Variable[];
  requestEditorRef: React.RefObject<MonacoRequestEditorHandle>;
  editorForceUpdateKey: number;
  onLog?: (message: string, level?: 'info' | 'warn' | 'error' | 'debug') => void;
  onPickFile?: () => Promise<{ name: string; content: string; contentType: string; size: number } | null>;
  extraTabs: ExtraTab[];
}

export const RequestTabContent: React.FC<RequestTabContentProps> = ({
  activeTab,
  request,
  onUpdateRequest,
  readOnly,
  availableVariables,
  requestEditorRef,
  editorForceUpdateKey,
  onLog,
  onPickFile,
  extraTabs,
}) => {
  const editorSettings = useEditorSettings();

  switch (activeTab) {
    case 'request': {
      if (request.bodyType === 'form-data') {
        return (
          <FormDataPanel
            fields={request.formFields || []}
            onChange={(fields) => onUpdateRequest({ ...request, formFields: fields })}
            enctype={
              (request.contentType === 'application/x-www-form-urlencoded' ||
                request.contentType === 'multipart/form-data')
                ? request.contentType
                : 'multipart/form-data'
            }
            onPickFile={onPickFile}
          />
        );
      }

      if (request.bodyType === 'binary') {
        return (
          <BinaryBodyPanel
            file={request.binaryFile ?? null}
            onChange={(file) => onUpdateRequest({ ...request, binaryFile: file ?? undefined })}
            onPickFile={onPickFile}
          />
        );
      }

      if (request.bodyType === 'none') {
        return (
          <S.EmptyState>
            <S.EmptyStateText>No request body for this request type</S.EmptyStateText>
          </S.EmptyState>
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
                onChange={(value) => onUpdateRequest({ ...request, request: value })}
                language="graphql"
                readOnly={readOnly}
                availableVariables={availableVariables}
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
                onChange={(vars) => onUpdateRequest({
                  ...request,
                  graphqlConfig: { ...request.graphqlConfig, variables: vars },
                })}
                title="Variables"
                paramLabel="Variable"
                readOnly={readOnly}
              />
            </div>
          </div>
        );
      }

      return (
        <MonacoRequestEditor
          ref={requestEditorRef}
          value={request.request || ''}
          onChange={(value) => onUpdateRequest({ ...request, request: value })}
          language={editorLanguage}
          readOnly={readOnly}
          availableVariables={availableVariables}
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
          onChange={(headers) => onUpdateRequest({ ...request, headers })}
        />
      );

    case 'params':
      return (
        <QueryParamsPanel
          params={request.queryParams || {}}
          onChange={(params) => onUpdateRequest({ ...request, queryParams: params })}
        />
      );

    case 'assertions':
      return (
        <AssertionsPanel
          assertions={request.assertions || []}
          onChange={(assertions) => onUpdateRequest({ ...request, assertions })}
        />
      );

    case 'extractors':
      return (
        <ExtractorsPanel
          extractors={request.extractors || []}
          onChange={(extractors) => onUpdateRequest({ ...request, extractors })}
        />
      );

    case 'auth':
      return (
        <SecurityPanel
          security={request.wsSecurity}
          onChange={(security) => onUpdateRequest({ ...request, wsSecurity: security })}
        />
      );

    case 'attachments':
      return (
        <AttachmentsPanel
          attachments={request.attachments || []}
          onChange={(attachments) => onUpdateRequest({ ...request, attachments })}
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
