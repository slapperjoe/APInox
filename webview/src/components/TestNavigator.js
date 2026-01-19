import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { Play, Plus, ChevronRight, ChevronDown, FlaskConical, Folder, Trash2 } from 'lucide-react';
const Container = styled.div `
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--vscode-foreground);
`;
const Toolbar = styled.div `
    display: flex;
    align-items: center;
    padding: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
    gap: 8px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--vscode-sideBarTitle-foreground);
`;
// Shake animation for delete confirmation
const shakeAnimation = keyframes `
    0% { transform: translateX(0); }
    25% { transform: translateX(2px) rotate(5deg); }
    50% { transform: translateX(-2px) rotate(-5deg); }
    75% { transform: translateX(2px) rotate(5deg); }
    100% { transform: translateX(0); }
`;
const IconButton = styled.button `
    background: none;
    border: none;
    cursor: pointer;
    color: var(--vscode-icon-foreground);
    padding: 2px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
        background-color: var(--vscode-toolbar-hoverBackground);
    }
    
    ${props => props.shake && css `
        animation: ${shakeAnimation} 0.5s ease-in-out infinite;
        color: var(--vscode-errorForeground);
    `}
`;
const TreeItem = styled.div `
    padding: 4px 8px;
    padding-left: ${props => props.depth * 16 + 8}px;
    cursor: pointer;
    display: flex;
    align-items: center;
    font-size: 13px;
    background-color: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent'};
    color: ${props => props.active ? 'var(--vscode-list-activeSelectionForeground)' : 'inherit'};

    &:hover {
        background-color: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-list-hoverBackground)'};
    }
`;
export const TestNavigator = ({ projects, onAddSuite, onDeleteSuite, onRunSuite, onAddTestCase, onRunCase, onDeleteTestCase, onRenameTestCase }) => {
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [renameId, setRenameId] = useState(null);
    const [renameName, setRenameName] = useState('');
    const toggleExpand = (id, e) => {
        if (e)
            e.stopPropagation();
        const newSet = new Set(expandedIds);
        if (newSet.has(id))
            newSet.delete(id);
        else
            newSet.add(id);
        setExpandedIds(newSet);
    };
    const handleDeleteSuite = (suiteId, e) => {
        e.stopPropagation();
        if (deleteConfirmId === suiteId) {
            onDeleteSuite(suiteId);
            setDeleteConfirmId(null);
        }
        else {
            setDeleteConfirmId(suiteId);
        }
    };
    const handleDeleteTestCase = (caseId, e) => {
        e.stopPropagation();
        if (deleteConfirmId === caseId) {
            onDeleteTestCase(caseId);
            setDeleteConfirmId(null);
        }
        else {
            setDeleteConfirmId(caseId);
        }
    };
    const startRename = (caseId, currentName, e) => {
        e.preventDefault();
        e.stopPropagation();
        setRenameId(caseId);
        setRenameName(currentName);
    };
    const submitRename = () => {
        if (renameId && renameName.trim() && onRenameTestCase) {
            onRenameTestCase(renameId, renameName.trim());
        }
        setRenameId(null);
        setRenameName('');
    };
    const cancelRename = () => {
        setRenameId(null);
        setRenameName('');
    };
    console.log(`[TestNavigator] Rendering with ${projects.length} projects`);
    projects.forEach(p => console.log(`[TestNavigator] Project ${p.name} has ${p.testSuites?.length || 0} suites`));
    return (_jsxs(Container, { children: [_jsx(Toolbar, { children: _jsx("div", { style: { fontWeight: 'bold' }, children: "Test Runner" }) }), _jsx("div", { style: { flex: 1, overflowY: 'auto' }, children: projects.map(p => (_jsxs("div", { children: [" ", _jsxs(TreeItem, { depth: 0, onClick: (e) => toggleExpand(p.name, e), children: [expandedIds.has(p.name) ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 }), _jsx(Folder, { size: 14, style: { marginRight: 6, marginLeft: 4 } }), p.name, _jsx("div", { style: { marginLeft: 'auto' }, children: _jsx(IconButton, { onClick: (e) => {
                                            e.stopPropagation();
                                            onAddSuite(p.name);
                                        }, title: "Add Test Suite", children: _jsx(Plus, { size: 14 }) }) })] }), expandedIds.has(p.name) && (_jsx("div", { children: (p.testSuites || []).map(suite => (_jsxs("div", { children: [_jsxs(TreeItem, { depth: 1, onClick: (e) => toggleExpand(suite.id, e), children: [expandedIds.has(suite.id) ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 }), _jsx(FlaskConical, { size: 14, style: { marginRight: 6, marginLeft: 4 } }), suite.name, _jsxs("div", { style: { marginLeft: 'auto', display: 'flex' }, children: [_jsx(IconButton, { onClick: (e) => {
                                                            e.stopPropagation();
                                                            onAddTestCase(suite.id);
                                                        }, title: "New Test Case", children: _jsx(Plus, { size: 14 }) }), _jsx(IconButton, { onClick: (e) => {
                                                            e.stopPropagation();
                                                            onRunSuite(suite.id);
                                                        }, title: "Run Suite", children: _jsx(Play, { size: 14 }) }), _jsx(IconButton, { onClick: (e) => handleDeleteSuite(suite.id, e), title: deleteConfirmId === suite.id ? "Click again to confirm" : "Delete Suite", shake: deleteConfirmId === suite.id, children: _jsx(Trash2, { size: 14 }) })] })] }), expandedIds.has(suite.id) && (_jsx("div", { children: (suite.testCases || []).map(tc => (_jsxs(TreeItem, { depth: 2, onClick: (e) => toggleExpand(tc.id, e), onContextMenu: (e) => startRename(tc.id, tc.name, e), children: [_jsx(Play, { size: 12, style: { opacity: 0.7, marginRight: 8, marginLeft: 4 } }), renameId === tc.id ? (_jsx("input", { type: "text", value: renameName, onChange: (e) => setRenameName(e.target.value), onBlur: submitRename, onKeyDown: (e) => {
                                                        if (e.key === 'Enter')
                                                            submitRename();
                                                        if (e.key === 'Escape')
                                                            cancelRename();
                                                    }, onClick: (e) => e.stopPropagation(), autoFocus: true, style: {
                                                        background: 'var(--vscode-input-background)',
                                                        border: '1px solid var(--vscode-input-border)',
                                                        color: 'var(--vscode-input-foreground)',
                                                        padding: '2px 4px',
                                                        flex: 1,
                                                        fontSize: '13px',
                                                        outline: 'none'
                                                    } })) : (_jsx("span", { title: "Right-click to rename", children: tc.name })), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex' }, children: [_jsx(IconButton, { onClick: (e) => {
                                                                e.stopPropagation();
                                                                onRunCase(tc.id);
                                                            }, title: "Run Case", children: _jsx(Play, { size: 12 }) }), _jsx(IconButton, { onClick: (e) => handleDeleteTestCase(tc.id, e), title: deleteConfirmId === tc.id ? "Click again to confirm" : "Delete Case", shake: deleteConfirmId === tc.id, children: _jsx(Trash2, { size: 12 }) })] })] }, tc.id))) }))] }, suite.id))) }))] }, p.name))) })] }));
};
