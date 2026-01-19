import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styled from 'styled-components';
import Editor from '@monaco-editor/react';
import { X, Play, Loader2, HelpCircle } from 'lucide-react';
import { bridge } from '../../utils/bridge';
const Overlay = styled.div `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.75);
    z-index: 2000;
    display: flex;
    justify-content: center;
    align-items: center;
`;
const ModalContainer = styled.div `
    width: 95vw;
    height: 95vh;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
`;
const Header = styled.div `
    height: 40px;
    background: var(--vscode-editorGroupHeader-tabsBackground);
    border-bottom: 1px solid var(--vscode-panel-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 15px;
    font-weight: bold;
`;
const CloseButton = styled.button `
    background: transparent;
    border: none;
    color: var(--vscode-foreground);
    cursor: pointer;
    &:hover { color: var(--vscode-errorForeground); }
`;
const Content = styled.div `
    flex: 1;
    display: flex;
    overflow: hidden;
`;
const LeftPanel = styled.div `
    width: 40%;
    min-width: 300px;
    border-right: 1px solid var(--vscode-panel-border);
    display: flex;
    flex-direction: column;
    background: var(--vscode-sideBar-background);
`;
const RightPanel = styled.div `
    flex: 1;
    display: flex;
    flex-direction: column;
`;
const SectionTitle = styled.div `
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-panel-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
`;
const Section = styled.div `
    flex: ${props => props.flex || 'none'};
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--vscode-panel-border);
    &:last-child { border-bottom: none; }
`;
const InputRow = styled.div `
    display: flex;
    align-items: center;
    padding: 5px 10px;
    gap: 10px;
    font-size: 12px;
    
    label { min-width: 80px; }
    input {
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        padding: 4px;
        flex: 1;
    }
`;
const Footer = styled.div `
    height: 50px;
    border-top: 1px solid var(--vscode-panel-border);
    display: flex;
    align-items: center;
    padding: 0 20px;
    justify-content: flex-end;
    gap: 15px;
    background: var(--vscode-editor-background);
`;
const RunButton = styled.button `
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 8px 16px;
    border-radius: 2px;
    cursor: pointer;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;

    &:hover { background: var(--vscode-button-hoverBackground); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;
const OutputConsole = styled.div `
    flex: 1;
    background: var(--vscode-terminal-background, #1e1e1e);
    color: var(--vscode-terminal-foreground, #cccccc);
    padding: 10px;
    font-family: monospace;
    font-size: 12px;
    overflow-y: auto;
    white-space: pre-wrap;
`;
const SectionToolbar = styled.div `
    display: flex;
    justify-content: flex-end;
    padding: 2px 5px;
    background: var(--vscode-editor-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    gap: 5px;
`;
const MiniButton = styled.button `
    background: transparent;
    border: 1px solid var(--vscode-panel-border);
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 2px;
    cursor: pointer;
    &:hover {
        background: var(--vscode-list-hoverBackground);
        color: var(--vscode-foreground);
    }
`;
const HelpOverlay = styled.div `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 600px;
    max-width: 90%;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-focusBorder);
    box-shadow: 0 8px 16px rgba(0,0,0,0.5);
    z-index: 2001;
    padding: 20px;
    border-radius: 4px;

    h3 { margin-top: 0; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px; }
    ul { padding-left: 20px; }
    li { margin-bottom: 5px; }
    code { background: var(--vscode-textCodeBlock-background); padding: 2px 4px; borderRadius: 3px; font-family: monospace; }
`;
export const ScriptPlaygroundModal = ({ onClose, initialScript, scriptType }) => {
    const [script, setScript] = useState(initialScript);
    const [responseBody, setResponseBody] = useState('<root>Hello World</root>');
    const [statusCode, setStatusCode] = useState(200);
    const [variables, setVariables] = useState('{\n  "env": "dev"\n}');
    const [logs, setLogs] = useState([]);
    const [result, setResult] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const handleRun = () => {
        setIsRunning(true);
        setLogs([]);
        setResult(null);
        let parsedVars = {};
        try {
            parsedVars = JSON.parse(variables);
        }
        catch (e) {
            setLogs(['[System] Error parsing context variables JSON.']);
            setIsRunning(false);
            return;
        }
        bridge.sendMessage({
            command: 'executePlaygroundScript',
            scriptType,
            script,
            context: {
                responseBody,
                statusCode: Number(statusCode),
                variables: parsedVars
            }
        });
    };
    useEffect(() => {
        const handler = (event) => {
            const message = event.data;
            if (message.command === 'playgroundScriptResult') {
                setIsRunning(false);
                setLogs(message.logs || []);
                setResult({ status: message.status, message: message.message });
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);
    return (_jsx(Overlay, { onClick: (e) => e.target === e.currentTarget && onClose(), children: _jsxs(ModalContainer, { children: [_jsxs(Header, { children: [_jsxs("span", { children: ["Script Playground (", scriptType === 'assertion' ? 'Assertion' : 'Test Step', ")"] }), _jsxs("div", { style: { display: 'flex', gap: '10px' }, children: [_jsx(CloseButton, { onClick: () => setShowHelp(!showHelp), title: "Help", children: _jsx(HelpCircle, { size: 18 }) }), _jsx(CloseButton, { onClick: onClose, children: _jsx(X, { size: 20 }) })] })] }), _jsxs(Content, { children: [showHelp && (_jsxs(HelpOverlay, { children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }, children: [_jsx("h3", { style: { margin: 0, border: 'none' }, children: "Script Reference" }), _jsx(CloseButton, { onClick: () => setShowHelp(false), children: _jsx(X, { size: 16 }) })] }), _jsx("h4", { children: "Available Objects" }), _jsxs("ul", { children: [_jsxs("li", { children: [_jsx("code", { children: "response" }), " (string): The raw response body (Assertion only)."] }), _jsxs("li", { children: [_jsx("code", { children: "statusCode" }), " (number): The HTTP status code (Assertion only)."] }), _jsxs("li", { children: [_jsx("code", { children: "context" }), " (object): Shared variables accessible across steps."] })] }), _jsx("h4", { children: "Helper Functions" }), _jsxs("ul", { children: [_jsxs("li", { children: [_jsx("code", { children: "log(message)" }), ": Log a message to the console."] }), _jsxs("li", { children: [_jsx("code", { children: "fail(reason)" }), ": Explicitly fail the test step/assertion."] }), _jsxs("li", { children: [_jsx("code", { children: "delay(ms)" }), ": Pause execution for specified milliseconds."] }), _jsxs("li", { children: [_jsx("code", { children: "goto(stepName)" }), ": Jump to a specific step (mocked in playground)."] })] })] })), _jsxs(LeftPanel, { children: [_jsx(SectionTitle, { children: "Context Inputs" }), _jsxs(Section, { flex: 1, style: { minHeight: '200px' }, children: [_jsx("div", { style: { padding: '5px', fontSize: '11px', color: 'var(--vscode-descriptionForeground)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: _jsxs("span", { children: ["Response Body (accessible as ", _jsx("code", { children: "response" }), ")"] }) }), _jsxs(SectionToolbar, { children: [_jsx(MiniButton, { onClick: () => setResponseBody('<root>\n  <status>success</status>\n  <data>\n    <id>123</id>\n    <name>Test Item</name>\n  </data>\n</root>'), children: "Sample XML" }), _jsx(MiniButton, { onClick: () => setResponseBody('{\n  "status": "success",\n  "data": {\n    "id": 123,\n    "name": "Test Item"\n  }\n}'), children: "Sample JSON" }), _jsx(MiniButton, { onClick: () => setResponseBody(''), children: "Clear" })] }), _jsx(Editor, { height: "100%", defaultLanguage: "xml", theme: "vs-dark", value: responseBody, onChange: (v) => setResponseBody(v || ''), options: { minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 12 } })] }), _jsxs(InputRow, { children: [_jsx("label", { children: "Status Code:" }), _jsx("input", { type: "number", value: statusCode, onChange: (e) => setStatusCode(Number(e.target.value)) }), _jsxs("select", { style: { background: 'var(--vscode-dropdown-background)', color: 'var(--vscode-dropdown-foreground)', border: '1px solid var(--vscode-dropdown-border)' }, onChange: (e) => setStatusCode(Number(e.target.value)), value: statusCode, children: [_jsx("option", { value: "200", children: "200 OK" }), _jsx("option", { value: "201", children: "201 Created" }), _jsx("option", { value: "400", children: "400 Bad Request" }), _jsx("option", { value: "401", children: "401 Unauthorized" }), _jsx("option", { value: "403", children: "403 Forbidden" }), _jsx("option", { value: "404", children: "404 Not Found" }), _jsx("option", { value: "500", children: "500 Server Error" })] })] }), _jsxs(Section, { flex: 1, children: [_jsxs("div", { style: { padding: '5px', fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }, children: ["Context Variables (JSON - accessible as ", _jsx("code", { children: "context" }), ")"] }), _jsxs(SectionToolbar, { children: [_jsx(MiniButton, { onClick: () => setVariables('{\n  "env": "dev",\n  "userId": 101,\n  "token": "abc-123"\n}'), children: "Default" }), _jsx(MiniButton, { onClick: () => setVariables('{}'), children: "Clear" })] }), _jsx(Editor, { height: "100%", defaultLanguage: "json", theme: "vs-dark", value: variables, onChange: (v) => setVariables(v || ''), options: { minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 12 } })] })] }), _jsxs(RightPanel, { children: [_jsxs(Section, { flex: 2, children: [_jsx(SectionTitle, { children: "Script" }), _jsx(Editor, { height: "100%", defaultLanguage: "javascript", theme: "vs-dark", value: script, onChange: (v) => setScript(v || ''), options: {
                                                minimap: { enabled: false },
                                                fontSize: 14,
                                                scrollBeyondLastLine: false
                                            } })] }), _jsxs(Section, { flex: 1, style: { minHeight: '150px' }, children: [_jsx(SectionTitle, { children: "Console & Output" }), _jsxs(OutputConsole, { children: [result && (_jsxs("div", { style: {
                                                        color: result.status === 'PASS' ? '#4caf50' : '#f44336',
                                                        marginBottom: '10px',
                                                        fontWeight: 'bold'
                                                    }, children: ["[", result.status, "] ", result.message] })), logs.map((log, i) => (_jsx("div", { children: log }, i)))] })] })] })] }), _jsx(Footer, { children: _jsxs(RunButton, { onClick: handleRun, disabled: isRunning, children: [isRunning ? _jsx(Loader2, { className: "spin", size: 16 }) : _jsx(Play, { size: 16 }), "Run Script"] }) })] }) }));
};
