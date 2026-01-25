/**
 * Button.tsx
 * Unified button component library for APInox.
 * 
 * Consolidates 7+ duplicate IconButton definitions and provides
 * consistent button variants across the application.
 * 
 * Usage:
 * ```tsx
 * import { IconButton, PrimaryButton, SecondaryButton, DangerButton } from './common/Button';
 * 
 * <IconButton onClick={handleClick} title="Delete">
 *   <Trash2 size={16} />
 * </IconButton>
 * 
 * <PrimaryButton onClick={handleSubmit}>Save</PrimaryButton>
 * ```
 */

import styled, { css, keyframes } from 'styled-components';

// Shake animation for danger states (e.g., delete confirmation)
const shake = keyframes`
    0% { transform: translateX(0); }
    25% { transform: translateX(2px) rotate(5deg); }
    50% { transform: translateX(-2px) rotate(-5deg); }
    75% { transform: translateX(2px) rotate(5deg); }
    100% { transform: translateX(0); }
`;

// Base button styles
const baseButtonStyles = css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: none;
    outline: none;
    font-family: var(--vscode-font-family);
    font-size: 13px;
    transition: background-color 0.1s ease, opacity 0.1s ease;
    
    &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }
`;

/**
 * IconButton - Transparent button for icons
 * Standard padding: 4px
 * Used in toolbars, headers, and inline actions
 */
export const IconButton = styled.button<{ $shake?: boolean; $danger?: boolean }>`
    ${baseButtonStyles}
    background: transparent;
    color: ${props => props.$danger ? 'var(--vscode-testing-iconFailed)' : 'var(--vscode-icon-foreground)'};
    padding: 4px;
    border-radius: 3px;
    
    &:hover:not(:disabled) {
        background-color: ${props => props.$danger 
            ? 'rgba(241, 76, 76, 0.1)' 
            : 'var(--vscode-toolbar-hoverBackground)'};
    }
    
    &:active:not(:disabled) {
        opacity: 0.8;
    }
    
    ${props => props.$shake && css`
        animation: ${shake} 0.5s ease-in-out;
        color: var(--vscode-testing-iconFailed);
    `}
`;

/**
 * HeaderButton - Smaller button for sidebar headers
 * Standard padding: 2px
 * Used in sidebar section headers
 */
export const HeaderButton = styled.button<{ $shake?: boolean }>`
    ${baseButtonStyles}
    background: transparent;
    color: currentColor;
    padding: 2px;
    margin-left: 5px;
    border-radius: 3px;
    
    &:hover:not(:disabled) {
        background-color: var(--vscode-toolbar-hoverBackground);
    }
    
    ${props => props.$shake && css`
        animation: ${shake} 0.5s ease-in-out;
    `}
`;

/**
 * PrimaryButton - Main action button
 * Used for primary actions (Save, Submit, Create, etc.)
 */
export const PrimaryButton = styled.button`
    ${baseButtonStyles}
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: 1px solid transparent;
    padding: 6px 14px;
    border-radius: 2px;
    font-weight: 500;
    
    &:hover:not(:disabled) {
        background-color: var(--vscode-button-hoverBackground);
    }
    
    &:active:not(:disabled) {
        opacity: 0.9;
    }
`;

/**
 * SecondaryButton - Secondary action button
 * Used for cancel, back, or alternative actions
 */
export const SecondaryButton = styled.button`
    ${baseButtonStyles}
    background-color: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: 1px solid var(--vscode-button-border, transparent);
    padding: 6px 14px;
    border-radius: 2px;
    font-weight: 400;
    
    &:hover:not(:disabled) {
        background-color: var(--vscode-button-secondaryHoverBackground);
    }
    
    &:active:not(:disabled) {
        opacity: 0.9;
    }
`;

/**
 * DangerButton - Destructive action button
 * Used for delete, remove, or other destructive actions
 */
export const DangerButton = styled.button<{ $shake?: boolean }>`
    ${baseButtonStyles}
    background-color: transparent;
    color: var(--vscode-testing-iconFailed);
    border: 1px solid var(--vscode-testing-iconFailed);
    padding: 6px 14px;
    border-radius: 2px;
    font-weight: 500;
    
    &:hover:not(:disabled) {
        background-color: rgba(241, 76, 76, 0.1);
    }
    
    &:active:not(:disabled) {
        opacity: 0.9;
    }
    
    ${props => props.$shake && css`
        animation: ${shake} 0.5s ease-in-out;
    `}
`;

/**
 * TextButton - Minimal text-only button
 * Used for inline links or subtle actions
 */
export const TextButton = styled.button`
    ${baseButtonStyles}
    background: transparent;
    color: var(--vscode-textLink-foreground);
    border: none;
    padding: 2px 6px;
    text-decoration: underline;
    
    &:hover:not(:disabled) {
        color: var(--vscode-textLink-activeForeground);
    }
`;

/**
 * ToggleButton - Button that shows active/inactive state
 * Used for mode selectors, filters, etc.
 */
export const ToggleButton = styled.button<{ $active: boolean; $activeColor?: string }>`
    ${baseButtonStyles}
    flex: 1;
    padding: 6px 8px;
    font-size: 11px;
    border: 1px solid ${props => props.$active
        ? (props.$activeColor || 'var(--vscode-button-background)')
        : 'var(--vscode-input-border)'};
    border-radius: 4px;
    background: ${props => props.$active
        ? (props.$activeColor || 'var(--vscode-button-background)')
        : 'transparent'};
    color: ${props => props.$active
        ? 'var(--vscode-button-foreground)'
        : 'var(--vscode-input-foreground)'};
    font-weight: ${props => props.$active ? 600 : 500};
    
    &:hover:not(:disabled) {
        background: ${props => props.$active
            ? (props.$activeColor || 'var(--vscode-button-background)')
            : 'var(--vscode-list-hoverBackground)'};
    }
`;

/**
 * RunButton - Success-colored button for play/run actions
 * Used for test execution, server start, etc.
 */
export const RunButton = styled.button`
    ${baseButtonStyles}
    background: transparent;
    color: var(--vscode-testing-iconPassed);
    border: none;
    padding: 4px;
    border-radius: 3px;
    
    &:hover:not(:disabled) {
        background-color: var(--vscode-toolbar-hoverBackground);
    }
`;

/**
 * StopButton - Error-colored button for stop actions
 * Used for stopping servers, canceling operations, etc.
 */
export const StopButton = styled.button`
    ${baseButtonStyles}
    background: transparent;
    color: var(--vscode-testing-iconFailed);
    border: none;
    padding: 4px;
    border-radius: 3px;
    
    &:hover:not(:disabled) {
        background-color: var(--vscode-toolbar-hoverBackground);
    }
`;
