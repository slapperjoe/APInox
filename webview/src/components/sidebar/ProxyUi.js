import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Play, Square, Shield, Trash2, FolderOpen, Network, FileCode, FileDown, Bug, Plus, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';
import { HeaderButton, ServiceItem } from './shared/SidebarStyles';
import { formatXml } from '@shared/utils/xmlFormatter';
import { BreakpointModal } from '../modals/BreakpointModal';
export const ProxyUi = ({ isRunning, config, history, onStart, onStop, onUpdateConfig, onClear, onSelectEvent, onSaveHistory, configPath, onSelectConfigFile, onInjectProxy, onRestoreProxy, onOpenCertificate, breakpoints = [], onUpdateBreakpoints }) => {
    const isHttps = config.target.toLowerCase().startsWith('https');
    const [breakpointModal, setBreakpointModal] = useState({ open: false });
    const [showBreakpoints, setShowBreakpoints] = useState(true);
    const generateEventMarkdown = (event) => {
        let md = `## Request: ${event.url} \n\n`;
        md += `Timestamp: ${event.timestampLabel} \n`;
        md += `Method: ${event.method} \n`;
        md += `Status: ${event.status} \n`;
        md += `Duration: ${(event.duration || 0).toFixed(2)} s\n\n`;
        md += '### Request\n\n';
        if (event.requestHeaders) {
            md += '#### Headers\n';
            md += '```yaml\n';
            Object.entries(event.requestHeaders).forEach(([k, v]) => {
                md += `${k}: ${v}\n`;
            });
            md += '```\n\n';
        }
        md += '#### Body\n';
        const reqBody = event.formattedBody || (event.requestContent || event.requestBody || '').trim();
        if (reqBody) {
            md += '```xml\n' + formatXml(reqBody, true) + '\n```\n\n';
        }
        else {
            md += '*Empty Body*\n\n';
        }
        md += '### Response\n\n';
        if (event.responseHeaders) {
            md += '#### Headers\n';
            md += '```yaml\n';
            Object.entries(event.responseHeaders).forEach(([k, v]) => {
                md += `${k}: ${v}\n`;
            });
            md += '```\n\n';
        }
        md += '#### Body\n';
        const resBody = event.responseContent || event.responseBody || '';
        if (resBody) {
            let displayRes = resBody;
            try {
                if (resBody.trim().startsWith('<'))
                    displayRes = formatXml(resBody, true);
                else if (resBody.trim().startsWith('{'))
                    displayRes = JSON.stringify(JSON.parse(resBody), null, 2);
            }
            catch (e) { }
            md += '```\n' + displayRes + '\n```\n\n';
        }
        else {
            md += '*Empty Body*\n\n';
        }
        return md;
    };
    const handleSaveSingleReport = (event, e) => {
        e.stopPropagation();
        const md = generateEventMarkdown(event);
        onSaveHistory(md);
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: [_jsx("div", { style: { display: 'flex', borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)', padding: '5px 10px', alignItems: 'center', justifyContent: 'space-between' }, children: _jsx("div", { style: { fontWeight: 'bold' }, children: "Dirty Proxy" }) }), _jsxs("div", { style: { flex: 1, overflowY: 'auto', padding: 10, color: 'var(--vscode-descriptionForeground)' }, children: [_jsxs("div", { style: { marginBottom: 15, padding: 10, backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)', borderRadius: 5 }, children: [_jsxs("div", { style: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 5 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("label", { style: { display: 'block', fontSize: '0.8em', marginBottom: 2 }, children: "Local Port" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', background: 'var(--vscode-input-background)', border: '1px solid var(--vscode-input-border)' }, children: [_jsx("div", { onClick: () => onUpdateConfig({ ...config, port: Math.max(1, (config.port || 9000) - 1) }), style: { padding: '4px 8px', cursor: 'pointer', borderRight: '1px solid var(--vscode-input-border)', userSelect: 'none' }, children: "-" }), _jsx("input", { type: "number", className: "vscode-input", value: config.port, onChange: (e) => onUpdateConfig({ ...config, port: parseInt(e.target.value) || 9000 }), style: {
                                                            flex: 1,
                                                            width: '50px',
                                                            padding: '4px',
                                                            background: 'transparent',
                                                            color: 'var(--vscode-input-foreground)',
                                                            border: 'none',
                                                            textAlign: 'center',
                                                            appearance: 'textfield', // Hide default arrows
                                                        } }), _jsx("div", { onClick: () => onUpdateConfig({ ...config, port: (config.port || 9000) + 1 }), style: { padding: '4px 8px', cursor: 'pointer', borderLeft: '1px solid var(--vscode-input-border)', userSelect: 'none' }, children: "+" })] })] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', paddingBottom: 1 }, children: !isRunning ? (_jsx(HeaderButton, { onClick: onStart, style: { color: 'var(--vscode-testing-iconPassed)', border: '1px solid currentColor', padding: '5px 8px', height: '28px' }, title: "Start Proxy", children: _jsx(Play, { size: 14 }) })) : (_jsx(HeaderButton, { onClick: onStop, style: { color: 'var(--vscode-testing-iconFailed)', border: '1px solid currentColor', padding: '5px 8px', height: '28px' }, title: "Stop Proxy", children: _jsx(Square, { size: 14 }) })) })] }), _jsxs("div", { style: { marginBottom: 5 }, children: [_jsx("label", { style: { display: 'block', fontSize: '0.8em', marginBottom: 2 }, children: "Target URL" }), _jsx("input", { type: "text", className: "vscode-input", value: config.target, onChange: (e) => onUpdateConfig({ ...config, target: e.target.value }), style: { width: '100%', padding: '4px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)' } })] }), _jsxs("div", { style: { marginBottom: 5, display: 'flex', alignItems: 'center' }, children: [_jsx("input", { type: "checkbox", id: "chkSystemProxy", checked: config.systemProxyEnabled !== false, onChange: e => onUpdateConfig({ ...config, systemProxyEnabled: e.target.checked }), style: {
                                            marginRight: 6,
                                            accentColor: 'var(--vscode-button-background)',
                                            width: '14px',
                                            height: '14px',
                                            cursor: 'pointer'
                                        } }), _jsx("label", { htmlFor: "chkSystemProxy", style: { fontSize: '0.8em', cursor: 'pointer', userSelect: 'none' }, title: "Uncheck to bypass local corporate proxy (direct connection)", children: "Use System Proxy" })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }, children: [_jsxs("div", { style: { fontSize: '0.8em' }, children: ["Status: ", isRunning ? _jsx("span", { style: { color: 'var(--vscode-testing-iconPassed)' }, children: "Running" }) : 'Stopped'] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center' }, children: [isHttps && onOpenCertificate && (_jsx(HeaderButton, { onClick: onOpenCertificate, title: "Install Certificate (Required for HTTPS)", style: { color: 'var(--vscode-charts-yellow)' }, children: _jsx(Shield, { size: 14 }) })), _jsx(HeaderButton, { onClick: onClear, title: "Clear Traffic History", children: _jsx(Trash2, { size: 14 }) })] })] })] }), onUpdateBreakpoints && (_jsxs("div", { style: { borderTop: '1px solid var(--vscode-panel-border)', paddingTop: 10, marginTop: 10 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, children: [_jsxs("h4", { style: { margin: 0, fontSize: '0.9em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }, onClick: () => setShowBreakpoints(!showBreakpoints), children: [_jsx(Bug, { size: 14 }), "Breakpoints (", breakpoints.length, ")"] }), _jsx(HeaderButton, { onClick: () => setBreakpointModal({ open: true }), title: "Add Breakpoint", children: _jsx(Plus, { size: 14 }) })] }), showBreakpoints && breakpoints.length > 0 && (_jsx("div", { style: { fontSize: '0.85em' }, children: breakpoints.map((bp, i) => (_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '6px 8px',
                                        marginBottom: 4,
                                        backgroundColor: 'var(--vscode-list-hoverBackground)',
                                        borderRadius: 4,
                                        opacity: bp.enabled ? 1 : 0.5
                                    }, children: [_jsx("button", { onClick: () => {
                                                const updated = breakpoints.map((b, idx) => idx === i ? { ...b, enabled: !b.enabled } : b);
                                                onUpdateBreakpoints(updated);
                                            }, style: {
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: bp.enabled ? 'var(--vscode-testing-iconPassed)' : 'var(--vscode-disabledForeground)',
                                                padding: 2,
                                                display: 'flex'
                                            }, title: bp.enabled ? 'Disable' : 'Enable', children: bp.enabled ? _jsx(ToggleRight, { size: 16 }) : _jsx(ToggleLeft, { size: 16 }) }), _jsxs("div", { style: { flex: 1, overflow: 'hidden' }, children: [_jsx("div", { style: { fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: bp.name || bp.pattern }), _jsxs("div", { style: { fontSize: '0.8em', opacity: 0.7 }, children: [bp.target, " \u2022 ", bp.matchOn, bp.isRegex ? ' (regex)' : ''] })] }), _jsx(HeaderButton, { onClick: () => setBreakpointModal({ open: true, bp }), title: "Edit", style: { padding: 4 }, children: _jsx(Edit2, { size: 12 }) }), _jsx(HeaderButton, { onClick: () => {
                                                const updated = breakpoints.filter((_, idx) => idx !== i);
                                                onUpdateBreakpoints(updated);
                                            }, title: "Delete", style: { padding: 4, color: 'var(--vscode-testing-iconFailed)' }, children: _jsx(Trash2, { size: 12 }) })] }, bp.id))) })), showBreakpoints && breakpoints.length === 0 && (_jsx("div", { style: { textAlign: 'center', fontSize: '0.8em', opacity: 0.7, padding: '10px 0' }, children: "No breakpoints configured." }))] })), _jsxs("div", { style: { borderTop: '1px solid var(--vscode-panel-border)', paddingTop: 10, marginTop: 10 }, children: [_jsx("h4", { style: { margin: '0 0 8px 0', fontSize: '0.9em' }, children: "Config Switcher" }), _jsxs("div", { style: { display: 'flex', gap: 5, alignItems: 'center', marginBottom: 5 }, children: [_jsx("div", { style: {
                                            flex: 1,
                                            fontSize: '0.8em',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            padding: '4px',
                                            backgroundColor: 'var(--vscode-editor-background)',
                                            border: '1px solid var(--vscode-input-border)',
                                            borderRadius: '2px'
                                        }, title: configPath || '', children: configPath ? configPath.split(/[\\/]/).pop() : 'Select web.config...' }), _jsx(HeaderButton, { onClick: onSelectConfigFile, title: "Browse", children: _jsx(FolderOpen, { size: 14 }) })] }), configPath && (_jsxs("div", { style: { display: 'flex', gap: 5, marginTop: 5 }, children: [_jsxs(HeaderButton, { onClick: onInjectProxy, style: { flex: 1, justifyContent: 'center', border: '1px solid var(--vscode-button-border)', background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)' }, title: "Inject Proxy Address", children: [_jsx(Network, { size: 12, style: { marginRight: 5 } }), " Inject"] }), _jsxs(HeaderButton, { onClick: onRestoreProxy, style: { flex: 1, justifyContent: 'center', border: '1px solid var(--vscode-button-border)', background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)' }, title: "Restore Original Config", children: [_jsx(FileCode, { size: 12, style: { marginRight: 5 } }), " Restore"] })] }))] }), _jsxs("div", { style: { marginTop: 15, borderTop: '1px solid var(--vscode-panel-border)', paddingTop: 10 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }, children: [_jsxs("h4", { style: { margin: 0, fontSize: '0.9em' }, children: ["Traffic (", history.length, ")"] }), history.length > 0 && (_jsx(HeaderButton, { onClick: onClear, title: "Clear Traffic History", style: { padding: 4 }, children: _jsx(Trash2, { size: 14 }) }))] }), history.length === 0 ? (_jsx("div", { style: { textAlign: 'center', marginTop: 10, fontSize: '0.8em', opacity: 0.7 }, children: "No events captured." })) : (history.map((event, i) => (_jsxs(ServiceItem, { style: { paddingLeft: 5, paddingRight: 5 }, onClick: () => onSelectEvent(event), children: [_jsxs("div", { style: { flex: 1, fontSize: '0.85em', overflow: 'hidden' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between' }, children: [_jsx("span", { style: { fontWeight: 'bold' }, children: event.method }), _jsx("span", { style: { opacity: 0.7 }, children: event.status })] }), _jsx("div", { style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, title: event.url, children: event.url })] }), _jsx(HeaderButton, { onClick: (e) => handleSaveSingleReport(event, e), title: "Save Request Log", children: _jsx(FileDown, { size: 14 }) })] }, i))))] })] }), onUpdateBreakpoints && (_jsx(BreakpointModal, { open: breakpointModal.open, breakpoint: breakpointModal.bp, onClose: () => setBreakpointModal({ open: false }), onSave: (bp) => {
                    const existing = breakpoints.findIndex(b => b.id === bp.id);
                    if (existing >= 0) {
                        // Update existing
                        const updated = [...breakpoints];
                        updated[existing] = bp;
                        onUpdateBreakpoints(updated);
                    }
                    else {
                        // Add new
                        onUpdateBreakpoints([...breakpoints, bp]);
                    }
                } }))] }));
};
