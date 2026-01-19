import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MonacoRequestEditor } from '../MonacoRequestEditor';
// Mock monaco-editor
vi.mock('@monaco-editor/react', () => {
    const Editor = ({ onMount, onChange, value, defaultValue }) => {
        const [content, setContent] = React.useState(defaultValue || value || '');
        const contentRef = React.useRef(content);
        // Keep ref in sync
        React.useEffect(() => {
            contentRef.current = content;
        }, [content]);
        React.useEffect(() => {
            const mockEditor = {
                getValue: () => contentRef.current,
                setValue: (v) => setContent(v),
                setPosition: vi.fn(),
                getPosition: () => ({ lineNumber: 1, column: 1 }),
                getModel: () => ({
                    getValue: () => contentRef.current,
                    setValue: (v) => setContent(v),
                    getValueInRange: vi.fn(),
                    getOffsetAt: vi.fn(),
                    // add required methods for decorations
                    getAllDecorations: () => [],
                    deltaDecorations: vi.fn(),
                }),
                getSelection: vi.fn(),
                executeEdits: (_source, edits) => {
                    // Simulate text insertion by calling onChange with new text
                    // This is a simplified simulation
                    if (onChange && edits.length > 0) {
                        // Assuming insert at end or replace for simplicity in test
                        onChange(edits[0].text);
                    }
                },
                focus: vi.fn(),
                onDidFocusEditorText: vi.fn(),
                addAction: vi.fn(),
                hasTextFocus: () => true,
                revealLine: vi.fn(),
            };
            if (onMount) {
                onMount(mockEditor, { KeyCode: {}, KeyMod: {} });
            }
        }, [onMount]); // Only run on mount to properly simulate Monaco instance creation
        return (_jsx("textarea", { "data-testid": "monaco-editor", value: content, onChange: (e) => {
                setContent(e.target.value);
                if (onChange)
                    onChange(e.target.value);
            } }));
    };
    return {
        default: Editor,
        loader: { config: vi.fn() }
    };
});
// Mock monaco-editor library main entry point
vi.mock('monaco-editor', () => ({
    editor: {
        setModelLanguage: vi.fn(),
    },
    KeyCode: { Enter: 13 },
    KeyMod: { CtrlCmd: 2048, KeyC: 33, KeyV: 50, KeyX: 52 }
}));
vi.mock('../utils/bridge', () => ({
    bridge: {
        sendMessage: vi.fn()
    }
}));
// Mock useWildcardDecorations hook
vi.mock('../hooks/useWildcardDecorations', () => ({
    useWildcardDecorations: vi.fn()
}));
describe('MonacoRequestEditor', () => {
    const defaultProps = {
        value: '<request></request>',
        onChange: vi.fn(),
        requestId: 'initial-req'
    };
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('should render correctly', () => {
        render(_jsx(MonacoRequestEditor, { ...defaultProps }));
        expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
        expect(screen.getByTestId('monaco-editor')).toHaveValue(defaultProps.value);
    });
    it('should call onChange when content changes', () => {
        render(_jsx(MonacoRequestEditor, { ...defaultProps }));
        const editor = screen.getByTestId('monaco-editor');
        const newValue = '<request>updated</request>';
        // Simulate change directly via the mock's onChange handler
        fireEvent.change(editor, { target: { value: newValue } });
        expect(defaultProps.onChange).toHaveBeenCalledWith(newValue);
    });
    it('should expose insertText method via ref', () => {
        const ref = React.createRef();
        render(_jsx(MonacoRequestEditor, { ...defaultProps, ref: ref }));
        expect(ref.current).not.toBeNull();
        expect(ref.current).toHaveProperty('insertText');
        if (ref.current) {
            ref.current.insertText('inserted content');
            expect(defaultProps.onChange).toHaveBeenCalledWith('inserted content');
        }
    });
    it('should handle value updates from props', () => {
        // Test that updating props updates the mock editor value
        const { rerender } = render(_jsx(MonacoRequestEditor, { ...defaultProps }));
        const newValue = '<new>value</new>';
        rerender(_jsx(MonacoRequestEditor, { ...defaultProps, value: newValue, requestId: "new-id" }));
        expect(screen.getByTestId('monaco-editor')).toHaveValue(newValue);
    });
});
