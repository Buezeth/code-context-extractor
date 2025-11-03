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
            <title>Code Context Extractor</title>
        </head>
        <body>
            <h2>Code Context Extractor</h2>
            <p class="description">
                Create a single text file with your project's context, optimized for feeding into AI models.
            </p>

            <hr>

            <h3>Step 1: Choose a Base Filter</h3>
            <p class="description">
                Start by loading a standard .gitignore template based on your project's technology. This will provide a good starting list of files and folders to exclude.
            </p>
            <button id="load-template-btn">Load Project Type Template</button>

            <!-- This entire section is hidden until a template is loaded -->
            <div id="refine-section" class="hidden">
                <hr>
                <h3>Step 2: Refine Files to Exclude</h3>
                <p class="description">
                    Uncheck any items you want to include in the context file. Add any other files or folders you wish to exclude.
                </p>

                <div id="select-all-container">
                    <input type="checkbox" id="select-all-cb">
                    <label for="select-all-cb">Select / Deselect All</label>
                </div>
                
                <div id="rules-container">
                    <!-- Checkboxes will be dynamically inserted here -->
                </div>

                <div id="add-rule-container">
                    <input type="text" id="new-rule-input" placeholder="Add custom rule (e.g., *.log or temp/)"/>
                    <button id="add-rule-btn">+</button>
                </div>
            </div>

            <!-- This section is also hidden until a template is loaded -->
            <div id="generate-section" class="hidden">
                <hr>
                <h3>Step 3: Generate the File</h3>
                <p class="description">
                    This will create a 'ProjectContext.txt' file in your workspace root.
                </p>
                <button id="generate-btn">Generate Context File</button>
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