import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import styled from 'styled-components';
import { FlaskConical, Play } from 'lucide-react';
const Overlay = styled.div `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
`;
const Content = styled.div `
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    border: 1px solid var(--vscode-widget-border);
    width: 400px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 10px rgba(0,0,0,0.25);
`;
const Header = styled.div `
    padding: 10px;
    font-weight: bold;
    border-bottom: 1px solid var(--vscode-widget-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
`;
const Body = styled.div `
    padding: 10px;
    flex: 1;
    overflow-y: auto;
`;
const Footer = styled.div `
    padding: 10px;
    border-top: 1px solid var(--vscode-widget-border);
    display: flex;
    justify-content: flex-end;
    gap: 10px;
`;
const Button = styled.button `
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 6px 12px;
    cursor: pointer;
    &:hover {
        background: var(--vscode-button-hoverBackground);
    }
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;
const Item = styled.div `
    padding: 4px;
    padding-left: ${props => props.depth * 20 + 5}px;
    cursor: pointer;
    background: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent'};
    color: ${props => props.active ? 'var(--vscode-list-activeSelectionForeground)' : 'inherit'};
    display: flex;
    align-items: center;
    gap: 6px;
    &:hover {
        background: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-list-hoverBackground)'};
    }
`;
export const AddToTestCaseModal = ({ projects, onClose, onAdd }) => {
    const [selectedId, setSelectedId] = useState(null);
    const [selectionType, setSelectionType] = useState(null);
    // Flatten logic for simple tree
    // We want to verify selection:
    // 1. Select a Suite -> "Create new Case in this Suite"
    // 2. Select a Case -> "Add step to this Case"
    // Actually simplicity: List Suites. Under each suite, list Cases.
    // If Suite Selected -> Button says "Add to New Case"
    // If Case Selected -> Button says "Add to Case"
    const handleSelect = (id, type) => {
        setSelectedId(id);
        setSelectionType(type);
    };
    const handleSubmit = () => {
        if (!selectedId || !selectionType)
            return;
        if (selectionType === 'suite') {
            onAdd({ type: 'new', suiteId: selectedId });
        }
        else {
            onAdd({ type: 'existing', caseId: selectedId });
        }
    };
    return (_jsx(Overlay, { onClick: onClose, children: _jsxs(Content, { onClick: e => e.stopPropagation(), children: [_jsx(Header, { children: "Add to Test Case" }), _jsxs(Body, { children: [_jsx("div", { style: { marginBottom: 10, fontSize: '0.9em', opacity: 0.8 }, children: "Select a Test Case to append to, or a Test Suite to create a new Case in." }), projects.map(p => (_jsxs("div", { children: [_jsx("div", { style: { padding: 4, fontWeight: 'bold' }, children: p.name }), (p.testSuites || []).map(suite => (_jsxs("div", { children: [_jsxs(Item, { depth: 1, active: selectedId === suite.id, onClick: () => handleSelect(suite.id, 'suite'), children: [_jsx(FlaskConical, { size: 14 }), suite.name] }), (suite.testCases || []).map(tc => (_jsxs(Item, { depth: 2, active: selectedId === tc.id, onClick: () => handleSelect(tc.id, 'case'), children: [_jsx(Play, { size: 10 }), tc.name] }, tc.id)))] }, suite.id))), (!p.testSuites || p.testSuites.length === 0) && (_jsx("div", { style: { paddingLeft: 20, fontStyle: 'italic', opacity: 0.6 }, children: "No Test Suites" }))] }, p.name)))] }), _jsxs(Footer, { children: [_jsx(Button, { onClick: onClose, style: { background: 'transparent', border: '1px solid var(--vscode-button-background)' }, children: "Cancel" }), _jsx(Button, { disabled: !selectedId, onClick: handleSubmit, children: selectionType === 'suite' ? 'Create New Case' : 'Add to Case' })] })] }) }));
};
