import { jsx as _jsx } from "react/jsx-runtime";
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { bridge } from '../utils/bridge';
import { BackendCommand, FrontendCommand } from '@shared/messages';
import { getInitialXml } from '../utils/soapUtils';
import { useUI } from './UIContext';
import { useSelection } from './SelectionContext';
const debugLog = (_message, _data) => {
    // console.debug(`[PerformanceContext] ${_message}`, _data);
};
const PerformanceContext = createContext(undefined);
export const usePerformance = () => {
    const context = useContext(PerformanceContext);
    if (!context) {
        throw new Error('usePerformance must be used within a PerformanceProvider');
    }
    return context;
};
export const PerformanceProvider = ({ children }) => {
    // State
    const [activeRunId, setActiveRunId] = useState(undefined);
    const [performanceProgress, setPerformanceProgress] = useState(null);
    const [coordinatorStatus, setCoordinatorStatus] = useState({
        running: false,
        port: 8765,
        workers: [],
        expectedWorkers: 1
    });
    const [expandedPerformanceSuiteIds, setExpandedPerformanceSuiteIds] = useState([]);
    // Dependencies
    const { config, setConfig } = useUI();
    const { selectedPerformanceSuiteId, setSelectedPerformanceSuiteId, setSelectedInterface, setSelectedOperation, setSelectedRequest, setSelectedTestCase, setSelectedStep } = useSelection();
    // Handlers
    const handleAddPerformanceSuite = useCallback((name) => {
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
    const handleDeletePerformanceSuite = useCallback((id) => {
        bridge.sendMessage({ command: 'deletePerformanceSuite', suiteId: id });
    }, []);
    const handleRunPerformanceSuite = useCallback((id) => {
        setActiveRunId(id);
        bridge.sendMessage({ command: 'runPerformanceSuite', suiteId: id });
    }, []);
    const handleStopPerformanceRun = useCallback(() => {
        bridge.sendMessage({ command: 'abortPerformanceSuite' });
    }, []);
    const handleSelectPerformanceSuite = useCallback((id) => {
        if (selectedPerformanceSuiteId === id)
            return;
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
    const handleUpdatePerformanceSuite = useCallback((suite) => {
        bridge.sendMessage({ command: 'updatePerformanceSuite', suiteId: suite.id, updates: suite });
    }, []);
    const handleTogglePerformanceSuiteExpand = useCallback((suiteId) => {
        setExpandedPerformanceSuiteIds(prev => prev.includes(suiteId)
            ? prev.filter(id => id !== suiteId)
            : [...prev, suiteId]);
    }, []);
    const handleAddPerformanceRequest = useCallback((suiteId) => {
        setExpandedPerformanceSuiteIds(prev => prev.includes(suiteId) ? prev : [...prev, suiteId]);
        bridge.sendMessage({ command: 'pickOperationForPerformance', suiteId });
    }, []);
    const handleDeletePerformanceRequest = useCallback((suiteId, requestId) => {
        bridge.sendMessage({ command: 'deletePerformanceRequest', suiteId, requestId });
    }, []);
    const handleUpdatePerformanceRequest = useCallback((suiteId, requestId, updates) => {
        bridge.sendMessage({ command: 'updatePerformanceRequest', suiteId, requestId, updates });
    }, []);
    const handleSelectPerformanceRequest = useCallback((request) => {
        console.log('[Performance] Selecting request', request.id);
        const soapRequest = {
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
    const handleStartCoordinator = useCallback((port, expectedWorkers) => {
        bridge.sendMessage({ command: 'startCoordinator', port, expectedWorkers });
    }, []);
    const handleStopCoordinator = useCallback(() => {
        bridge.sendMessage({ command: 'stopCoordinator' });
    }, []);
    // Listen for coordinator status updates
    useEffect(() => {
        const handleMessage = (event) => {
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
        const handleMessage = (event) => {
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
                        setPerformanceProgress((prev) => ({
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
    const handleBackendAddOperation = async (message) => {
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
        setConfig((prevConfig) => {
            const currentSuites = prevConfig.performanceSuites || [];
            const idx = currentSuites.findIndex((s) => s.id === message.suiteId);
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
                    requestBody: newRequest.requestBody || newRequest.request || '',
                    interfaceName: newRequest.interfaceName,
                    operationName: newRequest.operationName,
                    order: (suite.requests?.length || 0) + 1,
                    readOnly: false
                };
            }
            else if (perfOp) {
                newRequest = {
                    id: `perf-req-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    name: perfOp.name,
                    endpoint: perfOp.originalEndpoint || '',
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
    return (_jsx(PerformanceContext.Provider, { value: {
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
        }, children: children }));
};
