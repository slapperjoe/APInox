import { describe, it, expect } from 'vitest';
import {
    resolveRequestType,
    buildRestInvokeArgs,
    normalizeRestResponse,
    editorLanguageForRequest,
    findOwnerRequest,
} from './unifiedExecute';
import type { ApiRequest, UnifiedProject } from '@shared/models';

// Phase 4 (R-09 / F-06 / F-07) — unit tests for the request-type dispatcher
// util. These lock the legacy bridge.ts:433–505 semantics (body rules) in
// one testable place, independent of the Tauri bridge.

describe('resolveRequestType', () => {
    it('returns the declared rest type', () => {
        expect(resolveRequestType({ name: 'r', request: '', requestType: 'rest' })).toBe('rest');
    });
    it('returns an explicit soap type', () => {
        expect(resolveRequestType({ name: 'r', request: '', requestType: 'soap' })).toBe('soap');
    });
    it('defaults to soap when requestType is absent (WSDL/legacy/quick requests)', () => {
        expect(resolveRequestType({ name: 'r', request: '' })).toBe('soap');
    });
});

describe('buildRestInvokeArgs (legacy bridge.ts:433–505 parity)', () => {
    it('REST GET sends no body', () => {
        const args = buildRestInvokeArgs({
            method: 'get',
            url: 'https://petstore.swagger.io/v2/pet/1',
            headers: { 'Content-Type': 'application/json' },
            body: '{"should":"not":"be":"sent"}',
        });
        expect(args.method).toBe('GET'); // uppercased
        expect(args.url).toBe('https://petstore.swagger.io/v2/pet/1');
        expect(args.body).toBeNull();
        expect(args.headers).toEqual({ 'Content-Type': 'application/json' });
    });

    it('REST POST/PUT/PATCH send the body', () => {
        for (const m of ['POST', 'PUT', 'PATCH']) {
            const args = buildRestInvokeArgs({
                method: m,
                url: 'https://petstore.swagger.io/v2/pet',
                headers: {},
                body: '{"name":"dog"}',
            });
            expect(args.method).toBe(m);
            expect(args.body).toBe('{"name":"dog"}');
        }
    });

    it('no body at all yields null', () => {
        expect(
            buildRestInvokeArgs({ method: 'GET', url: 'u', headers: {}, body: null }).body,
        ).toBeNull();
    });
});

describe('normalizeRestResponse', () => {
    it('maps the Rust HttpResponse into the ExecutionResponse shape', () => {
        const out = normalizeRestResponse(
            {
                success: true,
                status: 200,
                status_text: 'OK',
                headers: { 'content-type': 'application/json' },
                body: '{"id":1}',
                time_taken_ms: 12,
            },
            'application/json',
        );
        expect(out.rawResponse).toBe('{"id":1}');
        expect(out.status).toBe(200);
        expect(out.statusText).toBe('OK');
        expect(out.headers).toEqual({ 'content-type': 'application/json' });
        expect(out.contentType).toBe('application/json');
    });

    it('falls back to the request content type when the response has none', () => {
        const out = normalizeRestResponse(
            { success: false, status: 500, headers: {}, body: '' },
            'application/json',
        );
        expect(out.contentType).toBe('application/json');
        expect(out.status).toBe(500);
    });
});

describe('editorLanguageForRequest (doc §5.3(3), risk R3)', () => {
    it('SOAP → xml', () => {
        expect(editorLanguageForRequest({ name: 'r', request: '', requestType: 'soap', contentType: 'text/xml' })).toBe('xml');
    });
    it('REST with JSON content type → json', () => {
        expect(
            editorLanguageForRequest({ name: 'r', request: '', requestType: 'rest', contentType: 'application/json' }),
        ).toBe('json');
    });
    it('REST with a non-JSON content type → plaintext', () => {
        expect(
            editorLanguageForRequest({ name: 'r', request: '', requestType: 'rest', contentType: 'text/plain' }),
        ).toBe('plaintext');
    });
    it('undeclared type (WSDL/quick request default) → xml (backward compatible)', () => {
        expect(editorLanguageForRequest({ name: 'r', request: '', contentType: 'application/soap+xml' })).toBe('xml');
    });
    it('null request → xml (safe default)', () => {
        expect(editorLanguageForRequest(null)).toBe('xml');
    });
});

describe('findOwnerRequest', () => {
    const project: UnifiedProject = {
        name: 'P',
        source: 'openapi',
        parsedAt: new Date(),
        operations: [
            {
                name: 'Op',
                action: '',
                originalEndpoint: 'https://x',
                requests: [{ name: 'sample_op', request: '', id: 'req-abc', requestType: 'rest' }],
            },
        ],
    };

    it('resolves the owning project + operation for a nested request', () => {
        const owner = findOwnerRequest([project], 'req-abc');
        expect(owner?.project?.name).toBe('P');
        expect(owner?.operation?.name).toBe('Op');
    });
    it('falls back to name when the request has no id', () => {
        const p2: UnifiedProject = {
            ...project,
            operations: [{ name: 'Op2', action: '', requests: [{ name: 'onlyname', request: '' }] }],
        };
        expect(findOwnerRequest([p2], 'onlyname')?.operation?.name).toBe('Op2');
    });
    it('returns null when the request is not nested in the projects (quick request)', () => {
        expect(findOwnerRequest([project], 'not-there')).toBeNull();
    });
});
