import type { InternalNode } from "./types";

export type DropPosition = "before" | "inside" | "after";

export interface DragDropCallbacks {
  getNode: (path: string) => InternalNode | undefined;
  /**
   * Return the paths that should be dragged together when a node is
   * dragged (e.g. the full selection, including the dragged node).
   */
  getDragPaths: (path: string) => string[];
  onMove: (
    sourcePaths: string[],
    targetPath: string,
    position: DropPosition,
  ) => void;
  onExternalDrop: (
    entries: { files: FileList; items: DataTransferItemList },
    targetPath: string | null,
    position: DropPosition,
  ) => void;
}

export class DragDrop {
  private draggedPaths: string[] = [];
  private currentDropTarget: HTMLElement | null = null;
  /** Whether the current drop target is the tree's empty space (root). */
  private rootDrop = false;
  private dropIndicator: HTMLElement;
  private dropPosition: DropPosition = "inside";
  private treeEl: HTMLElement;

  constructor(
    treeEl: HTMLElement,
    private callbacks: DragDropCallbacks,
  ) {
    this.treeEl = treeEl;

    this.dropIndicator = document.createElement("div");
    this.dropIndicator.className = "ft-drop-indicator";
    this.dropIndicator.style.display = "none";
    treeEl.appendChild(this.dropIndicator);

    this.onDragStart = this.onDragStart.bind(this);
    this.onDragOver = this.onDragOver.bind(this);
    this.onDragLeave = this.onDragLeave.bind(this);
    this.onDrop = this.onDrop.bind(this);
    this.onDragEnd = this.onDragEnd.bind(this);

    treeEl.addEventListener("dragstart", this.onDragStart);
    treeEl.addEventListener("dragover", this.onDragOver);
    treeEl.addEventListener("dragleave", this.onDragLeave);
    treeEl.addEventListener("drop", this.onDrop);
    treeEl.addEventListener("dragend", this.onDragEnd);
  }

  private onDragStart(e: DragEvent): void {
    const nodeEl = (e.target as HTMLElement).closest(
      ".ft-node",
    ) as HTMLElement | null;
    if (!nodeEl) return;
    const path = nodeEl.dataset.path;
    if (!path) return;

    this.draggedPaths = this.callbacks.getDragPaths(path);
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", this.draggedPaths.join("\n"));
    // Mark all dragged nodes (fade via rAF so the drag image isn't affected)
    for (const p of this.draggedPaths) {
      this.callbacks.getNode(p)?.el.classList.add("ft-node--dragging");
    }
    requestAnimationFrame(() => {
      for (const p of this.draggedPaths) {
        this.callbacks.getNode(p)?.el.style.setProperty("opacity", "0.4");
      }
    });
  }

  private onDragOver(e: DragEvent): void {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";

    const contentEl = (e.target as HTMLElement).closest(
      ".ft-node__content",
    ) as HTMLElement | null;
    if (!contentEl) {
      // Over empty space: if it's within an expanded folder's children
      // area, treat it as a drop inside that folder; otherwise drop on
      // the tree root.
      const childrenEl = (e.target as HTMLElement).closest(
        ".ft-node__children",
      ) as HTMLElement | null;
      const folderEl = childrenEl?.closest(".ft-node") as HTMLElement | null;
      const folderPath = folderEl?.dataset.path;
      const folderContentEl = folderEl?.querySelector(
        ":scope > .ft-node__content",
      ) as HTMLElement | null;
      if (folderPath && folderContentEl) {
        // Don't drop on any dragged node or into its descendants.
        if (this.draggedPaths.includes(folderPath)) {
          this.clearDropTarget();
          return;
        }
        if (this.draggedPaths.some((s) => folderPath.startsWith(s + "/"))) {
          this.clearDropTarget();
          return;
        }
        this.setDropTarget(
          folderContentEl,
          "inside",
          folderContentEl.getBoundingClientRect(),
        );
        return;
      }
      this.setRootDrop();
      return;
    }

    const nodeEl = contentEl.closest(".ft-node") as HTMLElement;
    const path = nodeEl?.dataset.path;
    if (!path) return;

    const nodeData = this.callbacks.getNode(path);
    if (!nodeData) return;

    // A file row nested inside a folder's children always drops into that
    // folder: the whole row highlights the parent instead of showing
    // before/after zones on the file itself.
    if (nodeData.data.type === "file") {
      const parentFolderEl = nodeEl.parentElement?.closest(
        ".ft-node",
      ) as HTMLElement | null;
      const parentPath = parentFolderEl?.dataset.path;
      const parentContentEl = parentFolderEl?.querySelector(
        ":scope > .ft-node__content",
      ) as HTMLElement | null;
      if (parentPath && parentContentEl) {
        // Don't drop into a dragged folder or into a dragged node's
        // descendant.
        if (this.draggedPaths.includes(parentPath)) {
          this.clearDropTarget();
          return;
        }
        if (this.draggedPaths.some((s) => parentPath.startsWith(s + "/"))) {
          this.clearDropTarget();
          return;
        }
        this.setDropTarget(
          parentContentEl,
          "inside",
          parentContentEl.getBoundingClientRect(),
        );
        return;
      }
    }

    // Don't drop on any dragged node or into its descendants.
    if (this.draggedPaths.includes(path)) {
      this.clearDropTarget();
      return;
    }
    if (this.draggedPaths.some((s) => path.startsWith(s + "/"))) {
      this.clearDropTarget();
      return;
    }

    const rect = contentEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ratio = y / rect.height;

    let position: DropPosition;
    if (nodeData.data.type === "folder") {
      if (ratio < 0.25) position = "before";
      else if (ratio > 0.75) position = "after";
      else position = "inside";
    } else {
      position = ratio < 0.5 ? "before" : "after";
    }

    this.setDropTarget(contentEl, position, rect);
  }

