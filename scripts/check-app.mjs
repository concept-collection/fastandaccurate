/**
 * Headless end-to-end check of the built site: serves dist/, loads the
 * page in headless Chrome, fails on any console error, and exercises one
 * real in-browser solve through the worker (the Solution section),
 * asserting the reported error is small. Visual appearance is checked by
 * a human, not here.
 *
 * Usage: npm run build && node scripts/check-app.mjs
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
    res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});

const errors = [];
let failures = 0;
try {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      const url = msg.location()?.url ?? "";
      // The committed-results fetch may fail offline, or while the
      // results site is unavailable; the app reports that in the UI by
      // design. CORS complaints name the URL in the message text rather
      // than in the location, so both are checked.
      const RESULTS_HOST = "github.io/fastandaccurate-results";
      if (url.includes(RESULTS_HOST) || text.includes(RESULTS_HOST)) return;
      // numbl logs its linear-algebra bridge choice at error level.
      if (text.includes("using bridge:")) return;
      errors.push(`${text} (${url})`);
    }
  });
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle2" });
  await page.waitForSelector("h1");

  // Home: the problem list with a clickable card.
  const card = await page.$('a[href="#/problem/laplace-dirichlet-2d"]');
  if (!card) {
    console.error("FAIL: problem card missing on home page");
    failures++;
  } else {
    await card.click();
  }
  await page.waitForFunction(
    () => document.body.innerText.includes("Work-precision results"),
    { timeout: 30000 }
  );

  // One real solve through the worker: the Solution section's compute
  // button, default solver (mfs) at its default n.
  const buttons = await page.$$("button");
  let computeBtn = null;
  for (const b of buttons) {
    const t = await b.evaluate((el) => el.textContent);
    if (t && t.includes("Compute in this browser")) computeBtn = b;
  }
  if (!computeBtn) {
    console.error("FAIL: compute button not found");
    failures++;
  } else {
    await computeBtn.click();
    await page.waitForFunction(
      () => document.body.innerText.includes("rel max error"),
      { timeout: 120000 }
    );
    const text = await page.evaluate(() => document.body.innerText);
    const m = text.match(/rel max error ([0-9.]+e[+-][0-9]+)/);
    if (!m) {
      console.error("FAIL: no reported error after compute");
      failures++;
    } else {
      const err = parseFloat(m[1]);
      // mfs at its default n on star-medium should be far below 1e-6.
      if (!(err < 1e-6)) {
        console.error(`FAIL: in-browser mfs error ${err} not < 1e-6`);
        failures++;
      } else {
        console.log(`in-browser solve ok (rel max error ${m[1]})`);
      }
    }
  }

  if (errors.length > 0) {
    console.error("FAIL: console errors:");
    for (const e of errors) console.error(`  ${e}`);
    failures++;
  }
} finally {
  await browser.close();
  server.close();
}

if (failures > 0) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
console.log("check-app: all checks passed");
