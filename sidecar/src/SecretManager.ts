/**
 * SecretManager
 * 
 * Manages encrypted secrets for environment variables.
 * Wraps SidecarSecretStorage with environment-specific key formatting.
 */

import { SidecarSecretStorage } from './adapters/SidecarSecretStorage';

const SECRET_REFERENCE_PREFIX = '__SECRET__:';

export class SecretManager {
    private storage: SidecarSecretStorage;

    constructor(storage?: SidecarSecretStorage) {
        this.storage = storage || new SidecarSecretStorage();
    }

    /**
     * Create a secret reference string for config storage
     */
    public createReference(envName: string, fieldName: string): string {
        return `${SECRET_REFERENCE_PREFIX}env:${envName}:${fieldName}`;
    }

    /**
     * Check if a value is a secret reference
     */
    public isSecretReference(value: string | undefined): boolean {
        return typeof value === 'string' && value.startsWith(SECRET_REFERENCE_PREFIX);
    }

    /**
     * Extract key from secret reference
     */
    private extractKey(reference: string): string {
        return reference.substring(SECRET_REFERENCE_PREFIX.length);
    }

    /**
     * Format key for environment secret
     */
    private formatKey(envName: string, fieldName: string): string {
        return `env:${envName}:${fieldName}`;
    }

    /**
     * Store an environment secret
     */
    public async setEnvironmentSecret(envName: string, fieldName: string, value: string): Promise<void> {
        const key = this.formatKey(envName, fieldName);
        await this.storage.store(key, value);
    }

    /**
     * Retrieve an environment secret
     */
    public async getEnvironmentSecret(envName: string, fieldName: string): Promise<string | undefined> {
        const key = this.formatKey(envName, fieldName);
        return await this.storage.get(key);
    }

    /**
     * Resolve a value - if it's a secret reference, decrypt it
     */
    public async resolveValue(value: string | undefined): Promise<string | undefined> {
        if (!value || !this.isSecretReference(value)) {
            return value;
        }

        const key = this.extractKey(value);
        return await this.storage.get(key);
    }

    /**
     * Delete an environment secret
     */
    public async deleteEnvironmentSecret(envName: string, fieldName: string): Promise<void> {
        const key = this.formatKey(envName, fieldName);
        await this.storage.delete(key);
    }

    /**
     * List all secret field names for an environment
     */
    public async listEnvironmentSecrets(envName: string): Promise<string[]> {
        // This requires accessing storage internals or maintaining metadata
        // For now, we rely on _secretFields in config
        // Future: could extend SidecarSecretStorage to support key listing
        return [];
    }

    /**
     * Check if a field is marked as secret in the environment config
     */
    public isSecretField(env: any, fieldName: string): boolean {
        return Array.isArray(env._secretFields) && env._secretFields.includes(fieldName);
    }
}
