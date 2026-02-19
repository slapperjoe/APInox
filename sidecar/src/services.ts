/**
 * Service Container - Holds all backend service instances
 * 
 * Mirrors the service initialization from WebviewPanel.ts
 * but without VS Code dependencies.
 */

import { SoapClient } from './soapClient';
import { TestRunnerService } from './services/TestRunnerService';
import { ConfigSwitcherService } from './services/ConfigSwitcherService';
import { RequestHistoryService } from './services/RequestHistoryService';
import { FolderProjectStorage } from './FolderProjectStorage';
import { SettingsManager } from './utils/SettingsManager';

import { SidecarNotificationService } from './adapters/SidecarNotificationService';
import { SidecarConfigService } from './adapters/SidecarConfigService';
import { SidecarSecretStorage } from './adapters/SidecarSecretStorage';
import { SecretManager } from './SecretManager';

export class ServiceContainer {
    public readonly soapClient: SoapClient;
    public readonly testRunnerService: TestRunnerService;
    public readonly configSwitcherService: ConfigSwitcherService;
    public readonly historyService: RequestHistoryService;
    public readonly folderStorage: FolderProjectStorage;
    public readonly settingsManager: SettingsManager;

    // Platform adapters
    public readonly notificationService: SidecarNotificationService;
    public readonly configService: SidecarConfigService;
    public readonly secretStorage: SidecarSecretStorage;
    public readonly secretManager: SecretManager;

    private outputLog: string[] = [];

    constructor() {
        // Create platform adapters
        this.notificationService = new SidecarNotificationService();
        this.configService = new SidecarConfigService();

        // Create output channel mock
        const outputChannel = {
            appendLine: (msg: string) => {
                this.outputLog.push(msg);
                console.log(`[APInox] ${msg}`);
            }
        };

        // Initialize services
        this.settingsManager = new SettingsManager();
        this.secretStorage = new SidecarSecretStorage();
        this.secretManager = new SecretManager(this.secretStorage);
        
        // Link secret manager to settings manager for variable resolution
        this.settingsManager.setSecretManager(this.secretManager);
        
        this.soapClient = new SoapClient(this.settingsManager, outputChannel, this.configService);
        this.folderStorage = new FolderProjectStorage(outputChannel);

        this.configSwitcherService = new ConfigSwitcherService();
        this.testRunnerService = new TestRunnerService(this.soapClient, outputChannel, this.settingsManager);

        const configDir = this.settingsManager.getConfigDir();
        this.historyService = new RequestHistoryService(configDir);

        console.log('[Sidecar] All services initialized');
    }

    /**
     * Clean up resources when shutting down
     */
    dispose(): void {
        console.log('[Sidecar] Services disposed');
    }

    /**
     * Get recent output logs
     */
    getOutputLogs(count: number = 100): string[] {
        return this.outputLog.slice(-count);
    }

    /**
     * Clear output logs
     */
    clearOutputLogs(): void {
        this.outputLog = [];
        console.log('[Sidecar] Output logs cleared');
    }
}
