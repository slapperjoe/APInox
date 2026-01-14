/**
 * VS Code implementation of ISecretStorage
 */

import * as vscode from 'vscode';
import { ISecretStorage } from '../../interfaces/ISecretStorage';

export class VSCodeSecretStorage implements ISecretStorage {
    private secrets: vscode.SecretStorage;

    constructor(context: vscode.ExtensionContext) {
        this.secrets = context.secrets;
    }

    async store(key: string, value: string): Promise<void> {
        await this.secrets.store(key, value);
    }

    async get(key: string): Promise<string | undefined> {
        return await this.secrets.get(key);
    }

    async delete(key: string): Promise<void> {
        await this.secrets.delete(key);
    }
}
