import React, { Suspense } from 'react';
import { Play, ChevronLeft, GitBranch, Clock, FileCode, FileText, RefreshCw } from 'lucide-react';
// Models imported via props.ts indirections, specific enums kept if needed locally (TestStepType is used in code?)
// Checking code: TestStepType is used in props interface but not local var?
// Actually TestStepType is used in onAddStep signature but onAddStep comes from props.
// Let's remove them and add back if needed.
import { SidebarView, RequestType, BodyType, HttpMethod, WorkflowStep, ApiRequest, TestStep } from '@shared/models';
import { bridge } from '../utils/bridge';
import { CustomXPathEvaluator } from '../utils/xpathEvaluator';
import { XPathGenerator } from '../utils/xpathGenerator';
import { useMobileLayout } from '../hooks/useMobileLayout';

import { ErrorBoundary, formatXml, stripCausalityData, formatContent, formatJson, validateUrl, validateJson, validateXml } from '@apinox/request-editor/core';
import { RequestWorkspace, MonacoRequestEditorWithToolbar as MonacoRequestEditor, MonacoResponseViewer, MonacoSingleLineInput, AssertionsPanel, HeadersPanel, SecurityPanel, AttachmentsPanel, ExtractorsPanel, VariablesPanel, QueryParamsPanel, RestAuthPanel, GraphQLVariablesPanel, ScriptEditor } from '@apinox/request-editor/monaco';
import type { ApiRequest as PackageApiRequest, ExecutionResponse as PackageExecutionResponse, Variable as PackageVariable, MonacoRequestEditorHandle, MonacoSingleLineInputHandle } from '@apinox/request-editor/monaco';
import { WelcomePanel, TestCaseView, EmptyTestCase } from './workspace';
import { RequestStepEditor } from './workspace/RequestStepEditor';
import { DelayStepEditor } from './workspace/DelayStepEditor';
import { ConditionStepEditor } from './workspace/ConditionStepEditor';
import { TestCaseStepEditor } from './workspace/TestCaseStepEditor';
import { LoopStepEditor } from './workspace/LoopStepEditor';
import { ScriptStepEditor } from './workspace/ScriptStepEditor';
import { EmptyState } from './common/EmptyState';
import { CustomSelect } from './common/CustomSelect';
import { TestSuiteSummary } from './workspace/TestSuiteSummary';
import { PerformanceSuiteEditor } from './workspace/PerformanceSuiteEditor';
import { findPathToRequest } from '../utils/projectUtils';
import { useWorkspace } from '../contexts/WorkspaceContext';

const ProxyPanel = React.lazy(() =>
    import('./proxy/ProxyPanel').then(module => ({ default: module.ProxyPanel }))
);
const RulesAndMockPage = React.lazy(() =>
    import('./proxy/RulesAndMockPage').then(module => ({ default: module.RulesAndMockPage }))
);

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
    MenuRow,
    MenuLabel,
    MenuControls,
    FontSizeDisplay,
    MenuIconButton,
    SettingsMenuWrapper
} from '../styles/WorkspaceLayout.styles';

/**
 * WorkspaceLayout - Main workspace component for editing requests and tests
 * 
 * Uses useWorkspace() hook to access all state instead of receiving props.
 * This eliminates the need for ~140 lines of prop passing from MainContent.
 */
