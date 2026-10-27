import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { after, before, test } from "node:test";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
} from "playwright-core";
import rawMakingOf from "../content/making-of.json" with { type: "json" };
import { readMakingOf, ROLE_KEYS } from "../lib/making-of.ts";
import { collectBrowserErrors } from "./console-errors.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const snapshot = readMakingOf(rawMakingOf);

let browser: Browser;
const contexts: BrowserContext[] = [];
const tmp = mkdtempSync("/tmp/making-of-e2e-");

before(async () => {
  const env = { ...process.env, TMPDIR: tmp };
  if (process.env.CHROME_PATH) {
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, env });
  } else {
    try {
      browser = await chromium.launch({ channel: "chrome", env });
    } catch {
      browser = await chromium.launch({ env });
    }
  }
});

after(async () => {
  for (const c of contexts) await c.close();
  await browser?.close();
  rmSync(tmp, { recursive: true, force: true });
});

async function open(options: BrowserContextOptions = {}) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 840 },
    ...options,
  });
  contexts.push(context);
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const errors = collectBrowserErrors(BASE);
  page.on("pageerror", (e) => errors.pageError(e.message));
  page.on("response", (response) =>
    errors.response({
      url: response.url(),
      status: response.status(),
      method: response.request().method(),
      resourceType: response.request().resourceType(),
    }),
  );
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const loc = m.location();
    errors.console({
      text: m.text(),
      url: loc.url,
      line: loc.lineNumber,
      column: loc.columnNumber,
      args: m.args().length,
    });
  });
  return { page, context, errors };
}

test("/work links to /making-of and renders all scenes, four reusable ink figures, role/model badges, and GitHub commit links", async () => {
  const { page, errors } = await open();
  await page.goto(`${BASE}/work`);

  const makingOfLink = page.locator('a[href="/making-of"]');
  await makingOfLink.waitFor({ state: "visible" });
  assert.match(await makingOfLink.innerText(), /Making-of Emaki/i);

  await makingOfLink.click();
  await page.waitForURL(`${BASE}/making-of`);

  const root = page.locator('[data-testid="emaki-root"]');
  await page.locator('[data-testid="emaki-root"][data-hydrated="true"]').waitFor({ state: "visible" });
  assert.equal(await root.getAttribute("data-hydrated"), "true");

  const sceneList = page.locator('ol[data-testid="emaki-scene-list"]');
  await sceneList.waitFor({ state: "visible" });
  const scenes = sceneList.locator('> li[data-testid="emaki-scene"]');
  assert.equal(await scenes.count(), snapshot.scenes.length);

  // Verify shared SVG <defs> for the four reusable ink figures exist once at the root
  for (const roleKey of ROLE_KEYS) {
    assert.equal(await page.locator(`svg.emaki-figure-defs #emaki-figure-${roleKey}`).count(), 1);
    assert.equal(await page.locator(`[data-relay-figure="${roleKey}"]`).count(), 1);
  }

  // Inspect first scene (pm-293)
  const firstExpected = snapshot.scenes[0];
  const firstScene = scenes.first();
  assert.equal(await firstScene.getAttribute("data-scene-plan"), firstExpected.planId);
  assert.match(await firstScene.locator('[data-testid="emaki-scene-heading"]').innerText(), new RegExp(firstExpected.title));
  assert.equal(await firstScene.locator('[data-testid="emaki-scene-date"]').getAttribute("datetime"), firstExpected.date);

  // All 4 reusable ink figures are rendered inside the scene via <use href="#emaki-figure-...">
  for (const roleKey of ROLE_KEYS) {
    const figUse = firstScene.locator(`g[data-figure-role="${roleKey}"] > use`);
    assert.equal(await figUse.count(), 1);
    assert.equal(await figUse.getAttribute("href"), `#emaki-figure-${roleKey}`);
  }

  // All 4 role/model badges match the snapshot
  const roleBadges = firstScene.locator('[data-testid="emaki-role-badge"]');
  assert.equal(await roleBadges.count(), 4);
  for (let i = 0; i < firstExpected.roles.length; i++) {
    const expectedRole = firstExpected.roles[i];
    const badge = roleBadges.nth(i);
    assert.equal(await badge.getAttribute("data-role"), expectedRole.role);
    assert.equal(await badge.getAttribute("data-model-id"), expectedRole.modelId);
    assert.match(await badge.innerText(), new RegExp(expectedRole.label));
    assert.match(await badge.innerText(), new RegExp(expectedRole.modelId));
  }

  // Clickable GitHub commit link
  const commitLink = firstScene.locator('a[data-testid="emaki-commit-link"]');
  assert.equal(await commitLink.getAttribute("href"), firstExpected.commitUrl);
  assert.match(await commitLink.innerText(), new RegExp(firstExpected.sha));

  assert.deepEqual(errors.unexpected, []);
});

