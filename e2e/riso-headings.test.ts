// Real local production browser/SSR contract. No fake renderer, observer or stamp solver.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { chromium, type Browser, type Page } from "playwright-core";
import { collectBrowserErrors } from "./console-errors.ts";
const BASE = process.env.BASE_URL ?? "http://localhost:4000";
let browser: Browser;
before(async () => {
  const env = { ...process.env, TMPDIR: "/tmp" };
  browser = await chromium.launch({ channel: "chrome", env }).catch(() => chromium.launch({ env }));
});
after(async () => { await browser?.close(); });
async function open(options: Parameters<Browser["newContext"]>[0] = {}) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, ...options });
  const page = await context.newPage();
  const errors = collectBrowserErrors(BASE);
  page.on("pageerror", e => errors.pageError(e.message));
  page.on("response", response => errors.response({ url: response.url(), status: response.status(), method: response.request().method(), resourceType: response.request().resourceType() }));
  page.on("console", msg => {
    if (msg.type() !== "error") return;
    const location = msg.location();
    errors.console({ text: msg.text(), url: location.url, line: location.lineNumber, column: location.columnNumber, args: msg.args().length });
  });
  await page.addInitScript(() => {
    const state = window as unknown as { risoEntries: Record<string, number>; risoTransitions: string[][]; risoObservers: number };
    state.risoEntries = {};
    state.risoTransitions = [];
    state.risoObservers = 0;
    const observers = new WeakSet<IntersectionObserver>();
    const observe = IntersectionObserver.prototype.observe;
    IntersectionObserver.prototype.observe = function (target) {
      if (target.matches(".riso-text") && !observers.has(this)) { observers.add(this); state.risoObservers++; }
      return observe.call(this, target);
    };
    const start = document.startViewTransition?.bind(document);
    if (start) document.startViewTransition = options => {
      state.risoTransitions.push(typeof options === "object" && options ? [...(options.types ?? [])] : []);
      return start(options);
    };
    document.addEventListener("animationstart", event => {
      const el = event.target as Element;
      if (el.matches(".riso-anchor")) {
        const heading = el.closest("h1,h2");
        const name = heading?.id || heading?.querySelector(".riso-source")?.textContent || "";
        state.risoEntries[name] = (state.risoEntries[name] || 0) + 1;
      }
    });
  });
  await page.goto(BASE);
  return { context, page, errors };
}
async function settled(page: Page) {
  await page.waitForFunction(() => [...document.querySelectorAll("h1 .riso-text")].every(el => el.getAttribute("data-riso-state") === "printed"));
  await page.locator("h1 .riso-char").first().evaluate(async el => {
    await Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished));
  });
}
async function noDuplicateNames(page: Page) {
  const names = await page.locator("*").evaluateAll(els => els.filter(el => el.getClientRects().length > 0).map(el => getComputedStyle(el).viewTransitionName).filter(n => n && n !== "none" && n !== "auto"));
  assert.equal(new Set(names).size, names.length, names.join(","));
  assert.equal(await page.locator(".riso-char").evaluateAll(els => els.every(el => getComputedStyle(el).viewTransitionName === "none")), true);
}

test("disabled ghost config reconciles only its real resource error; unrelated errors still fail", async () => {
  // Reduced motion prevents the idle canvas from making another config request.
  const { context, page, errors } = await open({ reducedMotion: "reduce" });
  try {
    // The shared browser server is now configured for the ghost fake. This case explicitly
    // supplies disabled configuration; the compiled unset route is tested in ghosts-config.test.ts.
    await page.route(`${BASE}/api/ghosts`, route => route.fulfill({ status: 404, body: "", headers: { "cache-control": "no-store" } }));
    const [response, , body] = await Promise.all([
      page.waitForResponse(`${BASE}/api/ghosts`),
      page.waitForEvent("console", { predicate: msg => msg.type() === "error" && msg.location().url === `${BASE}/api/ghosts` }),
      page.evaluate(async () => (await fetch("/api/ghosts")).text()),
    ]);
    assert.equal(response.status(), 404);
    assert.equal(response.headers()["cache-control"], "no-store");
    assert.equal(body, "");
    assert.deepEqual(errors.unexpected, []);

    for (const [path, status] of [["/missing-console-control", 404], ["/api/ghosts", 500]] as const) {
      await page.route(`${BASE}${path}`, route => route.fulfill({ status, body: "negative control" }));
      const countBefore: number = errors.unexpected.length;
      await Promise.all([
        page.waitForEvent("console", { predicate: msg => msg.type() === "error" && msg.location().url === `${BASE}${path}` }),
        page.evaluate(path => fetch(path), path),
      ]);
      assert.equal(errors.unexpected.length, countBefore + 1, `${path} ${status} remains unexpected`);
    }
    const countBefore: number = errors.unexpected.length;
    const resourceText = "Failed to load resource: the server responded with a status of 404 (Not Found)";
    await page.evaluate(text => console.error(text), resourceText);
    assert.equal(errors.unexpected.length, countBefore + 1, "same-text application console.error stays unexpected");
    await Promise.all([
      page.waitForEvent("pageerror"),
      page.evaluate(() => { setTimeout(() => { throw new Error("pageerror negative control"); }, 0); }),
    ]);
    assert.equal(errors.unexpected.at(-1), "pageerror negative control");
  } finally { await context.close(); }
});

