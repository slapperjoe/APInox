import { describe, it, expect, vi } from 'vitest';
import { extractValue } from '../extractValue';

// The shared suite runs in the node environment, where DOMParser does not exist,
// so the XPath evaluator itself cannot be exercised here. Mocking it proves the
// routing decision, which is the part this module owns.
vi.mock('../xpathEvaluator', () => ({
    CustomXPathEvaluator: { evaluate: vi.fn(() => 'from-xpath') },
}));

const JSON_BODY = '{"data":{"token":"abc123","items":[{"id":7}]}}';
const XML_BODY = '<Envelope><Header><Token>xyz</Token></Header></Envelope>';

describe('extractValue', () => {
    it('runs a JSONPath extractor as JSONPath', () => {
        expect(extractValue({ type: 'JSONPath', source: 'body', path: '$.data.token' }, JSON_BODY, {})).toBe('abc123');
        expect(extractValue({ type: 'JSONPath', source: 'body', path: '$.data.items[0].id' }, JSON_BODY, {})).toBe('7');
    });

    it('does not evaluate a JSONPath as XPath', () => {
        // The old behaviour: every body extractor went through the XPath
        // evaluator, so this returned null and the variable stayed empty.
        expect(extractValue({ type: 'JSONPath', source: 'body', path: '$.data.token' }, JSON_BODY, {})).not.toBeNull();
    });

    it('matches the wire format, which lowercases the type', () => {
        expect(extractValue({ type: 'jsonpath', source: 'body', path: '$.data.token' }, JSON_BODY, {})).toBe('abc123');
    });

    it('runs a Regex extractor with capture-group semantics', () => {
        expect(extractValue({ type: 'Regex', source: 'body', path: 'Token>([^<]+)<' }, XML_BODY, {})).toBe('xyz');
        expect(extractValue({ type: 'Regex', source: 'body', path: 'abc123' }, JSON_BODY, {})).toBe('abc123');
    });

    it('reads headers case-insensitively', () => {
        const headers = { 'X-Trace-Id': 't-9' };
        expect(extractValue({ type: 'Header', source: 'header', path: 'x-trace-id' }, JSON_BODY, headers)).toBe('t-9');
        expect(extractValue({ type: 'Regex', source: 'header', path: 'content-type' }, JSON_BODY, {})).toBeNull();
    });

    it('still routes XPath extractors to the XPath evaluator', () => {
        expect(extractValue({ type: 'XPath', source: 'body', path: '/Envelope/Header/Token' }, XML_BODY, {})).toBe('from-xpath');
    });

    it('returns null for a path it cannot resolve rather than a wrong value', () => {
        expect(extractValue({ type: 'JSONPath', source: 'body', path: '$.data.nope' }, JSON_BODY, {})).toBeNull();
        expect(extractValue({ type: 'JSONPath', source: 'body', path: '$.data.token' }, '<not json>', {})).toBeNull();
        expect(extractValue({ type: 'JSONPath', source: 'body', path: '' }, JSON_BODY, {})).toBeNull();
    });
});
