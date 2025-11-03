// src/extension.ts

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateProjectContextText } from './contextGenerator';
import { getAvailableTemplates, getTemplateContent, detectProjectTypes } from './gitignoreProvider';
import ignore from 'ignore';
import { SidebarProvider } from './SidebarProvider';

export function activate(context: vscode.ExtensionContext) {

    // Register the Sidebar Panel
    const sidebarProvider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider)
    );

    // COMMAND 1: Loads gitignore rules and returns them (for the UI)
    const loadTemplateCommand = vscode.commands.registerCommand('code-context-extractor.loadTemplateRules', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder is open.');
            return;
        }
        const projectRoot = workspaceFolders[0].uri.fsPath;

        const templates = await getAvailableTemplates();
        if (templates.length === 0) {
            vscode.window.showWarningMessage('Could not fetch .gitignore templates from GitHub.');
            return [];
        }

        const detected = await detectProjectTypes(projectRoot);
        const selectedTemplate = await vscode.window.showQuickPick(templates, {
            canPickMany: false,
            placeHolder: 'Select a .gitignore template to load',
            title: detected.length > 0 ? `Suggested: ${detected.join(', ')}` : 'Choose a template'
        });

        if (selectedTemplate) {
            const content = await getTemplateContent(selectedTemplate);
            // Parse and filter out comments/empty lines before returning
            return content.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#'));
        }
        return [];
    });

    // COMMAND 2: Generates the context file (now accepts rules from the UI)
    const generateCommand = vscode.commands.registerCommand('code-context-extractor.generate', async (args?: { selectedRules?: string[] }) => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder is open.');
            return;
        }
        const projectRoot = workspaceFolders[0].uri.fsPath;
        const outputFilePath = path.join(projectRoot, 'ProjectContext.txt');
        
        const configuration = vscode.workspace.getConfiguration('code-context-extractor');
        const ig = ignore();

        // 1. Add rules from user's global settings
        const excludeDirs = configuration.get<string[]>('excludeDirs', []);
        const excludeFiles = configuration.get<string[]>('excludeFiles', []);
        ig.add(excludeDirs.map(dir => `${dir}/`));
        ig.add(excludeFiles);

        // 2. Add rules selected from the UI (if any)
        if (args?.selectedRules) {
            ig.add(args.selectedRules);
        }

        // 3. Add rules from local .gitignore
        const localGitignorePath = path.join(projectRoot, '.gitignore');
        if (fs.existsSync(localGitignorePath)) {
            const localGitignoreContent = fs.readFileSync(localGitignorePath, 'utf8');
            ig.add(localGitignoreContent);
        }

        const config = {
            allowedExtensions: configuration.get<string[]>('allowedExtensions', [])
        };
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Generating Project Context',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Scanning files...' });
            try {
                await generateProjectContextText(projectRoot, outputFilePath, config, ig);
                vscode.window.showInformationMessage('Successfully generated ProjectContext.txt!');
                await vscode.window.showTextDocument(vscode.Uri.file(outputFilePath));
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate context: ${(error as Error).message}`);
            }
        });
    });

    context.subscriptions.push(loadTemplateCommand, generateCommand);
}

export function deactivate() {}