import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useState,
} from "react";
import styled from "styled-components";
import type { EditorVariable } from "../types";

const InputContainer = styled.div`
  height: 26px; /* Matches standard VS Code input height approx */
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--apinox-input-border);
  background-color: var(--apinox-input-background);
  color: var(--apinox-input-foreground);
  display: flex;
  align-items: center;
  position: relative;

  &:focus-within {
    border-color: var(--apinox-focusBorder);
  }
`;

/**
 * Single-line contenteditable that renders the value as decorated spans.
 *
 * Perf (review item 1): this replaces a full `monaco.editor.create()` per row.
 * A native `<input>` cannot draw per-token styling that changes glyph width
 * (bold/italic), so the caret would drift off the highlighted text. A
 * contenteditable keeps the caret inside the styled content, which lets us
 * reproduce the full set of decoration types from `useWildcardDecorations`:
 *
 *   - wildcard-tag      ({{...}} env/global variables + functions)
 *   - environment-tag   ({{env}} / {{url}})
 *   - chain-variable    (${...} workflow variables)
 *   - undefined-warning (underline for undefined variables)
 *
 * It is still a plain DOM element — no Monaco view, DOM or worker per row.
 */
const DecoratedInput = styled.div`
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 4px 8px;
  font-family: var(--apinox-font-family);
  font-size: 13px;
  line-height: 18px;
  white-space: pre;
  overflow: hidden;
  outline: none;
  caret-color: var(--apinox-input-foreground);

  &:empty::before {
    content: attr(data-placeholder);
    color: var(--apinox-input-placeholderForeground, var(--apinox-descriptionForeground, #999));
  }

  .wildcard-tag-decoration {
    background-color: rgba(255, 105, 180, 0.2);
    border-radius: 12px;
    margin-left: 2px;
    margin-right: 2px;
  }
  .wildcard-tag-text {
    font-weight: bold;
    font-style: italic;
    color: var(--apinox-editorBracketHighlight-foreground2, #da70d6);
  }
  .environment-tag-decoration {
    background-color: rgba(255, 105, 180, 0.2);
    border-radius: 12px;
    margin-left: 2px;
    margin-right: 2px;
  }
  .environment-tag-text {
    font-weight: bold;
    font-style: italic;
    color: var(--apinox-editorBracketHighlight-foreground2, #da70d6);
  }
  .chain-variable-decoration {
    background-color: var(--apinox-editor-inactiveSelectionBackground, rgba(38, 79, 120, 0.4));
    border-radius: 12px;
    margin-left: 2px;
    margin-right: 2px;
  }
  .chain-variable-text {
    font-weight: bold;
    font-style: italic;
    color: var(--apinox-debugTokenExpression-name, #9cdcfe);
  }
  .undefined-variable-warning {
    text-decoration: underline;
    text-decoration-color: var(--apinox-errorForeground, #f44336);
  }
`;

interface MonacoSingleLineInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string; // shown when the field is empty
  readOnly?: boolean;
  onEnter?: () => void; // Support for hitting Enter
  onFocus?: () => void;
  /** Chain/workflow variables, used to enrich ${...} tooltips (defined/value/source). */
  availableVariables?: EditorVariable[];
  /** Environment/global variables, used to enrich {{...}} tooltips (defined/value/source). */
  availableEnvVariables?: EditorVariable[];
}

export interface MonacoSingleLineInputHandle {
  insertText: (text: string) => void;
}

// Known dynamic functions that render as "defined" (mirrors isKnownFunction in
// useWildcardDecorations).
const KNOWN_FUNCTIONS = new Set([
  "uuid", "newguid", "now", "epoch", "lorem", "name", "country", "state",
  "env", "url", "randomInt",
]);
function isKnownFunction(name: string): boolean {
  if (KNOWN_FUNCTIONS.has(name)) return true;
  if (/^now[+-]\d+[dmy]$/.test(name)) return true;
  if (/^lorem\(\d+\)$/.test(name)) return true;
  if (/^randomInt\(\d+,\d+\)$/.test(name)) return true;
  return false;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}

// Plain-text hover tooltips (native title attributes do not render Markdown, so
// these mirror the useWildcardDecorations hover content in plain form).
const FUNCTION_TOOLTIPS: Record<string, string> = {
  uuid: "Dynamic function: generates a random UUID v4 identifier",
  newguid: "Dynamic function: alias for uuid - generates a random UUID",
  now: "Dynamic function: current date/time in ISO 8601 format",
  epoch: "Dynamic function: current Unix timestamp in seconds",
  lorem: "Dynamic function: generates lorem ipsum placeholder text",
  name: "Dynamic function: generates a random full name",
  country: "Dynamic function: generates a random country name",
  state: "Dynamic function: generates a random US state name",
  randomInt: "Dynamic function: random integer between min and max (inclusive)",
  env: "Environment variable - resolves to the active environment's endpoint URL",
  url: "Environment variable - resolves to the active environment's endpoint URL",
};

