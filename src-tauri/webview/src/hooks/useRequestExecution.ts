/**
 * useRequestExecution.ts
 * 
 * Hook for managing SOAP request execution, updates, and related operations.
 * Extracted from App.tsx to reduce complexity.
 */

import { useRef, useCallback } from 'react';
import { bridge } from '../utils/bridge';
import { CustomXPathEvaluator } from '../utils/xpathEvaluator';
import { FrontendCommand } from '@shared/messages';
import { getInitialXml } from '@shared/utils/xmlUtils';
import {
    ApinoxProject,
    ApiInterface,
    ApiOperation,
    ApiRequest,
    TestCase,
    TestStep,
    BodyType
} from '@shared/models';

/**
 * Get Content-Type header based on body type
 * Mirrors backend logic in HttpClient.ts
 */
function getContentTypeForBodyType(bodyType: BodyType): string {
    switch (bodyType) {
        case 'json':
            return 'application/json';
        case 'xml':
            return 'application/xml';
        case 'graphql':
            return 'application/json';
        case 'text':
            return 'text/plain';
        case 'form-data':
            return 'multipart/form-data';
        case 'none':
            return '';
        default:
            return 'application/json';
    }
}

/**
 * Fix legacy content-type mismatches
 * If we detect old default content-types that don't match the body type, fix them
 */
function fixContentType(request: ApiRequest): { contentType: string; headers: Record<string, string> } {
    const legacyDefaults = ['text/xml; charset=utf-8', 'text/xml', 'application/soap+xml'];
    const currentContentType = request.contentType || '';
    const currentHeaderContentType = request.headers?.['Content-Type'] || '';
    
    // For REST/GraphQL requests with a body type, ensure content type matches
    if (request.requestType === 'rest' || request.requestType === 'graphql') {
        if (request.bodyType) {
            const expectedContentType = getContentTypeForBodyType(request.bodyType);
            
            // If current content type is a legacy SOAP default, fix it
            if (legacyDefaults.includes(currentContentType) || currentContentType === '') {
                return {
                    contentType: expectedContentType,
                    headers: {
                        ...(request.headers || {}),
                        'Content-Type': expectedContentType
                    }
                };
            }
            
            // If header doesn't match content type field, fix header
            if (currentHeaderContentType !== currentContentType) {
                return {
                    contentType: currentContentType,
                    headers: {
                        ...(request.headers || {}),
                        'Content-Type': currentContentType
                    }
                };
            }
        }
    }
    
    // No fix needed
    return {
        contentType: currentContentType,
        headers: request.headers || {}
    };
}

interface UseRequestExecutionParams {
    // Selection state
    selectedOperation: ApiOperation | null;
    selectedRequest: ApiRequest | null;
    selectedInterface: ApiInterface | null;
    selectedTestCase: TestCase | null;
    selectedStep: TestStep | null;
    selectedProjectName: string | null;
    wsdlUrl: string;

    // State setters
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setResponse: React.Dispatch<React.SetStateAction<any>>;
    setSelectedRequest: React.Dispatch<React.SetStateAction<ApiRequest | null>>;
    setProjects: React.Dispatch<React.SetStateAction<ApinoxProject[]>>;
    setWorkspaceDirty: React.Dispatch<React.SetStateAction<boolean>>;

    // Other
    testExecution: Record<string, Record<string, { response?: any }>>;

    // Performance Support
    selectedPerformanceSuiteId?: string | null;
    config?: any;
    setConfig?: React.Dispatch<React.SetStateAction<any>>;

    // Explorer Support
    exploredInterfaces?: ApiInterface[];
    setExploredInterfaces?: React.Dispatch<React.SetStateAction<ApiInterface[]>>;

    // Scrapbook auto-save callback
    onScrapbookAutoSave?: (updated: ApiRequest) => Promise<boolean>;
}

interface UseRequestExecutionReturn {
    executeRequest: (xml: string) => void;
    cancelRequest: () => void;
    handleRequestUpdate: (updated: ApiRequest) => void;
    handleResetRequest: () => void;
    startTimeRef: React.MutableRefObject<number>;
}

