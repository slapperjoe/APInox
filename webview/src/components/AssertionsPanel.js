import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from 'react';
import styled from 'styled-components';
import { Trash2, CheckCircle2, XCircle, Clock, Play } from 'lucide-react';
import { StatusCodePicker } from './StatusCodePicker';
import Editor from '@monaco-editor/react';
import { ScriptPlaygroundModal } from './modals/ScriptPlaygroundModal';
const Container = styled.div `
    display: flex;
    flex-direction: column;
    padding: 10px;
    height: 100%;
    overflow-y: auto;
    background-color: var(--vscode-editor-background);
`;
const Toolbar = styled.div `
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
`;
const Button = styled.button `
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 4px 8px;
    border-radius: 2px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    &:hover { background: var(--vscode-button-hoverBackground); }
`;
const AssertionList = styled.div `
    display: flex;
    flex-direction: column;
    gap: 5px;
`;
const AssertionItem = styled.div `
    display: flex;
    align-items: center;
    padding: 8px;
    background: var(--vscode-list-hoverBackground);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    gap: 10px;
`;
const IconWrapper = styled.div `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
`;
const Details = styled.div `
    flex: 1;
    display: flex;
    flex-direction: column;
`;
const Title = styled.div `
    font-weight: bold;
`;
const ConfigText = styled.div `
    opacity: 0.8;
`;
const Input = styled.input `
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 2px 4px;
    margin-left: 5px;
`;
const Select = styled.select `
    background-color: var(--vscode-dropdown-background);
    color: var(--vscode-dropdown-foreground);
    border: 1px solid var(--vscode-dropdown-border);
    padding: 4px;
    outline: none;
    height: 26px;
    box-sizing: border-box;
    cursor: pointer;
    &:focus {
        border-color: var(--vscode-focusBorder);
    }
`;
function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
export const AssertionsPanel = ({ assertions, onChange, lastResult }) => {
    const [playgroundScript, setPlaygroundScript] = React.useState(null);
    const handleAdd = (type) => {
        const newAssertion = {
            id: generateId(),
            type,
            name: type,
            configuration: {}
        };
        // Set defaults
        if (type === 'Response SLA')
            newAssertion.configuration = { sla: '200' };
        if (type === 'Simple Contains')
            newAssertion.configuration = { token: '', ignoreCase: true };
        if (type === 'Simple Not Contains')
            newAssertion.configuration = { token: '', ignoreCase: true };
        if (type === 'XPath Match')
            newAssertion.configuration = { xpath: '', expectedContent: '' };
        if (type === 'SOAP Fault')
            newAssertion.configuration = { expectFault: false };
        if (type === 'HTTP Status')
            newAssertion.configuration = { expectedStatus: '200' };
        if (type === 'Script')
            newAssertion.configuration = { script: '// return true to pass, false to fail\n// Available: response, statusCode\nreturn response.includes("Success");' };
        onChange([...assertions, newAssertion]);
    };
    const handleRemove = (id) => {
        onChange(assertions.filter(a => a.id !== id));
    };
    const updateConfig = (id, key, value) => {
        onChange(assertions.map(a => {
            if (a.id === id) {
                return { ...a, configuration: { ...a.configuration, [key]: value } };
            }
            return a;
        }));
    };
    const getStatus = (id) => {
        if (!lastResult)
            return null;
        // console.log('Checking status for', id, 'in', lastResult);
        const res = lastResult.find(r => r.id === id);
        return res ? res.status : null;
    };
    return (_jsxs(Container, { children: [_jsx(Toolbar, { children: _jsxs(Select, { onChange: (e) => handleAdd(e.target.value), value: "", children: [_jsx("option", { value: "", disabled: true, style: { color: 'var(--vscode-dropdown-foreground)' }, children: "+ Add Assertion" }), _jsx("option", { value: "Simple Contains", children: "Contains" }), _jsx("option", { value: "Simple Not Contains", children: "Not Contains" }), _jsx("option", { value: "Response SLA", children: "Response SLA" }), _jsx("option", { value: "XPath Match", children: "XPath Match" }), _jsx("option", { value: "SOAP Fault", children: "SOAP Fault" }), _jsx("option", { value: "HTTP Status", children: "HTTP Status" }), _jsx("option", { value: "Script", children: "Script (JavaScript)" })] }) }), _jsxs(AssertionList, { children: [assertions.length === 0 && _jsx("div", { style: { opacity: 0.5, fontStyle: 'italic' }, children: "No assertions defined." }), assertions.map((a, i) => {
                        const status = getStatus(a.id || '');
                        return (_jsxs(AssertionItem, { children: [_jsx(IconWrapper, { title: status || 'Not Run', children: status === 'PASS' ? _jsx(CheckCircle2, { size: 18, color: "var(--vscode-testing-iconPassed)" }) :
                                        status === 'FAIL' ? _jsx(XCircle, { size: 18, color: "var(--vscode-testing-iconFailed)" }) :
                                            _jsx(Clock, { size: 18, style: { opacity: 0.5 } }) }), _jsxs(Details, { children: [_jsx(Title, { children: a.name || a.type }), _jsxs(ConfigText, { children: [(a.type === 'Simple Contains' || a.type === 'Simple Not Contains') && (_jsxs(_Fragment, { children: ["Token:", _jsx(Input, { value: a.configuration?.token || '', onChange: (e) => updateConfig(a.id, 'token', e.target.value), placeholder: "Text to check" }), _jsxs("label", { style: { marginLeft: 10 }, children: [_jsx("input", { type: "checkbox", checked: a.configuration?.ignoreCase, onChange: (e) => updateConfig(a.id, 'ignoreCase', e.target.checked) }), " Ignore Case"] })] })), a.type === 'Response SLA' && (_jsxs(_Fragment, { children: ["Limit (ms):", _jsx(Input, { type: "number", value: a.configuration?.sla || '', onChange: (e) => updateConfig(a.id, 'sla', e.target.value), style: { width: 60 } })] })), a.type === 'XPath Match' && (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 5 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center' }, children: [_jsx("span", { style: { minWidth: 60 }, children: "XPath:" }), _jsx(Input, { style: { flex: 1 }, value: a.configuration?.xpath || '', onChange: (e) => updateConfig(a.id, 'xpath', e.target.value), placeholder: "//ns:Node" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center' }, children: [_jsx("span", { style: { minWidth: 60 }, children: "Expected:" }), _jsx(Input, { style: { flex: 1 }, value: a.configuration?.expectedContent || '', onChange: (e) => updateConfig(a.id, 'expectedContent', e.target.value), placeholder: "Value" })] })] })), a.type === 'SOAP Fault' && (_jsxs(_Fragment, { children: [_jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: 5 }, children: [_jsx("input", { type: "checkbox", checked: a.configuration?.expectFault === true, onChange: (e) => updateConfig(a.id, 'expectFault', e.target.checked) }), "Expect Fault"] }), _jsxs("div", { style: { marginTop: 5, display: 'flex', alignItems: 'center' }, children: [_jsx("span", { style: { marginRight: 5 }, children: "Fault Code:" }), _jsx(Input, { value: a.configuration?.faultCode || '', onChange: (e) => updateConfig(a.id, 'faultCode', e.target.value), placeholder: "Optional (e.g. Client)", style: { width: 140 } })] })] })), a.type === 'HTTP Status' && (_jsxs("div", { style: { marginTop: 5 }, children: [_jsx("div", { style: { marginBottom: 4, fontSize: 12 }, children: "Expected Codes:" }), _jsx(StatusCodePicker, { value: a.configuration?.expectedStatus || '', onChange: (val) => updateConfig(a.id, 'expectedStatus', val) })] })), a.type === 'Script' && (_jsxs("div", { style: { marginTop: 5, width: '100%' }, children: [_jsxs("div", { style: { marginBottom: 4, fontSize: 11, opacity: 0.7, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsxs("span", { children: ["Return ", _jsx("code", { style: { background: 'var(--vscode-textCodeBlock-background)', padding: '1px 4px', borderRadius: 2 }, children: "true" }), " to pass, ", _jsx("code", { style: { background: 'var(--vscode-textCodeBlock-background)', padding: '1px 4px', borderRadius: 2 }, children: "false" }), " to fail. Available: ", _jsx("code", { style: { background: 'var(--vscode-textCodeBlock-background)', padding: '1px 4px', borderRadius: 2 }, children: "response" }), ", ", _jsx("code", { style: { background: 'var(--vscode-textCodeBlock-background)', padding: '1px 4px', borderRadius: 2 }, children: "statusCode" })] }), _jsxs(Button, { onClick: () => setPlaygroundScript(a.configuration?.script || ''), title: "Test in Playground", style: { fontSize: '11px', padding: '2px 6px', height: '20px' }, children: [_jsx(Play, { size: 10 }), " Test Script"] })] }), _jsx("div", { style: { border: '1px solid var(--vscode-input-border)', borderRadius: 4, overflow: 'hidden' }, children: _jsx(Editor, { height: "100px", defaultLanguage: "javascript", theme: "vs-dark", value: a.configuration?.script || '', onChange: (val) => updateConfig(a.id, 'script', val || ''), onMount: (editor, monaco) => {
                                                                    // Fix Enter key to insert newline
                                                                    editor.addAction({
                                                                        id: 'insert-newline',
                                                                        label: 'Insert Newline',
                                                                        keybindings: [monaco.KeyCode.Enter],
                                                                        run: (ed) => {
                                                                            ed.trigger('keyboard', 'type', { text: '\n' });
                                                                        }
                                                                    });
                                                                }, options: {
                                                                    minimap: { enabled: false },
                                                                    scrollBeyondLastLine: false,
                                                                    fontSize: 12,
                                                                    lineNumbers: 'off',
                                                                    folding: false,
                                                                    glyphMargin: false,
                                                                    lineDecorationsWidth: 0,
                                                                    lineNumbersMinChars: 0,
                                                                    automaticLayout: true,
                                                                    acceptSuggestionOnEnter: 'off',
                                                                    quickSuggestions: false,
                                                                } }) })] }))] })] }), _jsx(Button, { onClick: () => handleRemove(a.id), title: "Delete Assertion", style: { background: 'transparent', color: 'var(--vscode-descriptionForeground)' }, children: _jsx(Trash2, { size: 16 }) })] }, a.id || i));
                    })] }), playgroundScript !== null && (_jsx(ScriptPlaygroundModal, { scriptType: "assertion", initialScript: playgroundScript, onClose: () => setPlaygroundScript(null) }))] }));
};
