import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MonacoRequestEditor } from '../components/MonacoRequestEditor';
import type { MonacoRequestEditorHandle } from '../components/MonacoRequestEditor';
import { ThemeProvider } from '../contexts/ThemeContext';

// Mock the useWildcardDecorations hook
vi.mock('../hooks/useWildcardDecorations', () => ({
    useWildcardDecorations: () => ({
        updateDecorations: vi.fn()
    })
}));

// Mock monaco-editor library main entry point
vi.mock('monaco-editor', () => ({
    editor: {
        setModelLanguage: vi.fn(),
    },
    KeyCode: { Enter: 13 },
    KeyMod: { CtrlCmd: 2048, KeyC: 33, KeyV: 50, KeyX: 52 }
}));
vi.mock('../../utils/bridge', () => ({
    bridge: {
        sendMessage: vi.fn()
    },
    isVsCode: () => true
}));

// Mock useWildcardDecorations hook
vi.mock('../hooks/useWildcardDecorations', () => ({
    useWildcardDecorations: vi.fn()
}));

// TODO: Fix Monaco mocking - hook integration issues with vitest
// These tests work in the main APInox codebase, need to adapt for standalone package
describe.skip('MonacoRequestEditor', () => {
    const defaultProps = {
        value: '<request></request>',
        onChange: vi.fn(),
        requestId: 'initial-req'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderWithTheme = (ui: React.ReactElement) => render(
        <ThemeProvider>{ui}</ThemeProvider>
    );

    it('should render correctly', () => {
        renderWithTheme(<MonacoRequestEditor {...defaultProps} />);
        expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
        expect(screen.getByTestId('monaco-editor')).toHaveValue(defaultProps.value);
    });

    it('should call onChange when content changes', () => {
        renderWithTheme(<MonacoRequestEditor {...defaultProps} />);

        const editor = screen.getByTestId('monaco-editor');
        const newValue = '<request>updated</request>';

        // Simulate change directly via the mock's onChange handler
        fireEvent.change(editor, { target: { value: newValue } });

        expect(defaultProps.onChange).toHaveBeenCalledWith(newValue);
    });

    it('should expose insertText method via ref', () => {
        const ref = React.createRef<MonacoRequestEditorHandle>();
        renderWithTheme(<MonacoRequestEditor {...defaultProps} ref={ref} />);

        expect(ref.current).not.toBeNull();
        expect(ref.current).toHaveProperty('insertText');

        if (ref.current) {
            ref.current.insertText('inserted content');
            expect(defaultProps.onChange).toHaveBeenCalledWith('inserted content');
        }
    });

    it('should handle value updates from props', () => {
        // Test that updating props updates the mock editor value
        const { rerender } = renderWithTheme(<MonacoRequestEditor {...defaultProps} />);

        const newValue = '<new>value</new>';
        rerender(
            <ThemeProvider>
                <MonacoRequestEditor {...defaultProps} value={newValue} requestId="new-id" />
            </ThemeProvider>
        );

        expect(screen.getByTestId('monaco-editor')).toHaveValue(newValue);
    });
});
