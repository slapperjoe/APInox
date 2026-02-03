import React, { useState } from 'react';
import styled from 'styled-components';
import { Plus, FolderPlus, ChevronDown, ChevronRight, Trash2, Lock, Save, ChevronsDownUp, ChevronsUpDown, Download, Upload, GripVertical } from 'lucide-react';
import { ApinoxProject, ApiInterface, ApiOperation, ApiRequest } from '@shared/models';
import { HeaderButton, OperationItem, SidebarContainer, SidebarContent, SidebarHeader, SidebarHeaderActions, SidebarHeaderTitle } from './shared/SidebarStyles';
import { ServiceTree } from './ServiceTree';
import { FolderTree } from './FolderTree';
import { ContextMenu, ContextMenuItem } from '../../styles/App.styles';
import { updateProjectWithRename } from '../../utils/projectUtils';
import { SaveErrorDialog } from '../SaveErrorDialog';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';

interface ProjectListProps {
    projects: ApinoxProject[];
    savedProjects: Set<string>;
    saveErrors: Map<string, string>;
    setSaveErrors: React.Dispatch<React.SetStateAction<Map<string, string>>>;
    workspaceDirty?: boolean;
    onAddProject: () => void;
    loadProject: () => void;
    saveProject: (proj: ApinoxProject) => void;
    onUpdateProject: (oldProject: ApinoxProject, newProject: ApinoxProject) => void;
    closeProject: (name: string) => void;

    // Toggle
    toggleProjectExpand: (name: string) => void;
    toggleInterfaceExpand: (projName: string, ifaceName: string) => void;
    toggleOperationExpand: (projName: string, ifaceName: string, opName: string) => void;
    expandAll: () => void;
    collapseAll: () => void;
    reorderItems: (itemId: string, targetId: string, position: 'before' | 'after', itemType: 'project' | 'folder' | 'interface', projectName?: string) => void;

    // Selection
    selectedProjectName: string | null;
    setSelectedProjectName: (name: string | null) => void;
    selectedInterface: ApiInterface | null;
    setSelectedInterface: (iface: ApiInterface | null) => void;
    selectedOperation: ApiOperation | null;
    setSelectedOperation: (op: ApiOperation | null) => void;
    selectedRequest: ApiRequest | null;
    setSelectedRequest: (req: ApiRequest | null) => void;
    setResponse: (res: any) => void;

    // Actions
    handleContextMenu: (e: React.MouseEvent, type: string, data: any, isExplorer?: boolean) => void;
    onAddRequest?: (op: ApiOperation) => void;
    onDeleteInterface?: (iface: ApiInterface) => void;
    onDeleteOperation?: (op: ApiOperation, iface: ApiInterface) => void;
    onDeleteRequest?: (req: ApiRequest) => void;
    onExportWorkspace?: () => void;
    // Folder handlers
    onAddFolder?: (projectName: string, parentFolderId?: string) => void;
    onAddRequestToFolder?: (projectName: string, folderId: string) => void;
    onDeleteFolder?: (projectName: string, folderId: string) => void;
    onToggleFolderExpand?: (projectName: string, folderId: string) => void;

    deleteConfirm: string | null;
    setDeleteConfirm: (id: string | null) => void;
    onRefreshInterface?: (projectName: string, iface: ApiInterface) => void;
    onBulkImport?: () => void;
}

const ProjectContainer = styled(SidebarContainer)`
    overflow: hidden;
`;

const ProjectContent = styled(SidebarContent)`
    overflow-y: auto;
`;

