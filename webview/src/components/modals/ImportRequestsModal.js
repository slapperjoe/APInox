import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * ImportRequestsModal Component
 *
 * Modal for selecting requests from workspace projects to import into a performance suite.
 */
import { useState } from 'react';
import styled from 'styled-components';
import { X, ChevronRight, ChevronDown, Check } from 'lucide-react';
const Overlay = styled.div `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
`;
const Modal = styled.div `
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 8px;
    min-width: 500px;
    max-width: 700px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
`;
const Header = styled.div `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    border-bottom: 1px solid var(--vscode-panel-border);
    
    h2 {
        margin: 0;
        font-size: 1.1em;
    }
`;
const CloseButton = styled.button `
    background: none;
    border: none;
    cursor: pointer;
    color: var(--vscode-foreground);
    opacity: 0.7;
    &:hover { opacity: 1; }
`;
const Content = styled.div `
    flex: 1;
    overflow-y: auto;
    padding: 15px 20px;
`;
const Footer = styled.div `
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 15px 20px;
    border-top: 1px solid var(--vscode-panel-border);
`;
const Button = styled.button `
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9em;
    border: none;
    background: ${props => props.primary ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)'};
    color: ${props => props.primary ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)'};
    
    &:hover {
        opacity: 0.9;
    }
    
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;
const TreeItem = styled.div `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    padding-left: ${props => 10 + props.level * 16}px;
    cursor: pointer;
    border-radius: 4px;
    background: ${props => props.selected ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent'};
    
    &:hover {
        background: var(--vscode-list-hoverBackground);
    }
`;
const Checkbox = styled.div `
    width: 16px;
    height: 16px;
    border: 1px solid var(--vscode-input-border);
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${props => props.checked ? 'var(--vscode-checkbox-background)' : 'transparent'};
    color: var(--vscode-checkbox-foreground);
`;
const EmptyState = styled.div `
    padding: 40px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
`;
export const ImportRequestsModal = ({ open, onClose, onImport, projects }) => {
    const [selected, setSelected] = useState(new Set());
    const [expanded, setExpanded] = useState({
        projects: new Set(),
        interfaces: new Set(),
        operations: new Set()
    });
    if (!open)
        return null;
    const toggleExpanded = (type, id) => {
        setExpanded(prev => {
            const newSet = new Set(prev[type]);
            if (newSet.has(id)) {
                newSet.delete(id);
            }
            else {
                newSet.add(id);
            }
            return { ...prev, [type]: newSet };
        });
    };
    const toggleSelected = (requestId) => {
        setSelected(prev => {
            const newSet = new Set(prev);
            if (newSet.has(requestId)) {
                newSet.delete(requestId);
            }
            else {
                newSet.add(requestId);
            }
            return newSet;
        });
    };
    const handleImport = () => {
        const requests = [];
        for (const project of projects) {
            for (const iface of project.interfaces) {
                for (const op of iface.operations) {
                    for (const req of op.requests) {
                        const reqId = req.id || req.name;
                        if (reqId && selected.has(reqId)) {
                            requests.push(req);
                        }
                    }
                }
            }
        }
        onImport(requests);
        onClose();
        setSelected(new Set());
    };
    const selectAll = () => {
        const allIds = new Set();
        for (const project of projects) {
            for (const iface of project.interfaces) {
                for (const op of iface.operations) {
                    for (const req of op.requests) {
                        const reqId = req.id || req.name;
                        if (reqId)
                            allIds.add(reqId);
                    }
                }
            }
        }
        setSelected(allIds);
    };
    const totalRequests = projects.reduce((sum, p) => sum + p.interfaces.reduce((iSum, i) => iSum + i.operations.reduce((oSum, o) => oSum + o.requests.length, 0), 0), 0);
    return (_jsx(Overlay, { onClick: onClose, children: _jsxs(Modal, { onClick: e => e.stopPropagation(), children: [_jsxs(Header, { children: [_jsx("h2", { children: "Import Requests from Workspace" }), _jsx(CloseButton, { onClick: onClose, children: _jsx(X, { size: 18 }) })] }), _jsx(Content, { children: projects.length === 0 || totalRequests === 0 ? (_jsxs(EmptyState, { children: ["No requests available in workspace.", _jsx("br", {}), "Load a WSDL and add requests to projects first."] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: { marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsxs("span", { style: { fontSize: '0.9em', opacity: 0.7 }, children: [selected.size, " of ", totalRequests, " selected"] }), _jsx(Button, { onClick: selectAll, children: "Select All" })] }), projects.map(project => (_jsxs("div", { children: [_jsxs(TreeItem, { level: 0, onClick: () => toggleExpanded('projects', project.name), children: [expanded.projects.has(project.name) ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 }), _jsx("strong", { children: project.name })] }), expanded.projects.has(project.name) && project.interfaces.map(iface => (_jsxs("div", { children: [_jsxs(TreeItem, { level: 1, onClick: () => toggleExpanded('interfaces', iface.name), children: [expanded.interfaces.has(iface.name) ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 }), iface.name] }), expanded.interfaces.has(iface.name) && iface.operations.map(op => (_jsxs("div", { children: [_jsxs(TreeItem, { level: 2, onClick: () => toggleExpanded('operations', op.name), children: [expanded.operations.has(op.name) ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 }), op.name, " (", op.requests.length, ")"] }), expanded.operations.has(op.name) && op.requests.map(req => {
                                                        const reqId = req.id || req.name || '';
                                                        return (_jsxs(TreeItem, { level: 3, selected: selected.has(reqId), onClick: () => toggleSelected(reqId), children: [_jsx(Checkbox, { checked: selected.has(reqId), children: selected.has(reqId) && _jsx(Check, { size: 12 }) }), req.name] }, reqId));
                                                    })] }, op.name)))] }, iface.name)))] }, project.name)))] })) }), _jsxs(Footer, { children: [_jsx(Button, { onClick: onClose, children: "Cancel" }), _jsxs(Button, { primary: true, onClick: handleImport, disabled: selected.size === 0, children: ["Import ", selected.size, " Request", selected.size !== 1 ? 's' : ''] })] })] }) }));
};
