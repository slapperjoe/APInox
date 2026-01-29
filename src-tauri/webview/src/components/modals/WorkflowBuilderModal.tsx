import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { Plus, Trash2, GripVertical, Play, Save, X, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react';
import { Modal } from './Modal';
import { Workflow, WorkflowStep, ApinoxProject, HttpMethod } from '@shared/models';
import { PrimaryButton, SecondaryButton, IconButton } from '../common/Button';
import { SPACING_SM, SPACING_MD, SPACING_XS } from '../../styles/spacing';
import { v4 as uuidv4 } from 'uuid';
import { PickRequestModal, PickRequestItem } from './PickRequestModal';
import Editor from '@monaco-editor/react';

const WorkflowBuilderContent = styled.div`
    display: flex;
    gap: ${SPACING_MD};
    height: 600px;
`;

const LeftPanel = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: ${SPACING_MD};
    min-width: 300px;
`;

const RightPanel = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: ${SPACING_MD};
    border-left: 1px solid var(--vscode-panel-border);
    padding-left: ${SPACING_MD};
    min-width: 300px;
`;

const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_SM};
`;

const SectionTitle = styled.div`
    font-weight: bold;
    font-size: 12px;
    opacity: 0.8;
    text-transform: uppercase;
`;

const Input = styled.input`
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: ${SPACING_SM};
    font-size: 13px;
    width: 100%;

    &:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
    }
`;

const StepsList = styled.div`
    flex: 1;
    overflow-y: auto;
    border: 1px solid var(--vscode-panel-border);
    background: var(--vscode-editor-background);
`;

const StepItem = styled.div<{ $isDragging?: boolean; $isNested?: boolean }>`
    display: flex;
    align-items: center;
    padding: ${SPACING_SM};
    gap: ${SPACING_SM};
    border-bottom: 1px solid var(--vscode-panel-border);
    background: ${props => props.$isDragging ? 'var(--vscode-list-hoverBackground)' : 'transparent'};
    cursor: pointer;
    margin-left: ${props => props.$isNested ? '24px' : '0'};
    border-left: ${props => props.$isNested ? '2px solid var(--vscode-charts-blue)' : 'none'};

    &:hover {
        background: var(--vscode-list-hoverBackground);
    }
`;

const DragHandle = styled.div`
    cursor: grab;
    color: var(--vscode-icon-foreground);
    opacity: 0.5;

    &:hover {
        opacity: 1;
    }
`;

const StepNumber = styled.div`
    font-weight: bold;
    font-size: 12px;
    opacity: 0.6;
    min-width: 24px;
`;

const StepDetails = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

const StepName = styled.div`
    font-size: 13px;
    font-weight: 500;
`;

const StepType = styled.div`
    font-size: 11px;
    opacity: 0.6;
    text-transform: uppercase;
`;

const StepActions = styled.div`
    display: flex;
    gap: 4px;
    opacity: 0;

    ${StepItem}:hover & {
        opacity: 1;
    }
`;

const AddStepButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${SPACING_SM};
    padding: ${SPACING_SM};
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: 1px dashed var(--vscode-panel-border);
    cursor: pointer;
    font-size: 13px;

    &:hover {
        background: var(--vscode-button-secondaryHoverBackground);
    }
`;

const AddNestedStepButton = styled.button`
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    margin-left: 48px;
    background: transparent;
    color: var(--vscode-textLink-foreground);
    border: 1px dashed var(--vscode-textLink-foreground);
    cursor: pointer;
    font-size: 11px;
    opacity: 0.7;
    margin-top: -1px;
    margin-bottom: ${SPACING_XS};

    &:hover {
        opacity: 1;
        background: var(--vscode-list-hoverBackground);
    }
`;

const AddNestedStepDropdown = styled.div`
    position: relative;
    margin-left: 48px;
    margin-top: -1px;
    margin-bottom: ${SPACING_XS};
`;

const DropdownButton = styled.button`
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: transparent;
    color: var(--vscode-textLink-foreground);
    border: 1px dashed var(--vscode-textLink-foreground);
    cursor: pointer;
    font-size: 11px;
    opacity: 0.7;
    width: 100%;
    justify-content: center;

    &:hover {
        opacity: 1;
        background: var(--vscode-list-hoverBackground);
    }
`;

const DropdownMenu = styled.div`
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--vscode-dropdown-background);
    border: 1px solid var(--vscode-dropdown-border);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    margin-top: 2px;
`;

