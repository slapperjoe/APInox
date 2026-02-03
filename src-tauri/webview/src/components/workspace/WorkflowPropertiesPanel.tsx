import React, { useState } from 'react';
import styled from 'styled-components';
import { Workflow } from '@shared/models';
import { SPACING_SM, SPACING_MD, SPACING_XS } from '../../styles/spacing';
import { Settings } from 'lucide-react';

const Container = styled.div`
    padding: ${SPACING_MD};
    overflow-y: auto;
    height: 100%;
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    padding-bottom: ${SPACING_MD};
    border-bottom: 1px solid var(--apinox-panel-border);
    margin-bottom: ${SPACING_MD};
`;

const IconContainer = styled.div`
    color: var(--apinox-charts-blue);
    display: flex;
    align-items: center;
`;

const Title = styled.h2`
    margin: 0;
    font-size: 16px;
    font-weight: 600;
`;

const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_SM};
    margin-bottom: ${SPACING_MD};
`;

const Label = styled.label`
    font-size: 12px;
    font-weight: 600;
    opacity: 0.8;
    display: block;
`;

const Input = styled.input`
    background: var(--apinox-input-background);
    color: var(--apinox-input-foreground);
    border: 1px solid var(--apinox-input-border);
    padding: 8px 10px;
    border-radius: 4px;
    font-size: 13px;
    font-family: var(--apinox-font-family);
    width: 100%;
    
    &:focus {
        outline: 1px solid var(--apinox-focusBorder);
    }
`;

const TextArea = styled.textarea`
    background: var(--apinox-input-background);
    color: var(--apinox-input-foreground);
    border: 1px solid var(--apinox-input-border);
    padding: 8px 10px;
    border-radius: 4px;
    font-size: 13px;
    font-family: var(--apinox-font-family);
    width: 100%;
    min-height: 100px;
    resize: vertical;
    
    &:focus {
        outline: 1px solid var(--apinox-focusBorder);
    }
`;

const InfoBox = styled.div`
    padding: ${SPACING_SM};
    background: var(--apinox-textCodeBlock-background);
    border: 1px solid var(--apinox-panel-border);
    border-radius: 4px;
    font-size: 12px;
    opacity: 0.8;
`;

const StatsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: ${SPACING_SM};
    margin-top: ${SPACING_MD};
`;

const StatBox = styled.div`
    padding: ${SPACING_SM};
    background: var(--apinox-sideBar-background);
    border: 1px solid var(--apinox-panel-border);
    border-radius: 4px;
`;

const StatLabel = styled.div`
    font-size: 11px;
    opacity: 0.6;
    text-transform: uppercase;
`;

const StatValue = styled.div`
    font-size: 20px;
    font-weight: 600;
    margin-top: ${SPACING_XS};
`;

interface WorkflowPropertiesPanelProps {
    workflow: Workflow;
    onUpdate: (updates: Partial<Workflow>) => void;
}

export const WorkflowPropertiesPanel: React.FC<WorkflowPropertiesPanelProps> = ({
    workflow,
    onUpdate
}) => {
    const [name, setName] = useState(workflow.name);
    const [description, setDescription] = useState(workflow.description || '');

    const handleNameBlur = () => {
        if (name !== workflow.name) {
            onUpdate({ name });
        }
    };

    const handleDescriptionBlur = () => {
        if (description !== workflow.description) {
            onUpdate({ description });
        }
    };

    // Calculate stats
    const stepCount = workflow.steps.length;
    const requestCount = workflow.steps.filter(s => s.type === 'request').length;
    const loopCount = workflow.steps.filter(s => s.type === 'loop').length;
    const conditionCount = workflow.steps.filter(s => s.type === 'condition').length;

    return (
        <Container>
            <Header>
                <IconContainer>
                    <Settings size={20} />
                </IconContainer>
                <Title>Workflow Properties</Title>
            </Header>

            <Section>
                <Label htmlFor="workflow-name">Name</Label>
                <Input
                    id="workflow-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleNameBlur}
                    placeholder="Enter workflow name"
                />
            </Section>

            <Section>
                <Label htmlFor="workflow-description">Description</Label>
                <TextArea
                    id="workflow-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={handleDescriptionBlur}
                    placeholder="Enter workflow description (optional)"
                />
            </Section>

            <Section>
                <Label>Statistics</Label>
                <StatsGrid>
                    <StatBox>
                        <StatLabel>Total Steps</StatLabel>
                        <StatValue>{stepCount}</StatValue>
                    </StatBox>
                    <StatBox>
                        <StatLabel>Requests</StatLabel>
                        <StatValue>{requestCount}</StatValue>
                    </StatBox>
                    <StatBox>
                        <StatLabel>Loops</StatLabel>
                        <StatValue>{loopCount}</StatValue>
                    </StatBox>
                    <StatBox>
                        <StatLabel>Conditions</StatLabel>
                        <StatValue>{conditionCount}</StatValue>
                    </StatBox>
                </StatsGrid>
            </Section>

            <Section>
                <Label>Variables (Coming Soon)</Label>
                <InfoBox>
                    Workflow variables will allow you to define reusable values across all steps.
                    This feature is planned for a future update.
                </InfoBox>
            </Section>
        </Container>
    );
};
