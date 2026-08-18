# Problem: laplace-dirichlet-2d (version 1)

This document is the canonical statement of the problem. Results refer to
it by the pair (problem id, problem version); any change that could alter
a measured number requires a version bump.

## The problem

Solve the Laplace equation

    Δu = 0  in Ω,    u = g  on ∂Ω,

where Ω is the plane domain bounded by the curve

    x(t) = r(t) (cos t, sin t),    t ∈ [0, 2π),

and g is Dirichlet data specified below. Two families of radius function
are used, both analytic and both parameterized by the polar angle:

    star:            r(t) = 1 + a cos(k t)
    rounded square:  r(t) = (cos^p t + sin^p t)^(−1/p),   p even

The second traces the superellipse |x|^p + |y|^p = 1: four sides, straight
to within about 1/p², meeting at four corners on the diagonals whose
radius of curvature is about 1.4/p. Since p is even, cos^p t is a
polynomial in cos t and the curve is analytic, so `curveDD` exists
everywhere and a solver sees the same interface as for a star. A genuine
corner, where the curve is only piecewise smooth and the layer density is
singular, is a different problem and not this one; what this family gives
is an arbitrarily *near* corner. The problem is posed in the
continuum: a solver receives the curve and the data as functions, chooses
its own discretization, and is scored on the values it returns at a fixed
set of evaluation points.

## The exact solution

The data g is manufactured from an exact harmonic function, a sum of
three logarithmic point sources placed outside the domain:

    u*(x) = Σ_j c_j log |x − s_j|,    c = (1.0, −0.6, 0.8).

Source s_j is the boundary point at parameter φ_j = 2π(j−1)/3 + 0.4
pushed a distance d along the outward unit normal, and g = u* restricted
to ∂Ω. Since u* is harmonic in Ω, it is the unique solution, and errors
are measured against it directly rather than against a reference
computation. The distance d controls difficulty: u* continues
harmonically only up to the sources, so the smaller d, the shorter the
distance the data continues past the boundary, and methods whose
representations assume a generous continuation lose it. A solver must
not use knowledge of the sources; they exist only to manufacture g.

## Official instances

| id | shape | a | k | p | d | character |
|---|---|---|---|---|---|---|
| disk-easy | star | 0 | 0 | | 0.5 | the unit disk, distant sources |
| star-medium | star | 0.2 | 3 | | 0.4 | mild geometry, comfortable continuation |
| star-hard | star | 0.3 | 5 | | 0.08 | wavy boundary, data barely continues |
| flower-15 | star | 0.2 | 15 | | 0.25 | fine features everywhere, data continues |
| square-corners | rounded square | | | 100 | 0.25 | near corners, targets inside them |
| star-nearfield | star | 0.3 | 5 | | 0.08 | star-hard, with targets against the boundary |

The hard instances are hard in different ways, which is the point of
having several. On star-hard the geometry is mild and the data barely
continues past the boundary; on flower-15 the data continues comfortably
(the sources really are 0.25 from the boundary, not merely 0.25 along a
normal) and the boundary itself is the difficulty: fifteen lobes, with
curvature up to 69, a curvature radius of 0.014 against a domain of size
1. Resolving it costs a few hundred boundary nodes before any method
converges at all, and the fixed evaluation rule below puts the closest
evaluation point 0.0295 from the boundary, so a method whose quadrature
degrades near the boundary is held back further. Note that k = 15 is
divisible by 3, so the three sources sit at equivalent phases of the lobe
pattern; this is deliberate, and keeps the instance from favoring any
particular angular sector.

square-corners moves the difficulty from everywhere to somewhere. Its
corners have radius 0.0142, one percent of the side, and its sides are
straight to a thousandth: four short stretches of boundary demand all the
resolution and the rest demands almost none. A method that can grade its
discretization has something to exploit here that the star instances never
offer, and the extra evaluation points described below sit inside the
corners, at 0.005 to 0.05 from the boundary, so that near-field accuracy
is measured where the geometry is worst rather than only where it is
convenient.

star-nearfield changes the question rather than the problem. Its domain
and its data are exactly star-hard's, so the equation a solver has to
solve is the same one; what differs is where the answer is wanted. Besides
the standard points it carries 32 targets on the inward normal at eight
parameters around the curve, at the same four distances the near-corner
set uses, so the closest sits 0.005 from a boundary of perimeter 9.02. A
method that evaluates its own representation with an uncorrected
quadrature rule loses accuracy there for reasons that have nothing to do
with how well it solved the equation: for the periodic trapezoid rule the
error at a target a distance δ inside behaves like exp(−2πδ/h) in the node
spacing h, so at n = 1024 nodes (h = 0.0088) one and the same computed
density is accurate to 6e−14 at δ = 0.05, 6.6e−6 at 0.02, 2.7e−3 at 0.01
and only 6.3e−2 at 0.005. The instance therefore measures near-field
evaluation by itself, and the pair (star-hard, star-nearfield) isolates
it: identical geometry, identical data, identical discretizations, one
question changed. Note that a method whose representation is smooth up to
the boundary, such as the MFS with its charges outside the domain, pays
nothing here; the difficulty belongs to the representation and not to the
problem.

