/**
 * Tauri implementation of INotificationService
 * 
 * Uses Tauri events to communicate with the React frontend,
 * which displays notifications as toast messages.
 */

import { emit } from '@tauri-apps/api/event';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { INotificationService } from '../../interfaces/INotificationService';
import { NotificationType, TauriEvent, NotificationPayload } from './types';

export class TauriNotificationService implements INotificationService {
    showError(msg: string): void {
        const payload: NotificationPayload = {
            type: NotificationType.Error,
            message: msg
        };
        emit(TauriEvent.Notification, payload);
    }

    showInfo(msg: string): void {
        const payload: NotificationPayload = {
            type: NotificationType.Info,
            message: msg
        };
        emit(TauriEvent.Notification, payload);
    }

    async showWarning(msg: string, ...actions: string[]): Promise<string | undefined> {
        if (actions.length === 0) {
            // Simple warning with OK button
            await message(msg, { title: 'Warning', kind: 'warning' });
            return undefined;
        }

        // For actions, use ask dialog (Yes/No style)
        // Tauri's ask returns boolean, so we map to first action
        const result = await ask(msg, {
            title: 'Warning',
            kind: 'warning',
            okLabel: actions[0],
            cancelLabel: actions[1] || 'Cancel'
        });

        return result ? actions[0] : (actions[1] || undefined);
    }
}
