/**
 * SecretManager.test.ts
 * 
 * Unit tests for SecretManager
 */

import { SecretManager } from '../SecretManager';

// Mock SidecarSecretStorage
class MockSecretStorage {
    private storage = new Map<string, string>();

    async store(key: string, value: string): Promise<void> {
        this.storage.set(key, value);
    }

    async get(key: string): Promise<string | undefined> {
        return this.storage.get(key);
    }

    async delete(key: string): Promise<void> {
        this.storage.delete(key);
    }
}

describe('SecretManager', () => {
    let secretManager: SecretManager;
    let mockStorage: MockSecretStorage;

    beforeEach(() => {
        mockStorage = new MockSecretStorage();
        secretManager = new SecretManager(mockStorage as any);
    });

    describe('createReference', () => {
        it('should create a properly formatted secret reference', () => {
            const ref = secretManager.createReference('Prod', 'apiKey');
            expect(ref).toBe('__SECRET__:env:Prod:apiKey');
        });
    });

    describe('isSecretReference', () => {
        it('should return true for valid secret references', () => {
            expect(secretManager.isSecretReference('__SECRET__:env:Prod:apiKey')).toBe(true);
        });

        it('should return false for plain values', () => {
            expect(secretManager.isSecretReference('my-api-key-123')).toBe(false);
            expect(secretManager.isSecretReference('')).toBe(false);
            expect(secretManager.isSecretReference(undefined)).toBe(false);
        });
    });

    describe('setEnvironmentSecret and getEnvironmentSecret', () => {
        it('should store and retrieve secrets', async () => {
            await secretManager.setEnvironmentSecret('Prod', 'apiKey', 'secret-value-123');
            const value = await secretManager.getEnvironmentSecret('Prod', 'apiKey');
            expect(value).toBe('secret-value-123');
        });

        it('should return undefined for non-existent secrets', async () => {
            const value = await secretManager.getEnvironmentSecret('Prod', 'nonExistent');
            expect(value).toBeUndefined();
        });
    });

    describe('resolveValue', () => {
        it('should resolve secret references', async () => {
            await secretManager.setEnvironmentSecret('Prod', 'apiKey', 'my-secret-key');
            const resolved = await secretManager.resolveValue('__SECRET__:env:Prod:apiKey');
            expect(resolved).toBe('my-secret-key');
        });

        it('should return plain values unchanged', async () => {
            const resolved = await secretManager.resolveValue('plain-value');
            expect(resolved).toBe('plain-value');
        });

        it('should handle undefined values', async () => {
            const resolved = await secretManager.resolveValue(undefined);
            expect(resolved).toBeUndefined();
        });
    });

    describe('deleteEnvironmentSecret', () => {
        it('should delete secrets', async () => {
            await secretManager.setEnvironmentSecret('Prod', 'apiKey', 'secret-value');
            await secretManager.deleteEnvironmentSecret('Prod', 'apiKey');
            const value = await secretManager.getEnvironmentSecret('Prod', 'apiKey');
            expect(value).toBeUndefined();
        });
    });

    describe('isSecretField', () => {
        it('should return true if field is in _secretFields array', () => {
            const env = {
                endpoint_url: 'https://api.prod.com',
                apiKey: '__SECRET__:env:Prod:apiKey',
                _secretFields: ['apiKey']
            };
            expect(secretManager.isSecretField(env, 'apiKey')).toBe(true);
        });

        it('should return false if field is not in _secretFields array', () => {
            const env = {
                endpoint_url: 'https://api.prod.com',
                _secretFields: ['apiKey']
            };
            expect(secretManager.isSecretField(env, 'endpoint_url')).toBe(false);
        });

        it('should return false if _secretFields is not an array', () => {
            const env = {
                endpoint_url: 'https://api.prod.com',
                apiKey: 'plain-value'
            };
            expect(secretManager.isSecretField(env, 'apiKey')).toBe(false);
        });
    });
});
