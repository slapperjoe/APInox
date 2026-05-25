import React, { useRef, useEffect, useState } from "react";
import * as monaco from "monaco-editor";

// Monaco type alias for consumers
export type Monaco = typeof monaco;

export interface MonacoEditorWrapperProps {
  /** Height of the editor container. Default: "100%" */
  height?: string;
  /** Width of the editor container. Default: "100%" */
  width?: string;
  /** Default language for the editor */
  defaultLanguage?: string;
  /** Initial value */
  defaultValue?: string;
  /** Controlled value */
  value?: string;
  /** Current language (can change dynamically) */
  language?: string;
  /** Editor theme */
  theme?: string;
  /** Loading text shown before editor is ready */
  loading?: React.ReactNode;
  /** Called when editor is first mounted */
  onMount?: (editor: any, monacoInstance: Monaco) => void;
  /** Called when value changes */
  onChange?: (value: string | undefined) => void;
  /** Editor options */
  options?: any;
  /** CSS class for the wrapper element */
  className?: string;
  /** Additional wrapper props */
  wrapperProps?: React.HTMLAttributes<HTMLDivElement>;
}

interface MonacoEditorWrapperHandle {
  getEditor(): any;
  getModel(): any;
}

/**
 * Thin React wrapper around `monaco-editor` that eliminates the
 * `@monaco-editor/loader` (no CDN, no network calls).
 *
 * Uses `monaco.editor.create()` directly.
 */
export const MonacoEditorWrapper = React.forwardRef<
  MonacoEditorWrapperHandle,
  MonacoEditorWrapperProps
>(
  function MonacoEditorWrapper(
    {
      height = "100%",
      width = "100%",
      defaultLanguage = "text",
      defaultValue = "",
      value,
      language,
      theme = "vs-dark",
      loading = "Loading...",
      onMount,
      onChange,
      options = {},
      className,
      wrapperProps,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null);
    const modelRef = useRef<any>(null);
    const [isReady, setIsReady] = useState(false);

    // Create model helper
    const createModel = (
      text: string,
      lang: string,
      uriPath?: string
    ): any => {
      if (uriPath) {
        // Check if a model with this URI already exists and reuse it
        const existing = monaco.editor.getModel(monaco.Uri.parse(uriPath));
        if (existing) {
          existing.setValue(text);
          monaco.editor.setModelLanguage(existing, lang);
          return existing;
        }
      }
      const uri = uriPath ? monaco.Uri.parse(uriPath) : undefined;
      return monaco.editor.createModel(text, lang, uri);
    };

    // Initialize editor on mount
    useEffect(() => {
      if (!containerRef.current || editorRef.current) return;

      const uriPath = "editor://monaco-wrapper";
      const initialLang = language || defaultLanguage;
      const initialText = value !== undefined ? value : defaultValue;
      const model = createModel(initialText, initialLang, uriPath);
      modelRef.current = model;

      const editor = monaco.editor.create(containerRef.current, {
        model,
        automaticLayout: true,
        ...options,
      });
      editorRef.current = editor;

      // Apply theme
      monaco.editor.setTheme(theme);
      setIsReady(true);

      // Call onMount callback
      if (onMount) {
        onMount(editor, monaco);
      }
    }, []);

    // Sync value changes from parent
    useEffect(() => {
      if (!editorRef.current || value === undefined) return;
      const editor = editorRef.current;
      const model = editor.getModel();
      if (!model || model.isDisposed()) return;

      const readOnly = editor.getOption(monaco.editor.EditorOption.readOnly);
      if (readOnly) {
        editor.setValue(value);
      } else {
        const current = editor.getValue();
        if (value !== current) {
          editor.executeEdits("wrapper", [
            {
              range: model.getFullModelRange(),
              text: value,
              forceMoveMarkers: true,
            },
          ]);
          editor.pushUndoStop();
        }
      }
    }, [value]);

    // Sync language changes
    useEffect(() => {
      if (!editorRef.current || !language) return;
      const model = editorRef.current.getModel();
      if (model && !model.isDisposed()) {
        monaco.editor.setModelLanguage(model, language);
      }
    }, [language]);

    // Sync theme changes
    useEffect(() => {
      if (theme) {
        monaco.editor.setTheme(theme);
      }
    }, [theme]);

    // Sync options changes
    useEffect(() => {
      if (!editorRef.current || !options) return;
      editorRef.current.updateOptions(options);
    }, [options]);

    // Handle editor content changes
    useEffect(() => {
      if (!editorRef.current || !onChange) return;
      const editor = editorRef.current;

      const listener = editor.onDidChangeModelContent(() => {
        if (onChange) {
          onChange(editor.getValue());
        }
      });

      return () => {
        listener.dispose();
      };
    }, [onChange]);

    // Expose imperative handle
    useEffect(() => {
      if (ref) {
        if (typeof ref === "object" && "current" in ref) {
          (ref as React.MutableRefObject<MonacoEditorWrapperHandle>).current = {
            getEditor: () => editorRef.current,
            getModel: () => modelRef.current,
          };
        }
      }
    }, [isReady]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (editorRef.current) {
          const model = editorRef.current.getModel();
          if (model) model.dispose();
          editorRef.current.dispose();
        }
      };
    }, []);

    const wrapperStyle: React.CSSProperties = {
      display: "flex",
      position: "relative",
      textAlign: "initial",
      width,
      height,
    };

    const containerStyle: React.CSSProperties = {
      display: "flex",
      height: "100%",
      width: "100%",
      justifyContent: "center",
      alignItems: "center",
    };

    const editorContainerStyle: React.CSSProperties = {
      width: "100%",
      ...(isReady ? {} : { display: "none" }),
    };

    return (
      <div
        ref={containerRef}
        className={className}
        style={wrapperStyle}
        {...wrapperProps}
      >
        {!isReady && (
          <div style={containerStyle}>{loading}</div>
        )}
        <div style={editorContainerStyle} />
      </div>
    );
  }
);

export default MonacoEditorWrapper;
