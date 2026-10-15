import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { Play, Plus, Trash2, ChevronDown, ChevronRight, FlaskConical, ListChecks, Clock, FileCode, ArrowRight, FileText, GitBranch, RefreshCw, CheckCircle, XCircle, Minus, Download, FolderOpen } from 'lucide-react';
import { UnifiedProject, TestSuite, Workflow, WorkflowStep } from '@shared/models';
import { SidebarContextMenu, CtxMenuSection, CtxMenuItem, Pencil } from './shared/SidebarContextMenu';
import { SidebarContainer, SidebarContent, SidebarHeader, SidebarHeaderActions, SidebarHeaderTitle, OperationItem, RequestItem } from './shared/SidebarStyles';
import { EmptyState } from '../common/EmptyState';
import { HeaderButton } from '../common/Button';
import { Tooltip } from '../common/Tooltip';
import { InlineFormInput } from '../common/Form';
import { Spinner } from '../common/Spinner';
import { SPACING_SM, SPACING_XS } from '../../styles/spacing';
import type { TestExecutionStatus } from '../workspace/TestCaseView';

// One workflow step result inside a 'workflow' test step's live status map.
type WorkflowStepExecution = NonNullable<TestExecutionStatus['workflowSteps']>[string];

const StepItem = styled(RequestItem)`
    /* Indentation halved (was 52px): suite 8px → case 18px → step 26px. */
    padding-left: 26px !important;
    font-size: 0.9em;
    opacity: 0.9;
    
    &:hover {
        opacity: 1;
    }
`;

const TestsContainer = styled(SidebarContainer)``;

const TestsContent = styled(SidebarContent)``;

const HeaderActions = styled.div`
    position: relative;
`;

const SuiteOperationItem = styled(OperationItem)`
    padding-left: 8px;
`;

const SuiteToggle = styled.span<{ $hasChildren?: boolean }>`
    cursor: ${props => (props.$hasChildren ? 'pointer' : 'default')};
    display: flex;
    align-items: center;
    /* Fixed-width chevron slot: rendered empty (no chevron) when the suite
       has no test cases, so rows line up with expandable rows and there is
       no dead toggle to click (matches the unified explorer TreeItem). */
    width: 14px;
    flex-shrink: 0;
`;

const SuiteIcon = styled.span`
    margin-left: ${SPACING_XS};
    display: flex;
    align-items: center;
`;

const SuiteName = styled.span`
    flex: 1;
    margin-left: ${SPACING_XS};
    font-weight: var(--fw-bold);
`;

const SuiteCount = styled.span`
    font-size: 0.8em;
    opacity: 0.6;
    margin-right: ${SPACING_XS};
`;

const CaseRequestItem = styled(RequestItem)`
    /* Indentation halved (was 35px): suite 8px → case 18px → step 26px. */
    padding-left: 18px;
`;

const CaseToggle = styled.span<{ $hasChildren?: boolean }>`
    cursor: ${props => (props.$hasChildren ? 'pointer' : 'default')};
    display: flex;
    align-items: center;
    margin-right: ${SPACING_XS};
    width: 14px;
    /* Fixed-width chevron slot (empty when the case has no steps) so rows
       line up and there is no dead toggle — same pattern as SuiteToggle. */
    flex-shrink: 0;
`;

const CaseName = styled.span`
    flex: 1;
`;

const CaseCount = styled.span`
    font-size: 0.75em;
    opacity: 0.6;
    margin-right: ${SPACING_XS};
`;

const StepTypeIcon = styled.span`
    display: flex;
    align-items: center;
    margin-right: ${SPACING_XS};
    opacity: 0.7;
`;

// Live execution status on a step row — mirrors the TestCaseView status
// icons (running spinner / pass / fail) onto the rail. The slot renders on
// EVERY row (empty when there is no status) so the chevron + type-icon
// columns stay aligned — the same fixed-slot pattern as the main view's
// workflow sub-step rows.
const StepStatusSlot = styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 13px;
    flex-shrink: 0;
`;

const StepStatusRunning = styled(StepStatusSlot)`
    color: var(--apinox-testing-iconQueued);
`;

const StepStatusPass = styled(StepStatusSlot)`
    color: var(--apinox-testing-iconPassed);
