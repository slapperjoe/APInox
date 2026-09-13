import React from 'react';
import styled from 'styled-components';

const Container = styled.div<{ $fill?: boolean }>`
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--apinox-descriptionForeground);
    padding: var(--space-xl);
    text-align: center;
    ${props => props.$fill ? 'height: 100%; min-height: 200px;' : 'min-height: 100px;'}
`;

const IconWrapper = styled.div`
    margin-bottom: var(--space-lg);
    opacity: 0.5;
    color: var(--apinox-foreground);

    svg {
        width: 48px;
        height: 48px;
    }
`;

const Title = styled.h2`
    margin: 0 0 var(--space-sm) 0;
    color: var(--apinox-foreground);
    font-weight: 600;
    font-size: 1.1em;
`;

const Description = styled.p`
    margin: 0;
    max-width: 400px;
    line-height: 1.4;
    opacity: 0.9;
`;

const ActionContainer = styled.div`
    margin-top: var(--space-lg);
`;

const ActionButton = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: none;
    outline: none;
    font-family: var(--apinox-font-family);
    font-size: 13px;
    background-color: var(--apinox-button-background);
    color: var(--apinox-button-foreground);
    border: 1px solid transparent;
    padding: 6px 14px;
    border-radius: 2px;
    font-weight: 500;

    &:hover:not(:disabled) {
        background-color: var(--apinox-button-hoverBackground);
    }

    &:active:not(:disabled) {
        opacity: 0.9;
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

export interface EmptyStateProps {
    icon?: React.ElementType | null;
    title: string;
    description?: string;
    /** When true, fills the parent (webview layout); default is compact. */
    fill?: boolean;
    action?: {
        label: string;
        onClick: () => void;
    };
    children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, fill, action, children }) => {
    return (
        <Container $fill={fill}>
            {Icon && (
                <IconWrapper>
                    <Icon />
                </IconWrapper>
            )}
            <Title>{title}</Title>
            {description && <Description>{description}</Description>}
            {action && (
                <ActionContainer>
                    <ActionButton onClick={action.onClick}>{action.label}</ActionButton>
                </ActionContainer>
            )}
            {children}
        </Container>
    );
};
