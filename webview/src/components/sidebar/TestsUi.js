import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState } from 'react';
import styled from 'styled-components';
import { Play, Plus, Trash2, ChevronDown, ChevronRight, FlaskConical, FolderOpen, ListChecks, Edit2, Clock, FileCode, ArrowRight, FileText } from 'lucide-react';
import { HeaderButton, OperationItem, RequestItem } from './shared/SidebarStyles';
const StepItem = styled(RequestItem) `
    padding-left: 52px !important;
    font-size: 0.9em;
    opacity: 0.9;
    
    &:hover {
        opacity: 1;
    }
`;
// Context menu styled components
const ContextMenuOverlay = styled.div `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
`;
const ContextMenuDropdown = styled.div `
    position: fixed;
    top: ${props => props.y}px;
    left: ${props => props.x}px;
    background: var(--vscode-menu-background);
    border: 1px solid var(--vscode-menu-border);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    z-index: 1001;
    min-width: 150px;
    padding: 4px 0;
`;
const ContextMenuItem = styled.div `
    padding: 6px 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--vscode-menu-foreground);
    
    &:hover {
        background: var(--vscode-menu-selectionBackground);
        color: var(--vscode-menu-selectionForeground);
    }
`;
export const TestsUi = ({ projects, onAddSuite, onDeleteSuite, onRunSuite, onAddTestCase, onDeleteTestCase, onRenameTestCase, onRunCase, onSelectSuite, onSelectTestCase, onToggleSuiteExpand, onToggleCaseExpand, onSelectTestStep, onRenameTestStep, deleteConfirm }) => {
    const [showAddSuiteMenu, setShowAddSuiteMenu] = useState(false);
    const [selectedCaseId, setSelectedCaseId] = useState(null);
    const [selectedSuiteId, setSelectedSuiteId] = useState(null);
    const [selectedStepId, setSelectedStepId] = useState(null);
    const [renameId, setRenameId] = useState(null);
    const [renameType, setRenameType] = useState(null);
    const [renameParentId, setRenameParentId] = useState(null);
    const [renameName, setRenameName] = useState('');
    // Context menu state
    const [contextMenu, setContextMenu] = useState(null);
    const handleContextMenu = (e, caseId, name, type, stepId) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, caseId, name, type, stepId });
    };
    const closeContextMenu = () => {
        setContextMenu(null);
    };
    const handleRenameFromMenu = () => {
        if (contextMenu) {
            setRenameId(contextMenu.stepId || contextMenu.caseId);
            setRenameType(contextMenu.type);
            setRenameParentId(contextMenu.caseId); // For steps, caseId is parent. For cases, it's just caseId (unused as parent)
            setRenameName(contextMenu.name);
            closeContextMenu();
        }
    };
    const submitRename = () => {
        console.log('[TestsUi] submitRename called:', { renameId, renameName, renameType, renameParentId });
        if (renameId && renameName.trim()) {
            if (renameType === 'step' && renameParentId && onRenameTestStep) {
                console.log('[TestsUi] Calling onRenameTestStep');
                onRenameTestStep(renameParentId, renameId, renameName.trim());
            }
            else if (renameType === 'case' && onRenameTestCase) {
                console.log('[TestsUi] Calling onRenameTestCase');
                onRenameTestCase(renameId, renameName.trim());
            }
        }
        setRenameId(null);
        setRenameType(null);
        setRenameParentId(null);
        setRenameName('');
    };
    const cancelRename = () => {
        setRenameId(null);
        setRenameType(null);
        setRenameParentId(null);
        setRenameName('');
    };
    // Aggregate all test suites from all projects
    const allSuites = projects.flatMap(p => (p.testSuites || []).map(suite => ({ suite, projectName: p.name })));
    return (_jsxs(_Fragment, { children: [_jsx("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: _jsxs("div", { style: { flex: 1, overflow: 'auto', padding: 10 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, children: [_jsxs("div", { style: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--vscode-sideBarTitle-foreground)', flex: 1 }, children: ["Test Suites (", allSuites.length, ")"] }), _jsxs("div", { style: { position: 'relative' }, children: [_jsx(HeaderButton, { onClick: () => setShowAddSuiteMenu(!showAddSuiteMenu), title: "Add Test Suite", style: { padding: 4 }, children: _jsx(Plus, { size: 16 }) }), showAddSuiteMenu && (_jsxs("div", { style: {
                                                position: 'absolute',
                                                top: '100%',
                                                right: 0,
                                                marginTop: 5,
                                                background: 'var(--vscode-dropdown-background)',
                                                border: '1px solid var(--vscode-dropdown-border)',
                                                borderRadius: 4,
                                                zIndex: 100,
                                                minWidth: 180,
                                                boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                                            }, children: [_jsx("div", { style: { padding: '8px 10px', fontSize: '0.8em', opacity: 0.7, borderBottom: '1px solid var(--vscode-panel-border)' }, children: "Add suite to project:" }), projects.length === 0 ? (_jsx("div", { style: { padding: '10px', fontSize: '0.85em', opacity: 0.6 }, children: "No projects loaded" })) : (projects.map(p => (_jsxs("div", { onClick: () => {
                                                        if (p.readOnly)
                                                            return; // Disable for read-only projects
                                                        onAddSuite(p.name);
                                                        setShowAddSuiteMenu(false);
                                                    }, style: {
                                                        padding: '8px 12px',
                                                        cursor: p.readOnly ? 'not-allowed' : 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        opacity: p.readOnly ? 0.5 : 1
                                                    }, onMouseEnter: (e) => e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)', onMouseLeave: (e) => e.currentTarget.style.background = 'transparent', title: p.readOnly ? 'Workspace is read-only; cannot add suites.' : undefined, children: [_jsx(FolderOpen, { size: 14 }), p.name] }, p.name))))] }))] })] }), allSuites.length === 0 && (_jsxs("div", { style: { textAlign: 'center', padding: 30, opacity: 0.6 }, children: [_jsx(FlaskConical, { size: 40, style: { marginBottom: 10 } }), _jsx("div", { children: "No test suites yet." }), _jsx("div", { style: { fontSize: '0.85em', marginTop: 5 }, children: "Click + to add a test suite." })] })), Array.from(new Map(projects.flatMap(p => (p.testSuites || []).map(s => [s.id, s]))).values()).map(suite => {
                            const isSuiteSelected = selectedSuiteId === suite.id && selectedCaseId === null;
                            return (_jsxs("div", { children: [_jsxs(OperationItem, { "$active": isSuiteSelected, onClick: () => {
                                            // Toggle suite selection and notify parent
                                            if (isSuiteSelected) {
                                                setSelectedSuiteId(null);
                                            }
                                            else {
                                                setSelectedSuiteId(suite.id);
                                                setSelectedCaseId(null); // Clear case selection
                                                onSelectSuite(suite.id); // Notify parent
                                            }
                                        }, style: { paddingLeft: 8 }, children: [_jsx("span", { onClick: (e) => { e.stopPropagation(); onToggleSuiteExpand(suite.id); }, style: { cursor: 'pointer', display: 'flex', alignItems: 'center' }, children: suite.expanded !== false ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 }) }), _jsx(ListChecks, { size: 14, style: { marginLeft: 4 } }), _jsx("span", { style: { flex: 1, marginLeft: 6, fontWeight: 'bold' }, children: suite.name }), _jsxs("span", { style: { fontSize: '0.8em', opacity: 0.6, marginRight: 6 }, children: ["(", suite.testCases?.length || 0, ")"] }), isSuiteSelected && (_jsxs(_Fragment, { children: [_jsx(HeaderButton, { onClick: (e) => { e.stopPropagation(); onRunSuite(suite.id); }, title: "Run Suite", style: { padding: 2 }, children: _jsx(Play, { size: 12 }) }), _jsx(HeaderButton, { onClick: (e) => { e.stopPropagation(); onAddTestCase(suite.id); }, title: "Add Test Case", style: { padding: 2 }, children: _jsx(Plus, { size: 12 }) }), _jsx(HeaderButton, { onClick: (e) => { e.stopPropagation(); onDeleteSuite(suite.id); }, title: deleteConfirm === suite.id ? 'Click again to confirm' : 'Delete Suite', style: { padding: 2, color: deleteConfirm === suite.id ? 'var(--vscode-testing-iconFailed)' : undefined }, children: _jsx(Trash2, { size: 12 }) })] }))] }), suite.expanded !== false && (suite.testCases || []).map(tc => {
                                        const isSelected = selectedCaseId === tc.id;
                                        return (_jsxs(React.Fragment, { children: [_jsxs(RequestItem, { "$active": isSelected, onClick: () => {
                                                        // Select case and notify parent
                                                        if (isSelected) {
                                                            setSelectedCaseId(null);
                                                        }
                                                        else {
                                                            setSelectedCaseId(tc.id);
                                                            setSelectedSuiteId(null); // Clear suite selection
                                                            onSelectTestCase(tc.id); // Notify parent
                                                        }
                                                    }, onContextMenu: (e) => handleContextMenu(e, tc.id, tc.name, 'case'), style: { paddingLeft: 35 }, children: [_jsx("span", { onClick: (e) => { e.stopPropagation(); onToggleCaseExpand(tc.id); }, style: { cursor: 'pointer', display: 'flex', alignItems: 'center', marginRight: 4, width: 14 }, children: tc.expanded !== false ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 }) }), renameId === tc.id ? (_jsx("input", { type: "text", value: renameName, onChange: (e) => setRenameName(e.target.value), onBlur: submitRename, onKeyDown: (e) => {
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
                                                                fontSize: '12px',
                                                                outline: 'none'
                                                            } })) : (_jsx("span", { style: { flex: 1 }, title: "Right-click to rename", children: tc.name })), _jsx("span", { style: { fontSize: '0.75em', opacity: 0.6, marginRight: 6 }, children: tc.steps?.length || 0 }), isSelected && (_jsxs(_Fragment, { children: [_jsx(HeaderButton, { onClick: (e) => { e.stopPropagation(); onRunCase(tc.id); }, title: "Run Test Case", style: { padding: 2 }, children: _jsx(Play, { size: 12 }) }), _jsx(HeaderButton, { onClick: (e) => { e.stopPropagation(); onDeleteTestCase(tc.id); }, title: deleteConfirm === tc.id ? 'Click again to confirm' : 'Delete Case', style: { padding: 2, color: deleteConfirm === tc.id ? 'var(--vscode-testing-iconFailed)' : undefined }, children: _jsx(Trash2, { size: 12 }) })] }))] }), tc.expanded !== false && (tc.steps || []).map(step => (_jsx(StepItem, { "$active": selectedStepId === step.id, onClick: (e) => {
                                                        e.stopPropagation();
                                                        setSelectedStepId(step.id);
                                                        // Also select the parent case if we want context, but usually explicit step selection is enough
                                                        // if (selectedCaseId !== tc.id) setSelectedCaseId(tc.id);
                                                        if (onSelectTestStep)
                                                            onSelectTestStep(tc.id, step.id);
                                                    }, onContextMenu: (e) => handleContextMenu(e, tc.id, step.name, 'step', step.id), style: { cursor: 'pointer' }, children: renameId === step.id ? (_jsx("input", { type: "text", value: renameName, onChange: (e) => setRenameName(e.target.value), onBlur: submitRename, onKeyDown: (e) => {
                                                            if (e.key === 'Enter')
                                                                submitRename();
                                                            if (e.key === 'Escape')
                                                                cancelRename();
                                                        }, onClick: (e) => e.stopPropagation(), autoFocus: true, style: {
                                                            background: 'var(--vscode-input-background)',
                                                            border: '1px solid var(--vscode-input-border)',
                                                            color: 'var(--vscode-input-foreground)',
                                                            padding: '1px 3px',
                                                            flex: 1,
                                                            fontSize: '0.9em',
                                                            outline: 'none',
                                                            marginLeft: 4
                                                        } })) : (_jsxs(_Fragment, { children: [_jsx("span", { style: { display: 'flex', alignItems: 'center', marginRight: 6, opacity: 0.7 }, children: (() => {
                                                                    switch (step.type) {
                                                                        case 'delay': return _jsx(Clock, { size: 12 });
                                                                        case 'transfer': return _jsx(ArrowRight, { size: 12 });
                                                                        case 'script': return _jsx(FileCode, { size: 12 });
                                                                        case 'request':
                                                                        default: return _jsx(FileText, { size: 12 });
                                                                    }
                                                                })() }), _jsx("span", { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: "Right-click to rename", children: step.name })] })) }, step.id)))] }, tc.id));
                                    })] }, suite.id));
                        })] }) }), contextMenu && (_jsxs(_Fragment, { children: [_jsx(ContextMenuOverlay, { onClick: closeContextMenu }), _jsx(ContextMenuDropdown, { x: contextMenu.x, y: contextMenu.y, children: _jsxs(ContextMenuItem, { onClick: handleRenameFromMenu, children: [_jsx(Edit2, { size: 14 }), "Rename"] }) })] }))] }));
};
