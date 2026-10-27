import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { launchBrowser } from "./probe-browser.mjs";

// Execute the actual helper from the full CLI without starting its unrelated 170-check matrix.
const source = readFileSync(new URL("./probe-end.mjs", import.meta.url), "utf8");
const helper = source.match(/^async function observeMainHeading\(page\) \{[\s\S]*?^\}/m)?.[0];
let observeMainHeading;
let browser;
let server;
let base;
before(async () => {
  assert.ok(helper, "probe-end.mjs must define the bounded heading observer");
  observeMainHeading = new Function(`return (${helper});`)();
  if (!process.env.TMPDIR || process.env.TMPDIR.length > 48) process.env.TMPDIR = "/tmp";
  browser = await launchBrowser({ log: () => {} });
  server = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    // A shared hydrated layout remains visible while route content streams, as with loading.tsx.
    res.write('<!doctype html><main id="main"><div id="skeleton">Loading</div></main><footer class="end" data-hydrated="true">Footer</footer>' + " ".repeat(2048));
    if (req.url === "/dashboard") {
      const timer = setTimeout(() => res.end('<script>document.querySelector("main").innerHTML = "<h1>Hello, stream</h1>"</script>'), 1500);
      res.on("close", () => clearTimeout(timer));
    } else {
      const headings = '<h1>   </h1><h1 hidden>Hidden</h1><h1><span hidden>Hidden text only</span></h1><h1 style="opacity:0">Transparent heading</h1><h1 style="visibility:hidden">Invisible heading</h1>';
      res.end(`<script>document.querySelector("main").insertAdjacentHTML("beforeend", ${JSON.stringify(headings)})</script>`);
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await browser?.close();
  await new Promise((resolve) => server ? server.close(resolve) : resolve());
});

test("Footer 403 exit calls the heading observer after navigation before reading main h1", () => {
  assert.match(source, /await page\.waitForURL\(`\$\{BASE_URL\}\/\$\{target\}`[^;]*;\s*await hydrated\(page\);\s*await observeMainHeading\(page\);\s*const landed = await page\.evaluate/);
});

test("streamed /dashboard heading arriving after 1.5s resolves the real observer", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${base}/dashboard`, { waitUntil: "commit" });
    await page.locator("footer.end[data-hydrated=true]").waitFor();
    assert.equal(await page.locator("main h1").count(), 0, "shared hydration is not route readiness");
    const start = performance.now();
    await observeMainHeading(page);
    assert.ok(performance.now() - start >= 1000, "must observe the delayed stream, not a fixed short pause");
    assert.equal(await page.locator("main h1").innerText(), "Hello, stream");
  } finally { await page.close(); }
});

test("missing, empty and hidden main headings fail at the 10s bound (negative control)", { timeout: 15_000 }, async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${base}/projects`);
    assert.equal(await page.locator("main h1").count(), 5, "negative control must render all empty/hidden variants");
    assert.equal(await page.locator("main h1").nth(2).innerText(), "", "hidden descendants supply no rendered text");
    assert.equal(await page.locator("main h1").nth(3).evaluate((el) => getComputedStyle(el).opacity), "0");
    const start = performance.now();
    await assert.rejects(observeMainHeading(page), /Timeout 10000ms exceeded/);
    const elapsed = performance.now() - start;
    assert.ok(elapsed >= 9900 && elapsed < 12_000, `bounded observation took ${elapsed}ms`);
  } finally { await page.close(); }
});
