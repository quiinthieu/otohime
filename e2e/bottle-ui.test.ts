/** Real production Chromium UI; route fixtures are explicit failure/edge controls. */
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import { CONSOLE_MENU } from "../lib/pages.ts";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright-core";
const base = process.env.BASE_URL ?? "http://localhost:4000";
const tmp = mkdtempSync("/tmp/bottle-ui-");
let browser: Browser;
const contexts: BrowserContext[] = [];
before(async () => {
  const env = { ...process.env, TMPDIR: tmp };
  if (process.env.CHROME_PATH) browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, env });
  else { try { browser = await chromium.launch({ channel: "chrome", env }); } catch { browser = await chromium.launch({ env }); } }
});
after(async () => { for (const c of contexts) await c.close(); await browser?.close(); rmSync(tmp, { recursive: true, force: true }); });
const fixture = [0, 1, 2].map((n) => ({ id: `fixture-${n}`, title: `Paper world ${n}`, note: `An inked note ${n}.`, kind: "art", url: `https://paper-world.org/${n}` }));
async function open(options: BrowserContextOptions = {}) {
  const c = await browser.newContext({ viewport: { width: 1366, height: 768 }, ...options });
  contexts.push(c);
  const p = await c.newPage();
  p.setDefaultTimeout(8000);
  return { c, p };
}
async function home(p: Page) {
  await p.goto(base);
  await p.locator('[data-bottle-entry="pocket"]:enabled').waitFor();
}
const panel = (p: Page) => p.getByRole("dialog", { name: "Message in a Bottle", exact: true });
async function reveal(p: Page, entry = "footer") {
  const button = p.locator(`[data-bottle-entry="${entry}"]:visible`);
  await button.click();
  await panel(p).waitFor();
  await panel(p).getByRole("button", { name: "Another bottle" }).waitFor();
  await p.waitForFunction(() => !document.querySelector(".bottle-card-slot")?.textContent?.includes("Waiting for the tide"));
  return button;
}
async function cardId(p: Page) { return panel(p).locator("[data-bottle-id]").getAttribute("data-bottle-id"); }
async function poolFixture(c: BrowserContext, bottles = fixture) {
  await c.route("**/api/bottles", (route) => route.fulfill({ json: { bottles, degraded: false } }));
}
async function fill(p: Page, url = `https://paper-submission.org/${randomUUID()}`) {
  const d = panel(p);
  await d.getByText("Suggest a site", { exact: true }).click();
  await d.getByLabel("URL", { exact: true }).fill(url);
  await d.getByLabel("Title", { exact: true }).fill("A small paper world");
  await d.getByLabel("Note", { exact: true }).fill("Drawn by hand, shared with care.");
  await d.getByLabel("Kind", { exact: true }).selectOption("toy");
  return url;
}

