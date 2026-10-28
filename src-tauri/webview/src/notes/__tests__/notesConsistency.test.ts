/**
 * Notes feature — shared-primitive and token consistency guards.
 *
 * The notes folder was the most divergent area of the webview: it re-implemented
 * buttons, tooltips, section labels, spinners, selects, toolbars, separators and
 * status bars locally, hard-coded colours/weights/sizes, and shipped toolbar
 * actions nothing handled. These tests pin the fixes so the drift cannot return.
 *
 * Same style as `__tests__/bridgeParity.test.ts` — a source-level guard rather
 * than a render assertion, because the thing being protected is "which component
 * does this file use", not a computed value.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = resolve(__dirname, '..', '..');          // src-tauri/webview/src
const WEBVIEW = resolve(SRC, '..');                  // src-tauri/webview
const ROOT = resolve(WEBVIEW, '..', '..');           // repo root
const NOTES = (file: string) => readFileSync(resolve(SRC, 'notes', file), 'utf8');
const NOTES_FILES = [
  'NotesContext.tsx',
  'NotesEditor.tsx',
  'NotesCodeMirrorEditor.tsx',
  'NotesContextToolbar.tsx',
  'NotesHexEditor.tsx',
  'NotesPreview.tsx',
  'hybridPlugin.ts',
];

describe('notes styling uses the shared tokens, not hard-coded values', () => {
  it('no raw rgba() colours', () => {
    const offenders = NOTES_FILES
      .filter((f) => /rgba?\(/.test(NOTES(f)))
      .map((f) => `${f}: ${NOTES(f).match(/rgba?\([^)]*\)/)?.[0]}`);
    expect(offenders).toEqual([]);
  });

  it('no dark-theme hex fallbacks on theme vars', () => {
    const offenders = NOTES_FILES.flatMap((f) =>
      (NOTES(f).match(/var\(--apinox-[^,]*,\s*#[0-9a-fA-F]{3,8}\)/g) ?? []).map((m) => `${f}: ${m}`)
    );
    expect(offenders).toEqual([]);
  });

  it('no !important', () => {
    const offenders = NOTES_FILES.filter((f) => NOTES(f).includes('!important'));
    expect(offenders).toEqual([]);
  });

  it('font weights come from the --fw-* tokens', () => {
    const offenders = NOTES_FILES.filter((f) => /font-weight:\s*\d/.test(NOTES(f)));
    expect(offenders).toEqual([]);
  });

  it('font sizes use the --apinox-fs-* tokens, not off-scale px/em', () => {
    const offenders = NOTES_FILES.filter((f) => /font-size:\s*(14px|9px|\d+em)/.test(NOTES(f)));
    expect(offenders).toEqual([]);
  });

  it('spacing uses the SPACING_* tokens', () => {
    const offenders = NOTES_FILES.filter((f) => /padding:\s*\d+px/.test(NOTES(f)));
    expect(offenders).toEqual([]);
  });
});

describe('notes uses the shared primitives', () => {
  it('the notes folder imports the shared components it needs', () => {
    const editor = NOTES('NotesEditor.tsx');
    for (const primitive of ['Button', 'Tooltip', 'Spinner', 'EmptyState', 'CustomSelect', 'DirtyDot']) {
      expect(editor).toContain(`components/common/${primitive}`);
    }
    expect(NOTES('NotesContextToolbar.tsx')).toContain('components/common/SectionLabel');
  });

  it('does not re-declare a local SectionLabel or Tooltip', () => {
    expect(NOTES('NotesContextToolbar.tsx')).not.toMatch(/const (SectionLabel|Tooltip) = styled/);
  });

  it('the toolbar and separator come from the shared styles', () => {
    const editor = NOTES('NotesEditor.tsx');
    expect(editor).toContain('ToolbarSeparator');
    expect(editor).not.toMatch(/const (Toolbar|Separator) = styled/);
  });

  it('the hex status bar is the shared StatusBar', () => {
    expect(NOTES('NotesHexEditor.tsx')).toContain('StatusBarLeft');
    expect(NOTES('NotesHexEditor.tsx')).not.toMatch(/const StatusBar = styled/);
  });

  it('the preview debounce uses the shared DEBOUNCE_MS, not a local value', () => {
    expect(NOTES('NotesPreview.tsx')).toContain('DEBOUNCE_MS');
  });
});

describe('the notes folder has no lint debt', () => {
  /**
   * The folder carried two problems after the consistency pass: a non-null assertion
   * in the save updater, and a `set-state-in-effect` error on the mount load. The
   * assertion was replaced by narrowing inside the updater, and the load by a promise
   * continuation — which is the form the rule permits, because the state update is an
   * external-system callback rather than a synchronous call in the effect body.
   */
  it('no non-null assertions', () => {
    const offenders = NOTES_FILES.filter((f) => /[\w\]}]\.(bytes|content|name)!/.test(NOTES(f)));
    expect(offenders).toEqual([]);
  });

  it('the mount load updates state from the promise continuation, not the effect body', () => {
    const context = NOTES('NotesContext.tsx');
    expect(context).toMatch(/invoke[^]*load_notes_index[^]*\.then\(\(index\) => setNotes/);
    expect(context).toMatch(/\.catch\(\(e\) => setError\(commandErrorText\(e\)\)\)/);
  });
});

