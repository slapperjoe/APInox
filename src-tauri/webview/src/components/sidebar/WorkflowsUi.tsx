import React, { useState } from 'react';
import styled from 'styled-components';
import { Play, Plus, Trash2, GitBranch, Edit2, Copy, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import { Workflow, WorkflowStep } from '@shared/models';
import { SidebarContainer, SidebarContent, SidebarHeader, SidebarHeaderActions, SidebarHeaderTitle, RowActions } from './shared/SidebarStyles';
import { EmptyState } from '../common/EmptyState';
import { HeaderButton, IconButton } from '../common/Button';
import { Tooltip } from '../common/Tooltip';
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
    font-size: var(--apinox-fs-base);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const WorkflowStepCount = styled.div`
    font-size: 0.8em;
    opacity: 0.6;
    margin-right: ${SPACING_XS};
`;

const StepItem = styled.div`
    display: flex;
    align-items: center;
    padding: ${SPACING_SM} 12px ${SPACING_SM} 40px;
    font-size: var(--apinox-fs-md);
    opacity: 0.8;
    border-bottom: 1px solid var(--apinox-panel-border);
    gap: ${SPACING_XS};
`;

const StepNumber = styled.div`
    font-weight: var(--fw-bold);
    opacity: 0.6;
    min-width: 20px;
`;

const StepName = styled.div`
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const StepType = styled.div`
    font-size: 10px;
    opacity: 0.6;
    flex-shrink: 0;
`;

const StepActions = styled.div`
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    flex-shrink: 0;

    ${StepItem}:hover & {
        opacity: 1;
    }
`;

const StepActionBtn = styled.button`
    background: transparent;
    border: none;
    color: var(--apinox-icon-foreground);
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 2px;
    border-radius: 3px;

    &:hover {
        background: var(--apinox-list-hoverBackground);
    }

    &.danger:hover {
        color: var(--apinox-errorForeground);
    }
`;

const AddStepRow = styled.div`
    padding: ${SPACING_SM} 12px ${SPACING_SM} 40px;
`;

const AddStepButton = styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 1px dashed var(--apinox-panel-border);
    color: var(--apinox-textLink-foreground);
    border-radius: 4px;
    padding: ${SPACING_XS} ${SPACING_SM};
    font-size: var(--apinox-fs-sm);
    cursor: pointer;
    width: 100%;
    justify-content: center;

    &:hover {
        background: var(--apinox-list-hoverBackground);
    }
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
    onAddStep?: (workflow: Workflow) => void;
    onDeleteStep?: (workflow: Workflow, stepId: string) => void;
    onMoveStep?: (workflow: Workflow, stepId: string, direction: -1 | 1) => void;
}

export const WorkflowsUi: React.FC<WorkflowsUiProps> = ({
    workflows,
    onAdd,
    onEdit,
    onRun,
    onDelete,
    onDuplicate,
    onSelect,
    onSelectStep,
    onAddStep,
    onDeleteStep,
    onMoveStep,
}) => {
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());

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
                    <Tooltip content="Create Workflow">
                      <HeaderButton onClick={() => onAdd?.()}>
                        <Plus size={16} />
                      </HeaderButton>
                    </Tooltip>
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
                                    <RowActions $parent={WorkflowItem}>
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
                                    </RowActions>
                                </WorkflowItem>

                                {/* Show steps when expanded */}
                                {isExpanded && workflow.steps?.map((step, idx) => (
                                    <StepItem
                                        key={step.id}
                                        onClick={() => {
                                            onSelectStep?.(workflow, step);
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <StepNumber>#{idx + 1}</StepNumber>
                                        <StepName title={step.name}>{step.name}</StepName>
                                        <StepType>{step.type}</StepType>
                                        <StepActions>
                                            <StepActionBtn
                                                title="Move up"
                                                aria-label={`Move step ${step.name} up`}
                                                disabled={idx === 0}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onMoveStep?.(workflow, step.id, -1);
                                                }}
                                            >
                                                <ArrowUp size={12} />
                                            </StepActionBtn>
                                            <StepActionBtn
                                                title="Move down"
                                                aria-label={`Move step ${step.name} down`}
                                                disabled={idx === (workflow.steps?.length || 0) - 1}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onMoveStep?.(workflow, step.id, 1);
                                                }}
                                            >
                                                <ArrowDown size={12} />
                                            </StepActionBtn>
                                            <StepActionBtn
                                                className="danger"
                                                title="Delete step"
                                                aria-label={`Delete step ${step.name}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteStep?.(workflow, step.id);
                                                }}
                                            >
                                                <Trash2 size={12} />
                                            </StepActionBtn>
                                        </StepActions>
                                    </StepItem>
                                ))}
                                {isExpanded && onAddStep && (
                                    <AddStepRow>
                                        <AddStepButton onClick={() => onAddStep(workflow)}>
                                            <Plus size={12} /> Add Step
                                        </AddStepButton>
                                    </AddStepRow>
                                )}
                            </div>
                        );
                    })
                )}
            </WorkflowsContent>
        </WorkflowsContainer>
    );
};
