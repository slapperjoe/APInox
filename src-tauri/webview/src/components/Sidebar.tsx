import React from 'react';
import styled from 'styled-components';
import { SidebarView } from '@shared/models';

// Components
import { ProjectList } from './sidebar/ProjectList';
import { ApiExplorerSidebar } from './sidebar/ApiExplorerSidebar';
import { TestsUi } from './sidebar/TestsUi';
import { WorkflowsUi } from './sidebar/WorkflowsUi';
// @ts-ignore - TS export detection issue; runtime export exists.
import HistorySidebar from './sidebar/HistorySidebar';
import { ScrapbookPanel } from './sidebar/ScrapbookPanel';
import { SidebarRail } from './sidebar/SidebarRail';

const SidebarContainer = styled.div<{ $collapsed: boolean }>`
    display: flex;
    height: 100%;
    flex-direction: row;
    min-width: ${props => props.$collapsed ? '50px' : '300px'};
    width: ${props => props.$collapsed ? '50px' : 'auto'};
    flex-shrink: 0;
`;

const SidebarContent = styled.div<{ $hidden: boolean }>`
    flex: ${props => props.$hidden ? 0 : 1};
    display: ${props => props.$hidden ? 'none' : 'flex'};
    flex-direction: column;
    overflow: hidden;
    background-color: var(--apinox-sideBar-background);
`;

// Prop Groups
import {
    SidebarProjectProps,
    SidebarExplorerProps,
    SidebarWsdlProps,
    SidebarSelectionProps,
    SidebarTestRunnerProps,
    SidebarTestsProps,
    SidebarWorkflowsProps,
    SidebarPerformanceProps,
    SidebarHistoryProps
} from '../types/props';

interface SidebarProps {
    projectProps: SidebarProjectProps;
    explorerProps: SidebarExplorerProps;
    wsdlProps: SidebarWsdlProps;
    selectionProps: SidebarSelectionProps;
    testRunnerProps: SidebarTestRunnerProps;
    testsProps: SidebarTestsProps;
    workflowsProps?: SidebarWorkflowsProps;
    performanceProps?: SidebarPerformanceProps;
    historyProps?: SidebarHistoryProps;


    // View State
    activeView: SidebarView;
    onChangeView: (view: SidebarView) => void;
    sidebarExpanded: boolean;

    // Global/Computed
    backendConnected: boolean;
    workspaceDirty?: boolean;
    showBackendStatus?: boolean;
    onSaveUiState?: () => void;
    onOpenSettings?: () => void;
    onOpenHelp?: () => void;

