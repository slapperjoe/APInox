import React, { useState } from 'react';
import styled from 'styled-components';
import { Plus, Trash2 } from 'lucide-react';
import { ApiInterface, ApiOperation, ApiRequest } from '@shared/models';
import { HeaderButton, SidebarContainer, SidebarContent, SidebarHeader, SidebarHeaderActions, SidebarHeaderTitle } from './shared/SidebarStyles';
import { ServiceTree } from './ServiceTree';
import { ScrapbookPanel } from './ScrapbookPanel';
import { useScrapbook } from '../../contexts/ScrapbookContext';
import { bridge } from '../../utils/bridge';
import { FrontendCommand } from '@shared/messages';
import { SPACING_MD, SPACING_XL } from '../../styles/spacing';



export interface ApiExplorerSidebarProps {
    exploredInterfaces: ApiInterface[];
    // Actions
    addToProject: (iface: ApiInterface) => void;
    addAllToProject: () => void;
    clearExplorer: () => void;
    removeFromExplorer: (iface: ApiInterface) => void;
    toggleExploredInterface: (iName: string) => void;
    toggleExploredOperation: (iName: string, oName: string) => void;

    // Selection State
    selectedInterface: ApiInterface | null;
    setSelectedInterface: (iface: ApiInterface | null) => void;
    selectedOperation: ApiOperation | null;
    setSelectedOperation: (op: ApiOperation | null) => void;
    selectedRequest: ApiRequest | null;
    setSelectedRequest: (req: ApiRequest | null) => void;
    setSelectedProjectName: (name: string | null) => void;
    setResponse: (res: any) => void;

    handleContextMenu: (e: React.MouseEvent, type: string, data: any, isExplorer?: boolean) => void;
}

const ExplorerContent = styled(SidebarContent)`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_MD};
`;

const EmptyMessage = styled.div`
    text-align: center;
    color: var(--apinox-descriptionForeground);
    padding: ${SPACING_XL} 0;
    font-size: 0.9em;
`;

const Divider = styled.div`
    height: 1px;
    background: var(--apinox-widget-border);
    margin: ${SPACING_MD} 0;
`;

