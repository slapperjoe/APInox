import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ChevronRight, ChevronDown, Plus, Trash2, Code, Globe, Zap } from 'lucide-react';
import { HeaderButton, OperationItem, RequestItem } from './shared/SidebarStyles';
export const ServiceTree = ({ interfaces, isExplorer, selectedInterface, selectedOperation, selectedRequest, confirmDeleteId, onToggleInterface, onSelectInterface, onToggleOperation, onSelectOperation, onSelectRequest, onContextMenu, onAddToProject, onRemoveFromExplorer, onDeleteInterface, onAddRequest, onDeleteOperation, onDeleteRequest, setConfirmDeleteId, renameId, renameValue, onRenameChange, onRenameSubmit, onRenameCancel }) => {
    return (_jsx(_Fragment, { children: interfaces.map((iface, i) => (_jsxs("div", { children: [_jsxs(OperationItem, { "$active": selectedInterface?.id && iface.id ? selectedInterface.id === iface.id : selectedInterface?.name === iface.name, onContextMenu: (e) => onContextMenu(e, 'interface', iface), onClick: () => onSelectInterface(iface), style: { paddingLeft: 20 }, children: [_jsx("span", { onClick: (e) => { e.stopPropagation(); onToggleInterface(iface); }, style: { marginRight: 5, display: 'flex', cursor: 'pointer' }, children: iface.expanded !== false ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 }) }), _jsxs("span", { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: [iface.name, " ", isExplorer ? '(Preview)' : ''] }), isExplorer && selectedInterface?.name === iface.name && onAddToProject && onRemoveFromExplorer && (_jsxs("div", { style: { display: 'flex', alignItems: 'center' }, children: [_jsx(HeaderButton, { onClick: (e) => { e.stopPropagation(); onAddToProject(iface); }, title: "Add to Project", children: _jsx(Plus, { size: 14 }) }), _jsx(HeaderButton, { onClick: (e) => { e.stopPropagation(); onRemoveFromExplorer(iface); }, title: "Remove from Explorer", children: _jsx(Trash2, { size: 14 }) })] })), !isExplorer && selectedInterface?.name === iface.name && onDeleteInterface && (_jsx("div", { style: { marginLeft: 'auto', display: 'flex', alignItems: 'center' }, children: _jsx(HeaderButton, { onClick: (e) => {
                                    e.stopPropagation();
                                    if (confirmDeleteId === iface.name) {
                                        onDeleteInterface(iface);
                                        setConfirmDeleteId(null);
                                    }
                                    else {
                                        setConfirmDeleteId(iface.name);
                                        setTimeout(() => setConfirmDeleteId(null), 3000);
                                    }
                                }, title: confirmDeleteId === iface.name ? "Click again to Confirm Delete" : "Delete Interface", style: { color: confirmDeleteId === iface.name ? 'var(--vscode-errorForeground)' : undefined }, "$shake": confirmDeleteId === iface.name, children: _jsx(Trash2, { size: 12 }) }) }))] }), iface.expanded !== false && iface.operations.map((op, j) => {
                    return (_jsxs("div", { style: { marginLeft: 15 }, children: [_jsxs(OperationItem, { "$active": selectedOperation?.id && op.id ? selectedOperation.id === op.id : (selectedOperation?.name === op.name && selectedInterface?.name === iface.name), onClick: () => onSelectOperation(op, iface), onContextMenu: (e) => onContextMenu(e, 'operation', op), children: [_jsx("span", { style: { marginRight: 5, display: 'flex', alignItems: 'center', width: 14 }, children: _jsx("div", { onClick: (e) => { e.stopPropagation(); onToggleOperation(op, iface); }, style: { display: 'flex' }, children: op.expanded !== false ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 }) }) }), op.name, !isExplorer && selectedOperation?.name === op.name && (_jsxs("div", { style: { marginLeft: 'auto', display: 'flex', alignItems: 'center' }, children: [onAddRequest && (_jsx(HeaderButton, { onClick: (e) => { e.stopPropagation(); onAddRequest(op); }, title: "Add New Request", children: _jsx(Plus, { size: 12 }) })), onDeleteOperation && (_jsx(HeaderButton, { onClick: (e) => {
                                                    e.stopPropagation();
                                                    const id = `op-${iface.name}-${op.name}`;
                                                    if (confirmDeleteId === id) {
                                                        onDeleteOperation(op, iface);
                                                        setConfirmDeleteId(null);
                                                    }
                                                    else {
                                                        setConfirmDeleteId(id);
                                                        setTimeout(() => setConfirmDeleteId(null), 3000);
                                                    }
                                                }, title: confirmDeleteId === `op-${iface.name}-${op.name}` ? "Click to Confirm Delete" : "Delete Operation", style: { color: confirmDeleteId === `op-${iface.name}-${op.name}` ? 'var(--vscode-errorForeground)' : undefined }, "$shake": confirmDeleteId === `op-${iface.name}-${op.name}`, children: _jsx(Trash2, { size: 12 }) }))] }))] }), op.expanded !== false && op.requests.map((req, k) => {
                                const isRenaming = renameId === req.id;
                                return (_jsx(RequestItem, { "$active": selectedRequest?.id === req.id, onClick: (e) => {
                                        e.stopPropagation();
                                        onSelectRequest(req, op, iface);
                                    }, onContextMenu: (e) => onContextMenu(e, 'request', req), children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', width: '100%', overflow: 'hidden' }, children: [(() => {
                                                const type = req.requestType || 'soap';
                                                const iconProps = { size: 14, style: { marginRight: 6, flexShrink: 0 } };
                                                switch (type) {
                                                    case 'rest':
                                                        return _jsx(Globe, { ...iconProps, style: { ...iconProps.style, color: '#48bb78' } });
                                                    case 'graphql':
                                                        return _jsx(Zap, { ...iconProps, style: { ...iconProps.style, color: '#9f7aea' } });
                                                    case 'soap':
                                                    default:
                                                        return _jsx(Code, { ...iconProps, style: { ...iconProps.style, color: '#4299e1' } });
                                                }
                                            })(), isRenaming ? (_jsx("input", { type: "text", value: renameValue, onChange: (e) => onRenameChange?.(e.target.value), onBlur: () => onRenameSubmit?.(), onKeyDown: (e) => {
                                                    if (e.key === 'Enter')
                                                        onRenameSubmit?.();
                                                    if (e.key === 'Escape')
                                                        onRenameCancel?.();
                                                }, autoFocus: true, onClick: (e) => e.stopPropagation(), style: {
                                                    background: 'var(--vscode-input-background)',
                                                    color: 'var(--vscode-input-foreground)',
                                                    border: '1px solid var(--vscode-input-border)',
                                                    width: '100%'
                                                } })) : (_jsx("span", { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: req.name })), !isExplorer && onDeleteRequest && !isRenaming && (_jsx("div", { style: { marginLeft: 5 }, children: _jsx(HeaderButton, { onClick: (e) => {
                                                        e.stopPropagation();
                                                        if (confirmDeleteId === req.id) {
                                                            onDeleteRequest(req);
                                                            setConfirmDeleteId(null);
                                                        }
                                                        else {
                                                            setConfirmDeleteId(req.id);
                                                            setTimeout(() => setConfirmDeleteId(null), 3000);
                                                        }
                                                    }, title: confirmDeleteId === req.id ? "Click again to Confirm Delete" : "Delete Request", style: { color: confirmDeleteId === req.id ? 'var(--vscode-errorForeground)' : undefined }, "$shake": confirmDeleteId === req.id, children: _jsx(Trash2, { size: 12 }) }) }))] }) }, k));
                            })] }, j));
                })] }, i))) }));
};
