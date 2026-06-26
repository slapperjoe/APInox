import React, { useState } from 'react';
import styled from 'styled-components';
import { Plus, Trash2, Play } from 'lucide-react';
import { SidebarContextMenu, CtxMenuSection } from './shared/SidebarContextMenu';
import { ScrapbookRequest } from '@shared/models';
import { SidebarHeaderActions, SidebarHeaderTitle, RequestItem as BaseRequestItem } from './shared/SidebarStyles';
import { HeaderButton } from '../common/Button';
import { SPACING_SM } from '../../styles/spacing';
import { EmptyState } from '../common/EmptyState';

export interface ScrapbookPanelProps {
    requests: ScrapbookRequest[];
    selectedRequest: ScrapbookRequest | null;
    loading: boolean;
    onCreateRequest: () => void;
    onSelectRequest: (request: ScrapbookRequest) => void;
    onDeleteRequest: (id: string) => void;
    onExecuteRequest: (request: ScrapbookRequest) => void;
}

const SectionHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px;
    min-height: 28px;
    user-select: none;
    margin-left: -10px;
    margin-right: -10px;
`;

const RequestList = styled.div`
    display: flex;
    flex-direction: column;
`;

const RequestItem = styled(BaseRequestItem)<{ $selected: boolean }>`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    background-color: ${props => props.$selected ? 'var(--apinox-list-activeSelectionBackground)' : 'transparent'};
    color: ${props => props.$selected ? 'var(--apinox-list-activeSelectionForeground)' : 'inherit'};
    
    &:hover {
        background-color: ${props => props.$selected ? 'var(--apinox-list-activeSelectionBackground)' : 'var(--apinox-list-hoverBackground)'};
    }
`;

const RequestName = styled.div`
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const RequestActions = styled.div`
    display: flex;
    gap: ${SPACING_SM};
    opacity: 0.7;

    &:hover {
        opacity: 1;
    }
`;

const IconButton = styled.button`
    background: transparent;
    border: none;
    color: var(--apinox-foreground);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;

    &:hover {
        background: var(--apinox-list-hoverBackground);
    }

    &:active {
        background: var(--apinox-list-activeSelectionBackground);
    }
`;

export const ScrapbookPanel: React.FC<ScrapbookPanelProps> = ({
    requests,
    selectedRequest,
    loading,
    onCreateRequest,
    onSelectRequest,
    onDeleteRequest,
    onExecuteRequest,
}) => {
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; request: ScrapbookRequest } | null>(null);

    const handleContextMenu = (e: React.MouseEvent, request: ScrapbookRequest) => {
        e.preventDefault();
        e.stopPropagation();
        setCtxMenu({ x: e.clientX, y: e.clientY, request });
    };

    const closeCtxMenu = () => setCtxMenu(null);

    return (
        <>
            <SectionHeader>
                <SidebarHeaderTitle>Quick Requests</SidebarHeaderTitle>
                <SidebarHeaderActions>
                    <HeaderButton onClick={onCreateRequest} title="Create New Request">
                        <Plus size={16} />
                    </HeaderButton>
                </SidebarHeaderActions>
            </SectionHeader>

            {loading ? (
                <EmptyState icon={null} title="Loading..." />
            ) : requests.length === 0 ? (
                <EmptyState icon={null} title="No quick requests yet" description="Click + to create one." />
            ) : (
                <RequestList>
                    {requests.map(request => (
                        <RequestItem
                            key={request.id}
                            $selected={selectedRequest?.id === request.id}
                            $active={selectedRequest?.id === request.id}
                            onClick={() => onSelectRequest(request)}
                            onContextMenu={(e) => handleContextMenu(e, request)}
                        >
                            <RequestName title={request.name}>
                                {request.name}
                            </RequestName>
                            <RequestActions>
                                <IconButton
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onExecuteRequest(request);
                                    }}
                                    title="Execute Request"
                                >
                                    <Play size={14} />
                                </IconButton>
                                <IconButton
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteRequest(request.id);
                                    }}
                                    title="Delete Request"
                                >
                                    <Trash2 size={14} />
                                </IconButton>
                            </RequestActions>
                        </RequestItem>
                    ))}
                </RequestList>
            )}

            {/* Context Menu */}
            {ctxMenu && (
                <SidebarContextMenu
                    x={ctxMenu.x}
                    y={ctxMenu.y}
                    sections={[{
                        title: 'Actions',
                        items: [
                            { icon: Play, label: 'Execute Request', onClick: () => { onExecuteRequest(ctxMenu.request); closeCtxMenu(); } },
                            { icon: Trash2, label: 'Delete', danger: true, onClick: () => { onDeleteRequest(ctxMenu.request.id); closeCtxMenu(); } },
                        ],
                    }] as CtxMenuSection[]}
                    onClose={closeCtxMenu}
                />
            )}
        </>
    );
};
