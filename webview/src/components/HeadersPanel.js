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
const HeaderRow = styled.div `
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
export const HeadersPanel = ({ headers, onChange, contentType }) => {
    // Filter out Content-Type as it's managed by the toolbar dropdown
    const filteredHeaders = Object.fromEntries(Object.entries(headers || {}).filter(([key]) => key.toLowerCase() !== 'content-type'));
    const entries = Object.entries(filteredHeaders);
    const displayContentType = contentType || 'application/soap+xml';
    const updateHeader = (oldKey, newKey, newValue) => {
        // Prevent adding Content-Type via this panel
        if (newKey.toLowerCase() === 'content-type') {
            return; // Silently ignore - Content-Type is managed by toolbar
        }
        const newHeaders = { ...headers };
        if (oldKey !== newKey) {
            delete newHeaders[oldKey];
        }
        newHeaders[newKey] = newValue;
        onChange(newHeaders);
    };
    const removeHeader = (key) => {
        const newHeaders = { ...headers };
        delete newHeaders[key];
        onChange(newHeaders);
    };
    const addHeader = () => {
        const newHeaders = { ...headers };
        // Find unique key
        let count = 1;
        while (newHeaders[`Header${count}`])
            count++;
        newHeaders[`Header${count}`] = '';
        onChange(newHeaders);
    };
    return (_jsxs(Container, { children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }, children: [_jsx("h3", { children: "HTTP Headers" }), _jsxs(IconButton, { onClick: addHeader, title: "Add Header", children: [_jsx(Plus, { size: 16 }), " Add"] })] }), _jsxs(HeaderRow, { style: { opacity: 0.7 }, children: [_jsx("div", { style: { flex: 1 }, children: _jsx("div", { style: {
                                padding: '6px 8px',
                                background: 'var(--vscode-input-background)',
                                border: '1px solid var(--vscode-input-border)',
                                borderRadius: 4,
                                color: 'var(--vscode-disabledForeground)',
                                fontFamily: 'monospace',
                                fontSize: 12
                            }, children: "Content-Type" }) }), _jsx("div", { style: { flex: 1 }, children: _jsx("div", { style: {
                                padding: '6px 8px',
                                background: 'var(--vscode-input-background)',
                                border: '1px solid var(--vscode-input-border)',
                                borderRadius: 4,
                                color: 'var(--vscode-disabledForeground)',
                                fontFamily: 'monospace',
                                fontSize: 12
                            }, children: displayContentType }) }), _jsx("div", { style: { width: 30, textAlign: 'center', fontSize: 10, opacity: 0.5 }, title: "Managed by toolbar dropdown", children: "\uD83D\uDD12" })] }), entries.length === 0 && (_jsx("div", { style: { opacity: 0.6, fontStyle: 'italic', padding: 10, textAlign: 'center' }, children: "No custom headers defined." })), entries.map(([key, value], index) => (_jsxs(HeaderRow, { children: [_jsx("div", { style: { flex: 1 }, children: _jsx(MonacoSingleLineInput, { value: key, onChange: (newKey) => updateHeader(key, newKey, value), placeholder: "Header Name" }) }), _jsx("div", { style: { flex: 1 }, children: _jsx(MonacoSingleLineInput, { value: value, onChange: (newValue) => updateHeader(key, key, newValue), placeholder: "Value" }) }), _jsx(IconButton, { onClick: () => removeHeader(key), title: "Delete Header", children: _jsx(Trash2, { size: 14 }) })] }, index)))] }));
};
