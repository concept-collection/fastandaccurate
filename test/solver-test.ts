// Convergence test: run both solvers on the official instances through
// numbl in node and check that errors behave as the theory says they
// should. Run with: npx tsx test/solver-test.ts

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { INSTANCES, getInstance } from "../src/problems/laplace2d/spec";
import { SOLVERS } from "../src/solvers";
import { runPoint, type MatlabSources } from "../src/harness/runner";
import { runSweep } from "../src/harness/sweep";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf-8");

const base = {
  buildProblem: read("src/problems/laplace2d/matlab/build_problem.m"),
  bdata: read("src/problems/laplace2d/matlab/laplace2d_bdata.m"),
  bdataBranch: read("src/problems/laplace2d/matlab/laplace2d_bdata_branch.m"),
};
const solverSources: Record<string, MatlabSources> = {
  mfs: { ...base, solver: read("src/solvers/mfs/solver.m") },
  "nystrom-dlp": { ...base, solver: read("src/solvers/nystrom-dlp/solver.m") },
};

// Best relMax each solver must reach over its full sweep. On star-hard,
// MFS is additionally required NOT to do well: its charge curve lies
// beyond the data's singularities there, and if it suddenly reached high
// accuracy the instance would no longer be testing what the spec says.
const mustReach: Record<string, Record<string, number>> = {
  mfs: {
    "disk-easy": 1e-12,
    "star-medium": 1e-12,
    "star-hard": 1e-2,
    "star-branch": 1e-10,
  },
  "nystrom-dlp": {
    "disk-easy": 1e-10,
    "star-medium": 1e-10,
    "star-hard": 1e-8,
    "star-branch": 1e-10,
  },
};
const mustNotReach: Record<string, Record<string, number>> = {
  mfs: { "star-hard": 1e-8 },
};

let failures = 0;

for (const inst of INSTANCES) {
  for (const solver of SOLVERS) {
    console.log(`\n== ${inst.id} / ${solver.id}`);
    console.log("   n     relMax       relL2        solve(s)  cold(s)");
    let best = Infinity;
    runSweep({
      instance: inst,
      solver,
      sources: solverSources[solver.id],
      repeats: 1,
      onPoint: (p) => {
        best = Math.min(best, p.relMax);
        console.log(
          `  ${String(p.n).padStart(4)}  ${p.relMax.toExponential(3)}  ` +
            `${p.relL2.toExponential(3)}  ${p.solveSeconds.toFixed(4)}    ${p.coldSeconds.toFixed(4)}`
        );
      },
    });
    const reach = mustReach[solver.id][inst.id];
    const notReach = mustNotReach[solver.id]?.[inst.id];
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

// The grid path: one run with wantGrid on the medium instance.
{
  const p = runPoint({
    instance: getInstance("star-medium"),
    n: 64,
    repeats: 1,
    wantGrid: true,
    sources: solverSources["nystrom-dlp"],
  });
  if (!p.uGrid || p.uGrid.length !== 200 * 200) {
    console.log(`\nFAIL: grid has ${p.uGrid?.length ?? 0} values, expected 40000`);
    failures++;
  } else {
    console.log(`\ngrid ok (${p.uGrid.length} values)`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall checks passed");
