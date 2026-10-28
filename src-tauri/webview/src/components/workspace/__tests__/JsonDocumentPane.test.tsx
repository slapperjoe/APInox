/**
 * Raw JSON editor for a store entity — as a workspace pane.
 *
 * It replaced a modal. The modal was the weaker UI: it could not stay open, could not be used
 * alongside the structured view, and had no persistence. A pane keeps the entity context and the
 * document survives navigating away and back.
 *
 * What these tests guard is the boundary a raw editor has to hold: it must accept things the
 * structured editors would not allow, must not let you save a document the runner cannot
 * execute, must not let you change the key the entry is filed under — and it must stay a pane,
 * because the shape is the point of the change.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import React from 'react';
import { EditorSettingsProvider, ThemeProvider } from '../../../request-editor/core';
import { JsonDocumentPane } from '../JsonDocumentPane';
import { testCaseValidator, testSuiteValidator } from '../../../utils/jsonValidators';
import { clearSaveShortcuts, focusedSaveHandler } from '../../../hooks/useSaveShortcut';
import { TestCase, TestSuite } from '@shared/models';

// Monaco cannot run in jsdom, so the editor is replaced with a textarea the tests can
// drive — the same pattern the explorer tests use.
vi.mock('../../../request-editor/monaco', () => ({
    MonacoEditorWrapper: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) => (
        <textarea
            data-testid="editor"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
        />
    ),
}));

const caseWithTransfer: TestCase = {
    id: 'c1',
    name: 'Case',
    variables: { token: 'abc' },
    steps: [
        { id: 's1', name: 'First', type: 'request', config: { request: { name: 'R', request: '<x/>' } } },
        {
            id: 's2',
            name: 'Transfer',
            type: 'transfer',
            config: { sourceStepId: 's1', targetStepId: 's3' },
        },
        { id: 's3', name: 'Second', type: 'delay', config: { delayMs: 10 } },
    ],
};

const suite: TestSuite = {
    id: 's1',
    name: 'Suite',
    variables: { baseUrl: 'https://example.com' },
    testCases: [caseWithTransfer],
};

function renderPane(
    document: unknown,
    entityLabel: string,
    expectedId: string,
    entityValidator: (parsed: Record<string, unknown>) => { error?: string; warnings: string[] },
    onSave: (doc: any) => void
) {
    render(
        <ThemeProvider standalone={true}>
            <EditorSettingsProvider>
                <JsonDocumentPane
                    document={document}
                    entityLabel={entityLabel}
                    expectedId={expectedId}
                    entityValidator={entityValidator}
                    onSave={onSave}
                />
            </EditorSettingsProvider>
        </ThemeProvider>
    );
}

const editor = () => screen.getByTestId('editor') as HTMLTextAreaElement;
const save = () => fireEvent.click(screen.getByText('Save'));

beforeEach(() => {
    document.body.innerHTML = '';
    clearSaveShortcuts();
});

afterEach(() => clearSaveShortcuts());

describe('the pane is a pane, not a dialog', () => {
    /**
     * The whole reason this exists. A modal cannot stay open, cannot be used alongside the
     * structured view, and loses the document when it closes — so the shape is part of the fix,
     * not a detail of it.
     */
    it('does not render inside a modal', () => {
        const source = readFileSync(resolve(__dirname, '..', 'JsonDocumentPane.tsx'), 'utf8');
        expect(source).not.toContain('components/modals/Modal');
        expect(source).toContain('useSaveShortcut');
    });

    it('renders the entity pretty-printed', () => {
        renderPane(caseWithTransfer, 'test case', 'c1', testCaseValidator, vi.fn());
        const shown = JSON.parse(editor().value);
        expect(shown.id).toBe('c1');
        expect(shown.variables).toEqual({ token: 'abc' });
        expect(shown.steps).toHaveLength(3);
    });

    it('renders a suite pretty-printed', () => {
        renderPane(suite, 'test suite', 's1', testSuiteValidator, vi.fn());
        const shown = JSON.parse(editor().value);
        expect(shown.id).toBe('s1');
        expect(shown.testCases).toHaveLength(1);
    });
});

describe('dirty state', () => {
    it('Save is disabled until the text differs from what the store holds', () => {
        renderPane(caseWithTransfer, 'test case', 'c1', testCaseValidator, vi.fn());
        expect(screen.getByText('Save')).toBeDisabled();

        fireEvent.change(editor(), { target: { value: '{ "id": "c1", "name": "Case", "steps": [] }' } });
        expect(screen.getByText('Save')).not.toBeDisabled();
    });

    it('shows the unsaved marker only when dirty', () => {
        renderPane(caseWithTransfer, 'test case', 'c1', testCaseValidator, vi.fn());
        expect(screen.queryByLabelText('Unsaved changes')).not.toBeInTheDocument();

        fireEvent.change(editor(), { target: { value: '{ "id": "c1", "name": "Case", "steps": [] }' } });
        expect(screen.getByLabelText('Unsaved changes')).toBeInTheDocument();
    });
});

