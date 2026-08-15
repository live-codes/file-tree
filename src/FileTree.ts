import { EventEmitter } from "./EventEmitter";
import { injectStyles } from "./styles";
import { ContextMenu, type ContextMenuEntry } from "./ContextMenu";
import { DragDrop, type DropPosition } from "./DragDrop";
import {
  chevron,
  folder,
  folderOpen,
  file as fileIcon,
  newFile,
  newFolder,
  expandAllIcon,
  collapseAllIcon,
  editIcon,
  trashIcon,
  copyIcon,
  cutIcon,
  pasteIcon,
  defaultIconMap,
  defaultNameIconMap,
} from "./icons";
import {
  normalizePath,
  getParentPath,
  getName,
  getExtension,
  normalizeData,
  buildHierarchy,
  cloneData,
  updatePathsInData,
  updatePathsInSet,
  isDescendant,
  createNode,
} from "./utils";
import type {
  FileTreeNodeData,
  FileTreeOptions,
  FileTreeEvent,
  FileTreeEventType,
  FileTreeEventSource,
  EventHandler,
  InternalNode,
  HierarchyNode,
  Theme,
  Direction,
  ToolbarOptions,
  ContextMenuOptions,
  FileTreeStringKey,
  FileTreeTranslate,
} from "./types";

/** Built-in English strings used when no `t` function is provided. */
export const defaultStrings: Record<FileTreeStringKey, string> = {
  newFile: "New File",
  newFolder: "New Folder",
  expandAll: "Expand All",
  collapseAll: "Collapse All",
  copyPath: "Copy Path",
  copy: "Copy",
  cut: "Cut",
  paste: "Paste",
  rename: "Rename",
  delete: "Delete",
};

const DEFAULT_OPTIONS: Required<FileTreeOptions> = {
  data: [],
  selected: "",
  theme: "dark",
  direction: "ltr",
  indent: 16,
  dragAndDrop: true,
  readOnly: false,
  injectStyles: true,
  toolbar: {
    createFile: true,
    createFolder: true,
    expandAll: true,
    collapseAll: true,
    custom: [],
  },
  contextMenu: {
    createFile: true,
    createFolder: true,
    rename: true,
    delete: true,
    copy: true,
    cut: true,
    paste: true,
    copyPath: true,
    custom: [],
  },
  icons: {},
  sort: true,
  t: (key: FileTreeStringKey): string => defaultStrings[key],
};

export class FileTree {
  // ── Internal State ──────────────────────────────────────

  private root: HTMLElement;
  private toolbarEl: HTMLElement | null = null;
  private treeEl: HTMLElement;
  private data: FileTreeNodeData[];
  private hierarchy: HierarchyNode[] = [];
  private options: Required<FileTreeOptions>;
  private nodeMap = new Map<string, InternalNode>();
  private expandedNodes = new Set<string>();
  private selectedPath: string | null = null;
  private emitter = new EventEmitter<
    Record<FileTreeEventType, FileTreeEvent>
  >();
  private contextMenu: ContextMenu;
  private dragDrop: DragDrop | null = null;
  private iconMap: Record<string, string>;
  private nameIconMap: Record<string, string>;
  private renamingPath: string | null = null;
  private pendingNewNodePath: string | null = null;
  private clipboard: { path: string; type: "copy" | "cut" } | null = null;
  private t: FileTreeTranslate;

  // ── Constructor ─────────────────────────────────────────

  constructor(container: HTMLElement | string, options?: FileTreeOptions) {
    const el =
      typeof container === "string"
        ? document.querySelector(container)
        : container;
    if (!el || !(el instanceof HTMLElement)) {
      throw new Error("[file-tree-js] Invalid container element.");
    }

    this.options = this.mergeOptions(options);
    this.data = normalizeData(this.options.data);
    this.t = (key: FileTreeStringKey): string =>
      this.options.t(key) ?? defaultStrings[key];
    this.iconMap = { ...defaultIconMap, ...this.options.icons };
    this.nameIconMap = { ...defaultNameIconMap };

    // Inject the bundled stylesheet into the document once (unless disabled).
    if (this.options.injectStyles) {
      injectStyles();
    }

    // Root element
    this.root = document.createElement("div");
    this.root.className = "ft-root";
    this.root.dataset.theme = this.options.theme;
    this.root.dir = this.options.direction;
    this.root.tabIndex = 0;
    el.appendChild(this.root);

    // Toolbar
    if (this.options.toolbar !== false) {
      this.toolbarEl = this.renderToolbar();
      this.root.appendChild(this.toolbarEl);
    }

    // Tree container
    this.treeEl = document.createElement("div");
    this.treeEl.className = "ft-tree";
    this.treeEl.setAttribute("role", "tree");
    this.root.appendChild(this.treeEl);

    // Context menu
    this.contextMenu = new ContextMenu(this.root);

    // Drag & drop
    if (this.options.dragAndDrop && !this.options.readOnly) {
      this.dragDrop = new DragDrop(this.treeEl, {
        getNode: (path) => this.nodeMap.get(path),
        onMove: (src, tgt, pos) => this.handleDragMove(src, tgt, pos),
        onExternalDrop: (entries, tgt, pos) =>
          this.handleExternalDrop(entries, tgt, pos),
      });
    }

    // Render tree
    this.renderTree();

    // Apply initial selection (expands parents automatically)
    if (this.options.selected) {
      this.select(this.options.selected);
    }

    // Keyboard
    this.root.addEventListener("keydown", this.onKeydown.bind(this));
  }

  // ── Options ─────────────────────────────────────────────