function functionTooltip(name: string): string {
  if (name === "env" || name === "url") return FUNCTION_TOOLTIPS[name];
  if (KNOWN_FUNCTIONS.has(name)) return FUNCTION_TOOLTIPS[name] || "Dynamic wildcard function";
  if (/^now[+-]\d+[dmy]$/.test(name)) return "Dynamic function: date math (add/subtract days, months, or years to the current date)";
  if (/^lorem\(\d+\)$/.test(name)) return `Dynamic function: generates ${name.slice(6, -1)} words of lorem ipsum`;
  if (/^randomInt\(\d+,\d+\)$/.test(name)) return "Dynamic function: random integer between min and max (inclusive)";
  return "Dynamic wildcard function";
}

function tooltipForToken(
  token: string,
  availableVariables?: EditorVariable[],
  availableEnvVariables?: EditorVariable[],
): string {
  if (token.startsWith("{{")) {
    const name = token.slice(2, token.length - 2);
    if (name === "env" || name === "url") return FUNCTION_TOOLTIPS[name];
    const envVar = availableEnvVariables?.find((v) => v.name === name);
    if (envVar) {
      const displayValue = envVar.value
        ? envVar.value.length > 100
          ? envVar.value.substring(0, 100) + "..."
          : envVar.value
        : "not set";
      return `Custom variable ${name} - Value: ${displayValue}. Defined in Settings → Environments`;
    }
    if (isKnownFunction(name)) return functionTooltip(name);
    return "Unknown variable - not defined in environments, globals, or built-in functions. Workflow variables use ${name} syntax.";
  }
  const name = token.slice(2, token.length - 1);
  if (!availableVariables || availableVariables.length === 0) {
    return `Workflow variable ${name} - extracted during test execution.`;
  }
  const variable = availableVariables.find((v) => v.name === name);
  if (variable) {
    const displayValue = variable.value
      ? variable.value.length > 100
        ? variable.value.substring(0, 100) + "..."
        : variable.value
      : "pending extraction";
    return `Workflow variable ${name} - Source: ${variable.source}. Value: ${displayValue}`;
  }
  return `Undefined workflow variable ${name} - not extracted in any prior step. Add an extractor in a previous step.`;
}

// Caret-anchored autocomplete popup (the interactivity the contenteditable
// rewrite dropped). position: fixed escapes the input container's
// overflow:hidden clipping box — the standing dropdown-menu rule.
const AutocompletePopup = styled.div`
  position: fixed;
  z-index: 1000;
  min-width: 180px;
  max-width: 320px;
  background: var(--apinox-editorWidget-background);
  color: var(--apinox-editorWidget-foreground);
  border: 1px solid var(--apinox-editorWidget-border);
  border-radius: 4px;
  padding: 2px 0;
  font-family: var(--apinox-font-family);
  font-size: var(--apinox-fs-sm);
  overflow-y: auto;
`;

const AutocompleteRow = styled.div<{ $active: boolean }>`
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 3px 8px;
  cursor: pointer;
  background: ${(p) => (p.$active ? "var(--apinox-list-activeSelectionBackground)" : "transparent")};
  color: ${(p) => (p.$active ? "var(--apinox-list-activeSelectionForeground)" : "inherit")};

  .detail {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.65;
  }
`;

interface SuggestionItem {
  name: string;
  detail: string;
}

// `{{...}}` popup entries — the same function set the Monaco completion
// provider exposes, kept as name + short detail for the row.
const FUNCTION_ITEMS: SuggestionItem[] = [
  { name: "uuid", detail: "random UUID v4" },
  { name: "newguid", detail: "random UUID (alias)" },
  { name: "now", detail: "current time (ISO)" },
  { name: "epoch", detail: "unix timestamp" },
  { name: "randomInt(1,100)", detail: "random integer" },
  { name: "lorem(5)", detail: "lorem ipsum text" },
  { name: "name", detail: "random name" },
  { name: "country", detail: "random country" },
  { name: "state", detail: "random US state" },
  { name: "now+1d", detail: "date math (future)" },
  { name: "now-1d", detail: "date math (past)" },
  { name: "env", detail: "environment endpoint URL" },
  { name: "url", detail: "environment endpoint URL" },
];

interface PopupState {
  items: SuggestionItem[];
  active: number;
  top: number;
  left: number;
}

