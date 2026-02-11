/**
 * SidebarStyles.tsx
 * Shared styled components for sidebar UI elements.
 * 
 * NOTE: Some components in this file are being migrated to common components:
 * - HeaderButton → Use components/common/Button.tsx > HeaderButton
 * - Input → Use components/common/Form.tsx > FormInput or InlineFormInput
 * 
 * These sidebar-specific components remain:
 * - Layout components (SidebarContainer, SidebarHeader, SidebarContent)
 * - Tree item components (SectionHeader, ServiceItem, OperationItem, RequestItem)
 * - Visual elements (DirtyMarker)
 */

import styled, { keyframes, css } from 'styled-components';

/**
 * DirtyMarker - Visual indicator for unsaved changes
 * Used to show "*" next to modified items
 */
export const DirtyMarker = styled.span`
    color: var(--apinox-charts-yellow);
    margin-left: 5px;
    font-size: 1.2em;
    line-height: 0.5;
`;

/**
 * SidebarHeader - Top section of sidebar panels
 * Contains title and action buttons
 * Standard padding: 4px 10px (matches SPACING_PATTERNS.sidebarHeader)
 */
export const SidebarHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 10px;
    min-height: 28px;
    border-bottom: 1px solid var(--apinox-sideBarSectionHeader-border);
    user-select: none;
`;

/**
 * SidebarHeaderTitle - Title text in sidebar header
 * Uppercase, bold styling matching VS Code sidebar sections
 */
export const SidebarHeaderTitle = styled.div`
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--apinox-sideBarTitle-foreground);
    letter-spacing: 0.3px;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
`;

/**
 * SidebarHeaderActions - Container for action buttons in header
 * Use with HeaderButton or IconButton from common/Button.tsx
 */
export const SidebarHeaderActions = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--apinox-icon-foreground);
`;

/**
 * SidebarContainer - Root container for sidebar panels
 * Provides flex column layout filling full height
 */
export const SidebarContainer = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
`;

/**
 * SidebarContent - Scrollable content area of sidebar
 * Standard padding: 10px (matches SPACING_PATTERNS.sidebarContent)
 */
export const SidebarContent = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 10px;
`;

/**
 * SectionHeader - Collapsible section header in tree views
 * Used for expandable sections like "Interfaces", "Suites", etc.
 */
export const SectionHeader = styled.div`
    padding: 3px 8px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    user-select: none;
    &:hover {
        background-color: var(--apinox-list-hoverBackground);
    }
`;

/**
 * SectionTitle - Text content in section headers
 * Handles overflow with ellipsis
 */
export const SectionTitle = styled.div`
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

/**
 * ServiceItem - Top-level tree item (Interface, Folder at root level)
 * No indentation, larger font for visual hierarchy
 */
export const ServiceItem = styled.div`
    padding: 2px 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    font-size: 0.95em;
    font-weight: 500;
    &:hover {
        background-color: var(--apinox-list-hoverBackground);
    }
`;

/**
 * OperationItem - Second-level tree item (Operation, TestCase)
 * Indentation: 20px (first level of nesting)
 * Supports active state for selection highlighting
 */
export const OperationItem = styled.div<{ $active?: boolean }>`
    padding: 2px 8px;
    padding-left: 20px;
    cursor: pointer;
    font-size: 0.88em;
    line-height: 1.4;
    min-height: 20px;
    background-color: ${props => props.$active ? 'var(--apinox-list-activeSelectionBackground)' : 'transparent'};
    color: ${props => props.$active ? 'var(--apinox-list-activeSelectionForeground)' : 'inherit'};
    display: flex;
    align-items: center;
    &:hover {
        background-color: ${props => props.$active ? 'var(--apinox-list-activeSelectionBackground)' : 'var(--apinox-list-hoverBackground)'};
    }
`;

/**
 * RequestItem - Third-level tree item (Request, TestStep)
 * Indentation: 45px (second level of nesting)
 * Smaller font size for visual hierarchy
 */
export const RequestItem = styled.div<{ $active?: boolean }>`
    padding: 2px 8px;
    padding-left: 45px;
    cursor: pointer;
    line-height: 1.4;
    min-height: 20px;
    font-size: 0.82em;
    background-color: ${props => props.$active ? 'var(--apinox-list-activeSelectionBackground)' : 'transparent'};
    color: ${props => props.$active ? 'var(--apinox-list-activeSelectionForeground)' : 'inherit'};
    display: flex;
    align-items: center;
    &:hover {
        background-color: ${props => props.$active ? 'var(--apinox-list-activeSelectionBackground)' : 'var(--apinox-list-hoverBackground)'};
    }
`;

/**
 * Shake animation for attention-grabbing effects
 * Used for delete confirmations and warnings
 * NOTE: Also exported from components/common/Button.tsx
 */
export const shake = keyframes`
    0% { transform: translateX(0); }
    25% { transform: translateX(2px) rotate(5deg); }
    50% { transform: translateX(-2px) rotate(-5deg); }
    75% { transform: translateX(2px) rotate(5deg); }
    100% { transform: translateX(0); }
`;

/**
 * HeaderButton - Button for sidebar headers
 * @deprecated Prefer using HeaderButton from components/common/Button.tsx
 * This version remains for backward compatibility during migration.
 */
export const HeaderButton = styled.button<{ $shake?: boolean }>`
    background: transparent;
    border: none;
    color: currentColor;
    cursor: pointer;
    padding: 2px;
    margin-left: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    ${props => props.$shake && css`animation: ${shake} 0.5s ease-in-out;`}
    &:hover {
        background-color: var(--apinox-toolbar-hoverBackground);
        border-radius: 3px;
    }
`;

/**
 * Input - Basic text input
 * @deprecated Prefer using FormInput or InlineFormInput from components/common/Form.tsx
 * This version remains for backward compatibility during migration.
 * 
 * Note: This has 4px padding vs. FormInput's 6px padding.
 * Use InlineFormInput (2px 4px) for compact inline editing.
 */
export const Input = styled.input`
    background-color: var(--apinox-input-background);
    color: var(--apinox-input-foreground);
    border: 1px solid var(--apinox-input-border);
    padding: 4px;
    flex: 1;
    outline: none;
    &:focus {
        border-color: var(--apinox-focusBorder);
    }
`;
