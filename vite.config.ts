import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, normalize } from "path";

const root = dirname(fileURLToPath(import.meta.url));
const numblVersion = (
  JSON.parse(
    readFileSync(join(root, "node_modules", "numbl", "package.json"), "utf-8")
  ) as { version: string }
).version;

/**
 * In dev, serve the sibling fastandaccurate-results checkout under
 * /local-results/ so the page shows the results repo as it stands on
 * disk, uncommitted and unpushed included, and never touches the network
 * for them. Production builds fetch the deployed results site instead.
 */
function localResultsPlugin(): Plugin {
  const resultsRoot = join(root, "..", "fastandaccurate-results");
  return {
    name: "fastandaccurate-local-results",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        if (!url.startsWith("/local-results/")) return next();
        const rel = decodeURIComponent(url.slice("/local-results/".length));
        const file = normalize(join(resultsRoot, rel));
        if (!file.startsWith(normalize(resultsRoot)) || !existsSync(file)) {
          res.statusCode = 404;
          res.end("not found");
          return;
        }
        res.setHeader("content-type", "application/json");
        res.end(readFileSync(file));
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), localResultsPlugin()],
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
