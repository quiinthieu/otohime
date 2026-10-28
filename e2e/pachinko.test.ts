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
import { dbToGain, MAX_DB } from "../lib/sound.ts";
import { collectBrowserErrors } from "./console-errors.ts";

if (
  !process.env.OTOHIME_E2E_SUBPROCESS &&
  process.argv.some(
    (arg) =>
      /(?:^|[\\/])playwright(?:\.js|-core)?$/i.test(arg) ||
      arg.includes("playwright/cli"),
  )
) {
  const args = process.env.BASE_URL
    ? [
        "--experimental-strip-types",
        "--disable-warning=ExperimentalWarning",
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--test",
        "e2e/pachinko.test.ts",
      ]
    : [
        "--experimental-strip-types",
        "--disable-warning=ExperimentalWarning",
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "scripts/e2e.mjs",
        "--test",
        "e2e/pachinko.test.ts",
      ];
  const res = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      OTOHIME_E2E_SUBPROCESS: "1",
      TMPDIR: process.env.TMPDIR || "/tmp",
    },
  });
  spawnSync("git", ["checkout", "--", "content/history.json"], {
    stdio: "ignore",
  });
  rmSync("test-results", { recursive: true, force: true });
  process.exit(res.status ?? 1);
}

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
let browser: Browser;
const contexts: BrowserContext[] = [];
const tmp = mkdtempSync("/tmp/pachinko-e2e-");

