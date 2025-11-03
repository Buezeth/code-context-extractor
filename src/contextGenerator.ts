// src/contextGenerator.ts

import * as fs from 'fs';
import * as path from 'path';
import type { Ignore } from 'ignore'; // Import the type for TypeScript

interface GeneratorConfig {
    allowedExtensions: string[];
}

export function generateProjectContextText(
    projectPath: string,
    outputFile: string,
    config: GeneratorConfig,
    ig: Ignore // Accept the pre-configured ignore instance
): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const outputStream = fs.createWriteStream(outputFile, { encoding: "utf8" });

            outputStream.write("--- START OF FILE ProjectContext.txt ---\n\n");
            outputStream.write("--- Folder Structure ---\n");

            function shouldProcessFile(fileName: string): boolean {
                // The ignore instance already handles excluded files.
                // We only need to check for allowed extensions.
                return config.allowedExtensions.some((ext) => fileName.endsWith(ext));
            }
            
            function walkDir(dir: string, indent: string = ""): void {
                let entries;
                try {
                    entries = fs.readdirSync(dir, { withFileTypes: true });
                } catch (err) { return; }
            
                entries.sort((a, b) => a.name.localeCompare(b.name));
            
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    // Get path relative to the project root for the ignore check
                    const relativePath = path.relative(projectPath, fullPath);

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
                    const relativePath = path.relative(projectPath, fullPath);
                    
                    if (ig.ignores(relativePath)) {
                        continue;
                    }

                    if (entry.isDirectory()) {
                        writeIncludedFileContents(fullPath);
                    } else if (entry.isFile() && shouldProcessFile(entry.name)) {
                        outputStream.write(`\n--- ${relativePath.replace(/\\/g, '/')} ---\n`);
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