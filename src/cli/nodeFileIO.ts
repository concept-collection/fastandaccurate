// The node substitute for numbl's synchronous-XHR file I/O: websave and
// webread shell out to curl (node has no synchronous fetch), with
// responses cached under ~/.cache/fastandaccurate keyed by URL, so
// repeated runs are offline. Used by the CLI and the node tests for
// solvers that mip-install packages.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { BrowserFileIOAdapter, type VirtualFileSystem } from "numbl";

const cacheDir = join(homedir(), ".cache", "fastandaccurate");

function curlCached(url: string): Buffer {
  mkdirSync(cacheDir, { recursive: true });
  const key = createHash("sha1").update(url).digest("hex").slice(0, 16);
  const cached = join(cacheDir, key);
  if (!existsSync(cached)) {
    execFileSync("curl", ["-sfL", "-o", cached, url], { stdio: "inherit" });
  }
  return readFileSync(cached);
}

export class NodeFileIOAdapter extends BrowserFileIOAdapter {
  private nodeVfs: VirtualFileSystem;
  constructor(vfs: VirtualFileSystem) {
    super(vfs);
    this.nodeVfs = vfs;
  }
  override websave(url: string, filename: string): void {
    this.nodeVfs.writeFile(
      this.nodeVfs.normalizePath(filename),
      new Uint8Array(curlCached(url))
    );
  }
  override webread(url: string): string {
    return curlCached(url).toString("utf8");
  }
}
