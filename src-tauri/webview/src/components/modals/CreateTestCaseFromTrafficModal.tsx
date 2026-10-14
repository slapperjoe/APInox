/**
 * CreateTestCaseFromTrafficModal.tsx
 *
 * Right-click on captured proxy traffic → "Create Test Case from Traffic".
 * Pick the test suite the new case belongs to (or create a new one), then
 * pick which captured requests to include. Each selected log becomes a
 * standalone `request` step holding a raw, identical copy of the captured
 * call (method, URL, headers and body verbatim) — no variables, no
 * substitutions at this stage.
 */
import React, { useRef, useState } from 'react';
import styled from 'styled-components';
import { TestSuite } from '@shared/models';
import { FlaskConical, Plus } from 'lucide-react';
import type { TrafficLog } from '../proxy/TrafficViewer';
import { lastPathSegment } from '../../utils/trafficWorkflow';
import { Modal, Button } from './Modal';
import { SPACING_XS, SPACING_SM, SPACING_MD } from '../../styles/spacing';
import { EmptyState } from '../common/EmptyState';

const Body = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_MD};
    max-height: 70vh;
    overflow-y: auto;
`;

const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_XS};
`;

const SectionTitle = styled.div`
    font-size: 0.8em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.7;
`;

const Instruction = styled.div`
    font-size: 0.9em;
    opacity: 0.8;
`;

const Item = styled.div<{ $active?: boolean }>`
    padding: ${SPACING_XS};
    padding-left: ${SPACING_SM};
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

const CheckRow = styled.label`
    display: flex;
    align-items: center;
    gap: ${SPACING_XS};
    padding: ${SPACING_XS} ${SPACING_SM};
    cursor: pointer;
    border-radius: 4px;

    &:hover {
        background: var(--apinox-list-hoverBackground);
    }
`;

const Check = styled.input`
    accent-color: var(--apinox-button-background);
    cursor: pointer;
`;

const MethodTag = styled.span`
    font-size: 0.78em;
    font-weight: 600;
    min-width: 44px;
`;

const PathLabel = styled.code`
    font-size: 0.85em;
    opacity: 0.85;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const CountLabel = styled.span`
    font-size: 0.8em;
    opacity: 0.7;
`;

const NameInput = styled.input`
    width: 100%;
    box-sizing: border-box;
    padding: ${SPACING_XS} ${SPACING_SM};
    background: var(--apinox-input-background, transparent);
    color: inherit;
    border: 1px solid var(--apinox-input-border, rgba(128,128,128,0.35));
    border-radius: 4px;
    outline: none;

    &:focus {
        border-color: var(--apinox-focusBorder, #007fd4);
    }
`;

const SecondaryButton = styled(Button)`
    background: transparent;
    border: 1px solid var(--apinox-button-background);
`;

/** What the dialog resolves to when the user confirms. */
export interface CreateTestCaseFromTrafficResult {
    /** Where the new case lands: an existing suite, or a brand-new one. */
    suite: { kind: 'existing'; suiteId: string } | { kind: 'new'; name: string };
    /** Name for the new test case. */
    caseName: string;
    /** Selected captures, in capture order (oldest first). */
    selectedLogs: TrafficLog[];
}

interface CreateTestCaseFromTrafficModalProps {
    /** All captured traffic, in capture order (oldest first). */
    logs: TrafficLog[];
    /** The right-clicked log — pre-selected. */
    anchorLogId: string | null;
    testSuites: TestSuite[];
    onClose: () => void;
    onCreate: (result: CreateTestCaseFromTrafficResult) => void;
}

