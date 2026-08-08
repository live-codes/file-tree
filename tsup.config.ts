import { defineConfig } from "tsup";

// The library's stylesheet is inlined into the bundle as a string and
// injected into `document.head` at runtime (see `src/styles.ts`).
// `injectStyle` minifies the CSS (esbuild transform) and replaces the
// `styles.css` module with a JS module whose default export is the
// minified CSS string — which `styles.ts` imports directly.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
  splitting: false,
  outDir: "dist",
  external: [],
  noExternal: [],
  injectStyle: (css) => `export default ${css};`,
  onSuccess:
    "npx lightningcss --minify --bundle src/styles.css -o dist/styles.css",
});
