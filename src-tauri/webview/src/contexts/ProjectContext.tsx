/**
 * ProjectContext.tsx
 * 
 * Centralizes project state management for the APInox application.
 * This context provides a single source of truth for:
 * - Projects list and their state
 * - Selected project tracking
 * - Workspace dirty state
 * - Project CRUD operations
 * 
 * Usage:
 *   1. Wrap your app with <ProjectProvider>
 *   2. Access state and actions via useProject() hook
 * 
 * Example:
 *   const { projects, addProject, saveProject } = useProject();
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { ApinoxProject } from '@shared/models';
import { BackendCommand } from '@shared/messages';
import { bridge } from '../utils/bridge';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Shape of the ProjectContext value.
 * Contains both state and actions for project management.
 */
interface ProjectContextValue {
    // -------------------------------------------------------------------------
    // STATE
    // -------------------------------------------------------------------------

    /** Array of all loaded projects */
    projects: ApinoxProject[];

    /** Name of the currently selected project (if any) */
    selectedProjectName: string | null;

    /** Flag indicating unsaved changes to workspace */
    workspaceDirty: boolean;

    /** Set of project names with pending save indicators */
    savedProjects: Set<string>;

    /** Map of project names to save error messages */
    saveErrors: Map<string, string>;

    /** ID of item awaiting delete confirmation (shared state for delete confirm pattern) */
    deleteConfirm: string | null;

    // -------------------------------------------------------------------------
    // STATE SETTERS (exposed for complex handlers in App.tsx)
    // -------------------------------------------------------------------------

    setProjects: React.Dispatch<React.SetStateAction<ApinoxProject[]>>;
    setSelectedProjectName: React.Dispatch<React.SetStateAction<string | null>>;
    setWorkspaceDirty: React.Dispatch<React.SetStateAction<boolean>>;
    setSavedProjects: React.Dispatch<React.SetStateAction<Set<string>>>;
    setSaveErrors: React.Dispatch<React.SetStateAction<Map<string, string>>>;
    setDeleteConfirm: React.Dispatch<React.SetStateAction<string | null>>;

    // -------------------------------------------------------------------------
    // ACTIONS
    // -------------------------------------------------------------------------

    /** Creates a new empty project with auto-generated name */
    addProject: () => void;

    /** 
     * Closes (removes) a project by name.
     * Uses double-click-to-confirm pattern via deleteConfirm state.
     */
    closeProject: (name: string) => void;

    /** Sends loadProject command to backend (optionally with specific path) */
    loadProject: (path?: string) => void;

    /** Sends saveProject command to backend */
    saveProject: (project: ApinoxProject) => void;

    /** Toggles the expanded state of a project in the sidebar */
    toggleProjectExpand: (name: string) => void;

    /** Toggles the expanded state of an interface within a project */
    toggleInterfaceExpand: (projectName: string, interfaceName: string) => void;

    /** Toggles the expanded state of an operation within an interface */
    toggleOperationExpand: (projectName: string, interfaceName: string, operationName: string) => void;

    /** Expands all projects, interfaces, and operations in the sidebar */
    expandAll: () => void;

    /** Collapses all projects, interfaces, and operations in the sidebar */
    collapseAll: () => void;

    /** Reorders items within their parent context */
    reorderItems: (itemId: string, targetId: string, position: 'before' | 'after', itemType: 'project' | 'folder' | 'interface', projectName?: string) => void;

    // -------------------------------------------------------------------------
    // UTILITIES
    // -------------------------------------------------------------------------

    /**
     * Helper to update a specific project by name.
     * Automatically marks project and workspace as dirty.
     * 
     * @param name - Project name to update
     * @param updater - Function that receives the project and returns updated version
     */
    updateProject: (name: string, updater: (p: ApinoxProject) => ApinoxProject) => void;

    /**
     * Finds a project by its name.
     * @returns The project or undefined if not found
     */
    findProjectByName: (name: string) => ApinoxProject | undefined;
}

// =============================================================================
// CONTEXT CREATION
// =============================================================================

/**
 * The React Context for project state.
 * Initially undefined - must be used within ProjectProvider.
 */
const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

interface ProjectProviderProps {
    children: ReactNode;
    /** 
     * Optional initial projects (e.g., from autosave restoration).
     * If not provided, starts with empty array.
     */
    initialProjects?: ApinoxProject[];
}