test("vertical scrolling scrubs horizontal translation and parallax layers, keyboard steps scenes, and reduced motion stays static", async () => {
  const { page, errors } = await open({ reducedMotion: "no-preference" });
  await page.goto(`${BASE}/making-of`);

  const root = page.locator('[data-testid="emaki-root"]');
  await page.locator('[data-testid="emaki-root"][data-hydrated="true"]').waitFor({ state: "visible" });
  assert.equal(await root.getAttribute("data-hydrated"), "true");
  assert.equal(await root.getAttribute("data-reduced-motion"), "false");

  const readScrollState = () =>
    page.evaluate(() => {
      const rootEl = document.querySelector<HTMLElement>('[data-testid="emaki-root"]')!;
      const stageEl = document.querySelector<HTMLElement>('[data-testid="emaki-scroll-stage"]')!;
      const listEl = document.querySelector<HTMLElement>('[data-testid="emaki-scene-list"]')!;
      const cloudsEl = document.querySelector<HTMLElement>('[data-testid="emaki-layer-clouds"]')!;
      const pinesEl = document.querySelector<HTMLElement>('[data-testid="emaki-layer-pines"]')!;
      const rect = stageEl.getBoundingClientRect();
      return {
        stageTop: window.scrollY + rect.top,
        stageHeight: stageEl.offsetHeight,
        viewportHeight: window.innerHeight,
        progress: Number(rootEl.getAttribute("data-progress")),
        activeIndex: Number(rootEl.getAttribute("data-active-scene-index")),
        translateXAttr: Number(listEl.getAttribute("data-translate-x")),
        cloudOffsetAttr: Number(cloudsEl.getAttribute("data-offset-x")),
        pineOffsetAttr: Number(pinesEl.getAttribute("data-offset-x")),
        listTransform: getComputedStyle(listEl).transform,
        cloudsTransform: getComputedStyle(cloudsEl).transform,
        pinesTransform: getComputedStyle(pinesEl).transform,
      };
    });

  const initial = await readScrollState();
  assert.equal(initial.progress, 0);
  assert.equal(initial.translateXAttr, 0);
  assert.equal(initial.activeIndex, 0);

  const scrollable = Math.max(400, initial.stageHeight - initial.viewportHeight);

  // Scroll to ~45% of the sticky stage
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(initial.stageTop + scrollable * 0.45));
  await page.waitForFunction(
    () => Number(document.querySelector('[data-testid="emaki-scene-list"]')?.getAttribute("data-translate-x")) < -100,
  );
  const mid = await readScrollState();

  assert.ok(mid.progress > 0.3 && mid.progress < 0.7, `expected mid progress, got ${mid.progress}`);
  assert.ok(mid.translateXAttr < -200, `expected negative translateX, got ${mid.translateXAttr}`);
  assert.ok(Math.abs(mid.cloudOffsetAttr) < Math.abs(mid.pineOffsetAttr));
  assert.ok(Math.abs(mid.pineOffsetAttr) < Math.abs(mid.translateXAttr));
  assert.ok(mid.activeIndex > 0);
  assert.match(mid.listTransform, /^matrix\(1,\s*0,\s*0,\s*1,\s*-\d+/);

  // Scroll to 100% of the sticky stage
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(initial.stageTop + scrollable + 50));
  await page.waitForFunction(
    () => Number(document.querySelector('[data-testid="emaki-root"]')?.getAttribute("data-progress")) >= 0.99,
  );
  const end = await readScrollState();

  assert.equal(end.progress, 1);
  assert.ok(end.translateXAttr < mid.translateXAttr, `expected ${end.translateXAttr} < ${mid.translateXAttr}`);
  assert.equal(end.activeIndex, snapshot.scenes.length - 1);

  // Keyboard navigation: Home resets to scene 0, ArrowRight advances to scene 1 and 2, ArrowLeft steps back
  const controls = page.locator('[data-testid="emaki-controls"]');
  await controls.focus();
  await page.keyboard.press("Home");
  assert.equal(await root.getAttribute("data-active-scene-index"), "0");

  await page.keyboard.press("ArrowRight");
  assert.equal(await root.getAttribute("data-active-scene-index"), "1");
  assert.equal(await root.getAttribute("data-active-scene"), snapshot.scenes[1].planId);
  assert.match(
    await page.locator('[data-testid="emaki-live-status"]').innerText(),
    new RegExp(`Scene 2 of ${snapshot.scenes.length}: ${snapshot.scenes[1].planId}`),
  );

  await page.keyboard.press("ArrowRight");
  assert.equal(await root.getAttribute("data-active-scene-index"), "2");

  await page.keyboard.press("ArrowLeft");
  assert.equal(await root.getAttribute("data-active-scene-index"), "1");

  assert.deepEqual(errors.unexpected, []);

  // Negative control: prefers-reduced-motion disables parallax and keeps static layout on scroll
  const reduced = await open({ reducedMotion: "reduce" });
  await reduced.page.goto(`${BASE}/making-of`);
  const reducedRoot = reduced.page.locator('[data-testid="emaki-root"]');
  await reduced.page.locator('[data-testid="emaki-root"][data-hydrated="true"]').waitFor({ state: "visible" });
  assert.equal(await reducedRoot.getAttribute("data-reduced-motion"), "true");

  await reduced.page.evaluate(() => window.scrollTo(0, 700));
  const reducedState = await reduced.page.evaluate(() => {
    const listEl = document.querySelector<HTMLElement>('[data-testid="emaki-scene-list"]')!;
    const cloudsEl = document.querySelector<HTMLElement>('[data-testid="emaki-layer-clouds"]')!;
    const pinesEl = document.querySelector<HTMLElement>('[data-testid="emaki-layer-pines"]')!;
    const viewportEl = document.querySelector<HTMLElement>('[data-testid="emaki-sticky-viewport"]')!;
    return {
      translateXAttr: listEl.getAttribute("data-translate-x"),
      listTransform: getComputedStyle(listEl).transform,
      cloudsTransform: getComputedStyle(cloudsEl).transform,
      pinesTransform: getComputedStyle(pinesEl).transform,
      viewportPosition: getComputedStyle(viewportEl).position,
    };
  });

  assert.deepEqual(reducedState, {
    translateXAttr: "0",
    listTransform: "none",
    cloudsTransform: "none",
    pinesTransform: "none",
    viewportPosition: "static",
  });
  assert.deepEqual(reduced.errors.unexpected, []);
});

test("no-JS visitors receive the complete server-rendered semantic <ol> with all scenes, role models, and commit links", async () => {
  const { page, errors } = await open({ javaScriptEnabled: false });
  await page.goto(`${BASE}/making-of`);

  const root = page.locator('[data-testid="emaki-root"]');
  await root.waitFor({ state: "visible" });
  assert.equal(await root.getAttribute("data-hydrated"), "false");

  const sceneList = page.locator('ol[data-testid="emaki-scene-list"]');
  await sceneList.waitFor({ state: "visible" });
  assert.equal(await sceneList.locator('> li[data-testid="emaki-scene"]').count(), snapshot.scenes.length);
  assert.equal(
    await page.locator('[data-testid="emaki-role-badge"]').count(),
    snapshot.scenes.length * 4,
  );
  assert.equal(
    await page.locator('a[data-testid="emaki-commit-link"]').count(),
    snapshot.scenes.length,
  );

  const firstLinkHref = await page.locator('a[data-testid="emaki-commit-link"]').first().getAttribute("href");
  assert.equal(firstLinkHref, snapshot.scenes[0].commitUrl);

  assert.deepEqual(errors.unexpected, []);
});
