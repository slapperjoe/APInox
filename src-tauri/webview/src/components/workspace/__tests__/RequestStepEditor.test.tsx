/**
 * RequestStepEditor tests.
 *
 * A request step may carry request data two ways:
 *  - project-referenced (projectName + interfaceName + operationName), or
 *  - self-contained (endpoint + requestBody) — what the traffic->workflow
 *    wizard emits. Self-contained steps are legitimate request steps and must
 *    render their body/endpoint editor, NOT the "No request selected" state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { RequestStepEditor } from '../RequestStepEditor';
import type { WorkflowStep, WorkflowExtractor } from '@shared/models';

vi.mock('@apinox/request-editor/monaco', () => ({
    MonacoEditorWrapper: ({ value }: { value?: string }) => (
        <textarea data-testid="mock-monaco" value={value || ''} readOnly />
    ),
    applyMonacoTheme: (_monacoInstance: unknown, theme: string) => `apinox-${theme}`,
}));

// The step editors import the monaco-editor namespace for applyMonacoTheme —
// mock it so the real (large, browser-only) module never loads in jsdom.
vi.mock('monaco-editor', () => ({}));

// RequestStepEditor reads the active skin's Monaco theme via useTheme —
// mock the hook (avoids pulling the package ThemeProvider's Tauri/Monaco
// side effects into jsdom).
vi.mock('@apinox/request-editor/core', () => ({
    useTheme: () => ({
        theme: 'dark',
        setTheme: () => {},
        isStandalone: true,
        monacoTheme: 'vs-dark',
    }),
}));

function step(partial: Partial<WorkflowStep> = {}): WorkflowStep {
    return {
        id: 's1', name: 'Step', type: 'request', order: 0,
        requestBody: '', ...partial,
    };
}

const ORDER_EXTRACTOR: WorkflowExtractor = {
    id: 'e1', variable: 'orderId', type: 'xpath', pattern: '//OrderId/text()', source: 'body',
};
const TOKEN_EXTRACTOR: WorkflowExtractor = {
    id: 'e2', variable: 'sessionToken', type: 'xpath', pattern: '//SessionToken/text()', source: 'body',
};

describe('RequestStepEditor', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders the body editor for a self-contained step (endpoint + requestBody, no project refs)', () => {
        render(<RequestStepEditor
            step={step({ endpoint: 'http://x/login', requestBody: '<Login/>' })}
            onUpdate={vi.fn()}
        />);
        expect(screen.queryByText('No request selected')).not.toBeInTheDocument();
        expect(screen.getByTestId('mock-monaco')).toHaveValue('<Login/>');
    });

    it('treats a project-referenced step as a request (existing behavior)', () => {
        render(<RequestStepEditor
            step={step({ projectName: 'P', interfaceName: 'I', operationName: 'Op', requestBody: '<X/>' })}
            onUpdate={vi.fn()}
        />);
        expect(screen.getByText('Request Details')).toBeInTheDocument();
        expect(screen.getByText(/Interface:/)).toBeInTheDocument();
        expect(screen.queryByText('No request selected')).not.toBeInTheDocument();
    });

    it('shows the empty state only when a step has neither request refs nor a body', () => {
        render(<RequestStepEditor step={step()} onUpdate={vi.fn()} />);
        expect(screen.getByText('No request selected')).toBeInTheDocument();
    });

    it('saves edits back on the self-contained step', () => {
        const onUpdate = vi.fn();
        render(<RequestStepEditor
            step={step({ endpoint: 'http://x/login', requestBody: '<Login/>' })}
            onUpdate={onUpdate}
        />);
        fireEvent.change(screen.getByDisplayValue('http://x/login'), { target: { value: 'http://x/other' } });
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
        expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'http://x/other' }));
    });

    // ── extractors (populated from the wizard: OrderId, sessionToken, …) ──
    it('renders each extractor with its variable name and pattern', () => {
        render(<RequestStepEditor
            step={step({ endpoint: 'http://x/login', requestBody: '<Login/>', extractors: [ORDER_EXTRACTOR, TOKEN_EXTRACTOR] })}
            onUpdate={vi.fn()}
        />);
        expect(screen.getByText('Extractors')).toBeInTheDocument();
        expect(screen.getByDisplayValue('orderId')).toBeInTheDocument();
        expect(screen.getByDisplayValue('//OrderId/text()')).toBeInTheDocument();
        expect(screen.getByDisplayValue('sessionToken')).toBeInTheDocument();
        expect(screen.getByDisplayValue('//SessionToken/text()')).toBeInTheDocument();
    });

    it('shows an empty state when the step has no extractors', () => {
        render(<RequestStepEditor
            step={step({ endpoint: 'http://x/login', requestBody: '<Login/>' })}
            onUpdate={vi.fn()}
        />);
        expect(screen.getByText(/no extractors/i)).toBeInTheDocument();
    });

    it('edits an extractor pattern and persists via onUpdate on save', () => {
        const onUpdate = vi.fn();
        render(<RequestStepEditor
            step={step({ endpoint: 'http://x/login', requestBody: '<Login/>', extractors: [ORDER_EXTRACTOR] })}
            onUpdate={onUpdate}
        />);
        fireEvent.change(screen.getByDisplayValue('//OrderId/text()'), { target: { value: '//Order/Id/text()' } });
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
        const updated = onUpdate.mock.calls[0][0];
        expect(updated.extractors).toHaveLength(1);
        expect(updated.extractors[0]).toMatchObject({ id: 'e1', variable: 'orderId', pattern: '//Order/Id/text()' });
    });

    it('removes an extractor and persists via onUpdate on save', () => {
        const onUpdate = vi.fn();
        render(<RequestStepEditor
            step={step({ endpoint: 'http://x/login', requestBody: '<Login/>', extractors: [ORDER_EXTRACTOR, TOKEN_EXTRACTOR] })}
            onUpdate={onUpdate}
        />);
        const removeBtns = screen.getAllByRole('button', { name: /remove extractor/i });
        fireEvent.click(removeBtns[0]);
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
        const updated = onUpdate.mock.calls[0][0];
        expect(updated.extractors).toHaveLength(1);
        expect(updated.extractors[0].variable).toBe('sessionToken');
    });

    it('adds a new extractor and persists via onUpdate on save', () => {
        const onUpdate = vi.fn();
        render(<RequestStepEditor
            step={step({ endpoint: 'http://x/login', requestBody: '<Login/>' })}
            onUpdate={onUpdate}
        />);
        fireEvent.click(screen.getByRole('button', { name: /add extractor/i }));
        // A blank extractor row appears.
        const added = screen.getAllByRole('button', { name: /remove extractor/i });
        expect(added).toHaveLength(1);
        // Fill in a variable name.
        const varInput = screen.getAllByPlaceholderText('variable')[0];
        fireEvent.change(varInput, { target: { value: 'orderId' } });
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
        const updated = onUpdate.mock.calls[0][0];
        expect(updated.extractors).toHaveLength(1);
        expect(updated.extractors[0].variable).toBe('orderId');
        expect(updated.extractors[0].type).toBe('xpath');
    });
});

