import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { bridge } from '../utils/bridge';
import { PerformanceSuite, PerformanceRequest, ApiRequest } from '@shared/models';
import { BackendCommand, FrontendCommand } from '@shared/messages';
import { getInitialXml } from '../utils/soapUtils';
import { useUI } from './UIContext';
import { useSelection } from './SelectionContext';

const debugLog = (_message: string, _data?: any) => { // Allowed unused for now or used
    // console.debug(`[PerformanceContext] ${_message}`, _data);
};

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
    const {
        selectedPerformanceSuiteId,
        setSelectedPerformanceSuiteId,
        setSelectedInterface,
        setSelectedOperation,
        setSelectedRequest,
        setSelectedTestCase,
        setSelectedStep
    } = useSelection();

    // Handlers
    const handleAddPerformanceSuite = useCallback((name: string) => {
        const newId = `perf - suite - ${Date.now()} `;
        bridge.sendMessage({ command: 'addPerformanceSuite', name, id: newId });
        setSelectedPerformanceSuiteId(newId);

        // Clear other selections
        setSelectedInterface(null);
        setSelectedOperation(null);
        setSelectedRequest(null);
        setSelectedTestCase(null);
        setSelectedStep(null);
    }, [setSelectedPerformanceSuiteId, setSelectedInterface, setSelectedOperation, setSelectedRequest, setSelectedTestCase, setSelectedStep]);

    const handleDeletePerformanceSuite = useCallback((id: string) => {
        bridge.sendMessage({ command: 'deletePerformanceSuite', suiteId: id });
    }, []);

    const handleRunPerformanceSuite = useCallback((id: string) => {
        setActiveRunId(id);
        bridge.sendMessage({ command: 'runPerformanceSuite', suiteId: id });
    }, []);

    const handleStopPerformanceRun = useCallback(() => {
        bridge.sendMessage({ command: 'abortPerformanceSuite' });
    }, []);

    const handleSelectPerformanceSuite = useCallback((id: string) => {
        if (selectedPerformanceSuiteId === id) return;

        const suite = config?.performanceSuites?.find(s => s.id === id);
        if (suite) {
            setSelectedInterface(null);
            setSelectedOperation(null);
            setSelectedRequest(null);
            setSelectedTestCase(null);
            setSelectedStep(null);
            setSelectedPerformanceSuiteId(suite.id);
        }
    }, [selectedPerformanceSuiteId, config, setSelectedPerformanceSuiteId, setSelectedInterface, setSelectedOperation, setSelectedRequest, setSelectedTestCase, setSelectedStep]);

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
        setExpandedPerformanceSuiteIds(prev =>
            prev.includes(suiteId) ? prev : [...prev, suiteId]
        );
        bridge.sendMessage({ command: 'pickOperationForPerformance', suiteId });
    }, []);

    const handleDeletePerformanceRequest = useCallback((suiteId: string, requestId: string) => {
        bridge.sendMessage({ command: 'deletePerformanceRequest', suiteId, requestId });
    }, []);

    const handleUpdatePerformanceRequest = useCallback((suiteId: string, requestId: string, updates: Partial<PerformanceRequest>) => {
        bridge.sendMessage({ command: 'updatePerformanceRequest', suiteId, requestId, updates });
    }, []);

    const handleSelectPerformanceRequest = useCallback((request: PerformanceRequest) => {
        console.log('[Performance] Selecting request', request.id);
        const soapRequest: ApiRequest = {
            id: request.id,
            name: request.name,
            endpoint: request.endpoint,
            method: request.method,
            request: request.requestBody,
            headers: request.headers,
            extractors: request.extractors,
            contentType: request.headers?.['Content-Type'] || request.headers?.['content-type'] || 'application/soap+xml',
        };
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
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.command === 'coordinatorStatus') {
                setCoordinatorStatus(message.status);
            }
        };
        window.addEventListener('message', handleMessage);
        // Request initial status
        bridge.sendMessage({ command: 'getCoordinatorStatus' });
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // -------------------------------------------------------------------------
    // MESSAGE HANDLING
    // -------------------------------------------------------------------------

    React.useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.command) {
                case BackendCommand.PerformanceRunStarted:
                    debugLog('performanceRunStarted', { runId: message.runId });
                    setActiveRunId(message.runId);
                    setPerformanceProgress({ iteration: 0, total: 0 }); // Initialize valid object
                    break;

                case BackendCommand.PerformanceRunComplete:
                    debugLog('performanceRunComplete', { runId: message.runId });
                    setActiveRunId(undefined); // undefined matches state type
                    break;

                case BackendCommand.PerformanceIterationComplete:
                    // debugLog('performanceIterationComplete', { runId: message.runId, iteration: message.iteration });
                    if (message.runId) {
                        setPerformanceProgress((prev: { iteration: number; total: number } | null) => ({
                            iteration: message.iteration || (prev?.iteration || 0) + 1,
                            total: message.total || prev?.total || 0
                        }));
                    }
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

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [setConfig]); // Only stable deps needed if debugLog is constant

    // Helper for complex AddOperation logic
    const handleBackendAddOperation = async (message: any) => {
        debugLog('addOperationToPerformance', { suiteId: message.suiteId, operation: message.operation?.name });
        // We need current config. Since this is inside useEffect/event listener, 
        // we might have stale state if we just use 'config'. 
        // However, 'setProperty' style updates are safe. 
        // For reading 'config.performanceSuites', we should probably use a Ref or Functional State update if possible.
        // But here we need to READ to find the index.

        // Ideally, we move this logic to a separate function that we can call with fresh state?
        // Or we use a ref for config which is kept in sync.

        // For now, let's implement the logic using the functional update pattern where possible,
        // or accept that we might need `config` in dependency array (which re-binds listener).
        // Re-binding listener on config change is expensive? Config changes often?
        // Yes, config changes on every keystroke in some editors.

        // Better approach: Use the ref pattern for config like useMessageHandler did, OR
        // Use the `setConfig` functional update heavily.

        // Let's rely on `setConfig` functional update to find and update.

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
                    id: `perf-req-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    method: newRequest.method || 'POST',
                    requestBody: newRequest.requestBody || (newRequest as any).request || '',
                    interfaceName: newRequest.interfaceName,
                    operationName: newRequest.operationName,
                    order: (suite.requests?.length || 0) + 1,
                    readOnly: false
                };
            } else if (perfOp) {
                newRequest = {
                    id: `perf-req-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
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
                    readOnly: false
                };
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
    };

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