const ProjectRow = styled(OperationItem)<{ $isDragging?: boolean; $dropPosition?: 'before' | 'after' | null }>`
    font-weight: 600;
    font-size: 0.98em;
    padding-left: 5px;
    padding-top: 3px;
    padding-bottom: 3px;
    cursor: pointer;
    opacity: ${props => props.$isDragging ? 0.5 : 1};
    position: relative;
    
    ${props => props.$dropPosition === 'before' && `
        &::before {
            content: '';
            position: absolute;
            top: -2px;
            left: 0;
            right: 0;
            height: 2px;
            background: var(--apinox-focusBorder, #007ACC);
        }
    `}
    
    ${props => props.$dropPosition === 'after' && `
        &::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            right: 0;
            height: 2px;
            background: var(--apinox-focusBorder, #007ACC);
        }
    `}
`;

const DragHandle = styled.div<{ $visible: boolean }>`
    display: ${props => props.$visible ? 'flex' : 'none'};
    align-items: center;
    justify-content: center;
    cursor: grab;
    color: var(--apinox-foreground);
    opacity: 0.5;
    position: absolute;
    left: -18px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 100%;
    
    &:hover {
        opacity: 0.8;
    }
    
    &:active {
        cursor: grabbing;
    }
`;

const ProjectToggle = styled.span`
    cursor: pointer;
    display: flex;
    align-items: center;
`;

const RenameInput = styled.input`
    background: var(--apinox-input-background);
    color: var(--apinox-input-foreground);
    border: 1px solid var(--apinox-input-border);
    margin-left: 5px;
    flex: 1;
`;

const ProjectName = styled.span`
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-left: 5px;
`;

const SaveButton = styled(HeaderButton)<{ $hasError?: boolean }>`
    color: ${props => props.$hasError 
        ? 'var(--apinox-errorForeground)' 
        : 'var(--apinox-charts-orange)'};
`;

const ReadOnlyIcon = styled(Lock)`
    opacity: 0.5;
    margin-left: 5px;
`;

const MenuSeparator = styled.div`
    height: 1px;
    background-color: var(--apinox-menu-separatorBackground);
    margin: 4px 0;
`;

export const ProjectList: React.FC<ProjectListProps> = ({
    projects,
    savedProjects,
    saveErrors,
    setSaveErrors,

    onAddProject,
    loadProject,
    saveProject,
    onUpdateProject,
    closeProject,
    toggleProjectExpand,
    toggleInterfaceExpand,
    toggleOperationExpand,
    expandAll,
    collapseAll,
    reorderItems,
    setSelectedProjectName,
    selectedProjectName,
    setSelectedInterface,
    selectedInterface,
    setSelectedOperation,
    selectedOperation,
    setSelectedRequest,
    selectedRequest,
    setResponse,
    handleContextMenu: _handleContextMenu,
    onAddRequest,
    onDeleteInterface,
    onDeleteOperation,
    onDeleteRequest,
    onAddFolder,
    onAddRequestToFolder,
    onDeleteFolder,
    onToggleFolderExpand,
    deleteConfirm, // Global delete confirm from Sidebar parent
    setDeleteConfirm,
    onRefreshInterface,
    onExportWorkspace,
    onBulkImport
}) => {
    // Local state for folder selection
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

    // Save Error Dialog State
    const [errorDialogProject, setErrorDialogProject] = useState<string | null>(null);

    // Drag and Drop State
    const { dragState, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd } = useDragAndDrop({
        onReorder: reorderItems
    });

    // Inline Rename State
    const [renameId, setRenameId] = useState<string | null>(null);
    const [renameType, setRenameType] = useState<'project' | 'folder' | 'request' | 'interface' | 'operation' | null>(null);
    const [renameName, setRenameName] = useState<string>('');

    // Local Context Menu State
    const [localContextMenu, setLocalContextMenu] = useState<{ x: number; y: number; type: string; data: any } | null>(null);

    // Show error dialog when a save error occurs
    React.useEffect(() => {
        // Find the first project with an error that doesn't already have a dialog open
        const projectWithError = Array.from(saveErrors.keys()).find(name => 
            saveErrors.has(name) && name !== errorDialogProject
        );
        
        if (projectWithError && !errorDialogProject) {
            setErrorDialogProject(projectWithError);
        }
    }, [saveErrors, errorDialogProject]);

    const handleLocalContextMenu = (e: React.MouseEvent, type: string, data: any, _isExplorer?: boolean) => {
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
        if (type === 'project' && (data as ApinoxProject).readOnly) return;

        setLocalContextMenu({ x: e.clientX, y: e.clientY, type, data });
        // Also call parent handler if needed for side effects? No, we replace it.
        // But we might need key functionality not implemented here?
        // Let's implement full menu capability here.
    };

    const closeLocalContextMenu = () => setLocalContextMenu(null);

    const handleRenameStart = () => {
        console.log('[ProjectList] handleRenameStart triggered', localContextMenu);
        if (localContextMenu) {
            console.log('[ProjectList] Starting rename for:', {
                type: localContextMenu.type,
                id: localContextMenu.data.id || localContextMenu.data.name,
                name: localContextMenu.data.name
            });
            setRenameId(localContextMenu.data.id || localContextMenu.data.name); // Prefer ID, fallback to name for projects
            setRenameType(localContextMenu.type as any);
            setRenameName(localContextMenu.data.name);
            closeLocalContextMenu();
        }
    };

    const submitRename = () => {
        if (renameId && renameName.trim() && renameType) {
            console.log('[ProjectList] submitRename', { renameId, renameName: renameName.trim(), renameType });
            
            // Update projects
            const updatedProjects = updateProjectWithRename(projects, renameId, renameType, renameName.trim(), localContextMenu?.data);

            // Find the project that changed and save it
            // We can just save the specific project if we know which one?
            // updateProjectWithRename returns new array.
            // We need to call setProjects in App? No, ProjectList props has 'saveProject'.
            // 'saveProject' takes a single project.
            // We need to find the modified project.

            const originalProject = projects.find(p =>
                (p.id && p.id === renameId) ||
                p.name === renameId ||
                // Deep search for children?
                (renameType !== 'project' && (
                    p.folders?.some(f => f.id === renameId || f.requests.some(r => r.id === renameId)) ||
                    p.interfaces?.some(i => 
                        (i.id === renameId || i.name === renameId) || // Check interface itself
                        i.operations.some(o => 
                            (o.id === renameId || o.name === renameId) || // Check operation itself
                            o.requests.some(r => r.id === renameId) // Check requests
                        )
                    )
                ))
            );

            console.log('[ProjectList] originalProject found:', originalProject?.name);

            if (originalProject) {
                // Name might have changed!
                // Find the updated project in the new array.
                // Since updateProjectWithRename maps the array, the index is preserved.
                const index = projects.indexOf(originalProject);
                if (index !== -1 && updatedProjects[index]) {
                    console.log('[ProjectList] Calling onUpdateProject for:', updatedProjects[index].name);
                    // Pass both old and new to parent to update state and save
                    if (onUpdateProject) {
                        onUpdateProject(originalProject, updatedProjects[index]);
                    } else {
                        // Fallback (e.g., if prop missing, but it shouldn't be)
                        console.log('[ProjectList] onUpdateProject not available, using saveProject');
                        saveProject(updatedProjects[index]);
                    }
                }
            } else {
                console.warn('[ProjectList] Could not find project containing renamed item:', { renameId, renameType });
            }
        }
        setRenameId(null);
        setRenameType(null);
        setRenameName('');
    };

    // Save Error Dialog Handlers
    const handleRetrySave = () => {
        if (errorDialogProject) {
            const proj = projects.find(p => p.name === errorDialogProject);
            if (proj) {
                saveProject(proj);
            }
            // Clear the error so dialog doesn't reopen
            setSaveErrors(current => {
                const next = new Map(current);
                next.delete(errorDialogProject);
                return next;
            });
            setErrorDialogProject(null);
        }
    };

    const handleDeleteProject = () => {
        if (errorDialogProject) {
            closeProject(errorDialogProject);
            // Clear the error
            setSaveErrors(current => {
                const next = new Map(current);
                next.delete(errorDialogProject);
                return next;
            });
            setErrorDialogProject(null);
        }
    };

    const handleKeepProject = () => {
        if (errorDialogProject) {
            // Clear the error so dialog doesn't reopen
            setSaveErrors(current => {
                const next = new Map(current);
                next.delete(errorDialogProject);
                return next;
            });
            setErrorDialogProject(null);
        }
    };

    return (
        <ProjectContainer onClick={closeLocalContextMenu}>
            <SidebarHeader>
                <SidebarHeaderTitle>Workspace</SidebarHeaderTitle>
                <SidebarHeaderActions>
                    <HeaderButton onClick={collapseAll} title="Collapse All"><ChevronsDownUp size={16} /></HeaderButton>
                    <HeaderButton onClick={expandAll} title="Expand All"><ChevronsUpDown size={16} /></HeaderButton>
                    <HeaderButton onClick={onExportWorkspace} title="Export Workspace"><Upload size={16} /></HeaderButton>
                    <HeaderButton onClick={onBulkImport} title="Bulk Import"><Download size={16} /></HeaderButton>
                    <HeaderButton onClick={onAddProject} title="New Project"><Plus size={16} /></HeaderButton>
                    <HeaderButton onClick={loadProject} title="Add Project"><FolderPlus size={16} /></HeaderButton>
                </SidebarHeaderActions>
            </SidebarHeader>

            <ProjectContent>
                {(() => {
                    const sortedProjects = [...projects].sort((a, b) => {
                        if (a.readOnly && !b.readOnly) return 1;
                        if (!a.readOnly && b.readOnly) return -1;
                        return 0;
                    });

                    return sortedProjects.map((proj, pIdx) => {
                        // Project is selected if explicitly selected OR if any of its children are selected
                        const isProjectSelected = selectedProjectName === proj.name;
                        const isProjectActive = isProjectSelected && selectedInterface === null;
                        const isRenaming = renameId === (proj.id || proj.name) && renameType === 'project';
                        const isReadOnly = !!proj.readOnly;
                        const projId = proj.id || proj.name;
                        
                        // Drag state for this project
                        const isDragging = dragState.draggedItemId === projId;
                        const isDropTarget = dragState.dropTargetId === projId;
                        const dropPosition = isDropTarget ? dragState.dropPosition : null;

                        return (
                            <div key={proj.id || pIdx}>
                                <ProjectRow
                                    $active={isProjectActive}
                                    $isDragging={isDragging}
                                    $dropPosition={dropPosition}
                                    onDragOver={(e) => handleDragOver(e, projId, 'project')}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, projId, 'project')}
                                    onClick={() => {
                                        // Select project, clear interface/operation/request
                                        setSelectedProjectName(proj.name);
                                        setSelectedInterface(null);
                                        setSelectedOperation(null);
                                        setSelectedRequest(null);
                                    }}
                                    onContextMenu={(e) => handleLocalContextMenu(e, 'project', proj)}
                                >
                                    {!isReadOnly && !isRenaming && isProjectActive && (
                                        <DragHandle
                                            $visible={true}
                                            draggable
                                            onDragStart={(e) => {
                                                e.stopPropagation();
                                                handleDragStart(e, projId, 'project');
                                            }}
                                            onDragEnd={handleDragEnd}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <GripVertical size={14} />
                                        </DragHandle>
                                    )}
                                    
                                    <ProjectToggle
                                        onClick={(e) => { e.stopPropagation(); toggleProjectExpand(proj.name); }}
                                    >
                                        {(proj as any).expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </ProjectToggle>

                                    {isRenaming ? (
                                        <RenameInput
                                            type="text"
                                            value={renameName}
                                            onChange={(e) => setRenameName(e.target.value)}
                                            onBlur={submitRename}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') submitRename();
                                                if (e.key === 'Escape') {
                                                    setRenameId(null);
                                                    setRenameType(null);
                                                    setRenameName('');
                                                }
                                            }}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                            title="Rename project"
                                            placeholder="Project name"
                                        />
                                    ) : (
                                        <ProjectName>
                                            {proj.name || (proj as any).fileName}
                                        </ProjectName>
                                    )}

                                    {/* Unsaved Project: Show Manual Save Button (Required for first save) */}
                                    {(!(proj as any).fileName) && !isRenaming && !isReadOnly && (
                                        <SaveButton
                                            $hasError={saveErrors.has(proj.name)}
                                            onClick={(e) => { e.stopPropagation(); saveProject(proj); }}
                                            title={saveErrors.has(proj.name) 
                                                ? `Save Failed: ${saveErrors.get(proj.name)}` 
                                                : "Save Project (Required for Auto-Save)"}
                                        >
                                            <Save size={14} />
                                        </SaveButton>
                                    )}

                                    {isReadOnly && <ReadOnlyIcon size={12} />}

                                    {/* Add Folder button - only on selected project */}
                                    {isProjectActive && onAddFolder && !isRenaming && !isReadOnly && (
                                        <HeaderButton
                                            onClick={(e) => { e.stopPropagation(); onAddFolder(proj.name); }}
                                            title="Add Folder"
                                        >
                                            <FolderPlus size={14} />
                                        </HeaderButton>
                                    )}
                                    {/* Close button only when selected */}
                                    {isProjectActive && !isRenaming && !isReadOnly && (
                                        <HeaderButton
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (deleteConfirm === proj.name) {
                                                    closeProject(proj.name);
                                                    setDeleteConfirm(null);
                                                } else {
                                                    setDeleteConfirm(proj.name);
                                                    setTimeout(() => {
                                                        setDeleteConfirm(null);
                                                    }, 3000);
                                                }
                                            }}
                                            title={deleteConfirm === proj.name ? "Click again to Confirm Delete" : "Close Project"}
                                            style={{ color: deleteConfirm === proj.name ? 'var(--apinox-errorForeground)' : undefined }}
                                            $shake={deleteConfirm === proj.name}
                                        >
                                            <Trash2 size={14} />
                                        </HeaderButton>
                                    )}
                                </ProjectRow>
                                {(proj as any).expanded && (
                                    <>
                                        {/* Interfaces */}
                                        <ServiceTree
                                            interfaces={proj.interfaces}
                                            projects={projects}
                                            isExplorer={false}
                                            selectedInterface={selectedInterface}
                                            selectedOperation={selectedOperation}
                                            selectedRequest={selectedRequest}
                                            confirmDeleteId={deleteConfirm}
                                            setConfirmDeleteId={setDeleteConfirm}

                                            onToggleInterface={(iface) => toggleInterfaceExpand(proj.name, iface.name)}
                                            onSelectInterface={(iface) => {
                                                // Only select, don't expand - expand is chevron-only
                                                setSelectedProjectName(proj.name);
                                                setSelectedInterface(iface);
                                                setSelectedOperation(null);
                                                setSelectedRequest(null);
                                            }}
                                            onToggleOperation={(op, iface) => toggleOperationExpand(proj.name, iface.name, op.name)}
                                            onSelectOperation={(op, iface) => {
                                                // Only select operation, don't auto-select request
                                                setSelectedProjectName(proj.name);
                                                setSelectedInterface(iface);
                                                setSelectedOperation(op);
                                                setSelectedRequest(null);
                                            }}
                                            onSelectRequest={(req, op, iface) => {
                                                setSelectedProjectName(proj.name);
                                                setSelectedInterface(iface);
                                                setSelectedOperation(op);
                                                setSelectedRequest(req);
                                                setResponse(null);
                                            }}
                                            onContextMenu={(e, type, data) => handleLocalContextMenu(e, type, data, false)}

                                            onAddRequest={onAddRequest}
                                            onDeleteInterface={onDeleteInterface}
                                            onDeleteOperation={onDeleteOperation}
                                            onDeleteRequest={onDeleteRequest}
                                            onSaveProject={() => saveProject(proj)}
                                            recentlySaved={savedProjects.has(proj.name)}

                                            // Inline Rename Props
                                            renameId={renameId}
                                            renameType={renameType as 'interface' | 'operation' | 'request' | null}
                                            renameValue={renameName}
                                            onRenameChange={setRenameName}
                                            onRenameSubmit={submitRename}
                                            onRenameCancel={() => {
                                                setRenameId(null);
                                                setRenameType(null);
                                                setRenameName('');
                                            }}
                                            
                                            // Drag and drop props
                                            projectName={proj.name}
                                            dragState={dragState}
                                            onDragStart={handleDragStart}
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e, itemId, itemType) => handleDrop(e, itemId, itemType, proj.name)}
                                            onDragEnd={handleDragEnd}
                                        />

                                        {/* Folders */}
                                        {proj.folders && proj.folders.length > 0 && (
                                            <FolderTree
                                                folders={proj.folders}
                                                projectName={proj.name}
                                                selectedFolderId={selectedFolderId}
                                                setSelectedFolderId={setSelectedFolderId}
                                                selectedRequest={selectedRequest}
                                                setSelectedRequest={setSelectedRequest}
                                                setSelectedProjectName={setSelectedProjectName}
                                                setResponse={setResponse}
                                                onAddFolder={onAddFolder}
                                                onAddRequest={onAddRequestToFolder}
                                                onDeleteFolder={onDeleteFolder}
                                                onDeleteRequest={onDeleteRequest}
                                                onToggleFolderExpand={onToggleFolderExpand}
                                                deleteConfirm={deleteConfirm}
                                                setDeleteConfirm={setDeleteConfirm}
                                                onSaveProject={() => saveProject(proj)}
                                                handleContextMenu={handleLocalContextMenu}

                                                // Inline Rename Props
                                                renameId={renameId}
                                                renameType={renameType}
                                                renameValue={renameName}
                                                onRenameChange={setRenameName}
                                                onRenameSubmit={submitRename}
                                                onRenameCancel={() => {
                                                    setRenameId(null);
                                                    setRenameType(null);
                                                    setRenameName('');
                                                }}
                                                readOnly={isReadOnly}
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })
                })()}
            </ProjectContent>

            {/* Local Context Menu */}
            {localContextMenu && (
                <ContextMenu top={localContextMenu.y} left={localContextMenu.x}>
                    {(localContextMenu.type === 'project' || 
                      localContextMenu.type === 'folder' || 
                      localContextMenu.type === 'request' ||
                      localContextMenu.type === 'interface' ||
                      localContextMenu.type === 'operation') && (
                        <ContextMenuItem onClick={() => {
                            console.log('Clicked: Rename');
                            handleRenameStart();
                        }}>Rename</ContextMenuItem>
                    )}

                    {/* Replica of Global Menu Items for Fallback */}
                    {localContextMenu.type === 'request' && onDeleteRequest && (
                        <ContextMenuItem onClick={() => { onDeleteRequest(localContextMenu.data); closeLocalContextMenu(); }}>Delete</ContextMenuItem>
                    )}
                    {localContextMenu.type === 'folder' && onDeleteFolder && (
                        <ContextMenuItem onClick={() => { onDeleteFolder((localContextMenu.data as any).projectName || selectedProjectName || '', localContextMenu.data.id); closeLocalContextMenu(); }}>Delete</ContextMenuItem>
                    )}

                    {localContextMenu.type === 'interface' && onRefreshInterface && (
                        <>
                            <MenuSeparator />
                            <ContextMenuItem onClick={() => {
                                // We need project name. 
                                // `data` is ApiInterface. We need parent project.
                                // How do we get parent project name? 
                                // We don't have it easily in local data unless we passed it.
                                // But we can find it in projects array.
                                const iface = localContextMenu.data as ApiInterface;
                                const proj = projects.find(p => p.interfaces.some(i => i.name === iface.name));
                                // Pass interface object instead of just name for better identification
                                if (proj) {
                                    onRefreshInterface(proj.name, iface);
                                }
                                closeLocalContextMenu();
                            }}>
                                Refresh Definition
                            </ContextMenuItem>
                        </>
                    )}

                    {/* Note: This is a simplified menu. Complex global actions like "Export Native" or "Add to Project" might be missing if not handled here. 
                           However, standard Rename/Delete are covered. 
                           To be safe, we could offer "More..." that triggers global handleContextMenu?
                           Or simpler: we just handle Rename here and forward others? NO, standard context menu implies replacing it.
                        */}
                </ContextMenu>
            )}

            {/* Save Error Dialog */}
            {errorDialogProject && saveErrors.has(errorDialogProject) && (
                <SaveErrorDialog
                    projectName={errorDialogProject}
                    errorMessage={saveErrors.get(errorDialogProject) || 'Unknown error'}
                    onRetry={handleRetrySave}
                    onDelete={handleDeleteProject}
                    onKeep={handleKeepProject}
                />
            )}
        </ProjectContainer>
    );
};
