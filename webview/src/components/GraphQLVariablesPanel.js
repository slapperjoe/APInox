import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * GraphQLVariablesPanel - JSON editor for GraphQL variables
 */
import React from 'react';
import styled from 'styled-components';
import Editor from '@monaco-editor/react';
const Container = styled.div `
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    overflow: hidden;
`;
const Header = styled.div `
    padding: 10px 15px;
    border-bottom: 1px solid var(--vscode-panel-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
`;
const EditorContainer = styled.div `
    flex: 1;
    overflow: hidden;
`;
const Hint = styled.div `
    padding: 8px 15px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-textBlockQuote-background);
    border-top: 1px solid var(--vscode-panel-border);
`;
const ErrorBanner = styled.div `
    padding: 8px 15px;
    font-size: 12px;
    color: var(--vscode-errorForeground);
    background: var(--vscode-inputValidation-errorBackground);
    border-top: 1px solid var(--vscode-inputValidation-errorBorder);
`;
export const GraphQLVariablesPanel = ({ variables, operationName, onChange, onOperationNameChange, readOnly = false }) => {
    const [error, setError] = React.useState(null);
    // Convert variables object to JSON string for editing
    const jsonString = React.useMemo(() => {
        try {
            return JSON.stringify(variables || {}, null, 2);
        }
        catch {
            return '{}';
        }
    }, [variables]);
    const handleChange = (value) => {
        if (!value) {
            onChange({});
            setError(null);
            return;
        }
        try {
            const parsed = JSON.parse(value);
            onChange(parsed);
            setError(null);
        }
        catch (e) {
            setError(`Invalid JSON: ${e.message}`);
        }
    };
    return (_jsxs(Container, { children: [_jsxs(Header, { children: [_jsx("h3", { style: { margin: 0 }, children: "GraphQL Variables" }), onOperationNameChange && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("label", { style: { fontSize: 12, color: 'var(--vscode-descriptionForeground)' }, children: "Operation:" }), _jsx("input", { type: "text", value: operationName || '', onChange: (e) => onOperationNameChange(e.target.value), placeholder: "operationName", disabled: readOnly, style: {
                                    background: 'var(--vscode-input-background)',
                                    color: 'var(--vscode-input-foreground)',
                                    border: '1px solid var(--vscode-input-border)',
                                    padding: '4px 8px',
                                    borderRadius: 3,
                                    fontSize: 12,
                                    width: 150
                                } })] }))] }), _jsx(EditorContainer, { children: _jsx(Editor, { height: "100%", language: "json", value: jsonString, onChange: handleChange, theme: "vs-dark", options: {
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: 'off',
                        folding: false,
                        wordWrap: 'on',
                        scrollBeyondLastLine: false,
                        readOnly,
                        automaticLayout: true,
                        tabSize: 2
                    } }) }), error && _jsx(ErrorBanner, { children: error }), _jsx(Hint, { children: "Variables are passed to your GraphQL query. Use $variableName in your query to reference them." })] }));
};
