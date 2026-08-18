// Getting a WebGPU device, in the browser and outside it.
//
// In the browser navigator.gpu is there or it is not. In node it comes from
// the optional `webgpu` package (prebuilt Google Dawn), imported through a
// variable specifier so that neither the site bundle nor the command line
// bundle tries to resolve a native module at build time. The package is an
// optionalDependency and is 68 MB, so the command line does not ship it:
// a run without it skips the WebGPU solvers the same way a run without
// matlab on the PATH skips the MATLAB ones.

export interface GpuEnvironment {
  device: GPUDevice;
  /** Adapter description for the result file's environment record. */
  adapter: string;
  /** How WebGPU was reached, for the same record. */
  via: string;
}

let cached: Promise<GpuEnvironment> | null = null;

/** Whether this is node rather than a page or a worker, which decides
 * whether a missing navigator.gpu means "install Dawn" or "this browser
 * does not have WebGPU". */
function isNode(): boolean {
  return typeof process !== "undefined" && !!process.versions?.node;
}

async function installNodeWebGpu(): Promise<string> {
  const specifier = "webgpu";
  let mod: { create: (flags: string[]) => GPU; globals: Record<string, unknown> };
  try {
    mod = (await import(/* @vite-ignore */ specifier)) as typeof mod;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    if (/Cannot find (package|module) '?webgpu'?/.test(detail)) {
      throw new Error(
        "WebGPU outside the browser needs the optional `webgpu` package " +
          "(prebuilt Google Dawn): npm install webgpu"
      );
    }
    // Installed but unloadable is a different problem from missing, and
    // reporting it as missing sends people in circles.
    throw new Error(`the \`webgpu\` package is installed but did not load: ${detail}`);
  }
  Object.assign(globalThis, mod.globals);
  Object.defineProperty(globalThis, "navigator", {
    value: { gpu: mod.create([]) },
    configurable: true,
    writable: true,
  });
  return "node-webgpu (Google Dawn)";
}

/** A device, requested once and shared. Throws with an actionable message
 * when there is no WebGPU here. */
export function requestGpu(): Promise<GpuEnvironment> {
  cached ??= (async () => {
    let via: string;
    if (typeof navigator !== "undefined" && navigator.gpu) {
      via = "browser";
    } else if (isNode()) {
      via = await installNodeWebGpu();
    } else {
      throw new Error(
        "this browser has no WebGPU: navigator.gpu is absent. Chrome and " +
          "Edge have it; Safari and Firefox need a recent version."
      );
    }
    const gpu = (navigator as Navigator).gpu;
    if (!gpu) throw new Error("no navigator.gpu after setup");
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      throw new Error(
        "WebGPU found no adapter. A headless machine often has none at all; " +
          "in Chrome chrome://gpu says why."
      );
    }
    const info = adapter.info as GPUAdapterInfo | undefined;
    const parts = [info?.vendor, info?.architecture, info?.device]
      .filter((s) => s)
      .join(" ");
    const device = await adapter.requestDevice();
    // A device lost mid-sweep would otherwise show up as a wrong answer.
    device.lost.then((reason) => {
      console.error(`WebGPU device lost: ${reason.reason} ${reason.message}`);
    });
    return {
      device,
      adapter: (info?.description || parts || "unknown adapter").trim(),
      via,
    };
  })();
  return cached;
}

/** Whether a WebGPU device can be had here. Used to skip the WebGPU
 * solvers rather than fail a whole run. */
export async function gpuAvailable(): Promise<boolean> {
  try {
    await requestGpu();
    return true;
  } catch {
    return false;
  }
}

/** Why WebGPU is unavailable, for a message to the user. */
export async function gpuUnavailableReason(): Promise<string | null> {
  try {
    await requestGpu();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
