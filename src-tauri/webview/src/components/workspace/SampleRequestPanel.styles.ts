import styled from 'styled-components';
import { SPACING_XS, SPACING_SM, SPACING_MD } from '../../styles/spacing';

export const SamplePanelContainer = styled.div`
    background: var(--apinox-editor-background);
    border: 1px solid var(--apinox-panel-border);
    border-radius: 4px;
    margin-bottom: var(--space-xl);
    overflow: hidden;
`;

export const SamplePanelHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: ${SPACING_MD};
    background: var(--apinox-editor-inactiveSelectionBackground);
    border-bottom: 1px solid var(--apinox-panel-border);
    cursor: pointer;
    user-select: none;
    
    &:hover {
        background: var(--apinox-list-hoverBackground);
    }
`;

export const SamplePanelTitle = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
    font-weight: 600;
    font-size: 0.95em;
`;

export const SamplePanelActions = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_SM};
`;

export const SamplePanelBody = styled.div<{ collapsed: boolean }>`
    display: ${props => props.collapsed ? 'none' : 'block'};
    padding: ${SPACING_MD};
    max-height: 600px;
    overflow-y: auto;
`;

export const MetadataSection = styled.div`
    display: grid;
    grid-template-columns: auto 1fr;
    gap: ${SPACING_SM} ${SPACING_MD};
    padding: ${SPACING_MD};
    background: var(--apinox-editor-inactiveSelectionBackground);
    border-radius: 3px;
    margin-bottom: ${SPACING_MD};
    font-size: 0.85em;
`;

export const MetadataLabel = styled.div`
    font-weight: 600;
    opacity: 0.7;
`;

export const MetadataValue = styled.div`
    font-family: var(--apinox-editor-font-family);
    opacity: 0.9;
    word-break: break-all;
`;

export const XmlTreeContainer = styled.div`
    font-family: var(--apinox-editor-font-family);
    font-size: 0.9em;
    line-height: 1.6;
`;

export const TreeNode = styled.div<{ depth: number }>`
    padding-left: ${props => props.depth * 20}px;
    margin: 2px 0;
`;

export const ElementNode = styled.div`
    display: flex;
    align-items: center;
    gap: ${SPACING_XS};
    padding: 2px 0;
    
    &:hover {
        background: var(--apinox-list-hoverBackground);
    }
`;

export const CollapseIcon = styled.span<{ collapsed: boolean }>`
    cursor: pointer;
    user-select: none;
    display: inline-flex;
    align-items: center;
    width: 16px;
    transition: transform 0.2s;
    transform: ${props => props.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)'};
    color: var(--apinox-foreground);
    opacity: 0.6;
    
    &:hover {
        opacity: 1;
    }
`;

export const TagBracket = styled.span`
    color: var(--apinox-symbolIcon-classForeground);
    opacity: 0.7;
`;

export const TagName = styled.span`
    color: var(--apinox-symbolIcon-fieldForeground);
    font-weight: 500;
`;

export const AttributeName = styled.span`
    color: var(--apinox-symbolIcon-propertyForeground);
    margin-left: ${SPACING_SM};
`;

export const AttributeValue = styled.span`
    color: var(--apinox-symbolIcon-stringForeground);
`;

export const TextValue = styled.span`
    color: var(--apinox-symbolIcon-stringForeground);
    font-style: italic;
    opacity: 0.8;
`;

export const OptionalBadge = styled.span`
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 0.75em;
    font-weight: 600;
    background: var(--apinox-badge-background);
    color: var(--apinox-badge-foreground);
    opacity: 0.7;
    margin-left: ${SPACING_XS};
`;

export const RequiredBadge = styled(OptionalBadge)`
    background: var(--apinox-charts-green);
    color: var(--apinox-editor-background);
    opacity: 0.9;
`;

export const CommentText = styled.span`
    color: var(--apinox-symbolIcon-variableForeground);
    opacity: 0.5;
    font-style: italic;
`;

export const ActionButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: ${SPACING_XS};
    padding: ${SPACING_XS} ${SPACING_SM};
    background: var(--apinox-button-secondaryBackground);
    color: var(--apinox-button-secondaryForeground);
    border: 1px solid var(--apinox-button-border);
    border-radius: 3px;
    font-size: 0.85em;
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
        background: var(--apinox-button-secondaryHoverBackground);
    }
    
    &:active {
        transform: scale(0.98);
    }
`;

export const PrimaryActionButton = styled(ActionButton)`
    background: var(--apinox-button-background);
    color: var(--apinox-button-foreground);
    
    &:hover {
        background: var(--apinox-button-hoverBackground);
    }
`;
