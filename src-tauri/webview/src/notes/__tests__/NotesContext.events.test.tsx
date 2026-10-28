/**
 * NotesContext — backend event subscription and error surfacing.
 *
 * Two things the feature lacked:
 * 1. The backend pushes `notesUpdated` on the bridge channel after every index
 *    mutation (`notes_storage::update_index`). The provider must consume it, so
 *    the list reflects the authoritative index rather than only what this
 *    component itself did.
 * 2. `error` used to double as a control channel: the external-change signal was
 *    a `__external_change__:<path>` sentinel string, and the UI only ever rendered
 *    that case — so every real failure (e.g. the size cap) was invisible. `error`
 *    is now a plain renderable message.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { NotesProvider, useNotes } from '../NotesContext';
import { NoteEntry } from '@shared/models';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
    invoke: (...args: any[]) => invokeMock(...args),
}));

const listeners = new Set<(message: any) => void>();
vi.mock('../../utils/bridge', () => ({
    bridge: {
        onMessage: (cb: (message: any) => void) => {
            listeners.add(cb);
            return () => listeners.delete(cb);
        },
    },
    commandErrorText: (error: unknown) =>
        typeof error === 'string' ? error : (error as { message?: string })?.message ?? String(error),
}));

const note: NoteEntry = {
    id: 'note-1',
    name: 'Design',
    filePath: '/appdata/notes/Design.md',
    language: 'markdown',
    isBinary: false,
    isManaged: true,
    lastModified: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
};

const Probe: React.FC = () => {
    const { notes, error, openNote } = useNotes();
    return (
        <div>
            <ul>
                {notes.map((n) => <li key={n.id}>{n.name}</li>)}
            </ul>
            <button onClick={() => openNote(note)}>open</button>
            <span data-testid="error">{error ?? ''}</span>
        </div>
    );
};

const postMessage = (message: any) => {
    for (const cb of listeners) cb(message);
};

beforeEach(() => {
    listeners.clear();
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (command: string) => {
        if (command === 'load_notes_index') return { entries: [note] };
        if (command === 'sniff_file_type') return { isBinary: false, fileSize: 10, lastModified: '2026-01-01T00:00:00.000Z' };
        if (command === 'load_note_content') return '# hi';
        return null;
    });
});

describe('NotesContext — notesUpdated event', () => {
    it('subscribes to the bridge channel and re-syncs from the authoritative index', async () => {
        render(<NotesProvider><Probe /></NotesProvider>);

        expect(await screen.findByText('Design')).toBeInTheDocument();

        // The backend's snapshot carries an entry this component never added.
        postMessage({
            command: 'notesUpdated',
            entries: [{ ...note, id: 'note-9', name: 'FromBackend' }],
        });

        expect(await screen.findByText('FromBackend')).toBeInTheDocument();
        expect(screen.queryByText('Design')).not.toBeInTheDocument();
    });

    it('ignores other backend messages', async () => {
        render(<NotesProvider><Probe /></NotesProvider>);
        await screen.findByText('Design');

        postMessage({ command: 'historyUpdate', entries: [] });
        expect(screen.queryByText('Design')).toBeInTheDocument();
    });
});

describe('NotesContext — real errors are visible', () => {
    it('a rejected load sets a plain error message, not a sentinel', async () => {
        invokeMock.mockImplementation(async (command: string) => {
            if (command === 'load_notes_index') return { entries: [note] };
            if (command === 'sniff_file_type') {
                throw { kind: 'invalid-input', message: 'File is too large to open as a note (10485761 bytes, limit 10485760 bytes)' };
            }
            return null;
        });

        render(<NotesProvider><Probe /></NotesProvider>);

        fireEvent.click(screen.getByText('open'));
        const shown = await screen.findByTestId('error');
        expect(shown).toHaveTextContent('too large');
        expect(shown.textContent).not.toContain('__external_change__');
    });

    /**
     * The initial load is the one thing the provider does on mount, and a corrupt
     * `index.json` is a real failure the backend now reports rather than silently
     * replacing. The old code logged it and left an empty list with no indication.
     */
    it('a failed initial load surfaces an error rather than an empty list', async () => {
        invokeMock.mockImplementation(async (command: string) => {
            if (command === 'load_notes_index') {
                throw { kind: 'serialization', message: 'Failed to parse notes index' };
            }
            return null;
        });

        render(<NotesProvider><Probe /></NotesProvider>);

        const shown = await screen.findByTestId('error');
        expect(shown).toHaveTextContent('Failed to parse notes index');
        expect(screen.queryByText('Design')).not.toBeInTheDocument();
    });
});
