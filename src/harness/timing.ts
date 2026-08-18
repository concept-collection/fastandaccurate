// The timing policy, shared by the numbl runner and the MATLAB runner so
// that both measure the same way (see docs/problems/laplace-dirichlet-2d.md).
//
// A fixed repeat count times a cheap point badly: a solve of 0.1 ms is
// dominated by whatever the operating system was doing during those few
// hundred microseconds, and the min of five such samples still scatters by
// a factor of several from one sweep to the next, which is what made the
// low-resolution end of the work-precision curves noisy. So the count is
// adaptive: keep running timed repetitions until they have accumulated a
// real amount of work, subject to a floor on the count and a cap so that
// an expensive solve is not repeated forever. The reported time is still
// the minimum over the timed runs, and every timing is recorded.

export interface TimingPolicy {
  /** Timed runs never stop below this count. */
  minTimedRuns: number;
  /** Timed runs continue past the minimum until they have accumulated
   * this much time in total. */
  timeBudgetSeconds: number;
  /** Hard cap on the count. It bounds both the time a cheap point can
   * spend and the number of timings a result file has to carry. */
  maxTimedRuns: number;
}

export const DEFAULT_TIMING: TimingPolicy = {
  minTimedRuns: 5,
  timeBudgetSeconds: 0.5,
  maxTimedRuns: 50,
};

/**
 * MATLAB lines that run `call` under the policy and leave one timing per
 * run in `timesVar` (a column vector, trimmed to the number actually
 * run). The loop lives on the MATLAB side so that all timing is tic/toc
 * inside the solver's own runtime.
 */
export function timedRunLines(
  call: string,
  timesVar: string,
  policy: TimingPolicy
): string[] {
  const { minTimedRuns: min, maxTimedRuns: max, timeBudgetSeconds: budget } = policy;
  return [
    `${timesVar} = zeros(${max}, 1);`,
    "res_nrun = 0;",
    "res_tot = 0;",
    `while res_nrun < ${max} && (res_nrun < ${min} || res_tot < ${budget})`,
    `  tic; ${call}; res_one = toc;`,
    "  res_nrun = res_nrun + 1;",
    `  ${timesVar}(res_nrun) = res_one;`,
    "  res_tot = res_tot + res_one;",
    "end",
    `${timesVar} = ${timesVar}(1:res_nrun);`,
  ];
}
