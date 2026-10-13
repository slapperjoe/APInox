import React from 'react';
import styled from 'styled-components';
import { Workflow } from '@shared/models';
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
                    onUpdate={handleUpdateWorkflow}
                />
            </EditorPanel>
        </Container>
    );
};
