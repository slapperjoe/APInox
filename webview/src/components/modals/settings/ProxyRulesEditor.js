import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styled from 'styled-components';
import { Plus, Trash, Check, X } from 'lucide-react';
import { FormGroup, SectionHeader } from './SettingsTypes';
const RulesList = styled.div `
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 10px;
`;
const RuleRow = styled.div `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    background: var(--vscode-list-hoverBackground);
    border: 1px solid ${props => props.active ? 'var(--vscode-focusBorder)' : 'transparent'};
    border-radius: 4px;
`;
const Input = styled.input `
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 4px 6px;
    border-radius: 2px;
    font-size: 12px;
    flex: 1;

    &:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
    }
`;
const Select = styled.select `
    background: var(--vscode-dropdown-background);
    color: var(--vscode-dropdown-foreground);
    border: 1px solid var(--vscode-dropdown-border);
    padding: 4px;
    border-radius: 2px;
    font-size: 12px;
`;
const IconButton = styled.button `
    background: transparent;
    border: none;
    color: var(--vscode-button-foreground);
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 2px;
    opacity: 0.7;

    &:hover {
        opacity: 1;
        background: var(--vscode-toolbar-hoverBackground);
    }
`;
export const ProxyRulesEditor = ({ config, onChange }) => {
    const rules = config.network?.proxyRules || [];
    const updateRules = (newRules) => {
        // We need to update the nested structure
        onChange('network', 'proxyRules', newRules);
    };
    const handleAddRule = () => {
        const newRule = {
            id: crypto.randomUUID(),
            pattern: '*.example.com',
            useProxy: false,
            enabled: true
        };
        updateRules([...rules, newRule]);
    };
    const handleUpdateRule = (id, field, value) => {
        const newRules = rules.map(r => r.id === id ? { ...r, [field]: value } : r);
        updateRules(newRules);
    };
    const handleDeleteRule = (id) => {
        const newRules = rules.filter(r => r.id !== id);
        updateRules(newRules);
    };
    return (_jsxs(FormGroup, { children: [_jsxs(SectionHeader, { style: { marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: ["Proxy Rules", _jsx(IconButton, { onClick: handleAddRule, title: "Add Rule", children: _jsx(Plus, { size: 14 }) })] }), _jsx("div", { style: { fontSize: '0.85em', color: 'var(--vscode-descriptionForeground)', marginBottom: 8 }, children: "Define wildcard overrides (*.example.com). Top-down priority." }), _jsxs(RulesList, { children: [rules.map((rule) => (_jsxs(RuleRow, { active: rule.enabled, children: [_jsx(IconButton, { onClick: () => handleUpdateRule(rule.id, 'enabled', !rule.enabled), title: rule.enabled ? 'Disable Rule' : 'Enable Rule', style: { color: rule.enabled ? 'var(--vscode-testing-iconPassed)' : 'var(--vscode-disabledForeground)' }, children: rule.enabled ? _jsx(Check, { size: 14 }) : _jsx(X, { size: 14 }) }), _jsx(Input, { value: rule.pattern, onChange: (e) => handleUpdateRule(rule.id, 'pattern', e.target.value), placeholder: "*.example.com" }), _jsxs(Select, { value: rule.useProxy ? 'proxy' : 'direct', onChange: (e) => handleUpdateRule(rule.id, 'useProxy', e.target.value === 'proxy'), style: { width: '80px' }, children: [_jsx("option", { value: "direct", children: "Direct" }), _jsx("option", { value: "proxy", children: "Proxy" })] }), _jsx(IconButton, { onClick: () => handleDeleteRule(rule.id), title: "Delete Rule", children: _jsx(Trash, { size: 14 }) })] }, rule.id))), rules.length === 0 && (_jsx("div", { style: { padding: '10px', textAlign: 'center', opacity: 0.5, fontStyle: 'italic', fontSize: '12px' }, children: "No rules defined. Global proxy setting applies." }))] })] }));
};
