// Read-only probe of Ask the Ink's model tier at BASE_URL: what a visitor should get once ASK_LLM=1 and a
// server-only ANTHROPIC_API_KEY are set there. Run by scripts/probe-ask-tier.sh (node --experimental-strip-types,
// so lib/ask-deploy.ts and lib/ask.ts import as they are), which passes BASE_URL and PW_PREFIX in.
//
// Steps 1 and 2 are probeTierLive in lib/ask-deploy.ts, unit-tested there.
// 1. GET /api/ask is 200 with enabled:true (checkTierGet).
// 2. One POST /api/ask with TIER_QUESTION and the site's own Origin (the route compares it to BETTER_AUTH_URL's)
//    answers 200 in mode llm with model lines and citations, every one to /work, /projects or /notes
//    (checkTierPost); each cited page answers 200. Not sent when step 1 failed. This is the probe's only
//    request that spends the model and one of the site's ASK_LIMITS.day answers.
// 3. In Chromium at 1366x768 and 390x844 (touch), /api/ask is answered by page.route fixtures, so nothing here
//    reaches the server: the tier off (GET 404), a 429 carrying the server's (OFFLINE) reply and a 429 with no
//    reply each print the canned answer (answer() from lib/ask.ts over /ask-index.json) with no visible error
//    element. Negative control: a fixture model reply prints its own lines and fails the canned-answer check.
//
// Prints one "ok -" / "not ok -" line per check and the counts; exits 1 on any miss.
import http from "node:http";
import https from "node:https";
import { createRequire } from "node:module";
import { answer } from "../lib/ask.ts";
import { probeTierLive, TIER_QUESTION, tierOrigin } from "../lib/ask-deploy.ts";

const BASE_URL = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const ORIGIN = process.env.ASK_ORIGIN || tierOrigin(BASE_URL);
const API = "/api/ask";
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const DIALOG = "dialog.ask-console";
const OUT = `${DIALOG} .ask-out`;
const ERROR_ELEMENT = `${DIALOG} [role=alert], ${DIALOG} [class*=error], ${DIALOG} [data-error]`;
const FIXTURE = { mode: "llm", intent: "search", lines: ["FIXTURE MODEL: I BUILD PIPELINES."], sources: [{ title: "Work", href: "/work" }] };

let ok = 0;
let failed = 0;
function check(name, pass, detail = "") {
  if (pass) {
    ok++;
    console.log(`ok - ${name}${detail ? ` (${detail})` : ""}`);
  } else {
    failed++;
    console.log(`not ok - ${name}${detail ? `: ${detail}` : ""}`);
  }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const squash = (s) => s.replace(/\s+/g, "");
const same = (a, b) => JSON.stringify(a.map(squash)) === JSON.stringify(b.map(squash));
const looksLikeError = (text) => /error|fail|did not load|went wrong|try again/i.test(text);

// A request with any Origin header (fetch may not let a script set one).
function request(method, url, { origin, body } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { "user-agent": "probe-ask-tier", ...(origin ? { origin } : {}), ...(body ? { "content-type": "application/json" } : {}) };
    const req = (url.startsWith("https:") ? https : http).request(url, { method, headers, timeout: 30_000 }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (text += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text }));
    });
    req.on("timeout", () => req.destroy(new Error("timed out after 30 s")));
    req.on("error", reject);
    req.end(body);
  });
}

async function live() {
  const r = await probeTierLive(BASE_URL, request, ORIGIN);
  if (r.posts > 0) {
    console.log(`model lines: ${r.lines}`);
    console.log(`citations: ${r.cited}`);
  }
  for (const c of r.checks) check(c.name, c.ok, c.detail);
}

