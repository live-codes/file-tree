import { afterEach, describe, expect, it, vi } from "vitest";
import { DragDrop } from "../src/DragDrop";
import type { InternalNode } from "../src/types";

interface TestNode {
  path: string;
  type: "file" | "folder";
}

function makeNode(path: string, type: TestNode["type"]): InternalNode {
  const el = document.createElement("div");
  el.className = "ft-node";
  el.dataset.path = path;
  const contentEl = document.createElement("div");
  contentEl.className = "ft-node__content";
  el.appendChild(contentEl);
  return {
    path,
    parentPath: "",
    name: path.split("/").pop() ?? "",
    data: { path, type },
    depth: 0,
    expanded: false,
    el,
    contentEl,
    childrenEl: type === "folder" ? document.createElement("div") : null,
    nameEl: contentEl,
    arrowEl: null,
    iconEl: contentEl,
  };
}

function setup(nodes: TestNode[] = [{ path: "a.ts", type: "file" }, { path: "src", type: "folder" }]) {
  const treeEl = document.createElement("div");
  treeEl.className = "ft-tree";
  document.body.appendChild(treeEl);
  const nodeMap = new Map(nodes.map((n) => [n.path, makeNode(n.path, n.type)]));
  nodeMap.forEach((n) => treeEl.appendChild(n.el));
  const onMove = vi.fn();
  const onExternalDrop = vi.fn();
  const dd = new DragDrop(treeEl, {
    getNode: (path) => nodeMap.get(path),
    onMove,
    onExternalDrop,
  });
  return { treeEl, dd, nodeMap, onMove, onExternalDrop };
}

afterEach(() => {
  document.body.innerHTML = "";
});

/** Build a synthetic drag event with a DataTransfer (jsdom lacks DragEvent). */
function dragEvent(
  type: string,
  init: { clientY?: number; dataTransfer?: DataTransfer; target?: EventTarget | null } = {},
): MouseEvent {
  const ev = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientY: init.clientY ?? 10,
  });
  if (init.dataTransfer) {
    Object.defineProperty(ev, "dataTransfer", { value: init.dataTransfer });
  }
  if (init.target) {
    Object.defineProperty(ev, "target", { value: init.target });
  }
  return ev;
}

