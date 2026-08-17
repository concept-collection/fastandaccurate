// Committed results live in the fastandaccurate-results repository and are
// fetched statically: index.json lists the result files, each of which is
// one work-precision sweep in the format of src/harness/resultSchema.ts.

import {
  RESULT_FORMAT,
  type ResultFile,
} from "../harness/resultSchema";

export const RESULTS_REPO_URL =
  "https://github.com/concept-collection/fastandaccurate-results";
// The results repo is served by its own GitHub Pages (branch-based, main
// at /), which is CDN-backed and CORS-open. raw.githubusercontent.com
// would also work but rate-limits hard enough to break page loads.
// In dev the vite server serves the sibling checkout instead (see
// localResultsPlugin in vite.config.ts), so local work sees local
// results and makes no network requests for them.
const RESULTS_BASE = import.meta.env.DEV
  ? "/local-results"
  : "https://concept-collection.github.io/fastandaccurate-results";

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
  const idxResp = await fetch(`${RESULTS_BASE}/index.json`, { cache: "no-cache" });
  if (!idxResp.ok) throw new Error(`index.json: HTTP ${idxResp.status}`);
  const idx = (await idxResp.json()) as { files?: string[] };
  const files = idx.files ?? [];
  const results = await Promise.all(
    files.map(async (f) => {
      const resp = await fetch(`${RESULTS_BASE}/${f}`, { cache: "no-cache" });
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
