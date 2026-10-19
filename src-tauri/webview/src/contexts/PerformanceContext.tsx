import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { bridge, isTauri } from '../utils/bridge';
import { PerformanceSuite, PerformanceRequest, ApiRequest } from '@shared/models';
import { BackendCommand, FrontendCommand } from '@shared/messages';
import { getInitialXml } from '@shared/utils/soapUtils';
import { useUI } from './UIContext';
import { useSelection } from './SelectionContext';
import { useNavigation } from './NavigationContext';
import { SidebarView } from '@shared/models';
import { PERF_REQUEST_ID_PREFIX, PERF_SUITE_ID_PREFIX } from '../constants';
import { debugLog } from '../utils/logger';
import { embedPerfRun } from '../utils/runEmbedding';
import { useTestSuitesOptional } from './TestSuiteContext';

interface CoordinatorStatus {
    running: boolean;
    port: number;
    workers: any[];
    expectedWorkers: number;
}

interface PerformanceContextType {
    // State
    activeRunId: string | undefined;
    performanceProgress: { iteration: number; total: number } | null;
    coordinatorStatus: CoordinatorStatus;
    expandedPerformanceSuiteIds: string[];

    // Handlers
    handleAddPerformanceSuite: (name: string) => void;
    handleDeletePerformanceSuite: (id: string) => void;
    handleRunPerformanceSuite: (id: string) => void;
    handleStopPerformanceRun: () => void;
    handleSelectPerformanceSuite: (id: string) => void;
    handleUpdatePerformanceSuite: (suite: PerformanceSuite) => void;
    handleAddPerformanceRequest: (suiteId: string) => void;
    /** Add a whole test case as one step of the suite's sequence. */
    handleAddPerformanceTestCase: (suiteId: string, caseId: string) => void;
    handleDeletePerformanceRequest: (suiteId: string, requestId: string) => void;
    handleUpdatePerformanceRequest: (suiteId: string, requestId: string, updates: Partial<PerformanceRequest>) => void;
    handleSelectPerformanceRequest: (request: PerformanceRequest) => void;
    handleStartCoordinator: (port: number, expectedWorkers: number) => void;
    handleStopCoordinator: () => void;
    handleTogglePerformanceSuiteExpand: (suiteId: string) => void;

    // Setters (exposed for message handler)
    setActiveRunId: React.Dispatch<React.SetStateAction<string | undefined>>;
    setPerformanceProgress: React.Dispatch<React.SetStateAction<{ iteration: number; total: number } | null>>;
    setCoordinatorStatus: React.Dispatch<React.SetStateAction<CoordinatorStatus>>;
}

const PerformanceContext = createContext<PerformanceContextType | undefined>(undefined);

export const usePerformance = () => {
    const context = useContext(PerformanceContext);
    if (!context) {
        throw new Error('usePerformance must be used within a PerformanceProvider');
    }
    return context;
};

