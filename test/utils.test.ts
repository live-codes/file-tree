import { describe, expect, it } from "vitest";
import {
  normalizePath,
  getParentPath,
  getName,
  getExtension,
  normalizeData,
  buildHierarchy,
  defaultSort,
  cloneData,
  updatePathsInData,
  updatePathsInSet,
  createNode,
  isDescendant,
} from "../src/utils";
import type { FileTreeNodeData } from "../src/types";

describe("normalizePath", () => {
  it("converts backslashes to forward slashes", () => {
    expect(normalizePath("src\\utils\\helpers.ts")).toBe("src/utils/helpers.ts");
  });

  it("strips leading and trailing slashes", () => {
    expect(normalizePath("/src/index.ts")).toBe("src/index.ts");
    expect(normalizePath("src/index.ts/")).toBe("src/index.ts");
    expect(normalizePath("/")).toBe("");
  });

  it("collapses repeated slashes", () => {
    expect(normalizePath("src//utils///helpers.ts")).toBe(
      "src/utils/helpers.ts",
    );
  });

  it("returns empty string for empty input", () => {
    expect(normalizePath("")).toBe("");
  });
});

describe("getParentPath", () => {
  it("returns parent path", () => {
    expect(getParentPath("src/utils/helpers.ts")).toBe("src/utils");
  });

  it("returns empty string for root-level paths", () => {
    expect(getParentPath("index.ts")).toBe("");
  });

  it("handles single-level nesting", () => {
    expect(getParentPath("src/index.ts")).toBe("src");
  });
});

describe("getName", () => {
  it("returns the last path segment", () => {
    expect(getName("src/utils/helpers.ts")).toBe("helpers.ts");
  });

  it("returns the whole path for root-level names", () => {
    expect(getName("index.ts")).toBe("index.ts");
  });
});

describe("getExtension", () => {
  it("returns lowercase extension without dot", () => {
    expect(getExtension("helpers.TS")).toBe("ts");
  });

  it("returns empty string when there is no extension", () => {
    expect(getExtension("README")).toBe("");
  });

  it("returns empty string for dotfiles with no extension after the dot", () => {
    expect(getExtension(".gitignore")).toBe("");
  });

  it("handles multi-dot names", () => {
    expect(getExtension("app.module.spec.ts")).toBe("ts");
  });
});

describe("normalizeData", () => {
  it("normalizes paths, drops empty paths and auto-creates parents", () => {
    const result = normalizeData([
      { path: "src\\index.ts", type: "file" },
      { path: "", type: "file" },
    ]);
    expect(result.map((d) => d.path)).toEqual(["src/index.ts", "src"]);
  });

  it("deduplicates by path, first occurrence wins", () => {
    const result = normalizeData([
      { path: "a.ts", type: "file", meta: { first: true } },
      { path: "a.ts", type: "folder", meta: { second: true } },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].meta).toEqual({ first: true });
    expect(result[0].type).toBe("file");
  });

  it("auto-creates missing parent folders", () => {
    const result = normalizeData([
      { path: "src/utils/helpers.ts", type: "file" },
    ]);
    const paths = result.map((d) => d.path).sort();
    expect(paths).toEqual(["src", "src/utils", "src/utils/helpers.ts"]);
    expect(result.find((d) => d.path === "src")?.type).toBe("folder");
  });

  it("keeps explicitly declared nodes and their data", () => {
    const result = normalizeData([
      { path: "src", type: "folder", meta: { custom: true } },
      { path: "src/index.ts", type: "file" },
    ]);
    expect(result.find((d) => d.path === "src")?.meta).toEqual({
      custom: true,
    });
  });
});

describe("buildHierarchy", () => {
  it("builds a nested tree (parents must be present in data)", () => {
    const data: FileTreeNodeData[] = [
      { path: "src", type: "folder" },
      { path: "src/utils", type: "folder" },
      { path: "src/utils/helpers.ts", type: "file" },
      { path: "src/index.ts", type: "file" },
      { path: "package.json", type: "file" },
    ];
    const roots = buildHierarchy(data, false);
    // Without sorting, insertion order is preserved.
    expect(roots.map((r) => r.path)).toEqual(["src", "package.json"]);
    expect(roots[0].children.map((c) => c.path)).toEqual([
      "src/utils",
      "src/index.ts",
    ]);
    expect(roots[0].children[0].children.map((c) => c.path)).toEqual([
      "src/utils/helpers.ts",
    ]);
  });

  it("sorts folders first then alphabetically when sort is enabled", () => {
    const data: FileTreeNodeData[] = [
      { path: "b.ts", type: "file" },
      { path: "a", type: "folder" },
      { path: "a.ts", type: "file" },
    ];
    const roots = buildHierarchy(data, true);
    expect(roots.map((r) => r.path)).toEqual(["a", "a.ts", "b.ts"]);
  });

  it("applies a custom comparator", () => {
    const data: FileTreeNodeData[] = [
      { path: "b.ts", type: "file" },
      { path: "a.ts", type: "file" },
    ];
    const roots = buildHierarchy(data, (a, b) => b.path.localeCompare(a.path));
    expect(roots.map((r) => r.path)).toEqual(["b.ts", "a.ts"]);
  });

  it("exposes the original data reference on each node", () => {
    const data: FileTreeNodeData[] = [{ path: "a.ts", type: "file" }];
    const roots = buildHierarchy(data, false);
    expect(roots[0].data).toBe(data[0]);
  });
});

