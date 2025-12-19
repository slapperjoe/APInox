import * as vscode from 'vscode';
import { SoapClient } from './soapClient';
import { SoapUIProject, SoapUIRequest, SoapUIOperation, SoapUIInterface } from './models';
import { ProjectStorage } from './ProjectStorage';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "dirty-soap" is now active!');

    let disposable = vscode.commands.registerCommand('dirty-soap.openInterface', () => {
        SoapPanel.createOrShow(context.extensionUri);
    });

    context.subscriptions.push(disposable);
}

class SoapPanel {
    public static currentPanel: SoapPanel | undefined;
    public static readonly viewType = 'dirtySoap';
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _soapClient: SoapClient;
    private _projectStorage: ProjectStorage;

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (SoapPanel.currentPanel) {
            SoapPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            SoapPanel.viewType,
            'Dirty SOAP',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'webview-build')
                ]
            }
        );

        SoapPanel.currentPanel = new SoapPanel(panel, extensionUri);
    }

    public constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        const outputChannel = vscode.window.createOutputChannel('Dirty SOAP');
        this._soapClient = new SoapClient(outputChannel);
        this._projectStorage = new ProjectStorage(outputChannel);

        this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);
        this._panel.onDidDispose(() => {
            this.dispose();
            outputChannel.dispose();
        }, null, []);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'saveProject':
                        try {
                            const uri = await vscode.window.showSaveDialog({
                                filters: { 'SoapUI Project': ['xml'] },
                                saveLabel: 'Save Workspace'
                            });
                            if (uri) {
                                await this._projectStorage.saveProject(message.project, uri.fsPath);
                                vscode.window.showInformationMessage(`Workspace saved to ${uri.fsPath}`);
                            }
                        } catch (e: any) {
                            vscode.window.showErrorMessage(`Failed to save project: ${e.message}`);
                        }
                        return;
                    case 'loadProject':
                        try {
                            const uris = await vscode.window.showOpenDialog({
                                canSelectFiles: true,
                                canSelectFolders: false,
                                filters: { 'SoapUI Project': ['xml'] },
                                openLabel: 'Open Workspace'
                            });
                            if (uris && uris.length > 0) {
                                const project = await this._projectStorage.loadProject(uris[0].fsPath);
                                this._panel.webview.postMessage({
                                    command: 'projectLoaded',
                                    project,
                                    filename: path.basename(uris[0].fsPath)
                                });
                                vscode.window.showInformationMessage(`Workspace loaded from ${uris[0].fsPath}`);
                            }
                        } catch (e: any) {
                            vscode.window.showErrorMessage(`Failed to load project: ${e.message}`);
                        }
                        return;
                    case 'saveWorkspace':
                        try {
                            const uri = await vscode.window.showSaveDialog({
                                filters: { 'SoapUI Workspace': ['xml'] },
                                saveLabel: 'Save Workspace'
                            });
                            if (uri) {
                                await this._projectStorage.saveWorkspace(message.projects, uri.fsPath);
                                vscode.window.showInformationMessage(`Workspace saved to ${uri.fsPath}`);
                            }
                        } catch (e: any) {
                            vscode.window.showErrorMessage(`Failed to save workspace: ${e.message}`);
                        }
                        return;
                    case 'openWorkspace':
                        try {
                            const uris = await vscode.window.showOpenDialog({
                                canSelectFiles: true,
                                canSelectFolders: false,
                                filters: { 'SoapUI Workspace': ['xml'] },
                                openLabel: 'Open Workspace'
                            });
                            if (uris && uris.length > 0) {
                                const projects = await this._projectStorage.loadWorkspace(uris[0].fsPath);
                                this._panel.webview.postMessage({
                                    command: 'workspaceLoaded',
                                    projects: projects
                                });
                                vscode.window.showInformationMessage(`Workspace loaded from ${uris[0].fsPath}`);
                            }
                        } catch (e: any) {
                            vscode.window.showErrorMessage(`Failed to load workspace: ${e.message}`);
                        }
                        return;
                    case 'getSampleSchema':
                        const schema = this._soapClient.getOperationSchema(message.operationName);
                        this._panel?.webview.postMessage({ command: 'sampleSchema', schema, operationName: message.operationName });
                        return;
                    case 'selectLocalWsdl':
                        try {
                            const uris = await vscode.window.showOpenDialog({
                                canSelectFiles: true,
                                canSelectFolders: false,
                                filters: { 'WSDL Files': ['wsdl', 'xml'] },
                                openLabel: 'Select WSDL'
                            });
                            if (uris && uris.length > 0) {
                                this._panel.webview.postMessage({
                                    command: 'wsdlSelected',
                                    path: uris[0].fsPath
                                });
                            }
                        } catch (e: any) {
                            vscode.window.showErrorMessage(`Failed to select WSDL: ${e.message}`);
                        }
                        return;
                    case 'getLocalWsdls':
                        try {
                            const workspaceFolders = vscode.workspace.workspaceFolders;
                            this._soapClient.log('Getting local WSDLs. Workspace folders:', workspaceFolders);

                            let wsdlDir = '';
                            if (workspaceFolders) {
                                wsdlDir = path.join(workspaceFolders[0].uri.fsPath, 'wsdl_files');
                                this._soapClient.log('Using workspace directory:', wsdlDir);
                            } else {
                                wsdlDir = path.join(this._extensionUri.fsPath, 'wsdl_files');
                                this._soapClient.log('No workspace folders found. Using extension directory:', wsdlDir);
                            }

                            if (fs.existsSync(wsdlDir)) {
                                const files = fs.readdirSync(wsdlDir).filter(file => file.endsWith('.wsdl') || file.endsWith('.xml'));
                                this._soapClient.log('Files found:', files);
                                this._panel.webview.postMessage({ command: 'localWsdls', files });
                            } else {
                                this._soapClient.log('Directory does not exist:', wsdlDir);
                                this._panel.webview.postMessage({ command: 'localWsdls', files: [] });
                            }
                        } catch (error: any) {
                            console.error('Error getting local wsdls:', error);
                            this._soapClient.log('Error getting local wsdls:', error);
                            this._panel.webview.postMessage({ command: 'localWsdls', files: [] });
                        }
                        return;
                    case 'loadWsdl':
                        try {
                            let urlToLoad = message.url;
                            let localWsdlDir: string | undefined;

                            if (message.isLocal) {
                                const workspaceFolders = vscode.workspace.workspaceFolders;
                                if (workspaceFolders) {
                                    urlToLoad = path.join(workspaceFolders[0].uri.fsPath, 'wsdl_files', message.url);
                                } else {
                                    urlToLoad = path.join(this._extensionUri.fsPath, 'wsdl_files', message.url);
                                }
                                localWsdlDir = path.dirname(urlToLoad);
                            }

                            this._soapClient.log('Loading WSDL from:', urlToLoad);
                            const services = await this._soapClient.parseWsdl(urlToLoad, localWsdlDir);
                            this._panel.webview.postMessage({ command: 'wsdlParsed', services });
                        } catch (error: any) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            this._panel.webview.postMessage({ command: 'error', message: errorMessage });
                        }
                        return;
                    case 'downloadWsdl':
                        try {
                            const workspaceFolders = vscode.workspace.workspaceFolders;
                            let wsdlDir = '';
                            if (workspaceFolders) {
                                wsdlDir = path.join(workspaceFolders[0].uri.fsPath, 'wsdl_files');
                            } else {
                                wsdlDir = path.join(this._extensionUri.fsPath, 'wsdl_files');
                            }

                            if (!fs.existsSync(wsdlDir)) {
                                fs.mkdirSync(wsdlDir, { recursive: true });
                            }

                            this._soapClient.log('Starting download for:', message.url);
                            const visited = new Set<string>();
                            const downloadedFiles: string[] = [];

                            const downloadRecursive = async (url: string, destDir: string, forcedFilename?: string) => {
                                if (visited.has(url)) return;
                                visited.add(url);

                                try {
                                    this._soapClient.log(`Downloading: ${url}`);
                                    const response = await axios.get(url, { responseType: 'text' });
                                    const content = response.data;

                                    let filename: string;
                                    if (forcedFilename) {
                                        filename = forcedFilename;
                                    } else {
                                        filename = url.split('/').pop()?.split('?')[0] || 'downloaded.wsdl';
                                    }

                                    const filePath = path.join(destDir, filename);
                                    fs.writeFileSync(filePath, content);
                                    this._soapClient.log(`Saved to: ${filePath}`);

                                    const relativePath = path.relative(wsdlDir, filePath);
                                    downloadedFiles.push(relativePath || filename);

                                    const regex = /(?:schemaLocation|location)\s*=\s*["'](http[^"']+)["']/g;
                                    let match;

                                    while ((match = regex.exec(content)) !== null) {
                                        const importUrl = match[2];
                                        const importsDir = path.join(wsdlDir, 'imports');
                                        if (!fs.existsSync(importsDir)) {
                                            fs.mkdirSync(importsDir);
                                        }
                                        await downloadRecursive(importUrl, importsDir);
                                    }
                                } catch (e: any) {
                                    this._soapClient.log(`Error downloading ${url}: ${e.message}`);
                                }
                            };

                            let rootFilename = message.url.split('/').pop()?.split('?')[0] || 'service.wsdl';
                            const lastDotIndex = rootFilename.lastIndexOf('.');
                            if (lastDotIndex > 0) {
                                rootFilename = rootFilename.substring(0, lastDotIndex) + '.wsdl';
                            } else {
                                rootFilename += '.wsdl';
                            }

                            await downloadRecursive(message.url, wsdlDir, rootFilename);

                            this._soapClient.log('Download complete.');

                            if (fs.existsSync(wsdlDir)) {
                                const files = fs.readdirSync(wsdlDir).filter(file => file.endsWith('.wsdl') || file.endsWith('.xml'));
                                this._panel.webview.postMessage({ command: 'localWsdls', files });
                            }

                            this._panel.webview.postMessage({ command: 'downloadComplete', files: downloadedFiles });

                        } catch (error: any) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            this._panel.webview.postMessage({ command: 'error', message: `Download failed: ${errorMessage}` });
                        }
                        return;
                    case 'cancelRequest':
                        this._soapClient.cancelRequest();
                        return;
                    case 'executeRequest':
                        try {
                            const result = await this._soapClient.executeRequest(message.url, message.operation, message.xml);
                            this._panel.webview.postMessage({ command: 'response', result });
                        } catch (error: any) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            this._panel.webview.postMessage({ command: 'error', message: errorMessage });
                        }
                        return;
                }
            },
            null,
            []
        );
    }

    public dispose() {
        SoapPanel.currentPanel = undefined;
        this._panel.dispose();
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        const scriptPathOnDisk = vscode.Uri.joinPath(extensionUri, 'webview-build', 'assets', 'index.js');
        const stylePathOnDisk = vscode.Uri.joinPath(extensionUri, 'webview-build', 'assets', 'index.css');

        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
        const styleUri = webview.asWebviewUri(stylePathOnDisk);

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-randomNonce' ${webview.cspSource} 'unsafe-eval'; worker-src blob:; font-src ${webview.cspSource} data:;">
            <title>Dirty SOAP</title>
            <link rel="stylesheet" type="text/css" href="${styleUri}">
        </head>
        <body>
            <div id="root"></div>
            <script type="module" nonce="randomNonce" src="${scriptUri}"></script>
        </body>
        </html>`;
    }
}
