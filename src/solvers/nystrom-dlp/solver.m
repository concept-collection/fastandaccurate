function out = solver(prob, n)
% Nystrom discretization of the double-layer boundary integral equation
% for the interior Dirichlet Laplace problem.
%
% The solution is represented as a double-layer potential
%   u(x) = (1/2pi) int_Gamma sigma(y) (x - y).n(y) / |x - y|^2 ds(y)
% whose interior boundary limit gives the second-kind equation
%   (W - I/2) sigma = g.
% W is discretized with the periodic trapezoid rule at n equispaced
% parameter nodes; the kernel is smooth on a smooth curve, with the
% diagonal limit -kappa(t) |x'(t)| / (4 pi). Convergence is geometric,
% at a rate set by how far the data g continues analytically. No
% correction is applied for targets close to the boundary, so the error
% of the evaluated potential at a target a distance delta inside behaves
% like exp(-2 pi delta / h) in the node spacing h (the close-evaluation
% problem). On most instances the evaluation points stay a modest
% distance inside and this costs nothing; on star-nearfield, whose
% closest target is 0.005 in, it is what limits the solver.
%
% n : number of boundary quadrature nodes.

h = 2*pi/n;
t = h*(0:n-1)';
xb = prob.curve(t);
dxb = prob.curveD(t);
ddxb = prob.curveDD(t);
sp = sqrt(dxb(:,1).^2 + dxb(:,2).^2);
nqx = dxb(:,2)./sp;
nqy = -dxb(:,1)./sp;

% M(i,j) = (1/2pi) (x_i - x_j).n(x_j) / |x_i - x_j|^2 * |x'(t_j)|
dx = repmat(xb(:,1), 1, n) - repmat(xb(:,1)', n, 1);
dy = repmat(xb(:,2), 1, n) - repmat(xb(:,2)', n, 1);
r2 = dx.^2 + dy.^2;
num = dx.*repmat(nqx', n, 1) + dy.*repmat(nqy', n, 1);
M = (num./r2).*repmat(sp', n, 1)/(2*pi);

% Diagonal limit: -kappa/2 * |x'| / (2 pi), kappa the signed curvature.
kap = (dxb(:,1).*ddxb(:,2) - dxb(:,2).*ddxb(:,1))./sp.^3;
md = -(kap/2).*sp/(2*pi);
for i = 1:n
  M(i, i) = md(i);
end

sigma = (h*M - 0.5*eye(n)) \ prob.g(t);

out = struct();
out.uEval = dlp_eval(prob.evalXY, xb, nqx, nqy, h*sp.*sigma);
if size(prob.vizXY, 1) > 0
  out.uGrid = dlp_eval(prob.vizXY, xb, nqx, nqy, h*sp.*sigma);
else
  out.uGrid = zeros(0, 1);
end

end

function u = dlp_eval(XY, xb, nqx, nqy, w)
% Evaluate the double-layer potential with combined weights w at the
% rows of XY, in blocks to bound memory.
m = size(XY, 1);
nb = size(xb, 1);
u = zeros(m, 1);
B = 4000;
for i0 = 1:B:m
  i1 = min(i0 + B - 1, m);
  mm = i1 - i0 + 1;
  dx = repmat(XY(i0:i1, 1), 1, nb) - repmat(xb(:,1)', mm, 1);
  dy = repmat(XY(i0:i1, 2), 1, nb) - repmat(xb(:,2)', mm, 1);
  r2 = dx.^2 + dy.^2;
  K = (dx.*repmat(nqx', mm, 1) + dy.*repmat(nqy', mm, 1))./r2/(2*pi);
  u(i0:i1) = K*w;
end
end
