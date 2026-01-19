/**
 * WorkspaceLayout.styles.ts
 *
 * Styled components for the WorkspaceLayout component.
 * Extracted for maintainability and reduced file size.
 */
import styled, { keyframes, css } from 'styled-components';
import { ChevronLeft } from 'lucide-react';
export const Mascot = styled.img `
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
    mix-blend-mode: color-burn;
    
    display: none !important; /* DEBUGGING: Forced hidden */
`;
export const EmptyStateImage = styled.img `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60vw;
    height: 60vh;
    object-fit: contain;
    opacity: 0.12;
    pointer-events: none;
    z-index: 0;
    mix-blend-mode: color-burn;

    display: none !important; /* DEBUGGING: Forced hidden */
`;
export const Content = styled.div `
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
`;
export const MarkdownContainer = styled.div `
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
export const Toolbar = styled.div `
    display: flex;
    padding: 5px 10px;
    background-color: var(--vscode-editor-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    align-items: center;
    gap: 10px;
    height: 40px;
`;
/** Read-only info bar for displaying endpoint URL in proxy/watcher view */
export const InfoBar = styled.div `
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
export const InfoBarMethod = styled.span `
    font-weight: 600;
    color: var(--vscode-textLink-foreground);
    background: var(--vscode-badge-background);
    padding: 2px 6px;
    border-radius: 3px;
`;
export const InfoBarUrl = styled.span `
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;
export const ToolbarButton = styled.button `
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

    /* Enforce uppercase labels */
    text-transform: uppercase;
    font-size: 11px;
    font-weight: 600;
`;
export const ToolbarSelect = styled.select `
    background-color: var(--vscode-dropdown-background);
    color: var(--vscode-dropdown-foreground);
    border: 1px solid var(--vscode-dropdown-border);
    padding: 4px;
    outline: none;
    height: 26px;
    box-sizing: border-box;
    font-size: 11px;

    &:focus {
        border-color: var(--vscode-focusBorder);
    }
`;
export const ToolbarSeparator = styled.div `
    width: 1px;
    height: 16px;
    background-color: var(--vscode-panel-border);
    margin: 0 4px;
    flex-shrink: 0;
`;
export const MainFooter = styled.div `
    padding: 5px 10px;
    border-top: 1px solid var(--vscode-panel-border);
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    background-color: var(--vscode-editor-background);
`;
export const shake = keyframes `
    0% { transform: translateX(0); }
    25% { transform: translateX(2px) rotate(5deg); }
    50% { transform: translateX(-2px) rotate(-5deg); }
    75% { transform: translateX(2px) rotate(5deg); }
    100% { transform: translateX(0); }
`;
export const IconButton = styled.button `
    background: ${props => props.active ? 'var(--vscode-button-background)' : 'transparent'};
    color: ${props => props.active ? 'var(--vscode-button-foreground)' : (props.shake ? 'var(--vscode-errorForeground)' : 'var(--vscode-icon-foreground)')};
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
    ${props => props.shake && css `animation: ${shake} 0.5s ease-in-out infinite;`}

    &:hover {
        background-color: ${props => props.active ? 'var(--vscode-button-hoverBackground)' : 'var(--vscode-toolbar-hoverBackground)'};
    }
    &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
`;
export const EmptyStateContainer = styled.div `
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--vscode-descriptionForeground);
    padding: 20px;
    text-align: center;
`;
export const EmptyStateTitle = styled.h2 `
    margin-bottom: 10px;
    color: var(--vscode-foreground);
`;
export const ProjectContainer = styled.div `
    padding: 40px;
    color: var(--vscode-foreground);
    overflow-y: auto;
    flex: 1;
`;
export const ProjectHeader = styled.div `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
`;
export const ProjectName = styled.h1 `
    margin: 0;
`;
export const ProjectDescription = styled.p `
    font-size: 1.1em;
    opacity: 0.8;
    margin: 8px 0 0 0;
`;
export const StatsGrid = styled.div `
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 20px;
    margin-top: 20px;
`;
export const StatCard = styled.div `
    padding: 20px;
    background: var(--vscode-editor-inactiveSelectionBackground);
    border-radius: 6px;
`;
export const StatLabel = styled.div `
    font-size: 0.85em;
    opacity: 0.7;
    margin-bottom: 8px;
`;
export const StatValue = styled.span `
    font-size: 2em;
    font-weight: bold;
`;
export const InterfacesHeading = styled.h2 `
    margin-top: 40px;
    border-bottom: 1px solid var(--vscode-panel-border);
    padding-bottom: 10px;
`;
export const SectionHeading = styled(InterfacesHeading) `
    margin-top: 40px;
`;
export const InterfacesList = styled.div `
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 15px;
`;
export const InterfaceItem = styled.div `
    padding: 15px;
    background: var(--vscode-list-hoverBackground);
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
`;
export const InterfaceInfo = styled.div `
    flex: 1;
`;
export const InterfaceName = styled.span `
    font-weight: bold;
    font-size: 1.1em;
`;
export const InterfaceOps = styled.div `
    font-size: 0.8em;
    opacity: 0.7;
    margin-top: 4px;
`;
export const InterfaceDef = styled.div `
    font-size: 0.75em;
    opacity: 0.5;
    margin-top: 4px;
    font-family: monospace;
`;
export const InterfaceContainer = styled(ProjectContainer) ``;
export const InfoCard = styled.div `
    margin-top: 20px;
    padding: 20px;
    background: var(--vscode-editor-inactiveSelectionBackground);
    border-radius: 6px;
`;
export const InfoGrid = styled.div `
    display: grid;
    gap: 12px;
`;
export const EndpointText = styled.span `
    font-family: monospace;
    font-size: 0.9em;
    word-break: break-all;
`;
export const OperationsHeading = styled.h2 `
    margin-top: 30px;
    border-bottom: 1px solid var(--vscode-panel-border);
    padding-bottom: 10px;
`;
export const OperationsList = styled.div `
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 15px;
`;
export const OperationItem = styled.div `
    padding: 15px;
    background: var(--vscode-list-hoverBackground);
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid var(--vscode-panel-border);
`;
export const OperationRow = styled.div `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
`;
export const OperationMeta = styled.span `
    margin-left: 8px;
    font-size: 0.85em;
    opacity: 0.6;
`;
export const StatsGridSpaced = styled(StatsGrid) `
    margin-top: 30px;
`;
export const OperationContainer = styled(ProjectContainer) ``;
export const RequestsHeading = styled.h2 `
    margin-top: 30px;
    border-bottom: 1px solid var(--vscode-panel-border);
    padding-bottom: 10px;
`;
export const RequestGrid = styled.div `
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 15px;
    margin-top: 15px;
`;
export const RequestCard = styled(OperationItem) `
    display: flex;
    align-items: center;
    justify-content: space-between;
    `;
export const LinkText = styled.a `
    color: var(--vscode-textLink-foreground);
`;
export const ChevronIcon = styled(ChevronLeft) `
    transform: rotate(180deg);
    opacity: 0.5;
`;
export const ChevronIconFaint = styled(ChevronLeft) `
    transform: rotate(180deg);
    opacity: 0.3;
`;
export const RequestName = styled.span `
    font-weight: 500;
`;
