# Change Log

All notable changes to the "code-context-extractor" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.2.0]

### Added
- **Whitelist (Include) Mode**: Added a new mode to start with an empty context and strictly select specific files or folders to include.
- **Binary File Detection**: Implemented a heuristic to detect binary files (images, executables, PDFs) and automatically exclude their raw content from the output file.
- **Rule Grouping**: In Exclude mode, rules are now organized into collapsible "Imported Rules" (from .gitignore) and "Custom Rules" sections.
- **Delete Functionality**: Added the ability to delete custom rules from the list.
- **State Persistence**: The extension now saves the selected mode and rule lists between sessions.

### Changed
- **UI Overhaul**: Replaced simple checkboxes with a grouped accordion layout and native-style toggle controls.
- Improved the recursive logic for un-ignoring folders in Whitelist mode to ensure nested files are captured correctly.

## [0.0.1]

- Initial release