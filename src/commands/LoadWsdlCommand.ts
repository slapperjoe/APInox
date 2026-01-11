
import { ICommand } from './ICommand';
import { SoapClient } from '../soapClient';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class LoadWsdlCommand implements ICommand {
    constructor(
        private readonly _panel: vscode.WebviewPanel,
        private readonly _soapClient: SoapClient
    ) { }

    async execute(message: any): Promise<void> {
        try {
            this._soapClient.log('Parsing WSDL...');

            let url = '';
            let localPath = '';
            let source = 'file';
            const useProxy = message.useProxy === true;

            if (message.path) {
                localPath = message.path;
                url = message.path;
                source = 'file';
            } else if (message.url) {
                url = message.url;
                localPath = message.url; // Or logic to determine if local?
                source = 'url';
            } else if (message.content) {
                // Save raw content to temp file for parsing
                const tempDir = os.tmpdir();
                localPath = path.join(tempDir, `temp_${Date.now()}.wsdl`);
                fs.writeFileSync(localPath, message.content);
                url = localPath;
                source = 'raw';
            } else {
                throw new Error("No WSDL content provided. (Expected 'path', 'url', or 'content')");
            }

            if (useProxy) {
                this._soapClient.log('Using system proxy for WSDL fetch...');
            }

            this._soapClient.log(`Parsing API from URL: ${url}`);

            // Detection Logic
            const isJson = url.toLowerCase().endsWith('.json') || url.toLowerCase().endsWith('.yaml') || url.toLowerCase().endsWith('.yml');
            // Basic detection for "swagger" or "openapi" in content if we had it, but for URL based, extension is best guess + fallback

            let parsed: any;

            if (isJson) {
                this._soapClient.log('Detected OpenAPI/Swagger format (JSON/YAML)...');
                const { OpenApiParser } = require('../OpenApiParser');
                const parser = new OpenApiParser();
                // We need to pass the logger or use console
                // parser.log = this._soapClient.log;
                parsed = await parser.parse(url);
            } else {
                // Fallback to WSDL
                this._soapClient.log('Using WSDL parser...');
                // Use the centralized soapClient to parse, which handles settings/proxies correctly
                parsed = await this._soapClient.parseWsdl(url);
            }

            this._panel.webview.postMessage({
                command: 'wsdlParsed',
                services: parsed, // Matched to frontend expectation (message.services)
                source: source,
                url: url, // Return the path/url used
                localPath: localPath
            });
            this._soapClient.log(`API Parsed Successfully.`);

            // Cleanup temp file if raw
            if (source === 'raw') {
                try { fs.unlinkSync(localPath); } catch { /* ignore cleanup errors */ }
            }

        } catch (error: any) {
            this._soapClient.log(`WSDL Parse Error: ${error.message}`);
            this._panel.webview.postMessage({ command: 'error', message: `Failed to parse WSDL: ${error.message}` });
        }
    }
}
