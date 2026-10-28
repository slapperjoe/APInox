/**
 * NotesContext → backend invoke contract.
 *
 * Tauri binds command arguments by name, so the JS args object must match the
 * Rust command signature (Tauri converts camelCase JS to snake_case Rust). Two
 * notes calls had drifted from `src-tauri/src/notes_storage.rs` and could never
 * bind, so rename and binary save always failed:
 *
 *   rename_note(id, new_name)                    — was called with { oldPath, newPath }
 *   save_note_bytes(file_path, data_base64)      — was called with { dataB64 }
 *
 * These tests pin the argument names against the Rust signatures, and pin that
 * the UI takes the entry the backend returns — the backend owns the on-disk
 * rename for managed notes and leaves an external note where it is.
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

// The provider subscribes to the bridge channel; keep it inert here so the test
// exercises the invoke contract without pulling in the Tauri event runtime.
vi.mock('../../utils/bridge', () => ({
    bridge: { onMessage: () => () => {} },
    commandErrorText: (error: unknown) =>
        typeof error === 'string' ? error : (error as { message?: string })?.message ?? String(error),
}));

const managedNote: NoteEntry = {
    id: 'note-1',
    name: 'Design',
    filePath: '/appdata/notes/Design.md',
    language: 'markdown',
    isBinary: false,
    isManaged: true,
    lastModified: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
};

/** An external note: `isManaged` false, so `rename_note` must NOT move the file. */
const externalNote: NoteEntry = {
    ...managedNote,
    id: 'note-2',
    name: 'scratch',
    filePath: '/home/mark/scratch.md',
    isManaged: false,
};

const binaryNote: NoteEntry = {
    ...managedNote,
    id: 'note-3',
    name: 'blob',
    filePath: '/appdata/notes/blob.png',
    language: 'binary',
    isBinary: true,
};

const fixtureNotes = [managedNote, externalNote, binaryNote];

const callsTo = (command: string) =>
    invokeMock.mock.calls.filter(([cmd]) => cmd === command);

/** Renders the live context state so assertions see what the UI holds. */
const Probe: React.FC = () => {
    const { notes, activeNote, openNote, renameNote, saveActive } = useNotes();
    return (
        <div>
            {notes.map((n) => (
                <div key={n.id}>
                    <span data-testid={`name-${n.id}`}>{n.name}</span>
                    <span data-testid={`path-${n.id}`}>{n.filePath}</span>
                    <button onClick={() => openNote(n)}>open {n.id}</button>
                    <button onClick={() => renameNote(n.id, 'Renamed')}>rename {n.id}</button>
                </div>
            ))}
            <button onClick={() => saveActive()}>save</button>
            <span data-testid="active-path">{activeNote?.entry.filePath ?? ''}</span>
        </div>
    );
};

beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (command: string, args: any) => {
        if (command === 'load_notes_index') return { entries: fixtureNotes };
        if (command === 'sniff_file_type') {
            return {
                isBinary: args?.filePath === binaryNote.filePath,
                lastModified: '2026-01-01T00:00:00Z',
            };
        }
        if (command === 'load_note_content') return '# hello';
        if (command === 'load_note_bytes') return 'YWJjZGVm'; // "abcdef"
        if (command === 'rename_note') {
            // Mirrors rename_note_sync: managed notes move under the notes dir,
            // external notes keep their path; the name changes either way.
            const entry = fixtureNotes.find((e) => e.id === args.id)!;
            const updated = { ...entry, name: args.newName };
            if (entry.isManaged) {
                updated.filePath = `/appdata/notes/${args.newName}.md`;
            }
            return updated;
        }
        return null;
    });
});

describe('NotesContext — Tauri command argument names', () => {
    it('rename_note is called with { id, newName }, matching notes_storage.rs:249', async () => {
        render(<NotesProvider><Probe /></NotesProvider>);

        // The index loads on mount; wait for it before driving the UI.
        await screen.findByTestId('name-note-1');
        fireEvent.click(screen.getByText('rename note-1'));
        expect(await screen.findByTestId('name-note-1')).toHaveTextContent('Renamed');

        const call = callsTo('rename_note');
        expect(call).toHaveLength(1);
        expect(call[0]![1]).toEqual({ id: 'note-1', newName: 'Renamed' });
    });

    it('the UI takes the entry the backend returns: a managed note moves, an external note does not', async () => {
        render(<NotesProvider><Probe /></NotesProvider>);

        await screen.findByTestId('name-note-1');
        fireEvent.click(screen.getByText('rename note-1'));
        expect(await screen.findByTestId('path-note-1')).toHaveTextContent('/appdata/notes/Renamed.md');

        fireEvent.click(screen.getByText('rename note-2'));
        expect(await screen.findByTestId('path-note-2')).toHaveTextContent('/home/mark/scratch.md');
    });

    it('save_note_bytes is called with { filePath, dataBase64 }, matching notes_storage.rs:204', async () => {
        render(<NotesProvider><Probe /></NotesProvider>);

        await screen.findByTestId('name-note-3');
        fireEvent.click(screen.getByText('open note-3'));
        expect(await screen.findByTestId('active-path')).toHaveTextContent(binaryNote.filePath);

        fireEvent.click(screen.getByText('save'));

        const call = callsTo('save_note_bytes');
        expect(call).toHaveLength(1);
        expect(call[0]![1]).toEqual({ filePath: binaryNote.filePath, dataBase64: 'YWJjZGVm' });
    });
});
