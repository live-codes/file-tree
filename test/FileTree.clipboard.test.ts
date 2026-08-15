import { describe, expect, it } from "vitest";
import {
  createTree,
  nodeContentEl,
  queryAll,
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

function paths(tree: import("../src/index").FileTree): string[] {
  return tree.getData().map((d) => d.path);
}

describe("copy / paste", () => {
  it("copies a node into a folder, keeping the original", () => {
    const tree = createTree({ data: DATA });
    const copied: Array<[string, string]> = [];
    tree.on("copy", (e) => copied.push([e.oldPath!, e.path]));
    tree.copyNode("src/index.ts", "src/lib");
    expect(paths(tree)).toContain("src/lib/index.ts");
    expect(paths(tree)).toContain("src/index.ts");
    expect(copied).toEqual([["src/index.ts", "src/lib/index.ts"]]);
    tree.destroy();
  });

  it("copies a folder with all descendants into a subfolder", () => {
    const tree = createTree({ data: DATA });
    // Copy the whole `src` tree into a new location under a new parent.
    tree.addNode({ path: "backup", type: "folder" });
    tree.copyNode("src", "backup");
    expect(paths(tree)).toContain("backup/src");
    expect(paths(tree)).toContain("backup/src/index.ts");
    expect(paths(tree)).toContain("backup/src/lib/util.ts");
    tree.destroy();
  });

  it("duplicates a file when copying to the same parent", () => {
    const tree = createTree({ data: DATA });
    const newPath = tree.copyNode("src/index.ts", "src");
    expect(newPath).toBe("src/index copy.ts");
    expect(paths(tree)).toContain("src/index copy.ts");
    expect(paths(tree)).toContain("src/index.ts");
    tree.destroy();
  });

  it("duplicates a folder with descendants when copying to the same parent", () => {
    const tree = createTree({ data: DATA });
    const newPath = tree.copyNode("src", "");
    expect(newPath).toBe("src copy");
    expect(paths(tree)).toContain("src copy");
    expect(paths(tree)).toContain("src copy/index.ts");
    expect(paths(tree)).toContain("src copy/lib/util.ts");
    expect(paths(tree)).toContain("src");
    tree.destroy();
  });

  it("resolves a unique name when the ' copy' name is already taken", () => {
    const tree = createTree({ data: DATA });
    tree.addNode({ path: "src/index copy.ts", type: "file" });
    const newPath = tree.copyNode("src/index.ts", "src");
    expect(newPath).toBe("src/index copy-1.ts");
    tree.destroy();
  });

  it("resolves a unique name on copy conflict in a new folder", () => {
    const tree = createTree({ data: DATA });
    tree.addNode({ path: "backup", type: "folder" });
    tree.addNode({ path: "backup/src", type: "folder" });
    // backup/src exists, so the copy becomes backup/src-1
    const newPath = tree.copyNode("src", "backup");
    expect(newPath).toBe("backup/src-1");
    tree.destroy();
  });

  it("returns null when copying into itself or a descendant", () => {
    const tree = createTree({ data: DATA });
    expect(tree.copyNode("src", "src")).toBeNull();
    expect(tree.copyNode("src", "src/lib")).toBeNull();
    tree.destroy();
  });

  it("copyToClipboard + pasteNode duplicates a node into a selected folder", () => {
    const tree = createTree({ data: DATA });
    tree.addNode({ path: "backup", type: "folder" });
    tree.copyToClipboard("src/lib/util.ts");
    tree.select("backup");
    tree.pasteNode();
    expect(paths(tree)).toContain("backup/util.ts");
    expect(tree.getNode("src/lib/util.ts")).toBeDefined();
    tree.destroy();
  });

  it("copyToClipboard + pasteNode duplicates a node into the same folder", () => {
    const tree = createTree({ data: DATA });
    tree.copyToClipboard("src/lib/util.ts");
    tree.select("src/lib");
    tree.pasteNode();
    expect(paths(tree)).toContain("src/lib/util copy.ts");
    expect(tree.getNode("src/lib/util.ts")).toBeDefined();
    tree.destroy();
  });

  it("copyToClipboard + pasteNode duplicates a selected folder in its parent", () => {
    const tree = createTree({ data: DATA });
    tree.copyToClipboard("src");
    tree.select("src");
    tree.pasteNode();
    expect(paths(tree)).toContain("src copy");
    expect(paths(tree)).toContain("src copy/index.ts");
    expect(paths(tree)).toContain("src copy/lib/util.ts");
    expect(tree.getNode("src")).toBeDefined();
    tree.destroy();
  });
});

describe("cut / paste (move)", () => {
  it("cut + paste moves a node", () => {
    const tree = createTree({ data: DATA });
    const moved: Array<[string, string]> = [];
    tree.on("move", (e) => moved.push([e.oldPath!, e.path]));
    tree.cutNode("src/index.ts");
    tree.pasteNode("src/lib");
    expect(paths(tree)).toContain("src/lib/index.ts");
    expect(paths(tree)).not.toContain("src/index.ts");
    expect(moved).toEqual([["src/index.ts", "src/lib/index.ts"]]);
    tree.destroy();
  });

  it("cut + paste moves a folder and descendants", () => {
    const tree = createTree({ data: DATA });
    tree.addNode({ path: "backup", type: "folder" });
    tree.cutNode("src");
    tree.pasteNode("backup");
    expect(paths(tree)).not.toContain("src");
    expect(paths(tree)).toContain("backup/src");
    expect(paths(tree)).toContain("backup/src/index.ts");
    expect(paths(tree)).toContain("backup/src/lib/util.ts");
    tree.destroy();
  });

  it("paste into a file targets its parent folder", () => {
    const tree = createTree({ data: DATA });
    tree.cutNode("package.json");
    tree.pasteNode("src/index.ts");
    expect(paths(tree)).toContain("src/package.json");
    tree.destroy();
  });

  it("clears the clipboard after a cut-paste", () => {
    const tree = createTree({ data: DATA });
    tree.cutNode("src/index.ts");
    tree.pasteNode("src/lib");
    expect(tree["clipboard"]).toBeNull();
    tree.destroy();
  });
});

describe("moveNode", () => {
  it("moves a node to a new parent", () => {
    const tree = createTree({ data: DATA });
    tree.moveNode("src/index.ts", "src/lib");
    expect(paths(tree)).toContain("src/lib/index.ts");
    expect(paths(tree)).not.toContain("src/index.ts");
    tree.destroy();
  });

  it("moves a folder and its descendants into a new parent", () => {
    const tree = createTree({ data: DATA });
    tree.addNode({ path: "backup", type: "folder" });
    tree.moveNode("src", "backup");
    expect(paths(tree)).toContain("backup/src");
    expect(paths(tree)).toContain("backup/src/lib/util.ts");
    expect(paths(tree)).not.toContain("src");
    tree.destroy();
  });

  it("does nothing when moving to the same parent", () => {
    const tree = createTree({ data: DATA });
    tree.moveNode("src/index.ts", "src");
    expect(paths(tree)).toContain("src/index.ts");
    tree.destroy();
  });

  it("refuses to move a folder into its own descendant", () => {
    const tree = createTree({ data: DATA });
    tree.moveNode("src", "src/lib");
    expect(paths(tree)).toContain("src");
    tree.destroy();
  });
});

describe("context menu clipboard wiring", () => {
  it("shows Copy/Cut for any node", () => {
    const tree = createTree({ data: DATA });
    tree.select("src/index.ts");
    // Trigger context menu via the private method (right-click path).
    (tree as unknown as { showContextMenu(p: string, x: number, y: number): void })
      .showContextMenu("src/index.ts", 10, 10);
    const labels = queryAll(rootOf(tree), ".ft-context-menu__label").map((el) => el.textContent);
    expect(labels).toContain("Copy");
    expect(labels).toContain("Cut");
    tree.destroy();
  });

  it("shows Paste only when something is on the clipboard", () => {
    const tree = createTree({ data: DATA });
    (tree as unknown as { showContextMenu(p: string, x: number, y: number): void })
      .showContextMenu("src", 10, 10);
    let labels = queryAll(rootOf(tree), ".ft-context-menu__label").map((el) => el.textContent);
    expect(labels).not.toContain("Paste");
    tree.copyToClipboard("src/index.ts");
    (tree as unknown as { showContextMenu(p: string, x: number, y: number): void })
      .showContextMenu("src", 10, 10);
    labels = queryAll(rootOf(tree), ".ft-context-menu__label").map((el) => el.textContent);
    expect(labels).toContain("Paste");
    tree.destroy();
  });

  it("context menu Copy + Paste duplicates a node", () => {
    const tree = createTree({ data: DATA });
    tree.copyToClipboard("src/index.ts");
    (tree as unknown as { showContextMenu(p: string, x: number, y: number): void })
      .showContextMenu("src/lib", 10, 10);
    const pasteItem = queryAll(rootOf(tree), ".ft-context-menu__item").find(
      (el) => el.querySelector(".ft-context-menu__label")?.textContent === "Paste",
    );
    expect(pasteItem).toBeDefined();
    pasteItem!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(paths(tree)).toContain("src/lib/index.ts");
    tree.destroy();
  });
});

describe("keyboard clipboard shortcuts", () => {
  it("Ctrl+C copies and Ctrl+V pastes", () => {
    const tree = createTree({ data: DATA });
    tree.select("src/index.ts");
    rootOf(tree).dispatchEvent(new KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true }));
    expect(tree["clipboard"]).toEqual({ paths: ["src/index.ts"], type: "copy" });
    tree.select("src/lib");
    rootOf(tree).dispatchEvent(new KeyboardEvent("keydown", { key: "v", ctrlKey: true, bubbles: true }));
    expect(paths(tree)).toContain("src/lib/index.ts");
    tree.destroy();
  });

  it("Ctrl+X cuts and Ctrl+V moves", () => {
    const tree = createTree({ data: DATA });
    tree.select("src/index.ts");
    rootOf(tree).dispatchEvent(new KeyboardEvent("keydown", { key: "x", ctrlKey: true, bubbles: true }));
    expect(tree["clipboard"]?.type).toBe("cut");
    tree.select("src/lib");
    rootOf(tree).dispatchEvent(new KeyboardEvent("keydown", { key: "v", ctrlKey: true, bubbles: true }));
    expect(paths(tree)).toContain("src/lib/index.ts");
    expect(paths(tree)).not.toContain("src/index.ts");
    tree.destroy();
  });

  it("applies cut highlight to the cut node", () => {
    const tree = createTree({ data: DATA });
    tree.select("src/index.ts");
    rootOf(tree).dispatchEvent(new KeyboardEvent("keydown", { key: "x", ctrlKey: true, bubbles: true }));
    expect(
      nodeContentEl(tree, "src/index.ts")!.classList.contains("ft-node__content--cut"),
    ).toBe(true);
    tree.destroy();
  });
});
