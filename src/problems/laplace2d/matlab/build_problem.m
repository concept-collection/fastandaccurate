function prob = build_problem(a, k, d, family, wantGrid)
% BUILD_PROBLEM  Assemble the problem struct for laplace-dirichlet-2d.
%
% The domain is the star-shaped region bounded by
%   x(t) = r(t) [cos t; sin t],  r(t) = 1 + a cos(k t),  t in [0, 2 pi).
% The exact solution depends on the data family:
%   family 0 (log-sources): u(x) = sum_j c_j log|x - s_j|, with three
%     point sources s_j outside the domain: s_j is the boundary point at
%     parameter phi_j = 2 pi (j-1)/3 + 0.4 pushed a distance d along the
%     outward unit normal, with strengths c = [1.0; -0.6; 0.8].
%   family 1 (branch-point): u(z) = Re sqrt(-(z - z0) e^{-i th0}), with
%     z0 the boundary point at parameter 0.4 pushed a distance d along
%     the outward unit normal and th0 its polar angle (see
%     laplace2d_bdata_branch.m).
%
% The solver receives only the curve (with derivatives), the Dirichlet
% data g as a function of the boundary parameter, and the points where
% the solution is requested. The singularities exist here only to
% manufacture the data; a submitted solver must not use knowledge of
% them.
%
% Fields of prob:
%   curve   @(t) -> [x y]        boundary point, t column vector
%   curveD  @(t) -> [x' y']      first derivative
%   curveDD @(t) -> [x'' y'']    second derivative
%   g       @(t) -> g            Dirichlet data at boundary parameter t
%   evalXY  289 x 2              points where uEval is required
%   vizXY   m x 2                grid points where uGrid is requested
%                                (m = 0 when no visualization is wanted)

if family == 1
  phi = 0.4;
else
  phi = 2*pi*[0; 1; 2]/3 + 0.4;
end
c = [1.0; -0.6; 0.8];
rphi = 1 + a*cos(k*phi);
bx = rphi.*cos(phi);
by = rphi.*sin(phi);
dxb = -a*k*sin(k*phi).*cos(phi) - rphi.*sin(phi);
dyb = -a*k*sin(k*phi).*sin(phi) + rphi.*cos(phi);
sp = sqrt(dxb.^2 + dyb.^2);
sx = bx + d*(dyb./sp);
sy = by - d*(dxb./sp);

prob = struct();
prob.curve = @(t) [(1 + a*cos(k*t)).*cos(t), (1 + a*cos(k*t)).*sin(t)];
prob.curveD = @(t) [-a*k*sin(k*t).*cos(t) - (1 + a*cos(k*t)).*sin(t), ...
                    -a*k*sin(k*t).*sin(t) + (1 + a*cos(k*t)).*cos(t)];
prob.curveDD = @(t) [(-a*k*k*cos(k*t) - 1 - a*cos(k*t)).*cos(t) + 2*a*k*sin(k*t).*sin(t), ...
                     (-a*k*k*cos(k*t) - 1 - a*cos(k*t)).*sin(t) - 2*a*k*sin(k*t).*cos(t)];
if family == 1
  th0 = atan2(sy(1), sx(1));
  prob.g = @(t) laplace2d_bdata_branch(t, a, k, sx(1), sy(1), th0);
else
  prob.g = @(t) laplace2d_bdata(t, a, k, sx, sy, c);
end

% Evaluation points: 32 rays, radial fractions 0.1..0.9, plus the origin
% (289 points). The rule must match evalPoints() in
% src/problems/laplace2d/exact.ts.
rho = (1:9)'/10;
th = 2*pi*(0:31)'/32 + 0.13;
pts = zeros(numel(rho)*numel(th) + 1, 2);
idx = 1;
for i = 1:numel(rho)
  for j = 1:numel(th)
    rr = rho(i)*(1 + a*cos(k*th(j)));
    pts(idx, 1) = rr*cos(th(j));
    pts(idx, 2) = rr*sin(th(j));
    idx = idx + 1;
  end
end
prob.evalXY = pts;

% Visualization grid: ngrid x ngrid points over the bounding square,
% listed with y varying fastest (MATLAB column order). Points outside
% the domain are included; the viewer masks them.
if wantGrid
  ngrid = 200;
  R = 1.05*(1 + abs(a));
  xs = linspace(-R, R, ngrid);
  [X, Y] = meshgrid(xs, xs);
  prob.vizXY = [X(:), Y(:)];
else
  prob.vizXY = zeros(0, 2);
end

end
