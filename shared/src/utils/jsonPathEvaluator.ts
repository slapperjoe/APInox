/**
 * JSONPath evaluator for JSON responses.
 *
 * The extractor model offers a JSONPath type (shared/src/models.ts
 * `RequestExtractorType`), but until now every body extractor was evaluated as
 * XPath — a JSONPath extractor produced nothing with no error, so the user saw
 * an empty variable and no signal. This implements the subset the app can
 * actually resolve without a dependency:
 *
 *   $            root
 *   .name        member access
 *   ['name']     quoted member access
 *   [0]          array index (negative indexes count from the end)
 *   [*]          wildcard — first member / element
 *   ..name       recursive descent — first match in document order
 *
 * Filters and script expressions are deliberately not supported; a path the
 * evaluator cannot read returns null rather than a wrong value.
 *
 * Scalars resolve to their text form (strings unquoted); objects and arrays
 * resolve to their JSON text, which is what a template substitution needs.
 */

type Step =
  | { kind: "key"; name: string }
  | { kind: "index"; n: number }
  | { kind: "wildcard" }
  | { kind: "descend"; name: string };

function parsePath(path: string): Step[] {
  const steps: Step[] = [];
  let i = path[0] === "$" ? 1 : 0;

  while (i < path.length) {
    const ch = path[i];

    if (ch === ".") {
      if (path[i + 1] === ".") {
        i += 2;
        let name = "";
        while (i < path.length && path[i] !== "." && path[i] !== "[") {
          name += path[i];
          i++;
        }
        steps.push({ kind: "descend", name });
        continue;
      }
      i++;
      if (path[i] === "*") {
        steps.push({ kind: "wildcard" });
        i++;
        continue;
      }
      let name = "";
      while (i < path.length && path[i] !== "." && path[i] !== "[") {
        name += path[i];
        i++;
      }
      steps.push({ kind: "key", name });
      continue;
    }

    if (ch === "[") {
      i++;
      let raw = "";
      while (i < path.length && path[i] !== "]") {
        raw += path[i];
        i++;
      }
      i++; // consume ']'
      const token = raw.trim();
      if (token === "*") {
        steps.push({ kind: "wildcard" });
      } else if (/^-?\d+$/.test(token)) {
        steps.push({ kind: "index", n: parseInt(token, 10) });
      } else {
        steps.push({ kind: "key", name: token.replace(/^['"]|['"]$/g, "") });
      }
      continue;
    }

    // A leading name with no dot, e.g. "store.book[0]"
    let name = "";
    while (i < path.length && path[i] !== "." && path[i] !== "[") {
      name += path[i];
      i++;
    }
    steps.push({ kind: "key", name });
  }

  return steps;
}

function descend(value: unknown, name: string): unknown {
  if (value === null || typeof value !== "object") return undefined;
  if (!Array.isArray(value) && name in (value as Record<string, unknown>)) {
    return (value as Record<string, unknown>)[name];
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    const found = descend(child, name);
    if (found !== undefined) return found;
  }
  return undefined;
}

function resolve(value: unknown, steps: Step[]): unknown {
  let current: unknown = value;
  for (const step of steps) {
    if (current === null || current === undefined) return null;

    if (step.kind === "key") {
      if (typeof current !== "object") return null;
      current = (current as Record<string, unknown>)[step.name];
    } else if (step.kind === "index") {
      if (!Array.isArray(current)) return null;
      const idx = step.n < 0 ? current.length + step.n : step.n;
      current = current[idx];
    } else if (step.kind === "wildcard") {
      if (Array.isArray(current)) current = current[0];
      else current = Object.values(current as Record<string, unknown>)[0];
    } else {
      current = descend(current, step.name);
    }

    if (current === undefined) return null;
  }
  return current;
}

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

export class JsonPathEvaluator {
  /** Evaluate a JSONPath against JSON text. Returns the first match as text,
   *  or null when the JSON cannot be parsed or the path resolves to nothing. */
  static evaluate(json: string, path: string): string | null {
    if (!json || !path) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return null;
    }

    const value = resolve(parsed, parsePath(path));
    return value === null || value === undefined ? null : toText(value);
  }
}
