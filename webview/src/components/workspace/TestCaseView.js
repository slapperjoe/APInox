import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Play, Plus, FileCode, Loader2, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { ToolbarButton, IconButton } from '../../styles/WorkspaceLayout.styles';
import { ContextHelpButton } from '../ContextHelpButton';
const EmptyTestCase = ({ onCreateTestSuite, projectName }) => (_jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--vscode-descriptionForeground)', padding: 20, textAlign: 'center', position: 'relative' }, children: [_jsx("div", { style: { position: 'absolute', top: 10, right: 10 }, children: _jsx(ContextHelpButton, { sectionId: "test-suite" }) }), _jsx("h2", { style: { marginBottom: 10, color: 'var(--vscode-foreground)' }, children: "No Test Case Selected" }), _jsx("p", { style: { marginBottom: 20 }, children: "Select a test case from the sidebar or create a new test suite." }), onCreateTestSuite && projectName && (_jsxs(ToolbarButton, { onClick: () => onCreateTestSuite(projectName), style: { fontSize: '1em', padding: '10px 20px' }, children: [_jsx(Plus, { size: 16 }), " Create Test Suite"] }))] }));
/**
 * Displays a test case with its list of steps and execution controls.
 */
export const TestCaseView = ({ testCase, testExecution, onRunTestCase, onAddStep, onSelectStep, onMoveStep, onDeleteStep, onOpenStepRequest }) => {
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    return (_jsxs("div", { style: { padding: 20, flex: 1, overflow: 'auto', color: 'var(--vscode-editor-foreground)', fontFamily: 'var(--vscode-font-family)' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsxs("h1", { children: ["Test Case: ", testCase.name] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10 }, children: [_jsx(ContextHelpButton, { sectionId: "test-suite" }), _jsxs(ToolbarButton, { onClick: () => onRunTestCase && onRunTestCase(testCase.id), style: { color: 'var(--vscode-testing-iconPassed)' }, children: [_jsx(Play, { size: 14 }), " Run Test Case"] })] })] }), onAddStep && (_jsxs("div", { style: { padding: '10px 0', borderBottom: '1px solid var(--vscode-panel-border)', display: 'flex', gap: 10 }, children: [_jsxs(ToolbarButton, { onClick: () => onAddStep(testCase.id, 'delay'), children: [_jsx(Plus, { size: 14 }), " Add Delay"] }), _jsxs(ToolbarButton, { onClick: () => onAddStep(testCase.id, 'request'), children: [_jsx(FileCode, { size: 14 }), " Add Request"] }), _jsxs(ToolbarButton, { onClick: () => onAddStep(testCase.id, 'script'), children: [_jsx(FileCode, { size: 14 }), " Add Script"] })] })), _jsxs("div", { style: { marginTop: 20 }, children: [_jsx("h2", { style: { borderBottom: '1px solid var(--vscode-panel-border)', paddingBottom: 5 }, children: "Steps" }), _jsx("ul", { style: { listStyle: 'none', padding: 0 }, children: testCase.steps.map((step, index) => {
                            const status = testExecution && testExecution[testCase.id] && testExecution[testCase.id][step.id];
                            const isConfirming = deleteConfirm === step.id;
                            return (_jsxs("li", { style: {
                                    padding: '10px',
                                    borderBottom: '1px solid var(--vscode-panel-border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    cursor: step.type === 'request' || step.type === 'delay' || step.type === 'script' ? 'pointer' : 'default',
                                    backgroundColor: 'var(--vscode-list-hoverBackground)'
                                }, onClick: () => {
                                    if (onSelectStep) {
                                        onSelectStep(step);
                                    }
                                    else if (step.type === 'request' && step.config.request && onOpenStepRequest) {
                                        onOpenStepRequest(step.config.request);
                                    }
                                }, children: [_jsxs("div", { style: { opacity: 0.7, width: 24, display: 'flex', justifyContent: 'center' }, children: [status?.status === 'running' && _jsx(Loader2, { size: 14, className: "spin" }), status?.status === 'pass' && _jsx("div", { style: { color: 'var(--vscode-testing-iconPassed)' }, children: "\u2714" }), status?.status === 'fail' && _jsx("div", { style: { color: 'var(--vscode-testing-iconFailed)' }, children: "\u2718" }), !status && _jsxs("span", { children: [index + 1, "."] })] }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("strong", { children: step.name }), " ", _jsxs("span", { style: { opacity: 0.7 }, children: ["(", step.type, ")"] }), step.type === 'request' && step.config.request && (_jsxs("div", { style: { fontSize: '0.8em', opacity: 0.6 }, children: [step.config.request.method || 'POST', " ", step.config.request.endpoint || 'No Endpoint'] })), step.type === 'delay' && (_jsxs("div", { style: { fontSize: '0.8em', opacity: 0.6, color: 'var(--vscode-textLink-foreground)' }, children: ["Delay: ", step.config.delayMs || 0, " ms"] })), status?.error && (_jsxs("div", { style: { color: 'var(--vscode-errorForeground)', fontSize: '0.8em' }, children: ["Error: ", status.error] }))] }), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8em', opacity: 0.9 }, children: [status?.response?.duration !== undefined && _jsxs("span", { title: "Duration", style: { marginRight: 5 }, children: [status.response.duration.toFixed(3), "s"] }), status?.response?.rawResponse !== undefined && _jsxs("span", { title: "Response Size", style: { marginRight: 10 }, children: [(status.response.rawResponse.length / 1024).toFixed(2), " KB"] }), onMoveStep && (_jsxs(_Fragment, { children: [_jsx(IconButton, { onClick: (e) => { e.stopPropagation(); onMoveStep(step.id, 'up'); }, title: "Move Up", disabled: index === 0, style: { opacity: index === 0 ? 0.3 : 1 }, children: _jsx(ArrowUp, { size: 14 }) }), _jsx(IconButton, { onClick: (e) => { e.stopPropagation(); onMoveStep(step.id, 'down'); }, title: "Move Down", disabled: index === testCase.steps.length - 1, style: { opacity: index === testCase.steps.length - 1 ? 0.3 : 1 }, children: _jsx(ArrowDown, { size: 14 }) })] })), onDeleteStep && (_jsx(IconButton, { onClick: (e) => {
                                                    e.stopPropagation();
                                                    if (isConfirming) {
                                                        onDeleteStep(step.id);
                                                        setDeleteConfirm(null);
                                                    }
                                                    else {
                                                        setDeleteConfirm(step.id);
                                                        setTimeout(() => setDeleteConfirm(null), 2000);
                                                    }
                                                }, style: {
                                                    color: isConfirming ? 'var(--vscode-errorForeground)' : 'inherit',
                                                    animation: isConfirming ? 'shake 0.5s' : 'none',
                                                    marginLeft: 5
                                                }, title: isConfirming ? "Click to Confirm Delete" : "Delete Step", children: _jsx(Trash2, { size: 14 }) }))] })] }, step.id));
                        }) })] })] }));
};
export { EmptyTestCase };
