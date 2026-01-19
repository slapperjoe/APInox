import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRef, useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { bridge } from '../utils/bridge';
import { Toolbar, ToolbarButton } from '../styles/WorkspaceLayout.styles';
import { ChevronLeft, Play } from 'lucide-react';
import { ScriptPlaygroundModal } from './modals/ScriptPlaygroundModal';
import { ToolbarSeparator } from '../styles/WorkspaceLayout.styles';
export const ScriptEditor = ({ step, onUpdate, isReadOnly, onBack }) => {
    const editorRef = useRef(null);
    // Initialize local state from prop
    const [scriptContent, setScriptContent] = useState(step.config.scriptContent || '');
    const [showPlayground, setShowPlayground] = useState(false);
    // Track previous prop value to detect actual remote changes
    const prevStepContent = useRef(step.config.scriptContent);
    // Update local state and ref ONLY if prop actually changes remotely (e.g. undo/redo or initial load)
    useEffect(() => {
        if (step.config.scriptContent !== prevStepContent.current) {
            // Only update if the incoming prop is different from what we expect
            // This prevents local typing from being overwritten by the prop update it triggered
            if (scriptContent !== step.config.scriptContent) {
                setScriptContent(step.config.scriptContent || '');
            }
            prevStepContent.current = step.config.scriptContent;
        }
    }, [step.config.scriptContent]); // Removed scriptContent dep to avoid loops
    // Refs for flush-on-unmount pattern
    const latestScriptContent = useRef(scriptContent);
    const latestStep = useRef(step);
    const onUpdateRef = useRef(onUpdate);
    // Keep refs in sync
    useEffect(() => {
        latestScriptContent.current = scriptContent;
        latestStep.current = step;
        onUpdateRef.current = onUpdate;
    }, [scriptContent, step, onUpdate]);
    // Auto-save effect with debounce AND flush on unmount
    useEffect(() => {
        const timer = setTimeout(() => {
            // Debounced Save
            if (latestScriptContent.current !== latestStep.current.config.scriptContent) {
                bridge.sendMessage({ command: 'log', message: `[ScriptEditor] Auto-saving step (debounce): ${latestStep.current.id}` });
                onUpdateRef.current({
                    ...latestStep.current,
                    config: {
                        ...latestStep.current.config,
                        scriptContent: latestScriptContent.current
                    }
                });
                prevStepContent.current = latestScriptContent.current;
            }
        }, 800);
        return () => {
            clearTimeout(timer);
            // Flush on Unmount / Cleanup
            // If content is still different from prop, save immediately
            if (latestScriptContent.current !== latestStep.current.config.scriptContent) {
                bridge.sendMessage({ command: 'log', message: `[ScriptEditor] Auto-saving step (flush): ${latestStep.current.id}` });
                onUpdateRef.current({
                    ...latestStep.current,
                    config: {
                        ...latestStep.current.config,
                        scriptContent: latestScriptContent.current
                    }
                });
                prevStepContent.current = latestScriptContent.current;
            }
        };
    }, [scriptContent]); // Trigger on every keystroke (for debounce reset)
    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;
        // Configure JavaScript defaults for the Sandbox API
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false,
        });
        // Add extra lib for API autocomplete
        const libUri = 'ts:filename/sandbox.d.ts';
        monaco.languages.typescript.javascriptDefaults.addExtraLib(`
            /**
             * Log a message to the test runner output.
             * @param message The message to log.
             */
            declare function log(message: string): void;

            /**
             * Fail the current test step/case with a reason.
             * @param reason The error message.
             */
            declare function fail(reason: string): void;

            /**
             * Jump to a specific step in the test case.
             * @param stepName The exact name of the step to jump to.
             */
            declare function goto(stepName: string): void;

            /**
             * Pause execution for a specified duration.
             * @param ms Duration in milliseconds.
             */
            declare function delay(ms: number): Promise<void>;

            /**
             * Shared context object for storing variables across steps.
             */
            declare const context: Record<string, any>;
        `, libUri);
    };
    const handleChange = (value) => {
        if (value !== undefined) {
            setScriptContent(value);
        }
    };
    const handleBack = () => {
        if (onBack) {
            onBack();
        }
    };
    return (_jsxs("div", { style: { flex: 1, height: '100%', display: 'flex', flexDirection: 'column', width: '100%' }, children: [_jsxs(Toolbar, { children: [onBack && (_jsxs(_Fragment, { children: [_jsxs(ToolbarButton, { onClick: handleBack, title: "Back to Test Case", children: [_jsx(ChevronLeft, { size: 14 }), " Back"] }), _jsx(ToolbarSeparator, {})] })), _jsx("div", { style: { display: 'flex', alignItems: 'center', flex: 1 }, children: _jsxs("span", { style: { fontWeight: 'bold', marginLeft: 10 }, children: ["Script: ", step.name] }) }), _jsxs(ToolbarButton, { onClick: () => setShowPlayground(true), title: "Run in Playground", children: [_jsx(Play, { size: 14 }), " Playground"] })] }), _jsx("div", { style: { padding: '5px 10px', background: 'var(--vscode-editor-background)', borderBottom: '1px solid var(--vscode-panel-border)' }, children: _jsxs("span", { style: { fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }, children: ["API: ", _jsx("code", { children: "log(msg)" }), ", ", _jsx("code", { children: "context" }), ", ", _jsx("code", { children: "goto(step)" }), ", ", _jsx("code", { children: "delay(ms)" }), "."] }) }), _jsx("div", { style: { flex: 1, overflow: 'hidden' }, children: _jsx(Editor, { height: "100%", defaultLanguage: "javascript", theme: "vs-dark" // We should ideally inherit from VS Code theme
                    , value: scriptContent, onChange: handleChange, onMount: handleEditorDidMount, options: {
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 14,
                        readOnly: isReadOnly,
                        automaticLayout: true,
                    } }) }), showPlayground && (_jsx(ScriptPlaygroundModal, { scriptType: "step", initialScript: scriptContent, onClose: () => setShowPlayground(false) }))] }));
};