test("both entries share the lazy card; keyboard, safe deliberate visit, focus and modal coexistence", async () => {
  const { c, p } = await open();
  const requests: string[] = [];
  const errors: string[] = [];
  p.on("request", (r) => requests.push(r.url()));
  p.on("pageerror", (e) => errors.push(e.message));
  await home(p);
  await p.locator('[data-bottle-entry="pocket"]').hover();
  await p.locator('[data-bottle-entry="pocket"]').focus();
  assert.equal(requests.filter((u) => u.includes("/api/bottles")).length, 0);
  const before = new Set(requests);
  await p.keyboard.press("Enter");
  await panel(p).locator("[data-bottle-id]").waitFor();
  assert.equal(requests.filter((u) => u.endsWith("/api/bottles")).length, 1);
  const added = requests.filter((u) => !before.has(u) && /\.js(?:\?|$)/.test(u));
  assert.ok(added.length > 0, "activation requests a lazy JS chunk");
  const anchor = panel(p).getByRole("link", { name: /^Visit / });
  assert.match((await anchor.getAttribute("href"))!, /^https:\/\//);
  assert.equal(await anchor.getAttribute("target"), "_blank");
  assert.equal(await anchor.getAttribute("rel"), "noopener noreferrer");
  assert.equal(c.pages().length, 1, "drawing never opens a tab");
  await p.keyboard.press("Control+k");
  await p.keyboard.press("/");
  assert.equal(await p.locator("dialog[open]").count(), 1);
  assert.equal(await p.locator(".pocket-terminal[open]").count(), 0);
  for (let i = 0; i < 9; i++) {
    await p.keyboard.press("Tab");
    assert.equal(await p.evaluate(() => !!document.activeElement?.closest(".bottle-panel")), true);
  }
  // The actual browser opens a new tab only after clicking Visit. The destination is a local response fixture.
  await c.route((url) => url.origin !== new URL(base).origin, (route) => route.fulfill({ contentType: "text/html", body: "<title>Explicit Bottle destination</title>" }));
  const popup = p.waitForEvent("popup");
  await anchor.click();
  const child = await popup;
  await child.waitForLoadState();
  assert.equal(await child.evaluate(() => window.opener === null), true);
  await child.close();
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => document.activeElement?.getAttribute("data-bottle-entry") === "pocket");
  await reveal(p);
  const footerReadout = await p.locator("[data-end-readout]").textContent();
  for (const key of ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"]) await p.keyboard.press(key);
  assert.equal(await p.locator("[data-end-readout]").textContent(), footerReadout, "modal keys must not play the footer");
  assert.equal(await p.locator("[data-end-badge]").getAttribute("data-unlocked"), "false");
  await panel(p).getByRole("button", { name: "Close Bottle" }).click();
  await p.waitForFunction(() => document.activeElement?.getAttribute("data-bottle-entry") === "footer");
  assert.equal(await p.locator(".bottle-panel").count(), 0);
  const bottleBounds = await p.locator('[data-bottle-entry="footer"]').boundingBox();
  const sceneBounds = await p.locator(".end-canvas").boundingBox();
  assert.ok(bottleBounds && sceneBounds && bottleBounds.y + bottleBounds.height <= sceneBounds.y, "Bottle stays outside the existing scene pointer area");
  await p.locator("[data-end-mascot]").focus();
  await p.keyboard.press("Shift+Tab");
  assert.equal(await p.evaluate(() => document.activeElement?.getAttribute("data-bottle-entry")), "footer", "Bottle precedes the unchanged legacy Tab chain");
  await p.keyboard.press("Enter"); await panel(p).waitFor(); await p.keyboard.press("Escape");
  await p.keyboard.press("Control+k");
  await p.locator(".pocket-terminal[open]").waitFor();
  await p.keyboard.press("Escape");
  await p.getByRole("button", { name: "> Ask the console", exact: true }).click();
  await p.locator(".ask-console[open]").waitFor();
  await p.keyboard.press("Control+k");
  assert.equal(await p.locator("dialog[open]").count(), 1);
  await p.keyboard.press("Escape");
  await reveal(p, "pocket");
  const ids = await p.locator("[id]").evaluateAll((els) => els.map((el) => el.id));
  assert.equal(ids.length, new Set(ids).size, "no duplicate ids");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ browser: browser.version(), lazyRequests: added }));
});

