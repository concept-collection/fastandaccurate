// What the shipped solvers must achieve, shared by both test suites
// (test/solver-test.ts through numbl, test/matlab-test.ts in real
// MATLAB). Keyed by the solver's source directory rather than its id, so
// that manifest entries sharing one solver.m — mfs and mfs-mat, and
// likewise nystrom-dlp — are held to the same expectation whichever
// runtime executes them.

/** Best relMax the solver must reach somewhere in its full sweep. */
export const MUST_REACH: Record<string, Record<string, number>> = {
  // On flower-15 the MFS charge curve, a fixed 0.3 outside a boundary
  // whose curvature radius is 0.014, self-intersects and puts charges
  // inside the domain; the floor is only a sanity check that the solver
  // still returns something, and MUST_NOT_REACH below is the real test.
  mfs: {
    "disk-easy": 1e-12,
    "star-medium": 1e-12,
    "star-hard": 1e-4,
    "flower-15": 1e-2,
    // Convex geometry and charges far from every target: MFS is the best
    // method on the corner instance, so this floor is a real requirement.
    "square-corners": 1e-11,
    // Charges 0.3 out and targets 0.005 in: the charge curve overshoots
    // the sources, as on star-hard, and the near-boundary targets cost
    // nothing extra because the representation is smooth up to it.
    "star-nearfield": 1e-4,
  },
  // WebGPU has no f64, and the MFS is conditioning-limited, so these
  // floors are six to nine orders looser than the same method's on the CPU.
  // That is the finding, not a defect; MUST_NOT_REACH below holds it in
  // place.
  "mfs-gpu": {
    "disk-easy": 1e-6,
    "star-medium": 1e-6,
    "star-hard": 1e-2,
    "flower-15": 1e-2,
    "square-corners": 1e-5,
    "star-nearfield": 1e-2,
  },
  "nystrom-dlp": {
    "disk-easy": 1e-10,
    "star-medium": 1e-10,
    "star-hard": 1e-8,
    "flower-15": 1e-6,
    // Loose because the numbl sweep stops at 1536 nodes, where the target
    // 0.005 inside a corner is still at 1e-3; the MATLAB twin, whose list
    // runs to 4096, gets to 7e-9 and passes the same floor.
    "square-corners": 1e-2,
    // Looser still: uncorrected quadrature at a target 0.005 from a
    // boundary resolved at h = 0.0059 (1536 nodes) is worth about 1e-2,
    // and the MATLAB twin at 4096 only reaches 7e-6.
    "star-nearfield": 5e-2,
  },
  // chunkie's default quadrature tolerances cap it near 1e-11, and its
  // sweep is checked on the extreme instances only.
  "chunkie-dlp": {
    "disk-easy": 1e-10,
    "star-hard": 1e-9,
    "flower-15": 1e-9,
    "square-corners": 1e-8,
    // The instance chunkie exists to win: its corrected near-field
    // quadrature has to hold the same accuracy at a target 0.005 from the
    // boundary that it reaches in the bulk.
    "star-nearfield": 1e-9,
  },
};

/** Accuracy the solver must NOT reach. MFS is required to do badly on
 * both hard instances, for the two different reasons they exist: on
 * star-hard its charge curve lies beyond the data's singularities, and on
 * flower-15 the fixed offset self-intersects and puts charges inside the
 * domain. If either suddenly reached high accuracy, the instance would no
 * longer be testing what the spec says it tests. */
export const MUST_NOT_REACH: Record<string, Record<string, number>> = {
  mfs: { "star-hard": 1e-8, "flower-15": 1e-8 },
  // star-nearfield exists to measure near-field evaluation, and the plain
  // trapezoid rule has none: if this solver ever reached high accuracy at
  // a target 0.005 inside the boundary, either it acquired a near-field
  // correction or the instance stopped placing its targets there.
  "nystrom-dlp": { "star-nearfield": 1e-8 },
  // Single precision is what caps mfs-gpu on the two instances where the
  // method itself would otherwise reach 1e-13. If it ever got past this,
  // it stopped computing in f32 and the pair with mfs stopped measuring
  // what it claims to measure.
  "mfs-gpu": { "disk-easy": 1e-9, "star-medium": 1e-9 },
};
