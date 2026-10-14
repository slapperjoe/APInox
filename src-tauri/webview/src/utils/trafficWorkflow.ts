import type { Workflow, WorkflowStep, WorkflowExtractor } from "@shared/models";
import type { TrafficLog } from "../components/proxy/TrafficViewer";
import { formatXml } from "@shared/utils/xmlFormatter";

export interface BuildOpts {
    /** Log ids to exclude (user unchecked in the wizard). */
    disabledIds?: Set<string>;
    /** Per-log-id extractors to attach to that step. */
    extractors?: Record<string, WorkflowExtractor[]>;
    /** Explicit per-step names (keyed by log id). */
    stepNames?: Record<string, string>;
    /** Value → variable substitutions applied to request bodies/headers so a
     *  tagged captured value is emitted as `{{variable}}` (runtime-extracted). */
    valueSubstitutions?: Array<{ value: string; variable: string }>;
    /** Final per-log request headers (keyed by log id) — the wizard's edited
     *  header rows. Wins over `log.requestHeaders` when present for a log. */
    headersByLog?: Record<string, Record<string, string>>;
}

export function lastPathSegment(url: string): string {
    try {
        const seg = new URL(url).pathname.split("/").filter(Boolean).pop();
        if (seg) return seg;
    } catch { /* not a URL */ }
    return "request";
}

/**
 * Substitute tagged `value` literals with `{{variable}}` placeholders in a
 * request body/header, so a captured token the wizard tagged is emitted as a
 * runtime-extractable reference instead of a hardcoded value. Sort by longest
 * value first so overlapping tokens don't clobber each other.
 */
function applyValueSubstitutions(text: string, subs: BuildOpts["valueSubstitutions"]): string {
    if (!subs?.length || !text) return text;
    const ordered = [...subs].sort((a, b) => b.value.length - a.value.length);
    let out = text;
    for (const s of ordered) {
        out = out.split(s.value).join(`{{${s.variable}}}`);
    }
    return out;
}

/** Pretty-print an XML body with the app's formatter (inline element values). */
function formatRequestXml(body: string | undefined): string {
    if (!body) return "";
    return formatXml(body, false, true);
}

/** Convert captured traffic into ordered, self-contained request steps (chronological). */
export function buildWorkflowStepsFromLogs(logs: TrafficLog[], opts: BuildOpts = {}): WorkflowStep[] {
    const { disabledIds, extractors = {}, stepNames = {}, valueSubstitutions, headersByLog } = opts;
    const included = logs.filter(l => !disabledIds?.has(l.id));
    return included.map((log, idx) => {
        const rawBody = log.requestBody || "";
        const substitutedBody = applyValueSubstitutions(rawBody, valueSubstitutions);
        // All captured request headers flow into the step. The wizard's
        // edited rows (headersByLog) win over the raw capture for that log;
        // untouched logs keep the captured headers verbatim.
        const captured = headersByLog?.[log.id] ?? log.requestHeaders ?? {};
        const headers: Record<string, string> = {};
        for (const key of Object.keys(captured)) {
            if (!key.trim()) continue; // drop rows with a blank name
            headers[key] = applyValueSubstitutions(String(captured[key] ?? ""), valueSubstitutions);
        }
        return {
            id: log.id,
            name: stepNames[log.id] || `${log.method} ${lastPathSegment(log.url)}`,
            type: "request",
            order: idx,
            endpoint: applyValueSubstitutions(log.url, valueSubstitutions),
            method: log.method,
            httpMethod: log.method as WorkflowStep["httpMethod"],
            requestBody: formatRequestXml(substitutedBody),
            headers,
            contentType: headers["Content-Type"] || headers["content-type"],
            extractors: extractors[log.id]?.length ? extractors[log.id] : undefined,
        };
    });
}

export interface ChainedValue {
    /** The raw captured value (the token/session id). */
    value: string;
    /** Suggested variable name (sanitized, unique). */
    variable: string;
    /** Log id of the response that first produced the value. */
    sourceLogId: string;
    /** Where it was captured: 'body' (XPath into the response XML) or 'header'. */
    source: 'body' | 'header';
    /** Header name when source === 'header'. */
    sourceHeaderName?: string;
    /** XPath to re-extract the value from the response body (source === 'body'). */
    sourceXPath?: string;
    /** Element/attribute tag the value was captured from (source === 'body'). */
    sourceElementName?: string;
    /** Log id of the request that consumes the value. */
    consumedByLogId: string;
    /** Where it is consumed: 'body' | 'url' | 'header'. */
    consumedIn: 'body' | 'url' | 'header';
    /** Header name when consumedIn === 'header'. */
    consumedHeaderName?: string;
}

const MIN_TOKEN_LEN = 6;          // shorter values are usually noise (status codes, dates)
const MAX_TOKEN_LEN = 128;
const MIN_HEADER_VAL_LEN = 3;     // header values are whole candidates; allow slightly shorter ids

/** Token-ish value: alnum plus common token chars, no surrounding spaces. */
const TOKEN_RE = /[A-Za-z0-9_\-]{6,128}/g;

