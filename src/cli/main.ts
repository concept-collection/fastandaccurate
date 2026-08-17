// The fastandaccurate command line: run work-precision sweeps outside the
// browser, through the same harness the site uses, and write result JSON
// files ready to submit to the fastandaccurate-results repository by PR.
//
//   fastandaccurate list
//   fastandaccurate run [--instance <id>] [--solver <id>]
//                       [--solver-file f.m --solver-id name]
//                       [--repeats N] [--max-n N] [--label "text"]
//                       [--out dir]
//
// In development: npx tsx src/cli/main.ts run ...

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import os from "os";
import { INSTANCES, getInstance } from "../problems/laplace2d/spec";
import { setNumblFileIO } from "../harness/numblRun";
import { NodeFileIOAdapter } from "./nodeFileIO";

setNumblFileIO((vfs) => new NodeFileIOAdapter(vfs));
import { SOLVERS, getSolver, type SolverManifest } from "../solvers";
import { runSweep } from "../harness/sweep";
import type { MatlabSources } from "../harness/runner";
import {
  buildResultFile,
  toResultPoint,
  type ResultEnvironment,
} from "../harness/resultSchema";

const moduleDir = dirname(fileURLToPath(import.meta.url));

/** Locate the directory holding the .m sources: the repo's src/ in
 * development, the bundle's own src/ in the packed CLI. */
function findSrcRoot(): string {
  const candidates = [join(moduleDir, "..", ".."), join(moduleDir)];
  for (const c of candidates) {
    if (existsSync(join(c, "src", "problems", "laplace2d", "matlab", "build_problem.m"))) {
      return join(c, "src");
    }
  }
  throw new Error("cannot locate MATLAB sources next to the CLI");
}

const srcRoot = findSrcRoot();
const readSrc = (p: string) => readFileSync(join(srcRoot, p), "utf-8");

function numblVersion(): string {
  // The packed CLI has numbl bundled in; the version is stamped at build
  // time. In development (tsx), read it from node_modules instead.
  if (typeof __NUMBL_VERSION__ !== "undefined") return __NUMBL_VERSION__;
  const c = join(srcRoot, "..", "node_modules", "numbl", "package.json");
  if (existsSync(c)) {
    return (JSON.parse(readFileSync(c, "utf-8")) as { version: string }).version;
  }
  return "unknown";
}

function environment(machineLabel: string | undefined, builtin: boolean): ResultEnvironment {
  return {
    kind: "node",
    runtime: `node ${process.version}`,
    numblVersion: numblVersion(),
    os: `${os.platform()} ${os.release()}`,
    cpu: os.cpus()[0]?.model?.trim() ?? "unknown",
    machineLabel,
    browserReproducible: builtin,
  };
}

interface Args {
  command: string;
  flags: Record<string, string>;
}

function parseArgs(argv: string[]): Args {
  const [command = "help", ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith("--")) throw new Error(`unexpected argument: ${a}`);
    const key = a.slice(2);
    const val = rest[i + 1];
    if (val === undefined || val.startsWith("--")) {
      flags[key] = "true";
    } else {
      flags[key] = val;
      i++;
    }
  }
  return { command, flags };
}

function listCommand() {
  console.log("Problem: laplace-dirichlet-2d (v1)\n");
  console.log("Instances:");
  for (const inst of INSTANCES) {
    console.log(`  ${inst.id.padEnd(14)} ${inst.label}`);
  }
  console.log("\nSolvers:");
  for (const s of SOLVERS) {
    console.log(`  ${s.id.padEnd(14)} ${s.name} (v${s.version}, ${s.backend})`);
  }
}

async function runCommand(flags: Record<string, string>) {
  const repeats = flags.repeats ? parseInt(flags.repeats, 10) : 3;
  const maxN = flags["max-n"] ? parseInt(flags["max-n"], 10) : undefined;
  const outDir = resolve(flags.out ?? "fastandaccurate-results-out");
  const instances = flags.instance
    ? [getInstance(flags.instance)]
    : INSTANCES;

  const base = {
    buildProblem: readSrc("problems/laplace2d/matlab/build_problem.m"),
    bdata: readSrc("problems/laplace2d/matlab/laplace2d_bdata.m"),
  };

  let solverList: { manifest: SolverManifest; sources: MatlabSources; source: string }[];
  if (flags["solver-file"]) {
    const file = resolve(flags["solver-file"]);
    const id = flags["solver-id"];
    if (!id) throw new Error("--solver-file requires --solver-id");
    const manifest: SolverManifest = {
      id,
      name: id,
      description: `custom solver from ${file}`,
      version: flags["solver-version"] ?? "0.0.0",
      backend: "cpu",
      sweepN: getSolver("nystrom-dlp").sweepN,
    };
    solverList = [
      {
        manifest,
        sources: { ...base, solver: readFileSync(file, "utf-8") },
        source: file,
      },
    ];
  } else {
    const wanted = flags.solver ? [getSolver(flags.solver)] : SOLVERS;
    solverList = wanted.map((manifest) => ({
      manifest,
      sources: { ...base, solver: readSrc(`solvers/${manifest.id}/solver.m`) },
      source: "builtin",
    }));
  }

  mkdirSync(outDir, { recursive: true });
  const env = environment(flags.label, !flags["solver-file"]);

  for (const inst of instances) {
    for (const { manifest, sources, source } of solverList) {
      console.log(`\n${inst.id} / ${manifest.id}`);
      console.log("   n     relMax      relL2       solve(s)");
      const points = runSweep({
        instance: inst,
        solver: manifest,
        sources,
        repeats,
        maxN,
        onPoint: (p) => {
          console.log(
            `  ${String(p.n).padStart(4)}  ${p.relMax.toExponential(2)}  ` +
              `${p.relL2.toExponential(2)}  ${p.solveSeconds.toFixed(4)}`
          );
        },
      });
      const result = await buildResultFile({
        instance: inst,
        solver: {
          id: manifest.id,
          version: manifest.version,
          backend: manifest.backend,
          source,
        },
        environment: env,
        repeats,
        points: points.map(toResultPoint),
      });
      const name = `laplace-dirichlet-2d.${inst.id}.${manifest.id}.json`;
      const path = join(outDir, name);
      writeFileSync(path, JSON.stringify(result, null, 2) + "\n");
      console.log(`  wrote ${path}`);
    }
  }
  console.log(
    "\nTo publish: open a pull request adding these files under results/ in " +
      "https://github.com/concept-collection/fastandaccurate-results"
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "list") {
    listCommand();
  } else if (args.command === "run") {
    await runCommand(args.flags);
  } else {
    console.log(
      [
        "fastandaccurate - PDE solver benchmarks (https://concept-collection.github.io/fastandaccurate/)",
        "",
        "Commands:",
        "  list   List problems, instances, and solvers",
        "  run    Run work-precision sweeps and write result JSON files",
        "",
        "Run flags:",
        "  --instance <id>      One instance (default: all)",
        "  --solver <id>        One built-in solver (default: all)",
        "  --solver-file <f.m>  A custom solver file (requires --solver-id)",
        "  --solver-id <name>   Identifier for the custom solver",
        "  --solver-version <v> Version string for the custom solver",
        "  --repeats <N>        Timed repeats per point (default 3)",
        "  --max-n <N>          Restrict the sweep to n <= N",
        "  --label <text>       Free-text machine label recorded in results",
        "  --out <dir>          Output directory (default fastandaccurate-results-out)",
      ].join("\n")
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
