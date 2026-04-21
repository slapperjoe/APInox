import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Play, X, Variable, Settings, Braces, Minus } from 'lucide-react';
import * as S from './RequestWorkspace.styles';
import { MonacoResponseViewer } from './MonacoResponseViewer';
import { MonacoSingleLineInput } from './MonacoSingleLineInput';
import type { MonacoSingleLineInputHandle } from './MonacoSingleLineInput';
import type { MonacoRequestEditorHandle } from './MonacoRequestEditor';
import type { FormField, BinaryFile } from '../types';
import { XPathGenerator } from '../utils/xpathGenerator';
import { useEditorSettings, EditorSettingsProvider } from '../contexts/EditorSettingsContext';
import { formatXml } from '../utils/xmlFormatter';
import { formatContent } from '../utils/contentFormatter';
import { RequestTypeSelector } from './RequestTypeSelector';
import { RequestTypeBadge, MethodBadge, BodyTypeBadge, ContentTypeBadge, BadgeGroup } from './RequestTypeBadges';
import type { RequestType, BodyType, HttpMethod } from '../types';
import { getInstalledFonts, type MonoFont } from '../utils/fontDetection';
import type { ExtraTab } from './MonacoRequestEditorWithToolbar';
import { EditorSettingsMenu } from './EditorSettingsMenu';
import { RequestTabContent } from './RequestTabContent';

// Types
export interface ApiRequest {
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

export interface ExecutionResponse {
  rawResponse?: string;
  status?: number;
  statusText?: string;
  time?: number;
  size?: number;
  headers?: Record<string, string>;
  contentType?: string;
}

export interface Variable {
  name: string;
  value: string | null;
  source: string;
}

export interface RequestWorkspaceProps {
  // Request data
  request: ApiRequest;
  response?: ExecutionResponse;
  loading?: boolean;

  // Callbacks
  onUpdateRequest: (updated: ApiRequest) => void;
  onExecute: () => void;
  onCancel?: () => void;
  onReset?: () => void;

  // Configuration
  readOnly?: boolean;
  defaultEndpoint?: string;
  availableVariables?: Variable[];

  // Display options
  showBreadcrumb?: boolean;
  breadcrumbPath?: string[];

  // Layout persistence
  initialLayoutMode?: 'vertical' | 'horizontal';
  /** When provided, overrides internal layout state (e.g. force vertical on mobile) */
  layoutMode?: 'vertical' | 'horizontal';
  onLayoutModeChange?: (mode: 'vertical' | 'horizontal') => void;

  // Event handlers for response actions
  onCreateExtractor?: (xpath: string, value: string) => void;
  onCreateAssertion?: (xpath: string, value: string) => void;
  onCreateExistenceAssertion?: (xpath: string) => void;

  // Logging callback (replaces direct bridge.sendMessage)
  onLog?: (message: string, level?: 'info' | 'warn' | 'error' | 'debug') => void;

  // Editor settings (for persistence)
  initialEditorSettings?: Partial<{
    fontSize: number;
    fontFamily: string;
    showLineNumbers: boolean;
    alignAttributes: boolean;
    inlineValues: boolean;
    hideCausality: boolean;
  }>;
  onEditorSettingsChange?: (settings: {
    fontSize: number;
    fontFamily: string;
    showLineNumbers: boolean;
    alignAttributes: boolean;
    inlineValues: boolean;
    hideCausality: boolean;
  }) => void;
  
  // File picker callbacks for form-data and binary uploads
  onPickFile?: () => Promise<{ name: string; content: string; contentType: string; size: number } | null>;

