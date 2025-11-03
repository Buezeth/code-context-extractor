// src/SidebarProvider.ts

import * as vscode from 'vscode';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'code-context-extractor-view';

    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
) {
    this._view = webviewView;

    webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
        switch (data.type) {
            case 'generate': {
                // Execute the generate command with the selected rules as an argument
                vscode.commands.executeCommand('code-context-extractor.generate', {
                    selectedRules: data.rules
                });
                break;
            }
            case 'load-template': {
                // Call the new command to get the rules
                const rules = await vscode.commands.executeCommand<string[]>('code-context-extractor.loadTemplateRules');
                if (rules && this._view) {
                    // Send the rules back to the webview to be displayed
                    this._view.webview.postMessage({ type: 'update-rules', rules: rules });
                }
                break;
            }
        }
    });
}

    private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));
    const nonce = getNonce();

    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleUri}" rel="stylesheet">
            <title>Code Context</title>
        </head>
        <body>
            <h3>Code Context Generator</h3>
            
            <button id="load-template-btn">Load Gitignore Template</button>
            
            <div id="rules-container">
                <!-- Checkboxes will be dynamically inserted here -->
            </div>

            <button id="generate-btn">Generate Context</button>

            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
}
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}