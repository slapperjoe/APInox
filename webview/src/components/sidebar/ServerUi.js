import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * ServerUi.tsx
 *
 * Unified server sidebar component with mode toggle, mock rules, breakpoints, and combined traffic history.
 * Replaces separate Proxy and Mock tabs.
 */
import { useState } from 'react';
import { Play, Square, Trash2, Settings, ArrowRight, Plus, Edit2, ToggleLeft, ToggleRight, Radio, Bug, PlusSquare, Shield } from 'lucide-react';
import { HeaderButton, ServiceItem } from './shared/SidebarStyles';
import { MockRuleModal } from '../modals/MockRuleModal';
import { BreakpointModal } from '../modals/BreakpointModal';
import { createMockRuleFromSource } from '../../utils/mockUtils';
const MODE_OPTIONS = [
    { value: 'off', label: 'Off' },
    { value: 'mock', label: 'Moxy', color: 'var(--vscode-charts-green)' },
    { value: 'proxy', label: 'Proxy', color: 'var(--vscode-charts-blue)' },
    { value: 'both', label: 'Both', color: 'var(--vscode-charts-purple)' },
];
export const ServerUi = ({ serverConfig, isRunning, onModeChange, onStart, onStop, onOpenSettings, proxyHistory, mockHistory, onSelectProxyEvent, onSelectMockEvent, selectedEventId, onClearHistory, mockRules = [], onAddMockRule, onDeleteMockRule, onToggleMockRule, breakpoints = [], onUpdateBreakpoints, onOpenCertificate, }) => {
    const totalEvents = proxyHistory.length + mockHistory.length;
    const showMockSection = serverConfig.mode === 'mock' || serverConfig.mode === 'both';
    const showProxySection = serverConfig.mode === 'proxy' || serverConfig.mode === 'both';
    // DEBUG: Diagnose missing sections
    console.log('[ServerUi] Render', {
        mode: serverConfig.mode,
        showMockSection,
        showProxySection,
        hasMockRulesHandler: !!onAddMockRule,
        hasBreakpointHandler: !!onUpdateBreakpoints,
        mockRulesCount: mockRules.length,
        breakpointsCount: breakpoints.length
    });
    // Modal states
    const [ruleModal, setRuleModal] = useState({ open: false });
    const [breakpointModal, setBreakpointModal] = useState({ open: false });
    const [showRules, setShowRules] = useState(true);
    const [showBreakpoints, setShowBreakpoints] = useState(true);
    const [notification, setNotification] = useState(null);
    const handleSaveRule = (rule) => {
        if (onAddMockRule) {
            onAddMockRule(rule);
        }
    };
    const handleSaveBreakpoint = (bp) => {
        if (onUpdateBreakpoints) {
            const existing = breakpoints.findIndex(b => b.id === bp.id);
            if (existing >= 0) {
                const updated = [...breakpoints];
                updated[existing] = bp;
                onUpdateBreakpoints(updated);
            }
            else {
                onUpdateBreakpoints([...breakpoints, bp]);
            }
        }
    };
    const handleCreateMockFromEvent = (e, event) => {
        e.stopPropagation();
        if (onAddMockRule) {
            // Normalize event to MockSourceData
            const sourceData = {
                url: event.url || '',
                statusCode: event.status || 200,
                responseBody: 'responseContent' in event ? (event.responseContent || '') : (event.responseBody || ''),
                responseHeaders: event.responseHeaders,
                // Include request body for SOAP operation name extraction
                requestBody: 'requestContent' in event ? (event.requestContent || '') : (event.requestBody || '')
            };
            const newRule = createMockRuleFromSource(sourceData);
            onAddMockRule(newRule);
            // Show notification
            setNotification(`Mock rule added: ${newRule.name}`);
            setTimeout(() => setNotification(null), 3000);
        }
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: [notification && (_jsx("div", { style: {
                    position: 'absolute',
                    top: 60,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--vscode-notificationsInfoIcon-foreground)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: 4,
                    zIndex: 1000,
                    fontSize: '0.85em',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    animation: 'fadeIn 0.2s ease'
                }, children: notification })), _jsxs("div", { style: {
                    display: 'flex',
                    borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)',
                    padding: '5px 10px',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }, children: [_jsxs("div", { style: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--vscode-sideBarTitle-foreground)', flex: 1, display: 'flex', alignItems: 'center', gap: 6 }, children: ["Server", isRunning && (_jsx("span", { style: {
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: 'var(--vscode-testing-iconPassed)',
                                    animation: 'pulse 2s infinite'
                                } }))] }), _jsx(HeaderButton, { onClick: onOpenSettings, title: "Server Settings", children: _jsx(Settings, { size: 14 }) })] }), _jsxs("div", { style: { flex: 1, overflowY: 'auto', padding: 10, color: 'var(--vscode-descriptionForeground)' }, children: [_jsxs("div", { style: { marginBottom: 10 }, children: [_jsx("div", { style: { fontSize: '0.8em', marginBottom: 4 }, children: "Mode" }), _jsx("div", { style: { display: 'flex', gap: 4, opacity: isRunning ? 0.6 : 1 }, children: MODE_OPTIONS.map(opt => (_jsx("button", { onClick: () => !isRunning && onModeChange(opt.value), disabled: isRunning, title: isRunning ? "Stop the server to change modes" : opt.label, style: {
                                        flex: 1,
                                        padding: '6px 8px',
                                        fontSize: 11,
                                        border: `1px solid ${serverConfig.mode === opt.value ? (opt.color || 'var(--vscode-button-background)') : 'var(--vscode-input-border)'}`,
                                        borderRadius: 4,
                                        background: serverConfig.mode === opt.value
                                            ? (opt.color || 'var(--vscode-button-background)')
                                            : 'transparent',
                                        color: serverConfig.mode === opt.value
                                            ? 'var(--vscode-button-foreground)'
                                            : 'var(--vscode-input-foreground)',
                                        cursor: isRunning ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.15s ease'
                                    }, children: opt.label }, opt.value))) })] }), _jsxs("div", { style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 10px',
                            background: 'var(--vscode-editor-inactiveSelectionBackground)',
                            borderRadius: 5,
                            fontSize: '0.85em',
                            marginBottom: 10
                        }, children: [_jsxs("div", { children: [_jsx("span", { style: { opacity: 0.7 }, children: "Port:" }), " ", serverConfig.port, serverConfig.targetUrl && (_jsxs(_Fragment, { children: [_jsx("span", { style: { opacity: 0.5, margin: '0 8px' }, children: "\u2192" }), _jsx("span", { style: { opacity: 0.7 }, title: serverConfig.targetUrl, children: serverConfig.targetUrl.length > 25
                                                    ? serverConfig.targetUrl.substring(0, 25) + '...'
                                                    : serverConfig.targetUrl })] }))] }), serverConfig.mode !== 'off' && (!isRunning ? (_jsx(HeaderButton, { onClick: onStart, style: { color: 'var(--vscode-testing-iconPassed)', border: '1px solid currentColor', padding: '4px 6px' }, title: "Start Server", children: _jsx(Play, { size: 12 }) })) : (_jsx(HeaderButton, { onClick: onStop, style: { color: 'var(--vscode-testing-iconFailed)', border: '1px solid currentColor', padding: '4px 6px' }, title: "Stop Server", children: _jsx(Square, { size: 12 }) }))), serverConfig.targetUrl?.toLowerCase().startsWith('https') && onOpenCertificate && (_jsx(HeaderButton, { onClick: onOpenCertificate, title: "Install Certificate (Required for HTTPS)", style: { color: 'var(--vscode-charts-yellow)', marginLeft: 4 }, children: _jsx(Shield, { size: 14 }) }))] }), showMockSection && onAddMockRule && (_jsxs("div", { style: { borderTop: '1px solid var(--vscode-panel-border)', paddingTop: 10, marginBottom: 10 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, children: [_jsxs("h4", { style: { margin: 0, fontSize: '0.9em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }, onClick: () => setShowRules(!showRules), children: [_jsx(Radio, { size: 14 }), "Mock Rules (", mockRules.length, ")"] }), _jsx(HeaderButton, { onClick: () => setRuleModal({ open: true }), title: "Add Mock Rule", children: _jsx(Plus, { size: 14 }) })] }), showRules && mockRules.length > 0 && (_jsx("div", { style: { fontSize: '0.85em' }, children: mockRules.map((rule) => (_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '6px 8px',
                                        marginBottom: 4,
                                        backgroundColor: 'var(--vscode-list-hoverBackground)',
                                        borderRadius: 4,
                                        opacity: rule.enabled ? 1 : 0.5
                                    }, children: [_jsx("button", { onClick: () => onToggleMockRule?.(rule.id, !rule.enabled), style: {
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: rule.enabled ? 'var(--vscode-testing-iconPassed)' : 'var(--vscode-disabledForeground)',
                                                padding: 2,
                                                display: 'flex'
                                            }, title: rule.enabled ? 'Disable' : 'Enable', children: rule.enabled ? _jsx(ToggleRight, { size: 16 }) : _jsx(ToggleLeft, { size: 16 }) }), _jsxs("div", { style: { flex: 1, overflow: 'hidden' }, children: [_jsx("div", { style: { fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: rule.name || 'Unnamed Rule' }), _jsxs("div", { style: { fontSize: '0.8em', opacity: 0.7 }, children: [rule.conditions?.length || 0, " condition(s) \u2022 ", rule.statusCode] })] }), _jsx(HeaderButton, { onClick: () => setRuleModal({ open: true, rule }), title: "Edit", style: { padding: 4 }, children: _jsx(Edit2, { size: 12 }) }), _jsx(HeaderButton, { onClick: () => onDeleteMockRule?.(rule.id), title: "Delete", style: { padding: 4, color: 'var(--vscode-testing-iconFailed)' }, children: _jsx(Trash2, { size: 12 }) })] }, rule.id))) })), showRules && mockRules.length === 0 && (_jsx("div", { style: { fontSize: '0.8em', opacity: 0.7, textAlign: 'center', padding: 10 }, children: "No mock rules. Click + to add one." }))] })), showProxySection && onUpdateBreakpoints && (_jsxs("div", { style: { borderTop: '1px solid var(--vscode-panel-border)', paddingTop: 10, marginBottom: 10 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, children: [_jsxs("h4", { style: { margin: 0, fontSize: '0.9em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }, onClick: () => setShowBreakpoints(!showBreakpoints), children: [_jsx(Bug, { size: 14 }), "Breakpoints (", breakpoints.length, ")"] }), _jsx(HeaderButton, { onClick: () => setBreakpointModal({ open: true }), title: "Add Breakpoint", children: _jsx(Plus, { size: 14 }) })] }), showBreakpoints && breakpoints.length > 0 && (_jsx("div", { style: { fontSize: '0.85em' }, children: breakpoints.map((bp, i) => (_jsxs("div", { style: {
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
                                            }, title: "Delete", style: { padding: 4, color: 'var(--vscode-testing-iconFailed)' }, children: _jsx(Trash2, { size: 12 }) })] }, bp.id))) })), showBreakpoints && breakpoints.length === 0 && (_jsx("div", { style: { fontSize: '0.8em', opacity: 0.7, textAlign: 'center', padding: 10 }, children: "No breakpoints. Click + to add one." }))] })), _jsxs("div", { style: { borderTop: '1px solid var(--vscode-panel-border)', paddingTop: 10 }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 5
                                }, children: [_jsxs("h4", { style: { margin: 0, fontSize: '0.9em' }, children: ["Traffic (", totalEvents, ")"] }), totalEvents > 0 && (_jsx(HeaderButton, { onClick: onClearHistory, title: "Clear History", style: { padding: 4 }, children: _jsx(Trash2, { size: 14 }) }))] }), totalEvents === 0 ? (_jsx("div", { style: {
                                    textAlign: 'center',
                                    marginTop: 20,
                                    fontSize: '0.8em',
                                    opacity: 0.7,
                                    color: 'var(--vscode-descriptionForeground)'
                                }, children: serverConfig.mode === 'off'
                                    ? 'Select a mode and start the server to capture traffic.'
                                    : isRunning
                                        ? 'Waiting for requests...'
                                        : 'Start the server to capture traffic.' })) : (_jsx(_Fragment, { children: [...proxyHistory.map(e => ({ type: 'proxy', event: e, timestamp: e.timestamp })),
                                    ...mockHistory.map(e => ({ type: 'mock', event: e, timestamp: e.timestamp }))]
                                    .sort((a, b) => b.timestamp - a.timestamp)
                                    .map((item, i) => (item.type === 'proxy' ? (_jsxs(ServiceItem, { style: {
                                        paddingLeft: 5,
                                        paddingRight: 5,
                                        backgroundColor: item.event.id === selectedEventId
                                            ? 'var(--vscode-list-activeSelectionBackground)'
                                            : undefined,
                                        color: item.event.id === selectedEventId
                                            ? 'var(--vscode-list-activeSelectionForeground)'
                                            : undefined
                                    }, onClick: () => onSelectProxyEvent(item.event), children: [_jsxs("div", { style: { flex: 1, fontSize: '0.85em', overflow: 'hidden' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("span", { style: { fontWeight: 'bold' }, children: item.event.method }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 4 }, children: [_jsx("span", { style: { color: 'var(--vscode-charts-blue)', fontSize: '0.8em' }, children: "PROXY" }), _jsx("span", { style: { opacity: 0.7 }, children: item.event.status })] })] }), _jsx("div", { style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, title: item.event.url, children: item.event.url })] }), onAddMockRule && (_jsx("button", { onClick: (e) => handleCreateMockFromEvent(e, item.event), title: "Create Mock Rule", style: {
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: 'inherit',
                                                opacity: item.event.id === selectedEventId ? 1 : 0.5,
                                                padding: 4,
                                                display: 'flex',
                                                alignItems: 'center'
                                            }, children: _jsx(PlusSquare, { size: 14 }) }))] }, `proxy-${i}`)) : (_jsxs(ServiceItem, { style: {
                                        paddingLeft: 5,
                                        paddingRight: 5,
                                        backgroundColor: item.event.id === selectedEventId
                                            ? 'var(--vscode-list-activeSelectionBackground)'
                                            : undefined,
                                        color: item.event.id === selectedEventId
                                            ? 'var(--vscode-list-activeSelectionForeground)'
                                            : undefined
                                    }, onClick: () => onSelectMockEvent(item.event), children: [_jsxs("div", { style: { flex: 1, fontSize: '0.85em', overflow: 'hidden' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("span", { style: { fontWeight: 'bold' }, children: item.event.method }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 4 }, children: [item.event.matchedRule && (_jsx("span", { style: { color: 'var(--vscode-charts-green)', fontSize: '0.8em' }, children: "MOXY" })), item.event.passthrough && (_jsxs("span", { style: { color: 'var(--vscode-charts-blue)', fontSize: '0.8em', display: 'flex', alignItems: 'center' }, children: [_jsx(ArrowRight, { size: 10 }), " FWD"] })), _jsx("span", { style: { opacity: 0.7 }, children: item.event.status })] })] }), _jsx("div", { style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, title: item.event.url, children: item.event.url }), item.event.matchedRule && (_jsxs("div", { style: { fontSize: '0.75em', opacity: 0.7, color: 'var(--vscode-charts-green)' }, children: ["Rule: ", item.event.matchedRule] }))] }), onAddMockRule && (_jsx("button", { onClick: (e) => handleCreateMockFromEvent(e, item.event), title: "Create Mock Rule", style: {
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: 'inherit',
                                                opacity: item.event.id === selectedEventId ? 1 : 0.5,
                                                padding: 4,
                                                display: 'flex',
                                                alignItems: 'center'
                                            }, children: _jsx(PlusSquare, { size: 14 }) }))] }, `mock-${i}`)))) }))] })] }), _jsx(MockRuleModal, { open: ruleModal.open, rule: ruleModal.rule, onClose: () => setRuleModal({ open: false }), onSave: handleSaveRule }), _jsx(BreakpointModal, { open: breakpointModal.open, breakpoint: breakpointModal.bp, onClose: () => setBreakpointModal({ open: false }), onSave: handleSaveBreakpoint })] }));
};
