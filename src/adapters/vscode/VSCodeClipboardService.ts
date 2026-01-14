/**
 * VS Code implementation of IClipboardService
 */

import * as vscode from 'vscode';
import { IClipboardService } from '../../interfaces/IClipboardService';

export class VSCodeClipboardService implements IClipboardService {
    async readText(): Promise<string> {
        return await vscode.env.clipboard.readText();
    }

    async writeText(text: string): Promise<void> {
        await vscode.env.clipboard.writeText(text);
    }
}
