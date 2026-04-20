
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { Container, ContextMenu, ContextMenuItem } from '../styles/App.styles';
import { bridge, isVsCode, isTauri } from '../utils/bridge';
import { updateProjectWithRename } from '../utils/projectUtils';
import { generateInitialXmlForOperation } from '../utils/soapUtils';
import { Sidebar } from './Sidebar';
import { WorkspaceLayout } from './WorkspaceLayout';
import { WorkspaceContext } from '../contexts/WorkspaceContext';
import { SidebarContext } from '../contexts/SidebarContext';
import { ProxyPanel } from './proxy/ProxyPanel';
import { AddToProjectDialog } from './proxy/AddToProjectDialog';
import type { TrafficLog } from './proxy/TrafficViewer';
import { RulesAndMockPage } from './proxy/RulesAndMockPage';
import { FileWatcherPage } from './proxy/FileWatcherPage';
import { HelpModal } from './HelpModal';

import { AddToTestCaseModal } from './modals/AddToTestCaseModal';
import { ConfirmationModal } from './modals/ConfirmationModal';
import { RenameModal } from './modals/RenameModal';
// import { SampleModal } from './modals/SampleModal'; // file is .skip — not yet available
import { ExtractorModal } from './modals/ExtractorModal';
import { SettingsEditorModal } from './modals/SettingsEditorModal';
import { AddToDevOpsModal } from './modals/AddToDevOpsModal';
import { AddToProjectModal } from './modals/AddToProjectModal';
import { WsdlSyncModal } from './modals/WsdlSyncModal';
import { DebugModal } from './modals/DebugModal';
import { PickRequestModal, PickRequestItem } from './modals/PickRequestModal';
import { ExportWorkspaceModal } from './modals/ExportWorkspaceModal';
// import { CodeSnippetModal } from './modals/CodeSnippetModal';
import { WorkflowBuilderModal } from './modals/WorkflowBuilderModal';
import { BulkImportModal, BulkImportResult } from './modals/BulkImportModal';
import { ApiRequest, TestCase, TestStep, SidebarView, RequestHistoryEntry, WsdlDiff, ApiInterface, Workflow, WorkflowStep, ApinoxProject } from '@shared/models';
import { BackendCommand, FrontendCommand } from '@shared/messages';
import { PERF_REQUEST_ID_PREFIX } from '../constants';
import { useMessageHandler } from '../hooks/useMessageHandler';
import { useProject } from '../contexts/ProjectContext';
import { useSelection } from '../contexts/SelectionContext';
import { useUI } from '../contexts/UIContext';
import { useNavigation } from '../contexts/NavigationContext';
import { usePerformance } from '../contexts/PerformanceContext';
import { useTestRunner } from '../contexts/TestRunnerContext';
import { useExplorer } from '../hooks/useExplorer';
import { useContextMenu } from '../hooks/useContextMenu';
import { useSidebarCallbacks } from '../hooks/useSidebarCallbacks';
import { useWorkspaceCallbacks } from '../hooks/useWorkspaceCallbacks';
import { useAppLifecycle } from '../hooks/useAppLifecycle';
import { useLayoutHandler } from '../hooks/useLayoutHandler';
import { useFolderManager } from '../hooks/useFolderManager';
import { useMobileLayout } from '../hooks/useMobileLayout';
import { useWorkflowHandlers } from '../hooks/useWorkflowHandlers';
import { ImportTestCaseModal } from './ImportTestCaseModal';

interface ConfirmationState {
    title: string;
    message: string;
    onConfirm: () => void;
}

const DangerMenuItem = styled(ContextMenuItem)`
    color: var(--apinox-errorForeground);
`;

