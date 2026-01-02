import { MockRule } from '../models';

export interface MockSourceData {
    url: string;
    statusCode: number;
    responseBody: string;
    responseHeaders?: Record<string, any>;
    requestBody?: string;  // Optional request body for SOAP operation extraction
}

/**
 * Extract SOAP operation name from request body.
 * Looks for elements ending in "Request" within the Body element.
 * E.g., <GetEmployeeDetailsRequest> -> "GetEmployeeDetailsRequest"
 */
const extractSoapOperationName = (requestBody: string): string | null => {
    if (!requestBody) return null;

    try {
        // Look for element names ending in "Request" or common SOAP patterns
        // Pattern: <ns:OperationRequest or <OperationRequest
        const operationMatch = requestBody.match(/<(?:\w+:)?(\w+Request)\b[^>]*>/i);
        if (operationMatch) {
            return operationMatch[1];
        }

        // Also look for elements that might be operations (first element after Body)
        const bodyMatch = requestBody.match(/<(?:\w+:)?Body[^>]*>\s*<(?:\w+:)?(\w+)[^>]*>/i);
        if (bodyMatch) {
            return bodyMatch[1];
        }
    } catch (e) {
        console.warn('[mockUtils] Failed to parse SOAP operation name:', e);
    }

    return null;
};

export const createMockRuleFromSource = (data: MockSourceData): MockRule => {
    let name = 'Recorded Rule';
    let operationName: string | null = null;

    // First, try to extract SOAP operation name from request body
    if (data.requestBody) {
        operationName = extractSoapOperationName(data.requestBody);
        if (operationName) {
            name = operationName;
        }
    }

    // Fallback: extract from URL path
    if (!operationName) {
        try {
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
