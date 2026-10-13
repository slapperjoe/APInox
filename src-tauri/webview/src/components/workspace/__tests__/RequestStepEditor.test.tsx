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
import type { WorkflowStep } from '@shared/models';

vi.mock('@apinox/request-editor/monaco', () => ({
    MonacoEditorWrapper: ({ value }: { value?: string }) => (
        <textarea data-testid="mock-monaco" value={value || ''} readOnly />
    ),
}));

function step(partial: Partial<WorkflowStep> = {}): WorkflowStep {
    return {
        id: 's1', name: 'Step', type: 'request', order: 0,
        requestBody: '', ...partial,
    };
}

describe('RequestStepEditor', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders the body editor for a self-contained step (endpoint + requestBody, no project refs)', () => {
        render(<RequestStepEditor
            step={step({ endpoint: 'http://x/login', requestBody: '<Login/>' })}
            onUpdate={vi.fn()}
        />);
        // No empty "pick a request" state for a self-contained step.
        expect(screen.queryByText('No request selected')).not.toBeInTheDocument();
        // The injected body is visible in the Monaco editor.
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
});
