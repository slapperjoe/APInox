import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import { SoapClient } from '../soapClient';
import { ProjectStorage } from '../ProjectStorage';
import { SettingsManager } from '../utils/SettingsManager';
import { WildcardProcessor } from '../utils/WildcardProcessor';
import { AssertionRunner } from '../utils/AssertionRunner';

import { FileWatcherService } from '../services/FileWatcherService';
import { ProxyService } from '../services/ProxyService';
import { ConfigSwitcherService } from '../services/ConfigSwitcherService';
import { TestRunnerService } from '../services/TestRunnerService';
import { SoapUIProject, SoapTestSuite, SoapTestCase } from '../models';
import { FolderProjectStorage } from '../FolderProjectStorage';

export class WebviewController {
    private _loadedProjects: Map<string, SoapUIProject> = new Map();

    constructor(
        private readonly _panel: vscode.WebviewPanel,
        private readonly _extensionUri: vscode.Uri,
        private readonly _soapClient: SoapClient,
        private readonly _folderStorage: FolderProjectStorage,
        private _projectStorage: ProjectStorage,
        private _settingsManager: SettingsManager,
        private readonly _wildcardProcessor: WildcardProcessor,
        private readonly _fileWatcherService: FileWatcherService,
        private readonly _proxyService: ProxyService,
        private readonly _configSwitcherService: ConfigSwitcherService,
        private readonly _testRunnerService: TestRunnerService
    ) {
        // Setup Update Callback
        this._fileWatcherService.setCallback((history) => {
            this._panel.webview.postMessage({ command: 'watcherUpdate', history });
        });

        // Proxy Callbacks
        this._proxyService.on('log', (event) => {
            this._panel.webview.postMessage({ command: 'proxyLog', event });
        });
        this._proxyService.on('status', (running) => {
            this._panel.webview.postMessage({ command: 'proxyStatus', running });
        });

        // Test Runner Callback
        this._testRunnerService.setCallback((data) => {
            this._panel.webview.postMessage({ command: 'testRunnerUpdate', data });
        });
    }

    public async handleMessage(message: any) {
        if (message.command === 'executeRequest') {
            console.log('[WebviewController] Received executeRequest message', message.url, message.operation);
        }

        switch (message.command) {
            case 'saveProject':
                await this.handleSaveProject(message);
                break;
            case 'log':
                this._soapClient.log('[Webview] ' + message.message);
                break;
            case 'loadProject':
                await this.handleLoadProject(message.path);
                break;
            case 'saveOpenProjects':
                this._settingsManager.updateOpenProjects(message.paths);
                break;
            case 'saveWorkspace':
                await this.handleSaveWorkspace(message);
                break;
            case 'openWorkspace':
                await this.handleOpenWorkspace();
                break;
            case 'getSampleSchema':
                this.handleGetSampleSchema(message);
                break;
            case 'selectLocalWsdl':
                await this.handleSelectLocalWsdl();
                break;
            case 'getLocalWsdls':
                this.handleGetLocalWsdls();
                break;
            case 'loadWsdl':
                await this.handleLoadWsdl(message);
                break;
            case 'downloadWsdl':
                await this.handleDownloadWsdl(message);
                break;
            case 'cancelRequest':
                this._soapClient.cancelRequest();
                break;
            case 'executeRequest':
                await this.handleExecuteRequest(message);
                break;
            case 'saveSettings':
                this.handleSaveSettings(message);
                break;
            case 'saveUiState':
                this._settingsManager.updateUiState(message.ui);
                break;
            case 'updateActiveEnvironment':
                this._settingsManager.updateActiveEnvironment(message.envName);
                this.sendSettingsToWebview();
                break;
            case 'autoSaveWorkspace':
                this._settingsManager.saveAutosave(message.content);
                break;
            case 'getSettings':
                this.sendSettingsToWebview();
                break;
            case 'startWatcher':
                this._fileWatcherService.start();
                break;
            case 'stopWatcher':
                this._fileWatcherService.stop();
                break;
            case 'getAutosave':
                this.handleGetAutosave();
                break;
            case 'getWatcherHistory':
                this._panel.webview.postMessage({ command: 'watcherUpdate', history: this._fileWatcherService.getHistory() });
                break;
            case 'clearWatcherHistory':
                this._fileWatcherService.clearHistory();
                break;
            case 'startProxy':
                this._proxyService.start();
                break;
            case 'stopProxy':
                this._proxyService.stop();
                break;
            case 'saveProxyHistory':
                await this.handleSaveProxyHistory(message);
                break;
            case 'updateProxyConfig':
                console.log('[WebviewController] Received updateProxyConfig:', message.config);
                // Map frontend 'target' to backend 'targetUrl'
                const proxyConfig = {
                    port: message.config.port,
                    targetUrl: message.config.target || message.config.targetUrl,
                    systemProxyEnabled: message.config.systemProxyEnabled
                };

                this._proxyService.updateConfig(proxyConfig);
                if (proxyConfig.targetUrl) {
                    this._settingsManager.updateLastProxyTarget(proxyConfig.targetUrl);
                }
                break;
            case 'selectConfigFile':
                const uris = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    filters: { 'Config Files': ['config', 'xml'] },
                    openLabel: 'Select Config File'
                });
                if (uris && uris.length > 0) {
                    const selectedPath = uris[0].fsPath;
                    this._settingsManager.updateLastConfigPath(selectedPath);
                    this._panel.webview.postMessage({ command: 'configFileSelected', path: selectedPath });
                }
                break;
            case 'injectProxy':
                const injectResult = this._configSwitcherService.inject(message.path, message.proxyUrl);
                if (injectResult.success) {
                    vscode.window.showInformationMessage(injectResult.message);
                    // If we found an original URL, tell the UI to update the target
                    if (injectResult.originalUrl) {
                        this._panel.webview.postMessage({
                            command: 'updateProxyTarget',
                            target: injectResult.originalUrl
                        });
                    }
                } else {
                    vscode.window.showErrorMessage(injectResult.message);
                }
                this._panel.webview.postMessage({ command: 'configSwitched', success: injectResult.success });
                break;
            case 'restoreProxy':
                const restoreResult = this._configSwitcherService.restore(message.path);
                if (restoreResult.success) {
                    vscode.window.showInformationMessage(restoreResult.message);
                } else {
                    vscode.window.showErrorMessage(restoreResult.message);
                }
                this._panel.webview.postMessage({ command: 'configRestored', success: restoreResult.success });
                break;
            case 'openCertificate':
                this.handleOpenCertificate();
                break;
            case 'runTestSuite':
                await this.handleRunTestSuite(message.suiteId);
                break;
            case 'runTestCase':
                await this.handleRunTestCase(message.caseId, message.fallbackEndpoint, message.testCase);
                break;
            case 'injectProxy':
                // Force generation if not running or missing
                let certPath = this._proxyService.getCertPath();
                this._soapClient.log('[WebviewController] Initial cert path: ' + certPath);

