import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Copy, Check, Download } from 'lucide-react';
import { Modal } from '../modals/Modal';
import { MonacoResponseViewer } from '../MonacoResponseViewer';
import { generateCode, CodeLanguage } from '../../utils/codeGenerator';
import { PrimaryButton, SecondaryButton } from '../common/Button';

const TabContainer = styled.div`
    display: flex;
    border-bottom: 1px solid var(--apinox-panel-border);
    background: var(--apinox-sideBar-background);
    overflow-x: auto;
`;

const Tab = styled.div<{ active: boolean }>`
    padding: 8px 16px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    border-top: 1px solid transparent;
    border-right: 1px solid var(--apinox-panel-border);
    background: ${props => props.active ? 'var(--apinox-editor-background)' : 'transparent'};
    color: ${props => props.active ? 'var(--apinox-tab-activeForeground)' : 'var(--apinox-tab-inactiveForeground)'};
    white-space: nowrap;

    &:hover {
        color: var(--apinox-tab-activeForeground);
    }
`;

const ActionsBar = styled.div`
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 10;
    display: flex;
    gap: 8px;
`;

interface CodeSnippetModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: any;
    environment?: any;
}

export const CodeSnippetModal: React.FC<CodeSnippetModalProps> = ({ isOpen, onClose, request, environment }) => {
    const [language, setLanguage] = useState<CodeLanguage>('curl');
    const [code, setCode] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen && request) {
            setCode(generateCode(request, language, environment));
        }
    }, [isOpen, request, language, environment]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    const handleDownload = () => {
        const fileExtensions: Record<CodeLanguage, string> = {
            'curl': 'sh',
            'node': 'js',
            'python': 'py',
            'csharp': 'cs',
            'csharp-restsharp': 'cs',
            'csharp-xunit': 'cs'
        };

        const extension = fileExtensions[language] || 'txt';
        const fileName = `${request.name || 'request'}.${extension}`;
        
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const getMonacoLanguage = (lang: CodeLanguage): string => {
        if (lang === 'curl') return 'shell';
        if (lang === 'node') return 'javascript';
        if (lang === 'python') return 'python';
        if (lang.startsWith('csharp')) return 'csharp';
        return 'plaintext';
    };

    if (!isOpen) return null;

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Generate Code" 
            size="large"
        >
            <div style={{ display: 'flex', flexDirection: 'column', height: '60vh' }}>
                <TabContainer>
                    <Tab active={language === 'curl'} onClick={() => setLanguage('curl')}>
                        cURL
                    </Tab>
                    <Tab active={language === 'node'} onClick={() => setLanguage('node')}>
                        Node.js
                    </Tab>
                    <Tab active={language === 'python'} onClick={() => setLanguage('python')}>
                        Python
                    </Tab>
                    <Tab active={language === 'csharp'} onClick={() => setLanguage('csharp')}>
                        C# HttpClient
                    </Tab>
                    <Tab active={language === 'csharp-restsharp'} onClick={() => setLanguage('csharp-restsharp')}>
                        C# RestSharp
                    </Tab>
                    <Tab active={language === 'csharp-xunit'} onClick={() => setLanguage('csharp-xunit')}>
                        C# xUnit Test
                    </Tab>
                </TabContainer>

                <div style={{ position: 'relative', flex: 1, border: '1px solid var(--apinox-panel-border)', borderTop: 'none' }}>
                    <MonacoResponseViewer
                        value={code}
                        language={getMonacoLanguage(language)}
                        showLineNumbers={true}
                    />
                    <ActionsBar>
                        <SecondaryButton onClick={handleDownload} title="Download as file">
                            <Download size={14} />
                        </SecondaryButton>
                        <PrimaryButton onClick={handleCopy}>
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            {copied ? 'Copied!' : 'Copy'}
                        </PrimaryButton>
                    </ActionsBar>
                </div>
            </div>
        </Modal>
    );
};
