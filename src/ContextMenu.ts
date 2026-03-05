export interface ContextMenuEntry {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  separator?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export class ContextMenu {
  private el: HTMLElement;
  private isOpen = false;
  private boundClose: (e: MouseEvent) => void;
  private boundKeydown: (e: KeyboardEvent) => void;
  private focusedIndex = -1;
  private items: HTMLElement[] = [];

  constructor(private container: HTMLElement) {
    this.el = document.createElement("div");
    this.el.className = "ft-context-menu";
    this.el.setAttribute("role", "menu");
    this.el.style.display = "none";
    this.container.appendChild(this.el);

    this.boundClose = (e: MouseEvent) => {
      if (!this.el.contains(e.target as Node)) {
        this.hide();
      }
    };

    this.boundKeydown = (e: KeyboardEvent) => {
      if (!this.isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        this.hide();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        this.moveFocus(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.moveFocus(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (this.focusedIndex >= 0 && this.items[this.focusedIndex]) {
          this.items[this.focusedIndex].click();
        }
      }
    };
  }

  show(x: number, y: number, entries: ContextMenuEntry[]): void {
    this.el.innerHTML = "";
    this.items = [];
    this.focusedIndex = -1;

    for (const entry of entries) {
      if (entry.separator) {
        const sep = document.createElement("div");
        sep.className = "ft-context-menu__separator";
        sep.setAttribute("role", "separator");
        this.el.appendChild(sep);
        continue;
      }

      const item = document.createElement("div");
      item.className = "ft-context-menu__item";
      if (entry.disabled) item.classList.add("ft-context-menu__item--disabled");
      item.setAttribute("role", "menuitem");
      item.tabIndex = -1;

      let html = "";
      if (entry.icon) {
        html += `<span class="ft-context-menu__icon">${entry.icon}</span>`;
      }
      html += `<span class="ft-context-menu__label">${entry.label}</span>`;
      if (entry.shortcut) {
        html += `<span class="ft-context-menu__shortcut">${entry.shortcut}</span>`;
      }
      item.innerHTML = html;

      if (!entry.disabled) {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          this.hide();
          entry.onClick();
        });
      }

      this.el.appendChild(item);
      this.items.push(item);
    }

    // Position: prevent overflow
    this.el.style.display = "block";
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;

    requestAnimationFrame(() => {
      const rect = this.el.getBoundingClientRect();
      const containerRect = this.container.getBoundingClientRect();
      const viewW = containerRect.width;
      const viewH = containerRect.height;

      if (rect.right > containerRect.right) {
        this.el.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > containerRect.bottom) {
        this.el.style.top = `${Math.max(0, y - rect.height)}px`;
      }
    });

    this.isOpen = true;
    document.addEventListener("mousedown", this.boundClose, true);
    document.addEventListener("keydown", this.boundKeydown, true);
  }

  hide(): void {
    if (!this.isOpen) return;
    this.el.style.display = "none";
    this.el.innerHTML = "";
    this.isOpen = false;
    this.items = [];
    this.focusedIndex = -1;
    document.removeEventListener("mousedown", this.boundClose, true);
    document.removeEventListener("keydown", this.boundKeydown, true);
  }

  get visible(): boolean {
    return this.isOpen;
  }

  private moveFocus(delta: number): void {
    if (this.items.length === 0) return;
    this.focusedIndex =
      (this.focusedIndex + delta + this.items.length) % this.items.length;
    this.items.forEach((it, i) => {
      it.classList.toggle(
        "ft-context-menu__item--focused",
        i === this.focusedIndex,
      );
    });
    this.items[this.focusedIndex]?.focus();
  }

  destroy(): void {
    this.hide();
    this.el.remove();
  }
}
