/**
 * Raw JSON editor for a store entity.
 *
 * The point of the feature is find-and-replace across step bodies — the variables panel
 * edits values but cannot rename a name, so a `{{token}}` rename otherwise means editing
 * every step one at a time.
 *
 * What these tests guard is the boundary a raw editor has to hold: it must accept things
 * the structured editors would not allow, but it must not let you save a document the
 * runner cannot execute, and it must not let you change the key the entry is filed under.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { EditorSettingsProvider, ThemeProvider } from '../../../request-editor/core';
import { EditJsonModal } from '../EditJsonModal';
import { testCaseValidator, testSuiteValidator, validateJsonDocument } from '../../../utils/jsonValidators';
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

function renderModal(
    document: unknown,
    entityLabel: string,
    expectedId: string,
    entityValidator: (parsed: Record<string, unknown>) => { error?: string; warnings: string[] },
    onSave: (doc: any) => void
) {
    render(
        <ThemeProvider standalone={true}>
            <EditorSettingsProvider>
                <EditJsonModal
                    document={document}
                    entityLabel={entityLabel}
                    expectedId={expectedId}
                    entityValidator={entityValidator}
                    onSave={onSave}
                    onClose={() => {}}
                />
            </EditorSettingsProvider>
        </ThemeProvider>
    );
}

const editor = () => screen.getByTestId('editor') as HTMLTextAreaElement;
const save = () => fireEvent.click(screen.getByText('Save'));

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('the editor shows the entity as the store holds it', () => {
    it('renders a case pretty-printed', () => {
        renderModal(caseWithTransfer, 'test case', 'c1', testCaseValidator, vi.fn());
        const shown = JSON.parse(editor().value);
        expect(shown.id).toBe('c1');
        expect(shown.variables).toEqual({ token: 'abc' });
        expect(shown.steps).toHaveLength(3);
    });

    it('renders a suite pretty-printed', () => {
        renderModal(suite, 'test suite', 's1', testSuiteValidator, vi.fn());
        const shown = JSON.parse(editor().value);
        expect(shown.id).toBe('s1');
        expect(shown.testCases).toHaveLength(1);
    });
});

describe('saving', () => {
    it('saves the parsed document', () => {
        const onSave = vi.fn();
        renderModal(caseWithTransfer, 'test case', 'c1', testCaseValidator, onSave);

        fireEvent.change(editor(), {
            target: { value: JSON.stringify({ id: 'c1', name: 'Case', steps: [] }) },
        });
        save();

        expect(onSave).toHaveBeenCalledWith({ id: 'c1', name: 'Case', steps: [] });
    });

    it('refuses to save invalid JSON and says so', () => {
        const onSave = vi.fn();
        renderModal(caseWithTransfer, 'test case', 'c1', testCaseValidator, onSave);

        fireEvent.change(editor(), { target: { value: '{ id: "c1", }' } });
        save();

        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByTestId('json-error')).toHaveTextContent('invalid JSON');
    });

    it('refuses a step type the runner does not know', () => {
        const onSave = vi.fn();
        renderModal(caseWithTransfer, 'test case', 'c1', testCaseValidator, onSave);

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
        renderModal(suite, 'test suite', 's1', testSuiteValidator, onSave);

        fireEvent.change(editor(), {
            target: { value: JSON.stringify({ id: 's1', name: 'Suite', testCases: {} }) },
        });
        save();

        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByTestId('json-error')).toHaveTextContent('`testCases` must be an array');
    });

    it('blocks changing the entity id', () => {
        const onSave = vi.fn();
        renderModal(caseWithTransfer, 'test case', 'c1', testCaseValidator, onSave);

        fireEvent.change(editor(), { target: { value: JSON.stringify({ id: 'c2', name: 'Case', steps: [] }) } });
        save();

        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByTestId('json-error')).toHaveTextContent('`id` cannot be changed');
    });

    it('blocks changing a suite id', () => {
        const onSave = vi.fn();
        renderModal(suite, 'test suite', 's1', testSuiteValidator, onSave);

        fireEvent.change(editor(), { target: { value: JSON.stringify({ id: 's2', name: 'Suite', testCases: [] }) } });
        save();

        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByTestId('json-error')).toHaveTextContent('`id` cannot be changed');
    });

    it('warns about a dangling transfer reference but still saves', () => {
        const onSave = vi.fn();
        renderModal(caseWithTransfer, 'test case', 'c1', testCaseValidator, onSave);

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

describe('validateJsonDocument', () => {
    it('rejects a non-object document', () => {
        expect(validateJsonDocument([1, 2, 3], 'c1', testCaseValidator).error)
            .toBe('The document must be an object.');
    });

    it('requires steps to be an array', () => {
        expect(validateJsonDocument(caseWithTransfer, 'c1', testCaseValidator).error).toBeUndefined();
        expect(testCaseValidator({ id: 'c1', name: 'N', steps: {} }).error)
            .toBe('`steps` must be an array.');
    });

    it('does not block step ids — a mid-restructure document is allowed', () => {
        expect(validateJsonDocument(caseWithTransfer, 'c1', testCaseValidator).error).toBeUndefined();
    });
});