  private mergeOptions(opts?: FileTreeOptions): Required<FileTreeOptions> {
    if (!opts) return { ...DEFAULT_OPTIONS };
    return {
      data: opts.data ?? DEFAULT_OPTIONS.data,
      selected: opts.selected ?? DEFAULT_OPTIONS.selected,
      theme: opts.theme ?? DEFAULT_OPTIONS.theme,
      direction: opts.direction ?? DEFAULT_OPTIONS.direction,
      indent: opts.indent ?? DEFAULT_OPTIONS.indent,
      dragAndDrop: opts.dragAndDrop ?? DEFAULT_OPTIONS.dragAndDrop,
      readOnly: opts.readOnly ?? DEFAULT_OPTIONS.readOnly,
      injectStyles: opts.injectStyles ?? DEFAULT_OPTIONS.injectStyles,
      toolbar:
        opts.toolbar === undefined
          ? DEFAULT_OPTIONS.toolbar
          : opts.toolbar === false
            ? false
            : {
                ...(DEFAULT_OPTIONS.toolbar as ToolbarOptions),
                ...opts.toolbar,
              },
      contextMenu:
        opts.contextMenu === undefined
          ? DEFAULT_OPTIONS.contextMenu
          : opts.contextMenu === false
            ? false
            : {
                ...(DEFAULT_OPTIONS.contextMenu as ContextMenuOptions),
                ...opts.contextMenu,
              },
      icons: opts.icons ?? DEFAULT_OPTIONS.icons,
      sort: opts.sort ?? DEFAULT_OPTIONS.sort,
      t: opts.t ?? DEFAULT_OPTIONS.t,
    };
  }

  // ── Toolbar ─────────────────────────────────────────────

  private renderToolbar(): HTMLElement {
    const tb = document.createElement("div");
    tb.className = "ft-toolbar";
    const cfg = this.options.toolbar as ToolbarOptions;

    if (cfg.createFile && !this.options.readOnly) {
      tb.appendChild(
        this.toolbarBtn(this.t("newFile"), newFile, () =>
          this.createNewNode("file"),
        ),
      );
    }
    if (cfg.createFolder && !this.options.readOnly) {
      tb.appendChild(
        this.toolbarBtn(this.t("newFolder"), newFolder, () =>
          this.createNewNode("folder"),
        ),
      );
    }
    if (cfg.expandAll) {
      tb.appendChild(
        this.toolbarBtn(this.t("expandAll"), expandAllIcon, () =>
          this.expandAll(),
        ),
      );
    }
    if (cfg.collapseAll) {
      tb.appendChild(
        this.toolbarBtn(this.t("collapseAll"), collapseAllIcon, () =>
          this.collapseAll(),
        ),
      );
    }

    if (cfg.custom) {
      for (const btn of cfg.custom) {
        tb.appendChild(
          this.toolbarBtn(
            btn.title ?? btn.label,
            btn.icon ?? "",
            btn.onClick,
            btn.id,
          ),
        );
      }
    }

    return tb;
  }

