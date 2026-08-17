function out = solver(prob, n)
% chunkie double-layer BIE for the interior Dirichlet Laplace problem.
%
% The same second-kind double-layer formulation as nystrom-dlp,
% (D - I/2) sigma = g, but discretized and solved by
% chunkie (https://github.com/fastalgorithms/chunkie), a production
% MATLAB toolbox for boundary integral equations in 2D: the curve is
% panelized into n uniform 16th-order Gauss-Legendre chunks, chunkermat
% assembles the system with high-order singular quadrature, the dense
% system is solved directly, and chunkerkerneval evaluates the potential
% with corrected quadrature for targets near the boundary.
%
% This solver runs in real MATLAB only: the command-line harness invokes
% it through `matlab -batch` with chunkie on the path (fetched on first
% use). It is not runnable in the browser.
%
% n : number of chunks (16 points each).

chnkr = chunkerfuncuni(@(t) fcurve(t, prob), n);

% Dirichlet data at the nodes: for this problem family the curve
% parameter is the polar angle, so it is recovered from the node
% coordinates.
xy = chnkr.r(:, :);
tt = mod(atan2(xy(2, :), xy(1, :)), 2*pi);
rhs = prob.g(tt(:));

fkern = kernel('lap', 'd');
sysmat = chunkermat(chnkr, fkern);
sysmat = sysmat - 0.5*eye(chnkr.npt);
sigma = sysmat \ rhs;

out = struct();
out.uEval = eval_targets(chnkr, fkern, sigma, prob.evalXY);
if size(prob.vizXY, 1) > 0
  out.uGrid = eval_targets(chnkr, fkern, sigma, prob.vizXY);
else
  out.uGrid = zeros(0, 1);
end

end

function u = eval_targets(chnkr, fkern, sigma, XY)
% Direct (unaccelerated) evaluation, in blocks to bound memory. accel is
% disabled so that the FLAM/fmm2d submodules are not required; at these
% sizes direct evaluation is cheap anyway.
opts = struct();
opts.accel = false;
m = size(XY, 1);
u = zeros(m, 1);
B = 2000;
for i0 = 1:B:m
  i1 = min(i0 + B - 1, m);
  ub = chunkerkerneval(chnkr, fkern, sigma, XY(i0:i1, :).', opts);
  u(i0:i1) = ub(:);
end
end

function [r, d, d2] = fcurve(t, prob)
tt = t(:);
r = prob.curve(tt).';
d = prob.curveD(tt).';
d2 = prob.curveDD(tt).';
end
