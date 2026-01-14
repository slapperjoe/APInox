/**
 * Tauri implementation of IDialogService
 * 
 * Uses @tauri-apps/plugin-dialog for native file dialogs.
 */

import { open, save } from '@tauri-apps/plugin-dialog';
import {
    IDialogService,
    OpenDialogOptions,
    SaveDialogOptions,
    QuickPickItem,
    QuickPickOptions
} from '../../interfaces/IDialogService';
import { emit, listen } from '@tauri-apps/api/event';

export class TauriDialogService implements IDialogService {
    async showOpenDialog(options: OpenDialogOptions): Promise<string[] | undefined> {
        const result = await open({
            title: options.title,
            defaultPath: options.defaultPath,
            directory: options.canSelectFolders,
            multiple: options.canSelectMany,
            filters: options.filters
                ? Object.entries(options.filters).map(([name, extensions]) => ({
                    name,
                    extensions
                }))
                : undefined
        });

        if (!result) return undefined;
        return Array.isArray(result) ? result : [result];
    }

    async showSaveDialog(options: SaveDialogOptions): Promise<string | undefined> {
        const result = await save({
            title: options.title,
            defaultPath: options.defaultPath,
            filters: options.filters
                ? Object.entries(options.filters).map(([name, extensions]) => ({
                    name,
                    extensions
                }))
                : undefined
        });

        return result ?? undefined;
    }

    async showQuickPick(
        items: QuickPickItem[],
        options?: QuickPickOptions
    ): Promise<QuickPickItem | QuickPickItem[] | undefined> {
        // Quick pick is implemented as a React component in Tauri
        // We emit an event and wait for a response
        const requestId = `quickpick-${Date.now()}`;

        return new Promise((resolve) => {
            // Listen for the response
            const unlisten = listen<QuickPickItem | QuickPickItem[] | null>(
                `quickpick_response_${requestId}`,
                (event) => {
                    unlisten.then(fn => fn()); // Clean up listener
                    resolve(event.payload ?? undefined);
                }
            );

            // Emit the request to the frontend
            emit('quickpick_request', {
                requestId,
                items,
                options
            });
        });
    }
}
