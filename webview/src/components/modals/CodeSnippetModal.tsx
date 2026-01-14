import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Copy, Check } from 'lucide-react';
import { Modal, Button } from '../modals/Modal';
import { MonacoResponseViewer } from '../MonacoResponseViewer';
import { generateCode } from '../../utils/codeGenerator';

const LanguageTabs = styled.div`
    display: flex;
    gap: 2px;
    background: var(--vscode-editor-groupHeader-tabsBackground);
    padding: 0 10px;
    border-bottom: 1px solid var(--vscode-editorGroup-border);
`;

const Tab = styled.div<{ active: boolean }>`
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

interface CodeSnippetModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: any;
    environment?: any;
}

export const CodeSnippetModal: React.FC<CodeSnippetModalProps> = ({ isOpen, onClose, request, environment }) => {
    const [language, setLanguage] = useState<'curl' | 'node' | 'python' | 'csharp'>('curl');
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

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generate Code" width={800}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '60vh' }}>
                <LanguageTabs>
                    <Tab active={language === 'curl'} onClick={() => setLanguage('curl')}>cURL</Tab>
                    <Tab active={language === 'node'} onClick={() => setLanguage('node')}>Node.js</Tab>
                    <Tab active={language === 'python'} onClick={() => setLanguage('python')}>Python</Tab>
                    <Tab active={language === 'csharp'} onClick={() => setLanguage('csharp')}>C#</Tab>
                </LanguageTabs>

                <div style={{ position: 'relative', flex: 1, border: '1px solid var(--vscode-panel-border)', borderTop: 'none' }}>
                    <MonacoResponseViewer
                        value={code}
                        language={language === 'node' ? 'javascript' : language === 'csharp' ? 'csharp' : language === 'curl' ? 'shell' : 'python'}
                        showLineNumbers={true}
                    />
                    <Button
                        onClick={handleCopy}
                        style={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            zIndex: 10,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copied' : 'Copy'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
