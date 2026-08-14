import { describe, expect, it } from "vitest";
import { FileTree } from "../src/index";
import {
  createTree,
  nodeChildrenEl,
  nodeContentEl,
  nodeEl,
  nodeNameEl,
  query,
  queryAll,
  renderedPaths,
  rootOf,
  type FileTreeNodeData,
} from "./helpers";

const SAMPLE_DATA: FileTreeNodeData[] = [
  { path: "src", type: "folder" },
  { path: "src/index.ts", type: "file" },
  { path: "src/utils", type: "folder" },
  { path: "src/utils/helpers.ts", type: "file" },
  { path: "package.json", type: "file" },
];

describe("FileTree constructor", () => {
  it("accepts an HTMLElement container", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const tree = new FileTree(container, { injectStyles: false });
    expect(container.querySelector(".ft-root")).not.toBeNull();
    expect(container.querySelector(".ft-tree")).not.toBeNull();
    tree.destroy();
  });

  it("accepts a selector string container", () => {
    const container = document.createElement("div");
    container.id = "tree-root";
    document.body.appendChild(container);
    const tree = new FileTree("#tree-root", { injectStyles: false });
    expect(container.querySelector(".ft-root")).not.toBeNull();
    tree.destroy();
  });

  it("throws for an invalid container", () => {
    expect(() => new FileTree("#does-not-exist", { injectStyles: false })).toThrow(
      /Invalid container/,
    );
  });

  it("renders the toolbar by default", () => {
    const tree = createTree();
    expect(query(rootOf(tree), ".ft-toolbar")).not.toBeNull();
    tree.destroy();
  });

  it("hides the toolbar when toolbar: false", () => {
    const tree = createTree({ toolbar: false });
    expect(query(rootOf(tree), ".ft-toolbar")).toBeNull();
    tree.destroy();
  });

  it("does not create a DragDrop instance in readOnly mode", () => {
    const tree = createTree({ readOnly: true });
    expect(tree["dragDrop"]).toBeNull();
    tree.destroy();
  });

  it("creates a DragDrop instance by default", () => {
    const tree = createTree();
    expect(tree["dragDrop"]).not.toBeNull();
    tree.destroy();
  });

  it("injects styles into document.head once", () => {
    document.head.innerHTML = "";
    const tree = new FileTree(document.createElement("div"), {});
    expect(document.getElementById("ft-styles")).not.toBeNull();
    tree.destroy();
  });

  it("does not inject styles when injectStyles: false", () => {
    document.head.innerHTML = "";
    const tree = createTree();
    expect(document.getElementById("ft-styles")).toBeNull();
    tree.destroy();
  });
});

describe("rendering", () => {
  it("renders a node per data entry with paths and types", () => {
    const tree = createTree({ data: SAMPLE_DATA });
    const nodes = queryAll(rootOf(tree), ".ft-node");
    expect(nodes).toHaveLength(5);
    expect(nodes[0].dataset.path).toBe("src");
    expect(nodes[0].dataset.type).toBe("folder");
    tree.destroy();
  });

  it("renders only visible (expanded) nodes", () => {
    const tree = createTree({ data: SAMPLE_DATA });
    // Only src and package.json are visible at root; src's children are hidden.
    expect(renderedPaths(tree)).toEqual(["src", "package.json"]);
    tree.destroy();
  });

  it("auto-creates parent folders from nested paths", () => {
    const tree = createTree({
      data: [{ path: "a/b/c.txt", type: "file" }],
    });
    expect(renderedPaths(tree)).toEqual(["a"]);
    expect(tree.getData().map((d) => d.path).sort()).toEqual([
      "a",
      "a/b",
      "a/b/c.txt",
    ]);
    tree.destroy();
  });

  it("sorts folders first then alphabetically by default", () => {
    const tree = createTree({
      data: [
        { path: "z.txt", type: "file" },
        { path: "b", type: "folder" },
        { path: "a", type: "folder" },
        { path: "a.txt", type: "file" },
      ],
    });
    expect(renderedPaths(tree)).toEqual(["a", "b", "a.txt", "z.txt"]);
    tree.destroy();
  });

  it("honors a custom sort comparator", () => {
    const tree = createTree({
      data: [
        { path: "b.txt", type: "file" },
        { path: "a.txt", type: "file" },
      ],
      sort: (x, y) => y.path.localeCompare(x.path),
    });
    expect(renderedPaths(tree)).toEqual(["b.txt", "a.txt"]);
    tree.destroy();
  });

  it("does not sort when sort: false", () => {
    const tree = createTree({
      data: [
        { path: "b.txt", type: "file" },
        { path: "a.txt", type: "file" },
      ],
      sort: false,
    });
    expect(renderedPaths(tree)).toEqual(["b.txt", "a.txt"]);
    tree.destroy();
  });

  it("renders node names as text", () => {
    const tree = createTree({ data: [{ path: "index.ts", type: "file" }] });
    expect(nodeNameEl(tree, "index.ts")?.textContent).toBe("index.ts");
    tree.destroy();
  });

  it("marks folders with an arrow and files with a spacer", () => {
    const tree = createTree({
      data: [
        { path: "src", type: "folder" },
        { path: "index.ts", type: "file" },
      ],
    });
    expect(nodeEl(tree, "src")?.querySelector(".ft-node__arrow")).not.toBeNull();
    expect(
      nodeEl(tree, "index.ts")?.querySelector(".ft-node__arrow-spacer"),
    ).not.toBeNull();
    tree.destroy();
  });
});

