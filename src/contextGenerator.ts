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
                    // --- FIX #1: Normalize path separators to forward slashes ---
                    const relativePath = path.relative(projectPath, fullPath).replace(/\\/g, '/');

                    if (ig.ignores(relativePath)) {
                        continue;
                    }
            
                    if (entry.isDirectory()) {
                        outputStream.write(`${indent}${entry.name}/\n`);
                        walkDir(fullPath, indent + "  ");
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
                    // --- FIX #2: Normalize path separators to forward slashes ---
                    const relativePath = path.relative(projectPath, fullPath).replace(/\\/g, '/');
                    
                    if (ig.ignores(relativePath)) {
                        continue;
                    }

                    if (entry.isDirectory()) {
                        writeIncludedFileContents(fullPath);
                    } else if (entry.isFile()) {
                        outputStream.write(`\n--- ${relativePath} ---\n`); // No need for extra replace here now
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