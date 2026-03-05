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
    {
      id: "1",
      name: "src",
      type: "folder",
      children: [
        { id: "2", name: "index.ts", type: "file" },
        { id: "3", name: "utils.ts", type: "file" },
      ],
    },
    { id: "4", name: "package.json", type: "file" },
    { id: "5", name: "README.md", type: "file" },
  ],
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

## Constructor

```typescript
new FileTree(container: HTMLElement | string, options?: FileTreeOptions)
```

The `container` argument can be a CSS selector string or an HTMLElement. The file tree will be appended inside it.

## Options

| Option        | Type                          | Default   | Description                              |
| ------------- | ----------------------------- | --------- | ---------------------------------------- |
| `data`        | `FileTreeNodeData[]`          | `[]`      | Initial tree data                        |
| `theme`       | `'light' \| 'dark'`           | `'dark'`  | Color theme                              |
| `direction`   | `'ltr' \| 'rtl'`              | `'ltr'`   | Text direction                           |
| `indent`      | `number`                      | `16`      | Pixels per indentation level             |
| `dragAndDrop` | `boolean`                     | `true`    | Enable drag and drop                     |
| `toolbar`     | `ToolbarOptions \| false`     | See below | Toolbar configuration                    |
| `contextMenu` | `ContextMenuOptions \| false` | See below | Context menu configuration               |
| `icons`       | `Record<string, string>`      | `{}`      | Custom file extension → SVG icon mapping |
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
  onClick: (node: FileTreeNodeData, path: string) => void;
}
```

## Node Data

```typescript
interface FileTreeNodeData {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileTreeNodeData[];
  icon?: string; // Custom SVG string
  meta?: Record<string, unknown>; // Arbitrary user data
}
```

Use the helper to create nodes with auto-generated IDs:

```typescript
import { createNode } from "@live-codes/file-tree";

const file = createNode("index.ts", "file");
const folder = createNode("src", "folder", [file]);
```

## Methods

### Tree Operations

| Method          | Description          |
| --------------- | -------------------- |
| `expand(id)`    | Expand a folder      |
| `collapse(id)`  | Collapse a folder    |
| `expandAll()`   | Expand all folders   |
| `collapseAll()` | Collapse all folders |
| `select(id)`    | Select a node        |

### Data Operations

| Method                                     | Description                       |
| ------------------------------------------ | --------------------------------- |
| `addNode(parentId, node, index?)`          | Add a node                        |
| `removeNode(id)`                           | Remove a node                     |
| `renameNode(id, newName)`                  | Rename a node                     |
| `moveNode(nodeId, targetParentId, index?)` | Move a node                       |
| `setData(data)`                            | Replace the entire tree           |
| `getData()`                                | Get a deep clone of the tree data |
| `getNode(id)`                              | Get a single node by ID           |
| `getPath(id)`                              | Get the full path of a node       |
| `getSelectedNode()`                        | Get the currently selected node   |

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

| Event      | Fired when                               |
| ---------- | ---------------------------------------- |
| `select`   | A node is selected                       |
| `expand`   | A folder is expanded                     |
| `collapse` | A folder is collapsed                    |
| `create`   | A new node is created                    |
| `rename`   | A node is renamed                        |
| `delete`   | A node is deleted                        |
| `move`     | A node is moved via drag-and-drop or API |
| `drop`     | External files are dropped into the tree |
| `change`   | Any structural change to the tree data   |

Every event handler receives a `FileTreeEvent`:

```typescript
interface FileTreeEvent {
  type: FileTreeEventType;
  node: FileTreeNodeData; // The affected node
  path: string; // Current path
  oldPath?: string; // Previous path (rename/move)
  parentNode: FileTreeNodeData | null;
  tree: FileTreeNodeData[]; // Full tree snapshot
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

## Browser Support

All modern browsers (Chrome, Firefox, Safari, Edge). Uses standard HTML5 Drag and Drop API and CSS custom properties.

## License

MIT
