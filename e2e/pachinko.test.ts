import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { after, afterEach, before, test } from "node:test";
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
  await browser?.close();
  rmSync(tmp, { recursive: true, force: true });
});

// Each machine owns a continuous canvas/physics loop. Dispose completed tests'
// pages before the next test so old machines cannot starve its drain clock.
afterEach(async () => {
  for (const context of contexts.splice(0)) await context.close();
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

  // Wait until the entire 60-record Backfill drains back to IN-FLIGHT: 0 with completed >= 30
  await page.waitForFunction(
    () => {
      const activeBadge = document.querySelector('[data-testid="pachinko-active-badge"]');
      const settledEl = document.querySelector('[data-testid="pachinko-readout-settled"]');
      const partEl = document.querySelector('[data-testid="pachinko-partition-total"]');
      const settled = Number.parseInt(settledEl?.textContent || "0", 10);
      const partitioned = Number.parseInt(partEl?.textContent || "0", 10);
      return (
        activeBadge?.textContent?.trim() === "IN-FLIGHT: 0" &&
        settled >= 30 &&
        partitioned >= 24
      );
    },
    undefined,
    { timeout: 12_000 },
  );

  assert.equal(await page.getByTestId("pachinko-active-badge").textContent(), "IN-FLIGHT: 0");

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
    const activeBadge = document.querySelector('[data-testid="pachinko-active-badge"]');
    const el = document.querySelector('[data-testid="pachinko-readout-settled"]');
    return (
      activeBadge?.textContent?.trim() === "IN-FLIGHT: 0" &&
      Boolean(el && Number.parseInt(el.textContent || "0", 10) >= 6)
    );
  });

  assert.deepEqual(errors.unexpected, []);
});

