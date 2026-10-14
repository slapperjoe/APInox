import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TestSuiteSummary } from '../TestSuiteSummary';

vi.mock('../../ContextHelpButton', () => ({ ContextHelpButton: () => null }));

describe('TestSuiteSummary variables editor', () => {
    it('hides the editor when no onUpdateVariables is provided', () => {
        render(<TestSuiteSummary suite={{ id: 's1', name: 'Suite', testCases: [] }} />);
        expect(screen.queryByDisplayValue('sv')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /add variable/i })).not.toBeInTheDocument();
    });

    it('lists the suite variables as name→value rows', () => {
        render(
            <TestSuiteSummary
                suite={{ id: 's1', name: 'Suite', testCases: [], variables: { baseUrl: 'sv' } }}
                onUpdateVariables={vi.fn()}
            />,
        );
        expect(screen.getByDisplayValue('baseUrl')).toBeInTheDocument();
        expect(screen.getByDisplayValue('sv')).toBeInTheDocument();
    });

    it('edits a value and writes it back via onUpdateVariables', () => {
        const onUpdateVariables = vi.fn();
        render(
            <TestSuiteSummary
                suite={{ id: 's1', name: 'Suite', testCases: [], variables: { baseUrl: 'sv' } }}
                onUpdateVariables={onUpdateVariables}
            />,
        );
        fireEvent.change(screen.getByDisplayValue('sv'), { target: { value: 'sv2' } });
        expect(onUpdateVariables).toHaveBeenCalledWith({ baseUrl: 'sv2' });
    });
});
