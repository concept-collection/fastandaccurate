// The solver and problem sources, inlined into the bundle by vite. Used by
// the worker (which needs the MATLAB text to run a numbl solver) and by the
// problem page's source listing, which also shows the TypeScript and WGSL
// of a WebGPU solver. The node CLI reads the same files from disk.

import { getSolver, solverFiles, solverSourceDir } from "../solvers";

const files = {
  ...(import.meta.glob("../{problems,solvers}/**/*.m", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>),
  // Only a WebGPU solver's own directory, not the registry modules that sit
  // one level up.
  ...(import.meta.glob("../solvers/*/*.ts", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>),
};

function get(path: string): string {
  const src = files[path];
  if (!src) throw new Error(`missing solver source: ${path}`);
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

/** Every source file of a solver, named, for the page's listing. */
export function solverSourceFiles(
  solverId: string
): { name: string; code: string }[] {
  return solverFiles(getSolver(solverId)).map((f) => ({
    name: f.split("/").pop() as string,
    code: get(`../solvers/${f}`),
  }));
}
