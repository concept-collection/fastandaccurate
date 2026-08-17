// The solution-and-error view: compute one solve in the browser at a
// chosen resolution and show the field next to its pointwise error
// against the exact solution.

import { useMemo, useState } from "react";
import type { Laplace2dInstance } from "../../problems/laplace2d/spec";
import {
  evalPoints,
  exactU,
  vizGrid,
  VIZ_NGRID,
} from "../../problems/laplace2d/exact";
import { SOLVERS, getSolver } from "../../solvers";
import { solutionInBrowser } from "../workerClient";
import type { ResultPoint } from "../../harness/resultSchema";
import { FieldView, fieldAbsMax } from "./FieldView";

function exactGridValues(inst: Laplace2dInstance): Float64Array {
  const { xs } = vizGrid(inst);
  const out = new Float64Array(VIZ_NGRID * VIZ_NGRID);
  for (let ix = 0; ix < VIZ_NGRID; ix++) {
    for (let iy = 0; iy < VIZ_NGRID; iy++) {
      out[ix * VIZ_NGRID + iy] = exactU(inst, xs[ix], xs[iy]);
    }
  }
  return out;
}

interface Computed {
  solverId: string;
  n: number;
  uGrid: Float64Array;
  point: ResultPoint;
}

export function SolutionSection({ inst }: { inst: Laplace2dInstance }) {
  const [solverId, setSolverId] = useState(SOLVERS[0].id);
  const [n, setN] = useState<number>(
    SOLVERS[0].sweepN[Math.floor(SOLVERS[0].sweepN.length * 0.7)]
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [computed, setComputed] = useState<Computed | null>(null);

  const exact = useMemo(() => exactGridValues(inst), [inst]);

  const errField = useMemo(() => {
    if (!computed) return null;
    const out = new Float64Array(exact.length);
    for (let i = 0; i < exact.length; i++) {
      out[i] = Math.abs(computed.uGrid[i] - exact[i]);
    }
    return out;
  }, [computed, exact]);

  const solver = getSolver(solverId);
  const showsComputed = computed !== null && computed.solverId === solverId;

  // One color scale shared by the exact and computed solution fields, set
  // by the dynamic range of the exact solution; a computed field that
  // exceeds it clips.
  const sharedRange = useMemo(() => {
    const vabs = fieldAbsMax(inst, exact);
    return { lo: -vabs, hi: vabs };
  }, [inst, exact]);

  const marks = useMemo(() => evalPoints(inst), [inst]);

  async function compute() {
    setBusy(true);
    setError(null);
    try {
      const { point, uGrid } = await solutionInBrowser(inst.id, solverId, n);
      setComputed({ solverId, n, uGrid, point });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="row" style={{ alignItems: "center", gap: 12, marginBottom: 12 }}>
        <label>
          solver{" "}
          <select
            value={solverId}
            onChange={(e) => {
              const id = e.target.value;
              setSolverId(id);
              const sw = getSolver(id).sweepN;
              setN(sw[Math.floor(sw.length * 0.7)]);
            }}
          >
            {SOLVERS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          n{" "}
          <select value={n} onChange={(e) => setN(parseInt(e.target.value, 10))}>
            {solver.sweepN.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button className="primary" onClick={compute} disabled={busy}>
          {busy ? "computing…" : "Compute in this browser"}
        </button>
      </div>
      {error && <p className="small" style={{ color: "var(--series-2)" }}>{error}</p>}
      <div className="row">
        <FieldView
          inst={inst}
          values={exact}
          mode="diverging"
          range={sharedRange}
          title="Exact solution"
          caption="The exact solution on the visualization grid. The color scale is shared with the computed field."
        />
        {showsComputed && computed && (
          <FieldView
            inst={inst}
            values={computed.uGrid}
            mode="diverging"
            range={sharedRange}
            title={`${solver.name}, n = ${computed.n}`}
            caption={`Computed in this browser: rel max error ${computed.point.relMax.toExponential(2)} at the evaluation points, solve ${(computed.point.solveSeconds * 1000).toPrecision(3)} ms. Same color scale as the exact solution.`}
          />
        )}
        {showsComputed && errField && computed && (
          <FieldView
            inst={inst}
            values={errField}
            mode="logmag"
            overlayPoints={marks}
            title="Pointwise error (log scale)"
            caption="Absolute difference from the exact solution; the color scale spans 8 decades below the maximum. Dots mark the 65 evaluation points where the reported errors are measured."
          />
        )}
      </div>
    </div>
  );
}
