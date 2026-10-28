import React, { useCallback, useRef, useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { IconButton, SecondaryButton, ToggleTab } from "../components/common/Button";
import { Tooltip } from "../components/common/Tooltip";
import { DirtyDot } from "../components/common/DirtyDot";
import { Spinner } from "../components/common/Spinner";
import { MonacoEditorWrapper, Monaco, useSettingsDropdown } from "../request-editor/monaco";
import {
  CompactIconButton,
  EditorSettingsMenu,
  FontSizeDisplay,
  MenuControls,
  MenuIconButton,
  MenuLabel,
  MenuRow,
  MenuSection,
  MenuSectionTitle,
} from "../request-editor/components/RequestWorkspace.styles";
import { MONOSPACE_FONTS, getInstalledFonts } from "../request-editor/utils/fontDetection";
import {
  Minus,
  Plus,
  Save,
  Eye,
  Edit3,
  Code,
  FileText,
  X,
  Settings,
  Type,
  ListOrdered,
  ChevronDown,
} from "lucide-react";
import { NoteLanguage } from "@shared/models";
import { useNotes, noteDirtyKind } from "./NotesContext";
import { useSaveShortcut } from "../hooks/useSaveShortcut";
import { NotesCodeMirrorEditor, NotesCodeMirrorEditorRef } from "./NotesCodeMirrorEditor";
import { NotesContextToolbar } from "./NotesContextToolbar";
import { DebouncedNotesPreview } from "./NotesPreview";
import { NotesHexEditor } from "./NotesHexEditor";
import { useEditorSettings, useTheme } from "../request-editor/core";
import { applyMonacoTheme, isLightTheme } from "../request-editor/utils/monacoTheme";
import { EmptyState } from "../components/common/EmptyState";
import { CustomSelect, type CustomSelectOption } from "../components/common/CustomSelect";
import { ErrorDetailBanner } from "../request-editor/components/common/ErrorDetailBanner";
import { Toolbar, ToolbarSeparator } from "../styles/WorkspaceLayout.styles";
import { SPACING_MD, SPACING_SM } from "../styles/spacing";

// ─── Styled ───────────────────────────────────────────────────────────────────

const Root = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--apinox-editor-background);
  overflow: hidden;
`;

// Toolbar and ToolbarSeparator come from styles/WorkspaceLayout.styles.ts; the
// buttons are the shared Button primitives; the dirty indicator is
// components/common/DirtyDot.tsx.

const NoteTitle = styled.span`
  font-size: var(--apinox-fs-base);
  color: var(--apinox-foreground);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

const SavedFlash = styled.span`
  font-size: var(--apinox-fs-sm);
  color: var(--apinox-testing-iconPassed);
  flex-shrink: 0;
`;

/** External-change notice — a warning, not an error, so it keeps its own banner
 *  with a Reload action rather than going through `ErrorDetailBanner`. */
const WarningBanner = styled.div`
  padding: ${SPACING_SM} ${SPACING_MD};
  background: var(--apinox-inputValidation-warningBackground);
  border-top: 1px solid var(--apinox-inputValidation-warningBorder);
  font-size: var(--apinox-fs-md);
  display: flex;
  gap: ${SPACING_MD};
  align-items: center;
`;

