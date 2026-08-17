// Convergence test for the MATLAB-runtime solvers, run where real MATLAB
// exists (not in CI): npx tsx test/matlab-test.ts
// Exits quietly with a notice when no matlab is on the PATH.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getInstance } from "../src/problems/laplace2d/spec";
import { getSolver } from "../src/solvers";
import {
  ensureChunkie,
  matlabAvailable,
  runMatlabSweep,
} from "../src/cli/matlabRun";

if (!matlabAvailable()) {
  console.log("matlab not found on PATH; skipping MATLAB solver tests");
  process.exit(0);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf-8");
const sources = {
  buildProblem: read("src/problems/laplace2d/matlab/build_problem.m"),
  bdata: read("src/problems/laplace2d/matlab/laplace2d_bdata.m"),
  solver: read("src/solvers/chunkie-dlp/solver.m"),
};

const mustReach: Record<string, number> = {
  "disk-easy": 1e-10,
  "star-hard": 1e-9,
};

let failures = 0;
for (const [instId, reach] of Object.entries(mustReach)) {
  console.log(`\n== ${instId} / chunkie-dlp (MATLAB)`);
  console.log("   n     relMax       relL2        solve(s)");
  let best = Infinity;
  const { points, matlabVersion } = runMatlabSweep({
    instance: getInstance(instId),
    ns: getSolver("chunkie-dlp").sweepN,
    repeats: 1,
    sources,
    setup: ensureChunkie(),
  });
  for (const p of points) {
    best = Math.min(best, p.relMax);
    console.log(
      `  ${String(p.n).padStart(4)}  ${p.relMax.toExponential(3)}  ` +
        `${p.relL2.toExponential(3)}  ${p.solveSeconds.toFixed(4)}`
    );
  }
  console.log(`  (MATLAB ${matlabVersion})`);
  if (best > reach) {
    console.log(`  FAIL: best relMax ${best.toExponential(2)} > ${reach}`);
    failures++;
  } else {
    console.log(`  ok (best relMax ${best.toExponential(2)})`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall MATLAB checks passed");
