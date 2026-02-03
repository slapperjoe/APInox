/**
 * Sidecar Notification Service
 * 
 * In the sidecar, notifications are logged to console
 * and can be forwarded to the frontend via events.
 */

import { INotificationService } from '../interfaces/INotificationService';

export class SidecarNotificationService implements INotificationService {
    private listeners: ((type: string, message: string) => void)[] = [];

    showInformationMessage(message: string): void {
        this.showInfo(message);
    }

    showWarningMessage(message: string): void {
        console.warn(`[WARN] ${message}`);
        this.emit('warning', message);
    }

    showErrorMessage(message: string): void {
        this.showError(message);
    }

    showError(message: string): void {
        console.error(`[ERROR] ${message}`);
        this.emit('error', message);
    }

    showInfo(message: string): void {
        console.log(`[INFO] ${message}`);
        this.emit('info', message);
    }

    async showWarning(message: string, ...actions: string[]): Promise<string | undefined> {
        console.warn(`[WARN] ${message}`);
        this.emit('warning', message);
        // In sidecar, we can't show interactive dialogs
        // Return first action as default
        return actions[0];
    }

    /**
     * Subscribe to notification events
     */
    onNotification(callback: (type: string, message: string) => void): void {
        this.listeners.push(callback);
    }

    private emit(type: string, message: string): void {
        this.listeners.forEach(cb => cb(type, message));
    }
}
