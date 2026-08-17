// Thin wrapper around numbl's synchronous executeCode for harness runs.
// Works identically in a browser worker and in node: no file I/O adapters
// are attached, so the MATLAB side must communicate through workspace
// variables, which we read back from result.variableValues.

import { executeCode } from "numbl";

const PROJ = "/fastandaccurate";

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
  const result = executeCode(
    mainSource,
    {
      onOutput: (text) => outputs.push(text),
      displayResults: false,
      optimization: "1",
      implicitCwdPath: null,
    },
    workspaceFiles,
    `${PROJ}/main.m`,
    [PROJ]
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
