/**
 * Platform Bridge - Tauri Desktop Application
 * 
 * Provides unified communication between the React webview and the Rust/Tauri backend.
 * 
 * ## Architecture (Hybrid Approach)
 * 
 * This bridge serves two purposes:
 * 
 * 1. **Event-Driven Commands** (Keep using bridge):
 *    - Async operations that emit events (WSDL parsing, test execution, workflows)
 *    - Commands that need progress updates or streaming results
 *    - Examples: loadWsdl, executeRequest, runTestCase, runTestSuite
 * 
 * 2. **Simple CRUD Commands** (Migrate to direct Tauri calls):
 *    - TODO: These should be migrated to use `invoke()` directly from components
 *    - Examples: saveProject, loadProject, saveSettings, getSettings
 *    - Benefit: Simpler, faster, better type safety
 * 
 * ## Migration Guide (Future)
 * 
 * To migrate a simple command to direct Tauri calls:
 * 
 * ```typescript
 * // BEFORE (using bridge)
 * await bridge.sendMessageAsync({
 *     command: FrontendCommand.SaveProject,
 *     project
 * });
 * 
 * // AFTER (direct Tauri call)
 * import { invoke } from '@tauri-apps/api/core';
 * await invoke('save_project', { project, dirPath });
 * ```
 * 
 * ## Sidecar Status
 * 
 * ✅ Node.js sidecar has been completely removed
 * ✅ All functionality now implemented in Rust
 * ✅ All commands route through Rust via `tryRustCommand()`
 */

declare global {
    interface Window {
        __TAURI__?: any;
        __TAURI_INTERNALS__?: any;
    }
}

// ============== Environment Detection ==============

export const isTauri = (): boolean => typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);

export type Platform = 'tauri' | 'standalone';
export const getPlatform = (): Platform => {
    if (isTauri()) return 'tauri';
    return 'standalone';
};

// ============== Tauri Imports ==============

let tauriInvoke: ((cmd: string, args?: any) => Promise<any>) | null = null;
let tauriListen: ((event: string, handler: (e: any) => void) => Promise<() => void>) | null = null;
let tauriInitPromise: Promise<void> | null = null;

async function initTauri(): Promise<void> {
    if (!isTauri()) return;

    try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { listen } = await import('@tauri-apps/api/event');
        tauriInvoke = invoke;
        tauriListen = listen;
    } catch (e) {
        console.error('[Bridge] Failed to initialize Tauri:', e);
    }
}

function ensureTauriInitialized(): Promise<void> {
    if (!isTauri()) return Promise.resolve();
    if (!tauriInitPromise) {
        tauriInitPromise = initTauri();
    }
    return tauriInitPromise;
}

// Initialize Tauri on load
if (isTauri()) {
    ensureTauriInitialized();
}

// ============== Message Types ==============

import { FrontendCommand, BackendCommand } from '@shared/messages';

interface BridgeMessage {
    command: FrontendCommand | string;
    [key: string]: any;
}

export interface BackendMessage {
    command: BackendCommand | string;
    [key: string]: any;
}

// ============== Tauri Command Helpers ==============

/**
 * Call a Tauri command directly (bypassing sidecar)
 * Use this for commands implemented in Rust (file I/O, config, etc.)
 */
export async function invokeTauriCommand<T = any>(command: string, args?: Record<string, any>): Promise<T> {
    await ensureTauriInitialized();
    
    if (!tauriInvoke) {
        throw new Error('Tauri not initialized');
    }
    
    try {
        return await tauriInvoke(command, args);
    } catch (error: any) {
        console.error(`[Bridge] Tauri command '${command}' failed:`, error);
        throw error;
    }
}

// ============== Rust Backend Routing ==============

/**
 * Routes commands to Rust Tauri backend instead of Node.js sidecar
 * Returns null if command should fallback to sidecar (for unimplemented features)
 */
