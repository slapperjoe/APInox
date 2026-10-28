import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { NoteEntry, NoteLanguage } from "@shared/models";
import { captureLog } from "../utils/logger";
import { bridge, commandErrorText } from "../utils/bridge";
import { BackendCommand } from "@shared/messages";
import { detectLanguage, DetectedLanguage } from "./detectLanguage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NoteViewMode = "interactive" | "raw" | "preview";

export interface ActiveNote {
  entry: NoteEntry;
  /** Text content for non-binary notes */
  content: string;
  /** Raw bytes for binary notes */
  bytes?: Uint8Array;
  /** Content as it was last saved — used for dirty check */
  savedContent: string;
  savedBytes?: Uint8Array;
  detected: DetectedLanguage;
  viewMode: NoteViewMode;
  /** timestamp of file on disk at last load — for external-change detection */
  loadedAt: number;
}

/**
 * bytes → base64 without spreading the whole array as function arguments.
 * `String.fromCharCode(...bytes)` exhausts the stack on large files, so encode
 * in chunks. The backend decodes the same payload in `save_note_bytes`.
 */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 8192;
  let out = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(out);
}

/**
 * Parse the ISO timestamp the notes commands return (`save_note`,
 * `save_note_bytes`, `sniff_file_type`) into epoch ms. Falls back to the client
 * clock when the value is unparseable, so a bad timestamp can never make every
 * later check read as an external change.
 */
function toEpochMs(iso: string): number {
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? Date.now() : ms;
}

interface NotesState {
  notes: NoteEntry[];
  activeNote: ActiveNote | null;
  isLoading: boolean;
  /** A plain, renderable message. The external-change signal is NOT carried here
   *  — it has its own state (`externalChangePath`), so real errors are visible
   *  instead of being hidden behind a sentinel string the UI string-matches. */
  error: string | null;
  externalChangePath: string | null;
}

interface NotesActions {
  openNote: (entry: NoteEntry) => Promise<void>;
  newNote: (name?: string) => Promise<void>;
  openFileDialog: () => Promise<void>;
  saveActive: () => Promise<void>;
  saveAsDialog: () => Promise<void>;
  closeActive: () => void;
  deleteNote: (id: string) => Promise<void>;
  renameNote: (id: string, newName: string) => Promise<void>;
  updateContent: (content: string) => void;
  setViewMode: (mode: NoteViewMode) => void;
  setLanguageOverride: (lang: NoteLanguage) => void;
  checkExternalChange: () => Promise<void>;
  clearExternalChange: () => void;
  clearError: () => void;
}

type NotesContextValue = NotesState & NotesActions;

// ─── Context ──────────────────────────────────────────────────────────────────

const NotesContext = createContext<NotesContextValue | null>(null);

