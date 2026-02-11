
import { useRef, useImperativeHandle, forwardRef, useEffect, useState } from 'react';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import styled from 'styled-components';
import { useWildcardDecorations } from '../hooks/useWildcardDecorations';
import { bridge } from '../utils/bridge';
import { applyAutoFolding } from '../utils/xmlFoldingUtils';
import { useTheme } from '../contexts/ThemeContext';

loader.config({ monaco });

const EditorContainer = styled.div`
  height: 100%;
  width: 100%;
  overflow: hidden;
`;

interface MonacoRequestEditorProps {
    value: string;
    onChange: (value: string) => void;
    language?: string;
    readOnly?: boolean;
    onFocus?: () => void;
    autoFoldElements?: string[];
    showLineNumbers?: boolean;
    requestId?: string; // Used to detect when user switches to different request
    forceUpdateKey?: number; // Used to force update when value changes externally (e.g. formatting)
    logId?: string; // Debugging ID
    fontSize?: number; // Font size for editor (default: 14)
    fontFamily?: string; // Font family for editor (default: Consolas)
    availableVariables?: Array<{ name: string; value: string | null; source: string }>; // For autocomplete
}

export interface MonacoRequestEditorHandle {
    insertText: (text: string) => void;
    getValue: () => string;
}

export const MonacoRequestEditor = forwardRef<MonacoRequestEditorHandle, MonacoRequestEditorProps>(({
    value,
    onChange,
    language = 'xml',
    readOnly = false,
    onFocus,
    autoFoldElements,
    showLineNumbers = true,
    requestId,
    forceUpdateKey,
    fontSize = 14,
    fontFamily = 'Consolas, "Courier New", monospace',
    availableVariables = []
}, ref) => {
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<Monaco | null>(null);
    const { theme } = useTheme();
    const [editorTheme, setEditorTheme] = useState<string>('vs-dark');
    const previousRequestIdRef = useRef<string | undefined>(undefined);
    const lastSyncedRequestIdRef = useRef<string | undefined>(undefined);
    const lastSyncedForceUpdateKeyRef = useRef<number | undefined>(undefined);

    useImperativeHandle(ref, () => ({
        insertText: (text: string) => {
            if (editorRef.current && monacoRef.current) {
                const editor = editorRef.current;
                const selection = editor.getSelection();
                const op = {
                    range: selection,
                    text: text,
                    forceMoveMarkers: true
                };
                editor.executeEdits("my-source", [op]);
                editor.focus();
            }
        },
        getValue: () => {
            if (editorRef.current) {
                const model = editorRef.current.getModel();
                return model ? model.getValue() : '';
            }
            return '';
        }
    }));

    // Use shared hook for decorations (pass chain variables for validation)
    const { updateDecorations } = useWildcardDecorations(editorRef.current, monacoRef.current, value, availableVariables);

    // Sync value manual implementation to prevent cursor jumps
    useEffect(() => {
        if (editorRef.current) {
            const editor = editorRef.current;
            const model = editor.getModel();
            if (!model) return;


            const currentVal = model.getValue();
            const isNewRequest = requestId !== lastSyncedRequestIdRef.current;
            const isForceUpdate = forceUpdateKey !== undefined && forceUpdateKey !== lastSyncedForceUpdateKeyRef.current;
            const isMount = lastSyncedRequestIdRef.current === undefined;
            const shouldSync = isNewRequest || isForceUpdate || isMount;

            if (shouldSync) {
                // If content is identical, avoid updating to prevent cursor jumps.
                // This specifically handles the "ID Transition" case (Unsaved Name -> Saved ID)
                // where isNewRequest is true but content hasn't changed.
                if (currentVal !== value) {
                    if (isNewRequest) {
                        editor.setValue(value || '');
                    } else {
                        const pos = editor.getPosition();
                        editor.setValue(value || '');
                        if (pos) editor.setPosition(pos);
                    }
                }
            }
            if (forceUpdateKey !== undefined) {
                lastSyncedForceUpdateKeyRef.current = forceUpdateKey;
            }
            lastSyncedRequestIdRef.current = requestId;
        }
        // Removed `value` from dependencies to strictly enforce Force Update pattern.
        // We do NOT want to react to value prop changes unless it is a new request or forced.
    }, [requestId, forceUpdateKey]);

    const applyEditorTheme = (monacoInstance: Monaco) => {
        const root = document.documentElement;
        const getVar = (name: string, fallback: string) => {
            const value = getComputedStyle(root).getPropertyValue(name).trim();
            return value || fallback;
        };

        const isLight = theme.includes('light');
        const themeId = `apinox-${theme}`;

        monacoInstance.editor.defineTheme(themeId, {
            base: isLight ? 'vs' : 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': getVar('--apinox-editor-background', isLight ? '#ffffff' : '#1e1e1e'),
                'editor.foreground': getVar('--apinox-editor-foreground', isLight ? '#000000' : '#d4d4d4'),
                'editor.selectionBackground': getVar('--apinox-editor-selectionBackground', isLight ? '#add6ff' : '#264f78'),
                'editor.lineHighlightBackground': getVar('--apinox-editor-lineHighlightBackground', 'transparent'),
                'editorCursor.foreground': getVar('--apinox-editorCursor-foreground', isLight ? '#000000' : '#ffffff'),
                'editorLineNumber.foreground': getVar('--apinox-editorLineNumber-foreground', isLight ? '#999999' : '#858585'),
                'editorLineNumber.activeForeground': getVar('--apinox-editorLineNumber-activeForeground', isLight ? '#000000' : '#c6c6c6'),
                'editorWhitespace.foreground': getVar('--apinox-editorWhitespace-foreground', isLight ? '#d3d3d3' : '#404040')
            }
        });

        monacoInstance.editor.setTheme(themeId);
        setEditorTheme(themeId);
    };

    const handleEditorDidMount = (editor: any, monaco: Monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        applyEditorTheme(monaco);

        editor.onDidFocusEditorText(() => {
            if (onFocus) onFocus();
        });

        if (autoFoldElements && autoFoldElements.length > 0 && value) {
            applyAutoFolding(editor, value, autoFoldElements);
        }

        // Apply wildcard decorations after editor is fully mounted
        setTimeout(() => {
            updateDecorations();
        }, 0);

        // Fix Enter key to insert newline (prevents Enter from being stolen)
        editor.addAction({
            id: 'insert-newline',
            label: 'Insert Newline',
            keybindings: [monaco.KeyCode.Enter],
            run: (ed) => {
                ed.trigger('keyboard', 'type', { text: '\n' });
            }
        });

        // --- Clipboard Fixes ---

        const doPaste = async (ed: any) => {
            try {
                // Try Native Web API first
                const text = await navigator.clipboard.readText();
                if (text) {
                    const selection = ed.getSelection();
                    ed.executeEdits('clipboard', [{ range: selection, text: text, forceMoveMarkers: true }]);
                }
            } catch (e) {
                // Fallback to Backend
                bridge.sendMessage({ command: 'clipboardAction', action: 'read' });
            }
        };

        // Paste (Ctrl+V)
        editor.addAction({
            id: 'custom-paste',
            label: 'Paste',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV],
            run: doPaste
        });

        // Paste (Context Menu Override)
        editor.addAction({
            id: 'editor.action.clipboardPasteAction',
            label: 'Paste',
            precondition: '!readonly',
            run: doPaste
        });

        // --- Variable Autocomplete ---
        // Register completion provider for ${...} variables (chain variables)
        if (availableVariables.length > 0) {
            monaco.languages.registerCompletionItemProvider(language, {
                triggerCharacters: ['$', '{'],
                provideCompletionItems: (model, position) => {
                    const textUntilPosition = model.getValueInRange({
                        startLineNumber: position.lineNumber,
                        startColumn: 1,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column
                    });

                    // Check if we're typing ${...}
                    const match = textUntilPosition.match(/\$\{([^}]*)$/);
                    if (!match) {
                        return { suggestions: [] };
                    }

                    const word = model.getWordUntilPosition(position);
                    const range = {
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn: word.startColumn,
                        endColumn: word.endColumn
                    };

                    const suggestions = availableVariables.map((variable) => ({
                        label: variable.name,
                        kind: monaco.languages.CompletionItemKind.Variable,
                        detail: variable.value ? `= ${variable.value}` : '(not yet extracted)',
                        documentation: `From: ${variable.source}\nValue: ${variable.value || 'pending'}`,
                        insertText: variable.name,
                        range: range
                    }));

                    return { suggestions };
                }
            });
        }

        // Register completion provider for {{...}} variables (env/global/functions)
        monaco.languages.registerCompletionItemProvider(language, {
            triggerCharacters: ['{'],
            provideCompletionItems: (model, position) => {
                const textUntilPosition = model.getValueInRange({
                    startLineNumber: position.lineNumber,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });

                // Check if we're typing {{...}}
                const match = textUntilPosition.match(/\{\{([^}]*)$/);
                if (!match) {
                    return { suggestions: [] };
                }

                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };

                const suggestions: any[] = [];

                // Add function suggestions
                const functions = [
                    { name: 'uuid', detail: 'Generate a new UUID', doc: 'Generates a random UUID v4 identifier' },
                    { name: 'newguid', detail: 'Generate a new GUID', doc: 'Alias for uuid - generates a random UUID' },
                    { name: 'now', detail: 'Current timestamp (ISO)', doc: 'Returns the current date/time in ISO 8601 format' },
                    { name: 'epoch', detail: 'Current Unix timestamp', doc: 'Returns the current Unix timestamp in seconds' },
                    { name: 'randomInt(1,100)', detail: 'Random integer', doc: 'Generate a random integer between min and max (inclusive)\nExample: {{randomInt(1,100)}}' },
                    { name: 'lorem(5)', detail: 'Lorem ipsum text', doc: 'Generate lorem ipsum placeholder text\nExample: {{lorem(10)}} generates 10 words' },
                    { name: 'name', detail: 'Random name', doc: 'Generates a random full name' },
                    { name: 'country', detail: 'Random country', doc: 'Generates a random country name' },
                    { name: 'state', detail: 'Random US state', doc: 'Generates a random US state name' },
                    { name: 'now+1d', detail: 'Date math (future)', doc: 'Add time to current date\nExamples: {{now+1d}} (1 day), {{now+2m}} (2 months), {{now+3y}} (3 years)' },
                    { name: 'now-1d', detail: 'Date math (past)', doc: 'Subtract time from current date\nExamples: {{now-1d}} (1 day ago), {{now-2m}} (2 months ago)' },
                    { name: 'env', detail: 'Environment endpoint URL', doc: 'Shortcut for the current environment\'s endpoint URL' },
                    { name: 'url', detail: 'Environment endpoint URL', doc: 'Shortcut for the current environment\'s endpoint URL (alias for env)' }
                ];

                functions.forEach(fn => {
                    suggestions.push({
                        label: fn.name,
                        kind: monaco.languages.CompletionItemKind.Function,
                        detail: fn.detail,
                        documentation: fn.doc,
                        insertText: fn.name,
                        range: range
                    });
                });

                // TODO: Add environment and global variables when available
                // This would require passing them as props similar to availableVariables

                return { suggestions };
            }
        });

        // Copy (Ctrl+C)
        const doCopy = (ed: any) => {
            const selection = ed.getSelection();
            const text = ed.getModel()?.getValueInRange(selection);
            if (text) {
                // Try Native + Backend for redundancy coverage
                navigator.clipboard.writeText(text).catch(() => { });
                bridge.sendMessage({ command: 'clipboardAction', action: 'write', text });
            }
        };

        editor.addAction({
            id: 'custom-copy',
            label: 'Copy',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC],
            run: doCopy
        });

        // Copy (Context Menu Override)
        editor.addAction({
            id: 'editor.action.clipboardCopyAction',
            label: 'Copy',
            run: doCopy
        });

        // Cut (Ctrl+X)
        const doCut = (ed: any) => {
            const selection = ed.getSelection();
            const text = ed.getModel()?.getValueInRange(selection);
            if (text) {
                navigator.clipboard.writeText(text).catch(() => { });
                bridge.sendMessage({ command: 'clipboardAction', action: 'write', text });
                // Delete selection
                ed.executeEdits('clipboard', [{ range: selection, text: '', forceMoveMarkers: true }]);
            }
        };

        editor.addAction({
            id: 'custom-cut',
            label: 'Cut',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX],
            run: doCut
        });

        // Cut (Context Menu Override)
        editor.addAction({
            id: 'editor.action.clipboardCutAction',
            label: 'Cut',
            precondition: '!readonly',
            run: doCut
        });

        // --- End Clipboard Fixes ---
    };

    useEffect(() => {
        if (monacoRef.current) {
            applyEditorTheme(monacoRef.current);
        }
    }, [theme]);

    // Listen for Clipboard Data from Backend (Fallback for Paste)
    // Listen for Clipboard Data from Backend (Fallback for Paste)
    useEffect(() => {
        // Log mount
        bridge.sendMessage({ command: 'log', message: `[MonacoRequestEditor] Mounted. RequestId: ${requestId}` });

        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.command === 'clipboardText' && message.text) {
                if (editorRef.current) {
                    const ed = editorRef.current;
                    // Prevent pasting if not focused (avoids broadcasting paste to all editors)
                    if (ed.hasTextFocus()) {
                        const selection = ed.getSelection();
                        ed.executeEdits('clipboard', [{ range: selection, text: message.text, forceMoveMarkers: true }]);
                        ed.focus();
                    }
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => {
            bridge.sendMessage({ command: 'log', message: `[MonacoRequestEditor] Unmounted. RequestId: ${requestId}` });
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    const editorOptions = {
        minimap: { enabled: false }, // Save space
        fontSize: fontSize,
        fontFamily: fontFamily,
        scrollBeyondLastLine: false,
        readOnly: readOnly,
        folding: true,
        automaticLayout: true,
        lineNumbers: showLineNumbers ? 'on' : 'off',
        renderLineHighlight: 'none',
        contextmenu: true,
        acceptSuggestionOnEnter: 'off',
        quickSuggestions: false,
    };

    // Apply auto-folding when switching to a different request
    useEffect(() => {
        if (!editorRef.current || !autoFoldElements || autoFoldElements.length === 0 || !value) {
            previousRequestIdRef.current = requestId;
            return;
        }

        const currentReqId = requestId || '';
        const prevReqId = previousRequestIdRef.current || '';

        if (currentReqId && prevReqId && currentReqId !== prevReqId) {
            applyAutoFolding(editorRef.current, value, autoFoldElements);
        } else if (!previousRequestIdRef.current && requestId) {
            applyAutoFolding(editorRef.current, value, autoFoldElements);
        }

        previousRequestIdRef.current = requestId;
    }, [requestId, value, autoFoldElements]);

    // Keep Monaco language in sync when request or body type changes
    useEffect(() => {
        if (!editorRef.current || !language) return;
        const model = editorRef.current.getModel?.();
        if (model) {
            monaco.editor.setModelLanguage(model, language);
        }
    }, [language, requestId]);

    return (
        <EditorContainer>
            <style>

            </style>
            <Editor
                height="100%"
                key={`request-editor-${theme}`}
                defaultLanguage={language}
                defaultValue={value}
                onChange={(val) => {
                    console.log('[MonacoRequestEditor] onChange fired, val length:', val?.length, 'requestId:', requestId);
                    onChange(val || '');
                }}
                theme={editorTheme}
                onMount={handleEditorDidMount}
                options={editorOptions as any}
            />
        </EditorContainer>
    );
});
