import React from 'react';
import styled from 'styled-components';
import { ChevronRight, ChevronDown, Plus, Trash2, Code, Globe, Zap, GripVertical, Network } from 'lucide-react';
import { ApiInterface, ApiOperation, ApiRequest, ApinoxProject } from '@shared/models';
import { HeaderButton, OperationItem, RequestItem } from './shared/SidebarStyles';
import { ICON_COLORS } from '../../styles/colors';

const InterfaceRow = styled(OperationItem)<{ $isDragging?: boolean; $dropPosition?: 'before' | 'after' | null }>`
    cursor: pointer;
    opacity: ${props => props.$isDragging ? 0.5 : 1};
    position: relative;
    padding-left: 20px;
    
    ${props => props.$dropPosition === 'before' && `
        &::before {
            content: '';
            position: absolute;
            top: -2px;
            left: 0;
            right: 0;
            height: 2px;
            background: var(--vscode-focusBorder, #007ACC);
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
            background: var(--vscode-focusBorder, #007ACC);
        }
    `}
`;

const DragHandle = styled.div<{ $visible: boolean }>`
    display: ${props => props.$visible ? 'flex' : 'none'};
    align-items: center;
    justify-content: center;
    cursor: grab;
    color: var(--vscode-foreground);
    opacity: 0.5;
    position: absolute;
    left: 2px;
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

const RenameInput = styled.input`
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 2px 4px;
    flex: 1;
    font-size: inherit;
`;

interface DragState {
    draggedItemId: string | null;
    draggedItemType: 'project' | 'folder' | 'interface' | null;
    dropTargetId: string | null;
    dropPosition: 'before' | 'after' | null;
}

interface ServiceTreeProps {
    interfaces: ApiInterface[];
    projects?: ApinoxProject[]; // For lookup when in project view
    isExplorer: boolean;

    // State
    selectedInterface: ApiInterface | null;
    selectedOperation: ApiOperation | null;
    selectedRequest: ApiRequest | null;
    confirmDeleteId: string | null;


    // Actions
    onToggleInterface: (iface: ApiInterface) => void;
    onSelectInterface: (iface: ApiInterface) => void;
    onToggleOperation: (op: ApiOperation, iface: ApiInterface) => void;
    onSelectOperation: (op: ApiOperation, iface: ApiInterface) => void;
    onSelectRequest: (req: ApiRequest, op: ApiOperation, iface: ApiInterface) => void;
    onContextMenu: (e: React.MouseEvent, type: string, data: any) => void;

    // Explorer Specific
    onAddToProject?: (iface: ApiInterface) => void;
    onRemoveFromExplorer?: (iface: ApiInterface) => void;

    // Project Specific
    onDeleteInterface?: (iface: ApiInterface) => void;
    onAddRequest?: (op: ApiOperation) => void;
    onDeleteOperation?: (op: ApiOperation, iface: ApiInterface) => void;
    onDeleteRequest?: (req: ApiRequest) => void;
    onSaveProject?: () => void; // Saves the parent project
    recentlySaved?: boolean; // True if project was recently saved (for green confirmation)

    setConfirmDeleteId: (id: string | null) => void;

    // Inline Rename Props
    renameId?: string | null;
    renameType?: 'interface' | 'operation' | 'request' | null;
    renameValue?: string;
    onRenameChange?: (val: string) => void;
    onRenameSubmit?: () => void;
    onRenameCancel?: () => void;
    
    // Drag and drop props
    projectName?: string;
    dragState?: DragState;
    onDragStart?: (e: React.DragEvent, itemId: string, itemType: 'interface') => void;
    onDragOver?: (e: React.DragEvent, itemId: string, itemType: 'interface') => void;
    onDragLeave?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent, itemId: string, itemType: 'interface') => void;
    onDragEnd?: () => void;
}

export const ServiceTree: React.FC<ServiceTreeProps> = ({
    interfaces,
    isExplorer,
    selectedInterface,
    selectedOperation,
    selectedRequest,
    confirmDeleteId,

    onToggleInterface,
    onSelectInterface,
    onToggleOperation,
    onSelectOperation,
    onSelectRequest,
    onContextMenu,
    onAddToProject,
    onRemoveFromExplorer,
    onDeleteInterface,
    onAddRequest,
    onDeleteOperation,
    onDeleteRequest,
    setConfirmDeleteId,

    renameId,
    renameType,
    renameValue,
    onRenameChange,
    onRenameSubmit,
    onRenameCancel,
    
    projectName,
    dragState,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd
}) => {
    return (
        <>
            {interfaces.map((iface, i) => {
                const ifaceId = iface.id || iface.name;
                const isDragging = dragState?.draggedItemId === ifaceId;
                const isDropTarget = dragState?.dropTargetId === ifaceId;
                const dropPosition = isDropTarget ? dragState?.dropPosition : null;
                const isRenaming = renameId === ifaceId && renameType === 'interface';
                const isSelected = selectedInterface?.id && iface.id ? selectedInterface.id === iface.id : selectedInterface?.name === iface.name;
                const showHandle = !isExplorer && !isRenaming && isSelected;
                
                return (
                <div key={i}>
                    <InterfaceRow
                        $active={isSelected}
                        $isDragging={isDragging}
                        $dropPosition={dropPosition}
                        onContextMenu={(e) => onContextMenu(e, 'interface', iface)}
                        onClick={() => onSelectInterface(iface)}
                        onDragOver={onDragOver && !isExplorer ? (e) => onDragOver(e, ifaceId, 'interface') : undefined}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop && !isExplorer ? (e) => onDrop(e, ifaceId, 'interface') : undefined}
                    >
                        {showHandle && onDragStart && onDragEnd && (
                            <DragHandle
                                $visible={true}
                                draggable
                                onDragStart={(e) => {
                                    e.stopPropagation();
                                    onDragStart(e, ifaceId, 'interface');
                                }}
                                onDragEnd={onDragEnd}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <GripVertical size={14} />
                            </DragHandle>
                        )}
                        <span
                            onClick={(e) => { e.stopPropagation(); onToggleInterface(iface); }}
                            style={{ marginRight: 5, display: 'flex', cursor: 'pointer' }}
                        >
                            {(iface as any).expanded !== false ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <Network size={14} style={{ marginRight: 6, flexShrink: 0, color: ICON_COLORS.INTERFACE }} />
                        {isRenaming ? (
                            <RenameInput
                                type="text"
                                value={renameValue}
                                onChange={(e) => onRenameChange?.(e.target.value)}
                                onBlur={onRenameSubmit}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') onRenameSubmit?.();
                                    if (e.key === 'Escape') onRenameCancel?.();
                                }}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {(iface as any).displayName || iface.name} {isExplorer ? '(Preview)' : ''}
                            </span>
                        )}
                        {isExplorer && selectedInterface?.name === iface.name && onAddToProject && onRemoveFromExplorer && (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <HeaderButton onClick={(e) => { e.stopPropagation(); onAddToProject(iface); }} title="Add to Project">
                                    <Plus size={14} />
                                </HeaderButton>
                                <HeaderButton onClick={(e) => { e.stopPropagation(); onRemoveFromExplorer(iface); }} title="Remove from Explorer">
                                    <Trash2 size={14} />
                                </HeaderButton>
                            </div>
                        )}
                        {!isExplorer && selectedInterface?.name === iface.name && onDeleteInterface && (
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                                <HeaderButton
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirmDeleteId === iface.name) {
                                            onDeleteInterface(iface);
                                            setConfirmDeleteId(null);
                                        } else {
                                            setConfirmDeleteId(iface.name);
                                            setTimeout(() => setConfirmDeleteId(null), 3000);
                                        }
                                    }}
                                    title={confirmDeleteId === iface.name ? "Click again to Confirm Delete" : "Delete Interface"}
                                    style={{ color: confirmDeleteId === iface.name ? 'var(--vscode-errorForeground)' : undefined }}
                                    $shake={confirmDeleteId === iface.name}
                                >
                                    <Trash2 size={12} />
                                </HeaderButton>
                            </div>
                        )}
                    </InterfaceRow>
                    {(iface as any).expanded !== false && (iface.operations || []).map((op: any, j: number) => {
                        const opId = op.id || op.name;
                        const isOpRenaming = renameId === opId && renameType === 'operation';
                        
                        return (
                            <div key={j} style={{ marginLeft: 15 }}>
                                <OperationItem
                                    $active={selectedOperation?.id && op.id ? selectedOperation.id === op.id : (selectedOperation?.name === op.name && selectedInterface?.name === iface.name)}
                                    onClick={() => onSelectOperation(op, iface)}
                                    onContextMenu={(e) => onContextMenu(e, 'operation', op)}
                                >
                                    <span style={{ marginRight: 5, display: 'flex', alignItems: 'center', width: 14 }}>
                                        {op.requests && op.requests.length > 0 && (
                                            <div onClick={(e) => { e.stopPropagation(); onToggleOperation(op, iface); }} style={{ display: 'flex' }}>
                                                {op.expanded !== false ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </div>
                                        )}
                                    </span>
                                    <Zap size={12} style={{ marginRight: 6, flexShrink: 0, color: ICON_COLORS.OPERATION }} />
                                    {isOpRenaming ? (
                                        <RenameInput
                                            type="text"
                                            value={renameValue}
                                            onChange={(e) => onRenameChange?.(e.target.value)}
                                            onBlur={onRenameSubmit}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') onRenameSubmit?.();
                                                if (e.key === 'Escape') onRenameCancel?.();
                                            }}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span style={{ flex: 1 }}>{op.displayName || op.name}</span>
                                    )}
                                    {!isExplorer && selectedOperation?.name === op.name && (
                                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                                            {onAddRequest && (
                                                <HeaderButton
                                                    onClick={(e) => { e.stopPropagation(); onAddRequest(op); }}
                                                    title="Add New Request"
                                                >
                                                    <Plus size={12} />
                                                </HeaderButton>
                                            )}
                                            {onDeleteOperation && (
                                                <HeaderButton
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const id = `op-${iface.name}-${op.name}`;
                                                        if (confirmDeleteId === id) {
                                                            onDeleteOperation(op, iface);
                                                            setConfirmDeleteId(null);
                                                        } else {
                                                            setConfirmDeleteId(id);
                                                            setTimeout(() => setConfirmDeleteId(null), 3000);
                                                        }
                                                    }}
                                                    title={confirmDeleteId === `op-${iface.name}-${op.name}` ? "Click to Confirm Delete" : "Delete Operation"}
                                                    style={{ color: confirmDeleteId === `op-${iface.name}-${op.name}` ? 'var(--vscode-errorForeground)' : undefined }}
                                                    $shake={confirmDeleteId === `op-${iface.name}-${op.name}`}
                                                >
                                                    <Trash2 size={12} />
                                                </HeaderButton>
                                            )}
                                        </div>
                                    )}
                                </OperationItem>

                                {/* Always render request children */}
                                {op.expanded !== false && (op.requests || []).map((req: any, k: number) => {
                                    const isRenaming = renameId === req.id;
                                    return (
                                        <RequestItem
                                            key={k}
                                            $active={selectedRequest?.id === req.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectRequest(req, op, iface);
                                            }}
                                            onContextMenu={(e) => onContextMenu(e, 'request', req)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
                                                {/* Request Icon */}
                                                {(() => {
                                                    const type = req.requestType || 'soap';
                                                    const iconProps = { size: 14, style: { marginRight: 6, flexShrink: 0 } };
                                                    switch (type) {
                                                        case 'rest':
                                                            return <Globe {...iconProps} style={{ ...iconProps.style, color: ICON_COLORS.FILE }} />;
                                                        case 'graphql':
                                                            return <Zap {...iconProps} style={{ ...iconProps.style, color: ICON_COLORS.OPERATION }} />;
                                                        case 'soap':
                                                        default:
                                                            return <Code {...iconProps} style={{ ...iconProps.style, color: ICON_COLORS.SERVICE }} />;
                                                    }
                                                })()}

                                                {isRenaming ? (
                                                    <input
                                                        type="text"
                                                        value={renameValue}
                                                        onChange={(e) => onRenameChange?.(e.target.value)}
                                                        onBlur={() => onRenameSubmit?.()}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') onRenameSubmit?.();
                                                            if (e.key === 'Escape') onRenameCancel?.();
                                                        }}
                                                        autoFocus
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{
                                                            background: 'var(--vscode-input-background)',
                                                            color: 'var(--vscode-input-foreground)',
                                                            border: '1px solid var(--vscode-input-border)',
                                                            width: '100%'
                                                        }}
                                                    />
                                                ) : (
                                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.name}</span>
                                                )}

                                                {!isExplorer && onDeleteRequest && !isRenaming && (
                                                    <div style={{ marginLeft: 5 }}>
                                                        <HeaderButton
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirmDeleteId === req.id) {
                                                                    onDeleteRequest(req);
                                                                    setConfirmDeleteId(null);
                                                                } else {
                                                                    setConfirmDeleteId(req.id);
                                                                    setTimeout(() => setConfirmDeleteId(null), 3000);
                                                                }
                                                            }}
                                                            title={confirmDeleteId === req.id ? "Click again to Confirm Delete" : "Delete Request"}
                                                            style={{ color: confirmDeleteId === req.id ? 'var(--vscode-errorForeground)' : undefined }}
                                                            $shake={confirmDeleteId === req.id}
                                                        >
                                                            <Trash2 size={12} />
                                                        </HeaderButton>
                                                    </div>
                                                )}
                                            </div>
                                        </RequestItem>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
                );
            })}
        </>
    );
};
