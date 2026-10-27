import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { after, before, test } from "node:test";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
} from "playwright-core";
import { site } from "../content/site.ts";

const isPlaywrightCli =
  process.env.OTOHIME_E2E_DIRECT !== "1" &&
  process.argv.some(
    (arg) =>
      /(?:^|[\\/])playwright(?:\.js|\.mjs|\.cjs)?$/.test(arg) ||
      arg.includes("node_modules/.bin/playwright") ||
      arg.includes("/playwright/"),
  );

if (isPlaywrightCli) {
  const shortTmp =
    process.env.TMPDIR && process.env.TMPDIR.length < 40 ? process.env.TMPDIR : "/tmp";
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "scripts/e2e.mjs",
      "--test",
      "e2e/daruma.test.ts",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        TMPDIR: shortTmp,
        OTOHIME_E2E_DIRECT: "1",
      },
    },
  );
  spawnSync("git", ["checkout", "--", "content/history.json"], { stdio: "ignore" });
  process.exit(result.status ?? 1);
}

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

test("default /projects shows all 11 live projects as two-eyed upright Daruma dolls and an honest empty state on the unfinished shelf", async () => {
  const { page, errors } = await open();
  await page.goto(`${BASE}/projects`);

  const cartridgesBtn = page.getByRole("button", { name: "Cartridges", exact: true });
  const darumaBtn = page.getByRole("button", { name: "Daruma shelf", exact: true });

  assert.equal(await cartridgesBtn.getAttribute("aria-pressed"), "true");
  assert.equal(await darumaBtn.getAttribute("aria-pressed"), "false");
  assert.equal(await page.locator("ul.cartridges > li").count(), site.projectList.length);
  assert.equal(await page.locator('[data-testid="daruma-board"]').count(), 0);

  // Every project in Cartridges view carries a "live" badge (zero misreported building/shelved routes)
  const cartridgeStatuses = await page
    .locator("ul.cartridges > li .badge")
    .allInnerTexts();
  assert.equal(cartridgeStatuses.length, 11);
  assert.ok(
    cartridgeStatuses.every((s) => s.trim().toLowerCase() === "live"),
    `Expected all 11 cartridge badges to be 'live', got ${JSON.stringify(cartridgeStatuses)}`,
  );

  const summary = page.locator('[data-testid="daruma-shelf-summary"]');
  assert.match(await summary.innerText(), /11 shipped · 0 on the unfinished shelf/);

  await darumaBtn.click();
  const board = page.locator('[data-testid="daruma-board"]');
  await board.waitFor({ state: "visible" });
  assert.equal(await darumaBtn.getAttribute("aria-pressed"), "true");
  assert.equal(await cartridgesBtn.getAttribute("aria-pressed"), "false");
  assert.equal(await board.getAttribute("data-fixture-active"), "false");
  assert.equal(await board.getAttribute("data-kuyo-active"), "false");
  assert.equal(await page.locator("ul.cartridges").count(), 0);

  const shippedShelf = page.locator('section[data-shelf="shipped"]');
  const unfinishedShelf = page.locator('section[data-shelf="unfinished"]');
  assert.ok(await shippedShelf.isVisible());
  assert.ok(await unfinishedShelf.isVisible());
  assert.equal(await shippedShelf.locator(".daruma-card").count(), 11);
  assert.equal(await unfinishedShelf.locator(".daruma-card").count(), 0);

  // Honest empty state on the unfinished shelf
  const emptyState = unfinishedShelf.locator('[data-testid="daruma-unfinished-empty"]');
  await emptyState.waitFor({ state: "visible" });
  assert.match(
    await emptyState.innerText(),
    /All 11 current projects have shipped — every Daruma doll has both eyes painted\./,
  );

  // Verify Barometer, Structures, Design system, and Shore are all on the shipped shelf with both eyes painted (0px)
  for (const title of ["Shore", "Barometer", "Structures", "Design system"]) {
    const card = shippedShelf.locator(`[data-daruma-project="${title}"]`);
    assert.equal(await card.getAttribute("data-eye-state"), "both", `${title} eyeState`);
    assert.equal(await card.getAttribute("data-abandoned"), "false", `${title} abandoned`);
    assert.equal(await card.getAttribute("data-kuyo-retiring"), "false", `${title} retiring`);
    assert.equal(await card.getAttribute("data-demo-fixture"), "false", `${title} demoFixture`);
  }

  const barometer = shippedShelf.locator('[data-daruma-project="Barometer"]');
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
    rightPainted: "true",
    leftOffset: "0px",
    rightOffset: "0px",
  });

  // Lighting Kuyo on the truthful default board reports 0 abandoned dolls to retire
  const liveStatus = page.locator('[data-testid="daruma-kuyo-status"]');
  assert.equal(await liveStatus.getAttribute("aria-live"), "polite");
  assert.equal(
    await liveStatus.innerText(),
    "Daruma Kuyo fire is at rest. No abandoned dolls on the shelf.",
  );
  const kuyoToggle = page.locator('[data-kuyo-toggle="true"]');
  await kuyoToggle.click();
  assert.equal(await board.getAttribute("data-kuyo-active"), "true");
  assert.equal(
    await liveStatus.innerText(),
    "Daruma Kuyo ink-fire ceremony lit: no abandoned Daruma dolls to retire.",
  );
  assert.equal(await page.locator('[data-testid="daruma-kuyo-fire"]').count(), 0);

  // Switch back to Cartridges
  await cartridgesBtn.click();
  await page.locator("ul.cartridges").waitFor({ state: "visible" });
  assert.equal(await page.locator("ul.cartridges > li").count(), site.projectList.length);
  assert.deepEqual(errors, []);
});

