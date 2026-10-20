import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { MonacoEditorWrapper, Monaco } from "../monaco";
import styled from "styled-components";
import { useWildcardDecorations } from "../hooks/useWildcardDecorations";
import { applyAutoFolding } from "../utils/xmlFoldingUtils";
import { completionRangeAndText } from "../utils/templateCompletion";
import { useTheme } from "../contexts/ThemeContext";
import { applyMonacoTheme } from "../utils/monacoTheme";
import { debugWarn } from "../utils/logger";

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
  showMinimap?: boolean; // NEW: Show minimap
  requestId?: string; // Used to detect when user switches to different request
  forceUpdateKey?: number; // Used to force update when value changes externally (e.g. formatting)
  logId?: string; // Debugging ID
  fontSize?: number; // Font size for editor (default: 14)
  fontFamily?: string; // Font family for editor (default: Consolas)
  availableVariables?: Array<{
    name: string;
    value: string | null;
    source: string;
  }>; // For ${...} autocomplete
  availableEnvVariables?: Array<{
    name: string;
    value: string | null;
    source: string;
  }>; // For {{...}} autocomplete (env/global variables)
  onLog?: (
    message: string,
    level?: "info" | "warn" | "error" | "debug",
  ) => void; // Logging callback
}

export interface MonacoRequestEditorHandle {
  insertText: (text: string) => void;
  getValue: () => string;
}

// R5 (MONACO_LAG_ROOT_CAUSE.md): completion providers are a shared,
// per-language monaco resource. Previously each mounted request editor
// registered its own pair of providers (2 per mount, cumulative across
// tabs and theme-flip remounts), so every suggest query ran 2N providers
// for N editors, and typing `{{` in one editor could fire another
// editor's stale provider. Providers are now registered ONCE per language
// and read each editor's current variables live, keyed by that editor's
// model URI (published in MonacoRequestEditor's onMount).
// Exported for tests (the provider test populates them with a fake monaco).
export const variableCompletionRegistered = new Set<string>();
export const editorVariablesByModel = new Map<
  string,
  () => Array<{ name: string; value: string | null; source: string }>
>();
export const editorEnvVariablesByModel = new Map<
  string,
  () => Array<{ name: string; value: string | null; source: string }>
>();

function getEditorVariables(model: any): Array<{
  name: string;
  value: string | null;
  source: string;
}> {
  if (!model || !model.uri) return [];
  const provider = editorVariablesByModel.get(model.uri.toString());
  return provider ? provider() : [];
}

function getEditorEnvVariables(model: any): Array<{
  name: string;
  value: string | null;
  source: string;
}> {
  if (!model || !model.uri) return [];
  const provider = editorEnvVariablesByModel.get(model.uri.toString());
  return provider ? provider() : [];
}

