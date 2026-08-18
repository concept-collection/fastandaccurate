// Problem: laplace-dirichlet-2d.
// The canonical statement lives in docs/problems/laplace-dirichlet-2d.md.
// This module defines the official instances and the canonical spec object
// that identifies a (problem, instance) pair in results and, later, in
// cache keys.

export const PROBLEM_ID = "laplace-dirichlet-2d";
export const PROBLEM_VERSION = 1;

export interface Laplace2dInstance {
  /** Short stable identifier used in results and URLs. */
  id: string;
  label: string;
  /** Which boundary family the instance draws from. "star", the default,
   * is r(t) = 1 + a cos(k t). "rounded-square" is the superellipse
   * |x|^p + |y|^p = 1, four nearly straight sides meeting at four rounded
   * corners whose radius falls off like 1.4/p; it is analytic for even p,
   * so the interface a solver sees is unchanged. */
  shape?: "star" | "rounded-square";
  /** Boundary r(t) = 1 + a cos(k t) for the star family; both are 0 and
   * unused for rounded-square. */
  a: number;
  k: number;
  /** Corner sharpness of the rounded-square family (an even integer). */
  p?: number;
  /** Distance of the exact solution's sources beyond the boundary. */
  d: number;
  /** Whether the instance carries the near-boundary target set in addition
   * to the standard evaluation points: points a few thousandths inside the
   * boundary along the inward normal, where a quadrature rule with no
   * near-field correction loses its accuracy. */
  nearBoundary?: boolean;
  description: string;
}

/** Whether the instance has corners, and so carries near-corner
 * evaluation points in addition to the standard set. */
export function hasCorners(inst: Laplace2dInstance): boolean {
  return inst.shape === "rounded-square";
}

/** Whether the instance carries the near-boundary target set. */
export function hasNearBoundary(inst: Laplace2dInstance): boolean {
  return inst.nearBoundary === true;
}

export const INSTANCES: Laplace2dInstance[] = [
  {
    id: "disk-easy",
    label: "Disk, distant sources",
    a: 0,
    k: 0,
    d: 0.5,
    description:
      "The unit disk with sources half a radius beyond the boundary. " +
      "Every reasonable method should reach high accuracy quickly.",
  },
  {
    id: "star-medium",
    label: "3-lobe star, moderate sources",
    a: 0.2,
    k: 3,
    d: 0.4,
    description:
      "A gently star-shaped domain; the data continues comfortably past " +
      "the boundary, so geometric convergence is attainable but the " +
      "geometry is no longer trivial.",
  },
  {
    id: "star-hard",
    label: "5-lobe star, close sources",
    a: 0.3,
    k: 5,
    d: 0.08,
    description:
      "A wavier domain with sources only 0.08 beyond the boundary. The " +
      "data barely continues past the boundary, which defeats methods " +
      "whose representation assumes it does.",
  },
  {
    id: "flower-15",
    label: "15-lobe flower, complex geometry",
    a: 0.2,
    k: 15,
    d: 0.25,
    description:
      "Fifteen lobes, with boundary curvature up to 69 (radius 0.014) " +
      "against 13.9 on star-hard. Here the sources sit a full 0.25 from " +
      "the boundary, so the data continues comfortably and the difficulty " +
      "is the geometry alone: a method must resolve a boundary whose " +
      "features are twenty times smaller than the domain, and the " +
      "evaluation points, at a fixed fraction of the local radius, fall " +
      "within 0.03 of it because the boundary runs nearly radially along " +
      "the flanks of the lobes.",
  },
  {
    id: "square-corners",
    label: "Rounded square, targets in the corners",
    shape: "rounded-square",
    p: 100,
    a: 0,
    k: 0,
    d: 0.25,
    description:
      "A square with corners rounded to a radius of 0.014, one percent of " +
      "its side, and sides that are straight to within a thousandth. " +
      "Unlike the star instances, the difficulty is local: four small " +
      "patches of the boundary need everything the discretization has, and " +
      "the rest needs almost nothing. This instance also carries sixteen " +
      "extra evaluation points, four at each corner, at 0.005, 0.01, 0.02 " +
      "and 0.05 inside along the diagonal. The closest sits well within " +
      "the corner's own radius, which is where a quadrature rule with no " +
      "near-field correction gives up: the reported error on this instance " +
      "is normally attained at those points rather than in the bulk.",
  },
  {
    id: "star-nearfield",
    label: "5-lobe star, targets against the boundary",
    a: 0.3,
    k: 5,
    d: 0.08,
    nearBoundary: true,
    description:
      "The domain and the data of star-hard, asked a different question. " +
      "Besides the standard evaluation points it carries 32 targets 0.005 " +
      "to 0.05 inside the boundary, along the inward normal at eight " +
      "places around the curve. The closest of them is about half a node " +
      "spacing from the boundary at the resolutions these sweeps reach, " +
      "and that is where a quadrature rule with no near-field correction " +
      "stops converging: the error of the plain periodic trapezoid rule " +
      "at a target a distance delta inside behaves like " +
      "exp(-2 pi delta / h) in the node spacing h, so it can hold in the " +
      "bulk long after it has failed here. Because the geometry and the " +
      "sources are exactly those of star-hard, the difference between the " +
      "two instances measures one thing only: whether a method can " +
      "evaluate its own representation close to the boundary.",
  },
];

/** The instance a visitor sees first: the one that separates the methods
 * most sharply. */
export const DEFAULT_INSTANCE = "star-hard";

export function getInstance(id: string): Laplace2dInstance {
  const inst = INSTANCES.find((i) => i.id === id);
  if (!inst) throw new Error(`Unknown instance: ${id}`);
  return inst;
}

/**
 * The canonical spec object for an instance. Serialized with sorted keys,
 * this string identifies the instance exactly (results carry it, and a
 * future artifact cache hashes it).
 */
export function canonicalSpec(inst: Laplace2dInstance) {
  const base = {
    a: inst.a,
    d: inst.d,
    instance: inst.id,
    k: inst.k,
    problem: PROBLEM_ID,
    problemVersion: PROBLEM_VERSION,
  };
  // The shape keys appear only for instances that are not from the star
  // family, and nearBoundary only where it is set, so that the spec
  // strings and hashes of the instances that existed before each of those
  // fields are exactly what they were.
  const shaped =
    !inst.shape || inst.shape === "star"
      ? base
      : { ...base, p: inst.p, shape: inst.shape };
  if (!inst.nearBoundary) return shaped;
  return { ...shaped, nearBoundary: true };
}

export function canonicalSpecJson(inst: Laplace2dInstance): string {
  const spec = canonicalSpec(inst);
  const keys = Object.keys(spec).sort();
  return JSON.stringify(spec, keys);
}
