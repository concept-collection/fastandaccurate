// Convergence test: run the numbl solvers on the official instances
// through numbl in node and check that errors behave as the theory says
// they should. The MATLAB-runtime solvers are covered by
// test/matlab-test.ts, run locally where MATLAB exists, against the same
// expectations in test/expected.ts.
// Run with: npx tsx test/solver-test.ts

import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { INSTANCES, getInstance } from "../src/problems/laplace2d/spec";
import {
  SOLVERS,
  getSolver,
  solverSourceDir,
  type SolverManifest,
} from "../src/solvers";
import { runPoint, type MatlabSources } from "../src/harness/runner";
import { runSweep } from "../src/harness/sweep";
import { setNumblFileIO } from "../src/harness/numblRun";
import { DEFAULT_TIMING } from "../src/harness/timing";
import { NodeFileIOAdapter } from "../src/cli/nodeFileIO";
import { MUST_NOT_REACH, MUST_REACH } from "./expected";

// Solvers that mip-install packages (chunkie-dlp) need file I/O; in node
// that is the curl-backed adapter.
setNumblFileIO((vfs) => new NodeFileIOAdapter(vfs));

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf-8");

const base = {
  buildProblem: read("src/problems/laplace2d/matlab/build_problem.m"),
  bdata: read("src/problems/laplace2d/matlab/laplace2d_bdata.m"),
};
const solverSources = (solver: SolverManifest): MatlabSources => ({
  ...base,
  solver: read(`src/solvers/${solverSourceDir(solver)}/solver.m`),
});

// The suite checks accuracy, not speed, so one timed run per point is
// enough; the committed results are what the full timing policy is for.
const TEST_TIMING = { ...DEFAULT_TIMING, minTimedRuns: 1, timeBudgetSeconds: 0 };

let failures = 0;

// Registry consistency, checked for every entry including the ones this
// suite does not run: the solver file must exist, it must have stated
// expectations, and an entry that borrows another entry's solver.m must
// carry the same version, so that two results claiming the same solver
// version really did run the same code.
for (const s of SOLVERS) {
  const dir = solverSourceDir(s);
  const path = `src/solvers/${dir}/solver.m`;
  if (!existsSync(join(root, path))) {
    console.log(`FAIL: ${s.id} has no ${path}`);
    failures++;
  }
  const expected = MUST_REACH[dir];
  if (!expected) {
    console.log(`FAIL: ${s.id} has no entry in test/expected.ts`);
    failures++;
  } else if (s.runtime === "numbl") {
    for (const inst of INSTANCES) {
      if (expected[inst.id] === undefined) {
        console.log(`FAIL: ${s.id} has no expectation on ${inst.id}`);
        failures++;
      }
    }
  }
  const twin = s.sourceDir && SOLVERS.find((x) => x.id === s.sourceDir);
  if (s.sourceDir && !twin) {
    console.log(
      `FAIL: ${s.id} names sourceDir ${s.sourceDir}, which is not a solver`
    );
    failures++;
  } else if (twin && twin.version !== s.version) {
    console.log(
      `FAIL: ${s.id} v${s.version} shares solver.m with ${twin.id} v${twin.version}`
    );
    failures++;
  }
}

for (const inst of INSTANCES) {
  for (const solver of SOLVERS.filter((s) => s.runtime === "numbl")) {
    console.log(`\n== ${inst.id} / ${solver.id}`);
    console.log("   n     relMax       relL2        solve(s)  cold(s)");
    let best = Infinity;
    runSweep({
      instance: inst,
      solver,
      sources: solverSources(solver),
      timing: TEST_TIMING,
      onPoint: (p) => {
        best = Math.min(best, p.relMax);
        console.log(
          `  ${String(p.n).padStart(4)}  ${p.relMax.toExponential(3)}  ` +
            `${p.relL2.toExponential(3)}  ${p.solveSeconds.toFixed(4)}    ${p.coldSeconds.toFixed(4)}`
        );
      },
    });
    const dir = solverSourceDir(solver);
    const reach = MUST_REACH[dir][inst.id];
    const notReach = MUST_NOT_REACH[dir]?.[inst.id];
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
    timing: TEST_TIMING,
    wantGrid: true,
    sources: solverSources(getSolver("nystrom-dlp")),
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
