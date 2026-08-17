// Problem: laplace-dirichlet-2d.
// The canonical statement lives in docs/problems/laplace-dirichlet-2d.md.
// This module defines the official instances and the canonical spec object
// that identifies a (problem, instance) pair in results and, later, in
// cache keys.

export const PROBLEM_ID = "laplace-dirichlet-2d";
export const PROBLEM_VERSION = 1;

/** The family the exact solution is manufactured from. */
export type DataFamily = "log-sources" | "branch-point";

export interface Laplace2dInstance {
  /** Short stable identifier used in results and URLs. */
  id: string;
  label: string;
  /** Boundary r(t) = 1 + a cos(k t). */
  a: number;
  k: number;
  /** Distance of the exact solution's singularities beyond the boundary. */
  d: number;
  family: DataFamily;
  description: string;
}

export const INSTANCES: Laplace2dInstance[] = [
  {
    id: "disk-easy",
    label: "Disk, distant sources",
    a: 0,
    k: 0,
    d: 0.5,
    family: "log-sources",
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
    family: "log-sources",
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
    family: "log-sources",
    description:
      "A wavier domain with sources only 0.08 beyond the boundary. The " +
      "data barely continues past the boundary, which defeats methods " +
      "whose representation assumes it does.",
  },
  {
    id: "star-branch",
    label: "3-lobe star, branch-point data",
    a: 0.2,
    k: 3,
    d: 0.4,
    family: "branch-point",
    description:
      "Identical geometry and singularity distance to star-medium, but " +
      "the data comes from a branch-point singularity (the real part of " +
      "a complex square root) rather than log point charges, so the pair " +
      "tests whether behavior depends on the data family or only on its " +
      "singularity distance.",
  },
];

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
  return {
    a: inst.a,
    d: inst.d,
    family: inst.family,
    instance: inst.id,
    k: inst.k,
    problem: PROBLEM_ID,
    problemVersion: PROBLEM_VERSION,
  };
}

export function canonicalSpecJson(inst: Laplace2dInstance): string {
  const spec = canonicalSpec(inst);
  const keys = Object.keys(spec).sort();
  return JSON.stringify(spec, keys);
}
