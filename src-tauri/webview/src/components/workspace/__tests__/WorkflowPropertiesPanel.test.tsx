/**
 * WorkflowPropertiesPanel variables editor tests.
 *
 * Task 5: the workflow editor previously showed a "Variables (Coming Soon)"
 * placeholder — there was no place to store/reuse the variables the traffic
 * wizard tags. This pins the replacement: a name→value editor that reads and
 * writes `workflow.variables` via onUpdate, mirroring the wizard's manual
 * variable list.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { WorkflowPropertiesPanel } from '../WorkflowPropertiesPanel';
import { Workflow } from '@shared/models';

const makeWorkflow = (variables?: Record<string, string>): Workflow => ({
    id: 'wf-1',
    name: 'Booking Workflow',
    steps: [],
    createdAt: 0,
    modifiedAt: 0,
    variables,
});

describe('WorkflowPropertiesPanel variables', () => {
    beforeEach(() => vi.clearAllMocks());

    it('shows no "Coming Soon" placeholder now that variables are editable', () => {
        render(<WorkflowPropertiesPanel workflow={makeWorkflow()} onUpdate={vi.fn()} />);
        expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
    });

    it('lists the workflow variables as name→value rows', () => {
        render(<WorkflowPropertiesPanel workflow={makeWorkflow({ token: 'abc', user: 'mark' })} onUpdate={vi.fn()} />);
        expect(screen.getByDisplayValue('token')).toBeInTheDocument();
        expect(screen.getByDisplayValue('abc')).toBeInTheDocument();
        expect(screen.getByDisplayValue('user')).toBeInTheDocument();
        expect(screen.getByDisplayValue('mark')).toBeInTheDocument();
    });

    it('edits a variable value and writes it back via onUpdate', () => {
        const onUpdate = vi.fn();
        render(<WorkflowPropertiesPanel workflow={makeWorkflow({ token: 'abc' })} onUpdate={onUpdate} />);
        fireEvent.change(screen.getByDisplayValue('abc'), { target: { value: 'def' } });
        expect(onUpdate).toHaveBeenCalledWith({ variables: { token: 'def' } });
    });

    it('renames a variable key', () => {
        const onUpdate = vi.fn();
        render(<WorkflowPropertiesPanel workflow={makeWorkflow({ token: 'abc' })} onUpdate={onUpdate} />);
        fireEvent.change(screen.getByDisplayValue('token'), { target: { value: 'session' } });
        expect(onUpdate).toHaveBeenCalledWith({ variables: { session: 'abc' } });
    });

    it('adds a new variable', () => {
        const onUpdate = vi.fn();
        render(<WorkflowPropertiesPanel workflow={makeWorkflow()} onUpdate={onUpdate} />);
        fireEvent.click(screen.getByRole('button', { name: /add variable/i }));
        const addRow = screen.getAllByPlaceholderText('name').at(-1)!;
        const valRow = screen.getAllByPlaceholderText('value').at(-1)!;
        fireEvent.change(addRow, { target: { value: 'user' } });
        fireEvent.change(valRow, { target: { value: 'mark' } });
        expect(onUpdate).toHaveBeenLastCalledWith({ variables: { user: 'mark' } });
    });

    it('removes a variable', () => {
        const onUpdate = vi.fn();
        render(<WorkflowPropertiesPanel workflow={makeWorkflow({ token: 'abc' })} onUpdate={onUpdate} />);
        const removeBtn = screen.getAllByRole('button', { name: /remove variable/i })[0];
        fireEvent.click(removeBtn);
        expect(onUpdate).toHaveBeenCalledWith({ variables: {} });
    });

    it('renders the editable variables section label', () => {
        render(<WorkflowPropertiesPanel workflow={makeWorkflow()} onUpdate={vi.fn()} />);
        expect(screen.getByText('Variables')).toBeInTheDocument();
    });
});