export function useNotes(): NotesContextValue {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used inside NotesProvider");
  return ctx;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bytesEqual(a: Uint8Array | undefined, b: Uint8Array | undefined): boolean {
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function isNoteDirty(note: ActiveNote): boolean {
  if (note.detected.isBinary) return !bytesEqual(note.bytes, note.savedBytes);
  return note.content !== note.savedContent;
}

/** "external" = user-owned file (needs explicit save), "managed" = auto-saved scratch note */
export function noteDirtyKind(note: ActiveNote): "external" | "managed" | null {
  if (!isNoteDirty(note)) return null;
  return note.entry.isManaged ? "managed" : "external";
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const NotesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [activeNote, setActiveNote] = useState<ActiveNote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [externalChangePath, setExternalChangePath] = useState<string | null>(null);

  // Auto-save timer ref
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Mirror of `activeNote` for the debounce callback. The write used to run
   * inside a `setActiveNote` updater; keeping IO in the callback means the timer
   * reads the note through this ref instead.
   */
  const activeNoteRef = useRef<ActiveNote | null>(null);
  useEffect(() => {
    activeNoteRef.current = activeNote;
  }, [activeNote]);

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  // ── Index ────────────────────────────────────────────────────────────────

  // Initial load. The state update happens in the promise continuation rather than in
  // the effect body, which is the external-system callback the rule permits — and
  // `loadIndex` was never consumed by any component, so it existed only for this.
  useEffect(() => {
    invoke<{ entries: NoteEntry[] }>("load_notes_index")
      .then((index) => setNotes(index.entries ?? []))
      .catch((e) => setError(commandErrorText(e)));
  }, []);

  // The backend is the source of truth for the index: every mutation pushes
  // `notesUpdated` on the bridge channel, so the list re-syncs from the
  // authoritative snapshot rather than only from what this component did.
  useEffect(() => {
    const unsubscribe = bridge.onMessage((message) => {
      if (message.command === BackendCommand.NotesUpdated) {
        setNotes(message.entries ?? []);
      }
    });
    return unsubscribe;
  }, []);

  // ── Open ─────────────────────────────────────────────────────────────────

  const openNote = useCallback(async (entry: NoteEntry) => {
    setIsLoading(true);
    setError(null);
    setExternalChangePath(null);
    try {
      // Sniff binary first. The returned mtime is the baseline for the
      // external-change check — using the disk value rather than the client clock
      // avoids skew between the two.
      const sniff = await invoke<{ isBinary: boolean; lastModified: string }>("sniff_file_type", {
        filePath: entry.filePath,
      });
      const isBin = sniff.isBinary;
      const baseline = toEpochMs(sniff.lastModified);

      if (isBin) {
        const b64 = await invoke<string>("load_note_bytes", { filePath: entry.filePath });
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        setActiveNote({
          entry,
          content: "",
          bytes,
          savedContent: "",
          savedBytes: new Uint8Array(bytes),
          detected: { language: "binary", isMarkdown: false, isBinary: true },
          viewMode: "raw",
          loadedAt: baseline,
        });
      } else {
        const content = await invoke<string>("load_note_content", { filePath: entry.filePath });
        const langOverride = entry.language ?? null;
        const detected = detectLanguage(entry.filePath, content, false);
        const finalDetected: DetectedLanguage = langOverride && langOverride !== "plaintext"
          ? { language: langOverride as NoteLanguage, isMarkdown: langOverride === "markdown", isBinary: false }
          : detected;

        setActiveNote({
          entry,
          content,
          savedContent: content,
          detected: finalDetected,
          viewMode: finalDetected.isMarkdown ? "interactive" : "raw",
          loadedAt: baseline,
        });
      }

      await invoke("add_recent_note_path", { filePath: entry.filePath });
    } catch (e) {
      setError(commandErrorText(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── New ──────────────────────────────────────────────────────────────────

  const newNote = useCallback(async (name?: string) => {
    const notesDir = await invoke<string>("get_notes_dir_path");
    const safeName = (name ?? "Untitled").replace(/[^a-zA-Z0-9_\- ]/g, "_");
    const fileName = `${safeName}.txt`;
    const filePath = `${notesDir}/${fileName}`;

    const diskMtime = await invoke<string>("save_note", { filePath, content: "" });

    const entry: NoteEntry = {
      id: crypto.randomUUID(),
      name: safeName,
      filePath,
      language: "plaintext",
      lastModified: diskMtime,
      isBinary: false,
      isManaged: true,
      createdAt: new Date().toISOString(),
    };

    await invoke("upsert_note_index", { entry });

    setNotes((prev) => [entry, ...prev.filter((n) => n.id !== entry.id)]);
    setActiveNote({
      entry,
      content: "",
      savedContent: "",
      detected: { language: "plaintext", isMarkdown: false, isBinary: false },
      viewMode: "raw",
      loadedAt: toEpochMs(diskMtime),
    });
  }, []);

  // ── Open File Dialog ─────────────────────────────────────────────────────

  const openFileDialog = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      // No filters = native dialog shows all files (wildcards are unreliable on macOS)
      const selected = await open({
        title: "Open File",
        multiple: false,
      });
      if (!selected || typeof selected !== "string") return;

      const name = selected.split(/[/\\]/).pop() ?? selected;
      const entry: NoteEntry = {
        id: crypto.randomUUID(),
        name,
        filePath: selected,
        language: "plaintext",
        lastModified: new Date().toISOString(),
        isBinary: false,
        isManaged: false,
        createdAt: new Date().toISOString(),
      };
      await invoke("upsert_note_index", { entry });
      setNotes((prev) => [entry, ...prev.filter((n) => n.filePath !== selected)]);
      await openNote(entry);
    } catch (e) {
      setError(commandErrorText(e));
    }
  }, [openNote]);

  // ── Save ─────────────────────────────────────────────────────────────────

  const saveActive = useCallback(async () => {
    if (!activeNote) return;
    try {
      // The backend returns the authoritative disk mtime. Re-baselining
      // `loadedAt` on it is what keeps `checkExternalChange` from reporting the
      // app's own write as an external edit on the next focus.
      if (activeNote.detected.isBinary && activeNote.bytes) {
        const b64 = bytesToBase64(activeNote.bytes);
        const diskMtime = await invoke<string>("save_note_bytes", {
          filePath: activeNote.entry.filePath,
          dataBase64: b64,
        });
        // Narrow inside the updater rather than asserting: the outer guard checked
        // `activeNote`, but `prev` is a different reference the compiler cannot know is
        // the same object.
        // Narrow inside the updater rather than asserting: the outer guard checked
        // `activeNote`, but `prev` is a different reference the compiler cannot know is
        // the same object.
        setActiveNote((prev) => {
          if (!prev?.bytes) return prev;
          return { ...prev, savedBytes: new Uint8Array(prev.bytes), loadedAt: toEpochMs(diskMtime) };
        });
      } else {
        const diskMtime = await invoke<string>("save_note", {
          filePath: activeNote.entry.filePath,
          content: activeNote.content,
        });
        setActiveNote((prev) =>
          prev ? { ...prev, savedContent: prev.content, loadedAt: toEpochMs(diskMtime) } : prev
        );
      }
    } catch (e) {
      setError(commandErrorText(e));
    }
  }, [activeNote]);

  // ── Save As ──────────────────────────────────────────────────────────────

  const saveAsDialog = useCallback(async () => {
    if (!activeNote) return;
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const dest = await save({
        title: "Save As",
        defaultPath: activeNote.entry.name,
        filters: [{ name: "All Files", extensions: ["*"] }],
      });
      if (!dest) return;

      const name = dest.split(/[/\\]/).pop() ?? dest;

      const diskMtime = activeNote.detected.isBinary && activeNote.bytes
        ? await invoke<string>("save_note_bytes", { filePath: dest, dataBase64: bytesToBase64(activeNote.bytes) })
        : await invoke<string>("save_note", { filePath: dest, content: activeNote.content });

      // The backend's mtime is authoritative — the index records it, and the same
      // value re-baselines the external-change check.
      const updatedEntry: NoteEntry = {
        ...activeNote.entry,
        name,
        filePath: dest,
        lastModified: diskMtime,
      };

      await invoke("upsert_note_index", { entry: updatedEntry });
      setNotes((prev) => prev.map((n) => n.id === updatedEntry.id ? updatedEntry : n));
      setActiveNote((prev) =>
        prev ? {
          ...prev,
          entry: updatedEntry,
          savedContent: prev.content,
          savedBytes: prev.detected.isBinary && prev.bytes ? new Uint8Array(prev.bytes) : prev.savedBytes,
          loadedAt: toEpochMs(diskMtime),
        } : prev
      );
    } catch (e) {
      setError(commandErrorText(e));
    }
  }, [activeNote]);

  // ── Close ────────────────────────────────────────────────────────────────

  const closeActive = useCallback(() => {
    setActiveNote(null);
  }, []);

  // ── Delete ───────────────────────────────────────────────────────────────

  const deleteNote = useCallback(async (id: string) => {
    const entry = notes.find((n) => n.id === id);
    if (!entry) return;
    try {
      await invoke("delete_note", { id });
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (activeNote?.entry.id === id) setActiveNote(null);
    } catch (e) {
      setError(commandErrorText(e));
    }
  }, [notes, activeNote]);

  // ── Rename ───────────────────────────────────────────────────────────────

  const renameNote = useCallback(async (id: string, newName: string) => {
    const entry = notes.find((n) => n.id === id);
    if (!entry) return;
    try {
      // The backend owns the rename: it moves the file for managed notes,
      // updates index.json, and returns the authoritative entry. Only managed
      // notes are moved on disk — an external note keeps its path and gets the
      // name change in the index, so the UI must take the returned entry rather
      // than re-deriving a path here.
      const updated = await invoke<NoteEntry>("rename_note", { id, newName });
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      if (activeNote?.entry.id === id) {
        setActiveNote((prev) => (prev ? { ...prev, entry: updated } : prev));
      }
    } catch (e) {
      setError(commandErrorText(e));
    }
  }, [notes, activeNote]);

  // ── Content updates ──────────────────────────────────────────────────────

  const updateContent = useCallback((content: string) => {
    setActiveNote((prev) => {
      if (!prev) return prev;
      // If content reverts to what's on disk, cancel any pending auto-save — no write needed
      if (content === prev.savedContent && autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
      return { ...prev, content };
    });

    // Auto-save: text notes only, 2s debounce
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const note = activeNoteRef.current;
      if (!note || note.detected.isBinary) return;
      // Skip write if nothing changed since last disk save
      if (note.content === note.savedContent) return;
      invoke<string>("save_note", { filePath: note.entry.filePath, content: note.content })
        .then((diskMtime) => {
          // Re-baseline the external-change check on the mtime this write
          // produced, so the app's own autosave is not read as an external edit.
          setActiveNote((p) =>
            p ? { ...p, savedContent: p.content, loadedAt: toEpochMs(diskMtime) } : p
          );
        })
        .catch((err) => {
          captureLog("error", "[Notes] Auto-save failed", err);
        });
    }, 2000);
  }, []);

  // ── View mode / language override ────────────────────────────────────────

  const setViewMode = useCallback((mode: NoteViewMode) => {
    setActiveNote((prev) => prev ? { ...prev, viewMode: mode } : prev);
  }, []);

  const setLanguageOverride = useCallback(async (lang: NoteLanguage) => {
    setActiveNote((prev) => {
      if (!prev) return prev;
      const detected: DetectedLanguage = {
        language: lang,
        isMarkdown: lang === "markdown",
        isBinary: lang === "binary",
      };
      return { ...prev, detected };
    });
    // Persist the override in the index
    if (activeNote) {
      const updated = { ...activeNote.entry, language: lang };
      await invoke("upsert_note_index", { entry: updated });
      setNotes((prev) => prev.map((n) => n.id === updated.id ? updated : n));
    }
  }, [activeNote]);

  const clearExternalChange = useCallback(() => setExternalChangePath(null), []);
  const clearError = useCallback(() => setError(null), []);

  // ── External change detection ────────────────────────────────────────────

  const checkExternalChange = useCallback(async () => {
    if (!activeNote) return;
    try {
      const result = await invoke<{ lastModified: string }>("sniff_file_type", {
        filePath: activeNote.entry.filePath,
      });
      const diskMtime = toEpochMs(result.lastModified);
      if (diskMtime > activeNote.loadedAt) {
        setExternalChangePath(activeNote.entry.filePath);
      }
    } catch (e) {
      // A file that does not exist yet (a new, unsaved note) is not an external
      // change — but a real read failure must still surface.
      const message = commandErrorText(e);
      if (!message.toLowerCase().includes('not found')) {
        setError(message);
      }
    }
  }, [activeNote]);

  // Check for external changes when window regains focus
  useEffect(() => {
    const handler = () => { checkExternalChange(); };
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [checkExternalChange]);

  // Memoised like every other context in the app — a fresh object each render
  // re-renders every consumer.
  const value: NotesContextValue = useMemo(
    () => ({
      notes, activeNote, isLoading, error, externalChangePath,
      openNote, newNote, openFileDialog,
      saveActive, saveAsDialog, closeActive,
      deleteNote, renameNote,
      updateContent,
      setViewMode, setLanguageOverride,
      checkExternalChange, clearExternalChange, clearError,
    }),
    [
      notes, activeNote, isLoading, error, externalChangePath,
      openNote, newNote, openFileDialog,
      saveActive, saveAsDialog, closeActive,
      deleteNote, renameNote,
      updateContent,
      setViewMode, setLanguageOverride,
      checkExternalChange, clearExternalChange, clearError,
    ]
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
};
