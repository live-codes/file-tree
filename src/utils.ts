import type { FileTreeNodeData } from "./types";

let counter = 0;

/** Generate a unique ID. */
export function generateId(): string {
  return `ft_${Date.now().toString(36)}_${(counter++).toString(36)}`;
}

/** Get file extension without the leading dot, lowercased. */
export function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return "";
  return name.slice(idx + 1).toLowerCase();
}

/** Deep-clone a tree structure. */
export function deepClone(data: FileTreeNodeData[]): FileTreeNodeData[] {
  return data.map((node) => ({
    ...node,
    meta: node.meta ? { ...node.meta } : undefined,
    children: node.children ? deepClone(node.children) : undefined,
  }));
}

/** Find a node by ID in the tree. Returns `[node, parent]` or `undefined`. */
export function findNode(
  tree: FileTreeNodeData[],
  id: string,
  parent: FileTreeNodeData | null = null,
): [FileTreeNodeData, FileTreeNodeData | null] | undefined {
  for (const node of tree) {
    if (node.id === id) return [node, parent];
    if (node.children) {
      const found = findNode(node.children, id, node);
      if (found) return found;
    }
  }
  return undefined;
}

/** Remove a node by ID from the tree. Returns the removed node or `undefined`. */
export function removeNode(
  tree: FileTreeNodeData[],
  id: string,
): FileTreeNodeData | undefined {
  for (let i = 0; i < tree.length; i++) {
    if (tree[i].id === id) {
      return tree.splice(i, 1)[0];
    }
    if (tree[i].children) {
      const removed = removeNode(tree[i].children!, id);
      if (removed) return removed;
    }
  }
  return undefined;
}

/** Compute the path string for a node by ID. */
export function getNodePath(tree: FileTreeNodeData[], id: string): string {
  function walk(nodes: FileTreeNodeData[], segments: string[]): string | null {
    for (const node of nodes) {
      const current = [...segments, node.name];
      if (node.id === id) return current.join("/");
      if (node.children) {
        const found = walk(node.children, current);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(tree, []) ?? "";
}

/** Default sort: folders first, then alphabetical case-insensitive. */
export function defaultSort(a: FileTreeNodeData, b: FileTreeNodeData): number {
  if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/** Sort tree recursively in place. */
export function sortTree(
  tree: FileTreeNodeData[],
  comparator: (a: FileTreeNodeData, b: FileTreeNodeData) => number,
): void {
  tree.sort(comparator);
  for (const node of tree) {
    if (node.children) sortTree(node.children, comparator);
  }
}

/** Create a node data object with auto-generated ID. */
export function createNode(
  name: string,
  type: "file" | "folder",
  children?: FileTreeNodeData[],
  meta?: Record<string, unknown>,
): FileTreeNodeData {
  return { id: generateId(), name, type, children, meta };
}

/** Check if `targetId` is a descendant of `ancestorId` in the tree. */
export function isDescendant(
  tree: FileTreeNodeData[],
  ancestorId: string,
  targetId: string,
): boolean {
  const result = findNode(tree, ancestorId);
  if (!result) return false;
  const [ancestor] = result;
  if (!ancestor.children) return false;
  return !!findNode(ancestor.children, targetId);
}
