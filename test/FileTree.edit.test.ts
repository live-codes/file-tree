import { describe, expect, it } from "vitest";
import {
  createTree,
  commitRename,
  nodeContentEl,
  query,
  renameInput,
  renderedPaths,
  rootOf,
  type FileTreeNodeData,
} from "./helpers";

const DATA: FileTreeNodeData[] = [
  { path: "src", type: "folder" },
  { path: "src/index.ts", type: "file" },
];

describe("creating nodes via toolbar", () => {
  it("creates a file with an inline rename", () => {
    const tree = createTree({ data: DATA });
    const btn = query(rootOf(tree), ".ft-toolbar__btn[title='New File']")!;
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(renameInput(tree)).not.toBeNull();
    commitRename(tree, "readme.md");
    const paths = tree.getData().map((d) => d.path);
    expect(paths).toContain("readme.md");
    expect(tree.getNode("readme.md")?.type).toBe("file");
    tree.destroy();
  });

  it("creates a folder with an inline rename", () => {
    const tree = createTree({ data: DATA });
    const btn = query(rootOf(tree), ".ft-toolbar__btn[title='New Folder']")!;
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    commitRename(tree, "dist");
    expect(tree.getNode("dist")?.type).toBe("folder");
    tree.destroy();
  });

  it("keeps the new folder when the default name is committed unchanged", () => {
    const tree = createTree({ data: DATA });
    const btn = query(rootOf(tree), ".ft-toolbar__btn[title='New Folder']")!;
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(renameInput(tree)?.value).toBe("new-folder");
    commitRename(tree, "new-folder");
    expect(tree.getNode("new-folder")?.type).toBe("folder");
    tree.destroy();
  });

  it("keeps the new file when the default name is committed unchanged", () => {
    const tree = createTree({ data: DATA });
    const btn = query(rootOf(tree), ".ft-toolbar__btn[title='New File']")!;
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(renameInput(tree)?.value).toBe("untitled");
    commitRename(tree, "untitled");
    expect(tree.getNode("untitled")?.type).toBe("file");
    tree.destroy();
  });

  it("emits create + change events when committing a new node", () => {
    const tree = createTree({ data: DATA });
    const created: string[] = [];
    tree.on("create", (e) => created.push(e.path));
    const btn = query(rootOf(tree), ".ft-toolbar__btn[title='New File']")!;
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    commitRename(tree, "new.txt");
    expect(created).toEqual(["new.txt"]);
    tree.destroy();
  });

  it("cancels (removes) a pending new node when renaming is cancelled", () => {
    const tree = createTree({ data: DATA });
    const btn = query(rootOf(tree), ".ft-toolbar__btn[title='New File']")!;
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const input = renameInput(tree)!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const paths = tree.getData().map((d) => d.path);
    expect(paths).not.toContain("untitled");
    tree.destroy();
  });

  it("creates a unique name on conflict (untitled, untitled-1, ...)", () => {
    const tree = createTree({
      data: [
        { path: "untitled", type: "file" },
        { path: "untitled-1", type: "file" },
      ],
    });
    const btn = query(rootOf(tree), ".ft-toolbar__btn[title='New File']")!;
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // The initial temp name is untitled-2
    expect(renameInput(tree)?.value).toBe("untitled-2");
    // Committing a fresh unique name works.
    commitRename(tree, "notes.txt");
    expect(tree.getNode("notes.txt")).toBeDefined();
    tree.destroy();
  });

  it("hides create buttons in readOnly mode", () => {
    const tree = createTree({ readOnly: true });
    expect(query(rootOf(tree), ".ft-toolbar__btn[title='New File']")).toBeNull();
    expect(query(rootOf(tree), ".ft-toolbar__btn[title='New Folder']")).toBeNull();
    tree.destroy();
  });
});

describe("creating nodes with slash paths", () => {
  it("creates a nested file from the toolbar", () => {
    const tree = createTree({ data: [] });
    const btn = query(rootOf(tree), ".ft-toolbar__btn[title='New File']")!;
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    commitRename(tree, "src/images/logo.svg");
    const paths = tree.getData().map((d) => d.path);
    expect(paths).toContain("src");
    expect(paths).toContain("src/images");
    expect(paths).toContain("src/images/logo.svg");
    expect(tree.getNode("src")?.type).toBe("folder");
    expect(tree.getNode("src/images/logo.svg")?.type).toBe("file");
    tree.destroy();
  });

  it("creates a nested folder from the toolbar", () => {
    const tree = createTree({ data: [] });
    const btn = query(rootOf(tree), ".ft-toolbar__btn[title='New Folder']")!;
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    commitRename(tree, "components/ui");
    expect(tree.getNode("components/ui")?.type).toBe("folder");
    tree.destroy();
  });

  it("expands ancestors so the new nested node is visible", () => {
    const tree = createTree({ data: [] });
    const btn = query(rootOf(tree), ".ft-toolbar__btn[title='New File']")!;
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    commitRename(tree, "a/b/c.txt");
    expect(renderedPaths(tree)).toContain("a/b/c.txt");
    tree.destroy();
  });
});

