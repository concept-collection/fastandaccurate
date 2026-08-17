/**
 * Pack the command-line bundle as an npm tarball and put it in dist/,
 * where the page is deployed, so that
 *
 *   npx https://concept-collection.github.io/fastandaccurate/cli.tgz
 *
 * installs and runs it anywhere node 20+ is. Nothing goes to the npm
 * registry: npm installs a tarball from a URL as happily as from a name,
 * and this way the command line is always the same commit as the site.
 * (npx caches by the exact URL string, so the site offers the URL with a
 * ?v=<commit> suffix to make each deployment a fresh install.)
 *
 * Usage: node scripts/pack-cli.mjs  (after vite build --config vite.cli.config.ts)
 */
import { execFileSync } from "node:child_process";
import {
  mkdtemp,
  copyFile,
  writeFile,
  readFile,
  rm,
  mkdir,
} from "node:fs/promises";
import { glob } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

const manifest = {
  name: "fastandaccurate-cli",
  version: pkg.version,
  description:
    "Run fastandaccurate PDE-solver benchmarks from the command line",
  license: "Apache-2.0",
  type: "module",
  engines: { node: ">=20" },
  bin: { fastandaccurate: "launch.cjs" },
};

const stage = await mkdtemp(join(tmpdir(), "fastandaccurate-cli-"));
try {
  await copyFile(join(root, "dist-cli/main.js"), join(stage, "main.js"));
  await copyFile(join(root, "scripts/cli-launcher.cjs"), join(stage, "launch.cjs"));
  // The MATLAB sources, preserved under src/ so the CLI's source-root
  // probe finds them beside the bundle.
  for await (const entry of glob("src/{problems,solvers}/**/*.m", { cwd: root })) {
    const rel = relative(root, join(root, entry));
    await mkdir(join(stage, dirname(rel)), { recursive: true });
    await copyFile(join(root, rel), join(stage, rel));
  }
  await writeFile(
    join(stage, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  const out = execFileSync(
    "npm",
    ["pack", "--silent", "--pack-destination", stage],
    { cwd: stage, encoding: "utf8" }
  ).trim();
  await mkdir(join(root, "dist"), { recursive: true });
  await copyFile(join(stage, out), join(root, "dist/cli.tgz"));
  console.log(`dist/cli.tgz  (${manifest.name} ${manifest.version})`);
} finally {
  await rm(stage, { recursive: true, force: true });
}
