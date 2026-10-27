// Real production Next.js + Chrome. Only failure-injection tests replace browser ports.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { chromium, type Browser, type Page } from "playwright-core";
import { decodeLab, encodeLab, labDefaults } from "../lib/ink-lab.ts";
const BASE = process.env.BASE_URL ?? "http://localhost:4000";
let browser: Browser;
before(async () => { browser = await chromium.launch({ channel: "chrome", env: { ...process.env, TMPDIR: "/tmp" }, ignoreDefaultArgs: ["--hide-scrollbars"] }); });
after(async () => { await browser?.close(); });
async function open(options: Parameters<Browser["newContext"]>[0] = {}) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: "reduce", ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  return { context, page, errors };
}
async function ready(page: Page, query = "") {
  await page.goto(`${BASE}/lab${query}`);
  await page.locator("[data-lab-ready]").waitFor();
}
async function canonical(page: Page) {
  await page.waitForFunction(() => {
    const preview = document.querySelector<HTMLElement>(".lab-preview");
    return document.querySelector(".ink-lab")?.getAttribute("data-lab-pending") === "false" && preview?.dataset.query === location.search.slice(1);
  });
  return new URL(page.url()).search.slice(1);
}
async function range(page: Page, label: string, value: string) {
  await page.getByLabel(label, { exact: true }).fill(value);
  await canonical(page);
}
async function rootState(page: Page) {
  return page.evaluate(() => ({ style: document.documentElement.getAttribute("style"), run: document.documentElement.getAttribute("data-print-run"), lab: document.documentElement.hasAttribute("data-ink-lab"), local: localStorage.getItem("otohime:print-run:v1"), session: sessionStorage.getItem("otohime:ink-lab:v1"), heading: getComputedStyle(document.querySelector("h1")!).color, theme: localStorage.getItem("theme"), season: localStorage.getItem("season"), card: getComputedStyle(document.querySelector(".lab-controls .card") ?? document.body).backgroundColor }));
}

