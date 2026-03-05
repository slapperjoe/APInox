/**
 * WSDL/SOAP type definitions for the @apinox/wsdl-parser package.
 *
 * These types provide the data model needed to understand a parsed WSDL
 * document well enough to build a mock server, test runner, or any other
 * tool that needs to interact with a SOAP service.
 */

/**
 * Recursive XML schema node that represents a single element or complex type
 * in the WSDL's XML Schema Definition.  A tree of SchemaNodes gives a
 * consumer enough structure to generate valid XML request/response bodies.
 */
export interface SchemaNode {
    /** Element or attribute name */
    name: string;
    /** XSD type string, e.g. "xsd:string", "tns:MyComplexType" */
    type: string;
    /** Whether this node is a leaf ("simple") or contains children ("complex") */
    kind: 'complex' | 'simple';
    /** XSD minOccurs value (defaults to "1" when absent) */
    minOccurs?: string;
    /** XSD maxOccurs value (e.g. "unbounded" for arrays) */
    maxOccurs?: string;
    /** Human-readable documentation from the XSD annotation element */
    documentation?: string;
    /** Child nodes for complex types */
    children?: SchemaNode[];
    /** Allowed string values for simpleType enumerations */
    options?: string[];
    /** True when this element is inside an xs:choice group */
    isChoice?: boolean;
    /** Identifies which xs:choice group this element belongs to */
    choiceGroup?: number;
}

/**
 * Metadata for a single SOAP operation within a port.
 *
 * Contains everything a mock server needs to match an incoming SOAP request
 * to the correct operation and generate a schema-valid response.
 */
export interface ServiceOperation {
    /** Operation name as declared in the WSDL portType */
    name: string;
    /** Simplified input descriptor produced by node-soap's describe() */
    input?: any;
    /** Simplified output descriptor produced by node-soap's describe() */
    output: any;
    /** Optional human-readable description */
    description?: string;
    /** Target namespace of the WSDL (propagated to each operation for convenience) */
    targetNamespace?: string;
    /** Whether the operation is expanded in a UI tree (UI hint, ignored by parsers) */
    expanded?: boolean;
    /** Name of the WSDL port this operation belongs to */
    portName?: string;
    /**
     * The service endpoint URL extracted from the WSDL.
     * A mock server can use this as the path it should respond on.
     */
    originalEndpoint?: string;
    /**
     * Full recursive schema tree for the input message.
     * Enables consumers to generate valid XML bodies without re-parsing the WSDL.
     */
    fullSchema?: SchemaNode | null;
}

/**
 * A parsed WSDL service containing one or more ports and their operations.
 *
 * The top-level result of WsdlParser.parseWsdl() is an array of ApiService
 * objects — one per <wsdl:service> element in the document.
 */
export interface ApiService {
    /** Service name as declared in the WSDL */
    name: string;
    /** List of port names exposed by this service */
    ports: string[];
    /** All operations across every port of this service */
    operations: ServiceOperation[];
    /** Target namespace of the WSDL */
    targetNamespace?: string;
}

/**
 * Options for the WsdlParser constructor.
 */
export interface WsdlParserOptions {
    /**
     * Override proxy URL for WSDL fetching.
     * Falls back to HTTPS_PROXY / HTTP_PROXY environment variables when omitted.
     */
    proxyUrl?: string;
    /**
     * When false, TLS certificate validation is disabled.
     * Defaults to true (secure).  Only set to false for internal/air-gapped networks.
     */
    strictSSL?: boolean;
}

/**
 * Diff result comparing two versions of the same WSDL.
 * Useful for detecting breaking changes when a remote WSDL is refreshed.
 */
export interface WsdlDiff {
    projectId: string;
    interfaceId: string;
    interfaceName: string;
    newWsdlUrl: string;
    addedOperations: ServiceOperation[];
    removedOperations: ServiceOperation[];
    modifiedOperations: {
        operation: ServiceOperation;
        changes: string[];
    }[];
}
