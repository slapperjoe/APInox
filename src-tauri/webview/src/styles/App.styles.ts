/**
 * App.styles.ts
 * 
 * Styled components extracted from App.tsx for cleaner organization.
 * These are the core layout and menu components used by the main App component.
 */

import styled from 'styled-components';

// =============================================================================
// LAYOUT COMPONENTS
// =============================================================================

/**
 * Main container for the application.
 * Uses VS Code theme variables for consistent appearance.
 */
export const Container = styled.div<{ $showCustomTitleBar?: boolean; $isMacOS?: boolean; $isMobile?: boolean; $isAndroid?: boolean }>`
    display: flex;
    flex-direction: ${props => props.$isMobile ? 'column' : 'row'};
    overflow: hidden;
    background-color: var(--apinox-editor-background);
    color: var(--apinox-editor-foreground);
    font-family: var(--apinox-font-family);
    font-size: var(--apinox-font-size);
    /* Mobile: position:fixed fills the exact WKWebView frame (more reliable than height:100dvh) */
    position: ${props => props.$isMobile ? 'fixed' : 'static'};
    top: ${props => props.$isMobile ? '0' : 'auto'};
    left: ${props => props.$isMobile ? '0' : 'auto'};
    right: ${props => props.$isMobile ? '0' : 'auto'};
    bottom: ${props => props.$isMobile ? '0' : 'auto'};
    height: ${props => props.$isMobile ? 'auto' : '100dvh'};
    width: ${props => props.$isMobile ? 'auto' : '100vw'};
    padding-top: ${props => {
        if (props.$isMobile) return '0';  /* Mobile header handles its own clearance */
        if (props.$isMacOS) return '32px';  /* macOS native title bar with overlay - need space for traffic lights */
        if (props.$showCustomTitleBar) return '32px';  /* Windows/Linux custom title bar */
        return '0';
    }};
    padding-bottom: 0;
`;

// =============================================================================
// CONTEXT MENU COMPONENTS
// =============================================================================

/**
 * Positioned context menu container.
 * Appears at the specified x/y coordinates.
 */
export const ContextMenu = styled.div<{ top: number, left: number }>`
    position: fixed;
    top: ${props => props.top}px;
    left: ${props => props.left}px;
    background-color: var(--apinox-menu-background);
    color: var(--apinox-menu-foreground);
    border: 1px solid var(--apinox-menu-border);
    box-shadow: 0 2px 8px var(--apinox-widget-shadow);
    z-index: 2000;
    min-width: 150px;
    padding: 4px 0;
`;

/**
 * Individual menu item within a context menu.
 * Highlights on hover using VS Code selection colors.
 */
export const ContextMenuItem = styled.div`
    padding: 6px 12px;
    cursor: pointer;
    &:hover {
        background-color: var(--apinox-menu-selectionBackground);
        color: var(--apinox-menu-selectionForeground);
    }
`;
