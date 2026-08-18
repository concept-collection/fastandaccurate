function prob = build_problem(a, k, p, d, wantGrid, nearBoundary)
% BUILD_PROBLEM  Assemble the problem struct for laplace-dirichlet-2d.
%
% The domain is bounded by one of two analytic curves, selected by p:
%
%   p == 0   the star family, r(t) = 1 + a cos(k t),
%   p > 0    the rounded square, r(t) = (cos^p t + sin^p t)^(-1/p), which
%            traces the superellipse |x|^p + |y|^p = 1: four nearly
%            straight sides meeting at four corners of radius about 1.4/p.
%            a and k are unused. p must be even, which keeps the curve
%            analytic, so curveDD exists everywhere as the interface
%            requires.
%
% In both cases x(t) = r(t) [cos t; sin t], t in [0, 2 pi).
%
% nearBoundary (default 0) adds the near-boundary target set to the
% evaluation points: four points per parameter just inside the boundary
% along the inward normal, at eight parameters around the curve.
%
% The exact solution is u(x) = sum_j c_j log|x - s_j|, with three point
% sources outside the domain: s_j is the boundary point at parameter
% phi_j = 2 pi (j-1)/3 + 0.4 pushed a distance d along the outward unit
% normal, with strengths c = [1.0; -0.6; 0.8].
%
% The solver receives only the curve (with derivatives), the Dirichlet
% data g as a function of the boundary parameter, and the points where
% the solution is requested. The sources exist here only to manufacture
% the data; a submitted solver must not use knowledge of them.
%
% Fields of prob:
%   curve   @(t) -> [x y]        boundary point, t column vector
%   curveD  @(t) -> [x' y']      first derivative
%   curveDD @(t) -> [x'' y'']    second derivative
%   g       @(t) -> g            Dirichlet data at boundary parameter t
%   evalXY  m x 2                points where uEval is required (289; 305
%                                on an instance with corners, 321 on one
%                                with the near-boundary set)
%   vizXY   m x 2                grid points where uGrid is requested
%                                (m = 0 when no visualization is wanted)

if nargin < 6
  nearBoundary = 0;
end

corners = p > 0;

if corners
  prob = struct();
  prob.curve = @(t) sq_xy(t, p);
  prob.curveD = @(t) sq_xyd(t, p);
  prob.curveDD = @(t) sq_xydd(t, p);
  radius = @(t) sq_r(t, p);
  radiusD = @(t) sq_rd(t, p);
  rmax = sq_r(pi/4, p);
else
  prob = struct();
  prob.curve = @(t) [(1 + a*cos(k*t)).*cos(t), (1 + a*cos(k*t)).*sin(t)];
  prob.curveD = @(t) [-a*k*sin(k*t).*cos(t) - (1 + a*cos(k*t)).*sin(t), ...
                      -a*k*sin(k*t).*sin(t) + (1 + a*cos(k*t)).*cos(t)];
  prob.curveDD = @(t) [(-a*k*k*cos(k*t) - 1 - a*cos(k*t)).*cos(t) + 2*a*k*sin(k*t).*sin(t), ...
                       (-a*k*k*cos(k*t) - 1 - a*cos(k*t)).*sin(t) - 2*a*k*sin(k*t).*cos(t)];
  radius = @(t) 1 + a*cos(k*t);
  radiusD = @(t) -a*k*sin(k*t);
  rmax = 1 + abs(a);
end

% The three sources: boundary points at phi_j pushed d along the outward
% normal. The normal comes from the radius and its derivative, so this is
% the same formula for both families.
phi = 2*pi*[0; 1; 2]/3 + 0.4;
c = [1.0; -0.6; 0.8];
rphi = radius(phi);
drphi = radiusD(phi);
bx = rphi.*cos(phi);
by = rphi.*sin(phi);
dxb = drphi.*cos(phi) - rphi.*sin(phi);
dyb = drphi.*sin(phi) + rphi.*cos(phi);
sp = sqrt(dxb.^2 + dyb.^2);
sx = bx + d*(dyb./sp);
sy = by - d*(dxb./sp);

prob.g = @(t) laplace2d_bdata(t, radius(t), sx, sy, c);