                if (!certPath || !fs.existsSync(certPath)) {
                    try {
                        this._soapClient.log('[WebviewController] Cert missing. Forcing generation...');
                        await this._proxyService.prepareCert();
                        certPath = this._proxyService.getCertPath();
                    } catch (e: any) {
                        this._soapClient.log('Failed to generate certificate: ' + e.message);
                        vscode.window.showErrorMessage('Failed to generate certificate: ' + e.message);
                        return;
                    }
                }

                this._soapClient.log('[WebviewController] Opening certificate at: ' + certPath);

                if (certPath) {
                    if (!fs.existsSync(certPath)) {
                        this._soapClient.log('[WebviewController] Certificate file still not found at path: ' + certPath);
                        vscode.window.showErrorMessage(`Certificate file missing at: ${certPath}`);
                        return;
                    }

                    try {
                        const uri = vscode.Uri.file(certPath);
                        this._soapClient.log('[WebviewController] Opening URI: ' + uri.toString());
                        await vscode.env.openExternal(uri);
                        vscode.window.showInformationMessage(
                            "Certificate opened. To trust this proxy, install it to 'Trusted Root Certification Authorities' in the Windows Certificate Import Wizard."
                        );
                    } catch (err: any) {
                        this._soapClient.log('[WebviewController] Failed to open cert: ' + err);
                        vscode.window.showErrorMessage('Failed to open certificate: ' + err.message);
                    }
                } else {
                    this._soapClient.log('No cert path available even after generation attempt.');
                }
                break;
            case 'pickOperationForTestCase':
                await this.handlePickOperationForTestCase(message.caseId);
                break;
        }
    }

    private handleGetAutosave() {
        const content = this._settingsManager.getAutosave();
        if (content) {
            this._panel.webview.postMessage({ command: 'restoreAutosave', content });
        }
    }

    private async handleSaveProject(message: any) {
        try {
            let fileName = message.project.fileName;

            // 1. Existing file/folder?
            if (fileName && fs.existsSync(fileName)) {
                const stats = fs.statSync(fileName);
                if (stats.isDirectory()) {
                    await this._folderStorage.saveProject(message.project, fileName);
                } else {
                    await this._projectStorage.saveProject(message.project, fileName);
                }

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
            }

            // 2. New Save - Ask for Format
            const saveType = await vscode.window.showQuickPick(
                [
                    { label: 'Save as Folder Project (Recommended)', detail: 'New folder-based format. Git-friendly.', picked: true, id: 'folder' },
                    { label: 'Save as Legacy SoapUI XML', detail: 'Single .xml file compatible with SoapUI 5.x', id: 'xml' }
                ],
                { placeHolder: 'Select Project Format' }
            );

            if (!saveType) return; // User cancelled

            if (saveType.id === 'folder') {
                const uris = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Save Project Here'
                });

                if (uris && uris.length > 0) {
                    // Create a subfolder for the project?
                    // Or use the selected folder?
                    // Usually "Save Project Here" implies "Create folder inside this".
                    // OR "Select Empty Folder".
                    // Let's assume we create a folder named after the project inside the selection.

                    // Asking user for folder name is hard with just showOpenDialog.
                    // We can use InputBox to ask for "Project Folder Name" first?
                    // Or just assume project name.
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

            } else {
                // Legacy XML
                const uri = await vscode.window.showSaveDialog({
                    filters: { 'SoapUI Project': ['xml'] },
                    saveLabel: 'Save Project XML'
                });
                if (uri) {
                    const savedProject = { ...message.project, fileName: uri.fsPath };
                    await this._projectStorage.saveProject(savedProject, uri.fsPath);
                    // Update cache
                    this._loadedProjects.set(uri.fsPath, savedProject);
                    vscode.window.showInformationMessage(`Project saved to ${uri.fsPath}`);
                    this._panel.webview.postMessage({ command: 'projectSaved', projectName: savedProject.name, fileName: uri.fsPath });
                }
            }
        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to save project: ${e.message}`);
        }
    }

    private async handleLoadProject(filePath?: string) {
        try {
            let targetPath = filePath;

            if (!targetPath) {
                const uris = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: true, // Allow both!
                    filters: { 'SoapUI Project': ['xml', 'json'] },
                    openLabel: 'Open Project'
                });
                if (uris && uris.length > 0) {
                    targetPath = uris[0].fsPath;
                }
            }

            if (targetPath) {
                let project: SoapUIProject;
                let filename: string = targetPath;

                // Check if directory or file
                const stats = fs.statSync(targetPath);

                if (stats.isDirectory()) {
                    // Check if valid Dirty Project
                    if (!fs.existsSync(path.join(targetPath, 'properties.json'))) {
                        throw new Error("Selected folder is not a valid DirtySoap project (missing properties.json).");
                    }
                    project = await this._folderStorage.loadProject(targetPath);
                } else {
                    // Assume XML
                    project = await this._projectStorage.loadProject(targetPath);
                }

                this._loadedProjects.set(targetPath, project);
                this._panel.webview.postMessage({
                    command: 'projectLoaded',
                    project,
                    filename: targetPath // Send full path (dir or file)
                });
                vscode.window.showInformationMessage(`Project loaded from ${targetPath}`);
            }
        } catch (e: any) {
            this._soapClient.log(`Error loading project: ${e.message}`);
            if (e.stack) this._soapClient.log(e.stack);
            vscode.window.showErrorMessage(`Failed to load project: ${e.message}`);
        }
    }

    private async handleSaveWorkspace(message: any) {
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
    }

    private async handleSaveProxyHistory(message: any) {
        try {
            const defaultName = `proxy-report-${new Date().toISOString().slice(0, 10)}.md`;
            const uri = await vscode.window.showSaveDialog({
                filters: { 'Markdown Report': ['md'], 'Text File': ['txt'] },
                saveLabel: 'Save Proxy Report',
                defaultUri: vscode.Uri.file(defaultName)
            });
            if (uri) {
                fs.writeFileSync(uri.fsPath, message.content);
                vscode.window.showInformationMessage(`Report saved to ${uri.fsPath}`);
            }
        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to save report: ${e.message}`);
        }
    }

    private async handleOpenWorkspace() {
        try {
            const uris = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                filters: { 'SoapUI Workspace': ['xml'] },
                openLabel: 'Open Workspace'
            });
            if (uris && uris.length > 0) {
                const projects = await this._projectStorage.loadWorkspace(uris[0].fsPath);
                // We need to associate projects with their paths? 
                // loadWorkspace returns array of projects, but doesn't necessarily set fileName on them if not saved?
                // ProjectStorage.loadWorkspace likely sets fileName if loaded from disk.
                projects.forEach(p => {
                    if (p.fileName) this._loadedProjects.set(p.fileName, p);
                });

                this._panel.webview.postMessage({
                    command: 'workspaceLoaded',
                    projects: projects
                });
                vscode.window.showInformationMessage(`Workspace loaded from ${uris[0].fsPath}`);
            }
        } catch (e: any) {
            this._soapClient.log(`Error loading workspace: ${e.message}`);
            if (e.stack) this._soapClient.log(e.stack);
            vscode.window.showErrorMessage(`Failed to load workspace: ${e.message}`);
        }
    }

    private handleGetSampleSchema(message: any) {
        const schema = this._soapClient.getOperationSchema(message.operationName);
        this._panel?.webview.postMessage({ command: 'sampleSchema', schema, operationName: message.operationName });
    }

    private async handleSelectLocalWsdl() {
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
    }

    private handleGetLocalWsdls() {
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
    }

    private async handleLoadWsdl(message: any) {
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
    }

    private async handleDownloadWsdl(message: any) {
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
    }

    private async handleExecuteRequest(message: any) {
        try {
            const config = this._settingsManager.getConfig();
            const activeEnvName = config.activeEnvironment || 'Build';
            const activeEnv = config.environments ? config.environments[activeEnvName] : {};

            const envVars = activeEnv as Record<string, string>;
            const globals = config.globals as Record<string, string> || {};
            const scriptsDir = this._settingsManager.scriptsDir;

            const contextVars = message.contextVariables || {};
            const processedUrl = WildcardProcessor.process(message.url, envVars, globals, scriptsDir, contextVars);
            const processedXml = WildcardProcessor.process(message.xml, envVars, globals, scriptsDir, contextVars);

            this._soapClient.log('--- Executing Request ---');
            this._soapClient.log('Original URL:', message.url);
            this._soapClient.log('Substituted URL:', processedUrl);
            this._soapClient.log('Substituted Payload:', processedXml);
            this._soapClient.log('-----------------------');

            // Process Headers
            let headers = message.headers || {};
            // Apply wildcards to headers
            if (headers) {
                const processedHeaders: Record<string, string> = {};
                for (const key in headers) {
                    if (headers.hasOwnProperty(key)) {
                        processedHeaders[key] = WildcardProcessor.process(headers[key], envVars, globals, scriptsDir, contextVars);
                    }
                }
                headers = processedHeaders;
            }

            // Merge Content-Type
            if (message.contentType) {
                headers['Content-Type'] = message.contentType;
            }
            // If empty, set to undefined to avoid polluting if not needed, 
            // though SoapClient handles it. 
            // Better to keep it as object if keys exist.
            if (Object.keys(headers).length === 0) headers = undefined;

            const startTime = Date.now();
            const result = await this._soapClient.executeRequest(processedUrl, message.operation, processedXml, headers);
            const timeTaken = Date.now() - startTime;

            // Run Assertions
            let assertionResults: any[] = [];
            if (message.assertions && Array.isArray(message.assertions)) {
                assertionResults = AssertionRunner.run(typeof result === 'string' ? result : JSON.stringify(result), timeTaken, message.assertions);
                if (assertionResults.length > 0) {
                    this._soapClient.log(`Assertion Results:`);
                    assertionResults.forEach(r => {
                        this._soapClient.log(`  [${r.status}] ${r.name}: ${r.message || ''}`);
                    });
                }
            }

            this._panel.webview.postMessage({ command: 'response', result, assertionResults, timeTaken });
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this._soapClient.log(`Request Execution Error: ${errorMessage}`);
            if (error.stack) this._soapClient.log(error.stack);
            this._panel.webview.postMessage({ command: 'error', message: errorMessage });
        }
    }

    private handleSaveSettings(message: any) {
        if (message.raw) {
            this._settingsManager.saveRawConfig(message.content);
        }
        this.sendSettingsToWebview();
    }

    public sendSettingsToWebview() {
        if (this._panel) {
            const config = this._settingsManager.getConfig();
            const raw = this._settingsManager.getRawConfig();
            this.sendChangelogToWebview(); // Piggyback changelog
            this._panel.webview.postMessage({ command: 'settingsUpdate', config, raw });
        }
    }

    private findTestSuite(suiteId: string): { suite: SoapTestSuite, project: SoapUIProject } | undefined {
        for (const project of this._loadedProjects.values()) {
            if (project.testSuites) {
                const suite = project.testSuites.find(s => s.id === suiteId);
                if (suite) return { suite, project };
            }
        }
        return undefined;
    }

    private findTestCase(caseId: string): { testCase: SoapTestCase, project: SoapUIProject } | undefined {
        for (const project of this._loadedProjects.values()) {
            if (project.testSuites) {
                for (const suite of project.testSuites) {
                    const testCase = suite.testCases?.find(c => c.id === caseId);
                    if (testCase) return { testCase, project };
                }
            }
        }
        return undefined;
    }

    private async handleRunTestSuite(suiteId: string) {
        const found = this.findTestSuite(suiteId);
        if (!found) {
            vscode.window.showErrorMessage(`Test Suite not found: ${suiteId}`);
            return;
        }

        console.log(`[WebviewController] Run Suite: ${found.suite.name}`);
        // TODO: Implement runTestSuite in TestRunnerService
        // await this._testRunnerService.runTestSuite(found.suite); 
        // For now iterate cases manually?
        if (found.suite.testCases && found.suite.testCases.length > 0) {
            for (const testCase of found.suite.testCases) {
                await this._testRunnerService.runTestCase(testCase);
            }
        } else {
            vscode.window.showInformationMessage(`Test Suite ${found.suite.name} has no test cases.`);
        }
    }

    private async handleRunTestCase(caseId: string, fallbackEndpoint?: string, testCase?: SoapTestCase) {
        let tcToRun = testCase;
        if (!tcToRun) {
            const found = this.findTestCase(caseId);
            if (!found) {
                vscode.window.showErrorMessage(`Test Case not found: ${caseId}`);
                return;
            }
            tcToRun = found.testCase;
        }

        console.log(`[WebviewController] Run Case: ${tcToRun.name} (fallback: ${fallbackEndpoint})`);
        await this._testRunnerService.runTestCase(tcToRun, fallbackEndpoint);
    }

    private async handleOpenCertificate() {
        // I need to MOVE the logic from the switch to here.

        // Force generation if not running or missing
        let certPath = this._proxyService.getCertPath();
        this._soapClient.log('[WebviewController] Initial cert path: ' + certPath);

        if (!certPath || !fs.existsSync(certPath)) {
            try {
                this._soapClient.log('[WebviewController] Cert missing. Forcing generation...');
                await this._proxyService.prepareCert();
                certPath = this._proxyService.getCertPath();
            } catch (e: any) {
                this._soapClient.log('Failed to generate certificate: ' + e.message);
                vscode.window.showErrorMessage('Failed to generate certificate: ' + e.message);
                return;
            }
        }

        this._soapClient.log('[WebviewController] Opening certificate at: ' + certPath);

        if (certPath) {
            if (!fs.existsSync(certPath)) {
                this._soapClient.log('[WebviewController] Certificate file still not found at path: ' + certPath);
                vscode.window.showErrorMessage(`Certificate file missing at: ${certPath}`);
                return;
            }

            try {
                const uri = vscode.Uri.file(certPath);
                this._soapClient.log('[WebviewController] Opening URI: ' + uri.toString());
                await vscode.env.openExternal(uri);
                vscode.window.showInformationMessage(
                    "Certificate opened. To trust this proxy, install it to 'Trusted Root Certification Authorities' in the Windows Certificate Import Wizard."
                );
            } catch (err: any) {
                vscode.window.showErrorMessage('Failed to open certificate: ' + err.message);
            }
        }
    }


    private sendChangelogToWebview() {
        try {
            const changelogPath = path.join(this._extensionUri.fsPath, 'CHANGELOG.md');
            if (fs.existsSync(changelogPath)) {
                const content = fs.readFileSync(changelogPath, 'utf8');
                this._panel.webview.postMessage({ command: 'changelog', content });
            }
        } catch (e) {
            console.error('Failed to read changelog', e);
        }
    }

    private async handlePickOperationForTestCase(caseId: string) {
        const items: vscode.QuickPickItem[] = [];
        const operations: any[] = [];

        for (const project of this._loadedProjects.values()) {
            if (project.interfaces) {
                for (const iface of project.interfaces) {
                    if (iface.operations) {
                        for (const op of iface.operations) {
                            items.push({
                                label: op.name,
                                description: `${project.name} > ${iface.name}`,
                                detail: (op as any).originalEndpoint || ''
                            });
                            operations.push(op);
                        }
                    }
                }
            }
        }

        const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select Operation to Add' });
        if (selected) {
            const index = items.indexOf(selected);
            const op = operations[index];
            if (op) {
                this._panel.webview.postMessage({
                    command: 'addStepToCase',
                    caseId,
                    operation: op
                });
            }
        }
    }
}
