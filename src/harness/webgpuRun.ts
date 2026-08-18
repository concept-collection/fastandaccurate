// Runs a solver whose manifest declares runtime "webgpu": one that is
// TypeScript and WGSL rather than a MATLAB file, and executes on a WebGPU
// device. Used from the browser (where the device is the page's) and from
// the command line (where it is Dawn's, through the optional `webgpu`
// package).
//
// The protocol is the one in docs/problems/laplace-dirichlet-2d.md and the
// counting is identical to the numbl and MATLAB runners: one timed warmup
// reported as the cold time, a second untimed one, then timed runs until
// the policy is satisfied, of which the fastest is reported. What differs
// is the clock. A GPU solver has no tic/toc inside its own runtime, so the
// time is host wall clock around a run that ends by awaiting the device:
// the work is submitted and the result read back before the clock stops,
// which is the same synchronization point MATLAB's synchronous tic/toc
// gives. Shader compilation and pipeline creation happen once per device
// rather than per run, so, like numbl's JIT, they land outside the timed
// runs.

import { buildProblem } from "../problems/laplace2d/problem";
import { evalErrors } from "../problems/laplace2d/exact";
import type { Laplace2dInstance } from "../problems/laplace2d/spec";
import { getWebgpuSolver } from "../solvers/webgpuSolvers";
import { sweepNFor, type SolverManifest } from "../solvers";
import { DEFAULT_TIMING, type TimingPolicy } from "./timing";
import type { RunPoint } from "./runner";

export const GPU_TIMER = "host clock around submit and read-back";

export interface GpuPointRequest {
  instance: Laplace2dInstance;
  solverId: string;
  n: number;
  timing?: TimingPolicy;
  wantGrid?: boolean;
}

export async function runPointGpu(req: GpuPointRequest): Promise<RunPoint> {
  const timing = req.timing ?? DEFAULT_TIMING;
  const wantGrid = req.wantGrid ?? false;
  const solver = await getWebgpuSolver(req.solverId);
  const prob = buildProblem(req.instance, wantGrid);
  const { n } = req;

  const t0 = performance.now();
  let out = await solver.run(prob, n, wantGrid);
  const coldSeconds = (performance.now() - t0) / 1000;
  out = await solver.run(prob, n, wantGrid);

  const times: number[] = [];
  let total = 0;
  while (
    times.length < timing.maxTimedRuns &&
    (times.length < timing.minTimedRuns || total < timing.timeBudgetSeconds)
  ) {
    const t = performance.now();
    out = await solver.run(prob, n, wantGrid);
    const dt = (performance.now() - t) / 1000;
    times.push(dt);
    total += dt;
  }

  const { relMax, relL2 } = evalErrors(req.instance, out.uEval);
  return {
    n,
    solveSeconds: Math.min(...times),
    solveSecondsAll: times,
    coldSeconds,
    relMax,
    relL2,
    uEval: out.uEval,
    uGrid: out.uGrid,
  };
}

export interface GpuSweepOptions {
  instance: Laplace2dInstance;
  solver: SolverManifest;
  timing?: TimingPolicy;
  maxN?: number;
  onPoint?: (point: RunPoint, index: number, total: number) => void;
}

export async function runSweepGpu(opts: GpuSweepOptions): Promise<RunPoint[]> {
  const ns = sweepNFor(opts.solver, opts.instance.id).filter(
    (n) => opts.maxN === undefined || n <= opts.maxN
  );
  const points: RunPoint[] = [];
  for (const [i, n] of ns.entries()) {
    const p = await runPointGpu({
      instance: opts.instance,
      solverId: opts.solver.id,
      n,
      timing: opts.timing,
    });
    points.push(p);
    opts.onPoint?.(p, i, ns.length);
  }
  return points;
}