export function ensureVariableCompletionProviders(monaco: Monaco, language: string): void {
  if (variableCompletionRegistered.has(language)) {
    return;
  }
  variableCompletionRegistered.add(language);

  // Defensive: test environments mock monaco-editor without `languages`.
  if (!monaco || !monaco.languages || !monaco.languages.registerCompletionItemProvider) {
    return;
  }

  // ${...} chain variables (live per-editor values via the model URI)
  monaco.languages.registerCompletionItemProvider(language, {
    triggerCharacters: ["$", "{"],
    provideCompletionItems: (model: any, position: any) => {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // Check if we're typing ${...}
      const match = textUntilPosition.match(/\$\{([^}]*)$/);
      if (!match) {
        return { suggestions: [] };
      }

      const suggestions = getEditorVariables(model).map((variable) => {
        const { range, insertText } = completionRangeAndText(
          model,
          position,
          match[1].length,
          variable.name,
          "}",
        );
        return {
          label: variable.name,
          kind: monaco.languages.CompletionItemKind.Variable,
          detail: variable.value
            ? `= ${variable.value}`
            : "(not yet extracted)",
          documentation: `From: ${variable.source}\nValue: ${variable.value || "pending"}`,
          insertText,
          range,
        };
      });

      return { suggestions };
    },
  });

  // {{...}} variables (env/global/functions - static list)
  monaco.languages.registerCompletionItemProvider(language, {
    triggerCharacters: ["{"],
    provideCompletionItems: (model: any, position: any) => {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // Check if we're typing {{...}}
      const match = textUntilPosition.match(/\{\{([^}]*)$/);
      if (!match) {
        return { suggestions: [] };
      }

      const suggestions: any[] = [];

      // Env/global variables first — parity with the single-line popup, which
      // has always listed them; the editor previously only listed functions.
      getEditorEnvVariables(model).forEach((variable) => {
        const { range, insertText } = completionRangeAndText(
          model,
          position,
          match[1].length,
          variable.name,
          "}}",
        );
        suggestions.push({
          label: variable.name,
          kind: monaco.languages.CompletionItemKind.Variable,
          detail: variable.value ? `= ${variable.value}` : "(not set)",
          documentation: `From: ${variable.source}\nValue: ${variable.value || "unset"}`,
          insertText,
          range,
        });
      });

      // Add function suggestions
      const functions = [
        {
          name: "uuid",
          detail: "Generate a new UUID",
          doc: "Generates a random UUID v4 identifier",
        },
        {
          name: "newguid",
          detail: "Generate a new GUID",
          doc: "Alias for uuid - generates a random UUID",
        },
        {
          name: "now",
          detail: "Current timestamp (ISO)",
          doc: "Returns the current date/time in ISO 8601 format",
        },
        {
          name: "epoch",
          detail: "Current Unix timestamp",
          doc: "Returns the current timestamp in seconds",
        },
        {
          name: "randomInt(1,100)",
          detail: "Random integer",
          doc: "Generate a random integer between min and max (inclusive)\nExample: {{randomInt(1,100)}}",
        },
        {
          name: "lorem(5)",
          detail: "Lorem ipsum text",
          doc: "Generate lorem ipsum placeholder text\nExample: {{lorem(10)}} generates 10 words",
        },
        {
          name: "name",
          detail: "Random name",
          doc: "Generates a random full name",
        },
        {
          name: "country",
          detail: "Random country",
          doc: "Generates a random country name",
        },
        {
          name: "state",
          detail: "Random US state",
          doc: "Generates a random US state name",
        },
        {
          name: "now+1d",
          detail: "Date math (future)",
          doc: "Add time to current date\nExamples: {{now+1d}} (1 day), {{now+2m}} (2 months), {{now+3y}} (3 years)",
        },
        {
          name: "now-1d",
          detail: "Date math (past)",
          doc: "Subtract time from current date\nExamples: {{now-1d}} (1 day ago), {{now-2m}} (2 months ago)",
        },
        {
          name: "env",
          detail: "Environment endpoint URL",
          doc: "Shortcut for the current environment's endpoint URL",
        },
        {
          name: "url",
          detail: "Environment endpoint URL",
          doc: "Shortcut for the current environment's endpoint URL (alias for env)",
        },
      ];

      functions.forEach((fn) => {
        const { range, insertText } = completionRangeAndText(
          model,
          position,
          match[1].length,
          fn.name,
          "}}",
        );
        suggestions.push({
          label: fn.name,
          kind: monaco.languages.CompletionItemKind.Function,
          detail: fn.detail,
          documentation: fn.doc,
          insertText,
          range,
        });
      });

      return { suggestions };
    },
  });
}

const MonacoRequestEditorBase = forwardRef<
  MonacoRequestEditorHandle,
  MonacoRequestEditorProps
>(
  (
    {
      value,
      onChange,
      language = "xml",
      readOnly = false,
      onFocus,
      autoFoldElements,
      showLineNumbers = true,
      showMinimap = false,
      requestId,
      forceUpdateKey,
      fontSize = 14,
      fontFamily = 'Consolas, "Courier New", monospace',
      availableVariables = [],
      availableEnvVariables = [],
      onLog,
    },
    ref,
  ) => {
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<Monaco | null>(null);
    // R5 (MONACO_LAG_ROOT_CAUSE.md): the shared per-language completion
    // providers read each editor's variables through this ref so suggestions
    // stay current without re-registering providers on prop changes.
    const availableVariablesRef = useRef(availableVariables);
    availableVariablesRef.current = availableVariables;
    const availableEnvVariablesRef = useRef(availableEnvVariables);
    availableEnvVariablesRef.current = availableEnvVariables;
    // Model URI this editor published its variables under (cleared on unmount).
    const registeredModelUriRef = useRef<string | undefined>(undefined);
    const { theme } = useTheme();
    const [editorTheme, setEditorTheme] = useState<string>("vs-dark");
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
            forceMoveMarkers: true,
          };
          editor.executeEdits("my-source", [op]);
          editor.focus();
        }
      },
      getValue: () => {
        if (editorRef.current) {
          const model = editorRef.current.getModel();
          return model ? model.getValue() : "";
        }
        return "";
      },
    }));

    // Use shared hook for decorations (pass chain variables for validation)
    const { updateDecorations } = useWildcardDecorations(
      editorRef.current,
      monacoRef.current,
      value,
      availableVariables,
    );

    // Sync value manual implementation to prevent cursor jumps
    useEffect(() => {
      if (editorRef.current) {
        const editor = editorRef.current;
        const model = editor.getModel();
        if (!model) return;

        const currentVal = model.getValue();
        const isNewRequest = requestId !== lastSyncedRequestIdRef.current;
        const isForceUpdate =
          forceUpdateKey !== undefined &&
          forceUpdateKey !== lastSyncedForceUpdateKeyRef.current;
        const isMount = lastSyncedRequestIdRef.current === undefined;
        const shouldSync = isNewRequest || isForceUpdate || isMount;

        if (shouldSync) {
          // If content is identical, avoid updating to prevent cursor jumps.
          // This specifically handles the "ID Transition" case (Unsaved Name -> Saved ID)
          // where isNewRequest is true but content hasn't changed.
          if (currentVal !== value) {
            if (isNewRequest) {
              editor.setValue(value || "");
            } else {
              const pos = editor.getPosition();
              editor.setValue(value || "");
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

    const applyEditorTheme = useCallback((monacoInstance: Monaco) => {
      setEditorTheme(applyMonacoTheme(monacoInstance, theme));
    }, [theme]);

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

      // Enter inserts a newline UNLESS the completion widget is open — then
      // the built-in accept wins (Enter completes the selected variable).
      // Previously this action was unconditional, so Enter always typed a
      // newline and could never accept a suggestion.
      editor.addAction({
        id: "insert-newline",
        label: "Insert Newline",
        keybindings: [monaco.KeyCode.Enter],
        precondition: "!suggestVisible",
        run: (ed: any) => {
          ed.trigger("keyboard", "type", { text: "\n" });
        },
      });

      // --- Clipboard Fixes ---

      const doPaste = async (ed: any) => {
        try {
          // Use native clipboard API
          const text = await navigator.clipboard.readText();
          if (text) {
            const selection = ed.getSelection();
            ed.executeEdits("clipboard", [
              { range: selection, text: text, forceMoveMarkers: true },
            ]);
          }
        } catch (e) {
          // Clipboard access denied - log warning
          debugWarn("[MonacoRequestEditor] Clipboard access denied");
        }
      };

      // Paste (Ctrl+V)
      editor.addAction({
        id: "custom-paste",
        label: "Paste",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV],
        run: doPaste,
      });

      // Paste (Context Menu Override)
      editor.addAction({
        id: "editor.action.clipboardPasteAction",
        label: "Paste",
        precondition: "!readonly",
        run: doPaste,
      });

      // --- Variable Autocomplete (R5: shared, per-language providers) ---
      // R5 (MONACO_LAG_ROOT_CAUSE.md): completion providers are now
      // registered once per language via the module-level
      // ensureVariableCompletionProviders(); each mounted editor just
      // publishes its current variables under its model URI (below,
      // in onMount) so the shared providers read them live. No per-mount
      // registration, no cumulative provider growth, no cross-editor
      // completion fire.
      ensureVariableCompletionProviders(monaco, language);

      // Publish this editor's live variables under its model URI so the
      // shared providers resolve per-editor values (see getEditorVariables).
      const model = editor.getModel?.();
      if (model && model.uri) {
        const uri = model.uri.toString();
        editorVariablesByModel.set(uri, () => availableVariablesRef.current);
        editorEnvVariablesByModel.set(uri, () => availableEnvVariablesRef.current);
        registeredModelUriRef.current = uri;
      }
      // Copy (Ctrl+C)
      const doCopy = (ed: any) => {
        const selection = ed.getSelection();
        const text = ed.getModel()?.getValueInRange(selection);
        if (text) {
          // Use native clipboard API
          navigator.clipboard.writeText(text).catch((e) => {
            debugWarn(
              "[MonacoRequestEditor] Clipboard write failed:",
              e.message,
            );
          });
        }
      };

      editor.addAction({
        id: "custom-copy",
        label: "Copy",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC],
        run: doCopy,
      });

      // Copy (Context Menu Override)
      editor.addAction({
        id: "editor.action.clipboardCopyAction",
        label: "Copy",
        run: doCopy,
      });

      // Cut (Ctrl+X)
      const doCut = (ed: any) => {
        const selection = ed.getSelection();
        const text = ed.getModel()?.getValueInRange(selection);
        if (text) {
          navigator.clipboard.writeText(text).catch((e) => {
            debugWarn(
              "[MonacoRequestEditor] Clipboard write failed:",
              e.message,
            );
          });
          // Delete selection
          ed.executeEdits("clipboard", [
            { range: selection, text: "", forceMoveMarkers: true },
          ]);
        }
      };

      editor.addAction({
        id: "custom-cut",
        label: "Cut",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX],
        run: doCut,
      });

      // Cut (Context Menu Override)
      editor.addAction({
        id: "editor.action.clipboardCutAction",
        label: "Cut",
        precondition: "!readonly",
        run: doCut,
      });

      // --- End Clipboard Fixes ---
    };

    useEffect(() => {
      if (monacoRef.current) {
        applyEditorTheme(monacoRef.current);
      }
    }, [applyEditorTheme]);

    // R5 (MONACO_LAG_ROOT_CAUSE.md): drop this editor's published variables
    // on unmount so shared providers never resolve a disposed model's URI.
    useEffect(() => {
      return () => {
        const uri = registeredModelUriRef.current;
        if (uri) {
          editorVariablesByModel.delete(uri);
          editorEnvVariablesByModel.delete(uri);
          registeredModelUriRef.current = undefined;
        }
      };
    }, []);

    // Listen for Clipboard Data from Backend (Fallback for Paste)
    // Listen for Clipboard Data from Backend (Fallback for Paste)
    useEffect(() => {
      // Log mount
      if (onLog) {
        onLog(`[MonacoRequestEditor] Mounted. RequestId: ${requestId}`, "info");
      }

      const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        if (message.command === "clipboardText" && message.text) {
          if (editorRef.current) {
            const ed = editorRef.current;
            // Prevent pasting if not focused (avoids broadcasting paste to all editors)
            if (ed.hasTextFocus()) {
              const selection = ed.getSelection();
              ed.executeEdits("clipboard", [
                {
                  range: selection,
                  text: message.text,
                  forceMoveMarkers: true,
                },
              ]);
              ed.focus();
            }
          }
        }
      };

      window.addEventListener("message", handleMessage);
      return () => {
        if (onLog) {
          onLog(
            `[MonacoRequestEditor] Unmounted. RequestId: ${requestId}`,
            "info",
          );
        }
        window.removeEventListener("message", handleMessage);
      };
    }, [onLog, requestId]);

    // R2 (MONACO_LAG_ROOT_CAUSE.md): memoize editorOptions so the wrapper's
    // [options] effect only calls editor.updateOptions() when an actual
    // setting changes. Previously a fresh object literal was built on every
    // render, forcing updateOptions on all mounted editors per keystroke.
    const editorOptions = useMemo(
      () => ({
        minimap: { enabled: showMinimap },
        fontSize: fontSize,
        fontFamily: fontFamily,
        scrollBeyondLastLine: false,
        readOnly: readOnly,
        folding: true,
        automaticLayout: true,
        lineNumbers: showLineNumbers ? "on" : "off",
        renderLineHighlight: "none",
        contextmenu: true,
        acceptSuggestionOnEnter: "on",
        quickSuggestions: false,
        // Same as the response viewer: Monaco's default scans the whole model for
        // occurrences of the selected text on every selection change.
        selectionHighlight: false,
      }),
      [showMinimap, fontSize, fontFamily, readOnly, showLineNumbers],
    );

    // Apply auto-folding when switching to a different request
    useEffect(() => {
      if (
        !editorRef.current ||
        !autoFoldElements ||
        autoFoldElements.length === 0 ||
        !value
      ) {
        previousRequestIdRef.current = requestId;
        return;
      }

      const currentReqId = requestId || "";
      const prevReqId = previousRequestIdRef.current || "";

      if (currentReqId && prevReqId && currentReqId !== prevReqId) {
        applyAutoFolding(editorRef.current, value, autoFoldElements);
      } else if (!previousRequestIdRef.current && requestId) {
        applyAutoFolding(editorRef.current, value, autoFoldElements);
      }

      previousRequestIdRef.current = requestId;
    }, [requestId, value, autoFoldElements]);

    // Keep Monaco language in sync when request or body type changes
    useEffect(() => {
      if (!editorRef.current || !monacoRef.current || !language) return;
      const model = editorRef.current.getModel?.();
      if (model) {
        monacoRef.current.editor.setModelLanguage(model, language);
      }
    }, [language, requestId]);

    return (
      <EditorContainer>
        <style></style>
        <MonacoEditorWrapper
          height="100%"
          // R6 (MONACO_LAG_ROOT_CAUSE.md): no theme remount key — the theme
          // already switches in place via monaco.editor.setTheme (see the
          // applyEditorTheme effect above). A key-based remount destroyed and
          // re-created the whole editor (60-77 ms) on every theme flip.
          language={language}
          value={value}
          // R6: the per-keystroke debugLog here paid for in-memory log
          // capture on every typed character; debug logging is gated in
          // logger.ts (setDebugLogging) and only costs one flag check now.
          // R2: an inline arrow is fine — MonacoEditorWrapper subscribes
          // onDidChangeModelContent once and reads the latest callback via a
          // ref, so unstable caller identities no longer cause listener churn.
          onChange={(val) => onChange(val || "")}
          theme={editorTheme}
          onMount={handleEditorDidMount}
          options={editorOptions as any}
        />
      </EditorContainer>
    );
  },
);

// R3 (MONACO_LAG_ROOT_CAUSE.md): memoize so parent re-renders that don't
// change the props (e.g. a header edit elsewhere in the explorer) skip
// re-rendering the editor subtree entirely. Props that change per keystroke
// (value) still propagate; R2's stable options/callbacks mean the re-render
// is cheap when it does happen.
export const MonacoRequestEditor = React.memo(MonacoRequestEditorBase);
