/// <reference lib="webworker" />
// The compute worker: runs numbl solves off the main thread. One request
// at a time; requests queue in the message queue while a sweep runs.

import { getInstance } from "../problems/laplace2d/spec";
import { getSolver } from "../solvers";
import { runSweep } from "../harness/sweep";
import { runPoint } from "../harness/runner";
import { toResultPoint, type ResultPoint } from "../harness/resultSchema";
import { matlabBase, solverSource } from "./matlabSources";

export interface SweepRequest {
  type: "sweep";
  id: number;
  instanceId: string;
  solverId: string;
  repeats: number;
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

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === "sweep") {
      const points = runSweep({
        instance: getInstance(msg.instanceId),
        solver: getSolver(msg.solverId),
        sources: { ...matlabBase(), solver: solverSource(msg.solverId) },
        repeats: msg.repeats,
        onPoint: (p, index, total) => {
          const resp: WorkerResponse = {
            type: "point",
            id: msg.id,
            point: toResultPoint(p),
            index,
            total,
          };
          postMessage(resp);
        },
      });
      const resp: WorkerResponse = {
        type: "sweepDone",
        id: msg.id,
        points: points.map(toResultPoint),
      };
      postMessage(resp);
    } else if (msg.type === "solution") {
      const p = runPoint({
        instance: getInstance(msg.instanceId),
        n: msg.n,
        repeats: 1,
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
