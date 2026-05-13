import {
  useEffect,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, highlightActiveLine } from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentMore,
  indentLess,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { syntaxTree } from "@codemirror/language";
import { hybridPlugin, baseDirFacet } from "./hybridPlugin";

// Minimal light theme — relies on APInox CSS vars for background/foreground
const lightTheme = EditorView.theme(
  {
    "&": { background: "var(--apinox-editor-background, #fff)", color: "var(--apinox-editor-foreground, #333)" },
    ".cm-gutters": { background: "var(--apinox-editorGutter-background, #f5f5f5)", color: "var(--apinox-editorLineNumber-foreground, #999)", borderRight: "1px solid var(--apinox-editorGutter-border, #e0e0e0)" },
    ".cm-activeLine": { background: "var(--apinox-editor-lineHighlightBackground, rgba(0,0,0,0.04))" },
    ".cm-cursor": { borderLeftColor: "var(--apinox-editor-foreground, #333)" },
    ".cm-selectionBackground, ::selection": { background: "var(--apinox-editor-selectionBackground, #b3d4fd) !important" },
  },
  { dark: false }
);

export interface NotesCodeMirrorEditorRef {
  executeCommand: (cmd: string) => void;
  insertText: (text: string) => void;
}

export interface NotesCodeMirrorEditorProps {
  doc: string;
  onChange?: (doc: string) => void;
  onContextChange?: (context: string) => void;
  colorScheme?: "dark" | "light";
  viewMode: "interactive" | "raw";
  filePath?: string | null;
  wordWrap?: boolean;
  fontSize?: number;
  fontFamily?: string;
}

function getBaseDir(path: string | null | undefined): string {
  if (!path) return "";
  const lastSep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return lastSep > 0 ? path.substring(0, lastSep) : "";
}

export const NotesCodeMirrorEditor = forwardRef<
  NotesCodeMirrorEditorRef,
  NotesCodeMirrorEditorProps
