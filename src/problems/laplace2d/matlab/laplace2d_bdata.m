function g = laplace2d_bdata(t, r, sx, sy, c)
% LAPLACE2D_BDATA  Dirichlet data for laplace-dirichlet-2d.
% Evaluates u(x(t)) = sum_j c_j log|x(t) - s_j| at boundary parameters t,
% given the boundary radius r = r(t) at those parameters (which family the
% radius came from does not matter here). Called through the prob.g handle
% built in build_problem; solvers see only that handle.
x = r.*cos(t);
y = r.*sin(t);
g = zeros(size(t));
for j = 1:numel(c)
  g = g + c(j)*0.5*log((x - sx(j)).^2 + (y - sy(j)).^2);
end
end
