// Exact solution, geometry, and sampling rules for laplace-dirichlet-2d,
// implemented independently of the MATLAB side (build_problem.m). The two
// implementations of these simple formulas check each other: a solver can
// only reach high accuracy if both agree.

import { hasCorners, hasNearBoundary, type Laplace2dInstance } from "./spec";

export interface Source {
  x: number;
  y: number;
  c: number;
}

/** Boundary radius: r(t) = 1 + a cos(k t) for the star family, and
 * r(t) = (cos^p t + sin^p t)^(-1/p) for the rounded square, which traces
 * the superellipse |x|^p + |y|^p = 1. Written through a logarithm because
 * cos^p t underflows for p in the hundreds. */
export function boundaryR(inst: Laplace2dInstance, t: number): number {
  if (inst.shape === "rounded-square") {
    const p = inst.p as number;
    return Math.exp(-Math.log(Math.cos(t) ** p + Math.sin(t) ** p) / p);
  }
  return 1 + inst.a * Math.cos(inst.k * t);
}

/** dr/dt of the boundary radius. Only the ratio f'/f enters, which keeps
 * the rounded-square case away from the underflow in f itself. */
export function boundaryRD(inst: Laplace2dInstance, t: number): number {
  if (inst.shape === "rounded-square") {
    const p = inst.p as number;
    const c = Math.cos(t);
    const sn = Math.sin(t);
    const f = c ** p + sn ** p;
    const fp = p * (sn ** (p - 1) * c - c ** (p - 1) * sn);
    return (-boundaryR(inst, t) / p) * (fp / f);
  }
  return -inst.a * inst.k * Math.sin(inst.k * t);
}

/** The largest radius the boundary reaches, which sets the view extent
 * and the visualization grid. */
export function maxRadius(inst: Laplace2dInstance): number {
  if (inst.shape === "rounded-square") return boundaryR(inst, Math.PI / 4);
  return 1 + Math.abs(inst.a);
}

/** Angles of the corners, for instances that have them: the four
 * diagonals of the rounded square. */
export function cornerAngles(inst: Laplace2dInstance): number[] {
  if (!hasCorners(inst)) return [];
  return [0, 1, 2, 3].map((j) => Math.PI / 4 + (j * Math.PI) / 2);
}

/** Distances inside the boundary of the near-field evaluation points. The
 * same four distances serve the near-corner set of an instance with
 * corners and the near-boundary set of an instance that carries one: the
 * smallest is a third of the corner radius at p = 100, and about half a
 * node spacing at the resolutions the sweeps reach. */
export const NEAR_DELTAS = [0.005, 0.01, 0.02, 0.05];

/** Boundary parameters of the near-boundary evaluation points: eight
 * around the curve, offset so that they fall at no special phase of a lobe
 * pattern. Empty on an instance without the set. */
export function nearBoundaryParams(inst: Laplace2dInstance): number[] {
  if (!hasNearBoundary(inst)) return [];
  return Array.from({ length: 8 }, (_, j) => (2 * Math.PI * j) / 8 + 0.07);
}

/** Boundary point at parameter t. */
export function boundaryPoint(inst: Laplace2dInstance, t: number) {
  const r = boundaryR(inst, t);
  return { x: r * Math.cos(t), y: r * Math.sin(t) };
}

/** The point a distance delta inside the boundary along the inward unit
 * normal at parameter t. Since delta stays below the smallest radius of
 * curvature on the instances that use this, the distance from the point to
 * the curve is exactly delta. */
export function inwardPoint(inst: Laplace2dInstance, t: number, delta: number) {
  const r = boundaryR(inst, t);
  const dr = boundaryRD(inst, t);
  const dx = dr * Math.cos(t) - r * Math.sin(t);
  const dy = dr * Math.sin(t) + r * Math.cos(t);
  const sp = Math.hypot(dx, dy);
  // The outward unit normal of the counterclockwise curve is (y', -x')/|x'|.
  return {
    x: r * Math.cos(t) - (delta * dy) / sp,
    y: r * Math.sin(t) + (delta * dx) / sp,
  };
}

/** The three exact-solution sources: boundary points at phi_j pushed a
 * distance d along the outward normal, strengths [1.0, -0.6, 0.8]. */
export function sources(inst: Laplace2dInstance): Source[] {
  const { d } = inst;
  const strengths = [1.0, -0.6, 0.8];
  return strengths.map((c, j) => {
    const phi = (2 * Math.PI * j) / 3 + 0.4;
    const r = boundaryR(inst, phi);
    const dr = boundaryRD(inst, phi);
    const bx = r * Math.cos(phi);
    const by = r * Math.sin(phi);
    const dx = dr * Math.cos(phi) - r * Math.sin(phi);
    const dy = dr * Math.sin(phi) + r * Math.cos(phi);
    const sp = Math.hypot(dx, dy);
    return { x: bx + (d * dy) / sp, y: by - (d * dx) / sp, c };
  });
}

