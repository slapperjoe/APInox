import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * GeneralTab.tsx
 *
 * Network and UI settings for the Settings modal.
 */
import { useState, useEffect } from 'react';
import { ScrollableForm, FormGroup, Label, Input, Select, CheckboxLabel, SectionHeader, } from './SettingsTypes';
import { ProxyRulesEditor } from './ProxyRulesEditor';
import { useTheme } from '../../../contexts/ThemeContext';
import { bridge } from '../../../utils/bridge';
export const GeneralTab = ({ config, onChange }) => {
    const { theme, setTheme, isTauriMode } = useTheme();
    // Debug screen state
    const [logs, setLogs] = useState([]);
    const [settingsDebug, setSettingsDebug] = useState(null);
    const [fetchError, setFetchError] = useState(null);
    const [showLogs, setShowLogs] = useState(false);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    // Load logs and debug info when in Tauri mode
    useEffect(() => {
        if (!isTauriMode)
            return;
        const loadLogsAndDebugInfo = async () => {
            try {
                setIsLoadingLogs(true);
                // Load logs
                const logsResponse = await bridge.sendMessageAsync({ command: 'getSidecarLogs', count: 100 });
                if (logsResponse.logs) {
                    setLogs(logsResponse.logs);
                }
                // Load debug info
                const debugResponse = await bridge.sendMessageAsync({ command: 'getDebugInfo' });
                if (debugResponse.debugInfo) {
                    setSettingsDebug(debugResponse.debugInfo);
                }
                setFetchError(null);
            }
            catch (error) {
                setFetchError(error.message || 'Failed to load debug information');
                console.error('[GeneralTab] Failed to load debug info:', error);
            }
            finally {
                setIsLoadingLogs(false);
            }
        };
        loadLogsAndDebugInfo();
        // Set up polling interval for real-time updates (every 5 seconds)
        const interval = setInterval(loadLogsAndDebugInfo, 5000);
        return () => clearInterval(interval);
    }, [isTauriMode]);
    // Clear logs handler
    const clearLogs = async () => {
        try {
            await bridge.sendMessageAsync({ command: 'clearSidecarLogs' });
            setLogs([]);
            setFetchError(null);
        }
        catch (error) {
            setFetchError(error.message || 'Failed to clear logs');
            console.error('[GeneralTab] Failed to clear logs:', error);
        }
    };
    return (_jsxs(ScrollableForm, { children: [_jsxs("div", { style: { display: 'flex', gap: '30px' }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx(SectionHeader, { style: { marginTop: 0 }, children: "User Interface" }), isTauriMode && (_jsxs(FormGroup, { children: [_jsx(Label, { children: "Theme" }), _jsxs(Select, { value: theme, onChange: e => setTheme(e.target.value), children: [_jsx("option", { value: "dark", children: "Dark" }), _jsx("option", { value: "light", children: "Light" }), _jsx("option", { value: "solarized-dark", children: "Solarized Dark" }), _jsx("option", { value: "solarized-light", children: "Solarized Light" })] })] })), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Layout Mode" }), _jsxs(Select, { value: config.ui?.layoutMode ?? 'vertical', onChange: e => onChange('ui', 'layoutMode', e.target.value), children: [_jsx("option", { value: "vertical", children: "Vertical (Two Columns)" }), _jsx("option", { value: "horizontal", children: "Horizontal (Stacked)" })] })] }), _jsx(FormGroup, { children: _jsxs(CheckboxLabel, { children: [_jsx("input", { type: "checkbox", checked: config.ui?.showLineNumbers ?? true, onChange: e => onChange('ui', 'showLineNumbers', e.target.checked) }), "Show Line Numbers in Editor"] }) }), _jsx(FormGroup, { children: _jsxs(CheckboxLabel, { children: [_jsx("input", { type: "checkbox", checked: config.ui?.alignAttributes ?? false, onChange: e => onChange('ui', 'alignAttributes', e.target.checked) }), "Align Attributes Vertically"] }) }), _jsx(FormGroup, { children: _jsxs(CheckboxLabel, { children: [_jsx("input", { type: "checkbox", checked: config.ui?.inlineElementValues ?? false, onChange: e => onChange('ui', 'inlineElementValues', e.target.checked) }), "Inline simple values in XML Response (Experimental)"] }) }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Auto-Fold XML Elements" }), _jsx("div", { style: { fontSize: '0.85em', color: 'var(--vscode-descriptionForeground)', marginBottom: 8 }, children: "Enter element names to automatically collapse in editors (e.g., Security, Header)" }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }, children: (config.ui?.autoFoldElements || []).map((element, idx) => (_jsxs("div", { style: {
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                padding: '4px 8px',
                                                background: 'var(--vscode-badge-background)',
                                                color: 'var(--vscode-badge-foreground)',
                                                borderRadius: 3,
                                                fontSize: '0.9em'
                                            }, children: [_jsx("span", { children: element }), _jsx("button", { onClick: () => {
                                                        const newElements = [...(config.ui?.autoFoldElements || [])];
                                                        newElements.splice(idx, 1);
                                                        onChange('ui', 'autoFoldElements', newElements);
                                                    }, style: {
                                                        background: 'none',
                                                        border: 'none',
                                                        color: 'inherit',
                                                        cursor: 'pointer',
                                                        padding: 0,
                                                        fontSize: '1.1em',
                                                        lineHeight: 1
                                                    }, title: "Remove", children: "\u00D7" })] }, idx))) }), _jsx("div", { style: { display: 'flex', gap: 4 }, children: _jsx(Input, { type: "text", placeholder: "Element name (e.g., Security)", onKeyDown: (e) => {
                                                if (e.key === 'Enter') {
                                                    const input = e.target;
                                                    const value = input.value.trim();
                                                    if (value && !(config.ui?.autoFoldElements || []).includes(value)) {
                                                        onChange('ui', 'autoFoldElements', [...(config.ui?.autoFoldElements || []), value]);
                                                        input.value = '';
                                                    }
                                                }
                                            }, style: { flex: 1 } }) })] })] }), _jsxs("div", { style: { flex: 1 }, children: [_jsx(SectionHeader, { style: { marginTop: 0 }, children: "Network" }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Default Timeout (seconds)" }), _jsx(Input, { type: "number", value: config.network?.defaultTimeout ?? 30, onChange: e => onChange('network', 'defaultTimeout', parseInt(e.target.value)) })] }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Retry Count" }), _jsx(Input, { type: "number", min: 0, max: 10, value: config.network?.retryCount ?? 0, onChange: e => onChange('network', 'retryCount', parseInt(e.target.value)) })] }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Proxy URL (Optional)" }), _jsx(Input, { type: "text", placeholder: "http://127.0.0.1:8080", value: config.network?.proxy ?? '', onChange: e => onChange('network', 'proxy', e.target.value) })] }), _jsx(FormGroup, { children: _jsxs(CheckboxLabel, { children: [_jsx("input", { type: "checkbox", checked: config.network?.strictSSL ?? true, onChange: e => onChange('network', 'strictSSL', e.target.checked) }), "Strict SSL (Verify Certificates)"] }) }), _jsx(ProxyRulesEditor, { config: config, onChange: onChange })] })] }), isTauriMode && (_jsxs("div", { style: { marginTop: '30px', borderTop: '1px solid var(--vscode-panel-border)', paddingTop: '20px' }, children: [_jsx(SectionHeader, { children: "Diagnostics & Debug Information" }), _jsxs(FormGroup, { children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, children: [_jsx(Label, { style: { marginBottom: 0 }, children: "Sidecar Console Logs" }), _jsxs("div", { style: { display: 'flex', gap: '8px', alignItems: 'center' }, children: [isLoadingLogs && (_jsx("span", { style: { fontSize: '0.85em', color: 'var(--vscode-descriptionForeground)' }, children: "Loading..." })), _jsxs("span", { style: { fontSize: '0.85em', color: 'var(--vscode-descriptionForeground)' }, children: [logs.length, " ", logs.length === 1 ? 'entry' : 'entries'] }), _jsx("button", { onClick: clearLogs, disabled: logs.length === 0, style: {
                                                    padding: '4px 12px',
                                                    fontSize: '0.9em',
                                                    cursor: logs.length === 0 ? 'not-allowed' : 'pointer',
                                                    opacity: logs.length === 0 ? 0.5 : 1,
                                                }, children: "Clear Logs" }), _jsx("button", { onClick: () => setShowLogs(!showLogs), style: {
                                                    padding: '4px 12px',
                                                    fontSize: '0.9em',
                                                }, children: showLogs ? 'Hide' : 'Show' })] })] }), fetchError && (_jsxs("div", { style: {
                                    padding: '8px 12px',
                                    marginBottom: '8px',
                                    background: 'var(--vscode-inputValidation-errorBackground)',
                                    border: '1px solid var(--vscode-inputValidation-errorBorder)',
                                    color: 'var(--vscode-inputValidation-errorForeground)',
                                    borderRadius: '3px',
                                    fontSize: '0.9em',
                                }, children: ["\u26A0\uFE0F ", fetchError] })), showLogs && (_jsx("div", { style: {
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    background: 'var(--vscode-editor-background)',
                                    border: '1px solid var(--vscode-panel-border)',
                                    padding: '8px',
                                    fontFamily: 'var(--vscode-editor-font-family, monospace)',
                                    fontSize: '0.85em',
                                    lineHeight: '1.4',
                                    borderRadius: '3px',
                                }, children: logs.length === 0 ? (_jsx("div", { style: {
                                        color: 'var(--vscode-descriptionForeground)',
                                        textAlign: 'center',
                                        padding: '20px',
                                        fontStyle: 'italic',
                                    }, children: "No logs available" })) : (logs.map((log, i) => (_jsx("div", { style: {
                                        marginBottom: 4,
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        color: log.includes('[ERROR]') || log.includes('Error') ? 'var(--vscode-errorForeground)' :
                                            log.includes('[WARN]') || log.includes('Warning') ? 'var(--vscode-editorWarning-foreground)' :
                                                'var(--vscode-editor-foreground)',
                                    }, children: log }, i)))) }))] }), settingsDebug && (_jsxs("details", { style: { marginTop: 16 }, children: [_jsx("summary", { style: {
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    marginBottom: 8,
                                    padding: '8px',
                                    background: 'var(--vscode-sideBar-background)',
                                    borderRadius: '3px',
                                    userSelect: 'none',
                                }, children: "System Debug Information" }), _jsx("div", { style: {
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
                                }, children: JSON.stringify(settingsDebug, null, 2) })] }))] }))] }));
};
