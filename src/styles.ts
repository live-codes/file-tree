import css from "./styles.css";

const STYLE_ID = "ft-styles";

/**
 * Inject the library stylesheet into `document.head` once.
 * Safe to call multiple times across instances or bundle copies.
 */
export function injectStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}
