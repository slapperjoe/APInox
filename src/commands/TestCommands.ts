
import { ICommand } from './ICommand';
import { TestRunnerService } from '../services/TestRunnerService';
import { ApinoxProject, TestSuite, TestCase } from '../../shared/src/models';
import * as vscode from 'vscode';
import { DiagnosticService } from '../services/DiagnosticService';

// Helper to find Test Suite/Case
function findTestSuite(loadedProjects: Map<string, ApinoxProject>, suiteId: string): { suite: TestSuite, project: ApinoxProject } | undefined {
    for (const project of loadedProjects.values()) {
        if (project.testSuites) {
            const suite = project.testSuites.find(s => s.id === suiteId);
            if (suite) return { suite, project };
        }
    }
    return undefined;
}

function findTestCase(loadedProjects: Map<string, ApinoxProject>, caseId: string): { testCase: TestCase, project: ApinoxProject } | undefined {
    for (const project of loadedProjects.values()) {
        if (project.testSuites) {
            for (const suite of project.testSuites) {
                const testCase = suite.testCases?.find(c => c.id === caseId);
                if (testCase) return { testCase, project };
            }
        }
    }
    return undefined;
}

export class RunTestSuiteCommand implements ICommand {
    constructor(
        private readonly _testRunnerService: TestRunnerService,
        private readonly _loadedProjects: Map<string, ApinoxProject>
    ) { }

    async execute(message: any): Promise<void> {
        const suiteId = message.suiteId;
        const found = findTestSuite(this._loadedProjects, suiteId);
        if (!found) {
            vscode.window.showErrorMessage(`Test Suite not found: ${suiteId}`);
            return;
        }

        console.log(`[RunTestSuiteCommand] Run Suite: ${found.suite.name}`);
        if (found.suite.testCases && found.suite.testCases.length > 0) {
            for (const testCase of found.suite.testCases) {
                await this._testRunnerService.runTestCase(testCase);
            }
        } else {
            vscode.window.showInformationMessage(`Test Suite ${found.suite.name} has no test cases.`);
        }
    }
}

export class RunTestCaseCommand implements ICommand {
    constructor(
        private readonly _testRunnerService: TestRunnerService,
        private readonly _loadedProjects: Map<string, ApinoxProject>
    ) { }

    async execute(message: any): Promise<void> {
        const caseId = message.caseId;
        const fallbackEndpoint = message.fallbackEndpoint;
        const testCase = message.testCase ? message.testCase : undefined;

        let tcToRun = testCase;
        if (!tcToRun) {
            const found = findTestCase(this._loadedProjects, caseId);
            if (!found) {
                vscode.window.showErrorMessage(`Test Case not found: ${caseId}`);
                return;
            }
            tcToRun = found.testCase;
        }

        console.log(`[RunTestCaseCommand] Run Case: ${tcToRun.name} (fallback: ${fallbackEndpoint})`);
        await this._testRunnerService.runTestCase(tcToRun, fallbackEndpoint);
    }
}

export class PickOperationForTestCaseCommand implements ICommand {
    constructor(
        private readonly _panel: vscode.WebviewPanel,
        private readonly _loadedProjects: Map<string, ApinoxProject>
    ) { }

    async execute(message: any): Promise<void> {
        const caseId = message.caseId;
        const items: vscode.QuickPickItem[] = [];
        const payload: any[] = []; // Stores the underlying data
        const logger = DiagnosticService.getInstance();

        logger.log('BACKEND', '[PickOperationForTestCaseCommand] Executing for caseId:', { caseId });
        logger.log('BACKEND', '[PickOperationForTestCaseCommand] Loaded projects count:', this._loadedProjects.size);

        for (const project of this._loadedProjects.values()) {
            logger.log('BACKEND', `[PickOperationForTestCaseCommand] Processing project: ${project.name}`);
            logger.log('BACKEND', `[PickOperationForTestCaseCommand] Interfaces: ${project.interfaces?.length || 0}, Folders: ${project.folders?.length || 0}`);

            // 1. Interfaces (WSDL Operations)
            if (project.interfaces) {
                for (const iface of project.interfaces) {
                    if (iface.operations) {
                        for (const op of iface.operations) {
                            items.push({
                                label: `$(symbol-method) ${op.name}`,
                                description: `${project.name} > ${iface.name}`,
                                detail: (op as any).originalEndpoint || 'WSDL Operation'
                            });
                            payload.push({ type: 'operation', data: op });
                        }
                    }
                }
            }

            // 2. Folders (Requests) - Recursive
            const traverseFolders = (folders: any[], parentPath: string) => {
                logger.log('BACKEND', `[PickOperationForTestCaseCommand] Traversing folders at path: "${parentPath}", count: ${folders.length}`);
                for (const folder of folders) {
                    const currentPath = parentPath ? `${parentPath} / ${folder.name}` : folder.name;

                    // Add Requests in this folder
                    if (folder.requests) {
                        logger.log('BACKEND', `[PickOperationForTestCaseCommand] Found ${folder.requests.length} requests in ${folder.name}`);
                        for (const req of folder.requests) {
                            // Ensure we have a request object
                            if (!req) continue;

                            items.push({
                                label: `$(file-code) ${req.name}`,
                                description: `${project.name} > ${currentPath}`,
                                detail: req.endpoint || 'REST/SOAP Request'
                            });
                            payload.push({ type: 'request', data: req });
                        }
                    } else {
                        logger.log('BACKEND', `[PickOperationForTestCaseCommand] No requests array in folder: ${folder.name}`);
                    }

                    // Recurse
                    if (folder.folders) {
                        traverseFolders(folder.folders, currentPath);
                    }
                }
            };

            if (project.folders && project.folders.length > 0) {
                traverseFolders(project.folders, '');
            } else {
                logger.log('BACKEND', '[PickOperationForTestCaseCommand] No folders to traverse for project:', project.name);
            }
        }

        logger.log('BACKEND', `[PickOperationForTestCaseCommand] Total items found: ${items.length}`);

        if (items.length === 0) {
            vscode.window.showWarningMessage('No requests or operations found in the loaded projects.');
        }

        const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select Request or Operation to Add' });
        if (selected) {
            const index = items.indexOf(selected);
            const entry = payload[index];

            if (entry.type === 'operation') {
                this._panel.webview.postMessage({
                    command: 'addStepToCase',
                    caseId,
                    operation: entry.data
                });
            } else if (entry.type === 'request') {
                this._panel.webview.postMessage({
                    command: 'addStepToCase',
                    caseId,
                    request: entry.data
                });
            }
        }
    }
}
