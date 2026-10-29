import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright-core";
import { collectBrowserErrors } from "./console-errors.ts";
import { INKBLOT_DISCLAIMER } from "../lib/inkblot.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const tmp = mkdtempSync("/tmp/inkblot-e2e-");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let browser: Browser;
const contexts: BrowserContext[] = [];

before(async () => {
  const env = { ...process.env, TMPDIR: tmp };
  if (process.env.CHROME_PATH) browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, env });
  else {
    try { browser = await chromium.launch({ channel: "chrome", env }); }
    catch { browser = await chromium.launch({ env }); }
  }
});
after(async () => {
  for (const context of contexts) await context.close();
  await browser?.close();
  await pool.end();
  rmSync(tmp, { recursive: true, force: true });
});

async function open(options: BrowserContextOptions = {}, route = "/play/inkblot", allowValidation = false) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  contexts.push(context);
  const page = await context.newPage(), errors = collectBrowserErrors(BASE);
  const validation = { responses: 0, consoles: 0 };
  const endpoint = new URL("/api/inkblot/answers", BASE).href;
  page.on("pageerror", (e) => errors.pageError(e.message));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const value = { text: msg.text(), ...msg.location(), args: msg.args().length };
    if (allowValidation && value.url === endpoint && value.args === 0 && value.line === 0 && value.column === 0 &&
      /^Failed to load resource: the server responded with a status of 400 \((?:Bad Request)?\)$/.test(value.text)) validation.consoles++;
    else errors.console(value);
  });
  page.on("response", (res) => {
    const value = { url: res.url(), status: res.status(), method: res.request().method(), resourceType: res.request().resourceType() };
    if (allowValidation && value.url === endpoint && value.status === 400 && value.method === "POST" && value.resourceType === "fetch") validation.responses++;
    errors.response(value);
  });
  await page.goto(`${BASE}${route}`);
  if (new URL(route, BASE).pathname === "/play/inkblot") await page.getByTestId("inkblot-sheet").waitFor();
  return { page, context, errors, validation };
}

async function lobes(page: Page) {
  return page.$$eval("[data-side]", (nodes) => nodes.map((node) => ({
    side: node.getAttribute("data-side"),
    cx: Number(node.getAttribute("cx")),
    cy: Number(node.getAttribute("cy")),
  })));
}

test("/play discovers Ink Blot Test; seeded URL is deterministic; OG card renders", async () => {
  const { page, errors } = await open({ viewport: { width: 1280, height: 900 } }, "/play");
  const link = page.getByTestId("play-inkblot-link");
  assert.equal(await link.getAttribute("href"), "/play/inkblot");
  await link.click();
  await page.waitForURL("**/play/inkblot");
  await page.getByTestId("inkblot-sheet").waitFor();
  await page.waitForFunction(() => /Ink Blot Test/.test(document.title));
  await page.goto(`${BASE}/play/inkblot?b=otohime7`);
  await page.getByTestId("inkblot-graphic").waitFor();
  const first = await page.getByTestId("inkblot-graphic").getAttribute("aria-label");
  assert.match(first ?? "", /seed otohime7/);
  assert.match(first ?? "", /lobes/);
  await page.reload();
  await page.getByTestId("inkblot-graphic").waitFor();
  assert.equal(await page.getByTestId("inkblot-graphic").getAttribute("aria-label"), first);
  const marks = await lobes(page);
  assert.ok(marks.some((mark) => mark.side === "left") && marks.some((mark) => mark.side === "right"));
  const og = await page.locator('meta[property="og:image"]').getAttribute("content");
  assert.ok(og?.includes("/play/inkblot/opengraph-image"));
  const ogPath = new URL(og!, BASE);
  const response = await page.request.get(new URL(ogPath.pathname + ogPath.search, BASE).href);
  assert.equal(response.status(), 200);
  assert.match(response.headers()["content-type"], /image\/png/);
  assert.ok((await response.body()).byteLength > 5000);
  await page.getByRole("link", { name: "Back to Play" }).click();
  await page.waitForURL("**/play");
  assert.deepEqual(errors.unexpected, []);
});

