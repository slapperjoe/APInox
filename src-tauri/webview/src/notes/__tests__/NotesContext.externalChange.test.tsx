/**
 * NotesContext — external-change detection.
 *
 * `checkExternalChange` compares the file's disk mtime against `loadedAt`. The
 * bug this pins: `loadedAt` was only ever set at load time, so the app's own
 * autosave advanced the disk mtime without moving the baseline, and the next
 * window focus reported the app's own write as an external edit.
 *
 * The fix re-baselines `loadedAt` on the mtime the backend returns from
 * `save_note` / `save_note_bytes` — a value the frontend previously discarded.
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

vi.mock('../../utils/bridge', () => ({
    bridge: { onMessage: () => () => {} },
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
    lastModified: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
};

/** The file's mtime on disk, advanced by the app's own save. */
let diskMtime: number;

const iso = (ms: number) => new Date(ms).toISOString();

/** Exposes the context state so assertions see what the UI holds. */
const Probe: React.FC = () => {
    const { openNote, updateContent, saveActive, checkExternalChange, error, externalChangePath } = useNotes();
    return (
        <div>
            <button onClick={() => openNote(note)}>open</button>
            <button onClick={() => updateContent('# edited')}>edit</button>
            <button onClick={() => saveActive()}>save</button>
            <button onClick={() => checkExternalChange()}>check</button>
            <span data-testid="error">{error ?? ''}</span>
            <span data-testid="external-change">{externalChangePath ?? ''}</span>
        </div>
    );
};

beforeEach(() => {
    invokeMock.mockReset();
    diskMtime = Date.UTC(2026, 0, 1);

    invokeMock.mockImplementation(async (command: string, _args: any) => {
        if (command === 'load_notes_index') return { entries: [note] };
        if (command === 'sniff_file_type') {
            return { isBinary: false, fileSize: 10, lastModified: iso(diskMtime) };
        }
        if (command === 'load_note_content') return '# original';
        if (command === 'save_note') {
            // The backend writes and returns the authoritative disk mtime.
            diskMtime = diskMtime + 60_000;
            return iso(diskMtime);
        }
        return null;
    });
});

describe('NotesContext — external change detection', () => {
    it("the app's own save does not read as an external change on the next check", async () => {
        render(<NotesProvider><Probe /></NotesProvider>);

        fireEvent.click(screen.getByText('open'));
        await screen.findByTestId('error');

        fireEvent.click(screen.getByText('edit'));
        fireEvent.click(screen.getByText('save'));
        await new Promise((r) => setTimeout(r, 0));

        // Disk mtime has advanced past the load-time baseline; the baseline must
        // have moved with it.
        expect(diskMtime).toBeGreaterThan(Date.UTC(2026, 0, 1));

        fireEvent.click(screen.getByText('check'));
        await new Promise((r) => setTimeout(r, 0));

        expect(screen.getByTestId('external-change')).toHaveTextContent('');
        expect(screen.getByTestId('error')).toHaveTextContent('');
    });

    it('a genuine external edit is still detected', async () => {
        render(<NotesProvider><Probe /></NotesProvider>);

        fireEvent.click(screen.getByText('open'));
        await screen.findByTestId('error');

        // Someone else writes the file while the app is not looking.
        diskMtime = diskMtime + 300_000;

        fireEvent.click(screen.getByText('check'));
        await new Promise((r) => setTimeout(r, 0));

        expect(screen.getByTestId('external-change')).toHaveTextContent(note.filePath);
    });

    it('the autosave path re-baselines too, so a debounced write is not an external change', async () => {
        render(<NotesProvider><Probe /></NotesProvider>);

        fireEvent.click(screen.getByText('open'));
        await screen.findByTestId('error');

        fireEvent.click(screen.getByText('edit'));
        // Let the 2s autosave debounce fire and settle.
        await new Promise((r) => setTimeout(r, 2200));

        expect(diskMtime).toBeGreaterThan(Date.UTC(2026, 0, 1));

        fireEvent.click(screen.getByText('check'));
        await new Promise((r) => setTimeout(r, 0));

        expect(screen.getByTestId('external-change')).toHaveTextContent('');
        expect(screen.getByTestId('error')).toHaveTextContent('');
    });
});
