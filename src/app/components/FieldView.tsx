// Renders a scalar field on the visualization grid as a masked heatmap
// with a colorbar. Two modes: "diverging" for signed fields (the solution)
// and "logmag" for magnitudes on a log scale (the error).

import { useEffect, useRef } from "react";
import type { Laplace2dInstance } from "../../problems/laplace2d/spec";
import { insideDomain, vizGrid, VIZ_NGRID } from "../../problems/laplace2d/exact";
import { cssColor, divergingColor, isDarkMode, sequentialColor } from "../colors";

export interface FieldViewProps {
  inst: Laplace2dInstance;
  /** Values on the viz grid, index p = ix * ngrid + iy. */
  values: Float64Array;
  mode: "diverging" | "logmag";
  title: string;
  caption?: string;
  /** Fixed color-scale range; when absent, the range comes from the data.
   * For diverging mode this should be symmetric about zero. */
  range?: { lo: number; hi: number };
  /** Points drawn on top of the field (e.g. the evaluation points). */
  overlayPoints?: { x: number; y: number }[];
}

/** Max |v| over the grid points inside the domain, for building a shared
 * diverging range across several fields. */
export function fieldAbsMax(
  inst: Laplace2dInstance,
  values: Float64Array
): number {
  const { xs } = vizGrid(inst);
  let m = 0;
  for (let ix = 0; ix < VIZ_NGRID; ix++) {
    for (let iy = 0; iy < VIZ_NGRID; iy++) {
      if (!insideDomain(inst, xs[ix], xs[iy])) continue;
      const v = values[ix * VIZ_NGRID + iy];
      if (isFinite(v)) m = Math.max(m, Math.abs(v));
    }
  }
  return m;
}

export function FieldView({
  inst,
  values,
  mode,
  title,
  caption,
  range,
  overlayPoints,
}: FieldViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLCanvasElement>(null);
  const rangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const bar = barRef.current;
    if (!canvas || !bar) return;

    const draw = () => {
      const dark = isDarkMode();
      const ngrid = VIZ_NGRID;
      const { xs } = vizGrid(inst);
      // range
      let vmin = Infinity;
      let vmax = -Infinity;
      for (let ix = 0; ix < ngrid; ix++) {
        for (let iy = 0; iy < ngrid; iy++) {
          if (!insideDomain(inst, xs[ix], xs[iy])) continue;
          const v = values[ix * ngrid + iy];
          if (!isFinite(v)) continue;
          vmin = Math.min(vmin, v);
          vmax = Math.max(vmax, v);
        }
      }
      let lo: number;
      let hi: number;
      let scale: (v: number) => number;
      if (mode === "diverging") {
        const vabs = range
          ? Math.max(Math.abs(range.lo), Math.abs(range.hi), 1e-300)
          : Math.max(Math.abs(vmin), Math.abs(vmax), 1e-300);
        lo = -vabs;
        hi = vabs;
        scale = (v) => v / vabs; // [-1, 1]
      } else {
        hi = range ? range.hi : Math.max(vmax, 1e-300);
        lo = range
          ? Math.max(range.lo, 1e-300)
          : Math.max(vmin, hi * 1e-8, 1e-300);
        const llo = Math.log10(lo);
        const lhi = Math.log10(hi);
        scale = (v) =>
          (Math.log10(Math.min(Math.max(v, lo), hi)) - llo) / Math.max(lhi - llo, 1e-12);
      }

      canvas.width = ngrid;
      canvas.height = ngrid;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const img = ctx.createImageData(ngrid, ngrid);
      for (let ix = 0; ix < ngrid; ix++) {
        for (let iy = 0; iy < ngrid; iy++) {
          const px = ix;
          const py = ngrid - 1 - iy;
          const o = (py * ngrid + px) * 4;
          if (!insideDomain(inst, xs[ix], xs[iy])) {
            img.data[o + 3] = 0;
            continue;
          }
          const v = values[ix * ngrid + iy];
          const rgb =
            mode === "diverging"
              ? divergingColor(scale(v), dark)
              : sequentialColor(scale(v), dark);
          img.data[o] = Math.round(rgb[0]);
          img.data[o + 1] = Math.round(rgb[1]);
          img.data[o + 2] = Math.round(rgb[2]);
          img.data[o + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);

      // colorbar
      const bw = 220;
      const bh = 10;
      bar.width = bw;
      bar.height = bh;
      const bctx = bar.getContext("2d");
      if (!bctx) return;
      for (let i = 0; i < bw; i++) {
        const t = i / (bw - 1);
        const rgb =
          mode === "diverging"
            ? divergingColor(2 * t - 1, dark)
            : sequentialColor(t, dark);
        bctx.fillStyle = cssColor(rgb);
        bctx.fillRect(i, 0, 1, bh);
      }
      if (rangeRef.current) {
        const fmt = (v: number) =>
          mode === "logmag" ? v.toExponential(1) : v.toPrecision(3);
        rangeRef.current.textContent = `${fmt(lo)} … ${fmt(hi)}`;
      }

      // overlay: marked points (crisp, at display resolution)
      const overlay = overlayRef.current;
      if (overlay) {
        const disp = 300;
        const dpr = window.devicePixelRatio || 1;
        overlay.width = disp * dpr;
        overlay.height = disp * dpr;
        const octx = overlay.getContext("2d");
        if (octx) {
          octx.scale(dpr, dpr);
          octx.clearRect(0, 0, disp, disp);
          if (overlayPoints && overlayPoints.length > 0) {
            const { R } = vizGrid(inst);
            const tok = (name: string) =>
              getComputedStyle(document.documentElement)
                .getPropertyValue(name)
                .trim();
            octx.fillStyle = tok("--series-2");
            octx.strokeStyle = tok("--surface");
            octx.lineWidth = 1;
            for (const p of overlayPoints) {
              const px = ((p.x + R) / (2 * R)) * disp;
              const py = disp - ((p.y + R) / (2 * R)) * disp;
              octx.beginPath();
              octx.arc(px, py, 2.2, 0, 2 * Math.PI);
              octx.fill();
              octx.stroke();
            }
          }
        }
      }
    };

    draw();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", draw);
    return () => mq.removeEventListener("change", draw);
  }, [inst, values, mode, range, overlayPoints]);

  return (
    <figure style={{ margin: 0 }}>
      <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ position: "relative", width: 300, height: 300 }}>
        <canvas
          ref={canvasRef}
          style={{ width: 300, height: 300, imageRendering: "auto" }}
        />
        <canvas
          ref={overlayRef}
          style={{
            position: "absolute",
            inset: 0,
            width: 300,
            height: 300,
            pointerEvents: "none",
          }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <canvas ref={barRef} style={{ width: 220, height: 10, borderRadius: 3 }} />
      </div>
      <div ref={rangeRef} className="small muted" />
      {caption && <figcaption className="field-caption" style={{ maxWidth: 300 }}>{caption}</figcaption>}
    </figure>
  );
}
