/**
 * @apinox/wsdl-parser
 *
 * Standalone WSDL/SOAP parsing library extracted from the APInox sidecar.
 *
 * Parses a WSDL document (remote URL or local file path) and returns a
 * structured description of all services, ports, operations and their XML
 * schemas — enough for a consumer to build a mock server, generate test
 * stubs, or display the service tree in a UI.
 *
 * @example
 * ```typescript
 * import { WsdlParser } from '@apinox/wsdl-parser';
 *
 * const parser = new WsdlParser();
 * const services = await parser.parseWsdl('http://example.com/service?wsdl');
 *
 * for (const service of services) {
 *   console.log(service.name, service.operations.map(op => op.name));
 * }
 * ```
 */

export { WsdlParser } from './WsdlParser';
export type { WsdlParserOptions } from './WsdlParser';
export type { ApiService, ServiceOperation, SchemaNode, WsdlDiff } from './types';
