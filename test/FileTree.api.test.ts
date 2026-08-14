import { describe, expect, it, vi } from "vitest";
import {
  createTree,
  keydown,
  nodeContentEl,
  renderedPaths,
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

describe("public API", () => {
  it("getData returns a clone", () => {
    const tree = createTree({ data: DATA });
    const data = tree.getData();
    expect(data).toHaveLength(5);
    // Mutating the returned array must not affect the tree.
    data.push({ path: "x", type: "file" });
    expect(tree.getData()).toHaveLength(5);
    tree.destroy();
  });

  it("getNode returns a copy", () => {
    const tree = createTree({ data: DATA });
    const node = tree.getNode("src/index.ts");
    expect(node?.path).toBe("src/index.ts");
    node!.meta = { hacked: true };
    expect(tree.getNode("src/index.ts")?.meta).toBeUndefined();
    tree.destroy();
  });

  it("getNode normalizes the query path", () => {
    const tree = createTree({ data: DATA });
    expect(tree.getNode("src\\index.ts")?.path).toBe("src/index.ts");
    tree.destroy();
  });

  it("getSelectedNode returns null when nothing selected", () => {
    const tree = createTree({ data: DATA });
    expect(tree.getSelectedNode()).toBeNull();
    tree.destroy();
  });

  it("setData replaces the tree and resets selection", () => {
    const tree = createTree({ data: DATA });
    tree.select("src/index.ts");
    tree.setData([{ path: "new.ts", type: "file" }]);
    expect(tree.getData().map((d) => d.path)).toEqual(["new.ts"]);
    expect(tree.getSelectedNode()).toBeNull();
    tree.destroy();
  });

  it("addNode adds a node and expands ancestors", () => {
    const tree = createTree({ data: [] });
    const created: string[] = [];
    tree.on("create", (e) => created.push(e.path));
    tree.addNode({ path: "src/images/logo.svg", type: "file", meta: { x: 1 } });
    expect(paths(tree)).toContain("src/images/logo.svg");
    expect(tree.getNode("src")?.type).toBe("folder");
    expect(renderedPaths(tree)).toContain("src/images/logo.svg");
    expect(created).toEqual(["src/images/logo.svg"]);
    tree.destroy();
  });

  it("addNode ignores duplicates and empty paths", () => {
    const tree = createTree({ data: DATA });
    tree.addNode({ path: "src/index.ts", type: "file" });
    tree.addNode({ path: "", type: "file" });
    expect(tree.getData()).toHaveLength(5);
    tree.destroy();
  });

  it("removeNode removes a node and its descendants", () => {
    const tree = createTree({ data: DATA });
    tree.removeNode("src");
    expect(paths(tree)).toEqual(["package.json"]);
    tree.destroy();
  });
});

describe("renameNode API", () => {
  it("renames a node and emits rename with source api", () => {
    const tree = createTree({ data: DATA });
    const events: Array<[string, string, string]> = [];
    tree.on("rename", (e) => events.push([e.oldPath!, e.path, e.source]));
    tree.renameNode("src/index.ts", "main.ts");
    expect(tree.getNode("src/main.ts")).toBeDefined();
    expect(tree.getNode("src/index.ts")).toBeUndefined();
    expect(events).toEqual([["src/index.ts", "src/main.ts", "api"]]);
    tree.destroy();
  });

  it("creates intermediate folders for slash names (file)", () => {
    const tree = createTree({ data: [{ path: "logo.svg", type: "file" }] });
    tree.renameNode("logo.svg", "images/logo.svg");
    expect(paths(tree)).toContain("images");
    expect(paths(tree)).toContain("images/logo.svg");
    expect(tree.getNode("images")?.type).toBe("folder");
    tree.destroy();
  });

  it("creates intermediate folders for slash names (folder, moves children)", () => {
    const tree = createTree({
      data: [
        { path: "src", type: "folder" },
        { path: "src/main.js", type: "file" },
      ],
    });
    tree.renameNode("src", "lib/utils");
    expect(paths(tree)).toContain("lib/utils/main.js");
    expect(tree.getNode("src")).toBeUndefined();
    tree.destroy();
  });

  it("rejects folder rename into itself", () => {
    const tree = createTree({ data: [{ path: "a", type: "folder" }] });
    tree.renameNode("a", "a/b");
    expect(tree.getNode("a")).toBeDefined();
    expect(tree.getNode("a/b")).toBeUndefined();
    tree.destroy();
  });

  it("rejects backslash and empty names", () => {
    const tree = createTree({ data: [{ path: "a", type: "file" }] });
    tree.renameNode("a", "b\\c");
    tree.renameNode("a", "");
    expect(tree.getNode("a")).toBeDefined();
    tree.destroy();
  });

  it("does nothing when renaming to a conflicting sibling path", () => {
    const tree = createTree({ data: DATA });
    // Renaming package.json → src/index.ts would place it under src (different
    // parent), which is allowed. Use a same-parent conflict instead.
    tree.addNode({ path: "other.json", type: "file" });
    tree.renameNode("package.json", "other.json");
    expect(tree.getNode("package.json")).toBeDefined();
    expect(tree.getNode("other.json")).toBeDefined();
    tree.destroy();
  });
});

describe("event payloads", () => {
  it("includes path, oldPath, parentPath, parentNode and tree snapshot", () => {
    const tree = createTree({ data: DATA });
    let captured: import("../src/index").FileTreeEvent | undefined;
    tree.on("rename", (e) => {
      captured = e;
    });
    tree.renameNode("src/index.ts", "main.ts");
    expect(captured?.path).toBe("src/main.ts");
    expect(captured?.oldPath).toBe("src/index.ts");
    expect(captured?.parentPath).toBe("src");
    expect(captured?.parentNode?.path).toBe("src");
    expect(captured?.tree.map((d) => d.path)).toContain("src/main.ts");
    tree.destroy();
  });

  it("parentNode is null for root-level nodes", () => {
    const tree = createTree({ data: DATA });
    let captured: import("../src/index").FileTreeEvent | undefined;
    tree.on("create", (e) => {
      captured = e;
    });
    tree.addNode({ path: "root.txt", type: "file" });
    expect(captured?.parentPath).toBe("");
    expect(captured?.parentNode).toBeNull();
    tree.destroy();
  });

  it("create event includes the node type", () => {
    const tree = createTree({ data: [] });
    let type: string | undefined;
    tree.on("create", (e) => {
      type = e.node.type;
    });
    tree.addNode({ path: "dir/file.txt", type: "file" });
    expect(type).toBe("file");
    tree.destroy();
  });

  it("off() stops receiving events", () => {
    const tree = createTree({ data: DATA });
    const handler = vi.fn();
    tree.on("rename", handler);
    tree.renameNode("src/index.ts", "a.ts");
    tree.off("rename", handler);
    tree.renameNode("src/lib/util.ts", "b.ts");
    expect(handler).toHaveBeenCalledTimes(1);
    tree.destroy();
  });

  it("emits change after structural mutations", () => {
    const tree = createTree({ data: DATA });
    const changes: string[] = [];
    tree.on("change", (e) => changes.push(e.source));
    tree.addNode({ path: "x.ts", type: "file" });
    tree.renameNode("x.ts", "y.ts");
    tree.moveNode("y.ts", "src");
    tree.removeNode("src/lib/util.ts");
    expect(changes.filter((s) => s === "api").length).toBe(4);
    tree.destroy();
  });
});

describe("keyboard navigation", () => {
  it("ArrowDown/ArrowUp move selection through visible nodes", () => {
    const tree = createTree({ data: DATA });
    tree.select("src");
    keydown(tree, { key: "ArrowDown" });
    expect(tree.getSelectedNode()?.path).toBe("package.json");
    keydown(tree, { key: "ArrowUp" });
    expect(tree.getSelectedNode()?.path).toBe("src");
    tree.destroy();
  });

  it("ArrowRight expands a folder or moves to first child", () => {
    const tree = createTree({ data: DATA });
    tree.select("src");
    keydown(tree, { key: "ArrowRight" });
    expect(renderedPaths(tree)).toContain("src/index.ts");
    // Second ArrowRight moves to first child (folders sort first).
    keydown(tree, { key: "ArrowRight" });
    expect(tree.getSelectedNode()?.path).toBe("src/lib");
    tree.destroy();
  });

  it("ArrowLeft collapses a folder or moves to parent", () => {
    const tree = createTree({ data: DATA });
    tree.expand("src");
    tree.select("src");
    keydown(tree, { key: "ArrowLeft" });
    expect(renderedPaths(tree)).not.toContain("src/index.ts");
    tree.destroy();
  });

  it("Enter toggles expansion", () => {
    const tree = createTree({ data: DATA });
    tree.select("src");
    keydown(tree, { key: "Enter" });
    expect(renderedPaths(tree)).toContain("src/index.ts");
    keydown(tree, { key: "Enter" });
    expect(renderedPaths(tree)).not.toContain("src/index.ts");
    tree.destroy();
  });

  it("F2 starts a rename on the selected node", () => {
    const tree = createTree({ data: DATA });
    tree.select("src/index.ts");
    keydown(tree, { key: "F2" });
    expect(rootOf(tree).querySelector(".ft-rename-input")).not.toBeNull();
    tree.destroy();
  });
});

describe("context menu actions", () => {
  it("shows create file/folder items on a folder", () => {
    const tree = createTree({ data: DATA });
    (tree as unknown as { showContextMenu(p: string, x: number, y: number): void })
      .showContextMenu("src", 0, 0);
    const labels = [...rootOf(tree).querySelectorAll(".ft-context-menu__label")].map(
      (el) => el.textContent,
    );
    expect(labels).toContain("New File");
    expect(labels).toContain("New Folder");
    expect(labels).toContain("Rename");
    expect(labels).toContain("Delete");
    tree.destroy();
  });

  it("create file from context menu starts a rename in that folder", () => {
    const tree = createTree({ data: DATA });
    (tree as unknown as { showContextMenu(p: string, x: number, y: number): void })
      .showContextMenu("src", 0, 0);
    const item = [...rootOf(tree).querySelectorAll(".ft-context-menu__item")].find(
      (el) => el.querySelector(".ft-context-menu__label")?.textContent === "New File",
    );
    item!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const input = rootOf(tree).querySelector(".ft-rename-input") as HTMLInputElement;
    expect(input.value).toBe("untitled");
    input.value = "component.tsx";
    input.dispatchEvent(new Event("blur"));
    expect(tree.getNode("src/component.tsx")).toBeDefined();
    tree.destroy();
  });

  it("right-click selects the node and shows the menu", () => {
    const tree = createTree({ data: DATA });
    nodeContentEl(tree, "src/index.ts")!.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, clientX: 5, clientY: 5 }),
    );
    expect(tree.getSelectedNode()?.path).toBe("src/index.ts");
    expect(rootOf(tree).querySelector(".ft-context-menu")).not.toBeNull();
    tree.destroy();
  });
});
