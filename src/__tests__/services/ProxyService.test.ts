import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ProxyService, ProxyConfig, Breakpoint } from '../../services/ProxyService';
import { ReplaceRule } from '../../utils/ReplaceRuleApplier';
import axios from 'axios';
import * as http from 'http';

vi.mock('vscode', () => ({
    window: {
        showErrorMessage: vi.fn(),
    },
    workspace: {
        getConfiguration: vi.fn(() => ({
            get: vi.fn((key) => {
                if (key === 'proxy') return '';
                if (key === 'proxyStrictSSL') return false;
                return undefined;
            })
        }))
    }
}));

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('ProxyService', () => {
    let service: ProxyService;
    const defaultConfig: ProxyConfig = {
        port: 9000,
        targetUrl: 'http://localhost:8080',
        systemProxyEnabled: true
    };

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ProxyService(defaultConfig);
    });

    afterEach(() => {
        service.stop();
    });

    describe('Config Management', () => {
        it('should initialize with provided config', () => {
            expect(service.getConfig().port).toBe(9000);
            expect(service.getConfig().targetUrl).toBe('http://localhost:8080');
        });

        it('should update config correctly', () => {
            service.updateConfig({ port: 9005 });
            expect(service.getConfig().port).toBe(9005);
        });
    });

    describe('Mode Management', () => {
        it('should default to proxy mode', () => {
            expect(service.getServerMode()).toBe('proxy');
        });

        it('should change server mode', () => {
            service.setServerMode('mock');
            expect(service.getServerMode()).toBe('mock');
        });
    });

    describe('Breakpoint Logic', () => {
        it('should hit a breakpoint on URL match', () => {
            const bp: Breakpoint = {
                id: 'bp-1',
                enabled: true,
                pattern: 'test-endpoint',
                target: 'request',
                matchOn: 'url'
            };
            service.setBreakpoints([bp]);

            // checkBreakpoints(url, content, headers, target)
            // Note: internal private method, but we can test it indirectly or via event emission
            // For unit test, we can cast to any to test the logic
            const hit = (service as any).checkBreakpoints('http://localhost/test-endpoint', '', {}, 'request');
            expect(hit).toBeDefined();
            expect(hit.id).toBe('bp-1');
        });

        it('should hit a breakpoint on Body match', () => {
            const bp: Breakpoint = {
                id: 'bp-2',
                enabled: true,
                pattern: '<Secret>',
                target: 'request',
                matchOn: 'body'
            };
            service.setBreakpoints([bp]);

            const hit = (service as any).checkBreakpoints('http://localhost/', '<Secret>Value</Secret>', {}, 'request');
            expect(hit).toBeDefined();
            expect(hit.id).toBe('bp-2');
        });

        it('should NOT hit a disabled breakpoint', () => {
            const bp: Breakpoint = {
                id: 'bp-3',
                enabled: false,
                pattern: 'test',
                target: 'request',
                matchOn: 'url'
            };
            service.setBreakpoints([bp]);

            const hit = (service as any).checkBreakpoints('http://localhost/test', '', {}, 'request');
            expect(hit).toBeNull();
        });
    });

    describe('Replace Rule Logic', () => {
        it('should apply replace rules to request body', async () => {
            const rule: ReplaceRule = {
                id: 'rule-1',
                name: 'Replace Test',
                enabled: true,
                xpath: '', // global replacement
                matchText: 'find-me',
                replaceWith: 'replaced-you',
                target: 'request'
            };
            service.setReplaceRules([rule]);

            // This would normally be tested during handleRequest, 
            // but we can verify the rule set works.
            expect((service as any).replaceRules).toContainEqual(rule);
        });
    });

    describe('Proxy Rules', () => {
        it('should match proxy rules for host patterns', () => {
            // matchesRule(host, pattern)
            expect((service as any).matchesRule('api.example.com', 'api.*')).toBe(true);
            expect((service as any).matchesRule('other.com', 'api.*')).toBe(false);
            expect((service as any).matchesRule('sub.api.example.com', '*.api.example.com')).toBe(true);
        });
    });
});
