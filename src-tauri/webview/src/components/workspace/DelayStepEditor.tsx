import React, { useState } from 'react';
import styled from 'styled-components';
import { Clock, Save } from 'lucide-react';
import { WorkflowStep } from '@shared/models';
import { SPACING_SM } from '../../styles/spacing';
import { PrimaryButton, SecondaryButton } from '../common/Button';
import {
    StepEditorContainer,
    StepHeader,
    StepIcon,
    StepTitle,
    StepSection,
    StepLabel,
    StepInput,
    StepHint,
    StepActionRow,
    StepNameField,
} from './StepEditorShell';

const PreviewBox = styled.div`
    padding: 12px;
    background: var(--apinox-textCodeBlock-background);
    border: 1px solid var(--apinox-panel-border);
    border-radius: 4px;
    font-size: 12px;
    color: var(--apinox-descriptionForeground);
    margin-top: ${SPACING_SM};
`;

interface DelayStepEditorProps {
    step: WorkflowStep;
    onUpdate: (step: WorkflowStep) => void;
    onCancel?: () => void;
}

export const DelayStepEditor: React.FC<DelayStepEditorProps> = ({
    step,
    onUpdate,
    onCancel
}) => {
    const [delayMs, setDelayMs] = useState(step.delayMs || 1000);
    const [name, setName] = useState(step.name || 'Delay');

    const handleSave = () => {
        onUpdate({
            ...step,
            name,
            delayMs
        });
    };

    const formatDuration = (ms: number): string => {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
        return `${(ms / 3600000).toFixed(1)}h`;
    };

    return (
        <StepEditorContainer>
            <StepHeader>
                <StepIcon $color="var(--apinox-symbolIcon-variableForeground)">
                    <Clock size={24} />
                </StepIcon>
                <StepTitle>Delay Step</StepTitle>
            </StepHeader>

            <StepNameField value={name} onChange={setName} />

            <StepSection>
                <StepLabel>Delay Duration (milliseconds)</StepLabel>
                <StepInput
                    type="number"
                    value={delayMs}
                    onChange={(e) => setDelayMs(Math.max(0, parseInt(e.target.value) || 0))}
                    min="0"
                    step="100"
                />
                <StepHint>
                    The workflow will pause for this duration before continuing to the next step
                </StepHint>
                <PreviewBox>
                    ⏰ This step will wait for <strong>{formatDuration(delayMs)}</strong>
                </PreviewBox>
            </StepSection>

            <StepSection>
                <StepLabel>Common Durations</StepLabel>
                <div style={{ display: 'flex', gap: SPACING_SM, flexWrap: 'wrap', marginTop: SPACING_SM }}>
                    {[
                        { label: '100ms', value: 100 },
                        { label: '500ms', value: 500 },
                        { label: '1s', value: 1000 },
                        { label: '2s', value: 2000 },
                        { label: '5s', value: 5000 },
                        { label: '10s', value: 10000 },
                        { label: '30s', value: 30000 },
                        { label: '1m', value: 60000 }
                    ].map(({ label, value }) => (
                        <SecondaryButton
                            key={value}
                            onClick={() => setDelayMs(value)}
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                        >
                            {label}
                        </SecondaryButton>
                    ))}
                </div>
            </StepSection>

            <StepActionRow $right $bordered>
                {onCancel && (
                    <SecondaryButton onClick={onCancel}>
                        Cancel
                    </SecondaryButton>
                )}
                <PrimaryButton onClick={handleSave}>
                    <Save size={14} />
                    Save Changes
                </PrimaryButton>
            </StepActionRow>
        </StepEditorContainer>
    );
};
