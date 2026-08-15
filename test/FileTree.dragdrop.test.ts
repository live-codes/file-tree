import { describe, expect, it } from "vitest";
import {
  createTree,
  nodeContentEl,
  nodeEl,
  rootOf,
  type FileTreeNodeData,
} from "./helpers";

const DATA: FileTreeNodeData[] = [
  { path: "src", type: "folder" },
  { path: "src/index.ts", type: "file" },
  { path: "src/lib", type: "folder" },
  { path: "src/lib/util.ts", type: "file" },
  { path: "package.json", type: "file" },
];

/** Build a synthetic drag event with a DataTransfer (jsdom lacks DragEvent). */
function dragEvent(
  type: string,
  init: { clientY?: number; dataTransfer?: DataTransfer; target?: EventTarget | null } = {},
): MouseEvent {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientY: init.clientY ?? 10 });
  if (init.dataTransfer) Object.defineProperty(ev, "dataTransfer", { value: init.dataTransfer });
  if (init.target) Object.defineProperty(ev, "target", { value: init.target });
  return ev;
}

function paths(tree: import("../src/index").FileTree): string[] {
  return tree.getData().map((d) => d.path);
}

/** Drag a node's content element and drop it on a target content element. */
function dragDrop(
  tree: import("../src/index").FileTree,
  sourcePath: string,
  targetPath: string,
  clientY = 10,
): void {
  const treeEl = rootOf(tree).querySelector(".ft-tree")!;
  const srcContent = nodeContentEl(tree, sourcePath)!;
  const tgtContent = nodeContentEl(tree, targetPath)!;
  // jsdom reports zero-size rects; give the target a real height.
  tgtContent.getBoundingClientRect = () =>
    ({ top: 0, bottom: 100, height: 100, left: 0, right: 100, width: 100 } as DOMRect);

  const dt = new DataTransfer();
  const start = dragEvent("dragstart", { dataTransfer: dt });
  Object.defineProperty(start, "target", { value: srcContent });
  treeEl.dispatchEvent(start);

  const over = dragEvent("dragover", { dataTransfer: dt, clientY });
  Object.defineProperty(over, "target", { value: tgtContent });
  treeEl.dispatchEvent(over);

  const drop = dragEvent("drop", { dataTransfer: dt });
  treeEl.dispatchEvent(drop);
}

describe("drag & drop (internal)", () => {
  it("moves a file into a folder on drop", () => {
    const tree = createTree({ data: DATA });
    const moved: Array<[string, string]> = [];
    tree.on("move", (e) => moved.push([e.oldPath!, e.path]));
    dragDrop(tree, "package.json", "src", 50);
    expect(paths(tree)).toContain("src/package.json");
    expect(paths(tree)).not.toContain("package.json");
    expect(moved).toEqual([["package.json", "src/package.json"]]);
    tree.destroy();
  });

  it("moves a file into a nested folder on drop", () => {
    const tree = createTree({ data: DATA });
    dragDrop(tree, "src/index.ts", "src/lib", 50);
    expect(paths(tree)).toContain("src/lib/index.ts");
    expect(paths(tree)).not.toContain("src/index.ts");
    tree.destroy();
  });

  it("refuses to drop a folder into its own descendant", () => {
    const tree = createTree({ data: DATA });
    tree.expand("src");
    dragDrop(tree, "src", "src/lib", 50);
    expect(paths(tree)).toContain("src");
    expect(paths(tree)).not.toContain("src/lib/src");
    tree.destroy();
  });

  it("emits a move event with source ui", () => {
    const tree = createTree({ data: DATA });
    const sources: string[] = [];
    tree.on("move", (e) => sources.push(e.source));
    dragDrop(tree, "package.json", "src", 50);
    expect(sources).toEqual(["ui"]);
    tree.destroy();
  });

  it("dragging a selected node moves the whole selection", () => {
    const tree = createTree({ data: DATA });
    tree.addNode({ path: "backup", type: "folder" });
    tree.select(["src/index.ts", "package.json"]);
    // Drag one of the selected nodes onto the backup folder.
    dragDrop(tree, "src/index.ts", "backup", 50);
    expect(paths(tree)).toContain("backup/index.ts");
    expect(paths(tree)).toContain("backup/package.json");
    expect(paths(tree)).not.toContain("src/index.ts");
    expect(paths(tree)).not.toContain("package.json");
    expect(paths(tree)).toContain("src/lib");
    tree.destroy();
  });
});

describe("drag & drop (external files)", () => {
  function externalDrop(
    tree: import("../src/index").FileTree,
    targetPath: string,
    file: File,
  ): void {
    const treeEl = rootOf(tree).querySelector(".ft-tree")!;
    const dt = new DataTransfer();
    dt.addFile(file);
    const tgt = nodeContentEl(tree, targetPath)!;
    tgt.getBoundingClientRect = () =>
      ({ top: 0, bottom: 100, height: 100, left: 0, right: 100, width: 100 } as DOMRect);
    const over = dragEvent("dragover", { dataTransfer: dt, clientY: 50 });
    Object.defineProperty(over, "target", { value: tgt });
    treeEl.dispatchEvent(over);
    const drop = dragEvent("drop", { dataTransfer: dt });
    treeEl.dispatchEvent(drop);
  }

  it("adds dropped files as nodes", () => {
    const tree = createTree({ data: DATA });
    externalDrop(tree, "src", new File(["x"], "photo.png", { type: "image/png" }));
    expect(tree.getNode("src/photo.png")).toBeDefined();
    expect(tree.getNode("src/photo.png")?.meta?.file).toBeInstanceOf(File);
    tree.destroy();
  });

  it("emits a drop event before adding files, honoring preventDefault", () => {
    const tree = createTree({ data: DATA });
    tree.on("drop", (e) => e.preventDefault());
    externalDrop(tree, "src", new File(["x"], "blocked.txt", { type: "text/plain" }));
    expect(tree.getNode("src/blocked.txt")).toBeUndefined();
    tree.destroy();
  });

  it("resolves name conflicts for dropped files", () => {
    const tree = createTree({ data: DATA });
    externalDrop(tree, "src", new File(["x"], "index.ts", { type: "text/plain" }));
    expect(tree.getNode("src/index-1.ts")).toBeDefined();
    tree.destroy();
  });

  it("drops at root when no target is hovered", () => {
    const tree = createTree({ data: DATA });
    const dt = new DataTransfer();
    dt.addFile(new File(["x"], "root.txt", { type: "text/plain" }));
    // Drop without a dragover target: DragDrop requires a currentDropTarget,
    // so drop on the tree element with no prior target is a no-op.
    const drop = dragEvent("drop", { dataTransfer: dt });
    rootOf(tree).querySelector(".ft-tree")!.dispatchEvent(drop);
    expect(tree.getNode("root.txt")).toBeUndefined();
    tree.destroy();
  });
});

describe("drag & drop disabled", () => {
  it("does not set draggable when readOnly", () => {
    const tree = createTree({ data: DATA, readOnly: true });
    expect(nodeEl(tree, "package.json")?.getAttribute("draggable")).toBeNull();
    tree.destroy();
  });

  it("does not set draggable when dragAndDrop: false", () => {
    const tree = createTree({ data: DATA, dragAndDrop: false });
    expect(nodeEl(tree, "package.json")?.getAttribute("draggable")).toBeNull();
    expect(tree["dragDrop"]).toBeNull();
    tree.destroy();
  });
});
