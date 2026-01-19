import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * ServerTab.tsx
 *
 * Unified server configuration tab for Settings modal.
 * Combines proxy and mock server settings with mode toggle.
 */
import { useState } from 'react';
import { Network, Power, Plus, Edit2, Trash2, FolderOpen, RotateCcw, GripVertical } from 'lucide-react';
import { ScrollableForm, FormGroup, Label, Input, CheckboxLabel, SectionHeader, IconButton, PrimaryButton, } from './SettingsTypes';
import { MockRuleModal } from '../MockRuleModal';
const MODE_OPTIONS = [
    { value: 'off', label: 'Off', description: 'Server stopped' },
    { value: 'mock', label: 'Mock', description: 'Return canned responses' },
    { value: 'proxy', label: 'Proxy', description: 'Traffic logging + replace rules' },
    { value: 'both', label: 'Both', description: 'Mock + Proxy rules applied' },
];
export const ServerTab = ({ config, serverConfig, onServerConfigChange, configPath, onSelectConfigFile, onInjectConfig, onRestoreConfig, }) => {
    const [selectedRuleId, setSelectedRuleId] = useState(null);
    const [ruleModal, setRuleModal] = useState({ open: false });
    const [draggedId, setDraggedId] = useState(null);
    const [dropTargetId, setDropTargetId] = useState(null);
    const rules = serverConfig.mockRules || [];
    // Drag-drop handlers for rule reordering
    const handleDragStart = (e, id) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
    };
    const handleDragOver = (e, id) => {
        e.preventDefault();
        if (draggedId && draggedId !== id) {
            setDropTargetId(id);
        }
    };
    const handleDragLeave = () => {
        setDropTargetId(null);
    };
    const handleDrop = (e, targetId) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId)
            return;
        const draggedIndex = rules.findIndex(r => r.id === draggedId);
        const targetIndex = rules.findIndex(r => r.id === targetId);
        if (draggedIndex >= 0 && targetIndex >= 0) {
            const reordered = [...rules];
            const [removed] = reordered.splice(draggedIndex, 1);
            reordered.splice(targetIndex, 0, removed);
            onServerConfigChange({ mockRules: reordered });
        }
        setDraggedId(null);
        setDropTargetId(null);
    };
    const handleDragEnd = () => {
        setDraggedId(null);
        setDropTargetId(null);
    };
    const handleAddRule = () => {
        setRuleModal({ open: true, rule: null });
    };
    const handleEditRule = (rule) => {
        setRuleModal({ open: true, rule });
    };
    const handleSaveRule = (rule) => {
        const existingIndex = rules.findIndex(r => r.id === rule.id);
        if (existingIndex >= 0) {
            const updated = [...rules];
            updated[existingIndex] = rule;
            onServerConfigChange({ mockRules: updated });
        }
        else {
            onServerConfigChange({ mockRules: [...rules, rule] });
        }
    };
    const handleDeleteRule = (id) => {
        onServerConfigChange({ mockRules: rules.filter(r => r.id !== id) });
        if (selectedRuleId === id)
            setSelectedRuleId(null);
    };
    const handleToggleRule = (id, enabled) => {
        onServerConfigChange({
            mockRules: rules.map(r => r.id === id ? { ...r, enabled } : r)
        });
    };
    return (_jsxs(ScrollableForm, { children: [_jsxs(SectionHeader, { style: { marginTop: 0 }, children: [_jsx(Network, { size: 14, style: { verticalAlign: 'middle', marginRight: 6 } }), "Intercepting Server"] }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Mode" }), _jsx("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap' }, children: MODE_OPTIONS.map(opt => (_jsxs("label", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '8px 14px',
                                borderRadius: 4,
                                cursor: 'pointer',
                                background: serverConfig.mode === opt.value
                                    ? 'var(--vscode-button-background)'
                                    : 'var(--vscode-input-background)',
                                color: serverConfig.mode === opt.value
                                    ? 'var(--vscode-button-foreground)'
                                    : 'var(--vscode-input-foreground)',
                                border: '1px solid var(--vscode-input-border)',
                                fontSize: 12,
                            }, children: [_jsx("input", { type: "radio", name: "serverMode", value: opt.value, checked: serverConfig.mode === opt.value, onChange: () => onServerConfigChange({ mode: opt.value }), style: { display: 'none' } }), opt.label] }, opt.value))) }), _jsx("div", { style: { fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginTop: 6 }, children: MODE_OPTIONS.find(o => o.value === serverConfig.mode)?.description })] }), _jsxs("div", { style: { display: 'flex', gap: 16 }, children: [_jsxs(FormGroup, { style: { flex: 1 }, children: [_jsx(Label, { children: "Port" }), _jsx(Input, { type: "number", min: 1, max: 65535, value: serverConfig.port, onChange: e => onServerConfigChange({ port: parseInt(e.target.value) || 9000 }) })] }), _jsxs(FormGroup, { style: { flex: 3 }, children: [_jsx(Label, { children: "Target URL" }), _jsx(Input, { type: "text", placeholder: "https://api.example.com/services", value: serverConfig.targetUrl, onChange: e => onServerConfigChange({ targetUrl: e.target.value }) })] })] }), _jsx(FormGroup, { children: _jsxs(CheckboxLabel, { children: [_jsx("input", { type: "checkbox", checked: serverConfig.useSystemProxy ?? false, onChange: e => onServerConfigChange({ useSystemProxy: e.target.checked }) }), "Use System Proxy (for corporate proxies)"] }) }), _jsxs(SectionHeader, { children: [_jsx(FolderOpen, { size: 14, style: { verticalAlign: 'middle', marginRight: 6 } }), "Config Switcher"] }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Web.config / App.config Path" }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx(Input, { type: "text", value: configPath || config.lastConfigPath || '', placeholder: "Select a config file...", readOnly: true, style: { flex: 1 } }), _jsx(IconButton, { onClick: onSelectConfigFile, title: "Browse", children: _jsx(FolderOpen, { size: 14 }) })] })] }), _jsxs("div", { style: { display: 'flex', gap: 10 }, children: [_jsxs(PrimaryButton, { onClick: onInjectConfig, disabled: !configPath && !config.lastConfigPath, style: { opacity: (!configPath && !config.lastConfigPath) ? 0.5 : 1 }, children: [_jsx(Power, { size: 12 }), " Inject Server URL"] }), _jsxs(PrimaryButton, { onClick: onRestoreConfig, disabled: !configPath && !config.lastConfigPath, style: {
                            opacity: (!configPath && !config.lastConfigPath) ? 0.5 : 1,
                            background: 'var(--vscode-button-secondaryBackground)',
                            color: 'var(--vscode-button-secondaryForeground)'
                        }, children: [_jsx(RotateCcw, { size: 12 }), " Restore Original"] })] }), _jsxs(_Fragment, { children: [_jsx(SectionHeader, { children: "Mock Options" }), _jsx(FormGroup, { children: _jsxs(CheckboxLabel, { children: [_jsx("input", { type: "checkbox", checked: serverConfig.passthroughEnabled, onChange: e => onServerConfigChange({ passthroughEnabled: e.target.checked }) }), "Forward unmatched requests to target"] }) }), _jsx(FormGroup, { children: _jsxs(CheckboxLabel, { children: [_jsx("input", { type: "checkbox", checked: serverConfig.recordMode ?? false, onChange: e => onServerConfigChange({ recordMode: e.target.checked }) }), _jsx("span", { style: { color: serverConfig.recordMode ? 'var(--vscode-charts-yellow)' : undefined }, children: "\uD83D\uDD34 Record Mode (auto-capture responses as mocks)" })] }) }), _jsxs(FormGroup, { children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, children: [_jsxs(Label, { style: { marginBottom: 0 }, children: ["Mock Rules (", rules.length, ")"] }), _jsxs(PrimaryButton, { onClick: handleAddRule, style: { padding: '4px 10px' }, children: [_jsx(Plus, { size: 12 }), " Add Rule"] })] }), rules.length === 0 ? (_jsxs("div", { style: {
                                    padding: 20,
                                    textAlign: 'center',
                                    color: 'var(--vscode-descriptionForeground)',
                                    background: 'var(--vscode-input-background)',
                                    borderRadius: 4,
                                    fontSize: 12
                                }, children: ["No mock rules configured.", _jsx("br", {}), _jsx("span", { style: { color: 'var(--vscode-textLink-foreground)', cursor: 'pointer' }, onClick: handleAddRule, children: "Click to add your first rule." })] })) : (_jsx("div", { style: {
                                    border: '1px solid var(--vscode-input-border)',
                                    borderRadius: 4,
                                    overflow: 'hidden'
                                }, children: rules.map((rule, index) => (_jsxs("div", { draggable: true, onDragStart: (e) => handleDragStart(e, rule.id), onDragOver: (e) => handleDragOver(e, rule.id), onDragLeave: handleDragLeave, onDrop: (e) => handleDrop(e, rule.id), onDragEnd: handleDragEnd, style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '8px 12px',
                                        background: draggedId === rule.id
                                            ? 'var(--vscode-editor-selectionBackground)'
                                            : dropTargetId === rule.id
                                                ? 'var(--vscode-list-hoverBackground)'
                                                : selectedRuleId === rule.id
                                                    ? 'var(--vscode-list-activeSelectionBackground)'
                                                    : index % 2 === 0
                                                        ? 'var(--vscode-input-background)'
                                                        : 'transparent',
                                        borderBottom: index < rules.length - 1 ? '1px solid var(--vscode-input-border)' : 'none',
                                        cursor: 'grab',
                                        opacity: draggedId === rule.id ? 0.5 : rule.enabled ? 1 : 0.5,
                                        borderTop: dropTargetId === rule.id ? '2px solid var(--vscode-focusBorder)' : 'none'
                                    }, onClick: () => setSelectedRuleId(rule.id), children: [_jsx(GripVertical, { size: 12, style: { cursor: 'grab', opacity: 0.5 } }), _jsx("input", { type: "checkbox", checked: rule.enabled, onChange: e => {
                                                e.stopPropagation();
                                                handleToggleRule(rule.id, e.target.checked);
                                            }, style: { cursor: 'pointer' } }), _jsxs("div", { style: { flex: 1, overflow: 'hidden' }, children: [_jsx("div", { style: { fontWeight: 500, fontSize: 12 }, children: rule.name }), _jsx("div", { style: { fontSize: 10, color: 'var(--vscode-descriptionForeground)' }, children: rule.conditions.map(c => `${c.type}: ${c.pattern.substring(0, 25)}${c.pattern.length > 25 ? '...' : ''}`).join(' & ') })] }), rule.hitCount !== undefined && rule.hitCount > 0 && (_jsxs("span", { style: { fontSize: 10, opacity: 0.7 }, children: ["(", rule.hitCount, ")"] })), _jsx(IconButton, { onClick: (e) => { e.stopPropagation(); handleEditRule(rule); }, title: "Edit", children: _jsx(Edit2, { size: 12 }) }), _jsx(IconButton, { onClick: (e) => { e.stopPropagation(); handleDeleteRule(rule.id); }, title: "Delete", style: { color: 'var(--vscode-testing-iconFailed)' }, children: _jsx(Trash2, { size: 12 }) })] }, rule.id))) }))] })] }), _jsx(MockRuleModal, { open: ruleModal.open, rule: ruleModal.rule, onClose: () => setRuleModal({ open: false }), onSave: handleSaveRule })] }));
};
