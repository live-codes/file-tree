import { describe, expect, it } from "vitest";
import {
  createTree,
  nodeContentEl,
  rootOf,
  keydown,
  queryAll,
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

describe("multi-select: click interactions", () => {
  it("ctrl+click toggles selection without clearing others", () => {
    const tree = createTree({ data: DATA });
    nodeContentEl(tree, "src")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    nodeContentEl(tree, "package.json")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, ctrlKey: true }),
    );
    expect(tree.getSelectedNodes().map((n) => n.path).sort()).toEqual([
      "package.json",
      "src",
    ]);
    expect(
      nodeContentEl(tree, "src")!.classList.contains("ft-node__content--selected"),
    ).toBe(true);
    expect(
      nodeContentEl(tree, "package.json")!.classList.contains(
        "ft-node__content--selected",
      ),
    ).toBe(true);
    tree.destroy();
  });

  it("ctrl+click on a selected node deselects it", () => {
    const tree = createTree({ data: DATA });
    tree.select("src");
    nodeContentEl(tree, "package.json")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, ctrlKey: true }),
    );
    // deselect src
    nodeContentEl(tree, "src")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, ctrlKey: true }),
    );
    expect(tree.getSelectedNodes().map((n) => n.path)).toEqual([
      "package.json",
    ]);
    tree.destroy();
  });

  it("shift+click selects a range from the anchor", () => {
    const tree = createTree({ data: DATA });
    tree.select("src");
    // Expand src so its children are visible in the range
    tree.expand("src");
    tree.expand("src/lib");
    // anchor = src; shift+click on package.json selects everything in between
    nodeContentEl(tree, "package.json")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, shiftKey: true }),
    );
    expect(tree.getSelectedNodes().map((n) => n.path).sort()).toEqual([
      "package.json",
      "src",
      "src/index.ts",
      "src/lib",
      "src/lib/util.ts",
    ]);
    tree.destroy();
  });

  it("plain click replaces the selection", () => {
    const tree = createTree({ data: DATA });
    tree.select("src");
    tree.select("package.json");
    expect(tree.getSelectedNodes().map((n) => n.path)).toEqual([
      "package.json",
    ]);
    tree.destroy();
  });
});

describe("multi-select: keyboard", () => {
  it("shift+arrow extends the selection by a range", () => {
    const tree = createTree({ data: DATA });
    tree.select("src");
    tree.expand("src");
    // First shift+ArrowDown extends to the next visible node (src/lib,
    // folders sort first)
    keydown(tree, { key: "ArrowDown", shiftKey: true });
    expect(tree.getSelectedNodes().map((n) => n.path)).toEqual([
      "src",
      "src/lib",
    ]);
    keydown(tree, { key: "ArrowDown", shiftKey: true });
    expect(tree.getSelectedNodes().map((n) => n.path)).toEqual([
      "src",
      "src/lib",
      "src/index.ts",
    ]);
    tree.destroy();
  });

  it("ctrl+a selects all nodes", () => {
    const tree = createTree({ data: DATA });
    tree.select("src");
    keydown(tree, { key: "a", ctrlKey: true });
    expect(tree.getSelectedNodes().length).toBe(5);
    tree.destroy();
  });

  it("arrow without modifier collapses to a single selection", () => {
    const tree = createTree({ data: DATA });
    tree.select("src");
    keydown(tree, { key: "ArrowDown", shiftKey: true });
    keydown(tree, { key: "ArrowDown", shiftKey: true });
    // focus is now src/lib; a plain ArrowDown selects the next visible node
    keydown(tree, { key: "ArrowDown" });
    expect(tree.getSelectedNodes().length).toBe(1);
    tree.destroy();
  });

  it("sets aria-selected on selected nodes", () => {
    const tree = createTree({ data: DATA });
    tree.select("src");
    nodeContentEl(tree, "package.json")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, ctrlKey: true }),
    );
    const nodes = queryAll(rootOf(tree), ".ft-node");
    const ariaSelected = nodes.filter(
      (el) => el.getAttribute("aria-selected") === "true",
    );
    expect(ariaSelected.map((el) => el.dataset.path).sort()).toEqual([
      "package.json",
      "src",
    ]);
    tree.destroy();
  });
});

