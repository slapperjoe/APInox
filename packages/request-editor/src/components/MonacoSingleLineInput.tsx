import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useLayoutEffect,
  useCallback,
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
    if (event.key === "Enter") {
      event.preventDefault(); // single line: never insert a newline
      if (onEnter) onEnter();
    }
  };

  const handleFocus = useCallback(() => {
    if (onFocus) onFocus();
  }, [onFocus]);

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
        spellCheck={false}
      />
    </InputContainer>
  );
});

// R3 (MONACO_LAG_ROOT_CAUSE.md): memoize — these inputs sit next to the request
// editor and previously re-rendered on every keystroke even when their own
// value was unchanged.
export const MonacoSingleLineInput = React.memo(MonacoSingleLineInputBase);
