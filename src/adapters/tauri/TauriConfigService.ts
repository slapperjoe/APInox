/**
 * Tauri implementation of IConfigService
 * 
 * Uses @tauri-apps/plugin-store for persistent configuration
 * and environment variables for system settings.
 */

import { Store } from '@tauri-apps/plugin-store';
import { IConfigService } from '../../interfaces/IConfigService';

export class TauriConfigService implements IConfigService {
    private _store: Store | null = null;
    private storeReady: Promise<void>;

    constructor() {
        this.storeReady = this.initStore();
    }

    private async initStore(): Promise<void> {
        this._store = await Store.load('config.json');
    }

    get<T>(section: string, key: string, defaultValue?: T): T | undefined {
        // For synchronous access, we need to cache values
        // This is a limitation - Tauri store is async but interface is sync
        // In practice, we use getProxyUrl() and getStrictSSL() which handle this
        return defaultValue;
    }

    getProxyUrl(): string | undefined {
        // Check environment variables for proxy
        // In Tauri, we can access env vars
        if (typeof process !== 'undefined' && process.env) {
            return process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.http_proxy;
        }
        return undefined;
    }

    getStrictSSL(): boolean {
        // Default to true for security
        if (typeof process !== 'undefined' && process.env) {
            const envValue = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
            if (envValue === '0') return false;
        }
        return true;
    }
}
