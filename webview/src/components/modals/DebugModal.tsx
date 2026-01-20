/**
 * DebugModal.tsx
 * 
 * Debug and diagnostics modal for APInox.
 * Shows sidecar logs, frontend logs, system debug information, and connection testing.
 * Opens with Ctrl+Shift+D keyboard shortcut.
 */

import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { useTheme } from '../../contexts/ThemeContext';
import { bridge } from '../../utils/bridge';

interface DebugModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Frontend console log capture
const frontendLogs: Array<{ timestamp: number; level: string; message: string }> = [];
const MAX_FRONTEND_LOGS = 100;

// Intercept console methods
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

const captureLog = (level: string, ...args: any[]) => {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    frontendLogs.push({
        timestamp: Date.now(),
        level,
        message
    });
    
    // Keep only the last MAX_FRONTEND_LOGS entries
    if (frontendLogs.length > MAX_FRONTEND_LOGS) {
        frontendLogs.shift();
    }
};

console.log = (...args: any[]) => {
    captureLog('log', ...args);
    originalConsoleLog.apply(console, args);
};

console.warn = (...args: any[]) => {
    captureLog('warn', ...args);
    originalConsoleWarn.apply(console, args);
};

console.error = (...args: any[]) => {
    captureLog('error', ...args);
    originalConsoleError.apply(console, args);
};

