// Shared completion geometry for template variables (`{{name}}` / `${name}`).
// Pure logic (no monaco import) so it runs in the node-env test runner.

/// Completion range + insert text for a template variable.
///
/// The range spans the partial name the user has typed (from just after the
/// opening `{{` / `${` to the caret), not `getWordUntilPosition` — word
/// boundaries break on names containing `-` or `(` and mis-anchor Monaco's
/// prefix filtering. The insert text closes the template (`}}` / `}`) unless
/// the caret is already inside a closed one, so accepting a suggestion yields
/// a complete `{{name}}` instead of a bare word.
export function completionRangeAndText(
  model: { getValueInRange: (r: any) => string },
  position: { lineNumber: number; column: number },
  partialLen: number,
  name: string,
  close: string,
): { range: any; insertText: string } {
  const range = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: position.column - partialLen,
    endColumn: position.column,
  };
  const after = model.getValueInRange({
    startLineNumber: position.lineNumber,
    startColumn: position.column,
    endLineNumber: position.lineNumber,
    endColumn: position.column + close.length,
  });
  return { range, insertText: after === close ? name : name + close };
}
