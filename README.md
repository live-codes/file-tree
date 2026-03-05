# @live-codes/file-tree

A zero-dependency, framework-agnostic file tree component written in TypeScript. Features drag-and-drop, context menus, keyboard navigation, theming, and RTL support.

For use in [LiveCodes](https://livecodes.io).

## Install

```bash
npm install @live-codes/file-tree
```

## Quick Start

```typescript
import { FileTree } from "@live-codes/file-tree";
import "@live-codes/file-tree/styles.css";

const tree = new FileTree("#container", {
  data: [
    { path: "src/index.ts", type: "file" },
    { path: "src/utils/helpers.ts", type: "file" },
    { path: "src/utils/constants.ts", type: "file" },
    { path: "package.json", type: "file" },
    { path: "README.md", type: "file" },
  ],
  selected: "src/index.ts",
  theme: "dark",
  direction: "ltr",
});

// Listen to events
tree.on("select", (e) => console.log("Selected:", e.path));
tree.on("rename", (e) => console.log("Renamed:", e.oldPath, "->", e.path));
tree.on("delete", (e) => console.log("Deleted:", e.path));
tree.on("move", (e) => console.log("Moved:", e.oldPath, "->", e.path));
tree.on("change", (e) => console.log("Tree changed:", e.tree));
```

Parent folders are **automatically created** from paths. In the example above, the `src` and `src/utils` folders are inferred from the file paths — you don't need to declare them.

You can also declare folders explicitly when you want empty folders or want to attach metadata:

```typescript
const tree = new FileTree("#container", {
  data: [
    { path: "src", type: "folder" },
    { path: "src/index.ts", type: "file" },
    { path: "dist", type: "folder" }, // empty folder
  ],
});
```

## Constructor

```typescript
new FileTree(container: HTMLElement | string, options?: FileTreeOptions)
```

The `container` argument can be a CSS selector string or an HTMLElement.

## Node Data

```typescript
interface FileTreeNodeData {
  /** Full path (e.g. "src/utils/helpers.ts") — used as the unique identifier. */
  path: string;
  /** Whether this is a file or folder. */
  type: "file" | "folder";
  /** Custom SVG string to override the default icon. */
  icon?: string;
  /** Arbitrary user data. */
  meta?: Record<string, unknown>;
}
```

### `createNode` Helper

The `createNode` utility returns an array that includes the requested node plus all intermediate parent folders:

```typescript
import { createNode } from "@live-codes/file-tree";

const nodes = createNode("src/components/Button.tsx", "file");
// Returns:
// [
//   { path: 'src', type: 'folder' },
//   { path: 'src/components', type: 'folder' },
//   { path: 'src/components/Button.tsx', type: 'file' },
// ]
```

Spread multiple `createNode` calls into your data array — duplicates are automatically deduplicated:

```typescript
const tree = new FileTree("#container", {
  data: [
    ...createNode("src/index.ts", "file"),
    ...createNode("src/utils.ts", "file"),
    ...createNode("package.json", "file"),
  ],
});
```

## Options

| Option        | Type                          | Default   | Description                              |
| ------------- | ----------------------------- | --------- | ---------------------------------------- |
| `data`        | `FileTreeNodeData[]`          | `[]`      | Initial flat data array                  |
| `selected`    | `string`                      | `''`      | Path of the initially selected node      |
| `theme`       | `'light' \| 'dark'`           | `'dark'`  | Color theme                              |
| `direction`   | `'ltr' \| 'rtl'`              | `'ltr'`   | Text direction                           |
| `indent`      | `number`                      | `16`      | Pixels per indentation level             |
| `dragAndDrop` | `boolean`                     | `true`    | Enable drag and drop                     |
| `toolbar`     | `ToolbarOptions \| false`     | See below | Toolbar configuration                    |
| `contextMenu` | `ContextMenuOptions \| false` | See below | Context menu configuration               |
| `icons`       | `Record<string, string>`      | `{}`      | Custom file extension → SVG icon map     |
| `sort`        | `boolean \| Comparator`       | `true`    | Sort nodes (folders first, alphabetical) |

### ToolbarOptions

```typescript
{
  createFile?: boolean;    // default: true
  createFolder?: boolean;  // default: true
  expandAll?: boolean;     // default: true
  collapseAll?: boolean;   // default: true
  custom?: ToolbarButton[];
}
```

### ContextMenuOptions

```typescript
{
  createFile?: boolean;    // default: true
  createFolder?: boolean;  // default: true
  rename?: boolean;        // default: true
  delete?: boolean;        // default: true
  copy?: boolean;          // default: false
  custom?: ContextMenuItem[];
}
```

### Custom Toolbar Button

```typescript
interface ToolbarButton {
  id: string;
  label: string;
  icon?: string; // SVG string
  title?: string; // Tooltip
  onClick: () => void;
}
```

### Custom Context Menu Item

```typescript
interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  visible?: (node: FileTreeNodeData) => boolean;
  onClick: (node: FileTreeNodeData) => void;
}
```

## Methods

### Tree Navigation

| Method           | Description          |
| ---------------- | -------------------- |
| `expand(path)`   | Expand a folder      |
| `collapse(path)` | Collapse a folder    |
| `expandAll()`    | Expand all folders   |
| `collapseAll()`  | Collapse all folders |
| `select(path)`   | Select a node        |

### Data Operations

| Method                                   | Description                                                  |
| ---------------------------------------- | ------------------------------------------------------------ |
| `addNode(node)`                          | Add a node (parent folders auto-created from path)           |
| `removeNode(path)`                       | Remove a node and its descendants                            |
| `renameNode(path, newName)`              | Rename a node (changes only the last path segment)           |
| `moveNode(sourcePath, targetParentPath)` | Move a node to a new parent folder (`''` or `null` for root) |
| `setData(data)`                          | Replace the entire tree                                      |
| `getData()`                              | Get a clone of the flat data array                           |
| `getNode(path)`                          | Get a single node by path                                    |
| `getSelectedNode()`                      | Get the currently selected node                              |

### Theme & Direction

| Method                         | Description           |
| ------------------------------ | --------------------- |
| `setTheme('light' \| 'dark')`  | Change the theme      |
| `getTheme()`                   | Get current theme     |
| `setDirection('ltr' \| 'rtl')` | Change text direction |
| `getDirection()`               | Get current direction |

### Lifecycle

| Method      | Description                                |
| ----------- | ------------------------------------------ |
| `destroy()` | Remove the tree and clean up all listeners |

## Events

```typescript
tree.on(eventType, handler);
tree.off(eventType, handler);
```

| Event      | Fired when                                      |
| ---------- | ----------------------------------------------- |
| `select`   | A node is selected                              |
| `expand`   | A folder is expanded                            |
| `collapse` | A folder is collapsed                           |
| `create`   | A new node is created (after name is committed) |
| `rename`   | A node is renamed                               |
| `delete`   | A node is deleted                               |
| `move`     | A node is moved via drag-and-drop or API        |
| `drop`     | External files are dropped into the tree        |
| `change`   | Any structural change to the tree data          |

Every event handler receives a `FileTreeEvent`:

```typescript
interface FileTreeEvent {
  type: FileTreeEventType;
  node: FileTreeNodeData; // The affected node
  path: string; // Current path (same as node.path)
  oldPath?: string; // Previous path (rename/move)
  parentPath: string; // Parent folder path ('' for root)
  parentNode: FileTreeNodeData | null;
  tree: FileTreeNodeData[]; // Full flat data snapshot
}
```

## Keyboard Shortcuts

| Key               | Action                               |
| ----------------- | ------------------------------------ |
| `↑` / `↓`         | Navigate between visible nodes       |
| `→`               | Expand folder or move to first child |
| `←`               | Collapse folder or move to parent    |
| `Enter` / `Space` | Toggle folder expand/collapse        |
| `F2`              | Rename selected node                 |
| `Delete`          | Delete selected node                 |

## CSS Customization

All visual properties are controlled by CSS custom properties. Override them on `.ft-root` or on theme-specific selectors:

```css
.ft-root[data-theme="dark"] {
  --ft-bg: #1a1b26;
  --ft-color: #c0caf5;
  --ft-node-hover: #292e42;
  --ft-node-selected: #33467c;
  --ft-drop-indicator: #7aa2f7;
  /* ... see styles.css for all variables */
}
```

### Integration with LiveCodes / Custom Apps

Map the file tree variables to your app's existing CSS variables:

```css
.ft-root[data-theme="dark"] {
  --ft-bg: var(--layout);
  --ft-color: var(--link);
  --ft-node-hover: var(--darker-bg-active);
  --ft-node-selected: var(--dark-bg-active);
  --ft-toolbar-bg: var(--layout);
  --ft-toolbar-border: var(--color30);
  --ft-context-bg: var(--dropdown-bg-color);
  --ft-context-border: var(--dark-bg-color);
  --ft-context-color: var(--dropdown-color);
  --ft-context-hover: var(--dropdown-bg-active);
  --ft-input-bg: var(--input-bg-color);
  --ft-input-color: var(--input-color);
  --ft-input-border: var(--input-border-color);
  --ft-border-radius: var(--rs);
}

.ft-root[data-theme="light"] {
  --ft-bg: var(--layout);
  --ft-color: var(--dark-color);
  --ft-node-hover: var(--dark-bg-active);
  --ft-node-selected: var(--color80);
  --ft-toolbar-bg: var(--layout);
  --ft-toolbar-border: var(--color80);
  --ft-context-bg: var(--dropdown);
  --ft-context-color: var(--dark-color);
}
```

## Utility Exports

The library exports a few utility functions for working with paths:

```typescript
import {
  createNode, // Create node(s) with auto parent folders
  normalizePath, // Normalize a path string
  getName, // "src/index.ts" → "index.ts"
  getParentPath, // "src/index.ts" → "src"
  getExtension, // "index.ts" → "ts"
} from "@live-codes/file-tree";
```

## Browser Support

All modern browsers (Chrome, Firefox, Safari, Edge). Uses standard HTML5 Drag and Drop API and CSS custom properties.

## License

MIT
