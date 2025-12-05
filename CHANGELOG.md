# Change Log

All notable changes to the "code-context-extractor" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.4.0]

### Fixed
- **Deep Folder Traversal in Include Mode**: Fixed a critical issue where deeply nested folders (e.g., `migrations/` inside `pkg/database/`) were ignored because their parent directories were not explicitly un-ignored. The extension now automatically detects and un-ignores the entire directory chain leading to your selected files.
- **Folder Search Logic**: Fixed an issue where typing a folder name (e.g., `configs`) failed to include files. The system now performs a deep search to locate files within the requested directories.

### Improved
- **Path Resolution**: Include Mode now supports:
  - **Relative Paths**: You can paste specific paths like `pkg/routes/public_route.go`.
  - **Deep Folder Names**: Typing `migrations/` will find that folder wherever it is.
  - **Wildcards**: `*.sql` will correctly find and include SQL files in nested directories.

## [1.3.0]
- **Whitelist (Include) Mode**: Added a new mode to start with an empty context and strictly select specific files or folders to include.
- **Binary File Detection**: Implemented a heuristic to detect binary files (images, executables, PDFs) and automatically exclude their raw content.
- **Rule Grouping**: Exclude mode rules are now organized into collapsible "Imported Rules" and "Custom Rules" sections.
- **State Persistence**: The extension saves the selected mode and rule lists between sessions.

## [0.0.1]
- Initial release