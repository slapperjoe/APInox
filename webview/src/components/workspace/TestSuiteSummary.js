import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { ContextHelpButton } from '../ContextHelpButton';
import { ProjectContainer, StatsGridSpaced, StatCard, StatLabel, StatValue, SectionHeading, OperationsList, OperationItem, OperationRow, OperationMeta, ChevronIconFaint } from '../../styles/WorkspaceLayout.styles';
export const TestSuiteSummary = ({ suite, onSelectTestCase }) => {
    // Calculate total steps
    const totalSteps = suite.testCases.reduce((sum, tc) => sum + tc.steps.length, 0);
    return (_jsxs(ProjectContainer, { children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsxs("h1", { children: ["Test Suite: ", suite.name] }), _jsx(ContextHelpButton, { sectionId: "test-suite" })] }), _jsxs(StatsGridSpaced, { children: [_jsxs(StatCard, { children: [_jsx(StatLabel, { children: "Test Cases" }), _jsx(StatValue, { children: suite.testCases.length })] }), _jsxs(StatCard, { children: [_jsx(StatLabel, { children: "Total Steps" }), _jsx(StatValue, { children: totalSteps })] })] }), _jsx(SectionHeading, { children: "Test Cases" }), _jsx(OperationsList, { children: suite.testCases.map(tc => (_jsx(OperationItem, { onClick: () => onSelectTestCase && onSelectTestCase(tc), children: _jsxs(OperationRow, { children: [_jsxs("div", { children: [_jsx("span", { children: tc.name }), _jsxs(OperationMeta, { children: ["(", tc.steps.length, " step", tc.steps.length !== 1 ? 's' : '', ")"] })] }), _jsx(ChevronIconFaint, { size: 14 })] }) }, tc.id))) })] }));
};
