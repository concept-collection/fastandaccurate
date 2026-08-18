// Host-side wrapper for the compute worker: one shared worker, one
// promise per request. Requests are serviced one at a time in order.

import type { WorkerRequest, WorkerResponse } from "./worker";
import type { ResultPoint } from "../harness/resultSchema";
import type { TimingPolicy } from "../harness/timing";

type Pending = {
  onPoint?: (point: ResultPoint, index: number, total: number) => void;
  resolve: (value: never) => void;
  reject: (err: Error) => void;
};

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const p = pending.get(msg.id);
      if (!p) return;
      if (msg.type === "point") {
        p.onPoint?.(msg.point, msg.index, msg.total);
      } else if (msg.type === "sweepDone") {
        pending.delete(msg.id);
        (p.resolve as (v: ResultPoint[]) => void)(msg.points);
      } else if (msg.type === "solutionDone") {
        pending.delete(msg.id);
        (p.resolve as (v: { point: ResultPoint; uGrid: Float64Array }) => void)({
          point: msg.point,
          uGrid: msg.uGrid,
        });
      } else if (msg.type === "error") {
        pending.delete(msg.id);
        p.reject(new Error(msg.message));
      }
    };
  }
  return worker;
}

function post(req: WorkerRequest) {
  getWorker().postMessage(req);
}

export function sweepInBrowser(
  instanceId: string,
  solverId: string,
  timing: TimingPolicy,
  onPoint: (point: ResultPoint, index: number, total: number) => void
): Promise<ResultPoint[]> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { onPoint, resolve: resolve as never, reject });
    post({ type: "sweep", id, instanceId, solverId, timing });
  });
}

export function solutionInBrowser(
  instanceId: string,
  solverId: string,
  n: number
): Promise<{ point: ResultPoint; uGrid: Float64Array }> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as never, reject });
    post({ type: "solution", id, instanceId, solverId, n });
  });
}
