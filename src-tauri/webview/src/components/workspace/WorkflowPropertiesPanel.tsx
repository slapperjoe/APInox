import React, { useState, useEffect } from 'react';
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
    font-weight: var(--fw-semibold);
`;

const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_SM};
    margin-bottom: ${SPACING_MD};
`;

const Label = styled.label`
    font-size: var(--apinox-fs-md);
    font-weight: var(--fw-semibold);
    opacity: 0.8;
    display: block;
`;

const Input = styled.input`
    background: var(--apinox-input-background);
    color: var(--apinox-input-foreground);
    border: 1px solid var(--apinox-input-border);
    padding: 8px 12px;
    border-radius: 4px;
    font-size: var(--apinox-fs-base);
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
    padding: 8px 12px;
    border-radius: 4px;
    font-size: var(--apinox-fs-base);
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
    font-size: var(--apinox-fs-md);
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
    font-size: var(--apinox-fs-sm);
    opacity: 0.6;
    text-transform: uppercase;
`;

const StatValue = styled.div`
    font-size: 20px;
    font-weight: var(--fw-semibold);
    margin-top: ${SPACING_XS};
`;

const VariableRow = styled.div`
    display: flex;
    gap: ${SPACING_SM};
    align-items: center;
`;

const AddButton = styled.button`
    background: transparent;
    color: var(--apinox-textLink-foreground);
    border: 1px dashed var(--apinox-textLink-foreground);
    border-radius: 4px;
    padding: ${SPACING_XS} ${SPACING_SM};
    font-size: var(--apinox-fs-sm);
    cursor: pointer;
    align-self: flex-start;

    &:hover {
        background: var(--apinox-list-hoverBackground);
    }
`;

const RemoveButton = styled.button`
    background: transparent;
    border: none;
    color: var(--apinox-errorForeground);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    padding: 4px 6px;

    &:hover {
        opacity: 0.8;
    }
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
    const [variables, setVariables] = useState<Array<{ name: string; value: string }>>(() =>
        Object.entries(workflow.variables || {}).map(([name, value]) => ({ name, value: String(value) })),
    );

    useEffect(() => {
        setVariables(Object.entries(workflow.variables || {}).map(([name, value]) => ({ name, value: String(value) })));
    }, [workflow.variables]);

    const commitVariables = (rows: Array<{ name: string; value: string }>) => {
        const next: Record<string, string> = {};
        for (const r of rows) {
            if (r.name.trim()) next[r.name.trim()] = r.value;
        }
        onUpdate({ variables: next });
    };

    const updateVariable = (index: number, patch: Partial<{ name: string; value: string }>) => {
        const rows = variables.map((v, i) => (i === index ? { ...v, ...patch } : v));
        setVariables(rows);
        commitVariables(rows);
    };

    const addVariable = () => {
        const rows = [...variables, { name: '', value: '' }];
        setVariables(rows);
        commitVariables(rows);
    };

    const removeVariable = (index: number) => {
        const rows = variables.filter((_, i) => i !== index);
        setVariables(rows);
        commitVariables(rows);
    };

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
                <Label>Variables</Label>
                <InfoBox>
                    Reusable name→value pairs available to every step as {'{{name}}'}. These are the
                    variables tagged when creating a workflow from traffic.
                </InfoBox>
                {variables.length === 0 ? (
                    <div style={{ fontSize: 'var(--apinox-fs-sm)', opacity: 0.6, padding: `${SPACING_XS} 0` }}>
                        No variables yet. Add one below.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING_XS }}>
                        {variables.map((v, i) => (
                            <VariableRow key={i}>
                                <Input
                                    type="text"
                                    placeholder="name"
                                    aria-label={`Variable name ${i}`}
                                    value={v.name}
                                    onChange={(e) => updateVariable(i, { name: e.target.value })}
                                />
                                <Input
                                    type="text"
                                    placeholder="value"
                                    aria-label={`Variable value ${i}`}
                                    value={v.value}
                                    onChange={(e) => updateVariable(i, { value: e.target.value })}
                                />
                                <RemoveButton
                                    aria-label={`Remove variable ${i}`}
                                    title="Remove variable"
                                    onClick={() => removeVariable(i)}
                                >×</RemoveButton>
                            </VariableRow>
                        ))}
                    </div>
                )}
                <AddButton onClick={addVariable}>+ Add variable</AddButton>
            </Section>
        </Container>
    );
};
