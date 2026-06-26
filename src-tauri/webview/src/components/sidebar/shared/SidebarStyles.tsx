/**
 * SidebarStyles.tsx
 * Shared styled components for sidebar UI elements.
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
    height: 44px;
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
    letter-spacing: 0.08em;
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
    min-height: 0;
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
 * Shake animation - re-exported from common/Button.tsx to avoid duplication.
 * Used for delete confirmations and warnings.
 */
import { shake } from '../../common/Button';
export { shake };
