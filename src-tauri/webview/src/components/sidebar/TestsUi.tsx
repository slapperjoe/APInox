import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { Play, Plus, Trash2, ChevronDown, ChevronRight, FlaskConical, ListChecks, Clock, FileCode, ArrowRight, FileText } from 'lucide-react';
import { UnifiedProject, TestSuite } from '@shared/models';
import { SidebarContextMenu, CtxMenuSection, CtxMenuItem, Pencil } from './shared/SidebarContextMenu';
import { SidebarContainer, SidebarContent, SidebarHeader, SidebarHeaderActions, SidebarHeaderTitle, OperationItem, RequestItem } from './shared/SidebarStyles';
import { EmptyState } from '../common/EmptyState';
import { HeaderButton } from '../common/Button';
import { Tooltip } from '../common/Tooltip';
import { InlineFormInput } from '../common/Form';
import { SPACING_SM, SPACING_XS } from '../../styles/spacing';

const StepItem = styled(RequestItem)`
    padding-left: 52px !important;
    font-size: 0.9em;
    opacity: 0.9;
    
    &:hover {
        opacity: 1;
    }
`;

const TestsContainer = styled(SidebarContainer)``;

const TestsContent = styled(SidebarContent)``;

const HeaderActions = styled.div`
    position: relative;
`;

const SuiteOperationItem = styled(OperationItem)`
    padding-left: 8px;
`;

const SuiteToggle = styled.span<{ $hasChildren?: boolean }>`
    cursor: ${props => (props.$hasChildren ? 'pointer' : 'default')};
    display: flex;
    align-items: center;
    /* Fixed-width chevron slot: rendered empty (no chevron) when the suite
       has no test cases, so rows line up with expandable rows and there is
       no dead toggle to click (matches the unified explorer TreeItem). */
    width: 14px;
    flex-shrink: 0;
`;

const SuiteIcon = styled.span`
    margin-left: ${SPACING_XS};
    display: flex;
    align-items: center;
`;

const SuiteName = styled.span`
    flex: 1;
    margin-left: ${SPACING_XS};
    font-weight: var(--fw-bold);
`;

const SuiteCount = styled.span`
    font-size: 0.8em;
    opacity: 0.6;
    margin-right: ${SPACING_XS};
`;

const CaseRequestItem = styled(RequestItem)`
    padding-left: 35px;
`;

const CaseToggle = styled.span<{ $hasChildren?: boolean }>`
    cursor: ${props => (props.$hasChildren ? 'pointer' : 'default')};
    display: flex;
    align-items: center;
    margin-right: ${SPACING_XS};
    width: 14px;
    /* Fixed-width chevron slot (empty when the case has no steps) so rows
       line up and there is no dead toggle — same pattern as SuiteToggle. */
    flex-shrink: 0;
`;

const CaseName = styled.span`
    flex: 1;
`;

const CaseCount = styled.span`
    font-size: 0.75em;
    opacity: 0.6;
    margin-right: ${SPACING_XS};
`;

const StepTypeIcon = styled.span`
    display: flex;
    align-items: center;
    margin-right: ${SPACING_XS};
    opacity: 0.7;
`;

const StepName = styled.span`
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const AddSuiteRow = styled.div`
    padding: ${SPACING_SM};
