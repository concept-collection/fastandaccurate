/**
 * The command line's bundle: the same harness source as the page, built
 * for node. numbl is pure TypeScript/JavaScript, so everything bundles
 * and the published package has no dependencies at all. The MATLAB
 * sources are not bundled; pack-cli.mjs copies them into the tarball and
 * the CLI reads them from disk beside itself, so the installed package
 * shows the exact solver code it runs.
 */
import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";

export default mergeConfig(
  base,
  defineConfig({
    ssr: {
      // Bundle everything (numbl included); the published tarball has no
      // dependencies.
      noExternal: true,
    },
    build: {
      ssr: "src/cli/main.ts",
      outDir: "dist-cli",
      target: "node20",
      emptyOutDir: true,
      minify: false,
      rollupOptions: {
        input: "src/cli/main.ts",
        output: { entryFileNames: "main.js" },
      },
    },
  })
);
