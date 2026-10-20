import { describe, it, expect } from 'vitest';
import {
    CONTENT_TYPE_OPTIONS,
    findContentTypeHeader,
    isStandardContentType,
    effectiveContentType,
} from '../contentType';

describe('findContentTypeHeader', () => {
    it('is case-insensitive on the key', () => {
        expect(findContentTypeHeader({ 'content-type': 'text/xml' })).toBe('text/xml');
        expect(findContentTypeHeader({ 'Content-Type': 'application/json', Host: 'h' })).toBe('application/json');
    });

    it('returns an empty string when there is no such header', () => {
        expect(findContentTypeHeader({ Host: 'h' })).toBe('');
        expect(findContentTypeHeader(undefined)).toBe('');
        expect(findContentTypeHeader(null)).toBe('');
    });
});

describe('isStandardContentType', () => {
    it('accepts the dropdown options only', () => {
        for (const option of CONTENT_TYPE_OPTIONS) {
            expect(isStandardContentType(option)).toBe(true);
        }
        // A captured value carrying extra parameters is not a standard option,
        // so the Headers tab shows it as a custom ("Other…") value.
        expect(isStandardContentType('application/soap+xml; action="urn:demo"')).toBe(false);
        expect(isStandardContentType('')).toBe(false);
    });
});

describe('effectiveContentType', () => {
    it('the header wins over the stored mirror', () => {
        expect(effectiveContentType({
            contentType: 'text/xml; charset=utf-8',
            headers: { 'Content-Type': 'application/xml' },
        })).toBe('application/xml');
    });

    it('falls back to the mirror, then to the given fallback', () => {
        expect(effectiveContentType({ contentType: 'text/xml', headers: {} })).toBe('text/xml');
        expect(effectiveContentType({ headers: {} }, 'text/xml; charset=utf-8')).toBe('text/xml; charset=utf-8');
        expect(effectiveContentType(null)).toBe('application/soap+xml');
    });
});
