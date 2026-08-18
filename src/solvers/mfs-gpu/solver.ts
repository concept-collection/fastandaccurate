// Method of fundamental solutions on WebGPU.
//
// The same method as src/solvers/mfs/solver.m: n logarithmic point charges
// on a curve a fixed distance 0.3 outside the boundary, their strengths
// found by collocating the Dirichlet data at n boundary points, and the
// potential evaluated at the requested targets. What differs is where the
// work happens. The assembly, the dense solve, and the evaluation all run
// as WebGPU compute passes; the host does only the O(n) geometry, in f64,
// the way shtns-webgpu and the rest of the WebGPU work in this collection
// keep precomputation on the CPU.
//
// The solve is a right-looking LU with partial pivoting, three dispatches
// per column: pivot search and row swap in one workgroup, the multipliers,
// then the rank-one update of the trailing submatrix. There is no blocking
// and no GEMM, so it is memory-bound rather than compute-bound; it is the
// straightforward implementation, and a blocked panel factorization would
// be the next thing to try. The right-hand side rides along as an extra
// matrix column, which is what makes forward substitution disappear; back
// substitution is one dispatch per column after that. A sweep at n = 768
// therefore encodes about 3000 dispatches, all into one command buffer and
// one submit.
//
// Everything is f32: WebGPU has no double precision, which is what caps
// this solver's accuracy well short of the same method on the CPU. See
// ./wgsl.ts.

import { requestGpu } from "../../harness/webgpuDevice";
import type { Laplace2dProblem } from "../../problems/laplace2d/problem";
import { EVAL_GROUP, LANES, mfsShader, TILE } from "./wgsl";

/** Distance of the charge curve outside the boundary, as in mfs/solver.m. */
const DELTA = 0.3;

const KERNELS = [
  "assemble",
  "pivot",
  "multipliers",
  "update",
  "backsub",
  "evaluate",
] as const;
type Kernel = (typeof KERNELS)[number];

export interface GpuMfsResult {
  uEval: Float64Array;
  uGrid: Float64Array | null;
}

function ceilDiv(a: number, b: number): number {
  return Math.ceil(a / b);
}

export class MfsGpu {
  private constructor(
    private readonly device: GPUDevice,
    private readonly layout: GPUBindGroupLayout,
    private readonly pipelines: Record<Kernel, GPUComputePipeline>,
    private readonly stepStride: number,
    /** The adapter, for the result file's environment record. */
    readonly adapter: string,
    readonly via: string
  ) {}

