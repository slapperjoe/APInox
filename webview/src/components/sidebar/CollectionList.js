import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Plus, ChevronDown, ChevronRight, Folder, FolderOpen, Trash2, FileJson } from 'lucide-react';
import { HeaderButton, OperationItem } from './shared/SidebarStyles';
const RequestItem = ({ request, isSelected, onClick, onDelete, deleteConfirm, setDeleteConfirm }) => {
    const methodColors = {
        'GET': 'var(--vscode-charts-green)',
        'POST': 'var(--vscode-charts-blue)',
        'PUT': 'var(--vscode-charts-orange)',
        'PATCH': 'var(--vscode-charts-yellow)',
        'DELETE': 'var(--vscode-charts-red)',
    };
    const method = request.method || 'GET';
    const isDeleting = deleteConfirm === request.id;
    return (_jsxs(OperationItem, { style: {
            paddingLeft: 28,
            backgroundColor: isDeleting
                ? 'var(--vscode-inputValidation-errorBackground)'
                : isSelected
                    ? 'var(--vscode-list-activeSelectionBackground)'
                    : undefined,
            color: isDeleting
                ? 'var(--vscode-errorForeground)'
                : isSelected
                    ? 'var(--vscode-list-activeSelectionForeground)'
                    : undefined,
            animation: isDeleting ? 'shake 0.3s ease-in-out' : undefined
        }, onClick: isDeleting ? () => {
            onDelete?.();
            setDeleteConfirm(null);
        } : onClick, children: [_jsx(FileJson, { size: 14, style: { marginRight: 6, opacity: 0.7 } }), _jsx("span", { style: {
                    fontSize: 10,
                    fontWeight: 600,
                    marginRight: 6,
                    color: methodColors[method] || 'var(--vscode-foreground)'
                }, children: method }), _jsx("span", { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: request.name }), onDelete && !isDeleting && (_jsx(Trash2, { size: 12, style: { opacity: 0.5, marginLeft: 4 }, onClick: (e) => {
                    e.stopPropagation();
                    setDeleteConfirm(request.id || null);
                } }))] }));
};
const FolderItem = ({ folder, level, selectedRequest, onSelectRequest, onToggleExpand, onDeleteRequest, deleteConfirm, setDeleteConfirm }) => {
    const isExpanded = folder.expanded ?? true;
    return (_jsxs("div", { children: [_jsxs(OperationItem, { style: { paddingLeft: 12 + (level * 12) }, onClick: onToggleExpand, children: [isExpanded ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 }), isExpanded ? _jsx(FolderOpen, { size: 14, style: { marginLeft: 4 } }) : _jsx(Folder, { size: 14, style: { marginLeft: 4 } }), _jsx("span", { style: { marginLeft: 6, fontWeight: 500 }, children: folder.name })] }), isExpanded && (_jsxs(_Fragment, { children: [folder.folders?.map(subFolder => (_jsx(FolderItem, { folder: subFolder, collectionId: "", level: level + 1, selectedRequest: selectedRequest, onSelectRequest: onSelectRequest, onToggleExpand: () => { }, onDeleteRequest: onDeleteRequest, deleteConfirm: deleteConfirm, setDeleteConfirm: setDeleteConfirm }, subFolder.id))), folder.requests.map(req => (_jsx(RequestItem, { request: req, isSelected: selectedRequest?.id === req.id, onClick: () => onSelectRequest(req), onDelete: () => onDeleteRequest?.(req), deleteConfirm: deleteConfirm, setDeleteConfirm: setDeleteConfirm }, req.id)))] }))] }));
};
export const CollectionList = ({ collections, selectedCollectionId, setSelectedCollectionId, selectedRequest, setSelectedRequest, setResponse, onAddCollection, onAddRequest, onDeleteCollection, onDeleteRequest, toggleCollectionExpand, toggleFolderExpand, deleteConfirm, setDeleteConfirm }) => {
    const handleSelectRequest = (req) => {
        setSelectedRequest(req);
        setResponse(null);
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'hidden' }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)',
                    padding: '5px 10px',
                    flexShrink: 0
                }, children: [_jsx("div", { style: {
                            fontSize: 11,
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            color: 'var(--vscode-sideBarTitle-foreground)',
                            flex: 1
                        }, children: "Collections" }), _jsx(HeaderButton, { onClick: onAddCollection, title: "New Collection", children: _jsx(Plus, { size: 16 }) })] }), _jsxs("div", { style: { padding: 10, flex: 1, overflowY: 'auto' }, children: [collections.length === 0 && (_jsxs("div", { style: {
                            opacity: 0.6,
                            fontStyle: 'italic',
                            textAlign: 'center',
                            padding: 20,
                            fontSize: 12
                        }, children: ["No REST collections yet.", _jsx("br", {}), "Click + to create one."] })), collections.map(collection => {
                        const isExpanded = collection.expanded ?? true;
                        const isSelected = selectedCollectionId === collection.id;
                        const isDeleting = deleteConfirm === collection.id;
                        return (_jsxs("div", { children: [_jsxs(OperationItem, { style: {
                                        fontWeight: 'bold',
                                        backgroundColor: isDeleting
                                            ? 'var(--vscode-inputValidation-errorBackground)'
                                            : isSelected
                                                ? 'var(--vscode-list-activeSelectionBackground)'
                                                : undefined,
                                        color: isDeleting
                                            ? 'var(--vscode-errorForeground)'
                                            : undefined,
                                        animation: isDeleting ? 'shake 0.3s ease-in-out' : undefined
                                    }, onClick: isDeleting ? () => {
                                        onDeleteCollection?.(collection);
                                        setDeleteConfirm(null);
                                    } : () => {
                                        toggleCollectionExpand(collection.id);
                                        setSelectedCollectionId(collection.id);
                                    }, children: [isExpanded ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 }), _jsx(Folder, { size: 14, style: { marginLeft: 4 } }), _jsx("span", { style: { marginLeft: 6, flex: 1 }, children: collection.name }), !isDeleting && (_jsxs(_Fragment, { children: [_jsx("div", { title: "Add Request", onClick: (e) => {
                                                        e.stopPropagation();
                                                        onAddRequest(collection.id);
                                                    }, style: { display: 'flex', alignItems: 'center' }, children: _jsx(Plus, { size: 12, style: { opacity: 0.5, marginLeft: 4 } }) }), onDeleteCollection && (_jsx(Trash2, { size: 12, style: { opacity: 0.5, marginLeft: 4 }, onClick: (e) => {
                                                        e.stopPropagation();
                                                        setDeleteConfirm(collection.id);
                                                    } }))] }))] }), isExpanded && (_jsxs(_Fragment, { children: [collection.folders?.map(folder => (_jsx(FolderItem, { folder: folder, collectionId: collection.id, level: 1, selectedRequest: selectedRequest, onSelectRequest: handleSelectRequest, onToggleExpand: () => toggleFolderExpand(collection.id, folder.id), onDeleteRequest: onDeleteRequest, deleteConfirm: deleteConfirm, setDeleteConfirm: setDeleteConfirm }, folder.id))), collection.requests.map(req => (_jsx(RequestItem, { request: req, isSelected: selectedRequest?.id === req.id, onClick: () => handleSelectRequest(req), onDelete: () => onDeleteRequest?.(req), deleteConfirm: deleteConfirm, setDeleteConfirm: setDeleteConfirm }, req.id))), collection.requests.length === 0 && (!collection.folders || collection.folders.length === 0) && (_jsx("div", { style: {
                                                paddingLeft: 28,
                                                opacity: 0.5,
                                                fontSize: 11,
                                                fontStyle: 'italic'
                                            }, children: "No requests yet" }))] }))] }, collection.id));
                    })] })] }));
};