before(async () => {
  const env = { ...process.env, TMPDIR: tmp };
  if (process.env.CHROME_PATH) {
    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH,
      env,
    });
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

interface OpenPachinkoOptions extends BrowserContextOptions {
  tiltPermission?: "granted" | "denied";
}

async function open(options: OpenPachinkoOptions = {}) {
  const { tiltPermission = "granted", ...contextOptions } = options;
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    ...contextOptions,
  });
  contexts.push(context);

  await context.addInitScript(
    ({ permission }) => {
      const tracker = {
        audioContexts: 0,
        oscillators: 0,
        oscillatorTimestampsMs: [] as number[],
        maxGain: 0,
        tiltPermissionRequests: 0,
      };
      Object.assign(window, { __pachinkoTracker: tracker });

      // Mock DeviceOrientationEvent.requestPermission for mobile tilt-to-nudge verification
      if (!("DeviceOrientationEvent" in window)) {
        Object.defineProperty(window, "DeviceOrientationEvent", {
          configurable: true,
          writable: true,
          value: class DeviceOrientationEvent extends Event {},
        });
      }
      const DevOrient = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      DevOrient.requestPermission = async () => {
        tracker.tiltPermissionRequests += 1;
        return permission;
      };

      const RealAudioContext = window.AudioContext;
      if (typeof RealAudioContext === "function") {
        window.AudioContext = class extends RealAudioContext {
          constructor() {
            super();
            tracker.audioContexts += 1;
          }
          createOscillator() {
            tracker.oscillators += 1;
            tracker.oscillatorTimestampsMs.push(performance.now());
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
    },
    { permission: tiltPermission },
  );

  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
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

test("/play index links to both /play/booth and /play/pachinko and navigates cleanly", async () => {
  const { page, errors } = await open();
  await page.goto(`${BASE}/play`);

  const boothLink = page.getByTestId("play-booth-link");
  const pachinkoLink = page.getByTestId("play-pachinko-link");

  await boothLink.waitFor({ state: "visible" });
  await pachinkoLink.waitFor({ state: "visible" });

  assert.equal(await boothLink.getAttribute("href"), "/play/booth");
  assert.equal(await pachinkoLink.getAttribute("href"), "/play/pachinko");

  await pachinkoLink.click();
  await page.waitForURL("**/play/pachinko");
  await page.getByTestId("pachinko-root").waitFor({ state: "visible" });

  const backLink = page.getByTestId("pachinko-back-to-play");
  assert.equal(await backLink.getAttribute("href"), "/play");

  await backLink.click();
  await page.waitForURL("**/play");
  await boothLink.click();
  await page.waitForURL("**/play/booth");
  await page.getByTestId("booth-studio").waitFor({ state: "visible" });

  assert.deepEqual(errors.unexpected, []);
});

test("plunger pointer drag, keyboard launch, duplicate DUP bounce, and Backfill flood update 6-bucket bar chart and throttled aria-live readout", async () => {
  const { page, errors } = await open();
  await page.goto(`${BASE}/play/pachinko?seed=1346454344`);

  await page.locator('[data-testid="pachinko-root"][data-hydrated="true"]').waitFor({ state: "visible" });
  const canvas = page.getByTestId("pachinko-canvas");
  const plunger = page.getByTestId("pachinko-plunger");
  await canvas.waitFor({ state: "visible" });
  await plunger.waitFor({ state: "visible" });

  // Verify touch-action: none on both canvas and plunger track
  const touchStyles = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="pachinko-canvas"]')!;
    const p = document.querySelector('[data-testid="pachinko-plunger"]')!;
    return {
      canvasTouch: getComputedStyle(c).touchAction,
      plungerTouch: getComputedStyle(p).touchAction,
    };
  });
  assert.equal(touchStyles.canvasTouch, "none");
  assert.equal(touchStyles.plungerTouch, "none");

  // 1. Pointer drag-and-release on the spring plunger track
  const box = await plunger.boundingBox();
  assert.ok(box, "plunger bounding box should exist");
  await page.mouse.move(box.x + box.width / 2, box.y + 16);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 64, { steps: 4 });
  await page.mouse.up();

  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="pachinko-readout-launched"]');
    return el && Number.parseInt(el.textContent || "0", 10) >= 1;
  });

  // 2. Keyboard Space & Enter launch on plunger
  await plunger.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");

  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="pachinko-readout-launched"]');
    return el && Number.parseInt(el.textContent || "0", 10) >= 3;
  });

  // 3. Duplicate key probe triggers Stage 2 Dedupe Gate 'DUP' bounce
  await page.getByTestId("pachinko-launch-duplicate-btn").click();
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="pachinko-readout-deduped"]');
    return el && Number.parseInt(el.textContent || "0", 10) >= 1;
  });

  // 4. Backfill flood button (60 records under normal motion)
  const backfillBtn = page.getByTestId("pachinko-backfill-btn");
  assert.equal(await backfillBtn.getAttribute("data-batch-size"), "60");
  await backfillBtn.click();

  // Wait until at least 24 records settle across the 6 partition buckets
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="pachinko-partition-total"]');
      return el && Number.parseInt(el.textContent || "0", 10) >= 24;
    },
    undefined,
    { timeout: 10_000 },
  );

  // Verify all 6 bucket columns (p0..p5) exist and multiple buckets received records
  const bucketStats = await page.evaluate(() => {
    const ids = ["p0", "p1", "p2", "p3", "p4", "p5"];
    const counts = ids.map((id) => {
      const col = document.querySelector(`[data-testid="pachinko-bucket-${id}"]`);
      return Number(col?.getAttribute("data-count") ?? 0);
    });
    const rps = Number(
      document.querySelector('[data-testid="pachinko-readout-rps"]')?.getAttribute("data-value") ??
        0,
    );
    const lateText =
      document.querySelector('[data-testid="pachinko-readout-late"]')?.textContent ?? "";
    const dlqCount = Number(
      document.querySelector('[data-testid="pachinko-readout-dlq"]')?.getAttribute("data-value") ??
        -1,
    );
    const ariaEl = document.querySelector('[data-testid="pachinko-aria-live"]');
    return {
      counts,
      nonEmptyBuckets: counts.filter((c) => c > 0).length,
      totalBuckets: counts.reduce((a, b) => a + b, 0),
      rps,
      lateText,
      dlqCount,
      ariaLiveAttr: ariaEl?.getAttribute("aria-live"),
      ariaText: ariaEl?.textContent ?? "",
      ariaUpdateCount: Number(ariaEl?.getAttribute("data-update-count") ?? 0),
    };
  });

  assert.equal(bucketStats.counts.length, 6);
  assert.ok(bucketStats.nonEmptyBuckets >= 4, `expected >= 4 non-empty buckets, got ${bucketStats.nonEmptyBuckets}`);
  assert.ok(bucketStats.totalBuckets >= 24);
  assert.ok(bucketStats.rps > 0, `expected records/sec > 0, got ${bucketStats.rps}`);
  assert.match(bucketStats.lateText, /^\d+\.\d%$/);
  assert.ok(bucketStats.dlqCount >= 0);
  assert.equal(bucketStats.ariaLiveAttr, "polite");
  assert.match(bucketStats.ariaText, /Throughput .* records\/sec, late arrivals .*%, DLQ \d+/);
  // Throttled to ~1s so update count stays small during a multi-second flood
  assert.ok(
    bucketStats.ariaUpdateCount >= 1 && bucketStats.ariaUpdateCount <= 10,
    `expected throttled aria update count in [1, 10], got ${bucketStats.ariaUpdateCount}`,
  );

  assert.deepEqual(errors.unexpected, []);
});

