export interface INotificationService {
    showInformationMessage(message: string): void;
    showWarningMessage(message: string): void;
    showErrorMessage(message: string): void;
    showError(message: string): void;
    showInfo(message: string): void;
    showWarning(message: string, ...actions: string[]): Promise<string | undefined>;
}
