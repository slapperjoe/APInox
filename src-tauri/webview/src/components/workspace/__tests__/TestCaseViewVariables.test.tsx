import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TestCaseView } from '../TestCaseView';

vi.mock('../../ContextHelpButton', () => ({ ContextHelpButton: () => null }));

describe('TestCaseView variables editor', () => {
    it('hides the editor when no onUpdateVariables is provided', () => {
        render(<TestCaseView testCase={{ id: 'c1', name: 'Case', steps: [] }} />);
        expect(screen.queryByDisplayValue('abc')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /add variable/i })).not.toBeInTheDocument();
    });

    it('lists the case variables as name→value rows', () => {
        render(
            <TestCaseView
                testCase={{ id: 'c1', name: 'Case', steps: [], variables: { token: 'abc' } }}
                onUpdateVariables={vi.fn()}
            />,
        );
        expect(screen.getByDisplayValue('token')).toBeInTheDocument();
        expect(screen.getByDisplayValue('abc')).toBeInTheDocument();
    });

    it('edits a value and writes it back via onUpdateVariables', () => {
        const onUpdateVariables = vi.fn();
        render(
            <TestCaseView
                testCase={{ id: 'c1', name: 'Case', steps: [], variables: { token: 'abc' } }}
                onUpdateVariables={onUpdateVariables}
            />,
        );
        fireEvent.change(screen.getByDisplayValue('abc'), { target: { value: 'def' } });
        expect(onUpdateVariables).toHaveBeenCalledWith({ token: 'def' });
    });

    it('adds a variable and commits via onUpdateVariables', () => {
        const onUpdateVariables = vi.fn();
        render(<TestCaseView testCase={{ id: 'c1', name: 'Case', steps: [] }} onUpdateVariables={onUpdateVariables} />);
        fireEvent.click(screen.getByRole('button', { name: /add variable/i }));
        const addRow = screen.getAllByPlaceholderText('name').at(-1)!;
        const valRow = screen.getAllByPlaceholderText('value').at(-1)!;
        fireEvent.change(addRow, { target: { value: 'user' } });
        fireEvent.change(valRow, { target: { value: 'mark' } });
        expect(onUpdateVariables).toHaveBeenLastCalledWith({ user: 'mark' });
    });
});
