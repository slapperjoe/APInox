import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { WorkflowStep } from '@shared/models';
import { SPACING_SM } from '../../styles/spacing';
import { GitBranch, AlertCircle, Plus } from 'lucide-react';
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

interface RequestStepEditorProps {
    step: WorkflowStep;
    onUpdate: (step: WorkflowStep) => void;
    onPickRequest?: () => void;
}

export const RequestStepEditor: React.FC<RequestStepEditorProps> = ({ step, onUpdate, onPickRequest }) => {
    const [name, setName] = useState(step.name);
    const [requestBody, setRequestBody] = useState(step.requestBody || '');
    const [endpoint, setEndpoint] = useState(step.endpoint || '');

    useEffect(() => {
        setName(step.name);
        setRequestBody(step.requestBody || '');
        setEndpoint(step.endpoint || '');
    }, [step]);

    const handleSave = () => {
        onUpdate({
            ...step,
            name,
            requestBody,
            endpoint
        });
    };

    const hasRequest = step.projectName && step.interfaceName && step.operationName;

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