const MainContent: React.FC = () => {
    // ==========================================================================
    // PLATFORM DETECTION
    // ==========================================================================
    const [platformOS, setPlatformOS] = useState<'macos' | 'windows' | 'linux' | 'android' | 'ios' | 'unknown'>('unknown');
    const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
    const { isMobile } = useMobileLayout();

    useEffect(() => {
        async function detectPlatform() {
            try {
                if (window.__TAURI__) {
                    const { invoke } = await import('@tauri-apps/api/core');
                    const os = await invoke<string>('get_platform_os');
                    setPlatformOS(os as any);
                }
            } catch (err) {
                console.error('Failed to detect platform:', err);
            }
        }
        detectPlatform();
    }, []);
    
    const isMobilePlatform = platformOS === 'android' || platformOS === 'ios';
    const showCustomTitleBar = platformOS !== 'macos' && !isMobilePlatform;
    
    // ==========================================================================
    // CONTEXT - Project state from ProjectContext
    // ==========================================================================
    const {
        projects,
        setProjects,
        selectedProjectName,
        setSelectedProjectName,
        workspaceDirty,
        setWorkspaceDirty,
        savedProjects,
        setSavedProjects,
        saveErrors,
        setSaveErrors,
        deleteConfirm,
        setDeleteConfirm,
        addProject,
        closeProject,
        loadProject,
        saveProject,
        toggleProjectExpand,
        toggleInterfaceExpand,
        toggleOperationExpand,
        expandAll,
        collapseAll,
        reorderItems
    } = useProject();

    // ==========================================================================
    // CONTEXT - Selection state from SelectionContext
    // ==========================================================================
    const {
        selectedInterface,
        setSelectedInterface,
        selectedOperation,
        setSelectedOperation,
        selectedRequest,
        setSelectedRequest,
        selectedStep,
        setSelectedStep,
        selectedTestCase,
        setSelectedTestCase,
        selectedWorkflowStep,
        setSelectedWorkflowStep,
        selectedPerformanceSuiteId,
        setSelectedPerformanceSuiteId,
        response,
        setResponse,
        loading,
        setLoading,
        selectedTestSuite,
        setSelectedTestSuite
    } = useSelection();

    // Notify backend that the Webview is ready and load initial data
    useEffect(() => {
        console.log('[MainContent] App initialized');
    }, []);

    // ==========================================================================
    // EXPLORER - from useExplorer hook
    // ==========================================================================
    const {
        exploredInterfaces,
        explorerExpanded,
        setExplorerExpanded,
        pendingAddInterface,
        setPendingAddInterface,
        addToProject,
        addInterfaceToNamedProject,
        addAllToProject,
        clearExplorer,
        removeFromExplorer,
        toggleExplorerExpand,
        toggleExploredInterface,
        toggleExploredOperation
    } = useExplorer({ projects, setProjects, setWorkspaceDirty, saveProject });

    // ==========================================================================
    // LOCAL STATE - Remaining state that stays in App
    // ==========================================================================


    // Backend Connection
    const [backendConnected, setBackendConnected] = useState(false);

    // ==========================================================================
    // UI state from UIContext
    // ==========================================================================
    const {
        activeView,
        setActiveView,
        sidebarExpanded,
        setSidebarExpanded
    } = useNavigation();

    const {
        layoutMode,
        setLayoutMode,
        showLineNumbers,
        setShowLineNumbers,
        inlineElementValues,
        setInlineElementValues,
        hideCausalityData,
        setHideCausalityData,

        showSettings,
        setShowSettings,
        initialSettingsTab,
        setInitialSettingsTab,
        openSettings,
        showHelp,
        setShowHelp,
        helpSection,
        setHelpSection,
        showDevOpsModal,
        setShowDevOpsModal,
        showDebugModal,
        setShowDebugModal,
        openDebugModal,
        config,
        setConfig,
        rawConfig,
        setRawConfig,
        configPath,
        setConfigPath,
        setConfigDir
    } = useUI();

    // ── Startup update check ─────────────────────────────────────────────────
    const [hasUpdate, setHasUpdate] = useState(false);
    useEffect(() => {
        bridge.invokeTauriCommand<{ has_update: boolean }>('check_for_updates')
            .then((res) => { if (res?.has_update) setHasUpdate(true); })
            .catch(() => { /* silent failure when offline */ });
    }, []);
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                openDebugModal();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [openDebugModal]);

    // Keyboard shortcut: Ctrl+Shift+D to open debug modal
    useEffect(() => {
        // If we switch TO Projects/Explorer view, and have a perf request selected -> Clear it
        if ((activeView === SidebarView.PROJECTS || activeView === SidebarView.EXPLORER) && selectedRequest?.id && selectedRequest.id.startsWith(PERF_REQUEST_ID_PREFIX)) {
            setSelectedRequest(null);
        }

        // Tests view handles its own selection logic via useTestCaseHandlers usually, but safely:
        if (activeView === SidebarView.TESTS && selectedRequest?.id && selectedRequest.id.startsWith(PERF_REQUEST_ID_PREFIX)) {
            setSelectedRequest(null);
        }
    }, [activeView, selectedRequest, setSelectedRequest]);

    // If we switch TO Performance view, and have a non-perf request selected -> Clear it
    useEffect(() => {
        if (activeView === SidebarView.PERFORMANCE && selectedRequest?.id && !selectedRequest.id.startsWith(PERF_REQUEST_ID_PREFIX)) {
            setSelectedRequest(null);
        }
    }, [activeView, selectedRequest, setSelectedRequest]);

    // Auto-select first performance suite when available
    useEffect(() => {
        const suites = config?.performanceSuites || [];
        if (suites.length > 0 && !selectedPerformanceSuiteId) {
            setSelectedPerformanceSuiteId(suites[0].id);
        }
    }, [config?.performanceSuites, selectedPerformanceSuiteId, setSelectedPerformanceSuiteId]);

    // Local State (remaining)
    const [selectedFile, setSelectedFile] = useState<string | null>(null);

    // inputType, wsdlUrl were in original.
    const [inputType, setInputType] = useState<'url' | 'file'>('url');
    const [wsdlUrl, setWsdlUrl] = useState<string>('');
    const [wsdlUrlHistory, setWsdlUrlHistory] = useState<string[]>([]);
    const [downloadStatus, setDownloadStatus] = useState<string[] | null>(null);
    const [wsdlUseProxy, setWsdlUseProxy] = useState<boolean>(false);
    const [wsdlDiff, setWsdlDiff] = useState<WsdlDiff | null>(null);

    // ==========================================================================
    // FOLDER HANDLERS - Work with project.folders for unified structure
    // ==========================================================================
    const {
        handleAddFolder,
        handleAddRequestToFolder,
        handleDeleteFolder,
        handleToggleFolderExpand
    } = useFolderManager({
        setProjects,
        setWorkspaceDirty,
        setSelectedRequest
    });

    // Log unused handlers temporarily


    // Bulk Import Modal State
    const [showBulkImportModal, setShowBulkImportModal] = useState(false);

    // Add-traffic-to-project dialog state
    const [addTrafficLog, setAddTrafficLog] = useState<TrafficLog | null>(null);

    const handleAddTrafficToProject = useCallback((log: TrafficLog) => {
        setAddTrafficLog(log);
    }, []);

    const handleConfirmAddTrafficToProject = useCallback((
        projectName: string,
        interfaceName: string,
        operationName: string,
        requestName: string,
    ) => {
        if (!addTrafficLog) return;
        const log = addTrafficLog;
        setAddTrafficLog(null);

        setProjects(prev => prev.map(p => {
            if (p.name !== projectName) return p;
            const newInterfaces = p.interfaces.map(iface => {
                if (iface.name !== interfaceName) return iface;
                const newOps = iface.operations.map(op => {
                    if (op.name !== operationName) return op;
                    const contentType = log.requestHeaders?.['Content-Type']
                        || log.requestHeaders?.['content-type']
                        || (iface.soapVersion === '1.2' ? 'application/soap+xml' : 'text/xml; charset=utf-8');
                    const newReq: import('@shared/models').ApiRequest = {
                        id: crypto.randomUUID(),
                        name: requestName,
                        request: log.requestBody || '',
                        endpoint: log.url,
                        method: (log.method as any) || 'POST',
                        contentType,
                        headers: { ...log.requestHeaders },
                        requestType: 'soap',
                        bodyType: 'xml',
                        dirty: true,
                    };
                    return { ...op, requests: [...op.requests, newReq], expanded: true };
                });
                return { ...iface, operations: newOps };
            });
            const updated = { ...p, interfaces: newInterfaces, dirty: true };
            setTimeout(() => saveProject(updated), 0);
            return updated;
        }));
    }, [addTrafficLog, setProjects, saveProject]);



    const handleUpdateProject = useCallback((oldProject: import('@shared/models').ApinoxProject, newProject: import('@shared/models').ApinoxProject) => {
        setProjects(prev => prev.map(p => p === oldProject ? newProject : p));
        // All projects are persisted to ~/.apinox/projects/{name}/ — always save
        saveProject(newProject);
    }, [setProjects, saveProject]);

    // ==========================================================================
    // CONTEXT MENU - from useContextMenu hook
    // ==========================================================================
    const {
        contextMenu,
        renameState,
        setRenameState,
        handleContextMenu,
        closeContextMenu,
        handleRename,
        handleDeleteRequest: _handleDeleteRequest,
        handleCloneRequest,
        handleAddRequest,
        handleDeleteInterface: _handleDeleteInterface,
        handleDeleteOperation: _handleDeleteOperation,
        handleViewSample,
        handleExportNative
    } = useContextMenu({
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
    const handleDeleteInterface = (iface: import('@shared/models').ApiInterface) => {
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

    const handleDeleteOperation = (op: import('@shared/models').ApiOperation, iface: import('@shared/models').ApiInterface) => {
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

    const handleDeleteRequest = (req?: import('@shared/models').ApiRequest) => {
        const target = req || (contextMenu?.type === 'request' ? contextMenu.data as import('@shared/models').ApiRequest : null);
        _handleDeleteRequest(req);

        if (target && selectedRequest?.id === target.id) {
            setSelectedRequest(null);
        }
    };

    // ==========================================================================
    // CONTEXT - Test Runner state from TestRunnerContext
    // ==========================================================================
    const {
        testExecution,
        handleSelectTestSuite,
        handleSelectTestCase,
        handleAddAssertion,
        handleAddExistenceAssertion,
        handleGenerateTestSuite,
        handleRunTestCaseWrapper,
        handleRunTestSuiteWrapper,
        handleSaveExtractor,
        executeRequest,
        cancelRequest,
        handleRequestUpdate,
        handleResetRequest,
        startTimeRef
    } = useTestRunner();

    const {
        activeRunId,
        performanceProgress,
        coordinatorStatus,
        expandedPerformanceSuiteIds,
        handleAddPerformanceSuite,
        handleDeletePerformanceSuite,
        handleRunPerformanceSuite,
        handleStopPerformanceRun,
        handleSelectPerformanceSuite,
        handleUpdatePerformanceSuite,
        handleAddPerformanceRequest,
        handleDeletePerformanceRequest,
        handleUpdatePerformanceRequest,
        handleSelectPerformanceRequest,
        handleStartCoordinator,
        handleStopCoordinator,
        handleTogglePerformanceSuiteExpand
    } = usePerformance();

    const selectedPerformanceSuite = config?.performanceSuites?.find((s: any) => s.id === selectedPerformanceSuiteId) || null;

    // ==========================================================================
    // SIDEBAR CALLBACKS - from useSidebarCallbacks hook
    // ==========================================================================
    const {
        handleAddSuite,
        handleDeleteSuite: _handleDeleteSuite,
        handleToggleSuiteExpand,
        handleToggleCaseExpand,
        handleAddTestCase,
        handleDeleteTestCase: _handleDeleteTestCase,
        handleRenameTestCase,
        handleRenameTestStep,
        handleSaveUiState
    } = useSidebarCallbacks({
        projects,
        setProjects,
        deleteConfirm,
        setDeleteConfirm,
        saveProject,
        config
    });

    // Wrapped Handlers for State Cleanup

    const handleDeleteSuite = (suiteId: string) => {
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

    const handleDeleteTestCase = (caseId: string) => {
        _handleDeleteTestCase(caseId);
        if (selectedTestCase?.id === caseId) {
            setSelectedTestCase(null);
            setSelectedStep(null);
        }
    };

    // Performance Handlers
    // ==========================================================================

    // Auto-select first test case when none is selected but test cases exist
    // ONLY in Tests view to avoid re-selecting after user clears selection for navigation
    useEffect(() => {
        if (activeView !== SidebarView.TESTS) return;
        // Flatten all test cases from all projects/suites
        const allCases = projects.flatMap(p =>
            (p.testSuites || []).flatMap(s => s.testCases || [])
        );
        if (allCases.length > 0 && !selectedTestCase) {
            setSelectedTestCase(allCases[0]);
        }
    }, [projects, selectedTestCase, setSelectedTestCase, activeView]);

    // Sync selectedTestCase with authoritative projects state when projects changes
    // This fixes stale data (e.g. scriptContent) after projectLoaded updates projects
    useEffect(() => {
        if (!selectedTestCase) return;

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

    const handleReplayRequest = (entry: RequestHistoryEntry) => {
        const req: ApiRequest = {
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
        } else {
            setResponse(null);
        }
    };

    const handleToggleHistoryStar = async (id: string) => {
        try {
            await bridge.invokeTauriCommand('toggle_star_history', { id });
            // Refresh history
            const updatedHistory = await bridge.invokeTauriCommand('get_history', {});
            setRequestHistory(updatedHistory);
        } catch (error) {
            console.error('[MainContent] Failed to toggle star:', error);
        }
    };

    const handleDeleteHistory = async (id: string) => {
        try {
            await bridge.invokeTauriCommand('delete_history_entry', { id });
            // Refresh history
            const updatedHistory = await bridge.invokeTauriCommand('get_history', {});
            setRequestHistory(updatedHistory);
        } catch (error) {
            console.error('[MainContent] Failed to delete history entry:', error);
        }
    };

    // Extractor Modal State (needed before useWorkspaceCallbacks)
    const [extractorModal, setExtractorModal] = React.useState<{ xpath: string, value: string, source: 'body' | 'header', variableName: string } | null>(null);

    // ==========================================================================
    // SYNC SELECTED REQUEST FROM PROJECTS
    // ==========================================================================
    // When projects updates, re-sync selectedRequest to point to the updated object reference
    // ONLY if the current selectedRequest is stale (not found in projects anymore)
    React.useEffect(() => {
        if (!selectedRequest || !selectedProjectName) return;

        const project = projects.find(p => p.name === selectedProjectName);
        if (!project) return;

        // Check if selectedRequest is stale by searching for it in projects
        let isStale = true;

        // Search in folders
        const checkInFolders = (folders: any[]): boolean => {
            for (const folder of folders) {
                // Check if selectedRequest object reference exists in this folder
                if (folder.requests.some((r: any) => r === selectedRequest)) {
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
        if (!isStale) return; // selectedRequest is still valid, don't re-sync

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
        if (!isStale) return;

        // Find the updated request by ID
        const findInFolders = (folders: any[]): any => {
            for (const folder of folders) {
                // STRICT MATCHING: If we have an ID, we MUST match by ID.
                const found = folder.requests.find((r: any) => {
                    if (selectedRequest.id) {
                        return r.id === selectedRequest.id;
                    }
                    return r.name === selectedRequest.name;
                });
                if (found) return found;
                if (folder.folders) {
                    const nested = findInFolders(folder.folders);
                    if (nested) return nested;
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
    const {
        handleSelectStep,
        handleDeleteStep,
        handleMoveStep,
        handleUpdateStep,
        handleAddStep,
        handleToggleLayout,
        handleToggleLineNumbers,
        handleToggleInlineElementValues,
        handleToggleHideCausalityData,
        handleAddExtractor,
        handleEditExtractor
    } = useWorkspaceCallbacks({
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
        config,
        setExtractorModal,
        onPickRequestForTestCase: (caseId) => {
            setPickRequestModal({ open: true, mode: 'testcase', caseId, suiteId: null });
        }
    });

    // Modals (remaining)
    const [confirmationModal, setConfirmationModal] = useState<ConfirmationState | null>(null);
    const [addToTestCaseModal, setAddToTestCaseModal] = React.useState<{ open: boolean, request: ApiRequest | null }>({ open: false, request: null });
    const [pickRequestModal, setPickRequestModal] = React.useState<{ open: boolean, mode: 'testcase' | 'performance', caseId: string | null, suiteId: string | null }>({ open: false, mode: 'testcase', caseId: null, suiteId: null });
    const [importToPerformanceModal, setImportToPerformanceModal] = React.useState<{ open: boolean, suiteId: string | null }>({ open: false, suiteId: null });
    const [sampleModal, setSampleModal] = React.useState<{ open: boolean, schema: any | null, operationName: string }>({ open: false, schema: null, operationName: '' });
    const [exportWorkspaceModal, setExportWorkspaceModal] = React.useState(false);
    // const [codeSnippetModal, setCodeSnippetModal] = React.useState<{ open: boolean, request: ApiRequest | null }>({ open: false, request: null });

    const handleExportWorkspace = useCallback(async (selectedProjects: ApinoxProject[]) => {
        try {
            // Use Tauri dialog to choose save location first
            const { save } = await import('@tauri-apps/plugin-dialog');
            const filePath = await save({
                defaultPath: 'workspace.apinox',
                filters: [{
                    name: 'APInox Workspace',
                    extensions: ['apinox', 'json']
                }]
            });

            if (!filePath) {
                // User cancelled
                setExportWorkspaceModal(false);
                return;
            }

            // Send export command to backend
            console.log('[Export] Sending export command:', {
                command: FrontendCommand.ExportWorkspace,
                projectCount: selectedProjects.length,
                projectNames: selectedProjects.map(p => p.name),
                filePath
            });
            await bridge.sendMessageAsync({
                command: FrontendCommand.ExportWorkspace,
                projects: selectedProjects,
                filePath
            });

            console.log(`[Export] Workspace exported to ${filePath}`);
            alert(`Workspace exported successfully to ${filePath}`);
        } catch (error: any) {
            console.error('[Export] Failed to export workspace:', error);
            alert(`Failed to export workspace: ${error.message || 'Unknown error'}`);
        }
        setExportWorkspaceModal(false);
    }, []);

    // ==========================================================================
    // WORKFLOW HANDLERS - extracted to useWorkflowHandlers hook
    // ==========================================================================
    const {
        workflowBuilderModal,
        setWorkflowBuilderModal,
        handleAddWorkflow,
        handleEditWorkflow,
        handleSaveWorkflow,
        handleRunWorkflow,
        handleDeleteWorkflow,
        handleDuplicateWorkflow,
        handleSelectWorkflow,
        handleSelectWorkflowStep,
        handleUpdateWorkflowStep,
        handleUpdateWorkflow,
    } = useWorkflowHandlers({
        config,
        setConfig,
        setWorkspaceDirty,
        selectedWorkflowStep,
        setSelectedWorkflowStep: setSelectedWorkflowStep as (step: { workflow: Workflow; step: WorkflowStep | null } | null) => void,
        setSelectedRequest,
        setActiveView,
        setLoading,
    });

    const pickRequestItems = useMemo<PickRequestItem[]>(() => {
        const items: PickRequestItem[] = [];

        const addOperationItems = (project: any) => {
            if (!project.interfaces) return;
            project.interfaces.forEach((iface: any) => {
                iface.operations?.forEach((op: any) => {
                    // If operation has multiple requests, add each one separately
                    if (op.requests && op.requests.length > 0) {
                        op.requests.forEach((req: any, idx: number) => {
                            items.push({
                                id: `${project.id || project.name}-op-${op.name}-req-${idx}`,
                                label: op.requests.length > 1 ? `${(op as any).displayName || op.name} [${idx + 1}/${op.requests.length}]` : ((op as any).displayName || op.name),
                                description: `${project.name} > ${(iface as any).displayName || iface.name} > ${req.name}`,
                                detail: req.endpoint || op.originalEndpoint || 'WSDL Operation',
                                type: 'request',
                                data: req
                            });
                        });
                    } else {
                        // No requests - add operation for SOAP XML generation
                        items.push({
                            id: `${project.id || project.name}-op-${op.name}`,
                            label: (op as any).displayName || op.name,
                            description: `${project.name} > ${(iface as any).displayName || iface.name}`,
                            detail: op.originalEndpoint || 'WSDL Operation',
                            type: 'operation',
                            data: op,
                            warning: true
                        });
                    }
                });
            });
        };

        const traverseFolders = (project: any, folders: any[], parentPath: string) => {
            folders.forEach(folder => {
                const currentPath = parentPath ? `${parentPath} / ${folder.name}` : folder.name;
                if (folder.requests) {
                    folder.requests.forEach((req: any) => {
                        if (!req) return;
                        items.push({
                            id: `${project.id || project.name}-req-${req.id || req.name}`,
                            label: req.name,
                            description: `${project.name} > ${currentPath}`,
                            detail: req.endpoint || 'Request',
                            type: 'request',
                            data: req
                        });
                    });
                }
                if (folder.folders) {
                    traverseFolders(project, folder.folders, currentPath);
                }
            });
        };

        projects.forEach((project: any) => {
            addOperationItems(project);
            if (project.folders) {
                traverseFolders(project, project.folders, '');
            }
        });

        return items;
    }, [projects]);

    // Workspace State
    const [changelog, setChangelog] = useState<string>('');
    const [requestHistory, setRequestHistory] = useState<RequestHistoryEntry[]>([]);

    useEffect(() => {
        if (!isTauri()) return;
        try {
            localStorage.setItem('apinox_history_cache', JSON.stringify(requestHistory));
        } catch (e) {
            console.warn('[History] Failed to cache history:', e);
        }
    }, [requestHistory]);

    const handleRefreshWsdl = useCallback((projectName: string, iface: ApiInterface) => {
        bridge.sendMessage({
            command: FrontendCommand.RefreshWsdl,
            projectId: projectName,
            // Use interface ID if available, fallback to definition (WSDL URL) for matching
            interfaceId: iface.id || iface.definition,
            interfaceName: iface.name // Keep for backward compatibility
        });
    }, []);

    const handleApplyWsdlSync = useCallback((diff: WsdlDiff) => {
        // Find project dirPath from projects context
        const project = projects.find(p => p.id === diff.projectId);
        const dirPath = project?.fileName || '';
        
        bridge.sendMessage({
            command: FrontendCommand.ApplyWsdlSync,
            projectId: diff.projectId,
            diff,
            dirPath
        });
        setWsdlDiff(null);
    }, [projects]);



    // Message Handler Hook
    // ==========================================================================
    // LAYOUT & VIEW SWITCHING
    // ==========================================================================

    const handleAddPerformanceRequestForUi = useCallback((suiteId: string) => {
        if (isTauri()) {
            setPickRequestModal({ open: true, mode: 'performance', caseId: null, suiteId });
            return;
        }
        handleAddPerformanceRequest(suiteId);
    }, [handleAddPerformanceRequest]);

    const {
        isResizing,
        splitRatio,
        startResizing,
        handleSetActiveViewWrapper,
        setSplitRatio
    } = useLayoutHandler({
        config,
        setConfig,
        layoutMode,
        activeView,
        sidebarExpanded,
        setSidebarExpanded,
        setActiveView,
        selectedRequest,
        setSelectedInterface,
        setSelectedOperation,
        setSelectedRequest,
        setSelectedTestCase,
        selectedPerformanceSuiteId,
        setSelectedPerformanceSuiteId
    });
    useMessageHandler({
        setProjects,
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
        setConfigDir,
        // setProxyConfig, // Handled in MockProxyContext
        setSelectedProjectName,
        setWsdlUrl,
        setWorkspaceDirty,
        setSavedProjects,
        setSaveErrors,
        setChangelog,
        // Mock/Proxy setters moved to MockProxyContext but kept for useSidebarCallbacks via MainContent state
        setActiveView,
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
        explorerExpanded,
        wsdlUrl,
        selectedProjectName,
        saveProject,
        setProjects,
        setExplorerExpanded,
        setWsdlUrl,
        setSelectedProjectName,
        setRequestHistory
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

    // Auto-save projects when workspace becomes dirty
    useEffect(() => {
        if (!workspaceDirty) return;

        console.log('[MainContent] Workspace dirty, scheduling auto-save');
        
        const timer = setTimeout(() => {
            console.log('[MainContent] Auto-save executing for', projects.length, 'projects');

            // All projects are always persisted to ~/.apinox/projects/{name}/
            projects.forEach(project => {
                console.log('[MainContent] Auto-saving project:', project.name);
                saveProject(project);
            });

            // Clear dirty flag after save
            setWorkspaceDirty(false);
        }, 1000); // Debounce 1 second

        return () => clearTimeout(timer);
    }, [workspaceDirty, projects, saveProject, setWorkspaceDirty]);


    // Handlers
    const loadWsdl = () => {
        if (inputType === 'url' && wsdlUrl) {
            bridge.sendMessage({ command: 'loadWsdl', url: wsdlUrl, isLocal: false, useProxy: wsdlUseProxy });
            // Add to history if not already present
            if (!wsdlUrlHistory.includes(wsdlUrl)) {
                setWsdlUrlHistory(prev => [wsdlUrl, ...prev].slice(0, 10)); // Keep last 10
            }
        } else if (inputType === 'file' && selectedFile) {
            bridge.sendMessage({ command: 'loadWsdl', url: selectedFile, isLocal: true, useProxy: false });
        }
    };

    const pickLocalWsdl = () => {
        bridge.sendMessage({ command: 'selectLocalWsdl' });
    };








    // Handle selection reset when closing a project (context handles the deletion)
    const handleCloseProject = (name: string) => {
        // If we're closing the selected project, clear selection
        if (deleteConfirm === name && selectedProjectName === name) {
            setSelectedInterface(null);
            setSelectedOperation(null);
            setSelectedRequest(null);
        }
        // Delegate to context
        closeProject(name);
    };

    // ==========================================================================
    // WORKSPACE CONTEXT VALUE - Aggregates all state for WorkspaceLayout subtree
    // ==========================================================================
    const workspaceContextValue = useMemo(() => ({
        // PROJECT STATE
        projects,
        dirtyProjects: new Set<string>(),
        selectedProjectName,
        setProjects,
        // SELECTION STATE
        selectedInterface,
        selectedOperation,
        selectedRequest,
        selectedTestSuite,
        selectedTestCase,
        selectedTestStep: selectedStep,
        selectedWorkflowStep,
        selectedPerformanceSuiteId,
        performanceHistory: config?.performanceHistory || [],
        performanceProgress,
        coordinatorStatus,
        // NAVIGATION
        activeView,
        // EXPLORER STATE
        inputType,
        setInputType,
        wsdlUrl,
        setWsdlUrl,
        loadWsdl: async (url: string, type: 'url' | 'file') => {
            setDownloadStatus(['Loading...']);
            if (type === 'url' && url) {
                bridge.sendMessage({ command: 'loadWsdl', url, isLocal: false, useProxy: wsdlUseProxy });
                if (!wsdlUrlHistory.includes(url)) {
                    setWsdlUrlHistory(prev => [url, ...prev].slice(0, 10));
                }
            } else if (type === 'file') {
                bridge.sendMessage({ command: 'loadWsdl', url, isLocal: true, useProxy: false });
            }
        },
        downloadStatus: !downloadStatus ? 'idle' as const
            : downloadStatus.some(s => s.toLowerCase().includes('error')) ? 'error' as const
            : downloadStatus.some(s => s.toLowerCase().includes('loading') || s.includes('Downloading')) ? 'loading' as const
            : 'success' as const,
        onClearSelection: () => {
            setSelectedInterface(null);
            setSelectedOperation(null);
            setSelectedRequest(null);
        },
        // REQUEST/RESPONSE STATE
        response,
        loading,
        // UI STATE
        layoutMode,
        showLineNumbers,
        splitRatio,
        isResizing,
        inlineElementValues,
        setInlineElementValues,
        hideCausalityData,
        setHideCausalityData,
        // CONFIG STATE
        config,
        defaultEndpoint: '',
        isReadOnly: false,
        backendConnected,
        // PROJECT ACTIONS
        addProject,
        updateProject: handleUpdateProject,
        closeProject: handleCloseProject,
        setDirty: (_name: string, _isDirty: boolean) => { /* managed by workspaceDirty flag */ },
        saveProject: (name: string): Promise<void> => {
            const p = projects.find(x => x.name === name);
            if (p) return Promise.resolve(saveProject(p)).then(() => {});
            return Promise.resolve();
        },
        // SELECTION ACTIONS
        selectInterface: setSelectedInterface,
        selectOperation: setSelectedOperation,
        selectRequest: setSelectedRequest,
        selectTestSuite: setSelectedTestSuite,
        selectTestCase: setSelectedTestCase,
        selectTestStep: handleSelectStep,
        selectWorkflowStep: (ws: any) => setSelectedWorkflowStep(ws),
        // REQUEST ACTIONS
        executeRequest,
        cancelRequest,
        updateRequest: handleRequestUpdate,
        resetRequest: handleResetRequest,
        // UI ACTIONS
        toggleLayout: handleToggleLayout,
        setLayoutMode,
        toggleLineNumbers: handleToggleLineNumbers,
        setShowLineNumbers,
        setSplitRatio,
        setIsResizing: startResizing,
        // TEST RUNNER
        handleAddAssertion,
        handleRunTestCase: handleRunTestCaseWrapper,
        handleRunTestSuite: handleRunTestSuiteWrapper,
        // TEST STEP
        updateTestStep: handleUpdateStep,
        deleteTestStep: handleDeleteStep,
        moveTestStep: handleMoveStep,
        addTestStep: handleAddStep,
        backToTestCase: () => { setSelectedStep(null); setSelectedRequest(null); },
        openStepRequest: (req: ApiRequest) => { setSelectedRequest(req); setActiveView(SidebarView.EXPLORER); },
        // PERFORMANCE
        handleAddPerformanceSuite,
        handleDeletePerformanceSuite,
        handleAddPerformanceRequest: handleAddPerformanceRequestForUi,
        handleDeletePerformanceRequest,
        handleUpdatePerformanceRequest,
        handleSelectPerformanceRequest,
        handleRunPerformanceSuite: handleRunPerformanceSuite as (suiteId: string) => Promise<void>,
        handleStopPerformanceRun,
        handleSelectPerformanceSuite,
        handleUpdatePerformanceSuite,
        handleStartCoordinator,
        handleStopCoordinator,
        // TEST EXECUTION
        testExecution,
        // EXTRACTOR & EXISTENCE ASSERTION
        handleAddExtractor,
        handleAddExistenceAssertion,
        // PERFORMANCE - import from workspace
        onImportFromWorkspace: (suiteId: string) => setImportToPerformanceModal({ open: true, suiteId }),
        // WORKFLOW UPDATE
        updateWorkflow: handleUpdateWorkflow,
        updateWorkflowStep: handleUpdateWorkflowStep,
    }), [
        projects, selectedProjectName, selectedInterface, selectedOperation, selectedRequest,
        selectedTestSuite, selectedTestCase, selectedStep, selectedWorkflowStep,
        selectedPerformanceSuiteId, config, performanceProgress, coordinatorStatus,
        activeView, inputType, wsdlUrl, downloadStatus, wsdlUseProxy, wsdlUrlHistory,
        response, loading, layoutMode, showLineNumbers, splitRatio, isResizing,
        inlineElementValues, hideCausalityData, backendConnected, testExecution,
        handleUpdateProject, handleCloseProject, handleSelectStep, handleToggleLayout,
        handleToggleLineNumbers, handleUpdateStep, handleDeleteStep, handleMoveStep,
        handleAddStep, handleRunTestCaseWrapper, handleRunTestSuiteWrapper,
        handleAddAssertion, handleAddPerformanceSuite, handleDeletePerformanceSuite,
        handleRunPerformanceSuite, handleStopPerformanceRun, handleSelectPerformanceSuite,
        handleUpdatePerformanceSuite, handleAddPerformanceRequestForUi,
        handleDeletePerformanceRequest, handleUpdatePerformanceRequest,
        handleSelectPerformanceRequest, handleStartCoordinator, handleStopCoordinator,
        executeRequest, cancelRequest, handleRequestUpdate, handleResetRequest,
        setSelectedInterface, setSelectedOperation, setSelectedRequest, setSelectedTestSuite,
        setSelectedTestCase, setSelectedWorkflowStep, setLayoutMode, setShowLineNumbers,
        setSplitRatio, startResizing, setInlineElementValues, setHideCausalityData,
        addProject, saveProject, setProjects, setSelectedStep, setActiveView,
        setDownloadStatus, setWsdlUrlHistory, handleAddExtractor, handleAddExistenceAssertion,
        handleUpdateWorkflow, handleUpdateWorkflowStep, setImportToPerformanceModal,
    ]);

    // ==========================================================================
    // SIDEBAR CONTEXT VALUE - Aggregates all state for the Sidebar subtree
    // ==========================================================================
    const sidebarContextValue = useMemo(() => ({
        projectProps: {
            projects,
            savedProjects,
            saveErrors,
            setSaveErrors,
            loadProject: () => loadProject(),
            saveProject,
            onUpdateProject: handleUpdateProject,
            closeProject: handleCloseProject,
            onAddProject: addProject,
            toggleProjectExpand,
            toggleInterfaceExpand,
            toggleOperationExpand,
            expandAll,
            collapseAll,
            reorderItems,
            onDeleteInterface: handleDeleteInterface,
            onDeleteOperation: handleDeleteOperation,
            onAddFolder: handleAddFolder,
            onAddRequestToFolder: handleAddRequestToFolder,
            onDeleteFolder: handleDeleteFolder,
            onToggleFolderExpand: handleToggleFolderExpand,
            onRefreshInterface: handleRefreshWsdl,
            onExportWorkspace: () => setExportWorkspaceModal(true),
            onBulkImport: () => setShowBulkImportModal(true),
            onImportSoapUI: async () => {
                if (bridge.isTauri()) {
                    const { open } = await import('@tauri-apps/plugin-dialog');
                    const selected = await open({
                        multiple: false,
                        directory: false,
                        filters: [{ name: 'SoapUI Workspace or Project', extensions: ['xml'] }],
                        title: 'Import SoapUI Workspace or Project',
                    });
                    if (selected) {
                        await loadProject(selected as string);
                    }
                }
            },
        },
        explorerProps: {
            exploredInterfaces,
            explorerExpanded,
            toggleExplorerExpand,
            addToProject,
            addAllToProject,
            clearExplorer,
            removeFromExplorer,
            toggleExploredInterface,
            toggleExploredOperation,
        },
        wsdlProps: {
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
            setUseProxy: setWsdlUseProxy,
        },
        selectionProps: {
            selectedProjectName,
            setSelectedProjectName,
            selectedInterface,
            setSelectedInterface,
            selectedOperation,
            setSelectedOperation,
            selectedRequest,
            setSelectedRequest: (req: import('@shared/models').ApiRequest | null) => {
                setSelectedRequest(req);
                setSelectedTestCase(null);
            },
            setResponse,
            handleContextMenu,
            onAddRequest: handleAddRequest,
            onDeleteRequest: handleDeleteRequest,
            deleteConfirm,
            setDeleteConfirm,
        },
        testRunnerProps: {
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
            onToggleCaseExpand: handleToggleCaseExpand,
        },
        testsProps: {
            projects,
            selectedTestSuite,
            selectedTestCase,
            onAddSuite: handleAddSuite,
            onDeleteSuite: handleDeleteSuite,
            onRunSuite: handleRunTestSuiteWrapper,
            onAddTestCase: handleAddTestCase,
            onDeleteTestCase: handleDeleteTestCase,
            onRenameTestCase: handleRenameTestCase,
            onRunCase: handleRunTestCaseWrapper,
            onSelectSuite: handleSelectTestSuite,
            onSelectTestCase: handleSelectTestCase,
            onSelectTestStep: (caseId: string, stepId: string) => {
                const project = projects.find(p => p.testSuites?.some(s => s.testCases?.some(tc => tc.id === caseId)));
                const suite = project?.testSuites?.find(s => s.testCases?.some(tc => tc.id === caseId));
                const testCase = suite?.testCases?.find(tc => tc.id === caseId);
                const step = testCase?.steps?.find(s => s.id === stepId);
                if (step) handleSelectStep(step);
            },
            onRenameTestStep: handleRenameTestStep,
            onToggleSuiteExpand: handleToggleSuiteExpand,
            onToggleCaseExpand: handleToggleCaseExpand,
            deleteConfirm,
        },
        workflowsProps: {
            workflows: config?.workflows || [],
            onAdd: handleAddWorkflow,
            onEdit: handleEditWorkflow,
            onRun: handleRunWorkflow,
            onDelete: handleDeleteWorkflow,
            onDuplicate: handleDuplicateWorkflow,
            onSelect: handleSelectWorkflow,
            onSelectStep: handleSelectWorkflowStep,
        },
        performanceProps: {
            suites: config?.performanceSuites || [],
            onAddSuite: handleAddPerformanceSuite,
            onDeleteSuite: handleDeletePerformanceSuite,
            onRunSuite: handleRunPerformanceSuite,
            onSelectSuite: handleSelectPerformanceSuite,
            onStopRun: handleStopPerformanceRun,
            isRunning: !!activeRunId,
            activeRunId,
            selectedSuiteId: selectedPerformanceSuiteId ?? undefined,
            deleteConfirm,
            setDeleteConfirm,
            onAddRequest: handleAddPerformanceRequestForUi,
        },
        historyProps: {
            history: requestHistory,
            onReplay: handleReplayRequest,
            onToggleStar: handleToggleHistoryStar,
            onDelete: handleDeleteHistory,
        },
        activeView,
        onChangeView: handleSetActiveViewWrapper,
        sidebarExpanded,
        backendConnected,
        workspaceDirty,
        showBackendStatus: !isVsCode(),
        onOpenSettings: () => setShowSettings(true),
        onOpenHelp: () => setShowHelp(true),
        onSaveUiState: handleSaveUiState,
        activeEnvironment: config?.activeEnvironment,
        environments: config?.environments,
        onChangeEnvironment: (env: string) => bridge.sendMessage({ command: 'setActiveEnvironment', env }),
        isMobileOpen: isMobileDrawerOpen,
        onMobileClose: isMobilePlatform ? () => setIsMobileDrawerOpen(false) : undefined,
        hasUpdate,
    }), [
        projects, savedProjects, saveErrors, setSaveErrors, loadProject, saveProject,
        handleUpdateProject, handleCloseProject, addProject,
        toggleProjectExpand, toggleInterfaceExpand, toggleOperationExpand,
        expandAll, collapseAll, reorderItems,
        handleDeleteInterface, handleDeleteOperation,
        handleAddFolder, handleAddRequestToFolder, handleDeleteFolder, handleToggleFolderExpand,
        handleRefreshWsdl, setExportWorkspaceModal, setShowBulkImportModal,
        exploredInterfaces, explorerExpanded, toggleExplorerExpand,
        addToProject, addAllToProject, clearExplorer, removeFromExplorer,
        toggleExploredInterface, toggleExploredOperation,
        inputType, setInputType, wsdlUrl, setWsdlUrl, wsdlUrlHistory,
        selectedFile, loadWsdl, pickLocalWsdl, downloadStatus, wsdlUseProxy, setWsdlUseProxy,
        selectedProjectName, setSelectedProjectName,
        selectedInterface, setSelectedInterface,
        selectedOperation, setSelectedOperation,
        selectedRequest, setSelectedRequest, setSelectedTestCase, setResponse,
        handleContextMenu, handleAddRequest, handleDeleteRequest, deleteConfirm, setDeleteConfirm,
        handleAddSuite, handleDeleteSuite, handleRunTestSuiteWrapper,
        handleAddTestCase, handleDeleteTestCase, handleRenameTestCase,
        handleRunTestCaseWrapper, handleSelectTestSuite, handleSelectTestCase,
        handleToggleSuiteExpand, handleToggleCaseExpand, handleSelectStep, handleRenameTestStep,
        selectedTestSuite, selectedTestCase,
        config, activeRunId, selectedPerformanceSuiteId,
        handleAddWorkflow, handleEditWorkflow, handleRunWorkflow,
        handleDeleteWorkflow, handleDuplicateWorkflow, handleSelectWorkflow, handleSelectWorkflowStep,
        handleAddPerformanceSuite, handleDeletePerformanceSuite, handleRunPerformanceSuite,
        handleSelectPerformanceSuite, handleStopPerformanceRun, handleAddPerformanceRequestForUi,
        requestHistory, handleReplayRequest, handleToggleHistoryStar, handleDeleteHistory,
        activeView, handleSetActiveViewWrapper, sidebarExpanded, backendConnected,
        workspaceDirty, handleSaveUiState, setShowSettings, setShowHelp,
        isMobileDrawerOpen, isMobilePlatform, setIsMobileDrawerOpen, hasUpdate,
    ]);

    return (
        <Container onClick={closeContextMenu} $showCustomTitleBar={showCustomTitleBar} $isMacOS={platformOS === 'macos'} $isMobile={isMobilePlatform} $isAndroid={platformOS === 'android'}>
            {/* Mobile header bar — replaces desktop TitleBar on Android/iOS */}
            {isMobilePlatform && (
                <div className="mobile-header">
                    <button
                        className="mobile-hamburger"
                        onClick={(e) => { e.stopPropagation(); setIsMobileDrawerOpen(prev => !prev); }}
                        title={isMobileDrawerOpen ? "Close sidebar" : "Open sidebar"}
                        aria-label={isMobileDrawerOpen ? "Close sidebar" : "Open sidebar"}
                    >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 4h16v2H2zM2 9h16v2H2zM2 14h16v2H2z"/>
                        </svg>
                    </button>
                    <span className="mobile-header-title">APInox</span>
                </div>
            )}

            {/* Narrow-desktop hamburger — fixed overlay in TitleBar area, only on non-mobile platforms */}
            {isMobile && !isMobilePlatform && (
                <button
                    className="narrow-desktop-hamburger"
                    onClick={(e) => { e.stopPropagation(); setIsMobileDrawerOpen(prev => !prev); }}
                    title={isMobileDrawerOpen ? "Close sidebar" : "Open sidebar"}
                    aria-label={isMobileDrawerOpen ? "Close sidebar" : "Open sidebar"}
                >
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 4h16v2H2zM2 9h16v2H2zM2 14h16v2H2z"/>
                    </svg>
                </button>
            )}

            {/* Backdrop — closes sidebar on mobile when tapping outside */}
            {isMobile && isMobileDrawerOpen && (
                <div
                    className="sidebar-backdrop"
                    onClick={() => setIsMobileDrawerOpen(false)}
                />
            )}

            {/* Content row: sidebar + main workspace side by side */}
            <div className="content-row">

            {/* Sidebar — all props supplied via SidebarContext */}
            <SidebarContext.Provider value={sidebarContextValue}>
                <Sidebar />
            </SidebarContext.Provider>

            {activeView === SidebarView.PROXY && (
                <ProxyPanel
                    onNavigateTo={(view) => handleSetActiveViewWrapper(view as SidebarView)}
                    onAddToApinoxProject={handleAddTrafficToProject}
                />
            )}
            {activeView === SidebarView.MOCK && (
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <RulesAndMockPage />
                </div>
            )}
            {activeView === SidebarView.WATCHER && (
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <FileWatcherPage />
                </div>
            )}
            {/* WorkspaceLayout using WorkspaceContext - no props needed */}
            {activeView !== SidebarView.PROXY && activeView !== SidebarView.MOCK && activeView !== SidebarView.WATCHER && (
                <WorkspaceContext.Provider value={workspaceContextValue}>
                    <WorkspaceLayout />
                </WorkspaceContext.Provider>
            )}
            {
                showDevOpsModal && config?.azureDevOps?.orgUrl && config?.azureDevOps?.project && selectedRequest && (
                    <AddToDevOpsModal
                        orgUrl={config.azureDevOps.orgUrl}
                        project={config.azureDevOps.project}
                        requestContent={selectedRequest.request || ''}
                        responseContent={response?.body}
                        requestName={selectedRequest.name}
                        onClose={() => setShowDevOpsModal(false)}
                    />
                )
            }

            {
                showSettings && (
                    <SettingsEditorModal
                        rawConfig={rawConfig}
                        onClose={() => {
                            setShowSettings(false);
                            setInitialSettingsTab(null);
                        }}
                        onSave={async (content, config) => {
                            if (isTauri()) {
                                try {
                                    await bridge.sendMessageAsync({
                                        command: FrontendCommand.SaveSettings,
                                        raw: !config,
                                        content,
                                        config
                                    });
                                    const data: any = await bridge.sendMessageAsync({
                                        command: FrontendCommand.GetSettings
                                    });
                                    bridge.emit({
                                        command: BackendCommand.SettingsUpdate,
                                        config: data?.config ?? data ?? null,
                                        raw: data?.raw,
                                        configDir: data?.configDir,
                                        configPath: data?.configPath
                                    } as any);
                                } catch (e) {
                                    // fallback to fire-and-forget
                                    bridge.sendMessage({ command: FrontendCommand.SaveSettings, raw: !config, content, config });
                                }
                                return;
                            }

                            bridge.sendMessage({ command: 'saveSettings', raw: !config, content, config });
                        }}
                        initialTab={initialSettingsTab}
                    />
                )
            }
            {
                showHelp && (
                    <HelpModal
                        initialSectionId={helpSection}
                        onClose={() => {
                            setShowHelp(false);
                            setHelpSection(null);
                        }}
                    />
                )
            }
            {
                showDebugModal && (
                    <DebugModal
                        isOpen={showDebugModal}
                        onClose={() => setShowDebugModal(false)}
                    />
                )
            }
            {
                addTrafficLog && (
                    <AddToProjectDialog
                        log={addTrafficLog}
                        projects={projects}
                        onConfirm={handleConfirmAddTrafficToProject}
                        onClose={() => setAddTrafficLog(null)}
                    />
                )
            }
            {
                exportWorkspaceModal && (
                    <ExportWorkspaceModal
                        isOpen={exportWorkspaceModal}
                        onClose={() => setExportWorkspaceModal(false)}
                        projects={projects}
                        onExport={handleExportWorkspace}
                    />
                )
            }
            {/* Code snippet modal temporarily disabled during package migration
                codeSnippetModal.open && codeSnippetModal.request && (
                    <CodeSnippetModal
                        isOpen={codeSnippetModal.open}
                        onClose={() => setCodeSnippetModal({ open: false, request: null })}
                        request={codeSnippetModal.request}
                        environment={config?.activeEnvironment && config?.environments
                            ? config.environments[config.activeEnvironment]
                            : undefined}
                    />
                )
            */}
            {
                workflowBuilderModal.open && (
                    <WorkflowBuilderModal
                        isOpen={workflowBuilderModal.open}
                        onClose={() => {
                            console.log('[Workflows] Closing modal');
                            setWorkflowBuilderModal({ open: false, workflow: null, projectPath: null });
                        }}
                        workflow={workflowBuilderModal.workflow || undefined}
                        onSave={handleSaveWorkflow}
                        projects={projects}
                    />
                )
            }
            {
                contextMenu && (
                    <ContextMenu top={contextMenu.y} left={contextMenu.x}>
                        {(contextMenu.type === 'request' || contextMenu.type === 'project' || contextMenu.type === 'folder') && (
                            <ContextMenuItem onClick={handleRename}>Rename</ContextMenuItem>
                        )}
                        {contextMenu.type === 'project' && (
                            <ContextMenuItem onClick={() => handleExportNative(contextMenu.data)}>Export to Native Format</ContextMenuItem>
                        )}
                        {!contextMenu.isExplorer && contextMenu.type === 'request' && (
                            <>
                                <ContextMenuItem onClick={handleCloneRequest}>Clone Request</ContextMenuItem>
                                {/* Code snippet temporarily disabled during package migration
                                <ContextMenuItem onClick={() => {
                                    if (contextMenu) {
                                        setCodeSnippetModal({ open: true, request: contextMenu.data as ApiRequest });
                                        closeContextMenu();
                                    }
                                }}>Copy as Code...</ContextMenuItem>
                                */}
                                <ContextMenuItem onClick={() => {
                                    if (contextMenu) {
                                        setAddToTestCaseModal({ open: true, request: contextMenu.data as ApiRequest });
                                        closeContextMenu();
                                    }
                                }}>Add to Test Case</ContextMenuItem>
                                <DangerMenuItem onClick={() => handleDeleteRequest()}>Delete</DangerMenuItem>
                            </>
                        )}
                        {(contextMenu.type === 'operation') && (
                            <>
                                <ContextMenuItem onClick={() => handleGenerateTestSuite(contextMenu.data)}>Generate Test Suite</ContextMenuItem>
                                <ContextMenuItem onClick={() => handleAddRequest()}>Add Request</ContextMenuItem>
                                <ContextMenuItem onClick={handleViewSample}>View Sample Schema</ContextMenuItem>
                            </>
                        )}
                        {(contextMenu.type === 'interface') && (
                            <>
                                <ContextMenuItem onClick={handleRename}>Rename</ContextMenuItem>
                                <ContextMenuItem onClick={() => handleGenerateTestSuite(contextMenu.data)}>Generate Test Suite</ContextMenuItem>
                            </>
                        )}
                    </ContextMenu>
                )
            }



            {/* Rename Modal */}
            <RenameModal
                isOpen={!!renameState}
                title={`Rename ${renameState?.type} `}
                initialValue={renameState?.value || ''}
                onCancel={() => setRenameState(null)}
                onSave={(value) => {
                    if (!renameState) return;
                    // Apply rename logic here (update state)
                    if (renameState.type === 'project') {
                        setProjects(projects.map(p => p === renameState.data ? { ...p, name: value } : p));
                    } else if (renameState.type === 'interface') {
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
                    } else if (renameState.type === 'folder' || renameState.type === 'request') {
                        // Use helper to handle deep recursion for folders and requests within them
                        setProjects(prev => updateProjectWithRename(
                            prev,
                            renameState.data.id || renameState.data.name, // Use ID if available, else name
                            renameState.type as 'folder' | 'request',
                            value,
                            renameState.data
                        ));

                    }

                    setRenameState(null);
                }}
            />

            {/* Sample Schema Modal - temporarily disabled
            <SampleModal
                isOpen={sampleModal.open}
                operationName={sampleModal.operationName}
                schema={sampleModal.schema}
                onClose={() => setSampleModal({ open: false, schema: null, operationName: '' })}
            />
            */}

            {/* Add to Test Case Modal */}
            {
                addToTestCaseModal.open && addToTestCaseModal.request && (
                    <AddToTestCaseModal
                        projects={projects}
                        onClose={() => setAddToTestCaseModal({ open: false, request: null })}
                        onAdd={(target) => {
                            const req = addToTestCaseModal.request!;
                            const newStep: TestStep = {
                                id: `step-${Date.now()}`,
                                name: req.name,
                                type: 'request',
                                config: {
                                    request: {
                                        ...req,
                                        id: `req-${Date.now()}`,
                                        // Explicitly preserve requestType and bodyType to prevent defaulting to soap
                                        requestType: req.requestType || 'soap',
                                        bodyType: req.bodyType
                                    },
                                    requestId: undefined
                                }
                            };

                            setProjects(prev => prev.map(p => {
                                const suite = target.suiteId ? p.testSuites?.find(s => s.id === target.suiteId) :
                                    p.testSuites?.find(s => s.testCases.some(tc => tc.id === target.caseId));

                                if (!suite) return p;

                                const updatedTestSuites = (p.testSuites || []).map(s => {
                                    if (s.id === suite.id) {
                                        // If creating new case
                                        if (target.type === 'new') {
                                            const newCase: TestCase = {
                                                id: `tc-${Date.now()}`,
                                                name: `TestCase ${(s.testCases?.length || 0) + 1}`,
                                                expanded: true,
                                                steps: [newStep]
                                            };
                                            return { ...s, testCases: [...(s.testCases || []), newCase] };
                                        }
                                        // If adding to existing
                                        if (target.type === 'existing' && target.caseId) {
                                            return {
                                                ...s,
                                                testCases: s.testCases.map(tc =>
                                                    tc.id === target.caseId ? { ...tc, steps: [...tc.steps, newStep] } : tc
                                                )
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
                        }}
                    />
                )
            }

            {pickRequestModal.open && (
                <PickRequestModal
                    isOpen={pickRequestModal.open}
                    items={pickRequestItems}
                    title="Add Request to Test Case"
                    onClose={() => setPickRequestModal({ open: false, mode: 'testcase', caseId: null, suiteId: null })}
                    onSelect={(item) => {
                        if (pickRequestModal.mode === 'performance') {
                            const suiteId = pickRequestModal.suiteId;
                            if (!suiteId) return;
                            bridge.emit({
                                command: BackendCommand.AddOperationToPerformance,
                                suiteId,
                                ...(item.type === 'request' ? { request: item.data } : { operation: item.data })
                            });
                            setPickRequestModal({ open: false, mode: 'testcase', caseId: null, suiteId: null });
                            return;
                        }
                        const caseId = pickRequestModal.caseId;
                        if (!caseId) return;
                        bridge.emit({
                            command: BackendCommand.AddStepToCase,
                            caseId,
                            ...(item.type === 'request' ? { request: item.data } : { operation: item.data })
                        });
                        setPickRequestModal({ open: false, mode: 'testcase', caseId: null, suiteId: null });
                    }}
                />
            )}

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!confirmationModal}
                title={confirmationModal?.title || ''}
                message={confirmationModal?.message || ''}
                onCancel={() => setConfirmationModal(null)}
                onConfirm={() => {
                    confirmationModal?.onConfirm();
                    setConfirmationModal(null);
                }}
            />

            {/* Extractor Modal */}
            <ExtractorModal
                isOpen={!!extractorModal}
                data={extractorModal}
                onClose={() => setExtractorModal(null)}
                onSave={(data) => {
                    handleSaveExtractor(data);
                    setExtractorModal(null);
                }}
            />

            {/* Add to Project Modal */}
            <AddToProjectModal
                open={!!pendingAddInterface}
                onClose={() => setPendingAddInterface(null)}
                existingProjects={projects.map(p => p.name)}
                interfaceName={(pendingAddInterface as any)?._addAll ? `All ${exploredInterfaces.length} interfaces` : pendingAddInterface?.name}
                onSelectProject={(projectName) => {
                    if (pendingAddInterface) {
                        const isAddAll = (pendingAddInterface as any)._addAll;
                        if (isAddAll) {
                            // Add all explored interfaces to existing project
                            exploredInterfaces.forEach(iface => {
                                addInterfaceToNamedProject(iface, projectName, false);
                            });
                        } else {
                            addInterfaceToNamedProject(pendingAddInterface, projectName, false);
                        }
                        // Switch to workspace tab after adding
                        setActiveView(SidebarView.PROJECTS);
                    }
                }}
                onCreateProject={(projectName) => {
                    if (pendingAddInterface) {
                        const isAddAll = (pendingAddInterface as any)._addAll;
                        if (isAddAll) {
                            // Create new project with all explored interfaces
                            // First interface creates the project, rest are added
                            exploredInterfaces.forEach((iface, i) => {
                                addInterfaceToNamedProject(iface, projectName, i === 0);
                            });
                        } else {
                            addInterfaceToNamedProject(pendingAddInterface, projectName, true);
                        }
                        // Switch to workspace tab after adding
                        setActiveView(SidebarView.PROJECTS);
                    }
                }}
            />

            {/* Bulk Import Modal */}
            <BulkImportModal
                open={showBulkImportModal}
                onClose={() => setShowBulkImportModal(false)}
                existingProjects={projects.filter(p => !p.readOnly).map(p => p.name)}
                onImportComplete={(results: BulkImportResult[], projectName: string, isNew: boolean) => {
                    // Collect all successful interfaces
                    const successfulInterfaces = results
                        .filter(r => r.success && r.interfaces)
                        .flatMap(r => r.interfaces || []);

                    if (successfulInterfaces.length === 0) return;

                    // Add all interfaces to the project
                    successfulInterfaces.forEach((iface, i) => {
                        addInterfaceToNamedProject(iface, projectName, isNew && i === 0);
                    });

                    // Switch to workspace view
                    setActiveView(SidebarView.PROJECTS);
                }}
                onParseUrl={async (url: string) => {
                    const response = await bridge.sendMessageAsync({
                        command: FrontendCommand.LoadWsdl,
                        url
                    });

                    // Convert ApiService[] to ApiInterface[] (same logic as useMessageHandler.ts)
                    const data = response as any[];
                    const newInterfaces: ApiInterface[] = [];

                    if (Array.isArray(data)) {
                        // WSDL Handling: Convert SoapService[] to ApiInterface[]
                        data.forEach((svc: any) => {
                            // Group operations by Port
                            const operationsByPort = new Map<string, any[]>();
                            (svc.operations || []).forEach((op: any) => {
                                const port = op.portName || 'Default';
                                if (!operationsByPort.has(port)) {
                                    operationsByPort.set(port, []);
                                }
                                operationsByPort.get(port)!.push(op);
                            });

                            // Create an Interface for each Port
                            operationsByPort.forEach((ops, portName) => {
                                const interfaceName = portName === 'Default' ? svc.name : portName;

                                newInterfaces.push({
                                    id: crypto.randomUUID(),
                                    name: interfaceName,
                                    type: 'wsdl',
                                    bindingName: portName,
                                    soapVersion: portName.includes('12') ? '1.2' : '1.1',
                                    definition: url,
                                    expanded: false,
                                    operations: ops.map((op: any) => ({
                                        id: crypto.randomUUID(),
                                        name: op.name,
                                        action: '',
                                        input: op.input,
                                        fullSchema: op.fullSchema,
                                        targetNamespace: op.targetNamespace || svc.targetNamespace,
                                        originalEndpoint: op.originalEndpoint,
                                        expanded: false,
                                        requests: [{
                                            id: crypto.randomUUID(),
                                            name: 'Sample',
                                            endpoint: op.originalEndpoint,
                                            contentType: portName.includes('12') ? 'application/soap+xml' : 'text/xml',
                                            headers: {
                                                'Content-Type': portName.includes('12') ? 'application/soap+xml' : 'text/xml'
                                            },
                                            request: generateInitialXmlForOperation(op),
                                            requestType: 'soap' as const,
                                            bodyType: 'xml' as const
                                        }]
                                    }))
                                });
                            });
                        });
                    } else if (data && (data as any).interfaces) {
                        // OpenAPI Handling: Already correctly formatted
                        newInterfaces.push(...(data as any).interfaces);
                    }

                    return newInterfaces;
                }}
            />

            </div>{/* end content-row */}

            {wsdlDiff && (
                <WsdlSyncModal
                    diff={wsdlDiff}
                    onClose={() => setWsdlDiff(null)}
                    onSync={handleApplyWsdlSync}
                />
            )}

            {/* Import to Performance Suite Modal */}
            <ImportTestCaseModal
                open={importToPerformanceModal.open}
                suiteId={importToPerformanceModal.suiteId}
                projects={projects}
                onClose={() => setImportToPerformanceModal({ open: false, suiteId: null })}
            />
        </Container >
    );
}

export default MainContent;
