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
tree.on("copy", (e) => console.log("Copied:", e.oldPath, "->", e.path));
tree.on("move", (e) => console.log("Moved:", e.oldPath, "->", e.path));
tree.on("delete", (e) => {
  e.preventDefault();
  const confirmed = confirm(`Delete "${e.path}"?`);
  if (confirmed) tree.removeNode(e.path);
});
tree.on("change", (e) => console.log("Tree changed:", e.tree));
```

Parent folders are **automatically created** from paths. In the example above, the `src` and `src/utils` folders are inferred from the file paths — you don't need to declare them.

**Styles are injected automatically.** The component's CSS is bundled and added to `document.head` (as a `<style id="ft-styles">` tag) the first time you create a `FileTree` — no separate stylesheet import needed. If you prefer to manage the stylesheet yourself, pass `injectStyles: false` to the constructor and import `@live-codes/file-tree/styles.css` directly:

```typescript
import { FileTree } from "@live-codes/file-tree";
import "@live-codes/file-tree/styles.css";

const tree = new FileTree("#container", {
  injectStyles: false, // manage styles manually
  data: [...],
});
```

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

### Creating Nested Paths on the Fly

When creating a file or folder through the UI (toolbar buttons, context menu) or renaming one (double-click, `F2`, or the `renameNode` API), you can type a name containing slashes and the intermediate folders are created automatically:

```typescript
tree.renameNode("logo.svg", "images/logo.svg"); // file
// Creates: { path: "images", type: "folder" }, { path: "images/logo.svg", type: "file" }
```

```typescript
tree.renameNode("src", "components/ui"); // folder
// Renames: src → components/ui (and moves any children along)
```

A few rules apply:

- Slashes are only allowed in names entered through **create/rename** flows. Existing nodes with nested paths (from `data` or `addNode`) keep working as before.
- Renaming a **file** to `dir/file.txt` creates the `dir` folder and moves the file into it.
- Renaming a **folder** to `a/b` moves the folder (and its contents) to `b` under new folder `a`. A folder cannot be renamed inside itself (e.g. `a` → `a/b`).
- Backslashes (`\`) are rejected — they are treated as path separators on Windows.

## Options

| Option        | Type                          | Default   | Description                              |
| ------------- | ----------------------------- | --------- | ---------------------------------------- |
| `data`        | `FileTreeNodeData[]`          | `[]`      | Initial flat data array                  |
| `selected`    | `string`                      | `''`      | Path of the initially selected node      |
| `theme`       | `'light' \| 'dark'`           | `'dark'`  | Color theme                              |
| `direction`   | `'ltr' \| 'rtl'`              | `'ltr'`   | Text direction                           |
| `indent`      | `number`                      | `16`      | Pixels per indentation level             |
| `dragAndDrop` | `boolean`                     | `true`    | Enable drag and drop                     |
| `readOnly`    | `boolean`                     | `false`   | Disable all UI edits: keyboard shortcuts, context menu and drag & drop. Toolbar create buttons are hidden and double-click rename is disabled. Programmatic methods (`addNode`, `renameNode`, ...) still work |
| `injectStyles` | `boolean`                    | `true`    | Inject the bundled CSS into `document.head` automatically. Set to `false` to manage styles manually (e.g. import `@live-codes/file-tree/styles.css`) |
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
  copy?: boolean;          // default: true  (copy node to clipboard)
  cut?: boolean;           // default: true  (cut node to clipboard)
  paste?: boolean;         // default: true  (paste clipboard into tree)
  copyPath?: boolean;      // default: true  (copy node path to system clipboard)
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

## i18n

The built-in UI strings (toolbar tooltips and context menu labels) are in English by default. To localize them, pass a translation function via the `t` option. It receives a `FileTreeStringKey` and returns the string to display:

```typescript
import { FileTree, type FileTreeStringKey } from "@live-codes/file-tree";

