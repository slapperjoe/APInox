import React from 'react';
import { Layout as LayoutIcon, ListOrdered, Play, Loader2, RotateCcw, WrapText, Bug, AlignLeft, Braces, ChevronLeft, ChevronRight, ListChecks, Replace, Cloud, PlusSquare, FileCode, Clock, AlertCircle, Repeat, Code, GitBranch, Type, Minus, Plus, Settings, MoreVertical, Variable } from 'lucide-react';
// Models imported via props.ts indirections, specific enums kept if needed locally (TestStepType is used in code?)
// Checking code: TestStepType is used in props interface but not local var?
// Actually TestStepType is used in onAddStep signature but onAddStep comes from props.
// Let's remove them and add back if needed.
import { SidebarView, RequestType, BodyType, HttpMethod, WorkflowStep, ApiRequest } from '@shared/models';
import { bridge } from '../utils/bridge';
import { CustomXPathEvaluator } from '../utils/xpathEvaluator';
// ... imports

import { MonacoRequestEditor, MonacoRequestEditorHandle } from './MonacoRequestEditor';
import { MonacoResponseViewer } from './MonacoResponseViewer';
import { AssertionsPanel } from './AssertionsPanel';
import { HeadersPanel } from './HeadersPanel';
import { SecurityPanel } from './SecurityPanel';
import { AttachmentsPanel } from './AttachmentsPanel';
import { ExtractorsPanel } from './ExtractorsPanel';
import { VariablesPanel } from './VariablesPanel';

import { MonacoSingleLineInput, MonacoSingleLineInputHandle } from './MonacoSingleLineInput';
import { formatXml, stripCausalityData } from '@shared/utils/xmlFormatter';
import { XPathGenerator } from '../utils/xpathGenerator';
import { CodeSnippetModal } from './modals/CodeSnippetModal';
import { WelcomePanel, TestCaseView, EmptyTestCase } from './workspace';
import { WorkflowSummary } from './workspace/WorkflowSummary';
import { WorkflowEditor } from './workspace/WorkflowEditor';
import { DelayStepEditor } from './workspace/DelayStepEditor';
import { ConditionStepEditor } from './workspace/ConditionStepEditor';
import { LoopStepEditor } from './workspace/LoopStepEditor';
import { ScriptStepEditor } from './workspace/ScriptStepEditor';
import { ApiExplorerMain } from './explorer/ApiExplorerMain';
import { EmptyState, EmptyFileWatcher, EmptyApiExplorer, EmptyServer, EmptyProject, EmptyHistory } from './workspace/EmptyStates';
import { ProjectSummary } from './workspace/ProjectSummary';
import { InterfaceSummary } from './workspace/InterfaceSummary';
import { TestSuiteSummary } from './workspace/TestSuiteSummary';
import { OperationSummary } from './workspace/OperationSummary';
import { PerformanceSuiteEditor } from './workspace/PerformanceSuiteEditor';
import { RequestTypeSelector } from './workspace/RequestTypeSelector';
import { QueryParamsPanel } from './QueryParamsPanel';
import { RestAuthPanel } from './RestAuthPanel';
import { GraphQLVariablesPanel } from './GraphQLVariablesPanel';
import { ScriptEditor } from './ScriptEditor';


// Styled components extracted to styles file

import { createMockRuleFromSource } from '../utils/mockUtils';
import { findPathToRequest } from '../utils/projectUtils';

/**
 * Get Content-Type header based on body type
 * Mirrors backend logic in HttpClient.ts
 */
function getContentTypeForBodyType(bodyType: BodyType): string {
    switch (bodyType) {
        case 'json':
            return 'application/json';
        case 'xml':
            return 'application/xml';
        case 'graphql':
            return 'application/json';
        case 'text':
            return 'text/plain';
        case 'form-data':
            return 'multipart/form-data';
        case 'none':
            return '';
        default:
            return 'application/json';
    }
}

import {
    Toolbar, InfoBarMethod,
    ToolbarButton, MainFooter, IconButton, ToolbarSeparator,
    Content,
    DelayTitle,
    DelayContent,
    DelayField,
    DelayLabel,
    DelayInput,
    WorkspaceBody,
    ToolbarInfo,
    InfoBarUrlPrimary,
    UrlInputWrapper,
    CancelButton,
    RunButton,
    VariablesWrapper,
    VariablesLabel,
    VariablesDropdown,
    VariablesDropdownHeader,
    VariablesDropdownEmpty,
    VariablesDropdownItem,
    VariablesDropdownName,
    VariablesDropdownSource,
    EditorSplitContainer,
    RequestPane,
    BreadcrumbBar,
    BreadcrumbActive,
    TabsHeader,
    TabButton,
    TabMeta,
    TabsRight,
    CompactIconButton,
    CompactIconButtonWarning,
    Divider,
    StatText,
    RequestEditorWrapper,
    PanelColumn,
    PanelBody,
    HeadersViewer,
    HeadersTitle,
    HeadersRow,
    HeadersKey,
    HeadersValue,
    HeadersEmpty,
    ResponseHeadersContainer,
    SplitResizer,
    ResponseSection,
    ResponseHeader,
    ResponseHeaderLeft,
    ResponseHeaderActions,
    ResponseStats,
    ResponseContentType,
    ResponseStatus,
    MiniToolbarButton,
    MiniButtonIcon,
    EditorSettingsMenu,
    MenuSection,
    MenuSectionTitle,
    MenuRow,
    MenuLabel,
    MenuControls,
    FontSizeDisplay,
    MenuIconButton,
    SettingsMenuWrapper
} from '../styles/WorkspaceLayout.styles';


// Prop Groups
import {
    WorkspaceLayoutProps
} from '../types/props';







// Helper Components