export const DebugModal: React.FC<DebugModalProps> = ({ isOpen, onClose }) => {
    const { isTauriMode } = useTheme();

    // Debug screen state
    const [sidecarLogs, setSidecarLogs] = useState<string[]>([]);
    const [frontendLogState, setFrontendLogState] = useState<Array<{ timestamp: number; level: string; message: string }>>([]);
    const [settingsDebug, setSettingsDebug] = useState<any>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [showSidecarLogs, setShowSidecarLogs] = useState(true);
    const [showFrontendLogs, setShowFrontendLogs] = useState(true);
    const [showDebugInfo, setShowDebugInfo] = useState(false);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [debugIndicatorVisible, setDebugIndicatorVisible] = useState(false);
    const [connectionTest, setConnectionTest] = useState<{ status: string; message: string } | null>(null);

    // Load logs and debug info when modal opens in Tauri mode
    useEffect(() => {
        if (!isOpen || !isTauriMode) return;

        const loadLogsAndDebugInfo = async () => {
            try {
                setIsLoadingLogs(true);
                
                // Load sidecar logs
                const logsResponse = await bridge.sendMessageAsync({ command: 'getSidecarLogs', count: 100 });
                if (logsResponse.logs) {
                    setSidecarLogs(logsResponse.logs);
                }

                // Update frontend logs state
                setFrontendLogState([...frontendLogs]);

                // Load debug info
                const debugResponse = await bridge.sendMessageAsync({ command: 'getDebugInfo' });
                if (debugResponse.debugInfo) {
                    setSettingsDebug(debugResponse.debugInfo);
                }

                setFetchError(null);
            } catch (error: any) {
                setFetchError(error.message || 'Failed to load debug information');
                console.error('[DebugModal] Failed to load debug info:', error);
            } finally {
                setIsLoadingLogs(false);
            }
        };

        loadLogsAndDebugInfo();

        // Set up polling interval for real-time updates (every 5 seconds)
        const interval = setInterval(loadLogsAndDebugInfo, 5000);
        return () => clearInterval(interval);
    }, [isOpen, isTauriMode]);

    // Check debug indicator visibility on mount
    useEffect(() => {
        if (!isOpen) return;
        
        const indicator = document.getElementById('debug-indicator');
        if (indicator) {
            const isVisible = indicator.style.display !== 'none';
            setDebugIndicatorVisible(isVisible);
        }
    }, [isOpen]);

    // Clear sidecar logs handler
    const clearSidecarLogs = async () => {
        try {
            await bridge.sendMessageAsync({ command: 'clearSidecarLogs' });
            setSidecarLogs([]);
            setFetchError(null);
        } catch (error: any) {
            setFetchError(error.message || 'Failed to clear logs');
            console.error('[DebugModal] Failed to clear logs:', error);
        }
    };

    // Clear frontend logs handler
    const clearFrontendLogs = () => {
        frontendLogs.length = 0;
        setFrontendLogState([]);
    };

    // Toggle debug indicator
    const toggleDebugIndicator = () => {
        const indicator = document.getElementById('debug-indicator');
        if (indicator) {
            const newVisibility = !debugIndicatorVisible;
            indicator.style.display = newVisibility ? 'block' : 'none';
            setDebugIndicatorVisible(newVisibility);
        }
    };

    // Test connection between frontend and backend
    const testConnection = async () => {
        try {
            setConnectionTest({ status: 'testing', message: 'Testing connection...' });
            const startTime = Date.now();
            
            // Send a test command
            const response = await bridge.sendMessageAsync({ command: 'getDebugInfo' });
            const duration = Date.now() - startTime;
            
            if (response.debugInfo) {
                setConnectionTest({
                    status: 'success',
                    message: `✓ Connection successful (${duration}ms)\nMode: ${response.debugInfo.mode || response.debugInfo.sidecar ? 'Tauri/Sidecar' : 'Unknown'}`
                });
            } else {
                setConnectionTest({
                    status: 'error',
                    message: '✗ No response data received'
                });
            }
        } catch (error: any) {
            setConnectionTest({
                status: 'error',
                message: `✗ Connection failed: ${error.message}`
            });
        }
    };

    if (!isTauriMode) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Debug & Diagnostics" width={800}>
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--vscode-descriptionForeground)' }}>
                    Debug diagnostics are only available in Tauri standalone mode.
                </div>
            </Modal>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Debug & Diagnostics" width={900}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Debug Controls */}
                <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>Debug Controls</div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button
                            onClick={toggleDebugIndicator}
                            style={{
                                padding: '6px 12px',
                                fontSize: '0.9em',
                                background: debugIndicatorVisible ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
                                color: debugIndicatorVisible ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
                                border: '1px solid var(--vscode-panel-border)',
                                cursor: 'pointer',
                                borderRadius: '3px',
                            }}
                        >
                            {debugIndicatorVisible ? '👁️ Hide' : '👁️‍🗨️ Show'} Debug Indicator
                        </button>
                        <button
                            onClick={testConnection}
                            style={{
                                padding: '6px 12px',
                                fontSize: '0.9em',
                                background: 'var(--vscode-button-background)',
                                color: 'var(--vscode-button-foreground)',
                                border: '1px solid var(--vscode-panel-border)',
                                cursor: 'pointer',
                                borderRadius: '3px',
                            }}
                            disabled={connectionTest?.status === 'testing'}
                        >
                            {connectionTest?.status === 'testing' ? '⏳ Testing...' : '🔌 Test Connection'}
                        </button>
                    </div>

                    {connectionTest && (
                        <div style={{
                            marginTop: '8px',
                            padding: '8px 12px',
                            background: connectionTest.status === 'success' 
                                ? 'var(--vscode-testing-iconPassed)' 
                                : connectionTest.status === 'error'
                                ? 'var(--vscode-inputValidation-errorBackground)'
                                : 'var(--vscode-badge-background)',
                            border: '1px solid var(--vscode-panel-border)',
                            borderRadius: '3px',
                            fontSize: '0.9em',
                            whiteSpace: 'pre-line',
                            color: 'var(--vscode-editor-foreground)',
                        }}>
                            {connectionTest.message}
                        </div>
                    )}
                </div>

                {/* Error Display */}
                {fetchError && (
                    <div style={{
                        padding: '8px 12px',
                        background: 'var(--vscode-inputValidation-errorBackground)',
                        border: '1px solid var(--vscode-inputValidation-errorBorder)',
                        color: 'var(--vscode-inputValidation-errorForeground)',
                        borderRadius: '3px',
                        fontSize: '0.9em',
                    }}>
                        ⚠️ {fetchError}
                    </div>
                )}

                {/* Sidecar Console Logs */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontWeight: 'bold' }}>Sidecar Logs (Node.js Backend)</div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {isLoadingLogs && (
                                <span style={{ fontSize: '0.85em', color: 'var(--vscode-descriptionForeground)' }}>
                                    Loading...
                                </span>
                            )}
                            <span style={{ fontSize: '0.85em', color: 'var(--vscode-descriptionForeground)' }}>
                                {sidecarLogs.length} {sidecarLogs.length === 1 ? 'entry' : 'entries'}
                            </span>
                            <button
                                onClick={clearSidecarLogs}
                                disabled={sidecarLogs.length === 0}
                                style={{
                                    padding: '4px 12px',
                                    fontSize: '0.9em',
                                    cursor: sidecarLogs.length === 0 ? 'not-allowed' : 'pointer',
                                    opacity: sidecarLogs.length === 0 ? 0.5 : 1,
                                }}
                            >
                                Clear
                            </button>
                            <button
                                onClick={() => setShowSidecarLogs(!showSidecarLogs)}
                                style={{
                                    padding: '4px 12px',
                                    fontSize: '0.9em',
                                }}
                            >
                                {showSidecarLogs ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    {showSidecarLogs && (
                        <div style={{
                            maxHeight: '300px',
                            overflowY: 'auto',
                            background: 'var(--vscode-editor-background)',
                            border: '1px solid var(--vscode-panel-border)',
                            padding: '8px',
                            fontFamily: 'var(--vscode-editor-font-family, monospace)',
                            fontSize: '0.85em',
                            lineHeight: '1.4',
                            borderRadius: '3px',
                        }}>
                            {sidecarLogs.length === 0 ? (
                                <div style={{
                                    color: 'var(--vscode-descriptionForeground)',
                                    textAlign: 'center',
                                    padding: '20px',
                                    fontStyle: 'italic',
                                }}>
                                    No logs available
                                </div>
                            ) : (
                                sidecarLogs.map((log, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            marginBottom: 4,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            color: log.includes('[ERROR]') || log.includes('Error') ? 'var(--vscode-errorForeground)' :
                                                log.includes('[WARN]') || log.includes('Warning') ? 'var(--vscode-editorWarning-foreground)' :
                                                    'var(--vscode-editor-foreground)',
                                        }}
                                    >
                                        {log}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Frontend Console Logs */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontWeight: 'bold' }}>Frontend Logs (React/Browser)</div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85em', color: 'var(--vscode-descriptionForeground)' }}>
                                {frontendLogState.length} {frontendLogState.length === 1 ? 'entry' : 'entries'}
                            </span>
                            <button
                                onClick={clearFrontendLogs}
                                disabled={frontendLogState.length === 0}
                                style={{
                                    padding: '4px 12px',
                                    fontSize: '0.9em',
                                    cursor: frontendLogState.length === 0 ? 'not-allowed' : 'pointer',
                                    opacity: frontendLogState.length === 0 ? 0.5 : 1,
                                }}
                            >
                                Clear
                            </button>
                            <button
                                onClick={() => setShowFrontendLogs(!showFrontendLogs)}
                                style={{
                                    padding: '4px 12px',
                                    fontSize: '0.9em',
                                }}
                            >
                                {showFrontendLogs ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    {showFrontendLogs && (
                        <div style={{
                            maxHeight: '300px',
                            overflowY: 'auto',
                            background: 'var(--vscode-editor-background)',
                            border: '1px solid var(--vscode-panel-border)',
                            padding: '8px',
                            fontFamily: 'var(--vscode-editor-font-family, monospace)',
                            fontSize: '0.85em',
                            lineHeight: '1.4',
                            borderRadius: '3px',
                        }}>
                            {frontendLogState.length === 0 ? (
                                <div style={{
                                    color: 'var(--vscode-descriptionForeground)',
                                    textAlign: 'center',
                                    padding: '20px',
                                    fontStyle: 'italic',
                                }}>
                                    No logs captured yet
                                </div>
                            ) : (
                                frontendLogState.map((log, i) => {
                                    const timestamp = new Date(log.timestamp).toLocaleTimeString();
                                    return (
                                        <div
                                            key={i}
                                            style={{
                                                marginBottom: 4,
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                                color: log.level === 'error' ? 'var(--vscode-errorForeground)' :
                                                    log.level === 'warn' ? 'var(--vscode-editorWarning-foreground)' :
                                                        'var(--vscode-editor-foreground)',
                                            }}
                                        >
                                            <span style={{ opacity: 0.6 }}>[{timestamp}]</span> [{log.level.toUpperCase()}] {log.message}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* Settings Debug Information */}
                {settingsDebug && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontWeight: 'bold' }}>System Debug Information</div>
                            <button
                                onClick={() => setShowDebugInfo(!showDebugInfo)}
                                style={{
                                    padding: '4px 12px',
                                    fontSize: '0.9em',
                                }}
                            >
                                {showDebugInfo ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        
                        {showDebugInfo && (
                            <div style={{
                                background: 'var(--vscode-editor-background)',
                                border: '1px solid var(--vscode-panel-border)',
                                padding: '12px',
                                fontFamily: 'var(--vscode-editor-font-family, monospace)',
                                fontSize: '0.8em',
                                whiteSpace: 'pre-wrap',
                                overflowX: 'auto',
                                maxHeight: '400px',
                                overflowY: 'auto',
                                borderRadius: '3px',
                                lineHeight: '1.5',
                            }}>
                                {JSON.stringify(settingsDebug, null, 2)}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};