test("public shell/nav/terminal and every control tune only the proof sheet, with bounded frame updates", async () => {
  const { context, page, errors } = await open();
  try {
    await ready(page);
    assert.equal(await page.getByRole("heading", { level: 1, name: "Ink Lab", exact: true }).count(), 1);
    assert.equal(await page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: /Ink Lab/ }).count(), 1);
    const before = await rootState(page);
    const history = await page.evaluate(() => window.history.length);
    await page.getByLabel("Print run", { exact: true }).selectOption("riso"); await canonical(page);
    for (const [label, value] of [["Turbulence", "0.081"], ["Displacement", "8.1"], ["Wobble speed", "4.2"], ["Paper grain", "0.025"], ["Transition duration", "810"]]) await range(page, label, value);
    for (const [index, value] of ["#123456", "#abcdef", "#987654"].entries()) {
      await page.getByLabel(`Decorative plate ${index + 1}`, { exact: true }).fill(value); await canonical(page);
    }
    await page.getByLabel("Plate count", { exact: true }).selectOption("2"); await canonical(page);
    await page.getByLabel("Hand style", { exact: true }).selectOption("crayon"); await canonical(page);
    await page.getByLabel("Halftone", { exact: true }).check();
    const query = await canonical(page), settings = decodeLab(query).snapshot.settings;
    assert.deepEqual(settings, { turbulence: .081, displacement: 8.1, wobble: 4.2, grain: .025, transitionMs: 810, plates: ["#123456", "#abcdef", "#987654"], plateCount: 2, hand: "crayon", halftone: true });
    assert.equal(await page.locator('.lab-preview feTurbulence[result="warp"]').getAttribute("baseFrequency"), "0.081");
    assert.equal(await page.locator('.lab-preview feDisplacementMap[in2="warp"]').getAttribute("scale"), "8.1");
    assert.deepEqual(await rootState(page), before, "negative control: root heading, appearance variables and storage untouched");
    assert.equal(await page.evaluate(() => window.history.length), history);
    const metrics = await page.evaluate(async () => {
      const preview = document.querySelector<HTMLElement>(".lab-preview")!;
      const updates = Number(preview.dataset.filterUpdates);
      const slider = document.querySelector<HTMLInputElement>("#lab-displacement")!;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      const start = performance.now();
      for (const value of ["1", "2", "3", "4", "5"]) { setter.call(slider, value); slider.dispatchEvent(new Event("input", { bubbles: true })); }
      // Registered after the Lab's own rAF: the actual SVG must be ready for this paint,
      // rather than leaving React's default-priority commit queued behind other work.
      const firstFrame = new Promise<boolean>(resolve => requestAnimationFrame(() => {
        resolve(preview.querySelector('feDisplacementMap[in2="warp"]')?.getAttribute("scale") === "5");
      }));
      const latencyMs = await new Promise<number>(resolve => {
        const observer = new MutationObserver(() => { if (preview.dataset.query?.includes("d=5&")) { observer.disconnect(); resolve(performance.now() - start); } });
        observer.observe(preview, { attributes: true });
      });
      return { latencyMs, renderedBeforePaint: await firstFrame, updates: Number(preview.dataset.filterUpdates) - updates, effectiveSpeed: preview.dataset.effectiveSpeed };
    });
    console.log("Ink Lab input measurement", JSON.stringify(metrics));
    assert.ok(metrics.latencyMs <= 100, JSON.stringify(metrics)); assert.equal(metrics.renderedBeforePaint, true, "latest SVG commits inside the coalescing frame"); assert.equal(metrics.updates, 1); assert.equal(metrics.effectiveSpeed, "0");
    await page.reload(); await page.locator("[data-lab-ready]").waitFor();
    assert.equal(await page.getByLabel("Displacement", { exact: true }).inputValue(), "5");
    await page.keyboard.press("Control+k");
    const terminal = page.getByRole("dialog").getByRole("combobox");
    await terminal.fill("lab"); await terminal.press("Enter");
    await page.waitForURL(/\/lab/);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test("Share recreates the preview in a clean context; hostile/oversized links sanitize without applying", async () => {
  const { context, page, errors } = await open();
  try {
    await ready(page, "?v=1&r=indigo&t=999&d=-10&p=javascript%3Aevil&n=2&unknown=bad&t=0.02");
    const query = await canonical(page);
    assert.equal(query, encodeLab(decodeLab(query).snapshot));
    assert.equal(decodeLab(query).snapshot.settings.turbulence, .12);
    assert.equal(decodeLab(query).snapshot.settings.displacement, 0);
    assert.equal((await rootState(page)).lab, false);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Copied" }).waitFor();
    const shared = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(shared, `${BASE}/lab?${query}`);
    const clean = await open();
    try {
      await clean.page.goto(shared); await clean.page.locator("[data-lab-ready]").waitFor();
      assert.equal(await canonical(clean.page), query);
      assert.equal((await rootState(clean.page)).lab, false);
      assert.equal((await rootState(clean.page)).session, null);
    } finally { await clean.context.close(); }
    await ready(page, `?v=1&bad=${"x".repeat(2100)}`);
    await page.getByRole("status").filter({ hasText: "too long" }).waitFor();
    assert.equal(await canonical(page), encodeLab(labDefaults()));
    await ready(page, `?v=1&padding=${"%20".repeat(700)}`);
    await page.getByRole("status").filter({ hasText: "too long" }).waitFor();
    assert.equal(await canonical(page), encodeLab(labDefaults()));
    await ready(page, "?v=99"); await page.getByRole("status").filter({ hasText: "unsupported" }).waitFor();
    assert.equal(await canonical(page), encodeLab(labDefaults()));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test("Apply snapshot survives Work, Shore and reload; later URL edits stay local; reset restores house", async () => {
  const { context, page, errors } = await open();
  try {
    await page.addInitScript(() => { localStorage.setItem("theme", "dark"); localStorage.setItem("season", "winter"); });
    await ready(page, "?v=1&r=riso&d=7&w=0");
    const house = await rootState(page);
    const query = await canonical(page);
    await page.getByRole("button", { name: "Apply to whole site", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Applied for this tab session" }).waitFor();
    const applied = await rootState(page); assert.equal(applied.session, query); assert.equal(applied.lab, true);
    await range(page, "Displacement", "2"); assert.equal((await rootState(page)).session, query);
    await page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: /Work/ }).click();
    await page.waitForURL(`${BASE}/work`); assert.equal((await rootState(page)).session, query);
    await page.goto(`${BASE}/shore`); await page.reload();
    assert.equal((await rootState(page)).session, query); assert.equal((await rootState(page)).lab, true);
    await ready(page); assert.equal((await rootState(page)).lab, true);
    const clean = await open();
    try { await ready(clean.page); assert.equal((await rootState(clean.page)).lab, false); } finally { await clean.context.close(); }
    await page.getByRole("button", { name: "Reset to house style", exact: true }).click();
    await page.waitForURL(`${BASE}/lab`);
    // The site's reduced-motion reset still has a 0.01 ms transition: observe the painted color after it settles.
    await page.waitForFunction(color => [...document.querySelectorAll("h1")].some(el => el.getClientRects().length > 0 && getComputedStyle(el).color === color), house.heading);
    const reset = await rootState(page); assert.equal(reset.local, null); assert.equal(reset.session, null); assert.equal(reset.lab, false); assert.equal(reset.run, null);
    assert.equal(reset.theme, "dark"); assert.equal(reset.season, "winter"); assert.equal(reset.heading, house.heading);
    assert.equal(await page.getByLabel("Displacement", { exact: true }).inputValue(), String(labDefaults().settings.displacement));
    await page.reload(); await page.locator("[data-lab-ready]").waitFor(); assert.equal(new URL(page.url()).search, "");
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test("Back and Forward restore preview state without applying it", async () => {
  const { context, page } = await open();
  try {
    await ready(page, "?v=1&d=2"); const first = await canonical(page);
    await page.evaluate(() => history.pushState(null, "", "/lab?v=1&d=8"));
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>("#lab-displacement")?.value === "8");
    const second = await canonical(page);
    await page.goBack(); await page.waitForFunction(q => document.querySelector(".lab-preview")?.getAttribute("data-query") === q, first);
    await page.goForward(); await page.waitForFunction(q => document.querySelector(".lab-preview")?.getAttribute("data-query") === q, second);
    assert.equal((await rootState(page)).lab, false);
  } finally { await context.close(); }
});

test("denied storage and clipboard retain edits and tell the truth; recovery works", async () => {
  const { context, page, errors } = await open();
  try {
    await page.addInitScript(() => {
      const original = { set: Storage.prototype.setItem, remove: Storage.prototype.removeItem };
      Object.assign(window, { restoreLabStorage: () => { Storage.prototype.setItem = original.set; Storage.prototype.removeItem = original.remove; } });
      Storage.prototype.setItem = Storage.prototype.removeItem = () => { throw new DOMException("blocked", "SecurityError"); };
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("blocked")) } });
    });
    await ready(page, "?v=1&r=indigo&d=9"); const query = await canonical(page);
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Clipboard unavailable" }).waitFor();
    assert.equal(await page.getByLabel("Share URL", { exact: true }).inputValue(), `${BASE}/lab?${query}`);
    assert.equal(await page.getByLabel("Share URL", { exact: true }).evaluate((el: HTMLInputElement) => el.selectionEnd! - el.selectionStart!), `${BASE}/lab?${query}`.length);
    await page.getByRole("button", { name: "Apply to whole site", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "current page only" }).waitFor();
    assert.equal(await page.locator("html").getAttribute("data-print-run"), "indigo");
    assert.equal(await page.getByLabel("Displacement", { exact: true }).inputValue(), "9");
    await page.getByRole("button", { name: "Reset to house style", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Storage is blocked" }).waitFor();
    assert.equal(await page.locator("html").getAttribute("data-ink-lab"), null);
    await page.evaluate(() => (window as unknown as { restoreLabStorage(): void }).restoreLabStorage());
    await page.getByRole("button", { name: "Reset to house style", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "House style restored" }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test("the heading and loading explanation survive without JavaScript", async () => {
  const { context, page } = await open({ javaScriptEnabled: false });
  try {
    await page.goto(`${BASE}/lab`);
    assert.equal(await page.getByRole("heading", { level: 1, name: "Ink Lab", exact: true }).isVisible(), true);
    assert.match(await page.getByRole("status").textContent() ?? "", /controls need JavaScript/);
    assert.equal(await page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: /Ink Lab/ }).count(), 1);
  } finally { await context.close(); }
});

test("the local seed clock pauses offscreen/hidden/reduced and is torn down on navigation", async () => {
  const { context, page, errors } = await open({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
  try {
    await page.addInitScript(() => {
      const live = new Set<IntersectionObserver>();
      const observe = IntersectionObserver.prototype.observe, disconnect = IntersectionObserver.prototype.disconnect;
      IntersectionObserver.prototype.observe = function (target) { if (target.matches(".lab-preview")) live.add(this); return observe.call(this, target); };
      IntersectionObserver.prototype.disconnect = function () { live.delete(this); return disconnect.call(this); };
      Object.defineProperty(window, "labObserverCount", { get: () => live.size });
    });
    await ready(page);
    assert.equal(await page.evaluate(() => (window as unknown as { labObserverCount: number }).labObserverCount), 1);
    await page.clock.install();
    await page.getByLabel("Wobble speed", { exact: true }).fill("6");
    await page.clock.runFor(100);
    const preview = page.locator(".lab-preview");
    await preview.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector<HTMLElement>(".lab-preview")?.dataset.effectiveSpeed === "6");
    await page.clock.runFor(500);
    assert.ok(Number(await preview.getAttribute("data-seed-updates")) > 0, "real local SVG seeds advance");
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => document.querySelector<HTMLElement>(".lab-preview")?.dataset.effectiveSpeed === "0");
    const offscreen = await preview.getAttribute("data-seed-updates");
    await page.clock.runFor(1000); assert.equal(await preview.getAttribute("data-seed-updates"), offscreen);
    await preview.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector<HTMLElement>(".lab-preview")?.dataset.effectiveSpeed === "6");
    // Failure injection at the browser visibility port, with the real event handler/clock/filters.
    await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
    assert.equal(await preview.getAttribute("data-effective-speed"), "0");
    const hidden = await preview.getAttribute("data-seed-updates");
    await page.clock.runFor(1000); assert.equal(await preview.getAttribute("data-seed-updates"), hidden);
    await page.evaluate(() => { delete (document as unknown as { hidden?: boolean }).hidden; document.dispatchEvent(new Event("visibilitychange")); });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => document.querySelector<HTMLElement>(".lab-preview")?.dataset.effectiveSpeed === "0");
    const reduced = await preview.getAttribute("data-seed-updates");
    await page.clock.runFor(1000); assert.equal(await preview.getAttribute("data-seed-updates"), reduced);
    await page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: /Work/ }).click();
    await page.waitForURL(`${BASE}/work`); await preview.waitFor({ state: "hidden" });
    // Next Activity retains hidden route DOM but must dispose its effects.
    await page.waitForFunction(() => (window as unknown as { labObserverCount: number }).labObserverCount === 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

for (const [name, viewport, zoom] of [["desktop", { width: 1366, height: 768 }, 1], ["mobile", { width: 390, height: 844 }, 1], ["200% zoom", { width: 1366, height: 768 }, 2]] as const) {
  test(`keyboard controls, reachable actions and no horizontal overflow at ${name}`, async () => {
    const { context, page } = await open({ viewport });
    try {
      await ready(page);
      // CSS zoom doubles text and controls and exercises the sheet's container-based reflow.
      if (zoom === 2) await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
      const input = page.getByLabel("Displacement", { exact: true });
      await input.focus(); await page.keyboard.press("ArrowRight"); await canonical(page);
      assert.equal(await input.inputValue(), "3.6");
      await page.getByLabel("Print run", { exact: true }).focus();
      for (const label of ["Hand style", "Turbulence", "Displacement", "Wobble speed", "Transition duration", "Paper grain", "Plate count", "Decorative plate 1", "Decorative plate 2", "Decorative plate 3", "Halftone"]) {
        await page.keyboard.press("Tab");
        assert.equal(await page.getByLabel(label, { exact: true }).evaluate(el => el === document.activeElement), true, `${label} is in the native tab order`);
      }
      await page.keyboard.press(" "); await canonical(page);
      assert.equal(await page.getByLabel("Halftone", { exact: true }).isChecked(), true);
      for (const label of ["Share", "Apply to whole site", "Reset to house style"]) {
        const button = page.getByRole("button", { name: label, exact: true });
        await button.focus(); await button.scrollIntoViewIfNeeded();
        const box = await button.boundingBox(); assert.ok(box && box.y >= 0 && box.y + box.height <= (await page.evaluate(() => innerHeight)) + 1, JSON.stringify(box));
      }
      const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth,
        elements: [...document.querySelectorAll("body *")].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, className: el.getAttribute("class"), right: el.getBoundingClientRect().right })).slice(0, 15) }));
      assert.ok(overflow.width <= overflow.viewport, JSON.stringify(overflow));
      if (process.env.LAB_SCREENSHOT_DIR) {
        mkdirSync(process.env.LAB_SCREENSHOT_DIR, { recursive: true });
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: join(process.env.LAB_SCREENSHOT_DIR, `${name.replace(/\W+/g, "-")}.png`), fullPage: true });
      }
    } finally { await context.close(); }
  });
}
