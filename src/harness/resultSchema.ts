// The result-file format committed to the fastandaccurate-results repo.
// One file holds one work-precision sweep: one problem instance, one
// solver, one environment.

import {
  canonicalSpec,
  canonicalSpecJson,
  PROBLEM_ID,
  PROBLEM_VERSION,
  type Laplace2dInstance,
} from "../problems/laplace2d/spec";
import type { RunPoint } from "./runner";

export const RESULT_FORMAT = "fastandaccurate-result";
export const RESULT_FORMAT_VERSION = 1;

export interface ResultEnvironment {
  kind: "browser" | "node" | "matlab";
  /** User agent (browser), node version (node), or MATLAB version. */
  runtime: string;
  /** Absent for runs outside numbl (e.g. real MATLAB). */
  numblVersion?: string;
  os?: string;
  cpu?: string;
  /** Free-text label a human recognizes ("office workstation"). */
  machineLabel?: string;
  /** Whether a visitor can rerun this result in the browser. */
  browserReproducible: boolean;
}

export interface ResultPoint {
  n: number;
  solveSeconds: number;
  solveSecondsAll: number[];
  coldSeconds: number;
  relMax: number;
  relL2: number;
}

export interface ResultFile {
  format: typeof RESULT_FORMAT;
  formatVersion: typeof RESULT_FORMAT_VERSION;
  problem: string;
  problemVersion: number;
  instance: string;
  spec: Record<string, unknown>;
  specHash: string;
  solver: {
    id: string;
    version: string;
    backend: "cpu" | "gpu";
    /** "builtin" for solvers in the fastandaccurate repo; otherwise a
     * URL or free-text pointer to the solver's source. */
    source: string;
  };
  environment: ResultEnvironment;
  protocol: {
    warmupRuns: number;
    timedRuns: number;
    timer: string;
  };
  createdUtc: string;
  points: ResultPoint[];
}

/** SHA-256 hex digest, using WebCrypto (browser, worker, node >= 20). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function toResultPoint(p: RunPoint): ResultPoint {
  return {
    n: p.n,
    solveSeconds: p.solveSeconds,
    solveSecondsAll: p.solveSecondsAll,
    coldSeconds: p.coldSeconds,
    relMax: p.relMax,
    relL2: p.relL2,
  };
}

export async function buildResultFile(opts: {
  instance: Laplace2dInstance;
  solver: { id: string; version: string; backend: "cpu" | "gpu"; source: string };
  environment: ResultEnvironment;
  repeats: number;
  points: ResultPoint[];
  /** What measured the times (default numbl tic/toc). */
  timer?: string;
}): Promise<ResultFile> {
  return {
    format: RESULT_FORMAT,
    formatVersion: RESULT_FORMAT_VERSION,
    problem: PROBLEM_ID,
    problemVersion: PROBLEM_VERSION,
    instance: opts.instance.id,
    spec: canonicalSpec(opts.instance) as unknown as Record<string, unknown>,
    specHash: await sha256Hex(canonicalSpecJson(opts.instance)),
    solver: opts.solver,
    environment: opts.environment,
    protocol: {
      warmupRuns: 1,
      timedRuns: opts.repeats,
      timer: opts.timer ?? "numbl tic/toc",
    },
    createdUtc: new Date().toISOString(),
    points: opts.points,
  };
}
