/**
 * WorkspaceLayout.styles.ts
 * 
 * Styled components for the WorkspaceLayout component.
 * Extracted for maintainability and reduced file size.
 */

import styled from 'styled-components';

export const Mascot = styled.img`
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100vw;
    height: 100vh;
    object-fit: contain;
    opacity: 0.15;
    pointer-events: none;
    z-index: 0;
    mix-blend-mode: multiply;

    body.vscode-dark &, body.vscode-high-contrast & {
        filter: invert(1);
        mix-blend-mode: screen;
        opacity: 0.1;
    }
`;

export const EmptyStateImage = styled.img`
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100vw;
    height: 100vh;
    object-fit: contain;
    opacity: 0.15;
    pointer-events: none;
    z-index: 0;
    mix-blend-mode: multiply;

    body.vscode-dark &, body.vscode-high-contrast & {
        filter: invert(1);
        mix-blend-mode: screen;
        opacity: 0.1;
    }
`;

export const Content = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
`;

export const MarkdownContainer = styled.div`
    margin-top: 20px;
    padding-top: 10px;
    border-top: 1px solid var(--vscode-panel-border);

    h1, h2, h3 { border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 5px; margin-top: 1.5em; }
    p { margin-bottom: 1em; }
    ul { padding-left: 20px; }
    code { background: var(--vscode-textCodeBlock-background); padding: 2px 4px; border-radius: 3px; font-family: monospace; }
    pre { background: var(--vscode-textCodeBlock-background); padding: 10px; border-radius: 5px; overflow-x: auto; }
    pre code { background: transparent; padding: 0; }
`;

export const Toolbar = styled.div`
    display: flex;
    padding: 5px 10px;
    background-color: var(--vscode-editor-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    align-items: center;
    gap: 10px;
    height: 40px;
`;

/** Read-only info bar for displaying endpoint URL in proxy/watcher view */
export const InfoBar = styled.div`
    display: flex;
    padding: 8px 12px;
    background-color: var(--vscode-editor-inactiveSelectionBackground);
    border-bottom: 1px solid var(--vscode-panel-border);
    align-items: center;
    gap: 12px;
    font-family: var(--vscode-editor-font-family);
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
`;

export const InfoBarMethod = styled.span`
    font-weight: 600;
    color: var(--vscode-textLink-foreground);
    background: var(--vscode-badge-background);
    padding: 2px 6px;
    border-radius: 3px;
`;

export const InfoBarUrl = styled.span`
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const ToolbarButton = styled.button`
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 4px 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    border-radius: 2px;
    white-space: nowrap;
    height: 26px;
    box-sizing: border-box;

    &:hover {
        background: var(--vscode-button-hoverBackground);
    }
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

export const ToolbarSelect = styled.select`
    background-color: var(--vscode-dropdown-background);
    color: var(--vscode-dropdown-foreground);
    border: 1px solid var(--vscode-dropdown-border);
    padding: 4px;
    outline: none;
    height: 26px;
    box-sizing: border-box;

    &:focus {
        border-color: var(--vscode-focusBorder);
    }
`;

export const MainFooter = styled.div`
    padding: 5px 10px;
    border-top: 1px solid var(--vscode-panel-border);
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    background-color: var(--vscode-editor-background);
`;

export const IconButton = styled.button<{ active?: boolean }>`
    background: ${props => props.active ? 'var(--vscode-button-background)' : 'transparent'};
    color: ${props => props.active ? 'var(--vscode-button-foreground)' : 'var(--vscode-icon-foreground)'};
    border: 1px solid transparent;
    cursor: pointer;
    padding: 3px;
    border-radius: 3px;
    height: 26px;
    width: 26px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
        background-color: ${props => props.active ? 'var(--vscode-button-hoverBackground)' : 'var(--vscode-toolbar-hoverBackground)'};
    }
    &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
`;
