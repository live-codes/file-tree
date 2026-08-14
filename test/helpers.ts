import { FileTree, type FileTreeOptions } from "../src/index";

export type { FileTreeEvent, FileTreeNodeData } from "../src/index";

/** The library marks `root` as private; tests access it via a cast. */
export function rootOf(tree: FileTree): HTMLElement {
  return (tree as unknown as { root: HTMLElement }).root;
}

/** Mount a FileTree in a detached container and return it plus helpers. */
export function createTree(options: FileTreeOptions = {}): FileTree {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return new FileTree(container, { ...options, injectStyles: false });
}

/** Depth-first search for the first element matching a selector. */
export function query(root: ParentNode, selector: string): HTMLElement | null {
  return root.querySelector(selector);
}

/** All elements matching a selector. */
export function queryAll(root: ParentNode, selector: string): HTMLElement[] {
  return [...root.querySelectorAll(selector)] as HTMLElement[];
}

/** Node wrapper element for a path (`.ft-node[data-path="..."]`). */
export function nodeEl(
  tree: FileTree,
  path: string,
): HTMLElement | null {
  return query(rootOf(tree), `.ft-node[data-path="${cssEscape(path)}"]`);
}

function cssEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** The `.ft-node__name` element for a path. */
export function nodeNameEl(tree: FileTree, path: string): HTMLElement | null {
  const el = nodeEl(tree, path);
  return el ? query(el, ".ft-node__name") : null;
}

/** The `.ft-node__content` element for a path. */
export function nodeContentEl(
  tree: FileTree,
  path: string,
): HTMLElement | null {
  const el = nodeEl(tree, path);
  return el ? query(el, ".ft-node__content") : null;
}

/** The `.ft-node__children` container for a folder path. */
export function nodeChildrenEl(
  tree: FileTree,
  path: string,
): HTMLElement | null {
  const el = nodeEl(tree, path);
  return el ? query(el, ".ft-node__children") : null;
}

/** The currently-visible `.ft-rename-input`, if a rename is active. */
export function renameInput(tree: FileTree): HTMLInputElement | null {
  return rootOf(tree).querySelector(".ft-rename-input");
}

/** All rendered node paths, in DOM order, respecting expand/collapse. */
export function renderedPaths(tree: FileTree): string[] {
  const root = rootOf(tree);
  return queryAll(root, ".ft-node")
    .filter((el) => {
      // A node is visible unless an ancestor `.ft-node__children` is hidden.
      let parent = el.parentElement;
      while (parent && parent !== root) {
        if (parent.classList.contains("ft-node__children") && parent.style.display === "none") {
          return false;
        }
        parent = parent.parentElement;
      }
      return true;
    })
    .map((el) => el.dataset.path ?? "");
}

/**
 * Set the value of the active rename input and commit it (blur), the same
 * way a user typing and pressing Enter would.
 */
export function commitRename(
  tree: FileTree,
  value: string,
  commitBy: "blur" | "enter" = "blur",
): void {
  const input = renameInput(tree);
  if (!input) throw new Error("No active rename input");
  input.value = value;
  if (commitBy === "enter") {
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    // The Enter handler calls input.blur(), which commits.
  } else {
    input.dispatchEvent(new Event("blur"));
  }
}

/** Dispatch a keyboard event on the tree root. */
export function keydown(tree: FileTree, init: KeyboardEventInit): void {
  rootOf(tree).dispatchEvent(new KeyboardEvent("keydown", init));
}