test("opt-in ?fixture=kuyo, interactive shelf toggle, and window.__DARUMA_FIXTURES__ exercise one-eyed unfinished dolls and Daruma Kuyo ink-fire retirement", async () => {
  const { page, errors } = await open();

  // 1) Navigate to /projects?fixture=kuyo -> opens Daruma view with 11 shipped live projects + 3 demo unfinished dolls
  await page.goto(`${BASE}/projects?fixture=kuyo`);
  const board = page.locator('[data-testid="daruma-board"]');
  await board.waitFor({ state: "visible" });
  assert.equal(await board.getAttribute("data-fixture-active"), "true");
  assert.equal(await board.getAttribute("data-kuyo-active"), "false");

  const shippedShelf = page.locator('section[data-shelf="shipped"]');
  const unfinishedShelf = page.locator('section[data-shelf="unfinished"]');
  assert.equal(await shippedShelf.locator(".daruma-card").count(), 11);
  assert.equal(await unfinishedShelf.locator(".daruma-card").count(), 3);
  assert.equal(await unfinishedShelf.locator('[data-testid="daruma-unfinished-empty"]').count(), 0);

  // Every unfinished card is clearly badged as a demo fixture and has no link to a live route
  const demoBadges = await unfinishedShelf.locator('[data-testid="daruma-fixture-badge"]').count();
  assert.equal(demoBadges, 3);
  assert.equal(await unfinishedShelf.locator("a.daruma-title").count(), 0);

  // Active one-eyed demo doll ("Demo: Night Backfill"): left eye painted (0px), right eye blank (100px)
  const activeDemo = unfinishedShelf.locator('[data-daruma-project="Demo: Night Backfill"]');
  assert.equal(await activeDemo.getAttribute("data-eye-state"), "left");
  assert.equal(await activeDemo.getAttribute("data-abandoned"), "false");
  assert.equal(await activeDemo.getAttribute("data-demo-fixture"), "true");
  const activeEyes = await activeDemo.evaluate(async (card) => {
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
  assert.deepEqual(activeEyes, {
    leftPainted: "true",
    rightPainted: "false",
    leftOffset: "0px",
    rightOffset: "100px",
  });

  // Blank-eyed abandoned demo doll ("Demo: Unturned Ledger"): neither eye painted (both 100px)
  const blankDemo = unfinishedShelf.locator('[data-daruma-project="Demo: Unturned Ledger"]');
  assert.equal(await blankDemo.getAttribute("data-eye-state"), "none");
  assert.equal(await blankDemo.getAttribute("data-abandoned"), "true");
  const blankEyes = await blankDemo.evaluate((card) => {
    const left = card.querySelector<SVGPathElement>(".daruma-eye-left")!;
    const right = card.querySelector<SVGPathElement>(".daruma-eye-right")!;
    return {
      leftPainted: left.getAttribute("data-painted"),
      rightPainted: right.getAttribute("data-painted"),
      leftOffset: getComputedStyle(left).strokeDashoffset,
      rightOffset: getComputedStyle(right).strokeDashoffset,
    };
  });
  assert.deepEqual(blankEyes, {
    leftPainted: "false",
    rightPainted: "false",
    leftOffset: "100px",
    rightOffset: "100px",
  });

  // 2) Trigger Daruma Kuyo via the button -> lights ink-fire on the 2 abandoned demo dolls
  const liveStatus = page.locator('[data-testid="daruma-kuyo-status"]');
  assert.match(await liveStatus.innerText(), /Daruma Kuyo fire is at rest\. 2 abandoned Daruma dolls wait/);

  const kuyoToggle = page.locator('[data-kuyo-toggle="true"]');
  await kuyoToggle.click();
  assert.equal(await board.getAttribute("data-kuyo-active"), "true");
  assert.equal(await kuyoToggle.getAttribute("aria-pressed"), "true");
  assert.match(
    await liveStatus.innerText(),
    /Daruma Kuyo ink-fire ceremony lit: retiring 2 abandoned Daruma dolls \(Demo: Winter Sketchbook, Demo: Unturned Ledger\) in sumi ink flames\./,
  );
  assert.equal(await page.locator('[data-kuyo-retiring="true"]').count(), 2);
  assert.equal(await page.locator('[data-testid="daruma-kuyo-fire"]').count(), 2);
  assert.equal(
    await page.locator('[data-daruma-project="Structures"] [data-testid="daruma-kuyo-fire"]').count(),
    0,
  );
  assert.equal(
    await page.locator('[data-daruma-project="Demo: Night Backfill"] [data-testid="daruma-kuyo-fire"]').count(),
    0,
  );

  // 3) Interactive demo toggle on the unfinished shelf hides and reloads the fixture
  const fixtureToggle = page.locator('[data-testid="daruma-fixture-toggle"]');
  assert.equal(await fixtureToggle.getAttribute("aria-pressed"), "true");
  await fixtureToggle.click();
  assert.equal(await board.getAttribute("data-fixture-active"), "false");
  assert.equal(await unfinishedShelf.locator(".daruma-card").count(), 0);
  assert.ok(await unfinishedShelf.locator('[data-testid="daruma-unfinished-empty"]').isVisible());

  await fixtureToggle.click();
  assert.equal(await board.getAttribute("data-fixture-active"), "true");
  assert.equal(await unfinishedShelf.locator(".daruma-card").count(), 3);

  // 4) Advancing injected clock to 2027-02-15 retires all 3 demo dolls while keeping all 11 live projects shipped
  await page.goto(`${BASE}/projects?fixture=kuyo&kuyo=1&now=2027-02-15`);
  await board.waitFor({ state: "visible" });
  assert.equal(await board.getAttribute("data-now"), "2027-02-15");
  assert.equal(await shippedShelf.locator(".daruma-card").count(), 11);
  assert.equal(await page.locator('[data-kuyo-retiring="true"]').count(), 3);
  assert.match(
    await liveStatus.innerText(),
    /retiring 3 abandoned Daruma dolls \(Demo: Night Backfill, Demo: Winter Sketchbook, Demo: Unturned Ledger\)/,
  );

  // 5) window.__DARUMA_FIXTURES__ override works without ?fixture=kuyo in the URL
  const winContext = await open();
  await winContext.context.addInitScript(() => {
    window.__DARUMA_FIXTURES__ = "kuyo";
  });
  await winContext.page.goto(`${BASE}/projects`);
  const winBoard = winContext.page.locator('[data-testid="daruma-board"]');
  await winBoard.waitFor({ state: "visible" });
  assert.equal(await winBoard.getAttribute("data-fixture-active"), "true");
  assert.equal(
    await winContext.page.locator('section[data-shelf="unfinished"] .daruma-card').count(),
    3,
  );
  assert.deepEqual(winContext.errors, []);
  assert.deepEqual(errors, []);
});

test("hover and focus wobble shipped and unfinished Daruma dolls and settle upright, while reduced motion stays still", async () => {
  const { page, errors } = await open({ reducedMotion: "no-preference" });
  await page.goto(`${BASE}/projects?fixture=kuyo&kuyo=1`);

  const unfinishedCard = page.locator('[data-daruma-project="Demo: Night Backfill"]');
  await unfinishedCard.waitFor({ state: "visible" });
  await page.mouse.move(5, 5);

  const wobbleResult = await unfinishedCard.evaluate(async (card) => {
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
    `expected daruma-wobble animation on unfinished doll, got ${JSON.stringify(wobbleResult.anims)}`,
  );
  assert.match(wobbleResult.settledTransform, /^(none|matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\))$/);

  // Verify Kuyo ink-fire flame and ember animations are active under normal motion
  const retiringDemo = page.locator('[data-daruma-project="Demo: Winter Sketchbook"]');
  const fireAnims = await retiringDemo.evaluate((card) => {
    const flame = card.querySelector<SVGPathElement>(".daruma-kuyo-flame")!;
    const ember = card.querySelector<SVGCircleElement>(".daruma-kuyo-ember")!;
    return {
      flameAnim: getComputedStyle(flame).animationName,
      emberAnim: getComputedStyle(ember).animationName,
    };
  });
  assert.equal(fireAnims.flameAnim, "daruma-kuyo-flicker");
  assert.equal(fireAnims.emberAnim, "daruma-kuyo-ember");
  assert.deepEqual(errors, []);

  // Reduced motion negative control: zero wobble, eye, or ink-fire animations
  const reduced = await open({ reducedMotion: "reduce" });
  await reduced.page.goto(`${BASE}/projects?fixture=kuyo&kuyo=1`);
  await reduced.page.locator('[data-testid="daruma-board"]').waitFor({ state: "visible" });
  const root = reduced.page.locator(".daruma-root");
  assert.equal(await root.getAttribute("data-reduced-motion"), "true");

  const reducedCard = reduced.page.locator('[data-daruma-project="Demo: Winter Sketchbook"]');
  await reducedCard.hover();
  await reducedCard.focus();
  const reducedState = await reducedCard.evaluate((card) => {
    const fig = card.querySelector<HTMLElement>(".daruma-doll-figure")!;
    const flame = card.querySelector<SVGPathElement>(".daruma-kuyo-flame")!;
    const ember = card.querySelector<SVGCircleElement>(".daruma-kuyo-ember")!;
    return {
      figAnimationName: getComputedStyle(fig).animationName,
      figTransform: getComputedStyle(fig).transform,
      flameAnimationName: getComputedStyle(flame).animationName,
      emberAnimationName: getComputedStyle(ember).animationName,
      runningAnims: card.getAnimations({ subtree: true }).length,
    };
  });
  assert.deepEqual(reducedState, {
    figAnimationName: "none",
    figTransform: "none",
    flameAnimationName: "none",
    emberAnimationName: "none",
    runningAnims: 0,
  });
  assert.deepEqual(reduced.errors, []);
});
