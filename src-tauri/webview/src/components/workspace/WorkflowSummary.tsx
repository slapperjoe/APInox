import React from 'react';
import { Workflow, WorkflowStep } from '@shared/models';
import { Play, Edit2, Clock, GitBranch, AlertCircle, Code, Repeat } from 'lucide-react';
import styled from 'styled-components';
import { SPACING_SM, SPACING_MD, SPACING_LG } from '../../styles/spacing';
import { PrimaryButton, SecondaryButton } from '../common/Button';

const Container = styled.div`
    padding: ${SPACING_LG};
    overflow-y: auto;
    height: 100%;
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: ${SPACING_LG};
    padding-bottom: ${SPACING_MD};
    border-bottom: 1px solid var(--apinox-panel-border);
`;

const Title = styled.h2`
    margin: 0 0 ${SPACING_SM} 0;
    color: var(--apinox-foreground);
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
`;

const Description = styled.p`
    margin: 0;
    color: var(--apinox-descriptionForeground);
    font-size: 13px;
`;

const Actions = styled.div`
    display: flex;
    gap: ${SPACING_SM};
`;

const StatsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: ${SPACING_MD};
    margin-bottom: ${SPACING_LG};
`;

const StatCard = styled.div`
    padding: ${SPACING_MD};
    background: var(--apinox-editor-background);
    border: 1px solid var(--apinox-panel-border);
    border-radius: 4px;
`;

const StatLabel = styled.div`
    font-size: 11px;
    color: var(--apinox-descriptionForeground);
    text-transform: uppercase;
    margin-bottom: 4px;
`;

const StatValue = styled.div`
    font-size: 24px;
    font-weight: 600;
    color: var(--apinox-foreground);
`;

const StepsHeading = styled.h3`
    margin: ${SPACING_LG} 0 ${SPACING_MD} 0;
    color: var(--apinox-foreground);
    font-size: 14px;
    font-weight: 600;
`;

const StepsList = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_SM};
`;

const StepItem = styled.div`
    padding: ${SPACING_MD};
    background: var(--apinox-editor-background);
    border: 1px solid var(--apinox-panel-border);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: ${SPACING_MD};

    &:hover {
        background: var(--apinox-list-hoverBackground);
        border-color: var(--apinox-focusBorder);
    }
`;

const StepNumber = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--apinox-badge-background);
    color: var(--apinox-badge-foreground);
    font-weight: 600;
    font-size: 12px;
    flex-shrink: 0;
`;

const StepIcon = styled.div`
    display: flex;
    align-items: center;
    color: var(--apinox-symbolIcon-variableForeground);
    flex-shrink: 0;
`;

const StepInfo = styled.div`
    flex: 1;
    min-width: 0;
`;

const StepName = styled.div`
    font-size: 13px;
    font-weight: 500;
    color: var(--apinox-foreground);
    margin-bottom: 4px;
`;

const StepDetails = styled.div`
    font-size: 11px;
    color: var(--apinox-descriptionForeground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const EmptyState = styled.div`
    padding: ${SPACING_LG};
    text-align: center;
    color: var(--apinox-descriptionForeground);
`;

interface WorkflowSummaryProps {
    workflow: Workflow;
    onSelectStep?: (step: WorkflowStep) => void;
    onRun?: () => void;
    onEdit?: () => void;
}

const getStepIcon = (type: string) => {
    switch (type) {
        case 'request': return <GitBranch size={16} />;
        case 'delay': return <Clock size={16} />;
        case 'condition': return <AlertCircle size={16} />;
        case 'loop': return <Repeat size={16} />;
        case 'script': return <Code size={16} />;
        default: return <GitBranch size={16} />;
    }
};

const getStepDetails = (step: WorkflowStep): string => {
    switch (step.type) {
        case 'request':
            if (step.projectName && step.interfaceName && step.operationName) {
                return `${step.projectName} → ${step.interfaceName} → ${step.operationName}`;
            }
            return step.endpoint || 'No endpoint configured';
        case 'delay':
            return `Wait ${step.delayMs || 0}ms`;
        case 'condition':
            return step.condition ? 'Conditional branch' : 'No condition set';
        case 'loop':
            return step.loop ? `Loop ${step.loop.type}` : 'No loop configured';
        case 'script':
            return 'JavaScript execution';
        default:
            return '';
    }
};

export const WorkflowSummary: React.FC<WorkflowSummaryProps> = ({
    workflow,
    onSelectStep,
    onRun,
    onEdit
}) => {
    const steps = workflow.steps || [];
    
    // Calculate statistics
    const requestSteps = steps.filter(s => s.type === 'request').length;
    const delaySteps = steps.filter(s => s.type === 'delay').length;
    const conditionSteps = steps.filter(s => s.type === 'condition').length;
    const loopSteps = steps.filter(s => s.type === 'loop').length;
    const scriptSteps = steps.filter(s => s.type === 'script').length;

    return (
        <Container>
            <Header>
                <div>
                    <Title>
                        <GitBranch size={20} />
                        {workflow.name}
                    </Title>
                    {workflow.description && (
                        <Description>{workflow.description}</Description>
                    )}
                </div>
                <Actions>
                    {onEdit && (
                        <SecondaryButton onClick={onEdit}>
                            <Edit2 size={14} />
                            Edit
                        </SecondaryButton>
                    )}
                    {onRun && (
                        <PrimaryButton onClick={onRun}>
                            <Play size={14} />
                            Run
                        </PrimaryButton>
                    )}
                </Actions>
            </Header>

            <StatsGrid>
                <StatCard>
                    <StatLabel>Total Steps</StatLabel>
                    <StatValue>{steps.length}</StatValue>
                </StatCard>
                <StatCard>
                    <StatLabel>Requests</StatLabel>
                    <StatValue>{requestSteps}</StatValue>
                </StatCard>
                <StatCard>
                    <StatLabel>Delays</StatLabel>
                    <StatValue>{delaySteps}</StatValue>
                </StatCard>
                <StatCard>
                    <StatLabel>Other</StatLabel>
                    <StatValue>{conditionSteps + loopSteps + scriptSteps}</StatValue>
                </StatCard>
            </StatsGrid>

            <StepsHeading>Workflow Steps</StepsHeading>
            {steps.length === 0 ? (
                <EmptyState>
                    No steps in this workflow yet. Click Edit to add steps.
                </EmptyState>
            ) : (
                <StepsList>
                    {steps.map((step, index) => (
                        <StepItem
                            key={step.id}
                            onClick={() => onSelectStep?.(step)}
                        >
                            <StepNumber>{index + 1}</StepNumber>
                            <StepIcon>{getStepIcon(step.type)}</StepIcon>
                            <StepInfo>
                                <StepName>{step.name}</StepName>
                                <StepDetails>{getStepDetails(step)}</StepDetails>
                            </StepInfo>
                        </StepItem>
                    ))}
                </StepsList>
            )}
        </Container>
    );
};
