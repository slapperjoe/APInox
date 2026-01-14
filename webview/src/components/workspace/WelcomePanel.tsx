import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Mascot, MarkdownContainer } from '../../styles/WorkspaceLayout.styles';
import titleDark from '../../assets/app-title-dark.jpg';
import titleLight from '../../assets/app-title-light.jpg';

interface WelcomePanelProps {
    changelog?: string;
}

export const WelcomePanel: React.FC<WelcomePanelProps> = ({ changelog }) => {
    return (
        <div style={{ padding: 20, flex: 1, overflow: 'auto', color: 'var(--vscode-editor-foreground)', fontFamily: 'var(--vscode-font-family)', position: 'relative' }}>
            <Mascot src={titleDark} className="dark-only" alt="APInox" />
            <Mascot src={titleLight} className="light-only" alt="APInox" />
            <h1>Welcome to APInox</h1>
            <p>Load a WSDL to see available operations.</p>
            {changelog && (
                <MarkdownContainer>
                    <ReactMarkdown>{changelog}</ReactMarkdown>
                </MarkdownContainer>
            )}
        </div>
    );
};