export const ApiExplorerSidebar: React.FC<ApiExplorerSidebarProps> = ({
    exploredInterfaces,
    addToProject,
    addAllToProject,
    clearExplorer,
    removeFromExplorer,
    toggleExploredInterface,
    toggleExploredOperation,
    selectedInterface,
    setSelectedInterface,
    selectedOperation,
    setSelectedOperation,
    selectedRequest,
    setSelectedRequest,
    setSelectedProjectName,
    setResponse,
    handleContextMenu
}) => {
    // Local state for delete confirmation
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // Scrapbook context
    const {
        scrapbookRequests,
        selectedScrapbookRequest,
        loading: scrapbookLoading,
        createRequest,
        selectRequest,
        deleteRequest
    } = useScrapbook();

    const handleExecuteScrapbookRequest = (request: any) => {
        // Convert scrapbook request to ApiRequest format
        const apiRequest: ApiRequest = {
            id: request.id,
            name: request.name,
            endpoint: request.endpoint || '',
            method: request.method || 'POST',
            contentType: request.contentType || 'application/xml',
            request: request.request || '',
            headers: request.headers || {},
            requestType: request.requestType || 'soap',
            bodyType: request.bodyType || 'xml'
        };
        
        // Select the request in the workspace
        setSelectedRequest(apiRequest);
        setSelectedInterface(null);
        setSelectedOperation(null);
        setResponse(null);

        // Execute the request
        bridge.sendMessage({
            command: FrontendCommand.ExecuteRequest,
            url: apiRequest.endpoint,
            operation: apiRequest.name,
            xml: apiRequest.request,
            contentType: apiRequest.contentType,
            headers: apiRequest.headers,
            requestType: apiRequest.requestType,
            method: apiRequest.method,
            bodyType: apiRequest.bodyType
        });
    };

    const handleSelectScrapbookRequest = (request: any) => {
        // Convert and select for editing (no execution)
        const apiRequest: ApiRequest = {
            id: request.id,
            name: request.name,
            endpoint: request.endpoint || '',
            method: request.method || 'POST',
            contentType: request.contentType || 'application/xml',
            request: request.request || '',
            headers: request.headers || {},
            requestType: request.requestType || 'soap',
            bodyType: request.bodyType || 'xml'
        };
        
        // Update scrapbook context
        selectRequest(request);
        
        // Clear ALL other contexts (project, explorer, test)
        setSelectedRequest(apiRequest); // Display scrapbook request in workspace
        setSelectedProjectName(null); // Clear project context
        setSelectedInterface(null); // Clear API explorer interface selection
        setSelectedOperation(null); // Clear API explorer operation selection
        setResponse(null); // Clear previous response
    };

    return (
        <SidebarContainer>

            <SidebarHeader>
                <SidebarHeaderTitle>API Explorer</SidebarHeaderTitle>
                {exploredInterfaces.length > 0 && (
                    <SidebarHeaderActions>
                        <HeaderButton onClick={(e) => { e.stopPropagation(); addAllToProject(); }} title="Add All to Project">
                            <Plus size={16} />
                        </HeaderButton>
                        <HeaderButton onClick={(e) => { e.stopPropagation(); clearExplorer(); }} title="Clear Explorer">
                            <Trash2 size={16} />
                        </HeaderButton>
                    </SidebarHeaderActions>
                )}
            </SidebarHeader>

            <ExplorerContent>
                {exploredInterfaces.length === 0 ? (
                    <EmptyMessage>
                        No APIs loaded.
                        <br /><br />
                        Use the main view to load a WSDL or OpenAPI spec.
                    </EmptyMessage>
                ) : (
                    <ServiceTree
                        interfaces={exploredInterfaces}
                        isExplorer={true}
                        selectedInterface={selectedInterface}
                        selectedOperation={selectedOperation}
                        selectedRequest={selectedRequest}
                        confirmDeleteId={confirmDeleteId}
                        setConfirmDeleteId={setConfirmDeleteId}


                        onToggleInterface={(iface) => toggleExploredInterface(iface.name)}
                        onSelectInterface={(iface) => {
                            // Clear all other contexts
                            selectRequest(null); // Clear scrapbook
                            setSelectedProjectName(null); // Clear project
                            // Select interface
                            setSelectedInterface(iface);
                            setSelectedOperation(null);
                            setSelectedRequest(null);
                        }}
                        onToggleOperation={(op, iface) => toggleExploredOperation(iface.name, op.name)}
                        onSelectOperation={(op, iface) => {
                            // Clear all other contexts
                            selectRequest(null); // Clear scrapbook
                            setSelectedProjectName(null); // Clear project
                            // Select operation
                            setSelectedInterface(iface);
                            setSelectedOperation(op);
                            setSelectedRequest(null);
                        }}
                        onSelectRequest={(req, op, iface) => {
                            // Clear all other contexts
                            selectRequest(null); // Clear scrapbook
                            setSelectedProjectName(null); // Clear project
                            // Select explorer request
                            setSelectedInterface(iface);
                            setSelectedOperation(op);
                            setSelectedRequest(req);
                            setResponse(null);
                        }}
                        onContextMenu={(e, type, data) => handleContextMenu(e, type, data, true)}

                        onAddToProject={addToProject}
                        onRemoveFromExplorer={removeFromExplorer}
                    />
                )}

                {/* Scrapbook Section */}
                <Divider />
                <ScrapbookPanel
                    requests={scrapbookRequests}
                    selectedRequest={selectedScrapbookRequest}
                    loading={scrapbookLoading}
                    onCreateRequest={createRequest}
                    onSelectRequest={handleSelectScrapbookRequest}
                    onDeleteRequest={deleteRequest}
                    onExecuteRequest={handleExecuteScrapbookRequest}
                />
            </ExplorerContent>
        </SidebarContainer>
    );
};
