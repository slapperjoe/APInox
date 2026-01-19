import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styled from 'styled-components';
import { MonacoSingleLineInput } from './MonacoSingleLineInput';
const Container = styled.div `
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 15px;
    gap: 15px;
    overflow-y: auto;
`;
const Section = styled.div `
    display: flex;
    flex-direction: column;
    gap: 10px;
`;
const Label = styled.label `
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    display: block;
    margin-bottom: 4px;
`;
const Select = styled.select `
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 13px;
    width: 100%;
    cursor: pointer;

    &:focus {
        outline: 1px solid var(--vscode-focusBorder);
    }
`;
const InputRow = styled.div `
    display: flex;
    gap: 10px;
    align-items: flex-start;
`;
const InputGroup = styled.div `
    flex: 1;
`;
const Hint = styled.div `
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-top: 4px;
    opacity: 0.8;
`;
export const RestAuthPanel = ({ auth, onChange, readOnly = false }) => {
    const currentAuth = auth || { type: 'none' };
    const updateAuth = (updates) => {
        onChange({ ...currentAuth, ...updates });
    };
    const authTypes = [
        { value: 'none', label: 'No Auth', description: 'No authentication required' },
        { value: 'basic', label: 'Basic Auth', description: 'Username and password (Base64 encoded)' },
        { value: 'bearer', label: 'Bearer Token', description: 'OAuth2 or JWT token in Authorization header' },
        { value: 'apiKey', label: 'API Key', description: 'API key in header or query parameter' },
    ];
    return (_jsxs(Container, { children: [_jsx(Section, { children: _jsxs("div", { children: [_jsx(Label, { children: "Authentication Type" }), _jsx(Select, { value: currentAuth.type, onChange: (e) => updateAuth({ type: e.target.value }), disabled: readOnly, children: authTypes.map(at => (_jsx("option", { value: at.value, children: at.label }, at.value))) }), _jsx(Hint, { children: authTypes.find(at => at.value === currentAuth.type)?.description })] }) }), currentAuth.type === 'basic' && (_jsxs(Section, { children: [_jsx("h4", { style: { margin: 0 }, children: "Basic Authentication" }), _jsxs(InputRow, { children: [_jsxs(InputGroup, { children: [_jsx(Label, { children: "Username" }), _jsx(MonacoSingleLineInput, { value: currentAuth.username || '', onChange: (val) => updateAuth({ username: val }), placeholder: "username" })] }), _jsxs(InputGroup, { children: [_jsx(Label, { children: "Password" }), _jsx(MonacoSingleLineInput, { value: currentAuth.password || '', onChange: (val) => updateAuth({ password: val }), placeholder: "password" })] })] }), _jsx(Hint, { children: "Credentials will be Base64 encoded and sent as: Authorization: Basic <credentials>" })] })), currentAuth.type === 'bearer' && (_jsxs(Section, { children: [_jsx("h4", { style: { margin: 0 }, children: "Bearer Token" }), _jsxs("div", { children: [_jsx(Label, { children: "Token" }), _jsx(MonacoSingleLineInput, { value: currentAuth.token || '', onChange: (val) => updateAuth({ token: val }), placeholder: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." })] }), _jsx(Hint, { children: "Token will be sent as: Authorization: Bearer <token>" })] })), currentAuth.type === 'apiKey' && (_jsxs(Section, { children: [_jsx("h4", { style: { margin: 0 }, children: "API Key" }), _jsxs(InputRow, { children: [_jsxs(InputGroup, { children: [_jsx(Label, { children: "Key Name" }), _jsx(MonacoSingleLineInput, { value: currentAuth.apiKeyName || '', onChange: (val) => updateAuth({ apiKeyName: val }), placeholder: "X-API-Key" })] }), _jsxs(InputGroup, { children: [_jsx(Label, { children: "Key Value" }), _jsx(MonacoSingleLineInput, { value: currentAuth.token || '', onChange: (val) => updateAuth({ token: val }), placeholder: "your-api-key-here" })] })] }), _jsxs("div", { children: [_jsx(Label, { children: "Add To" }), _jsxs(Select, { value: currentAuth.apiKeyIn || 'header', onChange: (e) => updateAuth({ apiKeyIn: e.target.value }), disabled: readOnly, children: [_jsx("option", { value: "header", children: "Header" }), _jsx("option", { value: "query", children: "Query Parameter" })] })] }), _jsx(Hint, { children: currentAuth.apiKeyIn === 'query'
                            ? `Key will be added as query param: ?${currentAuth.apiKeyName || 'key'}=<value>`
                            : `Key will be sent in header: ${currentAuth.apiKeyName || 'X-API-Key'}: <value>` })] })), currentAuth.type === 'none' && (_jsx("div", { style: {
                    opacity: 0.6,
                    fontStyle: 'italic',
                    padding: 20,
                    textAlign: 'center',
                    border: '1px dashed var(--vscode-panel-border)',
                    borderRadius: 4
                }, children: "No authentication configured for this request." }))] }));
};