describe("DragDrop", () => {
  it("marks the dragged node on dragstart", () => {
    const { treeEl, nodeMap } = setup();
    const dt = new DataTransfer();
    const start = dragEvent("dragstart", { dataTransfer: dt });
    Object.defineProperty(start, "target", { value: nodeMap.get("a.ts")!.el });
    treeEl.dispatchEvent(start);
    expect(nodeMap.get("a.ts")!.el.classList.contains("ft-node--dragging")).toBe(true);
  });

  it("computes 'inside' position for a folder and calls onMove on drop", () => {
    const { treeEl, nodeMap, onMove } = setup();
    const dt = new DataTransfer();
    // dragstart on a.ts
    const start = dragEvent("dragstart", { dataTransfer: dt });
    Object.defineProperty(start, "target", { value: nodeMap.get("a.ts")!.el });
    treeEl.dispatchEvent(start);
    // dragover on src folder (middle → inside)
    const srcContent = nodeMap.get("src")!.contentEl;
    srcContent.getBoundingClientRect = () =>
      ({ top: 0, bottom: 100, height: 100, left: 0, right: 100, width: 100 } as DOMRect);
    const over = dragEvent("dragover", { dataTransfer: dt, clientY: 50 });
    Object.defineProperty(over, "target", { value: srcContent });
    treeEl.dispatchEvent(over);
    expect(srcContent.classList.contains("ft-node__content--drop-inside")).toBe(true);
    // drop
    const drop = dragEvent("drop", { dataTransfer: dt });
    treeEl.dispatchEvent(drop);
    expect(onMove).toHaveBeenCalledWith("a.ts", "src", "inside");
  });

  it("computes 'before'/'after' positions from pointer y", () => {
    const { treeEl, nodeMap, onMove } = setup([
      { path: "a.ts", type: "file" },
      { path: "b.ts", type: "file" },
    ]);
    const content = nodeMap.get("b.ts")!.contentEl;
    content.getBoundingClientRect = () =>
      ({ top: 0, bottom: 100, height: 100, left: 0, right: 100, width: 100 } as DOMRect);

    const dragFrom = () => {
      const dt = new DataTransfer();
      const start = dragEvent("dragstart", { dataTransfer: dt });
      Object.defineProperty(start, "target", { value: nodeMap.get("a.ts")!.el });
      treeEl.dispatchEvent(start);
      return dt;
    };

    // top half → before
    let dt = dragFrom();
    const overTop = dragEvent("dragover", { dataTransfer: dt, clientY: 10 });
    Object.defineProperty(overTop, "target", { value: content });
    treeEl.dispatchEvent(overTop);
    const dropTop = dragEvent("drop", { dataTransfer: dt });
    treeEl.dispatchEvent(dropTop);
    expect(onMove).toHaveBeenCalledWith("a.ts", "b.ts", "before");
    onMove.mockClear();

    // bottom half → after (re-drag: the previous drop cleared the drag state)
    dt = dragFrom();
    const overBottom = dragEvent("dragover", { dataTransfer: dt, clientY: 90 });
    Object.defineProperty(overBottom, "target", { value: content });
    treeEl.dispatchEvent(overBottom);
    const dropBottom = dragEvent("drop", { dataTransfer: dt });
    treeEl.dispatchEvent(dropBottom);
    expect(onMove).toHaveBeenCalledWith("a.ts", "b.ts", "after");
  });

  it("does not allow dropping on self", () => {
    const { treeEl, nodeMap, onMove } = setup([{ path: "a.ts", type: "file" }]);
    const dt = new DataTransfer();
    const start = dragEvent("dragstart", { dataTransfer: dt });
    Object.defineProperty(start, "target", { value: nodeMap.get("a.ts")!.el });
    treeEl.dispatchEvent(start);
    const content = nodeMap.get("a.ts")!.contentEl;
    content.getBoundingClientRect = () =>
      ({ top: 0, bottom: 100, height: 100, left: 0, right: 100, width: 100 } as DOMRect);
    const over = dragEvent("dragover", { dataTransfer: dt, clientY: 10 });
    Object.defineProperty(over, "target", { value: content });
    treeEl.dispatchEvent(over);
    // No drop target should be set; a subsequent drop is a no-op.
    expect(content.classList.contains("ft-node__content--drop-inside")).toBe(false);
    const drop = dragEvent("drop", { dataTransfer: dt });
    treeEl.dispatchEvent(drop);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("calls onExternalDrop when external files are dropped", () => {
    const { treeEl, nodeMap, onExternalDrop } = setup([{ path: "src", type: "folder" }]);
    const dt = new DataTransfer();
    dt.addFile(new File(["x"], "photo.png", { type: "image/png" }));
    // No internal dragstart happened, so it's treated as external.
    const srcContent = nodeMap.get("src")!.contentEl;
    srcContent.getBoundingClientRect = () =>
      ({ top: 0, bottom: 100, height: 100, left: 0, right: 100, width: 100 } as DOMRect);
    const over = dragEvent("dragover", { dataTransfer: dt, clientY: 50 });
    Object.defineProperty(over, "target", { value: srcContent });
    treeEl.dispatchEvent(over);
    const drop = dragEvent("drop", { dataTransfer: dt });
    treeEl.dispatchEvent(drop);
    expect(onExternalDrop).toHaveBeenCalledWith(
      { files: dt.files, items: dt.items },
      "src",
      "inside",
    );
  });

  it("cleans up dragging state on dragend", () => {
    const { treeEl, nodeMap } = setup();
    const dt = new DataTransfer();
    const start = dragEvent("dragstart", { dataTransfer: dt });
    Object.defineProperty(start, "target", { value: nodeMap.get("a.ts")!.el });
    treeEl.dispatchEvent(start);
    expect(nodeMap.get("a.ts")!.el.classList.contains("ft-node--dragging")).toBe(true);
    treeEl.dispatchEvent(dragEvent("dragend", { dataTransfer: dt }));
    expect(nodeMap.get("a.ts")!.el.classList.contains("ft-node--dragging")).toBe(false);
  });

  it("destroy() removes the drop indicator and listeners", () => {
    const { treeEl, dd } = setup();
    expect(treeEl.querySelector(".ft-drop-indicator")).not.toBeNull();
    dd.destroy();
    expect(treeEl.querySelector(".ft-drop-indicator")).toBeNull();
  });
});
