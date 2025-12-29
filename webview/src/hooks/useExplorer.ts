/**
 * useExplorer.ts
 * 
 * Hook for managing WSDL Explorer state and handlers.
 * Extracted from App.tsx to reduce complexity.
 */

import { useState, useCallback } from 'react';
import { SoapUIInterface, SoapUIProject } from '../models';

interface UseExplorerParams {
    projects: SoapUIProject[];
    setProjects: React.Dispatch<React.SetStateAction<SoapUIProject[]>>;
    setWorkspaceDirty: React.Dispatch<React.SetStateAction<boolean>>;
}

interface UseExplorerReturn {
    // State
    exploredInterfaces: SoapUIInterface[];
    setExploredInterfaces: React.Dispatch<React.SetStateAction<SoapUIInterface[]>>;
    explorerExpanded: boolean;
    setExplorerExpanded: React.Dispatch<React.SetStateAction<boolean>>;

    // Actions
    addToProject: (iface: SoapUIInterface) => void;
    addAllToProject: () => void;
    clearExplorer: () => void;
    removeFromExplorer: (iface: SoapUIInterface) => void;
    toggleExplorerExpand: () => void;
    toggleExploredInterface: (iName: string) => void;
    toggleExploredOperation: (iName: string, oName: string) => void;
}

export function useExplorer({
    projects,
    setProjects,
    setWorkspaceDirty
}: UseExplorerParams): UseExplorerReturn {
    // State
    const [exploredInterfaces, setExploredInterfaces] = useState<SoapUIInterface[]>([]);
    const [explorerExpanded, setExplorerExpanded] = useState(false);

    // Actions
    const clearExplorer = useCallback(() => {
        setExploredInterfaces([]);
        setExplorerExpanded(false);
    }, []);

    const addToProject = useCallback((iface: SoapUIInterface) => {
        // Prevent duplicates
        if (projects.length > 0 && projects[0].interfaces.some(i => i.name === iface.name)) {
            console.warn(`Interface ${iface.name} already exists in project`);
            return;
        }

        if (projects.length === 0) {
            setProjects([{
                name: 'Project 1',
                interfaces: [iface],
                expanded: true,
                dirty: true,
                id: Date.now().toString()
            }]);
        } else {
            setProjects(prev => prev.map((p, i) =>
                i === 0 ? { ...p, interfaces: [...p.interfaces, iface], dirty: true } : p
            ));
        }
        setWorkspaceDirty(true);

        // Clear from explorer
        setExploredInterfaces(prev => prev.filter(i => i.name !== iface.name));
        // Check if explorer should collapse
        setExploredInterfaces(prev => {
            if (prev.length === 0) {
                setExplorerExpanded(false);
            }
            return prev;
        });
    }, [projects, setProjects, setWorkspaceDirty]);

    const addAllToProject = useCallback(() => {
        if (projects.length === 0) {
            setProjects([{
                name: 'Project 1',
                interfaces: [...exploredInterfaces],
                expanded: true,
                dirty: true,
                id: Date.now().toString()
            }]);
        } else {
            setProjects(prev => prev.map((p, i) =>
                i === 0 ? {
                    ...p,
                    interfaces: [
                        ...p.interfaces,
                        ...exploredInterfaces.filter(ex => !p.interfaces.some(existing => existing.name === ex.name))
                    ],
                    dirty: true
                } : p
            ));
        }
        setWorkspaceDirty(true);
        clearExplorer();
    }, [projects, exploredInterfaces, setProjects, setWorkspaceDirty, clearExplorer]);

    const removeFromExplorer = useCallback((iface: SoapUIInterface) => {
        setExploredInterfaces(prev => prev.filter(i => i !== iface));
    }, []);

    const toggleExplorerExpand = useCallback(() => {
        setExplorerExpanded(prev => !prev);
    }, []);

    const toggleExploredInterface = useCallback((iName: string) => {
        setExploredInterfaces(prev =>
            prev.map(i => i.name === iName ? { ...i, expanded: !i.expanded } : i)
        );
    }, []);

    const toggleExploredOperation = useCallback((iName: string, oName: string) => {
        setExploredInterfaces(prev => prev.map(i => {
            if (i.name !== iName) return i;
            return {
                ...i,
                operations: i.operations.map(o =>
                    o.name === oName ? { ...o, expanded: !o.expanded } : o
                )
            };
        }));
    }, []);

    return {
        // State
        exploredInterfaces,
        setExploredInterfaces,
        explorerExpanded,
        setExplorerExpanded,

        // Actions
        addToProject,
        addAllToProject,
        clearExplorer,
        removeFromExplorer,
        toggleExplorerExpand,
        toggleExploredInterface,
        toggleExploredOperation
    };
}
