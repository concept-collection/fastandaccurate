// The MATLAB sources, inlined into the bundle by vite. Used by the worker
// and by the problem page's source listing; the node CLI reads the same
// files from disk.

import { getSolver, solverSourceDir } from "../solvers";

const files = import.meta.glob("../{problems,solvers}/**/*.m", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function get(path: string): string {
  const src = files[path];
  if (!src) throw new Error(`missing MATLAB source: ${path}`);
  return src;
}

export function matlabBase() {
  return {
    buildProblem: get("../problems/laplace2d/matlab/build_problem.m"),
    bdata: get("../problems/laplace2d/matlab/laplace2d_bdata.m"),
  };
}

/** The solver.m of a registry solver, resolved through its manifest so
 * that entries sharing a file (mfs and mfs-mat) read the one source. */
export function solverSource(solverId: string): string {
  return get(`../solvers/${solverSourceDir(getSolver(solverId))}/solver.m`);
}
