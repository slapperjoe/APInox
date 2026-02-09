import React, { useState } from 'react';
import styled from 'styled-components';
import { Play, Plus, Trash2, GitBranch, Edit2, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { Workflow, WorkflowStep } from '@shared/models';
import { SidebarContainer, SidebarContent, SidebarHeader, SidebarHeaderActions, SidebarHeaderTitle } from './shared/SidebarStyles';
import { EmptyState } from '../common/EmptyState';
import { HeaderButton, IconButton } from '../common/Button';
import { SPACING_SM, SPACING_XS } from '../../styles/spacing';

const WorkflowsContainer = styled(SidebarContainer)``;

const WorkflowsContent = styled(SidebarContent)``;

const WorkflowItem = styled.div<{ $active?: boolean }>`
    display: flex;
    align-items: center;
    padding: ${SPACING_SM} 12px;
    cursor: pointer;
    background-color: ${props => props.$active ? 'var(--apinox-list-activeSelectionBackground)' : 'transparent'};
    color: ${props => props.$active ? 'var(--apinox-list-activeSelectionForeground)' : 'var(--apinox-foreground)'};
    gap: ${SPACING_XS};
    border-bottom: 1px solid var(--apinox-panel-border);

    &:hover {
        background-color: ${props => props.$active ? 'var(--apinox-list-activeSelectionBackground)' : 'var(--apinox-list-hoverBackground)'};
    }
`;

const WorkflowIcon = styled.div`
    display: flex;
    align-items: center;
    color: var(--apinox-symbolIcon-variableForeground)`;

const WorkflowName = styled.div`
    flex: 1;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const WorkflowStepCount = styled.div`
    font-size: 0.8em;
    opacity: 0.6;
    margin-right: ${SPACING_XS};
`;

const WorkflowActions = styled.div`
    display: flex;
    gap: 4px;
    opacity: 0;

    ${WorkflowItem}:hover & {
        opacity: 1;
    }
`;

const StepItem = styled.div`
    display: flex;
    align-items: center;
    padding: ${SPACING_SM} 12px ${SPACING_SM} 40px;
    font-size: 12px;
    opacity: 0.8;
    border-bottom: 1px solid var(--apinox-panel-border);
    gap: ${SPACING_XS};
`;

const StepNumber = styled.div`
    font-weight: bold;
    opacity: 0.6;
    min-width: 20px;
`;

const StepName = styled.div`
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

interface WorkflowsUiProps {
    workflows: Workflow[];
    onAdd?: () => void;
    onEdit?: (workflow: Workflow) => void;
    onRun?: (workflow: Workflow) => void;
    onDelete?: (workflow: Workflow) => void;
    onDuplicate?: (workflow: Workflow) => void;
    onSelect?: (workflow: Workflow) => void;
    onSelectStep?: (workflow: Workflow, step: WorkflowStep) => void;
}

export const WorkflowsUi: React.FC<WorkflowsUiProps> = ({
    workflows,
    onAdd,
    onEdit,
    onRun,
    onDelete,
    onDuplicate,
    onSelect,
    onSelectStep
}) => {
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());

    console.log('[WorkflowsUi] Rendering with workflows:', workflows?.length || 0);
    console.log('[WorkflowsUi] Workflows:', workflows);

    const toggleWorkflow = (workflowId: string) => {
        const newExpanded = new Set(expandedWorkflows);
        if (newExpanded.has(workflowId)) {
            newExpanded.delete(workflowId);
        } else {
            newExpanded.add(workflowId);
        }
        setExpandedWorkflows(newExpanded);
    };

    return (
        <WorkflowsContainer>
            <SidebarHeader>
                <SidebarHeaderTitle>Workflows ({workflows.length})</SidebarHeaderTitle>
                <SidebarHeaderActions>
                    <HeaderButton onClick={() => onAdd?.()} title="Create Workflow">
                        <Plus size={14} />
                    </HeaderButton>
                </SidebarHeaderActions>
            </SidebarHeader>

            <WorkflowsContent>
                {workflows.length === 0 ? (
                    <EmptyState
                        icon={GitBranch}
                        title="No workflows yet"
                        description="Create a workflow to chain multiple requests together"
                        action={{
                            label: "Create Workflow",
                            onClick: () => onAdd?.()
                        }}
                    />
                ) : (
                    workflows.map(workflow => {
                        const isExpanded = expandedWorkflows.has(workflow.id);
                        
                        return (
                            <div key={workflow.id}>
                                <WorkflowItem onClick={() => {
                                    // Toggle expansion
                                    toggleWorkflow(workflow.id);
                                    // Also select the workflow to show summary
                                    if (onSelect) {
                                        onSelect(workflow);
                                    }
                                }}>
                                    <WorkflowIcon>
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </WorkflowIcon>
                                    <WorkflowIcon>
                                        <GitBranch size={16} />
                                    </WorkflowIcon>
                                    <WorkflowName title={workflow.name}>
                                        {workflow.name}
                                    </WorkflowName>
                                    <WorkflowStepCount>
                                        {workflow.steps?.length || 0} steps
                                    </WorkflowStepCount>
                                    <WorkflowActions>
                                        <IconButton
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRun?.(workflow);
                                            }}
                                            title="Run Workflow"
                                        >
                                            <Play size={14} />
                                        </IconButton>
                                        <IconButton
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEdit?.(workflow);
                                            }}
                                            title="Edit Workflow"
                                        >
                                            <Edit2 size={14} />
                                        </IconButton>
                                        <IconButton
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDuplicate?.(workflow);
                                            }}
                                            title="Duplicate Workflow"
                                        >
                                            <Copy size={14} />
                                        </IconButton>
                                        <IconButton
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (deleteConfirm === workflow.id) {
                                                    onDelete?.(workflow);
                                                    setDeleteConfirm(null);
                                                } else {
                                                    setDeleteConfirm(workflow.id);
                                                    setTimeout(() => setDeleteConfirm(null), 3000);
                                                }
                                            }}
                                            title={deleteConfirm === workflow.id ? "Click again to confirm" : "Delete Workflow"}
                                            style={{
                                                color: deleteConfirm === workflow.id ? 'var(--apinox-errorForeground)' : undefined
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </IconButton>
                                    </WorkflowActions>
                                </WorkflowItem>
                                
                                {/* Show steps when expanded */}
                                {isExpanded && workflow.steps?.map((step, idx) => (
                                    <StepItem 
                                        key={step.id}
                                        onClick={() => {
                                            console.log('[WorkflowsUi] Step clicked:', workflow.name, '→', step.name);
                                            console.log('[WorkflowsUi] onSelectStep exists:', !!onSelectStep);
                                            onSelectStep?.(workflow, step);
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <StepNumber>#{idx + 1}</StepNumber>
                                        <StepName title={step.name}>{step.name}</StepName>
                                        <div style={{ fontSize: '10px', opacity: 0.6 }}>
                                            {step.type}
                                        </div>
                                    </StepItem>
                                ))}
                            </div>
                        );
                    })
                )}
            </WorkflowsContent>
        </WorkflowsContainer>
    );
};
