function g = laplace2d_bdata_branch(t, a, k, x0, y0, th0)
% LAPLACE2D_BDATA_BRANCH  Dirichlet data for the branch-point family.
% The exact solution is u*(z) = Re sqrt(w), w = -(z - z0) e^{-i th0},
% with z0 = x0 + i y0 the branch point and th0 its polar angle. The
% principal branch cut w <= 0 maps to the radial ray from z0 away from
% the origin, which never meets a domain star-shaped about the origin,
% so u* is harmonic on the closed domain. Evaluated in real arithmetic:
% Re sqrt(w) = sqrt((|w| + Re w)/2).
% Called through the prob.g handle built in build_problem; solvers see
% only that handle. Must match the branch-point case of exactU in
% src/problems/laplace2d/exact.ts.
r = 1 + a*cos(k*t);
x = r.*cos(t);
y = r.*sin(t);
dx = x - x0;
dy = y - y0;
wre = -(dx*cos(th0) + dy*sin(th0));
wim = -(dy*cos(th0) - dx*sin(th0));
g = sqrt((sqrt(wre.^2 + wim.^2) + wre)/2);
end