describe("renaming via UI", () => {
  it("renames a file on double-click", () => {
    const tree = createTree({ data: DATA });
    nodeContentEl(tree, "src/index.ts")!.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true }),
    );
    const input = renameInput(tree)!;
    expect(input.value).toBe("index.ts");
    commitRename(tree, "main.ts");
    expect(tree.getNode("src/main.ts")).toBeDefined();
    expect(tree.getNode("src/index.ts")).toBeUndefined();
    tree.destroy();
  });

  it("renames a folder and its children", () => {
    const tree = createTree({ data: DATA });
    nodeContentEl(tree, "src")!.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true }),
    );
    commitRename(tree, "lib");
    expect(tree.getNode("lib")).toBeDefined();
    expect(tree.getNode("lib/index.ts")).toBeDefined();
    expect(tree.getNode("src")).toBeUndefined();
    tree.destroy();
  });

  it("cancels a rename and keeps the original", () => {
    const tree = createTree({ data: DATA });
    nodeContentEl(tree, "src")!.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true }),
    );
    const input = renameInput(tree)!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(tree.getNode("src")).toBeDefined();
    tree.destroy();
  });

  it("does not rename to a conflicting path", () => {
    const tree = createTree({
      data: [
        { path: "a.txt", type: "file" },
        { path: "b.txt", type: "file" },
      ],
    });
    nodeContentEl(tree, "a.txt")!.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true }),
    );
    commitRename(tree, "b.txt");
    expect(tree.getNode("a.txt")).toBeDefined();
    expect(tree.getNode("b.txt")).toBeDefined();
    tree.destroy();
  });

  it("rejects backslash names", () => {
    const tree = createTree({ data: DATA });
    nodeContentEl(tree, "src/index.ts")!.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true }),
    );
    commitRename(tree, "dir\\index.ts");
    expect(tree.getNode("src/index.ts")).toBeDefined();
    expect(tree.getNode("src/dir/index.ts")).toBeUndefined();
    tree.destroy();
  });
});

describe("renaming with slash paths (on the fly folders)", () => {
  it("renames a file into a new folder chain", () => {
    const tree = createTree({ data: [{ path: "logo.svg", type: "file" }] });
    nodeContentEl(tree, "logo.svg")!.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true }),
    );
    commitRename(tree, "images/logo.svg");
    const paths = tree.getData().map((d) => d.path);
    expect(paths).toContain("images");
    expect(paths).toContain("images/logo.svg");
    expect(paths).not.toContain("logo.svg");
    tree.destroy();
  });

  it("renames a folder into a nested path, moving children", () => {
    const tree = createTree({
      data: [
        { path: "src", type: "folder" },
        { path: "src/main.js", type: "file" },
      ],
    });
    nodeContentEl(tree, "src")!.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true }),
    );
    commitRename(tree, "lib/utils");
    const paths = tree.getData().map((d) => d.path);
    expect(paths).toContain("lib");
    expect(paths).toContain("lib/utils");
    expect(paths).toContain("lib/utils/main.js");
    expect(paths).not.toContain("src");
    tree.destroy();
  });

  it("rejects renaming a folder inside itself", () => {
    const tree = createTree({ data: [{ path: "a", type: "folder" }] });
    nodeContentEl(tree, "a")!.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true }),
    );
    commitRename(tree, "a/b");
    expect(tree.getNode("a")).toBeDefined();
    expect(tree.getNode("a/b")).toBeUndefined();
    tree.destroy();
  });

  it("emits rename with oldPath/newPath for slash renames", () => {
    const tree = createTree({ data: [{ path: "logo.svg", type: "file" }] });
    const renamed: Array<[string, string]> = [];
    tree.on("rename", (e) => renamed.push([e.oldPath!, e.path]));
    nodeContentEl(tree, "logo.svg")!.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true }),
    );
    commitRename(tree, "images/logo.svg");
    expect(renamed).toEqual([["logo.svg", "images/logo.svg"]]);
    tree.destroy();
  });
});

describe("deleting", () => {
  it("deletes a node and emits delete + change", () => {
    const tree = createTree({ data: DATA });
    const deleted: string[] = [];
    tree.on("delete", (e) => deleted.push(e.path));
    tree.deleteNode("src/index.ts");
    expect(tree.getNode("src/index.ts")).toBeUndefined();
    expect(deleted).toEqual(["src/index.ts"]);
    tree.destroy();
  });

  it("deletes a folder and all descendants", () => {
    const tree = createTree({ data: DATA });
    tree.deleteNode("src");
    expect(tree.getData().map((d) => d.path)).toEqual([]);
    tree.destroy();
  });

  it("respects preventDefault on the delete event", () => {
    const tree = createTree({ data: DATA });
    tree.on("delete", (e) => e.preventDefault());
    tree.deleteNode("src");
    expect(tree.getNode("src")).toBeDefined();
    tree.destroy();
  });

  it("removeNode is not cancellable", () => {
    const tree = createTree({ data: DATA });
    tree.on("delete", (e) => e.preventDefault());
    tree.removeNode("src");
    expect(tree.getNode("src")).toBeUndefined();
    tree.destroy();
  });

  it("Delete key deletes the selected node", () => {
    const tree = createTree({ data: DATA });
    tree.select("src/index.ts");
    rootOf(tree).dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    expect(tree.getNode("src/index.ts")).toBeUndefined();
    tree.destroy();
  });
});

describe("readOnly mode", () => {
  it("does not start rename on double-click", () => {
    const tree = createTree({ data: DATA, readOnly: true });
    nodeContentEl(tree, "src/index.ts")!.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true }),
    );
    expect(renameInput(tree)).toBeNull();
    tree.destroy();
  });

  it("does not delete via keyboard", () => {
    const tree = createTree({ data: DATA, readOnly: true });
    tree.select("src/index.ts");
    rootOf(tree).dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    expect(tree.getNode("src/index.ts")).toBeDefined();
    tree.destroy();
  });

  it("still allows navigation keys", () => {
    const tree = createTree({ data: DATA, readOnly: true });
    tree.select("src");
    rootOf(tree).dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(tree.getSelectedNode()?.path).toBe("package.json" in tree.getData() ? "src" : "src");
    tree.destroy();
  });
});