describe('the hybrid markdown classes are actually styled', () => {
  it('every class hybridPlugin assigns has a matching theme rule', () => {
    const plugin = NOTES('hybridPlugin.ts');
    const classes = [...plugin.matchAll(/className = "([^"]+)"/g)].map((m) => m[1]);
    const theme = NOTES('NotesCodeMirrorEditor.tsx');
    expect(classes.length).toBeGreaterThan(0);
    for (const cls of classes) {
      expect(theme, `class "${cls}" is assigned but never styled`).toContain(`.${cls}`);
    }
  });
});

describe('every context-toolbar action is handled', () => {
  it('the actions the toolbar emits appear in the CodeMirror command switch', () => {
    const toolbar = NOTES('NotesContextToolbar.tsx');
    const actions = [...toolbar.matchAll(/action: "([^"]+)"/g)].map((m) => m[1]);
    const editor = NOTES('NotesCodeMirrorEditor.tsx');
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      expect(editor, `action "${action}" has no handler`).toContain(`case "${action}"`);
    }
  });
});

describe('the notes feature is on the shared message contract', () => {
  it('BackendCommand has a notes entry and the provider consumes it', () => {
    const messages = readFileSync(resolve(ROOT, 'shared', 'src', 'messages.ts'), 'utf8');
    expect(messages).toContain("NotesUpdated = 'notesUpdated'");
    expect(NOTES('NotesContext.tsx')).toContain('BackendCommand.NotesUpdated');
  });

  it('the emitter payload matches the shape the provider reads', () => {
    const rust = readFileSync(resolve(ROOT, 'src-tauri', 'src', 'notes_storage.rs'), 'utf8');
    expect(rust).toContain('"command": "notesUpdated"');
    expect(NOTES('NotesContext.tsx')).toContain('message.entries');
  });
});

describe('the notes editor has find and replace', () => {
  /**
   * The notes feature had no search at all: `@codemirror/search` was not a dependency and
   * nothing imported it, so Ctrl+F fell through to the browser. That is why raw JSON editing
   * — which is nothing but find-and-replace over a document — had to live in its own modal.
   */
  it('search is a declared dependency and wired into the keymap', () => {
    const pkg = JSON.parse(readFileSync(resolve(WEBVIEW, 'package.json'), 'utf8'));
    expect(pkg.dependencies['@codemirror/search']).toBeTruthy();

    const editor = NOTES('NotesCodeMirrorEditor.tsx');
    expect(editor).toContain('from "@codemirror/search"');
    expect(editor).toContain('...searchKeymap');
    expect(editor).toContain('search(');
  });

  it('the search panel is styled from the theme vars, not browser defaults', () => {
    const theme = NOTES('NotesCodeMirrorEditor.tsx');
    for (const selector of ['.cm-panel.cm-search', '.cm-searchMatch', '.cm-searchMatch-selected']) {
      expect(theme, `${selector} is not styled`).toContain(selector);
    }
  });
});
