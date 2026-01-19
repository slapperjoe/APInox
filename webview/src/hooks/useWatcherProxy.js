/**
 * useWatcherProxy.ts
 *
 * Hook for managing watcher and proxy state and handlers.
 * Extracted from App.tsx to reduce complexity.
 */
import { useState, useCallback } from 'react';
import { SidebarView } from '@shared/models';
import { formatXml } from '@shared/utils/xmlFormatter';
export function useWatcherProxy({ activeView, inlineElementValues, hideCausalityData, setSelectedInterface, setSelectedOperation, setSelectedRequest, setSelectedTestCase, setResponse }) {
    // Watcher State
    const [watcherHistory, setWatcherHistory] = useState([]);
    const [watcherRunning, setWatcherRunning] = useState(false);
    // Proxy State
    const [proxyHistory, setProxyHistory] = useState([]);
    const [proxyRunning, setProxyRunning] = useState(false);
    const [proxyConfig, setProxyConfig] = useState({ port: 9000, target: 'http://localhost:8080', systemProxyEnabled: true });
    // Mock State
    const [mockHistory, setMockHistory] = useState([]);
    const [mockRunning, setMockRunning] = useState(false);
    const [mockConfig, setMockConfig] = useState({
        enabled: false,
        port: 9001,
        targetUrl: 'http://localhost:8080',
        rules: [],
        passthroughEnabled: true,
        routeThroughProxy: false
    });
    // Unified Server Mode (controlled by UI, not derived from running states)
    const [serverMode, setServerMode] = useState('off');
    const handleSelectWatcherEvent = useCallback((event) => {
        let requestBody = event.formattedBody;
        if (requestBody === undefined) {
            const raw = event.requestContent || event.requestBody || '';
            requestBody = formatXml(raw, true, inlineElementValues, hideCausalityData);
            // Cache the formatted body so it doesn't re-format on next click
            if (activeView === SidebarView.SERVER) {
                setProxyHistory(prev => prev.map(e => e.id === event.id ? { ...e, formattedBody: requestBody } : e));
            }
            else {
                setWatcherHistory(prev => prev.map(e => e.id === event.id ? { ...e, formattedBody: requestBody } : e));
            }
        }
        const tempRequest = {
            id: event.id,
            name: `Logged: ${event.timestampLabel}`,
            request: requestBody,
            dirty: false,
            headers: event.requestHeaders || {},
            endpoint: event.url || '',
            method: event.method || 'POST',
            contentType: 'application/soap+xml'
        };
        const tempOp = {
            name: 'External Request',
            input: '',
            requests: [tempRequest],
            action: 'WatcherAction'
        };
        const tempIface = {
            name: 'File Watcher',
            type: 'wsdl',
            soapVersion: '1.1',
            definition: '',
            operations: [tempOp],
            bindingName: 'WatcherBinding'
        };
        setSelectedInterface(tempIface);
        setSelectedOperation(tempOp);
        setSelectedInterface(tempIface);
        setSelectedOperation(tempOp);
        setSelectedRequest(tempRequest);
        setSelectedTestCase(null); // Ensure we exit test case context
        const responseContent = event.responseContent || event.responseBody;
        if (responseContent) {
            setResponse({
                rawResponse: responseContent,
                duration: event.duration || 0,
                lineCount: responseContent.split(/\r\n|\r|\n/).length,
                success: event.success,
                headers: event.responseHeaders
            });
        }
        else {
            setResponse(null);
        }
    }, [activeView, inlineElementValues, hideCausalityData, setSelectedInterface, setSelectedOperation, setSelectedRequest, setSelectedTestCase, setResponse]);
    // Mock Event Selection Handler
    const handleSelectMockEvent = useCallback((event) => {
        const requestBody = formatXml(event.requestBody || '', true, inlineElementValues, hideCausalityData);
        const tempRequest = {
            id: event.id,
            name: `Mock: ${event.timestampLabel}`,
            request: requestBody,
            dirty: false,
            headers: event.requestHeaders || {},
            endpoint: event.url || '',
            method: event.method || 'POST',
            contentType: 'application/soap+xml'
        };
        const tempOp = {
            name: event.matchedRule ? `Mock: ${event.matchedRule}` : 'Mock Request',
            input: '',
            requests: [tempRequest],
            action: 'MockAction'
        };
        const tempIface = {
            name: 'Mock Server',
            type: 'wsdl',
            soapVersion: '1.1',
            definition: '',
            operations: [tempOp],
            bindingName: 'MockBinding'
        };
        setSelectedInterface(tempIface);
        setSelectedOperation(tempOp);
        setSelectedRequest(tempRequest);
        setSelectedTestCase(null);
        if (event.responseBody) {
            setResponse({
                rawResponse: event.responseBody,
                duration: event.duration || 0,
                lineCount: event.responseBody.split(/\r\n|\r|\n/).length,
                success: event.status ? event.status >= 200 && event.status < 300 : false,
                headers: event.responseHeaders
            });
        }
        else {
            setResponse(null);
        }
    }, [inlineElementValues, hideCausalityData, setSelectedInterface, setSelectedOperation, setSelectedRequest, setSelectedTestCase, setResponse]);
    const handleClearMockHistory = useCallback(() => {
        setMockHistory([]);
    }, []);
    return {
        // Watcher
        watcherHistory,
        setWatcherHistory,
        watcherRunning,
        setWatcherRunning,
        // Proxy
        proxyHistory,
        setProxyHistory,
        proxyRunning,
        setProxyRunning,
        proxyConfig,
        setProxyConfig,
        // Handler
        handleSelectWatcherEvent,
        // Mock
        mockHistory,
        setMockHistory,
        mockRunning,
        setMockRunning,
        mockConfig,
        setMockConfig,
        handleSelectMockEvent,
        handleClearMockHistory,
        // Unified Server Mode
        serverMode,
        setServerMode
    };
}