// One page with /api/ask answered by fixtures: `get` and `post` are route handlers. Asks TIER_QUESTION and
// waits for the receipt to finish typing.
async function forced(browser, viewport, { get, post }) {
  const phone = viewport === PHONE;
  const context = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone, reducedMotion: "reduce" });
  const page = await context.newPage();
  const routed = { get: 0, post: 0 };
  const errors = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const at = m.location()?.url ?? "";
    // A fixture 404 or 429 on /api/ask is logged by Chromium as a failed resource: that is the fixture working.
    if (at.startsWith("http") && new URL(at).pathname === API && m.text().startsWith("Failed to load resource")) return;
    errors.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.route(`${BASE_URL}${API}`, (route) => {
    if (route.request().method() === "GET") {
      routed.get++;
      return get(route);
    }
    routed.post++;
    return post(route);
  });
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    const chip = page.getByRole("button", { name: "Ask the console" });
    if (phone) await chip.tap();
    else await chip.click();
    await page.waitForSelector(`${DIALOG}[open]`, { timeout: 10000 });
    for (let i = 0; i < 50 && routed.get === 0; i++) await sleep(100);
    await page.locator("#ask-q").fill(TIER_QUESTION);
    await page.locator("#ask-q").press("Enter");
    for (let t = 0; t < 20000; t += 100) {
      await sleep(100);
      const state = await page.evaluate((out) => {
        const receipt = document.querySelector(`${out} .ask-receipt`);
        const rows = [...document.querySelectorAll(`${out} .ask-row`)];
        return { total: Number(receipt?.dataset.total ?? -1), chars: rows.reduce((n, r) => n + r.textContent.length, 0) };
      }, OUT);
      if (state.total > 0 && state.chars === state.total) break;
    }
    await sleep(300);
    const lines = await page.evaluate((out) => [...document.querySelectorAll(`${out} .ask-receipt > p:not(.ask-echo)`)].map((p) => p.textContent), OUT);
    const text = (await page.locator(DIALOG).textContent()) ?? "";
    const visibleErrors = await page.locator(ERROR_ELEMENT).evaluateAll((els) => els.filter((e) => e.checkVisibility()).length);
    return { routed, lines, text, visibleErrors, errors };
  } finally {
    await context.close();
  }
}

async function fallback() {
  const require = createRequire(`${process.env.PW_PREFIX}/package.json`);
  const { chromium } = require("playwright");
  const indexRes = await request("GET", `${BASE_URL}/ask-index.json`);
  check("/ask-index.json answers 200", indexRes.status === 200, String(indexRes.status));
  if (indexRes.status !== 200) return;
  const canned = answer(JSON.parse(indexRes.text), TIER_QUESTION);
  const json = (status, body) => (route) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  const enabled = json(200, { enabled: true, limits: { hour: 10, day: 150 } });
  const cases = [
    ["the tier off (GET 404)", { get: (route) => route.fulfill({ status: 404, contentType: "text/plain", body: "Not Found" }), post: json(500, {}) }, 0, canned.lines],
    ["a 429 with the server's (OFFLINE) reply", { get: enabled, post: json(429, { mode: "offline", ...canned, lines: ["(OFFLINE)", ...canned.lines] }) }, 1, ["(OFFLINE)", ...canned.lines]],
    ["a 429 with no reply", { get: enabled, post: json(429, { error: "rate" }) }, 1, canned.lines],
  ];

  const browser = await chromium.launch();
  try {
    for (const viewport of [DESKTOP, PHONE]) {
      const size = viewport === PHONE ? "390x844 touch" : "1366x768";
      for (const [name, routes, posts, want] of cases) {
        const r = await forced(browser, viewport, routes);
        check(`${size}, forced ${name}: one GET and ${posts} POST, all answered by the fixture`, r.routed.get === 1 && r.routed.post === posts, JSON.stringify(r.routed));
        check(`${size}, forced ${name}: the receipt prints the canned answer`, same(r.lines, want), JSON.stringify({ got: r.lines, want }));
        check(`${size}, forced ${name}: no visible error element or error text`, r.visibleErrors === 0 && !looksLikeError(r.text), `${r.visibleErrors} visible; ${r.text.slice(0, 160)}`);
        check(`${size}, forced ${name}: no console or page errors`, r.errors.length === 0, r.errors.slice(0, 3).join(" | "));
      }
      if (viewport === DESKTOP) {
        const control = await forced(browser, viewport, { get: enabled, post: json(200, FIXTURE) });
        check(`${size} control: a fixture model reply prints its own lines`, same(control.lines, FIXTURE.lines), JSON.stringify(control.lines));
        check(`${size} control: those lines fail the canned-answer check`, !same(control.lines, canned.lines), JSON.stringify(control.lines));
      }
    }
  } finally {
    await browser.close();
  }
}

console.log(`# probe-ask-tier: ${BASE_URL} (Origin ${ORIGIN})`);
try {
  await live();
  await fallback();
} catch (error) {
  check("probe ran to the end", false, error?.stack ?? String(error));
}
console.log(`probe-ask-tier: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 && ok > 0 ? 0 : 1);
