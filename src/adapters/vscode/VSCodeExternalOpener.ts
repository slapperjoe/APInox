/**
 * VS Code implementation of IExternalOpener
 */

import * as vscode from 'vscode';
import { IExternalOpener } from '../../interfaces/IExternalOpener';

export class VSCodeExternalOpener implements IExternalOpener {
    async openUrl(url: string): Promise<void> {
        await vscode.env.openExternal(vscode.Uri.parse(url));
    }

    async openFile(filePath: string): Promise<void> {
        await vscode.env.openExternal(vscode.Uri.file(filePath));
    }

    async revealInFileExplorer(filePath: string): Promise<void> {
        // VS Code doesn't have a direct "reveal in file explorer" API,
        // but opening the folder comes close
        const uri = vscode.Uri.file(filePath);
        await vscode.commands.executeCommand('revealFileInOS', uri);
    }
}
