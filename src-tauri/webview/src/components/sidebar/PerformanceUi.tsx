import React, { useState } from 'react';
import styled from 'styled-components';
import { Play, Square, Trash2, Plus, ChevronRight, ChevronDown } from 'lucide-react';
import { SidebarPerformanceProps } from '../../types/props';
import { ContextMenu, ContextMenuItem } from '../../styles/App.styles';
import { SidebarContainer, SidebarHeader, SidebarHeaderActions, SidebarHeaderTitle } from './shared/SidebarStyles';
import { IconButton, RunButton } from '../common/Button';
import { InlineFormInput } from '../common/Form';
import { SPACING_XS, SPACING_SM } from '../../styles/spacing';

// Styled Components
const Container = styled(SidebarContainer)`
    color: var(--vscode-foreground);
    background-color: var(--vscode-sideBar-background);
`;

const AddSuiteRow = styled.div`
    padding: ${SPACING_SM};
`;

const RequestIndent = styled.div`
    width: 14px;
`;

const EmptyMessage = styled.div`
    padding: 20px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
    font-size: 13px;
`;

const List = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 0;
`;

const SuiteItem = styled.div<{ active: boolean }>`
    display: flex;
    align-items: center;
    padding: ${SPACING_XS} ${SPACING_SM};
    cursor: pointer;
    background-color: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent'};
    color: ${props => props.active ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-list-inactiveSelectionForeground)'};

    &:hover {
        background-color: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-list-hoverBackground)'};
    }
`;

const SuiteIcon = styled.div`
    margin-right: ${SPACING_XS};
    display: flex;
    align-items: center;
`;

const SuiteLabel = styled.div`
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 13px;
`;

const Actions = styled.div`
    display: flex;
    gap: ${SPACING_XS};
    opacity: 0;
    ${SuiteItem}:hover & {
        opacity: 1;
    }
        color: var(--vscode-icon-foreground);
        ${SuiteItem}[data-active='true'] & {
            color: var(--vscode-list-activeSelectionForeground);
        }
`;

const RequestLabel = styled(SuiteLabel)`
    font-size: 12px;
`;

const RequestItem = styled.div<{ active: boolean }>`
    display: flex;
    align-items: center;
    padding: ${SPACING_XS} ${SPACING_SM} ${SPACING_XS} 28px;
    cursor: pointer;
    background-color: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent'};
    color: ${props => props.active ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-list-inactiveSelectionForeground)'};

    &:hover {
        background-color: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-list-hoverBackground)'};
    }
