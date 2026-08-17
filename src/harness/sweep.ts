// A work-precision sweep: run one solver across its resolution list on
// one instance, reporting each point as it lands.

import { runPoint, type MatlabSources, type RunPoint } from "./runner";
import type { Laplace2dInstance } from "../problems/laplace2d/spec";
import type { SolverManifest } from "../solvers";

export interface SweepOptions {
  instance: Laplace2dInstance;
  solver: SolverManifest;
  sources: MatlabSources;
  repeats?: number;
  /** Restrict the sweep to n values <= this (for quick runs). */
  maxN?: number;
  onPoint?: (point: RunPoint, index: number, total: number) => void;
}

export function runSweep(opts: SweepOptions): RunPoint[] {
  const ns = opts.solver.sweepN.filter(
    (n) => opts.maxN === undefined || n <= opts.maxN
  );
  const points: RunPoint[] = [];
  ns.forEach((n, i) => {
    const p = runPoint({
      instance: opts.instance,
      n,
      repeats: opts.repeats ?? 5,
      sources: opts.sources,
    });
    points.push(p);
    opts.onPoint?.(p, i, ns.length);
  });
  return points;
}
