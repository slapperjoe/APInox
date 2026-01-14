/**
 * Tauri implementation of IClipboardService
 * 
 * Uses @tauri-apps/plugin-clipboard-manager for clipboard operations.
 */

import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { IClipboardService } from '../../interfaces/IClipboardService';

export class TauriClipboardService implements IClipboardService {
    async readText(): Promise<string> {
        return await readText();
    }

    async writeText(text: string): Promise<void> {
        await writeText(text);
    }
}
