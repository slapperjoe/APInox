/**
 * useContextMenu.ts
 *
 * Hook for managing context menu state and actions.
 * Extracted from App.tsx to reduce complexity.
 */
import { useState, useCallback } from 'react';
import { bridge } from '../utils/bridge';
import { generateXmlFromSchema } from '../utils/soapUtils';
export function useContextMenu({ setProjects, saveProject, setWorkspaceDirty, selectedInterface, selectedOperation, setSelectedInterface, setSelectedOperation, setSelectedRequest, setResponse }) {
    // State
    const [contextMenu, setContextMenu] = useState(null);
    const [renameState, setRenameState] = useState(null);
    // Actions
    const closeContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);
    const handleContextMenu = useCallback((e, type, data, isExplorer = false) => {
        // Prevent empty context menus
        if (type === 'interface')
            return;
        if (isExplorer && type === 'request')
            return; // Requests in explorer are read-only
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, type, data, isExplorer });
    }, []);
    const handleRename = useCallback(() => {
        if (contextMenu) {
            setRenameState({ active: true, type: contextMenu.type, data: contextMenu.data, value: contextMenu.data.name });
            closeContextMenu();
        }
    }, [contextMenu, closeContextMenu]);
    const handleDeleteRequest = useCallback((targetReq) => {
        const reqToRemove = targetReq || (contextMenu?.type === 'request' ? contextMenu.data : null);
        if (reqToRemove) {
            // Check context menu if relying on it
            if (!targetReq && contextMenu?.isExplorer)
                return;
            setProjects(prev => {
                // let projectChanged: ApinoxProject | null = null;
                const newProjects = prev.map(p => {
                    let changed = false;
                    const newInterfaces = p.interfaces.map(i => ({
                        ...i,
                        operations: i.operations.map(o => {
                            if (o.requests.includes(reqToRemove)) {
                                changed = true;
                                return { ...o, requests: o.requests.filter(r => r !== reqToRemove) };
                            }
                            return o;
                        })
                    }));
                    if (changed) {
                        const newP = { ...p, interfaces: newInterfaces, dirty: true };
                        // projectChanged = newP;
                        return newP;
                    }
                    return p;
                });
                // if (projectChanged) saveProject(projectChanged);
                return newProjects;
            });
            // Clear the deleted request selection but keep parent operation selected
            setSelectedRequest(null);
            if (contextMenu)
                closeContextMenu();
        }
    }, [contextMenu, setProjects, saveProject, closeContextMenu, setSelectedRequest]);
    const handleCloneRequest = useCallback(() => {
        if (contextMenu && contextMenu.type === 'request' && !contextMenu.isExplorer) {
            const req = contextMenu.data;
            setProjects(prev => prev.map(p => {
                let found = false;
                const newInterfaces = p.interfaces.map(i => ({
                    ...i,
                    operations: i.operations.map(o => {
                        if (o.requests.includes(req)) {
                            found = true;
                            const newReq = { ...req, name: `${req.name} Copy`, id: crypto.randomUUID(), dirty: true };
                            return { ...o, requests: [...o.requests, newReq] };
                        }
                        return o;
                    })
                }));
                if (found) {
                    return { ...p, interfaces: newInterfaces, dirty: true };
                }
                return p;
            }));
            closeContextMenu();
        }
    }, [contextMenu, setProjects, closeContextMenu]);
    const handleAddRequest = useCallback((targetOp) => {
        const op = targetOp || (contextMenu?.type === 'operation' ? contextMenu.data : null);
        if (op) {
            const newReqName = `Request ${op.requests.length + 1}`;
            // Try to clone first request or create blank
            let newReqContent = '';
            if (op.requests.length > 0) {
                newReqContent = op.requests[0].request;
            }
            else if (op.input && typeof op.input === 'object') {
                // Use schema generator
                const targetNs = op.targetNamespace || 'http://tempuri.org/';
                newReqContent = generateXmlFromSchema(op.name, op.input, targetNs);
            }
            else {
                // Fallback for empty/string input
                const targetNs = op.targetNamespace || (typeof op.input === 'string' ? op.input : 'http://tempuri.org/');
                newReqContent = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="${targetNs}">\n   <soapenv:Header/>\n   <soapenv:Body>\n      <web:${op.name}>\n         <!--Optional:-->\n      </web:${op.name}>\n   </soapenv:Body>\n</soapenv:Envelope>`;
            }
            const newRequest = {
                name: newReqName,
                request: newReqContent,
                id: crypto.randomUUID(),
                dirty: true,
                endpoint: op.requests[0]?.endpoint || ''
            };
            setProjects(prev => prev.map(p => {
                let found = false;
                const newInterfaces = p.interfaces.map(i => {
                    const newOps = i.operations.map(o => {
                        if (o.name === op.name && i.operations.includes(op)) {
                            found = true;
                            return { ...o, requests: [...o.requests, newRequest], expanded: true };
                        }
                        return o;
                    });
                    return { ...i, operations: newOps };
                });
                if (found) {
                    return { ...p, interfaces: newInterfaces, dirty: true };
                }
                return p;
            }));
            // Auto-select the new request
            setSelectedRequest(newRequest);
            setResponse(null);
            if (contextMenu)
                closeContextMenu();
        }
    }, [contextMenu, setProjects, closeContextMenu, setSelectedRequest, setResponse]);
    const handleDeleteInterface = useCallback((iface) => {
        setProjects(prev => {
            // let projectChanged: ApinoxProject | null = null;
            const newProjects = prev.map(p => {
                const hasInterface = p.interfaces.some(i => i.name === iface.name);
                if (hasInterface) {
                    const newInterfaces = p.interfaces.filter(i => i.name !== iface.name);
                    const newP = { ...p, interfaces: newInterfaces, dirty: true };
                    // projectChanged = newP;
                    return newP;
                }
                return p;
            });
            // if (projectChanged) saveProject(projectChanged);
            return newProjects;
        });
        setWorkspaceDirty(true);
        if (selectedInterface?.name === iface.name) {
            setSelectedInterface(null);
            setSelectedOperation(null);
            setSelectedRequest(null);
            setResponse(null);
        }
    }, [setProjects, saveProject, setWorkspaceDirty, selectedInterface, setSelectedInterface, setSelectedOperation, setSelectedRequest, setResponse]);
    const handleDeleteOperation = useCallback((op, iface) => {
        setProjects(prev => {
            // let projectChanged: ApinoxProject | null = null;
            const newProjects = prev.map(p => {
                const targetInterface = p.interfaces.find(i => i.name === iface.name);
                if (targetInterface) {
                    const newInterfaces = p.interfaces.map(i => {
                        if (i.name === iface.name) {
                            const newOps = i.operations.filter(o => o.name !== op.name);
                            return { ...i, operations: newOps };
                        }
                        return i;
                    });
                    const newP = { ...p, interfaces: newInterfaces, dirty: true };
                    // projectChanged = newP;
                    return newP;
                }
                return p;
            });
            // if (projectChanged) saveProject(projectChanged);
            return newProjects;
        });
        setWorkspaceDirty(true);
        if (selectedOperation?.name === op.name && selectedInterface?.name === iface.name) {
            setSelectedOperation(null);
            setSelectedRequest(null);
            setResponse(null);
        }
    }, [setProjects, saveProject, setWorkspaceDirty, selectedInterface, selectedOperation, setSelectedOperation, setSelectedRequest, setResponse]);
    const handleViewSample = useCallback(() => {
        if (contextMenu && (contextMenu.type === 'operation' || contextMenu.type === 'request')) {
            if (contextMenu.type === 'operation') {
                bridge.sendMessage({ command: 'getSampleSchema', operationName: contextMenu.data.name });
            }
            closeContextMenu();
        }
    }, [contextMenu, closeContextMenu]);
    const handleExportNative = useCallback((project) => {
        bridge.sendMessage({ command: 'exportNative', project });
        closeContextMenu();
    }, [closeContextMenu]);
    return {
        // State
        contextMenu,
        setContextMenu,
        renameState,
        setRenameState,
        // Actions
        handleContextMenu,
        closeContextMenu,
        handleRename,
        handleDeleteRequest,
        handleCloneRequest,
        handleAddRequest,
        handleDeleteInterface,
        handleDeleteOperation,
        handleViewSample,
        handleExportNative
    };
}
