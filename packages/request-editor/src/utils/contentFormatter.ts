import { formatXml } from './xmlFormatter';
import { EditorSettings } from '../contexts/EditorSettingsContext';

/**
 * Minify XML by removing unnecessary whitespace
 */
export function minifyXml(xml: string): string {
    if (!xml) return '';
    
    // Remove whitespace between tags but preserve content
    return xml
        .replace(/>\s+</g, '><')  // Remove whitespace between tags
        .replace(/^\s+|\s+$/g, '') // Trim start/end
        .replace(/\n/g, '');       // Remove newlines
}

/**
 * Minify JSON by removing whitespace
 */
export function minifyJson(json: string): string {
    if (!json) return '';
    
    try {
        const parsed = JSON.parse(json);
        return JSON.stringify(parsed);
    } catch (error) {
        // If parsing fails, just remove basic whitespace
        return json.replace(/\s+/g, ' ').trim();
    }
}

/**
 * Format JSON with proper indentation
 */
export function formatJson(json: string): string {
    if (!json) return '';
    
    try {
        const parsed = JSON.parse(json);
        return JSON.stringify(parsed, null, 2);
    } catch (error) {
        // Return original if parsing fails
        return json;
    }
}

/**
 * Format content based on language and settings
 */
export function formatContent(
    content: string,
    language: string,
    settings: EditorSettings,
    prettyPrint: boolean = true
): string {
    if (!content) return '';

    // If prettyPrint is false, minify
    if (!prettyPrint) {
        if (language === 'xml') {
            return minifyXml(content);
        }
        if (language === 'json') {
            return minifyJson(content);
        }
        // For other languages, just remove extra whitespace
        return content.replace(/\n\s*\n/g, '\n').trim();
    }

    // If prettyPrint is true, format according to language
    if (language === 'xml') {
        let formatted = formatXml(
            content,
            settings.alignAttributes,
            settings.inlineValues,
            settings.hideCausality
        );
        return formatted;
    }

    if (language === 'json') {
        return formatJson(content);
    }

    // For other languages (text, graphql, etc.), return as-is
    return content;
}

/**
 * Toggle between pretty print and minified
 */
export function toggleContentFormat(
    content: string,
    language: string,
    settings: EditorSettings,
    currentlyPretty: boolean
): string {
    return formatContent(content, language, settings, !currentlyPretty);
}