test("one heading name, one selectable copy, deterministic settled plates and token plate counts", async () => {
  const { context, page, errors } = await open();
  try {
    assert.equal(await page.getByRole("heading", { level: 1, name: "Otohime", exact: true }).count(), 1);
    await settled(page);
    const ink = await page.locator("h1 .riso-char").first().evaluate(el => {
      const before = getComputedStyle(el, "::before"), after = getComputedStyle(el, "::after");
      const anchor = getComputedStyle(el.querySelector(".riso-anchor")!);
      const r = document.createRange(); r.selectNodeContents(el.closest("h1")!);
      getSelection()!.removeAllRanges(); getSelection()!.addRange(r);
      return { before: before.transform, after: after.transform, ghostSelect: before.userSelect, anchor: anchor.userSelect, color: anchor.color, headingColor: getComputedStyle(el.closest("h1")!).color, selected: getSelection()!.toString() };
    });
    assert.equal(ink.selected, "Otohime");
    assert.equal(ink.ghostSelect, "none"); assert.equal(ink.anchor, "text");
    assert.equal(ink.color, ink.headingColor);
    for (const transform of [ink.before, ink.after]) {
      const numbers = transform.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      assert.ok([1, 2].includes(Math.abs(numbers[4])) && [1, 2].includes(Math.abs(numbers[5])), transform);
    }
    await page.reload(); await settled(page);
    assert.equal(await page.locator("h1 .riso-char").first().evaluate(el => getComputedStyle(el, "::before").transform), ink.before);
    // Negative control: a real Sumi preset removes the third plate without changing the name.
    await page.getByRole("region", { name: "Pocket console", exact: true }).getByText("Sumi black", { exact: true }).click();
    assert.equal(await page.locator("h1 .riso-char").first().evaluate(el => getComputedStyle(el, "::after").opacity), "0");
    assert.equal(await page.getByRole("heading", { name: "Otohime", exact: true }).count(), 1);
    await noDuplicateNames(page); assert.deepEqual(errors.unexpected, []);
  } finally { await context.close(); }
});

test("entry runs once per mount, h2 navigation, reduced motion, forced colors and print settle immediately", async () => {
  const { context, page, errors } = await open();
  try {
    await settled(page);
    const about = page.getByRole("heading", { level: 2, name: "About", exact: true });
    await about.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector("#about .riso-text")?.getAttribute("data-riso-state") === "printed");
    await about.locator(".riso-anchor").first().evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished)); });
    const entryCount = await page.evaluate(() => (window as unknown as { risoEntries: Record<string, number> }).risoEntries.about);
    assert.ok(entryCount > 0, "a real entry animation ran");
    await page.evaluate(() => scrollTo(0, 0)); await about.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => (window as unknown as { risoEntries: Record<string, number> }).risoEntries.about), entryCount);
    assert.equal(await about.locator(".riso-text").getAttribute("data-riso-state"), "printed");
    assert.equal(await page.evaluate(() => (window as unknown as { risoObservers: number }).risoObservers), 1);
    for (const media of [{ reducedMotion: "reduce" as const }, { forcedColors: "active" as const }, { media: "print" as const }]) {
      await page.emulateMedia(media);
      const data = await about.locator(".riso-char").first().evaluate(el => ({ a: getComputedStyle(el.querySelector(".riso-anchor")!).animationName, ghost: getComputedStyle(el, "::before").display, anchor: getComputedStyle(el.querySelector(".riso-anchor")!).color }));
      assert.equal(data.a, "none"); assert.equal(data.ghost, "none"); assert.notEqual(data.anchor, "rgba(0, 0, 0, 0)");
    }
    assert.deepEqual(errors.unexpected, []);
  } finally { await context.close(); }
});

test("server/no-JavaScript headings are readable and mobile notes wrap without overflow", async () => {
  const { context, page, errors } = await open({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    assert.equal(await page.getByRole("heading", { name: "Otohime", exact: true }).isVisible(), true);
    assert.equal(await page.locator("h1 .riso-text").getAttribute("data-riso-state"), null);
    assert.equal(await page.locator("h1 .riso-char").first().evaluate(el => getComputedStyle(el).opacity), "1");
    await page.goto(`${BASE}/notes`);
    assert.equal(await page.locator("h1 h1,h1 h2,h2 h1,h2 h2").count(), 0);
    assert.ok(await page.locator("main h2 .riso-text").count());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors.unexpected, []);
  } finally { await context.close(); }
});

