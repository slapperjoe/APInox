import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState } from 'react';
import styled from 'styled-components';
import { X } from 'lucide-react';
import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';
const ModalOverlay = styled.div `
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
`;
const ModalContent = styled.div `
  background-color: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  width: 900px;
  max-width: 95%;
  height: 80vh;
  display: flex;
  flex-direction: column;
`;
const ModalHeader = styled.div `
    padding: 10px 15px;
    border-bottom: 1px solid var(--vscode-panel-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: var(--vscode-editorGroupHeader-tabsBackground);
`;
const ModalBody = styled.div `
    flex: 1;
    display: flex;
    overflow: hidden;
`;
const Sidebar = styled.div `
    width: 200px;
    background-color: var(--vscode-sideBar-background);
    border-right: 1px solid var(--vscode-panel-border);
    display: flex;
    flex-direction: column;
`;
const Tab = styled.button `
    background: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent'};
    color: ${props => props.active ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-foreground)'};
    border: none;
    padding: 10px 15px;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;

    &:hover {
        background: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-list-hoverBackground)'};
    }
`;
const ContentArea = styled.div `
    flex: 1;
    padding: 20px 30px;
    overflow-y: auto;
    background-color: var(--vscode-editor-background);

    h1 { border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px; margin-bottom: 20px; font-size: 24px; }
    h2 { margin-top: 25px; margin-bottom: 15px; font-size: 18px; color: var(--vscode-textLink-foreground); }
    h3 { margin-top: 20px; margin-bottom: 10px; font-size: 16px; font-weight: bold; }
    p { margin-bottom: 15px; line-height: 1.5; }
    ul { margin-left: 20px; margin-bottom: 15px; }
    li { margin-bottom: 5px; }
    code { background: var(--vscode-textCodeBlock-background); padding: 2px 4px; border-radius: 3px; font-family: monospace; }
    pre { background: var(--vscode-textCodeBlock-background); padding: 15px; border-radius: 4px; overflow-x: auto; margin-bottom: 15px; }
    img { max-width: 100%; height: auto; border: 1px solid var(--vscode-panel-border); margin: 10px 0; border-radius: 4px; }
`;
const CloseButton = styled.button `
    background: transparent;
    border: none;
    color: var(--vscode-foreground);
    cursor: pointer;
    &:hover { color: var(--vscode-errorForeground); }
`;
import { HELP_SECTIONS } from '../data/helpContent';
export const HelpModal = ({ onClose, initialSectionId }) => {
    const [activeTabId, setActiveTabId] = useState(initialSectionId || HELP_SECTIONS[0].id);
    // If initialSectionId changes while modal is open (rare but possible), update tab
    React.useEffect(() => {
        if (initialSectionId) {
            setActiveTabId(initialSectionId);
        }
    }, [initialSectionId]);
    const activeSection = HELP_SECTIONS.find(s => s.id === activeTabId) || HELP_SECTIONS[0];
    return (_jsx(ModalOverlay, { onClick: (e) => { if (e.target === e.currentTarget)
            onClose(); }, children: _jsxs(ModalContent, { children: [_jsxs(ModalHeader, { children: [_jsx("div", { style: { fontWeight: 'bold' }, children: "APInox Help" }), _jsx(CloseButton, { onClick: onClose, children: _jsx(X, { size: 20 }) })] }), _jsxs(ModalBody, { children: [_jsx(Sidebar, { children: HELP_SECTIONS.map(section => (_jsxs(Tab, { active: activeTabId === section.id, onClick: () => setActiveTabId(section.id), children: [_jsx(section.icon, { size: 16 }), section.label] }, section.id))) }), _jsx(ContentArea, { children: _jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], children: activeSection.content }) })] })] }) }));
};
