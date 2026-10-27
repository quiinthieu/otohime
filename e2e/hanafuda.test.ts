import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { after, before, test } from "node:test";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from "playwright-core";
import rawYearlyLog from "../content/yearly-log.json" with { type: "json" };
import { dbToGain, MAX_DB } from "../lib/sound.ts";
import { collectBrowserErrors } from "./console-errors.ts";

if (
  !process.env.OTOHIME_E2E_SUBPROCESS &&
  process.argv.some((arg) => /(?:^|[\\/])playwright(?:\.js|-core)?$/i.test(arg) || arg.includes("playwright/cli"))
) {
  const args = process.env.BASE_URL
    ? [
        "--experimental-strip-types",
        "--disable-warning=ExperimentalWarning",
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--test",
        "e2e/hanafuda.test.ts",
      ]
    : [
        "--experimental-strip-types",
        "--disable-warning=ExperimentalWarning",
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "scripts/e2e.mjs",
        "--test",
        "e2e/hanafuda.test.ts",
      ];
  const res = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, OTOHIME_E2E_SUBPROCESS: "1", TMPDIR: process.env.TMPDIR || "/tmp" },
  });
  spawnSync("git", ["checkout", "--", "content/history.json"], { stdio: "ignore" });
  rmSync("test-results", { recursive: true, force: true });
  process.exit(res.status ?? 1);
}

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
let browser: Browser;
const contexts: BrowserContext[] = [];
const tmp = mkdtempSync("/tmp/hanafuda-e2e-");

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
    viewport: { width: 1366, height: 860 },
    ...options,
  });
  contexts.push(context);

  await context.addInitScript(() => {
    const tracker = {
      vtCalls: 0,
      audioContexts: 0,
      oscillators: 0,
      maxGain: 0,
    };
    Object.assign(window, { __hanafudaTracker: tracker });

    if (typeof document.startViewTransition === "function") {
      const origStart = document.startViewTransition.bind(document);
      document.startViewTransition = (...args: Parameters<typeof origStart>) => {
        tracker.vtCalls++;
        return origStart(...args);
      };
    }

    const RealAudioContext = window.AudioContext;
    if (typeof RealAudioContext === "function") {
      window.AudioContext = class extends RealAudioContext {
        constructor() {
          super();
          tracker.audioContexts++;
        }
        createOscillator() {
          tracker.oscillators++;
          return super.createOscillator();
        }
        createGain() {
          const g = super.createGain();
          const origSet = g.gain.setValueAtTime.bind(g.gain);
          const origRamp = g.gain.linearRampToValueAtTime.bind(g.gain);
          g.gain.setValueAtTime = (value: number, startTime: number) => {
            if (value > tracker.maxGain) tracker.maxGain = value;
            return origSet(value, startTime);
          };
          g.gain.linearRampToValueAtTime = (value: number, endTime: number) => {
            if (value > tracker.maxGain) tracker.maxGain = value;
            return origRamp(value, endTime);
          };
          return g;
        }
      };
    }
  });

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

test("/play links to /play/hanafuda and renders all 48 ink-and-washi SVG cards with unique ViewTransition names", async () => {
  const { page, errors } = await open();
  await page.goto(`${BASE}/play`);

  const link = page.locator('[data-testid="play-hanafuda-link"]');
  await link.waitFor({ state: "visible" });
  assert.equal(await link.getAttribute("href"), "/play/hanafuda");
  await link.click();
  await page.waitForURL(`${BASE}/play/hanafuda`);

  const board = page.locator('[data-testid="hanafuda-board"][data-hydrated="true"]');
  await board.waitFor({ state: "visible" });

  // Initial deal: 8 human hand cards, 8 CPU face-down cards, 8 field cards, 24 stock cards
  assert.equal(await page.locator('[data-testid="human-hand"] > li').count(), 8);
  assert.equal(await page.locator('[data-testid="cpu-hand"] > li').count(), 8);
  assert.equal(await page.locator('[data-testid="field-cards"] > li').count(), 8);
  assert.match(await page.locator('[data-testid="stock-count"]').innerText(), /24 cards/);

  // All 48 traditional cards are rendered in the 48-card deck gallery with shared frame + motif paths
  const deckItems = page.locator('[data-testid="full-48-deck"] > li');
  assert.equal(await deckItems.count(), 48);

  const svgSummary = await page.locator('[data-testid="full-48-deck"]').evaluate((el) => {
    const svgs = [...el.querySelectorAll<SVGSVGElement>("svg.hanafuda-card-svg")];
    const ids = svgs.map((s) => s.getAttribute("data-svg-card-id")).filter(Boolean);
    const allHaveRimAndPaths = svgs.every(
      (s) =>
        s.querySelector("rect.hanafuda-card-rim") !== null &&
        s.querySelector("rect.hanafuda-card-inner-frame") !== null &&
        s.querySelectorAll("path.hanafuda-motif-path").length >= 2,
    );
    return { count: svgs.length, uniqueIds: new Set(ids).size, allHaveRimAndPaths };
  });
  assert.deepEqual(svgSummary, {
    count: 48,
    uniqueIds: 48,
    allHaveRimAndPaths: true,
  });

  // Verify zero duplicate view-transition-names across the entire document
  const vtNames = await page.locator("*").evaluateAll((els) =>
    els
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => getComputedStyle(el).viewTransitionName)
      .filter((n) => n && n !== "none" && n !== "auto"),
  );
  assert.equal(new Set(vtNames).size, vtNames.length, `Duplicate VT names: ${vtNames.join(",")}`);
  assert.deepEqual(errors.unexpected, []);
});

