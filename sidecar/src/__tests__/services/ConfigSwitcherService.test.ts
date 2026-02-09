import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigSwitcherService } from '../../services/ConfigSwitcherService';

describe('ConfigSwitcherService', () => {
    let service: ConfigSwitcherService;
    let tempDir: string;

    beforeEach(() => {
        service = new ConfigSwitcherService();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-switcher-test-'));
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    });

    const createTestConfig = (content: string): string => {
        const filepath = path.join(tempDir, 'web.config');
        fs.writeFileSync(filepath, content);
        return filepath;
    };

    describe('inject', () => {
        it('should inject proxy URL into endpoint address', () => {
            const config = `
                <configuration>
                    <system.serviceModel>
                        <client>
                            <endpoint address="https://api.example.com/service" />
                        </client>
                    </system.serviceModel>
                </configuration>
            `;
            const filepath = createTestConfig(config);

            const result = service.inject(filepath, 'http://localhost:9000');

            expect(result.success).toBe(true);
            expect(result.originalUrl).toContain('example.com');

            const modifiedContent = fs.readFileSync(filepath, 'utf8');
            expect(modifiedContent).toContain('localhost:9000');
        });

        it('should create backup file', () => {
            const config = `<endpoint address="https://api.example.com/service" />`;
            const filepath = createTestConfig(config);

            service.inject(filepath, 'http://localhost:9000');

            expect(fs.existsSync(filepath + '.original')).toBe(true);
        });

        it('should replace multiple endpoints', () => {
            const config = `
                <endpoint address="https://api.example.com/service1" />
                <endpoint address="https://api.example.com/service2" />
            `;
            const filepath = createTestConfig(config);

            const result = service.inject(filepath, 'http://localhost:9000');

            expect(result.success).toBe(true);
            expect(result.message).toContain('2 endpoints');
        });

        it('should return error for non-existent file', () => {
            const result = service.inject('/nonexistent/path.config', 'http://localhost:9000');

            expect(result.success).toBe(false);
            expect(result.message).toContain('not found');
        });

        it('should return error if no endpoints found', () => {
            const config = `<configuration><appSettings/></configuration>`;
            const filepath = createTestConfig(config);

            const result = service.inject(filepath, 'http://localhost:9000');

            expect(result.success).toBe(false);
        });

        it('should preserve endpoint paths when injecting', () => {
            const config = `<endpoint address="https://api.example.com/v1/users" />`;
            const filepath = createTestConfig(config);

            service.inject(filepath, 'http://localhost:9000');

            const modifiedContent = fs.readFileSync(filepath, 'utf8');
            expect(modifiedContent).toContain('/v1/users');
        });
    });

    describe('restore', () => {
        it('should restore from backup file', () => {
            const originalContent = `<endpoint address="https://api.example.com/service" />`;
            const filepath = createTestConfig(originalContent);

            // First inject
            service.inject(filepath, 'http://localhost:9000');

            // Verify it was modified
            expect(fs.readFileSync(filepath, 'utf8')).toContain('localhost');

            // Now restore
            const result = service.restore(filepath);

            expect(result.success).toBe(true);
            expect(fs.readFileSync(filepath, 'utf8')).toBe(originalContent);
        });

        it('should delete backup after restore', () => {
            const config = `<endpoint address="https://api.example.com/service" />`;
            const filepath = createTestConfig(config);

            service.inject(filepath, 'http://localhost:9000');
            expect(fs.existsSync(filepath + '.original')).toBe(true);

            service.restore(filepath);

            expect(fs.existsSync(filepath + '.original')).toBe(false);
        });

        it('should return error if no backup exists', () => {
            const config = `<endpoint address="https://api.example.com/service" />`;
            const filepath = createTestConfig(config);

            // Don't inject, so no backup exists
            const result = service.restore(filepath);

            expect(result.success).toBe(false);
            expect(result.message).toContain('not found');
        });
    });

    describe('isProxied', () => {
        it('should return true when backup exists', () => {
            const config = `<endpoint address="https://api.example.com/service" />`;
            const filepath = createTestConfig(config);

            service.inject(filepath, 'http://localhost:9000');

            expect(service.isProxied(filepath)).toBe(true);
        });

        it('should return false when no backup exists', () => {
            const config = `<endpoint address="https://api.example.com/service" />`;
            const filepath = createTestConfig(config);

            expect(service.isProxied(filepath)).toBe(false);
        });
    });
});