`;

export interface TestsUiProps {
    // Phase B (t_86c34d38) → C (global suites): `testSuites` is the single
    // source of truth for the TESTS rail (the global store). When omitted,
    // the rail falls back to `projects[].testSuites` (kept for component
    // tests that render without a provider).
    testSuites?: TestSuite[];
    projects: UnifiedProject[];
    selectedTestSuite?: TestSuite | null;
    selectedTestCase?: any | null;
    onAddSuite: (projectName?: string, suiteName?: string) => void;
    onDeleteSuite: (suiteId: string) => void;
    onRunSuite: (suiteId: string) => void;
    onAddTestCase: (suiteId: string) => void;
    onDeleteTestCase: (caseId: string) => void;
    onRenameTestCase?: (caseId: string, newName: string) => void;
    onRenameSuite?: (suiteId: string, newName: string) => void;
    onRunCase: (caseId: string) => void;
    onSelectSuite: (suiteId: string) => void;
    onSelectTestCase: (caseId: string) => void;
    onToggleSuiteExpand: (suiteId: string) => void;
    onToggleCaseExpand: (caseId: string) => void;
    onSelectTestStep?: (caseId: string, stepId: string) => void;
    onRenameTestStep?: (caseId: string, stepId: string, newName: string) => void;
    deleteConfirm: string | null;
}

interface FlatSuite {
    suite: TestSuite;
    projectName: string;
}

export const TestsUi: React.FC<TestsUiProps> = ({
    testSuites,
    projects,
    selectedTestSuite,
    selectedTestCase,
    onAddSuite,
    onDeleteSuite,
    onRunSuite,
    onAddTestCase,
    onDeleteTestCase,
    onRenameTestCase,
    onRenameSuite,
    onRunCase,
    onSelectSuite,
    onSelectTestCase,
    onToggleSuiteExpand,
    onToggleCaseExpand,
    onSelectTestStep,
    onRenameTestStep,
    deleteConfirm
}) => {
    const addSuiteBtnRef = useRef<HTMLButtonElement>(null);
    const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
    const [renameId, setRenameId] = useState<string | null>(null);
    const [renameType, setRenameType] = useState<'case' | 'step' | 'suite' | null>(null);
    const [renameParentId, setRenameParentId] = useState<string | null>(null);
    const [renameName, setRenameName] = useState('');

    // New suite creation state
    const [isAddingSuite, setIsAddingSuite] = useState(false);
    const [newSuiteName, setNewSuiteName] = useState('');

    // Context menu state (cases/steps: rename; suites: run/rename/add-case/delete)
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; caseId?: string; suiteId?: string; stepId?: string; name: string; type: 'case' | 'step' | 'suite' } | null>(null);

    const handleContextMenu = (e: React.MouseEvent, name: string, type: 'case' | 'step' | 'suite', caseId?: string, stepId?: string, suiteId?: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, name, type, caseId, stepId, suiteId });
    };

    const closeContextMenu = () => {
        setContextMenu(null);
    };

    const handleRenameFromMenu = () => {
        if (contextMenu) {
            const targetId = contextMenu.stepId || contextMenu.caseId || contextMenu.suiteId || null;
            setRenameId(targetId);
            setRenameType(contextMenu.type);
            setRenameParentId(contextMenu.caseId ?? null); // For steps, caseId is the parent; unused for cases/suites.
            setRenameName(contextMenu.name);
            closeContextMenu();
        }
    };

    const submitRename = () => {
        console.log('[TestsUi] submitRename called:', { renameId, renameName, renameType, renameParentId });
        if (renameId && renameName.trim()) {
            if (renameType === 'step' && renameParentId && onRenameTestStep) {
                console.log('[TestsUi] Calling onRenameTestStep');
                onRenameTestStep(renameParentId, renameId, renameName.trim());
            } else if (renameType === 'case' && onRenameTestCase) {
                console.log('[TestsUi] Calling onRenameTestCase');
                onRenameTestCase(renameId, renameName.trim());
            } else if (renameType === 'suite' && onRenameSuite) {
                onRenameSuite(renameId, renameName.trim());
            }
        }
        setRenameId(null);
        setRenameType(null);
        setRenameParentId(null);
        setRenameName('');
    };

    const cancelRename = () => {
        setRenameId(null);
        setRenameType(null);
        setRenameParentId(null);
        setRenameName('');
    };

    // C (global suites): the `+` button opens the suite-name input directly —
    // there is no owning project to pick (suites are global). The old
    // project-picker menu is gone.
    const openAddSuite = () => {
        const count = (testSuites ?? projects.flatMap(p => p.testSuites || [])).length;
        setNewSuiteName(`TestSuite ${count + 1}`);
        setIsAddingSuite(true);
    };

    const submitNewSuite = () => {
        if (newSuiteName.trim()) {
            onAddSuite(undefined, newSuiteName.trim());
            setIsAddingSuite(false);
            setNewSuiteName('');
        } else {
            setIsAddingSuite(false);
            setNewSuiteName('');
        }
    };

    const cancelNewSuite = () => {
        setIsAddingSuite(false);
        setNewSuiteName('');
    };

    // Global suites when provided (the single source of truth); otherwise fall
    // back to the per-project suites (component tests without a provider).
    const effectiveSuites: TestSuite[] = testSuites
        ?? Array.from(new Map(projects.flatMap(p => (p.testSuites || []).map(s => [s.id, s]))).values());
    const allSuites: FlatSuite[] = effectiveSuites.map(suite => ({ suite, projectName: '' }));

    // Two-click confirm for the RIGHT-CLICK menu (the only delete entry point):
    // the first click arms `deleteConfirm` and the menu stays open
    // (label → "Click again to delete"); the second click deletes and closes.
    const menuDelete = (targetId: string, handler: (id: string) => void) => {
        const wasArmed = deleteConfirm === targetId;
        // The handler does the two-click work: arms on click 1, deletes on click 2.
        handler(targetId);
        // Only close after the delete actually happened (the armed click).
        if (wasArmed) closeContextMenu();
    };

    // The suite the (open) context menu targets — gates the menu's Run action
    // on it having cases, matching the inline-button gating.
    const menuSuite = contextMenu?.type === 'suite'
        ? effectiveSuites.find(s => s.id === contextMenu.suiteId)
        : undefined;


    return (
        <>
            <TestsContainer>
                {/* Header */}
                <SidebarHeader>
                    <SidebarHeaderTitle>
                        Test Suites ({allSuites.length})
                    </SidebarHeaderTitle>
                    <SidebarHeaderActions>
                        <HeaderActions>
                            <Tooltip content="Add Test Suite">
                              <HeaderButton ref={addSuiteBtnRef} onClick={openAddSuite}>
                                <Plus size={16} />
                              </HeaderButton>
                            </Tooltip>
                        </HeaderActions>
                    </SidebarHeaderActions>
                </SidebarHeader>

                <TestsContent>

                    {/* Inline Suite Name Input */}
                    {isAddingSuite && (
                        <AddSuiteRow>
                            <InlineFormInput
                                autoFocus
                                placeholder="Suite Name"
                                value={newSuiteName}
                                onChange={e => setNewSuiteName(e.target.value)}
                                onBlur={submitNewSuite}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') submitNewSuite();
                                    if (e.key === 'Escape') cancelNewSuite();
                                }}
                                style={{ width: '100%' }}
                            />
                        </AddSuiteRow>
                    )}

                    {/* Empty State */}
                    {allSuites.length === 0 && (
                        <EmptyState
                            icon={FlaskConical}
                            title="No test suites yet."
                            description="Click + to add a test suite."
                        />
                    )}

                    {/* Unique Test Suites List — C (global suites): render the
                        effective (global-first) list, not raw per-project. */}
                    {allSuites.map(({ suite }) => {
                        const isSuiteSelected = selectedTestSuite?.id === suite.id && !selectedTestCase;
                        const hasCases = (suite.testCases || []).length > 0;
                        return (
                            <div key={suite.id}>
                                {/* Suite Header */}
                                <SuiteOperationItem
                                    $active={isSuiteSelected}
                                    onClick={() => {
                                        // Notify parent - let context handle state
                                        onSelectSuite(suite.id);
                                    }}
                                    onContextMenu={(e) => handleContextMenu(e, suite.name, 'suite', undefined, undefined, suite.id)}
                                >
                                    <SuiteToggle
                                        $hasChildren={hasCases}
                                        onClick={hasCases ? (e) => { e.stopPropagation(); onToggleSuiteExpand(suite.id); } : undefined}
                                    >
                                        {hasCases && (suite.expanded !== false ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                                    </SuiteToggle>
                                    <SuiteIcon>
                                        <ListChecks size={14} />
                                    </SuiteIcon>
                                    {renameId === suite.id ? (
                                        <InlineFormInput
                                            type="text"
                                            title="Rename test suite"
                                            placeholder="Rename"
                                            value={renameName}
                                            onChange={(e) => setRenameName(e.target.value)}
                                            onBlur={submitRename}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') submitRename();
                                                if (e.key === 'Escape') cancelRename();
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            autoFocus
                                        />
                                    ) : (
                                        <SuiteName title="Right-click for suite actions">{suite.name}</SuiteName>
                                    )}
                                    <SuiteCount>
                                        ({suite.testCases?.length || 0})
                                    </SuiteCount>
                                    {isSuiteSelected && hasCases && (
                                        <Tooltip content="Run Suite">
                                          <HeaderButton onClick={(e) => { e.stopPropagation(); onRunSuite(suite.id); }}>
                                            <Play size={12} />
                                          </HeaderButton>
                                        </Tooltip>
                                    )}
                                </SuiteOperationItem>

                                {/* Test Cases */}
                                {suite.expanded !== false && (suite.testCases || []).map(tc => {
                                    const isSelected = selectedTestCase?.id === tc.id;
                                    const hasSteps = (tc.steps || []).length > 0;
                                    return (
                                        <React.Fragment key={tc.id}>
                                            <CaseRequestItem
                                                $active={isSelected}
                                                onClick={() => {
                                                    // Notify parent - let context handle state
                                                    onSelectTestCase(tc.id);
                                                }}
                                                onContextMenu={(e) => handleContextMenu(e, tc.name, 'case', tc.id)}
                                            >
                                                <CaseToggle
                                                    $hasChildren={hasSteps}
                                                    onClick={hasSteps ? (e) => { e.stopPropagation(); onToggleCaseExpand(tc.id); } : undefined}
                                                >
                                                    {hasSteps && (tc.expanded !== false ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                                                </CaseToggle>
                                                {renameId === tc.id ? (
                                                    <InlineFormInput
                                                        type="text"
                                                        title="Rename test case"
                                                        placeholder="Rename"
                                                        value={renameName}
                                                        onChange={(e) => setRenameName(e.target.value)}
                                                        onBlur={submitRename}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') submitRename();
                                                            if (e.key === 'Escape') cancelRename();
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <CaseName title="Right-click to rename">{tc.name}</CaseName>
                                                )}
                                                <CaseCount>
                                                    {tc.steps?.length || 0}
                                                </CaseCount>
                                            </CaseRequestItem>

                                            {/* Test Steps */}
                                            {tc.expanded !== false && (tc.steps || []).map(step => (
                                                <StepItem
                                                    key={step.id}
                                                    $active={selectedStepId === step.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedStepId(step.id);
                                                        // Also select the parent case if we want context, but usually explicit step selection is enough
                                                        // if (selectedCaseId !== tc.id) setSelectedCaseId(tc.id);
                                                        if (onSelectTestStep) onSelectTestStep(tc.id, step.id);
                                                    }}
                                                    onContextMenu={(e) => handleContextMenu(e, step.name, 'step', tc.id, step.id)}
                                                >
                                                    {renameId === step.id ? (
                                                        <InlineFormInput
                                                            type="text"
                                                            title="Rename test step"
                                                            placeholder="Rename"
                                                            value={renameName}
                                                            onChange={(e) => setRenameName(e.target.value)}
                                                            onBlur={submitRename}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') submitRename();
                                                                if (e.key === 'Escape') cancelRename();
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            autoFocus
                                                            style={{ marginLeft: '4px', fontSize: '0.9em' }}
                                                        />
                                                    ) : (
                                                        <>
                                                            <StepTypeIcon>
                                                                {(() => {
                                                                    switch (step.type) {
                                                                        case 'delay': return <Clock size={12} />;
                                                                        case 'transfer': return <ArrowRight size={12} />;
                                                                        case 'script': return <FileCode size={12} />;
                                                                        case 'request':
                                                                        default: return <FileText size={12} />;
                                                                    }
                                                                })()}
                                                            </StepTypeIcon>
                                                            <StepName title="Right-click to rename">
                                                                {step.name}
                                                            </StepName>
                                                        </>
                                                    )}
                                                </StepItem>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        );
                    })}
                </TestsContent>
            </TestsContainer>

            {/* Context Menu — suites: run/rename/add-case/delete; cases:
                run/rename/delete; steps: rename. Menu deletes are deliberate
                (force) — the 2-click confirm is reserved for the inline buttons. */}
            {contextMenu && (
                <SidebarContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    sections={
                        contextMenu.type === 'suite' && contextMenu.suiteId ? [
                            {
                                title: 'Suite',
                                items: [
                                    ...(menuSuite && (menuSuite.testCases?.length || 0) > 0
                                        ? [{ icon: Play, label: 'Run Suite', onClick: () => { onRunSuite(contextMenu.suiteId!); closeContextMenu(); } }]
                                        : []),
                                    { icon: Pencil, label: 'Rename', onClick: handleRenameFromMenu },
                                    { icon: Plus, label: 'Add Test Case', onClick: () => { onAddTestCase(contextMenu.suiteId!); closeContextMenu(); } },
                                    { icon: Trash2, label: deleteConfirm === contextMenu.suiteId ? 'Click again to delete' : 'Delete', danger: deleteConfirm === contextMenu.suiteId, onClick: () => menuDelete(contextMenu.suiteId!, onDeleteSuite) }
                                ]
                            }
                        ]
                        : contextMenu.type === 'case' && contextMenu.caseId ? [
                            {
                                title: 'Test Case',
                                items: [
                                    { icon: Play, label: 'Run Test Case', onClick: () => { onRunCase(contextMenu.caseId!); closeContextMenu(); } },
                                    { icon: Pencil, label: 'Rename', onClick: handleRenameFromMenu },
                                    { icon: Trash2, label: deleteConfirm === contextMenu.caseId ? 'Click again to delete' : 'Delete', danger: deleteConfirm === contextMenu.caseId, onClick: () => menuDelete(contextMenu.caseId!, onDeleteTestCase) }
                                ]
                            }
                        ]
                        : [{ title: 'Actions', items: [{ icon: Pencil, label: 'Rename', onClick: handleRenameFromMenu }] }
                    ] as CtxMenuSection[]}
                    onClose={closeContextMenu}
                />
            )}
        </>
    );
};