test("seeded pointer drag-to-match and tap-to-match trigger View Transitions, red hanko stamp, brush-stroke 'Koi-koi?' prompt, and Shobu/Koi-koi decisions", async () => {
  const { page, errors } = await open({ reducedMotion: "no-preference" });
  await page.goto(`${BASE}/play/hanafuda?seed=53`);

  const board = page.locator('[data-testid="hanafuda-board"][data-hydrated="true"]');
  await board.waitFor({ state: "visible" });
  assert.equal(await board.getAttribute("data-seed"), "53");
  assert.equal(await board.getAttribute("data-phase"), "play-hand");

  // 1) Drag-to-match on Seed 53 (HANAMI_ZAKE_SEED): drag 03-hikari-curtain onto 03-tanzaku-akatan
  const curtainCard = page.locator('[data-hand-card-id="03-hikari-curtain"]');
  const cherryRibbonField = page.locator('[data-field-card-id="03-tanzaku-akatan"]');
  await curtainCard.dragTo(cherryRibbonField);

  // Prompt appears with red hanko stamp and brush-stroke 'Koi-koi?' heading
  const prompt = page.locator('[data-testid="koi-koi-prompt"]');
  await prompt.waitFor({ state: "visible" });
  assert.equal(await board.getAttribute("data-phase"), "koi-koi-decision");

  const hanko = page.locator('[data-testid="hanko-stamp"]');
  assert.equal(await hanko.getAttribute("data-yaku-id"), "Hanami-zake");
  assert.match(await hanko.innerText(), /花見酒/);

  const brushHeading = page.locator('[data-testid="koi-koi-brush-heading"]');
  assert.match(await brushHeading.innerText(), /Koi-koi\?/);

  const liveStatus = page.locator('[data-testid="hanafuda-live-status"]');
  assert.equal(await liveStatus.getAttribute("aria-live"), "polite");
  assert.match(await liveStatus.innerText(), /You formed Hanami-zake \(5 pts\) — Koi-koi\?/);

  // View Transition executed for the capture
  const vtCountAfterDrag = Number(await board.getAttribute("data-view-transitions"));
  assert.ok(vtCountAfterDrag >= 1, `expected ViewTransition count >= 1, got ${vtCountAfterDrag}`);

  // Choose "Koi-koi (Continue round)" -> human Koi-koi badge appears, CPU takes its turn, returns to human play-hand
  await page.locator('[data-testid="decide-koi-koi"]').click();
  assert.equal(await board.getAttribute("data-phase"), "play-hand");
  assert.equal(await board.getAttribute("data-active-player"), "human");
  assert.ok(await page.locator('[data-testid="human-koikoi-badge"]').isVisible());
  assert.match(await liveStatus.innerText(), /Koi-koi! You continue the round/);

  // 2) Switch to Seed 151 (TSUKIMI_ZAKE_SEED) and use tap-to-match + Shobu
  await page.locator('[data-testid="seed-tsukimi"]').click();
  assert.equal(await board.getAttribute("data-seed"), "151");
  assert.equal(await board.getAttribute("data-phase"), "play-hand");

  const aotanCard = page.locator('[data-hand-card-id="09-tanzaku-aotan"]');
  const sakeCupField = page.locator('[data-field-card-id="09-tane-sake-cup"]');

  // First tap selects the hand card and announces matching field card in aria-live
  await aotanCard.click();
  assert.equal(await aotanCard.getAttribute("aria-pressed"), "true");
  assert.match(
    await liveStatus.innerText(),
    /Selected Chrysanthemum with Blue Ribbon.*Tap matching Chrysanthemum with Sake Cup/,
  );

  // Second tap on matching field card completes the capture and triggers Tsukimi-zake Koi-koi? prompt
  await sakeCupField.click();
  await prompt.waitFor({ state: "visible" });
  assert.equal(await hanko.getAttribute("data-yaku-id"), "Tsukimi-zake");
  assert.match(await liveStatus.innerText(), /You formed Tsukimi-zake \(5 pts\) — Koi-koi\?/);

  // Call Shobu to bank 5 points and finish Round 1
  await page.locator('[data-testid="decide-shobu"]').click();
  assert.equal(await board.getAttribute("data-phase"), "round-over");
  assert.match(await page.locator('[data-testid="human-score"]').innerText(), /5 pts/);
  assert.match(await liveStatus.innerText(), /Shobu! You win Round 1 with Tsukimi-zake for 5 pts/);

  // Advance to Round 2
  await page.locator('[data-testid="next-round-btn"]').click();
  assert.equal(await board.getAttribute("data-round"), "2");
  assert.equal(await board.getAttribute("data-phase"), "play-hand");
  assert.deepEqual(errors.unexpected, []);
});

