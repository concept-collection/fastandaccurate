// Convergence test for the WebGPU-runtime solvers, run where a WebGPU
// device can be had: npx tsx test/gpu-test.ts
// Exits quietly with a notice when there is none, which is the usual case
// on a headless machine and in CI.
//
// The expectations live in test/expected.ts, keyed by source directory, as
// for the other two suites. mfs-gpu's floors are deliberately far looser
// than mfs's, because WebGPU has no f64; MUST_NOT_REACH pins that down from
// the other side, so a run that suddenly got double precision fails here
// rather than quietly changing what the pair of curves means.

import { getInstance, INSTANCES } from "../src/problems/laplace2d/spec";
import { SOLVERS, solverSourceDir, sweepNFor } from "../src/solvers";
import { runSweepGpu } from "../src/harness/webgpuRun";
import { gpuUnavailableReason, requestGpu } from "../src/harness/webgpuDevice";
import { DEFAULT_TIMING } from "../src/harness/timing";
import { MUST_NOT_REACH, MUST_REACH } from "./expected";

const why = await gpuUnavailableReason();
if (why !== null) {
  console.log(`no WebGPU device here; skipping the WebGPU solver tests\n  ${why}`);
  process.exit(0);
}
const { adapter, via } = await requestGpu();
console.log(`WebGPU: ${adapter} (${via})`);

// Accuracy, not speed: one timed run per point is enough here.
const TEST_TIMING = { ...DEFAULT_TIMING, minTimedRuns: 1, timeBudgetSeconds: 0 };

let failures = 0;
for (const solver of SOLVERS.filter((s) => s.runtime === "webgpu")) {
  const dir = solverSourceDir(solver);
  for (const inst of INSTANCES) {
    const reach = MUST_REACH[dir]?.[inst.id];
    if (reach === undefined) continue;
    console.log(`\n== ${inst.id} / ${solver.id} (WebGPU)`);
    console.log("   n     relMax       relL2        solve(s)");
    let best = Infinity;
    const points = await runSweepGpu({
      instance: getInstance(inst.id),
      solver,
      timing: TEST_TIMING,
      onPoint: (p) => {
        best = Math.min(best, p.relMax);
        console.log(
          `  ${String(p.n).padStart(4)}  ${p.relMax.toExponential(3)}  ` +
            `${p.relL2.toExponential(3)}  ${p.solveSeconds.toFixed(4)}`
        );
      },
    });
    if (points.length !== sweepNFor(solver, inst.id).length) {
      console.log("  FAIL: sweep returned the wrong number of points");
      failures++;
      continue;
    }
    const notReach = MUST_NOT_REACH[dir]?.[inst.id];
    if (best > reach) {
      console.log(`  FAIL: best relMax ${best.toExponential(2)} > ${reach}`);
      failures++;
    } else if (notReach !== undefined && best < notReach) {
      console.log(
        `  FAIL: best relMax ${best.toExponential(2)} < ${notReach} ` +
          "(single precision no longer caps this solver)"
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
console.log("\nall WebGPU checks passed");
