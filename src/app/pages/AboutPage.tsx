import { RESULTS_REPO_URL } from "../results";

const REPO_URL = "https://github.com/concept-collection/fastandaccurate";

export function AboutPage() {
  const cliUrl = `https://concept-collection.github.io/fastandaccurate/cli.tgz?v=${__BUILD_ID__}`;
  return (
    <>
      <p className="small">
        <a href="#/">← problems</a>
      </p>
      <h1>About</h1>
      <p>
        fastandaccurate benchmarks PDE solvers on speed and accuracy
        together. Each <strong>problem</strong> is posed in the continuum,
        with an exact or highly accurate reference solution; a solver chooses
        its own discretization and is scored at problem-specified evaluation
        points. A problem defines its own solver interface and a short list
        of official <strong>instances</strong> (parameter combinations) in a
        written specification, so every solver is compared on identical
        inputs. The solvers on this site are MATLAB function files run by{" "}
        <a href="https://numbl.org">numbl</a>, client side; the identical
        harness runs from the command line.
      </p>

      <h2>Measurement</h2>
      <p>
        The central object is the <strong>work-precision curve</strong>:
        error against compute time, traced out as the solver's resolution
        parameter varies. Errors are measured at a fixed set of evaluation
        points defined per instance, relative to the reference solution.
        Timing is one untimed warmup run (which absorbs JIT compilation),
        then the median of repeated timed runs; a run includes the solver's
        own discretization, assembly, solve, and evaluation.
      </p>

      <h2>Results and provenance</h2>
      <p>
        Results are JSON files in{" "}
        <a href={RESULTS_REPO_URL}>fastandaccurate-results</a>, added by pull
        request; the site reads that repository statically. Every result
        carries its provenance: the instance spec and its hash, solver id and
        version, timing protocol, runtime, numbl version, and machine.
        Result files are produced by the command line; solvers included on
        the site can also be rerun in the browser, directly on the problem
        page, to compare against the committed curves. Results from solvers
        outside the repository (and, in the future, from other languages and
        hardware) enter the same way and are marked as not reproducible in
        the browser.
      </p>

      <h2>Running outside the browser</h2>
      <p>
        The command line installs from this site itself (node 20 or newer;
        nothing on the npm registry):
      </p>
      <pre>{`npx ${cliUrl} run --label "my workstation"`}</pre>
      <p>
        This runs the standard sweeps and writes one result JSON per instance
        and solver. Useful flags: <code>--instance &lt;id&gt;</code>,{" "}
        <code>--solver &lt;id&gt;</code>, <code>--repeats N</code>,{" "}
        <code>--max-n N</code>, <code>--out dir</code>. To benchmark your own
        solver, point the harness at a MATLAB function file implementing the
        problem's solver interface:
      </p>
      <pre>{`npx ${cliUrl} run --solver-file my_method.m --solver-id my-method`}</pre>
      <p className="small muted">
        Note that npx caches by the exact URL string; the <code>?v=</code>{" "}
        suffix above ties the command to the current deployment so a later
        visit installs the current build.
      </p>

      <h2>Submitting</h2>
      <p>
        Result files can be loaded on a problem page (load result file) to
        view them against the committed curves before submitting anything. To
        publish results, open a pull request adding the files under{" "}
        <code>results/</code> in the{" "}
        <a href={RESULTS_REPO_URL}>results repository</a>. To add a solver to
        the site itself, so visitors can rerun it in the browser, PR the
        solver directory and a manifest entry to{" "}
        <a href={REPO_URL}>the main repository</a>; submissions are reviewed
        against the problem specification, including that a solver must not
        special-case the known solution.
      </p>
    </>
  );
}
