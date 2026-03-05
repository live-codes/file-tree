import { EventEmitter } from "./EventEmitter";
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
} from "./utils";
import type {
  FileTreeNodeData,
  FileTreeOptions,
  FileTreeEvent,
  FileTreeEventType,
  EventHandler,
  InternalNode,
  HierarchyNode,
  Theme,
  Direction,
  ToolbarOptions,
  ContextMenuOptions,
} from "./types";

const DEFAULT_OPTIONS: Required<FileTreeOptions> = {
  data: [],
  theme: "dark",
  direction: "ltr",
  indent: 16,
  dragAndDrop: true,
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
    copy: false,
    custom: [],
  },
  icons: {},
  sort: true,
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
    this.iconMap = { ...defaultIconMap, ...this.options.icons };
    this.nameIconMap = { ...defaultNameIconMap };

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
    if (this.options.dragAndDrop) {
      this.dragDrop = new DragDrop(this.treeEl, {
        getNode: (path) => this.nodeMap.get(path),
        onMove: (src, tgt, pos) => this.handleDragMove(src, tgt, pos),
        onExternalDrop: (files, tgt, pos) =>
          this.handleExternalDrop(files, tgt, pos),
      });
    }

    // Render tree
    this.renderTree();

    // Keyboard
    this.root.addEventListener("keydown", this.onKeydown.bind(this));
  }

  // ── Options ─────────────────────────────────────────────

  private mergeOptions(opts?: FileTreeOptions): Required<FileTreeOptions> {
    if (!opts) return { ...DEFAULT_OPTIONS };
    return {
      data: opts.data ?? DEFAULT_OPTIONS.data,
      theme: opts.theme ?? DEFAULT_OPTIONS.theme,
      direction: opts.direction ?? DEFAULT_OPTIONS.direction,
      indent: opts.indent ?? DEFAULT_OPTIONS.indent,
      dragAndDrop: opts.dragAndDrop ?? DEFAULT_OPTIONS.dragAndDrop,
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
    };
  }

  // ── Toolbar ─────────────────────────────────────────────

  private renderToolbar(): HTMLElement {
    const tb = document.createElement("div");
    tb.className = "ft-toolbar";
    const cfg = this.options.toolbar as ToolbarOptions;

    if (cfg.createFile) {
      tb.appendChild(
        this.toolbarBtn("New File", newFile, () => this.createNewNode("file")),
      );
    }
    if (cfg.createFolder) {
      tb.appendChild(
        this.toolbarBtn("New Folder", newFolder, () =>
          this.createNewNode("folder"),
        ),
      );
    }
    if (cfg.expandAll) {
      tb.appendChild(
        this.toolbarBtn("Expand All", expandAllIcon, () => this.expandAll()),
      );
    }
    if (cfg.collapseAll) {
      tb.appendChild(
        this.toolbarBtn("Collapse All", collapseAllIcon, () =>
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
    if (this.options.dragAndDrop) el.draggable = true;

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
      if (this.renamingPath) return;
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

  private selectNode(path: string): void {
    if (this.selectedPath) {
      const prev = this.nodeMap.get(this.selectedPath);
      prev?.contentEl.classList.remove("ft-node__content--selected");
    }
    this.selectedPath = path;
    const node = this.nodeMap.get(path);
    node?.contentEl.classList.add("ft-node__content--selected");

    this.emitEvent("select", path);
  }

  // ── Expand / Collapse ───────────────────────────────────

  private toggleExpand(path: string): void {
    if (this.expandedNodes.has(path)) {
      this.collapse(path);
    } else {
      this.expand(path);
    }
  }

  expand(path: string): void {
    const p = normalizePath(path);
    const node = this.nodeMap.get(p);
    if (!node || node.data.type !== "folder") return;
    if (this.expandedNodes.has(p)) return;

    this.expandedNodes.add(p);
    node.expanded = true;
    node.arrowEl?.classList.add("ft-node__arrow--open");
    if (node.childrenEl) node.childrenEl.style.display = "";
    node.iconEl.innerHTML = this.resolveIcon(node.data, node.name, true);

    this.emitEvent("expand", p);
  }

  collapse(path: string): void {
    const p = normalizePath(path);
    const node = this.nodeMap.get(p);
    if (!node || node.data.type !== "folder") return;
    if (!this.expandedNodes.has(p)) return;

    this.expandedNodes.delete(p);
    node.expanded = false;
    node.arrowEl?.classList.remove("ft-node__arrow--open");
    if (node.childrenEl) node.childrenEl.style.display = "none";
    node.iconEl.innerHTML = this.resolveIcon(node.data, node.name, false);

    this.emitEvent("collapse", p);
  }

  expandAll(): void {
    this.nodeMap.forEach((node) => {
      if (node.data.type === "folder") this.expand(node.path);
    });
  }

  collapseAll(): void {
    this.nodeMap.forEach((node) => {
      if (node.data.type === "folder") this.collapse(node.path);
    });
  }

  // ── Context Menu ────────────────────────────────────────

  private showContextMenu(path: string, x: number, y: number): void {
    if (this.options.contextMenu === false) return;
    const cfg = this.options.contextMenu as ContextMenuOptions;
    const nodeData = this.data.find((d) => d.path === path);
    if (!nodeData) return;

    const entries: ContextMenuEntry[] = [];

    if (nodeData.type === "folder" && cfg.createFile) {
      entries.push({
        id: "create-file",
        label: "New File",
        icon: newFile,
        onClick: () => this.createNewNode("file", path),
      });
    }

    if (nodeData.type === "folder" && cfg.createFolder) {
      entries.push({
        id: "create-folder",
        label: "New Folder",
        icon: newFolder,
        onClick: () => this.createNewNode("folder", path),
      });
    }

    if (
      (cfg.createFile || cfg.createFolder) &&
      nodeData.type === "folder" &&
      (cfg.rename || cfg.delete || cfg.copy)
    ) {
      entries.push({
        id: "sep1",
        label: "",
        separator: true,
        onClick: () => {},
      });
    }

    if (cfg.copy) {
      entries.push({
        id: "copy-path",
        label: "Copy Path",
        icon: copyIcon,
        onClick: () => {
          navigator.clipboard?.writeText(path).catch(() => {});
        },
      });
    }

    if (cfg.rename) {
      entries.push({
        id: "rename",
        label: "Rename",
        icon: editIcon,
        shortcut: "F2",
        onClick: () => this.startRename(path),
      });
    }

    if (cfg.delete) {
      entries.push({
        id: "delete",
        label: "Delete",
        icon: trashIcon,
        shortcut: "Del",
        onClick: () => this.deleteNode(path),
      });
    }

    if (cfg.custom && cfg.custom.length > 0) {
      const visibleCustom = cfg.custom.filter(
        (c) => !c.visible || c.visible(nodeData),
      );
      if (visibleCustom.length > 0 && entries.length > 0) {
        entries.push({
          id: "sep-custom",
          label: "",
          separator: true,
          onClick: () => {},
        });
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
      if (newName && newName !== currentName && this.isValidName(newName)) {
        const parentPath = getParentPath(path);
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;

        // Check for name conflict
        if (this.data.some((d) => d.path === newPath && d.path !== path)) {
          this.handleRenameCancel(path);
          return;
        }

        if (this.pendingNewNodePath === path) {
          // Committing a newly created node
          updatePathsInData(this.data, path, newPath);
          updatePathsInSet(this.expandedNodes, path, newPath);
          this.updateSelectedPath(path, newPath);
          this.pendingNewNodePath = null;
          this.renamingPath = null;
          this.fullRerender();
          this.selectNode(newPath);
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
      // Remove the pending new node and its auto-created empty parents
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
  }

  private cancelRename(): void {
    if (!this.renamingPath) return;
    this.handleRenameCancel(this.renamingPath);
  }

  private isValidName(name: string): boolean {
    return name.length > 0 && !/[/\\]/.test(name);
  }

  private updateSelectedPath(oldPath: string, newPath: string): void {
    if (this.selectedPath === null) return;
    if (this.selectedPath === oldPath) {
      this.selectedPath = newPath;
    } else if (this.selectedPath.startsWith(oldPath + "/")) {
      this.selectedPath = newPath + this.selectedPath.slice(oldPath.length);
    }
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

  deleteNode(path: string): void {
    const p = normalizePath(path);
    this.emitEvent("delete", p);
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

    this.fullRerender();
  }

  // ── Move (Drag & Drop) ─────────────────────────────────

  private handleDragMove(
    sourcePath: string,
    targetPath: string,
    position: DropPosition,
  ): void {
    // Prevent self-move
    if (sourcePath === targetPath) return;

    // Prevent moving into own descendants
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

  private moveNodeInternal(sourcePath: string, newParentPath: string): void {
    const sourceName = getName(sourcePath);
    const newPath = newParentPath
      ? `${newParentPath}/${sourceName}`
      : sourceName;

    if (sourcePath === newPath) return; // No change

    // Check for name conflict
    if (this.data.some((d) => d.path === newPath)) return;

    const oldPath = sourcePath;

    // Update all paths (node + descendants)
    updatePathsInData(this.data, sourcePath, newPath);
    updatePathsInSet(this.expandedNodes, sourcePath, newPath);
    this.updateSelectedPath(sourcePath, newPath);

    // Ensure parent folders exist
    this.data = normalizeData(this.data);

    // Expand target parent
    if (newParentPath) this.expandedNodes.add(newParentPath);

    this.fullRerender();
    this.selectNode(newPath);

    this.emitEvent("move", newPath, oldPath);
    this.emitChange();
  }

  private handleExternalDrop(
    files: FileList,
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

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      let filePath = parentPath ? `${parentPath}/${f.name}` : f.name;

      // Handle conflicts
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

      this.emitEvent("drop", filePath);
    }

    if (parentPath) this.expandedNodes.add(parentPath);
    this.fullRerender();
    this.emitChange();
  }

  // ── Full Rerender ───────────────────────────────────────

  private fullRerender(): void {
    // Preserve expanded state (already in this.expandedNodes)
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
  }

  // ── Keyboard ────────────────────────────────────────────

  private onKeydown(e: KeyboardEvent): void {
    if (this.renamingPath) return;

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
              // Move to first child
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
  ): void {
    const nodeData = this.data.find((d) => d.path === path);
    const parentPath = getParentPath(path);
    const parentNode = parentPath
      ? (this.data.find((d) => d.path === parentPath) ?? null)
      : null;

    this.emitter.emit(type, {
      type,
      node: nodeData ? { ...nodeData } : { path, type: "file" },
      path,
      oldPath,
      parentPath,
      parentNode: parentNode ? { ...parentNode } : null,
      tree: cloneData(this.data),
    });
  }

  private emitChange(): void {
    this.emitter.emit("change", {
      type: "change",
      node: { path: "", type: "folder" },
      path: "",
      parentPath: "",
      parentNode: null,
      tree: cloneData(this.data),
    });
  }

  // ── Public API: Data ────────────────────────────────────

  /** Get a deep clone of the current flat data array. */
  getData(): FileTreeNodeData[] {
    return cloneData(this.data);
  }

  /** Get a single node by path. */
  getNode(path: string): FileTreeNodeData | undefined {
    const p = normalizePath(path);
    const item = this.data.find((d) => d.path === p);
    return item ? { ...item } : undefined;
  }

  /** Get the currently selected node, or null. */
  getSelectedNode(): FileTreeNodeData | null {
    if (!this.selectedPath) return null;
    return this.getNode(this.selectedPath) ?? null;
  }

  /** Replace the entire tree data and re-render. */
  setData(data: FileTreeNodeData[]): void {
    this.data = normalizeData(data);
    this.selectedPath = null;
    this.expandedNodes.clear();
    this.fullRerender();
  }

  // ── Public API: Node Operations ─────────────────────────

  /**
   * Add a node to the tree. Parent folders are auto-created from the path.
   * To add multiple nodes at once, use `setData` or call `addNode` in a loop.
   */
  addNode(node: FileTreeNodeData): void {
    const normalized = { ...node, path: normalizePath(node.path) };
    if (!normalized.path) return;

    // Don't add if already exists
    if (this.data.some((d) => d.path === normalized.path)) return;

    this.data.push(normalized);
    this.data = normalizeData(this.data);

    this.fullRerender();

    // Expand parent
    const parentPath = getParentPath(normalized.path);
    if (parentPath) this.expand(parentPath);

    this.emitEvent("create", normalized.path);
    this.emitChange();
  }

  /** Remove a node (and all descendants if it is a folder). */
  removeNode(path: string): void {
    this.deleteNode(path);
  }

  /** Rename a node. Only changes the last segment (name) of the path. */
  renameNode(path: string, newName: string): void {
    const p = normalizePath(path);
    if (!this.isValidName(newName)) return;

    const parentPath = getParentPath(p);
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;

    if (newPath === p) return;
    if (this.data.some((d) => d.path === newPath)) return; // Conflict

    updatePathsInData(this.data, p, newPath);
    updatePathsInSet(this.expandedNodes, p, newPath);
    this.updateSelectedPath(p, newPath);

    this.fullRerender();

    this.emitEvent("rename", newPath, p);
    this.emitChange();
  }

  /**
   * Move a node to a new parent folder.
   * Pass empty string or `null` for `targetParentPath` to move to root.
   */
  moveNode(sourcePath: string, targetParentPath: string | null): void {
    const src = normalizePath(sourcePath);
    const tgt = targetParentPath ? normalizePath(targetParentPath) : "";
    this.moveNodeInternal(src, tgt);
  }

  /** Programmatically select a node. */
  select(path: string): void {
    const p = normalizePath(path);
    if (this.nodeMap.has(p)) {
      this.selectNode(p);
    }
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
