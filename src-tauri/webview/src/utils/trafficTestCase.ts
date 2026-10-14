/**
 * trafficTestCase.ts
 *
 * Converts captured proxy traffic (watcher logs) into standalone test-case
 * request steps. Each selected log becomes a `request` step holding a raw,
 * identical copy of the captured call — method, URL, headers and body
 * verbatim, no variables or substitutions.
 *
 * The captured Content-Type string is copied EXACTLY, including any extra
 * parameters (SOAP 1.2 requests carry `action="urn:..."` in the
 * Content-Type). Both the `Content-Type` header and the `contentType`
 * field hold that raw value, and `bodyType` is deliberately left unset so
 * the runner never rewrites the captured header (see
 * useRequestExecution.fixContentType).
 *
 * Steps are tagged `fromTraffic: true` so the editor unlocks the
 * Content-Type header row for them (the captured value is the source of
 * truth, not a WSDL/interface resolution).
 */
import type { TrafficLog } from '../components/proxy/TrafficViewer';
import type { ApiRequest, TestStep } from '@shared/models';
import { lastPathSegment } from './trafficWorkflow';

/** Look up the captured Content-Type value (case-insensitive key). */
export function findContentType(headers?: Record<string, string>): string {
    if (!headers) return '';
    for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === 'content-type') return v;
    }
    return '';
}

/** Test-environment-safe id generator (crypto.randomUUID is absent in some jsdom runs). */
export function newId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Build one standalone `request` test step per captured log, in capture
 * order (fire order = step order).
 */
export function buildTrafficTestSteps(logs: TrafficLog[]): TestStep[] {
    return logs.map((log) => {
        const headers = { ...(log.requestHeaders || {}) };
        // Copy the captured Content-Type verbatim — it may carry extra
        // parameters (e.g. `application/soap+xml; charset=utf-8;
        // action="urn:demo:login"`) the replay must keep.
        const rawCT = findContentType(headers);
        // SOAP content-type → raw-XML SOAP route; everything else → raw REST
        // route (method + URL + headers + body pass through untouched).
        const requestType: 'soap' | 'rest' = rawCT.toLowerCase().includes('soap') ? 'soap' : 'rest';
        const apiRequest: ApiRequest = {
            id: newId(),
            name: `${log.method} ${lastPathSegment(log.url)}`,
            request: log.requestBody || '',
            endpoint: log.url,
            method: log.method || 'POST',
            contentType: rawCT,
            headers,
            requestType,
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
