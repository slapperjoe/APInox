/**
 * Find and replace in the notes editor.
 *
 * The notes feature had no search at all — `@codemirror/search` was not a dependency, so
 * Ctrl+F fell through to the browser. That gap is why raw JSON editing lived in its own modal:
 * the notes tab could not do the one thing the raw editor was for.
 *
 * CodeMirror runs in jsdom, so this drives the real keymap rather than asserting on source text.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { NotesCodeMirrorEditor } from '../NotesCodeMirrorEditor';

function openPanel(key: string) {
    render(<NotesCodeMirrorEditor doc="hello {{token}} {{token}}" viewMode="raw" colorScheme="dark" />);
    const content = document.querySelector('.cm-content') as HTMLElement;
    content.focus();
    content.dispatchEvent(
        new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true })
    );
    return document.querySelector('.cm-panel.cm-search');
}

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('the notes editor', () => {
    it('opens the search panel on Ctrl+F', () => {
        const panel = openPanel('f');
        expect(panel, 'Ctrl+F did not open the search panel').toBeTruthy();
    });

    it('opens the replace panel on Ctrl+H', () => {
        const panel = openPanel('h');
        expect(panel, 'Ctrl+H did not open the replace panel').toBeTruthy();
        // CodeMirror's own keymap binds Ctrl+F but not Ctrl+H — the panel already has a replace
        // field, so what the binding adds is focus on it.
        expect(document.activeElement, 'Ctrl+H should focus the replace field').toBe(
            panel!.querySelector('input[name="replace"]')
        );
    });

    it('matches every occurrence, which is what a rename across the document depends on', () => {
        const panel = openPanel('f');
        const field = panel?.querySelector('input[name="search"]') as HTMLInputElement;
        field.value = '{{token}}';
        // The panel commits on `change`/`keyup`, not on the `input` event.
        field.dispatchEvent(new Event('change', { bubbles: true }));

        expect(document.querySelectorAll('.cm-searchMatch').length).toBe(2);
    });
});