export const WorkspaceLayout: React.FC = () => {
    // Consume workspace context - replaces all prop groups
    const workspace = useWorkspace();

    // Destructure all needed state from context
    const {
        // PROJECT STATE
        projects,
        dirtyProjects,
        selectedProjectName,
        setProjects,
        
        // SELECTION STATE - Interface/Operation/Request
        selectedInterface,
        selectedOperation,
        selectedRequest,
        
        // SELECTION STATE - Test Cases
        selectedTestSuite,
        selectedTestCase,
        testCases: globalTestCases,
        selectedTestStep: selectedStep,  // Alias for backward compatibility
        
        // SELECTION STATE - Performance
        selectedPerformanceSuiteId,
        performanceHistory,
        performanceProgress,
        coordinatorStatus,
        
        // REQUEST/RESPONSE STATE
        response,
        loading,
        
        // UI STATE - Layout & Editor
        layoutMode,
        showLineNumbers,
        splitRatio,
        isResizing,
        
        // CONFIG STATE
        config,
        defaultEndpoint,
        isReadOnly: isHistoryMode,
        backendConnected
    } = workspace;

    // Get selected project from projects array
    const selectedProject = React.useMemo(() => {
        return projects.find(p => p.name === selectedProjectName) || null;
    }, [projects, selectedProjectName]);

    // Map context actions to existing variable names for minimal disruption
    const onExecute = workspace.executeRequest;
    const onCancel = workspace.cancelRequest;
    const rawOnUpdateRequest = workspace.updateRequest;
    const onReset = workspace.resetRequest;
    const onToggleLayout = workspace.toggleLayout;
    const onToggleLineNumbers = workspace.toggleLineNumbers;
    const onStartResizing = workspace.setIsResizing;
    const activeView = workspace.activeView;
    const inlineElementValues = workspace.inlineElementValues;
    const onToggleInlineElementValues = workspace.setInlineElementValues;
    const hideCausalityData = workspace.hideCausalityData;
    const onToggleHideCausalityData = workspace.setHideCausalityData;
    
    // Navigation actions (for backward compatibility)
    const navigationActions = {
        onSelectInterface: workspace.selectInterface,
        onSelectOperation: workspace.selectOperation,
        onSelectRequest: workspace.selectRequest,
        onSelectTestCase: workspace.selectTestCase
    };
    
    // Test runner actions
    const testExecution = workspace.testExecution;
    const onAddAssertion = workspace.handleAddAssertion;
    const onRunTestCase = workspace.handleRunTestCase;
    const onRunTestSuite = workspace.handleRunTestSuite;
    const updateTestSuiteVariables = workspace.updateTestSuiteVariables;
    const updateTestCaseVariables = workspace.updateTestCaseVariables;
    const onAddExtractor = workspace.handleAddExtractor;
    const onAddExistenceAssertion = workspace.handleAddExistenceAssertion;
    const onImportFromWorkspace = workspace.onImportFromWorkspace;
    const onUpdateStep = workspace.updateTestStep;
    const onSelectStep = workspace.selectTestStep;
    const onDeleteStep = workspace.deleteTestStep;
    const onMoveStep = workspace.moveTestStep;
    const onAddStep = workspace.addTestStep;
    const onBackToCase = workspace.backToTestCase;
    const onOpenStepRequest = workspace.openStepRequest;
    
    // Performance actions
    const onAddPerformanceSuite = workspace.handleAddPerformanceSuite;
    const onDeletePerformanceSuite = workspace.handleDeletePerformanceSuite;
    const onAddPerformanceRequest = workspace.handleAddPerformanceRequest;
    const onAddPerformanceTestCase = workspace.handleAddPerformanceTestCase;
    const onDeletePerformanceRequest = workspace.handleDeletePerformanceRequest;
    const onUpdatePerformanceRequest = workspace.handleUpdatePerformanceRequest;
    const onSelectPerformanceRequest = workspace.handleSelectPerformanceRequest;
    const onRunPerformanceSuite = workspace.handleRunPerformanceSuite;
    const onStopPerformanceRun = workspace.handleStopPerformanceRun;
    const onSelectPerformanceSuite = workspace.handleSelectPerformanceSuite;
    const onUpdateSuite = workspace.handleUpdatePerformanceSuite;
    const onStartCoordinator = workspace.handleStartCoordinator;
    const onStopCoordinator = workspace.handleStopCoordinator;
    const onRunSuite = workspace.handleRunPerformanceSuite;
    const onStopRun = workspace.handleStopPerformanceRun;
    
    // Calculate selectedPerformanceSuite from config (similar to MainContent)
    const selectedPerformanceSuite = React.useMemo(() => {
        return config?.performanceSuites?.find((s: any) => s.id === selectedPerformanceSuiteId) || null;
    }, [config, selectedPerformanceSuiteId]);
    
    // Mobile layout hook
    const { isMobile } = useMobileLayout();

    // We use a single "activeRequest" variable throughout the component
    const activeRequest = selectedRequest;

    // For backward compatibility with existing code, we use effectiveRequest as well
    const effectiveRequest = activeRequest;

    const onUpdateRequest = React.useCallback((updated: any) => {
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

    // Environment/global variables for {{...}} tooltips in the single-line inputs.
    const availableEnvVariables = React.useMemo(() => {
        const env = config?.environments && config?.activeEnvironment
            ? config.environments[config.activeEnvironment]
            : undefined;
        if (!env) return [];
        return Object.entries(env).map(([name, value]) => ({
            name,
            value: value ?? null,
            source: 'environment',
        }));
    }, [config?.environments, config?.activeEnvironment]);



    const [alignAttributes, setAlignAttributes] = React.useState(false);
    const [showVariables, setShowVariables] = React.useState(false);
    const [showCodeSnippet, setShowCodeSnippet] = React.useState(false);

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
    
    // Validation state
    const [urlValidationError, setUrlValidationError] = React.useState<string | null>(null);
    const [bodyValidationError, setBodyValidationError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (config?.ui?.alignAttributes !== undefined) {
            setAlignAttributes(config.ui.alignAttributes);
        }
    }, [config?.ui?.alignAttributes]);

    React.useEffect(() => {
        if (prevAlignAttributesRef.current === alignAttributes) return;
        prevAlignAttributesRef.current = alignAttributes;

        if (preventEditing || !effectiveRequest?.request) return;

        const isXmlRequest = effectiveRequest.requestType !== 'rest'
            && effectiveRequest.bodyType !== 'json'
            && effectiveRequest.bodyType !== 'graphql'
            && effectiveRequest.bodyType !== 'text';

        if (!isXmlRequest || !activeRequest) return;

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
    };

    const handleCreateExistenceAssertion = () => {
        if (!selection || !response || !onAddExistenceAssertion || !currentXPath) return;

        onAddExistenceAssertion({ xpath: currentXPath });
    };

    // Validated execute handler - MUST be defined before any conditional returns
    const handleValidatedExecute = React.useCallback(() => {
        if (!activeRequest) return;
        
        // Validate URL
        const urlResult = validateUrl(activeRequest.endpoint || '');
        if (!urlResult.valid) {
            setUrlValidationError(urlResult.error || 'Invalid URL');
            console.error('❌ URL validation failed:', urlResult.error);
            // Show user-friendly error via alert (could be replaced with toast notification)
            alert(`Cannot execute request:\n\n${urlResult.error || 'Invalid URL'}`);
            return;
        }
        setUrlValidationError(null);
        
        // Validate body based on type
        const bodyType = activeRequest.bodyType || 'xml';
        if (bodyType === 'json') {
            const jsonResult = validateJson(activeRequest.request);
            if (!jsonResult.valid) {
                setBodyValidationError(jsonResult.details || jsonResult.error || 'Invalid JSON');
                console.error('❌ JSON validation failed:', jsonResult.details);
                alert(`Cannot execute request:\n\nInvalid JSON body:\n${jsonResult.details || jsonResult.error}`);
                return;
            }
        } else if (bodyType === 'xml') {
            const xmlResult = validateXml(activeRequest.request);
            if (!xmlResult.valid) {
                setBodyValidationError(xmlResult.error || 'Invalid XML');
                console.error('❌ XML validation failed:', xmlResult.error);
                alert(`Cannot execute request:\n\nInvalid XML body:\n${xmlResult.error}`);
                return;
            }
        }
        setBodyValidationError(null);
        
        // All validations passed - execute
        if (onExecute) {
            onExecute(activeRequest.request);
        }
    }, [activeRequest, onExecute]);

    const handleCreateReplaceRule = (_target: 'request' | 'response') => {
        // Replace rule and mock rule features removed - moved to APIprox
        /*
        if (!selection || !currentXPath || !onAddReplaceRule) return;

        onAddReplaceRule({ xpath: currentXPath, matchText: selection.text, target });
        */
    };

    const handleCreateMockRule = () => {
        // Mock rule features removed - moved to APIprox
        /*
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
        */
    };

    // PERFORMANCE VIEW - REMOVED: Moved to APIprox
    // Performance testing is now available in the APIprox project

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
                    testCases={globalTestCases}
                    onAddTestCase={onAddPerformanceTestCase}
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
    }

    // TESTS VIEW
    if (activeView === SidebarView.TESTS) {
        if (selectedTestSuite && !selectedTestCase) {
            return <TestSuiteSummary
                suite={selectedTestSuite}
                onSelectTestCase={navigationActions?.onSelectTestCase}
                onUpdateVariables={updateTestSuiteVariables ? (vars) => updateTestSuiteVariables(selectedTestSuite.id, vars) : undefined}
            />;
        }

        // TESTS: condition step — reuse the ConditionStepEditor by shaping a
        // pseudo WorkflowStep from this test step's config (the editor only
        // reads name + condition).
        if (selectedStep && selectedStep.type === 'condition' && !isReadOnly && onUpdateStep) {
            const pseudo: WorkflowStep = {
                id: selectedStep.id,
                name: selectedStep.name,
                type: 'condition',
                order: 0,
                condition: selectedStep.config?.condition,
            };
            return (
                <Content>
                    <Toolbar>
                        {onBackToCase && (
                            <ToolbarButton onClick={onBackToCase} title="Back to Test Case">
                                <ChevronLeft size={14} /> Back
                            </ToolbarButton>
                        )}
                        <DelayTitle>Condition Configuration</DelayTitle>
                    </Toolbar>
                    <DelayContent>
                        <ConditionStepEditor
                            step={pseudo}
                            onUpdate={(updated) => onUpdateStep({
                                ...selectedStep,
                                name: updated.name,
                                config: { ...selectedStep.config, condition: updated.condition },
                            })}
                        />
                    </DelayContent>
                </Content>
            );
        }

        // TESTS: loop step — same adapter, reusing the workflow LoopStepEditor
        // (it only reads/writes name + loop + loopSteps).
        if (selectedStep && selectedStep.type === 'loop' && !isReadOnly && onUpdateStep) {
            const pseudo: WorkflowStep = {
                id: selectedStep.id,
                name: selectedStep.name,
                type: 'loop',
                order: 0,
                loop: selectedStep.config?.loop,
                loopSteps: selectedStep.config?.loopSteps,
            };
            return (
                <Content>
                    <Toolbar>
                        {onBackToCase && (
                            <ToolbarButton onClick={onBackToCase} title="Back to Test Case">
                                <ChevronLeft size={14} /> Back
                            </ToolbarButton>
                        )}
                        <DelayTitle>Loop Configuration</DelayTitle>
                    </Toolbar>
                    <DelayContent>
                        <LoopStepEditor
                            step={pseudo}
                            onUpdate={(updated) => onUpdateStep({
                                ...selectedStep,
                                name: updated.name,
                                config: {
                                    ...selectedStep.config,
                                    loop: updated.loop,
                                    loopSteps: updated.loopSteps,
                                },
                            })}
                        />
                    </DelayContent>
                </Content>
            );
        }

        // TESTS: testCase step — mirror the referenced-case screen with the
        // global case list (select the referenced case, preview its steps,
        // override its variables). Save-time cycle guard lives in
        // handleUpdateStep (see useWorkspaceCallbacks).
        if (selectedStep && selectedStep.type === 'testCase' && !isReadOnly && onUpdateStep) {
            const cases = globalTestCases || [];
            const referencedCase = cases.find(c => c.id === selectedStep.config?.testCaseId);
            const tcSteps = referencedCase?.steps || [];
            const tcStepIcon = (type: string) => {
                switch (type) {
                    case 'delay': return <Clock size={13} />;
                    case 'script': return <FileCode size={13} />;
                    case 'condition': return <GitBranch size={13} />;
                    case 'loop': return <RefreshCw size={13} />;
                    case 'testCase': return <FileText size={13} />;
                    case 'request':
                    default: return <FileText size={13} />;
                }
            };
            const tcStepMeta = (s: TestStep) => {
                switch (s.type) {
                    case 'delay':
                        return `${s.config?.delayMs ?? 0} ms`;
                    case 'condition':
                        return s.config?.condition?.expression || '';
                    case 'loop':
                        return s.config?.loop
                            ? `${s.config.loop.type === 'count' ? (s.config.loop.count ?? 0) + 'x' : s.config.loop.type} · ${s.config.loopSteps?.length || 0} steps`
                            : '';
                    case 'testCase':
                        return s.config?.testCaseId || '';
                    case 'request':
                    default: {
                        const method = s.config?.request?.method || 'POST';
                        const target = s.config?.request?.name || '';
                        return target ? `${method} ${target}` : method;
                    }
                }
            };

            return (
                <Content>
                    <Toolbar>
                        {onBackToCase && (
                            <ToolbarButton onClick={onBackToCase} title="Back to Test Case">
                                <ChevronLeft size={14} /> Back
                            </ToolbarButton>
                        )}
                        <DelayTitle>Test Case Configuration</DelayTitle>
                    </Toolbar>
                    <DelayContent>
                        <h2>Step: {selectedStep.name}</h2>
                        <DelayField>
                            <DelayLabel>Test Case:</DelayLabel>
                            {/* Themed CustomSelect — a native <select>'s dropdown
                                list is OS-rendered and ignores the app skin. */}
                            <CustomSelect
                                value={selectedStep.config?.testCaseId || ''}
                                placeholder="Select a test case..."
                                onChange={(value) => {
                                    onUpdateStep({
                                        ...selectedStep,
                                        config: { ...selectedStep.config, testCaseId: value }
                                    });
                                }}
                                options={[
                                    { value: '', label: 'Select a test case...' },
                                    ...cases.map((c) => ({ value: c.id, label: c.name }))
                                ]}
                            />
                        </DelayField>
                        <DelayField>
                            <DelayLabel>Test Case steps{referencedCase ? ` (${tcSteps.length})` : ''}:</DelayLabel>
                            {referencedCase && tcSteps.length > 0 ? (
                                <div style={{ border: '1px solid var(--apinox-panel-border)', borderRadius: '2px', overflow: 'hidden' }}>
                                    {tcSteps.map((s: TestStep, i: number) => (
                                        <div
                                            key={s.id}
                                            title={s.name}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                padding: '6px 10px',
                                                fontSize: '13px',
                                                borderTop: i ? '1px solid var(--apinox-panel-border)' : 'none'
                                            }}
                                        >
                                            <span style={{ opacity: 0.6, display: 'inline-flex', flexShrink: 0 }}>
                                                {tcStepIcon(s.type)}
                                            </span>
                                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {s.name}
                                            </span>
                                            {tcStepMeta(s) && (
                                                <span style={{ fontSize: '11px', opacity: 0.6, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                    {tcStepMeta(s)}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{
                                    fontSize: '12px',
                                    opacity: 0.6,
                                    padding: '8px 10px',
                                    border: '1px dashed var(--apinox-panel-border)',
                                    borderRadius: '2px'
                                }}>
                                    {referencedCase
                                        ? 'This test case has no steps yet.'
                                        : 'Select a test case to see its steps here.'}
                                </div>
                            )}
                            {referencedCase && tcSteps.length > 0 && (
                                <div style={{ fontSize: '11px', color: 'var(--apinox-descriptionForeground)', marginTop: '8px' }}>
                                    Read-only — edit these steps in the TESTS view.
                                </div>
                            )}
                        </DelayField>
                        <DelayField>
                            <DelayLabel>Override Variables (JSON):</DelayLabel>
                            {/* Shows the referenced case's variables with their
                                default values (plus any saved overrides) so the
                                user can see what's available and change values.
                                Only values that differ from the defaults are
                                persisted as overrides. */}
                            <textarea
                                value={JSON.stringify({
                                    ...(referencedCase?.variables || {}),
                                    ...(selectedStep.config.testCaseVariables || {})
                                }, null, 2)}
                                onChange={(e) => {
                                    try {
                                        const edited = JSON.parse(e.target.value) as Record<string, unknown>;
                                        const defaults = (referencedCase?.variables || {}) as Record<string, string>;
                                        const overrides: Record<string, string> = {};
                                        for (const [k, v] of Object.entries(edited)) {
                                            if (!(k in defaults) || defaults[k] !== v) {
                                                overrides[k] = String(v);
                                            }
                                        }
                                        onUpdateStep({
                                            ...selectedStep,
                                            config: { ...selectedStep.config, testCaseVariables: overrides }
                                        });
                                    } catch (err) {
                                        // Invalid JSON - don't update
                                        console.error('Invalid JSON for test case variables:', err);
                                    }
                                }}
                                rows={8}
                                placeholder={referencedCase
                                    ? '{"variable1": "value1"}'
                                    : 'Select a test case to see its variables'}
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
                                {referencedCase
                                    ? "Values override the referenced case's own variables (which override its suite's and the environment). Only changed values are saved as overrides; references are cycle-checked on save."
                                    : 'Values override the referenced case\'s own variables. References are cycle-checked on save.'}
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
                    onUpdateVariables={(vars) => updateTestCaseVariables(selectedTestCase.id, vars)}
                    testCases={globalTestCases}
                    projects={projects}
                />
            );
        }

        if (!selectedTestCase) {
            return <EmptyTestCase />;
        }
    }

    // Phase B (t_86c34d38): the PROJECTS view was deleted. Its dedicated
    // summary/empty-state rendering (OperationSummary / InterfaceSummary /
    // ProjectSummary / EmptyProject + create-request-from-sample) is gone with
    // it — the shared request editor below (fall-through) is now the only
    // render path for non-UNIFIED views (TESTS steps, PROXY, ...).

    // PROXY VIEW
    if (activeView === SidebarView.PROXY) {
        return (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Suspense fallback={<div style={{ flex: 1, background: 'var(--apinox-editor-background)' }} />}>
                    <ProxyPanel onNavigateTo={(_view) => workspace.selectInterface(null)} />
                </Suspense>
            </div>
        );
    }

    // MOCK/RULES VIEW
    if (activeView === SidebarView.MOCK) {
        return (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Suspense fallback={<div style={{ flex: 1, background: 'var(--apinox-editor-background)' }} />}>
                    <RulesAndMockPage />
                </Suspense>
            </div>
        );
    }

    // Fallback for other views that usually show Welcome if no request selected
    if (!effectiveRequest) {
        if (selectedStep && selectedStep.type === 'script' && onUpdateStep) {
            return (
                <ScriptEditor
                    step={selectedStep}
                    onUpdate={(step) => onUpdateStep(step as unknown as TestStep)}
                    isReadOnly={isReadOnly}
                    onBack={onBackToCase}
                />
            );
        }
        return <WelcomePanel />;
    }

    // TypeScript flow analysis: After the guard above, activeRequest is guaranteed to be non-null
    // Add a type assertion to help TypeScript understand this
    if (!activeRequest) {
        throw new Error('[WorkspaceLayout] Invariant violation: activeRequest should not be null after effectiveRequest check');
    }


    // For the main rendering, use effectiveRequest as the current request
    // This avoids having to change hundreds of references throughout the component
    const currentRequest = effectiveRequest;

    // File picker callback for form-data and binary uploads
    // TODO: Implement proper binary file reading via Tauri command
    // 
    // IMPLEMENTATION NEEDED:
    // 1. Add Tauri command in src-tauri/src/main.rs:
    //    #[tauri::command]
    //    fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    //        std::fs::read(path).map_err(|e| e.to_string())
    //    }
    // 
    // 2. Register command in tauri::Builder:
    //    .invoke_handler(tauri::generate_handler![read_binary_file])
    // 
    // 3. Update this function to call the command:
    //    const { invoke } = await import('@tauri-apps/api/core');
    //    const bytes = await invoke<number[]>('read_binary_file', { path: selected });
    //    const base64 = btoa(String.fromCharCode(...bytes));
    //    return { name, content: base64, contentType, size: bytes.length };
    const handlePickFile = async (): Promise<{ name: string; content: string; contentType: string; size: number } | null> => {
        try {
            // Import Tauri dialog API
            const { open } = await import('@tauri-apps/plugin-dialog');
            
            // Open file picker
            const selected = await open({
                multiple: false,
                directory: false
            });
            
            if (!selected || typeof selected !== 'string') return null;
            
            // Get file name
            const name = selected.split('/').pop() || selected.split('\\').pop() || 'file';
            
            // Detect content type from extension
            const ext = selected.split('.').pop()?.toLowerCase();
            let contentType = 'application/octet-stream';
            if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
            else if (ext === 'png') contentType = 'image/png';
            else if (ext === 'gif') contentType = 'image/gif';
            else if (ext === 'pdf') contentType = 'application/pdf';
            else if (ext === 'json') contentType = 'application/json';
            else if (ext === 'xml') contentType = 'application/xml';
            else if (ext === 'txt') contentType = 'text/plain';
            
            // TEMPORARY: Return placeholder until Tauri command is implemented
            // This allows the UI to work but files won't be uploaded yet
            console.warn('⚠️ File selected:', selected, 'but binary reading not yet implemented');
            console.warn('⚠️ See TODO comment above for implementation details');
            return {
                name,
                content: '', // FIXME: Empty for now - needs Tauri command to read binary
                contentType,
                size: 0      // FIXME: Actual size unknown without reading file
            };
        } catch (err) {
            console.error('File picker error:', err);
            return null;
        }
    };

    return (
        <Content>
            {/* Modal - temporarily disabled during package migration */}
            {/* <CodeSnippetModal
                isOpen={showCodeSnippet}
                onClose={() => setShowCodeSnippet(false)}
                request={currentRequest}
                environment={config?.environments && config?.activeEnvironment ? config.environments[config.activeEnvironment] : undefined}
            /> */}

            {/* Back navigation buttons */}
            {!isHistoryMode && selectedTestCase && (
                <Toolbar>
                    {/* Test case back button */}
                    {selectedTestCase && onBackToCase && (
                        <>
                            <ToolbarButton onClick={onBackToCase} title="Back to Test Case">
                                <ChevronLeft size={14} /> Back
                            </ToolbarButton>
                            <ToolbarSeparator />
                        </>
                    )}
                </Toolbar>
            )}

            {/* RequestWorkspace component */}
            <ErrorBoundary
                onError={(error, errorInfo) => {
                    console.error('💥 RequestWorkspace Error:', error);
                    console.error('Component Stack:', errorInfo.componentStack);
                }}
            >
                <RequestWorkspace
                    request={activeRequest as PackageApiRequest}
                response={response ? {
                    rawResponse: response.rawResponse,
                    status: response.status,
                    statusText: response.statusText,
                    time: response.time,
                    size: response.size,
                    headers: response.headers,
                    contentType: response.contentType,
                    // A transport failure arrives as `{ error }` with no body —
                    // without this the response pane rendered empty and the
                    // reason was lost.
                    error: response.error
                } as PackageExecutionResponse : undefined}
                loading={loading}
                onUpdateRequest={(updated) => onUpdateRequest(updated as any)}
                onExecute={handleValidatedExecute}
                onCancel={onCancel}
                onReset={onReset}
                readOnly={preventEditing}
                // Traffic-captured steps keep the captured Content-Type as the
                // source of truth (it may carry `action=...`), so their
                // Content-Type header row is always unlocked — the global
                // setting only governs every other request.
                contentTypeLocked={activeRequest?.fromTraffic ? false : (config?.ui?.contentTypeLocked ?? true)}
                defaultEndpoint={defaultEndpoint}
                availableVariables={availableVariables.map(v => ({
                    name: v.name,
                    value: v.value,
                    source: v.source
                }) as PackageVariable)}
                availableEnvVariables={availableEnvVariables as any}
                showBreadcrumb={false}
                breadcrumbPath={[]}
                onLog={(message, level = 'info') => {
                    console.log(`[${level.toUpperCase()}] ${message}`);
                }}
                initialEditorSettings={{
                    fontSize: config?.ui?.editorFontSize || 14,
                    fontFamily: config?.ui?.editorFontFamily || 'Consolas, "Courier New", monospace',
                    showLineNumbers: config?.ui?.showLineNumbers ?? true,
                    alignAttributes: config?.ui?.alignAttributes ?? false,
                    inlineValues: config?.ui?.inlineElementValues ?? true,
                    hideCausality: false
                }}
                initialLayoutMode={config?.ui?.layoutMode as 'vertical' | 'horizontal' ?? 'vertical'}
                layoutMode={isMobile ? 'horizontal' : undefined}
                onLayoutModeChange={(mode) => {
                    bridge.sendMessage({
                        command: 'saveUiState',
                        ui: {
                            ...config?.ui,
                            layoutMode: mode
                        }
                    });
                }}
                onEditorSettingsChange={(settings) => {
                    bridge.sendMessage({
                        command: 'saveUiState',
                        ui: {
                            ...config?.ui,
                            editorFontSize: settings.fontSize,
                            editorFontFamily: settings.fontFamily,
                            showLineNumbers: settings.showLineNumbers,
                            alignAttributes: settings.alignAttributes,
                            inlineElementValues: settings.inlineValues
                        }
                    });
                }}
                onPickFile={handlePickFile}
            />
            </ErrorBoundary>
        </Content >
    );
};


