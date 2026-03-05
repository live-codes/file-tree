import fs from "node:fs/promises";
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
  async onSuccess() {
    const styles = await fs.readFile("src/styles.css", "utf-8");
    await fs.writeFile("dist/styles.css", styles);
  },
});