// Caret position in viewport coordinates. jsdom's Range has no
// getBoundingClientRect, so guard it and fall back to the element's rect
// (zero in jsdom — tests assert the popup's existence, not its placement).
function caretRect(el: HTMLElement): { top: number; left: number } {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (typeof range.getBoundingClientRect === "function") {
      const r = range.getBoundingClientRect();
      if (r && (r.bottom || r.left)) return { top: r.bottom, left: r.left };
    }
  }
  const r = el.getBoundingClientRect();
  return { top: r.bottom, left: r.left };
}

// Build the decorated HTML for the value, preserving exact character order so
// the caret offset maps one-for-one onto the rendered spans. Each decorated
// token carries a plain-text hover tooltip.
function renderDecoratedHTML(
  value: string,
  availableVariables?: EditorVariable[],
  availableEnvVariables?: EditorVariable[],
): string {
  const regex = /(\{\{[^}]+\}\}|\$\{[^}]+\})/g;
  let html = "";
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value)) !== null) {
    if (match.index > last) html += escapeHtml(value.slice(last, match.index));
    const token = match[0];
    let classes: string;
    if (token.startsWith("{{")) {
      const name = token.slice(2, token.length - 2);
      const isEnv = name === "env" || name === "url";
      const base = isEnv ? "environment-tag-decoration environment-tag-text" : "wildcard-tag-decoration wildcard-tag-text";
      const defined = isEnv || isKnownFunction(name) || (availableEnvVariables?.some((v) => v.name === name) ?? false);
      classes = defined ? base : `${base} undefined-variable-warning`;
    } else {
      const name = token.slice(2, token.length - 1);
      const base = "chain-variable-decoration chain-variable-text";
      // Underline undefined chain variables only when a variable list is known.
      classes = availableVariables && !availableVariables.some((v) => v.name === name)
        ? `${base} undefined-variable-warning`
        : base;
    }
    html += `<span class="${classes}" title="${escapeHtml(tooltipForToken(token, availableVariables, availableEnvVariables))}">${escapeHtml(token)}</span>`;
    last = match.index + token.length;
  }
  if (last < value.length) html += escapeHtml(value.slice(last));
  return html;
}

// Caret helpers: map the selection to an absolute text offset and back.
function getCaretOffset(el: HTMLElement): number | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