for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) test(`footer Bottle clears the scene with enlarged text at ${viewport.width}`, async () => {
  const { c, p } = await open({ viewport, reducedMotion: "reduce", ...(viewport.width === 390 ? { isMobile: true, hasTouch: true } : {}) });
  await poolFixture(c);
  await home(p);
  await p.evaluate(async () => { await document.fonts.ready; });
  const button = p.locator('[data-bottle-entry="footer"]');
  const geometry = () => button.evaluate((el) => {
    const bottle = el.getBoundingClientRect();
    const scene = document.querySelector(".end-canvas")!.getBoundingClientRect();
    const footer = document.querySelector("footer.end")!.getBoundingClientRect();
    return { height: bottle.height, gap: scene.top - bottle.bottom, left: bottle.left, right: bottle.right,
      rootFont: parseFloat(getComputedStyle(document.documentElement).fontSize),
      sceneTop: scene.top - footer.top, sceneWidth: scene.width, sceneHeight: scene.height, footerHeight: footer.height };
  });
  const assertClear = (g: Awaited<ReturnType<typeof geometry>>) => {
    assert.ok(g.gap >= 0, `Bottle stays outside the existing scene pointer area: ${JSON.stringify(g)}`);
    assert.ok(g.height >= 36 && g.left >= 0 && g.right <= viewport.width, "visible target retains its size and fits the viewport");
  };
  const baseline = await geometry();
  assertClear(baseline);
  // Reproduce QA's changed font metrics without changing the containing footer's layout.
  await button.evaluate((el) => { el.style.fontSize = "24px"; });
  const enlarged = await geometry();
  assert.ok(enlarged.height > baseline.height, "the control actually makes the button taller");
  assertClear(enlarged);
  for (const key of ["sceneTop", "sceneWidth", "sceneHeight", "footerHeight"] as const) {
    assert.equal(enlarged[key], baseline[key], `${key}: larger Bottle text preserves reserved footer geometry`);
  }
  if (viewport.width === 390) await button.tap(); else await button.click();
  await panel(p).locator("[data-bottle-id]").waitFor();
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => document.activeElement?.getAttribute("data-bottle-entry") === "footer");
  await p.keyboard.press("Tab");
  assert.equal(await p.locator("[data-end-mascot]").evaluate((el) => el === document.activeElement), true);

  // The identical boundary assertion must reject the old fixed-offset layout.
  await button.evaluate((el) => { el.style.insetBlockStart = "-2.4rem"; el.style.insetBlockEnd = "auto"; el.style.marginBlockEnd = "0"; });
  const oldLayout = await geometry();
  assert.throws(() => assertClear(oldLayout), /scene pointer area/, "old fixed offset is a failing browser negative control");
  await button.evaluate((el) => { el.removeAttribute("style"); });
  await p.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await p.waitForFunction((size) => parseFloat(getComputedStyle(document.documentElement).fontSize) === size, baseline.rootFont * 2);
  const scaled = await geometry();
  assert.equal(scaled.rootFont, baseline.rootFont * 2, "root text scaling actually applied");
  assertClear(scaled);
  console.log(JSON.stringify({ viewport, baseline, enlarged, oldLayout, scaled, browser: browser.version() }));
});

test("repeat exhaustion, stale stored ids, cross-entry history and bounded persistence", async () => {
  const { c, p } = await open();
  await poolFixture(c);
  await c.addInitScript(() => { localStorage.setItem("bottles:v1", JSON.stringify(["unknown", "fixture-0", "fixture-0"])); });
  await home(p);
  await reveal(p, "pocket");
  const first = await cardId(p);
  assert.notEqual(first, "fixture-0");
  await panel(p).getByRole("button", { name: "Another bottle" }).click();
  const second = await cardId(p);
  assert.notEqual(second, first);
  assert.notEqual(second, "fixture-0");
  await p.keyboard.press("Escape");
  await reveal(p);
  const third = await cardId(p);
  assert.notEqual(third, second, "cycle reset excludes immediately previous");
  const cycle = [third];
  for (let i = 0; i < 2; i++) { await panel(p).getByRole("button", { name: "Another bottle" }).click(); cycle.push(await cardId(p)); }
  assert.equal(new Set(cycle).size, 3);
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem("bottles:v1")!));
  assert.equal(stored.length, 3);
  assert.ok(stored.every((id: string) => fixture.some((b) => b.id === id)));
});

test("readable but unwritable storage keeps visit history across both entries", async () => {
  const { c, p } = await open(); await poolFixture(c);
  await c.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (this === localStorage && key === "bottles:v1") throw new Error("write blocked");
      set.call(this, key, value);
    };
  });
  await home(p); await reveal(p, "pocket");
  const first = await cardId(p);
  await p.keyboard.press("Escape"); await reveal(p);
  assert.notEqual(await cardId(p), first);
  assert.equal(await p.evaluate(() => localStorage.getItem("bottles:v1")), null);
});

