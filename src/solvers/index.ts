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
      "data continues harmonically past the charge curve; stagnates when " +
      "it does not (the star-hard instance). Ill-conditioning caps the " +
      "attainable accuracy near 1e-10 in exchange for very small n.",
    version: "1.0.0",
    backend: "cpu",
    sweepN: [8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256],
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
      "near-corrected evaluation of the potential. chunkie's default " +
      "quadrature tolerances cap the attainable accuracy near 1e-11, and " +
      "the timings include the cost of running a general-purpose library " +
      "through numbl. The package is fetched by mip on first use, so the " +
      "first run in a session spends tens of seconds downloading it; " +
      "later runs do not.",
    version: "1.0.0",
    backend: "cpu",
    sweepN: [2, 3, 4, 6, 8, 12, 16, 24, 32, 48],
  },
];

export function getSolver(id: string): SolverManifest {
  const s = SOLVERS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown solver: ${id}`);
  return s;
}