const DropdownItem = styled.div`
    padding: 6px 8px;
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--vscode-dropdown-foreground);

    &:hover {
        background: var(--vscode-list-hoverBackground);
    }
`;

const ExpandCollapseIcon = styled.div`
    cursor: pointer;
    display: flex;
    align-items: center;
    color: var(--vscode-icon-foreground);
    opacity: 0.6;
    
    &:hover {
        opacity: 1;
    }
`;

const StepTypeSelector = styled.select`
    background: var(--vscode-dropdown-background);
    color: var(--vscode-dropdown-foreground);
    border: 1px solid var(--vscode-dropdown-border);
    padding: ${SPACING_SM};
    font-size: 13px;
    cursor: pointer;

    &:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
    }
`;

const EmptySteps = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: ${SPACING_MD};
    gap: ${SPACING_SM};
    opacity: 0.6;
    height: 100%;
`;

const InfoBox = styled.div`
    display: flex;
    gap: ${SPACING_SM};
    padding: ${SPACING_SM};
    background: var(--vscode-textCodeBlock-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    font-size: 12px;
`;

interface WorkflowBuilderModalProps {
    isOpen: boolean;
    onClose: () => void;
    workflow?: Workflow;
    onSave: (workflow: Workflow) => void;
    projects: ApinoxProject[]; // All projects for request picking
}

export const WorkflowBuilderModal: React.FC<WorkflowBuilderModalProps> = ({
    isOpen,
    onClose,
    workflow,
    onSave,
    projects
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [steps, setSteps] = useState<WorkflowStep[]>([]);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
    const [selectedNestedStep, setSelectedNestedStep] = useState<{ parentIndex: number; nestedIndex: number } | null>(null);
    const [showRequestPicker, setShowRequestPicker] = useState(false);
    const [requestPickerForNested, setRequestPickerForNested] = useState<{ parentIndex: number; nestedIndex: number } | null>(null);
    const [collapsedLoops, setCollapsedLoops] = useState<Set<string>>(new Set());
    const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
    const [mainAddStepDropdownOpen, setMainAddStepDropdownOpen] = useState(false);

    // Build request picker items from all projects
    const pickRequestItems = useMemo<PickRequestItem[]>(() => {
        const items: PickRequestItem[] = [];
        
        projects.forEach(project => {
            if (!project.interfaces) return;
            
            project.interfaces.forEach(iface => {
                iface.operations?.forEach(op => {
                    if (op.requests && op.requests.length > 0) {
                        op.requests.forEach((req, idx) => {
                            items.push({
                                id: `${project.name}-${iface.name}-${op.name}-${idx}`,
                                label: op.requests.length > 1 ? `${op.name} [${idx + 1}/${op.requests.length}]` : op.name,
                                description: `${project.name} > ${iface.name}${op.requests.length > 1 ? ` > Request ${idx + 1}` : ''}`,
                                detail: req.endpoint || op.originalEndpoint || 'WSDL Operation',
                                type: 'request',
                                data: {
                                    projectName: project.name,
                                    interfaceName: iface.name,
                                    operationName: op.name,
                                    requestIndex: idx,
                                    request: req
                                }
                            });
                        });
                    } else {
                        // Operation with no saved requests - use default
                        items.push({
                            id: `${project.name}-${iface.name}-${op.name}-default`,
                            label: op.name,
                            description: `${project.name} > ${iface.name}`,
                            detail: op.originalEndpoint || 'WSDL Operation',
                            type: 'request',
                            data: {
                                projectName: project.name,
                                interfaceName: iface.name,
                                operationName: op.name,
                                requestIndex: 0
                            }
                        });
                    }
                });
            });
        });
        
        return items;
    }, [projects]);

    useEffect(() => {
        if (isOpen && workflow) {
            setName(workflow.name);
            setDescription(workflow.description || '');
            setSteps(workflow.steps || []);
            setSelectedStepIndex(null);
        } else if (isOpen) {
            // New workflow
            setName('');
            setDescription('');
            setSteps([]);
            setSelectedStepIndex(null);
        }
    }, [isOpen, workflow]);

    const handleSave = () => {
        console.log('[WorkflowBuilder] Saving workflow, steps:', steps.length);
        
        const workflowToSave: Workflow = {
            id: workflow?.id || uuidv4(),
            name,
            description,
            steps: steps.map((step, idx) => ({ ...step, order: idx })),
            variables: workflow?.variables || {},
            createdAt: workflow?.createdAt || Date.now(),
            modifiedAt: Date.now()
        };
        
        console.log('[WorkflowBuilder] Workflow to save:', workflowToSave);

        onSave(workflowToSave);
        onClose();
    };

    const addStep = (type: WorkflowStep['type']) => {
        const newStep: WorkflowStep = {
            id: uuidv4(),
            name: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Step`,
            type,
            order: steps.length,
            extractors: []
        };

        if (type === 'delay') {
            newStep.delayMs = 1000;
        } else if (type === 'condition') {
            newStep.condition = {
                id: uuidv4(),
                expression: '',
                operator: 'equals',
                expectedValue: ''
            };
        } else if (type === 'loop') {
            newStep.loop = {
                type: 'count',
                count: 1,
                maxIterations: 100,
                iteratorVariable: 'i'
            };
            newStep.loopSteps = [];
        } else if (type === 'script') {
            newStep.script = '// Your JavaScript code here\n// Available: variables, console.log\n';
        }

        setSteps([...steps, newStep]);
    };

    const addNestedStep = (parentIndex: number, type: WorkflowStep['type']) => {
        const parentStep = steps[parentIndex];
        if (parentStep.type !== 'loop') return;

        const newStep: WorkflowStep = {
            id: uuidv4(),
            name: `Nested ${type.charAt(0).toUpperCase() + type.slice(1)} Step`,
            type,
            order: (parentStep.loopSteps?.length || 0),
            extractors: []
        };

        if (type === 'delay') {
            newStep.delayMs = 1000;
        } else if (type === 'condition') {
            newStep.condition = {
                id: uuidv4(),
                expression: '',
                operator: 'equals',
                expectedValue: ''
            };
        } else if (type === 'loop') {
            newStep.loop = {
                type: 'count',
                count: 1,
                maxIterations: 100,
                iteratorVariable: 'i'
            };
            newStep.loopSteps = [];
        } else if (type === 'script') {
            newStep.script = '// Your JavaScript code here\n// Available: variables, console.log\n';
        }

        const updatedSteps = [...steps];
        updatedSteps[parentIndex] = {
            ...parentStep,
            loopSteps: [...(parentStep.loopSteps || []), newStep]
        };
        setSteps(updatedSteps);
        setOpenDropdownIndex(null); // Close dropdown after adding
    };

    const updateNestedStep = (parentIndex: number, nestedIndex: number, updates: Partial<WorkflowStep>) => {
        const parentStep = steps[parentIndex];
        if (parentStep.type !== 'loop' || !parentStep.loopSteps) return;

        const updatedSteps = [...steps];
        updatedSteps[parentIndex] = {
            ...parentStep,
            loopSteps: parentStep.loopSteps.map((step, i) => 
                i === nestedIndex ? { ...step, ...updates } : step
            )
        };
        setSteps(updatedSteps);
    };

    const deleteNestedStep = (parentIndex: number, nestedIndex: number) => {
        const parentStep = steps[parentIndex];
        if (parentStep.type !== 'loop') return;

        const updatedSteps = [...steps];
        updatedSteps[parentIndex] = {
            ...parentStep,
            loopSteps: (parentStep.loopSteps || []).filter((_, i) => i !== nestedIndex)
        };
        setSteps(updatedSteps);
    };

    const toggleLoopCollapse = (stepId: string) => {
        const newCollapsed = new Set(collapsedLoops);
        if (newCollapsed.has(stepId)) {
            newCollapsed.delete(stepId);
        } else {
            newCollapsed.add(stepId);
        }
        setCollapsedLoops(newCollapsed);
    };

    const deleteStep = (index: number) => {
        setSteps(steps.filter((_, i) => i !== index));
    };

    const updateStep = (index: number, updates: Partial<WorkflowStep>) => {
        setSteps(steps.map((step, i) => i === index ? { ...step, ...updates } : step));
    };

    const updateStepName = (index: number, newName: string) => {
        updateStep(index, { name: newName });
    };

    const updateStepDelay = (index: number, delayMs: number) => {
        updateStep(index, { delayMs });
    };

    const handleSelectRequest = (item: PickRequestItem) => {
        const { projectName, interfaceName, operationName, request } = item.data;
        
        const requestData = {
            projectName,
            interfaceName,
            operationName,
            requestBody: request?.request || '', // Use saved request body if available
            endpoint: request?.endpoint,
            headers: request?.headers,
            contentType: request?.contentType,
            requestType: request?.requestType,
            bodyType: request?.bodyType,
            httpMethod: request?.httpMethod || request?.method as HttpMethod,
            method: request?.method || request?.httpMethod
        };

        // Check if this is for a nested step
        if (requestPickerForNested !== null) {
            const { parentIndex, nestedIndex } = requestPickerForNested;
            const parentStep = steps[parentIndex];
            
            if (parentStep?.type === 'loop' && parentStep.loopSteps) {
                const updatedLoopSteps = [...parentStep.loopSteps];
                updatedLoopSteps[nestedIndex] = {
                    ...updatedLoopSteps[nestedIndex],
                    ...requestData
                };
                
                const updatedSteps = [...steps];
                updatedSteps[parentIndex] = {
                    ...parentStep,
                    loopSteps: updatedLoopSteps
                };
                setSteps(updatedSteps);
            }
            
            setRequestPickerForNested(null);
        } else if (selectedStepIndex !== null) {
            // Regular parent step
            updateStep(selectedStepIndex, requestData);
        }
        
        setShowRequestPicker(false);
    };

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newSteps = [...steps];
        const draggedItem = newSteps[draggedIndex];
        newSteps.splice(draggedIndex, 1);
        newSteps.splice(index, 0, draggedItem);

        setSteps(newSteps);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Workflow Builder"
            size="large"
            footer={
                <>
                    <SecondaryButton onClick={onClose}>
                        <X size={14} />
                        Cancel
                    </SecondaryButton>
                    <PrimaryButton onClick={handleSave} disabled={!name.trim() || steps.length === 0}>
                        <Save size={14} />
                        Save Workflow
                    </PrimaryButton>
                </>
            }
        >
            <WorkflowBuilderContent>
                <LeftPanel>
                    <Section>
                        <SectionTitle>Workflow Details</SectionTitle>
                        <Input
                            placeholder="Workflow Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <Input
                            placeholder="Description (optional)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </Section>

                    <Section>
                        <SectionTitle>Steps ({steps.length})</SectionTitle>
                        
                        <InfoBox>
                            <AlertCircle size={16} />
                            <div>
                                Steps execute sequentially. Click a step to configure it on the right.
                            </div>
                        </InfoBox>

                        <StepsList>
                            {steps.length === 0 ? (
                                <EmptySteps>
                                    <div>No steps added yet</div>
                                    <div style={{ fontSize: '11px' }}>Add a step below to get started</div>
                                </EmptySteps>
                            ) : (
                                steps.map((step, index) => {
                                    const isCollapsed = step.type === 'loop' && collapsedLoops.has(step.id);
                                    const hasChildren = step.type === 'loop' && (step.loopSteps?.length || 0) > 0;

                                    return (
                                        <React.Fragment key={step.id}>
                                            <StepItem
                                                $isDragging={draggedIndex === index}
                                                draggable
                                                onDragStart={() => handleDragStart(index)}
                                                onDragOver={(e) => handleDragOver(e, index)}
                                                onDragEnd={handleDragEnd}
                                                onClick={() => setSelectedStepIndex(index)}
                                                style={{
                                                    background: selectedStepIndex === index ? 'var(--vscode-list-activeSelectionBackground)' : undefined
                                                }}
                                            >
                                                {step.type === 'loop' && hasChildren && (
                                                    <ExpandCollapseIcon onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleLoopCollapse(step.id);
                                                    }}>
                                                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                                    </ExpandCollapseIcon>
                                                )}
                                                {step.type !== 'loop' || !hasChildren ? (
                                                    <div style={{ width: '16px' }} />
                                                ) : null}
                                                <DragHandle>
                                                    <GripVertical size={16} />
                                                </DragHandle>
                                                <StepNumber>#{index + 1}</StepNumber>
                                                <StepDetails>
                                                    <StepName>{step.name}</StepName>
                                                    <StepType>
                                                        {step.type}
                                                        {step.type === 'loop' && step.loopSteps && ` (${step.loopSteps.length} steps)`}
                                                    </StepType>
                                                </StepDetails>
                                                <StepActions>
                                                    <IconButton
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteStep(index);
                                                        }}
                                                        title="Delete Step"
                                                    >
                                                        <Trash2 size={14} />
                                                    </IconButton>
                                                </StepActions>
                                            </StepItem>
                                            
                                            {/* Render nested loop steps */}
                                            {step.type === 'loop' && !isCollapsed && (step.loopSteps || []).map((nestedStep, nestedIndex) => (
                                                <StepItem
                                                    key={nestedStep.id}
                                                    $isNested
                                                    onClick={() => {
                                                        setSelectedStepIndex(null);
                                                        setSelectedNestedStep({ parentIndex: index, nestedIndex });
                                                    }}
                                                    style={{
                                                        cursor: 'pointer',
                                                        background: selectedNestedStep?.parentIndex === index && selectedNestedStep?.nestedIndex === nestedIndex 
                                                            ? 'var(--vscode-list-activeSelectionBackground)' 
                                                            : undefined
                                                    }}
                                                >
                                                    <div style={{ width: '16px' }} />
                                                    <DragHandle style={{ opacity: 0.3, cursor: 'grab' }}>
                                                        <GripVertical size={14} />
                                                    </DragHandle>
                                                    <StepNumber style={{ fontSize: '11px' }}>#{index + 1}.{nestedIndex + 1}</StepNumber>
                                                    <StepDetails>
                                                        <StepName style={{ fontSize: '12px' }}>{nestedStep.name}</StepName>
                                                        <StepType>{nestedStep.type}</StepType>
                                                    </StepDetails>
                                                    <StepActions>
                                                        <IconButton
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteNestedStep(index, nestedIndex);
                                                                if (selectedNestedStep?.parentIndex === index && selectedNestedStep?.nestedIndex === nestedIndex) {
                                                                    setSelectedNestedStep(null);
                                                                }
                                                            }}
                                                            title="Delete Nested Step"
                                                        >
                                                            <Trash2 size={12} />
                                                        </IconButton>
                                                    </StepActions>
                                                </StepItem>
                                            ))}
                                            
                                            {/* Add nested step dropdown for loops */}
                                            {step.type === 'loop' && !isCollapsed && (
                                                <AddNestedStepDropdown>
                                                    <DropdownButton 
                                                        onClick={() => setOpenDropdownIndex(openDropdownIndex === index ? null : index)}
                                                    >
                                                        <Plus size={12} />
                                                        Add Step to Loop
                                                    </DropdownButton>
                                                    {openDropdownIndex === index && (
                                                        <DropdownMenu>
                                                            <DropdownItem onClick={() => addNestedStep(index, 'request')}>
                                                                <Plus size={12} />
                                                                Request
                                                            </DropdownItem>
                                                            <DropdownItem onClick={() => addNestedStep(index, 'delay')}>
                                                                <Plus size={12} />
                                                                Delay
                                                            </DropdownItem>
                                                            <DropdownItem onClick={() => addNestedStep(index, 'condition')}>
                                                                <Plus size={12} />
                                                                Condition
                                                            </DropdownItem>
                                                            <DropdownItem onClick={() => addNestedStep(index, 'loop')}>
                                                                <Plus size={12} />
                                                                Nested Loop
                                                            </DropdownItem>
                                                            <DropdownItem onClick={() => addNestedStep(index, 'script')}>
                                                                <Plus size={12} />
                                                                Script
                                                            </DropdownItem>
                                                        </DropdownMenu>
                                                    )}
                                                </AddNestedStepDropdown>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </StepsList>

                        <AddNestedStepDropdown style={{ marginLeft: 0 }}>
                            <DropdownButton 
                                onClick={() => setMainAddStepDropdownOpen(!mainAddStepDropdownOpen)}
                            >
                                <Plus size={14} />
                                Add Step
                            </DropdownButton>
                            {mainAddStepDropdownOpen && (
                                <DropdownMenu>
                                    <DropdownItem onClick={() => { addStep('request'); setMainAddStepDropdownOpen(false); }}>
                                        <Plus size={12} />
                                        Request
                                    </DropdownItem>
                                    <DropdownItem onClick={() => { addStep('delay'); setMainAddStepDropdownOpen(false); }}>
                                        <Plus size={12} />
                                        Delay
                                    </DropdownItem>
                                    <DropdownItem onClick={() => { addStep('condition'); setMainAddStepDropdownOpen(false); }}>
                                        <Plus size={12} />
                                        Condition
                                    </DropdownItem>
                                    <DropdownItem onClick={() => { addStep('loop'); setMainAddStepDropdownOpen(false); }}>
                                        <Plus size={12} />
                                        Loop
                                    </DropdownItem>
                                    <DropdownItem onClick={() => { addStep('script'); setMainAddStepDropdownOpen(false); }}>
                                        <Plus size={12} />
                                        Script
                                    </DropdownItem>
                                </DropdownMenu>
                            )}
                        </AddNestedStepDropdown>
                    </Section>
                </LeftPanel>

                <RightPanel>
                    <Section>
                        <SectionTitle>Step Configuration</SectionTitle>
                        {(() => {
                            // Determine which step to configure: parent or nested
                            let currentStep: WorkflowStep | null = null;
                            let isNested = false;
                            let parentIdx: number | null = null;
                            let nestedIdx: number | null = null;

                            if (selectedNestedStep !== null) {
                                const parent = steps[selectedNestedStep.parentIndex];
                                if (parent?.type === 'loop' && parent.loopSteps) {
                                    currentStep = parent.loopSteps[selectedNestedStep.nestedIndex];
                                    isNested = true;
                                    parentIdx = selectedNestedStep.parentIndex;
                                    nestedIdx = selectedNestedStep.nestedIndex;
                                }
                            } else if (selectedStepIndex !== null) {
                                currentStep = steps[selectedStepIndex];
                                parentIdx = selectedStepIndex;
                            }

                            if (!currentStep) {
                                return (
                                    <div style={{ padding: SPACING_MD, textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
                                        Select a step from the left to configure it
                                    </div>
                                );
                            }

                            const updateCurrentStep = (updates: Partial<WorkflowStep>) => {
                                if (isNested && parentIdx !== null && nestedIdx !== null) {
                                    updateNestedStep(parentIdx, nestedIdx, updates);
                                } else if (parentIdx !== null) {
                                    updateStep(parentIdx, updates);
                                }
                            };

                            return (
                                <>
                                    {isNested && (
                                        <InfoBox style={{ marginBottom: SPACING_SM }}>
                                            <AlertCircle size={14} />
                                            <div>Editing nested step in loop</div>
                                        </InfoBox>
                                    )}
                                    <Input
                                        placeholder="Step Name"
                                        value={currentStep.name}
                                        onChange={(e) => updateCurrentStep({ name: e.target.value })}
                                    />

                                    {currentStep.type === 'delay' && (
                                    <div>
                                        <label style={{ display: 'block', marginBottom: SPACING_SM, fontSize: '12px', opacity: 0.8 }}>
                                            Delay (milliseconds)
                                        </label>
                                        <Input
                                            type="number"
                                            placeholder="1000"
                                            value={currentStep.delayMs || ''}
                                            onChange={(e) => updateCurrentStep({ delayMs: parseInt(e.target.value) || 0 })}
                                        />
                                        <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px' }}>
                                            {currentStep.delayMs ? `${(currentStep.delayMs! / 1000).toFixed(1)} seconds` : ''}
                                        </div>
                                    </div>
                                )}

                                {currentStep.type === 'condition' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING_SM }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: SPACING_SM, fontSize: '12px', opacity: 0.8 }}>
                                                Expression / Variable
                                            </label>
                                            <Input
                                                placeholder="e.g., {{status}} or {{responseCode}}"
                                                value={currentStep.condition?.expression || ''}
                                                onChange={(e) => updateCurrentStep({
                                                    condition: { ...currentStep.condition!, expression: e.target.value }
                                                })}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: SPACING_SM, fontSize: '12px', opacity: 0.8 }}>
                                                Operator
                                            </label>
                                            <select
                                                value={currentStep.condition?.operator || 'equals'}
                                                onChange={(e) => updateCurrentStep({
                                                    condition: { ...currentStep.condition!, operator: e.target.value as any }
                                                })}
                                                style={{
                                                    width: '100%',
                                                    padding: '6px 8px',
                                                    background: 'var(--vscode-input-background)',
                                                    border: '1px solid var(--vscode-input-border)',
                                                    color: 'var(--vscode-input-foreground)',
                                                    borderRadius: '4px',
                                                    fontSize: '13px'
                                                }}
                                            >
                                                <option value="equals">Equals</option>
                                                <option value="notEquals">Not Equals</option>
                                                <option value="contains">Contains</option>
                                                <option value="notContains">Not Contains</option>
                                                <option value="greaterThan">Greater Than</option>
                                                <option value="lessThan">Less Than</option>
                                                <option value="exists">Exists</option>
                                                <option value="notExists">Not Exists</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: SPACING_SM, fontSize: '12px', opacity: 0.8 }}>
                                                Compare Value
                                            </label>
                                            <Input
                                                placeholder="Value to compare against"
                                                value={currentStep.condition?.expectedValue || ''}
                                                onChange={(e) => updateCurrentStep({
                                                    condition: { ...currentStep.condition!, expectedValue: e.target.value }
                                                })}
                                            />
                                        </div>
                                        <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px', padding: SPACING_SM, background: 'var(--vscode-textCodeBlock-background)', borderRadius: '4px' }}>
                                            Note: Branching to specific steps not yet implemented. Condition will skip remaining steps if false.
                                        </div>
                                    </div>
                                )}

                                {currentStep.type === 'loop' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING_SM }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: SPACING_SM, fontSize: '12px', opacity: 0.8 }}>
                                                Loop Type
                                            </label>
                                            <select
                                                value={currentStep.loop?.type || 'count'}
                                                onChange={(e) => updateCurrentStep({
                                                    loop: { ...currentStep.loop!, type: e.target.value as any }
                                                })}
                                                style={{
                                                    width: '100%',
                                                    padding: '6px 8px',
                                                    background: 'var(--vscode-input-background)',
                                                    border: '1px solid var(--vscode-input-border)',
                                                    color: 'var(--vscode-input-foreground)',
                                                    borderRadius: '4px',
                                                    fontSize: '13px'
                                                }}
                                            >
                                                <option value="count">Fixed Count</option>
                                                <option value="list">Iterate List</option>
                                                <option value="while">While Condition</option>
                                            </select>
                                        </div>
                                        {currentStep.loop?.type === 'count' && (
                                            <div>
                                                <label style={{ display: 'block', marginBottom: SPACING_SM, fontSize: '12px', opacity: 0.8 }}>
                                                    Count
                                                </label>
                                                <Input
                                                    type="number"
                                                    placeholder="Number of iterations"
                                                    value={currentStep.loop?.count || ''}
                                                    onChange={(e) => updateCurrentStep({
                                                        loop: { ...currentStep.loop!, count: parseInt(e.target.value) || 1 }
                                                    })}
                                                />
                                            </div>
                                        )}
                                        {currentStep.loop?.type === 'list' && (
                                            <div>
                                                <label style={{ display: 'block', marginBottom: SPACING_SM, fontSize: '12px', opacity: 0.8 }}>
                                                    List Variable
                                                </label>
                                                <Input
                                                    placeholder="e.g., {{items}}"
                                                    value={currentStep.loop?.listVariable || ''}
                                                    onChange={(e) => updateCurrentStep({
                                                        loop: { ...currentStep.loop!, listVariable: e.target.value }
                                                    })}
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <label style={{ display: 'block', marginBottom: SPACING_SM, fontSize: '12px', opacity: 0.8 }}>
                                                Iterator Variable Name
                                            </label>
                                            <Input
                                                placeholder="Variable name for current item"
                                                value={currentStep.loop?.iteratorVariable || 'i'}
                                                onChange={(e) => updateCurrentStep({
                                                    loop: { ...currentStep.loop!, iteratorVariable: e.target.value }
                                                })}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: SPACING_SM, fontSize: '12px', opacity: 0.8 }}>
                                                Max Iterations (safety limit)
                                            </label>
                                            <Input
                                                type="number"
                                                placeholder="100"
                                                value={currentStep.loop?.maxIterations || ''}
                                                onChange={(e) => updateCurrentStep({
                                                    loop: { ...currentStep.loop!, maxIterations: parseInt(e.target.value) || 100 }
                                                })}
                                            />
                                        </div>
                                        <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px', padding: SPACING_SM, background: 'var(--vscode-textCodeBlock-background)', borderRadius: '4px' }}>
                                            Note: Loop steps must be defined separately. This creates the loop structure.
                                        </div>
                                    </div>
                                )}

                                {currentStep.type === 'script' && (
                                    <div>
                                        <label style={{ display: 'block', marginBottom: SPACING_SM, fontSize: '12px', opacity: 0.8 }}>
                                            JavaScript Code
                                        </label>
                                        <div style={{ 
                                            border: '1px solid var(--vscode-panel-border)',
                                            borderRadius: '4px',
                                            overflow: 'hidden',
                                            height: '300px'
                                        }}>
                                            <Editor
                                                height="300px"
                                                language="javascript"
                                                theme="vs-dark"
                                                value={currentStep.script || ''}
                                                onChange={(value) => updateCurrentStep({ script: value || '' })}
                                                options={{
                                                    minimap: { enabled: false },
                                                    lineNumbers: 'on',
                                                    scrollBeyondLastLine: false,
                                                    wordWrap: 'on',
                                                    fontSize: 12
                                                }}
                                            />
                                        </div>
                                        <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '8px', padding: SPACING_SM, background: 'var(--vscode-textCodeBlock-background)', borderRadius: '4px' }}>
                                            Available: <code>variables</code> (read/write workflow variables), <code>console.log</code> (output to logs)
                                        </div>
                                    </div>
                                )}

                                {currentStep.type === 'request' && (
                                    <div>
                                        <label style={{ display: 'block', marginBottom: SPACING_SM, fontSize: '12px', opacity: 0.8 }}>
                                            Request
                                        </label>
                                        {currentStep.operationName ? (
                                            <div>
                                                <div style={{ 
                                                    padding: SPACING_SM, 
                                                    background: 'var(--vscode-textCodeBlock-background)',
                                                    border: '1px solid var(--vscode-panel-border)',
                                                    borderRadius: '4px',
                                                    marginBottom: SPACING_SM,
                                                    fontSize: '12px'
                                                }}>
                                                    <div><strong>Project:</strong> {currentStep.projectName}</div>
                                                    <div><strong>Interface:</strong> {currentStep.interfaceName}</div>
                                                    <div><strong>Operation:</strong> {currentStep.operationName}</div>
                                                    {currentStep.endpoint && (
                                                        <div style={{ marginTop: '4px', opacity: 0.7 }}>
                                                            <strong>Endpoint:</strong> {currentStep.endpoint}
                                                        </div>
                                                    )}
                                                </div>
                                                <SecondaryButton 
                                                    onClick={() => {
                                                        if (isNested && parentIdx !== null && nestedIdx !== null) {
                                                            setRequestPickerForNested({ parentIndex: parentIdx, nestedIndex: nestedIdx });
                                                        }
                                                        setShowRequestPicker(true);
                                                    }} 
                                                    style={{ width: '100%', marginBottom: SPACING_SM }}
                                                >
                                                    Change Request
                                                </SecondaryButton>
                                                
                                                {/* Request Body Editor */}
                                                <label style={{ display: 'block', marginTop: SPACING_MD, marginBottom: SPACING_SM, fontSize: '12px', opacity: 0.8 }}>
                                                    Request Body (use {`{{varName}}`} for variables)
                                                </label>
                                                <div style={{ 
                                                    border: '1px solid var(--vscode-panel-border)',
                                                    borderRadius: '4px',
                                                    overflow: 'hidden',
                                                    height: '300px'
                                                }}>
                                                    <Editor
                                                        height="300px"
                                                        language="xml"
                                                        theme="vs-dark"
                                                        value={currentStep.requestBody || ''}
                                                        onChange={(value) => updateCurrentStep({ requestBody: value || '' })}
                                                        options={{
                                                            minimap: { enabled: false },
                                                            lineNumbers: 'on',
                                                            scrollBeyondLastLine: false,
                                                            wordWrap: 'on',
                                                            fontSize: 12
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <InfoBox style={{ marginBottom: SPACING_SM }}>
                                                    <AlertCircle size={16} />
                                                    <div>No request selected. Pick a request from any project.</div>
                                                </InfoBox>
                                                <PrimaryButton 
                                                    onClick={() => {
                                                        if (isNested && parentIdx !== null && nestedIdx !== null) {
                                                            setRequestPickerForNested({ parentIndex: parentIdx, nestedIndex: nestedIdx });
                                                        }
                                                        setShowRequestPicker(true);
                                                    }} 
                                                    style={{ width: '100%' }}
                                                >
                                                    <Plus size={14} />
                                                    Pick Request
                                                </PrimaryButton>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        );
                    })()}
                    </Section>
                </RightPanel>
            </WorkflowBuilderContent>

            {/* Request Picker Modal */}
            <PickRequestModal
                isOpen={showRequestPicker}
                onClose={() => setShowRequestPicker(false)}
                onSelect={handleSelectRequest}
                items={pickRequestItems}
                title="Pick Request for Workflow Step"
            />
        </Modal>
    );
};

