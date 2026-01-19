import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect, useCallback } from 'react';
import { Container, ContextMenu, ContextMenuItem } from '../styles/App.styles';
import { bridge, isVsCode } from '../utils/bridge';
import { updateProjectWithRename } from '../utils/projectUtils';
import { Sidebar } from './Sidebar';
import { WorkspaceLayout } from './WorkspaceLayout';
import { HelpModal } from './HelpModal';
import { AddToTestCaseModal } from './modals/AddToTestCaseModal';
import { ConfirmationModal } from './modals/ConfirmationModal';
import { RenameModal } from './modals/RenameModal';
import { SampleModal } from './modals/SampleModal';
import { ExtractorModal } from './modals/ExtractorModal';
import { SettingsEditorModal } from './modals/SettingsEditorModal';
import { CreateReplaceRuleModal } from './modals/CreateReplaceRuleModal';
import { AddToDevOpsModal } from './modals/AddToDevOpsModal';
import { AddToProjectModal } from './modals/AddToProjectModal';
import { WsdlSyncModal } from './modals/WsdlSyncModal';
import { SidebarView } from '@shared/models';
import { FrontendCommand } from '@shared/messages';
import { useMessageHandler } from '../hooks/useMessageHandler';
import { useProject } from '../contexts/ProjectContext';
import { useSelection } from '../contexts/SelectionContext';
import { useUI } from '../contexts/UIContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useTestRunner } from '../contexts/TestRunnerContext';
import { usePerformance } from '../contexts/PerformanceContext';
import { useExplorer } from '../hooks/useExplorer';
import { useContextMenu } from '../hooks/useContextMenu';
import { useWatcherProxy } from '../hooks/useWatcherProxy';
import { useSidebarCallbacks } from '../hooks/useSidebarCallbacks';
import { useWorkspaceCallbacks } from '../hooks/useWorkspaceCallbacks';
import { useAppLifecycle } from '../hooks/useAppLifecycle';
import { useLayoutHandler } from '../hooks/useLayoutHandler';
import { useFolderManager } from '../hooks/useFolderManager';
export function MainContent() {
    // ==========================================================================
    // CONTEXT - Project state from ProjectContext
    // ==========================================================================
    const { projects, setProjects, selectedProjectName, setSelectedProjectName, workspaceDirty, setWorkspaceDirty, savedProjects, setSavedProjects, deleteConfirm, setDeleteConfirm, addProject, closeProject, loadProject, saveProject, toggleProjectExpand, toggleInterfaceExpand, toggleOperationExpand } = useProject();
    // ==========================================================================
    // CONTEXT - Selection state from SelectionContext
    // ==========================================================================
    const { selectedInterface, setSelectedInterface, selectedOperation, setSelectedOperation, selectedRequest, setSelectedRequest, selectedStep, setSelectedStep, selectedTestCase, setSelectedTestCase, response, setResponse, loading, setLoading, selectedTestSuite, setSelectedTestSuite, selectedPerformanceSuiteId, setSelectedPerformanceSuiteId } = useSelection();
    // Notify backend that the Webview is ready and load initial data (Samples, Changelog)
    useEffect(() => {
        const initializeApp = async () => {
            // Retry logic to wait for sidecar to be ready
            let retries = 0;
            const maxRetries = 10;
            const retryDelay = 500; // ms
            while (retries < maxRetries) {
                try {
                    console.log(`[MainContent] Attempt ${retries + 1}/${maxRetries}: Sending webviewReady...`);
                    const response = await bridge.sendMessageAsync({ command: 'webviewReady' });
                    console.log('[MainContent] webviewReady response:', response);
                    // Validate response - throw error if invalid to trigger retry
                    if (!response || (!response.samplesProject && !response.changelog && !response.acknowledged)) {
                        throw new Error('webviewReady response invalid or empty');
                    }
                    // In Tauri mode, sidecar returns samples and changelog in the response
                    if (response?.samplesProject) {
                        console.log('[MainContent] Received samples project:', response.samplesProject.name);
                        bridge.emit({
                            command: 'projectLoaded',
                            project: response.samplesProject,
                            filename: 'Samples',
                            isReadOnly: true
                        });
                    }
                    if (response?.projects && Array.isArray(response.projects)) {
                        console.log(`[MainContent] Received ${response.projects.length} persisted projects`);
                        response.projects.forEach((proj) => {
                            bridge.emit({
                                command: 'projectLoaded',
                                project: proj,
                                filename: proj.fileName || proj.name, // Fallback to name if fileName missing
                                isReadOnly: false
                            });
                        });
                    }
                    if (response?.changelog) {
                        console.log('[MainContent] Received changelog, length:', response.changelog.length);
                        setChangelog(response.changelog);
                    }
                    console.log('[MainContent] Initialization successful');
                    break; // Success! Exit retry loop
                }
                catch (error) {
                    const shouldRetry = (error?.message?.includes('Sidecar not ready') ||
                        error?.message?.includes('invalid or empty')) && retries < maxRetries - 1;
                    if (shouldRetry) {
                        console.log(`[MainContent] Sidecar not ready or invalid response, retrying in ${retryDelay}ms... (attempt ${retries + 1}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        retries++;
                    }
                    else {
                        console.error('[MainContent] Failed to initialize app:', error);
                        break;
                    }
                }
            }
        };
        initializeApp();
    }, []);
    // ==========================================================================
    // EXPLORER - from useExplorer hook
    // ==========================================================================
    const { exploredInterfaces, setExploredInterfaces, explorerExpanded, setExplorerExpanded, pendingAddInterface, setPendingAddInterface, addToProject, addInterfaceToNamedProject, addAllToProject, clearExplorer, removeFromExplorer, toggleExplorerExpand, toggleExploredInterface, toggleExploredOperation } = useExplorer({ projects, setProjects, setWorkspaceDirty, saveProject });
    // ==========================================================================
    // LOCAL STATE - Remaining state that stays in App
    // ==========================================================================
    // Backend Connection
    const [backendConnected, setBackendConnected] = useState(false);
    // ==========================================================================
    // UI state from UIContext
    // ==========================================================================
    const { activeView, setActiveView } = useNavigation();
    const { layoutMode, setLayoutMode, showLineNumbers, setShowLineNumbers, inlineElementValues, setInlineElementValues, hideCausalityData, setHideCausalityData, showSettings, setShowSettings, initialSettingsTab, setInitialSettingsTab, openSettings, showHelp, setShowHelp, helpSection, setHelpSection, showDevOpsModal, setShowDevOpsModal, config, setConfig, rawConfig, setRawConfig, configPath, setConfigPath } = useUI();
    // View Isolation Logic - Prevent leaking requests between contexts
    useEffect(() => {
        // If we switch TO Performance view, and have a non-perf request selected -> Clear it
        if (activeView === SidebarView.PERFORMANCE && selectedRequest?.id && !selectedRequest.id.startsWith('perf-req-')) {
            setSelectedRequest(null);
        }
        // If we switch TO Projects/Explorer view, and have a perf request selected -> Clear it
        if ((activeView === SidebarView.PROJECTS || activeView === SidebarView.EXPLORER) && selectedRequest?.id && selectedRequest.id.startsWith('perf-req-')) {
            setSelectedRequest(null);
        }
        // Tests view handles its own selection logic via useTestCaseHandlers usually, but safely:
        if (activeView === SidebarView.TESTS && selectedRequest?.id && selectedRequest.id.startsWith('perf-req-')) {
            setSelectedRequest(null);
        }
    }, [activeView, selectedRequest, setSelectedRequest]);
    // Local State (remaining)
    const [selectedFile, setSelectedFile] = useState(null);
    // inputType, wsdlUrl were in original.
    const [inputType, setInputType] = useState('url');
    const [wsdlUrl, setWsdlUrl] = useState('');
    const [wsdlUrlHistory, setWsdlUrlHistory] = useState([]);
    const [downloadStatus, setDownloadStatus] = useState(null);
    const [wsdlUseProxy, setWsdlUseProxy] = useState(false);
    const [wsdlDiff, setWsdlDiff] = useState(null);
    // Derived State
    const selectedPerformanceSuite = config?.performanceSuites?.find(s => s.id === selectedPerformanceSuiteId) || null;
    // ==========================================================================
    // FOLDER HANDLERS - Work with project.folders for unified structure
    // ==========================================================================
    // ==========================================================================
    // FOLDER HANDLERS - Work with project.folders for unified structure
    // ==========================================================================
    const { handleAddFolder, handleAddRequestToFolder, handleDeleteFolder, handleToggleFolderExpand } = useFolderManager({
        setProjects,
        setWorkspaceDirty,
        setSelectedRequest
    });
    // Log unused handlers temporarily
    // Breakpoint State
    const [activeBreakpoint, setActiveBreakpoint] = useState(null);
    const handleUpdateProject = useCallback((oldProject, newProject) => {
        setProjects(prev => prev.map(p => p === oldProject ? newProject : p));
        // Only auto-save if project already has a file path (persisted).
        // Otherwise, rely on dirty flag and manual save for new projects.
        if (newProject.fileName) {
            saveProject(newProject);
        }
    }, [setProjects, saveProject]);
    // ==========================================================================
    // CONTEXT MENU - from useContextMenu hook
    // ==========================================================================
    const { contextMenu, renameState, setRenameState, handleContextMenu, closeContextMenu, handleRename, handleDeleteRequest: _handleDeleteRequest, handleCloneRequest, handleAddRequest, handleDeleteInterface: _handleDeleteInterface, handleDeleteOperation: _handleDeleteOperation, handleViewSample, handleExportNative } = useContextMenu({
        setProjects,
        saveProject,
        setWorkspaceDirty,
        selectedInterface,
        selectedOperation,
        setSelectedInterface,
        setSelectedOperation,
        setSelectedRequest,
        setResponse
    });
    // Cleanup wrappers for Project structure
    const handleDeleteInterface = (iface) => {
        _handleDeleteInterface(iface);
        // If selected interface matches, or selected operation/request belongs to it
        if (selectedInterface?.name === iface.name) {
            setSelectedInterface(null);
            // Operations and requests will be cleared by cascading logic or explicitly?
            // Safer to clear all if we are viewing the deleted interface's subtree
            setSelectedOperation(null);
            setSelectedRequest(null);
        }
        // Also check if selected operation belongs to this interface (if we didn't have interface selected directly)
        // ... (Checking strictly by name might be risky if duplicates allowed, but names are usually unique per project)
    };
    const handleDeleteOperation = (op, iface) => {
        _handleDeleteOperation(op, iface);
        if (selectedOperation?.name === op.name) {
            setSelectedOperation(null);
            setSelectedRequest(null);
        }
        // If a request of this operation is selected
        if (selectedRequest && op.requests.some(r => r.id === selectedRequest.id)) {
            setSelectedRequest(null);
        }
    };
    const handleDeleteRequest = (req) => {
        const target = req || (contextMenu?.type === 'request' ? contextMenu.data : null);
        _handleDeleteRequest(req);
        if (target && selectedRequest?.id === target.id) {
            setSelectedRequest(null);
        }
    };
    // ==========================================================================
    // CONTEXT - Test Runner state from TestRunnerContext
    // ==========================================================================
    const { testExecution, handleSelectTestSuite, handleSelectTestCase, handleAddAssertion, handleAddExistenceAssertion, handleGenerateTestSuite, handleRunTestCaseWrapper, handleRunTestSuiteWrapper, handleSaveExtractor, executeRequest, cancelRequest, handleRequestUpdate, handleResetRequest, startTimeRef } = useTestRunner();
    // ==========================================================================
    // WATCHER/PROXY/MOCK - from useWatcherProxy hook
    // ==========================================================================
    const { watcherHistory, setWatcherHistory, watcherRunning, setWatcherRunning, proxyHistory, setProxyHistory, proxyRunning: _proxyRunning, setProxyRunning, proxyConfig, setProxyConfig, handleSelectWatcherEvent, 
    // Mock state
    mockHistory, 
    // setMockHistory unused
    mockRunning: _mockRunning, 
    // setMockRunning unused
    mockConfig, 
    // setMockConfig unused
    handleSelectMockEvent, handleClearMockHistory, 
    // Unified Server Mode
    serverMode, setServerMode } = useWatcherProxy({
        activeView,
        inlineElementValues,
        hideCausalityData,
        setSelectedInterface,
        setSelectedOperation,
        setSelectedRequest,
        setSelectedTestCase,
        setResponse
    });
    // ==========================================================================
    // SIDEBAR CALLBACKS - from useSidebarCallbacks hook
    // ==========================================================================
    const { handleAddSuite, handleDeleteSuite: _handleDeleteSuite, handleToggleSuiteExpand, handleToggleCaseExpand, handleAddTestCase, handleDeleteTestCase: _handleDeleteTestCase, handleRenameTestCase, handleRenameTestStep, handleStartWatcher, handleStopWatcher, handleClearWatcher, handleStartProxy: _handleStartProxy, handleStopProxy: _handleStopProxy, handleUpdateProxyConfig: _handleUpdateProxyConfig, handleClearProxy, handleInjectProxy: _handleInjectProxy, handleRestoreProxy: _handleRestoreProxy, handleSaveUiState } = useSidebarCallbacks({
        projects,
        setProjects,
        deleteConfirm,
        setDeleteConfirm,
        saveProject,
        setWatcherRunning,
        setWatcherHistory,
        setProxyRunning,
        setProxyHistory,
        proxyConfig,
        setProxyConfig,
        configPath,
        config
    });
    // Wrapped Handlers for State Cleanup
    const handleDeleteSuite = (suiteId) => {
        // Call original handler
        _handleDeleteSuite(suiteId);
        // Cleanup selection if needed
        // If selected test case belongs to this suite, clear it.
        if (selectedTestCase) {
            // Find parent suite of selectedTestCase
            const project = projects.find(p => p.testSuites?.some(s => s.testCases?.some(tc => tc.id === selectedTestCase.id)));
            const suite = project?.testSuites?.find(s => s.testCases?.some(tc => tc.id === selectedTestCase.id));
            if (suite?.id === suiteId) {
                setSelectedTestCase(null);
                setSelectedStep(null);
            }
        }
    };
    const handleDeleteTestCase = (caseId) => {
        _handleDeleteTestCase(caseId);
        if (selectedTestCase?.id === caseId) {
            setSelectedTestCase(null);
            setSelectedStep(null);
        }
    };
    // Performance Handlers
    // ==========================================================================
    // CONTEXT - Performance state from PerformanceContext
    // ==========================================================================
    const { activeRunId, 
    // setActiveRunId,
    performanceProgress, 
    // setPerformanceProgress,
    coordinatorStatus, 
    // setCoordinatorStatus,
    expandedPerformanceSuiteIds, handleAddPerformanceSuite, handleDeletePerformanceSuite, handleRunPerformanceSuite, handleStopPerformanceRun, handleSelectPerformanceSuite, handleUpdatePerformanceSuite, handleAddPerformanceRequest, handleDeletePerformanceRequest, handleUpdatePerformanceRequest, handleSelectPerformanceRequest, handleStartCoordinator, handleStopCoordinator, handleTogglePerformanceSuiteExpand } = usePerformance();
    // Auto-select first performance suite when none is selected but suites exist
    useEffect(() => {
        const suites = config?.performanceSuites || [];
        if (suites.length > 0 && !selectedPerformanceSuiteId) {
            setSelectedPerformanceSuiteId(suites[0].id);
        }
    }, [config?.performanceSuites, selectedPerformanceSuiteId, setSelectedPerformanceSuiteId]);
    // Auto-select first test case when none is selected but test cases exist
    // ONLY in Tests view to avoid re-selecting after user clears selection for navigation
    useEffect(() => {
        if (activeView !== SidebarView.TESTS)
            return;
        // Flatten all test cases from all projects/suites
        const allCases = projects.flatMap(p => (p.testSuites || []).flatMap(s => s.testCases || []));
        if (allCases.length > 0 && !selectedTestCase) {
            setSelectedTestCase(allCases[0]);
        }
    }, [projects, selectedTestCase, setSelectedTestCase, activeView]);
    // Sync selectedTestCase with authoritative projects state when projects changes
    // This fixes stale data (e.g. scriptContent) after projectLoaded updates projects
    useEffect(() => {
        if (!selectedTestCase)
            return;
        // Find the matching test case in the current projects state
        for (const proj of projects) {
            for (const suite of (proj.testSuites || [])) {
                const freshTestCase = suite.testCases?.find(tc => tc.id === selectedTestCase.id);
                if (freshTestCase && freshTestCase !== selectedTestCase) {
                    // Update selectedTestCase with fresh data from projects
                    setSelectedTestCase(freshTestCase);
                    return;
                }
            }
        }
    }, [projects, selectedTestCase, setSelectedTestCase]);
    const handleReplayRequest = (entry) => {
        const req = {
            id: entry.id,
            name: entry.requestName || 'Replayed Request',
            endpoint: entry.endpoint,
            request: entry.requestBody,
            headers: entry.headers,
            contentType: 'application/soap+xml', // Default content type
            readOnly: true // Mark as read-only since it's from history
        };
        setSelectedRequest(req);
        // Also restore the response if available
        if (entry.responseBody) {
            setResponse({
                rawResponse: entry.responseBody,
                status: entry.statusCode,
                headers: entry.responseHeaders || {},
                success: entry.success,
                error: entry.error,
                timeTaken: entry.duration
            });
        }
        else {
            setResponse(null);
        }
    };
    const handleToggleHistoryStar = (id) => {
        bridge.sendMessage({
            command: FrontendCommand.ToggleStarHistory,
            id
        });
    };
    const handleDeleteHistory = (id) => {
        bridge.sendMessage({
            command: FrontendCommand.DeleteHistoryEntry,
            id
        });
    };
    const sidebarPerformanceProps = {
        suites: config?.performanceSuites || [],
        onAddSuite: handleAddPerformanceSuite,
        onDeleteSuite: handleDeletePerformanceSuite,
        onRunSuite: handleRunPerformanceSuite,
        onSelectSuite: handleSelectPerformanceSuite,
        onStopRun: handleStopPerformanceRun,
        isRunning: !!activeRunId,
        activeRunId,
        selectedSuiteId: selectedPerformanceSuite?.id,
        deleteConfirm,
        setDeleteConfirm
    };
    // Extractor Modal State (needed before useWorkspaceCallbacks)
    const [extractorModal, setExtractorModal] = React.useState(null);
    // ==========================================================================
    // SYNC SELECTED REQUEST FROM PROJECTS
    // ==========================================================================
    // When projects updates, re-sync selectedRequest to point to the updated object reference
    // ONLY if the current selectedRequest is stale (not found in projects anymore)
    React.useEffect(() => {
        if (!selectedRequest || !selectedProjectName)
            return;
        const project = projects.find(p => p.name === selectedProjectName);
        if (!project)
            return;
        // Check if selectedRequest is stale by searching for it in projects
        let isStale = true;
        // Search in folders
        const checkInFolders = (folders) => {
            for (const folder of folders) {
                // Check if selectedRequest object reference exists in this folder
                if (folder.requests.some((r) => r === selectedRequest)) {
                    return false; // Not stale, found the exact object
                }
                if (folder.folders && !checkInFolders(folder.folders)) {
                    return false;
                }
            }
            return true; // Stale, not found
        };
        if (project.folders) {
            isStale = checkInFolders(project.folders);
        }
        // If not stale in folders, check interfaces
        if (!isStale)
            return; // selectedRequest is still valid, don't re-sync
        if (selectedInterface && selectedOperation) {
            const foundInInterface = project.interfaces
                .find(i => i.name === selectedInterface.name)
                ?.operations.find(o => o.name === selectedOperation.name)
                ?.requests.find(r => r === selectedRequest);
            if (foundInInterface) {
                isStale = false; // Not stale
            }
        }
        // Only re-sync if selectedRequest is stale
        if (!isStale)
            return;
        // Find the updated request by ID
        const findInFolders = (folders) => {
            for (const folder of folders) {
                // STRICT MATCHING: If we have an ID, we MUST match by ID.
                const found = folder.requests.find((r) => {
                    if (selectedRequest.id) {
                        return r.id === selectedRequest.id;
                    }
                    return r.name === selectedRequest.name;
                });
                if (found)
                    return found;
                if (folder.folders) {
                    const nested = findInFolders(folder.folders);
                    if (nested)
                        return nested;
                }
            }
            return null;
        };
        const foundInFolders = project.folders ? findInFolders(project.folders) : null;
        if (foundInFolders) {
            setSelectedRequest(foundInFolders);
            return;
        }
        // Search in interfaces
        if (selectedInterface && selectedOperation) {
            const foundInInterface = project.interfaces
                .find(i => i.name === selectedInterface.name)
                ?.operations.find(o => o.name === selectedOperation.name)
                ?.requests.find(r => {
                if (selectedRequest.id) {
                    return r.id === selectedRequest.id;
                }
                return r.name === selectedRequest.name;
            });
            if (foundInInterface) {
                setSelectedRequest(foundInInterface);
            }
        }
    }, [projects]); // Only run when projects changes, NOT when selectedRequest changes
    // ==========================================================================
    // WORKSPACE CALLBACKS - from useWorkspaceCallbacks hook
    // ==========================================================================
    const { handleSelectStep, handleDeleteStep, handleMoveStep, handleAddStep, handleToggleLayout, handleToggleLineNumbers, handleToggleInlineElementValues, handleToggleHideCausalityData, handleAddExtractor, handleEditExtractor } = useWorkspaceCallbacks({
        selectedTestCase,
        selectedStep,
        projects,
        testExecution,
        setSelectedStep,
        setSelectedRequest,
        setResponse,
        setProjects,
        saveProject,
        layoutMode,
        setLayoutMode,
        showLineNumbers,
        setShowLineNumbers,
        inlineElementValues,
        setInlineElementValues,
        hideCausalityData,
        setHideCausalityData,
        setProxyHistory,
        setWatcherHistory,
        config,
        setExtractorModal
    });
    // Modals (remaining)
    const [confirmationModal, setConfirmationModal] = useState(null);
    const [addToTestCaseModal, setAddToTestCaseModal] = React.useState({ open: false, request: null });
    const [sampleModal, setSampleModal] = React.useState({ open: false, schema: null, operationName: '' });
    const [replaceRuleModal, setReplaceRuleModal] = React.useState({ open: false, xpath: '', matchText: '', target: 'response' });
    const [importToPerformanceModal, setImportToPerformanceModal] = React.useState({ open: false, suiteId: null });
    // Workspace State
    const [changelog, setChangelog] = useState('');
    const [requestHistory, setRequestHistory] = useState([]);
    const handleRefreshWsdl = useCallback((projectName, interfaceName) => {
        bridge.sendMessage({
            command: FrontendCommand.RefreshWsdl,
            projectId: projectName,
            interfaceId: interfaceName
        });
    }, []);
    const handleApplyWsdlSync = useCallback((diff) => {
        bridge.sendMessage({
            command: FrontendCommand.ApplyWsdlSync,
            projectId: diff.projectId,
            diff
        });
        setWsdlDiff(null);
    }, []);
    // Message Handler Hook
    // ==========================================================================
    // LAYOUT & VIEW SWITCHING
    // ==========================================================================
    const { isResizing, splitRatio, startResizing, handleSetActiveViewWrapper, setSplitRatio } = useLayoutHandler({
        config,
        setConfig,
        activeView,
        setActiveView,
        selectedRequest,
        selectedOperation,
        selectedInterface,
        projects,
        selectedProjectName,
        setSelectedProjectName,
        setSelectedInterface,
        setSelectedOperation,
        setSelectedRequest,
        selectedStep,
        selectedTestCase,
        setSelectedTestCase,
        selectedPerformanceSuiteId,
        setSelectedPerformanceSuiteId
    });
    useMessageHandler({
        setProjects,
        setExploredInterfaces,
        setExplorerExpanded, // Passed via alias
        setLoading,
        setResponse,
        setDownloadStatus,
        setSelectedFile,
        setSampleModal,
        setBackendConnected,
        setConfig,
        setRawConfig,
        setLayoutMode,
        setShowLineNumbers,
        setSplitRatio,
        setInlineElementValues,
        setConfigPath,
        // setProxyConfig, // Handled in MockProxyContext
        setSelectedProjectName,
        setWsdlUrl,
        setWorkspaceDirty,
        setSavedProjects,
        setChangelog,
        setWatcherHistory,
        // Mock/Proxy setters moved to MockProxyContext but kept for useSidebarCallbacks via MainContent state
        setActiveView,
        setActiveBreakpoint,
        setRequestHistory,
        // Current values
        wsdlUrl,
        projects,
        config,
        selectedTestCase,
        selectedRequest,
        startTimeRef,
        // Callbacks
        saveProject,
        setWsdlDiff
    });
    // ==========================================================================
    // LIFECYCLE - Initial Load, Autosave, Shortcuts
    // ==========================================================================
    useAppLifecycle({
        projects,
        exploredInterfaces,
        explorerExpanded,
        wsdlUrl,
        selectedProjectName,
        saveProject,
        setProjects,
        setExploredInterfaces,
        setExplorerExpanded,
        setWsdlUrl,
        setSelectedProjectName
    });
    // Sync selectedTestCase with latest projects state
    // Sync selectedTestCase with latest projects state
    useEffect(() => {
        if (selectedTestCase) {
            // Re-hydrate stale selectedTestCase
            for (const p of projects) {
                if (p.testSuites) {
                    for (const s of p.testSuites) {
                        const updatedCase = s.testCases?.find(tc => tc.id === selectedTestCase.id);
                        if (updatedCase) {
                            if (updatedCase !== selectedTestCase) {
                                // console.log('[sync] Re-hydrating selectedTestCase', updatedCase.name);
                                setSelectedTestCase(updatedCase);
                            }
                            return;
                        }
                    }
                }
            }
        }
    }, [projects, selectedTestCase]);
    // Sync selectedStep with latest projects state
    useEffect(() => {
        if (selectedStep && selectedTestCase) {
            // Re-hydrate stale selectedStep from the current testCase
            for (const p of projects) {
                if (p.testSuites) {
                    for (const s of p.testSuites) {
                        const updatedCase = s.testCases?.find(tc => tc.id === selectedTestCase.id);
                        if (updatedCase) {
                            const updatedStep = updatedCase.steps.find(step => step.id === selectedStep.id);
                            if (updatedStep && updatedStep !== selectedStep) {
                                // console.log('[sync] Re-hydrating selectedStep', updatedStep.name);
                                setSelectedStep(updatedStep);
                            }
                            return;
                        }
                    }
                }
            }
        }
    }, [projects, selectedStep, selectedTestCase]);
    // Sync selectedTestSuite - clear if deleted
    useEffect(() => {
        if (selectedTestSuite) {
            // Check if the selected test suite still exists in projects
            let suiteExists = false;
            for (const p of projects) {
                if (p.testSuites) {
                    const foundSuite = p.testSuites.find(s => s.id === selectedTestSuite.id);
                    if (foundSuite) {
                        suiteExists = true;
                        // Re-hydrate if suite has updated
                        if (foundSuite !== selectedTestSuite) {
                            setSelectedTestSuite(foundSuite);
                        }
                        break;
                    }
                }
            }
            // If suite no longer exists, clear selection
            if (!suiteExists) {
                setSelectedTestSuite(null);
            }
        }
    }, [projects, selectedTestSuite]);
    // Handlers
    const loadWsdl = () => {
        if (inputType === 'url' && wsdlUrl) {
            bridge.sendMessage({ command: 'loadWsdl', url: wsdlUrl, isLocal: false, useProxy: wsdlUseProxy });
            // Add to history if not already present
            if (!wsdlUrlHistory.includes(wsdlUrl)) {
                setWsdlUrlHistory(prev => [wsdlUrl, ...prev].slice(0, 10)); // Keep last 10
            }
        }
        else if (inputType === 'file' && selectedFile) {
            bridge.sendMessage({ command: 'loadWsdl', url: selectedFile, isLocal: true, useProxy: false });
        }
    };
    const pickLocalWsdl = () => {
        bridge.sendMessage({ command: 'selectLocalWsdl' });
    };
    // Handle selection reset when closing a project (context handles the deletion)
    const handleCloseProject = (name) => {
        // If we're closing the selected project, clear selection
        if (deleteConfirm === name && selectedProjectName === name) {
            setSelectedInterface(null);
            setSelectedOperation(null);
            setSelectedRequest(null);
        }
        // Delegate to context
        closeProject(name);
    };
    // Breakpoint Resolution Handler
    const handleResolveBreakpoint = (modifiedContent, cancelled = false) => {
        if (activeBreakpoint) {
            bridge.sendMessage({
                command: 'resolveBreakpoint',
                breakpointId: activeBreakpoint.id,
                content: modifiedContent,
                cancelled
            });
            setActiveBreakpoint(null);
        }
    };
    return (_jsxs(Container, { onClick: closeContextMenu, children: [_jsx(Sidebar, { projectProps: {
                    projects,
                    savedProjects,
                    loadProject: () => loadProject(),
                    saveProject,
                    onUpdateProject: handleUpdateProject,
                    closeProject: handleCloseProject,
                    onAddProject: addProject,
                    toggleProjectExpand,
                    toggleInterfaceExpand,
                    toggleOperationExpand,
                    onDeleteInterface: handleDeleteInterface,
                    onDeleteOperation: handleDeleteOperation,
                    onAddFolder: handleAddFolder,
                    onAddRequestToFolder: handleAddRequestToFolder,
                    onDeleteFolder: handleDeleteFolder,
                    onToggleFolderExpand: handleToggleFolderExpand,
                    onRefreshInterface: handleRefreshWsdl
                }, explorerProps: {
                    exploredInterfaces,
                    explorerExpanded,
                    toggleExplorerExpand,
                    addToProject,
                    addAllToProject,
                    clearExplorer,
                    removeFromExplorer,
                    toggleExploredInterface,
                    toggleExploredOperation
                }, wsdlProps: {
                    inputType,
                    setInputType,
                    wsdlUrl,
                    setWsdlUrl,
                    wsdlUrlHistory,
                    selectedFile,
                    loadWsdl,
                    pickLocalWsdl,
                    downloadStatus,
                    useProxy: wsdlUseProxy,
                    setUseProxy: setWsdlUseProxy
                }, selectionProps: {
                    selectedProjectName,
                    setSelectedProjectName,
                    selectedInterface,
                    setSelectedInterface,
                    selectedOperation,
                    setSelectedOperation,
                    selectedRequest,
                    setSelectedRequest: (req) => {
                        setSelectedRequest(req);
                        setSelectedTestCase(null);
                    },
                    setResponse,
                    handleContextMenu,
                    onAddRequest: handleAddRequest,
                    onDeleteRequest: handleDeleteRequest,
                    deleteConfirm,
                    setDeleteConfirm
                }, testRunnerProps: {
                    onAddSuite: handleAddSuite,
                    onDeleteSuite: handleDeleteSuite,
                    onRunSuite: handleRunTestSuiteWrapper,
                    onAddTestCase: handleAddTestCase,
                    onRunCase: handleRunTestCaseWrapper,
                    onDeleteTestCase: handleDeleteTestCase,
                    onRenameTestCase: handleRenameTestCase,
                    onSelectSuite: handleSelectTestSuite,
                    onSelectTestCase: handleSelectTestCase,
                    onToggleSuiteExpand: handleToggleSuiteExpand,
                    onToggleCaseExpand: handleToggleCaseExpand
                }, watcherProps: {
                    history: watcherHistory,
                    onSelectEvent: handleSelectWatcherEvent,
                    isRunning: watcherRunning,
                    onStart: handleStartWatcher,
                    onStop: handleStopWatcher,
                    onClear: handleClearWatcher
                }, testsProps: {
                    projects,
                    onAddSuite: handleAddSuite,
                    onDeleteSuite: handleDeleteSuite,
                    onRunSuite: handleRunTestSuiteWrapper,
                    onAddTestCase: handleAddTestCase,
                    onDeleteTestCase: handleDeleteTestCase,
                    onRenameTestCase: handleRenameTestCase,
                    onRunCase: handleRunTestCaseWrapper,
                    onSelectSuite: handleSelectTestSuite,
                    onSelectTestCase: handleSelectTestCase,
                    onToggleSuiteExpand: handleToggleSuiteExpand,
                    onToggleCaseExpand: handleToggleCaseExpand,
                    onSelectTestStep: (caseId, stepId) => {
                        const project = projects.find(p => p.testSuites?.some(s => s.testCases?.some(tc => tc.id === caseId)));
                        const suite = project?.testSuites?.find(s => s.testCases?.some(tc => tc.id === caseId));
                        const testCase = suite?.testCases?.find(tc => tc.id === caseId);
                        const step = testCase?.steps?.find(s => s.id === stepId);
                        if (step)
                            handleSelectStep(step);
                    },
                    onRenameTestStep: handleRenameTestStep,
                    deleteConfirm
                }, performanceProps: {
                    ...sidebarPerformanceProps,
                    onAddRequest: handleAddPerformanceRequest,
                    onDeleteRequest: handleDeletePerformanceRequest,
                    onSelectRequest: handleSelectPerformanceRequest,
                    onUpdateRequest: handleUpdatePerformanceRequest,
                    onToggleSuiteExpand: handleTogglePerformanceSuiteExpand,
                    expandedSuiteIds: expandedPerformanceSuiteIds
                }, historyProps: {
                    history: requestHistory,
                    onReplay: handleReplayRequest,
                    onToggleStar: handleToggleHistoryStar,
                    onDelete: handleDeleteHistory
                }, serverProps: {
                    serverConfig: {
                        mode: serverMode, // Use dedicated state instead of deriving from running
                        port: proxyConfig.port || 9000,
                        targetUrl: proxyConfig.target || '',
                        mockRules: mockConfig.rules || [],
                        passthroughEnabled: mockConfig.passthroughEnabled ?? true
                    },
                    isRunning: _proxyRunning,
                    onModeChange: (mode) => {
                        // Update UI state immediately
                        setServerMode(mode);
                        // Send unified command to backend
                        bridge.sendMessage({ command: 'setServerMode', mode });
                    },
                    onStart: () => {
                        bridge.sendMessage({ command: 'startProxy' });
                    },
                    onStop: () => {
                        bridge.sendMessage({ command: 'stopProxy' });
                    },
                    onOpenSettings: () => openSettings('server'),
                    proxyHistory,
                    mockHistory,
                    onSelectProxyEvent: handleSelectWatcherEvent,
                    onSelectMockEvent: handleSelectMockEvent,
                    selectedEventId: selectedRequest?.id,
                    onClearHistory: () => {
                        handleClearProxy();
                        handleClearMockHistory();
                    },
                    // Mock Rules
                    mockRules: mockConfig.rules || [],
                    onAddMockRule: (rule) => bridge.sendMessage({ command: 'addMockRule', rule }),
                    onDeleteMockRule: (id) => bridge.sendMessage({ command: 'deleteMockRule', ruleId: id }),
                    onToggleMockRule: (id, enabled) => bridge.sendMessage({ command: 'toggleMockRule', ruleId: id, enabled }),
                    // Breakpoints
                    breakpoints: config?.breakpoints || [],
                    onUpdateBreakpoints: (bps) => {
                        if (config) {
                            const updatedConfig = { ...config, breakpoints: bps };
                            setConfig(updatedConfig);
                            bridge.sendMessage({ command: 'saveSettings', config: updatedConfig });
                        }
                    },
                    // Certificate
                    onOpenCertificate: () => bridge.sendMessage({ command: 'openCertificate' })
                }, activeView: activeView, onChangeView: handleSetActiveViewWrapper, backendConnected: backendConnected, workspaceDirty: workspaceDirty, showBackendStatus: !isVsCode(), onOpenSettings: () => setShowSettings(true), onOpenHelp: () => setShowHelp(true), onSaveUiState: handleSaveUiState, activeEnvironment: config?.activeEnvironment, environments: config?.environments, onChangeEnvironment: (env) => bridge.sendMessage({ command: 'setActiveEnvironment', env }) }), _jsx(WorkspaceLayout, { projects: projects, selectionState: {
                    project: projects.find(p => p.name === selectedProjectName) || null,
                    interface: selectedInterface,
                    request: selectedRequest,
                    operation: selectedOperation,
                    testCase: selectedTestCase,
                    testSuite: selectedTestSuite,
                    testStep: selectedStep,
                    performanceSuite: selectedPerformanceSuite
                }, navigationActions: {
                    onSelectProject: (p) => {
                        setSelectedProjectName(p.name);
                        setSelectedPerformanceSuiteId(null); // Clear performance state when navigating to projects
                        setSelectedTestCase(null); // Clear test case state when navigating to projects
                        setActiveView(SidebarView.PROJECTS);
                    },
                    onSelectInterface: (i) => {
                        // Ensure parent project is selected if possible (we only have interface here, might need project name context)
                        // If we are navigating from Project Summary, we assume Project Level is correct.
                        setSelectedInterface(i);
                        setSelectedPerformanceSuiteId(null); // Clear performance state
                        setSelectedTestCase(null); // Clear test case state
                        setActiveView(SidebarView.PROJECTS);
                    },
                    onSelectOperation: (o) => {
                        setSelectedOperation(o);
                        setSelectedPerformanceSuiteId(null); // Clear performance state
                        setSelectedTestCase(null); // Clear test case state
                        setActiveView(SidebarView.PROJECTS);
                    },
                    onSelectRequest: (r) => {
                        if (r === null) {
                            // Clear selection - navigate back to Explorer/Projects list
                            setSelectedRequest(null);
                        }
                        else {
                            setSelectedRequest({ ...r, contentType: r.contentType || 'application/soap+xml' });
                            setSelectedPerformanceSuiteId(null); // Clear performance state when selecting workspace request
                            setSelectedTestCase(null); // Clear test case state when selecting workspace request
                            setActiveView(SidebarView.PROJECTS);
                        }
                    },
                    onSelectTestCase: (tc) => {
                        handleSelectTestCase(tc.id);
                        setSelectedPerformanceSuiteId(null); // Clear performance state
                        setActiveView(SidebarView.TESTS);
                    }
                }, requestActions: {
                    onExecute: executeRequest,
                    onCancel: cancelRequest,
                    onUpdate: handleRequestUpdate,
                    onReset: handleResetRequest,
                    response,
                    loading
                }, viewState: {
                    activeView,
                    layoutMode,
                    showLineNumbers,
                    splitRatio,
                    isResizing,
                    onToggleLayout: handleToggleLayout,
                    onToggleLineNumbers: handleToggleLineNumbers,
                    onStartResizing: startResizing,
                    inlineElementValues,
                    onToggleInlineElementValues: handleToggleInlineElementValues,
                    hideCausalityData,
                    onToggleHideCausalityData: handleToggleHideCausalityData
                }, configState: { config, defaultEndpoint: '', changelog, onChangeEnvironment: (env) => bridge.sendMessage({ command: 'setActiveEnvironment', env }), isReadOnly: false, backendConnected }, stepActions: {
                    onRunTestCase: handleRunTestCaseWrapper,
                    onOpenStepRequest: (req) => { setSelectedRequest(req); setActiveView(SidebarView.EXPLORER); console.warn('Legacy onOpenStepRequest called'); },
                    onBackToCase: () => { setSelectedStep(null); setSelectedRequest(null); },
                    onAddStep: handleAddStep,
                    testExecution,
                    onUpdateStep: (step) => {
                        console.log('[App] Sending updateTestStep with content:', step.config.scriptContent);
                        bridge.sendMessage({ command: 'updateTestStep', step });
                    },
                    onSelectStep: handleSelectStep,
                    onDeleteStep: handleDeleteStep,
                    onMoveStep: handleMoveStep
                }, toolsActions: {
                    onAddExtractor: handleAddExtractor,
                    onEditExtractor: handleEditExtractor,
                    onAddAssertion: handleAddAssertion,
                    onAddExistenceAssertion: handleAddExistenceAssertion,
                    onAddReplaceRule: (data) => setReplaceRuleModal({ open: true, ...data }),
                    onAddMockRule: (rule) => bridge.sendMessage({ command: 'addMockRule', rule }),
                    onOpenDevOps: () => setShowDevOpsModal(true)
                }, onUpdateSuite: handleUpdatePerformanceSuite, onAddPerformanceRequest: handleAddPerformanceRequest, onDeletePerformanceRequest: handleDeletePerformanceRequest, onSelectPerformanceRequest: handleSelectPerformanceRequest, onUpdatePerformanceRequest: handleUpdatePerformanceRequest, onImportFromWorkspace: (suiteId) => setImportToPerformanceModal({ open: true, suiteId }), onRunSuite: handleRunPerformanceSuite, onStopRun: handleStopPerformanceRun, performanceProgress: performanceProgress, performanceHistory: config?.performanceHistory || [], onBackToSuite: () => setSelectedRequest(null), breakpointState: {
                    activeBreakpoint,
                    onResolve: handleResolveBreakpoint
                }, coordinatorStatus: coordinatorStatus, onStartCoordinator: handleStartCoordinator, onStopCoordinator: handleStopCoordinator, explorerState: {
                    inputType,
                    setInputType,
                    wsdlUrl,
                    setWsdlUrl,
                    loadWsdl: async (url, type) => {
                        // Ensure state is updated (react batches updates, so we might need to rely on the args or just assume state sync)
                        // But since existing loadWsdl uses state, we should probably update state and call it.
                        // However, calling setWsdlUrl here might not update state immediately for loadWsdl to see it if called synchronously.
                        // Better to send message directly here using args, mirroring loadWsdl logic.
                        if (type === 'url' && url) {
                            bridge.sendMessage({ command: 'loadWsdl', url: url, isLocal: false, useProxy: wsdlUseProxy });
                            // Add to history
                            if (!wsdlUrlHistory.includes(url)) {
                                setWsdlUrlHistory(prev => [url, ...prev].slice(0, 10));
                            }
                        }
                        else if (type === 'file') {
                            bridge.sendMessage({ command: 'loadWsdl', url: url, isLocal: true, useProxy: false });
                        }
                    },
                    downloadStatus: !downloadStatus ? 'idle'
                        : downloadStatus.some(s => s.toLowerCase().includes('error')) ? 'error'
                            : downloadStatus.some(s => s.toLowerCase().includes('loading') || s.includes('Downloading')) ? 'loading'
                                : 'success',
                    onClearSelection: () => {
                        setSelectedInterface(null);
                        setSelectedOperation(null);
                        setSelectedRequest(null);
                    }
                } }), showDevOpsModal && config?.azureDevOps?.orgUrl && config?.azureDevOps?.project && selectedRequest && (_jsx(AddToDevOpsModal, { orgUrl: config.azureDevOps.orgUrl, project: config.azureDevOps.project, requestContent: selectedRequest.request || '', responseContent: response?.body, requestName: selectedRequest.name, onClose: () => setShowDevOpsModal(false) })), showSettings && (_jsx(SettingsEditorModal, { rawConfig: rawConfig, onClose: () => {
                    setShowSettings(false);
                    setInitialSettingsTab(null);
                }, onSave: (content, config) => {
                    bridge.sendMessage({ command: 'saveSettings', raw: !config, content, config });
                    setShowSettings(false);
                    setInitialSettingsTab(null);
                }, initialTab: initialSettingsTab })), showHelp && (_jsx(HelpModal, { initialSectionId: helpSection, onClose: () => {
                    setShowHelp(false);
                    setHelpSection(null);
                } })), contextMenu && (_jsxs(ContextMenu, { top: contextMenu.y, left: contextMenu.x, children: [(contextMenu.type === 'request' || contextMenu.type === 'project' || contextMenu.type === 'folder') && (_jsx(ContextMenuItem, { onClick: handleRename, children: "Rename" })), contextMenu.type === 'project' && (_jsx(ContextMenuItem, { onClick: () => handleExportNative(contextMenu.data), children: "Export to Native Format" })), !contextMenu.isExplorer && contextMenu.type === 'request' && (_jsxs(_Fragment, { children: [_jsx(ContextMenuItem, { onClick: handleCloneRequest, children: "Clone Request" }), _jsx(ContextMenuItem, { onClick: () => {
                                    if (contextMenu) {
                                        setAddToTestCaseModal({ open: true, request: contextMenu.data });
                                        closeContextMenu();
                                    }
                                }, children: "Add to Test Case" }), _jsx(ContextMenuItem, { onClick: () => handleDeleteRequest(), style: { color: 'var(--vscode-errorForeground)' }, children: "Delete" })] })), (contextMenu.type === 'operation') && (_jsxs(_Fragment, { children: [_jsx(ContextMenuItem, { onClick: () => handleGenerateTestSuite(contextMenu.data), children: "Generate Test Suite" }), _jsx(ContextMenuItem, { onClick: () => handleAddRequest(), children: "Add Request" }), _jsx(ContextMenuItem, { onClick: handleViewSample, children: "View Sample Schema" })] })), (contextMenu.type === 'interface') && (_jsx(ContextMenuItem, { onClick: () => handleGenerateTestSuite(contextMenu.data), children: "Generate Test Suite" }))] })), _jsx(RenameModal, { isOpen: !!renameState, title: `Rename ${renameState?.type} `, initialValue: renameState?.value || '', onCancel: () => setRenameState(null), onSave: (value) => {
                    if (!renameState)
                        return;
                    // Apply rename logic here (update state)
                    if (renameState.type === 'project') {
                        setProjects(projects.map(p => p === renameState.data ? { ...p, name: value } : p));
                    }
                    else if (renameState.type === 'interface') {
                        setProjects(prev => prev.map(p => {
                            const hasInterface = p.interfaces.some(i => i === renameState.data);
                            if (hasInterface) {
                                return {
                                    ...p,
                                    interfaces: p.interfaces.map(i => i === renameState.data ? { ...i, name: value } : i),
                                    dirty: true
                                };
                            }
                            return p;
                        }));
                    }
                    else if (renameState.type === 'folder' || renameState.type === 'request') {
                        // Use helper to handle deep recursion for folders and requests within them
                        setProjects(prev => updateProjectWithRename(prev, renameState.data.id || renameState.data.name, // Use ID if available, else name
                        renameState.type, value, renameState.data));
                    }
                    setRenameState(null);
                } }), _jsx(SampleModal, { isOpen: sampleModal.open, operationName: sampleModal.operationName, schema: sampleModal.schema, onClose: () => setSampleModal({ open: false, schema: null, operationName: '' }) }), addToTestCaseModal.open && addToTestCaseModal.request && (_jsx(AddToTestCaseModal, { projects: projects, onClose: () => setAddToTestCaseModal({ open: false, request: null }), onAdd: (target) => {
                    const req = addToTestCaseModal.request;
                    const newStep = {
                        id: `step - ${Date.now()} `,
                        name: req.name,
                        type: 'request',
                        config: {
                            request: { ...req, id: `req - ${Date.now()} ` },
                            requestId: undefined
                        }
                    };
                    setProjects(prev => prev.map(p => {
                        const suite = target.suiteId ? p.testSuites?.find(s => s.id === target.suiteId) :
                            p.testSuites?.find(s => s.testCases.some(tc => tc.id === target.caseId));
                        if (!suite)
                            return p;
                        const updatedTestSuites = (p.testSuites || []).map(s => {
                            if (s.id === suite.id) {
                                // If creating new case
                                if (target.type === 'new') {
                                    const newCase = {
                                        id: `tc - ${Date.now()} `,
                                        name: `TestCase ${(s.testCases?.length || 0) + 1} `,
                                        expanded: true,
                                        steps: [newStep]
                                    };
                                    return { ...s, testCases: [...(s.testCases || []), newCase] };
                                }
                                // If adding to existing
                                if (target.type === 'existing' && target.caseId) {
                                    return {
                                        ...s,
                                        testCases: s.testCases.map(tc => tc.id === target.caseId ? { ...tc, steps: [...tc.steps, newStep] } : tc)
                                    };
                                }
                            }
                            return s;
                        });
                        const newProj = { ...p, testSuites: updatedTestSuites, dirty: true };
                        setTimeout(() => saveProject(newProj), 0);
                        return newProj;
                    }));
                    setAddToTestCaseModal({ open: false, request: null });
                    setActiveView(SidebarView.PROJECTS);
                } })), _jsx(ConfirmationModal, { isOpen: !!confirmationModal, title: confirmationModal?.title || '', message: confirmationModal?.message || '', onCancel: () => setConfirmationModal(null), onConfirm: () => {
                    confirmationModal?.onConfirm();
                    setConfirmationModal(null);
                } }), importToPerformanceModal.open && importToPerformanceModal.suiteId && (_jsx("div", { style: {
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }, children: _jsxs("div", { style: {
                        background: 'var(--vscode-editor-background)',
                        border: '1px solid var(--vscode-widget-border)',
                        borderRadius: 6, padding: 20, minWidth: 400, maxWidth: 600, maxHeight: '70vh', overflow: 'auto'
                    }, children: [_jsx("h3", { style: { margin: '0 0 15px 0' }, children: "Import Test Case to Performance Suite" }), _jsx("p", { style: { marginBottom: 15, opacity: 0.8, fontSize: '0.9em' }, children: "Select a test case to import. All request steps from the test case will be added to this performance suite." }), _jsxs("div", { style: { maxHeight: 300, overflow: 'auto', marginBottom: 15 }, children: [projects.flatMap(p => (p.testSuites || []).flatMap(suite => (suite.testCases || []).map(tc => ({
                                    projectName: p.name,
                                    suiteName: suite.name,
                                    testCase: tc,
                                    // Count the request steps
                                    stepCount: (tc.steps || []).filter(s => s.type === 'request').length
                                })))).map((item, idx) => (_jsxs("div", { style: {
                                        padding: '10px', marginBottom: 5, borderRadius: 4,
                                        background: 'var(--vscode-list-hoverBackground)',
                                        cursor: 'pointer', border: '1px solid var(--vscode-widget-border)'
                                    }, onClick: () => {
                                        // Import all request steps from the test case
                                        const requestSteps = (item.testCase.steps || []).filter(s => s.type === 'request');
                                        if (requestSteps.length > 0) {
                                            for (const step of requestSteps) {
                                                const reqStep = step; // Request steps have additional properties
                                                bridge.sendMessage({
                                                    command: 'addPerformanceRequest',
                                                    suiteId: importToPerformanceModal.suiteId,
                                                    name: step.name || 'Imported Step',
                                                    endpoint: reqStep.endpoint || '',
                                                    method: reqStep.method || 'POST',
                                                    soapAction: reqStep.soapAction,
                                                    requestBody: reqStep.request || '',
                                                    headers: reqStep.headers || {},
                                                    extractors: reqStep.extractors || []
                                                });
                                            }
                                        }
                                        setImportToPerformanceModal({ open: false, suiteId: null });
                                    }, children: [_jsx("div", { style: { fontWeight: 'bold' }, children: item.testCase.name }), _jsxs("div", { style: { fontSize: '0.85em', opacity: 0.7 }, children: [item.projectName, " \u2192 ", item.suiteName] }), _jsxs("div", { style: { fontSize: '0.8em', opacity: 0.5 }, children: [item.stepCount, " request step", item.stepCount !== 1 ? 's' : ''] })] }, idx))), projects.flatMap(p => (p.testSuites || []).flatMap(s => s.testCases || [])).length === 0 && (_jsx("div", { style: { padding: 20, textAlign: 'center', opacity: 0.6 }, children: "No test cases available. Create a test suite first." }))] }), _jsx("button", { onClick: () => setImportToPerformanceModal({ open: false, suiteId: null }), style: {
                                background: 'var(--vscode-button-secondaryBackground)',
                                color: 'var(--vscode-button-secondaryForeground)',
                                border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer'
                            }, children: "Cancel" })] }) })), _jsx(ExtractorModal, { isOpen: !!extractorModal, data: extractorModal, onClose: () => setExtractorModal(null), onSave: (data) => {
                    handleSaveExtractor(data);
                    setExtractorModal(null);
                } }), _jsx(CreateReplaceRuleModal, { isOpen: replaceRuleModal.open, xpath: replaceRuleModal.xpath, matchText: replaceRuleModal.matchText, initialTarget: replaceRuleModal.target, onCancel: () => setReplaceRuleModal({ open: false, xpath: '', matchText: '', target: 'response' }), onSave: (rule) => {
                    // Create rule with unique ID and save to config
                    const newRule = {
                        id: crypto.randomUUID(),
                        name: rule.name,
                        xpath: rule.xpath,
                        matchText: rule.matchText,
                        replaceWith: rule.replaceWith,
                        target: rule.target,
                        enabled: true
                    };
                    const currentRules = config?.replaceRules || [];
                    bridge.sendMessage({
                        command: 'saveSettings',
                        raw: false,
                        config: { ...config, replaceRules: [...currentRules, newRule] }
                    });
                    setReplaceRuleModal({ open: false, xpath: '', matchText: '', target: 'response' });
                } }), _jsx(AddToProjectModal, { open: !!pendingAddInterface, onClose: () => setPendingAddInterface(null), existingProjects: projects.map(p => p.name), interfaceName: pendingAddInterface?._addAll ? `All ${exploredInterfaces.length} interfaces` : pendingAddInterface?.name, onSelectProject: (projectName) => {
                    if (pendingAddInterface) {
                        const isAddAll = pendingAddInterface._addAll;
                        if (isAddAll) {
                            // Add all explored interfaces to existing project
                            exploredInterfaces.forEach(iface => {
                                addInterfaceToNamedProject(iface, projectName, false);
                            });
                        }
                        else {
                            addInterfaceToNamedProject(pendingAddInterface, projectName, false);
                        }
                        // Switch to workspace tab after adding
                        setActiveView(SidebarView.PROJECTS);
                    }
                }, onCreateProject: (projectName) => {
                    if (pendingAddInterface) {
                        const isAddAll = pendingAddInterface._addAll;
                        if (isAddAll) {
                            // Create new project with all explored interfaces
                            // First interface creates the project, rest are added
                            exploredInterfaces.forEach((iface, i) => {
                                addInterfaceToNamedProject(iface, projectName, i === 0);
                            });
                        }
                        else {
                            addInterfaceToNamedProject(pendingAddInterface, projectName, true);
                        }
                        // Switch to workspace tab after adding
                        setActiveView(SidebarView.PROJECTS);
                    }
                } }), wsdlDiff && (_jsx(WsdlSyncModal, { diff: wsdlDiff, onClose: () => setWsdlDiff(null), onSync: handleApplyWsdlSync }))] }));
}
export default MainContent;
