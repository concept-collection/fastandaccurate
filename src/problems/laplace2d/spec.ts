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
  /** Boundary r(t) = 1 + a cos(k t). */
  a: number;
  k: number;
  /** Distance of the exact solution's sources beyond the boundary. */
  d: number;
  description: string;
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
