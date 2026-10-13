import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Workflow, WorkflowExecutionResult } from '@shared/models';
import { SPACING_SM, SPACING_MD, SPACING_XS } from '../../styles/spacing';
import { Settings, Play, Clock, ChevronDown, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { formatXml } from '@shared/utils/xmlFormatter';

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

const RunResultCard = styled.div`
    border: 1px solid var(--apinox-panel-border);
    border-radius: 6px;
    padding: ${SPACING_SM};
    background: var(--apinox-sideBar-background);
`;

const RunResultHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${SPACING_XS};
`;

const RunBadge = styled.span<{ $pass: boolean }>`
    font-size: 12px;
    font-weight: var(--fw-bold);
    padding: 2px 10px;
    border-radius: 10px;
    color: #fff;
    background: ${props => props.$pass ? 'var(--apinox-charts-green)' : 'var(--apinox-errorForeground)'};
`;

const RunDuration = styled.span`
    font-size: var(--apinox-fs-sm);
    opacity: 0.7;
`;

const RunStepRow = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    padding: 4px 0;
    font-size: var(--apinox-fs-md);
    border-top: 1px solid var(--apinox-panel-border);
`;

const RunStepDot = styled.span<{ $status: string }>`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    background: ${props =>
        props.$status === 'success' ? 'var(--apinox-charts-green)'
        : props.$status === 'failed' ? 'var(--apinox-errorForeground)'
        : 'var(--apinox-symbolIcon-variableForeground)'};
`;

const RunStepName = styled.span`
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const RunStepMeta = styled.span`
    font-size: var(--apinox-fs-sm);
    opacity: 0.7;
    flex-shrink: 0;
`;

const RunStepError = styled.div`
    font-size: var(--apinox-fs-sm);
    color: var(--apinox-errorForeground);
    margin-left: 16px;
`;

const RunEmpty = styled.div`
    font-size: var(--apinox-fs-sm);
    opacity: 0.6;
    padding: ${SPACING_XS} 0;
`;

const RunButton = styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--apinox-charts-green);
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 6px 14px;
    font-size: var(--apinox-fs-sm);
    font-weight: var(--fw-semibold);
    cursor: pointer;
    margin-left: auto;

    &:hover {
        opacity: 0.9;
    }
`;

const HistoryItem = styled.div`
    border: 1px solid var(--apinox-panel-border);
    border-radius: 6px;
    margin-bottom: ${SPACING_SM};
    background: var(--apinox-sideBar-background);
`;

const HistoryHeader = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    padding: ${SPACING_SM};
    cursor: pointer;
    font-size: var(--apinox-fs-md);

    &:hover {
        background: var(--apinox-list-hoverBackground);
    }
`;

const HistoryStatus = styled.span<{ $status: string }>`
    font-size: 11px;
    font-weight: var(--fw-bold);
    padding: 1px 8px;
    border-radius: 8px;
    color: #fff;
    background: ${props =>
        props.$status === 'completed' ? 'var(--apinox-charts-green)'
        : 'var(--apinox-errorForeground)'};
`;

const HistoryMeta = styled.span`
    font-size: var(--apinox-fs-sm);
    opacity: 0.7;
    margin-left: auto;
`;

const HistoryDetails = styled.div`
    padding: ${SPACING_SM};
    border-top: 1px solid var(--apinox-panel-border);
`;

const HistoryStepRow = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    padding: 4px 0;
    font-size: var(--apinox-fs-md);
    cursor: pointer;

    &:hover {
        background: var(--apinox-list-hoverBackground);
    }
`;

const HistoryStepName = styled.span`
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const HistoryStepMeta = styled.span`
    font-size: var(--apinox-fs-sm);
    opacity: 0.7;
    flex-shrink: 0;
`;

const HistoryBody = styled.pre`
    margin: 4px 0 8px 16px;
    padding: ${SPACING_SM};
    background: var(--apinox-textCodeBlock-background);
    border: 1px solid var(--apinox-panel-border);
    border-radius: 4px;
    font-size: var(--apinox-fs-sm);
    font-family: var(--apinox-font-family-mono, monospace);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 200px;
    overflow: auto;
`;

const HistoryBodyLabel = styled.div`
    font-size: var(--apinox-fs-sm);
    font-weight: var(--fw-semibold);
    opacity: 0.7;
    margin: 6px 0 2px 16px;
`;

interface WorkflowPropertiesPanelProps {
    workflow: Workflow;
    /** Last run result for this workflow (rendered as a run summary). */
    runResult?: WorkflowExecutionResult;
    /** Run this workflow (executes its request steps). */
    onRun?: () => void;
    /** History of this workflow's executions (newest first). */
    runHistory?: WorkflowExecutionResult[];
    onUpdate: (updates: Partial<Workflow>) => void;
}

export const WorkflowPropertiesPanel: React.FC<WorkflowPropertiesPanelProps> = ({
    workflow,
    runResult,
    onRun,
    runHistory = [],
    onUpdate
}) => {
    const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
    const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
    // Newest run first (mirrors the performance tester's history ordering).
    const sortedHistory = [...runHistory].sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
    const pretty = (s?: string) => (s ? formatXml(s, false, true) : '');
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
                <RunButton onClick={onRun} title="Run this workflow">
                    <Play size={14} /> Run
                </RunButton>
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
                <Label>Last Run</Label>
                {runResult ? (
                    <RunResultCard>
                        <RunResultHeader>
                            <RunBadge $pass={runResult.status === 'completed'}>
                                {runResult.status === 'completed' ? 'PASS' : 'FAIL'}
                            </RunBadge>
                            <RunDuration>
                                {(runResult.stepResults || []).length} step{(runResult.stepResults || []).length === 1 ? '' : 's'} · {(runResult.endTime || 0) - (runResult.startTime || 0)}ms
                            </RunDuration>
                        </RunResultHeader>
                        {runResult.error && <RunStepError>{runResult.error}</RunStepError>}
                        {(runResult.stepResults || []).map((s, i) => (
                            <div key={s.stepId || i}>
                                <RunStepRow>
                                    <RunStepDot $status={s.status} />
                                    <RunStepName title={s.stepName}>{s.stepName}</RunStepName>
                                    <RunStepMeta>
                                        {s.statusCode ? `${s.statusCode} · ` : ''}{s.duration}ms
                                    </RunStepMeta>
                                </RunStepRow>
                                {s.error && <RunStepError>{s.error}</RunStepError>}
                            </div>
                        ))}
                    </RunResultCard>
                ) : (
                    <RunEmpty>
                        Press the play icon on a workflow in the sidebar to run it. Per-step pass/fail results
                        appear here.
                    </RunEmpty>
                )}
            </Section>

                        <Section>
                            <Label>Run History ({sortedHistory.length})</Label>
                            {sortedHistory.length === 0 ? (
                                <RunEmpty>No previous runs yet. Run this workflow to build history.</RunEmpty>
                            ) : (
                                sortedHistory.map(run => {
                                        const runKey = `${run.workflowId}:${run.startTime}`;
                                        const isExpanded = expandedRunId === runKey;
                                        return (
                                            <HistoryItem key={runKey}>
                                                <HistoryHeader onClick={() => setExpandedRunId(isExpanded ? null : runKey)}>
                                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    {run.status === 'completed' ? (
                                                        <CheckCircle size={16} style={{ color: 'var(--apinox-testing-iconPassed)' }} />
                                                    ) : (
                                                        <XCircle size={16} style={{ color: 'var(--apinox-testing-iconFailed)' }} />
                                                    )}
                                                    <span style={{ fontWeight: 'var(--fw-medium)' }}>
                                                        {new Date(run.startTime).toLocaleString()}
                                                    </span>
                                                    <HistoryStatus $status={run.status}>
                                                        {run.status === 'completed' ? 'PASS' : 'FAIL'}
                                                    </HistoryStatus>
                                                    <HistoryMeta>
                                                        {(run.stepResults || []).length} steps · {(run.endTime || 0) - (run.startTime || 0)}ms
                                                    </HistoryMeta>
                                                </HistoryHeader>
                                                {isExpanded && (
                                                    <HistoryDetails>
                                                        {(run.stepResults || []).map((s, i) => {
                                                            const stepKey = s.stepId || `step-${i}`;
                                                            const stepExpanded = expandedStepId === stepKey;
                                                            return (
                                                                <div key={stepKey}>
                                                                    <HistoryStepRow onClick={() => setExpandedStepId(stepExpanded ? null : stepKey)}>
                                                                        <RunStepDot $status={s.status} />
                                                                        <HistoryStepName title={s.stepName}>{s.stepName}</HistoryStepName>
                                                                        <HistoryStepMeta>
                                                                            {s.statusCode ? `${s.statusCode} · ` : ''}{s.duration}ms
                                                                        </HistoryStepMeta>
                                                                        {stepExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                                    </HistoryStepRow>
                                                                    {stepExpanded && (
                                                                        <>
                                                                    {s.request && (
                                                                        <>
                                                                            <HistoryBodyLabel>Request</HistoryBodyLabel>
                                                                            <HistoryBody>{pretty(s.request)}</HistoryBody>
                                                                        </>
                                                                    )}
                                                                    {s.response && (
                                                                        <>
                                                                            <HistoryBodyLabel>Response</HistoryBodyLabel>
                                                                            <HistoryBody>{pretty(s.response)}</HistoryBody>
                                                                        </>
                                                                    )}
                                                                            {s.error && <RunStepError>{s.error}</RunStepError>}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </HistoryDetails>
                                                )}
                                            </HistoryItem>
                                        );
                                    })
                            )}
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
