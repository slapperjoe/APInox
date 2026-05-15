import React, { useCallback, useRef, useState, useEffect } from "react";
import styled from "styled-components";
import { configureMonacoEnvironment } from "@apinox/request-editor/monaco";
import Editor from "@monaco-editor/react";

// Configure Monaco to use the local bundle instead of CDN (blocked by Tauri CSP).
// Must be called before <Editor> mounts.
configureMonacoEnvironment();
import {
  Save,
  Eye,
  Edit3,
  Code,
  FileText,
  X,
  ChevronDown,
  Settings,
} from "lucide-react";
import { NoteLanguage } from "@shared/models";
import { useNotes, isNoteDirty, noteDirtyKind, NoteViewMode } from "./NotesContext";
import { NotesCodeMirrorEditor, NotesCodeMirrorEditorRef } from "./NotesCodeMirrorEditor";
import { NotesContextToolbar } from "./NotesContextToolbar";
import { NotesPreview, DebouncedNotesPreview } from "./NotesPreview";
import { NotesHexEditor } from "./NotesHexEditor";
import { useEditorSettings } from "@apinox/request-editor/core";

// ─── Styled ───────────────────────────────────────────────────────────────────

const Root = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--apinox-editor-background, #1e1e1e);
  overflow: hidden;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--apinox-sideBar-background, #252526);
  border-bottom: 1px solid var(--apinox-panel-border, rgba(128,128,128,0.2));
  flex-shrink: 0;
  min-height: 34px;
