import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Modal, Button } from './Modal';
export const ExtractorModal = ({ isOpen, data, onClose, onSave }) => {
    const [localData, setLocalData] = useState({ xpath: '', value: '', source: 'body', variableName: '', defaultValue: '' });
    useEffect(() => {
        if (isOpen && data) {
            // If no defaultValue is set and we have a preview value, use that as the initial default
            const initialDefault = data.defaultValue || data.value || '';
            setLocalData({ ...data, defaultValue: initialDefault });
        }
    }, [isOpen, data]);
    if (!isOpen || !data)
        return null;
    const isEditing = !!localData.editingId;
    return (_jsxs(Modal, { isOpen: isOpen, onClose: onClose, title: isEditing ? "Edit Property Extractor" : "Create Property Extractor", width: 600, footer: _jsxs(_Fragment, { children: [_jsx(Button, { onClick: onClose, style: { marginRight: 10, background: 'transparent', border: '1px solid var(--vscode-button-secondaryForeground)' }, children: "Cancel" }), _jsx(Button, { onClick: () => onSave(localData), disabled: !localData.variableName.trim(), children: isEditing ? 'Save Changes' : 'Save Extractor' })] }), children: [_jsxs("div", { style: { marginBottom: 15 }, children: [_jsx("label", { style: { display: 'block', marginBottom: 5, fontWeight: 'bold' }, children: "Target Variable Name" }), _jsx("input", { style: { width: '100%', padding: 8, background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 2 }, value: localData.variableName, placeholder: "e.g. authToken", onChange: (e) => setLocalData({ ...localData, variableName: e.target.value }), autoFocus: true }), _jsxs("div", { style: { fontSize: '0.8em', opacity: 0.7, marginTop: 4 }, children: ["This variable will be available in subsequent steps as ", _jsx("code", { children: '${#TestCase#VariableName}' }), "."] })] }), _jsxs("div", { style: { marginBottom: 15 }, children: [_jsx("label", { style: { display: 'block', marginBottom: 5, fontWeight: 'bold' }, children: "XPath Expression" }), _jsx("textarea", { style: { width: '100%', height: 60, padding: 8, background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 2, fontFamily: 'monospace', fontSize: '0.9em' }, value: localData.xpath, onChange: (e) => setLocalData({ ...localData, xpath: e.target.value }) })] }), _jsxs("div", { style: { marginBottom: 15 }, children: [_jsx("label", { style: { display: 'block', marginBottom: 5, fontWeight: 'bold' }, children: "Default Value" }), _jsx("input", { style: { width: '100%', padding: 8, background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 2 }, value: localData.defaultValue || '', placeholder: "Value to use if this step hasn't been run yet", onChange: (e) => setLocalData({ ...localData, defaultValue: e.target.value }) }), _jsx("div", { style: { fontSize: '0.8em', opacity: 0.7, marginTop: 4 }, children: "This value will be used when running subsequent steps if this step hasn't been executed yet." })] })] }));
};
