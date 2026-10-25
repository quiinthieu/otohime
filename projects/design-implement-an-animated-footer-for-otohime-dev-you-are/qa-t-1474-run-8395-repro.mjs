// Requires a fresh disposable local database, migrations and production server.
// PW_PREFIX=<temporary Playwright> BASE_URL=http://localhost:4095 QA_REPRO_OUT=/tmp/repro.json node <file>
// Exits 1 on page errors; never writes cookies or complete responses to evidence.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const { chromium } = createRequire(path.resolve(process.env.PW_PREFIX, "package.json"))("playwright");
const base = process.env.BASE_URL;
assert(base && ["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local isolated server only");
assert(process.env.QA_REPRO_OUT && !path.resolve(process.env.QA_REPRO_OUT).startsWith(process.cwd() + "/"));
const signup = await fetch(base + "/api/auth/sign-up/email", {
  method: "POST",
  headers: { origin: base, "content-type": "application/json" },
  body: JSON.stringify({
    name: "qa",
    email: `qa-8395-${Date.now()}@probe.test`,
    password: "qa-8395-local-password",
  }),
});
assert.equal(signup.status, 200, "Isolated fixture sign-up must succeed");
const cookies = signup.headers.getSetCookie().map(c => {
  const pair = c.split(";")[0], i = pair.indexOf("=");
  return { name: pair.slice(0, i), value: pair.slice(i + 1), url: base };
});
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce",
});
await context.addCookies(cookies);
const page = await context.newPage();
const errors = [], responses = [];
let phase = "";
page.on("pageerror", e => errors.push({ phase, url: page.url(), message: e.message, stack: e.stack }));
page.on("response", async response => {
  if (!response.url().startsWith(base) || !["document", "fetch"].includes(response.request().resourceType())) return;
  try {
    const body = await response.text();
    if (body.includes("NEXT_HTTP_ERROR") || body.includes("$RX") || body.includes("$!")) {
      responses.push({
        url: response.url(), status: response.status(),
        abortDigests: [...body.matchAll(/\$RX\("([^"]+)","([^"]+)"/g)].map(m => ({ boundary: m[1], digest: m[2] })),
      });
    }
  } catch { /* Navigation can cancel a response body; never treat it as proof. */ }
});
try {
  for (let i = 0; i < 3; i++) {
    for (const target of ["projects", "dashboard"]) {
      phase = `load-forbidden-${i}-${target}`;
      await page.goto(base + "/admin/roles");
      await page.getByRole("heading", { name: "This room is locked" }).waitFor();
      await page.waitForTimeout(400);
      phase = `exit-${i}-${target}`;
      await page.locator(`nav[aria-label="Main"] a[href="/${target}"]`).click();
      await page.waitForURL(base + "/" + target);
      await page.waitForTimeout(700);
    }
  }
  console.log(JSON.stringify({ errors: errors.length, messages: errors.map(e => ({ phase: e.phase, message: e.message })) }));
  assert.equal(errors.length, 0, "Repeated mobile reduced-motion 403 exits must produce no page errors");
} finally {
  await writeFile(process.env.QA_REPRO_OUT, JSON.stringify({ errors, responses }, null, 2));
  await browser.close();
}
