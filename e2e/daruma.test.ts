import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { after, before, test } from "node:test";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
} from "playwright-core";
import { site } from "../content/site.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
let browser: Browser;
const contexts: BrowserContext[] = [];
const tmp = mkdtempSync("/tmp/daruma-e2e-");

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
    viewport: { width: 1366, height: 820 },
    ...options,
  });
  contexts.push(context);
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return { page, context, errors };
}

test("switches between Cartridges and Daruma shelf views and renders none, left, and both SVG eye states", async () => {
  const { page, errors } = await open();
  await page.goto(`${BASE}/projects`);

  const cartridgesBtn = page.getByRole("button", { name: "Cartridges", exact: true });
  const darumaBtn = page.getByRole("button", { name: "Daruma shelf", exact: true });

  assert.equal(await cartridgesBtn.getAttribute("aria-pressed"), "true");
  assert.equal(await darumaBtn.getAttribute("aria-pressed"), "false");
  assert.equal(await page.locator("ul.cartridges > li").count(), site.projectList.length);
  assert.equal(await page.locator('[data-testid="daruma-board"]').count(), 0);

  await darumaBtn.click();
  await page.locator('[data-testid="daruma-board"]').waitFor({ state: "visible" });
  assert.equal(await darumaBtn.getAttribute("aria-pressed"), "true");
  assert.equal(await cartridgesBtn.getAttribute("aria-pressed"), "false");
  assert.equal(await page.locator("ul.cartridges").count(), 0);

  // Both shelves are populated
  const shippedShelf = page.locator('section[data-shelf="shipped"]');
  const unfinishedShelf = page.locator('section[data-shelf="unfinished"]');
  assert.ok(await shippedShelf.isVisible());
  assert.ok(await unfinishedShelf.isVisible());
  assert.equal(await shippedShelf.locator(".daruma-card").count(), 8);
  assert.equal(await unfinishedShelf.locator(".daruma-card").count(), 3);

  // Shipped project ("Shore"): both eyes painted (stroke-dashoffset 0px once brush animation settles)
  const shore = shippedShelf.locator('[data-daruma-project="Shore"]');
  assert.equal(await shore.getAttribute("data-eye-state"), "both");
  const shoreEyes = await shore.evaluate(async (card) => {
    await Promise.allSettled(card.getAnimations({ subtree: true }).map((a) => a.finished));
    const left = card.querySelector<SVGPathElement>(".daruma-eye-left")!;
    const right = card.querySelector<SVGPathElement>(".daruma-eye-right")!;
    return {
      leftPainted: left.getAttribute("data-painted"),
      rightPainted: right.getAttribute("data-painted"),
      leftOffset: getComputedStyle(left).strokeDashoffset,
      rightOffset: getComputedStyle(right).strokeDashoffset,
    };
  });
  assert.deepEqual(shoreEyes, {
    leftPainted: "true",
    rightPainted: "true",
    leftOffset: "0px",
    rightOffset: "0px",
  });

  // Started & active unfinished project ("Barometer"): left eye painted (0px), right eye blank (100px)
  const barometer = unfinishedShelf.locator('[data-daruma-project="Barometer"]');
  assert.equal(await barometer.getAttribute("data-eye-state"), "left");
  assert.equal(await barometer.getAttribute("data-abandoned"), "false");
  const barometerEyes = await barometer.evaluate(async (card) => {
    await Promise.allSettled(card.getAnimations({ subtree: true }).map((a) => a.finished));
    const left = card.querySelector<SVGPathElement>(".daruma-eye-left")!;
    const right = card.querySelector<SVGPathElement>(".daruma-eye-right")!;
    return {
      leftPainted: left.getAttribute("data-painted"),
      rightPainted: right.getAttribute("data-painted"),
      leftOffset: getComputedStyle(left).strokeDashoffset,
      rightOffset: getComputedStyle(right).strokeDashoffset,
    };
  });
  assert.deepEqual(barometerEyes, {
    leftPainted: "true",
    rightPainted: "false",
    leftOffset: "0px",
    rightOffset: "100px",
  });

  // Unstarted unfinished project ("Design system"): neither eye painted (both 100px)
  const designSystem = unfinishedShelf.locator('[data-daruma-project="Design system"]');
  assert.equal(await designSystem.getAttribute("data-eye-state"), "none");
  assert.equal(await designSystem.getAttribute("data-abandoned"), "true");
  const designEyes = await designSystem.evaluate((card) => {
    const left = card.querySelector<SVGPathElement>(".daruma-eye-left")!;
    const right = card.querySelector<SVGPathElement>(".daruma-eye-right")!;
    return {
      leftPainted: left.getAttribute("data-painted"),
      rightPainted: right.getAttribute("data-painted"),
      leftOffset: getComputedStyle(left).strokeDashoffset,
      rightOffset: getComputedStyle(right).strokeDashoffset,
    };
  });
  assert.deepEqual(designEyes, {
    leftPainted: "false",
    rightPainted: "false",
    leftOffset: "100px",
    rightOffset: "100px",
  });

  // Switch back to Cartridges
  await cartridgesBtn.click();
  await page.locator("ul.cartridges").waitFor({ state: "visible" });
  assert.equal(await page.locator("ul.cartridges > li").count(), site.projectList.length);
  assert.deepEqual(errors, []);
});

