/**
 * Utility for parsing XML into a tree structure suitable for collapsible tree rendering
 */

export interface XmlTreeNode {
    type: 'element' | 'text' | 'comment';
    name?: string;
    value?: string;
    attributes?: Record<string, string>;
    children?: XmlTreeNode[];
    isOptional?: boolean;
    depth: number;
}

/**
 * Parse XML string into a tree structure for rendering
 * @param xmlString The XML string to parse
 * @returns Root tree node
 */
export const parseXmlToTree = (xmlString: string): XmlTreeNode => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    
    // Check for parse errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
        console.error('XML Parse Error:', parserError.textContent);
        return {
            type: 'text',
            value: 'Invalid XML',
            depth: 0
        };
    }
    
    return convertDomNodeToTree(doc.documentElement, 0);
};

/**
 * Convert a DOM node to our tree structure recursively
 */
const convertDomNodeToTree = (node: Node, depth: number): XmlTreeNode => {
    // Handle element nodes
    if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const children: XmlTreeNode[] = [];
        
        // Extract attributes
        const attributes: Record<string, string> = {};
        for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            attributes[attr.name] = attr.value;
        }
        
        // Process child nodes
        for (let i = 0; i < node.childNodes.length; i++) {
            const child = node.childNodes[i];
            
            // Handle text nodes
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent?.trim();
                if (text) {
                    children.push({
                        type: 'text',
                        value: text,
                        depth: depth + 1
                    });
                }
            }
            // Handle comments (for <!--Optional:--> markers)
            else if (child.nodeType === Node.COMMENT_NODE) {
                const commentText = child.textContent?.trim();
                if (commentText) {
                    children.push({
                        type: 'comment',
                        value: commentText,
                        depth: depth + 1
                    });
                }
            }
            // Handle element nodes recursively
            else if (child.nodeType === Node.ELEMENT_NODE) {
                children.push(convertDomNodeToTree(child, depth + 1));
            }
        }
        
        // Detect optional elements (have <!--Optional:--> comment as sibling or child)
        const isOptional = children.some(c => 
            c.type === 'comment' && c.value?.toLowerCase().includes('optional')
        );
        
        return {
            type: 'element',
            name: element.tagName,
            attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
            children: children.length > 0 ? children : undefined,
            isOptional,
            depth
        };
    }
    
    // Fallback for other node types
    return {
        type: 'text',
        value: node.textContent || '',
        depth
    };
};

/**
 * Serialize tree back to XML string (for copy functionality)
 */
export const serializeTreeToXml = (node: XmlTreeNode, indent: string = ''): string => {
    if (node.type === 'text') {
        return node.value || '';
    }
    
    if (node.type === 'comment') {
        return `${indent}<!--${node.value}-->`;
    }
    
    if (node.type === 'element' && node.name) {
        const attrs = node.attributes 
            ? Object.entries(node.attributes)
                .map(([key, val]) => ` ${key}="${val}"`)
                .join('')
            : '';
        
        const openTag = `${indent}<${node.name}${attrs}>`;
        
        if (!node.children || node.children.length === 0) {
            return `${openTag}</${node.name}>`;
        }
        
        // Check if only text content (inline)
        const hasOnlyText = node.children.length === 1 && node.children[0].type === 'text';
        
        if (hasOnlyText) {
            return `${openTag}${node.children[0].value}</${node.name}>`;
        }
        
        // Multi-line with children
        const childIndent = indent + '   ';
        const childrenXml = node.children
            .map(child => serializeTreeToXml(child, childIndent))
            .join('\n');
        
        return `${openTag}\n${childrenXml}\n${indent}</${node.name}>`;
    }
    
    return '';
};

/**
 * Get a flattened list of all element nodes for rendering
 * @param node Root node
 * @returns Array of element nodes with their paths
 */
export const flattenTreeForDisplay = (node: XmlTreeNode): Array<{
    node: XmlTreeNode;
    path: string;
}> => {
    const result: Array<{ node: XmlTreeNode; path: string }> = [];
    
    const traverse = (current: XmlTreeNode, pathParts: string[]) => {
        const currentPath = pathParts.join('/');
        
        if (current.type === 'element') {
            result.push({ node: current, path: currentPath });
            
            // Traverse children
            if (current.children) {
                current.children
                    .filter(c => c.type === 'element')
                    .forEach(child => {
                        traverse(child, [...pathParts, child.name || '']);
                    });
            }
        }
    };
    
    traverse(node, [node.name || 'root']);
    return result;
};
