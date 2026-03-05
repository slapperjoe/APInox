import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WsdlParser } from '../WsdlParser';

// Mock the soap module so tests don't need a live network connection
vi.mock('soap', () => ({
    createClientAsync: vi.fn()
}));

import * as soap from 'soap';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal mock soap.Client for a given service/port/operation map */
function buildMockClient(
    serviceMap: Record<string, Record<string, Record<string, { input?: any; output?: any }>>>,
    targetNamespace = 'http://example.com/test',
    serviceLocations: Record<string, Record<string, string>> = {}
) {
    const services: Record<string, any> = {};
    for (const [svcName, ports] of Object.entries(serviceMap)) {
        const portDefs: Record<string, any> = {};
        for (const portName of Object.keys(ports)) {
            portDefs[portName] = {
                location: serviceLocations[svcName]?.[portName] ?? ''
            };
        }
        services[svcName] = { ports: portDefs };
    }

    return {
        describe: vi.fn(() => serviceMap),
        wsdl: {
            definitions: {
                targetNamespace,
                services,
                schemas: {},
                portTypes: {},
                messages: {}
            }
        }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WsdlParser', () => {
    let parser: WsdlParser;
    let mockOutputChannel: { appendLine: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        mockOutputChannel = { appendLine: vi.fn() };
        parser = new WsdlParser(mockOutputChannel);
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------
    describe('constructor', () => {
        it('creates a parser without an output channel', () => {
            const p = new WsdlParser();
            expect(p).toBeDefined();
            expect(p.getClient()).toBeNull();
        });

        it('creates a parser with an output channel', () => {
            expect(parser).toBeDefined();
            expect(parser.getClient()).toBeNull();
        });

        it('accepts proxy options', () => {
            const p = new WsdlParser(undefined, { proxyUrl: 'http://proxy:3128', strictSSL: false });
            expect(p).toBeDefined();
        });
    });

    // -----------------------------------------------------------------------
    // getClient
    // -----------------------------------------------------------------------
    describe('getClient', () => {
        it('returns null before any parseWsdl call', () => {
            expect(parser.getClient()).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // parseWsdl – happy paths
    // -----------------------------------------------------------------------
    describe('parseWsdl', () => {
        it('parses a simple WSDL and returns services', async () => {
            const mockClient = buildMockClient(
                { TestService: { TestPort: { GetData: { input: { param: 'string' }, output: { result: 'string' } } } } },
                'http://example.com/test',
                { TestService: { TestPort: 'http://localhost/service' } }
            );
            (soap.createClientAsync as any).mockResolvedValue(mockClient);

            const services = await parser.parseWsdl('http://example.com/test.wsdl');

            expect(services).toHaveLength(1);
            expect(services[0].name).toBe('TestService');
            expect(services[0].targetNamespace).toBe('http://example.com/test');
            expect(services[0].ports).toContain('TestPort');
            expect(services[0].operations).toHaveLength(1);
            expect(services[0].operations[0].name).toBe('GetData');
            expect(services[0].operations[0].originalEndpoint).toBe('http://localhost/service');
        });

        it('stores the soap client after successful parsing', async () => {
            const mockClient = buildMockClient({});
            (soap.createClientAsync as any).mockResolvedValue(mockClient);

            await parser.parseWsdl('http://example.com/test.wsdl');

            expect(parser.getClient()).toBe(mockClient);
        });

        it('handles a WSDL with multiple services and ports', async () => {
            const mockClient = buildMockClient({
                ServiceA: {
                    PortA1: { OpA1: { input: {}, output: {} } },
                    PortA2: { OpA2: { input: {}, output: {} } }
                },
                ServiceB: {
                    PortB1: { OpB1: { input: {}, output: {} } }
                }
            });
            (soap.createClientAsync as any).mockResolvedValue(mockClient);

            const services = await parser.parseWsdl('http://multi.example.com/test.wsdl');

            expect(services).toHaveLength(2);
            const svcA = services.find(s => s.name === 'ServiceA')!;
            expect(svcA.ports).toHaveLength(2);
        });

        it('collects all operations across ports into a flat list', async () => {
            const mockClient = buildMockClient({
                OrderService: {
                    OrderPort: {
                        CreateOrder: { input: { orderId: 'string' }, output: { status: 'string' } },
                        GetOrder: { input: { id: 'string' }, output: { order: 'object' } },
                        CancelOrder: { input: { orderId: 'string' }, output: { result: 'boolean' } }
                    }
                }
            }, 'http://orders.example.com/', { OrderService: { OrderPort: 'https://api.example.com/orders' } });

            (soap.createClientAsync as any).mockResolvedValue(mockClient);

            const services = await parser.parseWsdl('http://example.com/order.wsdl');

            expect(services[0].operations).toHaveLength(3);
            expect(services[0].operations.map(o => o.name)).toContain('CreateOrder');
            expect(services[0].operations.map(o => o.name)).toContain('CancelOrder');
            expect(services[0].operations[0].originalEndpoint).toBe('https://api.example.com/orders');
        });

        it('reads targetNamespace from the $targetNamespace property as a fallback', async () => {
            const mockClient = {
                describe: vi.fn(() => ({ Svc: { Port: { Op: {} } } })),
                wsdl: {
                    definitions: {
                        $targetNamespace: 'http://alt.namespace.com/',
                        services: { Svc: { ports: { Port: { location: '' } } } },
                        schemas: {},
                        portTypes: {},
                        messages: {}
                    }
                }
            };
            (soap.createClientAsync as any).mockResolvedValue(mockClient);

            const services = await parser.parseWsdl('http://alt.com/svc.wsdl');

            expect(services[0].targetNamespace).toBe('http://alt.namespace.com/');
        });

        it('logs parsing progress to the output channel', async () => {
            const mockClient = buildMockClient({});
            (soap.createClientAsync as any).mockResolvedValue(mockClient);

            await parser.parseWsdl('http://test.com/test.wsdl');

            expect(mockOutputChannel.appendLine).toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // parseWsdl – error handling
    // -----------------------------------------------------------------------
    describe('parseWsdl error handling', () => {
        it('re-throws errors from soap.createClientAsync', async () => {
            (soap.createClientAsync as any).mockRejectedValue(new Error('Network error'));

            await expect(parser.parseWsdl('http://invalid.com/test.wsdl')).rejects.toThrow('Network error');
        });

        it('provides a helpful error when a JSON file is passed as a WSDL URL', async () => {
            (soap.createClientAsync as any).mockRejectedValue(
                new Error('Text data outside of root node.\nLine: 0\nColumn: 1\nChar: }')
            );

            await expect(
                parser.parseWsdl('https://petstore.swagger.io/v2/swagger.json')
            ).rejects.toThrow(/JSON\/YAML file/);
        });

        it('provides a helpful error when a YAML file is passed as a WSDL URL', async () => {
            (soap.createClientAsync as any).mockRejectedValue(
                new Error('Text data outside of root node')
            );

            await expect(
                parser.parseWsdl('https://example.com/api.yaml')
            ).rejects.toThrow(/JSON\/YAML file/);
        });
    });

    // -----------------------------------------------------------------------
    // getOperationSchema
    // -----------------------------------------------------------------------
    describe('getOperationSchema', () => {
        it('returns null when no client has been initialised', () => {
            expect(parser.getOperationSchema('TestOp')).toBeNull();
        });

        it('returns null after a failed parseWsdl call', async () => {
            (soap.createClientAsync as any).mockRejectedValue(new Error('fail'));
            await expect(parser.parseWsdl('http://bad.com/')).rejects.toThrow();
            expect(parser.getOperationSchema('AnyOp')).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // Mock-server use-case: ApiService shape
    // -----------------------------------------------------------------------
    describe('ApiService shape for mock server consumers', () => {
        it('exposes endpoint, portName and targetNamespace on each operation', async () => {
            const mockClient = buildMockClient(
                { PaymentService: { PaymentPort: { ProcessPayment: { input: {}, output: {} } } } },
                'http://payments.example.com/schema',
                { PaymentService: { PaymentPort: 'https://payments.example.com/soap' } }
            );
            (soap.createClientAsync as any).mockResolvedValue(mockClient);

            const [service] = await parser.parseWsdl('http://payments.example.com/service?wsdl');
            const [op] = service.operations;

            // A mock server needs these to route and match incoming requests
            expect(op.originalEndpoint).toBe('https://payments.example.com/soap');
            expect(op.portName).toBe('PaymentPort');
            expect(op.targetNamespace).toBe('http://payments.example.com/schema');
        });
    });
});
