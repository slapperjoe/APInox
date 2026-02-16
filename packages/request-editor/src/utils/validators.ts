/**
 * Validation utilities for request editor package
 * Provides validators for URLs, JSON, XML, XPath, and regex patterns
 */

export interface ValidationResult {
    valid: boolean;
    error?: string;
    details?: string;
}

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Validates a URL string
 * Checks for proper protocol, hostname, and format
 */
export function validateUrl(url: string): ValidationResult {
    if (!url || typeof url !== 'string') {
        return { valid: false, error: 'URL is required' };
    }

    const trimmed = url.trim();
    if (!trimmed) {
        return { valid: false, error: 'URL cannot be empty' };
    }

    // Allow variables like {{baseUrl}}/api
    if (trimmed.includes('{{') && trimmed.includes('}}')) {
        // Contains variables - do basic structure check only
        if (!trimmed.match(/^https?:\/\//i) && !trimmed.startsWith('{{')) {
            return { valid: false, error: 'URL must start with http://, https://, or a variable' };
        }
        return { valid: true };
    }

    try {
        const urlObj = new URL(trimmed);
        
        // Check protocol
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            return {
                valid: false,
                error: 'Invalid protocol',
                details: `Protocol must be http or https, got: ${urlObj.protocol}`
            };
        }

        // Check hostname
        if (!urlObj.hostname) {
            return { valid: false, error: 'Missing hostname' };
        }

        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            error: 'Invalid URL format',
            details: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// ============================================================================
// JSON Validation
// ============================================================================

/**
 * Validates JSON string
 * Returns parse error details if invalid
 */
export function validateJson(json: string): ValidationResult {
    if (!json || typeof json !== 'string') {
        return { valid: false, error: 'JSON is required' };
    }

    const trimmed = json.trim();
    if (!trimmed) {
        return { valid: false, error: 'JSON cannot be empty' };
    }

    try {
        JSON.parse(trimmed);
        return { valid: true };
    } catch (error) {
        if (error instanceof SyntaxError) {
            // Extract line/column from error message if available
            const match = error.message.match(/position (\d+)/);
            const position = match ? parseInt(match[1], 10) : undefined;
            
            return {
                valid: false,
                error: 'Invalid JSON syntax',
                details: position !== undefined 
                    ? `${error.message} at position ${position}`
                    : error.message
            };
        }
        return {
            valid: false,
            error: 'JSON parse error',
            details: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Validates and formats JSON
 * Returns formatted JSON if valid, or error
 */
export function validateAndFormatJson(json: string): { valid: boolean; formatted?: string; error?: string } {
    const validation = validateJson(json);
    if (!validation.valid) {
        return { valid: false, error: validation.error };
    }

    try {
        const parsed = JSON.parse(json.trim());
        const formatted = JSON.stringify(parsed, null, 2);
        return { valid: true, formatted };
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// ============================================================================
// XML Validation
// ============================================================================

/**
 * Validates XML string
 * Checks for well-formed XML structure
 */
export function validateXml(xml: string): ValidationResult {
    if (!xml || typeof xml !== 'string') {
        return { valid: false, error: 'XML is required' };
    }

    const trimmed = xml.trim();
    if (!trimmed) {
        return { valid: false, error: 'XML cannot be empty' };
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(trimmed, 'text/xml');

        // Check for parsing errors
        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            const errorText = parserError.textContent || 'Unknown XML parse error';
            return {
                valid: false,
                error: 'Invalid XML structure',
                details: errorText
            };
        }

        // Check if document has root element
        if (!doc.documentElement) {
            return {
                valid: false,
                error: 'No root element found',
                details: 'XML must have a root element'
            };
        }

        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            error: 'XML parse error',
            details: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Checks if XML is well-formed and returns error details
 */
export function getXmlErrors(xml: string): string[] {
    const result = validateXml(xml);
    if (result.valid) {
        return [];
    }

    const errors: string[] = [];
    if (result.error) {
        errors.push(result.error);
    }
    if (result.details) {
        errors.push(result.details);
    }
    return errors;
}

// ============================================================================
// XPath Validation
// ============================================================================

/**
 * Validates XPath expression
 * Checks syntax but not whether it matches any nodes
 */
export function validateXPath(xpath: string): ValidationResult {
    if (!xpath || typeof xpath !== 'string') {
        return { valid: false, error: 'XPath is required' };
    }

    const trimmed = xpath.trim();
    if (!trimmed) {
        return { valid: false, error: 'XPath cannot be empty' };
    }

    // Basic syntax checks
    const unmatchedBrackets = countUnmatched(trimmed, '[', ']');
    if (unmatchedBrackets !== 0) {
        return {
            valid: false,
            error: 'Unmatched brackets',
            details: `XPath has ${Math.abs(unmatchedBrackets)} unmatched ${unmatchedBrackets > 0 ? 'opening' : 'closing'} brackets`
        };
    }

    const unmatchedParens = countUnmatched(trimmed, '(', ')');
    if (unmatchedParens !== 0) {
        return {
            valid: false,
            error: 'Unmatched parentheses',
            details: `XPath has ${Math.abs(unmatchedParens)} unmatched ${unmatchedParens > 0 ? 'opening' : 'closing'} parentheses`
        };
    }

    // Try to evaluate on a dummy document
    try {
        const doc = new DOMParser().parseFromString('<root/>', 'text/xml');
        // Just test if evaluation succeeds (don't need to use result)
        doc.evaluate(trimmed, doc, null, XPathResult.ANY_TYPE, null);
        
        // If we got here, syntax is valid
        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            error: 'Invalid XPath syntax',
            details: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Tests XPath against XML and returns match result
 */
export function testXPath(xpath: string, xml: string): { valid: boolean; matches: number; error?: string } {
    // Validate XPath syntax
    const xpathValidation = validateXPath(xpath);
    if (!xpathValidation.valid) {
        return { valid: false, matches: 0, error: xpathValidation.error };
    }

    // Validate XML
    const xmlValidation = validateXml(xml);
    if (!xmlValidation.valid) {
        return { valid: false, matches: 0, error: 'Invalid XML: ' + xmlValidation.error };
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        const result = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        
        return { valid: true, matches: result.snapshotLength };
    } catch (error) {
        return {
            valid: false,
            matches: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// ============================================================================
// Regex Validation
// ============================================================================

/**
 * Validates regex pattern
 * Checks if pattern can be compiled
 */
export function validateRegex(pattern: string, flags?: string): ValidationResult {
    if (!pattern || typeof pattern !== 'string') {
        return { valid: false, error: 'Pattern is required' };
    }

    try {
        new RegExp(pattern, flags);
        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            error: 'Invalid regex pattern',
            details: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Tests regex against text and returns match details
 */
export function testRegex(
    pattern: string,
    text: string,
    flags?: string
): { valid: boolean; matches: RegExpMatchArray | null; error?: string } {
    const validation = validateRegex(pattern, flags);
    if (!validation.valid) {
        return { valid: false, matches: null, error: validation.error };
    }

    try {
        const regex = new RegExp(pattern, flags);
        const matches = text.match(regex);
        return { valid: true, matches };
    } catch (error) {
        return {
            valid: false,
            matches: null,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Validates regex and returns capture groups if valid
 */
export function getRegexGroups(pattern: string): { valid: boolean; groups: number; error?: string } {
    const validation = validateRegex(pattern);
    if (!validation.valid) {
        return { valid: false, groups: 0, error: validation.error };
    }

    try {
        const regex = new RegExp(pattern);
        // Count capture groups by testing against empty string
        const match = ''.match(regex);
        const groups = match ? match.length - 1 : 0;
        return { valid: true, groups };
    } catch (error) {
        return {
            valid: false,
            groups: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Counts unmatched opening/closing characters
 * Returns: positive = more opening, negative = more closing, 0 = balanced
 */
function countUnmatched(str: string, opening: string, closing: string): number {
    let count = 0;
    for (const char of str) {
        if (char === opening) count++;
        if (char === closing) count--;
    }
    return count;
}

/**
 * Validates email address format
 */
export function validateEmail(email: string): ValidationResult {
    if (!email || typeof email !== 'string') {
        return { valid: false, error: 'Email is required' };
    }

    const trimmed = email.trim();
    if (!trimmed) {
        return { valid: false, error: 'Email cannot be empty' };
    }

    // Simple email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
        return {
            valid: false,
            error: 'Invalid email format',
            details: 'Email must be in format: user@domain.com'
        };
    }

    return { valid: true };
}

/**
 * Validates content type header
 */
export function validateContentType(contentType: string): ValidationResult {
    if (!contentType || typeof contentType !== 'string') {
        return { valid: false, error: 'Content-Type is required' };
    }

    const trimmed = contentType.trim();
    if (!trimmed) {
        return { valid: false, error: 'Content-Type cannot be empty' };
    }

    // Basic content-type format: type/subtype
    const contentTypeRegex = /^[\w\-+.]+\/[\w\-+.]+/;
    if (!contentTypeRegex.test(trimmed)) {
        return {
            valid: false,
            error: 'Invalid Content-Type format',
            details: 'Content-Type must be in format: type/subtype (e.g., application/json)'
        };
    }

    return { valid: true };
}
