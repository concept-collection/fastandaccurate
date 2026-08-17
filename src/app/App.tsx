import { useEffect, useMemo, useState } from "react";
import {
  INSTANCES,
  getInstance,
  PROBLEM_ID,
} from "../problems/laplace2d/spec";
import { SOLVERS, getSolver } from "../solvers";
import {
  buildResultFile,
  type ResultFile,
  type ResultPoint,
} from "../harness/resultSchema";
import {
  environmentLabel,
  fetchCommittedResults,
  isResultFile,
  RESULTS_REPO_URL,
} from "./results";
import { solverColorVar } from "./colors";
import { sweepInBrowser } from "./workerClient";
import { WorkPrecisionChart, type ChartCurve } from "./components/WorkPrecisionChart";
import { PointsTable } from "./components/PointsTable";
import { DomainView } from "./components/DomainView";
import { SolutionSection } from "./components/SolutionSection";

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

export function App() {
  const [instanceId, setInstanceId] = useState(INSTANCES[1].id);
  const [committed, setCommitted] = useState<ResultFile[] | null>(null);
  const [committedError, setCommittedError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<ResultFile[]>([]);
  const [localRuns, setLocalRuns] = useState<LocalRun[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [repeats, setRepeats] = useState(3);
  const [machineLabel, setMachineLabel] = useState("");

  const inst = getInstance(instanceId);

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
      ...rs.filter((r) => !(r.solverId === solverId && r.instanceId === instanceId)),
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
            rs.map((r) => (r.key === key ? { ...r, points: [...r.points, point] } : r))
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

  async function downloadRun(run: LocalRun) {
    const manifest = getSolver(run.solverId);
    const result = await buildResultFile({
      instance: getInstance(run.instanceId),
      solver: {
        id: manifest.id,
        version: manifest.version,
        backend: manifest.backend,
        source: "builtin",
      },
      environment: {
        kind: "browser",
        runtime: navigator.userAgent,
        numblVersion: __NUMBL_VERSION__,
        machineLabel: machineLabel || undefined,
        browserReproducible: true,
      },
      repeats: run.repeats,
      points: run.points,
    });
    const blob = new Blob([JSON.stringify(result, null, 2) + "\n"], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${PROBLEM_ID}.${run.instanceId}.${run.solverId}.browser.json`;
    a.click();
    URL.revokeObjectURL(a.href);
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

  const cliUrl = `https://concept-collection.github.io/fastandaccurate/cli.tgz?v=${__BUILD_ID__}`;

  return (
    <main>
      <h1>fastandaccurate</h1>
      <p className="subtitle">Speed and accuracy benchmarks for PDE solvers</p>
      <p>
        Each <strong>problem</strong> here is posed in the continuum, with an
        exact reference solution; a solver chooses its own discretization and
        is scored at problem-specified evaluation points. The central object
        is the <strong>work-precision curve</strong>: error against compute
        time as the solver's resolution varies. There is deliberately no
        single ranking; which curve is best can differ by accuracy regime,
        instance, and machine. Results shown here are committed to a public{" "}
        <a href={RESULTS_REPO_URL}>results repository</a> by pull request, and
        any in-browser solver can be rerun on your own machine, right on this
        page, to check them.
      </p>
      <p className="small muted">
        <a href={REPO_URL}>Source</a> · <a href={SPEC_URL}>Problem specification</a> ·{" "}
        <a href={RESULTS_REPO_URL}>Results repository</a> · Solvers run in
        MATLAB syntax via <a href="https://numbl.org">numbl</a>, client side.
      </p>

      <h2>The problem: laplace-dirichlet-2d</h2>
      <p>
        Solve Δu = 0 on the star-shaped domain with boundary
        r(θ) = 1 + a·cos(kθ), with Dirichlet data u = g on the boundary. The
        data comes from an exact harmonic function, a sum of three logarithmic
        point sources placed a distance d outside the boundary, so errors are
        measured against the true solution, not a reference computation. The
        distance d sets the difficulty: the closer the sources, the shorter
        the distance the data continues harmonically past the boundary, and
        methods whose representations assume that continuation lose it. A
        solver receives the curve (with derivatives), the boundary data as a
        function of the boundary parameter, and the evaluation points, and
        returns solution values at those points; reported time is the whole
        solve including the solver's own discretization (median of repeats
        after one untimed warmup). The precise statement, interface, and
        protocol are in the <a href={SPEC_URL}>specification</a>.
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
              </tr>
            </tbody>
          </table>
        </div>
        <DomainView inst={inst} />
      </div>

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
      <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
        <label className="small">
          machine label{" "}
          <input
            type="text"
            placeholder="e.g. office workstation"
            value={machineLabel}
            onChange={(e) => setMachineLabel(e.target.value)}
          />
        </label>
        {localRuns
          .filter((r) => r.done && r.instanceId === instanceId)
          .map((r) => (
            <button key={r.key} onClick={() => downloadRun(r)}>
              Download {r.solverId} result JSON
            </button>
          ))}
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
        the exact solution. The solution uses a diverging scale about zero;
        the error is the absolute pointwise difference on a log scale.
      </p>
      <SolutionSection inst={inst} />

      <h2>Run it outside the browser</h2>
      <p style={{ maxWidth: 720 }}>
        The same harness runs in node, with the same solvers, the same
        protocol, and the same result format (node 20 or newer; no install
        step):
      </p>
      <pre>{`npx ${cliUrl} run --label "my workstation"`}</pre>
      <p style={{ maxWidth: 720 }}>
        This writes one result JSON per instance and solver. To benchmark
        your own solver, point the harness at a MATLAB function file that
        implements the problem's solver interface:
      </p>
      <pre>{`npx ${cliUrl} run --solver-file my_method.m --solver-id my-method`}</pre>
      <p style={{ maxWidth: 720 }}>
        Result files can be loaded above (load result file) to view them
        against the committed curves before submitting anything. To publish,
        open a pull request adding the files under <code>results/</code> in
        the <a href={RESULTS_REPO_URL}>results repository</a>; provenance
        (machine, runtime, numbl version, solver version) travels inside each
        file. Solvers in other languages are planned to enter the same way:
        run offline, produce the same result format, submit by PR, with the
        file marked as not reproducible in the browser.
      </p>

      <footer>
        fastandaccurate · Apache-2.0 ·{" "}
        <a href={REPO_URL}>concept-collection/fastandaccurate</a> · numbl{" "}
        {__NUMBL_VERSION__}
      </footer>
    </main>
  );
}
