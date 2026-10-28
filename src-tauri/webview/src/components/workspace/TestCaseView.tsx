import React, { useState } from 'react';
import styled from 'styled-components';
import { Play, Plus, FileCode, ArrowUp, ArrowDown, Trash2, ListChecks, CheckCircle, XCircle, Clock, FileText, GitBranch, RefreshCw, ChevronDown, ChevronRight, Minus } from 'lucide-react';
import { TestCase, TestStep, TestStepType } from '@shared/models';
import { ToolbarButton, IconButton, RunButton } from '../../styles/WorkspaceLayout.styles';
import { ContextHelpButton } from '../ContextHelpButton';
import { EmptyState } from '../common/EmptyState';
import { Spinner } from '../common/Spinner';
import { Tooltip } from '../common/Tooltip';
import { VariablesEditor } from './VariablesEditor';
import { SPACING_XS, SPACING_SM, SPACING_MD, SPACING_LG, SPACING_XL, SPACING_3XL } from '../../styles/spacing';

// Empty state component
interface EmptyTestCaseProps {
    onCreateTestSuite?: (projectName: string) => void;
    projectName?: string;
}

const EmptyTestCaseContainer = styled.div`
    position: relative;
    flex: 1;
`;

const EmptyHelp = styled.div`
    position: absolute;
    top: ${SPACING_SM};
    right: ${SPACING_SM};
    z-index: 1;
`;

const ViewContainer = styled.div`
    padding: ${SPACING_XL};
    flex: 1;
    overflow: auto;
    color: var(--apinox-editor-foreground);
    font-family: var(--apinox-font-family);
`;

const HeaderRow = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const HeaderActions = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
`;

const StepsToolbar = styled.div`
    padding: ${SPACING_SM} 0;
    border-bottom: 1px solid var(--apinox-panel-border);
    display: flex;
    gap: ${SPACING_SM};
`;

const VariablesRow = styled.div`
    padding: ${SPACING_MD} 0;
    border-bottom: 1px solid var(--apinox-panel-border);
`;

const StepsSection = styled.div`
    margin-top: ${SPACING_XL};
`;

const StepsTitle = styled.h2`
    border-bottom: 1px solid var(--apinox-panel-border);
    padding-bottom: ${SPACING_XS};
`;

const StepsList = styled.ul`
    list-style: none;
    padding: 0;
    margin: 0;
`;

const StepRow = styled.li<{ $clickable: boolean }>`
    padding: ${SPACING_SM};
    border-bottom: 1px solid var(--apinox-panel-border);
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    cursor: ${props => props.$clickable ? 'pointer' : 'default'};
    background-color: var(--apinox-list-hoverBackground);
`;

const StepIndex = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_XS};
    min-width: 48px;
`;

const StepIndexNumber = styled.span`
    opacity: 0.7;
    min-width: 24px;
    display: inline-flex;
    justify-content: center;
`;

const StepStatusRunning = styled.div`
    color: var(--apinox-testing-iconQueued);
    display: inline-flex;
    align-items: center;
`;

const StepStatusPass = styled.div`
    color: var(--apinox-testing-iconPassed);
`;

const StepStatusFail = styled.div`
    color: var(--apinox-testing-iconFailed);
`;

const StepContent = styled.div`
    flex: 1;
`;

const StepType = styled.span`
    opacity: 0.7;
`;

const StepMeta = styled.div`
    font-size: 0.8em;
    opacity: 0.6;
`;

const DelayMeta = styled(StepMeta)`
    color: var(--apinox-textLink-foreground);
`;

const ErrorText = styled.div`
    color: var(--apinox-errorForeground);
    font-size: 0.8em;
`;

const StepActions = styled.div`
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: ${SPACING_XS};
    font-size: 0.8em;
    opacity: 0.9;
`;

const StepStat = styled.span`
    margin-right: ${SPACING_XS};
`;

