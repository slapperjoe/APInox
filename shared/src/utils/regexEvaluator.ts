/**
 * Regex extractor for non-XML responses.
 *
 * Semantics match the Rust side (src-tauri/src/utils/regex_extractor.rs):
 * the first capture group is the value, or the whole match when the pattern has
 * no groups. An invalid pattern returns null rather than throwing, so a bad
 * extractor cannot take down a test run.
 */
export class RegexEvaluator {
  static extract(text: string, pattern: string): string | null {
    if (!text || !pattern) return null;

    try {
      const match = new RegExp(pattern).exec(text);
      if (!match) return null;
      return match[1] ?? match[0];
    } catch {
      return null;
    }
  }
}
