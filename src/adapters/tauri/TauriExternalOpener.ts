/**
 * Tauri implementation of IExternalOpener
 * 
 * Uses @tauri-apps/plugin-opener for opening URLs and files.
 */

import { openUrl, openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { IExternalOpener } from '../../interfaces/IExternalOpener';

export class TauriExternalOpener implements IExternalOpener {
    async openUrl(url: string): Promise<void> {
        await openUrl(url);
    }

    async openFile(filePath: string): Promise<void> {
        await openPath(filePath);
    }

    async revealInFileExplorer(filePath: string): Promise<void> {
        await revealItemInDir(filePath);
    }
}
