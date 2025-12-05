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

    // COMMAND 1: Load Templates
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

        const addRulesToSet = (content: string, ruleSet: Set<string>) => {
            content.split(/\r?\n/).forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    ruleSet.add(trimmed);
                }
            });
        };

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

    // COMMAND 2: Generate Context File
    const generateCommand = vscode.commands.registerCommand('code-context-extractor.generate', async (args?: { selectedRules?: string[], mode?: 'include' | 'exclude' }) => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder is open.');
            return;
        }
        const projectRoot = workspaceFolders[0].uri.fsPath;
        const outputFilePath = path.join(projectRoot, 'ProjectContext.txt');
        
        const ig = ignore();
        ig.add('ProjectContext.txt'); // Always exclude output file

        const mode = args?.mode || 'exclude';
        const rules = args?.selectedRules || [];

        if (mode === 'include') {
            // --- WHITELIST STRATEGY ---
            ig.add('*'); // 1. Start by ignoring everything

            if (rules.length > 0) {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Resolving Include Paths...`,
                    cancellable: false
                }, async () => {
                    const unignoreRules = new Set<string>();

                    for (const rule of rules) {
                        const cleanRule = rule.trim().replace(/\\/g, '/');
                        if (!cleanRule) continue;

                        // 2. Resolve where these files actually are.
                        // If user typed "migrations/", we search for "**/migrations/**"
                        // If user typed "*.sql", we search for "**/*.sql"
                        let searchPattern = cleanRule;
                        if (!searchPattern.startsWith('**/') && !searchPattern.startsWith('/')) {
                            searchPattern = '**/' + searchPattern;
                        }
                        // If it looks like a folder, ensure we capture contents
                        if (searchPattern.endsWith('/')) {
                            searchPattern = searchPattern + '**';
                        }

                        // Use VS Code API to find actual files matching the rule
                        const foundUris = await vscode.workspace.findFiles(searchPattern, null, 500); // Limit to 500 to prevent freeze

                        for (const uri of foundUris) {
                            // Convert absolute path to relative path (e.g., "pkg/platform/database/migrations/up.sql")
                            const relativePath = path.relative(projectRoot, uri.fsPath).replace(/\\/g, '/');
                            
                            // 3. CRITICAL: Un-ignore every parent directory leading to this file.
                            // If we don't, the scanner stops at "pkg/" because "*" ignored it.
                            const parts = relativePath.split('/');
                            let pathBuilder = '';
                            
                            for (let i = 0; i < parts.length - 1; i++) {
                                pathBuilder += parts[i] + '/';
                                unignoreRules.add(`!${pathBuilder}`); // e.g., !pkg/, !pkg/platform/
                            }
                            
                            // 4. Un-ignore the file itself
                            unignoreRules.add(`!${relativePath}`);
                        }

                        // Fallback: If VS Code found nothing (maybe new file?), add the raw rule just in case
                        if (foundUris.length === 0) {
                            unignoreRules.add(`!${cleanRule}`);
                            if (cleanRule.endsWith('/')) {
                                unignoreRules.add(`!${cleanRule}**`);
                            }
                        }
                    }

                    // Apply all collected un-ignore rules
                    ig.add(Array.from(unignoreRules));
                });
            } else {
                vscode.window.showWarningMessage("Include Mode: No files selected. Output will be empty.");
                return;
            }

        } else {
            // --- BLACKLIST STRATEGY ---
            ig.add('.git/');
            if (rules.length > 0) {
                ig.add(rules);
            } else {
                const decision = await vscode.window.showWarningMessage(
                    "Exclude Mode: No files selected. This will include EVERYTHING (including node_modules). Continue?",
                    { modal: true }, 'Yes, Continue'
                );
                if (decision !== 'Yes, Continue') return;
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