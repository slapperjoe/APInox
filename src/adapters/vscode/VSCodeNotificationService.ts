/**
 * VS Code implementation of INotificationService
 */

import * as vscode from 'vscode';
import { INotificationService } from '../../interfaces/INotificationService';

export class VSCodeNotificationService implements INotificationService {
    showError(message: string): void {
        vscode.window.showErrorMessage(message);
    }

    showInfo(message: string): void {
        vscode.window.showInformationMessage(message);
    }

    async showWarning(message: string, ...actions: string[]): Promise<string | undefined> {
        return await vscode.window.showWarningMessage(message, ...actions);
    }
}
