// src/gitignoreProvider.ts

import * as vscode from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

// Simple in-memory cache to avoid hitting the GitHub API too often
let templateCache: string[] | null = null;

const API_URL = 'https://api.github.com/repos/github/gitignore/contents/';

/**
 * Fetches the list of available .gitignore templates from the GitHub API.
 * Results are cached in memory.
 */
export async function getAvailableTemplates(): Promise<string[]> {
    if (templateCache) {
        return templateCache;
    }

    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`GitHub API returned ${response.status}`);
        }
        const files = await response.json() as { name: string, type: string }[];
        
        const templateNames = files
            .filter(file => file.type === 'file' && file.name.endsWith('.gitignore'))
            .map(file => file.name.replace('.gitignore', ''));

        templateCache = templateNames;
        return templateNames;
    } catch (error) {
        console.error('Failed to fetch gitignore templates:', error);
        return []; // Return empty on error
    }
}

/**
 * Fetches the content of a specific .gitignore template.
 */
export async function getTemplateContent(templateName: string): Promise<string> {
    const url = `https://raw.githubusercontent.com/github/gitignore/main/${templateName}.gitignore`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return ''; // Return empty string if a template can't be fetched
        }
        return await response.text();
    } catch (error) {
        console.error(`Failed to fetch content for ${templateName}:`, error);
        return '';
    }
}

/**
 * Scans the project root for common files to detect the project type.
 */
export async function detectProjectTypes(projectRoot: string): Promise<string[]> {
    const detections: { [key: string]: string } = {
        'Node': 'package.json',
        'Python': 'requirements.txt',
        'Go': 'go.mod',
        'Rust': 'Cargo.toml',
        'Java': 'pom.xml',
        'Maven': 'pom.xml'
    };

    const detectedTypes: string[] = [];
    for (const type in detections) {
        const file = detections[type];
        try {
            await vscode.promises.stat(path.join(projectRoot, file));
            detectedTypes.push(type);
        } catch (error) {
            // File doesn't exist, so we don't detect this type.
        }
    }
    return detectedTypes;
}