/** Exact solution u(x, y) = sum_j c_j log|x - s_j|. */
export function exactU(inst: Laplace2dInstance, x: number, y: number): number {
  let u = 0;
  for (const s of sources(inst)) {
    u += s.c * 0.5 * Math.log((x - s.x) ** 2 + (y - s.y) ** 2);
  }
  return u;
}

/** The evaluation points: 32 rays, radial fractions 0.1..0.9, plus the
 * origin (289 points); on an instance with corners a further four points
 * per corner just inside the boundary along its diagonal (305 in all); and
 * on an instance carrying the near-boundary set four points per parameter
 * along the inward normal (321 in all). Order matches build_problem.m:
 * radius outer, angle inner, origin last, then the near-corner points with
 * the corner index outer and the distance inner, then the near-boundary
 * points with the parameter outer and the distance inner. */
export function evalPoints(inst: Laplace2dInstance): { x: number; y: number }[] {
  const rho = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const pts: { x: number; y: number }[] = [];
  for (const r of rho) {
    for (let j = 0; j < 32; j++) {
      const th = (2 * Math.PI * j) / 32 + 0.13;
      const rr = r * boundaryR(inst, th);
      pts.push({ x: rr * Math.cos(th), y: rr * Math.sin(th) });
    }
  }
  pts.push({ x: 0, y: 0 });
  for (const th of cornerAngles(inst)) {
    const rc = boundaryR(inst, th);
    for (const delta of NEAR_DELTAS) {
      pts.push({ x: (rc - delta) * Math.cos(th), y: (rc - delta) * Math.sin(th) });
    }
  }
  for (const t of nearBoundaryParams(inst)) {
    for (const delta of NEAR_DELTAS) {
      pts.push(inwardPoint(inst, t, delta));
    }
  }
  return pts;
}

/** Exact solution at the evaluation points. */
export function exactAtEvalPoints(inst: Laplace2dInstance): Float64Array {
  const pts = evalPoints(inst);
  const u = new Float64Array(pts.length);
  pts.forEach((p, i) => (u[i] = exactU(inst, p.x, p.y)));
  return u;
}

/** The visualization grid: ngrid x ngrid points over [-R, R]^2 with
 * R = 1.05 max_t r(t). Flat index p = ix * ngrid + iy with x = xs[ix],
 * y = xs[iy] (y varies fastest), matching build_problem.m's meshgrid
 * column order. */
export const VIZ_NGRID = 200;

export function vizGrid(inst: Laplace2dInstance) {
  const R = 1.05 * maxRadius(inst);
  const xs = new Float64Array(VIZ_NGRID);
  for (let i = 0; i < VIZ_NGRID; i++) {
    xs[i] = -R + (2 * R * i) / (VIZ_NGRID - 1);
  }
  return { R, ngrid: VIZ_NGRID, xs };
}

/** Whether (x, y) is inside the domain (used only for display masking,
 * never for scoring, so float tie-breaks at the boundary are harmless). */
export function insideDomain(inst: Laplace2dInstance, x: number, y: number): boolean {
  const rr = Math.hypot(x, y);
  const th = Math.atan2(y, x);
  return rr < boundaryR(inst, th);
}

/** Relative errors of numeric values against the exact solution at the
 * evaluation points: max and L2, both relative to the exact values. */
export function evalErrors(
  inst: Laplace2dInstance,
  uNum: ArrayLike<number>
): { relMax: number; relL2: number } {
  const uEx = exactAtEvalPoints(inst);
  if (uNum.length !== uEx.length) {
    throw new Error(`expected ${uEx.length} values, got ${uNum.length}`);
  }
  let maxDiff = 0;
  let maxEx = 0;
  let sumDiff2 = 0;
  let sumEx2 = 0;
  for (let i = 0; i < uEx.length; i++) {
    const diff = Math.abs(uNum[i] - uEx[i]);
    maxDiff = Math.max(maxDiff, diff);
    maxEx = Math.max(maxEx, Math.abs(uEx[i]));
    sumDiff2 += diff * diff;
    sumEx2 += uEx[i] * uEx[i];
  }
  return {
    relMax: maxDiff / maxEx,
    relL2: Math.sqrt(sumDiff2 / sumEx2),
  };
}
