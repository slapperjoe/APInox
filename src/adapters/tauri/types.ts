/**
 * Notification types enum for type-safe notifications
 */
export enum NotificationType {
    Error = 'error',
    Info = 'info',
    Warning = 'warning',
    Success = 'success'
}

/**
 * Notification event payload
 */
export interface NotificationPayload {
    type: NotificationType;
    message: string;
    title?: string;
    duration?: number;
}

/**
 * Tauri event names for IPC
 */
export enum TauriEvent {
    Notification = 'notification',
    SidecarReady = 'sidecar_ready',
    SidecarError = 'sidecar_error',
    BackendCommand = 'backend_command'
}
