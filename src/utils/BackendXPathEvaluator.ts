import { XMLParser } from 'fast-xml-parser';

export class BackendXPathEvaluator {
    private static parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        removeNSPrefix: false, // Keep prefixes to match if needed, or we can strip them?
        // If we strip, we lose namespace info but gain simplicity.
        // User XPaths might have prefixes.
        // Let's keep them and do "fuzzy matching" (match ending with localName).
    });

    public static evaluate(xml: string, xpath: string): string | null {
        if (!xml || !xpath) return null;

        try {
            const jsonObj = this.parser.parse(xml);

            // Remove leading slash
            const path = xpath.startsWith('/') ? xpath.substring(1) : xpath;
            const segments = path.split('/');

            let current: any = jsonObj;

            for (const segment of segments) {
                if (!current) return null;

                // Parse Segment: TagName[Index]
                const match = segment.match(/^([^\[]+)(?:\[(\d+)\])?$/);
                if (!match) return null;

                const tagName = match[1];
                const index = match[2] ? parseInt(match[2], 10) - 1 : 0; // XPath is 1-based

                // Extract Local Name (strip prefix if present)
                const localName = tagName.includes(':') ? tagName.split(':')[1] : tagName;

                // Find key in current object that matches tagName
                let foundKey: string | undefined;

                // 1. Direct Match (Full Tag provided in XPath matches Key in JSON)
                if (current[tagName]) {
                    foundKey = tagName;
                } else {
                    const keys = Object.keys(current);
                    foundKey = keys.find(k => {
                        // 2. Local Name Match (JSON key is just localName)
                        if (k === localName) return true;
                        // 3. Namespace Match (JSON key ends with :localName)
                        if (k.endsWith(':' + localName)) return true;

                        return false;
                    });
                }

                if (!foundKey) return null;

                const val = current[foundKey];

                // If val is array, assume multiple children with same tag. Select by index.
                if (Array.isArray(val)) {
                    if (index >= 0 && index < val.length) {
                        current = val[index];
                    } else {
                        return null;
                    }
                } else {
                    // Single item. Index must be 0?
                    // Actually fast-xml-parser might merge same tags into array.
                    // If it's single, index 0 is valid.
                    if (index === 0) {
                        current = val;
                    } else {
                        return null; // Index > 0 but only one element
                    }
                }
            }

            // After traversing, 'current' should be the value.
            // If it is an object/text/cdata?
            if (typeof current === 'object' && current !== null) {
                // If it has #text?
                if ('#text' in current) return String(current['#text']);
                // If strictly object, implies we selected an element, not text?
                // But usually we want the text content.
                // fast-xml-parser usually puts text in #text if attributes exist.
                // If no attributes, it might be the value itself.
                return null; // Needed specific text node?
            }

            return String(current);

        } catch (e) {
            console.error('BackendXPathEvaluator error:', e);
            return null;
        }
    }
}