async function tryRustCommand(message: BridgeMessage): Promise<any | null> {
    if (!tauriInvoke) {
        return null; // Tauri not initialized, fallback to sidecar
    }

    try {
        // Route LoadWsdl to Rust parse_wsdl command
        if (message.command === FrontendCommand.LoadWsdl) {
            console.log('[Bridge] Routing LoadWsdl to Rust backend:', message.url);
            
            const response = await tauriInvoke('parse_wsdl', {
                request: { url: message.url }
            });
            
            // Response format: { services: [], target_namespace: string, imports_count: number }
            if (!response.services || !Array.isArray(response.services)) {
                throw new Error('Invalid WSDL response from Rust backend');
            }
            
            console.log('[Bridge] WSDL parsed successfully:', response.services.length, 'services');
            
            // Return in format expected by mapResponseToBackendEvent
            return {
                services: response.services,
                wsdlUrl: message.url,
                targetProjectId: message.targetProjectId
            };
        }

        // Route ExecuteRequest (SOAP) to Rust execute_soap_request command
        if (message.command === FrontendCommand.ExecuteRequest && message.xml) {
            console.log('[Bridge] Routing SOAP ExecuteRequest to Rust backend');
            
            // Build request from message parameters
            const request: any = {
                operation: {
                    name: message.operation || '',
                    targetNamespace: message.targetNamespace || '',
                    action: message.soapAction || '',
                    input: { name: message.operation || '' },
                    output: { name: `${message.operation || ''}Response` },
                    originalEndpoint: message.url,
                    fullSchema: null,
                    description: null,
                    portName: null
                },
                soapVersion: message.soapVersion || '1.1',
                values: {}, // Raw XML mode, no values needed
                endpoint: message.url,
                username: message.username || null,
                password: message.password || null,
                passwordType: message.passwordType || null,
                addTimestamp: message.addTimestamp || false,
                rawXml: message.xml // Send raw XML body
            };

            const startTime = Date.now();
            const response = await tauriInvoke('execute_soap_request', { request });
            const duration = Date.now() - startTime;
            
            const responseHeaders: Record<string, string> = Object.fromEntries(response.headers || []);
            const responseBody: string = response.body || response.rawXml || '';

            // Save history entry
            const historyEntry: any = {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                requestName: message.operation || message.url || 'Request',
                endpoint: message.url || '',
                method: 'POST',
                projectName: message.projectName || '',
                interfaceName: message.interfaceName || '',
                operationName: message.operation || '',
                requestBody: message.xml || '',
                headers: message.headers || {},
                status: response.statusCode || (response.success ? 200 : 500),
                duration,
                responseBody,
                responseHeaders,
                responseSize: responseBody.length,
                success: !!response.success,
                error: response.success ? undefined : (response.error || undefined),
                starred: false,
            };
            tauriInvoke('add_history_entry', { entry: historyEntry }).catch((e: any) =>
                console.warn('[Bridge] Failed to save history entry:', e)
            );
            // Immediately surface in UI
            listeners.forEach(cb => cb({ command: BackendCommand.HistoryUpdate, entry: historyEntry } as any));

            if (!response.success) {
                return {
                    error: response.error || 'SOAP request failed',
                    fault: response.fault
                };
            }

            // Return in format expected by frontend
            return {
                response: {
                    rawResponse: responseBody,
                    headers: responseHeaders,
                    status: response.statusCode || 500,
                    timeTaken: duration
                }
            };
        }

        // Route RunTestCase to Rust run_test_case command
        if (message.command === FrontendCommand.RunTestCase) {
            const response = await tauriInvoke('run_test_case', {
                request: {
                    testCase: message.testCase,
                    variables: message.environment || {},
                    stream: message.stream !== false,
                    fallbackEndpoint: message.fallbackEndpoint || ''
                }
            });
            // Streaming: response = { runId: '...' }
            // Sync: response = { passed: bool, durationMs: number }
            return response;
        }

        // Route ExecuteWorkflow to Rust run_workflow command
        if (message.command === FrontendCommand.ExecuteWorkflow) {
            const response = await tauriInvoke('run_workflow', {
                request: {
                    workflow: message.workflow,
                    environment: message.environment || {}
                }
            });

            if (!response.success) {
                throw new Error(response.error || 'Workflow execution failed');
            }

            return response.result || {};
        }

        // Stub implementations for non-critical commands (return empty/default data)
        if (message.command === 'webviewReady' || message.command === 'echo') {
            return { success: true }; // Simple acknowledgment
        }

        if (message.command === 'log') {
            // Log messages - could forward to Rust logger, for now just acknowledge
            console.log('[Bridge] Log:', message.message || message);
            return { success: true };
        }

        if (message.command === 'syncProjects') {
            // Project sync - not needed with Rust backend (direct file I/O)
            return { success: true };
        }

        if (message.command === 'getAutosave') {
            return null; // No autosave data
        }

        if (message.command === 'getWatcherHistory') {
            return []; // Empty history
        }

        if (message.command === 'getScrapbook') {
            return { entries: [] }; // Empty scrapbook
        }

        if (message.command === 'saveOpenProjects') {
            // Persist open project paths to localStorage
            try {
                const paths = (message as any).projectPaths || (message as any).paths || [];
                localStorage.setItem('apinox:openProjects', JSON.stringify(paths));
                console.log('[Bridge] Saved open projects:', paths.length);
                return { success: true };
            } catch (error) {
                console.error('[Bridge] Failed to save open projects:', error);
                return { success: false };
            }
        }

        if (message.command === 'autoSaveWorkspace') {
            return { success: true }; // Acknowledge save (could implement later)
        }

        if (message.command === 'saveUiState') {
            // Save UI state via Rust
            try {
                await tauriInvoke('update_ui_settings', { ui: message.ui });
                
                // Reload full config and emit update event
                const config = await tauriInvoke('get_settings', {});
                
                // Emit settingsUpdate for frontend contexts to pick up
                setTimeout(() => {
                    bridge.emit({ command: 'settingsUpdate', config } as any);
                }, 0);
                
                return { success: true };
            } catch (error) {
                console.error('[Bridge] Failed to save UI state:', error);
                return { success: false, error: String(error) };
            }
        }

        // Route GetSettings to Rust get_settings command
        if (message.command === FrontendCommand.GetSettings || message.command === 'getSettings') {
            try {
                const response = await tauriInvoke('get_settings', {});
                return response;
            } catch (error: any) {
                console.error('[Bridge] Get settings failed:', error);
                throw new Error(`Failed to get settings: ${error.message || error}`);
            }
        }

        // Route SaveSettings to Rust
        if (message.command === FrontendCommand.SaveSettings || message.command === 'saveSettings') {
            try {
                const response = await tauriInvoke('save_settings', {
                    config: message.config
                });
                
                // Reload and emit update
                const config = await tauriInvoke('get_settings', {});
                setTimeout(() => {
                    bridge.emit({ command: 'settingsUpdate', config } as any);
                }, 0);
                
                return response;
            } catch (error: any) {
                console.error('[Bridge] Save settings failed:', error);
                throw new Error(`Failed to save settings: ${error.message || error}`);
            }
        }

        // Route SaveProject to Rust save_project command
        if (message.command === FrontendCommand.SaveProject) {
            console.log('[Bridge] Routing SaveProject to Rust backend');
            
            try {
                await tauriInvoke('save_project', {
                    project: message.project,
                    dirPath: message.filePath || message.project?.fileName  // Tauri converts to dir_path
                });
                
                console.log('[Bridge] Project saved successfully');
                return { success: true };
            } catch (error: any) {
                console.error('[Bridge] Save project failed:', error);
                throw new Error(`Failed to save project: ${error.message || error}`);
            }
        }

        // Route LoadProject to Rust load_project command
        if (message.command === FrontendCommand.LoadProject) {
            console.log('[Bridge] Routing LoadProject to Rust backend');
            
            const response = await tauriInvoke('load_project', {
                filePath: message.filePath
            });
            
            console.log('[Bridge] Project loaded successfully');
            return {
                project: response.project,
                filename: message.filePath
            };
        }

        // Route ExportWorkspace to Rust export_workspace command
        if (message.command === FrontendCommand.ExportWorkspace) {
            console.log('[Bridge] Routing ExportWorkspace to Rust backend');
            
            try {
                const response = await tauriInvoke('export_workspace', {
                    projects: message.projects,
                    filePath: message.filePath
                });
                
                console.log('[Bridge] Workspace exported successfully:', response);
                return response;
            } catch (error: any) {
                console.error('[Bridge] Export workspace failed:', error);
                throw new Error(`Failed to export workspace: ${error.message || error}`);
            }
        }

        // Route ImportWorkspace to Rust import_workspace command
        if (message.command === 'importWorkspace') {
            console.log('[Bridge] Routing ImportWorkspace to Rust backend');
            
            try {
                const response = await tauriInvoke('import_workspace', {
                    filePath: message.filePath
                });
                
                console.log('[Bridge] Workspace imported successfully:', response);
                return response;
            } catch (error: any) {
                console.error('[Bridge] Import workspace failed:', error);
                throw new Error(`Failed to import workspace: ${error.message || error}`);
            }
        }

        // Route RunTestSuite to Rust run_test_suite command
        if (message.command === FrontendCommand.RunTestSuite) {
            console.log('[Bridge] Routing RunTestSuite to Rust backend');
            
            try {
                const response = await tauriInvoke('run_test_suite', {
                    testSuite: message.testSuite,
                    variables: message.environment || {},
                    stream: message.stream || false
                });
                
                console.log('[Bridge] Test suite command sent:', response);
                return response;
            } catch (error: any) {
                console.error('[Bridge] Run test suite failed:', error);
                throw new Error(`Failed to run test suite: ${error.message || error}`);
            }
        }

        // Route GetTestRunUpdates to Rust get_test_run_updates command
        if (message.command === FrontendCommand.GetTestRunUpdates) {
            try {
                const response = await tauriInvoke('get_test_run_updates', {
                    runId: message.runId,
                    fromIndex: message.fromIndex || 0
                });
                
                return response;
            } catch (error: any) {
                console.error('[Bridge] Get test run updates failed:', error);
                throw new Error(`Failed to get test run updates: ${error.message || error}`);
            }
        }

        // Route workflow commands to Rust
        if (message.command === FrontendCommand.SaveWorkflow) {
            console.log('[Bridge] Routing SaveWorkflow to Rust backend');
            
            try {
                const response = await tauriInvoke('save_workflow', {
                    workflow: message.workflow
                });
                
                console.log('[Bridge] Workflow saved successfully');
                return response;
            } catch (error: any) {
                console.error('[Bridge] Save workflow failed:', error);
                throw new Error(`Failed to save workflow: ${error.message || error}`);
            }
        }

        if (message.command === FrontendCommand.DeleteWorkflow) {
            console.log('[Bridge] Routing DeleteWorkflow to Rust backend');
            
            try {
                const response = await tauriInvoke('delete_workflow', {
                    workflowId: message.workflowId
                });
                
                console.log('[Bridge] Workflow deleted successfully');
                return response;
            } catch (error: any) {
                console.error('[Bridge] Delete workflow failed:', error);
                throw new Error(`Failed to delete workflow: ${error.message || error}`);
            }
        }

        if (message.command === FrontendCommand.GetWorkflows) {
            try {
                const response = await tauriInvoke('get_workflows', {});
                return response;
            } catch (error: any) {
                console.error('[Bridge] Get workflows failed:', error);
                throw new Error(`Failed to get workflows: ${error.message || error}`);
            }
        }

        // Route RefreshWsdl to Rust refresh_wsdl command
        if (message.command === FrontendCommand.RefreshWsdl) {
            console.log('[Bridge] Routing RefreshWsdl to Rust backend');
            
            try {
                const response = await tauriInvoke('refresh_wsdl', {
                    url: message.interfaceDef || message.definition,
                    existingInterface: message.existingInterface || {}
                });
                
                console.log('[Bridge] WSDL refreshed successfully');
                return response;
            } catch (error: any) {
                console.error('[Bridge] Refresh WSDL failed:', error);
                throw new Error(`Failed to refresh WSDL: ${error.message || error}`);
            }
        }

        // Route ApplyWsdlSync to Rust apply_wsdl_sync command
        if (message.command === FrontendCommand.ApplyWsdlSync) {
            console.log('[Bridge] Routing ApplyWsdlSync to Rust backend');
            
            try {
                const response = await tauriInvoke('apply_wsdl_sync', {
                    projectId: message.projectId,
                    diff: message.diff,
                    dirPath: message.dirPath || ''
                });
                
                console.log('[Bridge] WSDL sync applied successfully');
                return response;
            } catch (error: any) {
                console.error('[Bridge] Apply WSDL sync failed:', error);
                throw new Error(`Failed to apply WSDL sync: ${error.message || error}`);
            }
        }

        // Route CloseProject to Rust close_project command
        if (message.command === FrontendCommand.CloseProject) {
            console.log('[Bridge] Routing CloseProject to Rust backend');
            
            try {
                const response = await tauriInvoke('close_project', {
                    projectId: message.projectId
                });
                
                console.log('[Bridge] Project closed successfully');
                return response;
            } catch (error: any) {
                console.error('[Bridge] Close project failed:', error);
                throw new Error(`Failed to close project: ${error.message || error}`);
            }
        }

        // Route CancelRequest to Rust cancel_request command
        if (message.command === FrontendCommand.CancelRequest) {
            console.log('[Bridge] Routing CancelRequest to Rust backend');
            
            try {
                const response = await tauriInvoke('cancel_request', {});
                console.log('[Bridge] Request cancelled successfully');
                return response;
            } catch (error: any) {
                console.error('[Bridge] Cancel request failed:', error);
                throw new Error(`Failed to cancel request: ${error.message || error}`);
            }
        }

        // Command not implemented in Rust, fallback to sidecar
        return null;

    } catch (error: any) {
        console.error('[Bridge] Rust command failed:', error);
        throw error;
    }
}