Committed results exist only at these instances, so every solver is
compared on identical inputs. The parameters may be varied freely in the
site's interactive views, but such runs are not recorded.

## What is scored

Each instance fixes at least 289 evaluation points: 32 rays at angles
θ_j = 2πj/32 + 0.13 (j = 0, …, 31), radial fractions
ρ ∈ {0.1, 0.2, …, 0.9} along each ray (the point at fraction ρ on ray
θ is ρ r(θ) (cos θ, sin θ)), ordered radius-major, plus the origin last.

An instance with corners adds a **near-corner set** after those: for each
corner in order (the diagonals θ_c = π/4 + jπ/2, j = 0, …, 3), the four
points at distances δ ∈ {0.005, 0.01, 0.02, 0.05} inside the boundary
along that diagonal, at radius r(θ_c) − δ. On square-corners this gives
16 further points and 305 in all, and their true perpendicular distances
to the boundary are 0.005, 0.010, 0.019 and 0.042, the smallest of them a
third of the corner's own radius of curvature.

An instance carrying the **near-boundary set** adds, after any near-corner
set, four points per parameter: for each of the eight parameters
t_i = 2πi/8 + 0.07 (i = 0, …, 7), the four points at the same distances
δ ∈ {0.005, 0.01, 0.02, 0.05} inside the boundary along the inward *unit
normal* at t_i, ordered with the parameter outer and the distance inner.
On star-nearfield this gives 32 further points and 321 in all. Because
every δ stays below the smallest radius of curvature
there (0.0721), the distance from such a point to the curve is exactly δ,
unlike the near-corner set whose radial offset makes the true distances a
little smaller. The eight parameters are offset by 0.07 so that they land
at no special phase of the lobe pattern, and 8 is coprime to k = 5, so
they sample crests, flanks and valleys alike.

The count is therefore per instance, and a solver must return one value
per row of `prob.evalXY` rather than assume 289.

The solver returns u at exactly these points. Reported errors are

    relMax = max_i |u_i − u*_i| / max_i |u*_i|,
    relL2  = ( Σ_i (u_i − u*_i)² / Σ_i u*_i² )^{1/2}.

relMax is the headline number; both are recorded. Note that the fraction
0.9 bounds the *radial* distance, not the distance to the boundary. On a
strongly wiggly instance the boundary runs nearly radially along the
flanks of the lobes, so the perpendicular distance from an evaluation
point to it is several times smaller than the radial one: 0.0295 at the
closest point on flower-15, against 0.0464 on star-hard and 0.077 on
star-medium. Close evaluation therefore enters on the wiggly instances,
though not in its severe form. The severe form is star-nearfield, whose
near-boundary set puts targets a fraction of a node spacing from the
boundary. Adding it needed no version bump: it is a new instance, and no
number measured on an existing one changes.

## Timing protocol

One run is a full call of the solver, including its own discretization,
assembly, solve, and evaluation. The harness performs two untimed warmup
runs (the first of which is recorded separately as the cold time), then
timed runs, and reports the **fastest** of them as the solve time. The
minimum is used rather than the mean or median because everything that
interferes with a measurement (scheduling, other load, residual JIT
compilation) only ever adds time, so the fastest run is the least
contaminated estimate of the solver's own cost; every individual timing
is recorded in the result file regardless.

The number of timed runs is not fixed, because a fixed count times a
cheap point badly: a solve of 0.1 ms is dominated by whatever else the
machine was doing during those few hundred microseconds, and the minimum
of five such samples still scatters by a factor of several from one sweep
to the next, which made the low-resolution end of the curves noisy. So
timed runs continue until they have accumulated a **time budget** (0.5 s
by default), subject to a floor on the count (5) and a cap (50 runs).
A solve of a fraction of a millisecond is therefore measured 50 times and
an expensive one 5 times, and each point is sampled enough for its
minimum to mean something. The cap also bounds how many timings a result
file carries, since it records all of them. The policy is recorded in the result file as
`protocol.minTimedRuns`, `protocol.timeBudgetSeconds`, and
`protocol.maxTimedRuns`; how many runs a given point actually took is the
length of its `solveSecondsAll`. Results written before this policy
record a fixed `protocol.timedRuns` instead. Where a
sweep shares one process across resolutions, as the MATLAB runner does,
warmup runs precede the sweep as well, so that the first resolution does
not absorb the session's one-time costs. All timing is tic/toc inside the
solver's own runtime, so browser, node and MATLAB runs measure the same
thing. Times from different machines are not comparable; every result
records its environment, and comparisons across environments are the
reader's responsibility.

Note that solve time need not increase with the resolution parameter n. A
solver whose cost is dominated by a per-target near-field computation can
get *slower* as n decreases, since coarser panels put more targets in the
near field. Work-precision curves are therefore drawn as parametric
curves in n, and may double back in time; a point that is both slower and
less accurate than another point on the same curve is simply dominated.

