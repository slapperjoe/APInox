import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * IntegrationsTab.tsx
 *
 * Azure DevOps integration settings for the Settings modal.
 */
import { useState, useEffect } from 'react';
import { ExternalLink, Check, AlertCircle, Loader2 } from 'lucide-react';
import styled, { keyframes } from 'styled-components';
import { ScrollableForm, FormGroup, Label, Input, Select, SectionHeader, PrimaryButton, } from './SettingsTypes';
const spin = keyframes `
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
`;
const Spinner = styled(Loader2) `
    animation: ${spin} 1s linear infinite;
`;
const StatusMessage = styled.div `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    margin-top: 10px;
    background: ${props => props.success
    ? 'var(--vscode-inputValidation-infoBackground)'
    : 'var(--vscode-inputValidation-errorBackground)'};
    color: ${props => props.success
    ? 'var(--vscode-inputValidation-infoForeground)'
    : 'var(--vscode-inputValidation-errorForeground)'};
    border-radius: 4px;
    font-size: 12px;
`;
const HelpText = styled.div `
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-top: 4px;
`;
export const IntegrationsTab = ({ config, onConfigChange, sendMessage, }) => {
    const [pat, setPat] = useState('');
    const [hasPat, setHasPat] = useState(false);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const azureDevOps = config.azureDevOps || {};
    // Check if PAT exists on mount
    useEffect(() => {
        sendMessage({ command: 'adoHasPat' });
        const handleMessage = (event) => {
            const msg = event.data;
            switch (msg.command) {
                case 'adoHasPatResult':
                    setHasPat(msg.hasPat);
                    break;
                case 'adoPatStored':
                    setHasPat(true);
                    setPat('');
                    // Auto-fetch projects after PAT stored
                    if (azureDevOps.orgUrl) {
                        fetchProjects();
                    }
                    break;
                case 'adoPatDeleted':
                    setHasPat(false);
                    setProjects([]);
                    break;
                case 'adoProjectsResult':
                    setLoading(false);
                    if (msg.success) {
                        setProjects(msg.projects);
                    }
                    else {
                        setTestResult({ success: false, message: msg.error });
                    }
                    break;
                case 'adoTestConnectionResult':
                    setLoading(false);
                    setTestResult(msg);
                    break;
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);
    const handleStorePat = () => {
        if (pat.trim()) {
            sendMessage({ command: 'adoStorePat', pat: pat.trim() });
        }
    };
    const handleDeletePat = () => {
        sendMessage({ command: 'adoDeletePat' });
        onConfigChange('azureDevOps', { ...azureDevOps, project: undefined });
    };
    const fetchProjects = () => {
        if (!azureDevOps.orgUrl)
            return;
        setLoading(true);
        setTestResult(null);
        sendMessage({ command: 'adoListProjects', orgUrl: azureDevOps.orgUrl });
    };
    const handleTestConnection = () => {
        if (!azureDevOps.orgUrl)
            return;
        setLoading(true);
        setTestResult(null);
        sendMessage({ command: 'adoTestConnection', orgUrl: azureDevOps.orgUrl });
    };
    const handleOrgUrlChange = (value) => {
        onConfigChange('azureDevOps', { ...azureDevOps, orgUrl: value });
        setProjects([]);
        setTestResult(null);
    };
    const handleProjectChange = (value) => {
        onConfigChange('azureDevOps', { ...azureDevOps, project: value });
    };
    return (_jsxs(ScrollableForm, { children: [_jsx(SectionHeader, { children: "Azure DevOps" }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Organization URL" }), _jsx(Input, { type: "text", value: azureDevOps.orgUrl || '', onChange: e => handleOrgUrlChange(e.target.value), placeholder: "https://dev.azure.com/your-org" }), _jsx(HelpText, { children: "Your Azure DevOps organization URL (e.g., https://dev.azure.com/myorg)" })] }), _jsxs(FormGroup, { children: [_jsx(Label, { children: "Personal Access Token (PAT)" }), hasPat ? (_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx(Input, { type: "password", value: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", disabled: true, style: { flex: 1 } }), _jsx(PrimaryButton, { onClick: handleDeletePat, style: { background: 'var(--vscode-button-secondaryBackground)' }, children: "Remove" })] })) : (_jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx(Input, { type: "password", value: pat, onChange: e => setPat(e.target.value), placeholder: "Enter your PAT", style: { flex: 1 } }), _jsx(PrimaryButton, { onClick: handleStorePat, disabled: !pat.trim(), children: "Save PAT" })] })), _jsxs(HelpText, { children: ["Create a PAT with \"Work Items (Read & Write)\" scope.", ' ', _jsxs("a", { href: "https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate", style: { color: 'var(--vscode-textLink-foreground)' }, children: ["Learn more ", _jsx(ExternalLink, { size: 10, style: { verticalAlign: 'middle' } })] })] })] }), hasPat && azureDevOps.orgUrl && (_jsxs(FormGroup, { children: [_jsx(Label, { children: "Project" }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsxs(Select, { value: azureDevOps.project || '', onChange: e => handleProjectChange(e.target.value), style: { flex: 1 }, disabled: loading || projects.length === 0, children: [_jsx("option", { value: "", children: "Select a project..." }), projects.map(p => (_jsx("option", { value: p.name, children: p.name }, p.id)))] }), _jsx(PrimaryButton, { onClick: fetchProjects, disabled: loading, style: { background: 'var(--vscode-button-secondaryBackground)' }, children: loading ? _jsx(Spinner, { size: 14 }) : 'Refresh' })] })] })), hasPat && azureDevOps.orgUrl && (_jsxs(FormGroup, { children: [_jsxs(PrimaryButton, { onClick: handleTestConnection, disabled: loading, children: [loading ? _jsx(Spinner, { size: 14 }) : _jsx(Check, { size: 14 }), "Test Connection"] }), testResult && (_jsxs(StatusMessage, { success: testResult.success, children: [testResult.success ? _jsx(Check, { size: 14 }) : _jsx(AlertCircle, { size: 14 }), testResult.message] }))] })), _jsxs("div", { style: {
                    marginTop: 20,
                    padding: 12,
                    background: 'var(--vscode-textBlockQuote-background)',
                    borderLeft: '3px solid var(--vscode-textBlockQuote-border)',
                    fontSize: 12
                }, children: [_jsx("strong", { children: "How it works:" }), _jsxs("ol", { style: { margin: '8px 0 0 0', paddingLeft: 20 }, children: [_jsx("li", { children: "Configure your Azure DevOps org and PAT above" }), _jsx("li", { children: "Select your project from the dropdown" }), _jsx("li", { children: "A \"Add to DevOps\" button will appear on request screens" }), _jsx("li", { children: "Enter a Work Item ID to add the request/response as a comment" })] })] })] }));
};
