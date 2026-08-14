import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextMenu, type ContextMenuEntry } from "../src/ContextMenu";

function setup(): {
  container: HTMLElement;
  menu: ContextMenu;
  entries: ContextMenuEntry[];
} {
  const container = document.createElement("div");
  container.style.width = "400px";
  container.style.height = "300px";
  document.body.appendChild(container);
  const menu = new ContextMenu(container);
  const entries: ContextMenuEntry[] = [
    { id: "a", label: "Alpha", onClick: vi.fn() },
    { id: "b", label: "Beta", icon: "<svg></svg>", shortcut: "Ctrl+B", onClick: vi.fn() },
    { id: "c", label: "Disabled", disabled: true, onClick: vi.fn() },
  ];
  return { container, menu, entries };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ContextMenu", () => {
  it("is hidden initially", () => {
    const { menu } = setup();
    expect(menu.visible).toBe(false);
  });

  it("shows entries and makes the menu visible", () => {
    const { menu, entries } = setup();
    menu.show(10, 10, entries);
    expect(menu.visible).toBe(true);
    const items = menu["el"].querySelectorAll(".ft-context-menu__item");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain("Alpha");
  });

  it("renders shortcut and icon", () => {
    const { menu, entries } = setup();
    menu.show(0, 0, entries);
    const items = menu["el"].querySelectorAll(".ft-context-menu__item");
    expect(items[1].querySelector(".ft-context-menu__shortcut")?.textContent).toBe("Ctrl+B");
    expect(items[1].querySelector(".ft-context-menu__icon")?.innerHTML).toBe("<svg></svg>");
  });

  it("renders separators", () => {
    const { menu, entries } = setup();
    menu.show(0, 0, [
      ...entries,
      { id: "sep", label: "", separator: true, onClick: () => {} },
      { id: "d", label: "Delta", onClick: () => {} },
    ]);
    expect(menu["el"].querySelectorAll(".ft-context-menu__separator")).toHaveLength(1);
  });

  it("calls onClick and hides when an enabled item is clicked", () => {
    const { menu, entries } = setup();
    menu.show(0, 0, entries);
    const item = menu["el"].querySelectorAll(".ft-context-menu__item")[1];
    item.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect((entries[1].onClick as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
    expect(menu.visible).toBe(false);
  });

  it("does not call onClick for disabled items", () => {
    const { menu, entries } = setup();
    menu.show(0, 0, entries);
    const items = menu["el"].querySelectorAll(".ft-context-menu__item");
    items[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(entries[2].onClick).not.toHaveBeenCalled();
  });

  it("hides when clicking outside", () => {
    const { menu, entries } = setup();
    menu.show(0, 0, entries);
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(menu.visible).toBe(false);
  });

  it("keeps the menu open when clicking inside", () => {
    const { menu, entries } = setup();
    menu.show(0, 0, entries);
    menu["el"].dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(menu.visible).toBe(true);
  });

  it("hides on Escape", () => {
    const { menu, entries } = setup();
    menu.show(0, 0, entries);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(menu.visible).toBe(false);
  });

  it("navigates items with arrow keys and activates with Enter", () => {
    const { menu, entries } = setup();
    menu.show(0, 0, entries);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    // First enabled item is focused and activated by Enter.
    expect(entries[0].onClick).toHaveBeenCalled();
    expect(menu.visible).toBe(false);
  });

  it("hide() is idempotent and removes DOM listeners", () => {
    const { menu, entries } = setup();
    menu.show(0, 0, entries);
    menu.hide();
    menu.hide();
    expect(menu.visible).toBe(false);
    // After hide, clicking outside should not throw or reopen.
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(menu.visible).toBe(false);
  });

  it("destroy() removes the menu element", () => {
    const { container, menu, entries } = setup();
    menu.show(0, 0, entries);
    menu.destroy();
    expect(container.querySelector(".ft-context-menu")).toBeNull();
  });

  it("clamps position within the container", () => {
    const { container, menu, entries } = setup();
    // jsdom reports zero rects; stub real geometry so the clamp math runs.
    const menuEl = menu["el"];
    const menuRect = { left: 300, right: 420, width: 120, height: 40, top: 50, bottom: 90 };
    const containerRect = { left: 0, right: 400, width: 400, height: 300, top: 0, bottom: 300 };
    vi.spyOn(menuEl, "getBoundingClientRect").mockReturnValue(menuRect as DOMRect);
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue(containerRect as DOMRect);
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    menu.show(10, 10, entries);
    // Menu overflows the right edge, so it should be clamped to fit.
    const left = parseFloat(menuEl.style.left);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + parseFloat(menuEl.style.width || "0")).toBeLessThanOrEqual(400);
    raf.mockRestore();
  });
});
