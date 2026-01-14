/**
 * IDialogService - Platform-agnostic file dialog service
 * 
 * Abstracts vscode.window.show*Dialog for cross-platform compatibility.
 */

export interface OpenDialogOptions {
    /** Dialog title */
    title?: string;
    /** Default path to open */
    defaultPath?: string;
    /** Button label */
    buttonLabel?: string;
    /** Allow selecting files */
    canSelectFiles?: boolean;
    /** Allow selecting directories */
    canSelectFolders?: boolean;
    /** Allow multiple selections */
    canSelectMany?: boolean;
    /** File filters (e.g., { 'XML Files': ['xml'] }) */
    filters?: Record<string, string[]>;
}

export interface SaveDialogOptions {
    /** Dialog title */
    title?: string;
    /** Default path/filename */
    defaultPath?: string;
    /** Button label */
    buttonLabel?: string;
    /** File filters */
    filters?: Record<string, string[]>;
}

export interface QuickPickItem {
    label: string;
    description?: string;
    detail?: string;
    value: string;
}

export interface QuickPickOptions {
    title?: string;
    placeholder?: string;
    canPickMany?: boolean;
}

export interface IDialogService {
    /**
     * Show an open file/folder dialog
     * @returns Array of selected file paths, or undefined if cancelled
     */
    showOpenDialog(options: OpenDialogOptions): Promise<string[] | undefined>;

    /**
     * Show a save file dialog
     * @returns The selected file path, or undefined if cancelled
     */
    showSaveDialog(options: SaveDialogOptions): Promise<string | undefined>;

    /**
     * Show a quick pick selection dialog
     * @returns The selected item(s), or undefined if cancelled
     */
    showQuickPick(items: QuickPickItem[], options?: QuickPickOptions): Promise<QuickPickItem | QuickPickItem[] | undefined>;
}
