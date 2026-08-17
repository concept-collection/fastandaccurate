# Problem: laplace-dirichlet-2d (version 1)

This document is the canonical statement of the problem. Results refer to
it by the pair (problem id, problem version); any change that could alter
a measured number requires a version bump.

## The problem

Solve the Laplace equation

    Δu = 0  in Ω,    u = g  on ∂Ω,

where Ω is the star-shaped plane domain bounded by the curve

    x(t) = r(t) (cos t, sin t),    r(t) = 1 + a cos(k t),    t ∈ [0, 2π),

and g is Dirichlet data specified below. The problem is posed in the
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

| id | a | k | d | character |
|---|---|---|---|---|
| disk-easy | 0 | 0 | 0.5 | the unit disk, distant sources |
| star-medium | 0.2 | 3 | 0.4 | mild geometry, comfortable continuation |
| star-hard | 0.3 | 5 | 0.08 | wavy boundary, data barely continues |

Committed results exist only at these instances, so every solver is
compared on identical inputs. The parameters may be varied freely in the
site's interactive views, but such runs are not recorded.

## What is scored

Each instance fixes 289 evaluation points: 32 rays at angles
θ_j = 2πj/32 + 0.13 (j = 0, …, 31), radial fractions
ρ ∈ {0.1, 0.2, …, 0.9} along each ray (the point at fraction ρ on ray
θ is ρ r(θ) (cos θ, sin θ)), ordered radius-major, plus the origin last.
The solver returns u at exactly these points. Reported errors are

    relMax = max_i |u_i − u*_i| / max_i |u*_i|,
    relL2  = ( Σ_i (u_i − u*_i)² / Σ_i u*_i² )^{1/2}.

relMax is the headline number; both are recorded. Note that the
evaluation points deliberately stay a modest distance inside the domain
(fraction 0.9 at most). Accuracy very close to the boundary is a genuine
and separate difficulty (the close-evaluation problem for integral
methods, boundary-layer resolution for grid methods) and a future
problem version may add a near-boundary target set; version 1 does not
test it.

## Timing protocol

One run is a full call of the solver, including its own discretization,
assembly, solve, and evaluation. The harness performs one untimed warmup
run (which absorbs numbl's JIT compilation and is recorded separately as
the cold time), then N timed runs (N = 3 unless stated), and reports the
median as the solve time. All timing is tic/toc inside the MATLAB
session, so browser and node runs measure the same thing. Times from
different machines are not comparable; every result records its
environment, and comparisons across environments are the reader's
responsibility.

## Solver interface

A solver is a MATLAB function file

    function out = solver(prob, n)

where n is the solver's own resolution parameter (its meaning is the
solver's choice; the standard sweep list is declared in the solver's
manifest) and prob is a struct with fields

| field | meaning |
|---|---|
| `prob.curve` | `@(t) -> [x y]`, boundary point at parameter t (column vectors in, m×2 out) |
| `prob.curveD` | first derivative of the curve with respect to t |
| `prob.curveDD` | second derivative |
| `prob.g` | `@(t) -> g`, Dirichlet data at boundary parameter t |
| `prob.evalXY` | 289×2, the evaluation points |
| `prob.vizXY` | m×2, visualization grid points (m = 0 when not requested) |

The return value is a struct: `out.uEval` (289×1, required) and
`out.uGrid` (m×1; `[]` when `prob.vizXY` is empty). The solver must not
reconstruct the sources analytically or otherwise special-case the known
solution; submissions are reviewed for this.

## Visualization grid

When requested, `prob.vizXY` lists a 200×200 grid of points over the
bounding square [−R, R]², R = 1.05(1 + |a|), with flat index
p = ix·200 + iy for x = xs[ix], y = xs[iy] (y varies fastest, MATLAB
meshgrid column order). Points outside Ω are included and the viewer
masks them; grid values are never scored.

## Limitations

The exact solution is smooth and free of boundary singularities, so this
problem does not test corner handling, nonsmooth data, or interior
sources (a nonzero right-hand side would exclude plain boundary-integral
methods; that belongs to a different problem). The domain family is
star-shaped by construction, which some methods can exploit.