/**
 * Element text content only — the "data" parts of an XML document. Excludes
 * element names, attribute names and attribute values (namespace URIs etc.),
 * which are structure, not data, and must never be suggested as values.
 * (Nested elements: text is collected from each element whose direct text
 * content matches; text adjacent to child elements is not a candidate.)
 */
function elementTexts(xml: string): string[] {
    const texts: string[] = [];
    const re = /<([A-Za-z0-9_:\-]+)(?:\s[^<>]*)?>([^<]*)<\/\1>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) texts.push(m[2]);
    return texts;
}

function candidateTokens(text: string): string[] {
    if (!text) return [];
    const out: string[] = [];
    for (const m of text.match(TOKEN_RE) ?? []) {
        if (m.length < MIN_TOKEN_LEN || m.length > MAX_TOKEN_LEN) continue;
        if (/^\d+$/.test(m)) continue;                 // pure numbers
        if (/^(20[0-9]|40[0-9]|50[0-9])$/.test(m)) continue; // status codes
        out.push(m);
    }
    return out;
}

/** Header values are whole candidates (session ids can be short); noise-filtered. */
function candidateHeaderValues(val: string): string[] {
    const t = String(val ?? "").trim();
    if (t.length < MIN_HEADER_VAL_LEN || t.length > MAX_TOKEN_LEN) return [];
    if (/^\d+$/.test(t)) return [];
    if (/^(20[0-9]|40[0-9]|50[0-9])$/.test(t)) return [];
    return [t];
}

/** Derive an element XPath that yields `value` from `xml` (first matching ancestor). */
function deriveXPath(xml: string, value: string): string | null {
    // Find the tag whose inner text equals (or contains) the value; prefer an exact match.
    const tagTextRe = /<([A-Za-z0-9_:\-]+)([^>]*)>([^<]*)<\/\1>/g;
    let m: RegExpExecArray | null;
    let best: string | null = null;
    while ((m = tagTextRe.exec(xml)) !== null) {
        const [, tag, , text] = m;
        if (text.trim() === value) {
            return `//${tag}/text()`;
        }
        if (text.includes(value) && !best) {
            best = `//${tag}/text()`;
        }
    }
    return best;
}