test("hover and focus wobble the Daruma doll and settle upright, while reduced motion stays still", async () => {
  const { page, errors } = await open({ reducedMotion: "no-preference" });
  await page.goto(`${BASE}/projects?view=daruma`);

  const shore = page.locator('[data-daruma-project="Shore"]');
  await shore.waitFor({ state: "visible" });
  await page.mouse.move(5, 5);

  const wobbleResult = await shore.evaluate(async (card) => {
    const fig = card.querySelector<HTMLElement>(".daruma-doll-figure")!;
    card.focus();
    const anims = fig
      .getAnimations()
      .filter((a): a is CSSAnimation => a instanceof CSSAnimation)
      .map((a) => a.animationName);
    await Promise.allSettled(fig.getAnimations().map((a) => a.finished));
    const settledTransform = getComputedStyle(fig).transform;
    return { anims, settledTransform };
  });

  assert.ok(
    wobbleResult.anims.includes("daruma-wobble"),
    `expected daruma-wobble animation, got ${JSON.stringify(wobbleResult.anims)}`,
  );
  // Matrix(1, 0, 0, 1, 0, 0) or none proves the doll rolled back upright to 0deg
  assert.match(wobbleResult.settledTransform, /^(none|matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\))$/);
  assert.deepEqual(errors, []);

  // Reduced motion negative control: zero wobble or eye animations
  const reduced = await open({ reducedMotion: "reduce" });
  await reduced.page.goto(`${BASE}/projects?kuyo=1`);
  await reduced.page.locator('[data-testid="daruma-board"]').waitFor({ state: "visible" });
  const root = reduced.page.locator(".daruma-root");
  assert.equal(await root.getAttribute("data-reduced-motion"), "true");

  const reducedCard = reduced.page.locator('[data-daruma-project="Structures"]');
  await reducedCard.hover();
  await reducedCard.focus();
  const reducedState = await reducedCard.evaluate((card) => {
    const fig = card.querySelector<HTMLElement>(".daruma-doll-figure")!;
    const flame = card.querySelector<SVGPathElement>(".daruma-kuyo-flame")!;
    return {
      figAnimationName: getComputedStyle(fig).animationName,
      figTransform: getComputedStyle(fig).transform,
      flameAnimationName: getComputedStyle(flame).animationName,
      runningAnims: card.getAnimations({ subtree: true }).length,
    };
  });
  assert.deepEqual(reducedState, {
    figAnimationName: "none",
    figTransform: "none",
    flameAnimationName: "none",
    runningAnims: 0,
  });
  assert.deepEqual(reduced.errors, []);
});

test("on-demand ?kuyo=1, toggle button, and injectable clock drive Daruma Kuyo ink-fire retirement and aria-live announcements", async () => {
  const { page, errors } = await open();

  // 1) Direct ?kuyo=1 query parameter activates Daruma view and Kuyo ink-fire immediately
  await page.goto(`${BASE}/projects?kuyo=1`);
  const board = page.locator('[data-testid="daruma-board"]');
  await board.waitFor({ state: "visible" });
  assert.equal(await board.getAttribute("data-kuyo-active"), "true");

  const liveStatus = page.locator('[data-testid="daruma-kuyo-status"]');
  assert.equal(await liveStatus.getAttribute("aria-live"), "polite");
  assert.equal(await liveStatus.getAttribute("role"), "status");
  assert.match(
    await liveStatus.innerText(),
    /Daruma Kuyo ink-fire ceremony lit: retiring 2 abandoned Daruma dolls \(Structures, Design system\)/,
  );

  // Abandoned dolls ("Structures" and "Design system") show ink-fire SVG; active/shipped do not (negative control)
  assert.equal(await page.locator('[data-kuyo-retiring="true"]').count(), 2);
  assert.equal(await page.locator('[data-testid="daruma-kuyo-fire"]').count(), 2);
  assert.equal(
    await page.locator('[data-daruma-project="Shore"] [data-testid="daruma-kuyo-fire"]').count(),
    0,
  );
  assert.equal(
    await page.locator('[data-daruma-project="Barometer"] [data-testid="daruma-kuyo-fire"]').count(),
    0,
  );

  // 2) Toggling Kuyo off extinguishes the ink-fire and updates aria-live status
  const kuyoToggle = page.locator('[data-kuyo-toggle="true"]');
  assert.equal(await kuyoToggle.getAttribute("aria-pressed"), "true");
  await kuyoToggle.click();
  assert.equal(await board.getAttribute("data-kuyo-active"), "false");
  assert.equal(await kuyoToggle.getAttribute("aria-pressed"), "false");
  assert.equal(await page.locator('[data-testid="daruma-kuyo-fire"]').count(), 0);
  assert.match(await liveStatus.innerText(), /Daruma Kuyo fire is at rest/);

  // Toggling Kuyo back on relights the ink-fire
  await kuyoToggle.click();
  assert.equal(await board.getAttribute("data-kuyo-active"), "true");
  assert.equal(await page.locator('[data-testid="daruma-kuyo-fire"]').count(), 2);

  // 3) Injectable clock: advancing clock to 2026-12-28 lights December Kuyo automatically, and advancing to 2027-02-15 retires Barometer too
  await page.goto(`${BASE}/projects?view=daruma&now=2026-12-28`);
  await board.waitFor({ state: "visible" });
  assert.equal(await board.getAttribute("data-now"), "2026-12-28");
  assert.equal(await board.getAttribute("data-kuyo-active"), "true");

  await page.goto(`${BASE}/projects?kuyo=1&now=2027-02-15`);
  await board.waitFor({ state: "visible" });
  assert.equal(await board.getAttribute("data-now"), "2027-02-15");
  assert.equal(await page.locator('[data-kuyo-retiring="true"]').count(), 3);
  assert.match(
    await liveStatus.innerText(),
    /retiring 3 abandoned Daruma dolls \(Barometer, Structures, Design system\)/,
  );
  assert.deepEqual(errors, []);
});