`;

const NoteTitle = styled.span`
  font-size: 13px;
  color: var(--apinox-foreground, #ccc);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DirtyDot = styled.span<{ $kind: "external" | "managed" }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  /* External files: bright orange — needs explicit save.
     Managed notes: muted amber — auto-save will handle it. */
  background: ${({ $kind }) =>
    $kind === "external"
      ? "var(--apinox-charts-orange, #e8965e)"
      : "var(--apinox-disabledForeground, #888)"};
  flex-shrink: 0;
`;

const ToolbarBtn = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid ${(p) => p.$active ? "var(--apinox-activityBar-activeBorder, #007acc)" : "transparent"};
  border-radius: 4px;
  background: ${(p) => p.$active ? "var(--apinox-list-activeSelectionBackground, rgba(0,122,204,0.2))" : "transparent"};
  color: var(--apinox-foreground, #ccc);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover {
    background: var(--apinox-list-hoverBackground, rgba(255,255,255,0.08));
  }
`;

const LangBadge = styled.select`
  font-size: 11px;
  padding: 2px 4px;
  border: 1px solid var(--apinox-panel-border, rgba(128,128,128,0.3));
  border-radius: 3px;
  background: var(--apinox-input-background, #3c3c3c);
  color: var(--apinox-foreground, #ccc);
  cursor: pointer;
  flex-shrink: 0;
`;

const EditorBody = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const EditorPane = styled.div`
  flex: 1;
  min-width: 0;
  overflow: hidden;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 0;
  gap: 12px;
  color: var(--apinox-descriptionForeground, rgba(204,204,204,0.5));
`;

const LoadingOverlay = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  align-items: center;
  justify-content: center;
  background: var(--apinox-editor-background, #1e1e1e);
  color: var(--apinox-foreground, #ccc);
  font-size: 14px;
`;

const Separator = styled.div`
  width: 1px;
  height: 18px;
  background: var(--apinox-panel-border, rgba(128,128,128,0.3));
  margin: 0 2px;
`;

const SavedFlash = styled.span`
  font-size: 11px;
  color: var(--apinox-testing-iconPassed, #81b88b);
  flex-shrink: 0;
`;

const SettingsPopup = styled.div`
  position: fixed;
  z-index: 9999;
  background: var(--apinox-dropdown-background, #252526);
  border: 1px solid var(--apinox-panel-border, rgba(128,128,128,0.4));
  border-radius: 6px;
  padding: 12px;
  width: 260px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SettingsRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--apinox-foreground, #ccc);
  gap: 8px;
`;

const SettingsInput = styled.input`
  width: 60px;
  padding: 2px 6px;
  border: 1px solid var(--apinox-panel-border, rgba(128,128,128,0.3));
  border-radius: 3px;
  background: var(--apinox-input-background, #3c3c3c);
  color: var(--apinox-foreground, #ccc);
  font-size: 12px;
`;

const SettingsSelect = styled.select`
  flex: 1;
  min-width: 0;
  padding: 2px 4px;
  border: 1px solid var(--apinox-panel-border, rgba(128,128,128,0.3));
  border-radius: 3px;
  background: var(--apinox-input-background, #3c3c3c);
  color: var(--apinox-foreground, #ccc);
  font-size: 12px;
`;

const SettingsDivider = styled.hr`
  border: none;
  border-top: 1px solid var(--apinox-panel-border, rgba(128,128,128,0.2));
  margin: 0;
`;

const MONO_FONTS = [
  { label: "JetBrains Mono", value: "JetBrains Mono" },
  { label: "Fira Code", value: "Fira Code" },
  { label: "Cascadia Code", value: "Cascadia Code" },
  { label: "Consolas", value: "Consolas" },
  { label: "Courier New", value: "Courier New" },
  { label: "Menlo", value: "Menlo" },
  { label: "Monaco", value: "Monaco" },
  { label: "Source Code Pro", value: "Source Code Pro" },
  { label: "SF Mono", value: "SF Mono" },
  { label: "monospace (system)", value: "monospace" },
];

const LANGUAGES: { value: NoteLanguage; label: string }[] = [
  { value: "markdown", label: "Markdown" },
  { value: "plaintext", label: "Plain Text" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "xml", label: "XML" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "python", label: "Python" },
  { value: "csharp", label: "C#" },
  { value: "rust", label: "Rust" },
  { value: "binary", label: "Binary" },
];

// Monaco language identifiers differ from our NoteLanguage values
const MONACO_LANG: Partial<Record<NoteLanguage, string>> = {
  typescript: "typescript",
  javascript: "javascript",
  json: "json",
  xml: "xml",
  html: "html",
  css: "css",
  python: "python",
  csharp: "csharp",
  rust: "rust",
  plaintext: "plaintext",
};

// ─── Component ────────────────────────────────────────────────────────────────

export const NotesEditor: React.FC = () => {
  const {
    activeNote,
    isLoading,
    error,
    saveActive,
    saveAsDialog,
    closeActive,
    openNote,
    updateContent,
    updateByte,
    setViewMode,
    setLanguageOverride,
  } = useNotes();

  const { settings, updateSettings } = useEditorSettings();

  const cmRef = useRef<NotesCodeMirrorEditorRef>(null);
  const [cmContext, setCmContext] = React.useState("Paragraph");
  const [showSaved, setShowSaved] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPos, setSettingsPos] = useState<{ top: number; right: number } | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsPopupRef = useRef<HTMLDivElement>(null);

  // Close settings on outside click
  useEffect(() => {
    if (!showSettings) return;
    const onMouseDown = (e: MouseEvent) => {
      if (settingsPopupRef.current && !settingsPopupRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [showSettings]);

  const handleSave = useCallback(async () => {
    await saveActive();
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1500);
  }, [saveActive]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  const handleExternalChangeReload = useCallback(async () => {
    if (activeNote) {
      await openNote(activeNote.entry);
    }
  }, [activeNote, openNote]);

  const handleToggleSettings = useCallback(() => {
    if (!showSettings && settingsButtonRef.current) {
      const rect = settingsButtonRef.current.getBoundingClientRect();
      setSettingsPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setShowSettings((prev) => !prev);
  }, [showSettings]);

  if (isLoading) {
    return (
      <Root>
        <LoadingOverlay>
          <span>Loading...</span>
        </LoadingOverlay>
      </Root>
    );
  }

  if (!activeNote) {
    return (
      <Root>
        <EmptyState>
          <FileText size={48} strokeWidth={1} />
          <p style={{ margin: 0 }}>Select a note from the sidebar, or create a new one.</p>
        </EmptyState>
      </Root>
    );
  }

  const dirtyKind = noteDirtyKind(activeNote);
  const isDirty = dirtyKind !== null;
  const { detected, viewMode, entry } = activeNote;
  const isMarkdown = detected.isMarkdown;
  const isBinary = detected.isBinary;
  const monacoLang = MONACO_LANG[detected.language] ?? "plaintext";

  // Determine color scheme from CSS var (dark if not explicitly light)
  const colorScheme =
    document.documentElement.classList.contains("light") ? "light" : "dark";

  return (
    <Root onKeyDown={handleKeyDown} tabIndex={-1}>
      {/* Toolbar */}
      <Toolbar>
        {dirtyKind && (
          <DirtyDot
            $kind={dirtyKind}
            title={dirtyKind === "external" ? "Unsaved changes — save to update file" : "Modified — will auto-save"}
          />
        )}
        {showSaved && !isDirty && <SavedFlash>✓ Saved</SavedFlash>}
        <NoteTitle title={entry.filePath}>{entry.name}</NoteTitle>

        {/* View mode toggle — only for markdown */}
        {isMarkdown && (
          <>
            <ToolbarBtn
              $active={viewMode === "interactive"}
              onClick={() => setViewMode("interactive")}
              title="Interactive (hybrid)"
            >
              <Edit3 size={13} /> Edit
            </ToolbarBtn>
            <ToolbarBtn
              $active={viewMode === "preview"}
              onClick={() => setViewMode("preview")}
              title="Preview"
            >
              <Eye size={13} /> Preview
            </ToolbarBtn>
            <ToolbarBtn
              $active={viewMode === "raw"}
              onClick={() => setViewMode("raw")}
              title="Raw markdown"
            >
              <Code size={13} /> Raw
            </ToolbarBtn>
            <Separator />
          </>
        )}

        {/* Language selector */}
        {!isBinary && (
          <LangBadge
            value={detected.language}
            onChange={(e) => setLanguageOverride(e.target.value as NoteLanguage)}
            title="Language override"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </LangBadge>
        )}

        <Separator />

        <ToolbarBtn onClick={handleSave} title="Save (Cmd/Ctrl+S)">
          <Save size={13} /> Save
        </ToolbarBtn>
        <ToolbarBtn onClick={saveAsDialog} title="Save As…">
          <ChevronDown size={13} /> Save As
        </ToolbarBtn>

        {/* Editor settings gear */}
        <ToolbarBtn
          ref={settingsButtonRef}
          $active={showSettings}
          onClick={handleToggleSettings}
          title="Editor settings"
        >
          <Settings size={13} />
        </ToolbarBtn>

        <ToolbarBtn onClick={closeActive} title="Close note">
          <X size={13} />
        </ToolbarBtn>
      </Toolbar>

      {/* Editor body */}
      <EditorBody>
        {/* Context toolbar — only for markdown interactive mode */}
        {isMarkdown && viewMode === "interactive" && (
          <NotesContextToolbar
            context={cmContext}
            onAction={(action) => cmRef.current?.executeCommand(action)}
          />
        )}

        <EditorPane>
          {isBinary ? (
            <NotesHexEditor
              data={activeNote.bytes ?? new Uint8Array(0)}
              onByteChange={updateByte}
            />
          ) : isMarkdown && viewMode === "preview" ? (
            <DebouncedNotesPreview content={activeNote.content} />
          ) : isMarkdown ? (
            /* interactive or raw */
            <NotesCodeMirrorEditor
              ref={cmRef}
              doc={activeNote.content}
              onChange={updateContent}
              onContextChange={setCmContext}
              colorScheme={colorScheme}
              viewMode={viewMode === "raw" ? "raw" : "interactive"}
              filePath={entry.filePath}
              fontSize={settings.fontSize}
              fontFamily={settings.fontFamily}
              wordWrap
            />
          ) : (
            /* Non-markdown: Monaco */
            <Editor
              height="100%"
              language={monacoLang}
              value={activeNote.content}
              onChange={(v) => updateContent(v ?? "")}
              theme={colorScheme === "light" ? "vs" : "vs-dark"}
              options={{
                minimap: { enabled: false },
                wordWrap: "on",
                scrollBeyondLastLine: false,
                fontSize: settings.fontSize,
                fontFamily: settings.fontFamily,
                lineNumbers: settings.showLineNumbers ? "on" : "off",
                renderLineHighlight: "line",
                automaticLayout: true,
              }}
            />
          )}
        </EditorPane>
      </EditorBody>

      {/* External change banner */}
      {error?.startsWith("__external_change__") && (
        <div
          style={{
            padding: "6px 12px",
            background: "var(--apinox-inputValidation-warningBackground, #352a05)",
            borderTop: "1px solid var(--apinox-inputValidation-warningBorder, #b89500)",
            fontSize: 12,
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <span>⚠ File changed externally.</span>
          <ToolbarBtn onClick={handleExternalChangeReload}>
            Reload
          </ToolbarBtn>
        </div>
      )}

      {/* Editor settings popup */}
      {showSettings && settingsPos && (
        <SettingsPopup
          ref={settingsPopupRef}
          style={{ top: settingsPos.top, right: settingsPos.right }}
        >
          <SettingsRow>
            Font size
            <SettingsInput
              type="number"
              min={8}
              max={32}
              value={settings.fontSize}
              onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
            />
          </SettingsRow>
          <SettingsRow>
            Font family
            <SettingsSelect
              value={settings.fontFamily}
              onChange={(e) => updateSettings({ fontFamily: e.target.value })}
            >
              {MONO_FONTS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
              {/* Keep current value even if not in list */}
              {!MONO_FONTS.find((f) => f.value === settings.fontFamily) && (
                <option value={settings.fontFamily}>{settings.fontFamily}</option>
              )}
            </SettingsSelect>
          </SettingsRow>
          <SettingsRow>
            Line numbers
            <input
              type="checkbox"
              checked={settings.showLineNumbers}
              onChange={(e) => updateSettings({ showLineNumbers: e.target.checked })}
            />
          </SettingsRow>
        </SettingsPopup>
      )}
    </Root>
  );
};