  /** Additional tabs injected by the parent, rendered after the built-in tabs */
  extraTabs?: ExtraTab[];
}

type BuiltinTabType = 'request' | 'headers' | 'params' | 'assertions' | 'extractors' | 'auth' | 'attachments' | 'variables';
type TabType = BuiltinTabType | string;

// Internal component that uses the context
const RequestWorkspaceInternal: React.FC<RequestWorkspaceProps> = ({
  request,
  response,
  loading = false,
  onUpdateRequest,
  onExecute,
  onCancel,
  onReset: _onReset,
  readOnly = false,
  defaultEndpoint,
  availableVariables = [],
  showBreadcrumb = false,
  breadcrumbPath = [],
  onCreateExtractor,
  onCreateAssertion,
  onCreateExistenceAssertion,
  onLog,
  onPickFile,
  initialLayoutMode,
  layoutMode: controlledLayoutMode,
  onLayoutModeChange,
  extraTabs = [],
}) => {
  // Editor settings from context
  const editorSettings = useEditorSettings();
  
  // State
  const [activeTab, setActiveTab] = useState<TabType>(() =>
    request.bodyType === 'none' ? 'params' : 'request'
  );
  const [showVariables, setShowVariables] = useState(false);
  const [showEditorSettings, setShowEditorSettings] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number; maxHeight: number } | null>(null);
  const [layoutMode, setLayoutMode] = useState<'vertical' | 'horizontal'>(controlledLayoutMode ?? initialLayoutMode ?? 'vertical');

