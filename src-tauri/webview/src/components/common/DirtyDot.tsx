/**
 * DirtyDot — the shared unsaved-changes indicator.
 *
 * Replaces the two bespoke copies (6px in `sidebar/NotesList.tsx`, 8px in
 * `notes/NotesEditor.tsx`) that had drifted apart.
 *
 * Two kinds, matching the notes feature's two save models:
 *   - `external` — a file the user opened from outside the notes store; it needs
 *     an explicit save, so it reads as a warning.
 *   - `managed`  — a note the app owns and auto-saves; a quieter marker.
 *
 * Colours come from the shared status palette (`tokens.status`, item 4 of
 * docs/UI_INCONSISTENCY_DECISIONS.md) rather than a chart colour, so the meaning
 * survives all six themes.
 */
import React from 'react';
import styled from 'styled-components';

export interface DirtyDotProps {
    kind: 'external' | 'managed';
    /** Hover text. Also the accessible name — a bare span has none. */
    label: string;
}

const Dot = styled.span`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
`;

const ExternalDot = styled(Dot)`
    background: var(--apinox-testing-iconQueued);
`;

const ManagedDot = styled(Dot)`
    background: var(--apinox-disabledForeground);
`;

export const DirtyDot: React.FC<DirtyDotProps> = ({ kind, label }) => {
    const Comp = kind === 'external' ? ExternalDot : ManagedDot;
    return <Comp title={label} aria-label={label} role="img" />;
};