test("keyboard navigation matches cards and opt-in WebAudio shuffle sound respects off-by-default toggle and -18 dB cap", async () => {
  const { page, errors } = await open();
  await page.goto(`${BASE}/play/hanafuda?seed=53`);

  const board = page.locator('[data-testid="hanafuda-board"][data-hydrated="true"]');
  await board.waitFor({ state: "visible" });

  // Negative control: sound is off by default, so keyboard play creates 0 AudioContexts
  const soundToggle = page.locator('[data-testid="hanafuda-sound-toggle"]');
  assert.equal(await soundToggle.getAttribute("aria-pressed"), "false");

  // Focus first hand card, use ArrowRight to reach 03-hikari-curtain (index 4 in seed 53 hand)
  const firstHandCard = page.locator("[data-hand-card-id]").first();
  await firstHandCard.focus();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("ArrowRight");
  }
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute("data-hand-card-id")),
    "03-hikari-curtain",
  );

  // Press Space to select, ArrowUp to focus matching field card 03-tanzaku-akatan, Enter to capture
  await page.keyboard.press(" ");
  assert.equal(
    await page.locator('[data-hand-card-id="03-hikari-curtain"]').getAttribute("aria-pressed"),
    "true",
  );
  await page.keyboard.press("ArrowUp");
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute("data-field-card-id")),
    "03-tanzaku-akatan",
  );
  await page.keyboard.press("Enter");

  await page.locator('[data-testid="koi-koi-prompt"]').waitFor({ state: "visible" });
  const silentAudio = await page.evaluate(
    () => (window as unknown as { __hanafudaTracker: { audioContexts: number; oscillators: number } }).__hanafudaTracker,
  );
  assert.equal(silentAudio.audioContexts, 0, "No AudioContext opened while sound is off");
  assert.equal(silentAudio.oscillators, 0);

  // Opt-in to sound: plays open + shuffle within -18 dB cap
  await soundToggle.click();
  assert.equal(await soundToggle.getAttribute("aria-pressed"), "true");
  await page.locator('[data-testid="decide-shobu"]').click();

  const activeAudio = await page.evaluate(
    () =>
      (
        window as unknown as {
          __hanafudaTracker: { audioContexts: number; oscillators: number; maxGain: number };
        }
      ).__hanafudaTracker,
  );
  assert.equal(activeAudio.audioContexts, 1);
  assert.ok(activeAudio.oscillators >= 6, `Expected shuffle/stamp oscillators, got ${activeAudio.oscillators}`);
  assert.ok(
    activeAudio.maxGain <= dbToGain(MAX_DB) + 1e-6,
    `Peak gain ${activeAudio.maxGain} exceeded MAX_DB (${MAX_DB} dB = ${dbToGain(MAX_DB)})`,
  );

  // Turn sound back off
  await soundToggle.click();
  assert.equal(await soundToggle.getAttribute("aria-pressed"), "false");
  assert.deepEqual(errors.unexpected, []);
});