test("sound is muted by default (0 AudioContexts) and rate-limited (<= 20/s, <= -18 dB) when toggled on; keyboard and DeviceOrientationEvent tilt-to-nudge work", async () => {
  const { page, errors } = await open({ tiltPermission: "granted" });
  await page.goto(`${BASE}/play/pachinko?seed=99`);

  const root = page.locator('[data-testid="pachinko-root"][data-hydrated="true"]');
  await root.waitFor({ state: "visible" });
  assert.equal(await root.getAttribute("data-sound-on"), "false");

  // Negative control: launch records while sound is OFF -> 0 AudioContexts created
  await page.getByTestId("pachinko-launch-btn").click();
  await page.getByTestId("pachinko-backfill-btn").click();
  await page.waitForTimeout(300);

  const mutedAudio = await page.evaluate(() => {
    const t = (window as unknown as { __pachinkoTracker: { audioContexts: number; oscillators: number } })
      .__pachinkoTracker;
    return { audioContexts: t.audioContexts, oscillators: t.oscillators };
  });
  assert.equal(mutedAudio.audioContexts, 0, "must not instantiate AudioContext while sound is off");
  assert.equal(mutedAudio.oscillators, 0, "must not play peg clicks while sound is off");

  // Toggle sound ON and verify peg clicks play through the shared AudioContext at <= 20/s and <= -18 dB
  const soundToggle = page.getByTestId("pachinko-sound-toggle");
  await soundToggle.click();
  assert.equal(await root.getAttribute("data-sound-on"), "true");

  await page.getByTestId("pachinko-backfill-btn").click();
  await page.waitForFunction(() => {
    const t = (window as unknown as { __pachinkoTracker: { oscillators: number } }).__pachinkoTracker;
    return t.oscillators >= 3;
  });
  await page.waitForTimeout(550);

  const activeAudio = await page.evaluate(() => {
    const t = (
      window as unknown as {
        __pachinkoTracker: {
          audioContexts: number;
          oscillators: number;
          oscillatorTimestampsMs: number[];
          maxGain: number;
        };
      }
    ).__pachinkoTracker;

    // Max oscillators started within any sliding 1000ms window
    const ts = t.oscillatorTimestampsMs;
    let maxInOneSecond = 0;
    for (let i = 0; i < ts.length; i++) {
      let count = 0;
      for (let j = i; j < ts.length; j++) {
        if (ts[j]! - ts[i]! < 950) {
          count += 1;
        }
      }
      if (count > maxInOneSecond) maxInOneSecond = count;
    }

    return {
      audioContexts: t.audioContexts,
      oscillators: t.oscillators,
      maxInOneSecond,
      maxGain: t.maxGain,
    };
  });

  assert.equal(activeAudio.audioContexts, 1, "must reuse a single AudioContext");
  assert.ok(activeAudio.oscillators >= 3, "expected peg click oscillators when sound is enabled");
  assert.ok(
    activeAudio.maxInOneSecond <= 20,
    `expected <= 20 peg clicks per second, got ${activeAudio.maxInOneSecond}`,
  );
  const maxAllowedGain = dbToGain(MAX_DB) + 1e-6;
  assert.ok(
    activeAudio.maxGain <= maxAllowedGain,
    `expected maxGain ${activeAudio.maxGain} <= ${maxAllowedGain} (-18 dB ceiling)`,
  );

  // Keyboard ArrowLeft / ArrowRight and on-screen nudge buttons
  await page.getByTestId("pachinko-canvas").focus();
  await page.keyboard.press("ArrowLeft");
  assert.equal(
    await page.getByTestId("pachinko-nudge-readout").getAttribute("data-last-nudge"),
    "left",
  );
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page.getByTestId("pachinko-nudge-readout").getAttribute("data-last-nudge"),
    "right",
  );

  await page.getByTestId("pachinko-nudge-left").click();
  await page.getByTestId("pachinko-nudge-right").click();
  const nudgeCount = Number(
    await page.getByTestId("pachinko-nudge-readout").getAttribute("data-nudge-count"),
  );
  assert.ok(nudgeCount >= 4, `expected >= 4 nudges recorded, got ${nudgeCount}`);

  // Mobile DeviceOrientationEvent tilt-to-nudge permission flow
  const tiltBtn = page.getByTestId("pachinko-tilt-btn");
  await tiltBtn.click();
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="pachinko-root"]');
    return el?.getAttribute("data-tilt-status") === "active";
  });
  assert.equal(await root.getAttribute("data-tilt-status"), "active");

  await page.evaluate(() => {
    const ev = new Event("deviceorientation") as Event & { gamma?: number };
    ev.gamma = 24;
    window.dispatchEvent(ev);
  });

  await page.waitForFunction(() => {
    const btn = document.querySelector('[data-testid="pachinko-tilt-btn"]');
    return btn?.textContent?.includes("24°") && btn?.getAttribute("data-tilt-gamma") === "24";
  });

  assert.deepEqual(errors.unexpected, []);
});

