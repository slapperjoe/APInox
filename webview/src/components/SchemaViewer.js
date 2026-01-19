import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import styled from 'styled-components';
import { ChevronRight, ChevronDown, Box, FileType } from 'lucide-react';
const TreeItem = styled.div `
  margin-left: 20px;
`;
const ItemHeader = styled.div `
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 2px 0;
  &:hover {
    background-color: var(--vscode-list-hoverBackground);
  }
`;
const Label = styled.span `
  margin-left: 5px;
  font-family: var(--vscode-editor-font-family);
  font-size: var(--vscode-editor-font-size);
`;
const TypeLabel = styled.span `
  margin-left: 8px;
  color: var(--vscode-descriptionForeground);
  font-size: 0.9em;
  opacity: 0.8;
`;
const NodeIcon = ({ kind }) => {
    return kind === 'complex' ? _jsx(Box, { size: 14, color: "var(--vscode-symbolIcon-classForeground)" }) : _jsx(FileType, { size: 14, color: "var(--vscode-symbolIcon-variableForeground)" });
};
const SchemaNodeItem = ({ node }) => {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;
    return (_jsxs("div", { children: [_jsxs(ItemHeader, { onClick: () => setExpanded(!expanded), children: [_jsx("div", { style: { width: 16, display: 'flex', alignItems: 'center' }, children: hasChildren && (expanded ? _jsx(ChevronDown, { size: 14 }) : _jsx(ChevronRight, { size: 14 })) }), _jsx(NodeIcon, { kind: node.kind }), _jsxs(Label, { children: [_jsx("span", { style: { fontWeight: node.kind === 'complex' ? 'bold' : 'normal' }, children: node.name }), node.isOptional && _jsx("span", { style: { color: 'var(--vscode-descriptionForeground)', marginLeft: 4 }, children: "?" })] }), _jsx(TypeLabel, { children: node.type })] }), hasChildren && expanded && (_jsx(TreeItem, { children: node.children.map((child, idx) => (_jsx(SchemaNodeItem, { node: child }, idx))) }))] }));
};
export const SchemaViewer = ({ schema }) => {
    return (_jsx("div", { style: { padding: 10, overflow: 'auto', height: '100%', userSelect: 'text' }, children: _jsx(SchemaNodeItem, { node: schema }) }));
};
