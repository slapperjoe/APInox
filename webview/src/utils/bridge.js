/**
 * Platform Bridge
 *
 * Provides unified communication between the webview and the backend,
 * supporting both VS Code extension host and Tauri sidecar.
 */
// ============== Environment Detection ==============
export const isVsCode = () => typeof window !== 'undefined' && !!window.acquireVsCodeApi;
export const isTauri = () => typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);
export const isStandalone = () => !isVsCode() && !isTauri();
export const getPlatform = () => {
    if (isVsCode())
        return 'vscode';
    if (isTauri())
        return 'tauri';
    return 'standalone';
};
// ============== VS Code API ==============
let vscodeApi = null;
if (isVsCode() && !vscodeApi) {
    vscodeApi = window.acquireVsCodeApi();
}
// ============== Tauri Imports (lazy loaded) ==============
let tauriInvoke = null;
let tauriListen = null;
let sidecarPort = null;
async function initTauri() {
    if (!isTauri())
        return;
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { listen } = await import('@tauri-apps/api/event');
        tauriInvoke = invoke;
        tauriListen = listen;
        // Get sidecar port from Rust backend
        sidecarPort = await invoke('get_sidecar_port');
    }
    catch (e) {
        console.error('[Bridge] Failed to initialize Tauri:', e);
    }
}
// Initialize Tauri on load
if (isTauri()) {
    initTauri();
}
// ============== Message Types ==============
import { FrontendCommand, BackendCommand } from '@shared/messages';
// ============== Sidecar HTTP Client (for Tauri) ==============
async function sendToSidecar(message) {
    if (!sidecarPort) {
        // Try to get port again
        if (tauriInvoke) {
            sidecarPort = await tauriInvoke('get_sidecar_port');
        }
        if (!sidecarPort) {
            throw new Error('Sidecar not ready');
        }
    }
    const response = await fetch(`http://127.0.0.1:${sidecarPort}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            command: message.command,
            payload: message
        })
    });
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || 'Sidecar command failed');
    }
    return result.data;
}
// ============== Response to Event Mapping ==============
/**
 * Maps sidecar HTTP responses to BackendCommand events
 * This allows the frontend to receive events just like in VS Code mode
 */
function mapResponseToBackendEvent(command, data) {
    // Map frontend commands to their corresponding backend response events
    const commandToEventMap = {
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
            result: data || { rawResponse: '', headers: {}, status: 0, timeTaken: 0 }
        }),
        [FrontendCommand.GetHistory]: (data) => ({
            command: BackendCommand.HistoryLoaded,
            entries: data || []
        }),
        [FrontendCommand.GetSettings]: (data) => ({
            command: BackendCommand.SettingsUpdate,
            // Frontend expects 'config' not 'settings'
            config: data
        }),
        [FrontendCommand.SaveProject]: (data) => ({
            command: BackendCommand.ProjectSaved,
            ...data
        }),
        [FrontendCommand.LoadProject]: (data) => ({
            command: BackendCommand.ProjectLoaded,
            project: data
        }),
        [FrontendCommand.GetMockStatus]: (data) => ({
            command: BackendCommand.MockStatus,
            ...data
        }),
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
const listeners = new Set();
export const bridge = {
    /**
     * Send message to Backend (VS Code extension or Tauri sidecar)
     * In Tauri mode, responses are converted to backend messages for listeners
     */
    sendMessage: (message) => {
        if (isVsCode() && vscodeApi) {
            vscodeApi.postMessage(message);
        }
        else if (isTauri()) {
            // Send to sidecar and convert response to backend message
            sendToSidecar(message)
                .then(data => {
                // Map command responses to backend events
                const backendEvent = mapResponseToBackendEvent(message.command, data);
                if (backendEvent) {
                    // Emit to all listeners
                    listeners.forEach(cb => cb(backendEvent));
                }
            })
                .catch(e => {
                console.error('[Bridge] Sidecar error:', e);
                // Emit error to listeners
                listeners.forEach(cb => cb({
                    command: BackendCommand.Error,
                    error: e.message,
                    originalCommand: message.command
                }));
            });
        }
        else {
            console.warn('[Bridge] No backend available (standalone mode)');
        }
    },
    /**
     * Send message and wait for response (Tauri only, VS Code uses events)
     */
    sendMessageAsync: async (message) => {
        if (isTauri()) {
            return await sendToSidecar(message);
        }
        else if (isVsCode() && vscodeApi) {
            // VS Code doesn't have request/response, use postMessage
            vscodeApi.postMessage(message);
            return undefined;
        }
        throw new Error('No backend available');
    },
    /**
     * Listen for messages from Backend
     */
    onMessage: (callback) => {
        listeners.add(callback);
        // VS Code: listen to window messages
        const vsCodeHandler = (event) => {
            const message = event.data;
            if (message && message.command) {
                callback(message);
            }
        };
        if (isVsCode()) {
            window.addEventListener('message', vsCodeHandler);
        }
        // Tauri: listen to events from backend
        let tauriUnlisten = null;
        if (isTauri() && tauriListen) {
            tauriListen('backend_command', (event) => {
                callback(event.payload);
            }).then(unlisten => {
                tauriUnlisten = unlisten;
            });
        }
        return () => {
            listeners.delete(callback);
            if (isVsCode()) {
                window.removeEventListener('message', vsCodeHandler);
            }
            if (tauriUnlisten) {
                tauriUnlisten();
            }
        };
    },
    /**
     * State Persistence
     */
    setState: (state) => {
        if (isVsCode() && vscodeApi) {
            vscodeApi.setState(state);
        }
        else if (isTauri()) {
            // Use localStorage for Tauri
            try {
                localStorage.setItem('apinox_state', JSON.stringify(state));
            }
            catch (e) {
                console.error('[Bridge] Failed to save state:', e);
            }
        }
    },
    getState: () => {
        if (isVsCode() && vscodeApi) {
            return vscodeApi.getState();
        }
        else if (isTauri()) {
            try {
                const saved = localStorage.getItem('apinox_state');
                return saved ? JSON.parse(saved) : undefined;
            }
            catch (e) {
                return undefined;
            }
        }
        return undefined;
    },
    /**
     * Emit a local event to all listeners (simulating a backend event)
     */
    emit: (message) => {
        listeners.forEach(cb => cb(message));
    },
    /**
     * Get current platform
     */
    getPlatform,
    isVsCode,
    isTauri,
    isStandalone
};
// Export for backwards compatibility
export { FrontendCommand, BackendCommand };
