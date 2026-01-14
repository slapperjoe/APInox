/**
 * IExternalOpener - Platform-agnostic external resource opener
 * 
 * Abstracts vscode.env.openExternal for cross-platform compatibility.
 */

export interface IExternalOpener {
    /**
     * Open a URL in the default browser
     * @param url The URL to open
     */
    openUrl(url: string): Promise<void>;

    /**
     * Open a file in the default application
     * @param filePath The absolute file path to open
     */
    openFile(filePath: string): Promise<void>;

    /**
     * Reveal a file in the system file explorer
     * @param filePath The absolute file path to reveal
     */
    revealInFileExplorer(filePath: string): Promise<void>;
}
