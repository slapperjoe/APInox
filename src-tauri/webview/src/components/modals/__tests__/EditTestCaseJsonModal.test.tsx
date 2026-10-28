/**
 * Raw JSON editor for a test case.
 *
 * The point of the feature is find-and-replace across step bodies — the variables panel
 * edits values but cannot rename a name, so a `{{token}}` rename otherwise means editing
 * every step one at a time.
 *
 * What these tests guard is the boundary a raw editor has to hold: it must accept things
 * the step editors would not allow, but it must not let you save a document the runner
 * cannot execute.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
    EditorSettingsProvider,
    ThemeProvider,
} from '../../../request-editor/core';
import { EditTestCaseJsonModal, validateTestCaseDocument } from '../EditTestCaseJsonModal';
import { TestCase } from '@shared/models';

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

function renderModal(testCase: TestCase, onSave: (tc: TestCase) => void) {
    render(
        <ThemeProvider standalone={true}>
            <EditorSettingsProvider>
                <EditTestCaseJsonModal
                    testCase={testCase}
                    onSave={onSave}
                    onClose={() => {}}
                />
            </EditorSettingsProvider>
        </ThemeProvider>
    );
}

const editor = () => screen.getByTestId('editor');
const save = () => fireEvent.click(screen.getByText('Save'));

describe('the editor shows the case as the store holds it', () => {
    it('renders the case pretty-printed', () => {
        renderModal(caseWithTransfer, vi.fn());
        const shown = JSON.parse((editor() as HTMLTextAreaElement).value);
        expect(shown.id).toBe('c1');
        expect(shown.variables).toEqual({ token: 'abc' });
        expect(shown.steps).toHaveLength(3);
    });
});

describe('saving', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('saves the parsed document', () => {
        const onSave = vi.fn();
        renderModal(caseWithTransfer, onSave);

        fireEvent.change(editor(), {
            target: { value: JSON.stringify({ id: 'c1', name: 'Case', steps: [] }) },
        });
        save();

        expect(onSave).toHaveBeenCalledWith({ id: 'c1', name: 'Case', steps: [] });
    });

    it('refuses to save invalid JSON and says so', () => {
        const onSave = vi.fn();
        renderModal(caseWithTransfer, onSave);

        fireEvent.change(editor(), { target: { value: '{ id: "c1", }' } });
        save();

        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByTestId('json-error')).toHaveTextContent('invalid JSON');
    });

    it('refuses a step type the runner does not know', () => {
        const onSave = vi.fn();
        renderModal(caseWithTransfer, onSave);

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

    it('blocks changing the case id', () => {
        const onSave = vi.fn();
        renderModal(caseWithTransfer, onSave);

        fireEvent.change(editor(), {
            target: {
                value: JSON.stringify({ id: 'c2', name: 'Case', steps: [] }),
            },
        });
        save();

        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByTestId('json-error')).toHaveTextContent('case `id` cannot be changed');
    });

    it('accepts the id unchanged', () => {
        const onSave = vi.fn();
        renderModal(caseWithTransfer, onSave);

        fireEvent.change(editor(), {
            target: { value: JSON.stringify({ id: 'c1', name: 'Renamed', steps: [] }) },
        });
        save();

        expect(onSave).toHaveBeenCalledWith({ id: 'c1', name: 'Renamed', steps: [] });
    });

    it('warns about a dangling transfer reference but still saves', () => {
        const onSave = vi.fn();
        renderModal(caseWithTransfer, onSave);

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

describe('validateTestCaseDocument', () => {
    it('rejects a non-object document', () => {
        expect(validateTestCaseDocument([1, 2, 3]).error).toBe('The document must be a test case object.');
    });

    it('requires steps to be an array', () => {
        expect(validateTestCaseDocument({ id: 'c', name: 'N', steps: {} }).error).toBe('`steps` must be an array.');
    });

    it('accepts a clean document', () => {
        expect(validateTestCaseDocument(caseWithTransfer).error).toBeUndefined();
    });

    it('blocks a case id that differs from the entry being edited', () => {
        expect(validateTestCaseDocument(caseWithTransfer, 'c1').error).toBeUndefined();
        expect(validateTestCaseDocument(caseWithTransfer, 'other').error).toContain(
            'case `id` cannot be changed'
        );
    });

    it('does not block step ids — a mid-restructure document is allowed', () => {
        expect(validateTestCaseDocument(caseWithTransfer, 'c1').error).toBeUndefined();
    });
});