test("flippable monthly card backs reveal shipped projects, notes, and commit counts from content/yearly-log.json", async () => {
  const { page, errors } = await open();
  await page.goto(`${BASE}/play/hanafuda`);

  const board = page.locator('[data-testid="hanafuda-board"][data-hydrated="true"]');
  await board.waitFor({ state: "visible" });

  // Flip Month 10 (Maple) in the Monthly Shipped Log deck
  const flipOctBtn = page.locator('[data-testid="flip-month-10"]');
  assert.equal(await flipOctBtn.getAttribute("aria-pressed"), "false");
  await flipOctBtn.click();
  assert.equal(await flipOctBtn.getAttribute("aria-pressed"), "true");

  // Verify Month 10 card backs flip to data-flipped="true" and show shipped projects from yearly-log.json
  const octDeckCard = page.locator('[data-deck-item-id="10-tane-deer"] .hanafuda-card-tile');
  assert.equal(await octDeckCard.getAttribute("data-flipped"), "true");

  const octBack = octDeckCard.locator('[data-testid="card-back-10"]');
  await octBack.waitFor({ state: "visible" });
  const octCommitsText = await octBack.locator('[data-testid="card-back-commits-10"]').innerText();
  assert.match(octCommitsText, new RegExp(`${rawYearlyLog.months["10"].commits} commits`));

  const octProjectsText = await octBack.locator('[data-testid="card-back-projects-10"]').innerText();
  for (const proj of rawYearlyLog.months["10"].shippedProjects) {
    assert.ok(
      octProjectsText.includes(proj.title),
      `Expected Month 10 card back to include shipped project "${proj.title}"`,
    );
  }

  // Live announcement reports the Month 10 flip
  const liveStatus = page.locator('[data-testid="hanafuda-live-status"]');
  assert.match(
    await liveStatus.innerText(),
    new RegExp(`Flipped Month 10 \\(Maple\\) card back: ${rawYearlyLog.months["10"].commits} commits`),
  );

  // Flip Month 09 (Chrysanthemum) and verify its notes from yearly-log.json
  await page.locator('[data-testid="flip-month-09"]').click();
  const sepDeckCard = page.locator('[data-deck-item-id="09-tane-sake-cup"] .hanafuda-card-tile');
  assert.equal(await sepDeckCard.getAttribute("data-flipped"), "true");
  const sepNotesText = await sepDeckCard.locator('[data-testid="card-back-notes-09"]').innerText();
  for (const note of rawYearlyLog.months["09"].notes) {
    assert.ok(sepNotesText.includes(note.title), `Expected Month 09 card back to include note "${note.title}"`);
  }

  // Negative control: Month 01 (Pine) has 0 commits and no shipped projects
  await page.locator('[data-testid="flip-month-01"]').click();
  const janDeckCard = page.locator('[data-deck-item-id="01-hikari-crane"] .hanafuda-card-tile');
  assert.equal(await janDeckCard.getAttribute("data-flipped"), "true");
  assert.match(
    await janDeckCard.locator('[data-testid="card-back-commits-01"]').innerText(),
    /0 commits/,
  );
  assert.equal(await janDeckCard.locator('[data-testid="card-back-projects-01"]').count(), 0);
  assert.deepEqual(errors.unexpected, []);
});

test("prefers-reduced-motion disables View Transitions and keyframe animations while preserving gameplay", async () => {
  const { page, errors } = await open({ reducedMotion: "reduce" });
  await page.goto(`${BASE}/play/hanafuda?seed=53`);

  const board = page.locator('[data-testid="hanafuda-board"][data-hydrated="true"]');
  await board.waitFor({ state: "visible" });
  assert.equal(await board.getAttribute("data-reduced-motion"), "true");

  // Play Turn 1 yaku under reduced motion
  await page.locator('[data-hand-card-id="03-hikari-curtain"]').click();
  await page.locator('[data-field-card-id="03-tanzaku-akatan"]').click();

  const prompt = page.locator('[data-testid="koi-koi-prompt"]');
  await prompt.waitFor({ state: "visible" });

  // Zero View Transitions and zero CSS animations under reduced motion
  assert.equal(await board.getAttribute("data-view-transitions"), "0");
  const reducedStyles = await prompt.evaluate((el) => {
    const hanko = el.querySelector<HTMLElement>('[data-testid="hanko-stamp"]')!;
    const stroke = el.querySelector<SVGPathElement>(".hanafuda-brush-stroke")!;
    return {
      modalAnim: getComputedStyle(el).animationName,
      hankoAnim: getComputedStyle(hanko).animationName,
      strokeAnim: getComputedStyle(stroke).animationName,
      runningAnims: el.getAnimations({ subtree: true }).length,
    };
  });
  assert.deepEqual(reducedStyles, {
    modalAnim: "none",
    hankoAnim: "none",
    strokeAnim: "none",
    runningAnims: 0,
  });
  assert.deepEqual(errors.unexpected, []);
});

