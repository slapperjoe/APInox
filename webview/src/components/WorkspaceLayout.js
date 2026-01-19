import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from 'react';
import { Layout as LayoutIcon, ListOrdered, Play, Loader2, RotateCcw, WrapText, Bug, AlignLeft, Braces, ChevronLeft, ChevronRight, ListChecks, Replace, Cloud, PlusSquare, FileCode } from 'lucide-react';
// Models imported via props.ts indirections, specific enums kept if needed locally (TestStepType is used in code?)
// Checking code: TestStepType is used in props interface but not local var?
// Actually TestStepType is used in onAddStep signature but onAddStep comes from props.
// Let's remove them and add back if needed.
import { SidebarView } from '@shared/models';
// ... imports
import { MonacoRequestEditor } from './MonacoRequestEditor';
import { MonacoResponseViewer } from './MonacoResponseViewer';
import { AssertionsPanel } from './AssertionsPanel';
import { HeadersPanel } from './HeadersPanel';
import { SecurityPanel } from './SecurityPanel';
import { AttachmentsPanel } from './AttachmentsPanel';
import { ExtractorsPanel } from './ExtractorsPanel';
import { MonacoSingleLineInput } from './MonacoSingleLineInput';
import { formatXml, stripCausalityData } from '@shared/utils/xmlFormatter';
import { XPathGenerator } from '../utils/xpathGenerator';
import { CodeSnippetModal } from './modals/CodeSnippetModal';
import { WelcomePanel, TestCaseView, EmptyTestCase } from './workspace';
import { ApiExplorerMain } from './explorer/ApiExplorerMain';
import { EmptyState, EmptyFileWatcher, EmptyApiExplorer, EmptyServer, EmptyProject } from './workspace/EmptyStates';
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
import { Toolbar, InfoBarMethod, InfoBarUrl, ToolbarButton, MainFooter, IconButton, ToolbarSeparator, Content } from '../styles/WorkspaceLayout.styles';
// Helper Components
export const WorkspaceLayout = ({ projects, selectionState, requestActions, viewState, configState, stepActions, toolsActions, onUpdateSuite, onAddPerformanceRequest, onDeletePerformanceRequest, onSelectPerformanceRequest, onUpdatePerformanceRequest, onImportFromWorkspace, onRunSuite, onStopRun, performanceProgress, performanceHistory, onBackToSuite, navigationActions, coordinatorStatus, onStartCoordinator, onStopCoordinator, explorerState // Add this
 }) => {
    // Destructure groups
    const { project: selectedProject, interface: selectedInterface, operation: selectedOperation, request: selectedRequest, testCase: selectedTestCase, testSuite: selectedTestSuite, testStep: selectedStep, performanceSuite: selectedPerformanceSuite } = selectionState;
    const { onExecute, onCancel, onUpdate: rawOnUpdateRequest, onReset, response, loading } = requestActions;
    // Wrapper to add logging for debugging
    const onUpdateRequest = React.useCallback((updated) => {
        console.log('[WorkspaceLayout] onUpdateRequest called:', { requestName: updated?.name, requestId: updated?.id });
        rawOnUpdateRequest(updated);
    }, [rawOnUpdateRequest]);
    const forceEditorUpdate = React.useCallback(() => {
        setEditorForceUpdateKey(prev => prev + 1);
    }, []);
    const { activeView, // Now available
    layoutMode, showLineNumbers, splitRatio, isResizing, onToggleLayout, onToggleLineNumbers, onStartResizing, inlineElementValues, onToggleInlineElementValues, hideCausalityData, onToggleHideCausalityData } = viewState;
    const { config, defaultEndpoint, changelog, isReadOnly: isHistoryMode } = configState;
    // Derived read-only state
    const isStructureLocked = (activeView === SidebarView.PERFORMANCE || activeView === SidebarView.TESTS);
    const isContentLocked = (selectedRequest?.readOnly === true) ||
        (!isStructureLocked && selectedProject?.readOnly === true);
    const preventEditing = isHistoryMode || isContentLocked;
    const isReadOnly = preventEditing; // Defaults to preventing editing, specific overrides used below
    const { onRunTestCase, onOpenStepRequest, onBackToCase, onAddStep, testExecution, onUpdateStep, onSelectStep, onDeleteStep, onMoveStep } = stepActions;
    const { onAddExtractor, onEditExtractor, onAddAssertion, onAddExistenceAssertion, onAddReplaceRule, onAddMockRule, onOpenDevOps } = toolsActions;
    // Performance Actions extracted in props destructuring above
    const [alignAttributes, setAlignAttributes] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('request');
    const [showVariables, setShowVariables] = React.useState(false);
    const [showCodeSnippet, setShowCodeSnippet] = React.useState(false);
    // ... imports
    // Editor Refs for insertion
    const urlEditorRef = React.useRef(null);
    const bodyEditorRef = React.useRef(null);
    const lastFocusedRef = React.useRef(null);
    const [selection, setSelection] = React.useState(null);
    const [currentXPath, setCurrentXPath] = React.useState(null);
    const [editorForceUpdateKey, setEditorForceUpdateKey] = React.useState(0);
    React.useEffect(() => {
        if (selection && response?.rawResponse) {
            // Calculate XPath on selection change to determine button visibility
            const path = XPathGenerator.getPath(response.rawResponse, selection.offset);
            setCurrentXPath(path);
        }
        else {
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
        if (!selection || !response || !onAddExtractor)
            return;
        let path = null;
        const source = 'body';
        if (response.rawResponse) {
            path = XPathGenerator.getPath(response.rawResponse, selection.offset);
        }
        if (path) {
            onAddExtractor({ xpath: path, value: selection.text, source });
        }
        else {
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
        if (!selection || !response || !onAddExistenceAssertion || !currentXPath)
            return;
        onAddExistenceAssertion({ xpath: currentXPath });
        setActiveTab('assertions');
    };
    const handleCreateReplaceRule = (target) => {
        if (!selection || !currentXPath || !onAddReplaceRule)
            return;
        onAddReplaceRule({ xpath: currentXPath, matchText: selection.text, target });
    };
    const handleCreateMockRule = () => {
        if (!selectedRequest || !response || !onAddMockRule) {
            console.warn('[WorkspaceLayout] handleCreateMockRule aborted: missing data or callback');
            return;
        }
        const newRule = createMockRuleFromSource({
            url: selectedRequest.endpoint || '',
            statusCode: response.status || 200,
            responseBody: response.rawResponse || '',
            responseHeaders: response.headers || {},
        });
        onAddMockRule(newRule);
    };
    // PERFORMANCE VIEW
    if (activeView === SidebarView.PERFORMANCE) {
        const suiteHistory = (performanceHistory || []).filter(run => selectedPerformanceSuite ? run.suiteId === selectedPerformanceSuite.id : false);
        const performanceSchedules = config?.performanceSchedules || [];
        const isPerfRunning = !!performanceProgress;
        if (!selectedPerformanceSuite && !selectedRequest) {
            return _jsx(EmptyState, { title: "No Performance Suite Selected", description: "Pick or create a performance suite from the sidebar.", icon: Play });
        }
        if (selectedPerformanceSuite && !selectedRequest) {
            return (_jsx(PerformanceSuiteEditor, { suite: selectedPerformanceSuite, onUpdate: onUpdateSuite || (() => { }), onRun: onRunSuite || (() => { }), onStop: onStopRun || (() => { }), isRunning: isPerfRunning, onAddRequest: onAddPerformanceRequest, onDeleteRequest: onDeletePerformanceRequest, onUpdateRequest: onUpdatePerformanceRequest, onSelectRequest: onSelectPerformanceRequest, onImportFromWorkspace: onImportFromWorkspace, progress: performanceProgress || null, history: suiteHistory, schedules: performanceSchedules, coordinatorStatus: coordinatorStatus, onStartCoordinator: onStartCoordinator, onStopCoordinator: onStopCoordinator }));
        }
        // If a performance request is selected, fall through to the request editor below.
    }
    // TESTS VIEW
    if (activeView === SidebarView.TESTS) {
        if (selectedTestSuite && !selectedTestCase) {
            return _jsx(TestSuiteSummary, { suite: selectedTestSuite, onSelectTestCase: navigationActions?.onSelectTestCase });
        }
        if (selectedStep && selectedStep.type === 'delay' && !isReadOnly && onUpdateStep) {
            return (_jsxs(Content, { children: [_jsxs(Toolbar, { children: [onBackToCase && (_jsxs(ToolbarButton, { onClick: onBackToCase, title: "Back to Test Case", children: [_jsx(ChevronLeft, { size: 14 }), " Back"] })), _jsx("span", { style: { fontWeight: 'bold', marginLeft: 10 }, children: "Delay Configuration" })] }), _jsxs("div", { style: { padding: 20, color: 'var(--vscode-editor-foreground)', fontFamily: 'var(--vscode-font-family)' }, children: [_jsxs("h2", { children: ["Step: ", selectedStep.name] }), _jsxs("div", { style: { marginTop: 20 }, children: [_jsx("label", { style: { display: 'block', marginBottom: 5 }, children: "Delay Duration (milliseconds):" }), _jsx("input", { type: "number", style: {
                                            background: 'var(--vscode-input-background)',
                                            color: 'var(--vscode-input-foreground)',
                                            border: '1px solid var(--vscode-input-border)',
                                            padding: '5px',
                                            fontSize: '1em',
                                            width: '100px'
                                        }, value: selectedStep.config.delayMs || 0, onChange: (e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            onUpdateStep({ ...selectedStep, config: { ...selectedStep.config, delayMs: val } });
                                        } })] })] })] }));
        }
        if (selectedTestCase && !selectedStep) {
            return (_jsx(TestCaseView, { testCase: selectedTestCase, testExecution: testExecution, onRunTestCase: onRunTestCase, onAddStep: onAddStep, onSelectStep: onSelectStep, onMoveStep: onMoveStep, onDeleteStep: onDeleteStep, onOpenStepRequest: onOpenStepRequest }));
        }
        if (!selectedTestCase) {
            return _jsx(EmptyTestCase, {});
        }
    }
    // PROJECTS VIEW
    if (activeView === SidebarView.PROJECTS) {
        if (!selectedRequest) {
            if (selectedOperation)
                return _jsx(OperationSummary, { operation: selectedOperation, onSelectRequest: navigationActions?.onSelectRequest });
            if (selectedInterface)
                return _jsx(InterfaceSummary, { interface: selectedInterface, onSelectOperation: navigationActions?.onSelectOperation });
            if (selectedProject)
                return _jsx(ProjectSummary, { project: selectedProject, onSelectInterface: navigationActions?.onSelectInterface });
            return _jsx(EmptyProject, {});
        }
        // If request IS selected, fall through to Request Editor
    }
    // EXPLORER VIEW
    if (activeView === SidebarView.EXPLORER) {
        // If a request is selected, fall through to main render
        if (!selectedRequest && explorerState) {
            return (_jsx(ApiExplorerMain, { inputType: explorerState.inputType, setInputType: explorerState.setInputType, wsdlUrl: explorerState.wsdlUrl, setWsdlUrl: explorerState.setWsdlUrl, loadWsdl: explorerState.loadWsdl, downloadStatus: explorerState.downloadStatus, onClearSelection: explorerState.onClearSelection, selectedInterface: selectedInterface || undefined, selectedOperation: selectedOperation || undefined }));
        }
        else if (!selectedRequest) {
            return _jsx(EmptyApiExplorer, {});
        }
    }
    // WATCHER VIEW
    if (activeView === SidebarView.WATCHER) {
        // If an event is selected (it's a request), it will have been handled by selectedRequest above?
        // Wait, selectedRequest handles everything. If we are here, it means !selectedRequest.
        if (!selectedRequest) {
            return _jsx(EmptyFileWatcher, {});
        }
    }
    // SERVER VIEW
    if (activeView === SidebarView.SERVER) {
        // If a request is selected (from Proxy/Mock history), it falls through to main render
        if (!selectedRequest) {
            return _jsx(EmptyServer, {});
        }
    }
    // Fallback for other views that usually show Welcome if no request selected
    if (!selectedRequest) {
        if (selectedStep && selectedStep.type === 'script' && onUpdateStep) {
            return (_jsx(ScriptEditor, { step: selectedStep, onUpdate: onUpdateStep, isReadOnly: isReadOnly, onBack: onBackToCase }));
        }
        return _jsx(WelcomePanel, { changelog: changelog });
    }
    return (_jsxs(Content, { children: [_jsx(CodeSnippetModal, { isOpen: showCodeSnippet, onClose: () => setShowCodeSnippet(false), request: selectedRequest, environment: config?.environments && config?.activeEnvironment ? config.environments[config.activeEnvironment] : undefined }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }, children: [!isHistoryMode && (_jsxs(Toolbar, { children: [activeView === SidebarView.EXPLORER && !selectedTestCase && !selectedPerformanceSuite && navigationActions?.onSelectRequest && (_jsxs(_Fragment, { children: [_jsxs(ToolbarButton, { onClick: () => navigationActions.onSelectRequest(null), title: "Back to API Explorer", children: [_jsx(ChevronLeft, { size: 14 }), " Back"] }), _jsx(ToolbarSeparator, {})] })), selectedTestCase && onBackToCase && (_jsxs(_Fragment, { children: [_jsxs(ToolbarButton, { onClick: onBackToCase, title: "Back to Test Case", children: [_jsx(ChevronLeft, { size: 14 }), " Back"] }), _jsx(ToolbarSeparator, {})] })), !selectedTestCase && selectedPerformanceSuite && onBackToSuite && (_jsxs(_Fragment, { children: [_jsxs(ToolbarButton, { onClick: onBackToSuite, title: "Back to Performance Suite", children: [_jsx(ChevronLeft, { size: 14 }), " Back"] }), _jsx(ToolbarSeparator, {})] })), preventEditing || isStructureLocked ? (_jsxs("div", { style: { display: 'flex', alignItems: 'center', flex: 1, paddingLeft: 10, overflow: 'hidden' }, children: [_jsx(InfoBarMethod, { children: selectedRequest.method || 'POST' }), _jsx(InfoBarUrl, { title: selectedRequest.endpoint, style: { marginLeft: 10, fontSize: '1em' }, children: selectedRequest.endpoint })] })) : (_jsxs(_Fragment, { children: [_jsx(RequestTypeSelector, { requestType: selectedRequest.requestType, method: selectedRequest.method, bodyType: selectedRequest.bodyType, contentType: selectedRequest.contentType, onRequestTypeChange: (type) => onUpdateRequest({ ...selectedRequest, requestType: type }), onMethodChange: (method) => onUpdateRequest({ ...selectedRequest, method: method }), onBodyTypeChange: (type) => onUpdateRequest({ ...selectedRequest, bodyType: type }), onContentTypeChange: (ct) => onUpdateRequest({ ...selectedRequest, contentType: ct }), compact: true }), _jsx("div", { style: { flex: 1, minWidth: '150px' }, children: _jsx(MonacoSingleLineInput, { ref: urlEditorRef, value: selectedRequest.endpoint || defaultEndpoint || '', onChange: (val) => onUpdateRequest({ ...selectedRequest, endpoint: val }), placeholder: "Endpoint URL", readOnly: isReadOnly || isStructureLocked, onFocus: () => lastFocusedRef.current = urlEditorRef.current }) })] })), !selectedTestCase && !preventEditing && (_jsxs(ToolbarButton, { onClick: () => { onReset(); forceEditorUpdate(); }, title: "Revert to Default XML", children: [_jsx(RotateCcw, { size: 14 }), " Reset"] })), !selectedTestCase && (_jsxs(ToolbarButton, { onClick: () => setShowCodeSnippet(true), title: "Generate Code", children: [_jsx(FileCode, { size: 14 }), " Code"] })), loading ? (_jsxs(ToolbarButton, { onClick: onCancel, style: { backgroundColor: 'var(--vscode-errorForeground)' }, children: [_jsx(Loader2, { size: 14, className: "spin" }), " Cancel"] })) : (_jsxs(ToolbarButton, { onClick: () => {
                                    // Get current content from editor, falling back to selectedRequest.request
                                    // This allows users to edit read-only samples and test with the edited content
                                    const currentContent = bodyEditorRef.current?.getValue() ?? selectedRequest.request;
                                    onExecute(currentContent);
                                }, title: "Run Request", style: { color: 'var(--vscode-testing-iconPassed)' }, children: [_jsx(Play, { size: 14 }), " Run"] })), _jsx(ToolbarSeparator, {}), selectedTestCase && selectedStep && (_jsxs("div", { style: { position: 'relative' }, children: [_jsxs(ToolbarButton, { onClick: () => setShowVariables(!showVariables), title: "Insert/View Variables from Previous Steps", children: [_jsx(Braces, { size: 14 }), _jsx("span", { style: { marginLeft: 5 }, children: "Variables" })] }), showVariables && (_jsxs("div", { style: {
                                            position: 'absolute',
                                            top: '100%',
                                            right: 0,
                                            marginTop: 5,
                                            background: 'var(--vscode-editor-background)',
                                            border: '1px solid var(--vscode-dropdown-border)',
                                            borderRadius: 3,
                                            zIndex: 100,
                                            boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                                            minWidth: 250,
                                            maxHeight: 300,
                                            overflow: 'auto'
                                        }, children: [_jsx("div", { style: { padding: '8px', borderBottom: '1px solid var(--vscode-dropdown-border)', fontWeight: 'bold', fontSize: '0.9em' }, children: "Available Context Variables" }), (() => {
                                                const idx = selectedTestCase.steps.findIndex(s => s.id === selectedStep.id);
                                                const vars = [];
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
                                                    return _jsx("div", { style: { padding: 10, opacity: 0.7, fontSize: '0.9em' }, children: "No variables defined in previous steps." });
                                                }
                                                return vars.map((v, i) => (_jsxs("div", { style: {
                                                        padding: '6px 10px',
                                                        cursor: 'pointer',
                                                        borderBottom: '1px solid var(--vscode-panel-border)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: 2
                                                    }, onClick: () => {
                                                        const target = lastFocusedRef.current || bodyEditorRef.current; // Default to body
                                                        if (target) {
                                                            target.insertText('${#TestCase#' + v.name + '}');
                                                            // InsertText modifies model directly, so no force update needed usually,
                                                            // but if we updated state, we might. Here we access editor instance directly.
                                                        }
                                                        setShowVariables(false);
                                                    }, onMouseEnter: (e) => e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)', onMouseLeave: (e) => e.currentTarget.style.background = 'transparent', title: "Click to Insert", children: [_jsx("div", { style: { fontWeight: 'bold', color: 'var(--vscode-textLink-foreground)' }, children: v.name }), _jsxs("div", { style: { fontSize: '0.8em', opacity: 0.7 }, children: ["from ", v.step] })] }, i)));
                                            })()] }))] }))] })), _jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: layoutMode === 'vertical' ? 'column' : 'row', overflow: 'hidden' }, children: [_jsxs("div", { style: {
                                    flex: (response || loading) ? `0 0 ${splitRatio > 1 ? splitRatio : splitRatio * 100}% ` : '1 1 auto',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    height: 'auto',
                                    width: 'auto'
                                }, children: [_jsx("div", { style: {
                                            padding: '10px 15px',
                                            backgroundColor: 'var(--vscode-editor-background)',
                                            borderBottom: '1px solid var(--vscode-panel-border)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 5,
                                            fontSize: '0.9em',
                                            color: 'var(--vscode-descriptionForeground)'
                                        }, children: (() => {
                                            const breadcrumbPath = projects && selectedRequest && selectedRequest.id ? findPathToRequest(projects, selectedRequest.id) : null;
                                            if (breadcrumbPath) {
                                                return (_jsxs(_Fragment, { children: [breadcrumbPath.map((segment, i) => (_jsxs(React.Fragment, { children: [i > 0 && _jsx(ChevronRight, { size: 12 }), _jsx("span", { children: segment })] }, i))), _jsx(ChevronRight, { size: 12 }), _jsx("span", { style: { fontWeight: 'bold', color: 'var(--vscode-foreground)' }, children: selectedRequest.name })] }));
                                            }
                                            // Fallback
                                            return (_jsxs(_Fragment, { children: [_jsx("span", { children: selectedOperation?.name }), selectedOperation && _jsx(ChevronRight, { size: 12 }), _jsx("span", { style: { fontWeight: 'bold', color: 'var(--vscode-foreground)' }, children: selectedRequest.name })] }));
                                        })() }), _jsxs("div", { style: {
                                            padding: '0 10px',
                                            backgroundColor: 'var(--vscode-editor-background)',
                                            borderBottom: '1px solid var(--vscode-panel-border)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 20,
                                            flexShrink: 0,
                                            height: 35
                                        }, children: [_jsx("div", { style: {
                                                    cursor: 'pointer',
                                                    borderBottom: activeTab === 'request' ? '2px solid var(--vscode-textLink-foreground)' : '2px solid transparent',
                                                    padding: '5px 0',
                                                    color: activeTab === 'request' ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)'
                                                }, onClick: () => setActiveTab('request'), children: "Body" }), _jsxs("div", { style: {
                                                    cursor: 'pointer',
                                                    borderBottom: activeTab === 'headers' ? '2px solid var(--vscode-textLink-foreground)' : '2px solid transparent',
                                                    padding: '5px 0',
                                                    color: activeTab === 'headers' ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)'
                                                }, onClick: () => setActiveTab('headers'), children: ["Headers", selectedRequest.headers && Object.keys(selectedRequest.headers).length > 0 && ` (${Object.keys(selectedRequest.headers).length})`] }), selectedRequest.requestType === 'rest' && (_jsxs("div", { style: {
                                                    cursor: 'pointer',
                                                    borderBottom: activeTab === 'params' ? '2px solid var(--vscode-textLink-foreground)' : '2px solid transparent',
                                                    padding: '5px 0',
                                                    color: activeTab === 'params' ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)'
                                                }, onClick: () => setActiveTab('params'), children: ["Params", selectedRequest.restConfig?.queryParams && Object.keys(selectedRequest.restConfig.queryParams).length > 0 && ` (${Object.keys(selectedRequest.restConfig.queryParams).length})`] })), selectedRequest.requestType === 'graphql' && (_jsxs("div", { style: {
                                                    cursor: 'pointer',
                                                    borderBottom: activeTab === 'variables' ? '2px solid var(--vscode-textLink-foreground)' : '2px solid transparent',
                                                    padding: '5px 0',
                                                    color: activeTab === 'variables' ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)'
                                                }, onClick: () => setActiveTab('variables'), children: ["Variables", selectedRequest.graphqlConfig?.variables && Object.keys(selectedRequest.graphqlConfig.variables).length > 0 && ' ✓'] })), !isHistoryMode && (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                                            cursor: 'pointer',
                                                            borderBottom: activeTab === 'assertions' ? '2px solid var(--vscode-textLink-foreground)' : '2px solid transparent',
                                                            padding: '5px 0',
                                                            color: activeTab === 'assertions' ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)'
                                                        }, onClick: () => setActiveTab('assertions'), children: ["Assertions", selectedRequest.assertions && selectedRequest.assertions.length > 0 && ` (${selectedRequest.assertions.length})`, response && response.assertionResults && (_jsx("span", { style: { marginLeft: 5, fontSize: '0.8em' }, children: response.assertionResults.every((r) => r.status === 'PASS') ? '✔' : '❌' }))] }), _jsxs("div", { style: {
                                                            cursor: 'pointer',
                                                            borderBottom: activeTab === 'extractors' ? '2px solid var(--vscode-textLink-foreground)' : '2px solid transparent',
                                                            padding: '5px 0',
                                                            color: activeTab === 'extractors' ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)'
                                                        }, onClick: () => setActiveTab('extractors'), children: ["Extractors", selectedRequest.extractors && selectedRequest.extractors.length > 0 && ` (${selectedRequest.extractors.length})`] })] })), _jsxs("div", { style: {
                                                    cursor: 'pointer',
                                                    borderBottom: activeTab === 'auth' ? '2px solid var(--vscode-textLink-foreground)' : '2px solid transparent',
                                                    padding: '5px 0',
                                                    color: activeTab === 'auth' ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)'
                                                }, onClick: () => setActiveTab('auth'), children: ["Auth", selectedRequest.wsSecurity && selectedRequest.wsSecurity.type !== 'none' && ' ✓'] }), _jsxs("div", { style: {
                                                    cursor: 'pointer',
                                                    borderBottom: activeTab === 'attachments' ? '2px solid var(--vscode-textLink-foreground)' : '2px solid transparent',
                                                    padding: '5px 0',
                                                    color: activeTab === 'attachments' ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)'
                                                }, onClick: () => setActiveTab('attachments'), children: ["Attachments", selectedRequest.attachments && selectedRequest.attachments.length > 0 && ` (${selectedRequest.attachments.length})`] }), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', gap: '5px', alignItems: 'center', fontSize: '0.9em' }, children: [_jsx(IconButton, { onClick: () => {
                                                            const newValue = !alignAttributes;
                                                            setAlignAttributes(newValue);
                                                            if (selectedRequest.request)
                                                                onUpdateRequest({ ...selectedRequest, request: formatXml(selectedRequest.request, newValue, inlineElementValues) });
                                                            forceEditorUpdate();
                                                        }, active: alignAttributes, title: "Toggle Attribute Alignment", style: { width: 24, height: 24, padding: 2 }, children: _jsx(WrapText, { size: 14 }) }), onToggleInlineElementValues && (_jsx(IconButton, { title: inlineElementValues ? "Format: Inline Values (Compact)" : "Format: Block Values (Expanded)", onClick: () => {
                                                            if (onToggleInlineElementValues)
                                                                onToggleInlineElementValues();
                                                            const nextVal = !inlineElementValues;
                                                            if (selectedRequest.request) {
                                                                onUpdateRequest({ ...selectedRequest, request: formatXml(selectedRequest.request, alignAttributes, nextVal) });
                                                                forceEditorUpdate();
                                                            }
                                                        }, active: inlineElementValues, style: { width: 24, height: 24, padding: 2 }, children: _jsx(AlignLeft, { size: 14 }) })), onToggleHideCausalityData && (_jsx(IconButton, { title: hideCausalityData ? "Show Debugger Causality Data" : "Hide Debugger Causality Data", onClick: onToggleHideCausalityData, active: hideCausalityData, style: { width: 24, height: 24, padding: 2 }, children: _jsx(Bug, { size: 14 }) })), _jsx(IconButton, { title: "Format XML Now", onClick: () => {
                                                            const formatted = formatXml(selectedRequest.request, alignAttributes, inlineElementValues);
                                                            onUpdateRequest({ ...selectedRequest, request: formatted });
                                                            forceEditorUpdate();
                                                        }, style: { width: 24, height: 24, padding: 2 }, children: _jsx(Braces, { size: 14 }) }), onOpenDevOps && config?.azureDevOps?.project && (_jsx(IconButton, { title: "Add to Azure DevOps", onClick: onOpenDevOps, style: { width: 24, height: 24, padding: 2 }, children: _jsx(Cloud, { size: 14 }) })), isReadOnly && onAddMockRule && (_jsx(IconButton, { title: "Import to Mock Rule", onClick: handleCreateMockRule, style: { width: 24, height: 24, padding: 2, color: 'var(--vscode-charts-orange)' }, children: _jsx(PlusSquare, { size: 14 }) })), _jsx("div", { style: { width: 1, height: 16, background: 'var(--vscode-panel-border)', margin: '0 5px' } }), _jsxs("span", { style: { opacity: 0.8 }, children: ["Lines: ", typeof selectedRequest.request === 'string' ? selectedRequest.request.split('\n').length : 0] }), _jsxs("span", { style: { opacity: 0.8 }, children: ["Size: ", typeof selectedRequest.request === 'string' ? (selectedRequest.request.length / 1024).toFixed(2) : 0, " KB"] })] })] }), activeTab === 'request' && (_jsx("div", { style: {
                                            position: 'relative',
                                            flex: 1,
                                            width: '100%',
                                            height: '100%',
                                            overflow: 'hidden'
                                        }, children: _jsx(MonacoRequestEditor, { ref: bodyEditorRef, value: hideCausalityData ? stripCausalityData(selectedRequest.request) : selectedRequest.request, language: 
                                            // Dynamic language based on bodyType or requestType
                                            selectedRequest.bodyType === 'json' ? 'json' :
                                                selectedRequest.bodyType === 'graphql' ? 'graphql' :
                                                    selectedRequest.bodyType === 'text' ? 'plaintext' :
                                                        selectedRequest.requestType === 'graphql' ? 'graphql' :
                                                            selectedRequest.requestType === 'rest' ? 'json' :
                                                                'xml', readOnly: isReadOnly && activeView !== SidebarView.PROJECTS && activeView !== SidebarView.EXPLORER, onChange: (val) => onUpdateRequest({ ...selectedRequest, request: val }), onFocus: () => lastFocusedRef.current = bodyEditorRef.current, autoFoldElements: config?.ui?.autoFoldElements, requestId: selectedRequest.id || selectedRequest.name, forceUpdateKey: editorForceUpdateKey }) })), activeTab === 'headers' && (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }, children: [_jsx("div", { style: { flex: 1, overflow: 'hidden', padding: (isReadOnly || isStructureLocked) ? '10px' : '0' }, children: !isReadOnly && !isStructureLocked ? (_jsx(HeadersPanel, { headers: selectedRequest.headers || {}, onChange: (newHeaders) => onUpdateRequest({ ...selectedRequest, headers: newHeaders }), contentType: selectedRequest.contentType })) : (_jsxs("div", { style: { overflow: 'auto', height: '100%', backgroundColor: 'var(--vscode-editor-background)' }, children: [_jsx("h3", { style: { marginTop: 0, marginBottom: 10, fontSize: '1em' }, children: "Request Headers" }), selectedRequest.headers && Object.keys(selectedRequest.headers).length > 0 ? (Object.entries(selectedRequest.headers).map(([key, value]) => (_jsxs("div", { style: { display: 'flex', gap: 10, marginBottom: 5, fontSize: '0.9em' }, children: [_jsxs("div", { style: { fontWeight: 'bold', minWidth: 150, color: 'var(--vscode-textLink-foreground)' }, children: [key, ":"] }), _jsx("div", { style: { wordBreak: 'break-all', fontFamily: 'monospace' }, children: String(value) })] }, key)))) : (_jsx("div", { style: { fontStyle: 'italic', opacity: 0.7 }, children: "No headers captured." }))] })) }), response && response.headers && (_jsxs("div", { style: {
                                                    flex: 1,
                                                    borderTop: '1px solid var(--vscode-panel-border)',
                                                    padding: 10,
                                                    overflow: 'auto',
                                                    backgroundColor: 'var(--vscode-editor-background)'
                                                }, children: [_jsx("h3", { style: { marginTop: 0, marginBottom: 10, fontSize: '1em' }, children: "Response Headers" }), Object.entries(response.headers).map(([key, value]) => (_jsxs("div", { style: { display: 'flex', gap: 10, marginBottom: 5, fontSize: '0.9em' }, children: [_jsxs("div", { style: { fontWeight: 'bold', minWidth: 150, color: 'var(--vscode-textLink-foreground)' }, children: [key, ":"] }), _jsx("div", { style: { wordBreak: 'break-all', fontFamily: 'monospace' }, children: String(value) })] }, key)))] }))] })), activeTab === 'params' && selectedRequest.requestType === 'rest' && (_jsx("div", { style: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }, children: _jsx(QueryParamsPanel, { params: selectedRequest.restConfig?.queryParams || {}, onChange: (newParams) => onUpdateRequest({
                                                ...selectedRequest,
                                                restConfig: { ...selectedRequest.restConfig, queryParams: newParams }
                                            }), title: "Query Parameters", readOnly: isReadOnly || isStructureLocked }) })), activeTab === 'variables' && selectedRequest.requestType === 'graphql' && (_jsx("div", { style: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }, children: _jsx(GraphQLVariablesPanel, { variables: selectedRequest.graphqlConfig?.variables, operationName: selectedRequest.graphqlConfig?.operationName, onChange: (newVars) => onUpdateRequest({
                                                ...selectedRequest,
                                                graphqlConfig: { ...selectedRequest.graphqlConfig, variables: newVars }
                                            }), onOperationNameChange: (name) => onUpdateRequest({
                                                ...selectedRequest,
                                                graphqlConfig: { ...selectedRequest.graphqlConfig, operationName: name }
                                            }) }) })), activeTab === 'assertions' && (_jsx(AssertionsPanel, { assertions: selectedRequest.assertions || [], onChange: (newAssertions) => onUpdateRequest({ ...selectedRequest, assertions: newAssertions }), lastResult: response?.assertionResults })), activeTab === 'extractors' && (_jsx(ExtractorsPanel, { extractors: selectedRequest.extractors || [], onChange: (newExtractors) => onUpdateRequest({ ...selectedRequest, extractors: newExtractors }), onEdit: onEditExtractor, rawResponse: response?.rawResponse })), activeTab === 'auth' && (selectedRequest.requestType === 'rest' || selectedRequest.requestType === 'graphql' ? (_jsx(RestAuthPanel, { auth: selectedRequest.restConfig?.auth, onChange: (newAuth) => onUpdateRequest({
                                            ...selectedRequest,
                                            restConfig: { ...selectedRequest.restConfig, auth: newAuth }
                                        }), readOnly: isReadOnly || isStructureLocked })) : (_jsx(SecurityPanel, { security: selectedRequest.wsSecurity, onChange: (newSecurity) => onUpdateRequest({ ...selectedRequest, wsSecurity: newSecurity }) }))), activeTab === 'attachments' && (_jsx(AttachmentsPanel, { attachments: selectedRequest.attachments || [], onChange: (newAttachments) => onUpdateRequest({ ...selectedRequest, attachments: newAttachments }) }))] }), (response || loading) && (_jsx("div", { onMouseDown: onStartResizing, style: {
                                    width: layoutMode === 'horizontal' ? 5 : '100%',
                                    height: layoutMode === 'vertical' ? 5 : '100%',
                                    cursor: layoutMode === 'horizontal' ? 'col-resize' : 'row-resize',
                                    backgroundColor: isResizing ? 'var(--vscode-focusBorder)' : 'var(--vscode-widget-shadow)',
                                    zIndex: 10,
                                    flex: '0 0 auto',
                                    transition: 'background-color 0.2s'
                                } })), (() => { console.log('[WorkspaceLayout] Rendering Response Section', { response: !!response, loading, splitRatio }); return null; })(), (response || loading) && (_jsxs("div", { "data-testid": "response-section", style: {
                                    flex: 1,
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    borderLeft: layoutMode === 'horizontal' ? '1px solid var(--vscode-panel-border)' : 'none',
                                    borderTop: layoutMode === 'vertical' ? '1px solid var(--vscode-panel-border)' : 'none',
                                }, children: [_jsxs("div", { style: {
                                            padding: '5px 10px',
                                            backgroundColor: 'var(--vscode-editor-background)',
                                            borderBottom: '1px solid var(--vscode-panel-border)',
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            flexShrink: 0
                                        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10 }, children: [_jsx("span", { children: "Response" }), selection && onAddExtractor && !isReadOnly && currentXPath && (_jsxs("div", { style: { display: 'flex', gap: 5 }, children: [selection.text && (_jsxs(_Fragment, { children: [_jsxs(ToolbarButton, { onClick: handleCreateExtractor, style: { fontSize: '0.8em', padding: '0 8px', height: 20 }, children: [_jsx(Bug, { size: 12, style: { marginRight: 4 } }), " Extract"] }), onAddAssertion && (_jsxs(ToolbarButton, { onClick: handleCreateAssertion, style: { fontSize: '0.8em', padding: '0 8px', height: 20 }, children: [_jsx(Braces, { size: 12, style: { marginRight: 4 } }), " Match"] }))] })), onAddExistenceAssertion && (_jsxs(ToolbarButton, { onClick: handleCreateExistenceAssertion, style: { fontSize: '0.8em', padding: '0 8px', height: 20 }, children: [_jsx(ListChecks, { size: 12, style: { marginRight: 4 } }), " Exists"] }))] })), selection && selection.text && isReadOnly && onAddReplaceRule && currentXPath && (_jsxs(ToolbarButton, { onClick: () => handleCreateReplaceRule('response'), style: { fontSize: '0.8em', padding: '0 8px', height: 20 }, title: "Create a replace rule for this selection", children: [_jsx(Replace, { size: 12, style: { marginRight: 4 } }), " Add Replace Rule"] }))] }), response && (_jsxs("div", { style: { marginLeft: 'auto', display: 'flex', gap: '15px', alignItems: 'center' }, children: [_jsxs("span", { style: { opacity: 0.8 }, children: ["Lines: ", response.lineCount || 0] }), _jsxs("span", { style: { opacity: 0.8 }, children: ["Time: ", (response.duration || 0).toFixed(1), "s"] }), _jsxs("span", { style: { opacity: 0.8 }, children: ["Size: ", typeof response.rawResponse === 'string' ? (response.rawResponse.length / 1024).toFixed(2) : 0, " KB"] }), response.createdAt && (_jsxs("span", { style: { opacity: 0.8 }, children: ["Received: ", new Date(response.createdAt).toLocaleTimeString()] })), response.headers && response.headers['content-type'] && (_jsx("span", { title: "Content-Type", style: { opacity: 0.8, borderLeft: '1px solid var(--vscode-panel-border)', paddingLeft: '10px' }, children: response.headers['content-type'].split(';')[0] })), _jsx("span", { style: {
                                                            color: response.success ? 'var(--vscode-testing-iconPassed)' : 'var(--vscode-testing-iconFailed)',
                                                            marginLeft: 10
                                                        }, children: response.success ? '200 OK' : 'Error' })] }))] }), _jsx(MonacoResponseViewer, { value: (() => {
                                            const raw = response ? (response.rawResponse ? response.rawResponse : (response.error || '')) : '';
                                            const viewerLanguage = response?.language || 'xml';
                                            if (!raw)
                                                return '';
                                            if (viewerLanguage === 'json')
                                                return raw;
                                            return formatXml(raw, alignAttributes, inlineElementValues);
                                        })(), language: response?.language || 'xml', showLineNumbers: showLineNumbers, onSelectionChange: setSelection, autoFoldElements: config?.ui?.autoFoldElements })] }))] })] }), _jsxs(MainFooter, { children: [_jsx(IconButton, { onClick: onToggleLineNumbers, active: showLineNumbers, title: "Toggle Line Numbers", children: _jsx(ListOrdered, { size: 16 }) }), _jsx(IconButton, { onClick: onToggleLayout, title: "Toggle Layout (Vertical/Horizontal)", children: _jsx(LayoutIcon, { size: 16 }) })] })] }));
};
