import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Play, Square, Trash2, Plus, Edit2, ToggleLeft, ToggleRight, Radio, ArrowRight, Circle } from 'lucide-react';
import { HeaderButton, ServiceItem } from './shared/SidebarStyles';
import { MockRuleModal } from '../modals/MockRuleModal';
const DEFAULT_CONFIG = {
    enabled: false,
    port: 9001,
    targetUrl: 'http://localhost:8080',
    rules: [],
    passthroughEnabled: true,
    routeThroughProxy: false
};
export const MockUi = ({ isRunning, config = DEFAULT_CONFIG, history, onStart, onStop, onUpdateConfig, onClear, onSelectEvent, rules, onAddRule, onDeleteRule, onToggleRule }) => {
    const [showRules, setShowRules] = useState(true);
    const [ruleModal, setRuleModal] = useState({ open: false });
    const handleAddRule = () => {
        setRuleModal({ open: true, rule: null });
    };
    const handleEditRule = (rule) => {
        setRuleModal({ open: true, rule });
    };
    const handleSaveRule = (rule) => {
        // Check if it's an update or new rule
        const existing = rules.find(r => r.id === rule.id);
        if (existing) {
            onAddRule(rule); // Will update via command
        }
        else {
            onAddRule(rule);
        }
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: [_jsx("div", { style: { display: 'flex', borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)', padding: '5px 10px', alignItems: 'center', justifyContent: 'space-between' }, children: _jsxs("div", { style: { fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx(Radio, { size: 14 }), "Dirty Moxy"] }) }), _jsxs("div", { style: { flex: 1, overflowY: 'auto', padding: 10, color: 'var(--vscode-descriptionForeground)' }, children: [_jsxs("div", { style: { marginBottom: 15, padding: 10, backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)', borderRadius: 5 }, children: [_jsxs("div", { style: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 5 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("label", { style: { display: 'block', fontSize: '0.8em', marginBottom: 2 }, children: "Port" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', background: 'var(--vscode-input-background)', border: '1px solid var(--vscode-input-border)' }, children: [_jsx("div", { onClick: () => onUpdateConfig({ port: Math.max(1, (config.port || 9001) - 1) }), style: { padding: '4px 8px', cursor: 'pointer', borderRight: '1px solid var(--vscode-input-border)', userSelect: 'none' }, children: "-" }), _jsx("input", { type: "number", className: "vscode-input", value: config.port, onChange: (e) => onUpdateConfig({ port: parseInt(e.target.value) || 9001 }), style: {
                                                            flex: 1,
                                                            width: '50px',
                                                            padding: '4px',
                                                            background: 'transparent',
                                                            color: 'var(--vscode-input-foreground)',
                                                            border: 'none',
                                                            textAlign: 'center',
                                                            appearance: 'textfield',
                                                        } }), _jsx("div", { onClick: () => onUpdateConfig({ port: (config.port || 9001) + 1 }), style: { padding: '4px 8px', cursor: 'pointer', borderLeft: '1px solid var(--vscode-input-border)', userSelect: 'none' }, children: "+" })] })] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', paddingBottom: 1 }, children: !isRunning ? (_jsx(HeaderButton, { onClick: onStart, style: { color: 'var(--vscode-testing-iconPassed)', border: '1px solid currentColor', padding: '5px 8px', height: '28px' }, title: "Start Dirty Moxy", children: _jsx(Play, { size: 14 }) })) : (_jsx(HeaderButton, { onClick: onStop, style: { color: 'var(--vscode-testing-iconFailed)', border: '1px solid currentColor', padding: '5px 8px', height: '28px' }, title: "Stop Dirty Moxy", children: _jsx(Square, { size: 14 }) })) })] }), _jsxs("div", { style: { marginBottom: 5 }, children: [_jsx("label", { style: { display: 'block', fontSize: '0.8em', marginBottom: 2 }, children: "Target URL (Passthrough)" }), _jsx("input", { type: "text", className: "vscode-input", value: config.targetUrl, onChange: (e) => onUpdateConfig({ targetUrl: e.target.value }), placeholder: "http://localhost:8080", style: { width: '100%', padding: '4px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)' } })] }), _jsxs("div", { style: { marginBottom: 5, display: 'flex', alignItems: 'center' }, children: [_jsx("input", { type: "checkbox", id: "chkPassthrough", checked: config.passthroughEnabled !== false, onChange: e => onUpdateConfig({ passthroughEnabled: e.target.checked }), style: {
                                            marginRight: 6,
                                            accentColor: 'var(--vscode-button-background)',
                                            width: '14px',
                                            height: '14px',
                                            cursor: 'pointer'
                                        } }), _jsx("label", { htmlFor: "chkPassthrough", style: { fontSize: '0.8em', cursor: 'pointer', userSelect: 'none' }, title: "Forward unmatched requests to target URL", children: "Forward unmatched requests" })] }), config.passthroughEnabled && (_jsxs("div", { style: { marginBottom: 5, display: 'flex', alignItems: 'center', paddingLeft: 20 }, children: [_jsx("input", { type: "checkbox", id: "chkRouteProxy", checked: config.routeThroughProxy === true, onChange: e => onUpdateConfig({ routeThroughProxy: e.target.checked }), style: {
                                            marginRight: 6,
                                            accentColor: 'var(--vscode-button-background)',
                                            width: '14px',
                                            height: '14px',
                                            cursor: 'pointer'
                                        } }), _jsx("label", { htmlFor: "chkRouteProxy", style: { fontSize: '0.8em', cursor: 'pointer', userSelect: 'none' }, title: "Route passthrough traffic through Dirty Proxy instead of directly to target", children: "Route through Dirty Proxy" })] })), _jsxs("div", { style: { marginBottom: 5, display: 'flex', alignItems: 'center' }, children: [_jsx("input", { type: "checkbox", id: "chkRecordMode", checked: config.recordMode === true, onChange: e => onUpdateConfig({ recordMode: e.target.checked }), style: {
                                            marginRight: 6,
                                            accentColor: 'var(--vscode-charts-yellow)',
                                            width: '14px',
                                            height: '14px',
                                            cursor: 'pointer'
                                        } }), _jsx("label", { htmlFor: "chkRecordMode", style: { fontSize: '0.8em', cursor: 'pointer', userSelect: 'none', color: config.recordMode ? 'var(--vscode-charts-yellow)' : undefined }, title: "Auto-capture real responses as mock rules", children: "\uD83D\uDD34 Record Mode" })] }), _jsx("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }, children: _jsxs("div", { style: { fontSize: '0.8em' }, children: ["Status: ", isRunning ? _jsx("span", { style: { color: 'var(--vscode-testing-iconPassed)' }, children: "Running" }) : 'Stopped'] }) })] }), _jsxs("div", { style: { borderTop: '1px solid var(--vscode-panel-border)', paddingTop: 10, marginTop: 10 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, children: [_jsxs("h4", { style: { margin: 0, fontSize: '0.9em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }, onClick: () => setShowRules(!showRules), children: [_jsx(Circle, { size: 14 }), "Mock Rules (", rules.length, ")"] }), _jsx(HeaderButton, { onClick: handleAddRule, title: "Add Mock Rule", children: _jsx(Plus, { size: 14 }) })] }), showRules && rules.length > 0 && (_jsx("div", { style: { fontSize: '0.85em' }, children: rules.map((rule) => (_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '6px 8px',
                                        marginBottom: 4,
                                        backgroundColor: 'var(--vscode-list-hoverBackground)',
                                        borderRadius: 4,
                                        opacity: rule.enabled ? 1 : 0.5
                                    }, children: [_jsx("button", { onClick: () => onToggleRule(rule.id, !rule.enabled), style: {
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: rule.enabled ? 'var(--vscode-testing-iconPassed)' : 'var(--vscode-disabledForeground)',
                                                padding: 2,
                                                display: 'flex'
                                            }, title: rule.enabled ? 'Disable' : 'Enable', children: rule.enabled ? _jsx(ToggleRight, { size: 16 }) : _jsx(ToggleLeft, { size: 16 }) }), _jsxs("div", { style: { flex: 1, overflow: 'hidden' }, children: [_jsxs("div", { style: { fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 4 }, children: [rule.name, rule.hitCount && rule.hitCount > 0 && (_jsxs("span", { style: { fontSize: '0.8em', opacity: 0.7 }, children: ["(", rule.hitCount, ")"] }))] }), _jsx("div", { style: { fontSize: '0.8em', opacity: 0.7 }, children: rule.conditions.map(c => `${c.type}: ${c.pattern.substring(0, 20)}${c.pattern.length > 20 ? '...' : ''}`).join(' & ') })] }), _jsx(HeaderButton, { onClick: () => handleEditRule(rule), title: "Edit", style: { padding: 4 }, children: _jsx(Edit2, { size: 12 }) }), _jsx(HeaderButton, { onClick: () => onDeleteRule(rule.id), title: "Delete", style: { padding: 4, color: 'var(--vscode-testing-iconFailed)' }, children: _jsx(Trash2, { size: 12 }) })] }, rule.id))) })), showRules && rules.length === 0 && (_jsxs("div", { style: { textAlign: 'center', fontSize: '0.8em', opacity: 0.7, padding: '10px 0' }, children: ["No mock rules configured.", _jsx("br", {}), _jsx("span", { style: { color: 'var(--vscode-textLink-foreground)', cursor: 'pointer' }, onClick: handleAddRule, children: "Click + to add one." })] }))] }), _jsxs("div", { style: { marginTop: 15, borderTop: '1px solid var(--vscode-panel-border)', paddingTop: 10 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }, children: [_jsxs("h4", { style: { margin: 0, fontSize: '0.9em' }, children: ["Traffic (", history.length, ")"] }), history.length > 0 && (_jsx(HeaderButton, { onClick: onClear, title: "Clear Traffic History", style: { padding: 4 }, children: _jsx(Trash2, { size: 14 }) }))] }), history.length === 0 ? (_jsx("div", { style: { textAlign: 'center', marginTop: 10, fontSize: '0.8em', opacity: 0.7 }, children: "No events captured." })) : (history.map((event, i) => (_jsx(ServiceItem, { style: { paddingLeft: 5, paddingRight: 5 }, onClick: () => onSelectEvent(event), children: _jsxs("div", { style: { flex: 1, fontSize: '0.85em', overflow: 'hidden' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("span", { style: { fontWeight: 'bold' }, children: event.method }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 4 }, children: [event.matchedRule && (_jsx("span", { style: { color: 'var(--vscode-charts-green)', fontSize: '0.8em' }, children: "MOXY" })), event.passthrough && (_jsxs("span", { style: { color: 'var(--vscode-charts-blue)', fontSize: '0.8em', display: 'flex', alignItems: 'center' }, children: [_jsx(ArrowRight, { size: 10 }), " FWD"] })), _jsx("span", { style: { opacity: 0.7 }, children: event.status })] })] }), _jsx("div", { style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, title: event.url, children: event.url }), event.matchedRule && (_jsxs("div", { style: { fontSize: '0.75em', opacity: 0.7, color: 'var(--vscode-charts-green)' }, children: ["Rule: ", event.matchedRule] }))] }) }, i))))] })] }), _jsx(MockRuleModal, { open: ruleModal.open, rule: ruleModal.rule, onClose: () => setRuleModal({ open: false }), onSave: handleSaveRule })] }));
};