test("touch, blocked storage, offline pool and live reduced motion stay usable", async () => {
  const { c, p } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
    // Keep the real WAAPI animation running so natural completion cannot stand in for cancellation.
    const animate = Element.prototype.animate;
    Element.prototype.animate = function(...args) {
      const animation = animate.apply(this, args);
      if (this.matches(".bottle-card")) animation.effect?.updateTiming({ duration: 60_000 });
      return animation;
    };
  });
  await c.route("**/api/bottles", (r) => r.abort("failed"));
  await home(p);
  await p.locator('[data-bottle-entry="pocket"]').tap();
  await panel(p).locator("[data-bottle-id]").waitFor();
  assert.match((await panel(p).textContent())!, /offline tide/);
  const first = await cardId(p);
  await panel(p).getByRole("button", { name: "Another bottle" }).tap();
  assert.notEqual(await cardId(p), first);
  assert.equal(await p.locator(".bottle-card").evaluate((el) => el.getAnimations().length), 1, "cancellation starts with an active native animation");
  // Observe cancellation at the media-query event, not before Chromium dispatches it.
  await p.evaluate(() => {
    const w = window as unknown as { bottleMotionChange: Promise<number> };
    w.bottleMotionChange = new Promise((resolve) => {
      matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => {
        resolve(document.querySelector(".bottle-card")?.getAnimations().length ?? -1);
      }, { once: true });
    });
  });
  await p.emulateMedia({ reducedMotion: "reduce" });
  const animationsAfterChange = await p.evaluate(() => Promise.race([
    (window as unknown as { bottleMotionChange: Promise<number> }).bottleMotionChange,
    new Promise<number>((_, reject) => setTimeout(() => reject(new Error("reduced-motion change was not dispatched")), 500)),
  ]));
  assert.equal(animationsAfterChange, 0);
  await panel(p).getByRole("button", { name: "Another bottle" }).tap();
  assert.equal(await p.locator(".bottle-card").evaluate((el) => el.getAnimations().length), 0);
  await panel(p).getByRole("button", { name: "Close Bottle" }).tap();
  await p.waitForFunction(() => document.activeElement?.getAttribute("data-bottle-entry") === "pocket");
});

test("empty and single pools and malformed stored history remain usable", async () => {
  for (const bottles of [[], fixture.slice(0, 1)]) {
    const { c, p } = await open({ reducedMotion: "reduce" });
    await poolFixture(c, bottles);
    await c.addInitScript(() => localStorage.setItem("bottles:v1", "{broken"));
    await home(p); await reveal(p);
    const another = panel(p).getByRole("button", { name: "Another bottle" });
    if (!bottles.length) { assert.equal(await another.isDisabled(), true); assert.match((await panel(p).textContent())!, /No bottles/); }
    else { const id = await cardId(p); await another.click(); assert.equal(await cardId(p), id); }
    await fill(p);
  }
});

test("real suggestion is pending in Postgres and absent from the public pool; validation stays local", async () => {
  const { p } = await open(); await home(p); await reveal(p);
  const url = await fill(p, `https://bottle-ui-submission.org/${randomUUID()}`);
  const d = panel(p);
  let posts = 0;
  p.on("request", (r) => { if (r.url().endsWith("/api/bottles/suggestions")) posts++; });
  await d.getByLabel("URL", { exact: true }).fill("http://unsafe.org");
  await d.getByRole("button", { name: "Send for review" }).click();
  assert.match((await d.getByRole("alert").textContent())!, /url/);
  assert.equal(posts, 0);
  await d.getByLabel("URL", { exact: true }).fill(url);
  await d.getByLabel("Title", { exact: true }).fill("<img src=x onerror=alert(1)>");
  await d.getByRole("button", { name: "Send for review" }).click();
  assert.equal(posts, 0);
  await d.getByLabel("Title", { exact: true }).fill("A small paper world");
  const response = p.waitForResponse((r) => r.url().endsWith("/api/bottles/suggestions"));
  await d.getByRole("button", { name: "Send for review" }).click();
  const r = await response;
  assert.equal(r.status(), 201, await r.text());
  await d.getByText("Thank you. Your suggestion is pending review.").waitFor();
  assert.equal(posts, 1);
  const publicData = await (await fetch(`${base}/api/bottles`)).json();
  assert.equal(publicData.bottles.some((b: { url: string }) => b.url === url), false);
  assert.ok(process.env.DATABASE_URL, "isolated runner supplies actual Postgres");
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try { const result = await db.query("select status from bottle_suggestion where url=$1", [url]); assert.deepEqual(result.rows, [{ status: "pending" }]); }
  finally { await db.query("delete from bottle_suggestion where url=$1", [url]); await db.end(); }
});

