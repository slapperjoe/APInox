/**
 * VariablesEditor — a reusable name→value row editor for a variables map
 * (used at the test-suite, test-case, and workflow scope). Mirrors the
 * WorkflowPropertiesPanel editor: every keystroke commits the whole trimmed
 * map via onChange (empty names dropped), rows carry `placeholder` name/value
 * inputs and an `aria-label`ed remove button, and a `+ Add variable` button
 * appends a blank row. Reads/writes a plain `Record<string, string>`.
 */
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { SPACING_XS, SPACING_SM } from '../../styles/spacing';

interface VariableRow {
    name: string;
    value: string;
}

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
    const [rows, setRows] = useState<VariableRow[]>(() =>
        Object.entries(variables || {}).map(([name, value]) => ({ name, value: String(value) })));

    useEffect(() => {
        setRows(Object.entries(variables || {}).map(([name, value]) => ({ name, value: String(value) })));
    }, [variables]);

    const commit = (next: VariableRow[]) => {
        const map: Record<string, string> = {};
        for (const r of next) {
            if (r.name.trim()) map[r.name.trim()] = r.value;
        }
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
