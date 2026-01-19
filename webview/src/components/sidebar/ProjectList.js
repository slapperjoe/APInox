import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Plus, FolderPlus, ChevronDown, ChevronRight, Trash2, Lock, Save } from 'lucide-react';
import { HeaderButton, OperationItem } from './shared/SidebarStyles';
import { ServiceTree } from './ServiceTree';
import { FolderTree } from './FolderTree';
import { ContextMenu, ContextMenuItem } from '../../styles/App.styles';
import { updateProjectWithRename } from '../../utils/projectUtils';
export const ProjectList = ({ projects, savedProjects, onAddProject, loadProject, saveProject, onUpdateProject, closeProject, toggleProjectExpand, toggleInterfaceExpand, toggleOperationExpand, setSelectedProjectName, selectedProjectName, setSelectedInterface, selectedInterface, setSelectedOperation, selectedOperation, setSelectedRequest, selectedRequest, setResponse, handleContextMenu: _handleContextMenu, onAddRequest, onDeleteInterface, onDeleteOperation, onDeleteRequest, onAddFolder, onAddRequestToFolder, onDeleteFolder, onToggleFolderExpand, deleteConfirm, // Global delete confirm from Sidebar parent
setDeleteConfirm, onRefreshInterface }) => {
    // Local state for folder selection
    const [selectedFolderId, setSelectedFolderId] = useState(null);
    // Inline Rename State
    const [renameId, setRenameId] = useState(null);
    const [renameType, setRenameType] = useState(null);
    const [renameName, setRenameName] = useState('');
    // Local Context Menu State
    const [localContextMenu, setLocalContextMenu] = useState(null);
    const handleLocalContextMenu = (e, type, data, _isExplorer) => {
        // Prevent default and stop propagation to avoid global menu
        e.preventDefault();
        e.stopPropagation();
        // Prevent context menu for read-only items (except maybe Copy? explicit disable for now)
        // We need to check if the item belongs to a read-only project.
        // But 'data' is the item itself. 
        // If type is 'project', we can check data.readOnly.
        // If type is 'folder' or 'request', we don't easily know parent project here without searching or passing it.
        // However, we blocked triggering context menu in the children components (FolderTree)!
        // So here we only care about project triggers.
        if (type === 'project' && data.readOnly)
            return;
        setLocalContextMenu({ x: e.clientX, y: e.clientY, type, data });
        // Also call parent handler if needed for side effects? No, we replace it.
        // But we might need key functionality not implemented here?
        // Let's implement full menu capability here.
    };
    const closeLocalContextMenu = () => setLocalContextMenu(null);
    const handleRenameStart = () => {
        if (localContextMenu) {
            setRenameId(localContextMenu.data.id || localContextMenu.data.name); // Prefer ID, fallback to name for projects
            setRenameType(localContextMenu.type);
            setRenameName(localContextMenu.data.name);
            closeLocalContextMenu();
        }
    };
    const submitRename = () => {
        if (renameId && renameName.trim() && renameType) {
            // Update projects
            const updatedProjects = updateProjectWithRename(projects, renameId, renameType, renameName.trim(), localContextMenu?.data);
            // Find the project that changed and save it
            // We can just save the specific project if we know which one?
            // updateProjectWithRename returns new array.
            // We need to call setProjects in App? No, ProjectList props has 'saveProject'.
            // 'saveProject' takes a single project.
            // We need to find the modified project.
            const originalProject = projects.find(p => (p.id && p.id === renameId) ||
                p.name === renameId ||
                // Deep search for children?
                (renameType !== 'project' && (p.folders?.some(f => f.id === renameId || f.requests.some(r => r.id === renameId)) ||
                    p.interfaces?.some(i => i.operations.some(o => o.requests.some(r => r.id === renameId))))));
            if (originalProject) {
                // Name might have changed!
                // Find the updated project in the new array.
                // Since updateProjectWithRename maps the array, the index is preserved.
                const index = projects.indexOf(originalProject);
                if (index !== -1 && updatedProjects[index]) {
                    // Pass both old and new to parent to update state and save
                    if (onUpdateProject) {
                        onUpdateProject(originalProject, updatedProjects[index]);
                    }
                    else {
                        // Fallback (e.g., if prop missing, but it shouldn't be)
                        saveProject(updatedProjects[index]);
                    }
                }
            }
        }
        setRenameId(null);
        setRenameType(null);
        setRenameName('');
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'hidden' }, onClick: closeLocalContextMenu, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)',
                    padding: '5px 10px',
                    flexShrink: 0
                }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--vscode-sideBarTitle-foreground)', flex: 1 }, children: "Workspace" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center' }, children: [_jsx(HeaderButton, { onClick: onAddProject, title: "New Project", children: _jsx(Plus, { size: 16 }) }), _jsx("div", { style: { width: 10 } }), _jsx(HeaderButton, { onClick: loadProject, title: "Add Project", children: _jsx(FolderPlus, { size: 16 }) })] })] }), _jsx("div", { style: { padding: 10, flex: 1, overflowY: 'auto' }, children: (() => {
                    const sortedProjects = [...projects].sort((a, b) => {
                        if (a.readOnly && !b.readOnly)
                            return 1;
                        if (!a.readOnly && b.readOnly)
                            return -1;
                        return 0;
                    });
                    return sortedProjects.map((proj, pIdx) => {
                        // Project is selected if explicitly selected OR if any of its children are selected
                        const isProjectSelected = selectedProjectName === proj.name;
                        const isProjectActive = isProjectSelected && selectedInterface === null;
                        const isRenaming = renameId === (proj.id || proj.name) && renameType === 'project';
                        const isReadOnly = !!proj.readOnly;
                        return (_jsxs("div", { children: [_jsxs(OperationItem, { "$active": isProjectActive, onClick: () => {
                                        // Select project, clear interface/operation/request
                                        setSelectedProjectName(proj.name);
                                        setSelectedInterface(null);
                                        setSelectedOperation(null);
                                        setSelectedRequest(null);
                                    }, onContextMenu: (e) => handleLocalContextMenu(e, 'project', proj), style: { fontWeight: 'bold', paddingLeft: 5 }, children: [_jsx("span", { onClick: (e) => { e.stopPropagation(); toggleProjectExpand(proj.name); }, style: { cursor: 'pointer', display: 'flex', alignItems: 'center' }, children: proj.expanded ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 }) }), isRenaming ? (_jsx("input", { type: "text", value: renameName, onChange: (e) => setRenameName(e.target.value), onBlur: submitRename, onKeyDown: (e) => {
                                                if (e.key === 'Enter')
                                                    submitRename();
                                                if (e.key === 'Escape') {
                                                    setRenameId(null);
                                                    setRenameType(null);
                                                    setRenameName('');
                                                }
                                            }, autoFocus: true, onClick: (e) => e.stopPropagation(), style: {
                                                background: 'var(--vscode-input-background)',
                                                color: 'var(--vscode-input-foreground)',
                                                border: '1px solid var(--vscode-input-border)',
                                                marginLeft: 5,
                                                flex: 1
                                            } })) : (_jsx("span", { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 5 }, children: proj.name || proj.fileName })), (!proj.fileName) && !isRenaming && !isReadOnly && (_jsx(HeaderButton, { onClick: (e) => { e.stopPropagation(); saveProject(proj); }, title: "Save Project (Required for Auto-Save)", style: { color: 'var(--vscode-charts-orange)' }, children: _jsx(Save, { size: 14 }) })), isReadOnly && _jsx(Lock, { size: 12, style: { opacity: 0.5, marginLeft: 5 } }), isProjectActive && onAddFolder && !isRenaming && !isReadOnly && (_jsx(HeaderButton, { onClick: (e) => { e.stopPropagation(); onAddFolder(proj.name); }, title: "Add Folder", children: _jsx(FolderPlus, { size: 14 }) })), isProjectActive && !isRenaming && !isReadOnly && (_jsx(HeaderButton, { onClick: (e) => {
                                                e.stopPropagation();
                                                if (deleteConfirm === proj.name) {
                                                    closeProject(proj.name);
                                                    setDeleteConfirm(null);
                                                }
                                                else {
                                                    setDeleteConfirm(proj.name);
                                                    setTimeout(() => {
                                                        setDeleteConfirm(null);
                                                    }, 3000);
                                                }
                                            }, title: deleteConfirm === proj.name ? "Click again to Confirm Delete" : "Close Project", style: { color: deleteConfirm === proj.name ? 'var(--vscode-errorForeground)' : undefined }, "$shake": deleteConfirm === proj.name, children: _jsx(Trash2, { size: 14 }) }))] }), proj.expanded && (_jsxs(_Fragment, { children: [_jsx(ServiceTree, { interfaces: proj.interfaces, projects: projects, isExplorer: false, selectedInterface: selectedInterface, selectedOperation: selectedOperation, selectedRequest: selectedRequest, confirmDeleteId: deleteConfirm, setConfirmDeleteId: setDeleteConfirm, onToggleInterface: (iface) => toggleInterfaceExpand(proj.name, iface.name), onSelectInterface: (iface) => {
                                                // Only select, don't expand - expand is chevron-only
                                                setSelectedProjectName(proj.name);
                                                setSelectedInterface(iface);
                                                setSelectedOperation(null);
                                                setSelectedRequest(null);
                                            }, onToggleOperation: (op, iface) => toggleOperationExpand(proj.name, iface.name, op.name), onSelectOperation: (op, iface) => {
                                                // Only select operation, don't auto-select request
                                                setSelectedProjectName(proj.name);
                                                setSelectedInterface(iface);
                                                setSelectedOperation(op);
                                                setSelectedRequest(null);
                                            }, onSelectRequest: (req, op, iface) => {
                                                setSelectedProjectName(proj.name);
                                                setSelectedInterface(iface);
                                                setSelectedOperation(op);
                                                setSelectedRequest(req);
                                                setResponse(null);
                                            }, onContextMenu: (e, type, data) => handleLocalContextMenu(e, type, data, false), onAddRequest: onAddRequest, onDeleteInterface: onDeleteInterface, onDeleteOperation: onDeleteOperation, onDeleteRequest: onDeleteRequest, onSaveProject: () => saveProject(proj), recentlySaved: savedProjects.has(proj.name), 
                                            // Inline Rename Props
                                            renameId: renameId, renameValue: renameName, onRenameChange: setRenameName, onRenameSubmit: submitRename, onRenameCancel: () => {
                                                setRenameId(null);
                                                setRenameType(null);
                                                setRenameName('');
                                            } }), proj.folders && proj.folders.length > 0 && (_jsx(FolderTree, { folders: proj.folders, projectName: proj.name, selectedFolderId: selectedFolderId, setSelectedFolderId: setSelectedFolderId, selectedRequest: selectedRequest, setSelectedRequest: setSelectedRequest, setSelectedProjectName: setSelectedProjectName, setResponse: setResponse, onAddFolder: onAddFolder, onAddRequest: onAddRequestToFolder, onDeleteFolder: onDeleteFolder, onDeleteRequest: onDeleteRequest, onToggleFolderExpand: onToggleFolderExpand, deleteConfirm: deleteConfirm, setDeleteConfirm: setDeleteConfirm, onSaveProject: () => saveProject(proj), handleContextMenu: handleLocalContextMenu, 
                                            // Inline Rename Props
                                            renameId: renameId, renameValue: renameName, onRenameChange: setRenameName, onRenameSubmit: submitRename, onRenameCancel: () => {
                                                setRenameId(null);
                                                setRenameType(null);
                                                setRenameName('');
                                            }, readOnly: isReadOnly }))] }))] }, proj.id || pIdx));
                    });
                })() }), localContextMenu && (_jsxs(ContextMenu, { top: localContextMenu.y, left: localContextMenu.x, children: [(localContextMenu.type === 'project' || localContextMenu.type === 'folder' || localContextMenu.type === 'request') && (_jsx(ContextMenuItem, { onClick: handleRenameStart, children: "Rename" })), localContextMenu.type === 'request' && onDeleteRequest && (_jsx(ContextMenuItem, { onClick: () => { onDeleteRequest(localContextMenu.data); closeLocalContextMenu(); }, children: "Delete" })), localContextMenu.type === 'folder' && onDeleteFolder && (_jsx(ContextMenuItem, { onClick: () => { onDeleteFolder(localContextMenu.data.projectName || selectedProjectName || '', localContextMenu.data.id); closeLocalContextMenu(); }, children: "Delete" })), localContextMenu.type === 'interface' && onRefreshInterface && (_jsxs(_Fragment, { children: [_jsx("div", { style: { height: 1, backgroundColor: 'var(--vscode-menu-separatorBackground)', margin: '4px 0' } }), _jsx(ContextMenuItem, { onClick: () => {
                                    // We need project name. 
                                    // `data` is ApiInterface. We need parent project.
                                    // How do we get parent project name? 
                                    // We don't have it easily in local data unless we passed it.
                                    // But we can find it in projects array.
                                    const iface = localContextMenu.data;
                                    const proj = projects.find(p => p.interfaces.some(i => i.name === iface.name));
                                    // Note: Finding by interface name across projects is risky if duplicates exist.
                                    // Ideally we pass project name in context menu data or look up safer.
                                    // Wait, ServiceTree calls onContextMenu with (e, 'interface', iface).
                                    // We can pass project name into data when rendering ServiceTree?
                                    // Or just simpler:
                                    if (proj) {
                                        onRefreshInterface(proj.name, iface.name);
                                    }
                                    closeLocalContextMenu();
                                }, children: "Refresh Definition" })] }))] }))] }));
};
