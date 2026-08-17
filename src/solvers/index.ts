// The in-browser solvers shipped with the site. Each solver is a MATLAB
// function file (solver.m) implementing the interface documented in
// docs/problems/laplace-dirichlet-2d.md. A submitted solver adds a
// directory here plus a manifest entry.

export interface SolverManifest {
  /** Short stable identifier used in results and URLs. */
  id: string;
  name: string;
  /** One-paragraph description of the method for the problem page. */
  description: string;
  /** Semantic version of the solver code; bump on any change that could
   * alter results. */
  version: string;
  backend: "cpu" | "gpu";
  /** What executes the solver: "numbl" solvers run in the browser and in
   * the CLI; "matlab" solvers run only in real MATLAB via the CLI. */
  runtime: "numbl" | "matlab";
  /** The resolution values a standard work-precision sweep runs. */
  sweepN: number[];
}

export const SOLVERS: SolverManifest[] = [
  {
    id: "mfs",
    name: "Method of fundamental solutions",
    description:
      "Represents the solution as n logarithmic point charges on a curve " +
      "a fixed distance 0.3 outside the boundary, with strengths found by " +
      "collocation at n boundary points. Converges geometrically when the " +
      "data continues harmonically past the charge curve, reaching machine " +
      "precision on the easier instances with far less work than the " +
      "integral-equation methods. When the data's singularities sit inside " +
      "that curve, as on star-hard, convergence is lost: more charges keep " +
      "helping only until the system's ill-conditioning takes over, and the " +
      "error settles near 1e-6 however far the sweep is pushed.",
    version: "1.0.0",
    backend: "cpu",
    runtime: "numbl",
    sweepN: [8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768],
  },
  {
    id: "nystrom-dlp",
    name: "Nystrom double-layer BIE",
    description:
      "Second-kind boundary integral equation for the double-layer " +
      "density, discretized with the periodic trapezoid rule at n " +
      "boundary nodes. Converges geometrically for any smooth data, at a " +
      "rate set by how far the data continues analytically, so the hard " +
      "instance costs more nodes rather than a lost method assumption.",
    version: "1.0.0",
    backend: "cpu",
    runtime: "numbl",
    sweepN: [16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768],
  },
  {
    id: "chunkie-dlp",
    name: "chunkie double-layer BIE",
    description:
      "The same second-kind double-layer formulation as nystrom-dlp, " +
      "discretized by chunkie, a production MATLAB boundary-integral " +
      "toolbox: n uniform 16th-order Gauss-Legendre panels, high-order " +
      "singular quadrature in the assembly, a direct dense solve, and " +
      "near-corrected evaluation of the potential. Runs in real MATLAB " +
      "only: the command line invokes matlab -batch and fetches chunkie " +
      "on first use, so its results appear here but cannot be rerun in " +
      "the browser. chunkie's default quadrature tolerances cap the " +
      "attainable accuracy near 1e-11.",
    version: "2.0.0",
    backend: "cpu",
    runtime: "matlab",
    sweepN: [2, 3, 4, 6, 8, 12, 16, 24, 32, 48],
  },
];

export function getSolver(id: string): SolverManifest {
  const s = SOLVERS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown solver: ${id}`);
  return s;
}
