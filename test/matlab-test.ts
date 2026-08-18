// Convergence test for the MATLAB-runtime solvers, run where real MATLAB
// exists (not in CI): npx tsx test/matlab-test.ts
// Exits quietly with a notice when no matlab is on the PATH.
//
// The expectations live in test/expected.ts and are keyed by source
// directory, so mfs-mat and nystrom-dlp-mat are held to exactly the same
// accuracy as their numbl twins in test/solver-test.ts: if a -mat curve
// misses it, the runtime and not the method is the suspect.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getInstance } from "../src/problems/laplace2d/spec";
import { SOLVERS, solverSourceDir, sweepNFor } from "../src/solvers";
import {
  matlabAvailable,
  matlabSetup,
  runMatlabSweep,
} from "../src/cli/matlabRun";
import { DEFAULT_TIMING } from "../src/harness/timing";
import { MUST_NOT_REACH, MUST_REACH } from "./expected";

if (!matlabAvailable()) {
  console.log("matlab not found on PATH; skipping MATLAB solver tests");
  process.exit(0);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf-8");
const base = {
  buildProblem: read("src/problems/laplace2d/matlab/build_problem.m"),
  bdata: read("src/problems/laplace2d/matlab/laplace2d_bdata.m"),
};

let failures = 0;
for (const solver of SOLVERS.filter((s) => s.runtime === "matlab")) {
  const dir = solverSourceDir(solver);
  const sources = { ...base, solver: read(`src/solvers/${dir}/solver.m`) };
  const setup = matlabSetup(solver.id);
  for (const [instId, reach] of Object.entries(MUST_REACH[dir] ?? {})) {
    console.log(`\n== ${instId} / ${solver.id} (MATLAB)`);
    console.log("   n     relMax       relL2        solve(s)");
    let best = Infinity;
    const { points, matlabVersion } = runMatlabSweep({
      instance: getInstance(instId),
      ns: sweepNFor(solver, instId),
      timing: { ...DEFAULT_TIMING, minTimedRuns: 1, timeBudgetSeconds: 0 },
      sources,
      setup,
    });
    for (const p of points) {
      best = Math.min(best, p.relMax);
      console.log(
        `  ${String(p.n).padStart(4)}  ${p.relMax.toExponential(3)}  ` +
          `${p.relL2.toExponential(3)}  ${p.solveSeconds.toFixed(4)}`
      );
    }
    console.log(`  (MATLAB ${matlabVersion})`);
    const notReach = MUST_NOT_REACH[dir]?.[instId];
    if (best > reach) {
      console.log(`  FAIL: best relMax ${best.toExponential(2)} > ${reach}`);
      failures++;
    } else if (notReach !== undefined && best < notReach) {
      console.log(
        `  FAIL: best relMax ${best.toExponential(2)} < ${notReach} ` +
          "(instance no longer defeats this method)"
      );
      failures++;
    } else {
      console.log(`  ok (best relMax ${best.toExponential(2)})`);
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall MATLAB checks passed");
