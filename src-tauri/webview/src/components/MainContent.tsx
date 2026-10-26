
import React, { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { Container } from '../styles/App.styles';
import { bridge, commandErrorText, isTauri } from '../utils/bridge';
import { saveImportedProjectsAsUnified } from '../utils/importUnifiedStore';
import { captureLog } from '../utils/logger';
import { generateInitialXmlForOperation } from '../utils/soapUtils';
import { Sidebar } from './Sidebar';
import { WorkspaceContext } from '../contexts/WorkspaceContext';
import { SidebarContext } from '../contexts/SidebarContext';
import { matchTrafficToOperations, type AddToProjectDestination } from '../utils/trafficMatch';
import { lastPathSegment } from '../utils/trafficWorkflow';
import type { TrafficLog } from './proxy/TrafficViewer';
import type { PickRequestItem } from './modals/PickRequestModal';
import type { BulkImportResult } from './modals/BulkImportModal';
import { ApiRequest, TestCase, TestStep, TestSuite, SidebarView, RequestHistoryEntry, WsdlDiff, ApiInterface, ApiOperation, ApinoxProject, UnifiedProject, ScrapbookRequest } from '@shared/models';
import { buildTrafficTestSteps } from '../utils/trafficTestCase';
import { BackendCommand, FrontendCommand } from '@shared/messages';
import { PERF_REQUEST_ID_PREFIX } from '../constants';
import { useMessageHandler } from '../hooks/useMessageHandler';
import { useProject } from '../contexts/ProjectContext';
import { useSelection } from '../contexts/SelectionContext';
import { useUI } from '../contexts/UIContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useUnifiedProjects } from '../contexts/UnifiedProjectContext';
import { usePerformance } from '../contexts/PerformanceContext';
import { useTestRunner } from '../contexts/TestRunnerContext';
import { useScrapbook } from '../contexts/ScrapbookContext';
import { useTestSuites } from '../contexts/TestSuiteContext';
import { useSidebarCallbacks } from '../hooks/useSidebarCallbacks';
import { useWorkspaceCallbacks } from '../hooks/useWorkspaceCallbacks';
import { useAppLifecycle } from '../hooks/useAppLifecycle';
import { useLayoutHandler } from '../hooks/useLayoutHandler';
import { useMobileLayout } from '../hooks/useMobileLayout';
import { useTestsAutoSelect } from '../hooks/useTestsAutoSelect';
import { useUnifiedExplorerHandlers } from '../hooks/useUnifiedExplorerHandlers';
import { NotesProvider } from '../notes/NotesContext';

const NotesEditorLazy = React.lazy(() =>
    import('../notes/NotesEditor').then(module => ({ default: module.NotesEditor }))
);

interface ConfirmationState {
    title: string;
    message: string;
    onConfirm: () => void;
}

const WorkspaceLayout = React.lazy(() =>
    import('./WorkspaceLayout').then(module => ({ default: module.WorkspaceLayout }))
);
const ProxyPanel = React.lazy(() =>
    import('./proxy/ProxyPanel').then(module => ({ default: module.ProxyPanel }))
);
const RulesAndMockPage = React.lazy(() =>
    import('./proxy/RulesAndMockPage').then(module => ({ default: module.RulesAndMockPage }))
);
const UnifiedExplorerView = React.lazy(() =>
    import('./explorer/UnifiedExplorerView').then(module => ({ default: module.UnifiedExplorerView }))
);
const HelpModal = React.lazy(() =>
    import('./HelpModal').then(module => ({ default: module.HelpModal }))
);
const AddToProjectDialog = React.lazy(() =>
    import('./proxy/AddToProjectDialog').then(module => ({ default: module.AddToProjectDialog }))
);
const AddToTestCaseModal = React.lazy(() =>
    import('./modals/AddToTestCaseModal').then(module => ({ default: module.AddToTestCaseModal }))
);

const CreateTestCaseFromTrafficWizard = React.lazy(() =>
    import('./proxy/CreateTestCaseFromTrafficWizard').then(module => ({ default: module.CreateTestCaseFromTrafficWizard }))
);
const ConfirmationModal = React.lazy(() =>
    import('./modals/ConfirmationModal').then(module => ({ default: module.ConfirmationModal }))
);
const ExtractorModal = React.lazy(() =>
    import('./modals/ExtractorModal').then(module => ({ default: module.ExtractorModal }))
);
const SettingsView = React.lazy(() =>
    import('./settings/SettingsView').then(module => ({ default: module.SettingsView }))
);
const AddToDevOpsModal = React.lazy(() =>
    import('./modals/AddToDevOpsModal').then(module => ({ default: module.AddToDevOpsModal }))
);
const DebugModal = React.lazy(() =>
    import('./modals/DebugModal').then(module => ({ default: module.DebugModal }))
);
const PickRequestModal = React.lazy(() =>
    import('./modals/PickRequestModal').then(module => ({ default: module.PickRequestModal }))
);
const ExportWorkspaceModal = React.lazy(() =>
    import('./modals/ExportWorkspaceModal').then(module => ({ default: module.ExportWorkspaceModal }))
);
const BulkImportModal = React.lazy(() =>
    import('./modals/BulkImportModal').then(module => ({ default: module.BulkImportModal }))
);
const ImportTestCaseModal = React.lazy(() =>
    import('./ImportTestCaseModal').then(module => ({ default: module.ImportTestCaseModal }))
);

const MainContent: React.FC = () => {
    // ==========================================================================
    // PLATFORM DETECTION
    // ==========================================================================
    const [platformOS, setPlatformOS] = useState<'macos' | 'windows' | 'linux' | 'unknown'>('unknown');
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
    
    const showCustomTitleBar = platformOS !== 'macos';
    
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
        saveProject
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
        selectedPerformanceSuiteId,
        setSelectedPerformanceSuiteId,
        response,
        setResponse,
        loading,
        setLoading,
        selectedTestSuite,
        setSelectedTestSuite
    } = useSelection();

    // ==========================================================================
    // WSDL -> project (shared by Bulk Import; legacy EXPLORER staging retired)
    // ==========================================================================
    const addInterfaceToNamedProject = useCallback((iface: ApiInterface, projectName: string, isNew: boolean) => {
        const normalizedIface = {
            ...iface,
            expanded: false,
            operations: (iface.operations || []).map(op => ({
                ...op,
                expanded: false,
                requests: op.requests.filter(req => req.name !== 'Sample')
            }))
        };
        if (isNew) {
            const newProject: ApinoxProject = {
                name: projectName,
                interfaces: [normalizedIface],
                expanded: true,
                dirty: true,
                id: Date.now().toString()
            };
            setProjects(prev => [...prev, newProject]);
            saveProject(newProject);
        } else {
            setProjects(prev => prev.map(p =>
                p.name === projectName
                    ? { ...p, interfaces: [...(p.interfaces || []), normalizedIface], dirty: true }
                    : p
            ));
        }
        setWorkspaceDirty(true);
    }, [setProjects, saveProject, setWorkspaceDirty]);

    // ==========================================================================
    // LOCAL STATE - Remaining state that stays in App
    // ==========================================================================
    
    // Unified Explorer State
    // Phase B (t_86c34d38): the unified project list is centralized in
    // UnifiedProjectContext (single source of truth for the unified store). It
    // migrates any legacy APInox-v1 dirs to unified on mount (idempotent,
    // non-destructive) then loads the unified list. The names below are aliased
    // from the context so the ~16 call sites in this component are unchanged.
    // What MainContent still needs directly (the traffic and history groups
    // write through these); the unified-explorer read values come from the
    // handler hook below.
    const {
        setProjects: setUnifiedProjects,
        // Phase B (t_86c34d38): the TESTS subsystem (step CRUD, suite CRUD,
        // add-to-test-case) persists through the UNIFIED store — the unified
        // saveProject (save_unified_project) is distinct from the legacy one
        // (save_project) that the rest of the workspace still uses.
        saveProject: saveUnifiedProject,
        setSelectedNode: setUnifiedSelectedNode,
        // t_aafaf92b: fullness-guarded project updater — see the note in
        // useUnifiedExplorerHandlers.
        updateProject: updateUnifiedProject,
        // t_aafaf92b: on-demand skeleton→detail upgrade. The traffic menu needs
        // it because a skeleton carries action: '', so the SOAPAction signal
        // cannot score an unopened project.
        ensureProjectFull
    } = useUnifiedProjects();

    const {
        createRequest: createScrapbookRequest,
        selectRequest: selectScrapbookRequest,
        updateRequest: updateScrapbookRequest
    } = useScrapbook();

    // C (global suites): the authoritative suite store (loaded from
    // `~/.apinox/test-suites.json` via TestSuiteProvider). MainContent reads and
    // writes suites through this instead of `unifiedProjects[].testSuites`,
    // which is no longer persisted (the migration moved them to the global
    // store and the per-project save path drops them).
    const {
        testSuites: globalTestSuites,
        updateTestCase: updateGlobalTestCase,
        updateSuite: updateGlobalSuite,
        addSuite: addGlobalSuite,
        findSuiteById: findGlobalSuite,
        findCaseById: findGlobalCase,
    } = useTestSuites();

    // Unified Explorer Handlers
    // Extracted to hooks/useUnifiedExplorerHandlers. The 21 callbacks here
    // existed only to satisfy UnifiedExplorerView props and the unifiedProps
    // sidebar bundle, and every value they closed over came from a context
    // provider already above MainContent — so the hook takes no parameters.
    const {
        unifiedProjects,
        unifiedSelectedNode,
        refreshUnifiedProjects,
        scrapbookRequests,
        selectedScrapbookRequest,
        scrapbookLoading,
        handleUnifiedSelectNode,
        handleUnifiedRefresh,
        handleUnifiedDeleteProject,
        handleUnifiedDeleteOperation,
        handleUnifiedDeleteRequest,
        handleUnifiedRenameProject,
        handleUnifiedRenameOperation,
        handleUnifiedRenameRequest,
        handleUnifiedNewRequest,
        handleUnifiedExport,
        handleUnifiedImportWorkspace,
        handleUnifiedImportSoapUI,
        handleUnifiedWsdlLoaded,
        handleUnifiedReorderOperation,
        handleUnifiedReorderRequest,
        handleUnifiedScrapbookCreate,
        handleUnifiedScrapbookSelect,
        handleUnifiedScrapbookDelete,
        handleUnifiedScrapbookExecute,
        registerUnifiedExecute,
    } = useUnifiedExplorerHandlers();

    // Settings save (moved verbatim from the old SettingsEditorModal render
    // site): Tauri persists then re-fetches + emits SettingsUpdate so every
    // consumer (env selector, proxy config, ...) sees the new config;
    // browser dev falls back to fire-and-forget.
    const handleSettingsSave = useCallback(async (content: string, config?: any) => {
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
    }, []);
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
    const [hasOpenedProxyView, setHasOpenedProxyView] = useState(activeView === SidebarView.PROXY);
    const [hasOpenedUnifiedExplorer, setHasOpenedUnifiedExplorer] = useState(activeView === SidebarView.UNIFIED_EXPLORER);

    useEffect(() => {
        if (activeView === SidebarView.PROXY) {
            setHasOpenedProxyView(true);
        }
        if (activeView === SidebarView.UNIFIED_EXPLORER) {
            setHasOpenedUnifiedExplorer(true);
        }
    }, [activeView]);

    const {
        layoutMode,
        setLayoutMode,
        showLineNumbers,
        setShowLineNumbers,
        inlineElementValues,
        setInlineElementValues,
        hideCausalityData,
        setHideCausalityData,

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
            .catch((err) => { captureLog('warn', '[Updates] check_for_updates failed (offline or backend unavailable)', err); });
    }, []);
    // ── Traffic capture indicator ────────────────────────────────────────────
    // Live dot on the rail's Proxy/Traffic entry while the proxy is capturing.
    // Polled (not event-driven) so it stays correct even when the proxy view is
    // closed — the dot is the whole point of showing it from the rail.
    const [trafficCapturing, setTrafficCapturing] = useState(false);
    useEffect(() => {
        let alive = true;
        const poll = () =>
            bridge.invokeTauriCommand<{ running?: boolean }>('get_proxy_status')
                .then((s) => { if (alive) setTrafficCapturing(!!s?.running); })
                .catch(() => { if (alive) setTrafficCapturing(false); }); // not in Tauri / backend down
        poll();
        const id = setInterval(poll, 3000);
        return () => { alive = false; clearInterval(id); };
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
        // Phase B (t_86c34d38): the PROJECTS view is deleted; the TESTS guard
        // below still clears leaked perf selections on view switches.
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

    // WSDL sync-diff state removed: the legacy interface-level refresh/sync flow
    // (RefreshWsdl → WsdlSyncModal → apply_wsdl_sync) is dead — the unified
    // explorer's "Refresh WSDL" (handleUnifiedRefresh → refresh_project_wsdl)
    // replaced it.

    // Legacy folder handlers (useFolderManager) removed: the unified explorer
    // owns folder/request structure; these were dead legacy-model writes.

    // Log unused handlers temporarily


    // Bulk Import Modal State
    const [showBulkImportModal, setShowBulkImportModal] = useState(false);

    // Add-traffic-to-project dialog state
    const [addTrafficLog, setAddTrafficLog] = useState<TrafficLog | null>(null);

    const handleAddTrafficToProject = useCallback((log: TrafficLog) => {
        setAddTrafficLog(log);
    }, []);

    /** Build the request from a capture and write it into a unified project.
     *  Shared by the dialog confirm and the right-click "Add to" match. */
    const addTrafficLogToProject = useCallback(async (
        log: TrafficLog,
        projectName: string,
        destination: AddToProjectDestination,
        requestName: string,
        includeAllHeaders: boolean,
    ) => {
        // Extract the bare Content-Type (e.g. "application/soap+xml") from the raw
        // header value. SOAP Content-Type headers often carry extra directives
        // like `application/soap+xml; charset=utf-8; action="..."` — preserve
        // charset, drop action= and other non-standard params so they don't
        // bleed into the request's Content-Type field.
        const rawContentType = log.requestHeaders?.['Content-Type'] || log.requestHeaders?.['content-type'] || '';
        const parsedContentType = (() => {
            if (!rawContentType) return 'text/xml; charset=utf-8';
            const parts = rawContentType.split(';').map((s: string) => s.trim());
            const mimeType = parts[0] || 'text/xml';
            const charset = parts.slice(1).find((p: string) => p.toLowerCase().startsWith('charset='));
            return charset ? `${mimeType}; ${charset}` : mimeType;
        })();

        // Headers: everything from the traffic, or just the authoritative
        // Content-Type. Keep the header in sync with the field mirror so the
        // Content-Type row shows exactly what will be sent.
        const headers: Record<string, string> = includeAllHeaders
            ? { ...log.requestHeaders }
            : { 'Content-Type': parsedContentType };

        const newReq: import('@shared/models').ApiRequest = {
            id: crypto.randomUUID(),
            name: requestName,
            request: log.requestBody || '',
            endpoint: log.url,
            method: (log.method as any) || 'POST',
            contentType: parsedContentType,
            headers,
            requestType: 'soap',
            bodyType: 'xml',
            dirty: true,
        };

        // Route through the UNIFIED store's fullness-guarded updater: it upgrades
        // a body-less first-paint skeleton to FULL detail before the updater runs
        // and persists through save_unified_project (which also guards
        // fullness). Writing the legacy nested model here (the old behavior)
        // landed in p.interfaces/p.folders — invisible to the unified explorer
        // sidebar, which is why the request never appeared and "Add Request"
        // appeared disabled.
        let createdId: string | null = null;
        try {
            await updateUnifiedProject(projectName, (project) => {
                const operations = project.operations || [];

                if (destination.isNew) {
                    // Create a new operation holding the captured request, so
                    // arbitrary traffic that doesn't match a WSDL operation is
                    // still usable in the tree.
                    const newOp: import('@shared/models').ApiOperation = {
                        id: crypto.randomUUID(),
                        name: destination.operationName,
                        action: '',
                        originalEndpoint: log.url,
                        targetNamespace: '',
                        fullSchema: null,
                        requests: [newReq],
                        expanded: true,
                    };
                    createdId = newReq.id ?? null;
                    return { ...project, operations: [...operations, newOp], dirty: true };
                }

                // Append to the existing operation of that (stable) name.
                createdId = newReq.id ?? null;
                return {
                    ...project,
                    operations: operations.map(op =>
                        op.name === destination.operationName
                            ? { ...op, requests: [...(op.requests || []), newReq], expanded: true }
                            : op
                    ),
                    dirty: true,
                };
            });
            if (createdId) {
                setUnifiedSelectedNode({ type: 'request', id: createdId });
            }
        } catch (e) {
            console.error('[Traffic] Add to unified project failed:', e);
        }
    }, [updateUnifiedProject, setUnifiedSelectedNode]);

    const handleConfirmAddTrafficToProject = useCallback(async (
        projectName: string,
        destination: AddToProjectDestination,
        requestName: string,
        includeAllHeaders: boolean,
    ) => {
        if (!addTrafficLog) return;
        const log = addTrafficLog;
        setAddTrafficLog(null);
        await addTrafficLogToProject(log, projectName, destination, requestName, includeAllHeaders);
    }, [addTrafficLog, addTrafficLogToProject]);

    // Right-click "Add to" → a matched operation: writes straight through the
    // unified store, no dialog. The request is named from the URL's last path
    // segment (what the traffic row shows) and only the authoritative
    // Content-Type header is carried over — the same defaults the dialog uses.
    const handleAddTrafficToOperation = useCallback(async (
        log: TrafficLog,
        projectName: string,
        destination: AddToProjectDestination,
    ) => {
        await addTrafficLogToProject(log, projectName, destination, lastPathSegment(log.url), false);
    }, [addTrafficLogToProject]);



    const handleUpdateProject = useCallback((oldProject: import('@shared/models').ApinoxProject, newProject: import('@shared/models').ApinoxProject) => {
        setProjects(prev => prev.map(p => p === oldProject ? newProject : p));
        // All projects are persisted to ~/.apinox/projects/{name}/ — always save
        saveProject(newProject);
    }, [setProjects, saveProject]);

    // Phase B (t_86c34d38): the legacy shared context menu (useContextMenu)
    // and its Project-structure delete wrappers were deleted with the
    // PROJECTS view — the unified explorer has its own context menu
    // (UnifiedExplorerSidebar) and its own handlers.

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
        startTimeRef,
        requestIdRef
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
        handleAddPerformanceTestCase,
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
        handleRenameSuite,
        handleRenameTestStep,
        handleDeleteTestStep,
        handleExportSuite,
        handleExportTestCase,
        handleImportSuite,
        handleImportTestCase,
        handleSaveUiState
    } = useSidebarCallbacks({
        // Phase B (t_86c34d38): TESTS suite CRUD (add/delete/toggle/rename)
        // operates on the UNIFIED store (suites relocated).
        projects: unifiedProjects,
        setProjects: setUnifiedProjects,
        deleteConfirm,
        setDeleteConfirm,
        saveProject: saveUnifiedProject,
        config
    });

    // Hoisted above the handlers below: `setRequestHistory` is used by them, and
    // once those handlers are memoized the dependency must be readable at the
    // point the useCallback runs. It was declared further down, which would put
    // it in the temporal dead zone.
    const [requestHistory, setRequestHistory] = useState<RequestHistoryEntry[]>([]);

    // Wrapped Handlers for State Cleanup

    const handleDeleteSuite = useCallback((suiteId: string) => {
        // Call original handler (2-click confirm: first click arms, second deletes)
        _handleDeleteSuite(suiteId);

        // Cleanup selection if needed
        // If selected test case belongs to this suite, clear it.
        if (selectedTestCase) {
            // Find parent suite of selectedTestCase (global store — C)
            const foundCase = findGlobalCase(selectedTestCase.id);
            if (foundCase?.suite.id === suiteId) {
                setSelectedTestCase(null);
                setSelectedStep(null);
            }
        }
    }, [_handleDeleteSuite, selectedTestCase, findGlobalCase, setSelectedTestCase, setSelectedStep]);

    const handleDeleteTestCase = useCallback((caseId: string) => {
        _handleDeleteTestCase(caseId);
        if (selectedTestCase?.id === caseId) {
            setSelectedTestCase(null);
            setSelectedStep(null);
        }
    }, [_handleDeleteTestCase, selectedTestCase, setSelectedTestCase, setSelectedStep]);

    // TESTS sidebar step delete (two-click confirm lives in `handleDeleteTestStep`).
    // Clear the in-editor step selection if the removed step was the open one,
    // so the editor doesn't point at a step that no longer exists.
    const handleDeleteStepFromMenu = useCallback((caseId: string, stepId: string) => {
        handleDeleteTestStep(caseId, stepId);
        if (selectedStep?.id === stepId) {
            setSelectedStep(null);
            setSelectedRequest(null);
        }
    }, [handleDeleteTestStep, selectedStep, setSelectedStep, setSelectedRequest]);

    // Performance Handlers
    // ==========================================================================

    // Auto-select the first test case when the Tests view opens with no
    // selection (suite-page guard lives in the hook — see useTestsAutoSelect).
    useTestsAutoSelect({
        activeView,
        selectedTestCase,
        selectedTestSuite,
        globalTestSuites,
        setSelectedTestCase
    });

    // Sync selectedTestCase with authoritative global suite store.
    // This fixes stale data (e.g. scriptContent) after a suite update lands.
    useEffect(() => {
        if (!selectedTestCase) return;

        // Find the matching test case in the current global suite store
        const freshTestCase = globalTestSuites.flatMap(s => s.testCases || [])
            .find(tc => tc.id === selectedTestCase.id);
        if (freshTestCase && freshTestCase !== selectedTestCase) {
            setSelectedTestCase(freshTestCase);
        }
    }, [globalTestSuites, selectedTestCase, setSelectedTestCase]);

    // Open a history / favorite entry in the UNIFIED explorer: surface it as
    // a Quick Request (endpoint + body + headers from the entry) and select
    // it, so the main area's request editor loads it. The old implementation
    // wrote to the legacy `setSelectedRequest`/`setResponse` (WorkspaceLayout)
    // — but History/Favorites now live inside the unified explorer, whose
    // editor is driven by `unifiedSelectedNode` + the scrapbook context, so a
    // legacy write was invisible.
    const handleReplayRequest = useCallback(async (entry: RequestHistoryEntry) => {
        try {
            setActiveView(SidebarView.UNIFIED_EXPLORER);
            const created = await createScrapbookRequest();
            if (!created) return;
            const name =
                entry.requestName && entry.requestName !== 'Request'
                    ? entry.requestName
                    : (entry.operationName || entry.requestName || 'Replayed Request');
            await updateScrapbookRequest(created.id, {
                name,
                request: entry.requestBody || '',
                endpoint: entry.endpoint || '',
                method: entry.method || 'POST',
                headers: entry.headers || { 'Content-Type': 'application/soap+xml' },
            });
            const seeded: ScrapbookRequest = {
                ...created,
                name,
                request: entry.requestBody || '',
                endpoint: entry.endpoint || '',
                method: entry.method || 'POST',
                headers: entry.headers || { 'Content-Type': 'application/soap+xml' },
            };
            selectScrapbookRequest(seeded);
            setUnifiedSelectedNode({ type: 'scrapbook', id: created.id });
        } catch (error) {
            console.error('[MainContent] Failed to open history entry:', error);
        }
    }, [setActiveView, createScrapbookRequest, updateScrapbookRequest, selectScrapbookRequest, setUnifiedSelectedNode]);

    const handleToggleHistoryStar = useCallback(async (id: string) => {
        try {
            await bridge.invokeTauriCommand('toggle_star_history', { id });
            // Refresh history
            const updatedHistory = await bridge.invokeTauriCommand('get_history', {});
            setRequestHistory(updatedHistory);
        } catch (error) {
            console.error('[MainContent] Failed to toggle star:', error);
        }
    }, [setRequestHistory]);

    const handleDeleteHistory = useCallback(async (id: string) => {
        try {
            await bridge.invokeTauriCommand('delete_history_entry', { id });
            // Refresh history
            const updatedHistory = await bridge.invokeTauriCommand('get_history', {});
            setRequestHistory(updatedHistory);
        } catch (error) {
            console.error('[MainContent] Failed to delete history entry:', error);
        }
    }, [setRequestHistory]);

    const handleRenameHistory = useCallback(async (id: string, name: string) => {
        try {
            await bridge.invokeTauriCommand('rename_history_entry', { id, name });
            // Refresh history
            const updatedHistory = await bridge.invokeTauriCommand('get_history', {});
            setRequestHistory(updatedHistory);
        } catch (error) {
            console.error('[MainContent] Failed to rename history entry:', error);
        }
    }, [setRequestHistory]);

    /**
     * Add a project request (from the explorer tree's right-click menu) to
     * the global history store as a STARRED entry — the Favorites section
     * renders every starred entry, so this is the "favorite" path for
     * requests that were never executed. The entry carries the request's
     * name/endpoint/body so replaying it from Favorites re-sends it.
     */
    const handleFavoriteRequest = useCallback(async (projectName: string, operationName: string, req: ApiRequest) => {
        try {
            const entry: RequestHistoryEntry & { method: string; status?: number } = {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                requestName: req.displayName || req.name,
                requestId: req.id,
                method: req.method || 'POST',
                endpoint: req.endpoint || '',
                projectName,
                interfaceName: projectName,
                operationName,
                requestBody: req.request || '',
                headers: req.headers || {},
                starred: true,
            };
            await bridge.invokeTauriCommand('add_history_entry', { entry });
            const updatedHistory = await bridge.invokeTauriCommand('get_history', {});
            setRequestHistory(updatedHistory);
        } catch (error) {
            console.error('[MainContent] Failed to add request to favorites:', error);
        }
    }, [setRequestHistory]);

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
        // Phase B: test-step CRUD persists to the UNIFIED store
        // (suites relocated to UnifiedProject.testSuites).
        projects: unifiedProjects,
        testExecution,
        setSelectedStep,
        setSelectedRequest,
        setResponse,
        setProjects: setUnifiedProjects,
        saveProject: saveUnifiedProject,
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
    // Create Test Case from Traffic: the full capture (capture order) plus the
    // right-clicked log as the pre-selected anchor. Full-page wizard rendered
    // in place of ProxyPanel — not a modal.
    const [testCaseWizard, setTestCaseWizard] = useState<{ logs: TrafficLog[]; anchorLogId: string | null } | null>(null);

    const handleCreateTestCaseFromTraffic = React.useCallback((anchorLog: TrafficLog, allLogs: TrafficLog[]) => {
        if (allLogs.length === 0) return;
        setTestCaseWizard({ logs: allLogs, anchorLogId: anchorLog.id });
    }, []);
    const [pickRequestModal, setPickRequestModal] = React.useState<{ open: boolean, mode: 'testcase' | 'performance', caseId: string | null, suiteId: string | null }>({ open: false, mode: 'testcase', caseId: null, suiteId: null });
    const [importToPerformanceModal, setImportToPerformanceModal] = React.useState<{ open: boolean, suiteId: string | null }>({ open: false, suiteId: null });
    const [exportWorkspaceModal, setExportWorkspaceModal] = React.useState(false);
    // const [codeSnippetModal, setCodeSnippetModal] = React.useState<{ open: boolean, request: ApiRequest | null }>({ open: false, request: null });

    const handleExportWorkspace = useCallback(async (selectedProjects: UnifiedProject[]) => {
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
            alert(`Failed to export workspace: ${commandErrorText(error) || 'Unknown error'}`);
        }
        setExportWorkspaceModal(false);
    }, []);

    const pickRequestItems = useMemo<PickRequestItem[]>(() => {
        const items: PickRequestItem[] = [];
        const seen = new Set<string>();

        // Build picker items from a project's operations. `ops` are unified
        // `ApiOperation`s (requests nested directly) — the single source of
        // truth. The legacy nested model (interfaces[].operations) had the
        // same shape per operation, so the item contract is identical; only
        // the traversal root changed.
        const addOperationItems = (project: any, ops: any[], interfaceName?: string) => {
            if (!ops) return;
            ops.forEach((op: any) => {
                const itemKey = `${project.id || project.name}-op-${op.name}`;
                if (seen.has(itemKey)) return;
                seen.add(itemKey);
                const ifaceLabel = interfaceName || op.displayName || project.name;
                if (op.requests && op.requests.length > 0) {
                    op.requests.forEach((req: any, idx: number) => {
                        items.push({
                            id: `${project.id || project.name}-op-${op.name}-req-${idx}`,
                            label: op.requests.length > 1 ? `${op.displayName || op.name} [${idx + 1}/${op.requests.length}]` : (op.displayName || op.name),
                            description: `${project.name} > ${ifaceLabel} > ${req.name}`,
                            detail: req.endpoint || op.originalEndpoint || 'WSDL Operation',
                            type: 'request',
                            data: req
                        });
                    });
                } else {
                    // No requests - add operation for SOAP XML generation
                    items.push({
                        id: `${project.id || project.name}-op-${op.name}`,
                        label: op.displayName || op.name,
                        description: `${project.name} > ${ifaceLabel}`,
                        detail: op.originalEndpoint || 'WSDL Operation',
                        type: 'operation',
                        data: op,
                        warning: true
                    });
                }
            });
        };

        const traverseFolders = (project: any, folders: any[], parentPath: string) => {
            folders.forEach(folder => {
                const currentPath = parentPath ? `${parentPath} / ${folder.name}` : folder.name;
                if (folder.requests) {
                    folder.requests.forEach((req: any) => {
                        if (!req) return;
                        const folderKey = `${project.id || project.name}-req-${req.id || req.name}`;
                        if (seen.has(folderKey)) return;
                        seen.add(folderKey);
                        items.push({
                            id: folderKey,
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

        // The unified store is the SINGLE source of truth for pickable
        // requests. Every operation's requests live directly under
        // `project.operations[]` (flat layout), which is what the unified
        // explorer persists and loads.
        //
        // There is deliberately NO legacy `interfaces[]` fallback here: the
        // legacy ProjectContext keeps an in-memory copy of projects that is
        // NOT pruned when a project is deleted from the unified explorer
        // (delete_unified_project only removes the dir + unified state).
        // Falling back to it resurrected operations of already-deleted
        // projects, and URL-bar WSDLs never write interfaces/ at all.
        unifiedProjects.forEach((project: any) => {
            addOperationItems(project, project.operations);
            if (project.folders) {
                traverseFolders(project, project.folders, '');
            }
        });

        return items;
    }, [unifiedProjects]);

    // Workspace State
    // (requestHistory state hoisted above the wrapped handlers)

    useEffect(() => {
        if (!isTauri()) return;
        try {
            localStorage.setItem('apinox_history_cache', JSON.stringify(requestHistory));
        } catch (e) {
            console.warn('[History] Failed to cache history:', e);
        }
    }, [requestHistory]);



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
        setSelectedRequest,
        setSelectedTestCase,
        setSelectedPerformanceSuiteId
    });

    // ── Traffic-wizard sidebar lock ─────────────────────────────────────────
    // The traffic→test-case wizard is a full-page flow the user must exit with
    // its own "Cancel". While it is open the sidebar is disabled (Sidebar
    // renders dimmed + pointer-events off via `sidebarLocked`) AND every
    // navigation surface is blocked here at the state level, so no rail /
    // settings / help click — pointer or keyboard — can walk away from the
    // wizard mid-flow (which would unmount it and lose the in-progress work).
    const sidebarLocked = !!testCaseWizard;
    const guardedChangeView = useCallback((view: SidebarView) => {
        if (sidebarLocked) return;
        handleSetActiveViewWrapper(view);
    }, [sidebarLocked, handleSetActiveViewWrapper]);
    const guardedOpenSettings = useCallback(() => {
        if (sidebarLocked) return;
        handleSetActiveViewWrapper(SidebarView.SETTINGS);
    }, [sidebarLocked, handleSetActiveViewWrapper]);
    const guardedOpenHelp = useCallback(() => {
        if (sidebarLocked) return;
        setShowHelp(true);
    }, [sidebarLocked, setShowHelp]);
    useMessageHandler({
        setProjects,
        setLoading,
        setResponse,
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
        setWorkspaceDirty,
        setSavedProjects,
        setSaveErrors,
        // Mock/Proxy setters moved to MockProxyContext but kept for useSidebarCallbacks via MainContent state
        setActiveView,
        setRequestHistory,

        // Current values
        projects,
        config,
        selectedTestCase,
        selectedRequest,
        startTimeRef,
        requestIdRef,

        // Callbacks
        saveProject
    });

    // ==========================================================================
    // LIFECYCLE - Initial Load, Autosave, Shortcuts
    // ==========================================================================
    useAppLifecycle({
        projects: unifiedProjects,
        selectedProjectName,
        saveProject: saveUnifiedProject,
        setSelectedProjectName,
        setRequestHistory
    });

    // Sync selectedStep with latest global suite store
    useEffect(() => {
        if (selectedStep && selectedTestCase) {
            // Re-hydrate stale selectedStep from the current testCase
            const updatedCase = globalTestSuites.flatMap(s => s.testCases || [])
                .find(tc => tc.id === selectedTestCase.id);
            if (updatedCase) {
                const updatedStep = updatedCase.steps.find(step => step.id === selectedStep.id);
                if (updatedStep && updatedStep !== selectedStep) {
                    setSelectedStep(updatedStep);
                }
            }
        }
    }, [globalTestSuites, selectedStep, selectedTestCase, setSelectedStep]);

    // Sync selectedTestSuite - clear if deleted
    useEffect(() => {
        if (selectedTestSuite) {
            // Check if the selected test suite still exists in the global store
            const foundSuite = findGlobalSuite(selectedTestSuite.id);
            if (foundSuite) {
                // Re-hydrate if suite has updated
                if (foundSuite !== selectedTestSuite) {
                    setSelectedTestSuite(foundSuite);
                }
            } else {
                setSelectedTestSuite(null);
            }
        }
    }, [globalTestSuites, selectedTestSuite, findGlobalSuite, setSelectedTestSuite]);

    // Auto-save projects when workspace becomes dirty
    useEffect(() => {
        if (!workspaceDirty) return;

        console.log('[MainContent] Workspace dirty, scheduling auto-save');
        
        const timer = setTimeout(() => {
            // All projects are always persisted to ~/.apinox/projects/{name}/
            projects.forEach(project => {
                saveProject(project);
            });

            // Clear dirty flag after save
            setWorkspaceDirty(false);
        }, 1000); // Debounce 1 second

        return () => clearTimeout(timer);
    }, [workspaceDirty, projects, saveProject, setWorkspaceDirty]);


    // Handlers







    // Handle selection reset when closing a project (context handles the deletion)
    const handleCloseProject = useCallback((name: string) => {
        // If we're closing the selected project, clear selection
        if (deleteConfirm === name && selectedProjectName === name) {
            setSelectedInterface(null);
            setSelectedOperation(null);
            setSelectedRequest(null);
        }
        // Delegate to context
        closeProject(name);
    }, [deleteConfirm, selectedProjectName, setSelectedInterface, setSelectedOperation, setSelectedRequest, closeProject]);

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
        testCases: globalTestSuites.flatMap(s => s.testCases || []),
        selectedTestStep: selectedStep,
        selectedPerformanceSuiteId,
        performanceHistory: config?.performanceHistory || [],
        performanceProgress,
        coordinatorStatus,
        // NAVIGATION
        activeView,
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
        updateTestSuiteVariables: (suiteId: string, variables: Record<string, string>) => {
            const suite = findGlobalSuite(suiteId);
            if (suite) updateGlobalSuite({ ...suite, variables });
        },
        updateTestCaseVariables: (caseId: string, variables: Record<string, string>) => {
            updateGlobalTestCase(caseId, tc => ({ ...tc, variables }));
        },
        // TEST STEP
        updateTestStep: handleUpdateStep,
        deleteTestStep: handleDeleteStep,
        moveTestStep: handleMoveStep,
        addTestStep: handleAddStep,
        backToTestCase: () => { setSelectedStep(null); setSelectedRequest(null); },
        // Phase B (t_86c34d38): opening a test-step request no longer jumps to
        // the deleted PROJECTS view — the shared request editor (WorkspaceLayout
        // fall-through) renders it while the user stays in TESTS.
        openStepRequest: (req: ApiRequest) => { setSelectedRequest(req); },
        // PERFORMANCE
        handleAddPerformanceSuite,
        handleDeletePerformanceSuite,
        handleAddPerformanceRequest: handleAddPerformanceRequestForUi,
        handleAddPerformanceTestCase,
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
    }), [
        projects, selectedProjectName, selectedInterface, selectedOperation, selectedRequest,
        selectedTestSuite, selectedTestCase, selectedStep, globalTestSuites,
        selectedPerformanceSuiteId, config, performanceProgress, coordinatorStatus,
        activeView,
        response, loading, layoutMode, showLineNumbers, splitRatio, isResizing,
        inlineElementValues, hideCausalityData, backendConnected, testExecution,
        handleUpdateProject, handleCloseProject, handleSelectStep, handleToggleLayout,
        handleToggleLineNumbers, handleUpdateStep, handleDeleteStep, handleMoveStep,
        handleAddStep, handleRunTestCaseWrapper, handleRunTestSuiteWrapper,
        handleAddAssertion, handleAddPerformanceSuite, handleDeletePerformanceSuite,
        findGlobalSuite, updateGlobalSuite, updateGlobalTestCase,
        handleRunPerformanceSuite, handleStopPerformanceRun, handleSelectPerformanceSuite,
        handleUpdatePerformanceSuite, handleAddPerformanceRequestForUi, handleAddPerformanceTestCase,
        handleDeletePerformanceRequest, handleUpdatePerformanceRequest,
        handleSelectPerformanceRequest, handleStartCoordinator, handleStopCoordinator,
        executeRequest, cancelRequest, handleRequestUpdate, handleResetRequest,
        setSelectedInterface, setSelectedOperation, setSelectedRequest, setSelectedTestSuite,
        setSelectedTestCase, setLayoutMode, setShowLineNumbers,
        setSplitRatio, startResizing, setInlineElementValues, setHideCausalityData,
        addProject, saveProject, setProjects, setSelectedStep,
        handleAddExtractor, handleAddExistenceAssertion, setImportToPerformanceModal,
    ]);

    // ==========================================================================
    // SIDEBAR CONTEXT VALUE - Aggregates all state for the Sidebar subtree
    // ==========================================================================
    const sidebarContextValue = useMemo(() => ({
        // Phase B (t_86c34d38): projectProps / selectionProps (which fed the
        // deleted ProjectList view + the legacy shared context menu) are gone.
        testsProps: {
            // C (global suites): the TESTS suite tree renders from the GLOBAL
            // suite store (the single source of truth).
            testSuites: globalTestSuites,
            projects: unifiedProjects,
            selectedTestSuite,
            selectedTestCase,
            onAddSuite: handleAddSuite,
            onDeleteSuite: handleDeleteSuite,
            onRunSuite: handleRunTestSuiteWrapper,
            onAddTestCase: handleAddTestCase,
            onDeleteTestCase: handleDeleteTestCase,
            onRenameTestCase: handleRenameTestCase,
            onRenameSuite: handleRenameSuite,
            onRunCase: handleRunTestCaseWrapper,
            onSelectSuite: handleSelectTestSuite,
            onSelectTestCase: handleSelectTestCase,
            onSelectTestStep: (caseId: string, stepId: string) => {
                const found = findGlobalCase(caseId);
                const testCase = found?.testCase;
                const step = testCase?.steps?.find(s => s.id === stepId);
                if (step) handleSelectStep(step);
            },
            onRenameTestStep: handleRenameTestStep,
            onDeleteTestStep: handleDeleteStepFromMenu,
            onExportSuite: handleExportSuite,
            onImportSuite: handleImportSuite,
            onImportTestCase: handleImportTestCase,
            onExportTestCase: handleExportTestCase,
            onToggleSuiteExpand: handleToggleSuiteExpand,
            onToggleCaseExpand: handleToggleCaseExpand,
            // Live per-step execution status — mirrors the TestCaseView status
            // icons onto the rail's step rows (running / pass / fail).
            testExecution,
            deleteConfirm,
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
            onAddRequest: handleAddPerformanceRequestForUi,
            // Expand/collapse state for the suite rows.
            onToggleSuiteExpand: handleTogglePerformanceSuiteExpand,
            expandedSuiteIds: expandedPerformanceSuiteIds,
        },
        unifiedProps: {
            projects: unifiedProjects,
            selectedNode: unifiedSelectedNode,
            onSelectNode: handleUnifiedSelectNode,
            onRefreshProject: handleUnifiedRefresh,
            onDeleteProject: handleUnifiedDeleteProject,
            onDeleteOperation: handleUnifiedDeleteOperation,
            onDeleteRequest: handleUnifiedDeleteRequest,
            onNewRequest: handleUnifiedNewRequest,
            onRenameProject: handleUnifiedRenameProject,
            onRenameOperation: handleUnifiedRenameOperation,
            onRenameRequest: handleUnifiedRenameRequest,
            onExportProject: handleUnifiedExport,
            // Phase B (t_86c34d38): import/export + generate-test-suite relocated
            // from the deleted PROJECTS view (ProjectList) onto the unified
            // sidebar context menu.
            onExportWorkspace: () => setExportWorkspaceModal(true),
            onBulkImport: () => setShowBulkImportModal(true),
            onImportSoapUI: handleUnifiedImportSoapUI,
            onImportWorkspace: handleUnifiedImportWorkspace,
            onGenerateTestSuite: handleGenerateTestSuite,
            onAddRequestToTestCase: (req: ApiRequest) => setAddToTestCaseModal({ open: true, request: req }),
            onReorderOperation: handleUnifiedReorderOperation,
            onReorderRequest: handleUnifiedReorderRequest,
            // F-01 / R-05 — Quick Requests bottom section (Q1(a))
            scrapbook: {
                requests: scrapbookRequests,
                selectedRequest: selectedScrapbookRequest,
                loading: scrapbookLoading,
                onCreateRequest: handleUnifiedScrapbookCreate,
                onSelectRequest: handleUnifiedScrapbookSelect,
                onDeleteRequest: handleUnifiedScrapbookDelete,
                onExecuteRequest: handleUnifiedScrapbookExecute,
            },
            // History sub-window (second bottom section, above Quick Requests).
            // Request history was a top-level rail view (SidebarView.HISTORY);
            // it is now a sub-section of the unified explorer, like Quick
            // Requests. The entries + replay/star/delete handlers were the
            // former top-level `historyProps`.
            history: {
                entries: requestHistory,
                onReplay: handleReplayRequest,
                onToggleStar: handleToggleHistoryStar,
                onDelete: handleDeleteHistory,
                onRename: handleRenameHistory,
                onFavoriteRequest: handleFavoriteRequest,
            },
        },
        activeView,
        onChangeView: guardedChangeView,
        sidebarExpanded,
        backendConnected,
        workspaceDirty,
        showBackendStatus: true,
        onOpenSettings: guardedOpenSettings,
        onOpenHelp: guardedOpenHelp,
        sidebarLocked,
        onSaveUiState: handleSaveUiState,
        activeEnvironment: config?.activeEnvironment,
        environments: config?.environments,
        onChangeEnvironment: (env: string) => bridge.sendMessage({ command: 'setActiveEnvironment', env }),
        isMobileOpen: isMobileDrawerOpen,
        onMobileClose: isMobile ? () => setIsMobileDrawerOpen(false) : undefined,
        hasUpdate,
        trafficCapturing,
    }), [
        // Phase B (t_86c34d38): the projectProps / selectionProps entries above
        // were removed with the deleted PROJECTS view; the remaining deps cover
        // testsProps / performanceProps / unifiedProps (incl. its scrapbook +
        // history sub-window entries) and the view-state fields.
        // t_b2eae8b0: import handlers (SoapUI + APInox workspace) write the
        // unified store directly and depend on refreshUnifiedProjects.
        handleUnifiedImportSoapUI, handleUnifiedImportWorkspace,
        deleteConfirm, setExportWorkspaceModal, setShowBulkImportModal,
        testExecution,
        handleAddSuite, handleDeleteSuite, handleRunTestSuiteWrapper,
        handleAddTestCase, handleDeleteTestCase, handleRenameTestCase, handleRenameSuite,
        handleRunTestCaseWrapper, handleSelectTestSuite, handleSelectTestCase,
        handleToggleSuiteExpand, handleToggleCaseExpand, handleSelectStep, handleRenameTestStep,
        handleDeleteStepFromMenu,
        handleExportSuite, handleExportTestCase, handleImportSuite, handleImportTestCase,
        selectedTestSuite, selectedTestCase, globalTestSuites, findGlobalCase,
        config, activeRunId, selectedPerformanceSuiteId,
        handleAddPerformanceSuite, handleDeletePerformanceSuite, handleRunPerformanceSuite,
        handleSelectPerformanceSuite, handleStopPerformanceRun, handleAddPerformanceRequestForUi,
        expandedPerformanceSuiteIds, handleTogglePerformanceSuiteExpand,
        requestHistory, handleReplayRequest, handleToggleHistoryStar, handleDeleteHistory, handleRenameHistory, handleFavoriteRequest,
        unifiedProjects, unifiedSelectedNode,
        handleUnifiedSelectNode, handleUnifiedRefresh, handleUnifiedDeleteProject,
        handleUnifiedDeleteOperation, handleUnifiedDeleteRequest, handleUnifiedNewRequest,
        handleUnifiedRenameProject, handleUnifiedRenameOperation, handleUnifiedRenameRequest,
        handleUnifiedExport, handleUnifiedReorderOperation, handleUnifiedReorderRequest,
        handleGenerateTestSuite,
        scrapbookRequests, selectedScrapbookRequest, scrapbookLoading,
        handleUnifiedScrapbookCreate, handleUnifiedScrapbookSelect,
        handleUnifiedScrapbookDelete, handleUnifiedScrapbookExecute,
        activeView, sidebarExpanded, backendConnected,
        workspaceDirty, handleSaveUiState,
        sidebarLocked, guardedChangeView, guardedOpenSettings, guardedOpenHelp,
        isMobileDrawerOpen, isMobile, setIsMobileDrawerOpen, hasUpdate,
        trafficCapturing,
    ]);

    return (
        <Container $showCustomTitleBar={showCustomTitleBar} $isMacOS={platformOS === 'macos'}>
            {/* Narrow-desktop hamburger — fixed overlay in TitleBar area, narrow viewports only */}
            {isMobile && (
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
            <NotesProvider>
            <div className="content-row">

            {/* Sidebar — all props supplied via SidebarContext */}
            <SidebarContext.Provider value={sidebarContextValue}>
                <Sidebar />
            </SidebarContext.Provider>

            {hasOpenedProxyView && (
                <div style={{ display: activeView === SidebarView.PROXY ? 'flex' : 'none', flex: 1, overflow: 'hidden', flexDirection: 'column', minHeight: 0 }}>
                    <Suspense fallback={<div style={{ flex: 1, background: 'var(--apinox-editor-background)' }} />}>
                        {/* ProxyPanel stays mounted (hidden) while a wizard is
                            open: its captured-traffic history lives in its local
                            state, so unmounting it to render the wizard "in
                            place" would wipe the traffic list on the way back.
                            The wizard fills the same work area on top instead. */}
                        <div style={{ display: testCaseWizard ? 'none' : 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column', minHeight: 0 }}>
                            <ProxyPanel
                                onNavigateTo={(view) => handleSetActiveViewWrapper(view as SidebarView)}
                                onAddToApinoxProject={handleAddTrafficToProject}
                                projects={unifiedProjects}
                                ensureProjectFull={ensureProjectFull}
                                onAddTrafficToOperation={handleAddTrafficToOperation}
                                onCreateTestCaseFromTraffic={handleCreateTestCaseFromTraffic}
                            />
                        </div>
                        {testCaseWizard && (
                            <CreateTestCaseFromTrafficWizard
                                logs={testCaseWizard.logs}
                                anchorLogId={testCaseWizard.anchorLogId}
                                testSuites={globalTestSuites}
                                onCancel={() => setTestCaseWizard(null)}
                                onCreate={(result) => {
                                    // Verbatim calls with optional chain capture: each
                                    // selected log's method, URL, headers and body are
                                    // copied into a standalone request step, with the
                                    // wizard's tagged captured values emitted as
                                    // {{variable}} (extractor on the source step).
                                    // The Content-Type string is copied exactly
                                    // (including any `action=...` parameter), so the
                                    // Headers tab shows it as a custom ("Other…")
                                    // value rather than snapping to a standard option.
                                    const steps = buildTrafficTestSteps(result.selectedLogs, {
                                        extractors: result.extractors,
                                        valueSubstitutions: result.valueSubstitutions,
                                    });
                                    const newCase: TestCase = {
                                        id: crypto.randomUUID(),
                                        name: result.caseName,
                                        expanded: true,
                                        steps,
                                    };
                                    // C (global suites): the new case lands in the
                                    // GLOBAL suite store (no owning project).
                                    if (result.suite.kind === 'new') {
                                        addGlobalSuite({
                                            id: crypto.randomUUID(),
                                            name: result.suite.name,
                                            testCases: [newCase],
                                            expanded: true,
                                        });
                                    } else {
                                        const suite = findGlobalSuite(result.suite.suiteId);
                                        if (suite) {
                                            updateGlobalSuite({ ...suite, testCases: [...(suite.testCases || []), newCase] });
                                        }
                                    }
                                    setTestCaseWizard(null);
                                }}
                            />
                        )}
                    </Suspense>
                </div>
            )}
            {activeView === SidebarView.MOCK && (
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <Suspense fallback={<div style={{ flex: 1, background: 'var(--apinox-editor-background)' }} />}>
                        <RulesAndMockPage />
                    </Suspense>
                </div>
            )}
            {/* WorkspaceLayout using WorkspaceContext - no props needed */}
            {activeView !== SidebarView.PROXY && activeView !== SidebarView.MOCK && activeView !== SidebarView.NOTES && activeView !== SidebarView.UNIFIED_EXPLORER && activeView !== SidebarView.SETTINGS && (
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <WorkspaceContext.Provider value={workspaceContextValue}>
                        <Suspense fallback={<div style={{ flex: 1, background: 'var(--apinox-editor-background)' }} />}>
                            <WorkspaceLayout />
                    </Suspense>
                </WorkspaceContext.Provider>
                </div>
            )}
            {hasOpenedUnifiedExplorer && (
                <div style={{ display: activeView === SidebarView.UNIFIED_EXPLORER ? 'flex' : 'none', flex: 1, overflow: 'hidden', flexDirection: 'column', minHeight: 0 }}>
                    <UnifiedExplorerView
                        projects={unifiedProjects}
                        selectedNode={unifiedSelectedNode}
                        onSelectNode={handleUnifiedSelectNode}
                        onRefreshProject={handleUnifiedRefresh}
                        onNewRequest={handleUnifiedNewRequest}
                        onWsdlLoaded={handleUnifiedWsdlLoaded}
                        onRegisterExecute={registerUnifiedExecute}
                    />
                </div>
            )}
            {activeView === SidebarView.NOTES && (
                <Suspense fallback={<div style={{ flex: 1, background: 'var(--apinox-editor-background)' }} />}>
                    <NotesEditorLazy />
                </Suspense>
            )}
            {activeView === SidebarView.SETTINGS && (
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <Suspense fallback={<div style={{ flex: 1, background: 'var(--apinox-editor-background)' }} />}>
                        <SettingsView rawConfig={rawConfig} onSave={handleSettingsSave} />
                    </Suspense>
                </div>
            )}
            <Suspense fallback={null}>
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
                            projects={unifiedProjects}
                            matches={matchTrafficToOperations(addTrafficLog, unifiedProjects)}
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
                            projects={unifiedProjects}
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
            </Suspense>
            {/* Phase B (t_86c34d38): the legacy shared context menu (ContextMenu/
                ContextMenuItem) and its RenameModal were deleted with the
                PROJECTS view — the unified explorer owns its own context menu
                and its own rename modal. */}

            {/* Add to Test Case Modal */}
            {
                addToTestCaseModal.open && addToTestCaseModal.request && (
                    <Suspense fallback={null}>
                        <AddToTestCaseModal
                            projects={unifiedProjects}
                            testSuites={globalTestSuites}
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

                                // C (global suites): new test steps persist to the
                                // GLOBAL suite store (no owning project).
                                const suiteId = target.suiteId ?? findGlobalCase(target.caseId ?? '')?.suite.id;
                                if (!suiteId) return;
                                const suite = findGlobalSuite(suiteId);
                                if (!suite) return;

                                if (target.type === 'new') {
                                    const newCase: TestCase = {
                                        id: `tc-${Date.now()}`,
                                        name: `TestCase ${(suite.testCases?.length || 0) + 1}`,
                                        expanded: true,
                                        steps: [newStep]
                                    };
                                    updateGlobalSuite({ ...suite, testCases: [...(suite.testCases || []), newCase] });
                                } else if (target.type === 'existing' && target.caseId) {
                                    updateGlobalTestCase(target.caseId, tc => ({
                                        ...tc,
                                        steps: [...tc.steps, newStep]
                                    }));
                                }
                                setAddToTestCaseModal({ open: false, request: null });
                            }}
                        />
                    </Suspense>
                )
            }

            {pickRequestModal.open && (
                <Suspense fallback={null}>
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
                </Suspense>
            )}

            {/* Confirmation Modal */}
            {confirmationModal && (
                <Suspense fallback={null}>
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
                </Suspense>
            )}

            {/* Extractor Modal */}
            {extractorModal && (
                <Suspense fallback={null}>
                    <ExtractorModal
                        isOpen={!!extractorModal}
                        data={extractorModal}
                        onClose={() => setExtractorModal(null)}
                        onSave={(data) => {
                            handleSaveExtractor(data);
                            setExtractorModal(null);
                        }}
                    />
                </Suspense>
            )}

            {/* Bulk Import Modal */}
            {showBulkImportModal && (
                <Suspense fallback={null}>
                    <BulkImportModal
                        open={showBulkImportModal}
                        onClose={() => setShowBulkImportModal(false)}
                        existingProjects={projects.filter(p => !p.readOnly).map(p => p.name)}
                        onImportComplete={async (results: BulkImportResult[], projectName: string, isNew: boolean) => {
                            // Collect all successful interfaces
                            const successfulInterfaces = results
                                .filter(r => r.success && r.interfaces)
                                .flatMap(r => r.interfaces || []);

                            if (successfulInterfaces.length === 0) return;

                            // t_b2eae8b0: Bulk Import now writes the canonical
                            // UNIFIED store directly. The WSDL-derived nested
                            // interfaces are grouped into ONE nested project
                            // (the legacy "one project = the service" shape) and
                            // persisted via save_imported_project_as_unified,
                            // which flattens them into operations[] (reusing the
                            // migration's transform) and merges idempotently
                            // into the unified store. The additive nested write
                            // keeps PROXY (nested-model reader) working on the
                            // imported project. Awaited FIRST so
                            // the canonical unified dir exists before any legacy
                            // in-session write (which would otherwise race and
                            // create a legacy dir, triggering an unwanted rename).
                            const nestedProject: ApinoxProject = {
                                name: projectName,
                                id: Date.now().toString(),
                                interfaces: successfulInterfaces,
                            };
                            const savedProjects = await saveImportedProjectsAsUnified([nestedProject]);
                            const saved = savedProjects[0];
                            const finalName = saved?.name ? String(saved.name) : projectName;

                            // In-session legacy list: PROXY (AddToProjectDialog)
                            // reads the nested model from
                            // useProject().projects IN THIS SESSION
                            // (they do not re-load from disk on demand), so add
                            // the interfaces there too. `isNew && i === 0`
                            // mirrors the original: only the first interface
                            // creates the (legacy-list) project; the rest append.
                            successfulInterfaces.forEach((iface, i) => {
                                addInterfaceToNamedProject(iface, finalName, isNew && i === 0);
                            });

                            // The unified store now owns the project — reload the
                            // list so the explorer shows it immediately.
                            await refreshUnifiedProjects();

                            // Navigate to the sole explorer entry point (the
                            // PROJECTS view no longer exists).
                            setActiveView(SidebarView.UNIFIED_EXPLORER);
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
                </Suspense>
            )}

            </div>{/* end content-row */}
            </NotesProvider>

            {/* Import to Performance Suite Modal */}
            {importToPerformanceModal.open && (
                <Suspense fallback={null}>
                    <ImportTestCaseModal
                        open={importToPerformanceModal.open}
                        suiteId={importToPerformanceModal.suiteId}
                        projects={unifiedProjects}
                        onClose={() => setImportToPerformanceModal({ open: false, suiteId: null })}
                    />
                </Suspense>
            )}
        </Container >
    );
}

export default MainContent;
