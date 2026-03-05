/** Data structure representing a single node in the file tree. */
export interface FileTreeNodeData {
  /** Unique identifier. Auto-generated if omitted when using `createNode()`. */
  id: string;
  /** Display name of the file or folder. */
  name: string;
  /** Whether this node is a file or folder. */
  type: "file" | "folder";
  /** Child nodes (only meaningful for folders). */
  children?: FileTreeNodeData[];
  /** Optional custom SVG string to override the default icon. */
  icon?: string;
  /** Arbitrary user data attached to this node. */
  meta?: Record<string, unknown>;
}

/** Configuration for a custom toolbar button. */
export interface ToolbarButton {
  id: string;
  label: string;
  icon?: string;
  title?: string;
  onClick: () => void;
}

/** Configuration for a custom context menu item. */
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  /** Whether this item should appear for a given node. Defaults to always visible. */
  visible?: (node: FileTreeNodeData) => boolean;
  onClick: (node: FileTreeNodeData, path: string) => void;
}

export interface ToolbarOptions {
  createFile?: boolean;
  createFolder?: boolean;
  expandAll?: boolean;
  collapseAll?: boolean;
  custom?: ToolbarButton[];
}

export interface ContextMenuOptions {
  createFile?: boolean;
  createFolder?: boolean;
  rename?: boolean;
  delete?: boolean;
  copy?: boolean;
  custom?: ContextMenuItem[];
}

export type Theme = "light" | "dark";
export type Direction = "ltr" | "rtl";

/** Options passed to the FileTree constructor. */
export interface FileTreeOptions {
  /** Initial tree data. */
  data?: FileTreeNodeData[];
  /** Color theme. Default: `'dark'`. */
  theme?: Theme;
  /** Text direction. Default: `'ltr'`. */
  direction?: Direction;
  /** Pixels of indentation per depth level. Default: `16`. */
  indent?: number;
  /** Enable drag and drop. Default: `true`. */
  dragAndDrop?: boolean;
  /** Toolbar configuration. Set to `false` to hide. */
  toolbar?: ToolbarOptions | false;
  /** Context menu configuration. Set to `false` to disable. */
  contextMenu?: ContextMenuOptions | false;
  /** Map of file extension (without dot) to SVG string for custom icons. */
  icons?: Record<string, string>;
  /** Sort nodes. `true` for default (folders first, alphabetical). Or provide a custom comparator. */
  sort?: boolean | ((a: FileTreeNodeData, b: FileTreeNodeData) => number);
}

/** All possible event types emitted by the file tree. */
export type FileTreeEventType =
  | "select"
  | "expand"
  | "collapse"
  | "create"
  | "rename"
  | "delete"
  | "move"
  | "drop"
  | "change";

/** Payload included with every emitted event. */
export interface FileTreeEvent {
  /** The type of event. */
  type: FileTreeEventType;
  /** The node involved in this event. */
  node: FileTreeNodeData;
  /** Full path of the node (e.g. `"src/utils/helpers.ts"`). */
  path: string;
  /** Previous path, for rename and move events. */
  oldPath?: string;
  /** Parent node, or `null` for root-level nodes. */
  parentNode: FileTreeNodeData | null;
  /** Full snapshot of the current tree data. */
  tree: FileTreeNodeData[];
}

export type EventHandler = (event: FileTreeEvent) => void;

/** Internal representation of a rendered node. */
export interface InternalNode {
  id: string;
  parentId: string | null;
  data: FileTreeNodeData;
  depth: number;
  expanded: boolean;
  el: HTMLElement;
  contentEl: HTMLElement;
  childrenEl: HTMLElement | null;
  nameEl: HTMLElement;
  arrowEl: HTMLElement | null;
  iconEl: HTMLElement;
}