`;

export const PerformanceUi: React.FC<SidebarPerformanceProps> = ({
    suites,
    onAddSuite,
    onDeleteSuite,
    onRunSuite,
    onSelectSuite,
    onStopRun,
    isRunning,
    selectedSuiteId,
    deleteConfirm,
    setDeleteConfirm,
    onAddRequest,
    onDeleteRequest,
    onSelectRequest,
    onUpdateRequest,
    onToggleSuiteExpand,
    expandedSuiteIds = []
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newSuiteName, setNewSuiteName] = useState('');

    // Rename state
    const [renameId, setRenameId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [renameType, setRenameType] = useState<'suite' | 'request' | null>(null);
    const [renameParentId, setRenameParentId] = useState<string | null>(null);

    // Context Menu
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'suite' | 'request', id: string, parentId?: string, name: string } | null>(null);

    const checkExpanded = (id: string) => expandedSuiteIds.includes(id);

    const handleCreateSuite = () => {
        setIsAdding(true);
        const suggestedName = `Performance Suite ${suites.length + 1}`;
        setNewSuiteName(suggestedName);
    };

    const submitCreateSuite = () => {
        if (newSuiteName.trim()) {
            onAddSuite(newSuiteName.trim());
            setIsAdding(false);
            setNewSuiteName('');
        } else {
            setIsAdding(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') submitCreateSuite();
        if (e.key === 'Escape') setIsAdding(false);
    };

    // Rename handlers
    const startRename = (id: string, name: string, type: 'suite' | 'request', parentId?: string) => {
        setRenameId(id);
        setRenameValue(name);
        setRenameType(type);
        setRenameParentId(parentId || null);
        setContextMenu(null);
    };

    const submitRename = () => {
        if (renameId && renameValue.trim()) {
            if (renameType === 'request' && onUpdateRequest && renameParentId) {
                onUpdateRequest(renameParentId, renameId, { name: renameValue });
            }
            // Add suite rename logic here if needed (not in original scope but good to have)
        }
        setRenameId(null);
        setRenameValue('');
        setRenameType(null);
    };

    const handleContextMenu = (e: React.MouseEvent, type: 'suite' | 'request', id: string, name: string, parentId?: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, type, id, name, parentId });
    };

    // Close menu on click elsewhere
    React.useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    return (
        <Container>
            <SidebarHeader>
                <SidebarHeaderTitle>Performance Suites</SidebarHeaderTitle>
                <SidebarHeaderActions>
                    <IconButton onClick={handleCreateSuite} title="New Performance Suite">
                        <Plus size={14} />
                    </IconButton>
                    {isRunning && (
                        <IconButton onClick={onStopRun} title="Stop All Runs">
                            <Square size={14} fill="currentColor" />
                        </IconButton>
                    )}
                </SidebarHeaderActions>
            </SidebarHeader>

            <List>
                {isAdding && (
                    <AddSuiteRow>
                        <InlineFormInput
                            autoFocus
                            placeholder="Suite Name"
                            value={newSuiteName}
                            onChange={e => setNewSuiteName(e.target.value)}
                            onBlur={submitCreateSuite}
                            onKeyDown={handleKeyDown}
                            style={{ width: '100%' }}
                        />
                    </AddSuiteRow>
                )}

                {suites.map(suite => {
                    const expanded = checkExpanded(suite.id);
                    return (
                        <React.Fragment key={suite.id}>
                            <SuiteItem
                                active={selectedSuiteId === suite.id}
                                data-active={selectedSuiteId === suite.id}
                                onClick={() => onSelectSuite(suite.id)}
                            >
                                <SuiteIcon onClick={(e) => { e.stopPropagation(); onToggleSuiteExpand?.(suite.id); }}>
                                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </SuiteIcon>
                                <SuiteLabel>{suite.name}</SuiteLabel>
                                <Actions>
                                    <IconButton
                                        onClick={(e) => { e.stopPropagation(); onAddRequest?.(suite.id); }}
                                        title="Add Request"
                                    >
                                        <Plus size={14} />
                                    </IconButton>
                                    <RunButton
                                        onClick={(e) => { e.stopPropagation(); onRunSuite(suite.id); }}
                                        title="Run Suite"
                                    >
                                        <Play size={14} fill="currentColor" />
                                    </RunButton>
                                    <IconButton
                                        $shake={deleteConfirm === suite.id}
                                        $danger
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (deleteConfirm === suite.id) {
                                                onDeleteSuite(suite.id);
                                                setDeleteConfirm(null);
                                            } else {
                                                setDeleteConfirm(suite.id);
                                            }
                                        }}
                                        title={deleteConfirm === suite.id ? "Click again to delete" : "Delete Suite"}
                                    >
                                        <Trash2 size={14} />
                                    </IconButton>
                                </Actions>
                            </SuiteItem>

                            {/* Render Requests */}
                            {expanded && suite.requests?.map(req => (
                                <RequestItem
                                    key={req.id}
                                    active={false} // Currently we don't track selected request ID in sidebar explicitly? Or reuse selection context? using standard 'active' styling might be misleading if not synced
                                    onClick={() => onSelectRequest?.(req)}
                                    onContextMenu={(e) => handleContextMenu(e, 'request', req.id, req.name, suite.id)}
                                >
                                    <RequestIndent />
                                    {renameId === req.id ? (
                                        <InlineFormInput
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            onBlur={submitRename}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') submitRename();
                                                if (e.key === 'Escape') setRenameId(null);
                                                e.stopPropagation();
                                            }}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <RequestLabel>{req.name}</RequestLabel>
                                    )}
                                </RequestItem>
                            ))}
                        </React.Fragment>
                    );
                })}

                {suites.length === 0 && !isAdding && (
                    <EmptyMessage>
                        No performance suites.<br />
                        Click + to create one.
                    </EmptyMessage>
                )}
            </List>

            {contextMenu && (
                <ContextMenu top={contextMenu.y} left={contextMenu.x} onClick={(e: any) => e.stopPropagation()}>
                    <ContextMenuItem onClick={() => startRename(contextMenu.id, contextMenu.name, contextMenu.type, contextMenu.parentId)}>
                        Rename
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => {
                        if (contextMenu.type === 'request' && onDeleteRequest && contextMenu.parentId) {
                            onDeleteRequest(contextMenu.parentId, contextMenu.id);
                        }
                        if (contextMenu.type === 'suite') {
                            onDeleteSuite(contextMenu.id);
                        }
                        setContextMenu(null);
                    }}>
                        Delete
                    </ContextMenuItem>
                </ContextMenu>
            )}
        </Container>
    );
};
