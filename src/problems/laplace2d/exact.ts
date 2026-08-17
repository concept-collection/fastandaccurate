// Exact solution, geometry, and sampling rules for laplace-dirichlet-2d,
// implemented independently of the MATLAB side (build_problem.m). The two
// implementations of these simple formulas check each other: a solver can
// only reach high accuracy if both agree.

import type { Laplace2dInstance } from "./spec";

export interface Source {
  x: number;
  y: number;
  c: number;
}

/** Boundary radius r(t) = 1 + a cos(k t). */
export function boundaryR(inst: Laplace2dInstance, t: number): number {
  return 1 + inst.a * Math.cos(inst.k * t);
}

/** Boundary point at parameter t. */
export function boundaryPoint(inst: Laplace2dInstance, t: number) {
  const r = boundaryR(inst, t);
  return { x: r * Math.cos(t), y: r * Math.sin(t) };
}

/** The three exact-solution sources: boundary points at phi_j pushed a
 * distance d along the outward normal, strengths [1.0, -0.6, 0.8]. */
export function sources(inst: Laplace2dInstance): Source[] {
  const { a, k, d } = inst;
  const strengths = [1.0, -0.6, 0.8];
  return strengths.map((c, j) => {
    const phi = (2 * Math.PI * j) / 3 + 0.4;
    const r = 1 + a * Math.cos(k * phi);
    const dr = -a * k * Math.sin(k * phi);
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

/** The 65 evaluation points: 16 rays, radial fractions
 * [0.25, 0.5, 0.75, 0.9], plus the origin. Order matches
 * build_problem.m: radius outer, angle inner, origin last. */
export function evalPoints(inst: Laplace2dInstance): { x: number; y: number }[] {
  const rho = [0.25, 0.5, 0.75, 0.9];
  const pts: { x: number; y: number }[] = [];
  for (const r of rho) {
    for (let j = 0; j < 16; j++) {
      const th = (2 * Math.PI * j) / 16 + 0.13;
      const rr = r * boundaryR(inst, th);
      pts.push({ x: rr * Math.cos(th), y: rr * Math.sin(th) });
    }
  }
  pts.push({ x: 0, y: 0 });
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
 * R = 1.05 (1 + |a|). Flat index p = ix * ngrid + iy with x = xs[ix],
 * y = xs[iy] (y varies fastest), matching build_problem.m's meshgrid
 * column order. */
export const VIZ_NGRID = 200;

export function vizGrid(inst: Laplace2dInstance) {
  const R = 1.05 * (1 + Math.abs(inst.a));
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
