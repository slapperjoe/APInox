import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, X, RotateCcw, Variable, Settings, Type, Minus, Plus, WrapText, AlignLeft, Braces, ListOrdered, Layout as LayoutIcon, Map } from 'lucide-react';
import * as S from './RequestWorkspace.styles';
import { MonacoRequestEditor } from './MonacoRequestEditor';
import { MonacoResponseViewer } from './MonacoResponseViewer';
import { MonacoSingleLineInput } from './MonacoSingleLineInput';
import type { MonacoSingleLineInputHandle } from './MonacoSingleLineInput';
import type { MonacoRequestEditorHandle } from './MonacoRequestEditor';
import { HeadersPanel } from './HeadersPanel';
import { AssertionsPanel } from './AssertionsPanel';
import { ExtractorsPanel } from './ExtractorsPanel';
import { QueryParamsPanel } from './QueryParamsPanel';
import { SecurityPanel } from './SecurityPanel';
import { AttachmentsPanel } from './AttachmentsPanel';
import { FormDataPanel } from './FormDataPanel';
import { BinaryBodyPanel } from './BinaryBodyPanel';
import type { FormField, BinaryFile } from '../types';
import { XPathGenerator } from '../utils/xpathGenerator';
import { useEditorSettings, EditorSettingsProvider } from '../contexts/EditorSettingsContext';
import { formatXml } from '../utils/xmlFormatter';
import { formatContent } from '../utils/contentFormatter';
import { RequestTypeSelector } from './RequestTypeSelector';
import { RequestTypeBadge, MethodBadge, BodyTypeBadge, ContentTypeBadge, BadgeGroup } from './RequestTypeBadges';
import type { RequestType, BodyType, HttpMethod } from '../types';
import { getInstalledFonts, type MonoFont } from '../utils/fontDetection';

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
}

type TabType = 'request' | 'headers' | 'params' | 'assertions' | 'extractors' | 'auth' | 'attachments' | 'variables';

