import type { Workflow, WorkflowStep, WorkflowExtractor } from "@shared/models";
import type { TrafficLog } from "../components/proxy/TrafficViewer";

export interface BuildOpts {
    /** Log ids to exclude (user unchecked in the wizard). */
    disabledIds?: Set<string>;
    /** Per-log-id extractors to attach to that step. */
    extractors?: Record<string, WorkflowExtractor[]>;
    /** Explicit per-step names (keyed by log id). */
    stepNames?: Record<string, string>;
}

export function lastPathSegment(url: string): string {
    try {
        const seg = new URL(url).pathname.split("/").filter(Boolean).pop();
        if (seg) return seg;
    } catch { /* not a URL */ }
    return "request";
}

/** Convert captured traffic into ordered, self-contained request steps (chronological). */
export function buildWorkflowStepsFromLogs(logs: TrafficLog[], opts: BuildOpts = {}): WorkflowStep[] {
    const { disabledIds, extractors = {}, stepNames = {} } = opts;
    const included = logs.filter(l => !disabledIds?.has(l.id));
    return included.map((log, idx) => ({
        id: log.id,
        name: stepNames[log.id] || `${log.method} ${lastPathSegment(log.url)}`,
        type: "request",
        order: idx,
        endpoint: log.url,
        method: log.method,
        httpMethod: log.method as WorkflowStep["httpMethod"],
        requestBody: log.requestBody || "",
        headers: log.requestHeaders || {},
        contentType: log.requestHeaders?.["Content-Type"] || log.requestHeaders?.["content-type"],
        extractors: extractors[log.id]?.length ? extractors[log.id] : undefined,
    }));
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

/** XML element name (for filtering structure out of body candidates). */
const TAG_NAME_RE = /<([A-Za-z0-9_:\-]+)/g;

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
 * Detect values captured in an earlier response that are reused in a later request.
 * SOAP-only: body candidates come from XML element text; headers from header values.
 */
export function detectChainedValues(logs: TrafficLog[]): ChainedValue[] {
    const ordered = logs;
    const seen = new Map<string, ChainedValue>();
    const usedNames = new Set<string>();

    // Element names appearing in a response XML are structure shared across
    // requests (e.g. <OrderId>), not data — exclude them from body candidates.
    const tagNameSet = (xml: string): Set<string> => {
        const s = new Set<string>();
        let m: RegExpExecArray | null;
        while ((m = TAG_NAME_RE.exec(xml)) !== null) {
            const name = m[1];
            if (name.length >= MIN_TOKEN_LEN) s.add(name);
        }
        return s;
    };

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
        const produced: Array<{ value: string; source: 'body' | 'header'; header?: string; xpath?: string }> = [];

        if (resLog.responseBody) {
            const tags = tagNameSet(resLog.responseBody);
            for (const v of Array.from(new Set(candidateTokens(resLog.responseBody)))) {
                if (boiler.has(v)) continue; // already in this request
                if (tags.has(v)) continue;   // an element name here = structure
                produced.push({ value: v, source: "body", xpath: deriveXPath(resLog.responseBody, v) ?? undefined });
            }
        }
        for (const [h, val] of Object.entries(resLog.responseHeaders ?? {})) {
            for (const v of candidateHeaderValues(val)) {
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
                    seen.set(p.value, {
                        value: p.value,
                        variable: sanitizeVariable(p.value, usedNames),
                        sourceLogId: resLog.id,
                        source: p.source,
                        sourceHeaderName: p.header,
                        sourceXPath: p.xpath ?? undefined,
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
}

/** Turn the wizard's final state into the `Workflow` object the save path expects. */
export function assembleWorkflow(input: AssembleInput): Workflow {
    const { name, description, logs, disabledIds, initialVariables = {}, extractors, stepNames } = input;
    return {
        id: crypto.randomUUID(),
        name,
        description,
        steps: buildWorkflowStepsFromLogs(logs, { disabledIds, extractors, stepNames }),
        variables: Object.keys(initialVariables).length ? initialVariables : undefined,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
    };
}
