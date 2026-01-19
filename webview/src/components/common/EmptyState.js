import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styled from 'styled-components';
import { Button } from '../modals/Modal';
const Container = styled.div `
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--vscode-descriptionForeground);
    padding: var(--space-xl);
    text-align: center;
    height: 100%;
    min-height: 200px;
`;
const IconWrapper = styled.div `
    margin-bottom: var(--space-lg);
    opacity: 0.5;
    color: var(--vscode-foreground);
    
    svg {
        width: 48px;
        height: 48px;
    }
`;
const Title = styled.h2 `
    margin: 0 0 var(--space-sm) 0;
    color: var(--vscode-foreground);
    font-weight: 600;
    font-size: 1.1em;
`;
const Description = styled.p `
    margin: 0;
    max-width: 400px;
    line-height: 1.4;
    opacity: 0.9;
`;
const ActionContainer = styled.div `
    margin-top: var(--space-lg);
`;
export const EmptyState = ({ icon: Icon, title, description, action, children }) => {
    return (_jsxs(Container, { children: [Icon && (_jsx(IconWrapper, { children: _jsx(Icon, {}) })), _jsx(Title, { children: title }), description && _jsx(Description, { children: description }), action && (_jsx(ActionContainer, { children: _jsx(Button, { onClick: action.onClick, children: action.label }) })), children] }));
};
