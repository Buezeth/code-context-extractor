# Code Context Extractor

This Visual Studio Code extension helps you create a single text file containing your project's folder structure and the content of all relevant files. It's designed to make it easy to copy-paste your entire project's context into large language models (LLMs) like GPT-4, Claude, or Gemini.

## Features

*   **Sidebar UI**: An easy-to-use interface right in the VS Code activity bar.
*   **.gitignore Integration**: Automatically loads rules from your project's `.gitignore` file and your global VS Code settings to provide a smart starting point for exclusions.
*   **Template Loading**: Choose from standard `.gitignore` templates (e.g., Node, Python, Go) to quickly add common ignore patterns for your project type.
*   **Dynamic Filtering**: Easily review, modify, and add custom rules to fine-tune which files and folders are included in the final context file.
*   **State Persistence**: Your list of ignore rules is saved per workspace, so you don't have to reconfigure it every time you open VS Code.

## How to Use

1.  Click on the **Code Context Extractor** icon in the activity bar to open the sidebar.
2.  Click **"Load / Refresh Ignore Rules"**. This will populate a list of files and folders to exclude based on your project's `.gitignore` and settings. You can also select a standard template to add more rules.
3.  In "Step 2", review the list of rules. Uncheck any files or folders you *want* to include. Add any custom rules you need.
4.  Click **"Generate Context File"**.
5.  A `ProjectContext.txt` file will be created in the root of your workspace and automatically opened for you.

## Extension Settings

This extension contributes the following settings:

*   `code-context-extractor.excludeDirs`: A list of directory names to always exclude (e.g., "node_modules", ".git").
*   `code-context-extractor.excludeFiles`: A list of file names to always exclude (e.g., "package-lock.json").

## Release Notes

### 0.0.1

- Initial release of Code Context Extractor.
- Added sidebar UI for generating context files.
- Implemented .gitignore and settings integration.
- Added GitHub .gitignore template fetching.