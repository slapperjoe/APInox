import React, { useState } from 'react';
import { Plus, FolderPlus, ChevronDown, ChevronRight, Save, Trash2 } from 'lucide-react';
import { SoapUIProject, SoapUIInterface, SoapUIOperation, SoapUIRequest } from '@shared/models';
import { HeaderButton, DirtyMarker, OperationItem } from './shared/SidebarStyles';
import { ServiceTree } from './ServiceTree';
import { FolderTree } from './FolderTree';

export interface ProjectListProps {
    projects: SoapUIProject[];
    savedProjects: Set<string>;
    workspaceDirty?: boolean;
    onAddProject: () => void;
    loadProject: () => void;
    saveProject: (proj: SoapUIProject) => void;
    closeProject: (name: string) => void;

    // Toggle
    toggleProjectExpand: (name: string) => void;
    toggleInterfaceExpand: (projName: string, ifaceName: string) => void;
    toggleOperationExpand: (projName: string, ifaceName: string, opName: string) => void;

    // Selection
    selectedProjectName: string | null;
    setSelectedProjectName: (name: string | null) => void;
    selectedInterface: SoapUIInterface | null;
    setSelectedInterface: (iface: SoapUIInterface | null) => void;
    selectedOperation: SoapUIOperation | null;
    setSelectedOperation: (op: SoapUIOperation | null) => void;
    selectedRequest: SoapUIRequest | null;
    setSelectedRequest: (req: SoapUIRequest | null) => void;
    setResponse: (res: any) => void;

    // Actions
    handleContextMenu: (e: React.MouseEvent, type: string, data: any, isExplorer?: boolean) => void;
    onAddRequest?: (op: SoapUIOperation) => void;
    onDeleteInterface?: (iface: SoapUIInterface) => void;
    onDeleteOperation?: (op: SoapUIOperation, iface: SoapUIInterface) => void;
    onDeleteRequest?: (req: SoapUIRequest) => void;
    // Folder handlers
    onAddFolder?: (projectName: string, parentFolderId?: string) => void;
    onAddRequestToFolder?: (projectName: string, folderId: string) => void;
    onDeleteFolder?: (projectName: string, folderId: string) => void;
    onToggleFolderExpand?: (projectName: string, folderId: string) => void;

    deleteConfirm: string | null;
    setDeleteConfirm: (id: string | null) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({
    projects,
    savedProjects,
    // workspaceDirty - removed, no longer shown
    onAddProject,
    loadProject,
    saveProject,
    closeProject,
    toggleProjectExpand,
    toggleInterfaceExpand,
    toggleOperationExpand,
    setSelectedProjectName,
    selectedProjectName,
    setSelectedInterface,
    selectedInterface,
    setSelectedOperation,
    selectedOperation,
    setSelectedRequest,
    selectedRequest,
    setResponse,
    handleContextMenu,
    onAddRequest,
    onDeleteInterface,
    onDeleteOperation,
    onDeleteRequest,
    onAddFolder,
    onAddRequestToFolder,
    onDeleteFolder,
    onToggleFolderExpand,
    deleteConfirm, // Global delete confirm from Sidebar parent
    setDeleteConfirm
}) => {
    // Local state for folder selection
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'hidden' }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border)',
                padding: '5px 10px',
                flexShrink: 0
            }}>
                <div style={{ fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--vscode-sideBarTitle-foreground)', flex: 1 }}>
                    Workspace
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <HeaderButton onClick={onAddProject} title="New Project"><Plus size={16} /></HeaderButton>
                    <div style={{ width: 10 }}></div>
                    <HeaderButton onClick={loadProject} title="Add Project"><FolderPlus size={16} /></HeaderButton>
                </div>
            </div>

            <div style={{ padding: 10, flex: 1, overflowY: 'auto' }}>
                {projects.map((proj, pIdx) => {
                    // Project is selected if explicitly selected OR if any of its children are selected
                    const isProjectSelected = selectedProjectName === proj.name;
                    const isProjectActive = isProjectSelected && selectedInterface === null;
                    return (
                        <div key={proj.id || pIdx}>
                            <OperationItem
                                active={isProjectActive}
                                onClick={() => {
                                    // Select project, clear interface/operation/request
                                    setSelectedProjectName(proj.name);
                                    setSelectedInterface(null);
                                    setSelectedOperation(null);
                                    setSelectedRequest(null);
                                }}
                                onContextMenu={(e) => handleContextMenu(e, 'project', proj)}
                                style={{ fontWeight: 'bold', paddingLeft: 5 }}
                            >
                                <span
                                    onClick={(e) => { e.stopPropagation(); toggleProjectExpand(proj.name); }}
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                >
                                    {(proj as any).expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </span>
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 5 }}>
                                    {proj.name || (proj as any).fileName} {proj.dirty && <DirtyMarker>●</DirtyMarker>}
                                </span>
                                {/* Save button when dirty OR recently saved (green confirmation) */}
                                {(proj.dirty || savedProjects.has(proj.name)) && (
                                    <HeaderButton onClick={(e) => { e.stopPropagation(); saveProject(proj); }} title="Save Project" style={{ color: savedProjects.has(proj.name) ? 'var(--vscode-testing-iconPassed)' : 'inherit' }}>
                                        <Save size={14} />
                                    </HeaderButton>
                                )}
                                {/* Add Folder button - only on selected project */}
                                {isProjectActive && onAddFolder && (
                                    <HeaderButton
                                        onClick={(e) => { e.stopPropagation(); onAddFolder(proj.name); }}
                                        title="Add Folder"
                                    >
                                        <FolderPlus size={14} />
                                    </HeaderButton>
                                )}
                                {/* Close button only when selected */}
                                {isProjectActive && (
                                    <HeaderButton
                                        onClick={(e) => { e.stopPropagation(); closeProject(proj.name); }}
                                        title={deleteConfirm === proj.name ? "Click again to Confirm Delete" : "Close Project"}
                                        style={{ color: deleteConfirm === proj.name ? 'var(--vscode-errorForeground)' : undefined }}
                                        shake={deleteConfirm === proj.name}
                                    >
                                        <Trash2 size={14} />
                                    </HeaderButton>
                                )}
                            </OperationItem>
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
                                        onContextMenu={(e, type, data) => handleContextMenu(e, type, data, false)}

                                        onAddRequest={onAddRequest}
                                        onDeleteInterface={onDeleteInterface}
                                        onDeleteOperation={onDeleteOperation}
                                        onDeleteRequest={onDeleteRequest}
                                        onSaveProject={() => saveProject(proj)}
                                        recentlySaved={savedProjects.has(proj.name)}
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
                                            handleContextMenu={handleContextMenu}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