// Internal component that uses the context
const RequestWorkspaceInternal: React.FC<RequestWorkspaceProps> = ({
  request,
  response,
  loading = false,
  onUpdateRequest,
  onExecute,
  onCancel,
  onReset,
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
  onLayoutModeChange
}) => {
  // Editor settings from context
  const editorSettings = useEditorSettings();
  
  // State
  const [activeTab, setActiveTab] = useState<TabType>('request');
  const [showVariables, setShowVariables] = useState(false);
  const [showEditorSettings, setShowEditorSettings] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [layoutMode, setLayoutMode] = useState<'vertical' | 'horizontal'>(initialLayoutMode ?? 'vertical');
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isResizing, setIsResizing] = useState(false);
  const [selection, setSelection] = useState<{ text: string; offset: number } | null>(null);
  const [currentXPath, setCurrentXPath] = useState<string | null>(null);
  const [editorForceUpdateKey, setEditorForceUpdateKey] = useState(0);
  const [installedFonts, setInstalledFonts] = useState<MonoFont[]>([]);

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
      setMenuPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right
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

  // Detect installed fonts on mount
  useEffect(() => {
    const fonts = getInstalledFonts();
    setInstalledFonts(fonts);
  }, []);

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

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'request':
        // Handle different body types
        if (request.bodyType === 'form-data') {
          return (
            <FormDataPanel
              fields={request.formFields || []}
              onChange={(fields) => onUpdateRequest({ ...request, formFields: fields })}
              enctype={(request.contentType === 'application/x-www-form-urlencoded' || request.contentType === 'multipart/form-data') ? request.contentType : 'multipart/form-data'}
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
        
        // Default: Monaco editor for text-based bodies (XML, JSON, GraphQL, text)
        const editorLanguage = request.bodyType === 'json' ? 'json' : request.bodyType === 'graphql' ? 'graphql' : 'xml';
        
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
            params={{}}
            onChange={() => {
              // TODO: Implement query params handling
            }}
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

      default:
        return null;
    }
  };

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
          <S.CancelButton $variant="danger" onClick={onCancel}>
            <X />
            Cancel
          </S.CancelButton>
        ) : (
          <S.RunButton $variant="primary" onClick={onExecute}>
            <Play />
            Run
          </S.RunButton>
        )}

        {/* Reset Button - Only for editable requests */}
        {!readOnly && onReset && (
          <S.ToolbarButton onClick={onReset} title="Reset to default">
            <RotateCcw />
          </S.ToolbarButton>
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
        <S.TabButton $active={activeTab === 'headers'} onClick={() => setActiveTab('headers')}>
          Headers
          {request.headers && Object.keys(request.headers).length > 0 && (
            <S.TabMeta>{Object.keys(request.headers).length}</S.TabMeta>
          )}
        </S.TabButton>
        <S.TabButton $active={activeTab === 'params'} onClick={() => setActiveTab('params')}>
          Params
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

        {/* Right side: Format & Settings buttons */}
        <S.TabsRight>
          <S.CompactIconButton
            title={editorSettings.settings.prettyPrint ? 'Minify (Compress)' : 'Pretty Print (Format)'}
            onClick={() => {
              // Toggle the setting - this will trigger reactive updates
              editorSettings.togglePrettyPrint();
              
              // Format the request body immediately with the NEW value
              // (state update is async, so we toggle the current value)
              const newPrettyPrint = !editorSettings.settings.prettyPrint;
              
              if (request.request && request.bodyType) {
                const language = request.bodyType === 'json' ? 'json' : 
                                request.bodyType === 'xml' ? 'xml' :
                                request.bodyType === 'graphql' ? 'graphql' : 'text';
                
                const formatted = formatContent(
                  request.request, 
                  language, 
                  editorSettings.settings, 
                  newPrettyPrint
                );
                
                if (formatted !== request.request) {
                  onUpdateRequest({ ...request, request: formatted });
                }
              }
              
              // Response viewer will update reactively via settings change
              // Force editor refresh to ensure both update
              setEditorForceUpdateKey(prev => prev + 1);
            }}
          >
            {editorSettings.settings.prettyPrint ? <Minus size={14} /> : <Braces size={14} />}
          </S.CompactIconButton>
          
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
              {renderTabContent()}
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
      {showEditorSettings && menuPosition && createPortal(
        <div
          ref={settingsMenuRef}
          style={{
            position: 'fixed',
            top: `${menuPosition.top}px`,
            right: `${menuPosition.right}px`,
            zIndex: 999999
          }}
        >
          <S.EditorSettingsMenu>
            {/* Font Settings */}
            <S.MenuSection>
              <S.MenuSectionTitle>Font Settings</S.MenuSectionTitle>
              
              <S.MenuRow>
                <S.MenuLabel>
                  <Type size={14} />
                  Font Family
                </S.MenuLabel>
                <S.FontSelect
                  value={editorSettings.settings.fontFamily}
                  onChange={(e) => editorSettings.updateSettings({ fontFamily: e.target.value })}
                >
                  {installedFonts.length > 0 ? (
                    installedFonts.map((font) => (
                      <option key={font.value} value={font.value}>
                        {font.name}
                      </option>
                    ))
                  ) : (
                    <option value='Consolas, "Courier New", monospace'>Consolas</option>
                  )}
                </S.FontSelect>
              </S.MenuRow>

              <S.MenuRow>
                <S.MenuLabel>
                  <Type size={14} />
                  Font Size
                </S.MenuLabel>
                <S.MenuControls>
                  <S.MenuIconButton
                    onClick={() => {
                      const newSize = Math.max(8, editorSettings.settings.fontSize - 1);
                      editorSettings.updateSettings({ fontSize: newSize });
                    }}
                    disabled={editorSettings.settings.fontSize <= 8}
                    title="Decrease"
                  >
                    <Minus size={12} />
                  </S.MenuIconButton>
                  <S.FontSizeDisplay>{editorSettings.settings.fontSize}px</S.FontSizeDisplay>
                  <S.MenuIconButton
                    onClick={() => {
                      const newSize = Math.min(24, editorSettings.settings.fontSize + 1);
                      editorSettings.updateSettings({ fontSize: newSize });
                    }}
                    disabled={editorSettings.settings.fontSize >= 24}
                    title="Increase"
                  >
                    <Plus size={12} />
                  </S.MenuIconButton>
                </S.MenuControls>
              </S.MenuRow>
            </S.MenuSection>

            {/* Formatting Options */}
            <S.MenuSection>
              <S.MenuSectionTitle>Formatting Options</S.MenuSectionTitle>
              
              <S.MenuRow>
                <S.MenuLabel>
                  <Braces size={14} />
                  Format XML
                </S.MenuLabel>
                <S.MenuIconButton
                  onClick={() => {
                    // Get current value from editor (not saved state)
                    const currentValue = requestEditorRef.current?.getValue() || request.request || '';
                    console.log('[Format] Current editor value:', currentValue);
                    const formatted = formatXml(
                      currentValue,
                      editorSettings.settings.alignAttributes,
                      editorSettings.settings.inlineValues,
                      editorSettings.settings.hideCausality
                    );
                    console.log('[Format] Formatted:', formatted);
                    console.log('[Format] Settings:', editorSettings.settings);
                    onUpdateRequest({ ...request, request: formatted });
                    // Force editor to update with new value
                    setEditorForceUpdateKey(prev => prev + 1);
                    setShowEditorSettings(false);
                  }}
                  title="Format XML Now"
                >
                  Format
                </S.MenuIconButton>
              </S.MenuRow>
              
              <S.MenuRow>
                <S.MenuLabel>
                  <WrapText size={14} />
                  Align Attributes
                </S.MenuLabel>
                <S.MenuIconButton
                  onClick={() => editorSettings.toggleAlignAttributes()}
                  className={editorSettings.settings.alignAttributes ? 'active' : ''}
                  title={editorSettings.settings.alignAttributes ? 'On' : 'Off'}
                >
                  {editorSettings.settings.alignAttributes ? 'On' : 'Off'}
                </S.MenuIconButton>
              </S.MenuRow>

              <S.MenuRow>
                <S.MenuLabel>
                  <AlignLeft size={14} />
                  Inline Values
                </S.MenuLabel>
                <S.MenuIconButton
                  onClick={() => editorSettings.toggleInlineValues()}
                  className={editorSettings.settings.inlineValues ? 'active' : ''}
                  title={editorSettings.settings.inlineValues ? 'On' : 'Off'}
                >
                  {editorSettings.settings.inlineValues ? 'On' : 'Off'}
                </S.MenuIconButton>
              </S.MenuRow>

              <S.MenuRow>
                <S.MenuLabel>
                  <Braces size={14} />
                  Hide Causality
                </S.MenuLabel>
                <S.MenuIconButton
                  onClick={() => editorSettings.toggleHideCausality()}
                  className={editorSettings.settings.hideCausality ? 'active' : ''}
                  title={editorSettings.settings.hideCausality ? 'On' : 'Off'}
                >
                  {editorSettings.settings.hideCausality ? 'On' : 'Off'}
                </S.MenuIconButton>
              </S.MenuRow>
            </S.MenuSection>

            {/* View Options */}
            <S.MenuSection>
              <S.MenuSectionTitle>View Options</S.MenuSectionTitle>
              
              <S.MenuRow>
                <S.MenuLabel>
                  <ListOrdered size={14} />
                  Line Numbers
                </S.MenuLabel>
                <S.MenuIconButton
                  onClick={() => editorSettings.toggleLineNumbers()}
                  className={editorSettings.settings.showLineNumbers ? 'active' : ''}
                  title={editorSettings.settings.showLineNumbers ? 'On' : 'Off'}
                >
                  {editorSettings.settings.showLineNumbers ? 'On' : 'Off'}
                </S.MenuIconButton>
              </S.MenuRow>

              <S.MenuRow>
                <S.MenuLabel>
                  <Map size={14} />
                  Minimap
                </S.MenuLabel>
                <S.MenuIconButton
                  onClick={() => editorSettings.toggleMinimap()}
                  className={editorSettings.settings.showMinimap ? 'active' : ''}
                  title={editorSettings.settings.showMinimap ? 'On' : 'Off'}
                >
                  {editorSettings.settings.showMinimap ? 'On' : 'Off'}
                </S.MenuIconButton>
              </S.MenuRow>

              <S.MenuRow>
                <S.MenuLabel>
                  <LayoutIcon size={14} />
                  Split Layout
                </S.MenuLabel>
                <S.MenuIconButton
                  onClick={handleToggleLayout}
                  title={layoutMode === 'vertical' ? 'Vertical' : 'Horizontal'}
                >
                  {layoutMode === 'vertical' ? 'Vertical' : 'Horizontal'}
                </S.MenuIconButton>
              </S.MenuRow>
            </S.MenuSection>
          </S.EditorSettingsMenu>
        </div>,
        document.body
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
