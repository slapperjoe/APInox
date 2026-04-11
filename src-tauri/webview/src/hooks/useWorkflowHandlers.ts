import { useCallback, useState } from 'react';
import { bridge } from '../utils/bridge';
import { FrontendCommand } from '@shared/messages';
import { SidebarView, type Workflow, type WorkflowStep, type ApinoxConfig } from '@shared/models';

interface WorkflowBuilderModalState {
    open: boolean;
    workflow: Workflow | null;
    projectPath: string | null;
}

interface UseWorkflowHandlersProps {
    config: ApinoxConfig | null;
    setConfig: (config: ApinoxConfig | null) => void;
    setWorkspaceDirty: (dirty: boolean) => void;
    selectedWorkflowStep: { workflow: Workflow; step: WorkflowStep | null } | null;
    setSelectedWorkflowStep: (step: { workflow: Workflow; step: WorkflowStep | null } | null) => void;
    setSelectedRequest: (req: any) => void;
    setActiveView: (view: SidebarView) => void;
    setLoading: (loading: boolean) => void;
}

export function useWorkflowHandlers({
    config,
    setConfig,
    setWorkspaceDirty,
    selectedWorkflowStep,
    setSelectedWorkflowStep,
    setSelectedRequest,
    setActiveView,
    setLoading,
}: UseWorkflowHandlersProps) {
    const [workflowBuilderModal, setWorkflowBuilderModal] = useState<WorkflowBuilderModalState>({
        open: false, workflow: null, projectPath: null
    });

    const handleAddWorkflow = useCallback(() => {
        setWorkflowBuilderModal({ open: true, workflow: null, projectPath: '' });
    }, []);

    const handleEditWorkflow = useCallback((workflow: Workflow) => {
        setWorkflowBuilderModal({ open: true, workflow, projectPath: '' });
    }, []);

    const handleSaveWorkflow = useCallback(async (workflow: Workflow) => {
        try {
            await bridge.sendMessageAsync({ command: FrontendCommand.SaveWorkflow, workflow });
            const response = await bridge.sendMessageAsync({ command: FrontendCommand.GetSettings });
            if (response) setConfig(response as any);
            setWorkspaceDirty(true);
            setWorkflowBuilderModal({ open: false, workflow: null, projectPath: '' });
        } catch (error) {
            console.error('[useWorkflowHandlers] Failed to save workflow:', error);
        }
    }, [setConfig, setWorkspaceDirty]);

    const handleRunWorkflow = useCallback(async (workflow: Workflow) => {
        try {
            setLoading(true);
            const result: any = await bridge.sendMessageAsync({
                command: FrontendCommand.ExecuteWorkflow,
                workflow,
                environment: config?.activeEnvironment
            });
            if (result?.status !== 'completed') {
                console.error(`[Workflow] ${workflow.name} failed:`, result?.error);
            }
        } catch (error) {
            console.error('Failed to run workflow:', error);
        } finally {
            setLoading(false);
        }
    }, [config?.activeEnvironment, setLoading]);

    const handleDeleteWorkflow = useCallback(async (workflow: Workflow) => {
        try {
            await bridge.sendMessageAsync({ command: FrontendCommand.DeleteWorkflow, workflowId: workflow.id });
            if (selectedWorkflowStep?.workflow.id === workflow.id) {
                setSelectedWorkflowStep(null);
            }
            const updatedConfig: any = await bridge.sendMessageAsync({ command: FrontendCommand.GetSettings });
            if (updatedConfig) setConfig(updatedConfig);
            setWorkspaceDirty(true);
        } catch (error) {
            console.error('Failed to delete workflow:', error);
        }
    }, [setConfig, setWorkspaceDirty, selectedWorkflowStep, setSelectedWorkflowStep]);

    const handleDuplicateWorkflow = useCallback((workflow: Workflow) => {
        const duplicated: Workflow = {
            ...workflow,
            id: crypto.randomUUID(),
            name: `${workflow.name} (Copy)`,
        };
        setWorkflowBuilderModal({ open: true, workflow: duplicated, projectPath: '' });
    }, []);

    const handleSelectWorkflow = useCallback((workflow: Workflow) => {
        setSelectedRequest(null);
        setSelectedWorkflowStep({ workflow, step: null as any });
        setActiveView(SidebarView.WORKFLOWS);
    }, [setSelectedRequest, setSelectedWorkflowStep, setActiveView]);

    const handleSelectWorkflowStep = useCallback((workflow: Workflow, step: WorkflowStep) => {
        setSelectedRequest(null);
        setSelectedWorkflowStep({ workflow, step });
        setActiveView(SidebarView.WORKFLOWS);
    }, [setSelectedRequest, setSelectedWorkflowStep, setActiveView]);

    const handleUpdateWorkflowStep = useCallback(async (workflow: Workflow, updatedStep: WorkflowStep) => {
        const updatedWorkflow: Workflow = {
            ...workflow,
            steps: workflow.steps.map(s => s.id === updatedStep.id ? updatedStep : s)
        };
        try {
            await bridge.sendMessageAsync({ command: FrontendCommand.SaveWorkflow, workflow: updatedWorkflow });
            const response = await bridge.sendMessageAsync({ command: FrontendCommand.GetSettings });
            if (response) setConfig(response as any);
            setSelectedWorkflowStep({ workflow: updatedWorkflow, step: updatedStep });
        } catch (error) {
            console.error('[useWorkflowHandlers] Failed to update workflow step:', error);
        }
    }, [setConfig, setSelectedWorkflowStep]);

    const handleUpdateWorkflow = useCallback(async (updatedWorkflow: Workflow) => {
        try {
            await bridge.sendMessageAsync({ command: FrontendCommand.SaveWorkflow, workflow: updatedWorkflow });
            const response = await bridge.sendMessageAsync({ command: FrontendCommand.GetSettings });
            if (response) setConfig(response as any);
            if (selectedWorkflowStep?.workflow.id === updatedWorkflow.id) {
                setSelectedWorkflowStep({ workflow: updatedWorkflow, step: selectedWorkflowStep.step });
            }
        } catch (error) {
            console.error('[useWorkflowHandlers] Failed to update workflow:', error);
        }
    }, [setConfig, setSelectedWorkflowStep, selectedWorkflowStep]);

    return {
        workflowBuilderModal,
        setWorkflowBuilderModal,
        handleAddWorkflow,
        handleEditWorkflow,
        handleSaveWorkflow,
        handleRunWorkflow,
        handleDeleteWorkflow,
        handleDuplicateWorkflow,
        handleSelectWorkflow,
        handleSelectWorkflowStep,
        handleUpdateWorkflowStep,
        handleUpdateWorkflow,
    };
}
