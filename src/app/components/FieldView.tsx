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
}

export function FieldView({ inst, values, mode, title, caption }: FieldViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
        const vabs = Math.max(Math.abs(vmin), Math.abs(vmax), 1e-300);
        lo = -vabs;
        hi = vabs;
        scale = (v) => v / vabs; // [-1, 1]
      } else {
        hi = Math.max(vmax, 1e-300);
        lo = Math.max(vmin, hi * 1e-8, 1e-300);
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
    };

    draw();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", draw);
    return () => mq.removeEventListener("change", draw);
  }, [inst, values, mode]);

  return (
    <figure style={{ margin: 0 }}>
      <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>
        {title}
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: 300, height: 300, imageRendering: "auto" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <canvas ref={barRef} style={{ width: 220, height: 10, borderRadius: 3 }} />
      </div>
      <div ref={rangeRef} className="small muted" />
      {caption && <figcaption className="field-caption" style={{ maxWidth: 300 }}>{caption}</figcaption>}
    </figure>
  );
}