>(
  (
    {
      doc,
      onChange,
      onContextChange,
      colorScheme = "dark",
      viewMode,
      filePath,
      wordWrap = true,
      fontSize = 14,
      fontFamily = "var(--apinox-editor-font-family, 'JetBrains Mono', monospace)",
    },
    ref
  ) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    const themeCompartment = useMemo(() => new Compartment(), []);
    const baseDirCompartment = useMemo(() => new Compartment(), []);
    const pluginCompartment = useMemo(() => new Compartment(), []);
    const lineWrappingCompartment = useMemo(() => new Compartment(), []);
    const fontCompartment = useMemo(() => new Compartment(), []);

    const insertTextAtCursor = (view: EditorView, text: string) => {
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      });
    };

    const wrapSelection = (view: EditorView, wrapper: string) => {
      const { from, to } = view.state.selection.main;
      const text = view.state.sliceDoc(from, to);
      view.dispatch({
        changes: { from, to, insert: `${wrapper}${text}${wrapper}` },
        selection: { anchor: from + wrapper.length, head: to + wrapper.length },
      });
    };

    const smartToggle = (view: EditorView, wrapper: string) => {
      const { state } = view;
      const { from, empty } = state.selection.main;
      if (!empty) { wrapSelection(view, wrapper); return; }

      const line = state.doc.lineAt(from);
      const rel = from - line.from;
      let start = rel;
      let end = rel;
      while (start > 0 && /\S/.test(line.text[start - 1])) start--;
      while (end < line.text.length && /\S/.test(line.text[end])) end++;

      if (start === end) {
        view.dispatch({ changes: { from: line.from, to: line.to, insert: `${wrapper}${line.text}${wrapper}` } });
      } else {
        const word = line.text.slice(start, end);
        view.dispatch({ changes: { from: line.from + start, to: line.from + end, insert: `${wrapper}${word}${wrapper}` } });
      }
    };

    const toggleList = (view: EditorView) => {
      const { state } = view;
      const line = state.doc.lineAt(state.selection.main.head);
      if (line.text.trim().startsWith("- ")) {
        const match = line.text.match(/^(\s*-\s)/);
        if (match) view.dispatch({ changes: { from: line.from, to: line.from + match[0].length, insert: "" }, selection: { anchor: line.from } });
      } else {
        view.dispatch({ changes: { from: line.from, to: line.from, insert: "- " }, selection: { anchor: line.from + 2 } });
      }
    };

    const toggleHeader = (view: EditorView, level: number) => {
      const { state } = view;
      const line = state.doc.lineAt(state.selection.main.head);
      const hash = "#".repeat(level) + " ";
      if (line.text.startsWith("#")) {
        const match = line.text.match(/^(#+ )/);
        if (match) {
          view.dispatch({ changes: { from: line.from, to: line.from + match[0].length, insert: "" }, selection: { anchor: line.from } });
          if (match[0].trim().length === level) return;
        }
      }
      view.dispatch({ changes: { from: line.from, to: line.from, insert: hash }, selection: { anchor: line.from + hash.length } });
    };

    useImperativeHandle(ref, () => ({
      insertText: (text: string) => {
        const view = viewRef.current;
        if (!view) return;
        view.focus();
        insertTextAtCursor(view, text);
      },
      executeCommand: (cmd: string) => {
        const view = viewRef.current;
        if (!view) return;
        view.focus();
        switch (cmd) {
          case "Bold": smartToggle(view, "**"); break;
          case "Italic": wrapSelection(view, "*"); break;
          case "H1": toggleHeader(view, 1); break;
          case "H2": toggleHeader(view, 2); break;
          case "H3": toggleHeader(view, 3); break;
          case "Indent": indentMore(view); break;
          case "Unindent": indentLess(view); break;
          case "Task Checkbox": insertTextAtCursor(view, "- [ ] "); break;
          case "Add Row": insertTextAtCursor(view, "\n| Col | Col |"); break;
          case "Add Col": insertTextAtCursor(view, " | Col"); break;
          case "Make List": toggleList(view); break;
        }
      },
    }));

    // Sync external doc changes into editor without recreating view
    useEffect(() => {
      if (viewRef.current) {
        const current = viewRef.current.state.doc.toString();
        if (current !== doc) {
          viewRef.current.dispatch({ changes: { from: 0, to: current.length, insert: doc } });
        }
      }
    }, [doc]);

    // Create editor once on mount
    useEffect(() => {
      if (!editorRef.current) return;

      const startState = EditorState.create({
        doc,
        extensions: [
          keymap.of([...defaultKeymap, ...historyKeymap]),
          history(),
          markdown({ codeLanguages: languages }),
          highlightActiveLine(),
          themeCompartment.of(colorScheme === "light" ? lightTheme : oneDark),
          baseDirCompartment.of(baseDirFacet.of(getBaseDir(filePath))),
          pluginCompartment.of(viewMode === "interactive" ? hybridPlugin : []),
          lineWrappingCompartment.of(wordWrap ? EditorView.lineWrapping : []),
          fontCompartment.of(EditorView.theme({
            "&": { height: "100%", fontSize: `${fontSize}px` },
            ".cm-scroller": { fontFamily, overflow: "auto" },
          })),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && onChange) {
              onChange(update.state.doc.toString());
            }
            if ((update.selectionSet || update.docChanged) && onContextChange) {
              const pos = update.state.selection.main.head;
              const node = syntaxTree(update.state).resolveInner(pos, -1);
              onContextChange(node.name);
            }
          }),
        ],
      });

      const view = new EditorView({ state: startState, parent: editorRef.current });
      viewRef.current = view;
      return () => { view.destroy(); };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reconfigure theme compartment when color scheme changes
    useEffect(() => {
      viewRef.current?.dispatch({
        effects: themeCompartment.reconfigure(colorScheme === "light" ? lightTheme : oneDark),
      });
    }, [colorScheme, themeCompartment]);

    // Reconfigure base dir when file path changes
    useEffect(() => {
      viewRef.current?.dispatch({
        effects: baseDirCompartment.reconfigure(baseDirFacet.of(getBaseDir(filePath))),
      });
    }, [filePath, baseDirCompartment]);

    // Reconfigure hybrid plugin when view mode changes
    useEffect(() => {
      viewRef.current?.dispatch({
        effects: pluginCompartment.reconfigure(viewMode === "interactive" ? hybridPlugin : []),
      });
    }, [viewMode, pluginCompartment]);

    // Reconfigure line wrapping
    useEffect(() => {
      viewRef.current?.dispatch({
        effects: lineWrappingCompartment.reconfigure(wordWrap ? EditorView.lineWrapping : []),
      });
    }, [wordWrap, lineWrappingCompartment]);

    // Reconfigure font settings
    useEffect(() => {
      viewRef.current?.dispatch({
        effects: fontCompartment.reconfigure(EditorView.theme({
          "&": { height: "100%", fontSize: `${fontSize}px` },
          ".cm-scroller": { fontFamily, overflow: "auto" },
        })),
      });
    }, [fontSize, fontFamily, fontCompartment]);

    return (
      <div
        ref={editorRef}
        style={{ height: "100%", width: "100%", textAlign: "left", overflow: "hidden" }}
      />
    );
  }
);

NotesCodeMirrorEditor.displayName = "NotesCodeMirrorEditor";
