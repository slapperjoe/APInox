import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styled from 'styled-components';
import { Trash2, Pencil } from 'lucide-react';
import { CustomXPathEvaluator } from '../utils/xpathEvaluator';
const Container = styled.div `
    height: 100%;
    overflow: auto;
    padding: 0;
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
`;
const Toolbar = styled.div `
    padding: 10px;
    border-bottom: 1px solid var(--vscode-panel-border);
    display: flex;
    justify-content: flex-end;
    gap: 10px;
`;
const ExtractorList = styled.div `
    padding: 10px;
`;
const ExtractorItem = styled.div `
    display: flex;
    padding: 8px;
    border: 1px solid var(--vscode-panel-border);
    background-color: var(--vscode-list-hoverBackground);
    margin-bottom: 8px;
    border-radius: 4px;
    align-items: flex-start;
    gap: 15px;
`;
const ExtractorInfo = styled.div `
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
`;
const InfoRow = styled.div `
    display: flex;
    gap: 10px;
    align-items: baseline;
`;
const Label = styled.span `
    font-weight: bold;
    color: var(--vscode-textLink-foreground);
    min-width: 80px;
    font-size: 0.9em;
`;
const Value = styled.code `
    background: var(--vscode-textCodeBlock-background);
    padding: 2px 4px;
    border-radius: 3px;
    font-family: monospace;
    word-break: break-all;
    font-size: 0.9em;
`;
const IconButton = styled.button `
    background: transparent;
    color: var(--vscode-icon-foreground);
    border: none;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;

    &:hover {
        opacity: 1;
        background-color: var(--vscode-toolbar-hoverBackground);
        border-radius: 3px;
    }
`;
const ButtonGroup = styled.div `
    display: flex;
    flex-direction: column;
    gap: 4px;
`;
export const ExtractorsPanel = ({ extractors, onChange, onEdit, rawResponse }) => {
    const handleDelete = (index) => {
        const newExtractors = [...extractors];
        newExtractors.splice(index, 1);
        onChange(newExtractors);
    };
    console.log('[ExtractorsPanel] Rendering. Extractors:', extractors.length, 'RawResponse length:', rawResponse?.length);
    return (_jsxs(Container, { children: [_jsx(Toolbar, { children: _jsx("span", { style: { marginRight: 'auto', fontWeight: 'bold', fontSize: '1.1em' }, children: "Context Variables extracted from this Step" }) }), _jsx(ExtractorList, { children: extractors.length === 0 ? (_jsx("div", { style: { padding: 20, opacity: 0.7, fontStyle: 'italic', textAlign: 'center' }, children: "No extractors defined. Select text in the Response panel to create one." })) : (extractors.map((ex, index) => {
                    let currentValue = null;
                    if (rawResponse && ex.source === 'body') {
                        try {
                            currentValue = CustomXPathEvaluator.evaluate(rawResponse, ex.path);
                            console.log(`[ExtractorsPanel] Expr: ${ex.path}, Val: ${currentValue}`);
                        }
                        catch (e) {
                            console.error('[ExtractorsPanel] Evaluation Error:', e);
                            currentValue = "Error evaluating XPath";
                        }
                    }
                    return (_jsxs(ExtractorItem, { children: [_jsxs(ExtractorInfo, { children: [_jsxs(InfoRow, { children: [_jsx(Label, { children: "Variable:" }), _jsx(Value, { style: { color: 'var(--vscode-debugTokenExpression-name)' }, children: ex.variable })] }), _jsxs(InfoRow, { children: [_jsx(Label, { children: "Source:" }), _jsx("span", { children: ex.source })] }), _jsxs(InfoRow, { children: [_jsx(Label, { children: "Path:" }), _jsx(Value, { children: ex.path })] }), ex.defaultValue && (_jsxs(InfoRow, { children: [_jsx(Label, { style: { color: 'var(--vscode-editorInfo-foreground)' }, children: "Default:" }), _jsx(Value, { style: { color: 'var(--vscode-editorInfo-foreground)' }, children: ex.defaultValue })] })), currentValue !== null && (_jsxs(InfoRow, { children: [_jsx(Label, { style: { color: 'var(--vscode-testing-iconPassed)' }, children: "Preview:" }), _jsx(Value, { style: { borderColor: 'var(--vscode-testing-iconPassed)', border: '1px solid transparent', backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)' }, children: currentValue || "(No Match)" })] }))] }), _jsxs(ButtonGroup, { children: [onEdit && (_jsx(IconButton, { onClick: () => onEdit(ex, index), title: "Edit Extractor", children: _jsx(Pencil, { size: 16 }) })), _jsx(IconButton, { onClick: () => handleDelete(index), title: "Delete Extractor", style: { color: 'var(--vscode-errorForeground)' }, children: _jsx(Trash2, { size: 16 }) })] })] }, ex.id || index));
                })) })] }));
};
