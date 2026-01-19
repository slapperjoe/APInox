import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * ReplaceRulesTab.tsx
 *
 * Replace rules management for the Settings modal.
 */
import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import styled, { keyframes, css } from 'styled-components';
import { EnvList, EnvItem, EnvDetail, FormGroup, Label, Input, Select, CheckboxLabel, IconButton, } from './SettingsTypes';
// Shake animation for delete confirmation
const shakeAnimation = keyframes `
    0% { transform: translateX(0); }
    25% { transform: translateX(2px) rotate(5deg); }
    50% { transform: translateX(-2px) rotate(-5deg); }
    75% { transform: translateX(2px) rotate(5deg); }
    100% { transform: translateX(0); }
`;
const DeleteButton = styled(IconButton) `
    color: ${props => props.confirming ? 'var(--vscode-errorForeground)' : 'var(--vscode-foreground)'};
    ${props => props.confirming && css `
        animation: ${shakeAnimation} 0.5s ease-in-out infinite;
    `}
`;
export const ReplaceRulesTab = ({ rules, selectedRuleId, setSelectedRuleId, onAddRule, onDeleteRule, onRuleChange, }) => {
    const selectedRule = rules.find(r => r.id === selectedRuleId);
    // Delete confirmation state
    const [confirmDelete, setConfirmDelete] = useState(false);
    // Reset confirm state when selection changes
    useEffect(() => {
        setConfirmDelete(false);
    }, [selectedRuleId]);
    const handleDeleteClick = () => {
        if (!selectedRuleId)
            return;
        if (confirmDelete) {
            onDeleteRule(selectedRuleId);
            setConfirmDelete(false);
        }
        else {
            setConfirmDelete(true);
        }
    };
    return (_jsxs("div", { style: { display: 'flex', flex: 1, overflow: 'hidden' }, children: [_jsxs(EnvList, { children: [_jsxs("div", { style: { padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--vscode-panel-border)' }, children: [_jsx("span", { style: { fontSize: '12px', fontWeight: 600 }, children: "Rules" }), _jsx(IconButton, { onClick: onAddRule, title: "Add Rule", children: _jsx(Plus, { size: 14 }) })] }), rules.map(rule => (_jsx(EnvItem, { active: rule.id === selectedRuleId, selected: rule.id === selectedRuleId, onClick: () => setSelectedRuleId(rule.id), children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', overflow: 'hidden', gap: 6 }, children: [_jsx("input", { type: "checkbox", checked: rule.enabled, onChange: (e) => { e.stopPropagation(); onRuleChange(rule.id, 'enabled', e.target.checked); }, onClick: (e) => e.stopPropagation() }), _jsx("span", { style: { textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', opacity: rule.enabled ? 1 : 0.5 }, children: rule.name || rule.id.slice(0, 8) })] }) }, rule.id))), rules.length === 0 && (_jsxs("div", { style: { padding: '15px', textAlign: 'center', color: 'var(--vscode-disabledForeground)', fontSize: 12 }, children: ["No rules yet.", _jsx("br", {}), "Create one from Proxy view."] }))] }), _jsx(EnvDetail, { children: selectedRule ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, children: [_jsx("h3", { style: { margin: 0, textTransform: 'uppercase', fontSize: 12 }, children: "Edit Rule" }), _jsx(DeleteButton, { onClick: handleDeleteClick, confirming: confirmDelete, title: confirmDelete ? "Click again to confirm delete" : "Delete Rule", children: _jsx(Trash2, { size: 14 }) })] }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Name" }), _jsx(Input, { type: "text", value: selectedRule.name || '', onChange: e => onRuleChange(selectedRule.id, 'name', e.target.value), placeholder: "Rule Name" })] }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "XPath" }), _jsx(Input, { type: "text", value: selectedRule.xpath, onChange: e => onRuleChange(selectedRule.id, 'xpath', e.target.value), placeholder: "//element" })] }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Match Text" }), _jsx(Input, { type: "text", value: selectedRule.matchText, onChange: e => onRuleChange(selectedRule.id, 'matchText', e.target.value), placeholder: "Text to find" })] }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Replace With" }), _jsx(Input, { type: "text", value: selectedRule.replaceWith, onChange: e => onRuleChange(selectedRule.id, 'replaceWith', e.target.value), placeholder: "Replacement text" })] }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Apply To" }), _jsxs(Select, { value: selectedRule.target, onChange: e => onRuleChange(selectedRule.id, 'target', e.target.value), children: [_jsx("option", { value: "request", children: "Request Only" }), _jsx("option", { value: "response", children: "Response Only" }), _jsx("option", { value: "both", children: "Both" })] })] }), _jsx(FormGroup, { children: _jsxs(CheckboxLabel, { children: [_jsx("input", { type: "checkbox", checked: selectedRule.enabled, onChange: e => onRuleChange(selectedRule.id, 'enabled', e.target.checked) }), "Enabled"] }) })] })) : (_jsx("div", { style: { display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--vscode-disabledForeground)' }, children: "Select a rule to edit" })) })] }));
};
