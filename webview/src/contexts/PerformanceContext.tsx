import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { bridge } from '../utils/bridge';
import { PerformanceSuite, PerformanceRequest, ApiRequest } from '@shared/models';
import { useUI } from './UIContext';
import { useSelection } from './SelectionContext';

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
    const { config } = useUI();
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

    // Auto-select first performance suite
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