describe("multi-select: selection API", () => {
  it("select() accepts an array of paths", () => {
    const tree = createTree({ data: DATA });
    tree.select(["src", "package.json"]);
    expect(tree.getSelectedNodes().map((n) => n.path).sort()).toEqual([
      "package.json",
      "src",
    ]);
    tree.destroy();
  });

  it("select() with an array expands ancestors", () => {
    const tree = createTree({ data: DATA });
    tree.select(["src/lib/util.ts"]);
    expect(
      nodeContentEl(tree, "src/lib/util.ts")!.classList.contains(
        "ft-node__content--selected",
      ),
    ).toBe(true);
    tree.destroy();
  });

  it("clearSelection() clears the selection", () => {
    const tree = createTree({ data: DATA });
    tree.select(["src", "package.json"]);
    tree.clearSelection();
    expect(tree.getSelectedNodes()).toEqual([]);
    tree.destroy();
  });

  it("select() with a missing path clears the selection", () => {
    const tree = createTree({ data: DATA });
    tree.select(["src", "package.json"]);
    tree.select("does-not-exist");
    expect(tree.getSelectedNodes()).toEqual([]);
    tree.destroy();
  });

  it("select() ignores missing paths in an array", () => {
    const tree = createTree({ data: DATA });
    tree.select(["src", "does-not-exist", "package.json"]);
    expect(tree.getSelectedNodes().map((n) => n.path).sort()).toEqual([
      "package.json",
      "src",
    ]);
    tree.destroy();
  });

  it("selectAll() selects all nodes", () => {
    const tree = createTree({ data: DATA });
    tree.selectAll();
    expect(tree.getSelectedNodes().length).toBe(5);
    tree.destroy();
  });

  it("initial selected accepts an array", () => {
    const tree = createTree({ data: DATA, selected: ["src", "package.json"] });
    expect(tree.getSelectedNodes().map((n) => n.path).sort()).toEqual([
      "package.json",
      "src",
    ]);
    tree.destroy();
  });
});

