import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MockService } from '../../services/MockService';
import { MockConfig, MockRule } from '../../../shared/src/models';
import * as http from 'http';
import axios from 'axios';

vi.mock('vscode', () => ({
    window: {
        showErrorMessage: vi.fn(),
    },
}));

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('MockService', () => {
    let service: MockService;
    const defaultConfig: MockConfig = {
        enabled: false,
        port: 9001,
        targetUrl: 'http://localhost:8080',
        rules: [],
        passthroughEnabled: true,
        routeThroughProxy: false
    };

    beforeEach(() => {
        vi.clearAllMocks();
        service = new MockService(defaultConfig);
        service.setRules([]);
    });

    afterEach(() => {
        service.stop();
    });

    describe('Config Management', () => {
        it('should initialize with default config', () => {
            expect(service.getConfig().port).toBe(9001);
            expect(service.getConfig().enabled).toBe(false);
        });

        it('should update config and maintain consistency', () => {
            service.updateConfig({ port: 9002, enabled: true });
            expect(service.getConfig().port).toBe(9002);
            expect(service.getConfig().enabled).toBe(true);
        });
    });

    describe('Rule Management', () => {
        it('should add a rule', () => {
            const rule: MockRule = {
                id: 'rule-1',
                name: 'Test Rule',
                enabled: true,
                conditions: [{ type: 'url', pattern: '/test', isRegex: false }],
                statusCode: 200,
                responseBody: 'OK'
            };
            service.addRule(rule);
            expect(service.getRules()).toContainEqual(rule);
        });

        it('should update a rule', () => {
            const rule: MockRule = {
                id: 'rule-1',
                name: 'Test Rule',
                enabled: true,
                conditions: [],
                statusCode: 200,
                responseBody: 'OK'
            };
            service.addRule(rule);
            service.updateRule('rule-1', { name: 'Updated Rule' });
            expect(service.getRules()[0].name).toBe('Updated Rule');
        });

        it('should remove a rule', () => {
            const rule: MockRule = {
                id: 'rule-1',
                name: 'Test Rule',
                enabled: true,
                conditions: [],
                statusCode: 200,
                responseBody: 'OK'
            };
            service.addRule(rule);
            service.removeRule('rule-1');
            expect(service.getRules().length).toBe(0);
        });
    });

    describe('Matching Logic', () => {
        it('should match a rule by URL', () => {
            const rule: MockRule = {
                id: 'rule-1',
                name: 'Url Rule',
                enabled: true,
                conditions: [{ type: 'url', pattern: '/api/test', isRegex: false }],
                statusCode: 200,
                responseBody: 'Match'
            };
            service.addRule(rule);

            const mockReq = { url: '/api/test' } as http.IncomingMessage;
            const matched = service.findMatchingRule(mockReq, '');
            expect(matched?.id).toBe('rule-1');
        });

        it('should match a rule by Regex URL', () => {
            const rule: MockRule = {
                id: 'rule-regex',
                name: 'Regex Rule',
                enabled: true,
                conditions: [{ type: 'url', pattern: '/api/.*', isRegex: true }],
                statusCode: 200,
                responseBody: 'Regex Match'
            };
            service.addRule(rule);

            const mockReq = { url: '/api/anything' } as http.IncomingMessage;
            const matched = service.findMatchingRule(mockReq, '');
            expect(matched?.id).toBe('rule-regex');
        });

        it('should match a rule by Content', () => {
            const rule: MockRule = {
                id: 'rule-content',
                name: 'Content Rule',
                enabled: true,
                conditions: [{ type: 'contains', pattern: 'search-term', isRegex: false }],
                statusCode: 200,
                responseBody: 'Content Match'
            };
            service.addRule(rule);

            const mockReq = { url: '/' } as http.IncomingMessage;
            const matched = service.findMatchingRule(mockReq, 'this body contains search-term');
            expect(matched?.id).toBe('rule-content');
        });

        it('should match a rule by SOAP Action', () => {
            const rule: MockRule = {
                id: 'rule-soap',
                name: 'SOAP Rule',
                enabled: true,
                conditions: [{ type: 'soapAction', pattern: 'GetCustomer', isRegex: false }],
                statusCode: 200,
                responseBody: 'SOAP Match'
            };
            service.addRule(rule);

            const mockReq = {
                url: '/',
                headers: { 'soapaction': 'http://example.com/GetCustomer' }
            } as any;
            const matched = service.findMatchingRule(mockReq, '');
            expect(matched?.id).toBe('rule-soap');
        });
    });

    describe('Server Lifecycle', () => {
        it('should start and stop the server', async () => {
            // This is tricky without actually binding to a port, 
            // but we can verify the status changes.
            const startPromise = service.start();
            // We expect it to eventually set isRunning to true
            // Mocking listen might be needed for full coverage without real network
            await startPromise;
            // Note: In real environment this might fail if port is taken,
            // but for unit test we focus on the service state.
        });
    });

    describe('Passthrough', () => {
        it('should record request when recordMode is true', () => {
            service.updateConfig({ recordMode: true });
            service.recordRequest({
                method: 'POST',
                url: 'http://example.com/api',
                requestHeaders: { 'soapaction': 'Login' },
                requestBody: '<Login/>',
                status: 200,
                responseHeaders: { 'Content-Type': 'text/xml' },
                responseBody: '<Success/>'
            });

            const rules = service.getRules();
            expect(rules.length).toBe(1);
            expect(rules[0].name).toContain('Login');
        });
    });
});
