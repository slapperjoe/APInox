import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * GlobalsTab.tsx
 *
 * Global variables management for the Settings modal.
 */
import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import styled, { keyframes, css } from 'styled-components';
import { EnvList, EnvItem, EnvDetail, FormGroup, Label, Input, IconButton, } from './SettingsTypes';
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
export const GlobalsTab = ({ config, selectedGlobalKey, setSelectedGlobalKey, onAddGlobal, onDeleteGlobal, onGlobalKeyChange, onGlobalValueChange, }) => {
    const globals = config.globals || {};
    const globalKeys = Object.keys(globals);
    // Delete confirmation state
    const [confirmDelete, setConfirmDelete] = useState(false);
    // Reset confirm state when selection changes
    useEffect(() => {
        setConfirmDelete(false);
    }, [selectedGlobalKey]);
    const handleDeleteClick = () => {
        if (!selectedGlobalKey)
            return;
        if (confirmDelete) {
            onDeleteGlobal(selectedGlobalKey);
            setConfirmDelete(false);
        }
        else {
            setConfirmDelete(true);
        }
    };
    return (_jsxs("div", { style: { display: 'flex', flex: 1, overflow: 'hidden' }, children: [_jsxs(EnvList, { children: [_jsxs("div", { style: { padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--vscode-panel-border)' }, children: [_jsx("span", { style: { fontSize: '12px', fontWeight: 600 }, children: "Globals" }), _jsx(IconButton, { onClick: onAddGlobal, title: "Add Variable", children: _jsx(Plus, { size: 14 }) })] }), globalKeys.map(key => (_jsx(EnvItem, { active: key === selectedGlobalKey, selected: key === selectedGlobalKey, onClick: () => setSelectedGlobalKey(key), children: _jsx("div", { style: { display: 'flex', alignItems: 'center', overflow: 'hidden' }, children: _jsx("span", { style: { textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }, children: key }) }) }, key)))] }), _jsxs(EnvDetail, { children: [selectedGlobalKey !== null && globals[selectedGlobalKey] !== undefined ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, children: [_jsx("h3", { style: { margin: 0, textTransform: 'uppercase', fontSize: 12 }, children: "Variable" }), _jsx(DeleteButton, { onClick: handleDeleteClick, confirming: confirmDelete, title: confirmDelete ? "Click again to confirm delete" : "Delete Variable", children: _jsx(Trash2, { size: 14 }) })] }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Key Name" }), _jsx(Input, { type: "text", value: selectedGlobalKey, onChange: e => onGlobalKeyChange(selectedGlobalKey, e.target.value) })] }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Value" }), _jsx(Input, { type: "text", value: globals[selectedGlobalKey], onChange: e => onGlobalValueChange(selectedGlobalKey, e.target.value) })] }), _jsx("div", { style: { fontSize: 12, color: 'var(--vscode-descriptionForeground)', padding: '10px', background: 'var(--vscode-textBlockQuote-background)', borderLeft: '3px solid var(--vscode-textBlockQuote-border)' }, children: _jsxs("p", { style: { margin: 0 }, children: ["Use ", _jsx("code", { children: '{{' + selectedGlobalKey + '}}' }), " in your requests to insert this value."] }) })] })) : (_jsx("div", { style: { display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--vscode-disabledForeground)' }, children: "Select a global variable to edit" })), _jsxs("div", { style: { marginTop: 20, borderTop: '1px solid var(--vscode-panel-border)', paddingTop: 15 }, children: [_jsx("h4", { style: { margin: '0 0 10px 0', fontSize: 11, textTransform: 'uppercase', color: 'var(--vscode-sideBarTitle-foreground)' }, children: "Predefined Variables" }), _jsxs("div", { style: { fontSize: 11, color: 'var(--vscode-descriptionForeground)', lineHeight: 1.6 }, children: [_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 15px' }, children: [_jsx("code", { children: '{{uuid}}' }), _jsx("span", { children: "Random UUID" }), _jsx("code", { children: '{{now}}' }), _jsx("span", { children: "ISO timestamp" }), _jsx("code", { children: '{{epoch}}' }), _jsx("span", { children: "Unix timestamp (seconds)" }), _jsx("code", { children: '{{randomInt(1,100)}}' }), _jsx("span", { children: "Random integer" }), _jsx("code", { children: '{{lorem(5)}}' }), _jsx("span", { children: "Lorem ipsum text" }), _jsx("code", { children: '{{name}}' }), _jsx("span", { children: "Random name" }), _jsx("code", { children: '{{country}}' }), _jsx("span", { children: "Random country" }), _jsx("code", { children: '{{now+1d}}' }), _jsx("span", { children: "Date math (+/- d/m/y)" })] }), _jsx("div", { style: { marginTop: 10, opacity: 0.8, fontStyle: 'italic' }, children: "Use these in request bodies or endpoints." })] })] })] })] }));
};