export function useRequestExecution({
    selectedOperation,
    selectedRequest,
    selectedInterface,
    selectedTestCase,
    selectedStep,
    selectedProjectName,
    wsdlUrl,
    setLoading,
    setResponse,
    setSelectedRequest,
    setProjects,
    setWorkspaceDirty,
    testExecution,
    selectedPerformanceSuiteId,
    config,
    setConfig,
    exploredInterfaces,
    setExploredInterfaces,
    onScrapbookAutoSave
}: UseRequestExecutionParams): UseRequestExecutionReturn {

    const startTimeRef = useRef<number>(0);

    const executeRequest = useCallback(async (xml: string) => {
        console.log('[App] executeRequest called');
        console.log('[App] Context - Operation:', selectedOperation?.name, 'Request:', selectedRequest?.name);

        // Debug: Log all conditions for scrapbook auto-save
        console.log('[executeRequest] Scrapbook save conditions:', {
            hasCallback: !!onScrapbookAutoSave,
            hasSelectedRequest: !!selectedRequest,
            selectedRequestId: selectedRequest?.id,
            selectedProjectName,
            selectedInterface: selectedInterface?.name,
            selectedOperation: selectedOperation?.name,
            selectedTestCase: selectedTestCase?.id,
            willSave: !!(onScrapbookAutoSave && selectedRequest && !selectedProjectName && !selectedInterface && !selectedOperation && !selectedTestCase)
        });

        // Auto-save scrapbook request before execution (captures manual edits to URL/body)
        if (onScrapbookAutoSave && selectedRequest && !selectedProjectName && !selectedInterface && !selectedOperation && !selectedTestCase) {
            console.log('[executeRequest] Auto-saving scrapbook request before execution');
            try {
                // Capture the current state including the xml being executed
                await onScrapbookAutoSave({ ...selectedRequest, request: xml });
            } catch (err) {
                console.error('[executeRequest] Failed to auto-save scrapbook:', err);
            }
        }

        setLoading(true);
        setResponse(null);
        startTimeRef.current = Date.now();

        // Allow execution if we have a request context, even if not fully in an Operation content (e.g. Test Step)
        if (selectedOperation || selectedRequest) {
            const url = selectedRequest?.endpoint || selectedInterface?.definition || wsdlUrl;
            const opName = selectedOperation?.name || selectedRequest?.name || 'Unknown Operation';

            console.log('[App] Sending executeRequest message. URL:', url, 'Op:', opName);

            const logToOutput = (msg: string) => bridge.sendMessage({ command: 'log', message: msg });
            logToOutput(`Starting execution of step: ${selectedStep?.name || selectedRequest?.name}`);

            // Calculate context variables if running a test step
            const contextVariables: Record<string, string> = {};
            if (selectedTestCase && selectedStep) {
                const currentIndex = selectedTestCase.steps.findIndex(s => s.id === selectedStep.id);
                if (currentIndex > 0) {
                    const priorSteps = selectedTestCase.steps.slice(0, currentIndex);
                    priorSteps.forEach(step => {
                        if (step.type === 'request' && step.config.request?.extractors) {
                            const stepExec = testExecution[selectedTestCase.id]?.[step.id];

                            step.config.request.extractors.forEach(ext => {
                                // Check if we already have a value for this variable
                                if (contextVariables[ext.variable]) return;

                                if (stepExec?.response) {
                                    // Step has been run, try to extract value
                                    const rawResp = stepExec.response.rawResponse || (typeof stepExec.response.result === 'string'
                                        ? stepExec.response.result
                                        : JSON.stringify(stepExec.response.result));

                                    if (rawResp && ext.source === 'body') {
                                        try {
                                            const val = CustomXPathEvaluator.evaluate(rawResp, ext.path);
                                            if (val) {
                                                contextVariables[ext.variable] = val;
                                                logToOutput(`[Context] Extracted '${ext.variable}' = '${val}' from step '${step.name}'`);
                                            } else if (ext.defaultValue) {
                                                // Extraction returned null, use default
                                                contextVariables[ext.variable] = ext.defaultValue;
                                                logToOutput(`[Context] Using default value for '${ext.variable}' = '${ext.defaultValue}' (extraction returned null)`);
                                            } else {
                                                logToOutput(`[Context] Warning: Extractor for '${ext.variable}' in step '${step.name}' returned null.`);
                                            }
                                        } catch (e) {
                                            console.warn('[App] Extractor failed for variable ' + ext.variable, e);
                                            if (ext.defaultValue) {
                                                contextVariables[ext.variable] = ext.defaultValue;
                                                logToOutput(`[Context] Using default value for '${ext.variable}' = '${ext.defaultValue}' (extraction error)`);
                                            } else {
                                                logToOutput(`[Context] Error evaluating extractor for '${ext.variable}': ${e}`);
                                            }
                                        }
                                    }
                                } else if (ext.defaultValue) {
                                    // Step hasn't been run yet, use default value
                                    contextVariables[ext.variable] = ext.defaultValue;
                                    logToOutput(`[Context] Using default value for '${ext.variable}' = '${ext.defaultValue}' (step '${step.name}' not run)`);
                                }
                            });
                        }
                    });
                }
            }

            console.log('[App] Context Variables:', contextVariables);
            if (Object.keys(contextVariables).length > 0) {
                logToOutput(`[Context] Sending ${Object.keys(contextVariables).length} context variables to backend.`);
            }

            // Regression fix: Ensure content-type matches body type
            const { contentType: fixedContentType, headers: fixedHeaders } = selectedRequest 
                ? fixContentType(selectedRequest) 
                : { contentType: 'application/soap+xml', headers: {} };

            bridge.sendMessage({
                command: FrontendCommand.ExecuteRequest,
                url,
                operation: opName,
                xml,
                contentType: fixedContentType,
                assertions: selectedRequest?.assertions,
                headers: fixedHeaders,
                contextVariables,
                // Environment for variable resolution
                environment: config?.activeEnvironment,
                // History context fields
                projectName: selectedProjectName || undefined,
                interfaceName: selectedInterface?.name || undefined,
                requestName: selectedRequest?.name || undefined,
                // WS-Security
                wsSecurity: selectedRequest?.wsSecurity,
                // Attachments
                attachments: selectedRequest?.attachments,
                // REST/GraphQL Support
                requestType: selectedRequest?.requestType,
                method: selectedRequest?.method,
                bodyType: selectedRequest?.bodyType,
                restConfig: selectedRequest?.restConfig,
                graphqlConfig: selectedRequest?.graphqlConfig
            });
        } else {
            console.error('[App] executeRequest aborted: No selectedOperation or selectedRequest');
            setLoading(false);
        }
    }, [selectedOperation, selectedRequest, selectedInterface, selectedTestCase, selectedStep, wsdlUrl, testExecution, setLoading, setResponse, onScrapbookAutoSave, selectedProjectName]);

    const cancelRequest = useCallback(() => {
        bridge.sendMessage({ command: FrontendCommand.CancelRequest });
        setLoading(false);
    }, [setLoading]);

    // Ref for debouncing project updates
    const projectUpdateTimer = useRef<NodeJS.Timeout | null>(null);

    const handleRequestUpdate = useCallback(async (updated: ApiRequest) => {
        const logContext = {
            requestName: updated.name,
            requestId: updated.id,
            assertionCount: updated.assertions?.length || 0,
            selectedProjectName,
            selectedInterfaceName: selectedInterface?.name,
            selectedOperationName: selectedOperation?.name,
            selectedTestCaseName: selectedTestCase?.name,
            selectedTestCaseId: selectedTestCase?.id,
            selectedPerformanceSuiteId
        };


        if (selectedRequest?.readOnly) {
            console.log('[handleRequestUpdate] Blocked update on read-only request:', updated.id);
            return;
        }

        console.log('[handleRequestUpdate] Called with:', logContext);
        // bridge.sendMessage({ command: 'log', message: '[handleRequestUpdate] START', data: JSON.stringify(logContext) });

        const dirtyUpdated = { ...updated, dirty: true };

        // 1. Immediate Local Update (Crucial for typing performance)
        setSelectedRequest(dirtyUpdated);
        setWorkspaceDirty(true);

        // bridge.sendMessage({ command: 'log', message: '[handleRequestUpdate] Set dirty: true on request', data: JSON.stringify({ requestId: updated.id }) });

        // 0. Scrapbook Request Modification (via callback)
        if (onScrapbookAutoSave) {
            const savedToScrapbook = await onScrapbookAutoSave(updated);
            if (savedToScrapbook) {
                console.log('[handleRequestUpdate] Saved to scrapbook via callback');
                return;
            }
        }

        // 1. Performance Request Modification (Immediate or Debounced? Keep immediate for now as it doesn't loop back to selectedRequest in the same way)
        if (selectedPerformanceSuiteId && updated.id?.startsWith('perf-req-')) {
            // ... existing perf logic omitted/unchanged ...
            // Actually, limiting scope of change. I will COPY existing perf logic here? 
            // No, I need to include it in the replacement chunk or omit it if outside.
        }

        // Re-implementing the Performance logic part to ensure it's not lost in replacement
        if (selectedPerformanceSuiteId && updated.id?.startsWith('perf-req-')) {
            console.log('[handleRequestUpdate] Updating Performance Request:', updated.id);
            bridge.sendMessage({ command: 'log', message: '[handleRequestUpdate] PERF PATH - updating perf request', data: JSON.stringify({ suiteId: selectedPerformanceSuiteId, requestId: updated.id }) });

            // Send update to backend immediately (safe?)
            bridge.sendMessage({
                command: FrontendCommand.UpdatePerformanceRequest,
                suiteId: selectedPerformanceSuiteId,
                requestId: updated.id!,
                updates: {
                    name: updated.name,
                    requestBody: updated.request,
                    headers: updated.headers,
                    method: updated.method,
                    endpoint: updated.endpoint
                }
            });

            // Optimistic update of local config
            if (setConfig && config) {
                setConfig((prev: any) => {
                    const suites = prev.performanceSuites || [];
                    const suiteIndex = suites.findIndex((s: any) => s.id === selectedPerformanceSuiteId);
                    if (suiteIndex === -1) return prev;
                    // ... verify structure ... 
                    const suite = { ...suites[suiteIndex] };
                    const reqIndex = suite.requests.findIndex((r: any) => r.id === updated.id);
                    if (reqIndex !== -1) {
                        const updatedReq = {
                            ...suite.requests[reqIndex],
                            name: updated.name,
                            requestBody: updated.request,
                            headers: updated.headers,
                            method: updated.method,
                            endpoint: updated.endpoint
                        };
                        const newRequests = [...suite.requests];
                        newRequests[reqIndex] = updatedReq;
                        const newSuites = [...suites];
                        newSuites[suiteIndex] = { ...suite, requests: newRequests };
                        return { ...prev, performanceSuites: newSuites };
                    }
                    return prev;
                });
            }
            return;
        }

        // 2. Project/Explorer Update - DEBOUNCED
        // This prevents the race condition where `setProjects` triggers a MainContent re-render
        // which inadvertently "re-syncs" selectedRequest to a slightly stale version from projects.

        if (projectUpdateTimer.current) {
            clearTimeout(projectUpdateTimer.current);
        }

        projectUpdateTimer.current = setTimeout(() => {
            // bridge.sendMessage({ command: 'log', message: '[handleRequestUpdate] PROJECT PATH - Debounced update executing' });

            // EXPLORER PATH: Update exploredInterfaces if viewing Explorer (no project selected)
            if (!selectedProjectName && setExploredInterfaces && exploredInterfaces) {
                setExploredInterfaces(prev => prev.map(i => {
                    if (i.name !== selectedInterface?.name) return i;
                    return {
                        ...i,
                        operations: i.operations.map(o => {
                            if (o.name !== selectedOperation?.name) return o;
                            return {
                                ...o,
                                requests: o.requests.map(r => r.id === updated.id ? dirtyUpdated : r)
                            };
                        })
                    };
                }));
            }

            setProjects(prev => {
                // bridge.sendMessage({ command: 'log', message: '[handleRequestUpdate] setProjects callback', data: JSON.stringify({ count: prev.length }) });

                const updatedProjects = prev.map(p => {
                    // 1. Is it a Test Case modification?
                    if (selectedTestCase) {
                        // ... Test Case Logic ...
                        // Need to duplicate logic here or assume it's stable?
                        // I'll copy the logic logic to be safe.

                        let caseUpdated = false;
                        const updatedSuites = p.testSuites?.map(s => {
                            const tcIndex = s.testCases?.findIndex(tc => tc.id === selectedTestCase.id) ?? -1;
                            if (tcIndex === -1) return s;

                            const updatedCases = [...(s.testCases || [])];
                            const stepIndex = updatedCases[tcIndex].steps.findIndex(step =>
                                (updated.id && step.config.request?.id === updated.id) ||
                                step.config.request?.name === updated.name ||
                                (selectedRequest && step.config.request?.name === selectedRequest.name)
                            );

                            if (stepIndex !== -1) {
                                caseUpdated = true;
                                updatedCases[tcIndex] = {
                                    ...updatedCases[tcIndex],
                                    steps: updatedCases[tcIndex].steps.map((st, i) => {
                                        if (i === stepIndex) {
                                            const finalRequest = {
                                                ...dirtyUpdated,
                                                id: dirtyUpdated.id || `req-${Date.now()}-healed`
                                            };
                                            return { ...st, config: { ...st.config, request: finalRequest } };
                                        }
                                        return st;
                                    })
                                };
                            }
                            return { ...s, testCases: updatedCases };
                        });

                        if (caseUpdated) {
                            return { ...p, testSuites: updatedSuites, dirty: true };
                        }
                    }

                    // 2. Standard Project Request Modification
                    if (p.name !== selectedProjectName && !selectedTestCase) return p;

                    let requestFound = false;
                    const updatedProject = {
                        ...p,
                        dirty: true,
                        interfaces: p.interfaces.map(i => {
                            // Optimization: Only scan relevant interface if known? 
                            // Just scan all for correctness.
                            return {
                                ...i,
                                operations: i.operations.map(o => {
                                    return {
                                        ...o,
                                        requests: o.requests.map(r => {
                                            if (r.id === updated.id) {
                                                requestFound = true;
                                                return dirtyUpdated;
                                            }
                                            return r;
                                        })
                                    };
                                })
                            };
                        }),
                        folders: p.folders ? updateFolderRequestInExecution(p.folders, updated.id || updated.name, dirtyUpdated, (found) => { requestFound = requestFound || found; }) : p.folders
                    };

                    return updatedProject;
                });

                return updatedProjects;
            });
        }, 300); // 300ms debounce for tree updates

    }, [selectedProjectName, selectedTestCase, selectedInterface, selectedOperation, selectedRequest, setProjects, setSelectedRequest, setWorkspaceDirty, selectedPerformanceSuiteId, config, setConfig, exploredInterfaces, setExploredInterfaces]);

    const handleResetRequest = useCallback(() => {
        if (selectedRequest && selectedOperation) {
            // Get the original request template from the operation
            // The first request in the operation contains the original full SOAP envelope
            const originalTemplate = selectedOperation.requests?.[0]?.request;

            if (originalTemplate) {
                // Use the original template which has the full SOAP envelope
                const updated = { ...selectedRequest, request: originalTemplate };
                handleRequestUpdate(updated);
            } else {
                // Fallback to generating from input if no template exists
                const xml = getInitialXml(selectedOperation.input);
                const updated = { ...selectedRequest, request: xml };
                handleRequestUpdate(updated);
            }
        }
    }, [selectedRequest, selectedOperation, handleRequestUpdate]);

    return {
        executeRequest,
        cancelRequest,
        handleRequestUpdate,
        handleResetRequest,
        startTimeRef
    };
}

// Helper function to recursively update a request in folder structure
function updateFolderRequestInExecution(folders: any[], requestId: string, updated: any, onFound: (found: boolean) => void): any[] {
    return folders.map(folder => {
        let foundInThis = false;
        const updatedRequests = folder.requests.map((r: any) => {
            if (r.id === requestId || r.name === requestId) {
                foundInThis = true;
                return updated;
            }
            return r;
        });

        if (foundInThis) onFound(true);

        return {
            ...folder,
            requests: updatedRequests,
            folders: folder.folders ? updateFolderRequestInExecution(folder.folders, requestId, updated, onFound) : folder.folders
        };
    });
}
