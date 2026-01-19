import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { Play, Square, Trash2, Plus, ChevronRight, ChevronDown } from 'lucide-react';
import { ContextMenu, ContextMenuItem } from '../../styles/App.styles';
// Shake animation for delete confirmation
const shakeAnimation = keyframes `
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
    20%, 40%, 60%, 80% { transform: translateX(2px); }
`;
// Styled Components (borrowed from existing UI)
const Container = styled.div `
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--vscode-foreground);
    background-color: var(--vscode-sideBar-background);
`;
const Toolbar = styled.div `
    display: flex;
    padding: 10px;
    gap: 8px;
    border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
    align-items: center;
`;
const Title = styled.div `
    font-size: 11px;
    font-weight: bold;
    text-transform: uppercase;
    color: var(--vscode-sideBarTitle-foreground);
    flex: 1;
`;
const IconButton = styled.button `
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: var(--vscode-icon-foreground);
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
        background-color: var(--vscode-toolbar-hoverBackground);
    }
`;
const List = styled.div `
    flex: 1;
    overflow-y: auto;
    padding: 0;
`;
const SuiteItem = styled.div `
    display: flex;
    align-items: center;
    padding: 4px 8px;
    cursor: pointer;
    background-color: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent'};
    color: ${props => props.active ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-list-inactiveSelectionForeground)'};

    &:hover {
        background-color: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-list-hoverBackground)'};
    }
`;
const SuiteIcon = styled.div `
    margin-right: 6px;
    display: flex;
    align-items: center;
`;
const SuiteLabel = styled.div `
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 13px;
`;
const Actions = styled.div `
    display: flex;
    gap: 4px;
    opacity: 0;
    ${SuiteItem}:hover & {
        opacity: 1;
    }
`;
const DeleteButton = styled(IconButton) `
    color: ${props => props.$shake ? '#f14c4c' : 'var(--vscode-icon-foreground)'};
    &:hover {
        background-color: rgba(241, 76, 76, 0.1);
    }
    ${props => props.$shake && css `
        animation: ${shakeAnimation} 0.5s ease-in-out infinite;
        color: #f14c4c;
    `}
`;
const Input = styled.input `
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 4px;
    width: 100%;
    margin-top: 5px;
    &:focus {
        outline: 1px solid var(--vscode-focusBorder);
    }
`;
const RequestItem = styled.div `
    display: flex;
    align-items: center;
    padding: 4px 8px 4px 28px;
    cursor: pointer;
    background-color: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent'};
    color: ${props => props.active ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-list-inactiveSelectionForeground)'};

    &:hover {
        background-color: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-list-hoverBackground)'};
    }
`;
export const PerformanceUi = ({ suites, onAddSuite, onDeleteSuite, onRunSuite, onSelectSuite, onStopRun, isRunning, selectedSuiteId, deleteConfirm, setDeleteConfirm, onAddRequest, onDeleteRequest, onSelectRequest, onUpdateRequest, onToggleSuiteExpand, expandedSuiteIds = [] }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newSuiteName, setNewSuiteName] = useState('');
    // Rename state
    const [renameId, setRenameId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [renameType, setRenameType] = useState(null);
    const [renameParentId, setRenameParentId] = useState(null);
    // Context Menu
    const [contextMenu, setContextMenu] = useState(null);
    const checkExpanded = (id) => expandedSuiteIds.includes(id);
    const handleCreateSuite = () => {
        setIsAdding(true);
        setNewSuiteName('');
    };
    const submitCreateSuite = () => {
        if (newSuiteName.trim()) {
            onAddSuite(newSuiteName.trim());
            setIsAdding(false);
            setNewSuiteName('');
        }
        else {
            setIsAdding(false);
        }
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter')
            submitCreateSuite();
        if (e.key === 'Escape')
            setIsAdding(false);
    };
    // Rename handlers
    const startRename = (id, name, type, parentId) => {
        setRenameId(id);
        setRenameValue(name);
        setRenameType(type);
        setRenameParentId(parentId || null);
        setContextMenu(null);
    };
    const submitRename = () => {
        if (renameId && renameValue.trim()) {
            if (renameType === 'request' && onUpdateRequest && renameParentId) {
                onUpdateRequest(renameParentId, renameId, { name: renameValue });
            }
            // Add suite rename logic here if needed (not in original scope but good to have)
        }
        setRenameId(null);
        setRenameValue('');
        setRenameType(null);
    };
    const handleContextMenu = (e, type, id, name, parentId) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, type, id, name, parentId });
    };
    // Close menu on click elsewhere
    React.useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);
    return (_jsxs(Container, { children: [_jsxs(Toolbar, { children: [_jsx(Title, { children: "Performance Suites" }), _jsx(IconButton, { onClick: handleCreateSuite, title: "New Performance Suite", children: _jsx(Plus, { size: 16 }) }), isRunning && (_jsx(IconButton, { onClick: onStopRun, title: "Stop All Runs", children: _jsx(Square, { size: 16, fill: "currentColor" }) }))] }), _jsxs(List, { children: [isAdding && (_jsx("div", { style: { padding: '8px' }, children: _jsx(Input, { autoFocus: true, placeholder: "Suite Name", value: newSuiteName, onChange: e => setNewSuiteName(e.target.value), onBlur: submitCreateSuite, onKeyDown: handleKeyDown }) })), suites.map(suite => {
                        const expanded = checkExpanded(suite.id);
                        return (_jsxs(React.Fragment, { children: [_jsxs(SuiteItem, { active: selectedSuiteId === suite.id, onClick: () => onSelectSuite(suite.id), children: [_jsx(SuiteIcon, { onClick: (e) => { e.stopPropagation(); onToggleSuiteExpand?.(suite.id); }, children: expanded ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 }) }), _jsx(SuiteLabel, { children: suite.name }), _jsxs(Actions, { children: [_jsx(IconButton, { onClick: (e) => { e.stopPropagation(); onAddRequest?.(suite.id); }, title: "Add Request", children: _jsx(Plus, { size: 14 }) }), _jsx(IconButton, { onClick: (e) => { e.stopPropagation(); onRunSuite(suite.id); }, title: "Run Suite", style: { color: 'var(--vscode-charts-green)' }, children: _jsx(Play, { size: 14, fill: "currentColor" }) }), _jsx(DeleteButton, { "$shake": deleteConfirm === suite.id, onClick: (e) => {
                                                        e.stopPropagation();
                                                        if (deleteConfirm === suite.id) {
                                                            onDeleteSuite(suite.id);
                                                            setDeleteConfirm(null);
                                                        }
                                                        else {
                                                            setDeleteConfirm(suite.id);
                                                        }
                                                    }, title: deleteConfirm === suite.id ? "Click again to delete" : "Delete Suite", children: _jsx(Trash2, { size: 14 }) })] })] }), expanded && suite.requests?.map(req => (_jsxs(RequestItem, { active: false, onClick: () => onSelectRequest?.(req), onContextMenu: (e) => handleContextMenu(e, 'request', req.id, req.name, suite.id), children: [_jsx("div", { style: { width: 14 } }), " ", renameId === req.id ? (_jsx(Input, { value: renameValue, onChange: (e) => setRenameValue(e.target.value), onBlur: submitRename, onKeyDown: (e) => {
                                                if (e.key === 'Enter')
                                                    submitRename();
                                                if (e.key === 'Escape')
                                                    setRenameId(null);
                                                e.stopPropagation();
                                            }, autoFocus: true, onClick: (e) => e.stopPropagation(), style: { margin: 0, padding: '2px 4px' } })) : (_jsx(SuiteLabel, { style: { fontSize: 12 }, children: req.name }))] }, req.id)))] }, suite.id));
                    }), suites.length === 0 && !isAdding && (_jsxs("div", { style: { padding: 20, textAlign: 'center', color: 'var(--vscode-descriptionForeground)', fontSize: 13 }, children: ["No performance suites.", _jsx("br", {}), "Click + to create one."] }))] }), contextMenu && (_jsxs(ContextMenu, { top: contextMenu.y, left: contextMenu.x, onClick: (e) => e.stopPropagation(), children: [_jsx(ContextMenuItem, { onClick: () => startRename(contextMenu.id, contextMenu.name, contextMenu.type, contextMenu.parentId), children: "Rename" }), _jsx(ContextMenuItem, { onClick: () => {
                            if (contextMenu.type === 'request' && onDeleteRequest && contextMenu.parentId) {
                                onDeleteRequest(contextMenu.parentId, contextMenu.id);
                            }
                            if (contextMenu.type === 'suite') {
                                onDeleteSuite(contextMenu.id);
                            }
                            setContextMenu(null);
                        }, children: "Delete" })] }))] }));
};
