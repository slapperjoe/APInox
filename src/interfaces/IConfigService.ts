/**
 * IConfigService - Platform-agnostic configuration service
 * 
 * Abstracts vscode.workspace.getConfiguration for cross-platform compatibility.
 */

export interface IConfigService {
    /**
     * Get a configuration value
     * @param section The configuration section (e.g., 'http')
     * @param key The configuration key (e.g., 'proxy')
     * @param defaultValue Optional default value if not set
     */
    get<T>(section: string, key: string, defaultValue?: T): T | undefined;

    /**
     * Get the HTTP proxy URL if configured
     */
    getProxyUrl(): string | undefined;

    /**
     * Get SSL strict mode setting
     */
    getStrictSSL(): boolean;
}
