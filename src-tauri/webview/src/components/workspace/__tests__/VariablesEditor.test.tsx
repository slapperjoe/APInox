/**
 * Regression tests for VariablesEditor's commit round-trip.
 *
 * Bug pinned: clicking "+ Add variable" briefly showed the new row, then it
 * disappeared and the empty state / add button came back. Every edit commits
 * the trimmed map upward; the global store then re-hydrates the case/suite
 * with NEW object identity, and the prop-driven rows reset wiped the
 * transient blank row (which is never committed — empty names are dropped).
 * The editor now ignores prop echoes of its own commits and only resets rows
 * on a genuinely external change.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { VariablesEditor } from '../VariablesEditor';

const nameInputs = () => screen.getAllByPlaceholderText('name');
const valueInputs = () => screen.getAllByPlaceholderText('value');
const addButton = () => screen.getByRole('button', { name: /add variable/i });

describe('VariablesEditor', () => {
    it('lists committed variables as name→value rows', () => {
        render(<VariablesEditor variables={{ token: 'abc' }} onChange={vi.fn()} />);
        expect(screen.getByDisplayValue('token')).toBeInTheDocument();
        expect(screen.getByDisplayValue('abc')).toBeInTheDocument();
    });

    it('keeps the new blank row when the parent reflects the commit back as a fresh object', () => {
        // The round-trip: addRow commits {} (blank row dropped), the store
        // re-hydrates the case/suite, and `variables` comes back as a NEW
        // object with the same content.
        const { rerender } = render(<VariablesEditor variables={{ token: 'abc' }} onChange={vi.fn()} />);
        fireEvent.click(addButton());
        expect(nameInputs()).toHaveLength(2);
        expect((nameInputs().at(-1) as HTMLInputElement).value).toBe('');

        rerender(<VariablesEditor variables={{ token: 'abc' }} onChange={vi.fn()} />);
        expect(nameInputs()).toHaveLength(2);
        expect((nameInputs().at(-1) as HTMLInputElement).value).toBe('');
        expect(valueInputs()).toHaveLength(2);
    });

    it('keeps the blank row for a suite that had no variables at all (undefined → {})', () => {
        // Suite-level variant: `suite.variables` is undefined until the first
        // commit, then re-hydrates as a fresh {}.
        const { rerender } = render(<VariablesEditor onChange={vi.fn()} />);
        fireEvent.click(addButton());
        expect(nameInputs()).toHaveLength(1);

        rerender(<VariablesEditor variables={{}} onChange={vi.fn()} />);
        expect(nameInputs()).toHaveLength(1);
        expect((nameInputs().at(-1) as HTMLInputElement).value).toBe('');
    });

    it('keeps typed values across the round-trip', () => {
        const onChange = vi.fn();
        const { rerender } = render(<VariablesEditor variables={{ token: 'abc' }} onChange={onChange} />);
        fireEvent.click(addButton());
        const newName = nameInputs().at(-1) as HTMLInputElement;
        const newValue = valueInputs().at(-1) as HTMLInputElement;
        fireEvent.change(newName, { target: { value: 'user' } });
        fireEvent.change(newValue, { target: { value: 'mark' } });
        expect(onChange).toHaveBeenLastCalledWith({ token: 'abc', user: 'mark' });

        // Store reflects the committed map back as a fresh object.
        rerender(<VariablesEditor variables={{ token: 'abc', user: 'mark' }} onChange={onChange} />);
        expect(screen.getByDisplayValue('user')).toBeInTheDocument();
        expect(screen.getByDisplayValue('mark')).toBeInTheDocument();
        expect(nameInputs()).toHaveLength(2);
    });

    it('still resets rows when the variables change externally (different content)', () => {
        const { rerender } = render(<VariablesEditor variables={{ token: 'abc' }} onChange={vi.fn()} />);
        expect(screen.getByDisplayValue('token')).toBeInTheDocument();

        // No local edit — an external surface changed the map.
        rerender(<VariablesEditor variables={{ other: 'xyz' }} onChange={vi.fn()} />);
        expect(screen.queryByDisplayValue('token')).not.toBeInTheDocument();
        expect(screen.getByDisplayValue('other')).toBeInTheDocument();
        expect(screen.getByDisplayValue('xyz')).toBeInTheDocument();
    });

    it('commits the trimmed map on every edit (blank rows dropped)', () => {
        const onChange = vi.fn();
        render(<VariablesEditor variables={{ token: 'abc' }} onChange={onChange} />);
        fireEvent.click(addButton());
        // The blank row commits the unchanged map (empty names dropped).
        expect(onChange).toHaveBeenLastCalledWith({ token: 'abc' });

        const newName = nameInputs().at(-1) as HTMLInputElement;
        fireEvent.change(newName, { target: { value: 'user' } });
        expect(onChange).toHaveBeenLastCalledWith({ token: 'abc', user: '' });
    });

    /**
     * Renaming a variable has to change the definition AND what points at it. The editor
     * used to change only the definition, so every `{{oldName}}` in the step bodies was left
     * dangling — silently, because nothing warned.
     */
    describe('renaming a variable', () => {
        it('propagates the rename on blur, not on every keystroke', () => {
            const onRenameVariable = vi.fn(() => 2);
            render(
                <VariablesEditor
                    variables={{ token: 'abc' }}
                    onChange={vi.fn()}
                    onRenameVariable={onRenameVariable}
                />
            );

            const name = nameInputs()[0] as HTMLInputElement;
            fireEvent.focus(name);
            fireEvent.change(name, { target: { value: 'tok' } });

            // Typing one character at a time would propagate partial renames into the
            // references, so the rename is committed on blur.
            expect(onRenameVariable).not.toHaveBeenCalled();

            fireEvent.blur(name);
            expect(onRenameVariable).toHaveBeenCalledWith('token', 'tok');
        });

        it('reports how many references it updated', () => {
            const onRenameVariable = vi.fn(() => 2);
            render(
                <VariablesEditor
                    variables={{ token: 'abc' }}
                    onChange={vi.fn()}
                    onRenameVariable={onRenameVariable}
                />
            );

            const name = nameInputs()[0] as HTMLInputElement;
            fireEvent.focus(name);
            fireEvent.change(name, { target: { value: 'tok' } });
            fireEvent.blur(name);

            expect(screen.getByTestId('rename-note')).toHaveTextContent('updated 2 references');
        });

        it('says so when a rename leaves references dangling', () => {
            // Without a rename handler the editor changes only the definition. That is the
            // footgun, so it must be stated rather than glossed over.
            render(<VariablesEditor variables={{ token: 'abc' }} onChange={vi.fn()} />);

            const name = nameInputs()[0] as HTMLInputElement;
            fireEvent.focus(name);
            fireEvent.change(name, { target: { value: 'tok' } });
            fireEvent.blur(name);

            expect(screen.getByTestId('rename-note')).toHaveTextContent('references to {{token}} are not updated');
        });

        it('does not call the handler when the name is unchanged', () => {
            const onRenameVariable = vi.fn();
            render(
                <VariablesEditor
                    variables={{ token: 'abc' }}
                    onChange={vi.fn()}
                    onRenameVariable={onRenameVariable}
                />
            );

            const name = nameInputs()[0] as HTMLInputElement;
            fireEvent.focus(name);
            fireEvent.change(name, { target: { value: 'token' } });
            fireEvent.blur(name);

            expect(onRenameVariable).not.toHaveBeenCalled();
        });
    });
});
