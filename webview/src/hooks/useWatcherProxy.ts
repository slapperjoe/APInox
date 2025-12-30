/**
 * useWatcherProxy.ts
 * 
 * Hook for managing watcher and proxy state and handlers.
 * Extracted from App.tsx to reduce complexity.
 */

import { useState, useCallback } from 'react';
import { WatcherEvent, SoapUIRequest, SoapUIOperation, SoapUIInterface, SidebarView } from '../models';
import { formatXml } from '../utils/xmlFormatter';

interface UseWatcherProxyParams {
    // UI State
    activeView: SidebarView;
    inlineElementValues: boolean;
    hideCausalityData: boolean;

    // Selection setters
    setSelectedInterface: React.Dispatch<React.SetStateAction<SoapUIInterface | null>>;
    setSelectedOperation: React.Dispatch<React.SetStateAction<SoapUIOperation | null>>;
    setSelectedRequest: React.Dispatch<React.SetStateAction<SoapUIRequest | null>>;
    setSelectedTestCase: React.Dispatch<React.SetStateAction<any>>;
    setResponse: React.Dispatch<React.SetStateAction<any>>;
}

interface UseWatcherProxyReturn {
    // Watcher State
    watcherHistory: WatcherEvent[];
    setWatcherHistory: React.Dispatch<React.SetStateAction<WatcherEvent[]>>;
    watcherRunning: boolean;
    setWatcherRunning: React.Dispatch<React.SetStateAction<boolean>>;

    // Proxy State
    proxyHistory: WatcherEvent[];
    setProxyHistory: React.Dispatch<React.SetStateAction<WatcherEvent[]>>;
    proxyRunning: boolean;
    setProxyRunning: React.Dispatch<React.SetStateAction<boolean>>;
    proxyConfig: { port: number; target: string; systemProxyEnabled: boolean };
    setProxyConfig: React.Dispatch<React.SetStateAction<{ port: number; target: string; systemProxyEnabled: boolean }>>;

    // Handlers
    handleSelectWatcherEvent: (event: WatcherEvent) => void;
}

export function useWatcherProxy({
    activeView,
    inlineElementValues,
    hideCausalityData,
    setSelectedInterface,
    setSelectedOperation,
    setSelectedRequest,
    setSelectedTestCase,
    setResponse
}: UseWatcherProxyParams): UseWatcherProxyReturn {

    // Watcher State
    const [watcherHistory, setWatcherHistory] = useState<WatcherEvent[]>([]);
    const [watcherRunning, setWatcherRunning] = useState(false);

    // Proxy State
    const [proxyHistory, setProxyHistory] = useState<WatcherEvent[]>([]);
    const [proxyRunning, setProxyRunning] = useState(false);
    const [proxyConfig, setProxyConfig] = useState({ port: 9000, target: 'http://localhost:8080', systemProxyEnabled: true });

    const handleSelectWatcherEvent = useCallback((event: WatcherEvent) => {
        let requestBody = event.formattedBody;
        if (requestBody === undefined) {
            const raw = event.requestContent || event.requestBody || '';
            requestBody = formatXml(raw, true, inlineElementValues, hideCausalityData);

            // Cache the formatted body so it doesn't re-format on next click
            if (activeView === SidebarView.PROXY) {
                setProxyHistory(prev => prev.map(e => e.id === event.id ? { ...e, formattedBody: requestBody } : e));
            } else {
                setWatcherHistory(prev => prev.map(e => e.id === event.id ? { ...e, formattedBody: requestBody } : e));
            }
        }

        const tempRequest: SoapUIRequest = {
            id: event.id,
            name: `Logged: ${event.timestampLabel}`,
            request: requestBody,
            dirty: false,
            headers: event.requestHeaders || {},
            endpoint: event.url || '',
            method: event.method || 'POST'
        };

        const tempOp: SoapUIOperation = {
            name: 'External Request',
            input: '',
            requests: [tempRequest],
            action: 'WatcherAction'
        };

        const tempIface: SoapUIInterface = {
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
        } else {
            setResponse(null);
        }
    }, [activeView, inlineElementValues, hideCausalityData, setSelectedInterface, setSelectedOperation, setSelectedRequest, setSelectedTestCase, setResponse]);

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
        handleSelectWatcherEvent
    };
}
