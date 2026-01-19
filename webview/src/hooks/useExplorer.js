/**
 * useExplorer.ts
 *
 * Hook for managing WSDL Explorer state and handlers.
 * Extracted from App.tsx to reduce complexity.
 */
import { useState, useCallback } from 'react';
export function useExplorer({ projects: _projects, setProjects, setWorkspaceDirty, saveProject }) {
    // State
    const [exploredInterfaces, setExploredInterfaces] = useState([]);
    const [explorerExpanded, setExplorerExpanded] = useState(false);
    const [pendingAddInterface, setPendingAddInterface] = useState(null);
    // Actions
    const clearExplorer = useCallback(() => {
        setExploredInterfaces([]);
        setExplorerExpanded(false);
    }, []);
    // Helper to remove interface from explorer after adding
    const removeInterfaceFromExplorer = useCallback((ifaceName) => {
        setExploredInterfaces(prev => {
            const filtered = prev.filter(i => i.name !== ifaceName);
            if (filtered.length === 0) {
                setExplorerExpanded(false);
            }
            return filtered;
        });
    }, []);
    // Add interface to a specific named project (new or existing)
    const addInterfaceToNamedProject = useCallback((iface, projectName, isNew) => {
        if (isNew) {
            // Create new project with this interface
            const newProject = {
                name: projectName,
                interfaces: [iface],
                expanded: true,
                dirty: true,
                id: Date.now().toString()
            };
            setProjects(prev => [...prev, newProject]);
            // Force immediate save for new projects created from explorer
            saveProject(newProject);
        }
        else {
            // Add to existing project by name
            setProjects(prev => prev.map(p => p.name === projectName
                ? { ...p, interfaces: [...p.interfaces, iface], dirty: true }
                : p));
        }
        setWorkspaceDirty(true);
        removeInterfaceFromExplorer(iface.name);
    }, [setProjects, setWorkspaceDirty, removeInterfaceFromExplorer]);
    const addToProject = useCallback((iface) => {
        // Set pending interface to trigger modal
        setPendingAddInterface(iface);
    }, []);
    const addAllToProject = useCallback(() => {
        // Trigger modal for all explored interfaces
        // We'll use a special marker - first interface with a flag
        if (exploredInterfaces.length > 0) {
            // Set first interface as pending, the modal handler will check for all
            setPendingAddInterface({ ...exploredInterfaces[0], _addAll: true });
        }
    }, [exploredInterfaces]);
    const removeFromExplorer = useCallback((iface) => {
        setExploredInterfaces(prev => prev.filter(i => i !== iface));
    }, []);
    const toggleExplorerExpand = useCallback(() => {
        setExplorerExpanded(prev => !prev);
    }, []);
    const toggleExploredInterface = useCallback((iName) => {
        setExploredInterfaces(prev => prev.map(i => i.name === iName ? { ...i, expanded: !i.expanded } : i));
    }, []);
    const toggleExploredOperation = useCallback((iName, oName) => {
        setExploredInterfaces(prev => prev.map(i => {
            if (i.name !== iName)
                return i;
            return {
                ...i,
                operations: i.operations.map(o => o.name === oName ? { ...o, expanded: !o.expanded } : o)
            };
        }));
    }, []);
    return {
        // State
        exploredInterfaces,
        setExploredInterfaces,
        explorerExpanded,
        setExplorerExpanded,
        pendingAddInterface,
        setPendingAddInterface,
        // Actions
        addToProject,
        addInterfaceToNamedProject,
        addAllToProject,
        clearExplorer,
        removeFromExplorer,
        toggleExplorerExpand,
        toggleExploredInterface,
        toggleExploredOperation
    };
}