  /** Compile the shader and build the pipelines. Done once per device; a
   * solver call reuses them, which is where numbl's JIT sits too. */
  static async create(): Promise<MfsGpu> {
    const { device, adapter, via } = await requestGpu();
    const module = device.createShaderModule({
      code: mfsShader(),
      label: "mfs-gpu",
    });
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter((m) => m.type === "error");
    if (errors.length > 0) {
      throw new Error(
        "mfs-gpu failed to compile:\n" +
          errors.map((m) => `  ${m.lineNum}:${m.linePos} ${m.message}`).join("\n")
      );
    }
    const layout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform", hasDynamicOffset: true, minBindingSize: 16 },
        },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
      ],
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    const built = await Promise.all(
      KERNELS.map((k) =>
        device.createComputePipelineAsync({
          layout: pipelineLayout,
          compute: { module, entryPoint: k },
          label: `mfs-gpu ${k}`,
        })
      )
    );
    const pipelines = Object.fromEntries(
      KERNELS.map((k, i) => [k, built[i]])
    ) as Record<Kernel, GPUComputePipeline>;
    return new MfsGpu(
      device,
      layout,
      pipelines,
      Math.max(16, device.limits.minUniformBufferOffsetAlignment),
      adapter,
      via
    );
  }

  private checked = false;

  /**
   * One full solve at resolution n: the timed unit of the protocol, so it
   * includes the host geometry, the buffer allocation, the assembly, the
   * factorization, the evaluation, and the read-back.
   */
  async run(
    prob: Laplace2dProblem,
    n: number,
    wantGrid = false
  ): Promise<GpuMfsResult> {
    const { device } = this;
    const ld = n + 1;
    const nGrid = wantGrid ? prob.nViz : 0;
    const m = prob.nEval + nGrid;
    const bytes = 4;

    // --- host geometry, in f64, rounded once on the way to the device --
    const data = new Float32Array(5 * n + 2 * m);
    const put = (index: number, v: number) => {
      data[index] = v;
    };
    for (let j = 0; j < n; j++) {
      const t = (2 * Math.PI * j) / n;
      const p = prob.curve(t);
      const d = prob.curveD(t);
      const sp = Math.hypot(d.x, d.y);
      // The outward unit normal of the counterclockwise curve.
      put(2 * j, p.x);
      put(2 * j + 1, p.y);
      put(2 * n + 2 * j, p.x + (DELTA * d.y) / sp);
      put(2 * n + 2 * j + 1, p.y - (DELTA * d.x) / sp);
      put(4 * n + j, prob.g(t));
    }
    for (let i = 0; i < prob.nEval; i++) {
      put(5 * n + 2 * i, prob.evalXY[2 * i]);
      put(5 * n + 2 * i + 1, prob.evalXY[2 * i + 1]);
    }
    for (let i = 0; i < nGrid; i++) {
      const o = 5 * n + 2 * (prob.nEval + i);
      put(o, prob.vizXY[2 * i]);
      put(o + 1, prob.vizXY[2 * i + 1]);
    }

    // --- buffers -----------------------------------------------------
    const S = GPUBufferUsage.STORAGE;
    const buffers = {
      dims: device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }),
      step: device.createBuffer({
        size: Math.max(this.stepStride * Math.max(n, 1), this.stepStride),
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      }),
      data: device.createBuffer({ size: data.byteLength, usage: S | GPUBufferUsage.COPY_DST }),
      mat: device.createBuffer({ size: n * ld * bytes, usage: S }),
      lcol: device.createBuffer({ size: n * bytes, usage: S }),
      sol: device.createBuffer({ size: n * bytes, usage: S }),
      out: device.createBuffer({ size: m * bytes, usage: S | GPUBufferUsage.COPY_SRC }),
      read: device.createBuffer({
        size: m * bytes,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      }),
    };
    try {
      device.queue.writeBuffer(buffers.dims, 0, new Uint32Array([n, ld, m, 0]));
      // One slot per elimination step, so k reaches the shader through a
      // dynamic uniform offset and the whole sweep needs one bind group.
      const steps = new Uint32Array((this.stepStride / 4) * Math.max(n, 1));
      for (let k = 0; k < n; k++) steps[k * (this.stepStride / 4)] = k;
      device.queue.writeBuffer(buffers.step, 0, steps);
      device.queue.writeBuffer(buffers.data, 0, data);

      const bind = device.createBindGroup({
        layout: this.layout,
        entries: [
          { binding: 0, resource: { buffer: buffers.dims } },
          { binding: 1, resource: { buffer: buffers.step, size: 16 } },
          { binding: 2, resource: { buffer: buffers.data } },
          { binding: 3, resource: { buffer: buffers.mat } },
          { binding: 4, resource: { buffer: buffers.lcol } },
          { binding: 5, resource: { buffer: buffers.sol } },
          { binding: 6, resource: { buffer: buffers.out } },
        ],
      });

      // The first run of a session is checked for validation errors, which
      // is a host round trip and so does not belong in a timed run; the
      // protocol's untimed warmups absorb it.
      const check = !this.checked;
      if (check) device.pushErrorScope("validation");

      const enc = device.createCommandEncoder();
      const pass = enc.beginComputePass();
      const P = this.pipelines;
      // WebGPU orders dispatches within a pass and makes each one's writes
      // visible to the next, so the dependences here need no barriers.
      pass.setPipeline(P.assemble);
      pass.setBindGroup(0, bind, [0]);
      pass.dispatchWorkgroups(ceilDiv(ld, TILE), ceilDiv(n, TILE));
      for (let k = 0; k < n; k++) {
        const off = k * this.stepStride;
        pass.setPipeline(P.pivot);
        pass.setBindGroup(0, bind, [off]);
        pass.dispatchWorkgroups(1);
        const rows = n - 1 - k;
        if (rows > 0) {
          pass.setPipeline(P.multipliers);
          pass.setBindGroup(0, bind, [off]);
          pass.dispatchWorkgroups(ceilDiv(rows, LANES));
          pass.setPipeline(P.update);
          pass.setBindGroup(0, bind, [off]);
          pass.dispatchWorkgroups(ceilDiv(ld - 1 - k, TILE), ceilDiv(rows, TILE));
        }
      }
      for (let k = n - 1; k >= 0; k--) {
        pass.setPipeline(P.backsub);
        pass.setBindGroup(0, bind, [k * this.stepStride]);
        pass.dispatchWorkgroups(1);
      }
      pass.setPipeline(P.evaluate);
      pass.setBindGroup(0, bind, [0]);
      pass.dispatchWorkgroups(ceilDiv(m, EVAL_GROUP));
      pass.end();
      enc.copyBufferToBuffer(buffers.out, 0, buffers.read, 0, m * bytes);
      device.queue.submit([enc.finish()]);

      await buffers.read.mapAsync(GPUMapMode.READ);
      const raw = new Float32Array(buffers.read.getMappedRange().slice(0));
      buffers.read.unmap();

      if (check) {
        this.checked = true;
        const err = await device.popErrorScope();
        if (err) throw new Error(`mfs-gpu: WebGPU validation: ${err.message}`);
      }

      const all = Float64Array.from(raw.subarray(0, m));
      return {
        uEval: all.slice(0, prob.nEval),
        uGrid: wantGrid ? all.slice(prob.nEval) : null,
      };
    } finally {
      for (const b of Object.values(buffers)) b.destroy();
    }
  }
}