`;

const StepStatusFail = styled(StepStatusSlot)`
    color: var(--apinox-testing-iconFailed);
`;

const StepStatusSkipped = styled(StepStatusSlot)`
    opacity: 0.4;
`;

// Chevron slot on a 'workflow' test step that references a workflow with
// steps — same fixed-width pattern as CaseToggle (empty slot = no dead
// toggle when the step isn't expandable).
const WfStepToggle = styled.span<{ $hasChildren?: boolean }>`
    cursor: ${props => (props.$hasChildren ? 'pointer' : 'default')};
    display: flex;
    align-items: center;
    margin-right: ${SPACING_XS};
    width: 14px;
    flex-shrink: 0;
`;

// A step of the workflow referenced by an expanded 'workflow' test step.
// Read-only (edit them in the WORKFLOWS view); clicking selects the parent
// test step for context.
const WorkflowSubStepItem = styled(RequestItem)`
    /* Indentation halved (was 70px): suite 8px → case 18px → step 26px →
       sub-step 35px — a near-uniform ~8px step per tree level. */
    padding-left: 35px !important;
    font-size: 0.85em;
    opacity: 0.75;

    &:hover {
        opacity: 1;
    }
`;

const StepName = styled.span`
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

// Dimmed workflow name shown on 'workflow' test steps (which workflow the
// step runs) — kept short so the step name keeps priority on truncation.
const StepWfName = styled.span`
    flex-shrink: 1;
    max-width: 45%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.55;
    font-size: 0.85em;
`;

const AddSuiteRow = styled.div`
    padding: ${SPACING_SM};
`;

export interface TestsUiProps {
    // Phase B (t_86c34d38) → C (global suites): `testSuites` is the single
    // source of truth for the TESTS rail (the global store). When omitted,
    // the rail falls back to `projects[].testSuites` (kept for component
    // tests that render without a provider).
    testSuites?: TestSuite[];
    projects: UnifiedProject[];
    // Workflows referenced by 'workflow' test steps — lets the rail expand a
    // workflow step and show the steps inside the referenced workflow.
    workflows?: Workflow[];
    /** Live execution status (caseId → stepId), from TestRunnerContext —
        mirrors the TestCaseView step status icons onto the rail's step rows. */
    testExecution?: Record<string, Record<string, TestExecutionStatus>>;
    selectedTestSuite?: TestSuite | null;
    selectedTestCase?: any | null;
    onAddSuite: (projectName?: string, suiteName?: string) => void;
    onDeleteSuite: (suiteId: string) => void;
    onRunSuite: (suiteId: string) => void;
    onAddTestCase: (suiteId: string) => void;
    onDeleteTestCase: (caseId: string) => void;
    onRenameTestCase?: (caseId: string, newName: string) => void;
    onRenameSuite?: (suiteId: string, newName: string) => void;
    onRunCase: (caseId: string) => void;
    onSelectSuite: (suiteId: string) => void;
    onSelectTestCase: (caseId: string) => void;
    onToggleSuiteExpand: (suiteId: string) => void;
    onToggleCaseExpand: (caseId: string) => void;
    onSelectTestStep?: (caseId: string, stepId: string) => void;
    onRenameTestStep?: (caseId: string, stepId: string, newName: string) => void;
    onDeleteTestStep?: (caseId: string, stepId: string) => void;
    /** Right-click import/export — the handlers own the native save/open
        dialogs + global store round-trip (useSidebarCallbacks). Omitted in
        isolated component tests: the menu items then simply don't render. */
    onExportSuite?: (suiteId: string) => void;
    onImportSuite?: () => void;
    onImportTestCase?: (suiteId: string) => void;
    onExportTestCase?: (caseId: string) => void;
    deleteConfirm: string | null;
}

interface FlatSuite {
    suite: TestSuite;
    projectName: string;
}

