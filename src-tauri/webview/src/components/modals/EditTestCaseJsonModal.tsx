import React, { useState } from 'react';
import styled from 'styled-components';
import { Modal } from './Modal';
import { MonacoEditorWrapper } from '../../request-editor/monaco';
import { useTheme, useEditorSettings } from '../../request-editor/core';
import { ErrorDetailBanner } from '../../request-editor/components/common/ErrorDetailBanner';
import { PrimaryButton, SecondaryButton } from '../common/Button';
import { TestCase, TestStepType } from '@shared/models';
import { SPACING_SM, SPACING_XS } from '../../styles/spacing';
import { tokens } from '../proxy/tokens';

const STEP_TYPES: TestStepType[] = [
    'request',
    'delay',
    'transfer',
    'script',
    'condition',
    'loop',
    'testCase',
];

/**
 * Raw JSON editor for a test case.
 *
 * The step editors guarantee shapes raw text cannot: `type` must be one of the
 * `TestStepType` members and each type has its own `config` fields. This is the escape
 * hatch for what those editors cannot do — renaming a `{{token}}` across every step body,
 * which is exactly what Monaco's find-and-replace (Ctrl+F / Ctrl+H) is for. The variables
 * panel edits values; it cannot rename a name.
 *
 * The document shown is the case as the global store holds it (`test-suites.json`) — the
 * same object `Export Test Case` writes. The historical per-project layout split a case
 * into `case.json` plus one file per step; that layout is retired, so there is no
 * per-file view.
 */
export interface EditTestCaseJsonModalProps {
    testCase: TestCase;
    onSave: (testCase: TestCase) => void;
    onClose: () => void;
}

/**
 * Validation is deliberately minimal. A raw editor exists precisely so you can write
 * something the UI would not allow, so only the fields the runner actually depends on are
 * checked: the shape of the case, and each step's `id` / `name` / `type`.
 *
 * `expectedId` blocks changing the case `id`. It is the key the store, the runner and the
 * current selection all resolve against, so a raw edit that renames it leaves the UI
 * pointing at a case that no longer exists — and unlike the other fields, there is no way
 * to recover it by editing the text back, because the entry is already filed under the old
 * key. Step ids are left editable: a transfer pointing at a missing step is a warning
 * rather than an error, because the document may be mid-restructure.
 *
 * Dangling transfer references are a warning rather than a block — they silently do nothing
 * at run time, so it is worth saying out loud before saving.
 */
export function validateTestCaseDocument(
    parsed: unknown,
    expectedId?: string
): { error?: string; warnings: string[] } {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { error: 'The document must be a test case object.', warnings: [] };
    }

    const tc = parsed as Record<string, unknown>;
    if (typeof tc.id !== 'string' || tc.id.length === 0) {
        return { error: '`id` must be a non-empty string.', warnings: [] };
    }
    if (expectedId !== undefined && tc.id !== expectedId) {
        return {
            error: `The case \`id\` cannot be changed — it is the key the store and the runner resolve against. Expected "${expectedId}".`,
            warnings: [],
        };
    }
    if (typeof tc.name !== 'string' || tc.name.length === 0) {
        return { error: '`name` must be a non-empty string.', warnings: [] };
    }
    if (!Array.isArray(tc.steps)) {
        return { error: '`steps` must be an array.', warnings: [] };
    }

    const steps = tc.steps as Record<string, unknown>[];
    const ids = new Set<string>();

    for (const step of steps) {
        if (typeof step.id !== 'string' || step.id.length === 0) {
            return { error: 'Every step needs a non-empty `id`.', warnings: [] };
        }
        if (typeof step.name !== 'string' || step.name.length === 0) {
            return { error: 'Every step needs a non-empty `name`.', warnings: [] };
        }
        if (typeof step.type !== 'string' || !STEP_TYPES.includes(step.type as TestStepType)) {
            return {
                error: `Step "${step.name}" has an unknown type: ${String(step.type)}.`,
                warnings: [],
            };
        }
        ids.add(step.id);
    }

    const warnings: string[] = [];
    for (const step of steps) {
        const config = (step.config ?? {}) as Record<string, unknown>;
        for (const key of ['sourceStepId', 'targetStepId']) {
            const ref = config[key];
            if (typeof ref === 'string' && ref.length > 0 && !ids.has(ref)) {
                warnings.push(
                    `Step "${step.name}" references ${key} "${ref}", which is not in this case — it will do nothing at run time.`
                );
            }
        }
    }

    return { warnings };
}

const Body = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_SM};
    height: 60vh;
`;

const WarningList = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${SPACING_XS};
    font-size: var(--apinox-fs-sm);
    color: ${tokens.status.warning};
`;

const Hint = styled.div`
    font-size: var(--apinox-fs-sm);
    color: var(--apinox-descriptionForeground);
`;

export const EditTestCaseJsonModal: React.FC<EditTestCaseJsonModalProps> = ({
    testCase,
    onSave,
    onClose,
}) => {
    const { monacoTheme } = useTheme();
    // The shared settings store (config.ui) — the same font size every other editor uses.
    const { settings } = useEditorSettings();
    const [text, setText] = useState(() => JSON.stringify(testCase, null, 2));
    const [error, setError] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);

    const handleSave = () => {
        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            setError(`Cannot save: invalid JSON — ${(e as Error).message}`);
            return;
        }

        const result = validateTestCaseDocument(parsed, testCase.id);
        setError(result.error ?? null);
        setWarnings(result.warnings);
        if (result.error) return;

        onSave(parsed as TestCase);
        onClose();
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={`Edit as JSON — ${testCase.name}`}
            size="xlarge"
            footer={
                <>
                    <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
                    <PrimaryButton onClick={handleSave}>Save</PrimaryButton>
                </>
            }
        >
            <Body>
                <Hint>
                    Find and replace across the whole case (Ctrl+F / Ctrl+H). Saving replaces
                    this case in the global store, so a malformed document affects the run. The
                    case `id` cannot change — it is the key the store and the runner use.
                </Hint>

                {error && <ErrorDetailBanner message={error} testId="json-error" />}

                {warnings.length > 0 && (
                    <WarningList data-testid="json-warnings">
                        {warnings.map((w) => (
                            <div key={w}>{w}</div>
                        ))}
                    </WarningList>
                )}

                <div style={{ flex: 1, minHeight: 0 }}>
                    <MonacoEditorWrapper
                        height="100%"
                        language="json"
                        theme={monacoTheme}
                        value={text}
                        onChange={(v) => setText(v || '')}
                        options={{
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            fontSize: settings.fontSize,
                        }}
                    />
                </div>
            </Body>
        </Modal>
    );
};
