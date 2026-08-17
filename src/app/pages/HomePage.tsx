import { PROBLEMS } from "../../problems";

export function HomePage() {
  return (
    <>
      <h1>fastandaccurate</h1>
      <p className="subtitle">Speed and accuracy benchmarks for PDE solvers</p>
      <p>
        Each problem is posed in the continuum with an exact or highly
        accurate reference solution; a solver chooses its own discretization
        and is compared by <em>work-precision curves</em>, error against
        compute time. Results can be reproduced in the browser and submitted
        by pull request. See <a href="#/about">About</a> for how measurement
        and submission work.
      </p>

      <h2>Problems</h2>
      <div className="problem-list">
        {PROBLEMS.map((p) => (
          <a key={p.id} className="problem-card" href={`#/problem/${p.id}`}>
            <div className="problem-card-title">
              <code>{p.id}</code>
              <span className="badge">{p.dimension}</span>
            </div>
            <div className="problem-card-summary">{p.summary}</div>
            <div className="problem-card-meta">
              {p.instanceCount} instances · {p.solverCount} solvers · ground
              truth: {p.groundTruth}
            </div>
          </a>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 16 }}>
        More problems are planned: further 2D problems (Helmholtz,
        time-dependent), 3D problems, and near-boundary evaluation variants.
        Suggestions and contributions are welcome on{" "}
        <a href="https://github.com/concept-collection/fastandaccurate">GitHub</a>.
      </p>
    </>
  );
}
