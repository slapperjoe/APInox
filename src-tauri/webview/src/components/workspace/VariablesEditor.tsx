/**
 * VariablesEditor — a reusable name→value row editor for a variables map
 * (used at the test-suite, test-case, and workflow scope). Mirrors the
 * WorkflowPropertiesPanel editor: every keystroke commits the whole trimmed
 * map via onChange (empty names dropped), rows carry `placeholder` name/value
 * inputs and an `aria-label`ed remove button, and a `+ Add variable` button
 * appends a blank row. Reads/writes a plain `Record<string, string>`.
 */
import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { SPACING_XS, SPACING_SM } from '../../styles/spacing';

interface VariableRow {
    name: string;
    value: string;
}

/** Rows for a committed map (undefined/empty → no rows). */
const rowsFromVariables = (variables?: Record<string, string>): VariableRow[] =>
    Object.entries(variables || {}).map(([name, value]) => ({ name, value: String(value) }));

/** The map rows commit to (empty names dropped). */
const mapFromRows = (rows: VariableRow[]): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const r of rows) {
        if (r.name.trim()) map[r.name.trim()] = r.value;
    }
    return map;
};

/** Content-equal variable maps (order-independent). */
const sameVariables = (a: Record<string, string>, b: Record<string, string>): boolean => {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(k => a[k] === b[k]);
};

const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_XS};
`;

const Header = styled.div`
    font-size: var(--apinox-fs-sm);
    font-weight: var(--fw-semibold);
    color: var(--apinox-descriptionForeground);
    text-transform: uppercase;
    letter-spacing: 0.03em;
`;

const Hint = styled.div`
    font-size: var(--apinox-fs-sm);
    color: var(--apinox-descriptionForeground);
    opacity: 0.7;
`;

const Empty = styled.div`
    font-size: var(--apinox-fs-sm);
    opacity: 0.6;
    padding: ${SPACING_XS} 0;
`;

const Rows = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_XS};
`;

const Row = styled.div`
    display: flex;
    gap: ${SPACING_XS};
`;

const Input = styled.input`
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    background: var(--apinox-input-background);
    color: var(--apinox-input-foreground);
    border: 1px solid var(--apinox-input-border);
    border-radius: 2px;
    font-size: var(--apinox-fs-sm);
    font-family: inherit;
    outline: none;
    &:focus {
        border-color: var(--apinox-focusBorder);
    }
`;

const NameInput = styled(Input)`
    flex: 2;
`;

const ValueInput = styled(Input)`
    flex: 3;
`;

const RemoveButton = styled.button`
    flex-shrink: 0;
    width: 26px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 2px;
    color: var(--apinox-descriptionForeground);
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    &:hover {
        color: var(--apinox-tertiaryButton-foreground);
        border-color: var(--apinox-input-border);
    }
`;

const AddButton = styled.button`
    align-self: flex-start;
    padding: 4px 8px;
    background: transparent;
    border: 1px dashed var(--apinox-input-border);
    border-radius: 2px;
    color: var(--apinox-foreground);
    font-size: var(--apinox-fs-sm);
    cursor: pointer;
    &:hover {
        border-color: var(--apinox-focusBorder);
        color: var(--apinox-focusBorder);
    }
`;

interface VariablesEditorProps {
    /** Current committed variable map (undefined/empty → shows the empty state). */
    variables?: Record<string, string>;
    /** Commit the full map (called on every edit). */
    onChange: (variables: Record<string, string>) => void;
    /** Optional: render the standard "Variables" header first (default true). */
    showHeader?: boolean;
    /** Optional helper text below the rows. */
    hint?: string;
}

export const VariablesEditor: React.FC<VariablesEditorProps> = ({
    variables,
    onChange,
    showHeader = true,
    hint,
}) => {
    const [rows, setRows] = useState<VariableRow[]>(() => rowsFromVariables(variables));

    /** The last map committed via onChange. The `variables` prop reflects our
     *  own commits back with a NEW object identity (the global-store
     *  round-trip re-hydrates the case/suite); resetting local rows from such
     *  an echo would wipe the transient blank row that "+ Add variable" just
     *  created — the blank row is never committed (empty names are dropped),
     *  so it can't survive a prop-driven reset. Only reset on a genuinely
     *  external change: incoming content that differs from the last commit. */
    const lastCommittedRef = useRef<Record<string, string> | null>(null);
    const mountedRef = useRef(false);

    useEffect(() => {
        if (!mountedRef.current) {
            // Initial rows were already built in the useState initializer.
            mountedRef.current = true;
            return;
        }
        const last = lastCommittedRef.current;
        if (last !== null && sameVariables(variables ?? {}, last)) {
            return; // own commit reflected back — local rows are authoritative
        }
        setRows(rowsFromVariables(variables));
    }, [variables]);

    const commit = (next: VariableRow[]) => {
        const map = mapFromRows(next);
        lastCommittedRef.current = map;
        onChange(map);
    };

    const updateRow = (index: number, patch: Partial<VariableRow>) => {
        const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
        setRows(next);
        commit(next);
    };

    const addRow = () => {
        const next = [...rows, { name: '', value: '' }];
        setRows(next);
        commit(next);
    };

    const removeRow = (index: number) => {
        const next = rows.filter((_, i) => i !== index);
        setRows(next);
        commit(next);
    };

    return (
        <Section>
            {showHeader && <Header>Variables</Header>}
            {rows.length === 0 ? (
                <Empty>No variables yet. Add one below.</Empty>
            ) : (
                <Rows>
                    {rows.map((v, i) => (
                        <Row key={i}>
                            <NameInput
                                type="text"
                                placeholder="name"
                                aria-label={`Variable name ${i}`}
                                value={v.name}
                                onChange={(e) => updateRow(i, { name: e.target.value })}
                            />
                            <ValueInput
                                type="text"
                                placeholder="value"
                                aria-label={`Variable value ${i}`}
                                value={v.value}
                                onChange={(e) => updateRow(i, { value: e.target.value })}
                            />
                            <RemoveButton
                                aria-label={`Remove variable ${i}`}
                                title="Remove variable"
                                onClick={() => removeRow(i)}
                            >
                                ×
                            </RemoveButton>
                        </Row>
                    ))}
                </Rows>
            )}
            <AddButton onClick={addRow}>+ Add variable</AddButton>
            {hint && <Hint>{hint}</Hint>}
        </Section>
    );
};
