# Code Context Extractor

**Code Context Extractor** is a Visual Studio Code extension designed to streamline the process of feeding codebases into Large Language Models (LLMs) like GPT-4, Claude, or Gemini.

It generates a single, formatted text file (`ProjectContext.txt`) containing your project's folder structure and file contents, filtering out unnecessary noise and binary files to save tokens.

## Key Features

*   **Dual Operation Modes**:
    *   **Blacklist (Exclude) Mode**: Best for general project context. Everything is included by default; you select what to hide (e.g., `node_modules`, secrets, logs).
    *   **Whitelist (Include) Mode**: Best for specific tasks. Start with nothing. Select *only* the specific files or folders you need for a specific bug or feature.
*   **Smart Grouping**: In Exclude mode, rules are organized into "Imported Rules" (from `.gitignore`/Templates) and "Custom Rules" for better manageability.
*   **Binary File Detection**: Automatically detects binary files (images, PDFs, executables) and excludes their raw content to prevent "garbage" text in your context file.
*   **GitHub Templates**: Built-in access to standard `.gitignore` templates (Node, Python, Go, etc.) for quick setup.
*   **State Persistence**: Remembers your selection, custom rules, and active mode between sessions.

## How to Use

1.  Open the **Code Context Extractor** view from the VS Code Activity Bar (Sidebar).

### Mode 1: Exclude (Blacklist)
*Use this when you want to share the whole project but hide specific clutter.*

1.  Select **"Exclude Mode"** at the top.
2.  Click **"Load .gitignore & Templates"**. This imports rules from your project's `.gitignore`, VS Code settings, and optionally a GitHub template.
3.  **Refine the List**:
    *   **Imported Rules**: Expand the group to see standard exclusions. Uncheck items to *include* them back into the context.
    *   **Custom Rules**: Type a folder or file name (e.g., `temp/` or `*.log`) and press Enter to add it. You can delete these later using the **×** button.
4.  Click **"Generate Context File"**.

### Mode 2: Include (Whitelist)
*Use this when you want to focus on a specific feature.*

1.  Select **"Include Mode"** at the top.
2.  The list starts empty (everything is ignored by default).
3.  **Add Files**: Type specific folder names (e.g., `src/utils/`) or file names (e.g., `package.json`) and press Enter.
4.  Only the items in this list (and their contents) will be written to the output file.
5.  Click **"Generate Context File"**.

## Output

A `ProjectContext.txt` file is created in your root directory and opened automatically. It contains:
1.  A visual tree of your folder structure.
2.  The text content of every allowed file, formatted with headers for easy LLM parsing.

## Extension Settings

This extension contributes the following settings:

*   `code-context-extractor.excludeDirs`: List of directory names to exclude by default in Exclude Mode (e.g., `.git`, `.vscode`).
*   `code-context-extractor.excludeFiles`: List of file names to exclude by default in Exclude Mode (e.g., `package-lock.json`).
*   `code-context-extractor.useGitignoreTemplates`: Enable/Disable the GitHub template fetcher.

## Release Notes

### 1.1.0
- **Major Feature Update**:
    - Introduced **Whitelist (Include) Mode** for targeted context extraction.
    - Added **Binary File Detection** to prevent binary content corruption.
    - **UI Overhaul**: Added collapsible "Accordion" groups for Imported vs. Custom rules.
    - Added ability to **Delete** custom rules.
    - Improved state persistence and checkbox logic.

### 0.0.1
- Initial release.