test("pointer and keyboard drips fold into a symmetric blot; reduced motion skips the flip", async () => {
  const { page, errors } = await open();
  await page.getByTestId("inkblot-clear-btn").click();
  assert.equal(await page.getByTestId("inkblot-sheet").getAttribute("data-folded"), "false");
  const box = (await page.getByTestId("inkblot-sheet").boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.22, box.y + box.height * 0.4);
  await page.getByTestId("inkblot-pen-target").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await page.getByTestId("inkblot-fold-btn").click();
  assert.equal(await page.getByTestId("inkblot-sheet").getAttribute("data-folded"), "true");
  const marks = await lobes(page);
  const left = marks.filter((mark) => mark.side === "left");
  const right = marks.filter((mark) => mark.side === "right");
  assert.ok(left.length > 0 && left.length === right.length);
  for (const mark of left) assert.ok(right.some((mirror) => Math.abs(mirror.cx - (100 - mark.cx)) < 0.05 && Math.abs(mirror.cy - mark.cy) < 0.05));
  const reduced = await open({ reducedMotion: "reduce" }, "/play/inkblot?b=otohime7");
  await reduced.page.getByTestId("inkblot-clear-btn").click();
  const reducedBox = (await reduced.page.getByTestId("inkblot-sheet").boundingBox())!;
  await reduced.page.mouse.click(reducedBox.x + reducedBox.width * 0.25, reducedBox.y + reducedBox.height * 0.45);
  await reduced.page.getByTestId("inkblot-fold-btn").click();
  assert.equal(await reduced.page.getByTestId("inkblot-sheet").getAttribute("data-motion"), "reduced");
  assert.equal(await reduced.page.getByTestId("inkblot-sheet").getAttribute("data-folded"), "true");
  const duration = await reduced.page.locator(".inkblot-leaf").evaluate((node) => getComputedStyle(node).animationDuration);
  assert.equal(duration, "0s");
  assert.deepEqual(errors.unexpected, []);
  assert.deepEqual(reduced.errors.unexpected, []);
});

test("an observation shows a toy reading and pins a note; URLs and profanity are rejected", async () => {
  const { page, errors, validation } = await open({}, "/play/inkblot?b=otohime7", true);
  const approved = randomUUID();
  await pool.query(
    "insert into inkblot_answer(id,blot_key,name,note,status,tilt,hand) values($1,'otohime7','Ward clerk','a folded moth','approved',-2,1)",
    [approved],
  );
  try {
    await page.reload();
    await page.getByTestId("inkblot-gallery").waitFor();
    await page.waitForFunction(() => document.querySelector('[data-testid="inkblot-gallery"]')?.textContent?.includes("a folded moth"));
    assert.match(await page.getByTestId("inkblot-gallery").innerText(), /a folded moth/);
    await page.locator("#inkblot-note").fill("a lantern in the crease");
    await page.locator("#inkblot-name").fill("Ink");
    await page.getByTestId("inkblot-submit-btn").click();
    await page.getByTestId("inkblot-reading").waitFor();
    const reading = await page.getByTestId("inkblot-reading").innerText();
    assert.match(reading, /lantern/i);
    assert.ok(reading.includes(INKBLOT_DISCLAIMER));
    await page.waitForFunction(() => document.querySelector('[data-testid="inkblot-gallery"]')?.textContent?.includes("Pinned · awaiting the doctor's initials"));
    assert.match((await page.getByTestId("inkblot-gallery").textContent()) ?? "", /Pinned · awaiting the doctor's initials/);
    assert.match(await page.getByTestId("inkblot-gallery").innerText(), /a lantern in the crease/);
    const pending = await pool.query("select status, note from inkblot_answer where note='a lantern in the crease' order by created_at desc limit 1");
    assert.equal(pending.rows[0].status, "pending");
    const before = Number((await pool.query("select count(*)::int as n from inkblot_answer")).rows[0].n);
    await page.locator("#inkblot-note").fill("https://spam.example");
    await page.getByTestId("inkblot-submit-btn").click();
    await page.waitForFunction(() => /link|ward/i.test(document.querySelector('[data-testid="inkblot-status"]')?.textContent ?? ""));
    assert.match(await page.getByTestId("inkblot-status").innerText(), /link|Links|ward/i);
    await page.locator("#inkblot-note").fill("this is shit");
    await page.getByTestId("inkblot-submit-btn").click();
    await page.waitForFunction(() => /kinder/i.test(document.querySelector('[data-testid="inkblot-status"]')?.textContent ?? ""));
    assert.equal(Number((await pool.query("select count(*)::int as n from inkblot_answer")).rows[0].n), before + 0);
    assert.equal(validation.responses, 2, "both negative forms reach the real validation endpoint and return HTTP 400");
    assert.ok(validation.consoles <= validation.responses, "each exempted browser resource error has matching URL, status and POST response evidence");
  } finally {
    await pool.query("delete from inkblot_answer where id=$1 or note in ('a lantern in the crease','https://spam.example','this is shit')", [approved]);
  }
  assert.deepEqual(errors.unexpected, []);
});
