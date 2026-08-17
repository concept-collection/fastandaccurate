// The work-precision chart: relative max error against median solve time,
// both log scale. One curve per (solver, environment); color follows the
// solver, line style distinguishes committed / local / loaded origins.

import { useMemo, useRef, useState } from "react";
import type { ResultPoint } from "../../harness/resultSchema";

export interface ChartCurve {
  key: string;
  solverId: string;
  label: string;
  color: string;
  /** stroke-dasharray, undefined for solid (committed results). */
  dash?: string;
  /** Open markers (used for runs made in this browser). */
  open?: boolean;
  points: ResultPoint[];
}

interface Hover {
  px: number;
  py: number;
  curve: ChartCurve;
  point: ResultPoint;
}

const W = 760;
const H = 470;
const M = { l: 64, r: 150, t: 14, b: 50 };

function decades(min: number, max: number): number[] {
  const lo = Math.floor(Math.log10(min));
  const hi = Math.ceil(Math.log10(max));
  const out: number[] = [];
  for (let e = lo; e <= hi; e++) out.push(e);
  return out;
}

function fmtPow(e: number): string {
  const sup = String(e)
    .split("")
    .map(
      (c) =>
        ({ "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" })[c] ?? c
    )
    .join("");
  return `10${sup}`;
}