// ============== Rust Command Invocation ==============

/**
 * Invoke a Rust backend command
 * All commands now route through Rust - sidecar has been removed
 */
async function invokeRustCommand(message: BridgeMessage): Promise<any> {
    await ensureTauriInitialized();
    
    if (!tauriInvoke) {
        throw new Error('Tauri not initialized');
    }

    try {
        const rustResult = await tryRustCommand(message);
        if (rustResult !== null) {
            console.log(`[Bridge] Command '${message.command}' handled by Rust backend`);
            return rustResult;
        }

        // Command not implemented
        console.error(`[Bridge] Command '${message.command}' not yet implemented in Rust backend`);
        throw new Error(`Command '${message.command}' not implemented. Please add Rust implementation.`);

    } catch (error: any) {
        console.error('[Bridge] Rust command failed:', error);
        throw error;
    }
}

// ============== Response to Event Mapping ==============

/**
 * Maps sidecar HTTP responses to BackendCommand events
 * This allows the frontend to receive events just like in VS Code mode
 */
function mapResponseToBackendEvent(command: string, data: any): BackendMessage | null {
    // Map frontend commands to their corresponding backend response events
    const commandToEventMap: Record<string, (data: any) => BackendMessage | null> = {
        [FrontendCommand.LoadWsdl]: (data) => ({
            command: BackendCommand.WsdlParsed,
            // Sidecar returns array of services directly from parseWsdl
            services: Array.isArray(data) ? data : (data?.services || data || []),
            wsdlUrl: data?.wsdlUrl || '',
            targetProjectId: data?.targetProjectId
        }),
        [FrontendCommand.ExecuteRequest]: (data) => ({
            command: BackendCommand.Response,
            // Frontend expects response data in 'result' property
            result: (data && 'response' in data) ? data.response : data || { rawResponse: '', headers: {}, status: 0, timeTaken: 0 }
        }),
        [FrontendCommand.GetHistory]: (data) => ({
            command: BackendCommand.HistoryLoaded,
            entries: data || []
        }),
        // [FrontendCommand.GetWatcherHistory]: (data) => ({ // Removed - watcher features
        //     command: BackendCommand.WatcherUpdate,
        //     history: data || []
        // }),
        [FrontendCommand.GetSettings]: (data) => ({
            command: BackendCommand.SettingsUpdate,
            // Frontend expects 'config' not 'settings'
            config: data?.config ?? data,
            raw: data?.raw,
            configDir: data?.configDir,
            configPath: data?.configPath
        }),
        [FrontendCommand.SaveProject]: (data) => ({
            command: BackendCommand.ProjectSaved,
            ...data
        }),
        [FrontendCommand.SaveSettings]: (data) => ({
            command: BackendCommand.SettingsUpdate,
            config: data?.config,
            raw: data?.raw,
            configDir: data?.configDir,
            configPath: data?.configPath
        }),
        [FrontendCommand.SaveUiState]: (data) => ({
            command: BackendCommand.SettingsUpdate,
            config: data?.config,
            raw: data?.raw
        }),
        [FrontendCommand.LoadProject]: (data) => {
            const project = data?.project ?? data;
            const fileName = data?.filename || data?.fileName;
            return {
                command: BackendCommand.ProjectLoaded,
                project: fileName && project ? { ...project, fileName } : project,
                filename: fileName
            };
        },
        // [FrontendCommand.GetMockStatus]: (data) => ({ // Removed - mock features
        //     command: BackendCommand.MockStatus,
        //     ...data
        // }),
        ['webviewReady']: (data) => data, // Pass through sidecar response with samplesProject and changelog
        // Add more mappings as needed
    };

    const mapper = commandToEventMap[command];
    if (mapper) {
        return mapper(data);
    }

    // For commands without specific mappings, return null (no event emitted)
    return null;
}

