import { jsx as _jsx } from "react/jsx-runtime";
import styled from 'styled-components';
import { HelpCircle } from 'lucide-react';
import { useUI } from '../contexts/UIContext';
// Styled similar to existing ToolbarButton but more minimal/ghost
const StyledHelpButton = styled.button `
    background: transparent;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 4px;
    transition: color 0.1s;

    &:hover {
        color: var(--vscode-foreground);
        background-color: var(--vscode-toolbar-hoverBackground);
    }
`;
export const ContextHelpButton = ({ sectionId, title = "Help", style, size = 16 }) => {
    const { openHelp } = useUI();
    return (_jsx(StyledHelpButton, { onClick: () => openHelp(sectionId), title: title, style: style, children: _jsx(HelpCircle, { size: size }) }));
};