// Font list comes from the shared font detection (full CSS stacks, not bare
// names), with the curated list as the fallback when nothing is detected.
const FALLBACK_FONTS: CustomSelectOption[] = MONOSPACE_FONTS.map((f) => ({ label: f.name, value: f.value }));

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
    setViewMode,
    setLanguageOverride,
    externalChangePath,
    clearExternalChange,
    clearError,
  } = useNotes();

  const { settings, updateSettings } = useEditorSettings();
  const { theme, monacoTheme } = useTheme();

  const cmRef = useRef<NotesCodeMirrorEditorRef>(null);
  const [cmContext, setCmContext] = React.useState("Paragraph");
  const [showSaved, setShowSaved] = useState(false);
  const [editorTheme, setEditorTheme] = useState<string>(monacoTheme);
  const settingsPopupRef = useRef<HTMLDivElement>(null);
  const {
    open: showSettings,
    position: settingsPos,
    toggle: handleToggleSettings,
    buttonRef: settingsButtonRef,
  } = useSettingsDropdown(settingsPopupRef);

  const fontOptions = useMemo(() => {
    const installed = getInstalledFonts();
    return installed.length > 0 ? installed.map((f) => ({ label: f.name, value: f.value })) : FALLBACK_FONTS;
  }, []);

  // Monaco themes are defined from the app's CSS vars (see monacoTheme.ts) rather
  // than using the base vs/vs-dark themes, so the editor picks up all six themes.
  const monacoRef = useRef<Monaco | null>(null);
  const applyEditorTheme = useCallback((monacoInstance: Monaco) => {
    setEditorTheme(applyMonacoTheme(monacoInstance, theme));
  }, [theme]);

  const handleEditorDidMount = useCallback(
    (_editor: unknown, monacoInstance: Monaco) => {
      monacoRef.current = monacoInstance;
      applyEditorTheme(monacoInstance);
    },
    [applyEditorTheme]
  );

  useEffect(() => {
    if (monacoRef.current) applyEditorTheme(monacoRef.current);
  }, [applyEditorTheme]);

  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    };
  }, []);

  const handleSave = useCallback(async () => {
    await saveActive();
    setShowSaved(true);
    if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    savedFlashTimer.current = setTimeout(() => setShowSaved(false), 1500);
  }, [saveActive]);

  // Ctrl/Cmd+S is dispatched centrally (hooks/useSaveShortcut.ts): the pane
  // registers its handler for its own container, so the shortcut saves the note
  // when the note has focus and the dirty projects otherwise — never both at once.
  const rootRef = useRef<HTMLDivElement>(null);
  useSaveShortcut(rootRef, handleSave);

  const handleExternalChangeReload = useCallback(async () => {
    if (activeNote) {
      await openNote(activeNote.entry);
    }
  }, [activeNote, openNote]);

  if (isLoading) {
    return (
      <Root>
        <EmptyState icon={null} title="Loading note…">
          <Spinner size={16} />
        </EmptyState>
      </Root>
    );
  }

  if (!activeNote) {
    return (
      <Root>
        <EmptyState icon={FileText} title="No note selected" description="Select a note from the sidebar, or create a new one." />
      </Root>
    );
  }

  const dirtyKind = noteDirtyKind(activeNote);
  const isDirty = dirtyKind !== null;
  const { detected, viewMode, entry } = activeNote;
  const isMarkdown = detected.isMarkdown;
  const isBinary = detected.isBinary;
  const monacoLang = MONACO_LANG[detected.language] ?? "plaintext";

  // Both editor stacks follow the app theme. The previous check looked for a
  // `light` class on <html> that nothing ever sets (ThemeContext applies themes
  // as CSS vars on <html> and a data-theme attribute on <body>), so the notes
  // editor was permanently dark in all six themes.
  const colorScheme = isLightTheme(theme) ? 'light' : 'dark';

  return (
    <Root ref={rootRef} tabIndex={-1}>
      {/* Toolbar */}
      <Toolbar>
        {dirtyKind && (
          <DirtyDot
            kind={dirtyKind}
            label={dirtyKind === "external" ? "Unsaved changes — save to update file" : "Modified — will auto-save"}
          />
        )}
        {showSaved && !isDirty && <SavedFlash>✓ Saved</SavedFlash>}
        <NoteTitle title={entry.filePath}>{entry.name}</NoteTitle>

        {/* View mode toggle — only for markdown */}
        {isMarkdown && (
          <>
            <ToggleTab $active={viewMode === "interactive"} onClick={() => setViewMode("interactive")}>
              <Edit3 size={16} /> Edit
            </ToggleTab>
            <ToggleTab $active={viewMode === "preview"} onClick={() => setViewMode("preview")}>
              <Eye size={16} /> Preview
            </ToggleTab>
            <ToggleTab $active={viewMode === "raw"} onClick={() => setViewMode("raw")}>
              <Code size={16} /> Raw
            </ToggleTab>
            <ToolbarSeparator />
          </>
        )}

        {/* Themed CustomSelect — a native <select>'s option popup is OS-controlled
            and would ignore the theme vars. */}
        {!isBinary && (
          <CustomSelect
            ariaLabel="Language override"
            value={detected.language}
            onChange={(v) => setLanguageOverride(v as NoteLanguage)}
            options={LANGUAGES}
            style={{ width: 116, flexShrink: 0 }}
          />
        )}

        <ToolbarSeparator />

        <SecondaryButton onClick={handleSave} title="Save (Cmd/Ctrl+S)">
          <Save size={16} /> Save
        </SecondaryButton>
        <SecondaryButton onClick={saveAsDialog} title="Save As…">
          <ChevronDown size={16} /> Save As
        </SecondaryButton>

        {/* Editor settings gear */}
        <Tooltip content="Editor settings">
          <CompactIconButton
            ref={settingsButtonRef}
            className={showSettings ? 'active' : ''}
            onClick={handleToggleSettings}
          >
            <Settings size={14} />
          </CompactIconButton>
        </Tooltip>

        <Tooltip content="Close note">
          <IconButton onClick={closeActive}>
            <X size={16} />
          </IconButton>
        </Tooltip>
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
            <NotesHexEditor data={activeNote.bytes ?? new Uint8Array(0)} />
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
            <MonacoEditorWrapper
              height="100%"
              language={monacoLang}
              value={activeNote.content}
              onChange={(v) => updateContent(v ?? "")}
              theme={editorTheme}
              onMount={handleEditorDidMount}
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

      {/* Real failures are now visible — they used to be hidden because the only
          thing the UI rendered was the external-change sentinel. */}
      {error && (
        <ErrorDetailBanner message={error} onDismiss={clearError} testId="notes-error" />
      )}

      {/* External change banner */}
      {externalChangePath && (
        <WarningBanner>
          <span>⚠ File changed externally.</span>
          <SecondaryButton onClick={handleExternalChangeReload}>Reload</SecondaryButton>
          <IconButton onClick={clearExternalChange} title="Dismiss">Dismiss</IconButton>
        </WarningBanner>
      )}

      {/* Editor settings popup — the shared menu shell (see EditorSettingsMenu),
        portalled like the other dropdowns so the sidebar's overflow:hidden does
        not clip it. */}
      {showSettings && settingsPos && createPortal(
        <div
          ref={settingsPopupRef}
          style={{
            position: 'fixed',
            top: settingsPos.top,
            right: settingsPos.right,
            maxHeight: settingsPos.maxHeight ? `${settingsPos.maxHeight}px` : undefined,
            overflowY: 'auto',
            zIndex: 999999,
          }}
        >
          <EditorSettingsMenu>
            <MenuSection>
              <MenuSectionTitle>Font Settings</MenuSectionTitle>
              <MenuRow>
                <MenuLabel><Type size={14} /> Font Family</MenuLabel>
                <CustomSelect
                  ariaLabel="Font family"
                  value={settings.fontFamily}
                  onChange={(v) => updateSettings({ fontFamily: v })}
                  options={fontOptions}
                />
              </MenuRow>
              <MenuRow>
                <MenuLabel><Type size={14} /> Font Size</MenuLabel>
                <MenuControls>
                  <Tooltip content="Decrease font size">
                    <MenuIconButton
                      onClick={() => updateSettings({ fontSize: Math.max(8, settings.fontSize - 1) })}
                      disabled={settings.fontSize <= 8}
                    >
                      <Minus size={12} />
                    </MenuIconButton>
                  </Tooltip>
                  <FontSizeDisplay>{settings.fontSize}px</FontSizeDisplay>
                  <Tooltip content="Increase font size">
                    <MenuIconButton
                      onClick={() => updateSettings({ fontSize: Math.min(24, settings.fontSize + 1) })}
                      disabled={settings.fontSize >= 24}
                    >
                      <Plus size={12} />
                    </MenuIconButton>
                  </Tooltip>
                </MenuControls>
              </MenuRow>
            </MenuSection>

            <MenuSection>
              <MenuSectionTitle>View Options</MenuSectionTitle>
              <MenuRow>
                <MenuLabel><ListOrdered size={14} /> Line Numbers</MenuLabel>
                <Tooltip content={settings.showLineNumbers ? 'Line numbers on' : 'Line numbers off'}>
                  <MenuIconButton
                    onClick={() => updateSettings({ showLineNumbers: !settings.showLineNumbers })}
                    className={settings.showLineNumbers ? 'active' : ''}
                  >
                    {settings.showLineNumbers ? 'On' : 'Off'}
                  </MenuIconButton>
                </Tooltip>
              </MenuRow>
            </MenuSection>
          </EditorSettingsMenu>
        </div>,
        document.body
      )}
    </Root>
  );
};