  private toolbarBtn(
    title: string,
    icon: string,
    onClick: () => void,
    id?: string,
  ): HTMLElement {
    const btn = document.createElement("button");
    btn.className = "ft-toolbar__btn";
    btn.title = title;
    btn.type = "button";
    if (id) btn.dataset.btnId = id;
    btn.innerHTML = icon;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  // ── Tree Rendering ──────────────────────────────────────

  private renderTree(): void {
    this.treeEl.innerHTML = "";
    this.nodeMap.clear();
    this.hierarchy = buildHierarchy(this.data, this.options.sort);
    for (const hNode of this.hierarchy) {
      this.renderNode(hNode, 0, "", this.treeEl);
    }
  }

  private renderNode(
    hNode: HierarchyNode,
    depth: number,
    parentPath: string,
    container: HTMLElement,
  ): void {
    const isFolder = hNode.type === "folder";
    const expanded = this.expandedNodes.has(hNode.path);

    // Node wrapper
    const el = document.createElement("div");
    el.className = "ft-node";
    el.dataset.path = hNode.path;
    el.dataset.type = hNode.type;
    el.setAttribute("role", "treeitem");
    if (this.options.dragAndDrop && !this.options.readOnly) {
      el.draggable = true;
    }

    // Content row
    const contentEl = document.createElement("div");
    contentEl.className = "ft-node__content";
    contentEl.style.paddingInlineStart = `${depth * this.options.indent + 4}px`;

    // Arrow (folders only)
    let arrowEl: HTMLElement | null = null;
    if (isFolder) {
      arrowEl = document.createElement("span");
      arrowEl.className = "ft-node__arrow";
      if (expanded) arrowEl.classList.add("ft-node__arrow--open");
      arrowEl.innerHTML = chevron;
      contentEl.appendChild(arrowEl);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "ft-node__arrow-spacer";
      contentEl.appendChild(spacer);
    }

    // Icon
    const iconEl = document.createElement("span");
    iconEl.className = "ft-node__icon";
    iconEl.innerHTML = this.resolveIcon(hNode.data, hNode.name, expanded);
    contentEl.appendChild(iconEl);

    // Name
    const nameEl = document.createElement("span");
    nameEl.className = "ft-node__name";
    nameEl.textContent = hNode.name;
    contentEl.appendChild(nameEl);

    el.appendChild(contentEl);

    // Children container (folders only)
    let childrenEl: HTMLElement | null = null;
    if (isFolder) {
      childrenEl = document.createElement("div");
      childrenEl.className = "ft-node__children";
      if (!expanded) childrenEl.style.display = "none";
      el.appendChild(childrenEl);

      for (const child of hNode.children) {
        this.renderNode(child, depth + 1, hNode.path, childrenEl);
      }
    }

    // Store internal reference
    const internalNode: InternalNode = {
      path: hNode.path,
      parentPath,
      name: hNode.name,
      data: hNode.data,
      depth,
      expanded,
      el,
      contentEl,
      childrenEl,
      nameEl,
      arrowEl,
      iconEl,
    };
    this.nodeMap.set(hNode.path, internalNode);

    // Events
    const nodePath = hNode.path;

    contentEl.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.renamingPath) return;
      this.selectNode(nodePath);
      if (isFolder) this.toggleExpand(nodePath);
    });

    contentEl.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      if (this.renamingPath || this.options.readOnly) return;
      if (
        this.options.contextMenu !== false &&
        (this.options.contextMenu as ContextMenuOptions).rename
      ) {
        this.startRename(nodePath);
      }
    });

    contentEl.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.selectNode(nodePath);
      this.showContextMenu(nodePath, e.clientX, e.clientY);
    });

    container.appendChild(el);
  }

  // ── Icon Resolution ─────────────────────────────────────

  private resolveIcon(
    data: FileTreeNodeData,
    name: string,
    expanded: boolean,
  ): string {
    if (data.icon) return data.icon;
    if (data.type === "folder") return expanded ? folderOpen : folder;

    // Check name-based icons
    if (this.nameIconMap[name]) return this.nameIconMap[name];

    // Extension-based
    const ext = getExtension(name);
    if (ext && this.iconMap[ext]) return this.iconMap[ext];

    return fileIcon;
  }

  // ── Selection ───────────────────────────────────────────

  private selectNode(
    path: string,
    source: FileTreeEventSource = "ui",
  ): void {
    if (this.selectedPath) {
      const prev = this.nodeMap.get(this.selectedPath);
      prev?.contentEl.classList.remove("ft-node__content--selected");
    }
    this.selectedPath = path;
    const node = this.nodeMap.get(path);
    node?.contentEl.classList.add("ft-node__content--selected");

    this.emitEvent("select", path, undefined, undefined, source);
  }

  // ── Expand / Collapse ───────────────────────────────────

  private toggleExpand(path: string): void {
    if (this.expandedNodes.has(path)) {
      this.collapse(path);
    } else {
      this.expand(path);
    }
  }

  expand(path: string, source: FileTreeEventSource = "ui"): void {
    const p = normalizePath(path);
    const node = this.nodeMap.get(p);
    if (!node || node.data.type !== "folder") return;
    if (this.expandedNodes.has(p)) return;

    this.expandedNodes.add(p);
    node.expanded = true;
    node.arrowEl?.classList.add("ft-node__arrow--open");
    if (node.childrenEl) node.childrenEl.style.display = "";
    node.iconEl.innerHTML = this.resolveIcon(node.data, node.name, true);

    this.emitEvent("expand", p, undefined, undefined, source);
  }

  collapse(path: string, source: FileTreeEventSource = "ui"): void {
    const p = normalizePath(path);
    const node = this.nodeMap.get(p);
    if (!node || node.data.type !== "folder") return;
    if (!this.expandedNodes.has(p)) return;

    this.expandedNodes.delete(p);
    node.expanded = false;
    node.arrowEl?.classList.remove("ft-node__arrow--open");
    if (node.childrenEl) node.childrenEl.style.display = "none";
    node.iconEl.innerHTML = this.resolveIcon(node.data, node.name, false);

    this.emitEvent("collapse", p, undefined, undefined, source);
  }

  expandAll(source: FileTreeEventSource = "ui"): void {
    this.nodeMap.forEach((node) => {
      if (node.data.type === "folder") this.expand(node.path, source);
    });
  }

  collapseAll(source: FileTreeEventSource = "ui"): void {
    this.nodeMap.forEach((node) => {
      if (node.data.type === "folder") this.collapse(node.path, source);
    });
  }

  // ── Context Menu ────────────────────────────────────────

  private showContextMenu(path: string, x: number, y: number): void {
    if (this.options.contextMenu === false || this.options.readOnly) return;
    const cfg = this.options.contextMenu as ContextMenuOptions;
    const nodeData = this.data.find((d) => d.path === path);
    if (!nodeData) return;

    const entries: ContextMenuEntry[] = [];

    const addSeparator = (): void => {
      if (entries.length > 0) {
        entries.push({
          id: `sep-${entries.length}`,
          label: "",
          separator: true,
          onClick: () => {},
        });
      }
    };

    if (nodeData.type === "folder" && cfg.createFile) {
      entries.push({
        id: "create-file",
        label: this.t("newFile"),
        icon: newFile,
        onClick: () => this.createNewNode("file", path),
      });
    }

    if (nodeData.type === "folder" && cfg.createFolder) {
      entries.push({
        id: "create-folder",
        label: this.t("newFolder"),
        icon: newFolder,
        onClick: () => this.createNewNode("folder", path),
      });
    }

    // Clipboard actions
    if (cfg.copy) {
      addSeparator();
      entries.push({
        id: "copy",
        label: this.t("copy"),
        icon: copyIcon,
        shortcut: this.modKeyLabel + "C",
        onClick: () => this.copyToClipboard(path),
      });
    }

    if (cfg.cut) {
      entries.push({
        id: "cut",
        label: this.t("cut"),
        icon: cutIcon,
        shortcut: this.modKeyLabel + "X",
        onClick: () => this.cutNode(path),
      });
    }

    if (cfg.paste && this.clipboard) {
      entries.push({
        id: "paste",
        label: this.t("paste"),
        icon: pasteIcon,
        shortcut: this.modKeyLabel + "V",
        onClick: () => this.pasteNode(path),
      });
    }

    if (cfg.copyPath) {
      addSeparator();
      entries.push({
        id: "copy-path",
        label: this.t("copyPath"),
        icon: copyIcon,
        onClick: () => {
          navigator.clipboard?.writeText(path).catch(() => {});
        },
      });
    }

    if (cfg.rename) {
      addSeparator();
      entries.push({
        id: "rename",
        label: this.t("rename"),
        icon: editIcon,
        shortcut: "F2",
        onClick: () => this.startRename(path),
      });
    }

    if (cfg.delete) {
      entries.push({
        id: "delete",
        label: this.t("delete"),
        icon: trashIcon,
        shortcut: "Del",
        onClick: () => this.deleteNode(path),
      });
    }

    if (cfg.custom && cfg.custom.length > 0) {
      const visibleCustom = cfg.custom.filter(
        (c) => !c.visible || c.visible(nodeData),
      );
      if (visibleCustom.length > 0) {
        addSeparator();
      }
      for (const c of visibleCustom) {
        entries.push({
          id: c.id,
          label: c.label,
          icon: c.icon,
          shortcut: c.shortcut,
          onClick: () => c.onClick(nodeData),
        });
      }
    }

    if (entries.length === 0) return;

    // Convert page coordinates to root-relative
    const rootRect = this.root.getBoundingClientRect();
    this.contextMenu.show(x - rootRect.left, y - rootRect.top, entries);
  }

  /** Modifier key label for shortcut hints (⌘ on macOS, Ctrl elsewhere). */
  private get modKeyLabel(): string {
    return navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl+";
  }

  // ── Clipboard (Copy / Cut / Paste) ──────────────────────

  /** Copy a node to the internal clipboard for later Paste (duplicate). */
  copyToClipboard(path: string): void {
    const p = normalizePath(path);
    if (!this.data.some((d) => d.path === p)) return;
    this.clipboard = { path: p, type: "copy" };
    this.clearCutHighlight();
  }

  /** Cut a node to the internal clipboard for later Paste (move). */
  cutNode(path: string): void {
    const p = normalizePath(path);
    if (!this.data.some((d) => d.path === p)) return;
    this.clipboard = { path: p, type: "cut" };
    this.clearCutHighlight();
    this.applyCutHighlight();
  }

  /** Paste the internal clipboard into a target folder (defaults to the selected node's parent). */
  pasteNode(targetPath?: string): void {
    if (!this.clipboard) return;
    const { path: src, type } = this.clipboard;

    // Resolve the destination folder.
    let destPath = "";
    if (targetPath) {
      const targetData = this.data.find((d) => d.path === targetPath);
      destPath =
        targetData?.type === "folder" ? targetPath : getParentPath(targetPath);
    } else if (this.selectedPath) {
      const selData = this.data.find((d) => d.path === this.selectedPath);
      destPath =
        selData?.type === "folder"
          ? selData.path
          : getParentPath(this.selectedPath);
    }

    // Guard: pasting into a descendant of the copied node (or into itself).
    if (type === "copy") {
      const destIsInSrc =
        destPath === src ||
        (destPath !== "" && isDescendant(src, destPath)) ||
        (destPath !== "" && isDescendant(destPath, src));
      if (destIsInSrc) return;
    }

    // Resolve a unique name in the destination.
    const srcName = getName(src);
    let newPath = destPath ? `${destPath}/${srcName}` : srcName;
    if (newPath === src) return;
    let counter = 1;
    while (this.data.some((d) => d.path === newPath)) {
      const ext = getExtension(srcName);
      const baseName = ext ? srcName.slice(0, -(ext.length + 1)) : srcName;
      newPath = destPath
        ? `${destPath}/${baseName}-${counter}${ext ? "." + ext : ""}`
        : `${baseName}-${counter}${ext ? "." + ext : ""}`;
      counter++;
    }

    if (type === "copy") {
      // Clone the node (and descendants) into the destination folder.
      this.copyNodeInternal(src, destPath);
    } else {
      // Cut: move the node (and descendants) to the destination.
      this.moveNodeInternal(src, destPath);
      this.clipboard = null;
      this.clearCutHighlight();
    }
  }

  /**
   * Duplicate a node (and its descendants) into a target parent folder.
   * Resolves a unique name on conflict. Returns the new path, or `null` if
   * the copy cannot be performed (invalid source, same location, or copying
   * into a descendant).
   */
  copyNodeInternal(
    sourcePath: string,
    targetParentPath: string,
    source: FileTreeEventSource = "ui",
  ): string | null {
    const src = normalizePath(sourcePath);
    const destPath = targetParentPath ? normalizePath(targetParentPath) : "";
    if (!this.data.some((d) => d.path === src)) return null;

    // Guard: copying into a descendant of the source (or into itself).
    const destIsInSrc =
      destPath === src ||
      (destPath !== "" && isDescendant(src, destPath)) ||
      (destPath !== "" && isDescendant(destPath, src));
    if (destIsInSrc) return null;

    // Resolve a unique name in the destination.
    const srcName = getName(src);
    let newPath = destPath ? `${destPath}/${srcName}` : srcName;
    if (newPath === src) return null;
    let counter = 1;
    while (this.data.some((d) => d.path === newPath)) {
      const ext = getExtension(srcName);
      const baseName = ext ? srcName.slice(0, -(ext.length + 1)) : srcName;
      newPath = destPath
        ? `${destPath}/${baseName}-${counter}${ext ? "." + ext : ""}`
        : `${baseName}-${counter}${ext ? "." + ext : ""}`;
      counter++;
    }

    // Clone the node and all its descendants.
    const prefix = src + "/";
    const copies = this.data
      .filter((d) => d.path === src || d.path.startsWith(prefix))
      .map((d) => {
        const suffix = d.path === src ? "" : d.path.slice(src.length);
        return { ...d, path: newPath + suffix };
      });
    this.data = normalizeData([...this.data, ...copies]);
    if (destPath) this.expandedNodes.add(destPath);
    this.fullRerender();
    this.selectNode(newPath, source);
    this.emitEvent("create", newPath, undefined, undefined, source);
    this.emitEvent("copy", newPath, src, undefined, source);
    this.emitChange(source);

    return newPath;
  }

  private applyCutHighlight(): void {
    if (!this.clipboard || this.clipboard.type !== "cut") return;
    const node = this.nodeMap.get(this.clipboard.path);
    node?.contentEl.classList.add("ft-node__content--cut");
  }

  private clearCutHighlight(): void {
    this.root
      .querySelectorAll(".ft-node__content--cut")
      .forEach((el) => el.classList.remove("ft-node__content--cut"));
  }

  // ── Rename ──────────────────────────────────────────────

  private startRename(path: string): void {
    const node = this.nodeMap.get(path);
    if (!node) return;
    if (this.renamingPath) this.cancelRename();

    this.renamingPath = path;
    const currentName = node.name;

    const input = document.createElement("input");
    input.className = "ft-rename-input";
    input.type = "text";
    input.value = currentName;

    node.nameEl.textContent = "";
    node.nameEl.appendChild(input);
    input.focus();

    // Select name without extension for files
    if (node.data.type === "file") {
      const dotIndex = currentName.lastIndexOf(".");
      if (dotIndex > 0) {
        input.setSelectionRange(0, dotIndex);
      } else {
        input.select();
      }
    } else {
      input.select();
    }

    const commit = (): void => {
      if (this.renamingPath !== path) return; // Already handled

      const newName = input.value.trim();
      const isNewNode = this.pendingNewNodePath === path;
      // Committing a fresh node with an unchanged name keeps it; a regular
      // rename with an unchanged name is a no-op.
      if (
        newName &&
        this.isValidName(newName) &&
        (isNewNode || newName !== currentName)
      ) {
        const parentPath = getParentPath(path);
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;

        // A name containing slashes creates intermediate folders on the fly.
        if (newName.includes("/")) {
          if (!this.renameToNestedPath(path, newPath, isNewNode, "ui")) {
            this.handleRenameCancel(path);
          }
          return;
        }

        // Check for name conflict
        if (this.data.some((d) => d.path === newPath && d.path !== path)) {
          this.handleRenameCancel(path);
          return;
        }

        if (isNewNode) {
          // Committing a newly created node
          updatePathsInData(this.data, path, newPath);
          updatePathsInSet(this.expandedNodes, path, newPath);
          this.updateSelectedPath(path, newPath);
          this.pendingNewNodePath = null;
          this.renamingPath = null;
          this.fullRerender();
          this.selectNode(newPath);
          this.root.focus();
          this.emitEvent("create", newPath);
          this.emitChange();
        } else {
          // Regular rename
          const oldPath = path;
          updatePathsInData(this.data, oldPath, newPath);
          updatePathsInSet(this.expandedNodes, oldPath, newPath);
          this.updateSelectedPath(oldPath, newPath);
          this.renamingPath = null;
          this.fullRerender();
          this.selectNode(newPath);
          this.root.focus();
          this.emitEvent("rename", newPath, oldPath);
          this.emitChange();
        }
      } else {
        this.handleRenameCancel(path);
      }
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.renamingPath = path; // Ensure cancel sees the correct path
        this.handleRenameCancel(path);
      }
    });

    input.addEventListener(
      "blur",
      () => {
        if (this.renamingPath === path) commit();
      },
      { once: true },
    );
  }

  private handleRenameCancel(path: string): void {
    if (this.pendingNewNodePath === path) {
      // Remove the pending new node
      this.data = this.data.filter((d) => d.path !== path);
      this.pendingNewNodePath = null;
    }
    this.renamingPath = null;
    this.fullRerender();
    // Restore selection
    if (this.selectedPath && this.nodeMap.has(this.selectedPath)) {
      this.nodeMap
        .get(this.selectedPath)
        ?.contentEl.classList.add("ft-node__content--selected");
    }
    this.root.focus();
  }

  private cancelRename(): void {
    if (!this.renamingPath) return;
    this.handleRenameCancel(this.renamingPath);
  }

  private isValidName(name: string): boolean {
    return name.length > 0 && !/\\/.test(name);
  }

  private updateSelectedPath(oldPath: string, newPath: string): void {
    if (this.selectedPath === null) return;
    if (this.selectedPath === oldPath) {
      this.selectedPath = newPath;
    } else if (this.selectedPath.startsWith(oldPath + "/")) {
      this.selectedPath = newPath + this.selectedPath.slice(oldPath.length);
    }
  }

  /**
   * Rename a node to a new path containing slashes, creating intermediate
   * folders on the fly. Returns `false` if the rename is invalid (conflict,
   * or a folder renamed inside itself).
   */
  private renameToNestedPath(
    oldPath: string,
    newPath: string,
    isNewNode: boolean,
    source: FileTreeEventSource,
  ): boolean {
    // A folder cannot be moved inside itself (e.g. `a` → `a/b`).
    if (isDescendant(oldPath, newPath)) return false;
    if (this.data.some((d) => d.path === newPath)) return false;

    if (isNewNode) {
      // Committing a freshly created node: replace the temporary node with
      // the full folder chain, keeping the node's original type on the end.
      const oldType = this.data.find((d) => d.path === oldPath)?.type ?? "file";
      this.data = this.data.filter((d) => d.path !== oldPath);
      this.data.push(...createNode(newPath, oldType));
      this.data = normalizeData(this.data);
      this.pendingNewNodePath = null;
      this.renamingPath = null;
      this.fullRerender();
      this.expandAncestors(newPath);
      this.selectNode(newPath);
      this.root.focus();
      this.emitEvent("create", newPath, undefined, undefined, source);
      this.emitChange(source);
      return true;
    }

    // Regular rename: move the node (and descendants) to the new path.
    // `normalizeData` auto-creates any missing intermediate folders.
    updatePathsInData(this.data, oldPath, newPath);
    updatePathsInSet(this.expandedNodes, oldPath, newPath);
    this.updateSelectedPath(oldPath, newPath);
    this.data = normalizeData(this.data);

    this.renamingPath = null;
    this.fullRerender();
    this.expandAncestors(newPath);
    this.selectNode(newPath, source);
    this.root.focus();
    this.emitEvent("rename", newPath, oldPath, undefined, source);
    this.emitChange(source);
    return true;
  }

  // ── Create ──────────────────────────────────────────────

  private createNewNode(
    type: "file" | "folder",
    parentFolderPath?: string,
  ): void {
    let parentPath = parentFolderPath ?? "";

    // If no parentPath given, infer from selection
    if (!parentPath && this.selectedPath) {
      const selData = this.data.find((d) => d.path === this.selectedPath);
      if (selData) {
        parentPath =
          selData.type === "folder"
            ? selData.path
            : getParentPath(selData.path);
      }
    }

    const tempName = type === "file" ? "untitled" : "new-folder";
    let finalPath = parentPath ? `${parentPath}/${tempName}` : tempName;

    // Handle name conflicts
    let counter = 1;
    while (this.data.some((d) => d.path === finalPath)) {
      finalPath = parentPath
        ? `${parentPath}/${tempName}-${counter}`
        : `${tempName}-${counter}`;
      counter++;
    }

    const newNode: FileTreeNodeData = { path: finalPath, type };
    this.data.push(newNode);
    this.data = normalizeData(this.data);

    // Expand parent folder
    if (parentPath) this.expandedNodes.add(parentPath);

    this.fullRerender();
    this.selectNode(finalPath);

    this.pendingNewNodePath = finalPath;
    this.startRename(finalPath);
  }

  // ── Delete ──────────────────────────────────────────────

  /**
   * Attempt to delete a node. Emits a `delete` event *before* removal.
   * If a listener calls `event.preventDefault()`, the node is **not**
   * removed, giving the consumer the chance to show a confirmation
   * dialog and later call `removeNode()` to carry out the deletion.
   */
  deleteNode(path: string): void {
    const p = normalizePath(path);
    const event = this.emitEvent("delete", p);
    if (event.defaultPrevented) return;
    this.removeNodeInternal(p);
    this.emitChange();
  }

  private removeNodeInternal(path: string): void {
    const prefix = path + "/";

    // Remove node and all descendants from data
    this.data = this.data.filter(
      (d) => d.path !== path && !d.path.startsWith(prefix),
    );

    // Clean up expanded nodes
    this.expandedNodes.delete(path);
    for (const p of [...this.expandedNodes]) {
      if (p.startsWith(prefix)) this.expandedNodes.delete(p);
    }

    // Clean up selection
    if (
      this.selectedPath === path ||
      (this.selectedPath && this.selectedPath.startsWith(prefix))
    ) {
      this.selectedPath = null;
    }

    // Clean up clipboard if it referenced the removed node
    if (
      this.clipboard &&
      (this.clipboard.path === path ||
        this.clipboard.path.startsWith(prefix))
    ) {
      this.clipboard = null;
    }

    this.fullRerender();
  }

  // ── Move (Drag & Drop) ─────────────────────────────────

  private handleDragMove(
    sourcePath: string,
    targetPath: string,
    position: DropPosition,
  ): void {
    if (sourcePath === targetPath) return;
    if (isDescendant(sourcePath, targetPath)) return;

    const targetData = this.data.find((d) => d.path === targetPath);
    if (!targetData) return;

    let newParentPath: string;
    if (position === "inside" && targetData.type === "folder") {
      newParentPath = targetPath;
    } else {
      newParentPath = getParentPath(targetPath);
    }

    this.moveNodeInternal(sourcePath, newParentPath);
  }

  private moveNodeInternal(
    sourcePath: string,
    newParentPath: string,
    source: FileTreeEventSource = "ui",
  ): void {
    const sourceName = getName(sourcePath);
    const newPath = newParentPath
      ? `${newParentPath}/${sourceName}`
      : sourceName;

    if (sourcePath === newPath) return;
    if (this.data.some((d) => d.path === newPath)) return;

    const oldPath = sourcePath;

    updatePathsInData(this.data, sourcePath, newPath);
    updatePathsInSet(this.expandedNodes, sourcePath, newPath);
    this.updateSelectedPath(sourcePath, newPath);

    this.data = normalizeData(this.data);

    if (newParentPath) this.expandedNodes.add(newParentPath);

    this.fullRerender();
    this.selectNode(newPath, source);

    this.emitEvent("move", newPath, oldPath, undefined, source);
    this.emitChange(source);
  }

  private handleExternalDrop(
    entries: { files: FileList; items: DataTransferItemList },
    targetPath: string | null,
    position: DropPosition,
  ): void {
    let parentPath = "";
    if (targetPath) {
      const targetData = this.data.find((d) => d.path === targetPath);
      if (position === "inside" && targetData?.type === "folder") {
        parentPath = targetPath;
      } else {
        parentPath = getParentPath(targetPath);
      }
    }

    const event = this.emitEvent(
      "drop",
      parentPath,
      undefined,
      entries,
      "ui",
    );
    if (event.defaultPrevented) return;

    const files = entries.files;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      let filePath = parentPath ? `${parentPath}/${f.name}` : f.name;

      let counter = 1;
      while (this.data.some((d) => d.path === filePath)) {
        const ext = getExtension(f.name);
        const baseName = ext ? f.name.slice(0, -(ext.length + 1)) : f.name;
        filePath = parentPath
          ? `${parentPath}/${baseName}-${counter}${ext ? "." + ext : ""}`
          : `${baseName}-${counter}${ext ? "." + ext : ""}`;
        counter++;
      }

      const newNode: FileTreeNodeData = {
        path: filePath,
        type: "file",
        meta: { file: f },
      };

      this.data.push(newNode);
      this.data = normalizeData(this.data);
    }

    if (parentPath) this.expandedNodes.add(parentPath);
    this.fullRerender();
    this.emitChange();
  }

  // ── Full Rerender ───────────────────────────────────────

  private fullRerender(): void {
    this.renderTree();

    // Restore expanded state from set
    for (const path of this.expandedNodes) {
      const node = this.nodeMap.get(path);
      if (node && node.data.type === "folder") {
        node.expanded = true;
        node.arrowEl?.classList.add("ft-node__arrow--open");
        if (node.childrenEl) node.childrenEl.style.display = "";
        node.iconEl.innerHTML = this.resolveIcon(node.data, node.name, true);
      }
    }

    // Restore selection
    if (this.selectedPath) {
      const node = this.nodeMap.get(this.selectedPath);
      node?.contentEl.classList.add("ft-node__content--selected");
    }

    // Restore cut highlight
    this.applyCutHighlight();
  }

  // ── Keyboard ────────────────────────────────────────────

  private onKeydown(e: KeyboardEvent): void {
    if (this.renamingPath) return;

    // In read-only mode only pure navigation keys are handled — everything
    // else (rename, delete, copy/cut/paste, ...) is ignored.
    if (this.options.readOnly) {
      const isNavKey =
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "Enter" ||
        e.key === " ";
      if (!isNavKey) return;
    }

    const visible = this.getVisibleNodePaths();
    if (visible.length === 0) return;

    const currentIdx = this.selectedPath
      ? visible.indexOf(this.selectedPath)
      : -1;

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const nextIdx = Math.min(currentIdx + 1, visible.length - 1);
        this.selectNode(visible[nextIdx]);
        this.scrollIntoView(visible[nextIdx]);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prevIdx = Math.max(currentIdx - 1, 0);
        this.selectNode(visible[prevIdx]);
        this.scrollIntoView(visible[prevIdx]);
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        if (this.selectedPath) {
          const nodeData = this.data.find((d) => d.path === this.selectedPath);
          if (nodeData?.type === "folder") {
            if (!this.expandedNodes.has(this.selectedPath)) {
              this.expand(this.selectedPath);
            } else {
              const children = this.getChildPaths(this.selectedPath);
              if (children.length > 0) {
                this.selectNode(children[0]);
                this.scrollIntoView(children[0]);
              }
            }
          }
        }
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        if (this.selectedPath) {
          const nodeData = this.data.find((d) => d.path === this.selectedPath);
          if (
            nodeData?.type === "folder" &&
            this.expandedNodes.has(this.selectedPath)
          ) {
            this.collapse(this.selectedPath);
          } else {
            const parentPath = getParentPath(this.selectedPath);
            if (parentPath && this.nodeMap.has(parentPath)) {
              this.selectNode(parentPath);
              this.scrollIntoView(parentPath);
            }
          }
        }
        break;
      }
      case "Enter":
      case " ": {
        e.preventDefault();
        if (this.selectedPath) {
          const nodeData = this.data.find((d) => d.path === this.selectedPath);
          if (nodeData?.type === "folder") this.toggleExpand(this.selectedPath);
        }
        break;
      }
      case "F2": {
        e.preventDefault();
        if (this.selectedPath && this.options.contextMenu !== false) {
          this.startRename(this.selectedPath);
        }
        break;
      }
      case "Delete": {
        e.preventDefault();
        if (this.selectedPath && this.options.contextMenu !== false) {
          this.deleteNode(this.selectedPath);
        }
        break;
      }
      case "c":
      case "C": {
        if (
          (e.ctrlKey || e.metaKey) &&
          this.selectedPath &&
          this.options.contextMenu !== false &&
          (this.options.contextMenu as ContextMenuOptions).copy
        ) {
          e.preventDefault();
          this.copyToClipboard(this.selectedPath);
        }
        break;
      }
      case "x":
      case "X": {
        if (
          (e.ctrlKey || e.metaKey) &&
          this.selectedPath &&
          this.options.contextMenu !== false &&
          (this.options.contextMenu as ContextMenuOptions).cut
        ) {
          e.preventDefault();
          this.cutNode(this.selectedPath);
        }
        break;
      }
      case "v":
      case "V": {
        if (
          (e.ctrlKey || e.metaKey) &&
          this.clipboard &&
          this.options.contextMenu !== false &&
          (this.options.contextMenu as ContextMenuOptions).paste
        ) {
          e.preventDefault();
          this.pasteNode();
        }
        break;
      }
    }
  }

  private getVisibleNodePaths(): string[] {
    const paths: string[] = [];
    const walk = (nodes: HierarchyNode[]): void => {
      for (const node of nodes) {
        paths.push(node.path);
        if (
          node.type === "folder" &&
          this.expandedNodes.has(node.path) &&
          node.children.length > 0
        ) {
          walk(node.children);
        }
      }
    };
    walk(this.hierarchy);
    return paths;
  }

  private getChildPaths(folderPath: string): string[] {
    const find = (nodes: HierarchyNode[]): HierarchyNode | null => {
      for (const n of nodes) {
        if (n.path === folderPath) return n;
        if (n.children.length > 0) {
          const found = find(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    const node = find(this.hierarchy);
    return node?.children.map((c) => c.path) ?? [];
  }

  private scrollIntoView(path: string): void {
    const node = this.nodeMap.get(path);
    node?.contentEl.scrollIntoView({ block: "nearest" });
  }

  // ── Expand Ancestors ────────────────────────────────────

  private expandAncestors(path: string): void {
    const segments = path.split("/");
    for (let i = 1; i < segments.length; i++) {
      const ancestorPath = segments.slice(0, i).join("/");
      this.expand(ancestorPath);
    }
  }

  // ── Events ──────────────────────────────────────────────

  on(event: FileTreeEventType, handler: EventHandler): void {
    this.emitter.on(event, handler);
  }

  off(event: FileTreeEventType, handler: EventHandler): void {
    this.emitter.off(event, handler);
  }

  private emitEvent(
    type: FileTreeEventType,
    path: string,
    oldPath?: string,
    data?: { files: FileList; items: DataTransferItemList },
    source: FileTreeEventSource = "ui",
  ): FileTreeEvent {
    const nodeData = this.data.find((d) => d.path === path);
    const parentPath = getParentPath(path);
    const parentNode = parentPath
      ? (this.data.find((d) => d.path === parentPath) ?? null)
      : null;

    const event: FileTreeEvent = {
      type,
      source,
      node: nodeData ? { ...nodeData } : { path, type: "file" },
      path,
      oldPath,
      parentPath,
      parentNode: parentNode ? { ...parentNode } : null,
      tree: cloneData(this.data),
      data,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };

    this.emitter.emit(type, event);
    return event;
  }

  private emitChange(source: FileTreeEventSource = "ui"): void {
    const event: FileTreeEvent = {
      type: "change",
      source,
      node: { path: "", type: "folder" },
      path: "",
      parentPath: "",
      parentNode: null,
      tree: cloneData(this.data),
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    this.emitter.emit("change", event);
  }

  // ── Public API: Data ────────────────────────────────────

  getData(): FileTreeNodeData[] {
    return cloneData(this.data);
  }

  getNode(path: string): FileTreeNodeData | undefined {
    const p = normalizePath(path);
    const item = this.data.find((d) => d.path === p);
    return item ? { ...item } : undefined;
  }

  getSelectedNode(): FileTreeNodeData | null {
    if (!this.selectedPath) return null;
    return this.getNode(this.selectedPath) ?? null;
  }

  setData(data: FileTreeNodeData[]): void {
    this.data = normalizeData(data);
    this.selectedPath = null;
    this.expandedNodes.clear();
    this.fullRerender();
  }

  // ── Public API: Node Operations ─────────────────────────

  addNode(node: FileTreeNodeData): void {
    const normalized = { ...node, path: normalizePath(node.path) };
    if (!normalized.path) return;
    if (this.data.some((d) => d.path === normalized.path)) return;

    this.data.push(normalized);
    this.data = normalizeData(this.data);

    this.fullRerender();

    // Expand all ancestors so auto-created parent folders are visible.
    this.expandAncestors(normalized.path);

    this.emitEvent("create", normalized.path, undefined, undefined, "api");
    this.emitChange("api");
  }

  /**
   * Programmatically remove a node and its descendants.
   * Unlike the UI-triggered `deleteNode`, this is **not cancellable** —
   * it always removes the node immediately. Use this from your
   * confirmation callback after intercepting a `delete` event.
   */
  removeNode(path: string): void {
    const p = normalizePath(path);
    this.removeNodeInternal(p);
    this.emitChange("api");
  }

  renameNode(path: string, newName: string): void {
    const p = normalizePath(path);
    if (!this.isValidName(newName)) return;

    const parentPath = getParentPath(p);
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;

    if (newPath === p) return;
    if (this.data.some((d) => d.path === newPath)) return;

    if (newName.includes("/")) {
      // Slashes create intermediate folders on the fly.
      this.renameToNestedPath(p, newPath, false, "api");
      return;
    }

    updatePathsInData(this.data, p, newPath);
    updatePathsInSet(this.expandedNodes, p, newPath);
    this.updateSelectedPath(p, newPath);

    this.fullRerender();

    this.emitEvent("rename", newPath, p, undefined, "api");
    this.emitChange("api");
  }

  moveNode(sourcePath: string, targetParentPath: string | null): void {
    const src = normalizePath(sourcePath);
    const tgt = targetParentPath ? normalizePath(targetParentPath) : "";
    this.moveNodeInternal(src, tgt, "api");
  }

  /**
   * Copy a node (and its descendants) to a new parent folder
   * (`''` or `null` for root). Emits `copy` and `create` events.
   * Returns the new path, or `null` if the copy cannot be performed.
   */
  copyNode(
    sourcePath: string,
    targetParentPath: string | null,
  ): string | null {
    const src = normalizePath(sourcePath);
    const tgt = targetParentPath ? normalizePath(targetParentPath) : "";
    return this.copyNodeInternal(src, tgt, "api");
  }

  select(path: string): void {
    const p = normalizePath(path);
    if (!this.nodeMap.has(p)) return;

    this.expandAncestors(p);

    this.selectNode(p, "api");
    this.scrollIntoView(p);
  }

  // ── Theme & Direction ───────────────────────────────────

  setTheme(theme: Theme): void {
    this.options.theme = theme;
    this.root.dataset.theme = theme;
  }

  getTheme(): Theme {
    return this.options.theme;
  }

  setDirection(direction: Direction): void {
    this.options.direction = direction;
    this.root.dir = direction;
  }

  getDirection(): Direction {
    return this.options.direction;
  }

  // ── Destroy ─────────────────────────────────────────────

  destroy(): void {
    this.contextMenu.destroy();
    this.dragDrop?.destroy();
    this.emitter.removeAllListeners();
    this.nodeMap.clear();
    this.expandedNodes.clear();
    this.root.remove();
  }
}