  private setDropTarget(
    contentEl: HTMLElement,
    position: DropPosition,
    rect: DOMRect,
  ): void {
    if (this.currentDropTarget) {
      this.currentDropTarget.classList.remove(
        "ft-node__content--drop-inside",
        "ft-node__content--drop-before",
        "ft-node__content--drop-after",
      );
    }
    if (this.rootDrop) {
      this.rootDrop = false;
      this.treeEl.classList.remove("ft-tree--drop-root");
    }

    this.currentDropTarget = contentEl;
    this.dropPosition = position;
    contentEl.classList.add(`ft-node__content--drop-${position}`);

    const treeRect = this.treeEl.getBoundingClientRect();

    if (position === "inside") {
      this.dropIndicator.style.display = "none";
    } else {
      this.dropIndicator.style.display = "block";
      this.dropIndicator.style.left = `${rect.left - treeRect.left}px`;
      this.dropIndicator.style.width = `${rect.width}px`;
      const topOffset =
        position === "before"
          ? rect.top - treeRect.top
          : rect.bottom - treeRect.top;
      this.dropIndicator.style.top = `${topOffset - 1}px`;
    }
  }

  private setRootDrop(): void {
    if (this.rootDrop) return;
    this.clearDropTarget();
    this.rootDrop = true;
    this.treeEl.classList.add("ft-tree--drop-root");
  }

  private clearDropTarget(): void {
    if (this.currentDropTarget) {
      this.currentDropTarget.classList.remove(
        "ft-node__content--drop-inside",
        "ft-node__content--drop-before",
        "ft-node__content--drop-after",
      );
      this.currentDropTarget = null;
    }
    if (this.rootDrop) {
      this.rootDrop = false;
      this.treeEl.classList.remove("ft-tree--drop-root");
    }
    this.dropIndicator.style.display = "none";
  }

  private onDragLeave(e: DragEvent): void {
    const treeRect = this.treeEl.getBoundingClientRect();
    const { clientX, clientY } = e;
    const outsideTree =
      clientX < treeRect.left ||
      clientX > treeRect.right ||
      clientY < treeRect.top ||
      clientY > treeRect.bottom;

    if (outsideTree) {
      // Pointer left the tree entirely: drop the root highlight or any
      // node target so the indicator doesn't stay stuck.
      this.clearDropTarget();
      return;
    }

    const contentEl = (e.target as HTMLElement).closest(
      ".ft-node__content",
    ) as HTMLElement | null;
    if (contentEl && contentEl === this.currentDropTarget) {
      const rect = contentEl.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        this.clearDropTarget();
      }
    }
  }

  private onDrop(e: DragEvent): void {
    e.preventDefault();

    // Determine drop target: a node's path, or null for the tree's root.
    let targetPath: string | null = null;
    if (this.currentDropTarget) {
      const targetNodeEl = this.currentDropTarget.closest(
        ".ft-node",
      ) as HTMLElement;
      targetPath = targetNodeEl?.dataset.path ?? null;
    }

    const position = this.dropPosition;
    const isExternal =
      ((e.dataTransfer?.files && e.dataTransfer.files.length > 0) ||
        (e.dataTransfer?.items && e.dataTransfer.items.length > 0)) &&
      this.draggedPaths.length === 0;
    const isRootDrop = this.rootDrop;

    this.clearDropTarget();

    if (!targetPath && !isRootDrop) {
      // No drop target was set — the drop happened outside any node.
      this.cleanup();
      return;
    }

    if (isExternal) {
      const files = e.dataTransfer.files;
      const items = e.dataTransfer.items; // for directories
      const entries = { files, items };
      this.callbacks.onExternalDrop(entries, targetPath, position);
      return;
    }

    if (this.draggedPaths.length > 0) {
      this.callbacks.onMove(this.draggedPaths, targetPath ?? "", position);
    }

    this.cleanup();
  }

  private onDragEnd(): void {
    this.cleanup();
  }

  private cleanup(): void {
    for (const p of this.draggedPaths) {
      const node = this.callbacks.getNode(p);
      node?.el.classList.remove("ft-node--dragging");
      node?.el.style.removeProperty("opacity");
    }
    this.draggedPaths = [];
    this.clearDropTarget();
  }

  destroy(): void {
    this.treeEl.removeEventListener("dragstart", this.onDragStart);
    this.treeEl.removeEventListener("dragover", this.onDragOver);
    this.treeEl.removeEventListener("dragleave", this.onDragLeave);
    this.treeEl.removeEventListener("drop", this.onDrop);
    this.treeEl.removeEventListener("dragend", this.onDragEnd);
    this.dropIndicator.remove();
  }
}
