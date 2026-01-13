
import { ICommand } from './ICommand';

// import { ProjectStorage } from '../ProjectStorage'; // Removed
import { FolderProjectStorage } from '../FolderProjectStorage';
import { SoapUIProject } from '../../shared/src/models';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class SaveProjectCommand implements ICommand {
    constructor(
        private readonly _panel: vscode.WebviewPanel,
        private readonly _folderStorage: FolderProjectStorage,
        // private readonly _projectStorage: ProjectStorage, // Removed
        private readonly _loadedProjects: Map<string, SoapUIProject>
    ) { }

    async execute(message: any): Promise<void> {
        try {
            const fileName = message.project.fileName;

            // 1. Existing file/folder?
            if (fileName && fs.existsSync(fileName)) {
                const stats = fs.statSync(fileName);
                if (stats.isDirectory()) {
                    await this._folderStorage.saveProject(message.project, fileName);

                    // Update cache & Notify
                    // Deduplicate: Remove any existing entries with same path (case-insensitive) to prevent stale duplicates
                    for (const key of this._loadedProjects.keys()) {
                        if (key.toLowerCase() === fileName.toLowerCase()) {
                            this._loadedProjects.delete(key);
                        }
                    }
                    this._loadedProjects.set(fileName, message.project);
                    vscode.window.setStatusBarMessage(`Project saved to ${fileName}`, 2000);
                    this._panel.webview.postMessage({ command: 'projectSaved', projectName: message.project.name, fileName: fileName });
                    return;
                } else {
                    // Refactored: We no longer save to XML files here.
                    // If LoadProjectCommand is working correctly, fileName should be empty for XML projects,
                    // so we shouldn't reach here unless there's a file with that name that ISN'T a directory?
                    // Or if it's a legacy state. 
                    vscode.window.showWarningMessage("This project is backed by a legacy XML file. Please use 'Save As' to migrate to the new Folder format.");
                    return;
                }
            }

            // 2. New Save - Always Folder
            const uris = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Save Project Here'
            });

            if (uris && uris.length > 0) {
                const parentDir = uris[0].fsPath;
                const safeName = message.project.name.replace(/[^a-z0-9\-_]/gi, '_');
                const projectDir = path.join(parentDir, safeName);

                if (fs.existsSync(projectDir)) {
                    const overwrite = await vscode.window.showWarningMessage(
                        `Folder '${safeName}' already exists. Overwrite?`, 'Yes', 'No'
                    );
                    if (overwrite !== 'Yes') return;
                }

                const savedProject = { ...message.project, fileName: projectDir };
                await this._folderStorage.saveProject(savedProject, projectDir);

                this._loadedProjects.set(projectDir, savedProject);
                vscode.window.showInformationMessage(`Project saved to ${projectDir}`);
                this._panel.webview.postMessage({ command: 'projectSaved', projectName: savedProject.name, fileName: projectDir });
            }

        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to save project: ${e.message}`);
        }
    }
}
