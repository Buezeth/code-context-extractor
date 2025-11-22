// src/SidebarProvider.ts

import * as vscode from 'vscode';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'code-context-extractor-view';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _workspaceState: vscode.Memento 
    ) {}

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

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                // Restore state when Webview reports it is ready
                case 'webview-ready': {
                    const savedState = this._workspaceState.get('sidebarState');
                    if (savedState) {
                        this._view?.webview.postMessage({ type: 'restore-state', state: savedState });
                    }
                    break;
                }
                case 'generate': {
                    vscode.commands.executeCommand('code-context-extractor.generate', {
                        selectedRules: data.rules,
                        mode: data.mode
                    });
                    break;
                }
                case 'load-template': {
                    const rules = await vscode.commands.executeCommand<string[]>('code-context-extractor.loadTemplateRules');
                    if (rules && this._view) {
                        this._view.webview.postMessage({ type: 'update-rules', rules: rules });
                    }
                    break;
                }
                case 'save-state': {
                    await this._workspaceState.update('sidebarState', data.state);
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
                <title>Code Context Extractor</title>
            </head>
            <body>
                <h2>Context Generator</h2>
                
                <!-- MODE TOGGLE -->
                <div class="toggle-container">
                    <button id="btn-mode-exclude" class="toggle-btn active">Exclude Mode</button>
                    <button id="btn-mode-include" class="toggle-btn">Include Mode</button>
                </div>

                <p id="mode-description" class="description">
                    <strong>Blacklist:</strong> Select files you want to <em>hide</em>.
                </p>

                <hr>

                <!-- EXCLUDE CONTROLS -->
                <div id="exclude-controls">
                    <h4 class="section-header">1. Load Ignore Rules</h4>
                    <button id="load-template-btn">Load .gitignore & Templates</button>
                </div>

                <!-- INCLUDE CONTROLS -->
                <div id="include-controls" class="hidden">
                    <h4 class="section-header">1. Add Files to Include</h4>
                    <p class="description">Start empty. Add specific folders (e.g., <code>src/</code>) or files you strictly need.</p>
                </div>

                <!-- LIST MANAGEMENT -->
                <div id="rules-section" class="hidden">
                    <h4 class="section-header" id="list-header">2. Manage List</h4>
                    
                    <div id="add-rule-container">
                        <input type="text" id="new-rule-input" placeholder="e.g. src/ or *.ts"/>
                        <button id="add-rule-btn">+</button>
                    </div>

                    <div id="select-all-container">
                        <input type="checkbox" id="select-all-cb" checked>
                        <label for="select-all-cb">Select / Deselect All</label>
                    </div>
                    
                    <div id="rules-container"></div>
                </div>

                <!-- GENERATE ACTION -->
                <div id="generate-section">
                    <hr>
                    <button id="generate-btn" disabled>Generate Context File</button>
                </div>

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