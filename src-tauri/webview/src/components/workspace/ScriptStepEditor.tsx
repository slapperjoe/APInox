import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { WorkflowStep } from '@shared/models';
import { Code } from 'lucide-react';
import { PrimaryButton } from '../common/Button';
import { MonacoEditorWrapper } from '@apinox/request-editor/monaco';
import {
    StepEditorContainer,
    StepHeader,
    StepIcon,
    StepTitle,
    StepSection,
    StepFlexSection,
    StepLabel,
    StepInfoBox,
    StepActionRow,
    StepNameField,
} from './StepEditorShell';

const EditorContainer = styled.div`
    border: 1px solid var(--apinox-panel-border);
    border-radius: 4px;
    overflow: hidden;
    flex: 1;
    min-height: 300px;
`;

interface ScriptStepEditorProps {
    step: WorkflowStep;
    onUpdate: (step: WorkflowStep) => void;
}

export const ScriptStepEditor: React.FC<ScriptStepEditorProps> = ({ step, onUpdate }) => {
    const [name, setName] = useState(step.name);
    const [script, setScript] = useState(step.script || '// Your JavaScript code here\n// Available: variables, console.log\n');

    useEffect(() => {
        setName(step.name);
        setScript(step.script || '// Your JavaScript code here\n// Available: variables, console.log\n');
    }, [step]);

    const handleSave = () => {
        onUpdate({
            ...step,
            name,
            script
        });
    };

    return (
        <StepEditorContainer $scroll={false}>
            <StepHeader>
                <StepIcon $color="var(--apinox-charts-purple)">
                    <Code size={20} />
                </StepIcon>
                <StepTitle>Script Step</StepTitle>
            </StepHeader>

            <StepNameField value={name} onChange={setName} />

            <StepFlexSection>
                <StepLabel>JavaScript Code</StepLabel>
                <EditorContainer>
                    <MonacoEditorWrapper
                        language="javascript"
                        theme="vs-dark"
                        value={script}
                        onChange={(value) => setScript(value || '')}
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
                <StepInfoBox>
                    <strong>Available objects:</strong><br />
                    • <code>variables</code> - Read/write workflow variables: <code>variables.myVar = "value"</code><br />
                    • <code>console.log()</code> - Write to workflow execution log<br />
                    • <code>response</code> - Access previous step's response (if applicable)<br />
                    <br />
                    <strong>Example:</strong><br />
                    <code>
                        const userId = variables.userId || "default";<br />
                        console.log("Processing user:", userId);<br />
                        variables.processed = true;
                    </code>
                </StepInfoBox>
            </StepFlexSection>

            <StepActionRow>
                <PrimaryButton onClick={handleSave}>Save Changes</PrimaryButton>
            </StepActionRow>
        </StepEditorContainer>
    );
};
