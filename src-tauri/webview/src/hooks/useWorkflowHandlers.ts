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
        open: false, workflow: null, projectPath: ''
    });
    // Last run result per workflow id (frontend WorkflowExecutionResult shape).
    const [workflowRunResults, setWorkflowRunResults] = useState<Record<string, any>>({});

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
            // Open the workflow in the main area so the run results are visible.
            setActiveView(SidebarView.WORKFLOWS);
            setSelectedWorkflowStep({ workflow, step: null });
            const result: any = await bridge.sendMessageAsync({
                command: FrontendCommand.ExecuteWorkflow,
                workflow,
                environment: config?.activeEnvironment
            });
            setWorkflowRunResults(prev => ({ ...prev, [workflow.id]: result || {} }));
            // Reload config so the persisted run history (workflowRunHistory) updates.
            const updated: any = await bridge.sendMessageAsync({ command: FrontendCommand.GetSettings });
            if (updated) setConfig(updated);
        } catch (error) {
            console.error(`[Workflow] ${workflow.name} failed:`, error);
            setWorkflowRunResults(prev => ({
                ...prev,
                [workflow.id]: {
                    status: 'failed',
                    error: (error as any)?.message || String(error),
                    stepResults: []
                }
            }));
        } finally {
            setLoading(false);
        }
    }, [config?.activeEnvironment, setLoading, setActiveView, setSelectedWorkflowStep]);

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

    // ── step management (lives in the app-sidebar expanded workflow) ────────
    const handleAddWorkflowStep = useCallback(async (workflow: Workflow) => {
        const newStep: WorkflowStep = {
            id: crypto.randomUUID(),
            name: 'New Request Step',
            type: 'request',
            order: workflow.steps?.length || 0,
        };
        await handleUpdateWorkflow({ ...workflow, steps: [...(workflow.steps || []), newStep] });
    }, [handleUpdateWorkflow]);

    const handleDeleteWorkflowStep = useCallback(async (workflow: Workflow, stepId: string) => {
        await handleUpdateWorkflow({
            ...workflow,
            steps: (workflow.steps || []).filter(s => s.id !== stepId),
        });
    }, [handleUpdateWorkflow]);

    const handleMoveWorkflowStep = useCallback(async (workflow: Workflow, stepId: string, direction: -1 | 1) => {
        const steps = [...(workflow.steps || [])];
        const idx = steps.findIndex(s => s.id === stepId);
        const target = idx + direction;
        if (idx < 0 || target < 0 || target >= steps.length) return;
        const [moving] = steps.splice(idx, 1);
        steps.splice(target, 0, moving);
        const renumbered = steps.map((s, i) => ({ ...s, order: i }));
        await handleUpdateWorkflow({ ...workflow, steps: renumbered });
    }, [handleUpdateWorkflow]);

    return {
        workflowBuilderModal,
        setWorkflowBuilderModal,
        workflowRunResults,
        setWorkflowRunResults,
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
        handleAddWorkflowStep,
        handleDeleteWorkflowStep,
        handleMoveWorkflowStep,
    };
}
