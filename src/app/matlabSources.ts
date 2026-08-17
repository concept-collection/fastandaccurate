// The MATLAB sources, inlined into the bundle by vite. Used by the worker
// (and only there; the node CLI reads the same files from disk).

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

export function solverSource(solverId: string): string {
  return get(`../solvers/${solverId}/solver.m`);
}