test("suggestion failures retain input, render inert reasons, prevent duplicates and honor 429", async () => {
  const { c, p } = await open(); await poolFixture(c); await home(p); await reveal(p);
  const url = await fill(p);
  let posts = 0;
  let release: (() => void) | undefined;
  await c.route("**/api/bottles/suggestions", async (route) => {
    posts++;
    if (posts === 1) { await new Promise<void>((resolve) => { release = resolve; }); await route.fulfill({ status: 503, json: { reason: "unavailable", message: "<img src=x onerror=alert(1)>" } }); }
    else await route.fulfill({ status: 429, headers: { "retry-after": "3600" }, json: { reason: "rate_limited", message: "Try again next UTC hour." } });
  });
  const send = panel(p).getByRole("button", { name: "Send for review" });
  await send.click();
  await p.getByRole("button", { name: "Sending…" }).waitFor();
  assert.equal(await p.getByRole("button", { name: "Sending…" }).isDisabled(), true);
  await panel(p).getByLabel("Title", { exact: true }).press("Enter");
  assert.equal(posts, 1);
  assert.ok(release); release();
  await p.waitForFunction(() => document.querySelector(".bottle-panel [role=alert]")?.textContent?.includes("unavailable"));
  assert.equal(await panel(p).locator("img").count(), 0);
  assert.equal(await panel(p).getByLabel("URL", { exact: true }).inputValue(), url);
  await send.click();
  await p.waitForFunction(() => document.querySelector(".bottle-panel [role=alert]")?.textContent?.includes("rate_limited"));
  await send.click();
  assert.equal(posts, 2);
  const id = await cardId(p);
  await panel(p).getByRole("button", { name: "Another bottle" }).click();
  assert.notEqual(await cardId(p), id);
});

test("no-JS baseline retains footer/Pocket links and explains Bottle activation", async () => {
  const { p } = await open({ javaScriptEnabled: false }); await p.goto(base);
  assert.equal(await p.locator("footer.end").count(), 1);
  assert.equal(await p.locator("[data-end-page]").count(), CONSOLE_MENU.length);
  assert.equal(await p.locator('[data-bottle-entry="footer"]').isDisabled(), true);
  assert.equal(await p.locator('[data-bottle-entry="pocket"]').isDisabled(), true);
  assert.equal(await p.locator(".bottle-panel").count(), 0);
  assert.equal(await p.getByText("Bottle needs JavaScript to wash up a link.", { exact: true }).count(), 2);
  assert.equal(await p.locator("[data-pocket-ryugu]").getAttribute("href"), "/ryugu");
});

