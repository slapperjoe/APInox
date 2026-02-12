import React, { useState } from 'react';
import styled from 'styled-components';
import { Play, Plus, FileCode, Loader2, ArrowUp, ArrowDown, Trash2, ListChecks, CheckCircle, XCircle } from 'lucide-react';
import { TestCase, TestStep, TestStepType } from '@shared/models';
import { ToolbarButton, IconButton, RunButton } from '../../styles/WorkspaceLayout.styles';
import { ContextHelpButton } from '../ContextHelpButton';
import { EmptyState } from '../common/EmptyState';
import { SPACING_XS, SPACING_SM, SPACING_MD, SPACING_LG, SPACING_XL } from '../../styles/spacing';

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
    
    /* Spin animation for loader icon */
    .spin {
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
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
    // Optional: For displaying workflow/request names
    workflows?: Array<{ id: string; name: string }>;
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
    workflows,
    // projects // Unused
}) => {
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
                    <ToolbarButton onClick={() => onAddStep(testCase.id, 'workflow')}>
                        <ListChecks size={14} /> Add Workflow
                    </ToolbarButton>
                </StepsToolbar>
            )}

            <StepsSection>
                <StepsTitle>Steps</StepsTitle>
                <StepsList>
                    {testCase.steps.map((step, index) => {
                        const status = testExecution && testExecution[testCase.id] && testExecution[testCase.id][step.id];
                        const isConfirming = deleteConfirm === step.id;
                        return (
                            <StepRow
                                key={step.id}
                                $clickable={step.type === 'request' || step.type === 'delay' || step.type === 'script' || step.type === 'workflow'}
                                onClick={() => {
                                    if (onSelectStep) {
                                        onSelectStep(step);
                                    } else if (step.type === 'request' && step.config.request && onOpenStepRequest) {
                                        onOpenStepRequest(step.config.request);
                                    }
                                }}
                            >
                                <StepIndex>
                                    <StepIndexNumber>{index + 1}.</StepIndexNumber>
                                    {status?.status === 'running' && (
                                        <StepStatusRunning title="Running...">
                                            <Loader2 size={16} className="spin" />
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
                                    {step.type === 'request' && step.config.request && (
                                        <StepMeta>
                                            {step.config.request.name || `${step.config.request.method || 'POST'} ${step.config.request.endpoint || 'No Endpoint'}`}
                                        </StepMeta>
                                    )}
                                    {step.type === 'delay' && (
                                        <DelayMeta>
                                            Delay: {step.config.delayMs || 0} ms
                                        </DelayMeta>
                                    )}
                                    {step.type === 'workflow' && (
                                        <StepMeta>
                                            Workflow: {workflows?.find(w => w.id === step.config.workflowId)?.name || step.config.workflowId || 'Not configured'}
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
                                    {status?.response?.rawResponse !== undefined && (
                                        <StepStatWide title="Response Size">
                                            {(status.response.rawResponse.length / 1024).toFixed(2)} KB
                                        </StepStatWide>
                                    )}

                                    {onMoveStep && (
                                        <>
                                            <IconButton
                                                onClick={(e) => { e.stopPropagation(); onMoveStep(step.id, 'up'); }}
                                                title="Move Up"
                                                disabled={index === 0}
                                            >
                                                <ArrowUp size={14} />
                                            </IconButton>
                                            <IconButton
                                                onClick={(e) => { e.stopPropagation(); onMoveStep(step.id, 'down'); }}
                                                title="Move Down"
                                                disabled={index === testCase.steps.length - 1}
                                            >
                                                <ArrowDown size={14} />
                                            </IconButton>
                                        </>
                                    )}

                                    {onDeleteStep && (
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
                                            title={isConfirming ? "Click to Confirm Delete" : "Delete Step"}
                                        >
                                            <Trash2 size={14} />
                                        </DeleteStepButton>
                                    )}
                                </StepActions>
                            </StepRow>
                        );
                    })}
                </StepsList>
            </StepsSection>
        </ViewContainer>
    );
};

export { EmptyTestCase };
