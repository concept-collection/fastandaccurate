// Thin wrapper around numbl's synchronous executeCode for harness runs.
// Works identically in a browser worker and in node. Plain solvers need
// no file system at all: the MATLAB side communicates through workspace
// variables, read back from result.variableValues.
//
// Solvers that begin with `mip load --install <pkg>` additionally need
// the mip package manager, which the wrapper bootstraps on first use: a
// persistent virtual file system holds /system, the mip core is fetched
// once and unzipped into it, and mip's own downloads go through the
// platform's websave. In a browser worker that is numbl's
// BrowserFileIOAdapter (synchronous XHR, GitHub release URLs routed
// through numbl's CORS proxy); the node CLI substitutes a curl-backed
// adapter via setNumblFileIO. Installed packages persist for the
// lifetime of the worker or process, so a sweep pays the download once.

import {
  executeCode,
  VirtualFileSystem,
  BrowserFileIOAdapter,
  BrowserSystemAdapter,
} from "numbl";
import { unzipSync } from "fflate";

const PROJ = "/fastandaccurate";

const MIP_MHL_URL =
  "https://github.com/mip-org/mip-core/releases/download/mip-numbl/mip-numbl-any.mhl";
const MIP_SYSTEM_PREFIX = "/system/mip/packages/gh/mip-org/core/mip/";
const MIP_SEARCH_PATH = MIP_SYSTEM_PREFIX + "mip";

type FileIOFactory = (vfs: VirtualFileSystem) => BrowserFileIOAdapter;

let makeFileIO: FileIOFactory = (vfs) => new BrowserFileIOAdapter(vfs);

/** Substitute the platform's file I/O adapter (the node CLI installs a
 * curl-backed one; the browser default needs nothing). Must be called
 * before the first mip-using run. */
export function setNumblFileIO(factory: FileIOFactory) {
  makeFileIO = factory;
}

let vfs: VirtualFileSystem | null = null;
let fileIO: BrowserFileIOAdapter | null = null;
let system: BrowserSystemAdapter | null = null;
let mipReady = false;

function ensureMip() {
  if (mipReady && vfs && fileIO && system) return;
  vfs = new VirtualFileSystem();
  fileIO = makeFileIO(vfs);
  system = new BrowserSystemAdapter(vfs);
  const tmp = "/tmp/mip-core.mhl";
  fileIO.websave(MIP_MHL_URL, tmp);
  const entries = unzipSync(vfs.readFile(vfs.normalizePath(tmp)));
  for (const [name, content] of Object.entries(entries)) {
    if (name.endsWith("/")) continue;
    vfs.writeFile(MIP_SYSTEM_PREFIX + name, content);
  }
  mipReady = true;
}

function usesMip(sources: string[]): boolean {
  return sources.some((s) => /^\s*mip\s+load\b/m.test(s));
}

export interface NumblRunResult {
  /** Console output of the run. */
  output: string;
  /** Named numeric results pulled from the final workspace. */
  vars: Record<string, Float64Array>;
}

/**
 * Run mainSource as the main script with the given auxiliary .m files on
 * the search path, and extract the requested workspace variables, which
 * must be real numeric arrays (or scalars, returned as length-1 arrays).
 * Throws on MATLAB errors and on missing/non-numeric variables.
 */
export function runNumblScript(
  mainSource: string,
  files: Record<string, string>,
  wantVars: string[]
): NumblRunResult {
  const workspaceFiles = Object.entries(files).map(([name, source]) => ({
    name: `${PROJ}/${name}`,
    source,
  }));
  const outputs: string[] = [];
  const mip = usesMip([mainSource, ...Object.values(files)]);
  if (mip) ensureMip();
  const result = executeCode(
    mainSource,
    {
      onOutput: (text) => outputs.push(text),
      displayResults: false,
      optimization: "1",
      implicitCwdPath: null,
      ...(mip && fileIO && system ? { fileIO, system } : {}),
    },
    workspaceFiles,
    `${PROJ}/main.m`,
    mip ? [PROJ, MIP_SEARCH_PATH] : [PROJ]
  );
  const vars: Record<string, Float64Array> = {};
  for (const name of wantVars) {
    const v = result.variableValues[name];
    if (typeof v === "number") {
      vars[name] = new Float64Array([v]);
    } else if (
      v &&
      typeof v === "object" &&
      (v as { kind?: string }).kind === "tensor"
    ) {
      const tensor = v as { data: Float64Array; imag?: Float64Array };
      if (tensor.imag) {
        throw new Error(`variable ${name} is complex; expected real`);
      }
      vars[name] = tensor.data;
    } else {
      throw new Error(`variable ${name} missing or not numeric after run`);
    }
  }
  return { output: outputs.join(""), vars };
}