## Solver interface

A solver is a MATLAB function file

    function out = solver(prob, n)

where n is the solver's own resolution parameter (its meaning is the
solver's choice; the standard sweep list is declared in the solver's
manifest, which may also declare a different list for an instance that
needs a different range of resolutions) and prob is a struct with fields

| field | meaning |
|---|---|
| `prob.curve` | `@(t) -> [x y]`, boundary point at parameter t (column vectors in, m×2 out) |
| `prob.curveD` | first derivative of the curve with respect to t |
| `prob.curveDD` | second derivative |
| `prob.g` | `@(t) -> g`, Dirichlet data at boundary parameter t |
| `prob.evalXY` | m×2, the evaluation points (289; 305 with corners, 321 with the near-boundary set) |
| `prob.vizXY` | m×2, visualization grid points (m = 0 when not requested) |

The return value is a struct: `out.uEval` (m×1, required) and
`out.uGrid` (m×1; `[]` when `prob.vizXY` is empty). The solver must not
reconstruct the sources analytically or otherwise special-case the known
solution; submissions are reviewed for this.

### The TypeScript form

A solver that cannot be a MATLAB file, one that runs on a GPU for
instance, receives the same information as a plain object instead, built by
`src/problems/laplace2d/problem.ts`:

| field | meaning |
|---|---|
| `curve(t)` | `{x, y}`, the boundary point at parameter t |
| `curveD(t)`, `curveDD(t)` | its first and second derivatives |
| `g(t)` | Dirichlet data at boundary parameter t |
| `evalXY` | `Float64Array`, `nEval` points as interleaved x, y |
| `vizXY` | the visualization grid, interleaved, empty when not wanted |

and returns `uEval`, and `uGrid` when the grid was asked for, as
`Float64Array`. Everything else is the same in both forms: the same
evaluation points in the same order, the same prohibition on
reconstructing the sources, and the same timing protocol. Only the clock
differs. A MATLAB solver is timed by tic/toc inside its own runtime; a GPU
solver has no such clock, so it is timed on the host around a run that
ends by awaiting the device, with the values read back before the clock
stops. That is the same synchronization point MATLAB's tic/toc gives.
Shader compilation and pipeline creation happen once per device rather
than once per run, which puts them where numbl's JIT compilation already
is: outside the timed runs, absorbed by the warmups.

A note on what a GPU solver can and cannot compute here. WGSL has f32 and
f16 and no double precision, and no extension in the WebGPU standard adds
one. Emulating double in software (carrying a value as an unevaluated sum
of two f32) is not a reliable way out either: it rests on error-free
transformations such as `s = a + b; err = b - (s - a)`, which are exact
only if the compiler evaluates them as written, and WGSL permits an
implementation to use greater precision or to reassociate. So a WebGPU
solver on this problem works in single precision, and for a method whose
accuracy is limited by conditioning rather than by resolution that sets a
ceiling the CPU does not have. `mfs-gpu` measures where that ceiling is.

## Visualization grid

When requested, `prob.vizXY` lists a 200×200 grid of points over the
bounding square [−R, R]², R = 1.05 max_t r(t), with flat index
p = ix·200 + iy for x = xs[ix], y = xs[iy] (y varies fastest, MATLAB
meshgrid column order). Points outside Ω are included and the viewer
masks them; grid values are never scored.

## Limitations

The exact solution is smooth and free of boundary singularities, so this
problem does not test corner handling, nonsmooth data, or interior
sources (a nonzero right-hand side would exclude plain boundary-integral
methods; that belongs to a different problem). The domain family is
star-shaped by construction, which some methods can exploit.

Every boundary here is analytic, which bounds what the measured curves
can show, and the instances differ in how much that bound bites. On the
star instances the features are of one size everywhere: flower-15 is
fifteen copies of the same lobe, so a method that refines adaptively has
nothing to refine toward, and a global spectral rule, which must resolve
the finest feature everywhere, loses nothing by doing so. There the
geometric convergence of the global trapezoid rule is hard to beat.
square-corners is the deliberate counterweight, with one localized feature
and targets inside it, and the ranking there is different in kind rather
than in degree. star-nearfield is a second counterweight, aimed at
evaluation rather than at geometry: what orders the methods there is
whether they correct their quadrature near the boundary at all, and a
method that does not is held at 1e−2 where one that does reaches 1e−11.

What remains untested is a genuine corner. The rounded square is smooth,
so its layer density is smooth; a boundary with an actual vertex has a
density that behaves like a power of the distance to it, needs graded
refinement or a corner-specific quadrature, and can turn a well-posed
second-kind equation into something that needs care. That is a different
problem, not a harder instance of this one. Also untested is whether
adaptive refinement pays: the panel solver here places its panels
uniformly, so on square-corners it resolves the corner by refining the
flat sides at the same time, and the benefit of grading is not measured.
