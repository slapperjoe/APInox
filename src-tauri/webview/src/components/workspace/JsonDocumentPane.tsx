/**
 * Raw JSON editor for a store entity — as a workspace pane, not a dialog.
 *
 * It replaced a modal. The modal was the weaker UI for three reasons: it could not stay open,
 * it could not be used alongside the structured view, and it had no persistence — you closed it
 * and the document was gone. A pane keeps the entity context (the tab strip is Steps | JSON) and
 * the document survives navigating away and back.
 *
 * The store stays the source of truth. This writes through the same path the structured editors
 * use, so validation runs on save and there is no second representation of the entity. That is
 * the boundary the Notes tab could not hold: notes are files, and a test case is an object inside
 * one file (`test-suites.json`), so a note could only ever be a copy that drifts from the store —
 * and `import_test_case_from_file` re-keys ids, so a round-trip creates a new entity and orphans
 * every reference to the old one.
 *
 * The editor is Monaco, which is what the notes feature itself uses for anything that is not
 * markdown, and which already has find-and-replace. The point of this view is find-and-replace
 * across the whole document — renaming a `{{token}}` across every step body, which the variables
 * panel can now do directly but the structured step editors cannot.
 */
import React, { useCallback, useRef, useState } from 'react';
import styled from 'styled-components';
import { MonacoEditorWrapper } from '../../request-editor/monaco';
import { useTheme, useEditorSettings } from '../../request-editor/core';
import { ErrorDetailBanner } from '../../request-editor/components/common/ErrorDetailBanner';
import { PrimaryButton } from '../common/Button';
import { DirtyDot } from '../common/DirtyDot';
import { Toolbar } from '../../styles/WorkspaceLayout.styles';
import { SPACING_SM, SPACING_XS } from '../../styles/spacing';
import { tokens } from '../proxy/tokens';
import { useSaveShortcut } from '../../hooks/useSaveShortcut';
import type { EntityValidator } from '../../utils/jsonValidators';
import { validateJsonDocument } from '../../utils/jsonValidators';

export interface JsonDocumentPaneProps {
    /** The entity as the store holds it. */
    document: unknown;
    /** Shown in the hint, e.g. "test case". */
    entityLabel: string;
    /** The key the store resolves against — changing it is blocked. */
    expectedId: string;
    entityValidator: EntityValidator;
    onSave: (document: any) => void;
}

const pretty = (document: unknown) => JSON.stringify(document, null, 2);

const Body = styled.div`
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: ${SPACING_XS};
    padding: 0 12px ${SPACING_SM};
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
    margin-left: ${SPACING_SM};
`;

export const JsonDocumentPane: React.FC<JsonDocumentPaneProps> = ({
    document,
    entityLabel,
    expectedId,
    entityValidator,
    onSave,
}) => {
    const { monacoTheme } = useTheme();
    // The shared settings store (config.ui) — the same font size every other editor uses.
    const { settings } = useEditorSettings();

    const [text, setText] = useState(() => pretty(document));
    const [error, setError] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    // Dirty means the text differs from what the store holds, not "the user typed". Saving
    // replaces the entity, so a pane that looks dirty when it is not invites a pointless write.
    const dirty = text !== pretty(document);

    const handleSave = useCallback(() => {
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
    }, [text, expectedId, entityValidator, onSave]);

    // Ctrl/Cmd+S belongs to whichever pane holds focus, so it saves this document rather than
    // every dirty project — the central dispatcher in `hooks/useSaveShortcut.ts`.
    useSaveShortcut(containerRef, handleSave);

    return (
        <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <Toolbar>
                <PrimaryButton onClick={handleSave} disabled={!dirty}>Save</PrimaryButton>
                {dirty && <DirtyDot kind="external" label="Unsaved changes" />}
                <Hint>
                    Find and replace across the whole {entityLabel} (Ctrl+F / Ctrl+H). The `id`
                    cannot change — it is the key the store and the runner use.
                </Hint>
            </Toolbar>

            <Body>
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
        </div>
    );
};
