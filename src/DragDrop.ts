import type { InternalNode } from "./types";

export type DropPosition = "before" | "inside" | "after";

export interface DragDropCallbacks {
  getNode: (path: string) => InternalNode | undefined;
  onMove: (
    sourcePath: string,
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
  private draggedPath: string | null = null;
  private currentDropTarget: HTMLElement | null = null;
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

    this.draggedPath = path;
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", path);
    nodeEl.classList.add("ft-node--dragging");

    requestAnimationFrame(() => {
      nodeEl.style.opacity = "0.4";
    });
  }

  private onDragOver(e: DragEvent): void {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";

    const contentEl = (e.target as HTMLElement).closest(
      ".ft-node__content",
    ) as HTMLElement | null;
    if (!contentEl) {
      this.clearDropTarget();
      return;
    }

    const nodeEl = contentEl.closest(".ft-node") as HTMLElement;
    const path = nodeEl?.dataset.path;
    if (!path) return;

    // Don't drop on self
    if (path === this.draggedPath) {
      this.clearDropTarget();
      return;
    }

    const rect = contentEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ratio = y / rect.height;
    const nodeData = this.callbacks.getNode(path);
    if (!nodeData) return;

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

  private clearDropTarget(): void {
    if (this.currentDropTarget) {
      this.currentDropTarget.classList.remove(
        "ft-node__content--drop-inside",
        "ft-node__content--drop-before",
        "ft-node__content--drop-after",
      );
      this.currentDropTarget = null;
    }
    this.dropIndicator.style.display = "none";
  }

  private onDragLeave(e: DragEvent): void {
    const contentEl = (e.target as HTMLElement).closest(
      ".ft-node__content",
    ) as HTMLElement | null;
    if (contentEl && contentEl === this.currentDropTarget) {
      const rect = contentEl.getBoundingClientRect();
      const { clientX, clientY } = e;
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
    const targetContentEl = this.currentDropTarget;
    if (!targetContentEl) return;

    const targetNodeEl = targetContentEl.closest(".ft-node") as HTMLElement;
    const targetPath = targetNodeEl?.dataset.path;
    if (!targetPath) return;

    const position = this.dropPosition;
    this.clearDropTarget();

    // External file drop
    if (
      ((e.dataTransfer?.files && e.dataTransfer.files.length > 0) ||
        (e.dataTransfer?.items && e.dataTransfer.items.length > 0)) &&
      !this.draggedPath
    ) {
      const files = e.dataTransfer.files;
      const items = e.dataTransfer.items; // for directories
      const entries = { files, items };
      this.callbacks.onExternalDrop(entries, targetPath, position);
      return;
    }

    if (this.draggedPath && this.draggedPath !== targetPath) {
      this.callbacks.onMove(this.draggedPath, targetPath, position);
    }

    this.cleanup();
  }

  private onDragEnd(): void {
    this.cleanup();
  }

  private cleanup(): void {
    const dragging = this.treeEl.querySelector(
      ".ft-node--dragging",
    ) as HTMLElement | null;
    if (dragging) {
      dragging.classList.remove("ft-node--dragging");
      dragging.style.opacity = "";
    }
    this.draggedPath = null;
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
