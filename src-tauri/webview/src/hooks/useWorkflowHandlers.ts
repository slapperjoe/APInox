import { useCallback, useState } from 'react';
import { bridge } from '../utils/bridge';
import { FrontendCommand } from '@shared/messages';
import { SidebarView, type Workflow, type WorkflowStep, type ApinoxConfig, type TestSuite } from '@shared/models';
import { findReferenceCycle } from '../utils/referenceCycle';
import { embedWorkflowRun } from '../utils/runEmbedding';

interface WorkflowBuilderModalState {
    open: boolean;
    workflow: Workflow | null;
    projectPath: string | null;
}

interface UseWorkflowHandlersProps {
    config: ApinoxConfig | null;
    /** Global test suites (flat case list is derived for the save-time cycle guard). */
    testSuites: TestSuite[];
    setConfig: (config: ApinoxConfig | null) => void;
    /** Keep the raw config string in lockstep with `config` after a save so
     *  whole-config surfaces (e.g. the Settings editor) never persist a stale
     *  snapshot that would clobber the workflows just written by Rust. */
    setRawConfig?: (raw: string) => void;
    setWorkspaceDirty: (dirty: boolean) => void;
    selectedWorkflowStep: { workflow: Workflow; step: WorkflowStep | null } | null;
    setSelectedWorkflowStep: (step: { workflow: Workflow; step: WorkflowStep | null } | null) => void;
    setSelectedRequest: (req: any) => void;
    setActiveView: (view: SidebarView) => void;
    setLoading: (loading: boolean) => void;
}