describe("expand / collapse", () => {
  it("toggles expansion on folder click", () => {
    const tree = createTree({ data: SAMPLE_DATA });
    nodeContentEl(tree, "src")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(renderedPaths(tree)).toContain("src/index.ts");
    expect(renderedPaths(tree)).toContain("src/utils");
    nodeContentEl(tree, "src")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(renderedPaths(tree)).not.toContain("src/index.ts");
    tree.destroy();
  });

  it("expand()/collapse() update visibility and emit events", () => {
    const tree = createTree({ data: SAMPLE_DATA });
    const events: string[] = [];
    tree.on("expand", (e) => events.push(e.path));
    tree.on("collapse", (e) => events.push(e.path));

    tree.expand("src");
    expect(renderedPaths(tree)).toContain("src/index.ts");
    expect(events).toEqual(["src"]);
    expect(nodeChildrenEl(tree, "src")!.style.display).not.toBe("none");

    tree.collapse("src");
    expect(renderedPaths(tree)).not.toContain("src/index.ts");
    expect(events).toEqual(["src", "src"]);
    tree.destroy();
  });

  it("expand() on a file is a no-op", () => {
    const tree = createTree({ data: SAMPLE_DATA });
    tree.expand("src/index.ts");
    expect(renderedPaths(tree)).not.toContain("src/utils");
    tree.destroy();
  });

  it("expandAll()/collapseAll() work", () => {
    const tree = createTree({ data: SAMPLE_DATA });
    tree.expandAll();
    expect(renderedPaths(tree)).toContain("src/utils/helpers.ts");
    tree.collapseAll();
    expect(renderedPaths(tree)).toEqual(["src", "package.json"]);
    tree.destroy();
  });

  it("expands ancestors when selecting a nested path", () => {
    const tree = createTree({ data: SAMPLE_DATA });
    tree.select("src/utils/helpers.ts");
    expect(renderedPaths(tree)).toContain("src/utils/helpers.ts");
    expect(nodeChildrenEl(tree, "src")!.style.display).not.toBe("none");
    expect(nodeChildrenEl(tree, "src/utils")!.style.display).not.toBe("none");
    tree.destroy();
  });
});

describe("selection", () => {
  it("selects on click and emits a select event", () => {
    const tree = createTree({ data: SAMPLE_DATA });
    const events: string[] = [];
    tree.on("select", (e) => events.push(e.path));
    nodeContentEl(tree, "src")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(tree.getSelectedNode()?.path).toBe("src");
    expect(events).toEqual(["src"]);
    expect(nodeContentEl(tree, "src")!.classList.contains("ft-node__content--selected")).toBe(true);
    tree.destroy();
  });

  it("select() by path works and moves selection", () => {
    const tree = createTree({ data: SAMPLE_DATA });
    tree.select("src");
    expect(tree.getSelectedNode()?.path).toBe("src");
    tree.select("package.json");
    expect(tree.getSelectedNode()?.path).toBe("package.json");
    expect(
      nodeContentEl(tree, "package.json")!.classList.contains("ft-node__content--selected"),
    ).toBe(true);
    expect(
      nodeContentEl(tree, "src")!.classList.contains("ft-node__content--selected"),
    ).toBe(false);
    tree.destroy();
  });

  it("applies initial selection from options", () => {
    const tree = createTree({ data: SAMPLE_DATA, selected: "src" });
    expect(tree.getSelectedNode()?.path).toBe("src");
    tree.destroy();
  });
});

describe("theme & direction", () => {
  it("applies the theme to the root dataset", () => {
    const tree = createTree({ theme: "light" });
    expect(rootOf(tree).dataset.theme).toBe("light");
    tree.setTheme("dark");
    expect(rootOf(tree).dataset.theme).toBe("dark");
    expect(tree.getTheme()).toBe("dark");
    tree.destroy();
  });

  it("applies direction to the root", () => {
    const tree = createTree({ direction: "rtl" });
    expect(rootOf(tree).dir).toBe("rtl");
    tree.setDirection("ltr");
    expect(rootOf(tree).dir).toBe("ltr");
    expect(tree.getDirection()).toBe("ltr");
    tree.destroy();
  });
});

describe("i18n", () => {
  it("uses the built-in English strings by default", () => {
    const tree = createTree();
    const newFileBtn = query(rootOf(tree), ".ft-toolbar__btn");
    expect(newFileBtn?.getAttribute("title")).toBe("New File");
    tree.destroy();
  });

  it("uses the provided translation function", () => {
    const tree = createTree({
      t: (key) => (key === "newFile" ? "Nouveau fichier" : key),
    });
    const newFileBtn = query(rootOf(tree), ".ft-toolbar__btn");
    expect(newFileBtn?.getAttribute("title")).toBe("Nouveau fichier");
    tree.destroy();
  });
});

describe("destroy", () => {
  it("removes the root element and cleans up", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const tree = new FileTree(container, { injectStyles: false });
    const root = rootOf(tree);
    expect(container.contains(root)).toBe(true);
    tree.destroy();
    expect(container.contains(root)).toBe(false);
    expect(tree["nodeMap"].size).toBe(0);
  });
});