// Measure only activation-related network bytes; all page/shared runtime chunks precede the gesture.
for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) test(`lazy network boundaries, emitted gzip budgets and open/close CLS at ${viewport.width}`, async () => {
  const { c, p } = await open({ reducedMotion: "reduce", viewport }); await poolFixture(c);
  const js: string[] = [];
  p.on("request", (r) => { if (/\/_next\/static\/.*\.(js|css)(?:\?|$)/.test(r.url())) js.push(r.url()); });
  await home(p);
  await p.locator("footer.end").scrollIntoViewIfNeeded();
  await p.evaluate(async () => { await document.fonts.ready; });
  await p.waitForTimeout(350); // settle existing footer entry, then measure every shift including recent input
  const initial = new Set(js);
  await p.evaluate(() => {
    const w = window as unknown as { bottleCLS: number; bottleObserver: PerformanceObserver };
    w.bottleCLS = 0;
    w.bottleObserver = new PerformanceObserver((list) => { for (const entry of list.getEntries()) w.bottleCLS += (entry as PerformanceEntry & { value: number }).value; });
    w.bottleObserver.observe({ type: "layout-shift" });
  });
  await reveal(p);
  await panel(p).getByRole("button", { name: "Close Bottle" }).click();
  await p.waitForTimeout(200);
  const cls = await p.evaluate(() => (window as unknown as { bottleCLS: number }).bottleCLS);
  assert.ok(cls <= .001, `Bottle open/close CLS ${cls}`);
  const lazy = [...new Set(js.filter((url) => !initial.has(url)))];
  assert.ok(lazy.some((url) => url.endsWith(".js")));
  const chunks = lazy.map((url) => {
    const file = ".next" + new URL(url).pathname.replace(/^\/_next/, "");
    const bytes = readFileSync(file);
    return { file, gzip: gzipSync(bytes).length, sha256: createHash("sha256").update(bytes).digest("hex") };
  });
  assert.ok(chunks.some(({ file }) => readFileSync(file, "utf8").includes("Message in a Bottle")), "actual panel is gesture-loaded");
  const curatedNote = JSON.parse(readFileSync("content/bottles.json", "utf8"))[0].note as string;
  assert.ok(chunks.some(({ file }) => readFileSync(file, "utf8").includes(curatedNote)), "bundled fallback content is gesture-loaded");
  const lazyBytes = chunks.reduce((n, item) => n + item.gzip, 0);
  assert.ok(lazyBytes <= 25 * 1024, `Bottle lazy UI ${lazyBytes} gzip bytes`);
  // A marker in the emitted module identifies the actual eager Bottle entry, even when bundled with siblings.
  const files = readdirSync(".next/static/chunks", { recursive: true }).filter((name) => String(name).endsWith(".js"));
  const eager = files.map((name) => ({ file: `.next/static/chunks/${name}`, code: readFileSync(`.next/static/chunks/${name}`, "utf8") })).filter(({ code }) => code.includes("data-bottle-entry"));
  assert.ok(eager.length > 0);
  for (const { file } of eager) assert.ok(initial.has(base + file.replace(/^\.next/, "/_next")), `${file} present before gesture`);
  const bootstrapModules = eager.map(({ file, code }) => {
    const marker = code.indexOf("data-bottle-entry");
    const boundaries = [...code.matchAll(/(?:,|\[)\d+,[a-zA-Z_$][\w$]*=>\{/g)].map((m) => m.index!);
    const start = boundaries.filter((index) => index < marker).at(-1);
    assert.notEqual(start, undefined, "identify emitted Bottle module");
    const end = boundaries.find((index) => index > marker) ?? code.length;
    const emitted = code.slice(start, end);
    assert.ok(emitted.includes("Bottle needs JavaScript"));
    assert.ok(!emitted.includes("Message in a Bottle"), "panel absent from eager module");
    return { file, gzip: gzipSync(emitted).length, sha256: createHash("sha256").update(emitted).digest("hex") };
  });
  const buttonCSS = readFileSync("components/bottle/button.css");
  // Unminified source CSS is a conservative upper bound on the emitted scoped icon styles.
  const initialCode = [...initial].filter((url) => url.endsWith(".js")).map((url) => readFileSync(".next" + new URL(url).pathname.replace(/^\/_next/, ""), "utf8"));
  for (const code of initialCode) { assert.ok(!code.includes("Message in a Bottle")); assert.ok(!code.includes(curatedNote)); }
  const calls = initialCode.flatMap((code) => [...code.matchAll(/.{0,35}\.BottleButton,\{entry:"pocket"\}\)/g)].map((m) => m[0]));
  assert.ok(calls.length > 0, "identify actual Pocket entry render glue");
  const guards = initialCode.flatMap((code) => [...code.matchAll(/document\.querySelector\("dialog\[open\]"\)/g)].map((m) => m[0]));
  assert.ok(guards.length >= 2, "include keyboard ownership glue");
  // Overcount all eager dialog guards (including those already in the measured entry) and surrounding JSX bytes.
  const glueGzip = gzipSync([...calls, ...guards].join(";")).length + 64; // numeric module import binding allowance
  const bootstrapBytes = bootstrapModules.reduce((n, m) => n + m.gzip, gzipSync(buttonCSS).length) + glueGzip;
  assert.ok(bootstrapBytes <= 3 * 1024, `Bottle incremental bootstrap ${bootstrapBytes} gzip bytes`);
  for (const { code } of eager) assert.ok(!code.includes("Message in a Bottle"));
  console.log(JSON.stringify({ cls, lazyBytes, bootstrapBytes, glueGzip, chunks, bootstrapModules, browser: browser.version() }));
});

test("browser Back closes the shared-footer modal without an orphaned overlay", async () => {
  const { c, p } = await open(); await poolFixture(c);
  await p.goto(`${base}/work`);
  await p.locator('[data-end-page="/notes"]:visible').click();
  await p.waitForURL(base + "/notes");
  await reveal(p);
  await p.goBack();
  await p.waitForURL(base + "/work");
  await p.waitForFunction(() => !document.querySelector(".bottle-panel"));
  assert.equal(await p.locator("dialog[open]").count(), 0);
  await reveal(p);
});
