import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = dirname(fileURLToPath(import.meta.url));
const numblVersion = (
  JSON.parse(
    readFileSync(join(root, "node_modules", "numbl", "package.json"), "utf-8")
  ) as { version: string }
).version;

export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    __NUMBL_VERSION__: JSON.stringify(numblVersion),
    __BUILD_ID__: JSON.stringify(
      process.env.GITHUB_SHA?.slice(0, 7) ?? "dev"
    ),
  },
  worker: {
    format: "es",
  },
});
