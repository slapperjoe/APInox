import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { HeaderButton, SectionHeader } from './shared/SidebarStyles';
import { ServiceTree } from './ServiceTree';
export const ApiExplorerSidebar = ({ exploredInterfaces, addToProject, addAllToProject, clearExplorer, removeFromExplorer, toggleExploredInterface, toggleExploredOperation, selectedInterface, setSelectedInterface, selectedOperation, setSelectedOperation, selectedRequest, setSelectedRequest, setResponse, handleContextMenu }) => {
    // Local state for delete confirmation
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: [_jsx("div", { style: { borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)' }, children: _jsxs(SectionHeader, { children: [_jsx("div", { style: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--vscode-sideBarTitle-foreground)', flex: 1, display: 'flex', alignItems: 'center', gap: 5 }, children: "API Explorer" }), exploredInterfaces.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { style: { flex: 1 } }), _jsx(HeaderButton, { onClick: (e) => { e.stopPropagation(); addAllToProject(); }, title: "Add All to Project", children: _jsx(Plus, { size: 16 }) }), _jsx(HeaderButton, { onClick: (e) => { e.stopPropagation(); clearExplorer(); }, title: "Clear Explorer", children: _jsx(Trash2, { size: 16 }) })] }))] }) }), _jsx("div", { style: { padding: 10, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto' }, children: exploredInterfaces.length === 0 ? (_jsxs("div", { style: { textAlign: 'center', color: 'var(--vscode-descriptionForeground)', padding: '20px 0', fontSize: '0.9em' }, children: ["No APIs loaded.", _jsx("br", {}), _jsx("br", {}), "Use the main view to load a WSDL or OpenAPI spec."] })) : (_jsx(ServiceTree, { interfaces: exploredInterfaces, isExplorer: true, selectedInterface: selectedInterface, selectedOperation: selectedOperation, selectedRequest: selectedRequest, confirmDeleteId: confirmDeleteId, setConfirmDeleteId: setConfirmDeleteId, onToggleInterface: (iface) => toggleExploredInterface(iface.name), onSelectInterface: (iface) => {
                        // Only select, don't expand
                        setSelectedInterface(iface);
                        setSelectedOperation(null);
                        setSelectedRequest(null);
                    }, onToggleOperation: (op, iface) => toggleExploredOperation(iface.name, op.name), onSelectOperation: (op, iface) => {
                        // Only select operation, don't auto-select request
                        setSelectedInterface(iface);
                        setSelectedOperation(op);
                        setSelectedRequest(null);
                    }, onSelectRequest: (req, op, iface) => {
                        setSelectedInterface(iface);
                        setSelectedOperation(op);
                        setSelectedRequest(req);
                        setResponse(null);
                    }, onContextMenu: (e, type, data) => handleContextMenu(e, type, data, true), onAddToProject: addToProject, onRemoveFromExplorer: removeFromExplorer })) })] }));
};
