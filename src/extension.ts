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

    // --- COMMAND 1: Load Templates ---
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

    // --- COMMAND 2: Generate Context File ---
    const generateCommand = vscode.commands.registerCommand('code-context-extractor.generate', async (args?: { selectedRules?: string[], mode?: 'include' | 'exclude' }) => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder is open.');
            return;
        }
        const projectRoot = workspaceFolders[0].uri.fsPath;
        const outputFilePath = path.join(projectRoot, 'ProjectContext.txt');
        
        const ig = ignore();
        ig.add('ProjectContext.txt'); 

        const mode = args?.mode || 'exclude';
        const rules = args?.selectedRules || [];

        if (mode === 'include') {
            // --- WHITELIST STRATEGY ---
            ig.add('*'); // Ignore everything by default

            if (rules.length > 0) {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Resolving Include Paths...`,
                    cancellable: false
                }, async () => {
                    const unignoreRules = new Set<string>();

                    const allowPathAndParents = (relativePath: string, isDirectory: boolean) => {
                        const parts = relativePath.split('/');
                        let currentPath = '';
                        
                        // 1. Un-ignore all parents
                        for (let i = 0; i < parts.length - 1; i++) {
                            currentPath += parts[i] + '/';
                            unignoreRules.add(`!${currentPath}`); 
                        }

                        // 2. Un-ignore the target itself
                        unignoreRules.add(`!${relativePath}`);

                        // 3. If directory, allow contents
                        if (isDirectory) {
                            const dirPath = relativePath.endsWith('/') ? relativePath : relativePath + '/';
                            unignoreRules.add(`!${dirPath}`);
                            unignoreRules.add(`!${dirPath}**`);
                        }
                    };

                    for (const rule of rules) {
                        let cleanRule = rule.trim().replace(/\\/g, '/');
                        if (!cleanRule) continue;

                        // Strategy A: Direct Path (Exact match at root or relative path provided by user)
                        const absolutePath = path.join(projectRoot, cleanRule);
                        let exists = false;
                        let isDir = false;

                        try {
                            const stat = fs.statSync(absolutePath);
                            exists = true;
                            isDir = stat.isDirectory();
                        } catch (e) { exists = false; }

                        if (exists) {
                            allowPathAndParents(cleanRule, isDir);
                        } else {
                            // Strategy B: Deep Search (Wildcard or Deep Folder)
                            let searchPatterns: string[] = [];

                            if (cleanRule.endsWith('/')) {
                                // Input is explicit directory: "migrations/"
                                // Search for: "**/migrations/**" (Find files INSIDE to locate the folder)
                                // Note: We remove leading **/ if user typed it, to standardize
                                const coreName = cleanRule.replace(/^\*\*\//, '');
                                searchPatterns.push(`**/${coreName}**`);
                            } else if (!cleanRule.includes('/')) {
                                // Input is just a name: "migrations"
                                // It could be a file OR a folder.
                                searchPatterns.push(`**/${cleanRule}`);      // File
                                searchPatterns.push(`**/${cleanRule}/**`);   // Folder content
                            } else {
                                // Input is specific path: "some/path.ts"
                                if (!cleanRule.startsWith('**/')) {
                                    searchPatterns.push(`**/${cleanRule}`);
                                } else {
                                    searchPatterns.push(cleanRule);
                                }
                            }
                            
                            // Execute Search
                            let foundAny = false;
                            for (const pattern of searchPatterns) {
                                const foundUris = await vscode.workspace.findFiles(pattern, null, 500);
                                if (foundUris.length > 0) {
                                    foundAny = true;
                                    for (const uri of foundUris) {
                                        const relPath = path.relative(projectRoot, uri.fsPath).replace(/\\/g, '/');
                                        // Treat findFiles results as files (false flag)
                                        // This works because allowPathAndParents extracts the directory structure anyway
                                        allowPathAndParents(relPath, false);
                                    }
                                }
                            }

                            // Fallback if search returns nothing (maybe it's a new file not on disk yet)
                            if (!foundAny) {
                                unignoreRules.add(`!${cleanRule}`);
                            }
                        }
                    }

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
                    "Exclude Mode: No files selected. This will include EVERYTHING. Continue?",
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