export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
    projects,
    setProjects,
    selectionState,
    requestActions,
    viewState,
    configState,
    stepActions,
    toolsActions,
    onUpdateSuite,
    onAddPerformanceRequest,
    onDeletePerformanceRequest,
    onSelectPerformanceRequest,
    onUpdatePerformanceRequest,
    onImportFromWorkspace,
    onRunSuite,
    onStopRun,
    performanceProgress,
    performanceHistory,
    onBackToSuite,
    navigationActions,
    coordinatorStatus,
    onStartCoordinator,
    onStopCoordinator,
    explorerState // Add this
}) => {
    // Destructure groups
    const {
        project: selectedProject,
        interface: selectedInterface,
        operation: selectedOperation,
        request: selectedRequest,
        testCase: selectedTestCase,
        testSuite: selectedTestSuite,
        testStep: selectedStep,
        performanceSuite: selectedPerformanceSuite,
        workflowStep: selectedWorkflowStep
    } = selectionState;

    const {
        onExecute,
        onCancel,
        onUpdate: rawOnUpdateRequest,
        onReset,
        response,
        loading
    } = requestActions;

    const { 
        activeView,
        layoutMode, 
        showLineNumbers, 
        splitRatio, 
        isResizing, 
        onToggleLayout, 
        onToggleLineNumbers, 
        onStartResizing,
        inlineElementValues, 
        onToggleInlineElementValues, 
        hideCausalityData, 
        onToggleHideCausalityData
    } = viewState;
    
    const { config, defaultEndpoint, changelog, isReadOnly: isHistoryMode } = configState;

    // For WORKFLOWS view, create a request object from the workflow step
    // We use a single "activeRequest" variable throughout the component
    let activeRequest = selectedRequest;
    if (activeView === SidebarView.WORKFLOWS && selectedWorkflowStep && selectedWorkflowStep.step && !activeRequest) {
        const step = selectedWorkflowStep.step;
        
        // Create a complete ApiRequest object from the workflow step with ALL defaults
        activeRequest = {
            id: step.id || `workflow-step-${step.name}`,
            name: step.name || 'Unnamed Step',
            endpoint: step.endpoint || '',
            request: step.requestBody || '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body></soap:Body></soap:Envelope>',
            headers: step.headers || {},
            contentType: step.contentType || 'application/soap+xml',
            // Default to SOAP since APInox is primarily a SOAP tool
            requestType: step.requestType || 'soap',
            bodyType: step.bodyType || 'xml',
            httpMethod: step.httpMethod || 'POST',
            method: step.method || 'POST',
            readOnly: false,
            // REST/GraphQL specific (optional, but prevents null errors)
            restConfig: {},
            graphqlConfig: {},
            // Ensure security and attachments exist
            security: {},
            attachments: []
        } as any;
        
        console.log('[WorkspaceLayout] Created activeRequest from workflow step:', activeRequest.name, 'type:', activeRequest.requestType);
    }

    // Use activeRequest throughout instead of activeRequest
    // For backward compatibility with existing code, we use effectiveRequest as well
    const effectiveRequest = activeRequest;

    console.log('[WorkspaceLayout] Render - activeView:', activeView, 'selectedWorkflowStep:', !!selectedWorkflowStep);
    if (selectedWorkflowStep) {
        console.log('[WorkspaceLayout] Workflow step details:', {
            workflow: selectedWorkflowStep.workflow?.name,
            step: selectedWorkflowStep.step?.name || 'null'
        });
    }

    // Wrapper to add logging for debugging
    const onUpdateRequest = React.useCallback((updated: any) => {
        console.log('[WorkspaceLayout] onUpdateRequest called:', { requestName: updated?.name, requestId: updated?.id });
        rawOnUpdateRequest(updated);
    }, [rawOnUpdateRequest]);


    const forceEditorUpdate = React.useCallback(() => {
        setEditorForceUpdateKey(prev => prev + 1);
    }, []);

    // Derived read-only state
    const isStructureLocked = (activeView === SidebarView.PERFORMANCE || activeView === SidebarView.TESTS);
    const isContentLocked = (activeRequest?.readOnly === true) ||
        (!isStructureLocked && selectedProject?.readOnly === true);
    const preventEditing = isHistoryMode || isContentLocked;
    const isReadOnly = preventEditing; // Defaults to preventing editing, specific overrides used below
    const {
        onRunTestCase, onOpenStepRequest, onBackToCase, onAddStep, testExecution,
        onUpdateStep, onSelectStep, onDeleteStep, onMoveStep
    } = stepActions;
    const {
        onAddExtractor, onEditExtractor, onAddAssertion, onAddExistenceAssertion, onAddReplaceRule, onAddMockRule, onOpenDevOps
    } = toolsActions;

    // Performance Actions extracted in props destructuring above

    // Calculate available variables for autocomplete (only in test step context)
    // MUST be after testExecution is destructured from stepActions
    const availableVariables = React.useMemo(() => {
        // Early return with empty array if not in correct context
        if (activeView !== SidebarView.TESTS) return [];
        if (!selectedTestCase || !selectedStep) return [];
        if (!selectedStep.id || selectedStep.type !== 'request') return [];
        
        try {
            const currentIndex = selectedTestCase.steps?.findIndex(s => s.id === selectedStep.id) ?? -1;
            if (currentIndex <= 0) return [];
            
            const priorSteps = selectedTestCase.steps.slice(0, currentIndex);
            const vars: Array<{ name: string; value: string | null; source: string }> = [];
            
            priorSteps.forEach(step => {
                if (step.type === 'request' && step.config?.request?.extractors) {
                    step.config.request.extractors.forEach(ext => {
                        try {
                            const stepExec = testExecution?.[selectedTestCase.id]?.[step.id];
                            let value: string | null = null;
                            
                            if (stepExec?.response) {
                                const rawResp = stepExec.response.rawResponse || 
                                    (typeof stepExec.response.result === 'string'
                                        ? stepExec.response.result
                                        : JSON.stringify(stepExec.response.result));
                                
                                if (rawResp && ext.source === 'body') {
                                    try {
                                        value = CustomXPathEvaluator.evaluate(rawResp, ext.path);
                                        if (!value && ext.defaultValue) {
                                            value = ext.defaultValue;
                                        }
                                    } catch (e) {
                                        if (ext.defaultValue) {
                                            value = ext.defaultValue;
                                        }
                                    }
                                }
                            } else if (ext.defaultValue) {
                                value = ext.defaultValue;
                            }
                            
                            vars.push({
                                name: ext.variable,
                                value,
                                source: step.name
                            });
                        } catch (extError) {
                            console.error('[WorkspaceLayout] Error processing extractor:', extError);
                        }
                    });
                }
            });
            
            return vars;
        } catch (error) {
            console.error('[WorkspaceLayout] Error in availableVariables:', error);
            return [];
        }
    }, [activeView, selectedTestCase, selectedStep, testExecution]);



    const [alignAttributes, setAlignAttributes] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<'request' | 'headers' | 'params' | 'assertions' | 'auth' | 'extractors' | 'attachments' | 'variables' | 'chainvars'>('request');
    const [showVariables, setShowVariables] = React.useState(false);
    const [showCodeSnippet, setShowCodeSnippet] = React.useState(false);
    const [editorFontSize, setEditorFontSize] = React.useState(14);
    const [editorFontFamily, setEditorFontFamily] = React.useState<string>('Consolas, "Courier New", monospace');
    const [showEditorSettings, setShowEditorSettings] = React.useState(false);
    const [installedFonts, setInstalledFonts] = React.useState<Array<{name: string; value: string}>>([]);
    
    console.log('[WorkspaceLayout] Component rendered, editorFontSize:', editorFontSize, 'config exists:', !!config);

    // Detect installed fonts on mount
    React.useEffect(() => {
        const detectFonts = async () => {
            // Dynamic import to avoid bundling issues
            const { getInstalledFonts } = await import('../utils/fontDetection');
            const fonts = getInstalledFonts();
            setInstalledFonts(fonts);
        };
        detectFonts();
    }, []);

    // ... imports


    // Editor Refs for insertion
    const urlEditorRef = React.useRef<MonacoSingleLineInputHandle>(null);
    const bodyEditorRef = React.useRef<MonacoRequestEditorHandle>(null);
    const lastFocusedRef = React.useRef<MonacoSingleLineInputHandle | MonacoRequestEditorHandle | null>(null);
    const [selection, setSelection] = React.useState<{ text: string, offset: number } | null>(null);
    const [currentXPath, setCurrentXPath] = React.useState<string | null>(null);
    const [editorForceUpdateKey, setEditorForceUpdateKey] = React.useState<number>(0);
    const prevAlignAttributesRef = React.useRef<boolean>(alignAttributes);
    const lastAlignedRequestIdRef = React.useRef<string | null>(null);
    const lastFormattedRequestIdRef = React.useRef<string | null>(null);
    const settingsMenuRef = React.useRef<HTMLDivElement>(null);

    // Close editor settings menu when clicking outside
    React.useEffect(() => {
        if (!showEditorSettings) return;
        
        const handleClickOutside = (event: MouseEvent) => {
            if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
                setShowEditorSettings(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showEditorSettings]);

    React.useEffect(() => {
        if (config?.ui?.alignAttributes !== undefined) {
            setAlignAttributes(config.ui.alignAttributes);
        }
    }, [config?.ui?.alignAttributes]);

    // Load editor font size from config
    React.useEffect(() => {
        if (config?.ui?.editorFontSize !== undefined) {
            setEditorFontSize(config.ui.editorFontSize);
        }
    }, [config?.ui?.editorFontSize]);

    // Load editor font family from config
    React.useEffect(() => {
        if (config?.ui?.editorFontFamily !== undefined) {
            setEditorFontFamily(config.ui.editorFontFamily);
        }
    }, [config?.ui?.editorFontFamily]);

    // Save editor font size to config when changed
    const handleFontSizeChange = React.useCallback((newSize: number) => {
        console.log('[WorkspaceLayout] Font size change requested:', newSize);
        console.log('[WorkspaceLayout] Config available?', !!config, 'config:', config);
        setEditorFontSize(newSize);
        
        // Update config and save immediately
        if (config) {
            const updatedConfig = {
                ...config,
                ui: {
                    ...config.ui,
                    editorFontSize: newSize
                }
            };
            console.log('[WorkspaceLayout] Sending saveSettings with fontSize:', newSize, 'config.ui:', updatedConfig.ui);
            bridge.sendMessage({ 
                command: 'saveSettings', 
                config: updatedConfig 
            });
        } else {
            console.warn('[WorkspaceLayout] No config available, cannot save font size');
        }
    }, [config]);

    // Save editor font family to config when changed
    const handleFontFamilyChange = React.useCallback((newFamily: string) => {
        console.log('[WorkspaceLayout] Font family change requested:', newFamily);
        setEditorFontFamily(newFamily);
        
        // Update config and save immediately
        if (config) {
            const updatedConfig = {
                ...config,
                ui: {
                    ...config.ui,
                    editorFontFamily: newFamily
                }
            };
            console.log('[WorkspaceLayout] Sending saveSettings with fontFamily:', newFamily);
            bridge.sendMessage({ 
                command: 'saveSettings', 
                config: updatedConfig 
            });
        } else {
            console.warn('[WorkspaceLayout] No config available, cannot save font family');
        }
    }, [config]);

    React.useEffect(() => {
        if (prevAlignAttributesRef.current === alignAttributes) return;
        prevAlignAttributesRef.current = alignAttributes;

        if (preventEditing || !effectiveRequest?.request) return;

        const isXmlRequest = effectiveRequest.requestType !== 'rest'
            && effectiveRequest.bodyType !== 'json'
            && effectiveRequest.bodyType !== 'graphql'
            && effectiveRequest.bodyType !== 'text';

        if (!isXmlRequest) return;

        onUpdateRequest({
            ...activeRequest,
            request: formatXml(activeRequest.request, alignAttributes, inlineElementValues)
        });
        forceEditorUpdate();
    }, [alignAttributes, preventEditing, activeRequest, inlineElementValues, onUpdateRequest]);

    React.useEffect(() => {
        if (!alignAttributes) {
            lastAlignedRequestIdRef.current = null;
            return;
        }
        if (preventEditing || !effectiveRequest?.request) return;

        const requestId = effectiveRequest.id || effectiveRequest.name || null;
        if (requestId && lastAlignedRequestIdRef.current === requestId) return;

        const isXmlRequest = effectiveRequest.requestType !== 'rest'
            && effectiveRequest.bodyType !== 'json'
            && effectiveRequest.bodyType !== 'graphql'
            && effectiveRequest.bodyType !== 'text';

        if (!isXmlRequest) return;

        onUpdateRequest({
            ...effectiveRequest,
            request: formatXml(effectiveRequest.request, alignAttributes, inlineElementValues)
        });
        forceEditorUpdate();

        if (requestId) {
            lastAlignedRequestIdRef.current = requestId;
        }
    }, [alignAttributes, preventEditing, activeRequest, inlineElementValues, onUpdateRequest]);

    React.useEffect(() => {
        if (preventEditing || !effectiveRequest?.request) return;

        const requestId = effectiveRequest.id || effectiveRequest.name || null;
        if (requestId && lastFormattedRequestIdRef.current === requestId) return;

        const isXmlRequest = effectiveRequest.requestType !== 'rest'
            && effectiveRequest.bodyType !== 'json'
            && effectiveRequest.bodyType !== 'graphql'
            && effectiveRequest.bodyType !== 'text';

        if (!isXmlRequest) return;

        onUpdateRequest({
            ...effectiveRequest,
            request: formatXml(effectiveRequest.request, alignAttributes, inlineElementValues)
        });
        forceEditorUpdate();

        if (requestId) {
            lastFormattedRequestIdRef.current = requestId;
        }
    }, [alignAttributes, preventEditing, activeRequest, inlineElementValues, onUpdateRequest]);

    React.useEffect(() => {
        if (selection && response?.rawResponse) {
            // Calculate XPath on selection change to determine button visibility
            const path = XPathGenerator.getPath(response.rawResponse, selection.offset);
            setCurrentXPath(path);
        } else {
            setCurrentXPath(null);
        }
    }, [selection, response]);

    // Reset selection when step changes or re-runs
    React.useEffect(() => {
        setSelection(null);
        setCurrentXPath(null);
        if (selectedStep?.config.request?.assertions) {
            console.log("WorkspaceLayout: Step Updated. Assertions:", selectedStep.config.request.assertions.length);
        }
    }, [selectedStep?.id, response, selectedStep?.config.request?.assertions]);

    const handleCreateExtractor = () => {
        if (!selection || !response || !onAddExtractor) return;

        let path: string | null = null;
        const source = 'body';

        if (response.rawResponse) {
            path = XPathGenerator.getPath(response.rawResponse, selection.offset);
        }

        if (path) {
            onAddExtractor({ xpath: path, value: selection.text, source });
        } else {
            console.warn("Could not determine XPath for selection");
        }
    };

    const handleCreateAssertion = () => {
        console.log("WorkspaceLayout: Match Clicked. XPath:", currentXPath, "Selection:", selection?.text);
        if (!selection || !response || !onAddAssertion || !currentXPath) {
            console.warn("WorkspaceLayout: Match aborted. Missing deps:", { hasSelection: !!selection, hasResponse: !!response, hasHandler: !!onAddAssertion, hasPath: !!currentXPath });
            return;
        }

        onAddAssertion({ xpath: currentXPath, expectedContent: selection.text });
        setActiveTab('assertions');
    };

    const handleCreateExistenceAssertion = () => {
        if (!selection || !response || !onAddExistenceAssertion || !currentXPath) return;

        onAddExistenceAssertion({ xpath: currentXPath });
        setActiveTab('assertions');
    };

    const handleCreateReplaceRule = (target: 'request' | 'response') => {
        if (!selection || !currentXPath || !onAddReplaceRule) return;

        onAddReplaceRule({ xpath: currentXPath, matchText: selection.text, target });
    };

    const handleCreateMockRule = () => {
        if (!activeRequest || !response || !onAddMockRule) {
            console.warn('[WorkspaceLayout] handleCreateMockRule aborted: missing data or callback');
            return;
        }

        const newRule = createMockRuleFromSource({
            url: activeRequest.endpoint || '',
            statusCode: response.status || 200,
            responseBody: response.rawResponse || '',
            responseHeaders: response.headers || {},
        });

        onAddMockRule(newRule);
    };

    if (activeView === SidebarView.HOME) {
        return <WelcomePanel changelog={changelog} />;
    }

    // PERFORMANCE VIEW
    if (activeView === SidebarView.PERFORMANCE) {
        const suiteHistory = (performanceHistory || []).filter(run => selectedPerformanceSuite ? run.suiteId === selectedPerformanceSuite.id : false);
        const performanceSchedules = config?.performanceSchedules || [];
        const isPerfRunning = !!performanceProgress;

        if (!selectedPerformanceSuite && !activeRequest) {
            return <EmptyState title="No Performance Suite Selected" description="Pick or create a performance suite from the sidebar." icon={Play} />;
        }

        if (selectedPerformanceSuite && !activeRequest) {
            return (
                <PerformanceSuiteEditor
                    suite={selectedPerformanceSuite}
                    onUpdate={onUpdateSuite || (() => { })}
                    onRun={onRunSuite || (() => { })}
                    onStop={onStopRun || (() => { })}
                    isRunning={isPerfRunning}
                    onAddRequest={onAddPerformanceRequest}
                    onDeleteRequest={onDeletePerformanceRequest}
                    onUpdateRequest={onUpdatePerformanceRequest}
                    onSelectRequest={onSelectPerformanceRequest}
                    onImportFromWorkspace={onImportFromWorkspace}
                    progress={performanceProgress || null}
                    history={suiteHistory}
                    schedules={performanceSchedules}
                    coordinatorStatus={coordinatorStatus}
                    onStartCoordinator={onStartCoordinator}
                    onStopCoordinator={onStopCoordinator}
                />
            );
        }
        // If a performance request is selected, fall through to the request editor below.
    }

    // TESTS VIEW
    if (activeView === SidebarView.TESTS) {
        if (selectedTestSuite && !selectedTestCase) {
            return <TestSuiteSummary suite={selectedTestSuite} onSelectTestCase={navigationActions?.onSelectTestCase} />;
        }

        if (selectedStep && selectedStep.type === 'workflow' && !isReadOnly && onUpdateStep) {
            // Load workflows from config
            const workflows = config?.workflows || [];
            
            return (
                <Content>
                    <Toolbar>
                        {onBackToCase && (
                            <ToolbarButton onClick={onBackToCase} title="Back to Test Case">
                                <ChevronLeft size={14} /> Back
                            </ToolbarButton>
                        )}
                        <DelayTitle>Workflow Configuration</DelayTitle>
                    </Toolbar>
                    <DelayContent>
                        <h2>Step: {selectedStep.name}</h2>
                        <DelayField>
                            <DelayLabel>Workflow:</DelayLabel>
                            <select
                                value={selectedStep.config.workflowId || ''}
                                onChange={(e) => {
                                    onUpdateStep({
                                        ...selectedStep,
                                        config: { ...selectedStep.config, workflowId: e.target.value }
                                    });
                                }}
                                style={{
                                    background: 'var(--apinox-input-background)',
                                    color: 'var(--apinox-input-foreground)',
                                    border: '1px solid var(--apinox-input-border)',
                                    padding: '6px',
                                    borderRadius: '2px',
                                    fontSize: '13px'
                                }}
                            >
                                <option value="">Select a workflow...</option>
                                {workflows.map((wf: any) => (
                                    <option key={wf.id} value={wf.id}>
                                        {wf.name}
                                    </option>
                                ))}
                            </select>
                        </DelayField>
                        <DelayField style={{ marginTop: '20px' }}>
                            <DelayLabel>Override Variables (JSON):</DelayLabel>
                            <textarea
                                value={JSON.stringify(selectedStep.config.workflowVariables || {}, null, 2)}
                                onChange={(e) => {
                                    try {
                                        const vars = JSON.parse(e.target.value);
                                        onUpdateStep({
                                            ...selectedStep,
                                            config: { ...selectedStep.config, workflowVariables: vars }
                                        });
                                    } catch (err) {
                                        // Invalid JSON - don't update
                                        console.error('Invalid JSON for workflow variables:', err);
                                    }
                                }}
                                rows={8}
                                placeholder='{"variable1": "value1", "variable2": "value2"}'
                                style={{
                                    background: 'var(--apinox-input-background)',
                                    color: 'var(--apinox-input-foreground)',
                                    border: '1px solid var(--apinox-input-border)',
                                    padding: '8px',
                                    borderRadius: '2px',
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                    width: '100%'
                                }}
                            />
                            <div style={{ fontSize: '11px', color: 'var(--apinox-descriptionForeground)', marginTop: '8px' }}>
                                Variables defined here will override workflow defaults. Test case context variables are also available.
                            </div>
                        </DelayField>
                    </DelayContent>
                </Content>
            );
        }

        if (selectedStep && selectedStep.type === 'delay' && !isReadOnly && onUpdateStep) {
            return (
                <Content>
                    <Toolbar>
                        {onBackToCase && (
                            <ToolbarButton onClick={onBackToCase} title="Back to Test Case">
                                <ChevronLeft size={14} /> Back
                            </ToolbarButton>
                        )}
                        <DelayTitle>Delay Configuration</DelayTitle>
                    </Toolbar>
                    <DelayContent>
                        <h2>Step: {selectedStep.name}</h2>
                        <DelayField>
                            <DelayLabel>Delay Duration (milliseconds):</DelayLabel>
                            <DelayInput
                                type="number"
                                value={selectedStep.config.delayMs || 0}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    onUpdateStep({ ...selectedStep, config: { ...selectedStep.config, delayMs: val } });
                                }}
                            />
                        </DelayField>
                    </DelayContent>
                </Content>
            );
        }

        if (selectedTestCase && !selectedStep) {
            return (
                <TestCaseView
                    testCase={selectedTestCase}
                    testExecution={testExecution}
                    onRunTestCase={onRunTestCase}
                    onAddStep={onAddStep}
                    onSelectStep={onSelectStep}
                    onMoveStep={onMoveStep}
                    onDeleteStep={onDeleteStep}
                    onOpenStepRequest={onOpenStepRequest}
                    workflows={configState.config?.workflows}
                    projects={projects}
                />
            );
        }

        if (!selectedTestCase) {
            return <EmptyTestCase />;
        }
    }

    // WORKFLOWS VIEW
    if (activeView === SidebarView.WORKFLOWS) {
        console.log('[WorkspaceLayout] In WORKFLOWS view, selectedWorkflowStep:', !!selectedWorkflowStep);
        
        if (!selectedWorkflowStep) {
            console.log('[WorkspaceLayout] No workflow step selected, showing welcome');
            return (
                <WelcomePanel 
                    changelog={null}
                    message="Select a workflow or workflow step from the sidebar"
                />
            );
        }
        
        // Check if a workflow is selected (but not a step within it)
        // This happens when the user clicks the workflow itself, not a step
        const { workflow, step } = selectedWorkflowStep;
        console.log('[WorkspaceLayout] workflow:', workflow?.name, 'step:', step?.name || 'null/undefined');
        console.log('[WorkspaceLayout] step check:', !step, '|| !step.type:', !step?.type);
        
        // If step is actually the first step or we're showing the workflow summary
        // We need to check if we're showing a step or the workflow itself
        // For now, let's check if step type exists - if not, show workflow editor
        if (!step || !step.type) {
            console.log('[WorkspaceLayout] Showing workflow editor for:', workflow?.name);
            return (
                <WorkflowEditor
                    workflow={workflow}
                    projects={projects || []}
                    onUpdate={(updatedWorkflow) => {
                        if (navigationActions?.onUpdateWorkflow) {
                            navigationActions.onUpdateWorkflow(updatedWorkflow);
                        }
                    }}
                    onSelectStep={(selectedStep) => {
                        // Re-select with proper step
                        if (navigationActions?.onSelectWorkflowStep) {
                            navigationActions.onSelectWorkflowStep(workflow, selectedStep);
                        }
                    }}
                />
            );
        }
        
        // Check if this is a non-request step type (delay, condition, loop, script)
        if (step.type !== 'request') {
            console.log('[WorkspaceLayout] Non-request step type:', step.type);
            
            const updateHandler = (updatedStep: WorkflowStep) => {
                if (navigationActions?.onUpdateWorkflowStep) {
                    navigationActions.onUpdateWorkflowStep(workflow, updatedStep);
                }
            };
            
            // Show appropriate editor for each step type
            switch (step.type) {
                case 'delay':
                    return <DelayStepEditor step={step} onUpdate={updateHandler} />;
                case 'condition':
                    return <ConditionStepEditor step={step} onUpdate={updateHandler} />;
                case 'loop':
                    return <LoopStepEditor step={step} onUpdate={updateHandler} />;
                case 'script':
                    return <ScriptStepEditor step={step} onUpdate={updateHandler} />;
                default:
                    return (
                        <EmptyState
                            icon={GitBranch}
                            title="Unknown Step Type"
                            description="This step type is not supported."
                        />
                    );
            }
        }
        
        // If workflow step IS selected and it's a request type, fall through to main editor
        // effectiveRequest/activeRequest has been set above
        console.log('[WorkspaceLayout] Rendering workflow request step editor');
    }

    // PROJECTS VIEW
    if (activeView === SidebarView.PROJECTS) {
        if (!activeRequest) {
            if (selectedOperation) {
                const handleCreateRequestFromSample = setProjects ? (sampleXml: string, metadata: {
                    endpoint?: string;
                    soapAction?: string;
                    contentType?: string;
                    targetNamespace?: string;
                }) => {
                    // Create new request from sample
                    const newReqName = `${selectedOperation.name} ${selectedOperation.requests.length + 1}`;
                    const newRequest: ApiRequest = {
                        name: newReqName,
                        request: sampleXml,
                        id: crypto.randomUUID(),
                        dirty: true,
                        endpoint: metadata.endpoint || selectedOperation.originalEndpoint || '',
                        contentType: metadata.contentType || 'text/xml; charset=utf-8',
                        headers: {
                            'Content-Type': metadata.contentType || 'text/xml; charset=utf-8'
                        },
                        requestType: 'soap',
                        bodyType: 'xml'
                    };

                    // Add to operation
                    setProjects(prev => prev.map(p => {
                        let found = false;
                        const newInterfaces = p.interfaces.map(i => {
                            const newOps = i.operations.map(o => {
                                if (o.name === selectedOperation.name) {
                                    found = true;
                                    return { ...o, requests: [...o.requests, newRequest], expanded: true };
                                }
                                return o;
                            });
                            return { ...i, operations: newOps };
                        });

                        if (found) {
                            return { ...p, interfaces: newInterfaces, dirty: true };
                        }
                        return p;
                    }));

                    // Auto-select the new request
                    if (navigationActions?.onSelectRequest) {
                        navigationActions.onSelectRequest(newRequest);
                    }
                } : undefined;
                
                return <OperationSummary 
                    operation={selectedOperation} 
                    onSelectRequest={navigationActions?.onSelectRequest}
                    onCreateRequestFromSample={handleCreateRequestFromSample}
                />;
            }
            if (selectedInterface) return <InterfaceSummary interface={selectedInterface} onSelectOperation={navigationActions?.onSelectOperation} />;
            if (selectedProject) return <ProjectSummary project={selectedProject} onSelectInterface={navigationActions?.onSelectInterface} />;
            return <EmptyProject />;
        }
        // If request IS selected, fall through to Request Editor
    }

    // EXPLORER VIEW
    if (activeView === SidebarView.EXPLORER) {
        // If a request is selected, fall through to main render
        if (!activeRequest && explorerState) {
            return (
                <ApiExplorerMain
                    inputType={explorerState.inputType}
                    setInputType={explorerState.setInputType}
                    wsdlUrl={explorerState.wsdlUrl}
                    setWsdlUrl={explorerState.setWsdlUrl}
                    loadWsdl={explorerState.loadWsdl}
                    downloadStatus={explorerState.downloadStatus}
                    onClearSelection={explorerState.onClearSelection}
                    selectedInterface={selectedInterface || undefined}
                    selectedOperation={selectedOperation || undefined}
                />
            );
        } else if (!activeRequest) {
            return <EmptyApiExplorer />;
        }
    }

    // WATCHER VIEW
    if (activeView === SidebarView.WATCHER) {
        // If an event is selected (it's a request), it will have been handled by activeRequest above?
        // Wait, activeRequest handles everything. If we are here, it means !activeRequest.
        if (!activeRequest) {
            return <EmptyFileWatcher />;
        }
    }

    // SERVER VIEW
    if (activeView === SidebarView.SERVER) {
        // If a request is selected (from Proxy/Mock history), it falls through to main render
        if (!activeRequest) {
            return <EmptyServer />;
        }
    }

    // HISTORY VIEW
    if (activeView === SidebarView.HISTORY) {
        if (!activeRequest) {
            return <EmptyHistory />;
        }
    }

    // Fallback for other views that usually show Welcome if no request selected
    if (!effectiveRequest) {
        if (selectedStep && selectedStep.type === 'script' && onUpdateStep) {
            return (
                <ScriptEditor
                    step={selectedStep}
                    onUpdate={onUpdateStep}
                    isReadOnly={isReadOnly}
                    onBack={onBackToCase}
                />
            );
        }
        return <WelcomePanel changelog={changelog} />;
    }



    // For the main rendering, use effectiveRequest as the current request
    // This avoids having to change hundreds of references throughout the component
    const currentRequest = effectiveRequest;

    return (
        <Content>
            {/* Modal */}
            <CodeSnippetModal
                isOpen={showCodeSnippet}
                onClose={() => setShowCodeSnippet(false)}
                request={currentRequest}
                environment={config?.environments && config?.activeEnvironment ? config.environments[config.activeEnvironment] : undefined}
            />

            <WorkspaceBody>
                {/* Toolbar */}

                {!isHistoryMode && (
                    <Toolbar>
                        {/* Explorer view back button */}
                        {activeView === SidebarView.EXPLORER && !selectedTestCase && !selectedPerformanceSuite && navigationActions?.onSelectRequest && (
                            <>
                                <ToolbarButton onClick={() => navigationActions.onSelectRequest(null as any)} title="Back to API Explorer">
                                    <ChevronLeft size={14} /> Back
                                </ToolbarButton>
                                <ToolbarSeparator />
                            </>
                        )}

                        {selectedTestCase && onBackToCase && (
                            <>
                                <ToolbarButton onClick={onBackToCase} title="Back to Test Case">
                                    <ChevronLeft size={14} /> Back
                                </ToolbarButton>
                                <ToolbarSeparator />
                            </>
                        )}

                        {!selectedTestCase && selectedPerformanceSuite && onBackToSuite && (
                            <>
                                <ToolbarButton onClick={onBackToSuite} title="Back to Performance Suite">
                                    <ChevronLeft size={14} /> Back
                                </ToolbarButton>
                                <ToolbarSeparator />
                            </>
                        )}

                        {/* Request Type / Method / Content-Type - Unified Selector */}
                        {preventEditing || isStructureLocked ? (
                            <ToolbarInfo>
                                <InfoBarMethod>{activeRequest.method || 'POST'}</InfoBarMethod>
                                <InfoBarUrlPrimary title={activeRequest.endpoint}>{activeRequest.endpoint}</InfoBarUrlPrimary>
                            </ToolbarInfo>
                        ) : (
                            <>
                                <RequestTypeSelector
                                    requestType={activeRequest.requestType}
                                    method={activeRequest.method as HttpMethod}
                                    bodyType={activeRequest.bodyType}
                                    contentType={activeRequest.contentType}
                                    onRequestTypeChange={(type: RequestType) => onUpdateRequest({ ...activeRequest, requestType: type })}
                                    onMethodChange={(method) => onUpdateRequest({ ...activeRequest, method: method as string })}
                                    onBodyTypeChange={(type: BodyType) => {
                                        // Update body type and sync content type
                                        const newContentType = getContentTypeForBodyType(type);
                                        onUpdateRequest({ 
                                            ...activeRequest, 
                                            bodyType: type,
                                            contentType: newContentType,
                                            headers: { ...(activeRequest.headers || {}), 'Content-Type': newContentType }
                                        });
                                    }}
                                    onContentTypeChange={(ct) => onUpdateRequest({ 
                                        ...activeRequest, 
                                        contentType: ct,
                                        headers: { ...(activeRequest.headers || {}), 'Content-Type': ct }
                                    })}
                                    compact={true}
                                />

                                {/* URL */}
                                <UrlInputWrapper>
                                    <MonacoSingleLineInput
                                        ref={urlEditorRef}
                                        value={activeRequest.endpoint || defaultEndpoint || ''}
                                        onChange={(val) => {
                                            console.log('[WorkspaceLayout] Endpoint onChange triggered, val:', val);
                                            onUpdateRequest({ ...activeRequest, endpoint: val });
                                        }}
                                        placeholder="Endpoint URL"
                                        readOnly={isReadOnly || isStructureLocked}
                                        onFocus={() => lastFocusedRef.current = urlEditorRef.current}
                                    />
                                </UrlInputWrapper>
                            </>
                        )}

                        {/* Actions */}
                        {!selectedTestCase && !preventEditing && (
                            <ToolbarButton onClick={() => { onReset(); forceEditorUpdate(); }} title="Revert to Default XML">
                                <RotateCcw size={14} /> Reset
                            </ToolbarButton>
                        )}

                        {!selectedTestCase && (
                            <ToolbarButton onClick={() => setShowCodeSnippet(true)} title="Generate Code">
                                <FileCode size={14} /> Code
                            </ToolbarButton>
                        )}

                        {loading ? (
                            <CancelButton onClick={onCancel}>
                                <Loader2 size={14} className="spin" /> Cancel
                            </CancelButton>
                        ) : (
                            <RunButton onClick={() => {
                                // Get current content from editor, falling back to activeRequest.request
                                // This allows users to edit read-only samples and test with the edited content
                                const currentContent = bodyEditorRef.current?.getValue() ?? activeRequest.request;
                                onExecute(currentContent);
                            }} title="Run Request">
                                <Play size={14} /> Run
                            </RunButton>
                        )}

                        <ToolbarSeparator />



                        {/* Variables Inserter */}
                        {selectedTestCase && selectedStep && (
                            <VariablesWrapper>
                                <ToolbarButton onClick={() => setShowVariables(!showVariables)} title="Insert/View Variables from Previous Steps">
                                    <Braces size={14} />
                                    <VariablesLabel>Variables</VariablesLabel>
                                </ToolbarButton>
                                {showVariables && (
                                    <VariablesDropdown>
                                        <VariablesDropdownHeader>
                                            Available Context Variables
                                        </VariablesDropdownHeader>
                                        {(() => {
                                            const idx = selectedTestCase.steps.findIndex(s => s.id === selectedStep.id);
                                            const vars: { name: string, step: string }[] = [];
                                            if (idx > 0) {
                                                selectedTestCase.steps.slice(0, idx).forEach(s => {
                                                    if (s.type === 'request' && s.config.request?.extractors) {
                                                        s.config.request.extractors.forEach(e => {
                                                            vars.push({ name: e.variable, step: s.name });
                                                        });
                                                    }
                                                });
                                            }

                                            if (vars.length === 0) {
                                                return <VariablesDropdownEmpty>No variables defined in previous steps.</VariablesDropdownEmpty>
                                            }

                                            return vars.map((v, i) => (
                                                <VariablesDropdownItem
                                                    key={i}
                                                    onClick={() => {
                                                        const target = lastFocusedRef.current || bodyEditorRef.current; // Default to body
                                                        if (target) {
                                                            target.insertText('${#TestCase#' + v.name + '}');
                                                            // InsertText modifies model directly, so no force update needed usually,
                                                            // but if we updated state, we might. Here we access editor instance directly.
                                                        }
                                                        setShowVariables(false);
                                                    }}
                                                    title="Click to Insert"
                                                >
                                                    <VariablesDropdownName>{v.name}</VariablesDropdownName>
                                                    <VariablesDropdownSource>from {v.step}</VariablesDropdownSource>
                                                </VariablesDropdownItem>
                                            ));
                                        })()}
                                    </VariablesDropdown>
                                )}
                            </VariablesWrapper>
                        )}
                    </Toolbar>
                )}

                <EditorSplitContainer $layoutMode={layoutMode}>
                    <RequestPane $hasResponse={Boolean(response || loading)} $splitRatio={splitRatio}>
                        {/* Title Section (Moved above tabs) */}
                        {/* Title Section (Breadcrumbs) */}
                        <BreadcrumbBar>
                            {(() => {
                                const breadcrumbPath = projects && activeRequest && activeRequest.id ? findPathToRequest(projects, activeRequest.id) : null;

                                if (breadcrumbPath) {
                                    return (
                                        <>
                                            {breadcrumbPath.map((segment, i) => (
                                                <React.Fragment key={i}>
                                                    {i > 0 && <ChevronRight size={12} />}
                                                    <span>{segment}</span>
                                                </React.Fragment>
                                            ))}
                                            <ChevronRight size={12} />
                                            <BreadcrumbActive>
                                                {activeRequest.name}
                                            </BreadcrumbActive>
                                        </>
                                    );
                                }
                                // Fallback
                                return (
                                    <>
                                        <span>{selectedOperation?.name}</span>
                                        {selectedOperation && <ChevronRight size={12} />}
                                        <BreadcrumbActive>
                                            {activeRequest.name}
                                        </BreadcrumbActive>
                                    </>
                                );
                            })()}
                        </BreadcrumbBar>

                        {/* Tabs Header */}
                        <TabsHeader>
                            <TabButton $active={activeTab === 'request'} onClick={() => setActiveTab('request')}>
                                Body
                            </TabButton>
                            <TabButton $active={activeTab === 'headers'} onClick={() => setActiveTab('headers')}>
                                Headers
                                {activeRequest.headers && Object.keys(activeRequest.headers).length > 0 && ` (${Object.keys(activeRequest.headers).length})`}
                            </TabButton>

                            {/* Params tab - only for REST requests */}
                            {activeRequest.requestType === 'rest' && (
                                <TabButton $active={activeTab === 'params'} onClick={() => setActiveTab('params')}>
                                    Params
                                    {activeRequest.restConfig?.queryParams && Object.keys(activeRequest.restConfig.queryParams).length > 0 && ` (${Object.keys(activeRequest.restConfig.queryParams).length})`}
                                </TabButton>
                            )}

                            {/* Variables tab - only for GraphQL requests */}
                            {activeRequest.requestType === 'graphql' && (
                                <TabButton $active={activeTab === 'variables'} onClick={() => setActiveTab('variables')}>
                                    Variables
                                    {activeRequest.graphqlConfig?.variables && Object.keys(activeRequest.graphqlConfig.variables).length > 0 && ' ✓'}
                                </TabButton>
                            )}
                            {!isHistoryMode && (
                                <>
                                    <TabButton $active={activeTab === 'assertions'} onClick={() => setActiveTab('assertions')}>
                                        Assertions
                                        {activeRequest.assertions && activeRequest.assertions.length > 0 && ` (${activeRequest.assertions.length})`}
                                        {response && response.assertionResults && (
                                            <TabMeta>
                                                {response.assertionResults.every((r: any) => r.status === 'PASS') ? '✔' : '❌'}
                                            </TabMeta>
                                        )}
                                    </TabButton>
                                    <TabButton $active={activeTab === 'extractors'} onClick={() => setActiveTab('extractors')}>
                                        <Code size={14} />
                                        Extractors
                                        {activeRequest.extractors && activeRequest.extractors.length > 0 && ` (${activeRequest.extractors.length})`}
                                    </TabButton>
                                    {/* Request Chaining Variables - show in test context only */}
                                    {activeView === SidebarView.TESTS && selectedTestCase && (
                                        <TabButton $active={activeTab === 'chainvars'} onClick={() => setActiveTab('chainvars')}>
                                            <Variable size={14} />
                                            Chain Vars
                                        </TabButton>
                                    )}
                                </>
                            )}
                            <TabButton $active={activeTab === 'auth'} onClick={() => setActiveTab('auth')}>
                                Auth
                                {activeRequest.wsSecurity && activeRequest.wsSecurity.type !== 'none' && ' ✓'}
                            </TabButton>
                            <TabButton $active={activeTab === 'attachments'} onClick={() => setActiveTab('attachments')}>
                                Attachments
                                {activeRequest.attachments && activeRequest.attachments.length > 0 && ` (${activeRequest.attachments.length})`}
                            </TabButton>

                            <TabsRight>
                                {/* Quick Format Actions - Keep These Visible */}
                                <IconButton
                                    title="Format XML Now"
                                    onClick={() => {
                                        const formatted = formatXml(activeRequest.request, alignAttributes, inlineElementValues);
                                        onUpdateRequest({ ...activeRequest, request: formatted });
                                        forceEditorUpdate();
                                    }}
                                    as={CompactIconButton}
                                >
                                    <Braces size={14} />
                                </IconButton>

                                {onOpenDevOps && config?.azureDevOps?.project && (
                                    <IconButton
                                        title="Add to Azure DevOps"
                                        onClick={onOpenDevOps}
                                        as={CompactIconButton}
                                    >
                                        <Cloud size={14} />
                                    </IconButton>
                                )}

                                {isReadOnly && onAddMockRule && (
                                    <CompactIconButtonWarning
                                        title="Import to Mock Rule"
                                        onClick={handleCreateMockRule}
                                    >
                                        <PlusSquare size={14} />
                                    </CompactIconButtonWarning>
                                )}

                                <Divider />

                                {/* Editor Settings Menu */}
                                <SettingsMenuWrapper ref={settingsMenuRef}>
                                    <IconButton
                                        title="Editor Settings"
                                        onClick={() => setShowEditorSettings(!showEditorSettings)}
                                        active={showEditorSettings}
                                        as={CompactIconButton}
                                    >
                                        <Settings size={14} />
                                    </IconButton>
                                    
                                    {showEditorSettings && (
                                        <EditorSettingsMenu>
                                            <MenuSection>
                                                <MenuSectionTitle>Font Settings</MenuSectionTitle>
                                                <MenuRow>
                                                    <MenuLabel>
                                                        <Type size={14} />
                                                        Font Size
                                                    </MenuLabel>
                                                    <MenuControls>
                                                        <MenuIconButton
                                                            onClick={() => {
                                                                console.log('[Button] Minus clicked, current:', editorFontSize);
                                                                handleFontSizeChange(Math.max(8, editorFontSize - 1));
                                                            }}
                                                            disabled={editorFontSize <= 8}
                                                            title="Decrease"
                                                        >
                                                            <Minus size={12} />
                                                        </MenuIconButton>
                                                        <FontSizeDisplay>{editorFontSize}px</FontSizeDisplay>
                                                        <MenuIconButton
                                                            onClick={() => {
                                                                console.log('[Button] Plus clicked, current:', editorFontSize);
                                                                handleFontSizeChange(Math.min(24, editorFontSize + 1));
                                                            }}
                                                            disabled={editorFontSize >= 24}
                                                            title="Increase"
                                                        >
                                                            <Plus size={12} />
                                                        </MenuIconButton>
                                                    </MenuControls>
                                                </MenuRow>
                                                <MenuRow>
                                                    <MenuLabel>
                                                        <Type size={14} />
                                                        Font Family
                                                    </MenuLabel>
                                                    <select
                                                        value={editorFontFamily}
                                                        onChange={(e) => handleFontFamilyChange(e.target.value)}
                                                        style={{
                                                            background: 'var(--apinox-dropdown-background)',
                                                            color: 'var(--apinox-dropdown-foreground)',
                                                            border: '1px solid var(--apinox-dropdown-border)',
                                                            padding: '4px 8px',
                                                            borderRadius: '2px',
                                                            fontSize: '12px',
                                                            fontFamily: 'var(--apinox-font-family)',
                                                            cursor: 'pointer',
                                                            minWidth: '200px'
                                                        }}
                                                    >
                                                        {installedFonts.length > 0 ? (
                                                            installedFonts.map(font => (
                                                                <option key={font.name} value={font.value}>
                                                                    {font.name}
                                                                </option>
                                                            ))
                                                        ) : (
                                                            <option value='Consolas, "Courier New", monospace'>Consolas</option>
                                                        )}
                                                    </select>
                                                </MenuRow>
                                            </MenuSection>

                                            <MenuSection>
                                                <MenuSectionTitle>Formatting Options</MenuSectionTitle>
                                                <MenuRow>
                                                    <MenuLabel>
                                                        <WrapText size={14} />
                                                        Align Attributes
                                                    </MenuLabel>
                                                    <MenuIconButton
                                                        onClick={() => {
                                                            const newValue = !alignAttributes;
                                                            setAlignAttributes(newValue);
                                                            if (activeRequest.request) onUpdateRequest({ ...activeRequest, request: formatXml(activeRequest.request, newValue, inlineElementValues) });
                                                            forceEditorUpdate();
                                                        }}
                                                        className={alignAttributes ? 'active' : ''}
                                                        title={alignAttributes ? 'On' : 'Off'}
                                                    >
                                                        {alignAttributes ? 'On' : 'Off'}
                                                    </MenuIconButton>
                                                </MenuRow>

                                                {onToggleInlineElementValues && (
                                                    <MenuRow>
                                                        <MenuLabel>
                                                            <AlignLeft size={14} />
                                                            Inline Values
                                                        </MenuLabel>
                                                        <MenuIconButton
                                                            onClick={() => {
                                                                if (onToggleInlineElementValues) onToggleInlineElementValues();
                                                                const nextVal = !inlineElementValues;
                                                                if (activeRequest.request) {
                                                                    onUpdateRequest({ ...activeRequest, request: formatXml(activeRequest.request, alignAttributes, nextVal) });
                                                                    forceEditorUpdate();
                                                                }
                                                            }}
                                                            className={inlineElementValues ? 'active' : ''}
                                                            title={inlineElementValues ? 'Compact' : 'Expanded'}
                                                        >
                                                            {inlineElementValues ? 'On' : 'Off'}
                                                        </MenuIconButton>
                                                    </MenuRow>
                                                )}

                                                {onToggleHideCausalityData && (
                                                    <MenuRow>
                                                        <MenuLabel>
                                                            <Bug size={14} />
                                                            Hide Causality Data
                                                        </MenuLabel>
                                                        <MenuIconButton
                                                            onClick={onToggleHideCausalityData}
                                                            className={hideCausalityData ? 'active' : ''}
                                                            title={hideCausalityData ? 'Hidden' : 'Shown'}
                                                        >
                                                            {hideCausalityData ? 'On' : 'Off'}
                                                        </MenuIconButton>
                                                    </MenuRow>
                                                )}
                                            </MenuSection>
                                        </EditorSettingsMenu>
                                    )}
                                </SettingsMenuWrapper>

                                <Divider />

                                <StatText>Lines: {typeof activeRequest.request === 'string' ? activeRequest.request.split('\n').length : 0}</StatText>
                                <StatText>Size: {typeof activeRequest.request === 'string' ? (activeRequest.request.length / 1024).toFixed(2) : 0} KB</StatText>
                            </TabsRight>
                        </TabsHeader>

                        {activeTab === 'request' && (
                            <RequestEditorWrapper>
                                <MonacoRequestEditor
                                    ref={bodyEditorRef}
                                    value={hideCausalityData ? stripCausalityData(activeRequest.request) : activeRequest.request}
                                    language={
                                        // Dynamic language based on bodyType or requestType
                                        activeRequest.bodyType === 'json' ? 'json' :
                                            activeRequest.bodyType === 'graphql' ? 'graphql' :
                                                activeRequest.bodyType === 'text' ? 'plaintext' :
                                                    activeRequest.requestType === 'graphql' ? 'graphql' :
                                                        activeRequest.requestType === 'rest' ? 'json' :
                                                            'xml'
                                    }
                                    readOnly={isReadOnly && activeView !== SidebarView.PROJECTS && activeView !== SidebarView.EXPLORER}
                                    onChange={(val) => {
                                        console.log('[WorkspaceLayout] Body editor onChange triggered, val length:', val?.length);
                                        onUpdateRequest({ ...activeRequest, request: val });
                                    }}
                                    onFocus={() => lastFocusedRef.current = bodyEditorRef.current}
                                    autoFoldElements={config?.ui?.autoFoldElements}
                                    showLineNumbers={showLineNumbers}
                                    requestId={activeRequest.id || activeRequest.name}
                                    forceUpdateKey={editorForceUpdateKey}
                                    fontSize={editorFontSize}
                                    fontFamily={editorFontFamily}
                                    availableVariables={availableVariables}
                                />
                                {/* Format Button Overlay */}
                            </RequestEditorWrapper>
                        )}
                        {activeTab === 'headers' && (
                            <PanelColumn>
                                <PanelBody $padded={isReadOnly || isStructureLocked}>
                                    {!isReadOnly && !isStructureLocked ? (
                                        <HeadersPanel
                                            headers={activeRequest.headers || {}}
                                            onChange={(newHeaders) => onUpdateRequest({ ...activeRequest, headers: newHeaders })}
                                            contentType={activeRequest.contentType}
                                        />
                                    ) : (
                                        <HeadersViewer>
                                            <HeadersTitle>Request Headers</HeadersTitle>
                                            {activeRequest.headers && Object.keys(activeRequest.headers).length > 0 ? (
                                                Object.entries(activeRequest.headers).map(([key, value]) => (
                                                    <HeadersRow key={key}>
                                                        <HeadersKey>{key}:</HeadersKey>
                                                        <HeadersValue>{String(value)}</HeadersValue>
                                                    </HeadersRow>
                                                ))
                                            ) : (
                                                <HeadersEmpty>No headers captured.</HeadersEmpty>
                                            )}
                                        </HeadersViewer>
                                    )}
                                </PanelBody>
                                {response && response.headers && (
                                    <ResponseHeadersContainer>
                                        <HeadersTitle>Response Headers</HeadersTitle>
                                        {Object.entries(response.headers).map(([key, value]) => (
                                            <HeadersRow key={key}>
                                                <HeadersKey>{key}:</HeadersKey>
                                                <HeadersValue>{String(value)}</HeadersValue>
                                            </HeadersRow>
                                        ))}
                                    </ResponseHeadersContainer>
                                )}
                            </PanelColumn>
                        )}
                        {/* Query Params Panel - REST only */}
                        {activeTab === 'params' && activeRequest.requestType === 'rest' && (
                            <PanelColumn>
                                <QueryParamsPanel
                                    params={activeRequest.restConfig?.queryParams || {}}
                                    onChange={(newParams) => onUpdateRequest({
                                        ...activeRequest,
                                        restConfig: { ...activeRequest.restConfig, queryParams: newParams }
                                    })}
                                    title="Query Parameters"
                                    readOnly={isReadOnly || isStructureLocked}
                                />
                            </PanelColumn>
                        )}
                        {/* GraphQL Variables Panel - GraphQL only */}
                        {activeTab === 'variables' && activeRequest.requestType === 'graphql' && (
                            <PanelColumn>
                                <GraphQLVariablesPanel
                                    variables={activeRequest.graphqlConfig?.variables}
                                    operationName={activeRequest.graphqlConfig?.operationName}
                                    onChange={(newVars) => onUpdateRequest({
                                        ...activeRequest,
                                        graphqlConfig: { ...activeRequest.graphqlConfig, variables: newVars }
                                    })}
                                    onOperationNameChange={(name) => onUpdateRequest({
                                        ...activeRequest,
                                        graphqlConfig: { ...activeRequest.graphqlConfig, operationName: name }
                                    })}
                                />
                            </PanelColumn>
                        )}
                        {activeTab === 'assertions' && (
                            <AssertionsPanel
                                assertions={activeRequest.assertions || []}
                                onChange={(newAssertions) => onUpdateRequest({ ...activeRequest, assertions: newAssertions })}
                                lastResult={response?.assertionResults}
                            />
                        )}
                        {activeTab === 'extractors' && (
                            <ExtractorsPanel
                                extractors={activeRequest.extractors || []}
                                onChange={(newExtractors) => onUpdateRequest({ ...activeRequest, extractors: newExtractors })}
                                onEdit={onEditExtractor}
                                rawResponse={response?.rawResponse}
                            />
                        )}
                        {activeTab === 'chainvars' && (
                            <VariablesPanel
                                testCase={selectedTestCase}
                                currentStepId={selectedStep?.id || null}
                                testExecution={testExecution}
                            />
                        )}
                        {activeTab === 'auth' && (
                            activeRequest.requestType === 'rest' || activeRequest.requestType === 'graphql' ? (
                                <RestAuthPanel
                                    auth={activeRequest.restConfig?.auth}
                                    onChange={(newAuth) => onUpdateRequest({
                                        ...activeRequest,
                                        restConfig: { ...activeRequest.restConfig, auth: newAuth }
                                    })}
                                    readOnly={isReadOnly || isStructureLocked}
                                />
                            ) : (
                                <SecurityPanel
                                    security={activeRequest.wsSecurity}
                                    onChange={(newSecurity) => onUpdateRequest({ ...activeRequest, wsSecurity: newSecurity })}
                                />
                            )
                        )}
                        {activeTab === 'attachments' && (
                            <AttachmentsPanel
                                attachments={activeRequest.attachments || []}
                                onChange={(newAttachments) => onUpdateRequest({ ...activeRequest, attachments: newAttachments })}
                            />
                        )}
                    </RequestPane>

                    {/* Resizer */}
                    {(response || loading) && (
                        <SplitResizer
                            onMouseDown={onStartResizing}
                            $layoutMode={layoutMode}
                            $isResizing={isResizing}
                        />
                    )}

                    {/* Debug visibility */}
                    {(() => { console.log('[WorkspaceLayout] Rendering Response Section', { response: !!response, loading, splitRatio }); return null; })()}

                    {/* Response Section */}
                    {(response || loading) && (
                        <ResponseSection data-testid="response-section" $layoutMode={layoutMode}>
                            <ResponseHeader>
                                <ResponseHeaderLeft>
                                    <span>Response</span>
                                    {selection && onAddExtractor && !isReadOnly && currentXPath && (
                                        <ResponseHeaderActions>
                                            {selection.text && (
                                                <>
                                                    <MiniToolbarButton onClick={handleCreateExtractor}>
                                                        <MiniButtonIcon><Bug size={12} /></MiniButtonIcon> Extract
                                                    </MiniToolbarButton>
                                                    {onAddAssertion && (
                                                        <MiniToolbarButton onClick={handleCreateAssertion}>
                                                            <MiniButtonIcon><Braces size={12} /></MiniButtonIcon> Match
                                                        </MiniToolbarButton>
                                                    )}
                                                </>
                                            )}
                                            {onAddExistenceAssertion && (
                                                <MiniToolbarButton onClick={handleCreateExistenceAssertion}>
                                                    <MiniButtonIcon><ListChecks size={12} /></MiniButtonIcon> Exists
                                                </MiniToolbarButton>
                                            )}
                                        </ResponseHeaderActions>
                                    )}
                                    {/* Replace Rule button for Proxy view */}
                                    {selection && selection.text && isReadOnly && onAddReplaceRule && currentXPath && (
                                        <MiniToolbarButton
                                            onClick={() => handleCreateReplaceRule('response')}
                                            title="Create a replace rule for this selection"
                                        >
                                            <MiniButtonIcon><Replace size={12} /></MiniButtonIcon> Add Replace Rule
                                        </MiniToolbarButton>
                                    )}
                                </ResponseHeaderLeft>
                                {response && (
                                    <ResponseStats>
                                        {/* ... stats ... */}
                                        <StatText>Lines: {response.lineCount || 0}</StatText>
                                        <StatText>Time: {(response.duration || 0).toFixed(1)}s</StatText>
                                        <StatText>Size: {typeof response.rawResponse === 'string' ? (response.rawResponse.length / 1024).toFixed(2) : 0} KB</StatText>
                                        {response.createdAt && (
                                            <StatText>Received: {new Date(response.createdAt).toLocaleTimeString()}</StatText>
                                        )}
                                        {response.headers && response.headers['content-type'] && (
                                            <ResponseContentType title="Content-Type">
                                                {response.headers['content-type'].split(';')[0]}
                                            </ResponseContentType>
                                        )}
                                        <ResponseStatus $success={response.success}>
                                            {response.success ? '200 OK' : 'Error'}
                                        </ResponseStatus>
                                    </ResponseStats>
                                )}
                            </ResponseHeader>
                            <MonacoResponseViewer
                                value={(() => {
                                    const raw = response ? (response.rawResponse ? response.rawResponse : (response.error || '')) : '';
                                    const viewerLanguage = response?.language || 'xml';
                                    if (!raw) return '';
                                    if (viewerLanguage === 'json') return raw;
                                    return formatXml(raw, alignAttributes, inlineElementValues);
                                })()}
                                language={response?.language || 'xml'}
                                showLineNumbers={showLineNumbers}
                                onSelectionChange={setSelection}
                                autoFoldElements={config?.ui?.autoFoldElements}
                                fontSize={editorFontSize}
                                fontFamily={editorFontFamily}
                            />
                        </ResponseSection>
                    )}
                </EditorSplitContainer>
            </WorkspaceBody>

            <MainFooter>
                <IconButton onClick={onToggleLineNumbers} active={showLineNumbers} title="Toggle Line Numbers">
                    <ListOrdered size={16} />
                </IconButton>

                <IconButton onClick={onToggleLayout} title="Toggle Layout (Vertical/Horizontal)">
                    <LayoutIcon size={16} />
                </IconButton>
            </MainFooter>
        </Content >
    );
};



