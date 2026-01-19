import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * EnvironmentsTab.tsx
 *
 * Environment profiles management for the Settings modal.
 */
import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Check, Download, Upload } from 'lucide-react';
import styled, { keyframes, css } from 'styled-components';
import { EnvList, EnvItem, EnvDetail, FormGroup, Label, Input, Badge, IconButton, PrimaryButton, } from './SettingsTypes';
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
export const EnvironmentsTab = ({ config, selectedEnvKey, setSelectedEnvKey, onAddEnv, onDeleteEnv, onSetActive, onEnvChange, onImportEnvironments, }) => {
    const environments = config.environments || {};
    const envKeys = Object.keys(environments);
    const fileInputRef = useRef(null);
    // Delete confirmation state
    const [confirmDelete, setConfirmDelete] = useState(false);
    // Reset confirm state when selection changes
    useEffect(() => {
        setConfirmDelete(false);
    }, [selectedEnvKey]);
    const handleDeleteClick = () => {
        if (!selectedEnvKey)
            return;
        if (confirmDelete) {
            onDeleteEnv(selectedEnvKey);
            setConfirmDelete(false);
        }
        else {
            setConfirmDelete(true);
        }
    };
    const handleExport = () => {
        const exportData = {
            environments: config.environments || {},
            activeEnvironment: config.activeEnvironment
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dirty-soap-environments.json';
        a.click();
        URL.revokeObjectURL(url);
    };
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file || !onImportEnvironments)
            return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result);
                if (data.environments && typeof data.environments === 'object') {
                    onImportEnvironments(data.environments, data.activeEnvironment);
                }
            }
            catch (err) {
                console.error('Failed to parse environments file:', err);
            }
        };
        reader.readAsText(file);
        // Reset input so same file can be selected again
        e.target.value = '';
    };
    return (_jsxs("div", { style: { display: 'flex', flex: 1, overflow: 'hidden' }, children: [_jsxs(EnvList, { children: [_jsxs("div", { style: { padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--vscode-panel-border)' }, children: [_jsx("span", { style: { fontSize: '12px', fontWeight: 600 }, children: "Profiles" }), _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx(IconButton, { onClick: handleExport, title: "Export Environments", children: _jsx(Download, { size: 14 }) }), _jsx(IconButton, { onClick: handleImportClick, title: "Import Environments", children: _jsx(Upload, { size: 14 }) }), _jsx(IconButton, { onClick: onAddEnv, title: "Add Environment", children: _jsx(Plus, { size: 14 }) }), _jsx("input", { ref: fileInputRef, type: "file", accept: ".json", style: { display: 'none' }, onChange: handleFileChange })] })] }), envKeys.map(key => (_jsx(EnvItem, { active: key === selectedEnvKey, selected: key === selectedEnvKey, onClick: () => setSelectedEnvKey(key), children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', overflow: 'hidden' }, children: [_jsx("span", { style: { textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }, children: key }), config.activeEnvironment === key && _jsx(Badge, { children: "Active" })] }) }, key)))] }), _jsx(EnvDetail, { children: selectedEnvKey && environments[selectedEnvKey] ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, children: [_jsx("h3", { style: { margin: 0, textTransform: 'uppercase', fontSize: 12 }, children: selectedEnvKey }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [config.activeEnvironment !== selectedEnvKey && (_jsxs(PrimaryButton, { onClick: () => onSetActive(selectedEnvKey), style: { height: '20px', background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)' }, children: [_jsx(Check, { size: 14 }), " Set Active"] })), _jsx(DeleteButton, { onClick: handleDeleteClick, confirming: confirmDelete, title: confirmDelete ? "Click again to confirm delete" : "Delete Environment", children: _jsx(Trash2, { size: 14 }) })] })] }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Endpoint URL" }), _jsx(Input, { type: "text", value: environments[selectedEnvKey].endpoint_url ?? '', onChange: e => onEnvChange(selectedEnvKey, 'endpoint_url', e.target.value), placeholder: "http://api.example.com/service.svc" })] }), _jsxs(FormGroup, { children: [_jsxs(Label, { children: ["Short Code (used in ", '{{env}}', ")"] }), _jsx(Input, { type: "text", value: environments[selectedEnvKey].env ?? '', onChange: e => onEnvChange(selectedEnvKey, 'env', e.target.value), placeholder: "dev01" })] }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Color" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '10px' }, children: [_jsx(Input, { type: "color", value: environments[selectedEnvKey].color ?? '#58A6FF', onChange: e => onEnvChange(selectedEnvKey, 'color', e.target.value), style: { width: '50px', padding: '2px', height: '30px' } }), _jsx("span", { style: { fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }, children: environments[selectedEnvKey].color ?? '#58A6FF' })] })] }), _jsx("div", { style: { fontSize: 12, color: 'var(--vscode-descriptionForeground)', padding: '10px', background: 'var(--vscode-textBlockQuote-background)', borderLeft: '3px solid var(--vscode-textBlockQuote-border)' }, children: _jsxs("p", { style: { margin: 0 }, children: ["Use ", _jsx("code", { children: '{{url}}' }), " in your requests to reference the Endpoint URL.", _jsx("br", {}), "Use ", _jsx("code", { children: '{{env}}' }), " to reference the Short Code."] }) })] })) : (_jsx("div", { style: { display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--vscode-disabledForeground)' }, children: "Select an environment to edit" })) })] }));
};
