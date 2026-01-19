import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { Play, Plus, ChevronRight, ChevronDown, FlaskConical, Trash2 } from 'lucide-react';
const shakeAnimation = keyframes `
  0% { transform: translateX(0); }
  25% { transform: translateX(-3px) rotate(-5deg); }
  50% { transform: translateX(3px) rotate(5deg); }
  75% { transform: translateX(-3px) rotate(-5deg); }
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
        animation: ${shakeAnimation} 0.4s ease-in-out infinite;
        color: var(--vscode-errorForeground) !important;
    `}
`;
const TreeItem = styled.div `
    padding: 2px 8px;
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
export const ProjectTestTree = ({ project, onAddSuite, onDeleteSuite, onRunSuite, onAddTestCase, onDeleteTestCase, onSelectSuite, onSelectTestCase, onToggleSuiteExpand, onToggleCaseExpand, deleteConfirm }) => {
    const [rootExpanded, setRootExpanded] = useState(true);
    return (_jsxs("div", { children: [_jsxs(TreeItem, { depth: 0, onClick: (e) => { e.stopPropagation(); setRootExpanded(!rootExpanded); }, children: [rootExpanded ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 }), _jsx(FlaskConical, { size: 14, style: { marginRight: 6, marginLeft: 4 } }), "Test Suites", _jsx("div", { style: { marginLeft: 'auto' }, children: _jsx(IconButton, { onClick: (e) => {
                                e.stopPropagation();
                                onAddSuite(project.name);
                            }, title: "Add Test Suite", children: _jsx(Plus, { size: 14 }) }) })] }), rootExpanded && (_jsx("div", { children: (project.testSuites || []).map(suite => (_jsxs("div", { children: [_jsxs(TreeItem, { depth: 1, onClick: (e) => {
                                e.stopPropagation();
                                onToggleSuiteExpand?.(suite.id);
                                onSelectSuite?.(suite.id);
                            }, children: [suite.expanded !== false ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 }), _jsx(FlaskConical, { size: 14, style: { marginRight: 6, marginLeft: 4 } }), suite.name, _jsxs("div", { style: { marginLeft: 'auto', display: 'flex' }, children: [_jsx(IconButton, { onClick: (e) => {
                                                e.stopPropagation();
                                                onAddTestCase(suite.id);
                                            }, title: "New Test Case", children: _jsx(Plus, { size: 14 }) }), _jsx(IconButton, { onClick: (e) => {
                                                e.stopPropagation();
                                                console.log('[ProjectTestTree] Run Suite clicked, suiteId:', suite.id);
                                                onRunSuite(suite.id);
                                            }, title: "Run Suite", children: _jsx(Play, { size: 14 }) }), _jsx(IconButton, { onClick: (e) => {
                                                e.stopPropagation();
                                                console.log('[ProjectTestTree] Delete Suite clicked, suiteId:', suite.id);
                                                onDeleteSuite(suite.id);
                                            }, title: deleteConfirm === suite.id ? "Click again to Confirm" : "Delete Suite", style: { color: deleteConfirm === suite.id ? 'var(--vscode-errorForeground)' : undefined }, shake: deleteConfirm === suite.id, children: _jsx(Trash2, { size: 14 }) })] })] }), suite.expanded !== false && (_jsx("div", { children: (suite.testCases || []).map(tc => (_jsxs(TreeItem, { depth: 2, onClick: (e) => {
                                    e.stopPropagation();
                                    onToggleCaseExpand?.(tc.id);
                                    onSelectTestCase?.(tc.id);
                                }, children: [tc.expanded !== false ? _jsx(ChevronDown, { size: 12, style: { marginRight: 4 } }) : _jsx(ChevronRight, { size: 12, style: { marginRight: 4 } }), tc.name, _jsx("div", { style: { marginLeft: 'auto', display: 'flex' }, children: _jsx(IconButton, { onClick: (e) => {
                                                e.stopPropagation();
                                                console.log('[ProjectTestTree] Delete Test Case clicked, caseId:', tc.id);
                                                onDeleteTestCase(tc.id);
                                            }, title: deleteConfirm === tc.id ? "Click again to Confirm" : "Delete Case", style: { color: deleteConfirm === tc.id ? 'var(--vscode-errorForeground)' : undefined }, shake: deleteConfirm === tc.id, children: _jsx(Trash2, { size: 12 }) }) })] }, tc.id))) }))] }, suite.id))) }))] }));
};
