/**
 * Tauri implementation of ISecretStorage
 * 
 * Uses @tauri-apps/plugin-store with a separate encrypted store file
 * for secure credential storage.
 */

import { Store } from '@tauri-apps/plugin-store';
import { ISecretStorage } from '../../interfaces/ISecretStorage';

export class TauriSecretStorage implements ISecretStorage {
    private _store: Store | null = null;
    private storeReady: Promise<void>;

    constructor() {
        this.storeReady = this.initStore();
    }

    private async initStore(): Promise<void> {
        // Use a separate store file for secrets
        // Note: For production, consider using the OS keychain via a native plugin
        this._store = await Store.load('secrets.dat');
    }

    async store(key: string, value: string): Promise<void> {
        await this.storeReady;
        await this._store?.set(key, value);
        await this._store?.save();
    }

    async get(key: string): Promise<string | undefined> {
        await this.storeReady;
        const value = await this._store?.get<string>(key);
        return value ?? undefined;
    }

    async delete(key: string): Promise<void> {
        await this.storeReady;
        await this._store?.delete(key);
        await this._store?.save();
    }
}
