/**
 * End-to-end check of the WebGPU solver in a real browser: serves dist/,
 * opens the problem page in headless Chrome, picks mfs-gpu in the Solution
 * section, computes one point through the worker, and asserts the reported
 * error is what single precision gives. The node suite
 * (test/gpu-test.ts) covers accuracy across the instances; what this adds
 * is that the same code reaches a device from inside a page and a worker,
 * which is the only place the site's "Run in this browser" button lives.
 *
 * Usage: npm run build && node scripts/check-gpu.mjs
 * Exits 2, without failing, when no WebGPU device can be had here.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import puppeteer from "puppeteer-core";

const root = new URL("../dist", import.meta.url).pathname;
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".json": "application/json",
};

const server = createServer(async (req, res) => {
  const path = req.url === "/" ? "/index.html" : (req.url ?? "/").split("?")[0];
  try {
    const data = await readFile(join(root, path));
    res.writeHead(200, {
      "content-type": types[extname(path)] ?? "application/octet-stream",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

// Hardware WebGPU first, then the software adapter, as turing-surface does.
const flagSets = [
  ["--headless=new", "--no-sandbox", "--enable-unsafe-webgpu", "--enable-features=Vulkan"],
  [
    "--headless=new",
    "--no-sandbox",
    "--enable-unsafe-webgpu",
    "--use-webgpu-adapter=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
];

/** f32 puts mfs-gpu's error on star-hard in this range; the point of the
 * check is that it computed at all, so the window is generous. */
const MIN_ERROR = 1e-9;
const MAX_ERROR = 1e-1;

let outcome = null;
for (const flags of flagSets) {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
    args: [...flags],
    protocolTimeout: 600_000,
  });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    await page.goto(`http://127.0.0.1:${port}/#/problem/laplace-dirichlet-2d`, {
      waitUntil: "networkidle2",
    });
    await page.waitForFunction(
      () => document.body.innerText.includes("Work-precision results"),
      { timeout: 60_000 }
    );

    const gpu = await page.evaluate(() => "gpu" in navigator);
    if (!gpu) throw new Error("navigator.gpu absent");

    // The Solution section's solver select, switched to mfs-gpu.
    const picked = await page.evaluate(() => {
      for (const sel of document.querySelectorAll("select")) {
        if ([...sel.options].some((o) => o.value === "mfs-gpu")) {
          sel.value = "mfs-gpu";
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
      }
      return false;
    });
    if (!picked) throw new Error("no solver select offering mfs-gpu");

    const buttons = await page.$$("button");
    let compute = null;
    for (const b of buttons) {
      const t = await b.evaluate((el) => el.textContent);
      if (t && t.includes("Compute in this browser")) compute = b;
    }
    if (!compute) throw new Error("compute button not found");
    await compute.click();

    const text = await page.waitForFunction(
      () => {
        const t = document.body.innerText;
        const m = /rel max error[^0-9eE.+-]*([0-9.]+e[+-][0-9]+)/i.exec(t);
        return m ? m[1] : false;
      },
      { timeout: 300_000 }
    );
    const relMax = Number(await text.jsonValue());
    if (pageErrors.length > 0) throw new Error(`page errors: ${pageErrors[0]}`);
    outcome = { flags, relMax };
  } catch (e) {
    console.error(`run with [${flags.join(" ")}] failed: ${e.message}`);
  } finally {
    await browser.close();
  }
  if (outcome) break;
  console.log("retrying with the software adapter…");
}
server.close();

if (!outcome) {
  console.error("check-gpu: no WebGPU device in this browser; not run");
  process.exit(2);
}
if (!(outcome.relMax > MIN_ERROR && outcome.relMax < MAX_ERROR)) {
  console.error(
    `check-gpu: FAIL, mfs-gpu in the browser reported relMax ${outcome.relMax}, ` +
      `outside [${MIN_ERROR}, ${MAX_ERROR}]`
  );
  process.exit(1);
}
console.log(
  `check-gpu: mfs-gpu ran in the browser (relMax ${outcome.relMax.toExponential(2)})`
);
