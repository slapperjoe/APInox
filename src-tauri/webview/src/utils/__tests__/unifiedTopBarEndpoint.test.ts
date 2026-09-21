import { describe, it, expect } from 'vitest';
import { resolveTopBarEndpoint } from '../unifiedTopBarEndpoint';
import { UnifiedProject, ApiOperation, ScrapbookRequest } from '@shared/models';

const OP: ApiOperation = {
    id: 'op-1',
    name: 'GetFoo',
    originalEndpoint: 'http://op.example.com/svc',
    requests: [
        { id: 'req-1', name: 'req-1', request: '<x/>', endpoint: 'http://req.example.com/svc' },
        { id: 'req-2', name: 'req-2', request: '<x/>' }, // no endpoint → inherits op
    ],
};
const PROJECT: UnifiedProject = {
    name: 'TestService',
    source: 'wsdl',
    sourceUrl: 'http://op.example.com/svc?wsdl',
    parsedAt: new Date(),
    soapVersion: '1.1',
    operations: [OP],
};

describe('resolveTopBarEndpoint', () => {
    it('returns the request endpoint for a selected request', () => {
        expect(resolveTopBarEndpoint({ type: 'request', id: 'req-1' }, [PROJECT], null))
            .toBe('http://req.example.com/svc');
    });

    it('falls back to the operation originalEndpoint when the request has no endpoint', () => {
        expect(resolveTopBarEndpoint({ type: 'request', id: 'req-2' }, [PROJECT], null))
            .toBe('http://op.example.com/svc');
    });

    it('returns the operation originalEndpoint for a selected operation', () => {
        expect(resolveTopBarEndpoint({ type: 'operation', id: 'op-1' }, [PROJECT], null))
            .toBe('http://op.example.com/svc');
    });

    it('returns the scrapbook endpoint for a selected scrapbook node', () => {
        const sb: ScrapbookRequest = {
            id: 'sb-1', name: 'quick', request: '<x/>', endpoint: 'http://quick.example.com',
        } as ScrapbookRequest;
        expect(resolveTopBarEndpoint({ type: 'scrapbook', id: 'sb-1' }, [], sb))
            .toBe('http://quick.example.com');
    });

    it('returns null for no selection (WSDL loader mode)', () => {
        expect(resolveTopBarEndpoint(null, [PROJECT], null)).toBeNull();
    });

    it('returns null for a project selection (WSDL loader mode)', () => {
        expect(resolveTopBarEndpoint({ type: 'project', id: 'TestService' }, [PROJECT], null)).toBeNull();
    });

    it('returns null when the selected node does not resolve', () => {
        expect(resolveTopBarEndpoint({ type: 'request', id: 'nope' }, [PROJECT], null)).toBeNull();
        expect(resolveTopBarEndpoint({ type: 'operation', id: 'nope' }, [PROJECT], null)).toBeNull();
    });
});