function setCaretOffset(el: HTMLElement, offset: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  let remaining = offset;
  for (const node of Array.from(el.childNodes)) {
    const len = node.textContent?.length ?? 0;
    if (remaining <= len) {
      const textNode = node.nodeType === 3 ? node : node.firstChild;
      if (textNode) {
        range.setStart(textNode, remaining);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
    }
    remaining -= len;
  }
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

export const MonacoSingleLineInputBase = forwardRef<
  MonacoSingleLineInputHandle,
  MonacoSingleLineInputProps
>(({ value, onChange, placeholder, readOnly = false, onEnter, onFocus, availableVariables, availableEnvVariables }, ref) => {
  const elRef = useRef<HTMLDivElement>(null);
  const caretOffsetRef = useRef<number | null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);

  // Re-render the decorated content when the value changes externally, then
  // restore the caret so typing does not jump.
  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;
    el.innerHTML = renderDecoratedHTML(value, availableVariables, availableEnvVariables);
    if (caretOffsetRef.current != null) {
      setCaretOffset(el, caretOffsetRef.current);
    }
  }, [value, availableVariables, availableEnvVariables]);

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      const el = elRef.current;
      if (!el) return;
      const offset = getCaretOffset(el) ?? el.textContent?.length ?? 0;
      const next = (el.textContent || "") + "";
      const cleaned = next.slice(0, offset) + text + next.slice(offset);
      caretOffsetRef.current = offset + text.length;
      onChange(cleaned);
    },
  }));

  // Open/refresh the popup when the caret sits inside an OPEN template
  // (`{{partial` / `${partial` at the caret). A closed template no longer
  // matches, so typing the closing braces dismisses it.
  const detectPopup = () => {
    if (readOnly) return;
    const el = elRef.current;
    if (!el) return;
    const offset = caretOffsetRef.current;
    if (offset == null) return;
    const before = (el.textContent || "").slice(0, offset);
    const m = before.match(/(\{\{|\$\{)([^}]*)$/);
    if (!m) {
      setPopup(null);
      return;
    }
    const open = m[1];
    const partial = m[2];
    const items = (
      open === "{{"
        ? [
            ...(availableEnvVariables || []).map((v) => ({
              name: v.name,
              detail: v.value ? `= ${v.value}` : "(not set)",
            })),
            ...FUNCTION_ITEMS,
          ]
        : (availableVariables || []).map((v) => ({
            name: v.name,
            detail: v.value ? `= ${v.value}` : "(pending)",
          }))
    ).filter((i) => i.name.toLowerCase().startsWith(partial.toLowerCase()));
    if (items.length === 0) {
      setPopup(null);
      return;
    }
    const rect = caretRect(el);
    setPopup({ items, active: 0, top: rect.top, left: rect.left });
  };

  // Accept a suggestion: replace the typed partial with the full name AND the
  // closing brace(s), so the completed template is `{{name}}` — not a bare
  // word. If the caret is already inside a closed template, don't double-close.
  const acceptSuggestion = (item: SuggestionItem) => {
    const el = elRef.current;
    if (!el) return;
    const text = el.textContent || "";
    const offset = caretOffsetRef.current ?? text.length;
    const m = text.slice(0, offset).match(/(\{\{|\$\{)([^}]*)$/);
    if (!m) return;
    const open = m[1];
    const close = open === "{{" ? "}}" : "}";
    const openStart = offset - m[2].length - open.length;
    const after = text.slice(offset);
    const insert = item.name + (after.startsWith(close) ? "" : close);
    const next = text.slice(0, openStart) + open + insert + after;
    caretOffsetRef.current = openStart + open.length + insert.length;
    onChange(next);
    setPopup(null);
  };

  // Force single line behavior (prevent newlines)
  const handleInput = () => {
    const el = elRef.current;
    if (!el) return;
    const raw = el.textContent || "";
    const clean = raw.replace(/[\r\n]+/g, "");
    caretOffsetRef.current = getCaretOffset(el);
    if (clean !== raw) {
      // Newline stripped: rebuild content so the DOM matches the emitted value.
      el.innerHTML = renderDecoratedHTML(clean, availableVariables, availableEnvVariables);
      if (caretOffsetRef.current != null) setCaretOffset(el, caretOffsetRef.current);
    }
    onChange(clean);
    detectPopup();
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const el = elRef.current;
    if (!el) return;
    const text = (event.clipboardData.getData("text") || "").replace(/[\r\n]+/g, "");
    const offset = getCaretOffset(el) ?? el.textContent?.length ?? 0;
    const current = el.textContent || "";
    const next = current.slice(0, offset) + text + current.slice(offset);
    caretOffsetRef.current = offset + text.length;
    onChange(next);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (popup) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setPopup((p) => p && { ...p, active: Math.min(p.active + 1, p.items.length - 1) });
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setPopup((p) => p && { ...p, active: Math.max(p.active - 1, 0) });
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        acceptSuggestion(popup.items[popup.active]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setPopup(null);
        return;
      }
    }
    if (event.key === "Enter") {
      event.preventDefault(); // single line: never insert a newline
      if (onEnter) onEnter();
    }
  };

  const handleFocus = useCallback(() => {
    if (onFocus) onFocus();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setPopup(null);
  }, []);

  // Backend clipboard paste fallback (parity with the previous Monaco version):
  // only writes into this input when it is the focused element, so a paste
  // does not broadcast to every input on the panel.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "clipboardText" && message.text) {
        const el = elRef.current;
        if (el && document.activeElement === el) {
          const clean = message.text.replace(/[\r\n]+/g, "");
          onChange(clean);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onChange]);

  return (
    <InputContainer>
      <DecoratedInput
        ref={elRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="false"
        data-placeholder={placeholder}
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        spellCheck={false}
      />
      {popup && (
        <AutocompletePopup
          data-testid="single-line-autocomplete"
          role="listbox"
          style={{
            top: popup.top,
            left: popup.left,
            maxHeight: Math.max(160, window.innerHeight - popup.top - 8),
          }}
        >
          {popup.items.map((item, i) => (
            <AutocompleteRow
              key={item.name}
              $active={i === popup.active}
              data-testid={`autocomplete-item-${item.name}`}
              role="option"
              aria-selected={i === popup.active}
              onMouseDown={(e) => {
                e.preventDefault(); // keep the caret/focus in the input
                acceptSuggestion(item);
              }}
            >
              <span>{item.name}</span>
              <span className="detail">{item.detail}</span>
            </AutocompleteRow>
          ))}
        </AutocompletePopup>
      )}
    </InputContainer>
  );
});

// R3 (MONACO_LAG_ROOT_CAUSE.md): memoize — these inputs sit next to the request
// editor and previously re-rendered on every keystroke even when their own
// value was unchanged.
export const MonacoSingleLineInput = React.memo(MonacoSingleLineInputBase);