describe('saving', () => {
    it('saves the parsed document', () => {
        const onSave = vi.fn();
        renderPane(caseWithTransfer, 'test case', 'c1', testCaseValidator, onSave);

        fireEvent.change(editor(), { target: { value: JSON.stringify({ id: 'c1', name: 'Case', steps: [] }) } });
        save();

        expect(onSave).toHaveBeenCalledWith({ id: 'c1', name: 'Case', steps: [] });
    });

    it('Ctrl/Cmd+S saves this document, not every dirty project', () => {
        const onSave = vi.fn();
        renderPane(caseWithTransfer, 'test case', 'c1', testCaseValidator, onSave);

        fireEvent.change(editor(), { target: { value: JSON.stringify({ id: 'c1', name: 'Case', steps: [] }) } });

        // The central dispatcher runs the handler for whichever registered container holds
        // focus, so the pane must be focused for its handler to be the one picked.
        editor().focus();
        const handler = focusedSaveHandler();
        expect(handler).not.toBeNull();
        handler!();

        expect(onSave).toHaveBeenCalledWith({ id: 'c1', name: 'Case', steps: [] });
    });

    it('refuses to save invalid JSON and says so', () => {
        const onSave = vi.fn();
        renderPane(caseWithTransfer, 'test case', 'c1', testCaseValidator, onSave);

        fireEvent.change(editor(), { target: { value: '{ id: "c1", }' } });
        save();

        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByTestId('json-error')).toHaveTextContent('invalid JSON');
    });

    it('refuses a step type the runner does not know', () => {
        const onSave = vi.fn();
        renderPane(caseWithTransfer, 'test case', 'c1', testCaseValidator, onSave);

        fireEvent.change(editor(), {
            target: {
                value: JSON.stringify({
                    id: 'c1',
                    name: 'Case',
                    steps: [{ id: 's1', name: 'X', type: 'banana', config: {} }],
                }),
            },
        });
        save();

        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByTestId('json-error')).toHaveTextContent('unknown type: banana');
    });

    it('refuses a suite whose testCases is not an array', () => {
        const onSave = vi.fn();
        renderPane(suite, 'test suite', 's1', testSuiteValidator, onSave);

        fireEvent.change(editor(), {
            target: { value: JSON.stringify({ id: 's1', name: 'Suite', testCases: {} }) },
        });
        save();

        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByTestId('json-error')).toHaveTextContent('`testCases` must be an array');
    });

    it('blocks changing the entity id', () => {
        const onSave = vi.fn();
        renderPane(caseWithTransfer, 'test case', 'c1', testCaseValidator, onSave);

        fireEvent.change(editor(), { target: { value: JSON.stringify({ id: 'c2', name: 'Case', steps: [] }) } });
        save();

        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByTestId('json-error')).toHaveTextContent('`id` cannot be changed');
    });

    it('blocks changing a suite id', () => {
        const onSave = vi.fn();
        renderPane(suite, 'test suite', 's1', testSuiteValidator, onSave);

        fireEvent.change(editor(), { target: { value: JSON.stringify({ id: 's2', name: 'Suite', testCases: [] }) } });
        save();

        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByTestId('json-error')).toHaveTextContent('`id` cannot be changed');
    });

    it('warns about a dangling transfer reference but still saves', () => {
        const onSave = vi.fn();
        renderPane(caseWithTransfer, 'test case', 'c1', testCaseValidator, onSave);

        // Deleting s3 leaves the transfer pointing at a step that no longer exists.
        // That is not a syntax error and the document may be mid-restructure, so it is
        // a warning rather than a block — but it silently does nothing at run time.
        fireEvent.change(editor(), {
            target: {
                value: JSON.stringify({
                    id: 'c1',
                    name: 'Case',
                    steps: [
                        { id: 's1', name: 'First', type: 'request', config: {} },
                        { id: 's2', name: 'Transfer', type: 'transfer', config: { sourceStepId: 's1', targetStepId: 's3' } },
                    ],
                }),
            },
        });
        save();

        expect(screen.getByTestId('json-warnings')).toHaveTextContent('targetStepId "s3"');
        expect(onSave).toHaveBeenCalled();
    });
});
