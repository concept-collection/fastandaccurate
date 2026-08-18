// The problem as a TypeScript object, for solvers that do not run through
// numbl. It carries exactly what build_problem.m hands a MATLAB solver —
// the curve with its derivatives, the Dirichlet data as a function of the
// boundary parameter, and the points where values are required — as plain
// functions and arrays. The specification
// (docs/problems/laplace-dirichlet-2d.md) states the interface once and
// this is its second form; a solver written against it, like the WebGPU
// MFS, sees the same information as a MATLAB one and no more. In
// particular the sources of the exact solution are used here only to
// manufacture g, and are not reachable from the returned object.

import { type Laplace2dInstance } from "./spec";
import {
  boundaryR,
  boundaryRD,
  boundaryRDD,
  evalPoints,
  sources,
  vizGrid,
  VIZ_NGRID,
} from "./exact";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Laplace2dProblem {
  /** Boundary point at parameter t. */
  curve(t: number): Vec2;
  /** First derivative of the curve with respect to t. */
  curveD(t: number): Vec2;
  /** Second derivative. */
  curveDD(t: number): Vec2;
  /** Dirichlet data at boundary parameter t. */
  g(t: number): number;
  /** The evaluation points: nEval rows of (x, y), interleaved. */
  evalXY: Float64Array;
  nEval: number;
  /** The visualization grid points, interleaved, empty when not wanted. */
  vizXY: Float64Array;
  nViz: number;
}

/** Point and derivatives of x(t) = r(t) (cos t, sin t). */
function curveAt(inst: Laplace2dInstance, t: number, order: 0 | 1 | 2): Vec2 {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const r = boundaryR(inst, t);
  if (order === 0) return { x: r * c, y: r * s };
  const r1 = boundaryRD(inst, t);
  if (order === 1) return { x: r1 * c - r * s, y: r1 * s + r * c };
  const r2 = boundaryRDD(inst, t);
  return {
    x: r2 * c - 2 * r1 * s - r * c,
    y: r2 * s + 2 * r1 * c - r * s,
  };
}

export function buildProblem(
  inst: Laplace2dInstance,
  wantGrid = false
): Laplace2dProblem {
  // The three sources exist only to manufacture g, exactly as in
  // build_problem.m, and stay in this closure.
  const src = sources(inst);
  const pts = evalPoints(inst);
  const evalXY = new Float64Array(2 * pts.length);
  pts.forEach((p, i) => {
    evalXY[2 * i] = p.x;
    evalXY[2 * i + 1] = p.y;
  });

  let vizXY = new Float64Array(0);
  if (wantGrid) {
    const { xs } = vizGrid(inst);
    vizXY = new Float64Array(2 * VIZ_NGRID * VIZ_NGRID);
    // Flat index p = ix * ngrid + iy, y varying fastest, matching
    // build_problem.m's meshgrid column order.
    let k = 0;
    for (let ix = 0; ix < VIZ_NGRID; ix++) {
      for (let iy = 0; iy < VIZ_NGRID; iy++) {
        vizXY[k++] = xs[ix];
        vizXY[k++] = xs[iy];
      }
    }
  }

  return {
    curve: (t) => curveAt(inst, t, 0),
    curveD: (t) => curveAt(inst, t, 1),
    curveDD: (t) => curveAt(inst, t, 2),
    g: (t) => {
      const p = curveAt(inst, t, 0);
      let u = 0;
      for (const s of src) {
        u += s.c * 0.5 * Math.log((p.x - s.x) ** 2 + (p.y - s.y) ** 2);
      }
      return u;
    },
    evalXY,
    nEval: pts.length,
    vizXY,
    nViz: vizXY.length / 2,
  };
}
