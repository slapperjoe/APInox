import React, { useState } from 'react';
import styled from 'styled-components';
import { EmptyState } from '../common/EmptyState';
import { UnifiedProject, TestSuite } from '@shared/models';
import { FlaskConical, Play } from 'lucide-react';
import { Modal, Button } from './Modal';
import { SPACING_XS, SPACING_SM, SPACING_MD } from '../../styles/spacing';

const Body = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_MD};
    max-height: 60vh;
    overflow-y: auto;
`;

const Instruction = styled.div`
    font-size: 0.9em;
    opacity: 0.8;
`;

const Item = styled.div<{ $active?: boolean; $depth: number }>`
    padding: ${SPACING_XS};
    padding-left: ${props => props.$depth * 20 + 5}px;
    cursor: pointer;
    background: ${props => props.$active ? 'var(--apinox-list-activeSelectionBackground)' : 'transparent'};
    color: ${props => props.$active ? 'var(--apinox-list-activeSelectionForeground)' : 'inherit'};
    display: flex;
    align-items: center;
    gap: ${SPACING_XS};
    
    &:hover {
        background: ${props => props.$active ? 'var(--apinox-list-activeSelectionBackground)' : 'var(--apinox-list-hoverBackground)'};
    }
`;


const SecondaryButton = styled(Button)`
    background: transparent;
    border: 1px solid var(--apinox-button-background);
`;

interface AddToTestCaseModalProps {
    projects: UnifiedProject[];
    // C (global suites): the flat global suite list (the single source of
    // truth). When omitted, falls back to `projects[].testSuites` (component
    // tests that render without the global store).
    testSuites?: TestSuite[];
    onClose: () => void;
    onAdd: (target: { type: 'new' | 'existing', suiteId?: string, caseId?: string }) => void;
}

export const AddToTestCaseModal: React.FC<AddToTestCaseModalProps> = ({ projects, testSuites, onClose, onAdd }) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectionType, setSelectionType] = useState<'suite' | 'case' | null>(null);

    // Global suites when provided (the single source of truth); otherwise fall
    // back to the per-project suites (component tests without the global store).
    const effectiveSuites: TestSuite[] = testSuites
        ?? Array.from(new Map(projects.flatMap(p => (p.testSuites || []).map(s => [s.id, s]))).values());

    const handleSelect = (id: string, type: 'suite' | 'case') => {
        setSelectedId(id);
        setSelectionType(type);
    };

    const handleSubmit = () => {
        if (!selectedId || !selectionType) return;

        if (selectionType === 'suite') {
            onAdd({ type: 'new', suiteId: selectedId });
        } else {
            onAdd({ type: 'existing', caseId: selectedId });
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Add to Test Case"
            size="small"
            footer={<>
                <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
                <Button disabled={!selectedId} onClick={handleSubmit}>
                    {selectionType === 'suite' ? 'Create New Case' : 'Add to Case'}
                </Button>
            </>}
        >
            <Body>
                <Instruction>
                    Select a Test Case to append to, or a Test Suite to create a new Case in.
                </Instruction>
                {effectiveSuites.length === 0 ? (
                    <EmptyState title="No Test Suites" />
                ) : (
                    effectiveSuites.map(suite => (
                        <div key={suite.id}>
                            <Item
                                $depth={1}
                                $active={selectedId === suite.id}
                                onClick={() => handleSelect(suite.id, 'suite')}
                            >
                                <FlaskConical size={14} />
                                {suite.name}
                            </Item>
                            {(suite.testCases || []).map(tc => (
                                <Item
                                    key={tc.id}
                                    $depth={2}
                                    $active={selectedId === tc.id}
                                    onClick={() => handleSelect(tc.id, 'case')}
                                >
                                    <Play size={12} />
                                    {tc.name}
                                </Item>
                            ))}
                        </div>
                    ))
                )}
            </Body>
        </Modal>
    );
};