export function WorkPrecisionChart({ curves }: { curves: ChartCurve[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const nonEmpty = curves.filter((c) => c.points.length > 0);

  const scales = useMemo(() => {
    let xMin = Infinity,
      xMax = -Infinity,
      yMin = Infinity,
      yMax = -Infinity;
    for (const c of nonEmpty) {
      for (const p of c.points) {
        const x = Math.max(p.solveSeconds, 1e-8);
        const y = Math.max(p.relMax, 1e-17);
        xMin = Math.min(xMin, x);
        xMax = Math.max(xMax, x);
        yMin = Math.min(yMin, y);
        yMax = Math.max(yMax, y);
      }
    }
    if (!isFinite(xMin)) {
      xMin = 1e-4; xMax = 1; yMin = 1e-12; yMax = 1;
    }
    const xE = decades(xMin, xMax * 1.0001);
    const yE = decades(yMin, yMax * 1.0001);
    const xLo = xE[0];
    const xHi = xE[xE.length - 1];
    const yLo = yE[0];
    const yHi = yE[yE.length - 1];
    const sx = (v: number) =>
      M.l + ((Math.log10(Math.max(v, 1e-17)) - xLo) / Math.max(xHi - xLo, 1)) * (W - M.l - M.r);
    const sy = (v: number) =>
      H - M.b - ((Math.log10(Math.max(v, 1e-17)) - yLo) / Math.max(yHi - yLo, 1)) * (H - M.t - M.b);
    return { sx, sy, xE, yE };
  }, [nonEmpty]);

  const { sx, sy, xE, yE } = scales;
  const xStep = xE.length > 8 ? 2 : 1;
  const yStep = yE.length > 8 ? 2 : 1;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    let best: Hover | null = null;
    let bestD = 26 * 26;
    for (const c of nonEmpty) {
      for (const p of c.points) {
        const dx = sx(p.solveSeconds) - px;
        const dy = sy(Math.max(p.relMax, 1e-17)) - py;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = { px: sx(p.solveSeconds), py: sy(Math.max(p.relMax, 1e-17)), curve: c, point: p };
        }
      }
    }
    setHover(best);
  }

  if (nonEmpty.length === 0) {
    return (
      <div className="panel muted" style={{ padding: "40px 20px", textAlign: "center" }}>
        No results for this selection yet. Run a solver below, or load a
        result file produced by the command line.
      </div>
    );
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", maxWidth: 860 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Work-precision chart: relative max error versus median solve time, log-log"
      >
        {/* grid */}
        {xE.map((ex) => (
          <line
            key={`gx${ex}`}
            x1={sx(10 ** ex)}
            x2={sx(10 ** ex)}
            y1={M.t}
            y2={H - M.b}
            stroke="var(--grid)"
            strokeWidth={1}
          />
        ))}
        {yE.map((ey) => (
          <line
            key={`gy${ey}`}
            x1={M.l}
            x2={W - M.r}
            y1={sy(10 ** ey)}
            y2={sy(10 ** ey)}
            stroke="var(--grid)"
            strokeWidth={1}
          />
        ))}
        {/* axes */}
        <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke="var(--border)" />
        <line x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} stroke="var(--border)" />
        {xE.map(
          (ex, i) =>
            i % xStep === 0 && (
              <text
                key={`tx${ex}`}
                x={sx(10 ** ex)}
                y={H - M.b + 18}
                textAnchor="middle"
                fontSize={12}
                fill="var(--text-2)"
              >
                {fmtPow(ex)}
              </text>
            )
        )}
        {yE.map(
          (ey, i) =>
            i % yStep === 0 && (
              <text
                key={`ty${ey}`}
                x={M.l - 8}
                y={sy(10 ** ey) + 4}
                textAnchor="end"
                fontSize={12}
                fill="var(--text-2)"
              >
                {fmtPow(ey)}
              </text>
            )
        )}
        <text
          x={(M.l + W - M.r) / 2}
          y={H - 10}
          textAnchor="middle"
          fontSize={13}
          fill="var(--text-2)"
        >
          median solve time (seconds)
        </text>
        <text
          x={16}
          y={(M.t + H - M.b) / 2}
          textAnchor="middle"
          fontSize={13}
          fill="var(--text-2)"
          transform={`rotate(-90 16 ${(M.t + H - M.b) / 2})`}
        >
          relative max error
        </text>
        {/* curves */}
        {nonEmpty.map((c) => {
          const pts = [...c.points].sort((a, b) => a.solveSeconds - b.solveSeconds);
          const path = pts
            .map(
              (p, i) =>
                `${i === 0 ? "M" : "L"}${sx(p.solveSeconds).toFixed(1)},${sy(Math.max(p.relMax, 1e-17)).toFixed(1)}`
            )
            .join("");
          const last = pts[pts.length - 1];
          return (
            <g key={c.key}>
              <path
                d={path}
                fill="none"
                stroke={c.color}
                strokeWidth={2}
                strokeDasharray={c.dash}
              />
              {pts.map((p, i) => (
                <circle
                  key={i}
                  cx={sx(p.solveSeconds)}
                  cy={sy(Math.max(p.relMax, 1e-17))}
                  r={4}
                  fill={c.open ? "var(--surface)" : c.color}
                  stroke={c.color}
                  strokeWidth={c.open ? 2 : 0}
                />
              ))}
              {nonEmpty.length <= 4 && (
                <text
                  x={sx(last.solveSeconds) + 9}
                  y={sy(Math.max(last.relMax, 1e-17)) + 4}
                  fontSize={12}
                  fill="var(--text-2)"
                >
                  {c.label}
                </text>
              )}
            </g>
          );
        })}
        {hover && (
          <circle
            cx={hover.px}
            cy={hover.py}
            r={7}
            fill="none"
            stroke={hover.curve.color}
            strokeWidth={2}
          />
        )}
      </svg>
      {hover && wrapRef.current && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(hover.px / W) * wrapRef.current.clientWidth + 12}px`,
            top: `${(hover.py / H) * (wrapRef.current.clientWidth * (H / W)) - 10}px`,
          }}
        >
          <div>
            <strong>{hover.curve.label}</strong>
          </div>
          <div>n = {hover.point.n}</div>
          <div>rel max error = {hover.point.relMax.toExponential(2)}</div>
          <div>rel L2 error = {hover.point.relL2.toExponential(2)}</div>
          <div>solve = {(hover.point.solveSeconds * 1000).toPrecision(3)} ms</div>
        </div>
      )}
    </div>
  );
}