function sanitizeVariable(raw: string, used: Set<string>): string {
    let base = raw
        .replace(/[^A-Za-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 32) || "value";
    base = base[0].toLowerCase() + base.slice(1);
    let name = base;
    let i = 2;
    while (used.has(name)) { name = `${base}${i}`; i++; }
    used.add(name);
    return name;
}

/**
 * Element tag name whose inner text is `value` (exact match preferred, else the
 * first containing match). Namespace prefixes are stripped. Returns null when
 * the value is not an element's text (e.g. it came from a header).
 * Used to give a captured value a human default variable name.
 */
export function elementNameFor(xml: string, value: string): string | null {
    if (!xml) return null;
    const tagTextRe = /<([A-Za-z0-9_:\-]+)[^>]*>([^<]*)<\/\1>/g;
    let m: RegExpExecArray | null;
    let containsBest: string | null = null;
    while ((m = tagTextRe.exec(xml)) !== null) {
        const tag = m[1].split(":").pop() || m[1];
        const text = m[2].trim();
        if (text === value) return tag;
        if (text.includes(value) && !containsBest) containsBest = tag;
    }
    return containsBest;
}

/**
 * The raw source line a suggestion is based on — what the runtime extractor
 * will read at run time. Body: the element holding the value as raw XML (e.g.
 * `<SessionToken>TKN-999</SessionToken>`); header: the full header line.
 * Lets the wizard show the user exactly what each pick would capture.
 */
export function chainSourceLine(log: TrafficLog, c: ChainedValue): string {
    if (c.source === "header") {
        const name = c.sourceHeaderName ?? "";
        const raw = name ? log.responseHeaders?.[name] : undefined;
        return name ? `${name}: ${raw ?? c.value}` : c.value;
    }
    // Same match the detector used to find the value (exact text preferred,
    // else the containing element), shown as raw XML.
    const re = /<([A-Za-z0-9_:\-]+)([^>]*)>([^<]*)<\/\1>/g;
    let m: RegExpExecArray | null;
    let containsBest: string | null = null;
    while ((m = re.exec(log.responseBody ?? "")) !== null) {
        const text = m[3].trim();
        if (text === c.value) return m[0];
        if (text.includes(c.value) && !containsBest) containsBest = m[0];
    }
    if (containsBest) return containsBest;
    return c.sourceXPath ? `${c.sourceXPath}: ${c.value}` : c.value;
}

/**
 * Detect values captured in an earlier response that are reused in a later request.
 * SOAP-only: body candidates come from XML element TEXT only (structure —
 * element/attribute names and attribute values — is never a candidate);
 * headers from header values.
 */
export function detectChainedValues(logs: TrafficLog[]): ChainedValue[] {
    const ordered = logs;
    const seen = new Map<string, ChainedValue>();
    const usedNames = new Set<string>();

    // Values already present in an entry's own request body/URL/headers are
    // boilerplate shared with other requests (SOAP namespace URIs, shared
    // client ids) — not values this entry's response captured. Track them
    // per-entry so a value is only treated as "captured" if the response
    // introduced it relative to that request.
    const boilerplateFor = (log: TrafficLog): Set<string> => {
        const s = new Set<string>();
        for (const m of (log.requestBody ?? "").match(TOKEN_RE) ?? []) s.add(m);
        for (const m of (log.url ?? "").match(TOKEN_RE) ?? []) s.add(m);
        for (const [, val] of Object.entries(log.requestHeaders ?? {})) {
            for (const m of String(val).match(TOKEN_RE) ?? []) s.add(m);
        }
        return s;
    };

    for (let i = 0; i < ordered.length; i++) {
        const resLog = ordered[i];
        const boiler = boilerplateFor(resLog);
        // Values this log PRODUCES (its response).
        const produced: Array<{ value: string; source: 'body' | 'header'; header?: string; xpath?: string; elementName?: string }> = [];

        if (resLog.responseBody) {
            // Candidates come from element TEXT only, so element/attribute
            // names and attribute values (namespace URIs etc.) — structure,
            // not data — can never be suggested as captured values.
            const valueText = elementTexts(resLog.responseBody).join("\n");
            for (const v of Array.from(new Set(candidateTokens(valueText)))) {
                if (boiler.has(v)) continue; // already in this request
                const elName = elementNameFor(resLog.responseBody, v);
                produced.push({ value: v, source: "body", xpath: deriveXPath(resLog.responseBody, v) ?? undefined, elementName: elName ?? undefined });
            }
        }
        for (const [h, val] of Object.entries(resLog.responseHeaders ?? {})) {
            for (const v of candidateHeaderValues(val)) {
                // Same boilerplate rule as body candidates: a value the client
                // already sent in this request's own headers (e.g. a
                // Content-Type echoed back by the server) is not a value the
                // response captured — skip it.
                const alreadySent = Object.values(resLog.requestHeaders ?? {})
                    .some(rv => String(rv).trim().toLowerCase() === v.trim().toLowerCase());
                if (alreadySent) continue;
                produced.push({ value: v, source: "header", header: h });
            }
        }

        // For each produced value, find the LATEST later request that consumes it.
        for (const p of produced) {
            if (seen.has(p.value)) continue; // one suggestion per value
            for (let j = i + 1; j < ordered.length; j++) {
                const reqLog = ordered[j];
                let consumedIn: 'body' | 'url' | 'header' | null = null;
                let consumedHeader: string | undefined;

                const inBody = (reqLog.requestBody ?? "").includes(p.value);
                const inUrl = (reqLog.url ?? "").includes(p.value);
                let headerHit: string | undefined;
                for (const [h, val] of Object.entries(reqLog.requestHeaders ?? {})) {
                    if (String(val).includes(p.value)) { headerHit = h; break; }
                }
                if (inBody) { consumedIn = "body"; }
                else if (inUrl) { consumedIn = "url"; }
                else if (headerHit) { consumedIn = "header"; consumedHeader = headerHit; }

                if (consumedIn) {
                    // Default variable name: the element/attribute tag it was
                    // captured from (human-readable); fall back to the value.
                    const nameBase = p.source === "body" && p.elementName ? p.elementName : p.value;
                    seen.set(p.value, {
                        value: p.value,
                        variable: sanitizeVariable(nameBase, usedNames),
                        sourceLogId: resLog.id,
                        source: p.source,
                        sourceHeaderName: p.header,
                        sourceXPath: p.xpath ?? undefined,
                        sourceElementName: p.elementName,
                        consumedByLogId: reqLog.id,
                        consumedIn,
                        consumedHeaderName: consumedHeader,
                    });
                    break; // nearest consumer
                }
            }
        }
    }
    return Array.from(seen.values());
}

export interface AssembleInput {
    name: string;
    description?: string;
    logs: TrafficLog[];
    disabledIds?: Set<string>;
    initialVariables?: Record<string, string>;
    extractors?: Record<string, WorkflowExtractor[]>;
    stepNames?: Record<string, string>;
    /** Value → variable substitutions applied to generated step bodies/headers. */
    valueSubstitutions?: Array<{ value: string; variable: string }>;
    /** Wizard-edited per-log request headers (win over the raw capture). */
    headersByLog?: Record<string, Record<string, string>>;
}

/** Turn the wizard's final state into the `Workflow` object the save path expects. */
export function assembleWorkflow(input: AssembleInput): Workflow {
    const { name, description, logs, disabledIds, initialVariables = {}, extractors, stepNames, valueSubstitutions, headersByLog } = input;
    return {
        id: crypto.randomUUID(),
        name,
        description,
        steps: buildWorkflowStepsFromLogs(logs, { disabledIds, extractors, stepNames, valueSubstitutions, headersByLog }),
        variables: Object.keys(initialVariables).length ? initialVariables : undefined,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
    };
}
