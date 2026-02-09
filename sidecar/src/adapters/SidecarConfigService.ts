/**
 * Sidecar Config Service
 * 
 * Reads configuration from environment variables
 * and a local config file.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as jsonc from 'jsonc-parser';
import { IConfigService } from '../interfaces/IConfigService';

export class SidecarConfigService implements IConfigService {
    private config: Record<string, any> = {};
    private configPath: string;

    constructor() {
        const envConfigDir = process.env.APINOX_CONFIG_DIR;
        const baseDir = envConfigDir && envConfigDir.trim().length > 0
            ? envConfigDir
            : path.join(os.homedir(), '.apinox');
        
        // Try .jsonc first (current format), fallback to .json (legacy)
        const jsoncPath = path.join(baseDir, 'config.jsonc');
        const jsonPath = path.join(baseDir, 'config.json');
        
        if (fs.existsSync(jsoncPath)) {
            this.configPath = jsoncPath;
        } else if (fs.existsSync(jsonPath)) {
            this.configPath = jsonPath;
        } else {
            this.configPath = jsoncPath; // Default to .jsonc for future writes
        }
        
        this.loadConfig();
    }

    private loadConfig(): void {
        try {
            if (fs.existsSync(this.configPath)) {
                const content = fs.readFileSync(this.configPath, 'utf-8');
                
                // Use proper JSONC parser (handles comments, trailing commas, etc.)
                const errors: jsonc.ParseError[] = [];
                this.config = jsonc.parse(content, errors);
                
                if (errors.length > 0) {
                    console.error('[SidecarConfig] JSONC parse errors:', errors);
                    throw new Error(`JSONC parse error: ${jsonc.printParseErrorCode(errors[0].error)}`);
                }
                
                console.log('[SidecarConfig] ✓ Loaded config from:', this.configPath);
                console.log('[SidecarConfig] Config keys:', Object.keys(this.config || {}).join(', '));
            } else {
                console.warn('[SidecarConfig] Config file not found:', this.configPath);
                this.config = {};
            }
        } catch (error: any) {
            console.error('[SidecarConfig] ❌ Failed to load config file:', error.message);
            console.error('[SidecarConfig] Config path:', this.configPath);
            // Set empty config as fallback
            this.config = {};
        }
    }

    /**
     * Reload configuration from disk
     * Call this after settings are saved to pick up changes
     */
    public reload(): void {
        console.log('[SidecarConfig] Reloading configuration...');
        this.loadConfig();
    }

    get<T>(section: string, key: string, defaultValue?: T): T | undefined {
        const sectionConfig = this.config[section];
        if (sectionConfig && key in sectionConfig) {
            return sectionConfig[key] as T;
        }
        return defaultValue;
    }

    getProxyUrl(): string | undefined {
        // Check config first, then environment
        const configProxy = this.get<string>('http', 'proxy');
        if (configProxy) return configProxy;

        return process.env.HTTPS_PROXY ||
            process.env.HTTP_PROXY ||
            process.env.https_proxy ||
            process.env.http_proxy;
    }

    getStrictSSL(): boolean {
        // Always reload config to get latest setting
        this.loadConfig();
        
        // Check new config location first (network.strictSSL)
        const networkSSL = this.get<boolean>('network', 'strictSSL');
        if (networkSSL !== undefined) {
            console.log(`[SidecarConfig] strictSSL = ${networkSSL} (from network.strictSSL)`);
            return networkSSL;
        }

        // Check legacy config location (http.proxyStrictSSL)
        const configSSL = this.get<boolean>('http', 'proxyStrictSSL');
        if (configSSL !== undefined) {
            console.log(`[SidecarConfig] strictSSL = ${configSSL} (from http.proxyStrictSSL)`);
            return configSSL;
        }

        // Check environment
        const envValue = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        if (envValue === '0') {
            console.log('[SidecarConfig] strictSSL = false (from NODE_TLS_REJECT_UNAUTHORIZED=0)');
            return false;
        }

        // Default to true (strict SSL validation enabled)
        console.log('[SidecarConfig] strictSSL = true (default)');
        return true;
    }

    async set(key: string, value: any): Promise<void> {
        // Not implemented for sidecar config (read-only)
        console.warn(`[SidecarConfig] set() not implemented: ${key}`);
    }

    has(key: string): boolean {
        return key in this.config;
    }
}