export const PerformanceProvider = ({ children }: { children: ReactNode }) => {
    // Global test-case store — a perf 'testCase' step is a live reference into
    // it, resolved at run time when the payload is embedded.
    const { testSuites: globalTestSuites } = useTestSuitesOptional();

    // State
    const [activeRunId, setActiveRunId] = useState<string | undefined>(undefined);
    const [performanceProgress, setPerformanceProgress] = useState<{ iteration: number; total: number } | null>(null);
    const [coordinatorStatus, setCoordinatorStatus] = useState<CoordinatorStatus>({
        running: false,
        port: 8765,
        workers: [],
        expectedWorkers: 1
    });
    const [expandedPerformanceSuiteIds, setExpandedPerformanceSuiteIds] = useState<string[]>([]);

    // Dependencies
    const { config, setConfig } = useUI();
    // Kept in sync so the message listener can read the current config without
    // re-binding on every config change (same pattern as useMessageHandler).
    const configRef = useRef(config);
    useEffect(() => { configRef.current = config; }, [config]);
    const { setActiveView } = useNavigation();
    const {
        selectedPerformanceSuiteId,
        setSelectedPerformanceSuiteId,
        setSelectedInterface,
        setSelectedOperation,
        selectedRequest,
        setSelectedRequest,
        setSelectedTestCase,
        setSelectedStep
    } = useSelection();

    // Handlers
    const handleAddPerformanceSuite = useCallback((name: string) => {
        const now = Date.now();
        const newId = `perf-suite-${now}`;
        const suite: PerformanceSuite = {
            id: newId,
            name: name || 'New Performance Suite',
            description: '',
            requests: [],
            iterations: 10,
            delayBetweenRequests: 0,
            warmupRuns: 1,
            concurrency: 1,
            createdAt: now,
            modifiedAt: now,
            collapsedSections: ['scheduling', 'workers']
        };

        setConfig(prev => {
            if (!prev) return prev;
            const prevSuites = prev.performanceSuites || [];
            if (prevSuites.some((s: PerformanceSuite) => s.id === newId)) return prev;
            return { ...prev, performanceSuites: [...prevSuites, suite] };
        });

        bridge.sendMessage({ command: FrontendCommand.AddPerformanceSuite, name, id: newId, suite });
        setSelectedPerformanceSuiteId(newId);

        // Clear other selections
        setSelectedInterface(null);
        setSelectedOperation(null);
        setSelectedRequest(null);
        setSelectedTestCase(null);
        setSelectedStep(null);
    }, [setConfig, setSelectedPerformanceSuiteId, setSelectedInterface, setSelectedOperation, setSelectedRequest, setSelectedTestCase, setSelectedStep]);

    const handleDeletePerformanceSuite = useCallback((id: string) => {
        bridge.sendMessage({ command: 'deletePerformanceSuite', suiteId: id });
    }, []);

    const handleRunPerformanceSuite = useCallback((id: string) => {
        setActiveRunId(id);

        if (isTauri()) {
            (async () => {
                try {
                    // Pass the full suite as fallback in case disk config is stale or not yet saved.
                    // Normalize requests to [] to guard against null values from stale config state,
                    // then expand every 'testCase' step into its referenced case's steps so the
                    // backend runs a self-contained payload.
                    const rawSuite = (config?.performanceSuites || []).find((s: PerformanceSuite) => s.id === id);
                    const currentSuite = rawSuite
                        ? embedPerfRun(
                            { ...rawSuite, requests: Array.isArray(rawSuite.requests) ? rawSuite.requests : [] },
                            globalTestSuites.flatMap(s => s.testCases || [])
                        )
                        : null;

                    const start = await bridge.sendMessageAsync<{ runId: string }>({
                        command: FrontendCommand.RunPerformanceSuite,
                        suiteId: id,
                        stream: true,
                        suite: currentSuite
                    });

                    const runId = start?.runId;
                    if (!runId) return;

                    let fromIndex = 0;
                    let done = false;
                    while (!done) {
                        const batch = await bridge.sendMessageAsync<{ updates: any[]; nextIndex: number; done: boolean; error?: string; run?: any }>({
                            command: FrontendCommand.GetPerformanceRunUpdates,
                            runId,
                            fromIndex
                        });

                        if (batch?.updates?.length) {
                            batch.updates.forEach(update => {
                                if (update.type === 'runStarted') {
                                    bridge.emit({ command: BackendCommand.PerformanceRunStarted, runId: update.runId, suiteId: update.suiteId, suiteName: update.suiteName });
                                }
                                if (update.type === 'iterationComplete') {
                                    bridge.emit({ command: BackendCommand.PerformanceIterationComplete, runId: update.runId, iteration: update.iteration, total: update.total });
                                }
                                if (update.type === 'runCompleted') {
                                    bridge.emit({ command: BackendCommand.PerformanceRunComplete, run: update.run, runId: update.run?.id });
                                    if (update.run) {
                                        setConfig(prev => {
                                            if (!prev) return prev;
                                            const prevHistory = prev.performanceHistory || [];
                                            const nextHistory = [...prevHistory, update.run];
                                            return { ...prev, performanceHistory: nextHistory };
                                        });
                                    }
                                }
                            });
                            fromIndex = batch.nextIndex;
                        }

                        if (batch?.error) {
                            console.error('[PerformanceContext] Run error:', batch.error);
                            done = true;
                            break;
                        }

                        done = !!batch?.done;
                        if (!done) {
                            await new Promise(resolve => setTimeout(resolve, 300));
                        }
                    }
                } catch (error) {
                    console.error('[PerformanceContext] Tauri run failed', error);
                }
            })();
            return;
        }

        bridge.sendMessage({ command: FrontendCommand.RunPerformanceSuite, suiteId: id });
    }, [setConfig, config, globalTestSuites]);

    const handleStopPerformanceRun = useCallback(() => {
        bridge.sendMessage({ command: 'abortPerformanceSuite' });
    }, []);

    const handleSelectPerformanceSuite = useCallback((id: string) => {
        const suite = config?.performanceSuites?.find(s => s.id === id);
        if (!suite) return;

        // Allow reselect to clear request selection and show suite summary
        if (selectedPerformanceSuiteId === id && !selectedRequest) return;

        setSelectedInterface(null);
        setSelectedOperation(null);
        setSelectedRequest(null);
        setSelectedTestCase(null);
        setSelectedStep(null);
        setSelectedPerformanceSuiteId(suite.id);
        setActiveView(SidebarView.PERFORMANCE);
    }, [selectedPerformanceSuiteId, selectedRequest, config, setSelectedPerformanceSuiteId, setSelectedInterface, setSelectedOperation, setSelectedRequest, setSelectedTestCase, setSelectedStep, setActiveView]);

    const handleUpdatePerformanceSuite = useCallback((suite: PerformanceSuite) => {
        bridge.sendMessage({ command: 'updatePerformanceSuite', suiteId: suite.id, updates: suite });
    }, []);

    const handleTogglePerformanceSuiteExpand = useCallback((suiteId: string) => {
        setExpandedPerformanceSuiteIds(prev =>
            prev.includes(suiteId)
                ? prev.filter(id => id !== suiteId)
                : [...prev, suiteId]
        );
    }, []);

    const handleAddPerformanceRequest = useCallback((suiteId: string) => {
        if (isTauri()) {
            console.warn('[PerformanceContext] pickOperationForPerformance is not available in Tauri');
            return;
        }
        setExpandedPerformanceSuiteIds(prev =>
            prev.includes(suiteId) ? prev : [...prev, suiteId]
        );
        bridge.sendMessage({ command: 'pickOperationForPerformance', suiteId });
    }, []);

    // Add a whole test case as one step of the suite's sequence. The step is a
    // live reference: it stores only the case id, and the run payload embeds
    // the case's current steps (see embedPerfRun).
    const handleAddPerformanceTestCase = useCallback((suiteId: string, caseId: string) => {
        const allCases = globalTestSuites.flatMap(s => s.testCases || []);
        const testCase = allCases.find(c => c.id === caseId);
        if (!testCase) return;

        const suite = config?.performanceSuites?.find(s => s.id === suiteId);
        if (!suite) return;

        const step: PerformanceRequest = {
            id: `${PERF_REQUEST_ID_PREFIX}${Date.now()}`,
            name: testCase.name,
            type: 'testCase',
            testCaseId: testCase.id,
            endpoint: '',
            requestBody: '',
            headers: {},
            extractors: [],
            order: (suite.requests || []).length,
        };

        setExpandedPerformanceSuiteIds(prev =>
            prev.includes(suiteId) ? prev : [...prev, suiteId]
        );

        // Optimistic UI state, then the persisted round-trip (same pattern as
        // the delete handler).
        setConfig(prev => {
            if (!prev || !prev.performanceSuites) return prev;
            return {
                ...prev,
                performanceSuites: prev.performanceSuites.map(s =>
                    s.id === suiteId
                        ? { ...s, requests: [...(s.requests || []), step] }
                        : s
                )
            };
        });

        bridge.sendMessage({ command: FrontendCommand.AddPerformanceRequest, suiteId, request: step });
    }, [config, globalTestSuites, setConfig]);

    const handleDeletePerformanceRequest = useCallback((suiteId: string, requestId: string) => {
        // Optimistically update UI state
        setConfig(prev => {
            if (!prev || !prev.performanceSuites) return prev;
            
            return {
                ...prev,
                performanceSuites: prev.performanceSuites.map(suite =>
                    suite.id === suiteId
                        ? { ...suite, requests: suite.requests?.filter(r => r.id !== requestId) || [] }
                        : suite
                )
            };
        });
        
        // Send delete command to backend
        bridge.sendMessage({ command: 'deletePerformanceRequest', suiteId, requestId });
    }, [setConfig]);

    const handleUpdatePerformanceRequest = useCallback((suiteId: string, requestId: string, updates: Partial<PerformanceRequest>) => {
        bridge.sendMessage({ command: 'updatePerformanceRequest', suiteId, requestId, updates });
    }, []);

    const handleSelectPerformanceRequest = useCallback((request: PerformanceRequest) => {
        const soapRequest: ApiRequest = {
            id: request.id,
            name: request.name,
            endpoint: request.endpoint,
            method: request.method,
            request: request.requestBody,
            headers: request.headers,
            extractors: request.extractors,
            contentType: request.headers?.['Content-Type'] || request.headers?.['content-type'] || 'application/soap+xml',
            requestType: request.requestType,
            bodyType: request.bodyType,
            restConfig: request.restConfig,
            graphqlConfig: request.graphqlConfig,
        };
        debugLog('[Performance] Selecting request', request.id);
        setSelectedRequest(soapRequest);
        setSelectedStep(null);
    }, [setSelectedRequest, setSelectedStep]);

    const handleStartCoordinator = useCallback((port: number, expectedWorkers: number) => {
        bridge.sendMessage({ command: 'startCoordinator', port, expectedWorkers });
    }, []);

    const handleStopCoordinator = useCallback(() => {
        bridge.sendMessage({ command: 'stopCoordinator' });
    }, []);

    // Listen for coordinator status updates
    useEffect(() => {
        const handleMessage = (message: any) => {
            if (message.command === 'coordinatorStatus') {
                setCoordinatorStatus(message.status);
            }
        };
        const unsubscribe = bridge.onMessage(handleMessage);
        // Request initial status
        bridge.sendMessage({ command: 'getCoordinatorStatus' });
        return () => unsubscribe();
    }, []);

    // -------------------------------------------------------------------------
    // MESSAGE HANDLING
    // -------------------------------------------------------------------------

    // Helper for complex AddOperation logic. Declared before the listener effect
    // so it can appear in that effect's deps. It reads config only through the
    // functional setConfig update, so it stays stable across config changes and
    // the listener is not re-bound on every keystroke.
    const handleBackendAddOperation = useCallback(async (message: any) => {
        debugLog('addOperationToPerformance', { suiteId: message.suiteId, operation: message.operation?.name });

        setConfig((prevConfig: any) => {
            const currentSuites = prevConfig.performanceSuites || [];
            const idx = currentSuites.findIndex((s: any) => s.id === message.suiteId);

            if (idx === -1) {
                console.error('[PerformanceContext] Suite not found for addOperationToPerformance');
                return prevConfig;
            }

            const suite = { ...currentSuites[idx] };
            let newRequest = message.request;
            const perfOp = message.operation;

            if (newRequest) {
                newRequest = {
                    ...newRequest,
                    id: `${PERF_REQUEST_ID_PREFIX}${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    method: newRequest.method || 'POST',
                    requestBody: newRequest.requestBody || (newRequest as any).request || '',
                    interfaceName: newRequest.interfaceName,
                    operationName: newRequest.operationName,
                    order: (suite.requests?.length || 0) + 1,
                    readOnly: false,
                    // Explicitly preserve requestType and bodyType to prevent defaulting to soap
                    requestType: newRequest.requestType || 'soap',
                    bodyType: newRequest.bodyType,
                    restConfig: newRequest.restConfig,
                    graphqlConfig: newRequest.graphqlConfig
                };
            } else if (perfOp) {
                // Check if operation has existing requests (e.g., from OpenAPI)
                if (perfOp.requests && perfOp.requests.length > 0) {
                    const firstRequest = perfOp.requests[0];
                    newRequest = {
                        ...firstRequest,
                        id: `${PERF_REQUEST_ID_PREFIX}${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        order: (suite.requests?.length || 0) + 1,
                        readOnly: false
                    };
                } else {
                    // No requests - generate default SOAP XML
                    newRequest = {
                        id: `${PERF_REQUEST_ID_PREFIX}${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        name: perfOp.name,
                        endpoint: (perfOp as any).originalEndpoint || '',
                        method: 'POST',
                        soapAction: perfOp.soapAction,
                        requestBody: `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="${perfOp.targetNamespace || 'http://tempuri.org/'}">
    <soapenv:Header/>
    <soapenv:Body>
       <tem:${perfOp.name}>
          <!--Optional:-->
          ${getInitialXml(perfOp.input)}
       </tem:${perfOp.name}>
    </soapenv:Body>
</soapenv:Envelope>`,
                        headers: {},
                        extractors: [],
                        slaThreshold: 200,
                        order: (suite.requests?.length || 0) + 1,
                        readOnly: false,
                        requestType: 'soap',
                        bodyType: 'xml'
                    };
                }
            }

            if (newRequest) {
                const nextRequests = [...(suite.requests || []), newRequest];
                const nextSuite = { ...suite, requests: nextRequests };

                // Send FULL suite update to backend
                bridge.sendMessage({
                    command: FrontendCommand.UpdatePerformanceSuite,
                    suiteId: nextSuite.id,
                    updates: nextSuite
                });

                const newSuites = [...currentSuites];
                newSuites[idx] = nextSuite;
                return { ...prevConfig, performanceSuites: newSuites };
            }

            return prevConfig;
        });
    }, [setConfig]);

    React.useEffect(() => {
        const handleMessage = (message: any) => {
            switch (message.command) {
                case BackendCommand.PerformanceRunStarted:
                    debugLog('performanceRunStarted', { runId: message.runId });
                    setActiveRunId(message.runId);
                    setPerformanceProgress(() => {
                        const suiteId = message.suiteId;
                        const suite = suiteId ? configRef.current?.performanceSuites?.find(s => s.id === suiteId) : undefined;
                        const total = suite ? (suite.iterations || 0) + (suite.warmupRuns || 0) : 0;
                        return { iteration: 0, total };
                    });
                    break;

                case BackendCommand.PerformanceRunComplete:
                    debugLog('performanceRunComplete', { runId: message.runId });
                    setActiveRunId(undefined); // undefined matches state type
                    setPerformanceProgress(null);
                    break;

                case BackendCommand.PerformanceIterationComplete:
                    // debugLog('performanceIterationComplete', { runId: message.runId, iteration: message.iteration });
                    setPerformanceProgress((prev: { iteration: number; total: number } | null) => ({
                        iteration: message.iteration !== undefined ? message.iteration + 1 : (prev?.iteration || 0) + 1,
                        total: message.total ?? prev?.total ?? 0
                    }));
                    break;

                case BackendCommand.CoordinatorStatus:
                    if (message.status) {
                        setCoordinatorStatus(message.status);
                    }
                    if (message.error) {
                        debugLog('Coordinator Error', { error: message.error });
                        // Ideally show a toast or error
                    }
                    break;

                case BackendCommand.AddOperationToPerformance:
                    handleBackendAddOperation(message);
                    break;
            }
        };

        const unsubscribe = bridge.onMessage(handleMessage);
        return () => unsubscribe();
    }, [setConfig, configRef, handleBackendAddOperation]);


    // -------------------------------------------------------------------------
    // CONTEXT VALUE
    // -------------------------------------------------------------------------select first performance suite
    useEffect(() => {
        const suites = config?.performanceSuites || [];
        if (suites.length > 0 && !selectedPerformanceSuiteId) {
            setSelectedPerformanceSuiteId(suites[0].id);
        }
    }, [config?.performanceSuites, selectedPerformanceSuiteId, setSelectedPerformanceSuiteId]);

    return (
        <PerformanceContext.Provider value={{
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
            handleTogglePerformanceSuiteExpand,
            setActiveRunId,
            setPerformanceProgress,
            setCoordinatorStatus
        }}>
            {children}
        </PerformanceContext.Provider>
    );
};
