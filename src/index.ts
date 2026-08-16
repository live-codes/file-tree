export { FileTree, defaultStrings } from "./FileTree";
export { createNode, normalizePath, getName, getParentPath, getExtension } from "./utils";

/**
 * Icon set used internally by the tree, exposed under the `icons` namespace
 * so consumers can reuse the same SVG strings (e.g. for custom toolbar
 * buttons or context-menu items). Includes `folder`, `folderOpen`, `file`,
 * per-extension file badges, toolbar icons, and the `defaultIconMap` /
 * `defaultNameIconMap` registries.
 */
export * as icons from "./icons";

export type {
  FileTreeNodeData,
  FileTreeOptions,
  FileTreeEvent,
  FileTreeEventType,
  EventHandler,
  Theme,
  Direction,
  ToolbarOptions,
  ToolbarButton,
  ContextMenuOptions,
  ContextMenuItem,
  FileTreeStringKey,
  FileTreeTranslate,
} from "./types";
