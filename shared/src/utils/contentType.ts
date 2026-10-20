/**
 * contentType.ts
 *
 * Content-Type is a header, not a locked field. The Headers tab dropdown is the
 * only place it is chosen, and the value chosen there is exactly what is sent.
 *
 * `ApiRequest.contentType` (and the interface/project `contentType` fields) are
 * kept only as a derived mirror of the header — for persistence, editor
 * language, form enctype and sample metadata — and are backfilled from the
 * header, never the other way round.
 */

/**
 * Options offered by the Headers tab dropdown. Any value outside this list is
 * treated as a custom ("Other…") Content-Type and shown in a free-text input.
 * The two charset variants are in the list because they are the SOAP-version
 * defaults (`soapDefault`), so a freshly parsed WSDL request shows a real
 * option rather than falling into Other mode.
 */
export const CONTENT_TYPE_OPTIONS: string[] = [
    'application/json',
    'application/xml',
    'text/xml',
    'text/xml; charset=utf-8',
    'application/soap+xml',
    'application/soap+xml; charset=utf-8',
    'text/plain',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
];

/** Sentinel for the dropdown's "Other…" entry (never a real header value). */
export const CONTENT_TYPE_OTHER = '__other__';

/** Case-insensitive lookup of the Content-Type header ('' when absent). */
export const findContentTypeHeader = (headers?: Record<string, string> | null): string => {
    if (!headers) return '';
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === 'content-type' && typeof value === 'string') return value;
    }
    return '';
};

/** True when `value` is one of the dropdown's fixed options. */
export const isStandardContentType = (value: string): boolean =>
    CONTENT_TYPE_OPTIONS.includes((value || '').trim());

/**
 * The Content-Type a request will send: the header first, then the stored
 * mirror, then `fallback`. Display sites use this so what they show is what
 * goes on the wire.
 */
export const effectiveContentType = (
    request: { contentType?: string; headers?: Record<string, string> } | null | undefined,
    fallback = 'application/soap+xml'
): string => {
    const header = findContentTypeHeader(request?.headers).trim();
    return header !== '' ? header : ((request?.contentType || '').trim() || fallback);
};
