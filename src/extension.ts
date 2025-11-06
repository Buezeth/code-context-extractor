// src/extension.ts

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateProjectContextText } from './contextGenerator';
import { getAvailableTemplates, getTemplateContent, detectProjectTypes } from './gitignoreProvider';
import ignore from 'ignore';
import { SidebarProvider } from './SidebarProvider';

export function activate(context: vscode.ExtensionContext) {

    // Register the Sidebar Panel, passing in the workspace state
    const sidebarProvider = new SidebarProvider(context.extensionUri, context.workspaceState);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider)
    );

    // COMMAND 1: Loads and aggregates ignore rules from all sources.
    const loadTemplateCommand = vscode.commands.registerCommand('code-context-extractor.loadTemplateRules', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder is open.');
            return [];
        }
        const projectRoot = workspaceFolders[0].uri.fsPath;

        // Use a Set to store unique rules
        const allRules = new Set<string>();

        // Helper to process and add rules from content string
        const addRulesFromString = (content: string) => {
            content.split(/\r?\n/).forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    allRules.add(trimmed);
                }
            });
        };

        // 1. Add rules from local .gitignore if it exists
        const localGitignorePath = path.join(projectRoot, '.gitignore');
        if (fs.existsSync(localGitignorePath)) {
            const localGitignoreContent = fs.readFileSync(localGitignorePath, 'utf8');
            addRulesFromString(localGitignoreContent);
        }

        // 2. Add rules from user's global settings
        const configuration = vscode.workspace.getConfiguration('code-context-extractor');
        const excludeDirs = configuration.get<string[]>('excludeDirs', []);
        const excludeFiles = configuration.get<string[]>('excludeFiles', []);
        excludeDirs.map(dir => `${dir}/`).forEach(rule => allRules.add(rule));
        excludeFiles.forEach(rule => allRules.add(rule));

        // 3. Ask user to select a template to add MORE rules
        const templates = await getAvailableTemplates();
        if (templates.length === 0) {
            vscode.window.showWarningMessage('Could not fetch .gitignore templates from GitHub. Using local rules only.');
        } else {
            const detected = await detectProjectTypes(projectRoot);
            const selectedTemplate = await vscode.window.showQuickPick(templates, {
                canPickMany: false,
                placeHolder: 'Select a template to add its rules (optional)',
                title: detected.length > 0 ? `Suggested: ${detected.join(', ')}` : 'Choose a template'
            });

            if (selectedTemplate) {
                const content = await getTemplateContent(selectedTemplate);
                addRulesFromString(content);
            }
        }
        
        // Return a sorted array of unique rules
        return Array.from(allRules).sort();
    });

    // COMMAND 2: Generates the context file using ONLY the rules from the UI.
    const generateCommand = vscode.commands.registerCommand('code-context-extractor.generate', async (args?: { selectedRules?: string[] }) => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder is open.');
            return;
        }
        const projectRoot = workspaceFolders[0].uri.fsPath;
        const outputFilePath = path.join(projectRoot, 'ProjectContext.txt');
        
        const ig = ignore();

        // Always ignore the output file itself and the .git directory.
        ig.add('ProjectContext.txt');
        ig.add('.git/');

        // The UI is now the single source of truth for all other ignore rules.
        if (args?.selectedRules && args.selectedRules.length > 0) {
            ig.add(args.selectedRules);
        } else {
            // Warn the user if no rules are provided, as this might include everything.
            const decision = await vscode.window.showWarningMessage(
                "No files/folders are selected for exclusion. This will include everything in your project (including node_modules, .git, etc). Do you want to continue?",
                { modal: true },
                'Yes, Continue'
            );
            if (decision !== 'Yes, Continue') {
                return; // Abort generation if user cancels
            }
        }
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Generating Project Context',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Scanning files...' });
            try {
                await generateProjectContextText(projectRoot, outputFilePath, ig);
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