// The solvers shipped with the site. Each solver is a MATLAB function
// file (solver.m) implementing the interface documented in
// docs/problems/laplace-dirichlet-2d.md. A submitted solver adds a
// directory here plus a manifest entry.
//
// Two manifest entries may share one solver.m: the "-mat" entries are the
// same file as their numbl twin, run in real MATLAB instead, which makes
// the pair of curves a measurement of the runtime rather than of the
// method. Such an entry sets sourceDir to the twin's directory.

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
  /** Resolutions for instances that need a different range from sweepN,
   * keyed by instance id. A harder geometry can need several times the
   * resolution, and putting those values in every sweep would only make
   * the easy instances slow. */
  sweepNByInstance?: Record<string, number[]>;
  /** Directory under src/solvers/ holding this solver's solver.m, when it
   * is not the solver's own id: set by entries that share a file with
   * another entry. Both entries must then carry the same version. */
  sourceDir?: string;
}

/** Directory under src/solvers/ holding a solver's solver.m. */
export function solverSourceDir(s: SolverManifest): string {
  return s.sourceDir ?? s.id;
}

/** The resolutions a sweep of this solver runs on this instance. */
export function sweepNFor(s: SolverManifest, instanceId: string): number[] {
  return s.sweepNByInstance?.[instanceId] ?? s.sweepN;
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
      "error settles near 1e-6 however far the sweep is pushed. On " +
      "flower-15 the method fails outright, and for a reason worth stating: " +
      "a fixed offset of 0.3 from a boundary whose curvature radius is " +
      "0.014 is not a curve at all. The offset self-intersects and leaves " +
      "some 45 percent of the charges inside the domain, where they " +
      "destroy the harmonicity of the representation. A better MFS would " +
      "choose the offset from the local geometry rather than fixing it in " +
      "advance; this one does not, and the instance shows what that costs. " +
      "On square-corners it is instead the strongest method by a wide " +
      "margin, reaching 2e-13. Two things go its way there: the domain is " +
      "convex, so the offset charge curve is simple again, and the charges " +
      "stay 0.3 away from every evaluation point, so the near-corner " +
      "targets that defeat the integral-equation methods cost it nothing. " +
      "Its error at the target 0.005 inside a corner is the same 1e-13 as " +
      "in the bulk. On star-nearfield, whose targets come within 0.005 of " +
      "the boundary, it likewise pays nothing for them: charges 0.3 " +
      "outside the domain make the representation smooth all the way in, " +
      "so the error there is the conditioning-limited few times 1e-6 it " +
      "already reaches on star-hard (1.7e-6 in real MATLAB, 3.9e-6 in " +
      "numbl, the two differing because the error is set by rounding in a " +
      "badly conditioned solve). That makes it the cheapest route to 1e-6 " +
      "of the three solvers on that instance, and the one with nothing " +
      "left beyond it.",
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
      "instance costs more nodes rather than a lost method assumption. On " +
      "flower-15 that price is about four times the nodes: a few hundred " +
      "to resolve fifteen lobes at all, and more still because the plain " +
      "quadrature is inaccurate for the evaluation points nearest the " +
      "boundary until the node spacing falls well below their distance to " +
      "it (0.0295 at the closest). Past that the geometric convergence " +
      "returns, and it is fast: on that instance the error falls from " +
      "5e-4 at n = 768 to 2e-7 at n = 1536. square-corners exposes the " +
      "method's real weakness instead, which is evaluation rather than " +
      "solution. At n = 768 the bulk error there is 7e-9, already " +
      "converged, while the error at the target 0.005 inside a corner is " +
      "4.6e-2: uncorrected quadrature for a target a fraction of a node " +
      "spacing from the boundary loses everything, and the reported error " +
      "follows exp(-2 pi delta / h) across the four target distances. " +
      "Reaching 1e-8 at those targets takes about 4000 nodes, where the " +
      "bulk alone would need 500. star-nearfield makes the same point " +
      "without the geometry, being the domain and data of star-hard with " +
      "32 targets 0.005 to 0.05 inside the boundary, and there the " +
      "exp(-2 pi delta / h) law is legible straight down the ladder: at " +
      "1024 nodes one and the same density is accurate to 7.5e-14 in the " +
      "bulk, 6e-14 at the target 0.05 in, 6.6e-6 at 0.02, 2.7e-3 at 0.01 " +
      "and 6.3e-2 at 0.005. The browser sweep, stopping at 1536 nodes, " +
      "reaches 1.2e-2; the MATLAB twin needs 4096 nodes and 0.86 s for " +
      "6.7e-6. We emphasize that this is a property of the uncorrected " +
      "quadrature rule and not of Nystrom methods: a near-field " +
      "correction, whether by kernel splitting or by a locally corrected " +
      "or expansion-based rule, removes it, and chunkie-dlp, which is the " +
      "same integral equation with one, reaches 1.8e-11 there.",
    version: "1.0.0",
    backend: "cpu",
    runtime: "numbl",
    sweepN: [16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768],
    // flower-15 needs roughly four times the nodes: the boundary itself
    // costs about 200 to resolve, and the evaluation points sit close
    // enough to it that the plain quadrature stays inaccurate until the
    // node spacing is well under that distance.
    sweepNByInstance: {
      "flower-15": [32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536],
      // The corner targets need a node spacing well below 0.005, which is
      // thousands of nodes. This list stops at 1536 because a numbl solve
      // at 2048 takes about five seconds, and a browser sweep has to stay
      // usable; nystrom-dlp-mat carries the tail.
      "square-corners": [64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536],
      // Same story as square-corners, for the same reason: the closest
      // near-boundary target is 0.005 inside, and the coarse end of the
      // standard list is off the chart (relMax above 1 at n = 16).
      "star-nearfield": [64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536],
    },
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
      "only: the command line invokes matlab -batch and installs chunkie " +
      "with the mip package manager on first use, so its results appear " +
      "here but cannot be rerun in the browser. chunkie's default " +
      "quadrature tolerances cap the attainable accuracy near 1e-11. Its " +
      "corrected quadrature buys a great deal of accuracy per node: on " +
      "flower-15 it is some 250 times more accurate than nystrom-dlp at " +
      "the same number of boundary points. Note, however, that this does " +
      "not make it the faster route to a given accuracy here. Each solve " +
      "costs roughly eight times as much per point (adaptive singular " +
      "quadrature in the assembly, near-corrections in the evaluation), " +
      "and against that the trapezoid rule's geometric convergence wins: " +
      "on flower-15 in the same MATLAB, nystrom-dlp-mat reaches 1e-9 in " +
      "0.2 s where chunkie needs 0.3 s, and goes on to 1e-14, which " +
      "chunkie's tolerances do not permit. The generality chunkie pays " +
      "for (corners, adaptive panels, fast algorithms) is barely " +
      "exercised by the star instances. The fast algorithms in particular " +
      "never get their chance. The solver runs with chunkie's defaults, " +
      "so the fmm2d library that mip installs alongside it accelerates " +
      "the evaluation, but with some 300 evaluation points there is " +
      "little there to accelerate: it is worth 1.2 times at the top of " +
      "the flower-15 sweep and nothing below. The two routes that would " +
      "replace the dense assembly and factorization, a chunkerflam fast " +
      "direct solve or GMRES on an FMM matvec, both break even only past " +
      "about 4000 boundary points, which on this problem is beyond where " +
      "the error has already stopped improving. square-corners exercises " +
      "part of it, and is one of the two instances where chunkie leads " +
      "the other integral-equation solver: its corrected evaluation " +
      "handles the " +
      "targets inside the corners, so what limits it is resolving a " +
      "corner of radius 0.014 with uniform panels rather than the " +
      "proximity of the targets. It reaches 2e-8 in 0.6 s where " +
      "nystrom-dlp-mat needs 0.85 s for 7e-9 and 0.23 s to manage only " +
      "1e-4. Note that both are beaten there by mfs, whose singularities " +
      "lie outside the domain and which therefore has no near-field problem " +
      "at all. The other instance, and the clearest case for the toolbox, " +
      "is star-nearfield. Its domain and data are star-hard's, so the " +
      "equation is identical and only the targets move, to within 0.005 " +
      "of the boundary; what is measured is the corrected near-field " +
      "evaluation by itself. chunkie loses nothing there: 1.8e-11 at 64 " +
      "panels in 0.09 s, against 2.3e-11 at 48 panels in 0.05 s on " +
      "star-hard, so the near targets cost it a third more panels and " +
      "roughly twice the time, and no accuracy. nystrom-dlp-mat, the same " +
      "integral equation with an uncorrected evaluation, gives 1.5e-10 on " +
      "star-hard in 0.017 s and 1.5e-1 here at those same 768 nodes, and " +
      "needs 4096 nodes and 0.86 s to bring the closest target to 6.7e-6: " +
      "nine times chunkie's time for five orders less accuracy. mfs-mat, " +
      "which as on square-corners has no near field to correct, is " +
      "stopped instead by its own conditioning at 1.7e-6, and is the " +
      "cheapest route to that accuracy (0.017 s against chunkie's " +
      "0.042 s for 2.4e-6). Past 1e-6, though, chunkie is the only one of " +
      "the three that goes anywhere at all.",
    version: "3.0.0",
    backend: "cpu",
    runtime: "matlab",
    sweepN: [2, 3, 4, 6, 8, 12, 16, 24, 32, 48],
    // Two panels cannot see a 15-lobe boundary at all, and the sweep has
    // to run out to 192 panels before the quadrature tolerance caps it.
    sweepNByInstance: {
      "flower-15": [8, 12, 16, 24, 32, 48, 64, 96, 128, 192],
      // Uniform panels have to get down to the corner radius of 0.014.
      "square-corners": [8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256],
      // Two panels past the standard list: on star-hard the quadrature
      // tolerance caps the error by n = 48, and the near-boundary targets
      // of star-nearfield take a little more resolution to reach the same
      // cap.
      "star-nearfield": [2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96],
    },
  },
  {
    id: "mfs-mat",
    name: "Method of fundamental solutions (MATLAB)",
    description:
      "The mfs solver file, unchanged, executed by real MATLAB instead of " +
      "numbl. The method, the resolution sweep, and the source file are the " +
      "same, so the pair of curves measures the runtime rather than the " +
      "discretization. Where the method converges, the two agree to the " +
      "digits reported; in the conditioning-limited regime of star-hard " +
      "and star-nearfield they do not, since there the error is set by " +
      "rounding in a badly " +
      "conditioned solve and the two linear-algebra libraries round " +
      "differently. Runs from the command line only, which invokes " +
      "matlab -batch.",
    version: "1.0.0",
    backend: "cpu",
    runtime: "matlab",
    sweepN: [8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768],
    sourceDir: "mfs",
  },
  {
    id: "nystrom-dlp-mat",
    name: "Nystrom double-layer BIE (MATLAB)",
    description:
      "The nystrom-dlp solver file, unchanged, executed by real MATLAB " +
      "instead of numbl, with the same resolution sweep except on " +
      "square-corners and star-nearfield, where being some fifteen times " +
      "faster lets it follow the near-field targets out to 4096 nodes, " +
      "past where a browser sweep would stay usable. Unlike " +
      "chunkie-dlp, which is a different discretization of the same " +
      "integral equation, nothing here changes the numerics: the systems " +
      "are well conditioned on every instance and the reported errors " +
      "reproduce those of nystrom-dlp, so what remains between the two " +
      "curves is the cost of the runtime. Runs from the command line only, " +
      "which invokes matlab -batch.",
    version: "1.0.0",
    backend: "cpu",
    runtime: "matlab",
    sweepN: [16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768],
    sweepNByInstance: {
      "flower-15": [32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536],
      // Real MATLAB is fast enough to follow the corner targets all the
      // way down, which the numbl twin's list stops short of.
      "square-corners": [
        64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096,
      ],
      "star-nearfield": [
        64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096,
      ],
    },
    sourceDir: "nystrom-dlp",
  },
];

export function getSolver(id: string): SolverManifest {
  const s = SOLVERS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown solver: ${id}`);
  return s;
}
