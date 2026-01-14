/**
 * VS Code implementation of IConfigService
 */

import * as vscode from 'vscode';
import { IConfigService } from '../../interfaces/IConfigService';

export class VSCodeConfigService implements IConfigService {
    get<T>(section: string, key: string, defaultValue?: T): T | undefined {
        const config = vscode.workspace.getConfiguration(section);
        return config.get<T>(key, defaultValue as T);
    }

    getProxyUrl(): string | undefined {
        return this.get<string>('http', 'proxy');
    }

    getStrictSSL(): boolean {
        return this.get<boolean>('http', 'proxyStrictSSL', true) ?? true;
    }
}