export const CreateTestCaseFromTrafficModal: React.FC<CreateTestCaseFromTrafficModalProps> = ({
    logs,
    anchorLogId,
    testSuites,
    onClose,
    onCreate,
}) => {
    // 'new' = the "New Suite..." row is active (no suite id yet).
    const [suiteSel, setSuiteSel] = useState<{ kind: 'existing'; suiteId: string } | { kind: 'new' } | null>(null);
    const [newSuiteName, setNewSuiteName] = useState('');
    // Default is derived from the selected suite's case count until the user
    // edits the field (caseNameEdited) — after that their text wins.
    const [caseName, setCaseName] = useState('TestCase 1');
    const caseNameEdited = useRef(false);
    const [selected, setSelected] = useState<Set<string>>(
        () => new Set(anchorLogId ? [anchorLogId] : []),
    );
    const selectAllRef = useRef<HTMLInputElement | null>(null);

    const toggleSelected = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const allSelected = logs.length > 0 && selected.size === logs.length;
    // Keep the select-all checkbox visually honest (indeterminate state).
    const selectAllRefCb = (el: HTMLInputElement | null) => {
        selectAllRef.current = el;
        if (el) el.indeterminate = selected.size > 0 && selected.size < logs.length;
    };
    const handleSelectAll = (checked: boolean) => {
        setSelected(checked ? new Set(logs.map(l => l.id)) : new Set());
    };

    const defaultCaseName = (sel: { kind: 'existing'; suiteId: string } | { kind: 'new' } | null): string => {
        if (sel?.kind === 'existing') {
            const suite = testSuites.find(s => s.id === sel.suiteId);
            return `TestCase ${(suite?.testCases?.length || 0) + 1}`;
        }
        return 'TestCase 1';
    };

    const selectSuite = (sel: { kind: 'existing'; suiteId: string } | { kind: 'new' }) => {
        setSuiteSel(sel);
        if (!caseNameEdited.current) {
            setCaseName(defaultCaseName(sel));
        }
    };

    const newSuiteValid = newSuiteName.trim().length > 0;
    const canCreate =
        selected.size > 0 &&
        ((suiteSel?.kind === 'existing') || (suiteSel?.kind === 'new' && newSuiteValid));

    const handleSubmit = () => {
        if (!canCreate || !suiteSel) return;
        // Preserve capture order — fire order = step order.
        const selectedLogs = logs.filter(l => selected.has(l.id));
        const suite = suiteSel.kind === 'existing'
            ? { kind: 'existing' as const, suiteId: suiteSel.suiteId }
            : { kind: 'new' as const, name: newSuiteName.trim() };
        onCreate({ suite, caseName: caseName.trim() || 'TestCase', selectedLogs });
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Create Test Case from Traffic"
            size="medium"
            footer={<>
                <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
                <Button disabled={!canCreate} onClick={handleSubmit}>Create Test Case</Button>
            </>}
        >
            <Body>
                <Instruction>
                    Choose the Test Suite this case belongs to, then pick which captured requests to include. Each is added as a raw, identical call.
                </Instruction>

                <Section>
                    <SectionTitle>Test Suite</SectionTitle>
                    {testSuites.length === 0 ? (
                        <EmptyState title="No Test Suites" />
                    ) : (
                        testSuites.map(suite => (
                            <Item
                                key={suite.id}
                                $active={suiteSel?.kind === 'existing' && suiteSel.suiteId === suite.id}
                                onClick={() => selectSuite({ kind: 'existing', suiteId: suite.id })}
                            >
                                <FlaskConical size={14} />
                                {suite.name}
                            </Item>
                        ))
                    )}
                    <Item
                        $active={suiteSel?.kind === 'new'}
                        onClick={() => selectSuite({ kind: 'new' })}
                    >
                        <Plus size={14} />
                        New Suite…
                    </Item>
                    {suiteSel?.kind === 'new' && (
                        <NameInput
                            aria-label="New suite name"
                            placeholder="Suite name"
                            value={newSuiteName}
                            onChange={(e) => setNewSuiteName(e.target.value)}
                        />
                    )}
                </Section>

                <Section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACING_XS }}>
                        <SectionTitle style={{ flex: 1 }}>Requests ({selected.size}/{logs.length})</SectionTitle>
                        <CheckRow
                            style={{ padding: 0 }}
                            data-testid="select-all-row"
                        >
                            <Check
                                ref={selectAllRefCb}
                                aria-label="Select all requests"
                                type="checkbox"
                                checked={allSelected}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                            />
                            <span style={{ fontSize: '0.8em', opacity: 0.7 }}>Select all</span>
                        </CheckRow>
                    </div>
                    {logs.length === 0 ? (
                        <EmptyState title="No Traffic Captured" />
                    ) : (
                        logs.map(log => {
                            const label = `${log.method} ${lastPathSegment(log.url)}`;
                            return (
                                <CheckRow
                                    key={log.id}
                                    title={log.url}
                                >
                                    <Check
                                        aria-label={label}
                                        type="checkbox"
                                        checked={selected.has(log.id)}
                                        onChange={() => toggleSelected(log.id)}
                                    />
                                    <MethodTag>{log.method}</MethodTag>
                                    <PathLabel>{lastPathSegment(log.url)}</PathLabel>
                                </CheckRow>
                            );
                        })
                    )}
                </Section>

                <Section>
                    <SectionTitle>Test Case Name</SectionTitle>
                    <NameInput
                        aria-label="Test case name"
                        value={caseName}
                        onChange={(e) => {
                            caseNameEdited.current = true;
                            setCaseName(e.target.value);
                        }}
                    />
                </Section>
            </Body>
        </Modal>
    );
};
