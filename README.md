# fastandaccurate

Speed and accuracy benchmarks for PDE solvers.

Live site: https://concept-collection.github.io/fastandaccurate/

A limitation of most solver comparisons is that they fix a
discretization, which quietly decides much of the outcome. Here each
**problem** is posed in the continuum with an exact reference solution;
a solver chooses its own discretization and is scored at
problem-specified evaluation points. The central object is the
**work-precision curve**: error against compute time as the solver's
resolution varies. No single ranking is presented; which curve wins can
differ by accuracy regime, instance, and machine.

Solvers are usually MATLAB function files. Most run via
[numbl](https://numbl.org) (MATLAB syntax in the browser and in node),
both on the site and from the command line; some run only in real
MATLAB through the command line, and their results are marked as not
reproducible in the browser. Two registry entries may share one file:
the `-mat` solvers are their numbl twin's `solver.m` run in real MATLAB,
so that pair of curves measures the runtime rather than the method. A
problem's interface also has a TypeScript form, for a solver that cannot
be a MATLAB file: `mfs-gpu` is the same method as `mfs` written in
TypeScript and WGSL and run on a WebGPU device. Each problem defines its
own interface and instances in a written specification; interfaces are
per problem rather than shared.

## Problems

- [laplace-dirichlet-2d](docs/problems/laplace-dirichlet-2d.md) —
  interior Dirichlet Laplace problem on a star-shaped domain, data
  manufactured from an exact harmonic function whose singularities sit an
  adjustable distance outside the boundary.

## Results

Results are work-precision sweeps stored as JSON files in
[fastandaccurate-results](https://github.com/concept-collection/fastandaccurate-results)
and added by pull request; the site reads that repository statically.
Every result records its provenance: instance spec and hash, solver id
and version, protocol, runtime, numbl version, and machine. Solvers
included on the site can be rerun in the browser on the problem page to
compare against the committed curves.

## Running benchmarks outside the browser

The command line installs from the site itself (node 20 or newer):

```
npx https://concept-collection.github.io/fastandaccurate/cli.tgz run --label "my workstation"
```

Note that npx caches by the exact URL string; the site offers the URL
with a `?v=<commit>` suffix so each deployment is a fresh install.

The solvers whose runtime is `matlab` need `matlab` on the PATH; the run
skips them when it is absent. `chunkie-dlp` needs one thing more, the
[mip](https://mip.sh) package manager on the MATLAB path, from which the
harness installs chunkie and its FLAM and fmm2d dependencies on first
use. Taking chunkie from mip rather than from a source clone is what
makes its accelerated code path available without a Fortran compiler on
the machine, since the mip fmm2d package ships a compiled MEX binary per
platform.

The solvers whose runtime is `webgpu` need a WebGPU device. In the
browser that is `navigator.gpu`; outside it, it is the optional
[`webgpu`](https://www.npmjs.com/package/webgpu) package (prebuilt Google
Dawn). That package is 68 MB, so the published command line does not ship
it and a run without it skips those solvers; `npm install webgpu` in a
checkout is enough to have them.

Useful flags: `--instance <id>`, `--solver <id>`, `--repeats N` (the
minimum timed runs per point; each point is then repeated until it has
used the `--time-budget`, 0.5 s by default), `--max-n N`, `--out dir`.
To benchmark your own solver, point the harness at a MATLAB function file
implementing the problem's interface:

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
npm run dev         # local dev server
npm test            # solver convergence tests through numbl in node
npm run test:matlab # the same for the MATLAB-runtime solvers (needs matlab)
npm run test:gpu    # the same for the WebGPU solvers (needs a device)
npm run build       # type-check, site build, CLI tarball (dist/)
npm run check-app   # headless end-to-end check of the built site
npm run check-gpu   # headless check that a WebGPU solver runs in a page
```

Only `npm test` runs in CI, since a GitHub runner has neither MATLAB nor a
GPU; the other three skip cleanly where their runtime is missing and are
meant to be run locally before pushing solver changes.

Layout: `src/problems/` holds problem specs, instances, exact solutions,
the problem-side MATLAB and its TypeScript form; `src/solvers/` the
solver files and manifests; `src/harness/` the shared runner, sweep,
timing policy, and result schema (used identically by the browser worker
and the CLI); `src/app/` the React site; `src/cli/` the command line.

Deployed to GitHub Pages by `.github/workflows/deploy.yml` on push to
main.

## License

Apache-2.0
