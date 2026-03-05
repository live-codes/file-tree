import { defineConfig } from "tsup";

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
  esbuildOptions(options) {
    options.loader = {
      ...options.loader,
      ".css": "copy",
    };
  },
  onSuccess:
    "npx lightningcss --minify --bundle src/styles.css -o dist/styles.css",
});
