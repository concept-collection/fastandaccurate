# fastandaccurate

Speed and accuracy benchmarks for PDE solvers.

Live site: https://concept-collection.github.io/fastandaccurate/

A limitation of most solver comparisons is that they fix a
discretization, which quietly decides much of the outcome. Here each
**problem** is posed in the continuum with an exact reference solution;
a solver chooses its own discretization and is scored at
problem-specified evaluation points. The central object is the
**work-precision curve**: error against compute time as the solver's
resolution varies. There is deliberately no single ranking, since which
curve wins can differ by accuracy regime, instance, and machine.

Solvers are MATLAB function files run by [numbl](https://numbl.org)
(MATLAB syntax in the browser and in node), so every run on this site
happens client side, and the identical harness runs from the command
line. Each problem defines its own interface and instances in a written
specification; the system is deliberately loose, and per-problem
interfaces are expected to differ.

## Problems

- [laplace-dirichlet-2d](docs/problems/laplace-dirichlet-2d.md) —
  interior Dirichlet Laplace problem on a star-shaped domain, data
  manufactured from an exact harmonic function whose singularities sit an
  adjustable distance outside the boundary.

## Results

Results are work-precision sweeps stored as JSON files in
[fastandaccurate-results](https://github.com/concept-collection/fastandaccurate-results)
and added by pull request; the site reads that repository statically, so
there is no database and no server. Every result records its provenance:
instance spec and hash, solver id and version, protocol, runtime, numbl
version, and machine. In-browser results can be rerun by any visitor on
their own machine directly on the site.

## Running benchmarks outside the browser

The command line installs from the site itself (node 20 or newer):

```
npx https://concept-collection.github.io/fastandaccurate/cli.tgz run --label "my workstation"
```

Note that npx caches by the exact URL string; the site offers the URL
with a `?v=<commit>` suffix so each deployment is a fresh install.

Useful flags: `--instance <id>`, `--solver <id>`, `--repeats N`,
`--max-n N`, `--out dir`. To benchmark your own solver, point the
harness at a MATLAB function file implementing the problem's interface:

```
npx https://concept-collection.github.io/fastandaccurate/cli.tgz run \
  --solver-file my_method.m --solver-id my-method
```

The resulting JSON files can be loaded on the site (load result file) to
view them against the committed curves, and submitted by PR to the
results repository. To add a solver to the site itself (so visitors can
rerun it in the browser), PR the solver directory and a manifest entry
to this repository; see `src/solvers/`.

## Development

```
npm install
npm run dev        # local dev server
npm test           # solver convergence tests through numbl in node
npm run build      # type-check, site build, CLI tarball (dist/)
npm run check-app  # headless end-to-end check of the built site
```

Layout: `src/problems/` holds problem specs, instances, exact solutions,
and the problem-side MATLAB; `src/solvers/` the solver MATLAB files and
manifests; `src/harness/` the shared runner, sweep, and result schema
(used identically by the browser worker and the CLI); `src/app/` the
React site; `src/cli/` the command line.

Deployed to GitHub Pages by `.github/workflows/deploy.yml` on push to
main.

## License

Apache-2.0
