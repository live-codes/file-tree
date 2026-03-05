import type { InternalNode } from "./types";

export type DropPosition = "before" | "inside" | "after";

export interface DropInfo {
  targetId: string;
  position: DropPosition;
}

export interface DragDropCallbacks {
  getNode: (id: string) => InternalNode | undefined;
  onMove: (sourceId: string, targetId: string, position: DropPosition) => void;
  onExternalDrop: (
    files: FileList,
    targetId: string | null,
    position: DropPosition,
  ) => void;
}

export class DragDrop {
  private draggedId: string | null = null;
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
    const id = nodeEl.dataset.id;
    if (!id) return;

    this.draggedId = id;
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", id);
    nodeEl.classList.add("ft-node--dragging");

    // Use a transparent drag image to rely on our own indicators
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
    const id = nodeEl?.dataset.id;
    if (!id) return;

    // Don't drop on self
    if (id === this.draggedId) {
      this.clearDropTarget();
      return;
    }

    const rect = contentEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ratio = y / rect.height;
    const nodeData = this.callbacks.getNode(id);
    if (!nodeData) return;

    let position: DropPosition;
    if (nodeData.data.type === "folder") {
      if (ratio < 0.25) position = "before";
      else if (ratio > 0.75) position = "after";
      else position = "inside";
    } else {
      position = ratio < 0.5 ? "before" : "after";
    }

    this.setDropTarget(contentEl, nodeEl, position, rect);
  }

  private setDropTarget(
    contentEl: HTMLElement,
    nodeEl: HTMLElement,
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
    const targetId = targetNodeEl?.dataset.id;
    if (!targetId) return;

    const position = this.dropPosition;
    this.clearDropTarget();

    // External file drop
    if (
      e.dataTransfer?.files &&
      e.dataTransfer.files.length > 0 &&
      !this.draggedId
    ) {
      this.callbacks.onExternalDrop(e.dataTransfer.files, targetId, position);
      return;
    }

    if (this.draggedId && this.draggedId !== targetId) {
      this.callbacks.onMove(this.draggedId, targetId, position);
    }

    this.cleanup();
  }

  private onDragEnd(_e: DragEvent): void {
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
    this.draggedId = null;
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