async function assertStrictlyInViewport(page: Page, testId: string, viewportHeight: number) {
  const rect = await page.locator(`[data-testid="${testId}"]`).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
      width: r.width,
      height: r.height,
    };
  });
  assert.ok(
    rect.width > 0 && rect.height > 0,
    `Expected ${testId} to have positive dimensions, got ${JSON.stringify(rect)}`,
  );
  assert.ok(
    rect.top >= 0 && rect.bottom <= viewportHeight,
    `Expected ${testId} bounding box strictly inside [0, ${viewportHeight}], got top=${rect.top}, bottom=${rect.bottom}`,
  );
}

test("390x844 mobile and 1366x768 desktop viewports keep koi-koi-prompt and round-result-banner strictly in viewport with focus and aria-live", async () => {
  // 1) 390x844 mobile viewport: scroll to bottom hand, tap card to form yaku, verify koi-koi-decision, round-over, and match-over
  const { page: mobilePage, errors: mobileErrors } = await open({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await mobilePage.goto(`${BASE}/play/hanafuda?seed=1&fixture=koi-koi-ready`);

  const mobileBoard = mobilePage.locator('[data-testid="hanafuda-board"][data-hydrated="true"]');
  await mobileBoard.waitFor({ state: "visible" });
  assert.equal(await mobileBoard.getAttribute("data-fixture"), "koi-koi-ready");
  assert.equal(await mobileBoard.getAttribute("data-phase"), "play-hand");

  // Scroll down to the player hand at the bottom of the ~2500px mobile board
  const mobileHandCard = mobilePage.locator('[data-hand-card-id="03-hikari-curtain"]');
  await mobileHandCard.scrollIntoViewIfNeeded();
  const mobileScrollY = await mobilePage.evaluate(() => window.scrollY);
  assert.ok(
    mobileScrollY > 1000,
    `Expected mobile board to be scrolled down (scrollY > 1000), got ${mobileScrollY}`,
  );

  // Tap the matching hand card at the bottom of the scrolled board to complete Hanami-zake
  await mobileHandCard.tap();
  const mobilePrompt = mobilePage.locator('[data-testid="koi-koi-prompt"]');
  await mobilePrompt.waitFor({ state: "visible" });
  assert.equal(await mobileBoard.getAttribute("data-phase"), "koi-koi-decision");

  // Without manual scrolling, koi-koi-prompt, decide-koi-koi, and decide-shobu must be strictly inside [0, 844]
  await assertStrictlyInViewport(mobilePage, "koi-koi-prompt", 844);
  await assertStrictlyInViewport(mobilePage, "decide-koi-koi", 844);
  await assertStrictlyInViewport(mobilePage, "decide-shobu", 844);
  assert.equal(await mobilePrompt.getAttribute("role"), "region");
  assert.equal(await mobilePrompt.getAttribute("aria-live"), "polite");
  assert.equal(
    await mobilePage.evaluate(() => document.activeElement?.getAttribute("data-testid")),
    "decide-koi-koi",
  );
  const mobileLive = mobilePage.locator('[data-testid="hanafuda-live-status"]');
  assert.equal(await mobileLive.getAttribute("aria-live"), "polite");
  assert.match(await mobileLive.innerText(), /You formed Hanami-zake \(5 pts\) — Koi-koi\?/);

  // Tap decide-shobu -> transitions to round-over; round-result-banner and next-round-btn must be strictly inside [0, 844]
  await mobilePage.locator('[data-testid="decide-shobu"]').tap();
  const mobileBanner = mobilePage.locator('[data-testid="round-result-banner"]');
  await mobileBanner.waitFor({ state: "visible" });
  assert.equal(await mobileBoard.getAttribute("data-phase"), "round-over");
  await assertStrictlyInViewport(mobilePage, "round-result-banner", 844);
  await assertStrictlyInViewport(mobilePage, "next-round-btn", 844);
  assert.equal(await mobileBanner.getAttribute("role"), "region");
  assert.equal(await mobileBanner.getAttribute("aria-live"), "polite");
  assert.equal(
    await mobilePage.evaluate(() => document.activeElement?.getAttribute("data-testid")),
    "next-round-btn",
  );
  assert.match(await mobileLive.innerText(), /Shobu! You win Round 1 with Hanami-zake for 5 pts/);

  // Advance through Round 2 and Round 3 (scrolling to bottom hand in Round 3) to enter match-over
  await mobilePage.locator('[data-testid="next-round-btn"]').tap();
  assert.equal(await mobileBoard.getAttribute("data-round"), "2");
  await mobileHandCard.scrollIntoViewIfNeeded();
  await mobileHandCard.tap();
  await assertStrictlyInViewport(mobilePage, "koi-koi-prompt", 844);
  await mobilePage.locator('[data-testid="decide-shobu"]').tap();
  await assertStrictlyInViewport(mobilePage, "round-result-banner", 844);
  await assertStrictlyInViewport(mobilePage, "next-round-btn", 844);

  await mobilePage.locator('[data-testid="next-round-btn"]').tap();
  assert.equal(await mobileBoard.getAttribute("data-round"), "3");
  await mobileHandCard.scrollIntoViewIfNeeded();
  await mobileHandCard.tap();
  await assertStrictlyInViewport(mobilePage, "koi-koi-prompt", 844);
  await mobilePage.locator('[data-testid="decide-shobu"]').tap();

  assert.equal(await mobileBoard.getAttribute("data-phase"), "match-over");
  await assertStrictlyInViewport(mobilePage, "round-result-banner", 844);
  await assertStrictlyInViewport(mobilePage, "play-again-btn", 844);
  assert.equal(
    await mobilePage.evaluate(() => document.activeElement?.getAttribute("data-testid")),
    "play-again-btn",
  );
  assert.deepEqual(mobileErrors.unexpected, []);

  // 2) 1366x768 desktop viewport: verify koi-koi-decision, round-over, and match-over stay strictly inside [0, 768]
  const { page: desktopPage, errors: desktopErrors } = await open({
    viewport: { width: 1366, height: 768 },
  });
  await desktopPage.goto(`${BASE}/play/hanafuda?seed=1&fixture=koi-koi-ready`);

  const desktopBoard = desktopPage.locator('[data-testid="hanafuda-board"][data-hydrated="true"]');
  await desktopBoard.waitFor({ state: "visible" });
  const desktopHandCard = desktopPage.locator('[data-hand-card-id="03-hikari-curtain"]');
  await desktopHandCard.scrollIntoViewIfNeeded();
  await desktopHandCard.click();

  assert.equal(await desktopBoard.getAttribute("data-phase"), "koi-koi-decision");
  await assertStrictlyInViewport(desktopPage, "koi-koi-prompt", 768);
  await assertStrictlyInViewport(desktopPage, "decide-koi-koi", 768);
  await assertStrictlyInViewport(desktopPage, "decide-shobu", 768);
  assert.equal(
    await desktopPage.evaluate(() => document.activeElement?.getAttribute("data-testid")),
    "decide-koi-koi",
  );

  await desktopPage.locator('[data-testid="decide-shobu"]').click();
  assert.equal(await desktopBoard.getAttribute("data-phase"), "round-over");
  await assertStrictlyInViewport(desktopPage, "round-result-banner", 768);
  await assertStrictlyInViewport(desktopPage, "next-round-btn", 768);
  assert.equal(
    await desktopPage.evaluate(() => document.activeElement?.getAttribute("data-testid")),
    "next-round-btn",
  );

  await desktopPage.locator('[data-testid="next-round-btn"]').click();
  await desktopHandCard.click();
  await desktopPage.locator('[data-testid="decide-shobu"]').click();
  await desktopPage.locator('[data-testid="next-round-btn"]').click();
  await desktopHandCard.click();
  await desktopPage.locator('[data-testid="decide-shobu"]').click();

  assert.equal(await desktopBoard.getAttribute("data-phase"), "match-over");
  await assertStrictlyInViewport(desktopPage, "round-result-banner", 768);
  await assertStrictlyInViewport(desktopPage, "play-again-btn", 768);
  assert.equal(
    await desktopPage.evaluate(() => document.activeElement?.getAttribute("data-testid")),
    "play-again-btn",
  );
  assert.deepEqual(desktopErrors.unexpected, []);
});
