/**
 * Tauri Platform Services Factory
 * 
 * Creates all platform service implementations for Tauri environment.
 */

import { IPlatformServices } from '../../interfaces';

import { TauriNotificationService } from './TauriNotificationService';
import { TauriDialogService } from './TauriDialogService';
import { TauriClipboardService } from './TauriClipboardService';
import { TauriConfigService } from './TauriConfigService';
import { TauriSecretStorage } from './TauriSecretStorage';
import { TauriExternalOpener } from './TauriExternalOpener';

// Re-export types
export * from './types';

// Re-export individual services for direct use
export { TauriNotificationService } from './TauriNotificationService';
export { TauriDialogService } from './TauriDialogService';
export { TauriClipboardService } from './TauriClipboardService';
export { TauriConfigService } from './TauriConfigService';
export { TauriSecretStorage } from './TauriSecretStorage';
export { TauriExternalOpener } from './TauriExternalOpener';

/**
 * Create all Tauri platform services
 */
export function createTauriServices(): IPlatformServices {
    return {
        notifications: new TauriNotificationService(),
        dialogs: new TauriDialogService(),
        clipboard: new TauriClipboardService(),
        config: new TauriConfigService(),
        secrets: new TauriSecretStorage(),
        external: new TauriExternalOpener()
    };
}
