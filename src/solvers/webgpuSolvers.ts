// The WebGPU solvers, by manifest id.
//
// A solver whose runtime is "webgpu" is not a MATLAB file, so it cannot be
// looked up on disk the way the numbl and MATLAB ones are; it is a module
// in this repository that implements the small interface below against the
// TypeScript form of the problem (src/problems/laplace2d/problem.ts). One
// instance is built per id and kept: the shader compilation and pipeline
// creation it does belong outside the timed runs.

import type { Laplace2dProblem } from "../problems/laplace2d/problem";
import { MfsGpu } from "./mfs-gpu/solver";

export interface WebgpuSolver {
  /** One full solve at resolution n, ending when the device has finished
   * and the values have been read back. */
  run(
    prob: Laplace2dProblem,
    n: number,
    wantGrid: boolean
  ): Promise<{ uEval: Float64Array; uGrid: Float64Array | null }>;
  /** The adapter and how WebGPU was reached, for the result file. */
  readonly adapter: string;
  readonly via: string;
}

const factories: Record<string, () => Promise<WebgpuSolver>> = {
  "mfs-gpu": () => MfsGpu.create(),
};

const built = new Map<string, Promise<WebgpuSolver>>();

export function isWebgpuSolver(id: string): boolean {
  return id in factories;
}

export function getWebgpuSolver(id: string): Promise<WebgpuSolver> {
  const make = factories[id];
  if (!make) throw new Error(`no WebGPU solver named ${id}`);
  let p = built.get(id);
  if (!p) {
    p = make();
    built.set(id, p);
  }
  return p;
}