export function useWorkflowHandlers({
    config,
    testSuites,
    setConfig,
    setRawConfig,
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

    /**
     * Apply a fresh GetSettings response to BOTH `config` and `rawConfig`.
     *
     * Keeping `rawConfig` in lockstep matters: the Settings editor snapshots
     * the config into local state and, on autosave/unmount, writes the whole
     * config back. If only `config` were refreshed after a workflow save, the
     * Settings editor would later persist a stale snapshot (missing the new
     * workflow) and clobber the on-disk copy — the workflow would vanish on
     * the next boot. Serializing the same response into `rawConfig` keeps the
     * two sources of truth consistent.
     */
    const applyConfigResponse = useCallback((response: any) => {
        if (!response) return;
        setConfig(response as any);
        setRawConfig?.(JSON.stringify(response, null, 2));
    }, [setConfig, setRawConfig]);

    const handleAddWorkflow = useCallback(() => {
        setWorkflowBuilderModal({ open: true, workflow: null, projectPath: '' });
    }, []);

    const handleEditWorkflow = useCallback((workflow: Workflow) => {
        setWorkflowBuilderModal({ open: true, workflow, projectPath: '' });
    }, []);

    const handleSaveWorkflow = useCallback(async (workflow: Workflow) => {
        try {
            // Cycle guard: upsert the incoming workflow into the graph, then walk from it.
            const allCases = testSuites.flatMap(s => s.testCases || []);
            const others = (config?.workflows || []).filter(w => w.id !== workflow.id);
            const cycle = findReferenceCycle(workflow.id, {
                workflows: [...others, workflow],
                cases: allCases,
            });
            if (cycle) {
                alert(`Cannot save workflow: reference cycle detected (${cycle.join(' → ')}). Remove one of the references.`);
                return;
            }
            await bridge.sendMessageAsync({ command: FrontendCommand.SaveWorkflow, workflow });
            const response = await bridge.sendMessageAsync({ command: FrontendCommand.GetSettings });
            applyConfigResponse(response);
            setWorkspaceDirty(true);
            setWorkflowBuilderModal({ open: false, workflow: null, projectPath: '' });
        } catch (error) {
            console.error('[useWorkflowHandlers] Failed to save workflow:', error);
        }
    }, [applyConfigResponse, setWorkspaceDirty, testSuites, config?.workflows]);

    const handleRunWorkflow = useCallback(async (workflow: Workflow) => {
        try {
            setLoading(true);
            // Open the workflow in the main area so the run results are visible.
            setActiveView(SidebarView.WORKFLOWS);
            setSelectedWorkflowStep({ workflow, step: null });
            // Embed referenced test cases (recursively) so the backend
            // executes a self-contained copy of each 'testCase' step.
            const allCases = testSuites.flatMap(s => s.testCases || []);
            const result: any = await bridge.sendMessageAsync({
                command: FrontendCommand.ExecuteWorkflow,
                workflow: embedWorkflowRun(workflow, config?.workflows || [], allCases),
                environment: config?.activeEnvironment
            });
            setWorkflowRunResults(prev => ({ ...prev, [workflow.id]: result || {} }));
            // Reload config so the persisted run history (workflowRunHistory) updates.
            const updated: any = await bridge.sendMessageAsync({ command: FrontendCommand.GetSettings });
            applyConfigResponse(updated);
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
    }, [config?.activeEnvironment, config?.workflows, testSuites, setLoading, setActiveView, setSelectedWorkflowStep, applyConfigResponse]);

    const handleDeleteWorkflow = useCallback(async (workflow: Workflow) => {
        try {
            await bridge.sendMessageAsync({ command: FrontendCommand.DeleteWorkflow, workflowId: workflow.id });
            if (selectedWorkflowStep?.workflow.id === workflow.id) {
                setSelectedWorkflowStep(null);
            }
            const updatedConfig: any = await bridge.sendMessageAsync({ command: FrontendCommand.GetSettings });
            applyConfigResponse(updatedConfig);
            setWorkspaceDirty(true);
        } catch (error) {
            console.error('Failed to delete workflow:', error);
        }
    }, [applyConfigResponse, setWorkspaceDirty, selectedWorkflowStep, setSelectedWorkflowStep]);

    const handleDuplicateWorkflow = useCallback((workflow: Workflow) => {
        const duplicated: Workflow = {
            ...workflow,
            id: crypto.randomUUID(),
            name: `${workflow.name} (Copy)`,
        };
        setWorkflowBuilderModal({ open: true, workflow: duplicated, projectPath: '' });
    }, []);

    const handleSaveWorkflowToDisk = useCallback(async (workflow: Workflow) => {
        try {
            const { save } = await import('@tauri-apps/plugin-dialog');
            const safeName = (workflow.name || workflow.id)
                .replace(/[^a-zA-Z0-9\-_ ]/g, '')
                .trim()
                .replace(/\s+/g, '-') || workflow.id;
            const filePath = await save({
                defaultPath: `${safeName}.workflow.json`,
                filters: [{ name: 'APInox Workflow', extensions: ['json'] }],
            });
            if (!filePath) return; // user cancelled the dialog
            await bridge.invokeTauriCommand('export_workflow_to_file', {
                workflowId: workflow.id,
                filePath,
            });
        } catch (error) {
            console.error('[useWorkflowHandlers] Failed to save workflow to disk:', error);
            alert(`Failed to save workflow to disk: ${(error as any)?.message || error}`);
        }
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
            applyConfigResponse(response);
            setSelectedWorkflowStep({ workflow: updatedWorkflow, step: updatedStep });
        } catch (error) {
            console.error('[useWorkflowHandlers] Failed to update workflow step:', error);
        }
    }, [applyConfigResponse, setSelectedWorkflowStep]);

    const handleUpdateWorkflow = useCallback(async (updatedWorkflow: Workflow) => {
        try {
            await bridge.sendMessageAsync({ command: FrontendCommand.SaveWorkflow, workflow: updatedWorkflow });
            const response = await bridge.sendMessageAsync({ command: FrontendCommand.GetSettings });
            applyConfigResponse(response);
            if (selectedWorkflowStep?.workflow.id === updatedWorkflow.id) {
                setSelectedWorkflowStep({ workflow: updatedWorkflow, step: selectedWorkflowStep.step });
            }
        } catch (error) {
            console.error('[useWorkflowHandlers] Failed to update workflow:', error);
        }
    }, [applyConfigResponse, setSelectedWorkflowStep, selectedWorkflowStep]);

    const handleLoadWorkflowFromFile = useCallback(async () => {
        try {
            const { open } = await import('@tauri-apps/plugin-dialog');
            const res = await open({
                multiple: false,
                directory: false,
                filters: [{ name: 'APInox Workflow', extensions: ['json'] }],
            });
            const filePath = Array.isArray(res) ? res[0] : res;
            if (!filePath) return; // user cancelled the dialog
            const imported: Workflow = await bridge.invokeTauriCommand('import_workflow_from_file', { filePath });
            if (!imported || typeof imported !== 'object' || !imported.id) {
                throw new Error('Invalid workflow file: missing id');
            }
            // Persist via the standard save path (upsert by id) and reload config.
            await handleUpdateWorkflow(imported);
        } catch (error) {
            console.error('[useWorkflowHandlers] Failed to load workflow from file:', error);
            alert(`Failed to load workflow from file: ${(error as any)?.message || error}`);
        }
    }, [handleUpdateWorkflow]);

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
        handleSaveWorkflowToDisk,
        handleSelectWorkflow,
        handleSelectWorkflowStep,
        handleUpdateWorkflowStep,
        handleUpdateWorkflow,
        handleLoadWorkflowFromFile,
        handleAddWorkflowStep,
        handleDeleteWorkflowStep,
        handleMoveWorkflowStep,
    };
}
