import React, { useState } from 'react';
import styled from 'styled-components';
import { Modal } from './Modal';
import { MonacoEditorWrapper } from '../../request-editor/monaco';
import { useTheme, useEditorSettings } from '../../request-editor/core';
import { ErrorDetailBanner } from '../../request-editor/components/common/ErrorDetailBanner';
import { PrimaryButton, SecondaryButton } from '../common/Button';
import { SPACING_SM, SPACING_XS } from '../../styles/spacing';
import { tokens } from '../proxy/tokens';
import { validateJsonDocument, type EntityValidator } from '../../utils/jsonValidators';

/**
 * Raw JSON editor for a store entity.
 *
 * The structured editors guarantee shapes raw text cannot — a step's `type` must be one of
 * the TestStepType members and each type has its own `config` fields. This is the escape
 * hatch for what those editors cannot do: renaming a `{{token}}` across every step body,
 * which is exactly what Monaco's find-and-replace (Ctrl+F / Ctrl+H) is for. The variables
 * panel edits values; it cannot rename a name.
 *
 * The document shown is the entity as the global store holds it — the same object
 * `Export Test Case` / `Export Suite` write. The historical per-project layout split a case
 * into `case.json` plus one file per step; that layout is retired, so there is no per-file
 * view.
 *
 * Validation lives in `utils/jsonValidators.ts` so this modal can stay lazily loaded.
 */
export interface EditJsonModalProps {
    document: unknown;
    /** Shown in the hint, e.g. "test case". */
    entityLabel: string;
    /** The key the store resolves against — changing it is blocked. */
    expectedId: string;
    entityValidator: EntityValidator;
    onSave: (document: any) => void;
    onClose: () => void;
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

export const EditJsonModal: React.FC<EditJsonModalProps> = ({
    document,
    entityLabel,
    expectedId,
    entityValidator,
    onSave,
    onClose,
}) => {
    const { monacoTheme } = useTheme();
    // The shared settings store (config.ui) — the same font size every other editor uses.
    const { settings } = useEditorSettings();
    const [text, setText] = useState(() => JSON.stringify(document, null, 2));
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

        const result = validateJsonDocument(parsed, expectedId, entityValidator);
        setError(result.error ?? null);
        setWarnings(result.warnings);
        if (result.error) return;

        onSave(parsed);
        onClose();
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={`Edit as JSON — ${(document as { name?: string })?.name ?? entityLabel}`}
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
                    Find and replace across the whole {entityLabel} (Ctrl+F / Ctrl+H). Saving
                    replaces it in the global store, so a malformed document affects the run.
                    The `id` cannot change — it is the key the store and the runner use.
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
