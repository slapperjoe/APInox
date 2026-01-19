import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import styled from 'styled-components';
import { Shield, Key, Clock, Hash } from 'lucide-react';
import { WSSecurityType, PasswordType } from '@shared/models';
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
const SectionHeader = styled.div `
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 0.95em;
    color: var(--vscode-foreground);
    margin-bottom: 5px;
`;
const FormRow = styled.div `
    display: flex;
    gap: 10px;
    align-items: center;
`;
const Label = styled.label `
    min-width: 120px;
    font-size: 0.9em;
    color: var(--vscode-descriptionForeground);
`;
const Select = styled.select `
    flex: 1;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 6px 10px;
    border-radius: 3px;
    font-size: 0.9em;
    &:focus {
        outline: 1px solid var(--vscode-focusBorder);
    }
`;
const Input = styled.input `
    flex: 1;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 6px 10px;
    border-radius: 3px;
    font-size: 0.9em;
    &:focus {
        outline: 1px solid var(--vscode-focusBorder);
    }
    &::placeholder {
        color: var(--vscode-input-placeholderForeground);
    }
`;
const Checkbox = styled.input.attrs({ type: 'checkbox' }) `
    width: 16px;
    height: 16px;
    cursor: pointer;
`;
const CheckboxLabel = styled.label `
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 0.9em;
    &:hover {
        color: var(--vscode-textLink-foreground);
    }
`;
const InfoText = styled.div `
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground);
    font-style: italic;
    padding: 10px;
    background: var(--vscode-textBlockQuote-background);
    border-radius: 3px;
`;
export const SecurityPanel = ({ security, onChange }) => {
    const currentType = security?.type || WSSecurityType.None;
    const updateField = (field, value) => {
        const current = security || { type: WSSecurityType.None };
        onChange({ ...current, [field]: value });
    };
    const handleTypeChange = (type) => {
        if (type === WSSecurityType.None) {
            onChange(undefined);
        }
        else {
            onChange({
                type,
                username: security?.username || '',
                password: security?.password || '',
                passwordType: security?.passwordType || PasswordType.PasswordDigest,
                hasNonce: security?.hasNonce ?? true,
                hasCreated: security?.hasCreated ?? true
            });
        }
    };
    return (_jsxs(Container, { children: [_jsxs(Section, { children: [_jsxs(SectionHeader, { children: [_jsx(Shield, { size: 16 }), "WS-Security Configuration"] }), _jsxs(FormRow, { children: [_jsx(Label, { children: "Security Type" }), _jsxs(Select, { value: currentType, onChange: (e) => handleTypeChange(e.target.value), children: [_jsx("option", { value: WSSecurityType.None, children: "None" }), _jsx("option", { value: WSSecurityType.UsernameToken, children: "UsernameToken" }), _jsx("option", { value: WSSecurityType.Certificate, children: "Certificate" })] })] })] }), currentType === WSSecurityType.UsernameToken && (_jsxs(_Fragment, { children: [_jsxs(Section, { children: [_jsxs(SectionHeader, { children: [_jsx(Key, { size: 16 }), "Credentials"] }), _jsxs(FormRow, { children: [_jsx(Label, { children: "Username" }), _jsx(Input, { type: "text", value: security?.username || '', onChange: (e) => updateField('username', e.target.value), placeholder: "Enter username or ${#Env#variable}" })] }), _jsxs(FormRow, { children: [_jsx(Label, { children: "Password" }), _jsx(Input, { type: "password", value: security?.password || '', onChange: (e) => updateField('password', e.target.value), placeholder: "Enter password or ${#Env#variable}" })] }), _jsxs(FormRow, { children: [_jsx(Label, { children: "Password Type" }), _jsxs(Select, { value: security?.passwordType || PasswordType.PasswordDigest, onChange: (e) => updateField('passwordType', e.target.value), children: [_jsx("option", { value: PasswordType.PasswordDigest, children: "PasswordDigest (Recommended)" }), _jsx("option", { value: PasswordType.PasswordText, children: "PasswordText (Plain)" })] })] }), _jsxs(InfoText, { children: [_jsx("strong", { children: "PasswordDigest" }), " hashes the password with a nonce and timestamp for security.", _jsx("strong", { children: "PasswordText" }), " sends the password in plain text (use only with HTTPS)."] })] }), _jsxs(Section, { children: [_jsxs(SectionHeader, { children: [_jsx(Clock, { size: 16 }), "Security Options"] }), _jsxs(CheckboxLabel, { children: [_jsx(Checkbox, { checked: security?.hasNonce ?? true, onChange: (e) => updateField('hasNonce', e.target.checked) }), _jsx(Hash, { size: 14 }), "Include Nonce (random value to prevent replay attacks)"] }), _jsxs(CheckboxLabel, { children: [_jsx(Checkbox, { checked: security?.hasCreated ?? true, onChange: (e) => updateField('hasCreated', e.target.checked) }), _jsx(Clock, { size: 14 }), "Include Timestamp (message creation time)"] }), _jsx(InfoText, { children: "Most WS-Security endpoints require both Nonce and Timestamp. These are generated fresh for each request to prevent replay attacks." })] })] })), currentType === WSSecurityType.Certificate && (_jsxs(Section, { children: [_jsxs(SectionHeader, { children: [_jsx(Key, { size: 16 }), "Certificate Details"] }), _jsxs(FormRow, { children: [_jsx(Label, { children: "Private Key Path" }), _jsx(Input, { type: "text", value: security?.privateKeyPath || '', onChange: (e) => updateField('privateKeyPath', e.target.value), placeholder: "Absolute path to .pem or .key file" })] }), _jsxs(FormRow, { children: [_jsx(Label, { children: "Public Cert Path" }), _jsx(Input, { type: "text", value: security?.publicCertPath || '', onChange: (e) => updateField('publicCertPath', e.target.value), placeholder: "Absolute path to .pem or .crt file" })] }), _jsxs(FormRow, { children: [_jsx(Label, { children: "Private Key Password" }), _jsx(Input, { type: "password", value: security?.password || '', onChange: (e) => updateField('password', e.target.value), placeholder: "Password for private key (if encrypted)" })] }), _jsxs(InfoText, { children: [_jsx("strong", { children: "Note:" }), " Files must be accessible by the extension. Paths support environment variables (e.g. ", _jsx("code", { children: '${#Env#cert_path}' }), ")."] })] })), currentType === WSSecurityType.None && (_jsx(InfoText, { children: "No WS-Security will be applied to requests. Select \"UsernameToken\" or \"Certificate\" to add authentication." }))] }));
};
