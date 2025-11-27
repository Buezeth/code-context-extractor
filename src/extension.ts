// src/extension.ts

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateProjectContextText } from './contextGenerator';
import { getAvailableTemplates, getTemplateContent, detectProjectTypes } from './gitignoreProvider';
import ignore from 'ignore';
import { SidebarProvider } from './SidebarProvider';

export function activate(context: vscode.ExtensionContext) {

    const sidebarProvider = new SidebarProvider(context.extensionUri, context.workspaceState);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider)
    );

    // COMMAND 1: Load Templates (Mostly for Exclude Mode)
    const loadTemplateCommand = vscode.commands.registerCommand('code-context-extractor.loadTemplateRules', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder is open.');
            return {};
        }
        const projectRoot = workspaceFolders[0].uri.fsPath;

        const localRules = new Set<string>();
        const templateRules = new Set<string>();
        let templateName = '';

        // Helper to parse line-by-line
        const addRulesToSet = (content: string, ruleSet: Set<string>) => {
            content.split(/\r?\n/).forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    ruleSet.add(trimmed);
                }
            });
        };

        // 1. Add rules from local .gitignore and Settings
        const localGitignorePath = path.join(projectRoot, '.gitignore');
        if (fs.existsSync(localGitignorePath)) {
            const localGitignoreContent = fs.readFileSync(localGitignorePath, 'utf8');
            addRulesToSet(localGitignoreContent, localRules);
        }
        const configuration = vscode.workspace.getConfiguration('code-context-extractor');
        const excludeDirs = configuration.get<string[]>('excludeDirs', []);
        const excludeFiles = configuration.get<string[]>('excludeFiles', []);
        
        excludeDirs.map(dir => `${dir}/`).forEach(rule => localRules.add(rule));
        excludeFiles.forEach(rule => localRules.add(rule));

        // 2. Ask user to select a GitHub template (Optional)
        const templates = await getAvailableTemplates();
        if (templates.length > 0) {
            const detected = await detectProjectTypes(projectRoot);
            const detectedSet = new Set(detected.map(d => d.toLowerCase()));
            const suggestedTemplates: vscode.QuickPickItem[] = [];
            const otherTemplates: vscode.QuickPickItem[] = [];

            templates.sort((a, b) => a.localeCompare(b));

            templates.forEach(template => {
                if (detectedSet.has(template.toLowerCase())) {
                    suggestedTemplates.push({
                        label: template,
                        description: '(Suggested for your project)'
                    });
                } else {
                    otherTemplates.push({ label: template });
                }
            });

            const allItems = [...suggestedTemplates, ...otherTemplates];
            const selectedTemplateItem = await vscode.window.showQuickPick(allItems, {
                canPickMany: false,
                placeHolder: 'Select a template to add its rules (optional)',
                title: 'Choose a .gitignore Template'
            });

            if (selectedTemplateItem) {
                templateName = selectedTemplateItem.label;
                const content = await getTemplateContent(templateName);
                addRulesToSet(content, templateRules);
            }
        }
        
        // De-duplicate: If a rule exists in local, don't show it as 'template'
        const finalTemplateRules = new Set<string>();
        templateRules.forEach(rule => {
            if (!localRules.has(rule)) {
                finalTemplateRules.add(rule);
            }
        });

        return {
            local: Array.from(localRules).sort(),
            template: {
                name: templateName,
                rules: Array.from(finalTemplateRules).sort()
            }
        };
    });

    /**
     * COMMAND 2: Generate Context File
     * Handles both 'exclude' (blacklist) and 'include' (whitelist) logic.
     */
    const generateCommand = vscode.commands.registerCommand('code-context-extractor.generate', async (args?: { selectedRules?: string[], mode?: 'include' | 'exclude' }) => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder is open.');
            return;
        }
        const projectRoot = workspaceFolders[0].uri.fsPath;
        const outputFilePath = path.join(projectRoot, 'ProjectContext.txt');
        
        const ig = ignore();

        // 1. Safety: Always exclude the output file itself
        ig.add('ProjectContext.txt');

        const mode = args?.mode || 'exclude';
        const rules = args?.selectedRules || [];

        if (mode === 'include') {
            // --- WHITELIST STRATEGY ---
            // 1. Ignore everything (*)
            ig.add('*'); 
            
            if (rules.length > 0) {
                rules.forEach(rule => {
                    const rawRule = rule.startsWith('!') ? rule.substring(1) : rule;
                    
                    // 2. Un-ignore (!) the specific item
                    ig.add(`!${rawRule}`);

                    // 3. If it's a folder, recursively un-ignore contents (**)
                    if (rawRule.endsWith('/')) {
                        ig.add(`!${rawRule}**`);
                    }
                });
            } else {
                vscode.window.showWarningMessage("Include Mode: No files selected. Output will be empty.");
                return;
            }

        } else {
            // --- BLACKLIST STRATEGY (Standard .gitignore) ---
            ig.add('.git/'); // Always exclude .git metadata
            
            if (rules.length > 0) {
                ig.add(rules);
            } else {
                const decision = await vscode.window.showWarningMessage(
                    "Exclude Mode: No files selected. This will include EVERYTHING (including node_modules). Continue?",
                    { modal: true }, 'Yes, Continue'
                );
                if (decision !== 'Yes, Continue') {
                    return;
                } 
            }
        }
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Generating Context (${mode === 'include' ? 'Whitelist' : 'Blacklist'})`,
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