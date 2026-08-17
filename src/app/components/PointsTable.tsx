// Table view of the charted data, one collapsible table per curve.

import type { ChartCurve } from "./WorkPrecisionChart";

export function PointsTable({ curves }: { curves: ChartCurve[] }) {
  const nonEmpty = curves.filter((c) => c.points.length > 0);
  if (nonEmpty.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      {nonEmpty.map((c) => (
        <details key={c.key} style={{ marginBottom: 6 }}>
          <summary className="small" style={{ cursor: "pointer" }}>
            <span className="legend-swatch" style={{ background: c.color }} />
            {c.label} — data table
          </summary>
          <table className="data" style={{ marginTop: 6 }}>
            <thead>
              <tr>
                <th>n</th>
                <th>rel max error</th>
                <th>rel L2 error</th>
                <th>solve (s)</th>
                <th>cold (s)</th>
              </tr>
            </thead>
            <tbody>
              {c.points.map((p) => (
                <tr key={p.n}>
                  <td>{p.n}</td>
                  <td>{p.relMax.toExponential(2)}</td>
                  <td>{p.relL2.toExponential(2)}</td>
                  <td>{p.solveSeconds.toFixed(4)}</td>
                  <td>{p.coldSeconds.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
    </div>
  );
}
