# Code Context Extractor

**Code Context Extractor** is a Visual Studio Code extension designed to streamline the process of feeding codebases into Large Language Models (LLMs) like GPT-4, Claude, or Gemini.

It generates a single, formatted text file (`ProjectContext.txt`) containing your project's folder structure and file contents, filtering out unnecessary noise.

## Key Features

*   **Dual Modes**:
    *   **Blacklist (Exclude) Mode**: Standard behavior. Everything is included by default; you select what to hide (e.g., `node_modules`, secrets, logs).
    *   **Whitelist (Include) Mode**: Start with nothing. Select *only* the specific files or folders you want to share. Perfect for focused debugging.
*   **.gitignore Integration**: Automatically imports rules from your project's `.gitignore` and VS Code settings.
*   **Smart Binary Detection**: Automatically detects binary files (images, PDFs, executables) and excludes their raw content to prevent "garbage" text in your context file.
*   **State Persistence**: Remembers your selection and mode between sessions, so you don't have to re-select files every time you restart VS Code.
*   **GitHub Templates**: Built-in access to standard `.gitignore` templates (Node, Python, Go, etc.) for quick setup.

## How to Use

1.  Open the **Code Context Extractor** view from the Activity Bar.
2.  **Select a Mode**:
    *   **Exclude Mode**: Click "Load .gitignore & Templates". Uncheck items you want to *keep*, check items you want to *hide*.
    *   **Include Mode**: The list starts empty. Type folder names (e.g., `src/`) or file names to add them. Check items to *include* them.
3.  **Review**: Toggle the checkboxes to fine-tune your selection.
4.  **Generate**: Click **"Generate Context File"**.
5.  A `ProjectContext.txt` file is created in your root directory and opened automatically.

## Extension Settings

*   `code-context-extractor.excludeDirs`: Default directories to exclude in "Exclude Mode" (e.g., `.git`, `.vscode`).
*   `code-context-extractor.excludeFiles`: Default files to exclude in "Exclude Mode" (e.g., `package-lock.json`).

## Release Notes

### 0.0.2
- Added **Whitelist (Include) Mode**.
- Added **Binary File Detection** to prevent corruption of the output text file.
- Improved UI with persistent state saving.
- Fixed UI glitches with toggle buttons.