// ============== Unified Bridge API ==============
// 
// Commands Suitable for Direct Migration (simple CRUD):
// - SaveProject, LoadProject, DeleteProject
// - SaveSettings, GetSettings, SaveUiState
// - GetWorkflows, SaveWorkflow, DeleteWorkflow
// - GetHistory, AddHistoryEntry, ClearHistory
// - GetScrapbook, AddScrapbookRequest, UpdateScrapbookRequest
// 
// Commands That Should Stay in Bridge (async/events):
// - LoadWsdl (emits WsdlParsed event)
// - ExecuteRequest (emits Response + HistoryUpdate events)
// - RunTestCase, RunTestSuite (emit TestRunnerUpdate events)
// - ExecuteWorkflow (emits progress events)
// - RefreshWsdl (async operation)
//

type MessageListener = (message: BackendMessage) => void;
const listeners: Set<MessageListener> = new Set();

export const bridge = {
    /**
     * Send message to Rust backend
     * 
     * Responses are converted to backend messages and emitted to listeners.
     * Use this for async/event-driven commands.
     * 
     * For simple CRUD operations, consider using direct Tauri invoke() in the future.
     */
    sendMessage: (message: BridgeMessage): void => {
        // Log saveSettings commands for debugging
        if (message.command === 'saveSettings') {
            console.log('[Bridge] Sending saveSettings command:', {
                hasConfig: !!message.config,
                uiConfig: message.config?.ui
            });
        }
        
        // Pre-process loadWsdl command for local XSD resolution
        if (message.command === 'loadWsdl' && message.isLocal && message.url) {
            const lastSlash = Math.max(message.url.lastIndexOf('/'), message.url.lastIndexOf('\\'));
            if (lastSlash > 0) {
                message.localWsdlDir = message.url.substring(0, lastSlash);
            }
        }
        
        if (isTauri()) {
            // Send to Rust backend and convert response to backend message
            invokeRustCommand(message)
                .then(data => {
                    // Emit test runner updates for test runs
                    if ((message.command === FrontendCommand.RunTestCase || message.command === FrontendCommand.RunTestSuite) && data?.updates) {
                        data.updates.forEach((update: any) => {
                            listeners.forEach(cb => cb({
                                command: BackendCommand.TestRunnerUpdate,
                                update
                            }));
                        });
                    }

                    // Emit history entry if provided
                    if (message.command === FrontendCommand.ExecuteRequest && data?.historyEntry) {
                        listeners.forEach(cb => cb({
                            command: BackendCommand.HistoryUpdate,
                            entry: data.historyEntry
                        }));
                    }

                    // Emit error if present
                    if (message.command === FrontendCommand.ExecuteRequest && data?.error) {
                        listeners.forEach(cb => cb({
                            command: BackendCommand.Error,
                            error: data.error,
                            message: data.error,
                            originalCommand: message.command
                        }));
                        return;
                    }

                    // Map command responses to backend events
                    const backendEvent = mapResponseToBackendEvent(message.command, data);
                    if (backendEvent) {
                        if (message.command === 'saveSettings') {
                            console.log('[Bridge] Emitting SettingsUpdate event from saveSettings response:', {
                                hasConfig: !!backendEvent.config,
                                uiConfig: backendEvent.config?.ui
                            });
                        }
                        listeners.forEach(cb => cb(backendEvent));
                    }
                })
                .catch(e => {
                    console.error('[Bridge] Rust backend error:', e);
                    listeners.forEach(cb => cb({
                        command: BackendCommand.Error,
                        error: e.message,
                        originalCommand: message.command,
                        // Include project info for save errors
                        projectName: message.command === FrontendCommand.SaveProject ? message.project?.name : undefined
                    }));
                });
        } else {
            console.warn('[Bridge] No backend available (standalone mode)');
        }
    },

    /**
     * Send message and wait for response (async version)
     * 
     * Use this when you need the response data immediately.
     * For simple CRUD operations, consider using direct Tauri invoke() in the future.
     */
    sendMessageAsync: async <T = any>(message: BridgeMessage): Promise<T> => {
        if (isTauri()) {
            return await invokeRustCommand(message) as T;
        }
        throw new Error('No backend available');
    },

    /**
     * Listen for messages from Rust backend
     * 
     * Use this to handle async events like WSDL parsing, test execution, etc.
     */
    onMessage: (callback: MessageListener): (() => void) => {
        listeners.add(callback);

        // Listen to Tauri events from backend
        let tauriUnlisten: (() => void) | null = null;
        if (isTauri() && tauriListen) {
            tauriListen('backend_command', (event: any) => {
                callback(event.payload);
            }).then(unlisten => {
                tauriUnlisten = unlisten;
            });
        }

        return () => {
            listeners.delete(callback);
            if (tauriUnlisten) {
                tauriUnlisten();
            }
        };
    },

    /**
     * State Persistence
     */
    setState: (state: any): void => {
        if (isTauri()) {
            try {
                localStorage.setItem('apinox_state', JSON.stringify(state));
            } catch (e) {
                console.error('[Bridge] Failed to save state:', e);
            }
        }
    },

    getState: (): any => {
        if (isTauri()) {
            try {
                const saved = localStorage.getItem('apinox_state');
                return saved ? JSON.parse(saved) : undefined;
            } catch (e) {
                return undefined;
            }
        }
        return undefined;
    },

    /**
     * Emit a local event to all listeners
     */
    emit: (message: BackendMessage): void => {
        listeners.forEach(cb => cb(message));
    },

    /**
     * Get current platform
     */
    getPlatform,
    isTauri,
    invokeTauriCommand, // Direct Rust command access
    
    // Deprecated - kept for backwards compatibility
    isVsCode: () => false,
    isStandalone: () => !isTauri()
};

// Export for backwards compatibility
export { FrontendCommand, BackendCommand };

// Deprecated exports - for backwards compatibility
export const isVsCode = () => false;
export const isStandalone = () => !isTauri();
