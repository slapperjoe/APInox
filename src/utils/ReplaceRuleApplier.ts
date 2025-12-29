/**
 * ReplaceRuleApplier.ts
 * 
 * Applies replace rules to XML content for live proxy modification.
 * Uses XPath to locate elements and performs scoped text replacement.
 */

import { XMLParser, XMLBuilder } from 'fast-xml-parser';

export interface ReplaceRule {
    id: string;
    name?: string;
    xpath: string;
    matchText: string;
    replaceWith: string;
    target: 'request' | 'response' | 'both';
    isRegex?: boolean;
    enabled: boolean;
}

export class ReplaceRuleApplier {
    private static parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
        trimValues: false,
        parseTagValue: false,
        ignoreDeclaration: false,
        removeNSPrefix: false,
    });

    private static builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
        format: false,
        suppressEmptyNode: false,
    });

    /**
     * Apply all enabled rules to XML content
     */
    public static apply(xml: string, rules: ReplaceRule[], target: 'request' | 'response'): string {
        if (!xml || !rules || rules.length === 0) {
            return xml;
        }

        const applicableRules = rules.filter(r =>
            r.enabled && (r.target === target || r.target === 'both')
        );

        if (applicableRules.length === 0) {
            return xml;
        }

        let modifiedXml = xml;

        for (const rule of applicableRules) {
            try {
                modifiedXml = this.applyRule(modifiedXml, rule);
            } catch (e) {
                console.error(`[ReplaceRuleApplier] Rule ${rule.id} failed:`, e);
            }
        }

        return modifiedXml;
    }

    /**
     * Apply a single rule with XPath scoping
     */
    private static applyRule(xml: string, rule: ReplaceRule): string {
        // Parse the target element name from XPath
        const targetElement = this.getTargetElementFromXPath(rule.xpath);

        if (!targetElement) {
            // Fallback to global replacement if XPath is invalid
            return this.globalReplace(xml, rule);
        }

        // Use regex to find and replace within specific element tags
        // This approach handles namespaces gracefully
        const elementPattern = this.createElementPattern(targetElement);

        return xml.replace(elementPattern, (match) => {
            return this.replaceInContent(match, rule);
        });
    }

    /**
     * Extract target element name from XPath
     * Examples: //Customer/Name -> Name, /Envelope/Body/Response -> Response
     */
    private static getTargetElementFromXPath(xpath: string): string | null {
        if (!xpath) return null;

        // Split by / and get the last non-empty segment
        const segments = xpath.split('/').filter(s => s.length > 0);
        if (segments.length === 0) return null;

        let elementName = segments[segments.length - 1];

        // Strip namespace prefix (e.g., m:Name -> Name)
        const colonIdx = elementName.indexOf(':');
        if (colonIdx > 0) {
            elementName = elementName.substring(colonIdx + 1);
        }

        // Strip index notation (e.g., Item[1] -> Item)
        const bracketIdx = elementName.indexOf('[');
        if (bracketIdx > 0) {
            elementName = elementName.substring(0, bracketIdx);
        }

        return elementName;
    }

    /**
     * Create regex pattern to match element with optional namespace prefix
     * Matches: <Name>...</Name> or <ns:Name>...</ns:Name>
     */
    private static createElementPattern(elementName: string): RegExp {
        // Match opening tag (with optional namespace), content, and closing tag
        // Handles self-closing tags and tags with attributes
        const escaped = elementName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(
            `(<(?:[a-zA-Z0-9_-]+:)?${escaped}(?:\\s[^>]*)?>)([\\s\\S]*?)(<\\/(?:[a-zA-Z0-9_-]+:)?${escaped}>)`,
            'g'
        );
    }

    /**
     * Replace text within element content
     */
    private static replaceInContent(elementMatch: string, rule: ReplaceRule): string {
        // Parse the element match into opening tag, content, closing tag
        const match = elementMatch.match(/^(<[^>]+>)([\s\S]*)(<\/[^>]+>)$/);
        if (!match) return elementMatch;

        const [, openTag, content, closeTag] = match;

        // Apply replacement to content only
        let newContent: string;
        if (rule.isRegex) {
            try {
                const regex = new RegExp(rule.matchText, 'g');
                newContent = content.replace(regex, rule.replaceWith);
            } catch (e) {
                console.error(`[ReplaceRuleApplier] Invalid regex: ${rule.matchText}`);
                newContent = content;
            }
        } else {
            const escaped = rule.matchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escaped, 'g');
            newContent = content.replace(regex, rule.replaceWith);
        }

        return openTag + newContent + closeTag;
    }

    /**
     * Fallback global replacement (when XPath is empty or invalid)
     */
    private static globalReplace(xml: string, rule: ReplaceRule): string {
        if (rule.isRegex) {
            try {
                const regex = new RegExp(rule.matchText, 'g');
                return xml.replace(regex, rule.replaceWith);
            } catch (e) {
                console.error(`[ReplaceRuleApplier] Invalid regex: ${rule.matchText}`);
                return xml;
            }
        }

        const escaped = rule.matchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'g');
        return xml.replace(regex, rule.replaceWith);
    }
}
