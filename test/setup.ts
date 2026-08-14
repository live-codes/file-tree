import { afterEach, beforeEach } from "vitest";

// The test-only FakeDataTransfer adds an `addFile` helper; make it visible
// to the type checker for tests.
declare global {
  interface DataTransfer {
    addFile(file: File): void;
  }
}

// Keep the DOM clean between tests. Any FileTree instance created without
// `injectStyles: false` adds a `#ft-styles` element to document.head.
beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

// jsdom lacks scrollIntoView; the library calls it on node content elements.
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom (29.x) does not expose `DataTransfer`. The library only uses
// `dataTransfer.files`, `dataTransfer.items`, `setData` and `effectAllowed`,
// so a minimal implementation is enough for the drag-and-drop tests.
if (typeof globalThis.DataTransfer === "undefined") {
  class FakeDataTransfer {
    files: FileList = {
      length: 0,
      item: () => null,
      [Symbol.iterator]: [][Symbol.iterator],
    } as unknown as FileList;
    items: DataTransferItemList = [] as unknown as DataTransferItemList;
    effectAllowed = "none";
    dropEffect = "none";
    private data = new Map<string, string>();
    private fileList: File[] = [];

    setData(type: string, value: string): void {
      this.data.set(type, value);
    }

    getData(type: string): string {
      return this.data.get(type) ?? "";
    }

    /** Test helper: attach a dropped File. */
    addFile(file: File): void {
      this.fileList.push(file);
      this.files = Object.assign([], this.fileList, {
        length: this.fileList.length,
        item: (i: number) => this.fileList[i] ?? null,
      }) as unknown as FileList;
    }
  }
  globalThis.DataTransfer = FakeDataTransfer as unknown as typeof DataTransfer;
}
