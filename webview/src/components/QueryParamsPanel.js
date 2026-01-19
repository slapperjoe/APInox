import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styled from 'styled-components';
import { Plus, Trash2 } from 'lucide-react';
import { MonacoSingleLineInput } from './MonacoSingleLineInput';
const Container = styled.div `
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 10px;
    gap: 10px;
    overflow-y: auto;
`;
const ParamRow = styled.div `
    display: flex;
    gap: 10px;
    align-items: center;
`;
const IconButton = styled.button `
    background: transparent;
    border: none;
    color: var(--vscode-icon-foreground);
    cursor: pointer;
    padding: 4px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    &:hover {
        background: var(--vscode-toolbar-hoverBackground);
        color: var(--vscode-foreground);
    }
`;
const Label = styled.div `
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    text-transform: uppercase;
    margin-bottom: 4px;
`;
export const QueryParamsPanel = ({ params, onChange, title = 'Query Parameters', paramLabel = 'Param', readOnly = false }) => {
    const entries = Object.entries(params || {});
    const updateParam = (oldKey, newKey, newValue) => {
        if (readOnly)
            return;
        const newParams = { ...params };
        if (oldKey !== newKey) {
            delete newParams[oldKey];
        }
        newParams[newKey] = newValue;
        onChange(newParams);
    };
    const removeParam = (key) => {
        if (readOnly)
            return;
        const newParams = { ...params };
        delete newParams[key];
        onChange(newParams);
    };
    const addParam = () => {
        if (readOnly)
            return;
        const newParams = { ...params };
        let count = 1;
        while (newParams[`${paramLabel.toLowerCase()}${count}`])
            count++;
        newParams[`${paramLabel.toLowerCase()}${count}`] = '';
        onChange(newParams);
    };
    return (_jsxs(Container, { children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }, children: [_jsx("h3", { style: { margin: 0 }, children: title }), !readOnly && (_jsxs(IconButton, { onClick: addParam, title: `Add ${paramLabel}`, children: [_jsx(Plus, { size: 16 }), " Add"] }))] }), _jsxs(ParamRow, { style: { opacity: 0.7 }, children: [_jsx("div", { style: { flex: 1 }, children: _jsx(Label, { children: "Key" }) }), _jsx("div", { style: { flex: 1 }, children: _jsx(Label, { children: "Value" }) }), !readOnly && _jsx("div", { style: { width: 30 } })] }), entries.length === 0 && (_jsx("div", { style: { opacity: 0.6, fontStyle: 'italic', padding: 10, textAlign: 'center' }, children: readOnly ? `No ${title.toLowerCase()} defined.` : `No ${title.toLowerCase()} defined. Click "Add" to create one.` })), entries.map(([key, value], index) => (_jsxs(ParamRow, { children: [_jsx("div", { style: { flex: 1 }, children: _jsx(MonacoSingleLineInput, { value: key, onChange: (newKey) => updateParam(key, newKey, value), placeholder: "parameter_name", readOnly: readOnly }) }), _jsx("div", { style: { flex: 1 }, children: _jsx(MonacoSingleLineInput, { value: value, onChange: (newValue) => updateParam(key, key, newValue), placeholder: "value", readOnly: readOnly }) }), !readOnly && (_jsx(IconButton, { onClick: () => removeParam(key), title: `Delete ${paramLabel}`, children: _jsx(Trash2, { size: 14 }) }))] }, index))), entries.length > 0 && (_jsxs("div", { style: {
                    marginTop: 10,
                    padding: 8,
                    background: 'var(--vscode-textBlockQuote-background)',
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: 'monospace',
                    wordBreak: 'break-all'
                }, children: [_jsx(Label, { children: "Preview" }), "?", entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')] }))] }));
};
