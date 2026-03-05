import type { FileTreeNodeData, HierarchyNode } from "./types";

/** Normalize a path: forward slashes, no leading/trailing slashes, collapse multiples. */
export function normalizePath(p: string): string {
  return p
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

/** Get the parent path. Returns empty string for root-level paths. */
export function getParentPath(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.substring(0, idx);
}

/** Get the file/folder name (last segment of the path). */
export function getName(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? path : path.substring(idx + 1);
}

/** Get file extension without the leading dot, lowercased. */
export function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return "";
  return name.slice(idx + 1).toLowerCase();
}

/**
 * Normalize a flat data array:
 * - Normalize all paths
 * - Remove empty paths
 * - Auto-create missing parent folders
 * - Deduplicate (first occurrence wins)
 */
export function normalizeData(data: FileTreeNodeData[]): FileTreeNodeData[] {
  const map = new Map<string, FileTreeNodeData>();

  for (const item of data) {
    const path = normalizePath(item.path);
    if (!path) continue;
    if (!map.has(path)) {
      map.set(path, { ...item, path });
    }
  }

  // Auto-create parent folders
  for (const path of [...map.keys()]) {
    const segments = path.split("/");
    for (let i = 1; i < segments.length; i++) {
      const folderPath = segments.slice(0, i).join("/");
      if (!map.has(folderPath)) {
        map.set(folderPath, { path: folderPath, type: "folder" });
      }
    }
  }

  return [...map.values()];
}

/**
 * Build a hierarchical tree from flat data for rendering.
 */
export function buildHierarchy(
  data: FileTreeNodeData[],
  sort?: boolean | ((a: FileTreeNodeData, b: FileTreeNodeData) => number),
): HierarchyNode[] {
  const map = new Map<string, HierarchyNode>();
  const roots: HierarchyNode[] = [];

  // Sort flat data by depth so parents are processed before children
  const sorted = [...data].sort((a, b) => {
    const da = a.path.split("/").length;
    const db = b.path.split("/").length;
    return da - db;
  });

  for (const item of sorted) {
    const node: HierarchyNode = {
      name: getName(item.path),
      path: item.path,
      type: item.type,
      data: item,
      children: [],
    };
    map.set(item.path, node);

    const parent = getParentPath(item.path);
    if (parent === "") {
      roots.push(node);
    } else {
      const parentNode = map.get(parent);
      if (parentNode) {
        parentNode.children.push(node);
      }
    }
  }

  // Sort if requested
  if (sort) {
    const cmp = typeof sort === "function" ? sort : defaultSort;
    const hCmp = (a: HierarchyNode, b: HierarchyNode) => cmp(a.data, b.data);
    sortHierarchyNodes(roots, hCmp);
  }

  return roots;
}

function sortHierarchyNodes(
  nodes: HierarchyNode[],
  cmp: (a: HierarchyNode, b: HierarchyNode) => number,
): void {
  nodes.sort(cmp);
  for (const node of nodes) {
    if (node.children.length > 0) {
      sortHierarchyNodes(node.children, cmp);
    }
  }
}

/** Default sort: folders first, then alphabetical case-insensitive. */
export function defaultSort(a: FileTreeNodeData, b: FileTreeNodeData): number {
  if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
  const nameA = getName(a.path);
  const nameB = getName(b.path);
  return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
}

/** Deep clone a flat data array. */
export function cloneData(data: FileTreeNodeData[]): FileTreeNodeData[] {
  return data.map((d) => ({
    ...d,
    meta: d.meta ? { ...d.meta } : undefined,
  }));
}

/** Update all matching paths in a data array when a node is renamed or moved. */
export function updatePathsInData(
  data: FileTreeNodeData[],
  oldPath: string,
  newPath: string,
): void {
  const oldPrefix = oldPath + "/";
  const newPrefix = newPath + "/";
  for (let i = 0; i < data.length; i++) {
    if (data[i].path === oldPath) {
      data[i] = { ...data[i], path: newPath };
    } else if (data[i].path.startsWith(oldPrefix)) {
      data[i] = {
        ...data[i],
        path: newPrefix + data[i].path.slice(oldPrefix.length),
      };
    }
  }
}

/** Update all matching paths in a Set. */
export function updatePathsInSet(
  set: Set<string>,
  oldPath: string,
  newPath: string,
): void {
  const oldPrefix = oldPath + "/";
  const newPrefix = newPath + "/";
  const toRemove: string[] = [];
  const toAdd: string[] = [];
  for (const p of set) {
    if (p === oldPath) {
      toRemove.push(p);
      toAdd.push(newPath);
    } else if (p.startsWith(oldPrefix)) {
      toRemove.push(p);
      toAdd.push(newPrefix + p.slice(oldPrefix.length));
    }
  }
  for (const p of toRemove) set.delete(p);
  for (const p of toAdd) set.add(p);
}

/**
 * Create one or more FileTreeNodeData entries for a path,
 * automatically including all intermediate parent folders.
 */
export function createNode(
  path: string,
  type: "file" | "folder",
  meta?: Record<string, unknown>,
): FileTreeNodeData[] {
  const normalized = normalizePath(path);
  if (!normalized) return [];

  const result: FileTreeNodeData[] = [];
  const segments = normalized.split("/");

  // Create parent folders
  for (let i = 1; i < segments.length; i++) {
    const folderPath = segments.slice(0, i).join("/");
    result.push({ path: folderPath, type: "folder" });
  }

  // Create the node itself
  result.push({ path: normalized, type, ...(meta ? { meta } : {}) });

  return result;
}

/** Check if `childPath` is a descendant of `parentPath`. */
export function isDescendant(parentPath: string, childPath: string): boolean {
  return childPath.startsWith(parentPath + "/");
}
