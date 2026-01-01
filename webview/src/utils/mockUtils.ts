import { MockRule } from '../models';

export interface MockSourceData {
    url: string;
    statusCode: number;
    responseBody: string;
    responseHeaders?: Record<string, any>;
}

export const createMockRuleFromSource = (data: MockSourceData): MockRule => {
    let name = 'Recorded Rule';
    try {
        // Extract a name from the endpoint or operation if possible
        if (data.url) {
            const urlStr = data.url.includes('://')
                ? data.url
                : `http://${data.url}`;
            const urlObj = new URL(urlStr);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            if (pathParts.length > 0) {
                name = pathParts[pathParts.length - 1];
            }
        }
    } catch (e) {
        console.warn('[mockUtils] Failed to parse URL for mock name:', e);
    }

    return {
        id: `imported-${Date.now()}`,
        name: `Mock: ${name}`,
        enabled: true,
        conditions: [
            { type: 'url', pattern: data.url || '', isRegex: false }
        ],
        statusCode: data.statusCode || 200,
        responseBody: data.responseBody || '',
        responseHeaders: (data.responseHeaders as Record<string, string>) || {},
        contentType: data.responseHeaders?.['content-type'] || 'text/xml',
        recordedFrom: data.url,
        recordedAt: Date.now(),
        hitCount: 0
    };
};
