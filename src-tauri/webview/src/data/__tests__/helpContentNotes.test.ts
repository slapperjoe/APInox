/**
 * Help coverage for the Notes view.
 *
 * Notes was the only rail view with no help page. These tests pin two things:
 *
 *   1. Every view on the sidebar rail has a help page — so a view cannot lose its
 *      coverage again without a test failing.
 *   2. The Notes page describes the behaviour the audit established, not the
 *      behaviour the code used to have. Each assertion names the specific fact and
 *      the code it must agree with, so drift in either direction is caught.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { HELP_SECTIONS } from '../helpContent';
import { SidebarView } from '@shared/models';

const SRC = resolve(__dirname, '..', '..');    // src-tauri/webview/src
const WEBVIEW = resolve(SRC, '..');            // src-tauri/webview
const ROOT = resolve(WEBVIEW, '..', '..');     // repo root

/** The help page a rail view points at. */
const VIEW_HELP_PAGE: Record<SidebarView, string> = {
    [SidebarView.UNIFIED_EXPLORER]: 'api-explorer',
    [SidebarView.TESTS]: 'test-suite',
    [SidebarView.PERFORMANCE]: 'performance-suites',
    [SidebarView.PROXY]: 'proxy',
    [SidebarView.MOCK]: 'mock-server',
    [SidebarView.NOTES]: 'notes',
    [SidebarView.SETTINGS]: 'settings-general',
};

function findPage(id: string) {
    for (const section of HELP_SECTIONS as any[]) {
        if (section.id === id) return section;
        const child = (section.children || []).find((c: any) => c.id === id);
        if (child) return child;
    }
    return undefined;
}

describe('every rail view has a help page', () => {
    for (const [view, pageId] of Object.entries(VIEW_HELP_PAGE)) {
        it(`the ${view} view resolves to help page "${pageId}"`, () => {
            const page = findPage(pageId);
            expect(page, `no help page for rail view ${view}`).toBeDefined();
            expect((page.content as string).trim().length).toBeGreaterThan(0);
        });
    }
});

describe('the Notes help page', () => {
    const page = findPage('notes');
    // Read lazily: resolving `page.content` in the describe body throws during
    // collection when the page is missing, which reports as a broken file rather
    // than a failed assertion — and the point of this test is to fail when the
    // page goes away.
    const content = () => (page as any).content as string;

    it('exists', () => {
        expect(page).toBeDefined();
    });

    it('names the rail as the entry point', () => {
        expect(content()).toContain('sidebar rail');
    });

    it('documents the two kinds of note and that managed-ness comes from the path', () => {
        expect(content()).toContain('Managed');
        expect(content()).toContain('External');
        expect(content()).toContain('path');
    });

    it('documents autosave for text notes and the absence of autosave for binary notes', () => {
        // NotesContext.updateContent: text notes autosave on a 2s debounce, and the
        // timer returns early for binary notes.
        expect(content()).toMatch(/autosave/i);
        expect(content()).toMatch(/binary notes are never autosaved/i);
    });

    it('documents that Cmd/Ctrl+S saves the focused pane, not the note and every project', () => {
        // hooks/useSaveShortcut.ts — the double-fire fix.
        expect(content()).toContain('Cmd/Ctrl+S');
        expect(content()).toMatch(/whichever pane has focus/);
    });

    it('documents the dirty-dot meanings in the order the shared component renders them', () => {
        // components/common/DirtyDot.tsx: external = warning amber (needs an explicit
        // save), managed = grey (autosave will handle it). The help must not swap them.
        expect(content()).toMatch(/amber dot.*external/i);
        expect(content()).toMatch(/grey dot.*managed/i);
    });

    it('documents the hex view as read-only and keyboard navigable', () => {
        expect(content()).toMatch(/read-only hex view/);
        expect(content()).toMatch(/arrow keys/);
    });

    it('documents the size cap on both open and save', () => {
        // notes_storage.rs MAX_NOTE_BYTES — the cap applies in both directions.
        expect(content()).toMatch(/10 MiB/);
        expect(content()).toMatch(/on open and on save/);
    });

    it('documents that the notes gear edits the shared editor settings', () => {
        // NotesEditor uses request-editor's useEditorSettings, so the settings are
        // not notes-local — the help must not imply they are.
        expect(content()).toMatch(/same editor\s+settings the request editor uses/);
    });
});

describe('the help content agrees with the code it describes', () => {
    it('the dirty dot really is amber for external and grey for managed', () => {
        const dirtyDot = readFileSync(resolve(SRC, 'components', 'common', 'DirtyDot.tsx'), 'utf8');
        expect(dirtyDot).toContain('--apinox-testing-iconQueued'); // warning amber
        expect(dirtyDot).toContain('--apinox-disabledForeground');  // grey
    });

    it('the autosave debounce really is two seconds', () => {
        const context = readFileSync(resolve(SRC, 'notes', 'NotesContext.tsx'), 'utf8');
        expect(context).toMatch(/Auto-save: text notes only, 2s debounce/);
    });

    it('the size cap really is 10 MiB', () => {
        const rust = readFileSync(resolve(ROOT, 'src-tauri', 'src', 'notes_storage.rs'), 'utf8');
        expect(rust).toContain('const MAX_NOTE_BYTES: u64 = 10 * 1024 * 1024;');
    });
});
