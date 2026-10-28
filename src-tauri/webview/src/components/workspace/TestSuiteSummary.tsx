import React from 'react';
import { ContextHelpButton } from '../ContextHelpButton';
import { VariablesEditor } from './VariablesEditor';
import {
    ProjectContainer, StatsGridSpaced, StatCard, StatLabel, StatValue,
    SectionHeading, OperationsList, OperationItem, OperationRow,
    OperationMeta, ChevronIconFaint
} from '../../styles/WorkspaceLayout.styles';

export const TestSuiteSummary: React.FC<{
    suite: import('@shared/models').TestSuite;
    onSelectTestCase?: (c: import('@shared/models').TestCase) => void;
    /** Commit this suite's variables (suite-level {{name}} values, shared by
        every case in the suite). When provided, a variable editor is shown. */
    onUpdateVariables?: (variables: Record<string, string>) => void;
    /** Rename a suite variable AND the references to it across every case in the suite.
        Returns how many references were rewritten. */
    onRenameVariable?: (from: string, to: string) => number;
}> = ({ suite, onSelectTestCase, onUpdateVariables, onRenameVariable }) => {
    // Calculate total steps
    const totalSteps = suite.testCases.reduce((sum, tc) => sum + tc.steps.length, 0);

    return (
        <ProjectContainer>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>Test Suite: {suite.name}</h1>
                <ContextHelpButton sectionId="test-suite" />
            </div>

            {/* Statistics Grid */}
            <StatsGridSpaced>
                <StatCard>
                    <StatLabel>Test Cases</StatLabel>
                    <StatValue>{suite.testCases.length}</StatValue>
                </StatCard>
                <StatCard>
                    <StatLabel>Total Steps</StatLabel>
                    <StatValue>{totalSteps}</StatValue>
                </StatCard>
            </StatsGridSpaced>

            {onUpdateVariables && (
                <div style={{ margin: '16px 0 8px' }}>
                    <VariablesEditor
                        variables={suite.variables}
                        onChange={onUpdateVariables}
                        onRenameVariable={onRenameVariable}
                        hint="Reusable name→value pairs shared by every case in this suite as {{name}}. A case's own variables override these; both override the active environment."
                    />
                </div>
            )}

            <SectionHeading>Test Cases</SectionHeading>
            <OperationsList>
                {suite.testCases.map(tc => (
                    <OperationItem
                        key={tc.id}
                        onClick={() => onSelectTestCase && onSelectTestCase(tc)}
                    >
                        <OperationRow>
                            <div>
                                <span>{tc.name}</span>
                                <OperationMeta>({tc.steps.length} step{tc.steps.length !== 1 ? 's' : ''})</OperationMeta>
                            </div>
                            <ChevronIconFaint size={14} />
                        </OperationRow>
                    </OperationItem>
                ))}
            </OperationsList>
        </ProjectContainer>
    );
};
