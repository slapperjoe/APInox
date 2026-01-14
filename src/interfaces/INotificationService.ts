/**
 * INotificationService - Platform-agnostic notification service
 * 
 * Abstracts vscode.window.show*Message for cross-platform compatibility.
 */

export interface INotificationService {
    /**
     * Show an error message to the user
     */
    showError(message: string): void;

    /**
     * Show an informational message to the user
     */
    showInfo(message: string): void;

    /**
     * Show a warning message with optional action buttons
     * @param message The warning message
     * @param actions Optional action button labels
     * @returns The selected action label, or undefined if dismissed
     */
    showWarning(message: string, ...actions: string[]): Promise<string | undefined>;
}
