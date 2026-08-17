// Committed results live in the fastandaccurate-results repository and are
// fetched statically: index.json lists the result files, each of which is
// one work-precision sweep in the format of src/harness/resultSchema.ts.

import {
  RESULT_FORMAT,
  type ResultFile,
} from "../harness/resultSchema";

export const RESULTS_REPO_URL =
  "https://github.com/concept-collection/fastandaccurate-results";
const RESULTS_RAW =
  "https://raw.githubusercontent.com/concept-collection/fastandaccurate-results/main";

export function isResultFile(x: unknown): x is ResultFile {
  const r = x as ResultFile;
  return (
    !!r &&
    r.format === RESULT_FORMAT &&
    typeof r.problem === "string" &&
    typeof r.instance === "string" &&
    !!r.solver &&
    typeof r.solver.id === "string" &&
    Array.isArray(r.points)
  );
}

export async function fetchCommittedResults(): Promise<ResultFile[]> {
  const idxResp = await fetch(`${RESULTS_RAW}/index.json`, { cache: "no-cache" });
  if (!idxResp.ok) throw new Error(`index.json: HTTP ${idxResp.status}`);
  const idx = (await idxResp.json()) as { files?: string[] };
  const files = idx.files ?? [];
  const results = await Promise.all(
    files.map(async (f) => {
      const resp = await fetch(`${RESULTS_RAW}/${f}`, { cache: "no-cache" });
      if (!resp.ok) return null;
      const data: unknown = await resp.json();
      return isResultFile(data) ? data : null;
    })
  );
  return results.filter((r): r is ResultFile => r !== null);
}

/** Short human label for the environment a result was measured in. */
export function environmentLabel(r: ResultFile): string {
  const env = r.environment;
  if (env.machineLabel) return `${env.machineLabel} (${env.kind})`;
  if (env.kind === "browser") return "browser";
  return `${env.cpu ?? "unknown cpu"} (${env.kind})`;
}
