function out = solver(prob, n)
% Method of fundamental solutions (MFS) for the interior Dirichlet
% Laplace problem.
%
% The solution is represented as a sum of n logarithmic point charges
% placed on a fictitious curve outside the domain: each charge sits at
% the boundary point of parameter t_j pushed a fixed distance delta
% along the outward normal. Charge strengths are found by collocation
% of the Dirichlet data at the n boundary points t_j (a square dense
% system). Convergence is geometric when the solution continues
% harmonically past the charge curve; when the data has singularities
% closer to the boundary than delta, the method stagnates. The system
% grows exponentially ill-conditioned with n, which caps the attainable
% accuracy near 1e-10.
%
% n : number of charges = number of collocation points.

delta = 0.3;

t = 2*pi*(0:n-1)'/n;
xb = prob.curve(t);
dxb = prob.curveD(t);
sp = sqrt(dxb(:,1).^2 + dxb(:,2).^2);
nx = dxb(:,2)./sp;
ny = -dxb(:,1)./sp;
qx = xb(:,1) + delta*nx;
qy = xb(:,2) + delta*ny;

A = kernel_matrix(xb(:,1), xb(:,2), qx, qy);
coef = A \ prob.g(t);

out = struct();
out.uEval = apply_potential(prob.evalXY, qx, qy, coef);
if size(prob.vizXY, 1) > 0
  out.uGrid = apply_potential(prob.vizXY, qx, qy, coef);
else
  out.uGrid = zeros(0, 1);
end

end

function A = kernel_matrix(px, py, qx, qy)
% A(i,j) = log|p_i - q_j|
m = numel(px);
nq = numel(qx);
dx = repmat(px, 1, nq) - repmat(qx', m, 1);
dy = repmat(py, 1, nq) - repmat(qy', m, 1);
A = 0.5*log(dx.^2 + dy.^2);
end

function u = apply_potential(XY, qx, qy, coef)
% Evaluate the charge sum at the rows of XY, in blocks to bound memory.
m = size(XY, 1);
u = zeros(m, 1);
B = 4000;
for i0 = 1:B:m
  i1 = min(i0 + B - 1, m);
  u(i0:i1) = kernel_matrix(XY(i0:i1, 1), XY(i0:i1, 2), qx, qy)*coef;
end
end