% Evaluation points: 32 rays, radial fractions 0.1..0.9, plus the origin
% (289 points). On an instance with corners, four further points per
% corner follow, just inside the boundary along the corner's diagonal
% (305 points). On an instance carrying the near-boundary set, four
% further points per parameter follow after those, at the same four
% distances inside the boundary but along the inward unit normal, at
% eight parameters around the curve (321 points). The rule must match
% evalPoints() in src/problems/laplace2d/exact.ts.
rho = (1:9)'/10;
th = 2*pi*(0:31)'/32 + 0.13;
deltas = [0.005; 0.01; 0.02; 0.05];
if corners
  cth = pi/4 + pi*(0:3)'/2;
else
  cth = zeros(0, 1);
end
if nearBoundary
  ntt = 2*pi*(0:7)'/8 + 0.07;
else
  ntt = zeros(0, 1);
end
npts = numel(rho)*numel(th) + 1 + (numel(cth) + numel(ntt))*numel(deltas);
pts = zeros(npts, 2);
idx = 1;
for i = 1:numel(rho)
  for j = 1:numel(th)
    rr = rho(i)*radius(th(j));
    pts(idx, 1) = rr*cos(th(j));
    pts(idx, 2) = rr*sin(th(j));
    idx = idx + 1;
  end
end
pts(idx, 1) = 0;
pts(idx, 2) = 0;
idx = idx + 1;
for i = 1:numel(cth)
  rc = radius(cth(i));
  for j = 1:numel(deltas)
    pts(idx, 1) = (rc - deltas(j))*cos(cth(i));
    pts(idx, 2) = (rc - deltas(j))*sin(cth(i));
    idx = idx + 1;
  end
end
% The inward normal of the counterclockwise curve is -(y', -x')/|x'|.
rn = radius(ntt);
drn = radiusD(ntt);
dxn = drn.*cos(ntt) - rn.*sin(ntt);
dyn = drn.*sin(ntt) + rn.*cos(ntt);
spn = sqrt(dxn.^2 + dyn.^2);
for i = 1:numel(ntt)
  for j = 1:numel(deltas)
    pts(idx, 1) = rn(i)*cos(ntt(i)) - deltas(j)*dyn(i)/spn(i);
    pts(idx, 2) = rn(i)*sin(ntt(i)) + deltas(j)*dxn(i)/spn(i);
    idx = idx + 1;
  end
end
prob.evalXY = pts;

% Visualization grid: ngrid x ngrid points over the bounding square,
% listed with y varying fastest (MATLAB column order). Points outside
% the domain are included; the viewer masks them.
if wantGrid
  ngrid = 200;
  R = 1.05*rmax;
  xs = linspace(-R, R, ngrid);
  [X, Y] = meshgrid(xs, xs);
  prob.vizXY = [X(:), Y(:)];
else
  prob.vizXY = zeros(0, 2);
end

end

% --- the rounded-square radius and its derivatives ---------------------
%
% With f(t) = cos^p t + sin^p t, the radius is r = f^(-1/p). For p in the
% hundreds f underflows near the diagonals, so r goes through a logarithm
% and the derivatives are written with the ratios f'/f and f''/f, which
% stay of moderate size.

function r = sq_r(t, p)
c = cos(t); s = sin(t);
r = exp(-log(c.^p + s.^p)/p);
end

function r1 = sq_rd(t, p)
c = cos(t); s = sin(t);
f = c.^p + s.^p;
fp = p*(s.^(p-1).*c - c.^(p-1).*s);
r1 = -(sq_r(t, p)/p).*(fp./f);
end

function r2 = sq_rdd(t, p)
c = cos(t); s = sin(t);
f = c.^p + s.^p;
fp = p*(s.^(p-1).*c - c.^(p-1).*s);
fpp = p*((p-1)*(s.^(p-2).*c.^2 + c.^(p-2).*s.^2) - f);
u = fp./f;
v = fpp./f;
r2 = sq_r(t, p).*((1/p)*(1/p + 1)*u.^2 - v/p);
end

function xy = sq_xy(t, p)
r = sq_r(t, p);
xy = [r.*cos(t), r.*sin(t)];
end

function xy = sq_xyd(t, p)
r = sq_r(t, p);
r1 = sq_rd(t, p);
xy = [r1.*cos(t) - r.*sin(t), r1.*sin(t) + r.*cos(t)];
end

function xy = sq_xydd(t, p)
r = sq_r(t, p);
r1 = sq_rd(t, p);
r2 = sq_rdd(t, p);
xy = [r2.*cos(t) - 2*r1.*sin(t) - r.*cos(t), ...
      r2.*sin(t) + 2*r1.*cos(t) - r.*sin(t)];
end
