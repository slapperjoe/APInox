/**
 * IClipboardService - Platform-agnostic clipboard service
 * 
 * Abstracts vscode.env.clipboard for cross-platform compatibility.
 */

export interface IClipboardService {
    /**
     * Read text from the clipboard
     */
    readText(): Promise<string>;

    /**
     * Write text to the clipboard
     */
    writeText(text: string): Promise<void>;
}
