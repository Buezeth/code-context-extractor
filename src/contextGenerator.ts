// src/contextGenerator.ts

import * as fs from 'fs';
import * as path from 'path';
import type { Ignore } from 'ignore';

export function generateProjectContextText(
    projectPath: string,
    outputFile: string,
    ig: Ignore 
): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const outputStream = fs.createWriteStream(outputFile, { encoding: "utf8" });

            outputStream.write("--- START OF FILE ProjectContext.txt ---\n\n");
            outputStream.write("--- Folder Structure ---\n");
            
            function walkDir(dir: string, indent: string = ""): void {
                let entries;
                try {
                    entries = fs.readdirSync(dir, { withFileTypes: true });
                } catch (err) { return; }
            
                entries.sort((a, b) => a.name.localeCompare(b.name));
            
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    const relativePath = path.relative(projectPath, fullPath).replace(/\\/g, '/');

                    // --- CORE FIX: Check directories with a trailing slash ---
                    if (entry.isDirectory()) {
                        // For directories, test path with a trailing slash to match patterns like "node_modules/"
                        if (ig.ignores(relativePath + '/')) {
                            continue;
                        }
                        outputStream.write(`${indent}${entry.name}/\n`);
                        walkDir(fullPath, indent + "  ");
                    } else {
                        // For files, test the path as is
                        if (ig.ignores(relativePath)) {
                            continue;
                        }
                        // We no longer write file names here, that's handled by writeIncludedFileContents
                    }
                }
            }

            function writeIncludedFileContents(dir: string): void {
                let entries;
                try {
                    entries = fs.readdirSync(dir, { withFileTypes: true });
                } catch (err) { return; }
                
                entries.sort((a, b) => a.name.localeCompare(b.name));

                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    const relativePath = path.relative(projectPath, fullPath).replace(/\\/g, '/');
                    
                    // --- CORE FIX: Also check directories with a trailing slash here ---
                    if (entry.isDirectory()) {
                        if (ig.ignores(relativePath + '/')) {
                            continue;
                        }
                        writeIncludedFileContents(fullPath);
                    } else if (entry.isFile()) {
                        if (ig.ignores(relativePath)) {
                            continue;
                        }
                        outputStream.write(`\n--- ${relativePath} ---\n`);
                        try {
                            const content = fs.readFileSync(fullPath, "utf8");
                            outputStream.write(content + "\n");
                        } catch (err) {
                            // ... error handling
                        }
                    }
                }
            }

            walkDir(projectPath);
            outputStream.write("\n");
            writeIncludedFileContents(projectPath);

            outputStream.end(() => resolve());
            outputStream.on('error', reject);

        } catch (error) {
            reject(error);
        }
    });
}