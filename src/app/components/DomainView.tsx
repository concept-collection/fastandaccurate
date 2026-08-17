// Draws the problem geometry: boundary curve, evaluation points, and the
// exact solution's sources.

import { useEffect, useRef } from "react";
import type { Laplace2dInstance } from "../../problems/laplace2d/spec";
import {
  boundaryPoint,
  branchPoint,
  evalPoints,
  singularities,
} from "../../problems/laplace2d/exact";

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function DomainView({ inst }: { inst: Laplace2dInstance }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const size = 360;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size, size);

      const extent = 1 + Math.abs(inst.a) + inst.d + 0.25;
      const s = size / (2 * extent);
      const X = (x: number) => size / 2 + x * s;
      const Y = (y: number) => size / 2 - y * s;

      // domain fill + boundary
      ctx.beginPath();
      for (let i = 0; i <= 512; i++) {
        const t = (2 * Math.PI * i) / 512;
        const p = boundaryPoint(inst, t);
        if (i === 0) ctx.moveTo(X(p.x), Y(p.y));
        else ctx.lineTo(X(p.x), Y(p.y));
      }
      ctx.closePath();
      ctx.fillStyle = token("--surface-2");
      ctx.fill();
      ctx.strokeStyle = token("--text");
      ctx.lineWidth = 2;
      ctx.stroke();

      // evaluation points
      ctx.fillStyle = token("--text-2");
      for (const p of evalPoints(inst)) {
        ctx.beginPath();
        ctx.arc(X(p.x), Y(p.y), 1.4, 0, 2 * Math.PI);
        ctx.fill();
      }

      // the exact solution's singularities
      ctx.strokeStyle = token("--series-2");
      ctx.lineWidth = 2;
      for (const src of singularities(inst)) {
        const cx = X(src.x);
        const cy = Y(src.y);
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy - 5);
        ctx.lineTo(cx + 5, cy + 5);
        ctx.moveTo(cx - 5, cy + 5);
        ctx.lineTo(cx + 5, cy - 5);
        ctx.stroke();
      }

      // branch family: dashed segment along the cut (radially outward)
      if (inst.family === "branch-point") {
        const b = branchPoint(inst);
        ctx.strokeStyle = token("--text-3");
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(X(b.x), Y(b.y));
        ctx.lineTo(
          X(b.x + 0.3 * Math.cos(b.theta0)),
          Y(b.y + 0.3 * Math.sin(b.theta0))
        );
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };
    draw();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", draw);
    return () => mq.removeEventListener("change", draw);
  }, [inst]);

  return (
    <figure style={{ margin: 0 }}>
      <canvas ref={canvasRef} />
      <figcaption className="field-caption" style={{ maxWidth: 360 }}>
        The domain, the evaluation points where solutions are scored
        (dots), and the exact solution's{" "}
        {inst.family === "branch-point"
          ? "branch point a distance " + inst.d + " outside the boundary " +
            "(cross), with its cut running radially outward (dashed)"
          : "sources a distance " + inst.d + " outside the boundary (crosses)"}
        .
      </figcaption>
    </figure>
  );
}
