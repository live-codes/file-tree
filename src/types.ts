/** Data structure representing a single node in the file tree. */
export interface FileTreeNodeData {
  /** Path of the file or folder (e.g. "src/utils/helpers.ts"). */
  path: string;
  /** Whether this node is a file or folder. */
  type: "file" | "folder";
  /** Optional custom SVG string to override the default icon. */
  icon?: string;
  /** Arbitrary user data attached to this node. */
  meta?: Record<string, unknown>;
}

/** Configuration for a custom toolbar button. */
export interface ToolbarButton {
  id: string;
  /** Button tooltip (shown on hover). */
  label: string;
  icon?: string;
  onClick: () => void;
  /**
   * Position of this button relative to the built-in toolbar buttons.
   * Built-ins own fixed slots: `createFile`=0, `createFolder`=1,
   * `expandAll`=2, `collapseAll`=3. `order: N` inserts the button after the
   * built-in that owns slot N (e.g. `order: 1` makes it the third button).
   * Omit to append after all built-ins in array order.
   */
  order?: number;
}

/** Configuration for a custom context menu item. */
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  /** Whether this item should appear for a given node. Defaults to always visible. */
  visible?: (node: FileTreeNodeData) => boolean;
  /**
   * Called when the item is clicked. `nodes` is the array of nodes the
   * operation applies to (all selected nodes, or just the right-clicked
   * node when it is not part of a multi-selection). `primaryNode` is the
   * node the context menu was opened on.
   */
  onClick: (
    nodes: FileTreeNodeData[],
    primaryNode: FileTreeNodeData,
  ) => void;
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
  /** Copy a node to the clipboard (duplicate it via Paste). Default: `true`. */
  copy?: boolean;
  /** Cut a node to the clipboard (move it via Paste). Default: `true`. */
  cut?: boolean;
  /** Paste the clipboard contents into the tree. Default: `true`. */
  paste?: boolean;
  /** Copy the node's full path to the system clipboard. Default: `false`. */
  copyPath?: boolean;
  custom?: ContextMenuItem[];
}

export type Theme = "light" | "dark";
export type Direction = "ltr" | "rtl";

/**
 * Keys for the user-facing strings rendered by the library.
 * Pass a translation function via the `t` option to localize them.
 */
export type FileTreeStringKey =
  | "newFile"
  | "newFolder"
  | "expandAll"
  | "collapseAll"
  | "copy"
  | "cut"
  | "paste"
  | "copyPath"
  | "rename"
  | "delete";

/**
 * Translates a built-in string key to a localized string.
 * Supplied via the `t` option for i18n.
 */
export type FileTreeTranslate = (key: FileTreeStringKey) => string;

/** Options passed to the FileTree constructor. */
export interface FileTreeOptions {
  /** Initial tree data (flat array). Parent folders are auto-created from paths. */
  data?: FileTreeNodeData[];
  /** Path (or array of paths) of the initially selected node(s). Parent folders are auto-expanded. */
  selected?: string | string[];
  /** Color theme. Default: `'dark'`. */
  theme?: Theme;
  /** Text direction. Default: `'ltr'`. */
  direction?: Direction;
  /** Pixels of indentation per depth level. Default: `16`. */
  indent?: number;
  /** Enable drag and drop. Default: `true`. */
  dragAndDrop?: boolean;
  /**
   * Disable all edits via the UI: keyboard shortcuts, the context menu
   * and drag & drop. Toolbar buttons that create files/folders are also
   * hidden, and double-click rename is disabled. Programmatic methods
   * (`addNode`, `renameNode`, ...) remain available. Default: `false`.
   */
  readOnly?: boolean;
  /**
   * Automatically inject the component's bundled stylesheet into
   * `document.head` (once) when the tree is created. Set to `false`
   * to manage the stylesheet yourself, e.g. by importing
   * `@live-codes/file-tree/styles.css`. Default: `true`.
   */
  injectStyles?: boolean;
  /** Toolbar configuration. Set to `false` to hide. */
  toolbar?: ToolbarOptions | false;
  /** Context menu configuration. Set to `false` to disable. */
  contextMenu?: ContextMenuOptions | false;
  /** Map of file extension (without dot) to SVG string for custom icons. */
  icons?: Record<string, string>;
  /** Sort nodes. `true` for default (folders first, alphabetical). Or provide a custom comparator. */
  sort?: boolean | ((a: FileTreeNodeData, b: FileTreeNodeData) => number);
  /**
   * Translate function for built-in UI strings (toolbar tooltips, context menu
   * labels). Takes a `FileTreeStringKey` and returns the localized string.
   * Defaults to the built-in English strings.
   */
  t?: FileTreeTranslate;
}

/** All possible event types emitted by the file tree. */
export type FileTreeEventType =
  | "select"
  | "expand"
  | "collapse"
  | "create"
  | "copy"
  | "rename"
  | "delete"
  | "move"
  | "drop"
  | "change";

/** Who triggered the event: the user interacting with the UI, or a programmatic API call. */
export type FileTreeEventSource = "ui" | "api";

/** Payload included with every emitted event. */
export interface FileTreeEvent {
  /** The type of event. */
  type: FileTreeEventType;
  /** Whether this event was triggered by the UI or by the API. */
  source: FileTreeEventSource;
  /** The node involved in this event. */
  node: FileTreeNodeData;
  /** Full path of the node. Same as `node.path`. */
  path: string;
  /** Previous path, for rename and move events. */
  oldPath?: string;
  /**
   * All affected node paths for multi-node operations (e.g. deleting a
   * multi-selection). Single-node fields (`path`, `node`) always refer to
   * the first entry. Absent for single-node events.
   */
  paths?: string[];
  /** Node data for each path in `paths`. */
  nodes?: FileTreeNodeData[];
  /** Parent folder path. Empty string for root-level nodes. */
  parentPath: string;
  /** Parent node data, or `null` for root-level nodes. */
  parentNode: FileTreeNodeData | null;
  /** Full snapshot of the current flat data array. */
  tree: FileTreeNodeData[];
  /** Data passed to the event. */
  data?: { files: FileList; items: DataTransferItemList };
  /**
   * Whether `preventDefault()` has been called on this event.
   * Only checked for certain event types (currently `delete`).
   */
  defaultPrevented: boolean;
  /**
   * Call to cancel the default behavior associated with this event.
   * For `delete` events this prevents the node from being removed,
   * allowing the consumer to show a confirmation dialog and later
   * call `removeNode()` programmatically.
   */
  preventDefault: () => void;
}

export type EventHandler = (event: FileTreeEvent) => void;

/** Hierarchical node used internally for rendering the flat data as a tree. */
export interface HierarchyNode {
  name: string;
  path: string;
  type: "file" | "folder";
  data: FileTreeNodeData;
  children: HierarchyNode[];
}

/** Internal representation of a rendered DOM node. */
export interface InternalNode {
  path: string;
  parentPath: string;
  name: string;
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
