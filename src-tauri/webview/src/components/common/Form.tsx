/**
 * Form.tsx
 * Unified form component library for APInox.
 * 
 * Provides consistent input, textarea, and select components
 * with standardized styling across all forms and settings.
 * 
 * Usage:
 * ```tsx
 * import { FormInput, FormTextArea, FormSelect, FormLabel } from './common/Form';
 * 
 * <FormLabel>Username</FormLabel>
 * <FormInput
 *   value={username}
 *   onChange={(e) => setUsername(e.target.value)}
 *   placeholder="Enter username"
 * />
 * ```
 */

import styled, { css } from 'styled-components';

// Base form element styles
const baseInputStyles = css`
    font-family: var(--vscode-font-family);
    font-size: 13px;
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    outline: none;
    transition: border-color 0.1s ease;
    
    &:focus {
        border-color: var(--vscode-focusBorder);
    }
    
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    &::placeholder {
        color: var(--vscode-input-placeholderForeground);
        opacity: 0.6;
    }
`;

/**
 * FormInput - Standard text input
 * Standard padding: 6px
 */
export const FormInput = styled.input<{ $error?: boolean; $fullWidth?: boolean }>`
    ${baseInputStyles}
    padding: 6px;
    border-radius: 2px;
    width: ${props => props.$fullWidth ? '100%' : 'auto'};
    
    ${props => props.$error && css`
        border-color: var(--vscode-inputValidation-errorBorder);
        background-color: var(--vscode-inputValidation-errorBackground);
    `}
`;

/**
 * FormTextArea - Multi-line text input
 * Standard padding: 6px
 */
export const FormTextArea = styled.textarea<{ $error?: boolean; $fullWidth?: boolean }>`
    ${baseInputStyles}
    padding: 6px;
    border-radius: 2px;
    width: ${props => props.$fullWidth ? '100%' : 'auto'};
    min-height: 60px;
    resize: vertical;
    font-family: var(--vscode-editor-font-family, monospace);
    
    ${props => props.$error && css`
        border-color: var(--vscode-inputValidation-errorBorder);
        background-color: var(--vscode-inputValidation-errorBackground);
    `}
`;

/**
 * FormSelect - Dropdown select input
 * Standard padding: 6px
 */
export const FormSelect = styled.select<{ $error?: boolean; $fullWidth?: boolean }>`
    ${baseInputStyles}
    padding: 6px;
    border-radius: 2px;
    width: ${props => props.$fullWidth ? '100%' : 'auto'};
    cursor: pointer;
    
    ${props => props.$error && css`
        border-color: var(--vscode-inputValidation-errorBorder);
        background-color: var(--vscode-inputValidation-errorBackground);
    `}
`;

/**
 * FormCheckbox - Checkbox input
 */
export const FormCheckbox = styled.input.attrs({ type: 'checkbox' })`
    cursor: pointer;
    width: 16px;
    height: 16px;
    margin: 0;
    
    &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }
`;

/**
 * FormLabel - Label for form elements
 */
export const FormLabel = styled.label<{ $required?: boolean }>`
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--vscode-foreground);
    margin-bottom: 4px;
    
    ${props => props.$required && css`
        &::after {
            content: ' *';
            color: var(--vscode-testing-iconFailed);
        }
    `}
`;

/**
 * FormGroup - Container for label + input pair
 */
export const FormGroup = styled.div<{ $inline?: boolean }>`
    display: ${props => props.$inline ? 'flex' : 'block'};
    align-items: ${props => props.$inline ? 'center' : 'stretch'};
    gap: ${props => props.$inline ? '8px' : '0'};
    margin-bottom: 12px;
    
    ${props => props.$inline && css`
        ${FormLabel} {
            margin-bottom: 0;
            flex-shrink: 0;
        }
    `}
`;

/**
 * FormRow - Horizontal layout for multiple form groups
 */
export const FormRow = styled.div<{ $gap?: string }>`
    display: flex;
    gap: ${props => props.$gap || '12px'};
    align-items: flex-start;
    margin-bottom: 12px;
    
    & > * {
        flex: 1;
    }
`;

/**
 * FormSection - Visual grouping of related form fields
 */
export const FormSection = styled.div`
    padding: 16px;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    margin-bottom: 16px;
    background-color: var(--vscode-editor-background);
`;

/**
 * FormSectionTitle - Title for form sections
 */
export const FormSectionTitle = styled.h3`
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--vscode-foreground);
    border-bottom: 1px solid var(--vscode-panel-border);
    padding-bottom: 6px;
`;

/**
 * FormHelperText - Helper or error text below inputs
 */
export const FormHelperText = styled.div<{ $error?: boolean }>`
    font-size: 11px;
    margin-top: 4px;
    color: ${props => props.$error 
        ? 'var(--vscode-inputValidation-errorForeground)' 
        : 'var(--vscode-descriptionForeground)'};
    opacity: ${props => props.$error ? 1 : 0.8};
`;

/**
 * FormActions - Container for form action buttons (submit, cancel, etc.)
 */
export const FormActions = styled.div<{ $align?: 'left' | 'center' | 'right' }>`
    display: flex;
    gap: 8px;
    justify-content: ${props => 
        props.$align === 'left' ? 'flex-start' :
        props.$align === 'center' ? 'center' :
        'flex-end'};
    margin-top: 20px;
    padding-top: 12px;
    border-top: 1px solid var(--vscode-panel-border);
`;

/**
 * InlineFormInput - Compact input for inline editing
 * Smaller padding: 2px 4px
 */
export const InlineFormInput = styled.input`
    ${baseInputStyles}
    padding: 2px 4px;
    border-radius: 2px;
    font-size: 12px;
    min-width: 60px;
`;
