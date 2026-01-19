import { jsx as _jsx } from "react/jsx-runtime";
/**
 * SelectionContext.tsx
 *
 * Centralizes UI selection state for the APInox application.
 * This context tracks what the user has currently selected in the UI:
 * - Selected interface, operation, request
 * - Selected test case and step
 * - Current response and loading state
 *
 * Usage:
 *   1. Wrap your app with <SelectionProvider>
 *   2. Access state and actions via useSelection() hook
 *
 * Example:
 *   const { selectedRequest, setSelectedRequest, clearSelection } = useSelection();
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
// =============================================================================
// CONTEXT CREATION
// =============================================================================
/**
 * The React Context for selection state.
 * Initially undefined - must be used within SelectionProvider.
 */
const SelectionContext = createContext(undefined);
/**
 * Provider component that manages selection state.
 * Wrap your application (or relevant portion) with this provider.
 */
export function SelectionProvider({ children }) {
    // -------------------------------------------------------------------------
    // STATE
    // -------------------------------------------------------------------------
    const [selectedInterface, setSelectedInterface] = useState(null);
    const [selectedOperation, setSelectedOperation] = useState(null);
    const [selectedRequestState, setSelectedRequestState] = useState(null);
    const selectedRequestRef = React.useRef(null);
    const [selectedStep, setSelectedStep] = useState(null);
    const [selectedTestSuite, setSelectedTestSuite] = useState(null);
    const [selectedTestCase, setSelectedTestCase] = useState(null);
    const [selectedPerformanceSuiteId, setSelectedPerformanceSuiteId] = useState(null);
    const [response, setResponseState] = useState(null);
    const [responseCache, setResponseCache] = useState({});
    const [loading, setLoading] = useState(false);
    const getCacheKey = useCallback((req) => req?.id || req?.name || null, []);
    const getStorageKey = useCallback((key) => `apinox:lastResponse:${key}`, []);
    const restoreResponseForRequest = useCallback((req, existingCache) => {
        const key = getCacheKey(req);
        if (!req || !key) {
            console.log('[SelectionContext] restoreResponseForRequest: no request/key, clearing response');
            setResponseState(null);
            return;
        }
        const cache = existingCache || responseCache;
        if (cache.hasOwnProperty(key)) {
            console.log('[SelectionContext] restoreResponseForRequest: restored from in-memory cache', { key });
            setResponseState(cache[key]);
            return;
        }
        try {
            const stored = window.localStorage.getItem(getStorageKey(key));
            if (stored) {
                const parsed = JSON.parse(stored);
                console.log('[SelectionContext] restoreResponseForRequest: restored from localStorage', { key });
                setResponseCache((c) => ({ ...c, [key]: parsed }));
                setResponseState(parsed);
                return;
            }
        }
        catch (e) {
            console.warn('[SelectionContext] Failed to read persisted response', e);
        }
        console.log('[SelectionContext] restoreResponseForRequest: no cached response', { key });
        setResponseState(null);
    }, [getCacheKey, getStorageKey, responseCache]);
    const setSelectedRequest = useCallback((next) => {
        const resolved = typeof next === 'function'
            ? next(selectedRequestRef.current)
            : next;
        console.log('[SelectionContext] setSelectedRequest', { name: resolved?.name, id: resolved?.id });
        selectedRequestRef.current = resolved;
        setSelectedRequestState(resolved);
        restoreResponseForRequest(resolved);
    }, [restoreResponseForRequest]);
    const setResponse = useCallback((next) => {
        setResponseState((prev) => {
            const resolved = typeof next === 'function' ? next(prev) : next;
            const key = getCacheKey(selectedRequestRef.current);
            if (key && resolved != null) {
                setResponseCache((cache) => ({ ...cache, [key]: resolved }));
                try {
                    const storageKey = getStorageKey(key);
                    window.localStorage.setItem(storageKey, JSON.stringify(resolved));
                }
                catch (e) {
                    console.warn('[SelectionContext] Failed to persist response', e);
                }
            }
            else {
                console.log('[SelectionContext] setResponse skipped persisting (no key or null response)', { key, hasResponse: resolved != null });
            }
            return resolved;
        });
    }, [getCacheKey, getStorageKey]);
    // Restore cached response when switching requests
    useEffect(() => {
        console.log('[SelectionContext] selectedRequest changed, attempting restore');
        restoreResponseForRequest(selectedRequestState, responseCache);
    }, [selectedRequestState, responseCache, restoreResponseForRequest]);
    // -------------------------------------------------------------------------
    // UTILITY ACTIONS
    // -------------------------------------------------------------------------
    /**
     * Clears all selection state.
     * Call when closing a project or navigating to a different view.
     */
    const clearSelection = useCallback(() => {
        setSelectedInterface(null);
        setSelectedOperation(null);
        setSelectedRequest(null);
        setSelectedStep(null);
        setSelectedTestSuite(null);
        setSelectedTestCase(null);
        setSelectedPerformanceSuiteId(null);
        setResponseState(null);
        setResponseCache({});
    }, []);
    /**
     * Clears sub-selections but keeps test case.
     * Used when selecting a test case to reset step/request selection.
     */
    const clearSubSelection = useCallback(() => {
        setSelectedStep(null);
        setSelectedRequest(null);
        setSelectedOperation(null);
        setSelectedInterface(null);
        setSelectedPerformanceSuiteId(null);
        setResponseState(null);
    }, []);
    // -------------------------------------------------------------------------
    // CONTEXT VALUE
    // -------------------------------------------------------------------------
    const value = {
        // Selection State
        selectedInterface,
        selectedOperation,
        selectedRequest: selectedRequestState,
        selectedStep,
        selectedTestSuite,
        selectedTestCase,
        selectedPerformanceSuiteId,
        // Request/Response State
        response,
        loading,
        // Setters
        setSelectedInterface,
        setSelectedOperation,
        setSelectedRequest,
        setSelectedStep,
        setSelectedTestSuite,
        setSelectedTestCase,
        setSelectedPerformanceSuiteId,
        setResponse,
        setLoading,
        // Utilities
        clearSelection,
        clearSubSelection
    };
    return (_jsx(SelectionContext.Provider, { value: value, children: children }));
}
// =============================================================================
// HOOK
// =============================================================================
/**
 * Hook to access selection context.
 * Must be used within a SelectionProvider.
 *
 * @throws Error if used outside of SelectionProvider
 *
 * @example
 * function RequestPanel() {
 *     const { selectedRequest, response, loading } = useSelection();
 *     if (!selectedRequest) return <div>Select a request</div>;
 *     return <Editor value={selectedRequest.request} />;
 * }
 */
export function useSelection() {
    const context = useContext(SelectionContext);
    if (context === undefined) {
        throw new Error('useSelection must be used within a SelectionProvider');
    }
    return context;
}