export const TestsUi: React.FC<TestsUiProps> = ({
    testSuites,
    projects,
    workflows,
    testExecution,
    selectedTestSuite,
    selectedTestCase,
    onAddSuite,
    onDeleteSuite,
    onRunSuite,
    onAddTestCase,
    onDeleteTestCase,
    onRenameTestCase,
    onRenameSuite,
    onRunCase,
    onSelectSuite,
    onSelectTestCase,
    onToggleSuiteExpand,
    onToggleCaseExpand,
    onSelectTestStep,
    onRenameTestStep,
    onDeleteTestStep,
    onExportSuite,
    onImportSuite,
    onImportTestCase,
    onExportTestCase,
    deleteConfirm
}) => {
    const addSuiteBtnRef = useRef<HTMLButtonElement>(null);
    const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
    // 'workflow' test steps that reference a workflow with steps are expandable
    // in the rail (nested rows = the referenced workflow's steps; read-only,
    // edit them in the WORKFLOWS view). Expansion is UI-only state — not
    // persisted to the step config.
    const [expandedWfStepIds, setExpandedWfStepIds] = useState<Set<string>>(new Set());

    const toggleWfStepExpand = (stepId: string) => {
        setExpandedWfStepIds(prev => {
            const next = new Set(prev);
            if (next.has(stepId)) {
                next.delete(stepId);
            } else {
                next.add(stepId);
            }
            return next;
        });
    };

    const workflowSubStepIcon = (type: WorkflowStep["type"]) => {
        switch (type) {
            case 'delay': return <Clock size={11} />;
            case 'script': return <FileCode size={11} />;
            case 'condition': return <GitBranch size={11} />;
            case 'loop': return <RefreshCw size={11} />;
            case 'request':
            default: return <FileText size={11} />;
        }
    };

    // Status icon (or empty slot) for a step row — running / pass / fail,
    // mirroring the TestCaseView step status icons.
    const stepStatusSlot = (status: TestExecutionStatus | undefined) => {
        if (status?.status === 'running') {
            return (
                <StepStatusRunning data-testid="step-status-slot" title="Running...">
                    <Spinner size={13} />
                </StepStatusRunning>
            );
        }
        if (status?.status === 'pass') {
            return (
                <StepStatusPass data-testid="step-status-slot" title="Passed">
                    <CheckCircle size={13} />
                </StepStatusPass>
            );
        }
        if (status?.status === 'fail') {
            return (
                <StepStatusFail data-testid="step-status-slot" title="Failed">
                    <XCircle size={13} />
                </StepStatusFail>
            );
        }
        return <StepStatusSlot data-testid="step-status-slot" />;
    };

    // Status icon (or empty slot) for a nested workflow sub-step row — the
    // four-state mapping of the main view's sub-step rows (adds 'skipped').
    const subStepStatusSlot = (status: WorkflowStepExecution | undefined) => {
        if (status?.status === 'running') {
            return (
                <StepStatusRunning data-testid="substep-status-slot" title="Running...">
                    <Spinner size={13} />
                </StepStatusRunning>
            );
        }
        if (status?.status === 'pass') {
            return (
                <StepStatusPass data-testid="substep-status-slot" title="Passed">
                    <CheckCircle size={13} />
                </StepStatusPass>
            );
        }
        if (status?.status === 'fail') {
            return (
                <StepStatusFail data-testid="substep-status-slot" title="Failed">
                    <XCircle size={13} />
                </StepStatusFail>
            );
        }
        if (status?.status === 'skipped') {
            return (
                <StepStatusSkipped data-testid="substep-status-slot" title="Skipped">
                    <Minus size={13} />
                </StepStatusSkipped>
            );
        }
        return <StepStatusSlot data-testid="substep-status-slot" />;
    };

    const [renameId, setRenameId] = useState<string | null>(null);
    const [renameType, setRenameType] = useState<'case' | 'step' | 'suite' | null>(null);
    const [renameParentId, setRenameParentId] = useState<string | null>(null);
    const [renameName, setRenameName] = useState('');

    // New suite creation state
    const [isAddingSuite, setIsAddingSuite] = useState(false);
    const [newSuiteName, setNewSuiteName] = useState('');

    // Context menu state (cases/steps: rename; suites: run/rename/add-case/delete)
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; caseId?: string; suiteId?: string; stepId?: string; name: string; type: 'case' | 'step' | 'suite' } | null>(null);

    const handleContextMenu = (e: React.MouseEvent, name: string, type: 'case' | 'step' | 'suite', caseId?: string, stepId?: string, suiteId?: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, name, type, caseId, stepId, suiteId });
    };

    const closeContextMenu = () => {
        setContextMenu(null);
    };

    const handleRenameFromMenu = () => {
        if (contextMenu) {
            const targetId = contextMenu.stepId || contextMenu.caseId || contextMenu.suiteId || null;
            setRenameId(targetId);
            setRenameType(contextMenu.type);
            setRenameParentId(contextMenu.caseId ?? null); // For steps, caseId is the parent; unused for cases/suites.
            setRenameName(contextMenu.name);
            closeContextMenu();
        }
    };

    const submitRename = () => {
        if (renameId && renameName.trim()) {
            if (renameType === 'step' && renameParentId && onRenameTestStep) {
                onRenameTestStep(renameParentId, renameId, renameName.trim());
            } else if (renameType === 'case' && onRenameTestCase) {
                onRenameTestCase(renameId, renameName.trim());
            } else if (renameType === 'suite' && onRenameSuite) {
                onRenameSuite(renameId, renameName.trim());
            }
        }
        setRenameId(null);
        setRenameType(null);
        setRenameParentId(null);
        setRenameName('');
    };

    const cancelRename = () => {
        setRenameId(null);
        setRenameType(null);
        setRenameParentId(null);
        setRenameName('');
    };

    // C (global suites): the `+` button opens the suite-name input directly —
    // there is no owning project to pick (suites are global). The old
    // project-picker menu is gone.
    const openAddSuite = () => {
        const count = (testSuites ?? projects.flatMap(p => p.testSuites || [])).length;
        setNewSuiteName(`TestSuite ${count + 1}`);
        setIsAddingSuite(true);
    };

    const submitNewSuite = () => {
        if (newSuiteName.trim()) {
            onAddSuite(undefined, newSuiteName.trim());
            setIsAddingSuite(false);
            setNewSuiteName('');
        } else {
            setIsAddingSuite(false);
            setNewSuiteName('');
        }
    };

    const cancelNewSuite = () => {
        setIsAddingSuite(false);
        setNewSuiteName('');
    };

    // Global suites when provided (the single source of truth); otherwise fall
    // back to the per-project suites (component tests without a provider).
    const effectiveSuites: TestSuite[] = testSuites
        ?? Array.from(new Map(projects.flatMap(p => (p.testSuites || []).map(s => [s.id, s]))).values());
    const allSuites: FlatSuite[] = effectiveSuites.map(suite => ({ suite, projectName: '' }));

    // Two-click confirm for the RIGHT-CLICK menu (the only delete entry point):
    // the first click arms `deleteConfirm` and the menu stays open
    // (label → "Click again to delete"); the second click deletes and closes.
    const menuDelete = (targetId: string, handler: (id: string) => void) => {
        const wasArmed = deleteConfirm === targetId;
        // The handler does the two-click work: arms on click 1, deletes on click 2.
        handler(targetId);
        // Only close after the delete actually happened (the armed click).
        if (wasArmed) closeContextMenu();
    };

    // The suite the (open) context menu targets — gates the menu's Run action
    // on it having cases, matching the inline-button gating.
    const menuSuite = contextMenu?.type === 'suite'
        ? effectiveSuites.find(s => s.id === contextMenu.suiteId)
        : undefined;

    // Right-click import/export items (suite: Export Suite / Import Suite /
    // Import Test Case; case: Export Test Case). Each item renders only when
    // its handler is wired (isolated component tests omit the handlers), and
    // an empty section is never rendered.
    const suiteFileItems: CtxMenuItem[] = contextMenu?.type === 'suite' && contextMenu.suiteId
        ? [
            ...(onExportSuite ? [{ icon: Download, label: 'Export Suite', onClick: () => { onExportSuite(contextMenu.suiteId!); closeContextMenu(); } }] : []),
            ...(onImportSuite ? [{ icon: FolderOpen, label: 'Import Suite', onClick: () => { onImportSuite(); closeContextMenu(); } }] : []),
            ...(onImportTestCase ? [{ icon: FileText, label: 'Import Test Case', onClick: () => { onImportTestCase(contextMenu.suiteId!); closeContextMenu(); } }] : []),
        ]
        : [];
    const caseFileItems: CtxMenuItem[] = contextMenu?.type === 'case' && contextMenu.caseId
        ? [
            ...(onExportTestCase ? [{ icon: Download, label: 'Export Test Case', onClick: () => { onExportTestCase(contextMenu.caseId!); closeContextMenu(); } }] : []),
        ]
        : [];


    return (
        <>
            <TestsContainer>
                {/* Header */}
                <SidebarHeader>
                    <SidebarHeaderTitle>
                        Test Suites ({allSuites.length})
                    </SidebarHeaderTitle>
                    <SidebarHeaderActions>
                        <HeaderActions>
                            <Tooltip content="Add Test Suite">
                              <HeaderButton ref={addSuiteBtnRef} onClick={openAddSuite}>
                                <Plus size={16} />
                              </HeaderButton>
                            </Tooltip>
                        </HeaderActions>
                    </SidebarHeaderActions>
                </SidebarHeader>

                <TestsContent>

                    {/* Inline Suite Name Input */}
                    {isAddingSuite && (
                        <AddSuiteRow>
                            <InlineFormInput
                                autoFocus
                                placeholder="Suite Name"
                                value={newSuiteName}
                                onChange={e => setNewSuiteName(e.target.value)}
                                onBlur={submitNewSuite}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') submitNewSuite();
                                    if (e.key === 'Escape') cancelNewSuite();
                                }}
                                style={{ width: '100%' }}
                            />
                        </AddSuiteRow>
                    )}

                    {/* Empty State */}
                    {allSuites.length === 0 && (
                        <EmptyState
                            icon={FlaskConical}
                            title="No test suites yet."
                            description="Click + to add a test suite."
                        />
                    )}

                    {/* Unique Test Suites List — C (global suites): render the
                        effective (global-first) list, not raw per-project. */}
                    {allSuites.map(({ suite }) => {
                        const isSuiteSelected = selectedTestSuite?.id === suite.id && !selectedTestCase;
                        const hasCases = (suite.testCases || []).length > 0;
                        return (
                            <div key={suite.id}>
                                {/* Suite Header */}
                                <SuiteOperationItem
                                    $active={isSuiteSelected}
                                    onClick={() => {
                                        // Notify parent - let context handle state
                                        onSelectSuite(suite.id);
                                    }}
                                    onContextMenu={(e) => handleContextMenu(e, suite.name, 'suite', undefined, undefined, suite.id)}
                                >
                                    <SuiteToggle
                                        $hasChildren={hasCases}
                                        onClick={hasCases ? (e) => { e.stopPropagation(); onToggleSuiteExpand(suite.id); } : undefined}
                                    >
                                        {hasCases && (suite.expanded !== false ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                                    </SuiteToggle>
                                    <SuiteIcon>
                                        <ListChecks size={14} />
                                    </SuiteIcon>
                                    {renameId === suite.id ? (
                                        <InlineFormInput
                                            type="text"
                                            title="Rename test suite"
                                            placeholder="Rename"
                                            value={renameName}
                                            onChange={(e) => setRenameName(e.target.value)}
                                            onBlur={submitRename}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') submitRename();
                                                if (e.key === 'Escape') cancelRename();
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            autoFocus
                                        />
                                    ) : (
                                        <SuiteName title="Right-click for suite actions">{suite.name}</SuiteName>
                                    )}
                                    <SuiteCount>
                                        ({suite.testCases?.length || 0})
                                    </SuiteCount>
                                    {isSuiteSelected && hasCases && (
                                        <Tooltip content="Run Suite">
                                          <HeaderButton onClick={(e) => { e.stopPropagation(); onRunSuite(suite.id); }}>
                                            <Play size={12} />
                                          </HeaderButton>
                                        </Tooltip>
                                    )}
                                </SuiteOperationItem>

                                {/* Test Cases */}
                                {suite.expanded !== false && (suite.testCases || []).map(tc => {
                                    const isSelected = selectedTestCase?.id === tc.id;
                                    const hasSteps = (tc.steps || []).length > 0;
                                    return (
                                        <React.Fragment key={tc.id}>
                                            <CaseRequestItem
                                                $active={isSelected}
                                                onClick={() => {
                                                    // Notify parent - let context handle state
                                                    onSelectTestCase(tc.id);
                                                }}
                                                onContextMenu={(e) => handleContextMenu(e, tc.name, 'case', tc.id)}
                                            >
                                                <CaseToggle
                                                    $hasChildren={hasSteps}
                                                    onClick={hasSteps ? (e) => { e.stopPropagation(); onToggleCaseExpand(tc.id); } : undefined}
                                                >
                                                    {hasSteps && (tc.expanded !== false ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                                                </CaseToggle>
                                                {renameId === tc.id ? (
                                                    <InlineFormInput
                                                        type="text"
                                                        title="Rename test case"
                                                        placeholder="Rename"
                                                        value={renameName}
                                                        onChange={(e) => setRenameName(e.target.value)}
                                                        onBlur={submitRename}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') submitRename();
                                                            if (e.key === 'Escape') cancelRename();
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <CaseName title="Right-click to rename">{tc.name}</CaseName>
                                                )}
                                                <CaseCount>
                                                    {tc.steps?.length || 0}
                                                </CaseCount>
                                            </CaseRequestItem>

                                            {/* Test Steps */}
                                            {tc.expanded !== false && (tc.steps || []).map(step => {
                                                // 'workflow' steps can reference a workflow — when it exists and has
                                                // steps, the row gets a chevron and the referenced workflow's steps
                                                // render nested below (read-only).
                                                const referencedWorkflow = step.type === 'workflow'
                                                    ? (workflows || []).find(w => w.id === step.config?.workflowId)
                                                    : undefined;
                                                const wfSubSteps = referencedWorkflow?.steps || [];
                                                const hasWfSubSteps = step.type === 'workflow' && wfSubSteps.length > 0;
                                                const isWfExpanded = expandedWfStepIds.has(step.id);
                                                return (
                                                    <React.Fragment key={step.id}>
                                                        <StepItem
                                                            $active={selectedStepId === step.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedStepId(step.id);
                                                                // Also select the parent case if we want context, but usually explicit step selection is enough
                                                                // if (selectedCaseId !== tc.id) setSelectedCaseId(tc.id);
                                                                if (onSelectTestStep) onSelectTestStep(tc.id, step.id);
                                                            }}
                                                            onContextMenu={(e) => handleContextMenu(e, step.name, 'step', tc.id, step.id)}
                                                        >
                                                            {renameId === step.id ? (
                                                                <InlineFormInput
                                                                    type="text"
                                                                    title="Rename test step"
                                                                    placeholder="Rename"
                                                                    value={renameName}
                                                                    onChange={(e) => setRenameName(e.target.value)}
                                                                    onBlur={submitRename}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') submitRename();
                                                                        if (e.key === 'Escape') cancelRename();
                                                                    }}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    autoFocus
                                                                    style={{ marginLeft: '4px', fontSize: '0.9em' }}
                                                                />
                                                            ) : (
                                                                <>
                                                                    {stepStatusSlot(testExecution?.[tc.id]?.[step.id])}
                                                                    <WfStepToggle
                                                                        $hasChildren={hasWfSubSteps}
                                                                        title={hasWfSubSteps ? (isWfExpanded ? 'Collapse workflow steps' : 'Expand workflow steps') : undefined}
                                                                        onClick={hasWfSubSteps ? (e) => { e.stopPropagation(); toggleWfStepExpand(step.id); } : undefined}
                                                                    >
                                                                        {hasWfSubSteps && (isWfExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                                                                    </WfStepToggle>
                                                                    <StepTypeIcon>
                                                                        {(() => {
                                                                            switch (step.type) {
                                                                                case 'delay': return <Clock size={12} />;
                                                                                case 'transfer': return <ArrowRight size={12} />;
                                                                                case 'script': return <FileCode size={12} />;
                                                                                case 'request':
                                                                                default: return <FileText size={12} />;
                                                                            }
                                                                        })()}
                                                                    </StepTypeIcon>
                                                                    <StepName title="Right-click to rename">
                                                                        {step.name}
                                                                    </StepName>
                                                                    {step.type === 'workflow' && referencedWorkflow && (
                                                                        <StepWfName title={`Runs workflow: ${referencedWorkflow.name}`}>
                                                                            {referencedWorkflow.name}
                                                                        </StepWfName>
                                                                    )}
                                                                </>
                                                            )}
                                                        </StepItem>

                                                        {/* Nested workflow steps (read-only preview of the
                                                            referenced workflow; edit in the WORKFLOWS view).
                                                            Clicking one selects the parent workflow step. */}
                                                        {isWfExpanded && referencedWorkflow && wfSubSteps.map(ws => (
                                                            <WorkflowSubStepItem
                                                                key={ws.id}
                                                                $active={selectedStepId === step.id}
                                                                title={`${ws.name} — edit in the WORKFLOWS view`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedStepId(step.id);
                                                                    if (onSelectTestStep) onSelectTestStep(tc.id, step.id);
                                                                }}
                                                            >
                                                                {subStepStatusSlot(testExecution?.[tc.id]?.[step.id]?.workflowSteps?.[ws.id])}
                                                                <StepTypeIcon>
                                                                    {workflowSubStepIcon(ws.type)}
                                                                </StepTypeIcon>
                                                                <StepName>{ws.name}</StepName>
                                                            </WorkflowSubStepItem>
                                                        ))}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        );
                    })}
                </TestsContent>
            </TestsContainer>

            {/* Context Menu — suites: run/rename/add-case/delete + import/export;
                cases: run/rename/delete + export; steps: rename. Menu deletes
                are deliberate (force) — the 2-click confirm is reserved for the
                inline buttons. */}
            {contextMenu && (
                <SidebarContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    sections={
                        contextMenu.type === 'suite' && contextMenu.suiteId ? [
                            {
                                title: 'Suite',
                                items: [
                                    ...(menuSuite && (menuSuite.testCases?.length || 0) > 0
                                        ? [{ icon: Play, label: 'Run Suite', onClick: () => { onRunSuite(contextMenu.suiteId!); closeContextMenu(); } }]
                                        : []),
                                    { icon: Pencil, label: 'Rename', onClick: handleRenameFromMenu },
                                    { icon: Plus, label: 'Add Test Case', onClick: () => { onAddTestCase(contextMenu.suiteId!); closeContextMenu(); } },
                                    { icon: Trash2, label: deleteConfirm === contextMenu.suiteId ? 'Click again to delete' : 'Delete', danger: deleteConfirm === contextMenu.suiteId, onClick: () => menuDelete(contextMenu.suiteId!, onDeleteSuite) }
                                ]
                            },
                            ...(suiteFileItems.length > 0 ? [{ title: 'Import / Export', items: suiteFileItems }] : [])
                        ]
                        : contextMenu.type === 'case' && contextMenu.caseId ? [
                            {
                                title: 'Test Case',
                                items: [
                                    { icon: Play, label: 'Run Test Case', onClick: () => { onRunCase(contextMenu.caseId!); closeContextMenu(); } },
                                    { icon: Pencil, label: 'Rename', onClick: handleRenameFromMenu },
                                    { icon: Trash2, label: deleteConfirm === contextMenu.caseId ? 'Click again to delete' : 'Delete', danger: deleteConfirm === contextMenu.caseId, onClick: () => menuDelete(contextMenu.caseId!, onDeleteTestCase) }
                                ]
                            },
                            ...(caseFileItems.length > 0 ? [{ title: 'Import / Export', items: caseFileItems }] : [])
                        ]
                        : contextMenu.type === 'step' && contextMenu.caseId && contextMenu.stepId ? [
                            {
                                title: 'Test Step',
                                items: [
                                    { icon: Pencil, label: 'Rename', onClick: handleRenameFromMenu },
                                    { icon: Trash2, label: deleteConfirm === contextMenu.stepId ? 'Click again to delete' : 'Delete', danger: deleteConfirm === contextMenu.stepId, onClick: () => menuDelete(contextMenu.stepId!, () => onDeleteTestStep?.(contextMenu.caseId!, contextMenu.stepId!)) }
                                ]
                            }
                        ]
                        : [{ title: 'Actions', items: [{ icon: Pencil, label: 'Rename', onClick: handleRenameFromMenu }] }
                    ] as CtxMenuSection[]}
                    onClose={closeContextMenu}
                />
            )}
        </>
    );
};
