import React, { useState } from 'react';
import styled from 'styled-components';
import { SoapUIProject } from '../models';
import { Play, Plus, ChevronRight, ChevronDown, FlaskConical, Folder, Trash2 } from 'lucide-react';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--vscode-foreground);
`;

const Toolbar = styled.div`
    display: flex;
    align-items: center;
    padding: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
    gap: 8px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--vscode-sideBarTitle-foreground);
`;

const IconButton = styled.button`
    background: none;
    border: none;
    cursor: pointer;
    color: var(--vscode-icon-foreground);
    padding: 2px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
        background-color: var(--vscode-toolbar-hoverBackground);
    }
`;

const TreeItem = styled.div<{ depth: number, active?: boolean }>`
    padding: 4px 8px;
    padding-left: ${props => props.depth * 16 + 8}px;
    cursor: pointer;
    display: flex;
    align-items: center;
    font-size: 13px;
    background-color: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent'};
    color: ${props => props.active ? 'var(--vscode-list-activeSelectionForeground)' : 'inherit'};

    &:hover {
        background-color: ${props => props.active ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-list-hoverBackground)'};
    }
`;

interface TestNavigatorProps {
    projects: SoapUIProject[];
    onAddSuite: (projectName: string) => void;
    onDeleteSuite: (suiteId: string) => void;
    onRunSuite: (suiteId: string) => void;
    onAddTestCase: (suiteId: string) => void;
    onRunCase: (caseId: string) => void;
    onDeleteTestCase: (caseId: string) => void;
}

export const TestNavigator: React.FC<TestNavigatorProps> = ({
    projects,
    onAddSuite,
    onDeleteSuite,
    onRunSuite,
    onAddTestCase,
    onRunCase,
    onDeleteTestCase
}) => {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const newSet = new Set(expandedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedIds(newSet);
    };

    console.log(`[TestNavigator] Rendering with ${projects.length} projects`);
    projects.forEach(p => console.log(`[TestNavigator] Project ${p.name} has ${p.testSuites?.length || 0} suites`));

    return (
        <Container>
            <Toolbar>
                <div style={{ fontWeight: 'bold' }}>Test Runner</div>
                {/* Global Run All Button? */}
            </Toolbar>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {projects.map(p => (
                    <div key={p.name}> {/* Using p.name as key, assuming it's unique */}
                        <TreeItem depth={0} onClick={(e) => toggleExpand(p.name, e)}>
                            {expandedIds.has(p.name) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <Folder size={14} style={{ marginRight: 6, marginLeft: 4 }} />
                            {p.name}
                            <div style={{ marginLeft: 'auto' }}>
                                <IconButton onClick={(e) => {
                                    e.stopPropagation();
                                    onAddSuite(p.name);
                                }} title="Add Test Suite">
                                    <Plus size={14} />
                                </IconButton>
                            </div>
                        </TreeItem>
                        {expandedIds.has(p.name) && (
                            <div>
                                {(p.testSuites || []).map(suite => (
                                    <div key={suite.id}>
                                        <TreeItem
                                            depth={1}
                                            onClick={(e) => toggleExpand(suite.id, e)}
                                        >
                                            {expandedIds.has(suite.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            <FlaskConical size={14} style={{ marginRight: 6, marginLeft: 4 }} />
                                            {suite.name}
                                            <div style={{ marginLeft: 'auto', display: 'flex' }}>
                                                <IconButton onClick={(e) => {
                                                    e.stopPropagation();
                                                    onAddTestCase(suite.id);
                                                }} title="New Test Case">
                                                    <Plus size={14} />
                                                </IconButton>
                                                <IconButton onClick={(e) => {
                                                    e.stopPropagation();
                                                    onRunSuite(suite.id);
                                                }} title="Run Suite">
                                                    <Play size={14} />
                                                </IconButton>
                                                <IconButton onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteSuite(suite.id);
                                                }} title="Delete Suite" style={{ color: 'var(--vscode-errorForeground)' }}>
                                                    <Trash2 size={14} />
                                                </IconButton>
                                            </div>
                                        </TreeItem>
                                        {expandedIds.has(suite.id) && (
                                            <div>
                                                {(suite.testCases || []).map(tc => (
                                                    <TreeItem
                                                        key={tc.id}
                                                        depth={2}
                                                        onClick={(e) => toggleExpand(tc.id, e)}
                                                    >
                                                        <Play size={12} style={{ opacity: 0.7, marginRight: 8, marginLeft: 4 }} />
                                                        {tc.name}
                                                        <div style={{ marginLeft: 'auto', display: 'flex' }}>
                                                            <IconButton onClick={(e) => {
                                                                e.stopPropagation();
                                                                onRunCase(tc.id);
                                                            }} title="Run Case">
                                                                <Play size={12} />
                                                            </IconButton>
                                                            <IconButton onClick={(e) => {
                                                                e.stopPropagation();
                                                                onDeleteTestCase(tc.id);
                                                            }} title="Delete Case" style={{ color: 'var(--vscode-errorForeground)' }}>
                                                                <Trash2 size={12} />
                                                            </IconButton>
                                                        </div>
                                                    </TreeItem>
                                                ))}

                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </Container>
    );
};
