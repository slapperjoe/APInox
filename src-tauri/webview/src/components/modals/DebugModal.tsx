/**
 * DebugModal.tsx
 * 
 * Debug and diagnostics modal for APInox.
 * Shows Tauri backend logs, frontend logs, system debug information, and connection testing.
 * Opens with Ctrl+Shift+D keyboard shortcut.
 */

import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { useTheme } from '@apinox/request-editor'; // Use package ThemeContext
import { bridge } from '../../utils/bridge';
import { DiagnosticsTab } from './DiagnosticsTab';

interface DebugModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Frontend console log capture
const frontendLogs: Array<{ timestamp: number; level: string; message: string }> = [];
const MAX_FRONTEND_LOGS = 2000;

// Intercept console methods
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

const captureLog = (level: string, ...args: any[]) => {
    const message = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
            try {
                // Try to stringify, but catch circular reference errors
                return JSON.stringify(arg);
            } catch (e) {
                // If circular reference, use a fallback representation
                if (arg instanceof Error) {
                    return `Error: ${arg.message}`;
                }
                if (typeof arg.toString === 'function' && arg.toString !== Object.prototype.toString) {
                    return arg.toString();
                }
                return '[Circular or Complex Object]';
            }
        }
        return String(arg);
    }).join(' ');
    
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
    const { isStandalone } = useTheme();

    // Tab state
    const [activeTab, setActiveTab] = useState<'logs' | 'diagnostics'>('logs');

    // Debug screen state
    const [tauriLogs, setTauriLogs] = useState<string[]>([]);
    const [frontendLogState, setFrontendLogState] = useState<Array<{ timestamp: number; level: string; message: string }>>([]);
    const [settingsDebug, setSettingsDebug] = useState<any>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [showTauriLogs, setShowTauriLogs] = useState(false);
    const [showFrontendLogs, setShowFrontendLogs] = useState(false);
    const [showSystemInfo, setShowSystemInfo] = useState(true); // Start expanded
    const [showDebugInfo, setShowDebugInfo] = useState(false);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [debugIndicatorVisible, setDebugIndicatorVisible] = useState(false);
    const [connectionTest, setConnectionTest] = useState<{ status: string; message: string } | null>(null);
    const [copyStatus, setCopyStatus] = useState<string | null>(null);
    
    // Tauri-specific state
    const [configDir, setConfigDir] = useState<string | null>(null);

    // Refs for auto-scrolling log containers
    const tauriLogsRef = React.useRef<HTMLDivElement>(null);
    const frontendLogsRef = React.useRef<HTMLDivElement>(null);

    // Helper function to close all accordions
    const closeAllAccordions = () => {
        setShowTauriLogs(false);
        setShowFrontendLogs(false);
        setShowSystemInfo(false);
        setShowDebugInfo(false);
    };

    // Helper function to toggle accordion (closes others)
    const toggleAccordion = (section: 'tauri' | 'frontend' | 'system' | 'debug') => {
        if (section === 'tauri') {
            const wasOpen = showTauriLogs;
            closeAllAccordions();
            setShowTauriLogs(!wasOpen);
        } else if (section === 'frontend') {
            const wasOpen = showFrontendLogs;
            closeAllAccordions();
            setShowFrontendLogs(!wasOpen);
        } else if (section === 'system') {
            const wasOpen = showSystemInfo;
            closeAllAccordions();
            setShowSystemInfo(!wasOpen);
        } else if (section === 'debug') {
            const wasOpen = showDebugInfo;
            closeAllAccordions();
            setShowDebugInfo(!wasOpen);
        }
    };

    // Auto-scroll Tauri logs to bottom when opened
    React.useEffect(() => {
        if (showTauriLogs && tauriLogsRef.current) {
            setTimeout(() => {
                if (tauriLogsRef.current) {
                    tauriLogsRef.current.scrollTop = tauriLogsRef.current.scrollHeight;
                }
            }, 0);
        }
    }, [showTauriLogs]);

    // Auto-scroll frontend logs to bottom when opened
    React.useEffect(() => {
        if (showFrontendLogs && frontendLogsRef.current) {
            setTimeout(() => {
                if (frontendLogsRef.current) {
                    frontendLogsRef.current.scrollTop = frontendLogsRef.current.scrollHeight;
                }
            }, 0);
        }
    }, [showFrontendLogs]);

    // Load logs and debug info when modal opens in Tauri mode
    useEffect(() => {
        if (!isOpen || !isStandalone) return;

        const loadLogsAndDebugInfo = async () => {
            try {
                setIsLoadingLogs(true);
                
                // Load Tauri-specific information
                const { invoke } = await import('@tauri-apps/api/core');
                const dir = await invoke<string | null>('get_config_dir');
                setConfigDir(dir);
                
                // Load Tauri logs from the log file
                try {
                    const logs = await invoke<string[]>('get_tauri_logs', { lines: 2000 });
                    setTauriLogs(logs);
                } catch (e) {
                    console.warn('[DebugModal] Failed to get logs:', e);
                    setTauriLogs(['Unable to retrieve logs: ' + String(e)]);
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

        // Only poll if explicitly requested (don't auto-poll to avoid UI freezing)
        // User can manually refresh if needed
    }, [isOpen, isStandalone]);

    // Check debug indicator visibility on mount
    useEffect(() => {
        if (!isOpen) return;
        
        const indicator = document.getElementById('debug-indicator');
        if (indicator) {
            const isVisible = indicator.style.display !== 'none';
            setDebugIndicatorVisible(isVisible);
        }
    }, [isOpen]);

    // Clear Tauri logs handler
    const clearTauriLogs = async () => {
        try {
            await bridge.sendMessageAsync({ command: 'clearSidecarLogs' });
            setTauriLogs([]);
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
                    message: `✓ Connection successful (${duration}ms)\nMode: ${response.debugInfo.mode || 'Tauri'}`
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

    // Copy all diagnostics to clipboard
    const copyAllDiagnostics = async () => {
        try {
            setCopyStatus('Copying...');
            
            // Format all diagnostic information
            const lines: string[] = [];
            lines.push('=== APInox Diagnostic Information ===');
            lines.push(`Timestamp: ${new Date().toISOString()}`);
            lines.push('');
            
            // System Information
            lines.push('--- System Information ---');
            if (configDir) lines.push(`Settings Location: ${configDir}`);
            
            // Tauri Logs (last 1000 lines)
            if (tauriLogs.length > 0) {
                lines.push('');
                lines.push('--- Recent Logs (last 1000 lines) ---');
                const recentLogs = tauriLogs.slice(-1000);
                recentLogs.forEach(log => lines.push(log));
            }
            
            // Frontend Logs (last 1000 lines)
            if (frontendLogState.length > 0) {
                lines.push('');
                lines.push('--- Recent Frontend Logs (last 1000) ---');
                const recentFrontend = frontendLogState.slice(-1000);
                recentFrontend.forEach(log => {
                    const time = new Date(log.timestamp).toISOString();
                    lines.push(`[${time}] [${log.level.toUpperCase()}] ${log.message}`);
                });
            }
            
            const diagnosticText = lines.join('\n');
            
            // Copy to clipboard using Tauri clipboard plugin
            const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
            await writeText(diagnosticText);
            
            setCopyStatus('✓ Copied!');
            setTimeout(() => setCopyStatus(null), 2000);
        } catch (error: any) {
            console.error('[DebugModal] Failed to copy diagnostics:', error);
            setCopyStatus('✗ Failed to copy');
            setTimeout(() => setCopyStatus(null), 2000);
        }
    };

    if (!isStandalone) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Debug & Diagnostics" width={800}>
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--apinox-descriptionForeground)' }}>
                    Debug diagnostics are only available in Tauri standalone mode.
                </div>
            </Modal>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Debug & Diagnostics" width={900}>
            {/* Tab Navigation */}
            <div style={{ 
                display: 'flex', 
                borderBottom: '1px solid var(--apinox-panel-border)',
                marginBottom: '20px'
            }}>
                <button
                    onClick={() => setActiveTab('logs')}
                    style={{
                        padding: '10px 20px',
                        background: activeTab === 'logs' ? 'var(--apinox-tab-activeBackground)' : 'transparent',
                        color: activeTab === 'logs' ? 'var(--apinox-tab-activeForeground)' : 'var(--apinox-tab-inactiveForeground)',
                        border: 'none',
                        borderBottom: activeTab === 'logs' ? '2px solid var(--apinox-focusBorder)' : '2px solid transparent',
                        cursor: 'pointer',
                        fontSize: '0.95em',
                        fontWeight: activeTab === 'logs' ? 600 : 400
                    }}
                >
                    📋 Logs & System Info
                </button>
                <button
                    onClick={() => setActiveTab('diagnostics')}
                    style={{
                        padding: '10px 20px',
                        background: activeTab === 'diagnostics' ? 'var(--apinox-tab-activeBackground)' : 'transparent',
                        color: activeTab === 'diagnostics' ? 'var(--apinox-tab-activeForeground)' : 'var(--apinox-tab-inactiveForeground)',
                        border: 'none',
                        borderBottom: activeTab === 'diagnostics' ? '2px solid var(--apinox-focusBorder)' : '2px solid transparent',
                        cursor: 'pointer',
                        fontSize: '0.95em',
                        fontWeight: activeTab === 'diagnostics' ? 600 : 400
                    }}
                >
                    🔧 Certificate & Proxy
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'diagnostics' ? (
                <DiagnosticsTab />
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                            onClick={toggleDebugIndicator}
                            style={{
                                padding: '8px 16px',
                                fontSize: '0.9em',
                                background: debugIndicatorVisible ? 'var(--apinox-button-background)' : 'var(--apinox-button-secondaryBackground)',
                                color: debugIndicatorVisible ? 'var(--apinox-button-foreground)' : 'var(--apinox-button-secondaryForeground)',
                                border: '1px solid var(--apinox-button-border)',
                                cursor: 'pointer',
                                borderRadius: '2px',
                            }}
                        >
                            {debugIndicatorVisible ? '👁️ Hide' : '👁️‍🗨️ Show'} Debug Indicator
                        </button>
                        <button
                            onClick={testConnection}
                            style={{
                                padding: '8px 16px',
                                fontSize: '0.9em',
                                background: 'var(--apinox-button-background)',
                                color: 'var(--apinox-button-foreground)',
                                border: '1px solid var(--apinox-button-border)',
                                cursor: 'pointer',
                                borderRadius: '2px',
                            }}
                            disabled={connectionTest?.status === 'testing'}
                        >
                            {connectionTest?.status === 'testing' ? '⏳ Testing...' : '🔌 Test Connection'}
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={async () => {
                                setIsLoadingLogs(true);
                                try {
                                    const { invoke } = await import('@tauri-apps/api/core');
                                    // Always read from the actual log file for consistency with file contents
                                    const tauriLogs = await invoke<string[]>('get_tauri_logs', { lines: 2000 });
                                    setSidecarLogs(tauriLogs);
                                } catch (e) {
                                    console.error('[DebugModal] Failed to refresh logs:', e);
                                } finally {
                                    setIsLoadingLogs(false);
                                }
                            }}
                            disabled={isLoadingLogs}
                            style={{
                                padding: '8px 16px',
                                background: 'var(--apinox-button-secondaryBackground)',
                                color: 'var(--apinox-button-secondaryForeground)',
                                border: '1px solid var(--apinox-button-border)',
                                borderRadius: '2px',
                                cursor: isLoadingLogs ? 'not-allowed' : 'pointer',
                                fontSize: '0.9em',
                                opacity: isLoadingLogs ? 0.5 : 1
                            }}
                        >
                            {isLoadingLogs ? '🔄 Refreshing...' : '🔄 Refresh Logs'}
                        </button>
                        <button
                            onClick={copyAllDiagnostics}
                            style={{
                                padding: '8px 16px',
                                background: copyStatus ? 'var(--apinox-button-secondaryBackground)' : 'var(--apinox-button-background)',
                                color: 'var(--apinox-button-foreground)',
                                border: '1px solid var(--apinox-button-border)',
                                borderRadius: '2px',
                                cursor: 'pointer',
                                fontSize: '0.9em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                            onMouseEnter={(e) => {
                                if (!copyStatus) {
                                    e.currentTarget.style.background = 'var(--apinox-button-hoverBackground)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!copyStatus) {
                                    e.currentTarget.style.background = 'var(--apinox-button-background)';
                                }
                            }}
                        >
                            {copyStatus === 'Copying...' && '⏳'}
                            {copyStatus === '✓ Copied!' && '✓'}
                            {copyStatus === '✗ Failed to copy' && '✗'}
                            {!copyStatus && '📋'}
                            {copyStatus || 'Copy All Diagnostics'}
                        </button>
                    </div>
                </div>
                
                {/* Connection Test Result */}
                {connectionTest && (
                    <div style={{
                        padding: '8px 12px',
                        background: connectionTest.status === 'success' 
                            ? 'var(--apinox-testing-iconPassed)' 
                            : connectionTest.status === 'error'
                            ? 'var(--apinox-inputValidation-errorBackground)'
                            : 'var(--apinox-badge-background)',
                        border: '1px solid var(--apinox-panel-border)',
                        borderRadius: '3px',
                        fontSize: '0.9em',
                        whiteSpace: 'pre-line',
                        color: 'var(--apinox-editor-foreground)',
                    }}>
                        {connectionTest.message}
                    </div>
                )}
                
                {/* System Information */}
                <div>
                    <div 
                        onClick={() => toggleAccordion('system')}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            cursor: 'pointer',
                            userSelect: 'none',
                            padding: '4px 0',
                            marginBottom: '8px',
                            fontWeight: 'bold',
                        }}
                    >
                        <span style={{ fontSize: '0.85em', opacity: 0.7 }}>
                            {showSystemInfo ? '▼' : '▶'}
                        </span>
                        System Information
                    </div>
                    
                    {showSystemInfo && (
                        <div style={{
                            background: 'var(--apinox-editor-background)',
                            border: '1px solid var(--apinox-panel-border)',
                            padding: '12px',
                            borderRadius: '3px',
                            fontSize: '0.9em',
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--apinox-editor-font-family, monospace)' }}>
                        {configDir && (
                            <div>
                                <span style={{ opacity: 0.7 }}>Settings Location:</span>{' '}
                                <span>{configDir}</span>
                            </div>
                        )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Error Display */}
                {fetchError && (
                    <div style={{
                        padding: '8px 12px',
                        background: 'var(--apinox-inputValidation-errorBackground)',
                        border: '1px solid var(--apinox-inputValidation-errorBorder)',
                        color: 'var(--apinox-inputValidation-errorForeground)',
                        borderRadius: '3px',
                        fontSize: '0.9em',
                    }}>
                        ⚠️ {fetchError}
                    </div>
                )}

                {/* All Logs */}
                <div>
                    <div 
                        onClick={() => toggleAccordion('tauri')}
                        style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            marginBottom: 8,
                            cursor: 'pointer',
                            userSelect: 'none',
                            padding: '4px 0',
                        }}
                    >
                        <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.85em', opacity: 0.7 }}>
                                {showTauriLogs ? '▼' : '▶'}
                            </span>
                            All Logs (Tauri)
                            <span style={{ fontSize: '0.85em', color: 'var(--apinox-descriptionForeground)', fontWeight: 'normal' }}>
                                ({tauriLogs.length} {tauriLogs.length === 1 ? 'entry' : 'entries'})
                                {isLoadingLogs && ' - Loading...'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    clearTauriLogs();
                                }}
                                disabled={tauriLogs.length === 0}
                                style={{
                                    padding: '4px 12px',
                                    fontSize: '0.9em',
                                    background: 'var(--apinox-button-secondaryBackground)',
                                    color: 'var(--apinox-button-secondaryForeground)',
                                    border: '1px solid var(--apinox-button-border)',
                                    borderRadius: '2px',
                                    cursor: tauriLogs.length === 0 ? 'not-allowed' : 'pointer',
                                    opacity: tauriLogs.length === 0 ? 0.5 : 1,
                                }}
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    {showTauriLogs && (
                        <div 
                            ref={tauriLogsRef}
                            style={{
                            maxHeight: '300px',
                            overflowY: 'auto',
                            background: 'var(--apinox-editor-background)',
                            border: '1px solid var(--apinox-panel-border)',
                            padding: '8px',
                            fontFamily: 'var(--apinox-editor-font-family, monospace)',
                            fontSize: '0.85em',
                            lineHeight: '1.4',
                            borderRadius: '3px',
                        }}>
                            {tauriLogs.length === 0 ? (
                                <div style={{
                                    color: 'var(--apinox-descriptionForeground)',
                                    textAlign: 'center',
                                    padding: '20px',
                                    fontStyle: 'italic',
                                }}>
                                    No logs available
                                </div>
                            ) : (
                                tauriLogs.map((log, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            marginBottom: 4,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            color: log.includes('[ERROR]') || log.includes('Error') ? 'var(--apinox-errorForeground)' :
                                                log.includes('[WARN]') || log.includes('Warning') ? 'var(--apinox-editorWarning-foreground)' :
                                                    'var(--apinox-editor-foreground)',
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
                    <div 
                        onClick={() => toggleAccordion('frontend')}
                        style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            marginBottom: 8,
                            cursor: 'pointer',
                            userSelect: 'none',
                            padding: '4px 0',
                        }}
                    >
                        <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.85em', opacity: 0.7 }}>
                                {showFrontendLogs ? '▼' : '▶'}
                            </span>
                            Frontend Logs (React/Browser)
                            <span style={{ fontSize: '0.85em', color: 'var(--apinox-descriptionForeground)', fontWeight: 'normal' }}>
                                ({frontendLogState.length} {frontendLogState.length === 1 ? 'entry' : 'entries'})
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    clearFrontendLogs();
                                }}
                                disabled={frontendLogState.length === 0}
                                style={{
                                    padding: '4px 12px',
                                    fontSize: '0.9em',
                                    background: 'var(--apinox-button-secondaryBackground)',
                                    color: 'var(--apinox-button-secondaryForeground)',
                                    border: '1px solid var(--apinox-button-border)',
                                    borderRadius: '2px',
                                    cursor: frontendLogState.length === 0 ? 'not-allowed' : 'pointer',
                                    opacity: frontendLogState.length === 0 ? 0.5 : 1,
                                }}
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    {showFrontendLogs && (
                        <div 
                            ref={frontendLogsRef}
                            style={{
                            maxHeight: '300px',
                            overflowY: 'auto',
                            background: 'var(--apinox-editor-background)',
                            border: '1px solid var(--apinox-panel-border)',
                            padding: '8px',
                            fontFamily: 'var(--apinox-editor-font-family, monospace)',
                            fontSize: '0.85em',
                            lineHeight: '1.4',
                            borderRadius: '3px',
                        }}>
                            {frontendLogState.length === 0 ? (
                                <div style={{
                                    color: 'var(--apinox-descriptionForeground)',
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
                                                color: log.level === 'error' ? 'var(--apinox-errorForeground)' :
                                                    log.level === 'warn' ? 'var(--apinox-editorWarning-foreground)' :
                                                        'var(--apinox-editor-foreground)',
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
                        <div 
                            onClick={() => toggleAccordion('debug')}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px',
                                cursor: 'pointer',
                                userSelect: 'none',
                                padding: '4px 0',
                                marginBottom: '8px',
                                fontWeight: 'bold',
                            }}
                        >
                            <span style={{ fontSize: '0.85em', opacity: 0.7 }}>
                                {showDebugInfo ? '▼' : '▶'}
                            </span>
                            System Debug Information
                        </div>
                        
                        {showDebugInfo && (
                            <div style={{
                                background: 'var(--apinox-editor-background)',
                                border: '1px solid var(--apinox-panel-border)',
                                padding: '12px',
                                fontFamily: 'var(--apinox-editor-font-family, monospace)',
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
            )}
        </Modal>
    );
};
