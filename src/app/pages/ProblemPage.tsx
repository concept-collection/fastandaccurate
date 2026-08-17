import { useEffect, useMemo, useState } from "react";
import {
  INSTANCES,
  getInstance,
  PROBLEM_ID,
} from "../../problems/laplace2d/spec";
import { SOLVERS } from "../../solvers";
import type { ResultFile, ResultPoint } from "../../harness/resultSchema";
import {
  environmentLabel,
  fetchCommittedResults,
  isResultFile,
} from "../results";
import { solverColorVar } from "../colors";
import { sweepInBrowser } from "../workerClient";
import { solverSource } from "../matlabSources";
import {
  WorkPrecisionChart,
  type ChartCurve,
} from "../components/WorkPrecisionChart";
import { PointsTable } from "../components/PointsTable";
import { DomainView } from "../components/DomainView";
import { SolutionSection } from "../components/SolutionSection";

const REPO_URL = "https://github.com/concept-collection/fastandaccurate";
const SPEC_URL = `${REPO_URL}/blob/main/docs/problems/laplace-dirichlet-2d.md`;

interface LocalRun {
  key: string;
  solverId: string;
  instanceId: string;
  repeats: number;
  points: ResultPoint[];
  done: boolean;
}

export function ProblemPage({ problemId }: { problemId: string }) {
  const [instanceId, setInstanceId] = useState(INSTANCES[1].id);
  const [committed, setCommitted] = useState<ResultFile[] | null>(null);
  const [committedError, setCommittedError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<ResultFile[]>([]);
  const [localRuns, setLocalRuns] = useState<LocalRun[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [repeats, setRepeats] = useState(3);
  const [copied, setCopied] = useState(false);

  const inst = getInstance(instanceId);
  const visibleSolverList = SOLVERS.filter((s) => !hidden.has(s.id));
  const cliCommand =
    `npx https://concept-collection.github.io/fastandaccurate/cli.tgz?v=${__BUILD_ID__} ` +
    `run --instance ${instanceId}` +
    (visibleSolverList.length === 1 ? ` --solver ${visibleSolverList[0].id}` : "") +
    ` --label "my machine"`;

  useEffect(() => {
    fetchCommittedResults()
      .then(setCommitted)
      .catch((err) =>
        setCommittedError(err instanceof Error ? err.message : String(err))
      );
  }, []);

  const allSolverIds = useMemo(() => {
    const ids = new Set<string>(SOLVERS.map((s) => s.id));
    committed?.forEach((r) => ids.add(r.solver.id));
    loaded.forEach((r) => ids.add(r.solver.id));
    return [...ids];
  }, [committed, loaded]);

  const curves: ChartCurve[] = useMemo(() => {
    const out: ChartCurve[] = [];
    const color = (id: string) => solverColorVar(id, allSolverIds);
    committed
      ?.filter((r) => r.problem === PROBLEM_ID && r.instance === instanceId)
      .forEach((r, i) => {
        out.push({
          key: `committed:${i}`,
          solverId: r.solver.id,
          label: `${r.solver.id} — ${environmentLabel(r)}`,
          color: color(r.solver.id),
          points: r.points,
        });
      });
    loaded
      .filter((r) => r.problem === PROBLEM_ID && r.instance === instanceId)
      .forEach((r, i) => {
        out.push({
          key: `loaded:${i}`,
          solverId: r.solver.id,
          label: `${r.solver.id} — ${environmentLabel(r)} (loaded)`,
          color: color(r.solver.id),
          dash: "8 4",
          points: r.points,
        });
      });
    localRuns
      .filter((r) => r.instanceId === instanceId)
      .forEach((r) => {
        out.push({
          key: r.key,
          solverId: r.solverId,
          label: `${r.solverId} — this browser`,
          color: color(r.solverId),
          dash: "4 4",
          open: true,
          points: r.points,
        });
      });
    return out.filter((c) => !hidden.has(c.solverId));
  }, [committed, loaded, localRuns, instanceId, hidden, allSolverIds]);

  async function runSolver(solverId: string) {
    const key = `local:${solverId}:${instanceId}:${Date.now()}`;
    setLocalRuns((rs) => [
      ...rs.filter(
        (r) => !(r.solverId === solverId && r.instanceId === instanceId)
      ),
      { key, solverId, instanceId, repeats, points: [], done: false },
    ]);
    setRunning(solverId);
    try {
      const points = await sweepInBrowser(
        instanceId,
        solverId,
        repeats,
        (point, index, total) => {
          setRunStatus(
            `${solverId} on ${instanceId}: point ${index + 1}/${total} (n = ${point.n}) — rel max error ${point.relMax.toExponential(2)}`
          );
          setLocalRuns((rs) =>
            rs.map((r) =>
              r.key === key ? { ...r, points: [...r.points, point] } : r
            )
          );
        }
      );
      setLocalRuns((rs) =>
        rs.map((r) => (r.key === key ? { ...r, points, done: true } : r))
      );
      setRunStatus(null);
    } catch (err) {
      setRunStatus(
        `${solverId} failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setRunning(null);
    }
  }

  function loadFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      file.text().then((text) => {
        try {
          const data: unknown = JSON.parse(text);
          if (isResultFile(data)) {
            setLoaded((ls) => [...ls, data]);
          } else {
            alert(`${file.name} is not a fastandaccurate result file`);
          }
        } catch {
          alert(`${file.name}: not valid JSON`);
        }
      });
    }
  }

  if (problemId !== PROBLEM_ID) {
    return (
      <>
        <p className="small">
          <a href="#/">← problems</a>
        </p>
        <h1>Unknown problem</h1>
        <p>
          No problem named <code>{problemId}</code>.{" "}
          <a href="#/">Back to the problem list.</a>
        </p>
      </>
    );
  }

  return (
    <>
      <p className="small">
        <a href="#/">← problems</a>
      </p>
      <h1>
        <code>{PROBLEM_ID}</code>
      </h1>
      <p className="subtitle">
        Interior Dirichlet Laplace problem on a star-shaped 2D domain
      </p>
      <p>
        Solve Δu = 0 on the domain with boundary r(θ) = 1 + a·cos(kθ), with
        Dirichlet data u = g on the boundary. The data comes from an exact
        harmonic function, a sum of three logarithmic point sources placed a
        distance d outside the boundary, so errors are measured against the
        true solution rather than a reference computation. The distance d
        sets the difficulty: the closer the sources, the shorter the distance
        the data continues harmonically past the boundary, and methods whose
        representations assume that continuation lose it. A solver receives
        the curve (with derivatives), the boundary data as a function of the
        boundary parameter, and the evaluation points, and returns solution
        values at those points. The precise statement, solver interface, and
        timing protocol are in the <a href={SPEC_URL}>specification</a>.
      </p>
      <div className="row" style={{ marginTop: 14 }}>
        <div>
          <div style={{ marginBottom: 10 }}>
            <label>
              instance{" "}
              <select
                value={instanceId}
                onChange={(e) => setInstanceId(e.target.value)}
              >
                {INSTANCES.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.id} — {i.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="small muted" style={{ maxWidth: 380 }}>
            {inst.description}
          </p>
          <table className="data">
            <tbody>
              <tr>
                <th className="left">a</th>
                <td>{inst.a}</td>
                <th className="left">k</th>
                <td>{inst.k}</td>
                <th className="left">d</th>
                <td>{inst.d}</td>
                <th className="left">data</th>
                <td className="left">{inst.family}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <DomainView inst={inst} />
      </div>

      <h2>Solvers</h2>
      <p className="small muted" style={{ maxWidth: 640 }}>
        Each solver is a MATLAB function file implementing the interface in
        the <a href={SPEC_URL}>specification</a>; the same file runs in the
        browser via numbl and from the command line.
      </p>
      {SOLVERS.map((s) => (
        <div
          key={s.id}
          className="panel"
          style={{ maxWidth: 860, marginBottom: 12 }}
        >
          <div>
            <span
              className="legend-swatch"
              style={{ background: solverColorVar(s.id, allSolverIds) }}
            />
            <strong>{s.name}</strong>{" "}
            <span className="small muted">
              {s.id} v{s.version} · {s.backend}
            </span>
          </div>
          <p className="small" style={{ color: "var(--text-2)" }}>
            {s.description}
          </p>
          <details>
            <summary className="small" style={{ cursor: "pointer" }}>
              solver.m
            </summary>
            <pre style={{ maxHeight: 420, overflow: "auto", marginTop: 8 }}>
              {solverSource(s.id)}
            </pre>
          </details>
          <a
            className="small"
            href={`${REPO_URL}/blob/main/src/solvers/${s.id}/solver.m`}
          >
            view on GitHub
          </a>
        </div>
      ))}

      <h2>Work-precision results</h2>
      {committedError && (
        <p className="small muted">
          Committed results could not be loaded ({committedError}); showing
          local runs only.
        </p>
      )}
      <WorkPrecisionChart curves={curves} />
      <div className="row" style={{ marginTop: 14, alignItems: "center" }}>
        {SOLVERS.map((s) => (
          <span key={s.id} style={{ whiteSpace: "nowrap" }}>
            <label>
              <input
                type="checkbox"
                checked={!hidden.has(s.id)}
                onChange={(e) => {
                  setHidden((h) => {
                    const next = new Set(h);
                    if (e.target.checked) next.delete(s.id);
                    else next.add(s.id);
                    return next;
                  });
                }}
              />{" "}
              <span
                className="legend-swatch"
                style={{ background: solverColorVar(s.id, allSolverIds) }}
              />
              {s.name}
            </label>{" "}
            <button
              onClick={() => runSolver(s.id)}
              disabled={running !== null}
              title={`Run the full ${s.id} sweep on ${instanceId} in this browser`}
            >
              {running === s.id ? "running…" : "Run in this browser"}
            </button>
          </span>
        ))}
        <label>
          repeats{" "}
          <select
            value={repeats}
            onChange={(e) => setRepeats(parseInt(e.target.value, 10))}
          >
            {[1, 3, 5].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>
      {runStatus && <p className="small muted">{runStatus}</p>}
      <h3>Run this on your machine</h3>
      <p className="small muted" style={{ maxWidth: 640 }}>
        This command runs the{" "}
        {visibleSolverList.length === 1
          ? `${visibleSolverList[0].id} sweep`
          : "same sweeps"}{" "}
        on the <code>{instanceId}</code> instance (node 20 or newer) and
        writes result JSON files. Load them below to see them on this chart,
        or submit them by pull request (see <a href="#/about">About</a>).
      </p>
      <div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
        <pre style={{ margin: 0, flex: "1 1 420px", overflowX: "auto" }}>
          {cliCommand}
        </pre>
        <button
          onClick={() => {
            navigator.clipboard.writeText(cliCommand).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "copied" : "Copy"}
        </button>
      </div>
      <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
        <label className="small">
          load result file{" "}
          <input
            type="file"
            accept=".json,application/json"
            multiple
            onChange={(e) => loadFiles(e.target.files)}
          />
        </label>
      </div>
      <PointsTable curves={curves} />

      <h2>Solution and error</h2>
      <p className="small muted" style={{ maxWidth: 640 }}>
        Compute one solve at a chosen resolution and compare the field with
        the exact solution, on a shared color scale. The error map shows the
        absolute pointwise difference on a log scale; the errors reported in
        the results above are measured at the evaluation points, which can
        be shown on the error map.
      </p>
      <SolutionSection inst={inst} />
    </>
  );
}
