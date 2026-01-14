/**
 * VS Code Platform Services Factory
 * 
 * Creates all platform service implementations for VS Code environment.
 */

import * as vscode from 'vscode';
import { IPlatformServices } from '../../interfaces';

import { VSCodeNotificationService } from './VSCodeNotificationService';
import { VSCodeDialogService } from './VSCodeDialogService';
import { VSCodeClipboardService } from './VSCodeClipboardService';
import { VSCodeConfigService } from './VSCodeConfigService';
import { VSCodeSecretStorage } from './VSCodeSecretStorage';
import { VSCodeExternalOpener } from './VSCodeExternalOpener';

// Re-export individual services for direct use
export { VSCodeNotificationService } from './VSCodeNotificationService';
export { VSCodeDialogService } from './VSCodeDialogService';
export { VSCodeClipboardService } from './VSCodeClipboardService';
export { VSCodeConfigService } from './VSCodeConfigService';
export { VSCodeSecretStorage } from './VSCodeSecretStorage';
export { VSCodeExternalOpener } from './VSCodeExternalOpener';

/**
 * Create all VS Code platform services
 * @param context The VS Code extension context (required for secrets)
 */
export function createVSCodeServices(context: vscode.ExtensionContext): IPlatformServices {
    return {
        notifications: new VSCodeNotificationService(),
        dialogs: new VSCodeDialogService(),
        clipboard: new VSCodeClipboardService(),
        config: new VSCodeConfigService(),
        secrets: new VSCodeSecretStorage(context),
        external: new VSCodeExternalOpener()
    };
}
