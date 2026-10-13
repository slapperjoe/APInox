import React from 'react';
import styled from 'styled-components';
import { Workflow, WorkflowExecutionResult } from '@shared/models';
import { WorkflowPropertiesPanel } from './WorkflowPropertiesPanel';

const Container = styled.div`
    display: flex;
    height: 100%;
    overflow: hidden;
    width: 100%;
`;

const EditorPanel = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--apinox-editor-background);
`;

interface WorkflowEditorProps {
    workflow: Workflow;
    /** Last run result for this workflow (rendered in the properties panel). */
    runResult?: WorkflowExecutionResult;
    /** Run this workflow. */
    onRun?: () => void;
    /** History of this workflow's executions (newest first). */
    runHistory?: WorkflowExecutionResult[];
    onUpdate: (workflow: Workflow) => void;
}

/**
 * Workflow-level editor. Steps are listed and navigated from the app sidebar
 * (WorkflowsUi); selecting a step there renders its editor (RequestStepEditor
 * for request steps) in the main area. This panel shows the workflow's own
 * properties (name, description, variables) — it no longer renders an embedded
 * step list, so a step is never rendered two different ways.
 */
export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({
    workflow,
    runResult,
    onRun,
    runHistory,
    onUpdate,
}) => {
    const handleUpdateWorkflow = (updates: Partial<Workflow>) => {
        onUpdate({ ...workflow, ...updates });
    };

    return (
        <Container>
            <EditorPanel>
                <WorkflowPropertiesPanel
                    workflow={workflow}
                    runResult={runResult}
                    onRun={onRun}
                    runHistory={runHistory}
                    onUpdate={handleUpdateWorkflow}
                />
            </EditorPanel>
        </Container>
    );
};
