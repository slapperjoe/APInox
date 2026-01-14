/**
 * Platform-agnostic service interfaces for APInox
 * 
 * These interfaces enable the strangler pattern for migrating from
 * VS Code to other platforms (Tauri, Electron, etc.)
 */

import type { INotificationService } from './INotificationService';
import type { IDialogService } from './IDialogService';
import type { IClipboardService } from './IClipboardService';
import type { IConfigService } from './IConfigService';
import type { ISecretStorage } from './ISecretStorage';
import type { IExternalOpener } from './IExternalOpener';

// Re-export all interfaces
export { INotificationService } from './INotificationService';
export {
    IDialogService,
    OpenDialogOptions,
    SaveDialogOptions,
    QuickPickItem,
    QuickPickOptions
} from './IDialogService';
export { IClipboardService } from './IClipboardService';
export { IConfigService } from './IConfigService';
export { ISecretStorage } from './ISecretStorage';
export { IExternalOpener } from './IExternalOpener';

/**
 * Container for all platform services
 * Used for dependency injection
 */
export interface IPlatformServices {
    notifications: INotificationService;
    dialogs: IDialogService;
    clipboard: IClipboardService;
    config: IConfigService;
    secrets: ISecretStorage;
    external: IExternalOpener;
}
