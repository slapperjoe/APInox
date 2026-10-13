import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { WorkflowStep, WorkflowExtractor } from '@shared/models';
import { SPACING_SM } from '../../styles/spacing';
import { GitBranch, AlertCircle, Plus, X } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { MonacoEditorWrapper } from '@apinox/request-editor/monaco';
import {
    StepEditorContainer,
    StepHeader,
    StepIcon,
    StepTitle,
    StepSection,
    StepFlexSection,
    StepLabel,
    StepInput,
    StepInfoBox,
    StepActionRow,
    StepNameField,
} from './StepEditorShell';

const RequestDetails = styled.div`
    padding: ${SPACING_SM};
    background: var(--apinox-textCodeBlock-background);
    border: 1px solid var(--apinox-panel-border);
    border-radius: 4px;
    font-size: var(--apinox-fs-md);

    div {
        margin-bottom: 4px;

        &:last-child {
            margin-bottom: 0;
        }
    }
`;

const EditorContainer = styled.div`
    border: 1px solid var(--apinox-panel-border);
    border-radius: 4px;
    overflow: hidden;
    flex: 1;
    min-height: 200px;
`;

const ExtractorRow = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
`;

const ExtractorTypeBadge = styled.span`
    font-size: var(--apinox-fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--apinox-symbolIcon-variableForeground, rgba(78,201,176,0.15));
    color: var(--apinox-symbolIcon-variableForeground, #4ec9b0);
    flex-shrink: 0;
`;

const ExtractorRemove = styled.button`
    background: transparent;
    border: none;
    color: var(--apinox-errorForeground);
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 4px;
    flex-shrink: 0;

    &:hover {
        opacity: 0.8;
    }
`;

interface RequestStepEditorProps {
    step: WorkflowStep;
    onUpdate: (step: WorkflowStep) => void;
    onPickRequest?: () => void;
}

export const RequestStepEditor: React.FC<RequestStepEditorProps> = ({ step, onUpdate, onPickRequest }) => {
    const [name, setName] = useState(step.name);
    const [requestBody, setRequestBody] = useState(step.requestBody || '');
    const [endpoint, setEndpoint] = useState(step.endpoint || '');
    const [extractors, setExtractors] = useState<WorkflowExtractor[]>(step.extractors || []);

    useEffect(() => {
        setName(step.name);
        setRequestBody(step.requestBody || '');
        setEndpoint(step.endpoint || '');
        setExtractors(step.extractors || []);
    }, [step]);

    const handleSave = () => {
        onUpdate({
            ...step,
            name,
            requestBody,
            endpoint,
            extractors: extractors.length ? extractors : undefined,
        });
    };

    const updateExtractor = (index: number, updates: Partial<WorkflowExtractor>) =>
        setExtractors(xs => xs.map((x, i) => i === index ? { ...x, ...updates } : x));

    const removeExtractor = (index: number) =>
        setExtractors(xs => xs.filter((_, i) => i !== index));

    const addExtractor = () =>
        setExtractors(xs => [...xs, {
            id: crypto.randomUUID(),
            variable: '',
            type: 'xpath',
            pattern: '',
            source: 'body',
        }]);

    // A request step has data two ways: project-referenced (all three refs) OR
    // self-contained (own endpoint/requestBody — what the traffic->workflow
    // wizard emits). Either makes it a real, editable request step; only a step
    // with neither shows the "Pick a request" empty state.
    const isProjectRef = step.projectName && step.interfaceName && step.operationName;
    const isSelfContained = !!(step.endpoint || (step.requestBody && step.requestBody.trim()));
    const hasRequest = !!(isProjectRef || isSelfContained);

    return (
        <StepEditorContainer>
            <StepHeader>
                <StepIcon $color="var(--apinox-charts-green)">
                    <GitBranch size={20} />
                </StepIcon>
                <StepTitle>Request Step</StepTitle>
            </StepHeader>

            <StepNameField value={name} onChange={setName} />

            {hasRequest ? (
                <>
                    {isProjectRef && (
                        <StepSection>
                            <StepLabel>Request Details</StepLabel>
                            <RequestDetails>
                                <div><strong>Project:</strong> {step.projectName}</div>
                                <div><strong>Interface:</strong> {step.interfaceName}</div>
                                <div><strong>Operation:</strong> {step.operationName}</div>
                            </RequestDetails>
                            {onPickRequest && (
                                <SecondaryButton onClick={onPickRequest} style={{ marginTop: SPACING_SM }}>
                                    Change Request
                                </SecondaryButton>
                            )}
                        </StepSection>
                    )}

                    <StepSection>
                        <StepLabel>Endpoint URL</StepLabel>
                        <StepInput
                            type="text"
                            value={endpoint}
                            onChange={(e) => setEndpoint(e.target.value)}
                            placeholder="Endpoint URL"
                        />
                        <StepInfoBox $inline>
                            Leave empty to use the default endpoint from the WSDL
                        </StepInfoBox>
                    </StepSection>

                    <StepFlexSection>
                        <StepLabel>Request Body (use {`{{varName}}`} for variables)</StepLabel>
                        <EditorContainer>
                            <MonacoEditorWrapper
                                height="100%"
                                language="xml"
                                theme="vs-dark"
                                value={requestBody}
                                onChange={(value) => setRequestBody(value || '')}
                                options={{
                                    minimap: { enabled: false },
                                    lineNumbers: 'on',
                                    scrollBeyondLastLine: false,
                                    wordWrap: 'on',
                                    fontSize: 'var(--apinox-fs-md)',
                                    tabSize: 2,
                                    automaticLayout: true
                                }}
                            />
                        </EditorContainer>
                        <StepInfoBox $inline>
                            Use workflow variables in the body: {`{{variableName}}`}
                        </StepInfoBox>
                    </StepFlexSection>

                    <StepSection>
                        <StepLabel>Extractors</StepLabel>
                        <StepInfoBox>
                            Values this step's response contributes to the workflow. They populate as {`{{variable}}`} in later
                            steps (e.g. OrderId, sessionToken captured from this response).
                        </StepInfoBox>
                        {extractors.length === 0 ? (
                            <div style={{ fontSize: 'var(--apinox-fs-sm)', opacity: 0.6, padding: `${SPACING_SM} 0` }}>
                                No extractors. Add one to capture a value from this step's response.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING_SM }}>
                                {extractors.map((ex, i) => (
                                    <ExtractorRow key={ex.id}>
                                        <span style={{ width: 14, opacity: 0.6 }}>#{i + 1}</span>
                                        <StepInput
                                            type="text"
                                            placeholder="variable"
                                            aria-label={`Extractor variable ${i}`}
                                            value={ex.variable}
                                            onChange={(e) => updateExtractor(i, { variable: e.target.value })}
                                        />
                                        <StepInput
                                            type="text"
                                            placeholder="XPath pattern"
                                            aria-label={`Extractor pattern ${i}`}
                                            value={ex.pattern}
                                            onChange={(e) => updateExtractor(i, { pattern: e.target.value })}
                                        />
                                        <ExtractorTypeBadge>{ex.source === 'header' ? 'header' : 'body'}</ExtractorTypeBadge>
                                        <ExtractorRemove
                                            aria-label={`Remove extractor ${i}`}
                                            title="Remove extractor"
                                            onClick={() => removeExtractor(i)}
                                        >
                                            <X size={14} />
                                        </ExtractorRemove>
                                    </ExtractorRow>
                                ))}
                            </div>
                        )}
                        <SecondaryButton onClick={addExtractor} style={{ marginTop: SPACING_SM, alignSelf: 'flex-start' }}>
                            <Plus size={14} /> Add Extractor
                        </SecondaryButton>
                    </StepSection>
                </>
            ) : (
                <EmptyState
                    icon={AlertCircle}
                    title="No request selected"
                    description={onPickRequest ? 'Pick a request from any project.' : 'Select a request in the workflow builder.'}
                    action={onPickRequest ? { label: 'Pick Request', onClick: onPickRequest } : undefined}
                />
            )}

            <StepActionRow>
                <PrimaryButton onClick={handleSave}>Save Changes</PrimaryButton>
            </StepActionRow>
        </StepEditorContainer>
    );
};
