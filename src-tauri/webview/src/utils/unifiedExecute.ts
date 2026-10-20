import { ApiRequest, ApiOperation, SchemaIssue, UnifiedProject } from '@shared/models';
import { effectiveContentType } from '@shared/utils/contentType';
import type { ExecutionResponse } from '../request-editor/monaco';

/**
 * Phase 4 (R-09 / F-06 / F-07): request-type dispatcher for the unified
 * execute path.
 *
 * The unified explorer's `handleExecuteRequest` (UnifiedExplorerMain) used to
 * call `execute_soap_request` for every request. This module splits the
 * non-SOAP branches out of the component so the dispatch rules are testable
 * in isolation (doc §8: "per-type integration test") and so the SOAP branch
 * stays byte-identical to the R-02 baseline (doc §9 R3: "keep SOAP path
 * byte-identical; regression test (SOAP Country Info) as gate").
 *
 * REST semantics mirror the legacy bridge execute path
 * (`utils/bridge.ts` `ExecuteRequest` handler, baseline `3f7bc2f` lines
 * 433–505):
 *   - `execute_rest_request` is invoked with FLAT args
 *     `{ method, url, headers, body }` (the Rust command at
 *     `src-tauri/src/http/commands.rs` takes them positionally by name).
 *   - The body is sent only for REST methods POST/PUT/PATCH;
 *     GET/DELETE/etc. send no body.
 *
 * The legacy bridge itself is untouched (hard constraint 3: the legacy
 * EXPLORER view stays fully functional until Phase 6).
 */

/** Request-type discriminator used by the unified execute path. */
export type UnifiedRequestType = 'soap' | 'rest';

/** `execute_rest_request` response — Rust `HttpResponse` (http/client.rs). */
export interface ExecuteRestResponse {
    success: boolean;
    status: number;
    status_text?: string;
    headers: Record<string, string>;
    body: string;
    time_taken_ms?: number;
    error?: string | null;
    truncated?: boolean;
    /** Contract violations against the request's stored OpenAPI schema. */
    schema_issues?: SchemaIssue[];
}

export interface RestDispatchInput {
    /** `execute_rest_request` is flat-arg — `method` is required. */
    method: string;
    url: string;
    /** Request headers (already resolved; the dispatcher only passes them through). */
    headers: Record<string, string>;
    /** Raw body: JSON text for REST. */
    body: string | null;
    /** Stored OpenAPI response schema; present means the response is checked. */
    responseSchema?: unknown;
}

/**
 * Resolve the effective request type for a unified request.
 *
 * `ApiRequest.requestType` is the Phase-1 discriminator (Rust builders emit
 * `'rest'` for OpenAPI operations). Unset values default to SOAP — backward-compatible with WSDL
 * projects and with requests created before Phase 4 (doc §5.3(3), risk R3).
 */
export function resolveRequestType(req: ApiRequest): UnifiedRequestType {
    switch (req.requestType) {
        case 'rest':
            return req.requestType;
        case 'soap':
        default:
            return 'soap';
    }
}

/**
 * Build the flat `execute_rest_request` argument object for a REST request,
 * applying the legacy body rule (body only for POST/PUT/PATCH).
 *
 * Returned object is the EXACT argument record passed to the Tauri command
 * (the component spreads nothing into it) — tests assert on it verbatim.
 */
export function buildRestInvokeArgs(input: RestDispatchInput): {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string | null;
    responseSchema?: unknown;
} {
    const method = (input.method || 'GET').toUpperCase();
    const headers = { ...(input.headers || {}) };

    // Legacy rule (bridge.ts:440): REST carries a body only for the body methods.
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);
    const body: string | null = hasBody ? (input.body || null) : null;

    return { method, url: input.url, headers, body, responseSchema: input.responseSchema }
}

/**
 * Normalize a Rust `execute_rest_request` response into the `ExecutionResponse`
 * shape the unified response viewer renders (same shape the SOAP path
 * produces).
 */
export function normalizeRestResponse(
    result: ExecuteRestResponse,
    fallbackContentType?: string,
): ExecutionResponse {
    const headers = result.headers || {};
    return {
        rawResponse: result.body || '',
        status: result.status ?? 0,
        statusText: result.status_text || (result.success ? 'OK' : (result.error || 'Error')),
        headers,
        contentType: headers['content-type'] || fallbackContentType,
        schemaIssues: result.schema_issues,
    };
}

/**
 * Monaco editor language for a unified request (doc §5.3(3), risk R3: the
 * unified editor used to hardcode `language="xml"`).
 *
 * Chosen by the request's `contentType` / `requestType` / `bodyType`:
 *   - SOAP → `xml` (the R-02 baseline editor language).
 *   - REST → `json` (OpenAPI sample bodies are JSON; the Phase-1 builders
 *     set `contentType: application/json`), falling back to `plaintext`
 *     for a non-JSON content type.
 *
 * Quick requests (scrapbook) carry no `requestType` in the frozen
 * scrapbook.json schema, so a SOAP quick request still gets `xml` here —
 * existing behavior preserved.
 */
export function editorLanguageForRequest(req: ApiRequest | null | undefined): string {
    if (!req) return 'xml';
    const requestType: UnifiedRequestType = resolveRequestType(req);
    if (requestType === 'rest') {
        const ct = effectiveContentType(req, '').toLowerCase();
        return ct.includes('json') ? 'json' : 'plaintext';
    }
    // SOAP (and quick requests, whose type is undeclared in scrapbook.json).
    return 'xml';
}

/** Owner lookup shared by the dispatcher tests and the component. */
export interface OwnerInfo {
    project?: UnifiedProject;
    operation?: ApiOperation;
}

/**
 * Find the project/operation owning a request by id (same scan the execute
 * handler performs). Returns nothing when the request is not nested in the
 * given projects (e.g. quick requests).
 */
export function findOwnerRequest(
    projects: UnifiedProject[],
    requestId: string,
): OwnerInfo | null {
    for (const project of projects) {
        for (const op of project.operations || []) {
            if ((op.requests || []).some(r => (r.id || r.name) === requestId)) {
                return { project, operation: op };
            }
        }
    }
    return null;
}
