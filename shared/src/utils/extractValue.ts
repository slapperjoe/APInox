/**
 * Single extraction entry point for the four extractor types the UI offers.
 *
 * Every executor used to have its own idea of what an extractor is. The webview
 * test runner ran every body extractor through the XPath evaluator, so JSONPath
 * and Regex extractors silently produced nothing; the Rust performance runner
 * handled XPath only and ignored the rest. This is the one place that reads the
 * type, so the three paths agree.
 *
 * Types are matched case-insensitively because the wire format lowercases them
 * (see src-tauri/src/workflow_migration.rs).
 */
import { RequestExtractor } from "../models";
import { CustomXPathEvaluator } from "./xpathEvaluator";
import { JsonPathEvaluator } from "./jsonPathEvaluator";
import { RegexEvaluator } from "./regexEvaluator";

/** The wire format lowercases the type (see src-tauri/src/workflow_migration.rs),
 *  so this takes the plain string rather than the `RequestExtractorType` union —
 *  a payload read from disk or imported from a workflow would not satisfy it. */
type ExtractorInput = Pick<RequestExtractor, "source" | "path"> & { type: string };

export function extractValue(
  extractor: ExtractorInput,
  body: string,
  headers: Record<string, string> = {},
): string | null {
  const type = (extractor.type || "XPath").toLowerCase();
  const path = extractor.path || "";
  if (!path) return null;

  if (type === "header" || extractor.source === "header") {
    const entry = Object.entries(headers).find(
      ([key]) => key.toLowerCase() === path.toLowerCase(),
    );
    return entry ? entry[1] : null;
  }

  switch (type) {
    case "jsonpath":
      return JsonPathEvaluator.evaluate(body, path);
    case "regex":
      return RegexEvaluator.extract(body, path);
    default:
      return CustomXPathEvaluator.evaluate(body, path);
  }
}
