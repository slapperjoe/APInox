/**
 * Button.tsx
 * Unified button component library for APInox.
 * 
 * Consolidates 7+ duplicate IconButton definitions and provides
 * consistent button variants across the application.
 * 
 * Usage:
 * ```tsx
 * import { IconButton, PrimaryButton, SecondaryButton } from './common/Button';
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
export const shake = keyframes`
    0% { transform: translateX(0); }
    25% { transform: translateX(2px) rotate(5deg); }
    50% { transform: translateX(-2px) rotate(-5deg); }
    75% { transform: translateX(2px) rotate(5deg); }
    100% { transform: translateX(0); }
`;

// Base button styles
export const baseButtonStyles = css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: none;
    outline: none;
    font-family: var(--apinox-font-family);
    font-size: var(--apinox-fs-base);
    transition: background-color 0.1s ease, opacity 0.1s ease;
    
    &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }
`;

/**
 * GhostButton - Neutral button base.
 *
 * The canonical starting point for any button that doesn't map onto an
 * existing variant: it carries only the shared `baseButtonStyles` (flex
 * layout, cursor, border/outline reset, font, transition, disabled state)
 * and no color/padding/radius opinion. Ad-hoc `styled.button` definitions
 * migrate here (UI-consistency item 16+17) so they inherit the shared base
 * instead of redeclaring it; each site then adds only its delta CSS.
 */
export const GhostButton = styled.button`
    ${baseButtonStyles}
`;

/**
 * IconButton - Transparent button for icons
 * Standard padding: 4px
 * Used in toolbars, headers, and inline actions
 */
export const IconButton = styled.button<{ $shake?: boolean; $danger?: boolean }>`
    ${baseButtonStyles}
    background: transparent;
    color: ${props => props.$danger ? 'var(--apinox-testing-iconFailed)' : 'var(--apinox-icon-foreground)'};
    padding: 4px;
    border-radius: 2px;
    
    &:hover:not(:disabled) {
        background-color: ${props => props.$danger 
            ? 'color-mix(in srgb, var(--apinox-testing-iconFailed) 10%, transparent)'
            : 'var(--apinox-toolbar-hoverBackground)'};
    }
    
    &:active:not(:disabled) {
        opacity: 0.8;
    }
    
    ${props => props.$shake && css`
        animation: ${shake} 0.5s ease-in-out;
        color: var(--apinox-testing-iconFailed);
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
    border-radius: 2px;
    
    &:hover:not(:disabled) {
        background-color: var(--apinox-toolbar-hoverBackground);
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
    background-color: var(--apinox-button-background);
    color: var(--apinox-button-foreground);
    border: 1px solid transparent;
    padding: 8px 14px;
    border-radius: 2px;
    font-weight: var(--fw-medium);
    
    &:hover:not(:disabled) {
        background-color: var(--apinox-button-hoverBackground);
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
    background-color: var(--apinox-button-secondaryBackground);
    color: var(--apinox-button-secondaryForeground);
    border: 1px solid var(--apinox-button-border, transparent);
    padding: 8px 14px;
    border-radius: 2px;
    font-weight: var(--fw-regular);
    
    &:hover:not(:disabled) {
        background-color: var(--apinox-button-secondaryHoverBackground);
    }
    
    &:active:not(:disabled) {
        opacity: 0.9;
    }
`;

/**
 * RunButton - Success-colored button for play/run actions
 * Used for test execution, server start, etc.
 */
export const RunButton = styled.button`
    ${baseButtonStyles}
    background: transparent;
    color: var(--apinox-testing-iconPassed);
    border: none;
    padding: 4px;
    border-radius: 2px;
    
    &:hover:not(:disabled) {
        background-color: var(--apinox-toolbar-hoverBackground);
    }
`;

/**
 * ToggleTab - Active-state toggle for tab bars and mode selectors.
 * The single source of the active/inactive selection styling (list selection
 * tokens); sites extend it and add only their geometry (padding, size,
 * border). Replaces the per-file `$active` tab buttons (HelpModal,
 * TrafficDetails, EnvironmentsTab, HistorySidebar).
 */
export const ToggleTab = styled.button<{ $active?: boolean }>`
    ${baseButtonStyles}
    border: none;
    text-align: left;
    background: ${props => props.$active
        ? 'var(--apinox-list-activeSelectionBackground)'
        : 'transparent'};
    color: ${props => props.$active
        ? 'var(--apinox-list-activeSelectionForeground)'
        : 'var(--apinox-foreground)'};

    &:hover {
        background: ${props => props.$active
            ? 'var(--apinox-list-activeSelectionBackground)'
            : 'var(--apinox-list-hoverBackground)'};
    }
`;

