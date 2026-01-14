/**
 * VS Code implementation of IDialogService
 */

import * as vscode from 'vscode';
import {
    IDialogService,
    OpenDialogOptions,
    SaveDialogOptions,
    QuickPickItem,
    QuickPickOptions
} from '../../interfaces/IDialogService';

export class VSCodeDialogService implements IDialogService {
    async showOpenDialog(options: OpenDialogOptions): Promise<string[] | undefined> {
        const vscodeOptions: vscode.OpenDialogOptions = {
            title: options.title,
            defaultUri: options.defaultPath ? vscode.Uri.file(options.defaultPath) : undefined,
            openLabel: options.buttonLabel,
            canSelectFiles: options.canSelectFiles ?? true,
            canSelectFolders: options.canSelectFolders ?? false,
            canSelectMany: options.canSelectMany ?? false,
            filters: options.filters
        };

        const uris = await vscode.window.showOpenDialog(vscodeOptions);
        return uris?.map(uri => uri.fsPath);
    }

    async showSaveDialog(options: SaveDialogOptions): Promise<string | undefined> {
        const vscodeOptions: vscode.SaveDialogOptions = {
            title: options.title,
            defaultUri: options.defaultPath ? vscode.Uri.file(options.defaultPath) : undefined,
            saveLabel: options.buttonLabel,
            filters: options.filters
        };

        const uri = await vscode.window.showSaveDialog(vscodeOptions);
        return uri?.fsPath;
    }

    async showQuickPick(
        items: QuickPickItem[],
        options?: QuickPickOptions
    ): Promise<QuickPickItem | QuickPickItem[] | undefined> {
        const vscodeItems: vscode.QuickPickItem[] = items.map(item => ({
            label: item.label,
            description: item.description,
            detail: item.detail
        }));

        const vscodeOptions: vscode.QuickPickOptions = {
            title: options?.title,
            placeHolder: options?.placeholder,
            canPickMany: options?.canPickMany
        };

        if (options?.canPickMany) {
            const selected = await vscode.window.showQuickPick(vscodeItems, {
                ...vscodeOptions,
                canPickMany: true
            });
            if (!selected) return undefined;

            // Map back to our QuickPickItem type
            return selected.map(sel => {
                const original = items.find(i => i.label === sel.label);
                return original!;
            });
        } else {
            const selected = await vscode.window.showQuickPick(vscodeItems, vscodeOptions);
            if (!selected) return undefined;

            // Map back to our QuickPickItem type
            return items.find(i => i.label === selected.label);
        }
    }
}
