/**
 * Utility for extracting values from text using regular expressions
 * Used for extracting data from non-XML responses (JSON, HTML, plain text)
 */
export class RegexExtractor {
    /**
     * Extract value from text using regex pattern
     * @param text - Source text to extract from
     * @param pattern - Regex pattern (use capture groups for precise extraction)
     * @returns Extracted value or null if no match
     * 
     * @example
     * // Extract token from JSON
     * extract('{"token":"abc123"}', '"token":"([^"]+)"') // Returns: "abc123"
     * 
     * // Extract from HTML
     * extract('<title>My Page</title>', '<title>(.*?)</title>') // Returns: "My Page"
     */
    static extract(text: string, pattern: string): string | null {
        if (!text || !pattern) return null;

        try {
            const regex = new RegExp(pattern);
            const match = regex.exec(text);
            
            if (!match) return null;
            
            // If there are capture groups, use first group
            // Otherwise use full match
            return match[1] !== undefined ? match[1] : match[0];
        } catch (error) {
            console.error(`Regex extraction failed for pattern "${pattern}":`, error);
            return null;
        }
    }
    
    /**
     * Extract all matches (for multiple values)
     * @param text - Source text to extract from
     * @param pattern - Regex pattern with global flag automatically added
     * @returns Array of extracted values
     * 
     * @example
     * extractAll('<id>1</id><id>2</id>', '<id>(\\d+)</id>') // Returns: ["1", "2"]
     */
    static extractAll(text: string, pattern: string): string[] {
        if (!text || !pattern) return [];

        try {
            // Ensure global flag is present
            const flags = pattern.match(/\/([gimuy]*)$/)?.[1] || '';
            const hasGlobal = flags.includes('g');
            
            const regex = hasGlobal 
                ? new RegExp(pattern) 
                : new RegExp(pattern, 'g');
                
            const matches: string[] = [];
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                const value = match[1] !== undefined ? match[1] : match[0];
                matches.push(value);
            }
            
            return matches;
        } catch (error) {
            console.error(`Regex extraction (all) failed for pattern "${pattern}":`, error);
            return [];
        }
    }

    /**
     * Validate regex pattern syntax
     * @param pattern - Regex pattern to validate
     * @returns true if valid, false otherwise
     */
    static isValidPattern(pattern: string): boolean {
        try {
            new RegExp(pattern);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get common regex patterns for quick reference
     */
    static getCommonPatterns(): Record<string, { pattern: string; description: string; example: string }> {
        return {
            jsonField: {
                pattern: '"([^"]+)":"([^"]+)"',
                description: 'Extract value from JSON field',
                example: '{"token":"abc123"} → abc123'
            },
            email: {
                pattern: '[\\w.+-]+@[\\w-]+\\.[\\w.-]+',
                description: 'Extract email address',
                example: 'Contact: user@example.com → user@example.com'
            },
            number: {
                pattern: '\\d+',
                description: 'Extract first number',
                example: 'Price: 42.50 → 42'
            },
            decimal: {
                pattern: '\\d+\\.\\d+',
                description: 'Extract decimal number',
                example: 'Price: 42.50 → 42.50'
            },
            url: {
                pattern: 'https?://[^\\s<>"]+',
                description: 'Extract URL',
                example: 'Visit https://example.com today → https://example.com'
            },
            htmlTag: {
                pattern: '<(\\w+)>(.*?)</\\1>',
                description: 'Extract content from HTML tag',
                example: '<title>Hello</title> → Hello'
            },
            betweenMarkers: {
                pattern: 'START(.*?)END',
                description: 'Extract text between markers',
                example: 'START important END → important'
            },
            uuid: {
                pattern: '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
                description: 'Extract UUID',
                example: 'ID: 550e8400-e29b-41d4-a716-446655440000 → 550e8400-e29b-41d4-a716-446655440000'
            }
        };
    }
}
