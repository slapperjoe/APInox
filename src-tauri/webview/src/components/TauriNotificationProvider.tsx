/**
 * TauriNotificationProvider
 * 
 * Listens for notification events from the sidecar and displays
 * toast notifications in the UI. Used in Tauri mode only.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { isTauri } from '../utils/bridge';

export enum NotificationType {
    Error = 'error',
    Info = 'info',
    Warning = 'warning',
    Success = 'success'
}

interface Notification {
    id: string;
    type: NotificationType;
    message: string;
    duration: number;
}

interface TauriNotificationProviderProps {
    children: React.ReactNode;
}

export const TauriNotificationProvider: React.FC<TauriNotificationProviderProps> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const addNotification = useCallback((type: NotificationType, message: string, duration = 5000) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setNotifications(prev => [...prev, { id, type, message, duration }]);

        // Auto-remove after duration
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, duration);
    }, []);

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    useEffect(() => {
        if (!isTauri()) return;

        // Dynamically import Tauri event listener
        let unlisten: (() => void) | null = null;

        import('@tauri-apps/api/event').then(({ listen }) => {
            listen<{ type: NotificationType; message: string }>('notification', (event) => {
                addNotification(event.payload.type, event.payload.message);
            }).then(fn => {
                unlisten = fn;
            });
        }).catch(console.error);

        return () => {
            if (unlisten) unlisten();
        };
    }, [addNotification]);

    // Don't render toast container in VS Code mode
    if (!isTauri()) {
        return <>{children}</>;
    }

    return (
        <>
            {children}
            <div className="tauri-toast-container">
                {notifications.map(notification => (
                    <div
                        key={notification.id}
                        className={`tauri-toast tauri-toast-${notification.type}`}
                        onClick={() => removeNotification(notification.id)}
                    >
                        <span className="tauri-toast-icon">
                            {notification.type === 'error' && '❌'}
                            {notification.type === 'warning' && '⚠️'}
                            {notification.type === 'info' && 'ℹ️'}
                            {notification.type === 'success' && '✅'}
                        </span>
                        <span className="tauri-toast-message">{notification.message}</span>
                    </div>
                ))}
            </div>
        </>
    );
};

// CSS styles (add to your global CSS or styled-components)
export const tauriToastStyles = `
.tauri-toast-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 400px;
}

.tauri-toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.15));
    cursor: pointer;
    animation: slideIn 0.3s ease-out;
    font-size: 14px;
}

.tauri-toast-error {
    background: var(--vscode-inputValidation-errorBackground, #fce8e8);
    border: 1px solid var(--vscode-inputValidation-errorBorder, #f5c6c6);
    color: var(--vscode-errorForeground, #c62828);
}

.tauri-toast-warning {
    background: var(--vscode-inputValidation-warningBackground, #fff8e1);
    border: 1px solid var(--vscode-inputValidation-warningBorder, #ffe082);
    color: var(--vscode-editorWarning-foreground, #f57c00);
}

.tauri-toast-info {
    background: var(--vscode-inputValidation-infoBackground, #e3f2fd);
    border: 1px solid var(--vscode-inputValidation-infoBorder, #90caf9);
    color: var(--vscode-editorInfo-foreground, #1565c0);
}

.tauri-toast-success {
    background: var(--vscode-testing-iconPassed, #48bb78);
    background: color-mix(in srgb, var(--vscode-testing-iconPassed, #4caf50) 15%, var(--vscode-editor-background));
    border: 1px solid var(--vscode-testing-iconPassed, #4caf50);
    color: var(--vscode-testing-iconPassed, #2e7d32);
}

.tauri-toast-icon {
    font-size: 16px;
}

.tauri-toast-message {
    flex: 1;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}
`;