test("prefers-reduced-motion reduces backfill batch size to 12 and does not auto-run motion on load", async () => {
  const { page, errors } = await open({ reducedMotion: "reduce" });
  await page.goto(`${BASE}/play/pachinko?seed=42`);

  const root = page.locator('[data-testid="pachinko-root"][data-hydrated="true"]');
  await root.waitFor({ state: "visible" });
  assert.equal(await root.getAttribute("data-reduced-motion"), "true");

  // No auto-running balls on initial load
  assert.equal(await page.getByTestId("pachinko-active-badge").textContent(), "IN-FLIGHT: 0");

  // Backfill button uses reduced 12-record batch instead of 60
  const backfillBtn = page.getByTestId("pachinko-backfill-btn");
  assert.equal(await backfillBtn.getAttribute("data-batch-size"), "12");
  assert.match((await backfillBtn.textContent()) ?? "", /12 records/);

  await backfillBtn.click();
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="pachinko-readout-settled"]');
    return el && Number.parseInt(el.textContent || "0", 10) >= 6;
  });

  assert.deepEqual(errors.unexpected, []);
});

test("on-call pager Easter egg: 2-DLQ negative control, 3-consecutive-DLQ trigger, focus management, and viewport containment on 1366x768 desktop and 390x844 mobile", async () => {
  // 1. Desktop (1366x768): verify 2-DLQ + normal record + 1-DLQ negative control, then 3-streak trigger
  const { page, errors } = await open({ viewport: { width: 1366, height: 768 } });
  await page.goto(`${BASE}/play/pachinko?seed=1346454344`);
  await page
    .locator('[data-testid="pachinko-root"][data-hydrated="true"]')
    .waitFor({ state: "visible" });

  const dlqBtn = page.getByTestId("pachinko-launch-dlq-btn");
  const dlqReadout = page.getByTestId("pachinko-readout-dlq");

  // Inject 2 consecutive DLQ spills -> streak = 2, pager must NOT appear
  await dlqBtn.click();
  assert.equal(await dlqReadout.getAttribute("data-streak"), "1");
  await dlqBtn.click();
  assert.equal(await dlqReadout.getAttribute("data-streak"), "2");
  assert.equal(await page.getByTestId("pachinko-pager").count(), 0);

  // Launch 2 normal records so they pair in the join funnel and settle into p0..p5, resetting streak to 0
  await page.getByTestId("pachinko-launch-btn").click();
  await page.getByTestId("pachinko-launch-btn").click();
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="pachinko-partition-total"]');
    return el && Number.parseInt(el.textContent || "0", 10) >= 1;
  });
  assert.equal(await dlqReadout.getAttribute("data-streak"), "0");

  // Inject 1 more DLQ spill (total DLQ = 3, but streak = 1) -> pager STILL must NOT appear
  await dlqBtn.click();
  assert.equal(await dlqReadout.getAttribute("data-value"), "3");
  assert.equal(await dlqReadout.getAttribute("data-streak"), "1");
  assert.equal(
    await page.getByTestId("pachinko-pager").count(),
    0,
    "negative control: 3 non-consecutive DLQ hits must not trigger pager",
  );

  // Now trigger 3 consecutive DLQ spills -> pager opens, focus moves to dismiss button, fits inside 1366x768
  await page.getByTestId("pachinko-dlq-streak-btn").click();
  const pager = page.getByTestId("pachinko-pager");
  await pager.waitFor({ state: "visible" });
  assert.equal(await pager.getAttribute("role"), "dialog");

  await page.waitForFunction(() => {
    const active = document.activeElement as HTMLElement | null;
    return active?.getAttribute("data-testid") === "pachinko-pager-dismiss";
  });

  const desktopBounds = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="pachinko-pager"]')!;
    const r = el.getBoundingClientRect();
    return {
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  });
  assert.ok(desktopBounds.top >= 0, `desktop pager top ${desktopBounds.top} < 0`);
  assert.ok(desktopBounds.left >= 0, `desktop pager left ${desktopBounds.left} < 0`);
  assert.ok(
    desktopBounds.right <= desktopBounds.vw,
    `desktop pager right ${desktopBounds.right} > ${desktopBounds.vw}`,
  );
  assert.ok(
    desktopBounds.bottom <= desktopBounds.vh,
    `desktop pager bottom ${desktopBounds.bottom} > ${desktopBounds.vh}`,
  );

  // Dismiss pager and verify streak resets to 0
  await page.getByTestId("pachinko-pager-dismiss").click();
  assert.equal(await page.getByTestId("pachinko-pager").count(), 0);
  assert.equal(await dlqReadout.getAttribute("data-streak"), "0");
  assert.deepEqual(errors.unexpected, []);

  // 2. Mobile (390x844): verify ?fixture=dlq-streak opens pager strictly inside viewport even when scrolled
  const mobile = await open({ viewport: { width: 390, height: 844 } });
  await mobile.page.goto(`${BASE}/play/pachinko?fixture=dlq-streak`);
  const mobilePager = mobile.page.getByTestId("pachinko-pager");
  await mobilePager.waitFor({ state: "visible" });

  // Scroll down the page and verify the viewport-pinned pager remains strictly within 390x844
  await mobile.page.evaluate(() => window.scrollTo(0, 420));
  await mobile.page.waitForTimeout(80);

  const mobileBounds = await mobile.page.evaluate(() => {
    const el = document.querySelector('[data-testid="pachinko-pager"]')!;
    const r = el.getBoundingClientRect();
    return {
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  });
  assert.ok(mobileBounds.top >= 0, `mobile pager top ${mobileBounds.top} < 0`);
  assert.ok(mobileBounds.left >= 0, `mobile pager left ${mobileBounds.left} < 0`);
  assert.ok(
    mobileBounds.right <= mobileBounds.vw,
    `mobile pager right ${mobileBounds.right} > ${mobileBounds.vw}`,
  );
  assert.ok(
    mobileBounds.bottom <= mobileBounds.vh,
    `mobile pager bottom ${mobileBounds.bottom} > ${mobileBounds.vh}`,
  );

  assert.deepEqual(mobile.errors.unexpected, []);
});