describe("defaultSort", () => {
  it("puts folders before files", () => {
    expect(defaultSort({ path: "a", type: "folder" }, { path: "a.ts", type: "file" })).toBeLessThan(0);
    expect(defaultSort({ path: "a.ts", type: "file" }, { path: "a", type: "folder" })).toBeGreaterThan(0);
  });

  it("sorts alphabetically case-insensitively within a type", () => {
    expect(defaultSort({ path: "B.ts", type: "file" }, { path: "a.ts", type: "file" })).toBeGreaterThan(0);
  });
});

describe("cloneData", () => {
  it("returns a deep-enough clone (meta is copied)", () => {
    const data: FileTreeNodeData[] = [
      { path: "a.ts", type: "file", meta: { nested: { x: 1 } } },
    ];
    const clone = cloneData(data);
    expect(clone).not.toBe(data);
    expect(clone[0]).not.toBe(data[0]);
    expect(clone[0].meta).not.toBe(data[0].meta);
    expect(clone[0].meta).toEqual({ nested: { x: 1 } });
  });

  it("leaves meta undefined when absent", () => {
    const clone = cloneData([{ path: "a.ts", type: "file" }]);
    expect(clone[0].meta).toBeUndefined();
  });
});

describe("updatePathsInData", () => {
  it("renames the node and rewrites descendant paths", () => {
    const data: FileTreeNodeData[] = [
      { path: "src", type: "folder" },
      { path: "src/index.ts", type: "file" },
      { path: "src/lib/util.ts", type: "file" },
      { path: "other.ts", type: "file" },
    ];
    updatePathsInData(data, "src", "components");
    const paths = data.map((d) => d.path);
    expect(paths).toEqual([
      "components",
      "components/index.ts",
      "components/lib/util.ts",
      "other.ts",
    ]);
  });

  it("leaves unrelated paths untouched", () => {
    const data: FileTreeNodeData[] = [
      { path: "src.ts", type: "file" },
      { path: "src/x.ts", type: "file" },
    ];
    updatePathsInData(data, "src", "lib");
    // "src.ts" must NOT match the "src/" prefix
    expect(data.map((d) => d.path)).toEqual(["src.ts", "lib/x.ts"]);
  });
});

describe("updatePathsInSet", () => {
  it("renames matching entries and keeps others", () => {
    const set = new Set(["src", "src/lib", "src/lib/util", "other"]);
    updatePathsInSet(set, "src", "components");
    expect([...set].sort()).toEqual([
      "components",
      "components/lib",
      "components/lib/util",
      "other",
    ]);
  });
});

describe("createNode", () => {
  it("creates intermediate folders plus the node", () => {
    const result = createNode("src/components/Button.tsx", "file");
    expect(result).toEqual([
      { path: "src", type: "folder" },
      { path: "src/components", type: "folder" },
      { path: "src/components/Button.tsx", type: "file" },
    ]);
  });

  it("creates a single root node without folders", () => {
    expect(createNode("package.json", "file")).toEqual([
      { path: "package.json", type: "file" },
    ]);
  });

  it("attaches meta to the created node", () => {
    const result = createNode("a/b.txt", "file", { custom: 1 });
    expect(result[1].meta).toEqual({ custom: 1 });
    expect(result[0].meta).toBeUndefined();
  });

  it("normalizes the path before building", () => {
    const result = createNode("a\\b.txt", "file");
    expect(result.map((d) => d.path)).toEqual(["a", "a/b.txt"]);
  });

  it("returns an empty array for empty paths", () => {
    expect(createNode("", "file")).toEqual([]);
    expect(createNode("/", "file")).toEqual([]);
  });
});

describe("isDescendant", () => {
  it("returns true for nested paths", () => {
    expect(isDescendant("src", "src/utils/helpers.ts")).toBe(true);
  });

  it("returns false for the same path and unrelated paths", () => {
    expect(isDescendant("src", "src")).toBe(false);
    expect(isDescendant("src", "src.ts")).toBe(false);
    expect(isDescendant("src", "lib")).toBe(false);
  });
});
