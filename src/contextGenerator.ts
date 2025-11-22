// src/contextGenerator.ts

import * as fs from 'fs';
import * as path from 'path';
import type { Ignore } from 'ignore';

/**
 * Simple heuristic to detect if a file is binary.
 * 1. Checks extension.
 * 2. Checks for null bytes in the first 4KB.
 */
function isBinaryFile(filePath: string): boolean {
    // 1. Quick check based on extension
    const binaryExtensions = [
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
        '.pdf', '.exe', '.dll', '.so', '.dylib', '.bin',
        '.zip', '.tar', '.gz', '.7z', '.rar',
        '.mp3', '.mp4', '.wav', '.avi', '.mov',
        '.eot', '.ttf', '.woff', '.woff2',
        '.pyc', '.class', '.jar'
    ];
    
    if (binaryExtensions.includes(path.extname(filePath).toLowerCase())) {
        return true;
    }

    // 2. Content check (Null Byte Heuristic)
    try {
        const buffer = Buffer.alloc(4096);
        const fd = fs.openSync(filePath, 'r');
        const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
        fs.closeSync(fd);

        // Empty file is treated as text
        if (bytesRead === 0) {
            return false;
        }

        // Look for null byte (0x00) which usually indicates binary
        for (let i = 0; i < bytesRead; i++) {
            if (buffer[i] === 0) {
                return true;
            }
        }
        return false;
    } catch (err) {
        // If we can't read it, assume safe to skip or treat as binary to be safe
        return false; 
    }
}

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

                    if (entry.isDirectory()) {
                        if (ig.ignores(relativePath + '/')) {
                            continue;
                        }
                        outputStream.write(`${indent}${entry.name}/\n`);
                        walkDir(fullPath, indent + "  ");
                    } else {
                        if (ig.ignores(relativePath)) {
                            continue;
                        }
                        // File names are written in the structure section, content comes later
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

                        // --- FIX START: Check for binary files ---
                        if (isBinaryFile(fullPath)) {
                            outputStream.write("[Binary file detected - content excluded]\n");
                            continue;
                        }
                        // --- FIX END ---

                        try {
                            const content = fs.readFileSync(fullPath, "utf8");
                            outputStream.write(content + "\n");
                        } catch (err) {
                            outputStream.write(`[Error reading file: ${(err as Error).message}]\n`);
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