test("Pocket A to Work keeps TitleMorph ownership; Play stamps exactly the source letters and tidies", async () => {
  const { context, page, errors } = await open();
  try {
    await settled(page);
    await page.waitForLoadState("networkidle");
    const pocket = page.getByRole("region", { name: "Pocket console", exact: true });
    await pocket.getByRole("button", { name: "A Open", exact: true }).click();
    await page.waitForURL(`${BASE}/work`);
    await page.waitForFunction(() => !document.documentElement.matches(":active-view-transition"));
    assert.ok(await page.evaluate(() => (window as unknown as { risoTransitions: string[][] }).risoTransitions.some(types => types.includes("console"))), "the actual console transition type ran");
    assert.equal(await page.getByRole("heading", { level: 1, name: "Work", exact: true }).count(), 1);
    await noDuplicateNames(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${BASE}/play`);
    const heading = page.getByRole("heading", { level: 1, name: "Play", exact: true });
    assert.equal(await heading.count(), 1);
    assert.equal(await page.locator(".stamp-text").textContent(), "Play");
    assert.equal(await page.locator(".stamp-text > *").count(), 0);
    await page.getByRole("button", { name: "Stamp it", exact: true }).click();
    await page.getByRole("button", { name: "Tidy", exact: true }).waitFor();
    assert.equal(await page.locator(".stamp-block").count(), 4);
    assert.equal(await heading.locator(".riso-visual").evaluate(el => getComputedStyle(el).visibility), "hidden");
    const block = page.locator(".stamp-block").first();
    await block.focus(); await page.keyboard.press(" "); await page.keyboard.press("ArrowRight"); await page.keyboard.press(" ");
    assert.ok(Number(await page.locator(".stamp-board").getAttribute("data-marks")) > 0);
    await page.keyboard.press("Escape");
    await page.locator(".stamp-board").waitFor({ state: "detached" });
    await page.waitForFunction(() => document.activeElement?.matches(".stamp-chip"));
    await heading.locator(".riso-visual").waitFor({ state: "visible" });
    await noDuplicateNames(page); assert.deepEqual(errors.unexpected, []);
  } finally { await context.close(); }
});

// Render the real shared component for edge strings that are not published site content.
// This fixture proves SSR/CSS layout; normal-route tests above prove real hydration/observer behavior.
test("shared preview handles empty, Unicode, preserved whitespace and very long wrapped headings", async () => {
  const source = readFileSync(new URL("../components/riso-heading.tsx", import.meta.url), "utf8")
    .replace('import "./riso-heading.css";', "")
    .replace('"@/lib/riso-heading"', JSON.stringify(new URL("../lib/riso-heading.ts", import.meta.url).href));
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    .replace(/from "(react(?:\/jsx-runtime)?)"/g, (_, name: string) => `from ${JSON.stringify(import.meta.resolve(name))}`);
  const { RisoHeading } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const css = readFileSync(new URL("../components/riso-heading.css", import.meta.url), "utf8");
  const title = "墨 e\u0301 👩🏽‍🎨 🇻🇳  two words\n" + "A long title that wraps across the mobile paper. ".repeat(8) + "x".repeat(90);
  const markup = renderToStaticMarkup(createElement("main", {},
    createElement(RisoHeading, { as: "h1", id: "empty" }, ""),
    createElement(RisoHeading, { as: "h2", id: "long", plates: 2 }, title)));
  const { context, page, errors } = await open({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  try {
    await page.setContent(`<style>body{font:24px/1.5 monospace;margin:20px}h1,h2{font:inherit}${css}</style>${markup}`);
    assert.equal(await page.getByRole("heading", { name: "", exact: true }).count(), 1);
    assert.equal(await page.locator("#empty .riso-char").count(), 0);
    assert.equal(await page.getByRole("heading", { level: 2, name: title.replace(/\s+/g, " ").trim(), exact: true }).count(), 1);
    assert.equal(await page.locator("#long .riso-source").textContent(), title);
    assert.equal(await page.locator("#long .riso-anchor").allTextContents().then(chars => chars.includes("👩🏽‍🎨")), true);
    const geometry = await page.locator("#long").evaluate(el => {
      const boxes = [...el.querySelectorAll(".riso-anchor")].map(c => c.getBoundingClientRect());
      const range = document.createRange(); range.selectNodeContents(el);
      getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
      return { width: document.documentElement.scrollWidth, viewport: innerWidth, lines: new Set(boxes.map(b => b.top)).size, selected: getSelection()!.toString() };
    });
    assert.ok(geometry.lines > 5);
    assert.ok(geometry.width <= geometry.viewport, JSON.stringify(geometry));
    assert.equal(geometry.selected, title);
    assert.deepEqual(errors.unexpected, []);
  } finally { await context.close(); }
});