/**
 * Provider component that manages project state.
 * Wrap your application (or relevant portion) with this provider.
 */
export function ProjectProvider({ children, initialProjects = [] }: ProjectProviderProps) {
    // -------------------------------------------------------------------------
    // STATE
    // -------------------------------------------------------------------------

    const [projects, setProjects] = useState<ApinoxProject[]>(initialProjects);
    const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);
    const [workspaceDirty, setWorkspaceDirty] = useState(false);
    const [savedProjects, setSavedProjects] = useState<Set<string>>(new Set());
    const [saveErrors, setSaveErrors] = useState<Map<string, string>>(new Map());
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Sync projects to backend when they change
    useEffect(() => {
        // Debounce sync to avoid spamming bridge on rapid state changes
        const timer = setTimeout(() => {
            if (projects.length > 0) {
                // debugLog('Syncing projects to backend', { count: projects.length });
                bridge.sendMessage({ command: 'log', message: `[ProjectContext] Syncing projects. Count: ${projects.length}` });
                bridge.sendMessage({ command: 'syncProjects', projects });

                // Save the list of open project paths to settings
                // Filter out projects that don't have a file path yet or are the Samples project
                const openProjectPaths = projects
                    .filter(p => (p as any).fileName && p.name !== 'Samples' && p.id !== 'samples-project-read-only')
                    .map(p => (p as any).fileName as string);

                if (openProjectPaths.length > 0) {
                    bridge.sendMessage({
                        command: 'saveOpenProjects',
                        projectPaths: openProjectPaths
                    });
                }
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [projects]);

    // -------------------------------------------------------------------------
    // AUTO-SAVE
    // Watch for dirty projects and save them automatically
    // -------------------------------------------------------------------------
    useEffect(() => {
        const dirtyProjects = projects.filter(p => p.dirty && !p.readOnly && p.name !== 'Samples');

        if (dirtyProjects.length > 0) {
            const timer = setTimeout(() => {
                dirtyProjects.forEach(p => {
                    // bridge.sendMessage({ command: 'log', message: `[ProjectContext] Auto-saving project: ${p.name}` });
                    // We call the internal save logic directly
                    // Only auto-save if project is already saved to disk (has path)
                    if ((p as any).fileName) {
                        bridge.sendMessage({ command: 'saveProject', project: p });
                    }
                });
            }, 1000); // 1s debounce

            return () => clearTimeout(timer);
        }
    }, [projects]);

    // -------------------------------------------------------------------------
    // DEBUG LOGGING

    // -------------------------------------------------------------------------

    const debugLog = useCallback((action: string, data?: any) => {
        console.log(`[ProjectContext] ${action}`, data || '');
        bridge.sendMessage({ command: 'log', message: `[ProjectContext] ${action}`, data: JSON.stringify(data || {}) });
    }, []);

    // -------------------------------------------------------------------------
    // ACTIONS
    // -------------------------------------------------------------------------

    /**
     * Creates a new empty project.
     * Auto-generates name based on current project count.
     */
    const addProject = useCallback(() => {
        debugLog('addProject', { currentCount: projects.length });

        const name = `Project ${projects.length + 1}`;
        const newProject: ApinoxProject = {
            name,
            interfaces: [],
            expanded: true,
            dirty: true,
            id: Date.now().toString()
        };

        setProjects(prev => [...prev, newProject]);
        setWorkspaceDirty(true);

        debugLog('addProject complete', { newName: name });
    }, [projects.length, debugLog]);

    /**
     * Closes a project using double-click-to-confirm pattern.
     * First click: sets deleteConfirm to the project name
     * Second click (within 3s): actually removes the project
     */
    const closeProject = useCallback((name: string) => {
        debugLog('closeProject', { name, isConfirming: deleteConfirm === name });

        if (deleteConfirm === name) {
            // Second click - actually close
            setProjects(prev => prev.filter(p => p.name !== name));
            setWorkspaceDirty(true);

            // Notify backend that project is closed to clear from memory
            bridge.sendMessage({ command: 'closeProject', name });

            // Clear selection if we're closing the selected project
            if (selectedProjectName === name) {
                setSelectedProjectName(null);
            }

            setDeleteConfirm(null);
            debugLog('closeProject executed', { name });
        } else {
            // First click - request confirmation
            setDeleteConfirm(name);

            // Auto-clear after 3 seconds if not confirmed
            setTimeout(() => {
                setDeleteConfirm(current => current === name ? null : current);
            }, 3000);
        }
    }, [deleteConfirm, selectedProjectName, debugLog]);

    /**
     * Requests project load from backend.
     * If path is provided, loads that specific file.
     * If not, shows file picker dialog (handled by backend).
     */
    const loadProject = useCallback((path?: string) => {
        debugLog('loadProject', { path: path || 'picker' });
        bridge.sendMessage({ command: 'loadProject', path });
    }, [debugLog]);

    /**
     * Saves a project to the backend.
     * The backend handles file system operations and will respond
     * with 'projectSaved' message handled by useMessageHandler.
     */
    const saveProject = useCallback(async (project: ApinoxProject) => {
        debugLog('saveProject', { name: project.name, hasPath: !!(project as any).fileName });

        // If this is a new project (no file path) and we are in Tauri, prompt for location
        if (!(project as any).fileName && bridge.isTauri()) {
            try {
                // Dynamically import Tauri dialog plugin
                // Note: This requires @tauri-apps/plugin-dialog to be available in the build
                const { save } = await import('@tauri-apps/plugin-dialog');

                // Allow "Any" to simulate folder selection (since save dialog is for files)
                // We'll strip any extension later
                const filePath = await save({
                    // filters: [{
                    //     name: 'APInox Project Folder',
                    //     extensions: ['*'] 
                    // }],
                    defaultPath: `${project.name}`
                });

                if (filePath) {
                    // Strip .json if it was added by OS or user, because we save as FOLDER
                    const cleanPath = filePath.endsWith('.json')
                        ? filePath.slice(0, -5)
                        : filePath;

                    debugLog('saveProject: Dialog selected path', { filePath, cleanPath });
                    console.log('[ProjectContext] NEW PROJECT - Checking originalEndpoint before save:');
                    project.interfaces.forEach(iface => {
                        iface.operations.forEach(op => {
                            console.log(`  ${iface.name}.${op.name}: originalEndpoint=${op.originalEndpoint}`);
                        });
                    });
                    
                    bridge.sendMessage({ command: 'saveProject', project, filePath: cleanPath });
                } else {
                    debugLog('saveProject: Dialog cancelled');
                }
            } catch (e) {
                console.error('[ProjectContext] Failed to open save dialog:', e);
                // Fallback or alert user
                bridge.sendMessage({ command: 'log', message: `[ProjectContext] Error opening save dialog: ${e}` });
            }
            return;
        }

        bridge.sendMessage({ command: 'log', message: `[ProjectContext] saveProject called for: ${project.name}` });
        
        // Log interface displayNames for debugging
        const interfacesWithDisplayNames = project.interfaces.filter(i => (i as any).displayName);
        if (interfacesWithDisplayNames.length > 0) {
            console.log('[ProjectContext] Saving interfaces with displayNames:', interfacesWithDisplayNames.map(i => ({
                name: i.name,
                displayName: (i as any).displayName
            })));
        }
        
        bridge.sendMessage({ command: 'saveProject', project });
    }, [debugLog]);
    // -------------------------------------------------------------------------
    // MESSAGE HANDLING - Decentralized
    // -------------------------------------------------------------------------

    React.useEffect(() => {
        const handleMessage = (message: any) => {
            switch (message.command) {
                // ProjectLoaded sends a SINGLE project, not an array
                case BackendCommand.ProjectLoaded:
                    debugLog('Received ProjectLoaded', { name: message.project?.name, isReadOnly: message.isReadOnly });
                    if (message.project) {
                        // Log interface displayNames for debugging
                        const interfacesWithDisplayNames = message.project.interfaces?.filter((i: any) => i.displayName) || [];
                        if (interfacesWithDisplayNames.length > 0) {
                            console.log('[ProjectContext] Loaded interfaces with displayNames:', interfacesWithDisplayNames.map((i: any) => ({
                                name: i.name,
                                displayName: i.displayName
                            })));
                        } else if (message.project.interfaces?.length > 0) {
                            console.log('[ProjectContext] Loaded project but NO interfaces have displayName');
                        }
                        
                        // Add or update the single project in our list
                        setProjects(prev => {
                            const existingIndex = prev.findIndex(p =>
                                (p.id && p.id === message.project.id) || p.name === message.project.name
                            );

                            if (existingIndex !== -1) {
                                // Update existing
                                const updated = [...prev];
                                updated[existingIndex] = message.project;
                                return updated;
                            } else {
                                // Add new
                                return [...prev, message.project];
                            }
                        });
                        // Don't clear dirty flag for individual project loads
                    }
                    break;

                // Fallback for potential bulk load (if ever added)
                case 'projectsLoaded' as any:
                    debugLog('Received ProjectsLoaded (literal)', { count: message.projects?.length });
                    if (message.projects) {
                        setProjects(message.projects);
                        setWorkspaceDirty(false);
                    }
                    break;

                case BackendCommand.ProjectSaved:
                    debugLog('Received ProjectSaved', { name: message.projectName, fileName: message.fileName });

                    if (message.projectName) {
                        // Clear any save error for this project
                        setSaveErrors(current => {
                            const next = new Map(current);
                            next.delete(message.projectName);
                            return next;
                        });

                        setSavedProjects(current => {
                            const next = new Set(current);
                            next.add(message.projectName);
                            return next;
                        });

                        // CRITICAL: Update the project with the new fileName returned from backend
                        if (message.fileName) {
                            setProjects(prev => {
                                const updated = prev.map(p => {
                                    if (p.name === message.projectName) {
                                        return { ...p, fileName: message.fileName, dirty: false };
                                    }
                                    return p;
                                });
                                return updated;
                            });
                        }

                        // Auto-clear success indicator after 3s
                        setTimeout(() => {
                            setSavedProjects(current => {
                                const next = new Set(current);
                                next.delete(message.projectName);
                                return next;
                            });
                        }, 3000);
                    }
                    break;

                case BackendCommand.WorkspaceSaved:
                    debugLog('Received WorkspaceSaved');
                    setWorkspaceDirty(false);
                    break;
            }
        };

        const cleanup = bridge.onMessage(handleMessage);
        return () => cleanup();
    }, [debugLog]);

    /**
     * Toggles expanded/collapsed state of a project in the sidebar.
     */
    const toggleProjectExpand = useCallback((name: string) => {
        setProjects(prev => prev.map(p =>
            p.name === name ? { ...p, expanded: !p.expanded } : p
        ));
    }, []);

    /**
     * Toggles expanded/collapsed state of an interface within a project.
     */
    const toggleInterfaceExpand = useCallback((projectName: string, interfaceName: string) => {
        setProjects(prev => prev.map(p => {
            if (p.name !== projectName) return p;
            return {
                ...p,
                interfaces: p.interfaces.map(i =>
                    i.name === interfaceName ? { ...i, expanded: !i.expanded } : i
                )
            };
        }));
    }, []);

    /**
     * Toggles expanded/collapsed state of an operation within an interface.
     */
    const toggleOperationExpand = useCallback((projectName: string, interfaceName: string, operationName: string) => {
        setProjects(prev => prev.map(p => {
            if (p.name !== projectName) return p;
            return {
                ...p,
                interfaces: p.interfaces.map(i => {
                    if (i.name !== interfaceName) return i;
                    return {
                        ...i,
                        operations: i.operations.map(o =>
                            o.name === operationName ? { ...o, expanded: !o.expanded } : o
                        )
                    };
                })
            };
        }));
    }, []);

    /**
     * Expands all projects, interfaces, and operations in the sidebar.
     */
    const expandAll = useCallback(() => {
        setProjects(prev => prev.map(p => ({
            ...p,
            expanded: true,
            interfaces: p.interfaces.map(i => ({
                ...i,
                expanded: true,
                operations: i.operations.map(o => ({
                    ...o,
                    expanded: true
                }))
            }))
        })));
    }, []);

    /**
     * Collapses all projects, interfaces, and operations in the sidebar.
     */
    const collapseAll = useCallback(() => {
        setProjects(prev => prev.map(p => ({
            ...p,
            expanded: false,
            interfaces: p.interfaces.map(i => ({
                ...i,
                expanded: false,
                operations: i.operations.map(o => ({
                    ...o,
                    expanded: false
                }))
            }))
        })));
    }, []);

    // -------------------------------------------------------------------------
    // UTILITIES
    // -------------------------------------------------------------------------

    /**
     * Helper to update a specific project by name.
     * Automatically marks project and workspace as dirty.
     */
    const updateProject = useCallback((name: string, updater: (p: ApinoxProject) => ApinoxProject) => {
        setProjects(prev => prev.map(p => {
            if (p.name === name) {
                const updated = updater(p);
                return { ...updated, dirty: true };
            }
            return p;
        }));
        setWorkspaceDirty(true);
    }, []);

    /**
     * Reorders items within their parent context (same parent only)
     */
    const reorderItems = useCallback((
        itemId: string, 
        targetId: string, 
        position: 'before' | 'after', 
        itemType: 'project' | 'folder' | 'interface',
        projectName?: string
    ) => {
        if (itemType === 'project') {
            // Reorder projects
            setProjects(prev => {
                const arr = [...prev];
                const draggedIndex = arr.findIndex(p => p.id === itemId || p.name === itemId);
                const targetIndex = arr.findIndex(p => p.id === targetId || p.name === targetId);
                
                if (draggedIndex === -1 || targetIndex === -1) return prev;
                
                const [draggedItem] = arr.splice(draggedIndex, 1);
                const newTargetIndex = draggedIndex < targetIndex ? targetIndex : targetIndex + (position === 'after' ? 1 : 0);
                arr.splice(newTargetIndex, 0, draggedItem);
                
                return arr;
            });
            setWorkspaceDirty(true);
        } else if (itemType === 'folder' && projectName) {
            // Reorder folders within a project
            updateProject(projectName, project => {
                if (!project.folders) return project;
                
                const arr = [...project.folders];
                const draggedIndex = arr.findIndex(f => f.id === itemId);
                const targetIndex = arr.findIndex(f => f.id === targetId);
                
                if (draggedIndex === -1 || targetIndex === -1) return project;
                
                const [draggedItem] = arr.splice(draggedIndex, 1);
                const newTargetIndex = draggedIndex < targetIndex ? targetIndex : targetIndex + (position === 'after' ? 1 : 0);
                arr.splice(newTargetIndex, 0, draggedItem);
                
                return { ...project, folders: arr };
            });
        } else if (itemType === 'interface' && projectName) {
            // Reorder interfaces within a project
            updateProject(projectName, project => {
                const arr = [...project.interfaces];
                const draggedIndex = arr.findIndex(i => i.id === itemId || i.name === itemId);
                const targetIndex = arr.findIndex(i => i.id === targetId || i.name === targetId);
                
                if (draggedIndex === -1 || targetIndex === -1) return project;
                
                const [draggedItem] = arr.splice(draggedIndex, 1);
                const newTargetIndex = draggedIndex < targetIndex ? targetIndex : targetIndex + (position === 'after' ? 1 : 0);
                arr.splice(newTargetIndex, 0, draggedItem);
                
                return { ...project, interfaces: arr };
            });
        }
    }, [updateProject]);

    /**
     * Finds a project by name.
     */
    const findProjectByName = useCallback((name: string): ApinoxProject | undefined => {
        return projects.find(p => p.name === name);
    }, [projects]);

    // -------------------------------------------------------------------------
    // CONTEXT VALUE
    // -------------------------------------------------------------------------

    const value: ProjectContextValue = {
        // State
        projects,
        selectedProjectName,
        workspaceDirty,
        savedProjects,
        saveErrors,
        deleteConfirm,

        // Setters (exposed for complex handlers)
        setProjects,
        setSelectedProjectName,
        setWorkspaceDirty,
        setSavedProjects,
        setSaveErrors,
        setDeleteConfirm,

        // Actions
        addProject,
        closeProject,
        loadProject,
        saveProject,
        toggleProjectExpand,
        toggleInterfaceExpand,
        toggleOperationExpand,
        expandAll,
        collapseAll,
        reorderItems,

        // Utilities
        updateProject,
        findProjectByName
    };

    return (
        <ProjectContext.Provider value={value}>
            {children}
        </ProjectContext.Provider>
    );
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook to access project context.
 * Must be used within a ProjectProvider.
 * 
 * @throws Error if used outside of ProjectProvider
 * 
 * @example
 * function MySidebar() {
 *     const { projects, addProject } = useProject();
 *     return <button onClick={addProject}>Add Project</button>;
 * }
 */
export function useProject(): ProjectContextValue {
    const context = useContext(ProjectContext);

    if (context === undefined) {
        throw new Error('useProject must be used within a ProjectProvider');
    }

    return context;
}