const StepStatWide = styled.span`
    margin-right: ${SPACING_SM};
`;

const DeleteStepButton = styled(IconButton)`
    margin-left: ${SPACING_XS};
`;

// Chevron slot on a step row — expands the referenced case's steps
// (read-only; edit them in the TESTS view). Rendered on every row (empty when
// there's nothing to expand) so the step-number column stays aligned across rows.
const WfStepToggle = styled.button<{ $hasChildren?: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    flex-shrink: 0;
    border: none;
    background: transparent;
    color: inherit;
    opacity: 0.7;
    cursor: ${props => (props.$hasChildren ? 'pointer' : 'default')};

    /* Larger hit area so a click expands instead of selecting/editing the step. */
    &:hover {
        background: ${props => (props.$hasChildren ? 'var(--apinox-button-hoverBackground)' : 'transparent')};
        border-radius: 2px;
    }
`;

// A step of the test case referenced by an expanded 'testCase' step —
// shows the live per-step result (running / passed / failed / skipped).
const WfSubStepRow = styled.li`
    padding: 4px ${SPACING_SM} 4px ${SPACING_3XL};
    border-bottom: 1px solid var(--apinox-panel-border);
    display: flex;
    align-items: center;
    gap: ${SPACING_XS};
    font-size: 0.85em;
    opacity: 0.85;
    background-color: var(--apinox-list-hoverBackground);

    &:hover {
        opacity: 1;
    }
`;

const WfSubStepName = styled.span`
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const WfSubStepError = styled.span`
    color: var(--apinox-errorForeground);
    opacity: 1;
    font-size: 0.9em;
`;

const WfSubStepDuration = styled.span`
    opacity: 0.5;
    white-space: nowrap;
`;

const EmptyTestCase: React.FC<EmptyTestCaseProps> = ({ onCreateTestSuite, projectName }) => (
    <EmptyTestCaseContainer>
        <EmptyHelp>
            <ContextHelpButton sectionId="test-suite" />
        </EmptyHelp>
        <EmptyState
            icon={ListChecks}
            title="No Test Case Selected"
            description="Select a test case from the sidebar or create a new test suite."
        >
            {onCreateTestSuite && projectName && (
                <ToolbarButton onClick={() => onCreateTestSuite(projectName)}>
                    <Plus size={16} /> Create Test Suite
                </ToolbarButton>
            )}
        </EmptyState>
    </EmptyTestCaseContainer>
);

export interface TestExecutionStatus {
    status?: 'running' | 'pass' | 'fail';
    error?: string;
    response?: {
        duration?: number;
        rawResponse?: string;
    };
    /** Live per-nested-step results, keyed by the nested step's id (sub-steps
        of a loop body or an expanded referenced case). */
    workflowSteps?: Record<string, {
        status: 'running' | 'pass' | 'fail' | 'skipped';
        name?: string;
        error?: string;
        response?: any;
        durationMs?: number;
    }>;
}

export interface TestCaseViewProps {
    testCase: TestCase;
    testExecution?: Record<string, Record<string, TestExecutionStatus>>;
    onRunTestCase?: (testCaseId: string) => void;
    onAddStep?: (testCaseId: string, stepType: TestStepType) => void;
    onSelectStep?: (step: TestStep) => void;
    onMoveStep?: (stepId: string, direction: 'up' | 'down') => void;
    onDeleteStep?: (stepId: string) => void;
    /** @deprecated Use onSelectStep */
    onOpenStepRequest?: (request: any) => void;
    /** Commit this case's variables (case-level {{name}} values). When
        provided, a variable editor is shown above the steps. */
    onUpdateVariables?: (variables: Record<string, string>) => void;
    /** Global test cases, for resolving a 'testCase' step's referenced case
        (label + read-only nested steps preview). */
    testCases?: Array<{ id: string; name: string; steps?: TestStep[] }>;
    projects?: Array<any>;
}

/**
 * Displays a test case with its list of steps and execution controls.
 */
export const TestCaseView: React.FC<TestCaseViewProps> = ({
    testCase,
    testExecution,
    onRunTestCase,
    onAddStep,
    onSelectStep,
    onMoveStep,
    onDeleteStep,
    onOpenStepRequest,
    onUpdateVariables,
    testCases,
    // projects // Unused
}) => {
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    // A 'testCase' step is expandable in place: manually via the chevron, and
    // automatically once a run has touched the step (so per-request results
    // are visible right after a run). Collapsing after a run is remembered.
    const [expandedWfStepIds, setExpandedWfStepIds] = useState<Set<string>>(new Set());
    const [collapsedWfStepIds, setCollapsedWfStepIds] = useState<Set<string>>(new Set());

    const wfStepIcon = (type: string) => {
        switch (type) {
            case 'delay': return <Clock size={12} />;
            case 'script': return <FileCode size={12} />;
            case 'condition': return <GitBranch size={12} />;
            case 'loop': return <RefreshCw size={12} />;
            case 'testCase': return <ListChecks size={12} />;
            case 'request':
            default: return <FileText size={12} />;
        }
    };

    const isWfExpanded = (stepId: string, hasStatus: boolean) =>
        !collapsedWfStepIds.has(stepId) && (hasStatus || expandedWfStepIds.has(stepId));

    const toggleWfExpand = (stepId: string, hasStatus: boolean) => {
        if (isWfExpanded(stepId, hasStatus)) {
            setCollapsedWfStepIds(prev => new Set(prev).add(stepId));
            setExpandedWfStepIds(prev => { const next = new Set(prev); next.delete(stepId); return next; });
        } else {
            setExpandedWfStepIds(prev => new Set(prev).add(stepId));
            setCollapsedWfStepIds(prev => { const next = new Set(prev); next.delete(stepId); return next; });
        }
    };

    return (
        <ViewContainer>
            <HeaderRow>
                <h1>Test Case: {testCase.name}</h1>
                <HeaderActions>
                    <ContextHelpButton sectionId="test-suite" />
                    <RunButton onClick={() => onRunTestCase && onRunTestCase(testCase.id)}>
                        <Play size={14} /> Run Test Case
                    </RunButton>
                </HeaderActions>
            </HeaderRow>

            {onAddStep && (
                <StepsToolbar>
                    <ToolbarButton onClick={() => onAddStep(testCase.id, 'delay')}>
                        <Plus size={14} /> Add Delay
                    </ToolbarButton>
                    <ToolbarButton onClick={() => onAddStep(testCase.id, 'request')}>
                        <FileCode size={14} /> Add Request
                    </ToolbarButton>
                    <ToolbarButton onClick={() => onAddStep(testCase.id, 'script')}>
                        <FileCode size={14} /> Add Script
                    </ToolbarButton>
                    <ToolbarButton onClick={() => onAddStep(testCase.id, 'condition')}>
                        <GitBranch size={14} /> Add Condition
                    </ToolbarButton>
                    <ToolbarButton onClick={() => onAddStep(testCase.id, 'loop')}>
                        <RefreshCw size={14} /> Add Loop
                    </ToolbarButton>
                    <ToolbarButton onClick={() => onAddStep(testCase.id, 'testCase')}>
                        <ListChecks size={14} /> Add Test Case
                    </ToolbarButton>
                </StepsToolbar>
            )}

            {onUpdateVariables && (
                <VariablesRow>
                    <VariablesEditor
                        variables={testCase.variables}
                        onChange={onUpdateVariables}
                        hint="Reusable name→value pairs available to every step in this case as {{name}} — scoped to this case only. A case variable overrides the suite's variables and the active environment."
                    />
                </VariablesRow>
            )}

            <StepsSection>
                <StepsTitle>Steps</StepsTitle>
                <StepsList>
                    {testCase.steps.map((step, index) => {
                        const status = testExecution && testExecution[testCase.id] && testExecution[testCase.id][step.id];
                        const isConfirming = deleteConfirm === step.id;
                        // 'testCase' step: resolve the referenced global case so
                        // its steps preview the same way (read-only).
                        const referencedCase = step.type === 'testCase'
                            ? (testCases || []).find(c => c.id === step.config?.testCaseId)
                            : undefined;
                        const nestedSteps: Array<{ id: string; name: string; type: string }> =
                            step.type === 'testCase'
                                ? (referencedCase?.steps || []).map(ts => ({ id: ts.id, name: ts.name, type: ts.type }))
                                : [];
                        const hasNestedSteps = nestedSteps.length > 0;
                        const wfExpanded = hasNestedSteps && isWfExpanded(step.id, !!status);
                        return (
                            <React.Fragment key={step.id}>
                            <StepRow
                                $clickable={step.type === 'request' || step.type === 'delay' || step.type === 'script' || step.type === 'condition' || step.type === 'loop' || step.type === 'testCase'}
                                onClick={() => {
                                    if (onSelectStep) {
                                        onSelectStep(step);
                                    } else if (step.type === 'request' && step.config?.request && onOpenStepRequest) {
                                        onOpenStepRequest(step.config.request);
                                    }
                                }}
                            >
                                {hasNestedSteps ? (
                                    <Tooltip content={wfExpanded ? 'Collapse test case steps' : 'Expand test case steps'}>
                                        <WfStepToggle
                                            $hasChildren={hasNestedSteps}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleWfExpand(step.id, !!status);
                                            }}
                                        >
                                            {wfExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </WfStepToggle>
                                    </Tooltip>
                                ) : (
                                    <WfStepToggle $hasChildren={hasNestedSteps} />
                                )}
                                <StepIndex>
                                    <StepIndexNumber>{index + 1}.</StepIndexNumber>
                                    {status?.status === 'running' && (
                                        <StepStatusRunning title="Running...">
                                            <Spinner size={16} />
                                        </StepStatusRunning>
                                    )}
                                    {status?.status === 'pass' && (
                                        <StepStatusPass title="Passed">
                                            <CheckCircle size={16} />
                                        </StepStatusPass>
                                    )}
                                    {status?.status === 'fail' && (
                                        <StepStatusFail title="Failed">
                                            <XCircle size={16} />
                                        </StepStatusFail>
                                    )}
                                </StepIndex>
                                <StepContent>
                                    <strong>{step.name}</strong> <StepType>({step.type})</StepType>
                                    {step.type === 'request' && step.config?.request && (
                                        <StepMeta>
                                            {step.config.request.name || `${step.config.request.method || 'POST'} ${step.config.request.endpoint || 'No Endpoint'}`}
                                        </StepMeta>
                                    )}
                                    {step.type === 'delay' && (
                                        <DelayMeta>
                                            Delay: {step.config?.delayMs || 0} ms
                                        </DelayMeta>
                                    )}
                                    {step.type === 'condition' && (
                                        <StepMeta>{step.config?.condition?.expression || 'No condition configured'}</StepMeta>
                                    )}
                                    {step.type === 'loop' && (
                                        <StepMeta>
                                            {step.config?.loop
                                                ? `${step.config.loop.type === 'count' ? (step.config.loop.count ?? 0) + 'x' : step.config.loop.type} · ${step.config?.loopSteps?.length || 0} steps`
                                                : 'No loop configured'}
                                        </StepMeta>
                                    )}
                                    {step.type === 'testCase' && (
                                        <StepMeta>
                                            Test Case: {testCases?.find(c => c.id === step.config?.testCaseId)?.name || step.config?.testCaseId || 'Not configured'}
                                        </StepMeta>
                                    )}
                                    {status?.error && (
                                        <ErrorText>Error: {status.error}</ErrorText>
                                    )}
                                </StepContent>
                                <StepActions>
                                    {status?.response?.duration !== undefined && (
                                        <StepStat title="Execution time">
                                            {status.response.duration < 1 
                                                ? `${(status.response.duration * 1000).toFixed(0)}ms`
                                                : `${status.response.duration.toFixed(2)}s`
                                            }
                                        </StepStat>
                                    )}
                                    {status?.response?.rawResponse != null && (
                                        <StepStatWide title="Response Size">
                                            {(status.response.rawResponse.length / 1024).toFixed(2)} KB
                                        </StepStatWide>
                                    )}

                                    {onMoveStep && (
                                        <>
                                            <Tooltip content="Move Up">
                                                <IconButton
                                                    onClick={(e) => { e.stopPropagation(); onMoveStep(step.id, 'up'); }}
                                                    disabled={index === 0}
                                                >
                                                    <ArrowUp size={14} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip content="Move Down">
                                                <IconButton
                                                    onClick={(e) => { e.stopPropagation(); onMoveStep(step.id, 'down'); }}
                                                    disabled={index === testCase.steps.length - 1}
                                                >
                                                    <ArrowDown size={14} />
                                                </IconButton>
                                            </Tooltip>
                                        </>
                                    )}

                                    {onDeleteStep && (
                                        <Tooltip content={isConfirming ? 'Click to Confirm Delete' : 'Delete Step'}>
                                            <DeleteStepButton
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isConfirming) {
                                                        onDeleteStep(step.id);
                                                        setDeleteConfirm(null);
                                                    } else {
                                                        setDeleteConfirm(step.id);
                                                        setTimeout(() => setDeleteConfirm(null), 2000);
                                                    }
                                                }}
                                                shake={isConfirming}
                                            >
                                                <Trash2 size={14} />
                                            </DeleteStepButton>
                                        </Tooltip>
                                    )}
                                </StepActions>
                            </StepRow>

                            {/* Nested test-case steps (read-only preview of the
                                referenced case; edit in the TESTS view).
                                Status icons reflect this run's per-step results. */}
                            {wfExpanded && nestedSteps.map(ws => {
                                const wsExec = status?.workflowSteps?.[ws.id];
                                return (
                                    <WfSubStepRow
                                        key={ws.id}
                                        title={`${ws.name} — edit in the TESTS view`}
                                    >
                                        {wsExec?.status === 'running' && (
                                            <StepStatusRunning title="Running...">
                                                <Spinner size={13} />
                                            </StepStatusRunning>
                                        )}
                                        {wsExec?.status === 'pass' && (
                                            <StepStatusPass title="Passed">
                                                <CheckCircle size={13} />
                                            </StepStatusPass>
                                        )}
                                        {wsExec?.status === 'fail' && (
                                            <StepStatusFail title="Failed">
                                                <XCircle size={13} />
                                            </StepStatusFail>
                                        )}
                                        {wsExec?.status === 'skipped' && (
                                            <span title="Skipped" style={{ opacity: 0.4, display: 'inline-flex' }}>
                                                <Minus size={13} />
                                            </span>
                                        )}
                                        {!wsExec && (
                                            <span style={{ width: 13, display: 'inline-flex' }} />
                                        )}
                                        <span style={{ opacity: 0.6, display: 'inline-flex', flexShrink: 0 }}>
                                            {wfStepIcon(ws.type)}
                                        </span>
                                        <WfSubStepName>{ws.name}</WfSubStepName>
                                        {wsExec?.error && (
                                            <WfSubStepError>{wsExec.error}</WfSubStepError>
                                        )}
                                        {typeof wsExec?.durationMs === 'number' && (
                                            <WfSubStepDuration>{wsExec.durationMs} ms</WfSubStepDuration>
                                        )}
                                    </WfSubStepRow>
                                );
                            })}
                            </React.Fragment>
                        );
                    })}
                </StepsList>
            </StepsSection>
        </ViewContainer>
    );
};

export { EmptyTestCase };