describe("multi-select: operations", () => {
  it("deleteNode deletes all selected nodes with one delete event", () => {
    const tree = createTree({ data: DATA });
    tree.select(["src/index.ts", "package.json"]);
    const deleted: string[][] = [];
    tree.on("delete", (e) => deleted.push(e.paths ?? []));
    tree.deleteNode(["src/index.ts", "package.json"]);
    expect(paths(tree)).not.toContain("src/index.ts");
    expect(paths(tree)).not.toContain("package.json");
    expect(paths(tree)).toContain("src");
    expect(deleted).toEqual([["src/index.ts", "package.json"]]);
    tree.destroy();
  });

  it("deleteNode with preventDefault aborts the whole batch", () => {
    const tree = createTree({ data: DATA });
    tree.on("delete", (e) => e.preventDefault());
    tree.deleteNode(["src/index.ts", "package.json"]);
    expect(paths(tree)).toContain("src/index.ts");
    expect(paths(tree)).toContain("package.json");
    tree.destroy();
  });

  it("deleteNode dedupes: a folder and its child are removed once", () => {
    const tree = createTree({ data: DATA });
    tree.deleteNode(["src", "src/index.ts", "src/lib"]);
    expect(paths(tree)).not.toContain("src");
    expect(paths(tree)).not.toContain("src/index.ts");
    expect(paths(tree)).not.toContain("src/lib");
    expect(paths(tree)).not.toContain("src/lib/util.ts");
    expect(paths(tree)).toContain("package.json");
    tree.destroy();
  });

  it("copyToClipboard + pasteNode duplicates the whole selection", () => {
    const tree = createTree({ data: DATA });
    tree.copyToClipboard(["src/index.ts", "package.json"]);
    tree.select("src/lib");
    tree.pasteNode();
    expect(paths(tree)).toContain("src/lib/index.ts");
    expect(paths(tree)).toContain("src/lib/package.json");
    expect(paths(tree)).toContain("src/index.ts");
    expect(paths(tree)).toContain("package.json");
    tree.destroy();
  });

  it("cutNode + pasteNode moves the whole selection", () => {
    const tree = createTree({ data: DATA });
    tree.cutNode(["src/index.ts", "package.json"]);
    tree.select("src/lib");
    tree.pasteNode();
    expect(paths(tree)).toContain("src/lib/index.ts");
    expect(paths(tree)).toContain("src/lib/package.json");
    expect(paths(tree)).not.toContain("src/index.ts");
    expect(paths(tree)).not.toContain("package.json");
    tree.destroy();
  });

  it("moveNode moves the whole selection", () => {
    const tree = createTree({ data: DATA });
    tree.moveNode(["src/index.ts", "package.json"], "src/lib");
    expect(paths(tree)).toContain("src/lib/index.ts");
    expect(paths(tree)).toContain("src/lib/package.json");
    expect(paths(tree)).not.toContain("src/index.ts");
    expect(paths(tree)).not.toContain("package.json");
    tree.destroy();
  });

  it("copyNode with an array copies all sources", () => {
    const tree = createTree({ data: DATA });
    tree.addNode({ path: "backup", type: "folder" });
    const result = tree.copyNode(["src/index.ts", "package.json"], "backup");
    expect(result).toEqual(["backup/index.ts", "backup/package.json"]);
    tree.destroy();
  });

  it("keyboard Delete removes all selected", () => {
    const tree = createTree({ data: DATA });
    tree.select(["src/index.ts", "package.json"]);
    keydown(tree, { key: "Delete" });
    expect(paths(tree)).not.toContain("src/index.ts");
    expect(paths(tree)).not.toContain("package.json");
    tree.destroy();
  });
});

describe("multi-select: context menu", () => {
  it("right-click on a selected node keeps the multi-selection and delete removes all", () => {
    const tree = createTree({ data: DATA });
    tree.select(["src/index.ts", "package.json"]);
    // Right-click on package.json (already selected) keeps both selected.
    nodeContentEl(tree, "package.json")!.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, clientX: 5, clientY: 5 }),
    );
    const deleteItem = queryAll(rootOf(tree), ".ft-context-menu__item").find(
      (el) =>
        el.querySelector(".ft-context-menu__label")?.textContent === "Delete",
    );
    expect(deleteItem).toBeDefined();
    deleteItem!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(paths(tree)).not.toContain("src/index.ts");
    expect(paths(tree)).not.toContain("package.json");
    tree.destroy();
  });

  it("right-click on an unselected node replaces the selection", () => {
    const tree = createTree({ data: DATA });
    tree.select(["src", "package.json"]);
    nodeContentEl(tree, "src/index.ts")!.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, clientX: 5, clientY: 5 }),
    );
    expect(tree.getSelectedNodes().map((n) => n.path)).toEqual([
      "src/index.ts",
    ]);
    tree.destroy();
  });

  it("custom item receives all selected nodes plus the primary", () => {
    const tree = createTree({
      data: DATA,
      contextMenu: {
        custom: [
          {
            id: "pick",
            label: "Pick",
            onClick: (nodes, primary) => {
              (tree as unknown as { picked: unknown }).picked = {
                nodes: nodes.map((n) => n.path),
                primary: primary.path,
              };
            },
          },
        ],
      },
    });
    tree.select(["src", "package.json"]);
    nodeContentEl(tree, "package.json")!.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, clientX: 5, clientY: 5 }),
    );
    const item = queryAll(rootOf(tree), ".ft-context-menu__item").find(
      (el) => el.querySelector(".ft-context-menu__label")?.textContent === "Pick",
    );
    item!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const picked = (tree as unknown as { picked: { nodes: string[]; primary: string } }).picked;
    expect(picked.nodes.sort()).toEqual(["package.json", "src"]);
    expect(picked.primary).toBe("package.json");
    tree.destroy();
  });
});
