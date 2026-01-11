import React, { useState } from 'react';
import styled from 'styled-components';
import { SchemaNode } from '@shared/models';
import { ChevronRight, ChevronDown, Box, FileType } from 'lucide-react';

const TreeItem = styled.div`
  margin-left: 20px;
`;

const ItemHeader = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 2px 0;
  &:hover {
    background-color: var(--vscode-list-hoverBackground);
  }
`;

const Label = styled.span`
  margin-left: 5px;
  font-family: var(--vscode-editor-font-family);
  font-size: var(--vscode-editor-font-size);
`;

const TypeLabel = styled.span`
  margin-left: 8px;
  color: var(--vscode-descriptionForeground);
  font-size: 0.9em;
  opacity: 0.8;
`;

const NodeIcon = ({ kind }: { kind: string }) => {
    return kind === 'complex' ? <Box size={14} color="var(--vscode-symbolIcon-classForeground)" /> : <FileType size={14} color="var(--vscode-symbolIcon-variableForeground)" />;
};

const SchemaNodeItem: React.FC<{ node: SchemaNode }> = ({ node }) => {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div>
            <ItemHeader onClick={() => setExpanded(!expanded)}>
                <div style={{ width: 16, display: 'flex', alignItems: 'center' }}>
                    {hasChildren && (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                </div>
                <NodeIcon kind={node.kind} />
                <Label>
                    <span style={{ fontWeight: node.kind === 'complex' ? 'bold' : 'normal' }}>{node.name}</span>
                    {node.isOptional && <span style={{ color: 'var(--vscode-descriptionForeground)', marginLeft: 4 }}>?</span>}
                </Label>
                <TypeLabel>{node.type}</TypeLabel>
            </ItemHeader>
            {hasChildren && expanded && (
                <TreeItem>
                    {node.children!.map((child, idx) => (
                        <SchemaNodeItem key={idx} node={child} />
                    ))}
                </TreeItem>
            )}
        </div>
    );
};

export const SchemaViewer: React.FC<{ schema: SchemaNode }> = ({ schema }) => {
    return (
        <div style={{ padding: 10, overflow: 'auto', height: '100%', userSelect: 'text' }}>
            <SchemaNodeItem node={schema} />
        </div>
    );
};
