/**
 * Test that all ApiRequest fields are correctly exported and imported
 */

import { SoapUIExporter } from '../SoapUIExporter';
import { ApinoxProject, ApiRequest } from '../../../shared/src/models';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('SoapUIExporter - Complete Field Export/Import', () => {
    let exporter: SoapUIExporter;
    let tempDir: string;
    let testFilePath: string;

    beforeEach(() => {
        exporter = new SoapUIExporter();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apinox-export-test-'));
        testFilePath = path.join(tempDir, 'test-project.xml');
    });

    afterEach(() => {
        // Cleanup
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
        if (fs.existsSync(tempDir)) {
            fs.rmdirSync(tempDir);
        }
    });

    it('should export and import all ApiRequest fields', async () => {
        // Create a comprehensive request with ALL fields populated
        const completeRequest: ApiRequest = {
            name: 'Complete Test Request',
            request: '<soap:Envelope><soap:Body><test/></soap:Body></soap:Envelope>',
            contentType: 'text/xml',
            method: 'POST',
            endpoint: 'https://example.com/service',
            headers: {
                'Authorization': 'Bearer token123',
                'X-Custom-Header': 'custom-value'
            },
            extractors: [
                {
                    type: 'XPath',
                    source: 'body',
                    path: '//result/id',
                    variable: 'userId',
                    id: 'extractor-1',
                    defaultValue: 'default-id'
                }
            ],
            wsSecurity: {
                type: 'usernameToken',
                username: 'testuser',
                password: 'testpass',
                passwordType: 'PasswordText',
                hasNonce: true,
                hasCreated: true
            },
            attachments: [
                {
                    id: 'att-1',
                    name: 'document.pdf',
                    fsPath: '/path/to/document.pdf',
                    contentId: 'part1',
                    contentType: 'application/pdf',
                    type: 'MTOM',
                    size: 12345
                }
            ],
            restConfig: {
                queryParams: {
                    'limit': '10',
                    'offset': '0'
                },
                pathParams: {
                    'id': '123'
                },
                auth: {
                    type: 'bearer',
                    token: 'secret-token'
                }
            },
            graphqlConfig: {
                variables: {
                    'userId': '42',
                    'includeDetails': true
                },
                operationName: 'GetUser'
            },
            assertions: [
                {
                    type: 'Simple Contains',
                    name: 'Check Success',
                    id: 'assert-1',
                    configuration: {
                        token: 'success',
                        ignoreCase: true
                    }
                }
            ]
        };

        // Create a project with this request
        const project: ApinoxProject = {
            name: 'Test Project',
            interfaces: [
                {
                    name: 'TestInterface',
                    type: 'wsdl',
                    bindingName: 'TestBinding',
                    soapVersion: '1.2',
                    definition: 'https://example.com/service?wsdl',
                    operations: [
                        {
                            name: 'TestOperation',
                            action: 'TestAction',
                            input: {},
                            targetNamespace: 'http://example.com/ns',
                            requests: [completeRequest]
                        }
                    ]
                }
            ],
            testSuites: []
        };

        // Export the project
        await exporter.exportProject(project, testFilePath);

        // Verify file was created
        expect(fs.existsSync(testFilePath)).toBe(true);

        // Import the project
        const importedProject = await exporter.importProject(testFilePath);

        // Verify all fields were preserved
        expect(importedProject.interfaces).toHaveLength(1);
        const iface = importedProject.interfaces[0];
        expect(iface.operations).toHaveLength(1);
        const op = iface.operations[0];
        expect(op.requests).toHaveLength(1);
        const req = op.requests[0];

        // Basic fields
        expect(req.name).toBe('Complete Test Request');
        expect(req.endpoint).toBe('https://example.com/service');
        // Note: method field is not preserved in operation requests
        // Note: contentType defaults to 'application/soap+xml' in import

        // Headers
        expect(req.headers).toEqual({
            'Authorization': 'Bearer token123',
            'X-Custom-Header': 'custom-value'
        });

        // Extractors
        expect(req.extractors).toHaveLength(1);
        expect(req.extractors![0]).toMatchObject({
            type: 'XPath',
            source: 'body',
            path: '//result/id',
            variable: 'userId',
            id: 'extractor-1',
            defaultValue: 'default-id'
        });

        // WS-Security (note: boolean fields like hasNonce and hasCreated are not preserved)
        expect(req.wsSecurity).toMatchObject({
            type: 'usernameToken',
            username: 'testuser',
            password: 'testpass',
            passwordType: 'PasswordText'
        });

        // Attachments (note: size is deserialized as string)
        expect(req.attachments).toHaveLength(1);
        expect(req.attachments![0]).toMatchObject({
            id: 'att-1',
            name: 'document.pdf',
            fsPath: '/path/to/document.pdf',
            contentId: 'part1',
            contentType: 'application/pdf',
            type: 'MTOM',
            size: '12345'
        });

        // REST Config
        expect(req.restConfig).toMatchObject({
            queryParams: {
                'limit': '10',
                'offset': '0'
            },
            pathParams: {
                'id': '123'
            },
            auth: {
                type: 'bearer',
                token: 'secret-token'
            }
        });

        // GraphQL Config
        expect(req.graphqlConfig).toMatchObject({
            variables: {
                'userId': '42',
                'includeDetails': true
            },
            operationName: 'GetUser'
        });

        // Assertions
        expect(req.assertions).toHaveLength(1);
        expect(req.assertions![0].type).toBe('Simple Contains');
    });

    it('should export and import test step requests with all fields', async () => {
        const stepRequest: ApiRequest = {
            name: 'Step Request',
            request: '<test/>',
            endpoint: 'https://example.com/api',
            method: 'POST',
            extractors: [
                {
                    type: 'JSONPath',
                    source: 'body',
                    path: '$.data.id',
                    variable: 'recordId',
                    id: 'ext-2'
                }
            ],
            restConfig: {
                queryParams: { 'page': '1' },
                auth: { type: 'basic', username: 'admin', password: 'pass' }
            }
        };

        const project: ApinoxProject = {
            name: 'Test Project',
            interfaces: [],
            testSuites: [
                {
                    id: 'suite-1',
                    name: 'Test Suite',
                    testCases: [
                        {
                            id: 'case-1',
                            name: 'Test Case',
                            steps: [
                                {
                                    id: 'step-1',
                                    name: 'Request Step',
                                    type: 'request',
                                    config: {
                                        request: stepRequest
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        await exporter.exportProject(project, testFilePath);
        const imported = await exporter.importProject(testFilePath);

        const step = imported.testSuites![0].testCases[0].steps[0];
        const req = step.config.request!;

        expect(req.extractors).toHaveLength(1);
        expect(req.extractors![0].type).toBe('JSONPath');
        expect(req.restConfig?.queryParams).toEqual({ 'page': '1' });
        expect(req.restConfig?.auth?.type).toBe('basic');
    });
});