  // Sync controlled layoutMode prop (e.g. forced vertical on mobile)
  useEffect(() => {
    if (controlledLayoutMode !== undefined) {
      setLayoutMode(controlledLayoutMode);
    }
  }, [controlledLayoutMode]);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isResizing, setIsResizing] = useState(false);
  const [selection, setSelection] = useState<{ text: string; offset: number } | null>(null);
  const [currentXPath, setCurrentXPath] = useState<string | null>(null);
  const [editorForceUpdateKey, setEditorForceUpdateKey] = useState(0);
  const [installedFonts, setInstalledFonts] = useState<MonoFont[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs
  const urlInputRef = useRef<MonacoSingleLineInputHandle>(null);
  const requestEditorRef = useRef<MonacoRequestEditorHandle>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Calculate menu position when opening
  const handleToggleSettings = useCallback(() => {
    if (!showEditorSettings && settingsButtonRef.current) {
      const rect = settingsButtonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 4 - 16; // available px below button
      setMenuPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
        maxHeight: Math.max(200, spaceBelow) // at least 200px, capped to available space
      });
    }
    setShowEditorSettings(!showEditorSettings);
  }, [showEditorSettings]);

  // Close settings menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setShowEditorSettings(false);
      }
    };
    if (showEditorSettings) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEditorSettings]);

  // When switching to a request with no body, jump to Params tab
  useEffect(() => {
    if (request.bodyType === 'none') {
      setActiveTab(prev => prev === 'request' ? 'params' : prev);
    }
  }, [request.id, request.bodyType]);

  // Detect installed fonts on mount
  useEffect(() => {
    const fonts = getInstalledFonts();
    setInstalledFonts(fonts);
  }, []);

  // Elapsed request timer — runs while loading is true, resets on each new request
  useEffect(() => {
    if (loading) {
      setElapsedMs(0);
      timerRef.current = setInterval(() => {
        setElapsedMs(prev => prev + 100);
      }, 100);
    } else {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [loading]);

  // Handle response selection for XPath generation
  useEffect(() => {
    if (selection && response?.rawResponse) {
      const path = XPathGenerator.getPath(response.rawResponse, selection.offset);
      setCurrentXPath(path);
    } else {
      setCurrentXPath(null);
    }
  }, [selection, response]);

  // Handle request type/method/body type changes
  const handleRequestTypeChange = useCallback((type: RequestType) => {
    // Update request type and set default body type
    const defaultBodyType: BodyType = 
      type === 'graphql' ? 'graphql' :
      type === 'rest' ? 'json' : 
      'xml';
    
    const defaultMethod = type === 'soap' ? 'POST' : 'GET';
    
    onUpdateRequest({
      ...request,
      requestType: type,
      bodyType: defaultBodyType,
      method: defaultMethod
    });
  }, [request, onUpdateRequest]);

  const handleBodyTypeChange = useCallback((bodyType: BodyType) => {
    onUpdateRequest({ ...request, bodyType });
  }, [request, onUpdateRequest]);

  const handleMethodChange = useCallback((method: HttpMethod | string) => {
    onUpdateRequest({ ...request, method });
  }, [request, onUpdateRequest]);

  const handleContentTypeChange = useCallback((contentType: string) => {
    onUpdateRequest({ ...request, contentType });
  }, [request, onUpdateRequest]);

  // Handle variable insertion
  const handleInsertVariable = useCallback((varName: string) => {
    if (urlInputRef.current) {
      urlInputRef.current.insertText(`\${${varName}}`);
    }
    setShowVariables(false);
  }, []);

  // Handle response actions
  const handleExtract = useCallback(() => {
    if (currentXPath && selection && onCreateExtractor) {
      onCreateExtractor(currentXPath, selection.text);
    }
  }, [currentXPath, selection, onCreateExtractor]);

  const handleMatch = useCallback(() => {
    if (currentXPath && selection && onCreateAssertion) {
      onCreateAssertion(currentXPath, selection.text);
    }
  }, [currentXPath, selection, onCreateAssertion]);

  const handleExists = useCallback(() => {
    if (currentXPath && onCreateExistenceAssertion) {
      onCreateExistenceAssertion(currentXPath);
    }
  }, [currentXPath, onCreateExistenceAssertion]);

  // Handle layout toggle
  const handleToggleLayout = useCallback(() => {
    setLayoutMode(prev => {
      const next = prev === 'vertical' ? 'horizontal' : 'vertical';
      onLayoutModeChange?.(next);
      return next;
    });
  }, [onLayoutModeChange]);

  // Handle split view resizing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = resizerRef.current?.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      let newRatio;

      if (layoutMode === 'vertical') {
        newRatio = (e.clientX - rect.left) / rect.width;
      } else {
        newRatio = (e.clientY - rect.top) / rect.height;
      }

      setSplitRatio(Math.max(0.2, Math.min(0.8, newRatio)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, layoutMode]);

  const handleFormatXml = useCallback(() => {
    const currentValue = requestEditorRef.current?.getValue() || request.request || '';
    const formatted = formatXml(
      currentValue,
      editorSettings.settings.alignAttributes,
      editorSettings.settings.inlineValues,
      editorSettings.settings.hideCausality
    );
    onUpdateRequest({ ...request, request: formatted });
    setEditorForceUpdateKey(prev => prev + 1);
    setShowEditorSettings(false);
  }, [editorSettings.settings, request, onUpdateRequest]);

  const handleTogglePrettyPrint = useCallback(() => {
    editorSettings.togglePrettyPrint();
    const newPrettyPrint = !editorSettings.settings.prettyPrint;
    if (request.request && request.bodyType) {
      const language = request.bodyType === 'json' ? 'json'
        : request.bodyType === 'xml' ? 'xml'
        : request.bodyType === 'graphql' ? 'graphql'
        : 'text';
      const formatted = formatContent(request.request, language, editorSettings.settings, newPrettyPrint);
      if (formatted !== request.request) {
        onUpdateRequest({ ...request, request: formatted });
      }
    }
    setEditorForceUpdateKey(prev => prev + 1);
  }, [editorSettings, onUpdateRequest, request]);

  // Re-format the request body when XML formatting settings change, so the request
  // editor stays in sync with the response viewer (which already re-renders inline).
  useEffect(() => {
    if (activeTab !== 'request' || request.bodyType !== 'xml' || !request.request) return;
    const current = requestEditorRef.current?.getValue() || request.request;
    const formatted = formatXml(
      current,
      editorSettings.settings.alignAttributes,
      editorSettings.settings.inlineValues,
      editorSettings.settings.hideCausality,
    );
    if (formatted !== current) {
      onUpdateRequest({ ...request, request: formatted });
      setEditorForceUpdateKey(prev => prev + 1);
    }
  // Only run when formatting settings change, not on every request or tab change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorSettings.settings.alignAttributes, editorSettings.settings.inlineValues, editorSettings.settings.hideCausality]);

  return (
    <S.RequestWorkspaceContainer>
      {/* Breadcrumb */}
      {showBreadcrumb && breadcrumbPath.length > 0 && (
        <S.BreadcrumbBar>
          {breadcrumbPath.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && ' / '}
              {i === breadcrumbPath.length - 1 ? (
                <S.BreadcrumbActive>{item}</S.BreadcrumbActive>
              ) : (
                <span>{item}</span>
              )}
            </React.Fragment>
          ))}
        </S.BreadcrumbBar>
      )}

      {/* Toolbar */}
      <S.Toolbar>
        {/* Request Type / Method / Body Type Controls */}
        {readOnly ? (
          // Read-only badges
          <BadgeGroup>
            <RequestTypeBadge type={request.requestType || 'soap'} />
            <MethodBadge method={request.method || 'POST'} />
            {request.requestType === 'soap' && request.contentType && (
              <ContentTypeBadge contentType={request.contentType} />
            )}
            {request.requestType === 'rest' && request.bodyType && (
              <BodyTypeBadge bodyType={request.bodyType} />
            )}
          </BadgeGroup>
        ) : (
          // Editable selectors
          <RequestTypeSelector
            requestType={request.requestType || 'soap'}
            bodyType={request.bodyType}
            method={(request.method || 'POST') as HttpMethod}
            contentType={request.contentType || 'application/soap+xml'}
            onRequestTypeChange={handleRequestTypeChange}
            onBodyTypeChange={handleBodyTypeChange}
            onMethodChange={handleMethodChange}
            onContentTypeChange={handleContentTypeChange}
            readOnly={false}
            compact={true}
          />
        )}

        {/* URL Input */}
        <S.UrlInputWrapper>
          <MonacoSingleLineInput
            ref={urlInputRef}
            value={request.endpoint || defaultEndpoint || ''}
            onChange={(value) => onUpdateRequest({ ...request, endpoint: value })}
            placeholder="Enter endpoint URL..."
            readOnly={readOnly}
          />
        </S.UrlInputWrapper>

        {/* Run Button - Show for all requests including readonly */}
        {loading ? (
          <>
            <S.ElapsedTime>{(elapsedMs / 1000).toFixed(1)}s</S.ElapsedTime>
            <S.CancelButton $variant="danger" onClick={onCancel}>
              <X />
              Cancel
            </S.CancelButton>
          </>
        ) : (
          <S.RunButton $variant="primary" onClick={onExecute}>
            <Play />
            RUN
          </S.RunButton>
        )}

        {/* Variables Dropdown */}
        {availableVariables.length > 0 && (
          <S.VariablesWrapper>
            <S.VariablesLabel onClick={() => setShowVariables(!showVariables)}>
              <Variable />
              Variables
            </S.VariablesLabel>
            {showVariables && (
              <S.VariablesDropdown>
                <S.VariablesDropdownHeader>Available Variables</S.VariablesDropdownHeader>
                {availableVariables.length === 0 ? (
                  <S.VariablesDropdownEmpty>No variables available</S.VariablesDropdownEmpty>
                ) : (
                  availableVariables.map((v) => (
                    <S.VariablesDropdownItem
                      key={v.name}
                      onClick={() => handleInsertVariable(v.name)}
                    >
                      <S.VariablesDropdownName>${'{' + v.name + '}'}</S.VariablesDropdownName>
                      <S.VariablesDropdownSource>{v.source}</S.VariablesDropdownSource>
                    </S.VariablesDropdownItem>
                  ))
                )}
              </S.VariablesDropdown>
            )}
          </S.VariablesWrapper>
        )}
      </S.Toolbar>

      {/* Tabs */}
      <S.TabsHeader>
        {request.bodyType !== 'none' && (
          <S.TabButton $active={activeTab === 'request'} onClick={() => setActiveTab('request')}>
            Body
          </S.TabButton>
        )}
        <S.TabButton $active={activeTab === 'headers'} onClick={() => setActiveTab('headers')}>
          Headers
          {request.headers && Object.keys(request.headers).length > 0 && (
            <S.TabMeta>{Object.keys(request.headers).length}</S.TabMeta>
          )}
        </S.TabButton>
        <S.TabButton $active={activeTab === 'params'} onClick={() => setActiveTab('params')}>
          Params
          {request.queryParams && Object.keys(request.queryParams).length > 0 && (
            <S.TabMeta>{Object.keys(request.queryParams).length}</S.TabMeta>
          )}
        </S.TabButton>
        <S.TabButton $active={activeTab === 'assertions'} onClick={() => setActiveTab('assertions')}>
          Assertions
          {request.assertions && request.assertions.length > 0 && (
            <S.TabMeta>{request.assertions.length}</S.TabMeta>
          )}
        </S.TabButton>
        <S.TabButton $active={activeTab === 'extractors'} onClick={() => setActiveTab('extractors')}>
          Extractors
          {request.extractors && request.extractors.length > 0 && (
            <S.TabMeta>{request.extractors.length}</S.TabMeta>
          )}
        </S.TabButton>
        <S.TabButton $active={activeTab === 'auth'} onClick={() => setActiveTab('auth')}>
          Auth
        </S.TabButton>
        <S.TabButton $active={activeTab === 'attachments'} onClick={() => setActiveTab('attachments')}>
          Attachments
        </S.TabButton>
        {availableVariables.length > 0 && (
          <S.TabButton $active={activeTab === 'variables'} onClick={() => setActiveTab('variables')}>
            Variables
            <S.TabMeta>{availableVariables.length}</S.TabMeta>
          </S.TabButton>
        )}
        {extraTabs.map(tab => (
          <S.TabButton key={tab.id} $active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <S.TabMeta>{tab.badge}</S.TabMeta>
            )}
          </S.TabButton>
        ))}
        <S.TabsRight>
          {activeTab === 'request' && (
            <S.CompactIconButton
              title={editorSettings.settings.prettyPrint ? 'Minify (Compress)' : 'Pretty Print (Format)'}
              onClick={handleTogglePrettyPrint}
            >
              {editorSettings.settings.prettyPrint ? <Minus size={14} /> : <Braces size={14} />}
            </S.CompactIconButton>
          )}
          <S.SettingsMenuWrapper>
            <S.CompactIconButton
              ref={settingsButtonRef}
              title="Editor Settings"
              onClick={handleToggleSettings}
              className={showEditorSettings ? 'active' : ''}
            >
              <Settings size={14} />
            </S.CompactIconButton>
          </S.SettingsMenuWrapper>
        </S.TabsRight>
      </S.TabsHeader>

      {/* Content Area (Split View) */}
      <S.ContentArea>
        <S.EditorSplitContainer $layoutMode={layoutMode}>
          {/* Request Pane */}
          <S.RequestPane $ratio={response ? splitRatio : 1}>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <RequestTabContent
                activeTab={activeTab}
                request={request}
                onUpdateRequest={onUpdateRequest}
                readOnly={readOnly}
                availableVariables={availableVariables}
                requestEditorRef={requestEditorRef}
                editorForceUpdateKey={editorForceUpdateKey}
                onLog={onLog}
                onPickFile={onPickFile}
                extraTabs={extraTabs}
              />
            </div>
            {/* Request Status Bar */}
            <S.StatusBar>
              <S.StatusBarLeft>
                <span>Lines: {typeof request.request === 'string' ? request.request.split('\n').length : 0}</span>
                <span>Size: {typeof request.request === 'string' ? (request.request.length / 1024).toFixed(2) : 0} KB</span>
                {request.bodyType && <span>Type: {request.bodyType.toUpperCase()}</span>}
              </S.StatusBarLeft>
              <S.StatusBarRight>
                <span>{request.requestType?.toUpperCase() || 'SOAP'}</span>
              </S.StatusBarRight>
            </S.StatusBar>
          </S.RequestPane>

          {/* Resizer */}
          {response && (
            <S.SplitResizer
              ref={resizerRef}
              $layoutMode={layoutMode}
              onMouseDown={handleMouseDown}
            />
          )}

          {/* Response Pane */}
          {response && (
            <S.ResponsePane $ratio={splitRatio}>
              <S.ResponseSection>
                {/* Response Editor - Full height */}
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  <MonacoResponseViewer
                    value={(() => {
                      const raw = response.rawResponse || '';
                      if (!raw) return '';
                      
                      const viewerLanguage = response.contentType?.includes('json') ? 'json' : 'xml';
                      
                      // Use formatContent to respect prettyPrint setting
                      return formatContent(
                        raw,
                        viewerLanguage,
                        editorSettings.settings,
                        editorSettings.settings.prettyPrint
                      );
                    })()}
                    language={response.contentType?.includes('json') ? 'json' : 'xml'}
                    onSelectionChange={setSelection}
                    fontSize={editorSettings.settings.fontSize}
                    fontFamily={editorSettings.settings.fontFamily}
                    showLineNumbers={editorSettings.settings.showLineNumbers}
                    showMinimap={editorSettings.settings.showMinimap}
                  />
                </div>
                {/* Response Status Bar - All info and actions here */}
                <S.StatusBar>
                  <S.StatusBarLeft>
                    {response.status && (
                      <S.ResponseStatus $status={response.status}>
                        {response.status} {response.statusText}
                      </S.ResponseStatus>
                    )}
                    {response.time && <span>{response.time}ms</span>}
                    {response.size && <span>{(response.size / 1024).toFixed(2)} KB</span>}
                    {response.rawResponse && <span>Lines: {response.rawResponse.split('\n').length}</span>}
                  </S.StatusBarLeft>
                  <S.StatusBarRight>
                    {response.contentType && <span>{response.contentType}</span>}
                    {currentXPath && selection && (
                      <>
                        <S.MiniToolbarButton onClick={handleExtract} disabled={!onCreateExtractor}>
                          Extract
                        </S.MiniToolbarButton>
                        <S.MiniToolbarButton onClick={handleMatch} disabled={!onCreateAssertion}>
                          Match
                        </S.MiniToolbarButton>
                        <S.MiniToolbarButton onClick={handleExists} disabled={!onCreateExistenceAssertion}>
                          Exists
                        </S.MiniToolbarButton>
                      </>
                    )}
                  </S.StatusBarRight>
                </S.StatusBar>
              </S.ResponseSection>
            </S.ResponsePane>
          )}
        </S.EditorSplitContainer>
      </S.ContentArea>

      {/* Settings Menu Portal - renders at document body level */}
      {showEditorSettings && menuPosition && (
        <EditorSettingsMenu
          menuPosition={menuPosition}
          settingsMenuRef={settingsMenuRef}
          installedFonts={installedFonts}
          layoutMode={layoutMode}
          showLayoutToggle={controlledLayoutMode === undefined}
          onToggleLayout={handleToggleLayout}
          onFormatXml={handleFormatXml}
          onClose={() => setShowEditorSettings(false)}
        />
      )}
    </S.RequestWorkspaceContainer>
  );
};

// Export wrapped with EditorSettingsProvider
export const RequestWorkspace: React.FC<RequestWorkspaceProps> = ({ 
  initialEditorSettings, 
  onEditorSettingsChange,
  ...props 
}) => {
  return (
    <EditorSettingsProvider
      initialSettings={initialEditorSettings}
      onSettingsChange={onEditorSettingsChange}
    >
      <RequestWorkspaceInternal {...props} />
    </EditorSettingsProvider>
  );
};