const strings: Record<FileTreeStringKey, string> = {
  newFile: "Nouveau fichier",
  newFolder: "Nouveau dossier",
  expandAll: "Tout déplier",
  collapseAll: "Tout replier",
  copy: "Copier",
  cut: "Couper",
  paste: "Coller",
  copyPath: "Copier le chemin",
  rename: "Renommer",
  delete: "Supprimer",
};

const tree = new FileTree("#container", {
  data: [...],
  t: (key) => strings[key],
});
```

The library never tracks or manages languages — it only calls your function. If `t` returns `undefined` for a key, the built-in English string is used as a fallback. The English defaults are exported as `defaultStrings` and can be used to build a full locale object:

```typescript
import { defaultStrings, type FileTreeStringKey } from "@live-codes/file-tree";

const strings: Record<FileTreeStringKey, string> = {
  ...defaultStrings,
  newFile: "Nuevo archivo",
  // only override what you need
};
```

Custom toolbar buttons and context menu items are entirely user-supplied, so their `label`s are never passed through `t` — translate them yourself.

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
| `renameNode(path, newName)`              | Rename a node (changes only the last path segment; slashes in `newName` create intermediate folders on the fly) |
| `moveNode(sourcePath, targetParentPath)` | Move a node to a new parent folder (`''` or `null` for root) |
| `copyNode(sourcePath, targetParentPath)` | Copy a node to a new parent folder (`''` or `null` for root); copying to the same location duplicates it with a ` copy` suffix before the extension (e.g. `index copy.ts`); returns the new path |
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
| `copy`     | A node is copied                                |
| `move`     | A node is moved                                 |
| `rename`   | A node is renamed                               |
| `delete`   | A node is deleted                               |
| `drop`     | External files are dropped into the tree        |
| `change`   | Any structural change to the tree data          |

Every event handler receives a `FileTreeEvent`:

```typescript
interface FileTreeEvent {
  type: FileTreeEventType;
  source: "ui" | "api"; // What triggered the event
  node: FileTreeNodeData; // The affected node
  path: string; // Current path (same as node.path)
  oldPath?: string; // Previous path (rename/move)
  parentPath: string; // Parent folder path ('' for root)
  parentNode: FileTreeNodeData | null;
  tree: FileTreeNodeData[]; // Full flat data snapshot
  data?: { files: FileList; items: DataTransferItemList }; // Drag-and-drop
}
```

`source` tells you whether the event was triggered by user interaction (`"ui"` — clicks, keyboard, context menu, drag & drop) or by a programmatic API call (`"api"` — `addNode`, `renameNode`, `moveNode`, `copyNode`, `removeNode`, `select`, ...). This lets you react differently to the same event depending on its origin:

```typescript
tree.on("delete", (e) => {
  if (e.source === "ui") {
    // User pressed Delete / context menu — show a confirmation
    // dialog and call tree.removeNode() if confirmed.
    e.preventDefault();
  } else {
    // Already deleted programmatically — nothing to do.
  }
});
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
| `Ctrl/Cmd + C`    | Copy selected node                   |
| `Ctrl/Cmd + X`    | Cut selected node                    |
| `Ctrl/Cmd + V`    | Paste clipboard into selected folder |

## Read-Only Mode

Pass `readOnly: true` to disable every way of editing the tree from the UI — keyboard shortcuts (rename, delete, copy/cut/paste), the context menu, double-click rename, toolbar create buttons and drag & drop:

```typescript
const tree = new FileTree("#container", {
  data: [...],
  readOnly: true, // view-only tree
});
```

Navigation (arrow keys, selection, expand/collapse) still works, and the programmatic API (`addNode`, `renameNode`, `moveNode`, `copyNode`, `removeNode`, ...) remains fully available.

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

### Integration with Custom Apps

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

## Development

```bash
npm install          # install dependencies
npm run dev          # watch mode build
npm test             # run the test suite (Vitest + jsdom)
npm run test:watch   # run tests in watch mode
npm run test:coverage # run tests with coverage report + thresholds
npm run typecheck    # type-check src and tests
npm run lint         # lint src and tests
npm run build        # production build
```

## License

MIT
