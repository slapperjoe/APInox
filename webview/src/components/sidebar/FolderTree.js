import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { ChevronRight, ChevronDown, FolderPlus, Plus, Trash2, Folder, Code, Globe, Zap } from 'lucide-react';
import { HeaderButton, OperationItem, RequestItem } from './shared/SidebarStyles';
export const FolderTree = ({ folders, projectName, level = 0, selectedFolderId, setSelectedFolderId, selectedRequest, setSelectedRequest, setSelectedProjectName, setResponse, onAddFolder, onAddRequest, onDeleteFolder, onDeleteRequest, onToggleFolderExpand, deleteConfirm, setDeleteConfirm, onSaveProject, handleContextMenu, renameId, renameValue, onRenameChange, onRenameSubmit, onRenameCancel, readOnly }) => {
    // Track hovered folder for showing buttons
    const [_hoveredId, setHoveredId] = useState(null);
    const handleFolderClick = (folder) => {
        setSelectedProjectName(projectName);
        setSelectedFolderId(folder.id);
        setSelectedRequest(null);
    };
    const handleRequestClick = (req, folder) => {
        setSelectedProjectName(projectName);
        setSelectedFolderId(folder.id);
        setSelectedRequest(req);
        setResponse(null);
    };
    return (_jsx(_Fragment, { children: folders.map((folder) => {
            const isSelected = selectedFolderId === folder.id;
            const isExpanded = folder.expanded !== false;
            const isRenaming = renameId === folder.id;
            return (_jsxs("div", { style: { marginLeft: level * 10 }, children: [_jsxs(OperationItem, { "$active": isSelected, onClick: () => handleFolderClick(folder), onMouseEnter: () => setHoveredId(folder.id), onMouseLeave: () => setHoveredId(null), onContextMenu: (e) => !readOnly && handleContextMenu && handleContextMenu(e, 'folder', folder), children: [_jsx("span", { onClick: (e) => {
                                    e.stopPropagation();
                                    onToggleFolderExpand?.(projectName, folder.id);
                                }, style: { marginRight: 5, display: 'flex', alignItems: 'center', width: 14, cursor: 'pointer' }, children: isExpanded ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 }) }), _jsx(Folder, { size: 14, style: { marginRight: 5, opacity: 0.7 } }), isRenaming ? (_jsx("input", { type: "text", value: renameValue, onChange: (e) => onRenameChange?.(e.target.value), onBlur: () => onRenameSubmit?.(), onKeyDown: (e) => {
                                    if (e.key === 'Enter')
                                        onRenameSubmit?.();
                                    if (e.key === 'Escape')
                                        onRenameCancel?.();
                                }, autoFocus: true, onClick: (e) => e.stopPropagation(), style: {
                                    background: 'var(--vscode-input-background)',
                                    color: 'var(--vscode-input-foreground)',
                                    border: '1px solid var(--vscode-input-border)',
                                    flex: 1
                                } })) : (_jsx("span", { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: folder.name })), isSelected && !isRenaming && !readOnly && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 2 }, children: [onAddRequest && (_jsx(HeaderButton, { onClick: (e) => { e.stopPropagation(); onAddRequest(projectName, folder.id); }, title: "Add Request", children: _jsx(Plus, { size: 12 }) })), onAddFolder && (_jsx(HeaderButton, { onClick: (e) => { e.stopPropagation(); onAddFolder(projectName, folder.id); }, title: "Add Subfolder", children: _jsx(FolderPlus, { size: 12 }) })), onDeleteFolder && (_jsx(HeaderButton, { onClick: (e) => {
                                            e.stopPropagation();
                                            if (deleteConfirm === folder.id) {
                                                onDeleteFolder(projectName, folder.id);
                                                setDeleteConfirm(null);
                                            }
                                            else {
                                                setDeleteConfirm(folder.id);
                                                setTimeout(() => setDeleteConfirm(null), 3000);
                                            }
                                        }, title: deleteConfirm === folder.id ? "Click again to Confirm" : "Delete Folder", style: { color: deleteConfirm === folder.id ? 'var(--vscode-errorForeground)' : undefined }, "$shake": deleteConfirm === folder.id, children: _jsx(Trash2, { size: 12 }) }))] }))] }), isExpanded && folder.requests.map((req) => {
                        const isReqRenaming = renameId === req.id;
                        // Determine icon and color based on request type
                        const getRequestIcon = () => {
                            const type = req.requestType || 'soap';
                            const iconProps = { size: 14, style: { marginRight: 6, flexShrink: 0 } };
                            switch (type) {
                                case 'rest':
                                    return _jsx(Globe, { ...iconProps, style: { ...iconProps.style, color: '#48bb78' } }); // Green
                                case 'graphql':
                                    return _jsx(Zap, { ...iconProps, style: { ...iconProps.style, color: '#9f7aea' } }); // Purple
                                case 'soap':
                                default:
                                    return _jsx(Code, { ...iconProps, style: { ...iconProps.style, color: '#4299e1' } }); // Blue
                            }
                        };
                        return (_jsxs(RequestItem, { "$active": selectedRequest?.id === req.id, onClick: () => handleRequestClick(req, folder), style: { marginLeft: 20 }, onContextMenu: (e) => !readOnly && handleContextMenu && handleContextMenu(e, 'request', req), children: [getRequestIcon(), isReqRenaming ? (_jsx("input", { type: "text", value: renameValue, onChange: (e) => onRenameChange?.(e.target.value), onBlur: () => onRenameSubmit?.(), onKeyDown: (e) => {
                                        if (e.key === 'Enter')
                                            onRenameSubmit?.();
                                        if (e.key === 'Escape')
                                            onRenameCancel?.();
                                    }, autoFocus: true, onClick: (e) => e.stopPropagation(), style: {
                                        background: 'var(--vscode-input-background)',
                                        color: 'var(--vscode-input-foreground)',
                                        border: '1px solid var(--vscode-input-border)',
                                        flex: 1
                                    } })) : (_jsx("span", { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: req.name })), _jsx("div", { style: { display: 'flex', gap: '4px' }, children: selectedRequest?.id === req.id && onDeleteRequest && !isReqRenaming && !readOnly && (_jsx(HeaderButton, { onClick: (e) => {
                                            e.stopPropagation();
                                            if (deleteConfirm === req.id) {
                                                onDeleteRequest(req);
                                                setDeleteConfirm(null);
                                            }
                                            else {
                                                setDeleteConfirm(req.id);
                                                setTimeout(() => setDeleteConfirm(null), 3000);
                                            }
                                        }, title: deleteConfirm === req.id ? "Click again to Confirm" : "Delete Request", style: { color: deleteConfirm === req.id ? 'var(--vscode-errorForeground)' : undefined }, "$shake": deleteConfirm === req.id, children: _jsx(Trash2, { size: 12 }) })) })] }, req.id));
                    }), isExpanded && folder.folders && folder.folders.length > 0 && (_jsx(FolderTree, { folders: folder.folders, projectName: projectName, level: level + 1, selectedFolderId: selectedFolderId, setSelectedFolderId: setSelectedFolderId, selectedRequest: selectedRequest, setSelectedRequest: setSelectedRequest, setSelectedProjectName: setSelectedProjectName, setResponse: setResponse, onAddFolder: onAddFolder, onAddRequest: onAddRequest, onDeleteFolder: onDeleteFolder, onDeleteRequest: onDeleteRequest, onToggleFolderExpand: onToggleFolderExpand, deleteConfirm: deleteConfirm, setDeleteConfirm: setDeleteConfirm, onSaveProject: onSaveProject, handleContextMenu: handleContextMenu, renameId: renameId, renameValue: renameValue, onRenameChange: onRenameChange, onRenameSubmit: onRenameSubmit, onRenameCancel: onRenameCancel, readOnly: readOnly }))] }, folder.id));
        }) }));
};
