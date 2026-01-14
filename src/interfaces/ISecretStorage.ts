/**
 * ISecretStorage - Platform-agnostic secure storage service
 * 
 * Abstracts vscode.ExtensionContext.secrets for cross-platform compatibility.
 */

export interface ISecretStorage {
    /**
     * Store a secret value
     * @param key The unique key for the secret
     * @param value The secret value to store
     */
    store(key: string, value: string): Promise<void>;

    /**
     * Retrieve a secret value
     * @param key The unique key for the secret
     * @returns The secret value, or undefined if not found
     */
    get(key: string): Promise<string | undefined>;

    /**
     * Delete a secret value
     * @param key The unique key for the secret
     */
    delete(key: string): Promise<void>;
}
