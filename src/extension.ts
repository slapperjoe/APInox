import * as vscode from 'vscode';
import { SoapClient } from './soapClient';

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

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        const outputChannel = vscode.window.createOutputChannel('Dirty SOAP');
        this._soapClient = new SoapClient(outputChannel);

        this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);
        this._panel.onDidDispose(() => {
            this.dispose();
            outputChannel.dispose();
        }, null, []);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'loadWsdl':
                        try {
                            const services = await this._soapClient.parseWsdl(message.url);
                            this._panel.webview.postMessage({ command: 'wsdlParsed', services });
                        } catch (error: any) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            this._panel.webview.postMessage({ command: 'error', message: errorMessage });
                        }
                        return;
                    case 'cancelRequest':
                        this._soapClient.cancelRequest();
                        return;
                    case 'executeRequest':
                        try {
                            // Helper to parse XML to JSON args if needed, but for now let's assume valid XML string is passed 
                            // actually soap lib usually takes JSON args.
                            // If user edits XML directly, we might need a way to send raw XML.
                            // The soap library supports client.Method(xmlString, cb) if using specific options, but usually expects object.
                            // PROPOSAL: For this generic explorer, passing raw XML is hard with node-soap without manually handling it.
                            // ALTERNATIVE: Use a lower level request or try to parse the XML back to JSON.
                            // Let's assume for MVP we just use the raw XML if possible or simplistic JSON.

                            // A better approach for "Bruno-like" is allowing user to edit the BODY XML.
                            // node-soap allows passing xml as string to specific methods?
                            // Actually node-soap `client.Method(args, cb)` -> args is JS object.

                            // Let's implement a "raw" execution using extension's fetch or http/https lib if we want full XML control?
                            // OR: node-soap `client.lastRequest` access.

                            // Let's stick to Parsing the User's XML to an Object? No that's hard.
                            // node-soap has `client.MyFunction(xml, function(err, result) ...)` if xml is a string it might work? 
                            // let's try passing the args as the parsed XML string or just the string.

                            // Re-reading node-soap docs: "args argument can be a JavaScript object or a JSON string or an XML string".
                            // So we can pass the XML string from the editor directly!

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
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-randomNonce' ${webview.cspSource};">
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