    // Environment indicator
    activeEnvironment?: string;
    environments?: Record<string, any>;
    onChangeEnvironment?: (env: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    projectProps,
    explorerProps,
    selectionProps,
    testRunnerProps: _testRunnerProps, // Legacy, tests now use testsProps
    testsProps,
    workflowsProps,
    performanceProps: _performanceProps, // Unused - performance removed
    historyProps,
    workspaceDirty,
    onOpenSettings,
    onOpenHelp,
    activeView,
    onChangeView,
    sidebarExpanded,
    activeEnvironment,
    environments,
    onChangeEnvironment
}) => {
    // Destructure for passing to legacy children (can be cleaned up later by moving groups down)
    const { projects, savedProjects, loadProject, saveProject, onUpdateProject, closeProject, onAddProject, toggleProjectExpand, toggleInterfaceExpand, toggleOperationExpand, expandAll, collapseAll, reorderItems, onDeleteInterface, onDeleteOperation, onAddFolder, onAddRequestToFolder, onDeleteFolder, onToggleFolderExpand, onRefreshInterface, onExportWorkspace, onBulkImport } = projectProps;
    const { exploredInterfaces, addToProject, addAllToProject, clearExplorer, removeFromExplorer, toggleExploredInterface, toggleExploredOperation } = explorerProps;

    const {
        selectedProjectName, setSelectedProjectName,
        selectedInterface, setSelectedInterface,
        selectedOperation, setSelectedOperation,
        selectedRequest, setSelectedRequest,
        setResponse, handleContextMenu, onAddRequest, onDeleteRequest,
        deleteConfirm, setDeleteConfirm
    } = selectionProps;

    const hideContent = !sidebarExpanded || activeView === SidebarView.HOME;

    return (
        <SidebarContainer $collapsed={hideContent}>
            <SidebarRail
                activeView={activeView}
                onChangeView={onChangeView}
                onOpenSettings={onOpenSettings}
                onOpenHelp={onOpenHelp}
                activeEnvironment={activeEnvironment}
                environments={environments}
                onChangeEnvironment={onChangeEnvironment}
            />

            {/* Content Area */}
            <SidebarContent $hidden={hideContent}>

                {activeView === SidebarView.TESTS && (
                    <TestsUi
                        projects={testsProps.projects}
                        selectedTestSuite={testsProps.selectedTestSuite}
                        selectedTestCase={testsProps.selectedTestCase}
                        onAddSuite={testsProps.onAddSuite}
                        onDeleteSuite={testsProps.onDeleteSuite}
                        onRunSuite={testsProps.onRunSuite}
                        onAddTestCase={testsProps.onAddTestCase}
                        onDeleteTestCase={testsProps.onDeleteTestCase}
                        onRenameTestCase={testsProps.onRenameTestCase}
                        onRunCase={testsProps.onRunCase}
                        onSelectSuite={testsProps.onSelectSuite}
                        onSelectTestCase={testsProps.onSelectTestCase}
                        onToggleSuiteExpand={testsProps.onToggleSuiteExpand}
                        onToggleCaseExpand={testsProps.onToggleCaseExpand}
                        onSelectTestStep={testsProps.onSelectTestStep}
                        onRenameTestStep={testsProps.onRenameTestStep}
                        deleteConfirm={testsProps.deleteConfirm}
                    />
                )}

                {activeView === SidebarView.WORKFLOWS && workflowsProps && (
                    <WorkflowsUi
                        {...workflowsProps}
                    />
                )}

                {activeView === SidebarView.HISTORY && historyProps && (
                    <HistorySidebar
                        {...historyProps}
                    />
                )}

                {activeView === SidebarView.EXPLORER && (
                    <ApiExplorerSidebar
                        exploredInterfaces={exploredInterfaces}

                        addToProject={addToProject}
                        addAllToProject={addAllToProject}
                        clearExplorer={clearExplorer}
                        removeFromExplorer={removeFromExplorer}
                        toggleExploredInterface={toggleExploredInterface}
                        toggleExploredOperation={toggleExploredOperation}

                        selectedInterface={selectedInterface}
                        setSelectedInterface={setSelectedInterface}
                        selectedOperation={selectedOperation}
                        setSelectedOperation={setSelectedOperation}
                        selectedRequest={selectedRequest}
                        setSelectedRequest={setSelectedRequest}
                        setSelectedProjectName={setSelectedProjectName}
                        setResponse={setResponse}

                        handleContextMenu={handleContextMenu}
                    />
                )}

                {activeView === SidebarView.PROJECTS && (
                    <ProjectList
                        projects={projects}
                        savedProjects={savedProjects}
                        saveErrors={projectProps.saveErrors}
                        setSaveErrors={projectProps.setSaveErrors}
                        workspaceDirty={workspaceDirty}
                        onAddProject={onAddProject}
                        loadProject={loadProject}
                        saveProject={saveProject}
                        onUpdateProject={onUpdateProject}
                        closeProject={closeProject}
                        toggleProjectExpand={toggleProjectExpand}
                        toggleInterfaceExpand={toggleInterfaceExpand}
                        toggleOperationExpand={toggleOperationExpand}
                        expandAll={expandAll}
                        collapseAll={collapseAll}
                        reorderItems={reorderItems}

                        selectedProjectName={selectedProjectName}
                        setSelectedProjectName={setSelectedProjectName}
                        selectedInterface={selectedInterface}
                        setSelectedInterface={setSelectedInterface}
                        selectedOperation={selectedOperation}
                        setSelectedOperation={setSelectedOperation}
                        selectedRequest={selectedRequest}
                        setSelectedRequest={setSelectedRequest}
                        setResponse={setResponse}

                        handleContextMenu={handleContextMenu}
                        onAddRequest={onAddRequest}
                        onDeleteInterface={onDeleteInterface}
                        onDeleteOperation={onDeleteOperation}
                        onDeleteRequest={onDeleteRequest}
                        onAddFolder={onAddFolder}
                        onAddRequestToFolder={onAddRequestToFolder}
                        onDeleteFolder={onDeleteFolder}
                        onToggleFolderExpand={onToggleFolderExpand}
                        deleteConfirm={deleteConfirm}
                        setDeleteConfirm={setDeleteConfirm}
                        onRefreshInterface={onRefreshInterface}
                        onExportWorkspace={onExportWorkspace}
                        onBulkImport={onBulkImport}
                    />
                )}

            </SidebarContent>
        </SidebarContainer>
    );
};