test("site paper-and-ink CSS tokens, opaque surfaces/borders, sticky status-bar clearance below .masthead, and 60-record Backfill drain to IN-FLIGHT: 0 at 1366x768 and 390x844", async () => {
  const cssSource = readFileSync("app/(site)/(app)/play/pachinko/pachinko.css", "utf8");
  const cssWithoutComments = cssSource.replace(/\/\*[\s\S]*?\*\//g, "");
  const referencedVars = [
    ...new Set([...cssWithoutComments.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\b/g)].map((m) => m[1]!)),
  ];
  assert.ok(referencedVars.length >= 6, `expected CSS custom properties in pachinko.css, got ${referencedVars.length}`);
  for (const forbidden of ["--fg", "--bg", "--accent"]) {
    assert.equal(
      referencedVars.includes(forbidden),
      false,
      `pachinko.css must not reference undefined token ${forbidden}`,
    );
  }

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    const { page, errors } = await open({
      viewport,
      ...(viewport.width === 390 ? { isMobile: true, hasTouch: true } : {}),
    });
    await page.clock.install();
    await page.goto(`${BASE}/play/pachinko?seed=1346454344`);
    await page
      .locator('[data-testid="pachinko-root"][data-hydrated="true"]')
      .waitFor({ state: "visible" });

    // (a) Verify every var(--*) token in pachinko.css resolves non-empty on document.documentElement
    const tokenAudit = await page.evaluate((vars) => {
      const rootStyle = getComputedStyle(document.documentElement);
      const resolved: Record<string, string> = {};
      for (const v of vars) {
        resolved[v] = rootStyle.getPropertyValue(v).trim();
      }
      const undefinedControl = rootStyle.getPropertyValue("--fg").trim();
      return { resolved, undefinedControl };
    }, referencedVars);

    assert.equal(tokenAudit.undefinedControl, "", "negative control: undefined --fg must resolve empty on :root");
    for (const [token, value] of Object.entries(tokenAudit.resolved)) {
      assert.ok(
        value.length > 0,
        `expected ${token} to resolve non-empty on document.documentElement at ${viewport.width}x${viewport.height}, got "${value}"`,
      );
    }

    // Open pager first so .pachinko-pager can be audited alongside machine surfaces, then dismiss it
    await page.getByTestId("pachinko-dlq-streak-btn").click();
    await page.getByTestId("pachinko-pager").waitFor({ state: "visible" });

    // (b) Verify borderTopWidth >= 1 and opaque backgroundColor on all required surfaces
    const surfaceSelectors = [
      ".pachinko-root",
      ".pachinko-status-bar",
      ".pachinko-stage-panel",
      ".pachinko-telemetry-panel",
      ".pachinko-plunger-rail",
      ".pachinko-plunger-track",
      ".pachinko-plunger-knob",
      ".pachinko-btn",
      ".pachinko-pager",
    ];

    const surfaceAudit = await page.evaluate((selectors) => {
      const isOpaqueColor = (bg: string): boolean => {
        if (!bg || bg === "transparent" || bg === "rgba(0, 0, 0, 0)") return false;
        const rgbaMatch = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([0-9.]+)\s*\)$/.exec(bg);
        if (rgbaMatch) {
          return Number.parseFloat(rgbaMatch[1]!) >= 0.99;
        }
        return bg.startsWith("rgb(");
      };

      const results = selectors.map((sel) => {
        const els = [...document.querySelectorAll<HTMLElement>(sel)];
        const checks = els.map((el) => {
          const cs = getComputedStyle(el);
          const borderTopWidth = Number.parseFloat(cs.borderTopWidth);
          const borderTopStyle = cs.borderTopStyle;
          const backgroundColor = cs.backgroundColor;
          return {
            borderTopWidth,
            borderTopStyle,
            backgroundColor,
            borderOk: borderTopWidth >= 1 && borderTopStyle !== "none",
            bgOk: isOpaqueColor(backgroundColor),
          };
        });
        return {
          selector: sel,
          count: els.length,
          allBordersOk: checks.length > 0 && checks.every((c) => c.borderOk),
          allBgsOk: checks.length > 0 && checks.every((c) => c.bgOk),
          sample: checks[0] ?? null,
        };
      });

      // Negative control: verify the same predicate rejects a transparent/borderless element
      const probe = document.createElement("div");
      probe.style.background = "transparent";
      probe.style.border = "0px none";
      document.body.appendChild(probe);
      const probeCs = getComputedStyle(probe);
      const negativeControlRejected =
        !(Number.parseFloat(probeCs.borderTopWidth) >= 1 && probeCs.borderTopStyle !== "none") &&
        !isOpaqueColor(probeCs.backgroundColor);
      probe.remove();

      return { results, negativeControlRejected };
    }, surfaceSelectors);

    assert.equal(surfaceAudit.negativeControlRejected, true, "negative control must reject transparent borderless surface");
    for (const item of surfaceAudit.results) {
      assert.ok(item.count > 0, `expected ${item.selector} to exist at ${viewport.width}x${viewport.height}`);
      assert.equal(
        item.allBordersOk,
        true,
        `expected borderTopWidth >= 1 on ${item.selector} at ${viewport.width}x${viewport.height}, got ${JSON.stringify(item.sample)}`,
      );
      assert.equal(
        item.allBgsOk,
        true,
        `expected opaque backgroundColor on ${item.selector} at ${viewport.width}x${viewport.height}, got ${JSON.stringify(item.sample)}`,
      );
    }

    // Dismiss pager and reset board before scroll + 60-record Backfill drain check
    await page.getByTestId("pachinko-pager-dismiss").click();
    await page.getByTestId("pachinko-reset-btn").click();
    assert.equal(await page.getByTestId("pachinko-active-badge").textContent(), "IN-FLIGHT: 0");

    // (c) Scroll down the page and verify .pachinko-status-bar stays below .masthead with an opaque background
    await page.evaluate(() => window.scrollTo(0, 360));
    await page.waitForTimeout(80);

    const stickyScrollCheck = await page.evaluate(() => {
      const masthead = document.querySelector(".masthead")!;
      const statusBar = document.querySelector(".pachinko-status-bar")!;
      const mRect = masthead.getBoundingClientRect();
      const sRect = statusBar.getBoundingClientRect();
      const sStyle = getComputedStyle(statusBar);
      return {
        scrollY: window.scrollY,
        mastheadBottom: mRect.bottom,
        statusBarTop: sRect.top,
        backgroundColor: sStyle.backgroundColor,
        borderTopWidth: Number.parseFloat(sStyle.borderTopWidth),
        zIndex: Number.parseInt(sStyle.zIndex || "0", 10),
        mastheadZIndex: Number.parseInt(getComputedStyle(masthead).zIndex || "0", 10),
      };
    });

    assert.ok(stickyScrollCheck.scrollY > 100, `expected scrollY > 100 at ${viewport.width}x${viewport.height}, got ${stickyScrollCheck.scrollY}`);
    assert.ok(
      stickyScrollCheck.statusBarTop >= stickyScrollCheck.mastheadBottom - 1,
      `expected .pachinko-status-bar top (${stickyScrollCheck.statusBarTop}) >= .masthead bottom (${stickyScrollCheck.mastheadBottom}) at ${viewport.width}x${viewport.height}`,
    );
    assert.ok(
      stickyScrollCheck.backgroundColor.startsWith("rgb(") &&
        stickyScrollCheck.backgroundColor !== "rgba(0, 0, 0, 0)",
      `expected opaque .pachinko-status-bar background on scroll, got ${stickyScrollCheck.backgroundColor}`,
    );
    assert.ok(stickyScrollCheck.borderTopWidth >= 1);
    assert.ok(stickyScrollCheck.zIndex < stickyScrollCheck.mastheadZIndex);

    await page.evaluate(() => window.scrollTo(0, 0));

    // (d) Click Backfill (60 records) and verify it drains completely back to IN-FLIGHT: 0 with completed >= 30
    const backfillBtn = page.getByTestId("pachinko-backfill-btn");
    assert.equal(await backfillBtn.getAttribute("data-batch-size"), "60");
    await backfillBtn.click();

    // Drive real rAF callbacks at a fixed cadence. CPU load must not decide
    // whether the physics has received enough steps to drain all 60 records.
    for (let second = 0; second < 30; second++) {
      const drained = await page.evaluate(() => {
        const activeBadge = document.querySelector('[data-testid="pachinko-active-badge"]');
        const settledEl = document.querySelector('[data-testid="pachinko-readout-settled"]');
        const settled = Number.parseInt(settledEl?.textContent || "0", 10);
        return activeBadge?.textContent?.trim() === "IN-FLIGHT: 0" && settled >= 30;
      });
      if (drained) break;
      await page.clock.runFor(1000);
    }

    const drainSummary = await page.evaluate(() => {
      const activeText = document.querySelector('[data-testid="pachinko-active-badge"]')?.textContent?.trim() ?? "";
      const settledText = document.querySelector('[data-testid="pachinko-readout-settled"]')?.textContent ?? "0";
      const joinedText = document.querySelector('[data-testid="pachinko-readout-joined"]')?.textContent ?? "0";
      return {
        activeText,
        completed: Number.parseInt(settledText, 10),
        joined: Number.parseInt(joinedText, 10),
      };
    });

    assert.equal(drainSummary.activeText, "IN-FLIGHT: 0");
    assert.ok(
      drainSummary.completed >= 30,
      `expected completed >= 30 after 60-record Backfill at ${viewport.width}x${viewport.height}, got ${drainSummary.completed}`,
    );
    assert.equal(
      drainSummary.completed + drainSummary.joined,
      60,
      `expected totalCompleted (${drainSummary.completed}) + joinMergeCount (${drainSummary.joined}) === 60`,
    );

    assert.deepEqual(errors.unexpected, []);
  }
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

  // Drain both normal records before injecting the next DLQ. A late normal
  // settlement otherwise resets the streak between the DLQ click and assertion.
  await page.getByTestId("pachinko-launch-btn").click();
  await page.getByTestId("pachinko-launch-btn").click();
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="pachinko-partition-total"]');
    const active = document.querySelector('[data-testid="pachinko-active-badge"]');
    return el && Number.parseInt(el.textContent || "0", 10) >= 1 && active?.textContent?.trim() === "IN-FLIGHT: 0";
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
