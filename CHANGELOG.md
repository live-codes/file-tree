# Changelog

## Unreleased

### Changed

- Styles are now injected into `document.head` automatically when a `FileTree` is created, so importing `@live-codes/file-tree/styles.css` is no longer required (the stylesheet is still exported for manual use).
- New `injectStyles: false` option disables automatic style injection, letting consumers manage the stylesheet themselves.

## 0.1.0 (2026-03-06)

### Features

- File tree with nested files and folders
- Expand/collapse folders from UI and programmatically
- File type icons with extensible icon registry
- Drag and drop to move nodes and accept external drops
- Toolbar with create file/folder, expand/collapse all, and custom buttons
- Context menu with rename, delete, create, and custom operations
- Light/dark theme support (programmatic)
- LTR/RTL direction support (programmatic)
- Full event system for all file operations
- Keyboard navigation and accessibility
- CSS custom properties for UI customization
- Zero runtime dependencies
