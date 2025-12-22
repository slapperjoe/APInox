import React, { useRef } from 'react';
import Editor, { Monaco, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import styled from 'styled-components';
import { useWildcardDecorations } from '../hooks/useWildcardDecorations';

loader.config({ monaco });

const EditorContainer = styled.div`
  height: 100%;
  width: 100%;
  overflow: hidden;
`;

export interface MonacoRequestEditorProps {
    value: string;
    onChange: (value: string) => void;
    language?: string;
    readOnly?: boolean;
}

export const MonacoRequestEditor: React.FC<MonacoRequestEditorProps> = ({
    value,
    onChange,
    language = 'xml',
    readOnly = false
}) => {
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<Monaco | null>(null);

    // Use shared hook for decorations
    useWildcardDecorations(editorRef.current, monacoRef.current, value);

    const handleEditorDidMount = (editor: any, monaco: Monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        // Hook will trigger update via dependency on refs/value, but initial mount might race.
        // The dependency [value, editor, monaco] in the hook handles it once refs are set and value exists.

        // Force bind standard clipboard shortcuts with robust handling
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => {
            editor.trigger('keyboard', 'editor.action.clipboardCopyAction', null);
        });
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {
            // Explicitly read from clipboard and insert
            navigator.clipboard.readText()
                .then(text => {
                    const selection = editor.getSelection();
                    if (selection) {
                        editor.executeEdits('clipboard', [{
                            range: selection,
                            text: text,
                            forceMoveMarkers: true
                        }]);
                    }
                })
                .catch(err => {
                    console.error('Paste failed: ', err);
                    editor.trigger('keyboard', 'editor.action.clipboardPasteAction', null);
                });
        });
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX, () => {
            editor.trigger('keyboard', 'editor.action.clipboardCutAction', null);
        });
    };

    return (
        <EditorContainer>
            <style>
                {/* Styles moved to index.css */}
            </style>
            <Editor
                height="100%"
                defaultLanguage={language}
                value={value}
                onChange={(val) => onChange(val || '')}
                theme="vs-dark" // Default to dark, ideally sync with VSCode theme
                onMount={handleEditorDidMount}
                options={{
                    minimap: { enabled: false }, // Save space
                    fontSize: 14,
                    fontFamily: 'var(--vscode-editor-font-family)',
                    scrollBeyondLastLine: false,
                    readOnly: readOnly,
                    folding: true,
                    automaticLayout: true,
                    lineNumbers: 'on',
                    renderLineHighlight: 'none',
                    contextmenu: true, // Enable default context menu for Copy/Paste
                }}
            />
        </EditorContainer>
    );
};
