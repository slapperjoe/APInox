import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Copy, Check } from 'lucide-react';
import { Modal, Button } from '../modals/Modal';
import { MonacoResponseViewer } from '../MonacoResponseViewer';
import { generateCode } from '../../utils/codeGenerator';
const LanguageTabs = styled.div `
    display: flex;
    gap: 2px;
    background: var(--vscode-editor-groupHeader-tabsBackground);
    padding: 0 10px;
    border-bottom: 1px solid var(--vscode-editorGroup-border);
`;
const Tab = styled.div `
    padding: 8px 16px;
    cursor: pointer;
    background: ${props => props.active ? 'var(--vscode-editor-background)' : 'transparent'};
    color: ${props => props.active ? 'var(--vscode-tab-activeForeground)' : 'var(--vscode-tab-inactiveForeground)'};
    border-top: 1px solid ${props => props.active ? 'var(--vscode-tab-activeBorderTop)' : 'transparent'};
    font-size: 12px;
    
    &:hover {
        background: ${props => !props.active && 'var(--vscode-tab-hoverBackground)'};
    }
`;
export const CodeSnippetModal = ({ isOpen, onClose, request, environment }) => {
    const [language, setLanguage] = useState('curl');
    const [code, setCode] = useState('');
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (isOpen && request) {
            setCode(generateCode(request, language, environment));
        }
    }, [isOpen, request, language, environment]);
    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    if (!isOpen)
        return null;
    return (_jsx(Modal, { isOpen: isOpen, onClose: onClose, title: "Generate Code", width: 800, children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '60vh' }, children: [_jsxs(LanguageTabs, { children: [_jsx(Tab, { active: language === 'curl', onClick: () => setLanguage('curl'), children: "cURL" }), _jsx(Tab, { active: language === 'node', onClick: () => setLanguage('node'), children: "Node.js" }), _jsx(Tab, { active: language === 'python', onClick: () => setLanguage('python'), children: "Python" }), _jsx(Tab, { active: language === 'csharp', onClick: () => setLanguage('csharp'), children: "C#" })] }), _jsxs("div", { style: { position: 'relative', flex: 1, border: '1px solid var(--vscode-panel-border)', borderTop: 'none' }, children: [_jsx(MonacoResponseViewer, { value: code, language: language === 'node' ? 'javascript' : language === 'csharp' ? 'csharp' : language === 'curl' ? 'shell' : 'python', showLineNumbers: true }), _jsxs(Button, { onClick: handleCopy, style: {
                                position: 'absolute',
                                top: 10,
                                right: 10,
                                zIndex: 10,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }, children: [copied ? _jsx(Check, { size: 14 }) : _jsx(Copy, { size: 14 }), copied ? 'Copied' : 'Copy'] })] })] }) }));
};
