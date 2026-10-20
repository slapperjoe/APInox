/**
 * trafficTestCase.ts
 *
 * Converts captured proxy traffic (watcher logs) into standalone test-case
 * request steps. Each selected log becomes a `request` step holding a raw,
 * identical copy of the captured call — method, URL, headers and body
 * verbatim, unless tagged captured values are supplied via
 * `BuildTestStepsOpts`, in which case a picked value is emitted as
 * `{{variable}}` (the source step's extractor re-populates it at run time) —
 * the same chain capture the workflow wizard offers.
 *
 * The captured Content-Type string is copied EXACTLY, including any extra
 * parameters (SOAP 1.2 requests carry `action="urn:..."` in the
 * Content-Type). Both the `Content-Type` header and the `contentType`
 * mirror hold that raw value, and `bodyType` is deliberately left unset so
 * nothing re-derives the captured value from the body type.
 *
 * The captured header is the source of truth: the Headers tab shows it as a
 * custom ("Other…") Content-Type rather than snapping it to a standard option.
 */
import type { TrafficLog } from '../components/proxy/TrafficViewer';
import type { ApiRequest, RequestExtractor, TestStep } from '@shared/models';
import { findContentTypeHeader } from '@shared/utils/contentType';
import { applyValueSubstitutions, trafficStepName } from './trafficWorkflow';

/** Look up the captured Content-Type value (case-insensitive key). */
export function findContentType(headers?: Record<string, string>): string {
    return findContentTypeHeader(headers);
}

/** Test-environment-safe id generator (crypto.randomUUID is absent in some jsdom runs). */
export function newId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Options for {@link buildTrafficTestSteps} — optional chain capture. */
export interface BuildTestStepsOpts {
    /** Per-log-id extractors to attach to that step (test-case shape). */
    extractors?: Record<string, RequestExtractor[]>;
    /** Value → variable substitutions applied to request bodies/headers/URLs so
     *  a tagged captured value is emitted as `{{variable}}` (runtime-extracted). */
    valueSubstitutions?: Array<{ value: string; variable: string }>;
}

/**
 * Build one standalone `request` test step per captured log, in capture
 * order (fire order = step order).
 */
export function buildTrafficTestSteps(logs: TrafficLog[], opts: BuildTestStepsOpts = {}): TestStep[] {
    const { extractors, valueSubstitutions } = opts;
    return logs.map((log) => {
        // Tagged captured values become {{variable}} placeholders in the body,
        // URL and header values they're consumed in, so runtime extractors
        // re-populate them at run time (longest value first, see
        // applyValueSubstitutions). Untagged traffic is emitted verbatim.
        const headers: Record<string, string> = {};
        for (const [name, value] of Object.entries(log.requestHeaders || {})) {
            headers[name] = applyValueSubstitutions(String(value ?? ''), valueSubstitutions);
        }
        // Copy the captured Content-Type verbatim — it may carry extra
        // parameters (e.g. `application/soap+xml; charset=utf-8;
        // action="urn:demo:login"`) the replay must keep. Read it from the
        // (possibly substituted) headers so both copies stay in sync.
        const rawCT = findContentType(headers);
        // SOAP content-type → raw-XML SOAP route; everything else → raw REST
        // route (method + URL + headers + body pass through untouched).
        const requestType: 'soap' | 'rest' = rawCT.toLowerCase().includes('soap') ? 'soap' : 'rest';
        const apiRequest: ApiRequest = {
            id: newId(),
            name: trafficStepName(log),
            request: applyValueSubstitutions(log.requestBody || '', valueSubstitutions),
            endpoint: applyValueSubstitutions(log.url, valueSubstitutions),
            method: log.method || 'POST',
            contentType: rawCT,
            headers,
            requestType,
            // Extractors (when the wizard tagged captured values) make this
            // step re-capture them at run time for later steps.
            extractors: extractors?.[log.id]?.length ? extractors[log.id] : undefined,
            // bodyType intentionally omitted: the runner passes the captured
            // headers through untouched (no content-type "fixing"), keeping
            // the replay identical to the capture.
            fromTraffic: true,
            dirty: true,
        };
        return {
            id: newId(),
            name: apiRequest.name,
            type: 'request' as const,
            config: { request: apiRequest, requestId: undefined },
        };
    });
}
