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
  generateId,
  getExtension,
  deepClone,
  findNode,
  removeNode,
  getNodePath,
  defaultSort,
  sortTree,
  isDescendant,
} from "./utils";
import type {
  FileTreeNodeData,
  FileTreeOptions,
  FileTreeEvent,
  FileTreeEventType,
  EventHandler,
  InternalNode,
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
  private options: Required<FileTreeOptions>;
  private nodeMap = new Map<string, InternalNode>();
  private expandedNodes = new Set<string>();
  private selectedId: string | null = null;
  private emitter = new EventEmitter<
    Record<FileTreeEventType, FileTreeEvent>
  >();
  private contextMenu: ContextMenu;
  private dragDrop: DragDrop | null = null;
  private iconMap: Record<string, string>;
  private nameIconMap: Record<string, string>;
  private renamingId: string | null = null;
  private pendingNewNodeId: string | null = null;

  // ── Constructor ─────────────────────────────────────────

  constructor(container: HTMLElement | string, options?: FileTreeOptions) {
    const el =
      typeof container === "string"
        ? document.querySelector(container)
        : container;
    if (!el || !(el instanceof HTMLElement)) {
      throw new Error("[file-tree] Invalid container element.");
    }

    this.options = this.mergeOptions(options);
    this.data = deepClone(this.options.data);
    this.iconMap = { ...defaultIconMap, ...this.options.icons };
    this.nameIconMap = { ...defaultNameIconMap };

    if (this.options.sort) {
      const cmp =
        typeof this.options.sort === "function"
          ? this.options.sort
          : defaultSort;
      sortTree(this.data, cmp);
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
    if (this.options.dragAndDrop) {
      this.dragDrop = new DragDrop(this.treeEl, {
        getNode: (id) => this.nodeMap.get(id),
        onMove: (srcId, tgtId, pos) => this.handleDragMove(srcId, tgtId, pos),
        onExternalDrop: (files, tgtId, pos) =>
          this.handleExternalDrop(files, tgtId, pos),
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
    for (const node of this.data) {
      this.renderNode(node, 0, null, this.treeEl);
    }
  }

  private renderNode(
    data: FileTreeNodeData,
    depth: number,
    parentId: string | null,
    container: HTMLElement,
  ): void {
    const isFolder = data.type === "folder";
    const expanded = this.expandedNodes.has(data.id);

    // Node wrapper
    const el = document.createElement("div");
    el.className = "ft-node";
    el.dataset.id = data.id;
    el.dataset.type = data.type;
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
    iconEl.innerHTML = this.resolveIcon(data, expanded);
    contentEl.appendChild(iconEl);

    // Name
    const nameEl = document.createElement("span");
    nameEl.className = "ft-node__name";
    nameEl.textContent = data.name;
    contentEl.appendChild(nameEl);

    el.appendChild(contentEl);

    // Children container (folders only)
    let childrenEl: HTMLElement | null = null;
    if (isFolder) {
      childrenEl = document.createElement("div");
      childrenEl.className = "ft-node__children";
      if (!expanded) childrenEl.style.display = "none";
      el.appendChild(childrenEl);

      if (data.children) {
        for (const child of data.children) {
          this.renderNode(child, depth + 1, data.id, childrenEl);
        }
      }
    }

    // Store internal reference
    const internalNode: InternalNode = {
      id: data.id,
      parentId,
      data,
      depth,
      expanded,
      el,
      contentEl,
      childrenEl,
      nameEl,
      arrowEl,
      iconEl,
    };
    this.nodeMap.set(data.id, internalNode);

    // Events
    contentEl.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.renamingId) return;
      this.selectNode(data.id);
      if (isFolder) this.toggleExpand(data.id);
    });

    contentEl.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      if (this.renamingId) return;
      if (
        this.options.contextMenu !== false &&
        (this.options.contextMenu as ContextMenuOptions).rename
      ) {
        this.startRename(data.id);
      }
    });

    contentEl.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.selectNode(data.id);
      this.showContextMenu(data.id, e.clientX, e.clientY);
    });

    container.appendChild(el);
  }

  // ── Icon Resolution ─────────────────────────────────────

  private resolveIcon(data: FileTreeNodeData, expanded: boolean): string {
    if (data.icon) return data.icon;
    if (data.type === "folder") return expanded ? folderOpen : folder;

    // Check name-based icons
    if (this.nameIconMap[data.name]) return this.nameIconMap[data.name];

    // Extension-based
    const ext = getExtension(data.name);
    if (ext && this.iconMap[ext]) return this.iconMap[ext];

    return fileIcon;
  }

  // ── Selection ───────────────────────────────────────────

  private selectNode(id: string): void {
    if (this.selectedId) {
      const prev = this.nodeMap.get(this.selectedId);
      prev?.contentEl.classList.remove("ft-node__content--selected");
    }
    this.selectedId = id;
    const node = this.nodeMap.get(id);
    node?.contentEl.classList.add("ft-node__content--selected");

    this.emitEvent("select", id);
  }

  // ── Expand / Collapse ───────────────────────────────────

  private toggleExpand(id: string): void {
    if (this.expandedNodes.has(id)) {
      this.collapse(id);
    } else {
      this.expand(id);
    }
  }

  expand(id: string): void {
    const node = this.nodeMap.get(id);
    if (!node || node.data.type !== "folder") return;
    if (this.expandedNodes.has(id)) return;

    this.expandedNodes.add(id);
    node.expanded = true;
    node.arrowEl?.classList.add("ft-node__arrow--open");
    if (node.childrenEl) node.childrenEl.style.display = "";
    node.iconEl.innerHTML = this.resolveIcon(node.data, true);

    this.emitEvent("expand", id);
  }

  collapse(id: string): void {
    const node = this.nodeMap.get(id);
    if (!node || node.data.type !== "folder") return;
    if (!this.expandedNodes.has(id)) return;

    this.expandedNodes.delete(id);
    node.expanded = false;
    node.arrowEl?.classList.remove("ft-node__arrow--open");
    if (node.childrenEl) node.childrenEl.style.display = "none";
    node.iconEl.innerHTML = this.resolveIcon(node.data, false);

    this.emitEvent("collapse", id);
  }

  expandAll(): void {
    this.nodeMap.forEach((node) => {
      if (node.data.type === "folder") this.expand(node.id);
    });
  }

  collapseAll(): void {
    this.nodeMap.forEach((node) => {
      if (node.data.type === "folder") this.collapse(node.id);
    });
  }

  // ── Context Menu ────────────────────────────────────────

  private showContextMenu(id: string, x: number, y: number): void {
    if (this.options.contextMenu === false) return;
    const cfg = this.options.contextMenu as ContextMenuOptions;
    const node = this.nodeMap.get(id);
    if (!node) return;

    const entries: ContextMenuEntry[] = [];
    const data = node.data;
    const path = getNodePath(this.data, id);

    if (data.type === "folder" && cfg.createFile) {
      entries.push({
        id: "create-file",
        label: "New File",
        icon: newFile,
        onClick: () => this.createNewNode("file", id),
      });
    }

    if (data.type === "folder" && cfg.createFolder) {
      entries.push({
        id: "create-folder",
        label: "New Folder",
        icon: newFolder,
        onClick: () => this.createNewNode("folder", id),
      });
    }

    if (
      (cfg.createFile || cfg.createFolder) &&
      data.type === "folder" &&
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
        onClick: () => this.startRename(id),
      });
    }

    if (cfg.delete) {
      entries.push({
        id: "delete",
        label: "Delete",
        icon: trashIcon,
        shortcut: "Del",
        onClick: () => this.deleteNode(id),
      });
    }

    if (cfg.custom && cfg.custom.length > 0) {
      const visibleCustom = cfg.custom.filter(
        (c) => !c.visible || c.visible(data),
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
          onClick: () => c.onClick(data, path),
        });
      }
    }

    if (entries.length === 0) return;

    // Convert page coordinates to root-relative
    const rootRect = this.root.getBoundingClientRect();
    this.contextMenu.show(x - rootRect.left, y - rootRect.top, entries);
  }

  // ── Rename ──────────────────────────────────────────────

  private startRename(id: string): void {
    const node = this.nodeMap.get(id);
    if (!node) return;
    if (this.renamingId) this.cancelRename();

    this.renamingId = id;
    const nameEl = node.nameEl;
    const currentName = node.data.name;

    const input = document.createElement("input");
    input.className = "ft-rename-input";
    input.type = "text";
    input.value = currentName;

    nameEl.textContent = "";
    nameEl.appendChild(input);
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

    const commit = () => {
      const newName = input.value.trim();
      if (newName && newName !== currentName && this.isValidName(newName)) {
        const oldPath = getNodePath(this.data, id);
        node.data.name = newName;
        nameEl.textContent = newName;

        // Update icon (extension might have changed)
        node.iconEl.innerHTML = this.resolveIcon(node.data, node.expanded);

        if (this.options.sort) {
          this.resortParent(id);
        }

        this.renamingId = null;
        this.pendingNewNodeId = null;

        const newPath = getNodePath(this.data, id);
        this.emitEventFull("rename", id, oldPath, newPath);
        this.emitChange();
      } else {
        // Cancel or invalid: revert
        if (this.pendingNewNodeId === id) {
          // Was a new node creation that was cancelled
          this.removeNodeInternal(id);
          this.pendingNewNodeId = null;
          this.renamingId = null;
          return;
        }
        nameEl.textContent = currentName;
        this.renamingId = null;
      }
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        // Revert
        if (this.pendingNewNodeId === id) {
          this.removeNodeInternal(id);
          this.pendingNewNodeId = null;
          this.renamingId = null;
          return;
        }
        nameEl.textContent = currentName;
        this.renamingId = null;
      }
    });

    input.addEventListener(
      "blur",
      () => {
        if (this.renamingId === id) commit();
      },
      { once: true },
    );
  }

  private cancelRename(): void {
    if (!this.renamingId) return;
    const node = this.nodeMap.get(this.renamingId);
    if (node) {
      const input = node.nameEl.querySelector("input");
      if (input) {
        node.nameEl.textContent = node.data.name;
      }
    }
    if (this.pendingNewNodeId === this.renamingId) {
      this.removeNodeInternal(this.renamingId);
      this.pendingNewNodeId = null;
    }
    this.renamingId = null;
  }

  private isValidName(name: string): boolean {
    return name.length > 0 && !/[/\\]/.test(name);
  }

  // ── Create ──────────────────────────────────────────────

  private createNewNode(type: "file" | "folder", parentId?: string): void {
    const id = generateId();
    const newNode: FileTreeNodeData = {
      id,
      name: type === "file" ? "untitled" : "new-folder",
      type,
      children: type === "folder" ? [] : undefined,
    };

    let targetParentId: string | null = parentId ?? null;

    // If no parentId given, use selected node's parent folder
    if (!targetParentId && this.selectedId) {
      const selNode = this.nodeMap.get(this.selectedId);
      if (selNode) {
        targetParentId =
          selNode.data.type === "folder" ? selNode.id : selNode.parentId;
      }
    }

    if (targetParentId) {
      const result = findNode(this.data, targetParentId);
      if (result) {
        const [parent] = result;
        if (parent.type === "folder") {
          if (!parent.children) parent.children = [];
          parent.children.push(newNode);
          this.expand(targetParentId);

          // Render the new node
          const parentInternal = this.nodeMap.get(targetParentId);
          if (parentInternal?.childrenEl) {
            this.renderNode(
              newNode,
              parentInternal.depth + 1,
              targetParentId,
              parentInternal.childrenEl,
            );
          }
        }
      }
    } else {
      // Add to root
      this.data.push(newNode);
      this.renderNode(newNode, 0, null, this.treeEl);
    }

    this.pendingNewNodeId = id;
    this.selectNode(id);
    this.startRename(id);

    this.emitEvent("create", id);
    this.emitChange();
  }

  // ── Delete ──────────────────────────────────────────────

  deleteNode(id: string): void {
    this.emitEvent("delete", id);
    this.removeNodeInternal(id);
    this.emitChange();
  }

  private removeNodeInternal(id: string): void {
    const node = this.nodeMap.get(id);
    if (!node) return;

    // Remove from data
    removeNode(this.data, id);

    // Remove DOM
    node.el.remove();

    // Remove from map (including descendants)
    this.removeFromMap(id);

    // Clear selection if needed
    if (this.selectedId === id) this.selectedId = null;
  }

  private removeFromMap(id: string): void {
    const node = this.nodeMap.get(id);
    if (!node) return;
    if (node.data.children) {
      for (const child of node.data.children) {
        this.removeFromMap(child.id);
      }
    }
    this.nodeMap.delete(id);
    this.expandedNodes.delete(id);
  }

  // ── Move (Drag & Drop) ─────────────────────────────────

  private handleDragMove(
    sourceId: string,
    targetId: string,
    position: DropPosition,
  ): void {
    // Prevent moving into own descendants
    if (isDescendant(this.data, sourceId, targetId)) return;

    const oldPath = getNodePath(this.data, sourceId);

    // Remove source from tree
    const sourceData = removeNode(this.data, sourceId);
    if (!sourceData) return;

    // Determine new parent & index
    const targetResult = findNode(this.data, targetId);
    if (!targetResult) {
      // Target was removed somehow; re-add source to root
      this.data.push(sourceData);
      this.fullRerender();
      return;
    }
    const [targetNode, targetParent] = targetResult;

    if (position === "inside" && targetNode.type === "folder") {
      if (!targetNode.children) targetNode.children = [];
      targetNode.children.push(sourceData);
    } else {
      const siblings = targetParent ? targetParent.children! : this.data;
      const idx = siblings.indexOf(targetNode);
      const insertIdx = position === "before" ? idx : idx + 1;
      siblings.splice(insertIdx, 0, sourceData);
    }

    if (this.options.sort) {
      const cmp =
        typeof this.options.sort === "function"
          ? this.options.sort
          : defaultSort;
      sortTree(this.data, cmp);
    }

    this.fullRerender();

    // Re-expand previously expanded
    if (position === "inside") this.expand(targetId);

    this.selectNode(sourceId);

    const newPath = getNodePath(this.data, sourceId);
    this.emitEventFull("move", sourceId, oldPath, newPath);
    this.emitChange();
  }

  private handleExternalDrop(
    files: FileList,
    targetId: string | null,
    position: DropPosition,
  ): void {
    // Create file nodes for each dropped file
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const newNode: FileTreeNodeData = {
        id: generateId(),
        name: f.name,
        type: "file",
        meta: { file: f },
      };

      let parentId: string | null = targetId;
      if (targetId && position !== "inside") {
        const n = this.nodeMap.get(targetId);
        parentId = n?.parentId ?? null;
      }

      if (parentId) {
        const result = findNode(this.data, parentId);
        if (result) {
          const [parent] = result;
          if (parent.type === "folder") {
            if (!parent.children) parent.children = [];
            parent.children.push(newNode);
          }
        }
      } else {
        this.data.push(newNode);
      }

      if (this.options.sort) {
        const cmp =
          typeof this.options.sort === "function"
            ? this.options.sort
            : defaultSort;
        sortTree(this.data, cmp);
      }

      this.fullRerender();
      this.emitEvent("drop", newNode.id);
    }

    this.emitChange();
  }

  // ── Re-sort parent after rename ─────────────────────────

  private resortParent(id: string): void {
    const result = findNode(this.data, id);
    if (!result) return;
    const [, parent] = result;
    const cmp =
      typeof this.options.sort === "function" ? this.options.sort : defaultSort;
    const siblings = parent?.children ?? this.data;
    siblings.sort(cmp);

    // Re-render just the parent's children
    const parentInternal = parent ? this.nodeMap.get(parent.id) : null;
    const container = parentInternal?.childrenEl ?? this.treeEl;
    const depth = parentInternal ? parentInternal.depth + 1 : 0;
    const parentIdStr = parent?.id ?? null;

    // Remove old child DOM elements
    const childIds = siblings.map((s) => s.id);
    for (const cid of childIds) {
      this.removeFromMap(cid);
    }
    container.innerHTML = "";

    // Re-render
    for (const child of siblings) {
      this.renderNode(child, depth, parentIdStr, container);
    }

    // Restore selection
    if (this.selectedId) {
      const selNode = this.nodeMap.get(this.selectedId);
      selNode?.contentEl.classList.add("ft-node__content--selected");
    }
  }

  // ── Full Rerender ───────────────────────────────────────

  private fullRerender(): void {
    // Preserve expanded state
    const wasExpanded = new Set(this.expandedNodes);
    this.renderTree();
    // Restore expanded
    for (const id of wasExpanded) {
      if (this.nodeMap.has(id)) {
        this.expand(id);
      }
    }
  }

  // ── Keyboard ────────────────────────────────────────────

  private onKeydown(e: KeyboardEvent): void {
    if (this.renamingId) return;
    const visible = this.getVisibleNodeIds();
    if (visible.length === 0) return;

    const currentIdx = this.selectedId ? visible.indexOf(this.selectedId) : -1;

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
        if (this.selectedId) {
          const node = this.nodeMap.get(this.selectedId);
          if (node?.data.type === "folder") {
            if (!node.expanded) {
              this.expand(this.selectedId);
            } else if (node.data.children?.length) {
              this.selectNode(node.data.children[0].id);
              this.scrollIntoView(node.data.children[0].id);
            }
          }
        }
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        if (this.selectedId) {
          const node = this.nodeMap.get(this.selectedId);
          if (node?.data.type === "folder" && node.expanded) {
            this.collapse(this.selectedId);
          } else if (node?.parentId) {
            this.selectNode(node.parentId);
            this.scrollIntoView(node.parentId);
          }
        }
        break;
      }
      case "Enter":
      case " ": {
        e.preventDefault();
        if (this.selectedId) {
          const node = this.nodeMap.get(this.selectedId);
          if (node?.data.type === "folder") this.toggleExpand(this.selectedId);
        }
        break;
      }
      case "F2": {
        e.preventDefault();
        if (this.selectedId && this.options.contextMenu !== false) {
          this.startRename(this.selectedId);
        }
        break;
      }
      case "Delete": {
        e.preventDefault();
        if (this.selectedId && this.options.contextMenu !== false) {
          this.deleteNode(this.selectedId);
        }
        break;
      }
    }
  }

  private getVisibleNodeIds(): string[] {
    const ids: string[] = [];
    const walk = (nodes: FileTreeNodeData[]) => {
      for (const node of nodes) {
        ids.push(node.id);
        if (
          node.type === "folder" &&
          this.expandedNodes.has(node.id) &&
          node.children
        ) {
          walk(node.children);
        }
      }
    };
    walk(this.data);
    return ids;
  }

  private scrollIntoView(id: string): void {
    const node = this.nodeMap.get(id);
    node?.contentEl.scrollIntoView({ block: "nearest" });
  }

  // ── Events ──────────────────────────────────────────────

  on(event: FileTreeEventType, handler: EventHandler): void {
    this.emitter.on(event, handler);
  }

  off(event: FileTreeEventType, handler: EventHandler): void {
    this.emitter.off(event, handler);
  }

  private emitEvent(type: FileTreeEventType, nodeId: string): void {
    const result = findNode(this.data, nodeId);
    if (!result) return;
    const [node, parent] = result;
    const path = getNodePath(this.data, nodeId);
    this.emitter.emit(type, {
      type,
      node: { ...node },
      path,
      parentNode: parent ? { ...parent, children: undefined } : null,
      tree: deepClone(this.data),
    });
  }

  private emitEventFull(
    type: FileTreeEventType,
    nodeId: string,
    oldPath?: string,
    newPath?: string,
  ): void {
    const result = findNode(this.data, nodeId);
    if (!result) return;
    const [node, parent] = result;
    this.emitter.emit(type, {
      type,
      node: { ...node },
      path: newPath ?? getNodePath(this.data, nodeId),
      oldPath,
      parentNode: parent ? { ...parent, children: undefined } : null,
      tree: deepClone(this.data),
    });
  }

  private emitChange(): void {
    const tree = deepClone(this.data);
    this.emitter.emit("change", {
      type: "change",
      node: { id: "", name: "", type: "folder" },
      path: "",
      parentNode: null,
      tree,
    });
  }

  // ── Public API: Data ────────────────────────────────────

  getData(): FileTreeNodeData[] {
    return deepClone(this.data);
  }

  getNode(id: string): FileTreeNodeData | undefined {
    const result = findNode(this.data, id);
    return result ? { ...result[0] } : undefined;
  }

  getPath(id: string): string {
    return getNodePath(this.data, id);
  }

  getSelectedNode(): FileTreeNodeData | null {
    if (!this.selectedId) return null;
    return this.getNode(this.selectedId) ?? null;
  }

  /** Replace the entire tree data and re-render. */
  setData(data: FileTreeNodeData[]): void {
    this.data = deepClone(data);
    if (this.options.sort) {
      const cmp =
        typeof this.options.sort === "function"
          ? this.options.sort
          : defaultSort;
      sortTree(this.data, cmp);
    }
    this.selectedId = null;
    this.fullRerender();
  }

  // ── Public API: Node Operations ─────────────────────────

  /** Programmatically add a node. */
  addNode(
    parentId: string | null,
    node: FileTreeNodeData,
    index?: number,
  ): void {
    const newNode = { ...node, id: node.id || generateId() };
    if (newNode.type === "folder" && !newNode.children) newNode.children = [];

    if (parentId) {
      const result = findNode(this.data, parentId);
      if (result) {
        const [parent] = result;
        if (!parent.children) parent.children = [];
        if (index !== undefined) {
          parent.children.splice(index, 0, newNode);
        } else {
          parent.children.push(newNode);
        }
      }
    } else {
      if (index !== undefined) {
        this.data.splice(index, 0, newNode);
      } else {
        this.data.push(newNode);
      }
    }

    if (this.options.sort) {
      const cmp =
        typeof this.options.sort === "function"
          ? this.options.sort
          : defaultSort;
      sortTree(this.data, cmp);
    }

    this.fullRerender();
    if (parentId) this.expand(parentId);
    this.emitEvent("create", newNode.id);
    this.emitChange();
  }

  /** Programmatically remove a node. */
  removeNode(id: string): void {
    this.deleteNode(id);
  }

  /** Programmatically rename a node. */
  renameNode(id: string, newName: string): void {
    const result = findNode(this.data, id);
    if (!result) return;
    const [node] = result;
    const oldPath = getNodePath(this.data, id);
    node.name = newName;

    const internal = this.nodeMap.get(id);
    if (internal) {
      internal.nameEl.textContent = newName;
      internal.iconEl.innerHTML = this.resolveIcon(node, internal.expanded);
    }

    if (this.options.sort) {
      this.resortParent(id);
    }

    const newPath = getNodePath(this.data, id);
    this.emitEventFull("rename", id, oldPath, newPath);
    this.emitChange();
  }

  /** Programmatically move a node. */
  moveNode(
    nodeId: string,
    targetParentId: string | null,
    index?: number,
  ): void {
    const oldPath = getNodePath(this.data, nodeId);
    const sourceData = removeNode(this.data, nodeId);
    if (!sourceData) return;

    if (targetParentId) {
      const result = findNode(this.data, targetParentId);
      if (result) {
        const [parent] = result;
        if (!parent.children) parent.children = [];
        if (index !== undefined) {
          parent.children.splice(index, 0, sourceData);
        } else {
          parent.children.push(sourceData);
        }
      }
    } else {
      if (index !== undefined) {
        this.data.splice(index, 0, sourceData);
      } else {
        this.data.push(sourceData);
      }
    }

    if (this.options.sort) {
      const cmp =
        typeof this.options.sort === "function"
          ? this.options.sort
          : defaultSort;
      sortTree(this.data, cmp);
    }

    this.fullRerender();
    if (targetParentId) this.expand(targetParentId);
    this.selectNode(nodeId);

    const newPath = getNodePath(this.data, nodeId);
    this.emitEventFull("move", nodeId, oldPath, newPath);
    this.emitChange();
  }

  select(id: string): void {
    this.selectNode(id);
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
