/// <reference lib="webworker" />
// The compute worker: runs solves off the main thread. One request at a
// time; requests queue in the message queue while a sweep runs. numbl
// solvers run synchronously here; a WebGPU solver runs on the worker's own
// device, which is why the handler is asynchronous.

import { getInstance } from "../problems/laplace2d/spec";
import { getSolver } from "../solvers";
import { runSweep } from "../harness/sweep";
import { runPoint, type RunPoint } from "../harness/runner";
import { runPointGpu, runSweepGpu } from "../harness/webgpuRun";
import { toResultPoint, type ResultPoint } from "../harness/resultSchema";
import { DEFAULT_TIMING, type TimingPolicy } from "../harness/timing";
import { matlabBase, solverSource } from "./matlabSources";

export interface SweepRequest {
  type: "sweep";
  id: number;
  instanceId: string;
  solverId: string;
  timing: TimingPolicy;
}

export interface SolutionRequest {
  type: "solution";
  id: number;
  instanceId: string;
  solverId: string;
  n: number;
}

export type WorkerRequest = SweepRequest | SolutionRequest;

export type WorkerResponse =
  | { type: "point"; id: number; point: ResultPoint; index: number; total: number }
  | { type: "sweepDone"; id: number; points: ResultPoint[] }
  | {
      type: "solutionDone";
      id: number;
      point: ResultPoint;
      uGrid: Float64Array;
    }
  | { type: "error"; id: number; message: string };

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === "sweep") {
      const solver = getSolver(msg.solverId);
      const instance = getInstance(msg.instanceId);
      const onPoint = (p: RunPoint, index: number, total: number) => {
        const resp: WorkerResponse = {
          type: "point",
          id: msg.id,
          point: toResultPoint(p),
          index,
          total,
        };
        postMessage(resp);
      };
      const points =
        solver.runtime === "webgpu"
          ? await runSweepGpu({ instance, solver, timing: msg.timing, onPoint })
          : runSweep({
              instance,
              solver,
              sources: { ...matlabBase(), solver: solverSource(msg.solverId) },
              timing: msg.timing,
              onPoint,
            });
      const resp: WorkerResponse = {
        type: "sweepDone",
        id: msg.id,
        points: points.map(toResultPoint),
      };
      postMessage(resp);
    } else if (msg.type === "solution") {
      const solver = getSolver(msg.solverId);
      const timing = { ...DEFAULT_TIMING, minTimedRuns: 1, timeBudgetSeconds: 0 };
      const p =
        solver.runtime === "webgpu"
          ? await runPointGpu({
              instance: getInstance(msg.instanceId),
              solverId: msg.solverId,
              n: msg.n,
              timing,
              wantGrid: true,
            })
          : runPoint({
              instance: getInstance(msg.instanceId),
              n: msg.n,
              timing,
              wantGrid: true,
              sources: { ...matlabBase(), solver: solverSource(msg.solverId) },
            });
      if (!p.uGrid) throw new Error("solver returned no grid values");
      const resp: WorkerResponse = {
        type: "solutionDone",
        id: msg.id,
        point: toResultPoint(p),
        uGrid: p.uGrid,
      };
      postMessage(resp, { transfer: [p.uGrid.buffer] });
    }
  } catch (err) {
    const resp: WorkerResponse = {
      type: "error",
      id: msg.id,
      message: err instanceof Error ? err.message : String(err),
    };
    postMessage(resp);
  }
};
