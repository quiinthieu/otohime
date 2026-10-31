import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const CONTENT_APPS_DIR = path.join(REPO_ROOT, "content", "apps");
const PROBE_SLUG = "zzzz-qa-workshop-probe";
const PROBE_FILE = path.join(CONTENT_APPS_DIR, `${PROBE_SLUG}.json`);

function ensureDependencies() {
  const nextBin = path.join(REPO_ROOT, "node_modules", ".bin", "next");
  if (fs.existsSync(nextBin)) return;
  const res = spawnSync("npm", ["ci", "--prefer-offline", "--no-audit", "--no-fund"], {
    cwd: REPO_ROOT,
    env: { ...process.env, TMPDIR: "/tmp" },
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.status !== 0) {
    throw new Error(`npm ci failed (${res.status}):\n${res.stdout}\n${res.stderr}`);
  }
}

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error("No Chrome/Chromium executable found for Playwright QA check");
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
    srv.on("error", reject);
  });
}

async function waitForServer(baseUrl, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/apps`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${baseUrl}/apps`);
}

function restorePrebuildSideEffects() {
  try {
    if (fs.existsSync(PROBE_FILE)) {
      fs.unlinkSync(PROBE_FILE);
    }
  } catch {
    // ignore
  }
  spawnSync(
    "git",
    ["checkout", "--", "content/history.json", "content/contributions.json"],
    {
      cwd: REPO_ROOT,
      stdio: "ignore",
    },
  );
}

function killServerProcessGroup(server) {
  if (!server) return;
  try {
    server.stdout?.destroy();
    server.stderr?.destroy();
  } catch {
    // ignore
  }
  if (server.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // ignore
    }
    try {
      process.kill(-server.pid, "SIGKILL");
    } catch {
      // ignore
    }
  }
  try {
    server.kill("SIGKILL");
  } catch {
    // ignore
  }
}

process.on("SIGINT", () => {
  restorePrebuildSideEffects();
  process.exit(130);
});
process.on("SIGTERM", () => {
  restorePrebuildSideEffects();
  process.exit(143);
});

function verifyBrowserObservation(obs) {
  assert.equal(obs.buildExitCode, 0, "npm run build must exit 0");
  assert.equal(obs.buildIdExists, true, ".next/BUILD_ID must exist after npm run build");

  // 1. Pocket Terminal navigation & Sidebar nav active state
  assert.equal(
    obs.terminalNavigatedPath,
    "/apps",
    "Pocket Terminal 'go apps' must navigate browser to /apps",
  );
  assert.match(obs.sidebarAppsLabel, /Apps/, "Main sidebar nav must include 'Apps' link");
  assert.equal(
    obs.sidebarAppsAriaCurrent,
    "page",
    "Main sidebar 'Apps' link must have aria-current='page' on /apps",
  );

  // 2. /apps catalog cards, hanko stamps, platform badges, generated ink illustrations
  assert.equal(obs.appsIndexStatus, 200, "GET /apps must return HTTP 200");
  assert.deepEqual(
    obs.cards.map((c) => c.slug),
    ["bento", "niwa", "kakeibo", "shiki"],
    "/apps must render all 4 app cards in order",
  );
  assert.deepEqual(
    obs.cards.map((c) => c.title),
    ["Bento", "Niwa", "Kakeibo", "Shiki"],
    "/apps card titles must match Bento, Niwa, Kakeibo, Shiki",
  );

  const expectedCardMotifs = {
    bento: "bento-box",
    niwa: "bonsai-garden",
    kakeibo: "ledger-book",
    shiki: "sun-dial",
  };
  const expectedCardPlatforms = {
    bento: ["macOS", "CLI"],
    niwa: ["macOS", "CLI", "TUI"],
    kakeibo: ["CLI"],
    shiki: ["CLI"],
  };

  for (const card of obs.cards) {
    assert.equal(card.hankoStatus, "building", `${card.slug} card hanko status must be building`);
    assert.equal(
      card.hankoLabel,
      "In development",
      `${card.slug} card hanko label must be 'In development'`,
    );
    assert.equal(card.hasSvgMask, true, `${card.slug} card hanko must contain carved SVG <mask>`);
    assert.equal(card.hankoGlyph, "開", `${card.slug} card hanko glyph must be 開`);
    assert.equal(card.illustrationKind, "ink", `${card.slug} card illustration kind must be ink`);
    assert.equal(
      card.illustrationMotif,
      expectedCardMotifs[card.slug],
      `${card.slug} card illustration motif must match`,
    );
    assert.ok(card.polygonCount >= 4, `${card.slug} ink SVG must render isometric polygons`);
    assert.deepEqual(
      card.badges,
      expectedCardPlatforms[card.slug],
      `${card.slug} card platform badges must match`,
    );
    assert.ok(card.installCmd.startsWith("$ "), `${card.slug} card must show $ install command`);
  }

  // 3. Accessible platform and status filters
  assert.equal(obs.initialCountText, "Showing 4 of 4 apps");
  assert.equal(obs.tuiFilterPressed, "true", "TUI filter button must set aria-pressed='true'");
  assert.equal(obs.tuiFilterCountText, "Showing 1 of 4 apps");
  assert.deepEqual(obs.tuiFilteredSlugs, ["niwa"]);
  assert.equal(obs.releasedFilterCountText, "Showing 0 of 4 apps");
  assert.equal(obs.emptyNoticeVisible, true, "Zero-match filter must display Notice empty state");
  assert.equal(obs.resetCountText, "Showing 4 of 4 apps");
  assert.deepEqual(obs.resetSlugs, ["bento", "niwa", "kakeibo", "shiki"]);

  // 4. Detail pages (/apps/bento, /apps/niwa, /apps/kakeibo, /apps/shiki) + terminal previews
  const expectedPreviewKinds = {
    bento: "frames",
    niwa: "niwa-garden",
    kakeibo: "frames",
    shiki: "shiki-drift",
  };

  assert.equal(obs.details.length, 4, "All 4 app detail pages must be inspected");
  for (const detail of obs.details) {
    assert.equal(detail.status, 200, `/apps/${detail.slug} must return HTTP 200`);
    assert.ok(detail.h1.length > 0, `/apps/${detail.slug} must render h1`);
    assert.equal(detail.hankoStatus, "building", `/apps/${detail.slug} must render hanko stamp`);
    assert.equal(detail.hasSvgMask, true, `/apps/${detail.slug} hanko must render SVG mask`);
    assert.equal(detail.copyStateAfterClick, "copied", `/apps/${detail.slug} CopySnippet must copy`);
    assert.equal(
      detail.copyLiveStatus,
      "Copied command to clipboard.",
      `/apps/${detail.slug} CopySnippet must announce clipboard copy`,
    );
    assert.ok(detail.descriptionParagraphs >= 2, `/apps/${detail.slug} must render description`);
    assert.ok(detail.featureCount >= 3, `/apps/${detail.slug} must render key features`);
    assert.deepEqual(
      detail.lifecycleSteps,
      ["Idea", "Planned", "In development", "Beta", "Released"],
      `/apps/${detail.slug} must render 5-stage lifecycle`,
    );
    assert.equal(
      detail.currentLifecycleStep,
      "In development",
      `/apps/${detail.slug} aria-current='step' must be 'In development'`,
    );
    assert.ok(detail.milestoneCount >= 3, `/apps/${detail.slug} must render milestones`);
    assert.ok(
      detail.milestoneGlyphs.every((g) => ["✓", "●", "○"].includes(g)),
      `/apps/${detail.slug} milestones must use ✓/●/○ glyphs`,
    );
    assert.ok(detail.changelogDates.length >= 1, `/apps/${detail.slug} must render dated changelog`);
    for (const d of detail.changelogDates) {
      assert.match(d, /^\d{4}-\d{2}-\d{2}$/, `/apps/${detail.slug} changelog <time> dateTime`);
    }

    if (detail.slug === "bento") {
      assert.equal(detail.hasRepoLink, true, "/apps/bento must render GitHub repository link");
      assert.equal(detail.hasHomebrewCask, true, "/apps/bento must render Homebrew cask agent-bento");
      assert.equal(detail.primaryCtaText, "Watch on GitHub");
    } else {
      assert.equal(detail.hasRepoLink, false, `/apps/${detail.slug} must omit unverified repo link`);
      assert.match(detail.primaryCtaHref, /^mailto:hello@otohime\.dev\?subject=/);
      assert.equal(detail.secondaryCtaHref, "https://x.com/otohime73");
    }

    // t-1883: Terminal preview region assertions on every detail page
    assert.equal(
      detail.previewKind,
      expectedPreviewKinds[detail.slug],
      `/apps/${detail.slug} must render [data-terminal-preview="${expectedPreviewKinds[detail.slug]}"]`,
    );
    assert.equal(
      detail.previewRole,
      "region",
      `/apps/${detail.slug} terminal preview must have role="region"`,
    );
    assert.ok(
      detail.previewAriaLabel.length > 0,
      `/apps/${detail.slug} terminal preview must have non-empty aria-label`,
    );
    assert.ok(
      detail.previewHasPlayPauseButton,
      `/apps/${detail.slug} terminal preview must render an operable Play/Pause control`,
    );
    assert.equal(
      detail.finiteMountAnimations,
      0,
      `/apps/${detail.slug} must have 0 finite mount animations blocking probe-motion-state.mjs`,
    );
  }

  // t-1883 specific checks for Niwa, Shiki, and Frames previews
  assert.equal(
    obs.niwaPreview.hasMenuBarHeader,
    true,
    "/apps/niwa preview must render simulated macOS menu bar header containing 'niwa'",
  );
  assert.equal(
    obs.niwaPreview.stageButtonCount,
    5,
    "/apps/niwa preview must render 5 stage selector controls",
  );
  assert.equal(
    obs.niwaPreview.stageChangedOnSelect,
    true,
    "/apps/niwa stage selector controls must update the displayed garden stage",
  );

  assert.equal(
    obs.shikiPreview.hasCanvas,
    true,
    "/apps/shiki preview must render a <canvas> solar/horizon strip",
  );
  assert.deepEqual(
    obs.shikiPreview.phasesFound,
    ["Dawn", "Noon", "Sunset", "Midnight"],
    "/apps/shiki preview must expose Dawn, Noon, Sunset, Midnight controls",
  );
  assert.deepEqual(
    obs.shikiPreview.seasonsFound,
    ["Spring", "Summer", "Autumn", "Winter"],
    "/apps/shiki preview must expose Spring, Summer, Autumn, Winter season selectors",
  );
  assert.ok(
    obs.shikiPreview.minObservedContrast >= 7.0,
    `/apps/shiki live WCAG contrast readout must remain >= 7.0 across phases and seasons (min=${obs.shikiPreview.minObservedContrast})`,
  );

  assert.equal(
    obs.framesPreview.bentoStepped,
    true,
    "/apps/bento declarative frames stepper must advance frames when Next/frame control is activated",
  );
  assert.equal(
    obs.framesPreview.kakeiboStepped,
    true,
    "/apps/kakeibo declarative frames stepper must advance frames when Next/frame control is activated",
  );

  // 5. Dynamic zero-code JSON drop-in on /apps and /apps/<slug> (including custom frames preview)
  assert.ok(
    Array.isArray(obs.dropInDetail.catalogSlugs) &&
      obs.dropInDetail.catalogSlugs.includes(PROBE_SLUG) &&
      obs.dropInDetail.catalogSlugs.length === 5,
    "Dropping a 5th JSON file in content/apps/<slug>.json must populate loadApps() for /apps with 5 slugs",
  );
  assert.equal(
    obs.dropInDetail.status,
    200,
    "Dropping a 5th JSON file in content/apps/<slug>.json must populate /apps/<slug> with HTTP 200",
  );
  assert.match(obs.dropInDetail.h1, /Workshop Probe/);
  assert.equal(obs.dropInDetail.motif, "blueprint", "Omitted motif must render blueprint fallback");
  assert.equal(obs.dropInDetail.currentStep, "Idea");
  assert.equal(
    obs.dropInDetail.previewKind,
    "frames",
    "Dropped-in custom JSON manifest with preview.kind='frames' must render [data-terminal-preview='frames']",
  );
  assert.equal(
    obs.dropInDetail.previewStepped,
    true,
    "Dropped-in custom JSON manifest frames stepper must advance when controlled",
  );
  assert.equal(obs.unknownSlugStatus, 404, "Unknown /apps/<slug> must return HTTP 404");

  // 6. Reduced-motion & No-JS (SSR static frame) behavior
  assert.equal(
    obs.reducedMotion.allPausedOnLoad,
    true,
    "Under prefers-reduced-motion: reduce, all previews must set data-reduced-motion='true' and data-playing='false'",
  );
  assert.equal(
    obs.reducedMotion.autoAdvancedDuringWait,
    false,
    "Under prefers-reduced-motion: reduce, automatic timers must NOT advance frames across a 1600ms wait",
  );
  assert.equal(
    obs.reducedMotion.manualKeyboardOperable,
    true,
    "Under prefers-reduced-motion: reduce, manual keyboard controls (stage/time/season/Play) must remain operable",
  );
  assert.equal(
    obs.noJs.allStaticFramesRendered,
    true,
    "Without JS (before hydration), complete static terminal frames must render immediately with data-playing='false'",
  );

  // 7. Responsive viewports & console cleanliness
  assert.equal(obs.desktopOverflow, false, "Desktop 1280x860 must have no horizontal overflow");
  assert.equal(obs.mobileOverflow, false, "Mobile 390x844 must have no horizontal overflow");
  assert.deepEqual(obs.pageErrors, [], "Browser journey must produce zero pageerror/console.error");
}

async function collectBrowserObservation() {
  ensureDependencies();
  const { chromium } = await import("playwright-core");
  const buildIdPath = path.join(REPO_ROOT, ".next", "BUILD_ID");
  const authSecret =
    process.env.BETTER_AUTH_SECRET || "ci-placeholder-not-a-real-secret-0123456789abcdef";

  let buildExitCode = 0;
  if (!fs.existsSync(buildIdPath) || process.env.FORCE_BUILD === "1") {
    const buildRes = spawnSync("npm", ["run", "build"], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        TMPDIR: "/tmp",
        BETTER_AUTH_SECRET: authSecret,
        BETTER_AUTH_URL: "http://127.0.0.1:3000",
      },
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    restorePrebuildSideEffects();
    buildExitCode = buildRes.status ?? 1;
    if (buildExitCode !== 0) {
      throw new Error(
        `npm run build failed (${buildExitCode}):\n${buildRes.stdout}\n${buildRes.stderr}`,
      );
    }
  }
  const buildIdExists = fs.existsSync(buildIdPath);

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const nextBin = path.join(REPO_ROOT, "node_modules", ".bin", "next");
  const server = spawn(nextBin, ["start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: REPO_ROOT,
    detached: true,
    env: {
      ...process.env,
      NODE_ENV: "production",
      TMPDIR: "/tmp",
      BETTER_AUTH_URL: baseUrl,
      BETTER_AUTH_SECRET: authSecret,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", () => {});
  server.stderr?.on("data", () => {});
  server.unref();

  const shortTmp = fs.mkdtempSync("/tmp/otohime-qa-pw-");
  let browser;
  try {
    await waitForServer(baseUrl, 30000);

    browser = await chromium.launch({
      executablePath: findChromeExecutable(),
      headless: true,
      env: { ...process.env, TMPDIR: shortTmp },
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 860 },
      permissions: ["clipboard-read", "clipboard-write"],
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        pageErrors.push(msg.text());
      }
    });

    // 1. Visit /notes and navigate via Pocket Terminal (`/` -> `go apps` -> Enter)
    await page.goto(`${baseUrl}/notes`, { waitUntil: "networkidle" });
    await page.keyboard.press("/");
    await page.locator("dialog.pocket-terminal").waitFor({ state: "visible", timeout: 10000 });
    await page.keyboard.type("go apps");
    await page.keyboard.press("Enter");
    await page.waitForURL(`${baseUrl}/apps`, { timeout: 10000 });
    const terminalNavigatedPath = new URL(page.url()).pathname;

    // 2. Inspect /apps index directly as well
    const indexRes = await page.goto(`${baseUrl}/apps`, { waitUntil: "networkidle" });
    const appsIndexStatus = indexRes?.status() ?? 0;

    const sidebarLink = page.locator('nav[aria-label="Main"] a[href="/apps"]');
    const sidebarAppsLabel = ((await sidebarLink.textContent()) ?? "").trim();
    const sidebarAppsAriaCurrent = await sidebarLink.getAttribute("aria-current");

    const cards = await page.locator("article.app-card").evaluateAll((els) =>
      els.map((el) => {
        const hanko = el.querySelector(".app-hanko");
        const mask = el.querySelector(".app-hanko svg mask");
        const glyph = el.querySelector(".app-hanko svg mask text")?.textContent?.trim() ?? "";
        const hankoLabel = el.querySelector(".app-hanko-label")?.textContent?.trim() ?? "";
        const fig = el.querySelector("figure.app-illustration");
        const polygons = el.querySelectorAll("figure.app-illustration svg polygon").length;
        const badges = Array.from(el.querySelectorAll(".app-badge-list .badge")).map((b) =>
          (b.textContent ?? "").trim(),
        );
        const installCmd = el.querySelector(".app-card-cmd")?.textContent?.trim() ?? "";
        return {
          slug: el.getAttribute("data-app-slug") ?? "",
          title: el.querySelector(".app-card-title")?.textContent?.trim() ?? "",
          hankoStatus: hanko?.getAttribute("data-hanko-status") ?? "",
          hankoLabel,
          hasSvgMask: Boolean(mask),
          hankoGlyph: glyph,
          illustrationKind: fig?.getAttribute("data-illustration-kind") ?? "",
          illustrationMotif: fig?.getAttribute("data-illustration-motif") ?? "",
          polygonCount: polygons,
          badges,
          installCmd,
        };
      }),
    );

    const statusCounter = page.locator(".apps-result-count");
    const initialCountText = ((await statusCounter.textContent()) ?? "").trim();

    // Filter by TUI platform
    const tuiBtn = page
      .locator('[role="group"][aria-labelledby="apps-filter-platform"] button', { hasText: "TUI" });
    await tuiBtn.click();
    const tuiFilterPressed = await tuiBtn.getAttribute("aria-pressed");
    const tuiFilterCountText = ((await statusCounter.textContent()) ?? "").trim();
    const tuiFilteredSlugs = await page
      .locator("article.app-card")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-app-slug") ?? ""));

    // Filter by Released status -> 0 matches
    const releasedBtn = page
      .locator('[role="group"][aria-labelledby="apps-filter-status"] button', {
        hasText: "Released",
      });
    await releasedBtn.click();
    const releasedFilterCountText = ((await statusCounter.textContent()) ?? "").trim();
    const emptyNoticeVisible = await page
      .locator("h2", { hasText: "No apps match those filters" })
      .isVisible();

    // Reset filters
    await page.locator("button", { hasText: "Reset filters" }).first().click();
    const resetCountText = ((await statusCounter.textContent()) ?? "").trim();
    const resetSlugs = await page
      .locator("article.app-card")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-app-slug") ?? ""));

    const desktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );

    // 3. Visit all 4 detail pages and inspect detail + terminal preview behavior
    const details = [];
    const niwaPreview = {
      hasMenuBarHeader: false,
      stageButtonCount: 0,
      stageChangedOnSelect: false,
    };
    const shikiPreview = {
      hasCanvas: false,
      phasesFound: [],
      seasonsFound: [],
      minObservedContrast: 0,
    };
    const framesPreview = {
      bentoStepped: false,
      kakeiboStepped: false,
    };

    for (const slug of ["bento", "niwa", "kakeibo", "shiki"]) {
      const res = await page.goto(`${baseUrl}/apps/${slug}`, { waitUntil: "networkidle" });
      await page.locator(".app-snippet-btn").click();
      await page.waitForSelector('.app-snippet[data-copy-state="copied"]', { timeout: 5000 });

      const detailObs = await page.evaluate((s) => {
        const h1 = document.querySelector(".app-detail-hero h1")?.textContent?.trim() ?? "";
        const hanko = document.querySelector(".app-detail-hero .app-hanko");
        const hasSvgMask = Boolean(hanko?.querySelector("svg mask"));
        const snippet = document.querySelector(".app-snippet");
        const copyStateAfterClick = snippet?.getAttribute("data-copy-state") ?? "";
        const copyLiveStatus =
          document.querySelector(".app-snippet-status")?.textContent?.trim() ?? "";
        const descriptionParagraphs = document.querySelectorAll(".app-prose p").length;
        const featureCount = document.querySelectorAll(".app-feature-card").length;
        const lifecycleSteps = Array.from(
          document.querySelectorAll(".app-lifecycle-step span:nth-child(2)"),
        ).map((el) => (el.textContent ?? "").trim());
        const currentLifecycleStep =
          document
            .querySelector('.app-lifecycle-step[aria-current="step"] span:nth-child(2)')
            ?.textContent?.trim() ?? "";
        const milestoneCount = document.querySelectorAll(".app-milestone").length;
        const milestoneGlyphs = Array.from(
          document.querySelectorAll(".app-milestone-state span[aria-hidden='true']"),
        ).map((el) => (el.textContent ?? "").trim());
        const changelogDates = Array.from(
          document.querySelectorAll(".app-changelog time"),
        ).map((el) => el.getAttribute("dateTime") ?? "");
        const linksText = document.querySelector(".app-links-card")?.textContent ?? "";
        const hasRepoLink = Boolean(
          document.querySelector('.app-links-list a[href="https://github.com/quiinthieu/bento"]'),
        );
        const hasHomebrewCask = linksText.includes("Cask: agent-bento");
        const primaryCta = document.querySelector(".app-follow-actions a.btn-primary");
        const secondaryCta = document.querySelector(".app-follow-actions a.link");

        const previewEl = document.querySelector("[data-terminal-preview]");
        const previewKind = previewEl?.getAttribute("data-terminal-preview") ?? "";
        const previewRole = previewEl?.getAttribute("role") ?? "";
        const previewAriaLabel = previewEl?.getAttribute("aria-label") ?? "";
        const previewButtons = Array.from(previewEl?.querySelectorAll("button") ?? []).map((b) =>
          (b.textContent ?? "").trim(),
        );
        const previewHasPlayPauseButton = previewButtons.some((t) =>
          /^(play|pause)$/i.test(t),
        );

        const Scroll = globalThis.ScrollTimeline;
        const finiteMountAnimations = document
          .getAnimations()
          .filter((a) => !(typeof Scroll === "function" && a.timeline instanceof Scroll))
          .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
          .filter((a) => a.playState !== "finished" && a.playState !== "idle").length;

        return {
          slug: s,
          h1,
          hankoStatus: hanko?.getAttribute("data-hanko-status") ?? "",
          hasSvgMask,
          copyStateAfterClick,
          copyLiveStatus,
          descriptionParagraphs,
          featureCount,
          lifecycleSteps,
          currentLifecycleStep,
          milestoneCount,
          milestoneGlyphs,
          changelogDates,
          hasRepoLink,
          hasHomebrewCask,
          primaryCtaText: primaryCta?.textContent?.trim() ?? "",
          primaryCtaHref: primaryCta?.getAttribute("href") ?? "",
          secondaryCtaHref: secondaryCta?.getAttribute("href") ?? "",
          previewKind,
          previewRole,
          previewAriaLabel,
          previewHasPlayPauseButton,
          finiteMountAnimations,
        };
      }, slug);

      details.push({
        status: res?.status() ?? 0,
        ...detailObs,
      });

      const previewLoc = page.locator("[data-terminal-preview]");
      if ((await previewLoc.count()) > 0) {
        if (slug === "niwa") {
          const textBefore = (await previewLoc.textContent()) ?? "";
          niwaPreview.hasMenuBarHeader = /niwa/i.test(textBefore);
          const stageBtns = previewLoc.locator("button").filter({ hasText: /Stage\s*[1-5]|^[1-5]$/i });
          niwaPreview.stageButtonCount = await stageBtns.count();
          if (niwaPreview.stageButtonCount >= 2) {
            await stageBtns.first().click();
            const textStage1 = (await previewLoc.textContent()) ?? "";
            await stageBtns.nth(niwaPreview.stageButtonCount - 1).click();
            const textStage5 = (await previewLoc.textContent()) ?? "";
            niwaPreview.stageChangedOnSelect = textStage1 !== textStage5;
          }
        } else if (slug === "shiki") {
          shikiPreview.hasCanvas = (await previewLoc.locator("canvas").count()) > 0;
          const phasesFound = [];
          const seasonsFound = [];
          const observedRatios = [];

          for (const phase of ["Dawn", "Noon", "Sunset", "Midnight"]) {
            const btn = previewLoc.locator("button", { hasText: new RegExp(`^${phase}$`, "i") });
            if ((await btn.count()) > 0) {
              phasesFound.push(phase);
              await btn.first().click();
              const txt = (await previewLoc.textContent()) ?? "";
              const m = txt.match(/(\d+(?:\.\d+)?)\s*:\s*1/);
              if (m) observedRatios.push(parseFloat(m[1]));
            }
          }
          for (const season of ["Spring", "Summer", "Autumn", "Winter"]) {
            const btn = previewLoc.locator("button", { hasText: new RegExp(`^${season}$`, "i") });
            if ((await btn.count()) > 0) {
              seasonsFound.push(season);
              await btn.first().click();
              const txt = (await previewLoc.textContent()) ?? "";
              const m = txt.match(/(\d+(?:\.\d+)?)\s*:\s*1/);
              if (m) observedRatios.push(parseFloat(m[1]));
            }
          }
          shikiPreview.phasesFound = phasesFound;
          shikiPreview.seasonsFound = seasonsFound;
          shikiPreview.minObservedContrast =
            observedRatios.length > 0 ? Math.min(...observedRatios) : 0;
        } else if (slug === "bento" || slug === "kakeibo") {
          // Pause first if playing so we deterministically test manual Next/Prev step
          const pauseBtn = previewLoc.locator("button", { hasText: /^Pause$/i });
          if ((await pauseBtn.count()) > 0) {
            await pauseBtn.first().click();
          }
          const beforeFrame = (await previewLoc.textContent()) ?? "";
          const nextBtn = previewLoc.locator("button", { hasText: /Next/i });
          if ((await nextBtn.count()) > 0) {
            await nextBtn.first().click();
          }
          const afterFrame = (await previewLoc.textContent()) ?? "";
          if (slug === "bento") framesPreview.bentoStepped = beforeFrame !== afterFrame;
          if (slug === "kakeibo") framesPreview.kakeiboStepped = beforeFrame !== afterFrame;
        }
      }
    }

    // Check mobile viewport overflow on /apps/bento, /apps/niwa, /apps/shiki and /apps
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/apps`, { waitUntil: "networkidle" });
    const mobileAppsOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    await page.goto(`${baseUrl}/apps/shiki`, { waitUntil: "networkidle" });
    const mobileDetailOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );

    // 4. Dynamically drop a 5th JSON manifest in content/apps/ with a declarative frames preview
    let dropInDetail = {
      status: 0,
      h1: "",
      motif: "",
      currentStep: "",
      previewKind: "",
      previewStepped: false,
      catalogSlugs: [],
    };
    try {
      const probeManifest = {
        $schema: "./_schema.json",
        slug: PROBE_SLUG,
        name: "Workshop Probe",
        tagline: "Dynamic zero-code drop-in verification manifest.",
        status: "idea",
        featured: false,
        order: 99,
        swatch: "pink",
        platforms: ["cli"],
        techStack: ["TypeScript"],
        illustration: {
          kind: "ink",
          alt: "Blueprint fallback artwork for workshop probe",
        },
        preview: {
          kind: "frames",
          title: "workshop-probe terminal stepper",
          command: "npx workshop-probe --verify",
          alt: "Declarative CLI frame stepper for dropped-in workshop probe manifest",
          intervalMs: 1800,
          frames: [
            {
              label: "Probe init",
              lines: ["$ npx workshop-probe --verify", "  loading manifest schema... ok"],
            },
            {
              label: "Probe done",
              lines: ["  verified 5/5 workshop invariants", "  status: green"],
            },
          ],
        },
        description: [
          "First paragraph verifying zero-code drop-in rendering on /apps/[slug].",
          "Second paragraph confirming blueprint fallback motif and Idea lifecycle stage.",
        ],
        features: [
          { title: "Auto-discovered", detail: "Loaded directly from content/apps/ JSON." },
          { title: "Blueprint fallback", detail: "Uses deterministic hashAppSlug seed." },
          { title: "Carved seal", detail: "Renders 構 Idea hanko seal." },
        ],
        install: {
          label: "Preview command",
          command: "npx workshop-probe --help",
        },
        links: {},
        milestones: [
          { title: "Draft manifest", state: "done", target: "2026 Q1" },
          { title: "Verify blueprint fallback", state: "active", target: "2026 Q2" },
        ],
        changelog: [
          { version: "0.0.1", date: "2026-04-02", summary: "Initial probe manifest." },
        ],
      };
      fs.writeFileSync(PROBE_FILE, JSON.stringify(probeManifest, null, 2), "utf8");
      const loaderCheck = spawnSync(
        "node",
        [
          "--experimental-strip-types",
          "--disable-warning=ExperimentalWarning",
          "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
          "-e",
          'import { loadApps } from "./lib/apps-server.ts"; console.log(JSON.stringify(loadApps().map(a => a.slug)));',
        ],
        { cwd: REPO_ROOT, encoding: "utf8" },
      );
      const catalogSlugs =
        loaderCheck.status === 0 ? JSON.parse(loaderCheck.stdout.trim()) : [];
      const probeRes = await page.goto(`${baseUrl}/apps/${PROBE_SLUG}`, {
        waitUntil: "networkidle",
      });
      const probeDom = await page.evaluate(() => ({
        h1: document.querySelector(".app-detail-hero h1")?.textContent?.trim() ?? "",
        motif:
          document
            .querySelector("figure.app-illustration")
            ?.getAttribute("data-illustration-motif") ?? "",
        currentStep:
          document
            .querySelector('.app-lifecycle-step[aria-current="step"] span:nth-child(2)')
            ?.textContent?.trim() ?? "",
        previewKind:
          document
            .querySelector("[data-terminal-preview]")
            ?.getAttribute("data-terminal-preview") ?? "",
      }));

      let previewStepped = false;
      const probePreview = page.locator("[data-terminal-preview]");
      if ((await probePreview.count()) > 0) {
        const pauseBtn = probePreview.locator("button", { hasText: /^Pause$/i });
        if ((await pauseBtn.count()) > 0) await pauseBtn.first().click();
        const beforeTxt = (await probePreview.textContent()) ?? "";
        const nextBtn = probePreview.locator("button", { hasText: /Next/i });
        if ((await nextBtn.count()) > 0) await nextBtn.first().click();
        const afterTxt = (await probePreview.textContent()) ?? "";
        previewStepped = beforeTxt !== afterTxt;
      }

      dropInDetail = {
        status: probeRes?.status() ?? 0,
        catalogSlugs,
        previewStepped,
        ...probeDom,
      };
    } finally {
      if (fs.existsSync(PROBE_FILE)) {
        fs.unlinkSync(PROBE_FILE);
      }
    }

    // 5. Reduced-motion context verification (prefers-reduced-motion: reduce)
    const rmContext = await browser.newContext({
      viewport: { width: 1280, height: 860 },
      reducedMotion: "reduce",
    });
    const rmPage = await rmContext.newPage();
    let allPausedOnLoad = true;
    let autoAdvancedDuringWait = false;
    let manualKeyboardOperable = false;

    for (const slug of ["niwa", "shiki", "bento", "kakeibo"]) {
      await rmPage.goto(`${baseUrl}/apps/${slug}`, { waitUntil: "networkidle" });
      const loc = rmPage.locator("[data-terminal-preview]");
      if ((await loc.count()) === 0) {
        allPausedOnLoad = false;
        autoAdvancedDuringWait = true;
        continue;
      }
      const rmAttr = await loc.getAttribute("data-reduced-motion");
      const playingAttr = await loc.getAttribute("data-playing");
      if (rmAttr !== "true" || playingAttr !== "false") {
        allPausedOnLoad = false;
      }

      if (slug === "niwa" || slug === "shiki") {
        const snapBefore = (await loc.textContent()) ?? "";
        await rmPage.waitForTimeout(1600);
        const snapAfter = (await loc.textContent()) ?? "";
        if (snapBefore !== snapAfter) {
          autoAdvancedDuringWait = true;
        }
      }

      if (slug === "niwa") {
        const beforeKey = (await loc.textContent()) ?? "";
        const stage1Btn = loc.locator("button").filter({ hasText: /Stage\s*1|^1$/i }).first();
        if ((await stage1Btn.count()) > 0) {
          await stage1Btn.focus();
          await rmPage.keyboard.press("Enter");
          const afterStage1 = (await loc.textContent()) ?? "";
          const playBtn = loc.locator("button", { hasText: /^(Play|Pause)$/i }).first();
          if ((await playBtn.count()) > 0) {
            await playBtn.focus();
            await rmPage.keyboard.press("Enter");
          }
          manualKeyboardOperable = beforeKey !== afterStage1;
        }
      }
    }
    await rmContext.close();

    // 6. No-JS context verification (javaScriptEnabled: false)
    const noJsContext = await browser.newContext({
      viewport: { width: 1280, height: 860 },
      javaScriptEnabled: false,
    });
    const noJsPage = await noJsContext.newPage();
    let allStaticFramesRendered = true;
    for (const slug of ["niwa", "shiki", "bento", "kakeibo"]) {
      await noJsPage.goto(`${baseUrl}/apps/${slug}`, { waitUntil: "domcontentloaded" });
      const loc = noJsPage.locator("[data-terminal-preview]");
      if ((await loc.count()) === 0) {
        allStaticFramesRendered = false;
        break;
      }
      const playingAttr = await loc.getAttribute("data-playing");
      const txt = ((await loc.textContent()) ?? "").trim();
      if (playingAttr !== "false" || txt.length < 20) {
        allStaticFramesRendered = false;
      }
    }
    await noJsContext.close();

    // 7. Verify unknown slug returns HTTP 404
    const res404 = await fetch(`${baseUrl}/apps/unknown-nonexistent-slug-404`, {
      redirect: "manual",
    });
    const unknownSlugStatus = res404.status;

    return {
      buildExitCode,
      buildIdExists,
      terminalNavigatedPath,
      sidebarAppsLabel,
      sidebarAppsAriaCurrent,
      appsIndexStatus,
      cards,
      initialCountText,
      tuiFilterPressed,
      tuiFilterCountText,
      tuiFilteredSlugs,
      releasedFilterCountText,
      emptyNoticeVisible,
      resetCountText,
      resetSlugs,
      details,
      niwaPreview,
      shikiPreview,
      framesPreview,
      dropInDetail,
      reducedMotion: {
        allPausedOnLoad,
        autoAdvancedDuringWait,
        manualKeyboardOperable,
      },
      noJs: {
        allStaticFramesRendered,
      },
      unknownSlugStatus,
      desktopOverflow,
      mobileOverflow: mobileAppsOverflow || mobileDetailOverflow,
      pageErrors,
    };
  } finally {
    restorePrebuildSideEffects();
    if (browser) {
      await browser.close().catch(() => {});
    }
    killServerProcessGroup(server);
    fs.rmSync(shortTmp, { recursive: true, force: true });
  }
}

const isNegativeControl = process.argv.includes("--negative-control");

if (isNegativeControl) {
  // Construct a mutated browser observation (missing preview region, reduced-motion timer leak,
  // low WCAG contrast on Shiki, and finite mount animations) and feed into the exact same
  // verifyBrowserObservation() oracle.
  const brokenObservation = {
    buildExitCode: 0,
    buildIdExists: true,
    terminalNavigatedPath: "/apps",
    sidebarAppsLabel: "Apps",
    sidebarAppsAriaCurrent: "page",
    appsIndexStatus: 200,
    cards: [
      {
        slug: "bento",
        title: "Bento",
        hankoStatus: "building",
        hankoLabel: "In development",
        hasSvgMask: true,
        hankoGlyph: "開",
        illustrationKind: "ink",
        illustrationMotif: "bento-box",
        polygonCount: 8,
        badges: ["macOS", "CLI"],
        installCmd: "$ brew install --cask agent-bento",
      },
      {
        slug: "niwa",
        title: "Niwa",
        hankoStatus: "building",
        hankoLabel: "In development",
        hasSvgMask: true,
        hankoGlyph: "開",
        illustrationKind: "ink",
        illustrationMotif: "bonsai-garden",
        polygonCount: 8,
        badges: ["macOS", "CLI", "TUI"],
        installCmd: "$ niwa",
      },
      {
        slug: "kakeibo",
        title: "Kakeibo",
        hankoStatus: "building",
        hankoLabel: "In development",
        hasSvgMask: true,
        hankoGlyph: "開",
        illustrationKind: "ink",
        illustrationMotif: "ledger-book",
        polygonCount: 8,
        badges: ["CLI"],
        installCmd: "$ kakeibo summary --today",
      },
      {
        slug: "shiki",
        title: "Shiki",
        hankoStatus: "building",
        hankoLabel: "In development",
        hasSvgMask: true,
        hankoGlyph: "開",
        illustrationKind: "ink",
        illustrationMotif: "sun-dial",
        polygonCount: 8,
        badges: ["CLI"],
        installCmd: "$ shiki-term status",
      },
    ],
    initialCountText: "Showing 4 of 4 apps",
    tuiFilterPressed: "true",
    tuiFilterCountText: "Showing 1 of 4 apps",
    tuiFilteredSlugs: ["niwa"],
    releasedFilterCountText: "Showing 0 of 4 apps",
    emptyNoticeVisible: true,
    resetCountText: "Showing 4 of 4 apps",
    resetSlugs: ["bento", "niwa", "kakeibo", "shiki"],
    details: ["bento", "niwa", "kakeibo", "shiki"].map((slug) => ({
      slug,
      status: 200,
      h1: slug,
      hankoStatus: "building",
      hasSvgMask: true,
      copyStateAfterClick: "copied",
      copyLiveStatus: "Copied command to clipboard.",
      descriptionParagraphs: 2,
      featureCount: 4,
      lifecycleSteps: ["Idea", "Planned", "In development", "Beta", "Released"],
      currentLifecycleStep: "In development",
      milestoneCount: 4,
      milestoneGlyphs: ["✓", "✓", "●", "○"],
      changelogDates: ["2026-10-24"],
      hasRepoLink: slug === "bento",
      hasHomebrewCask: slug === "bento",
      primaryCtaText: slug === "bento" ? "Watch on GitHub" : "Notify me by email",
      primaryCtaHref:
        slug === "bento"
          ? "https://github.com/quiinthieu/bento"
          : `mailto:hello@otohime.dev?subject=Notify%20me`,
      secondaryCtaHref: slug === "bento" ? "" : "https://x.com/otohime73",
      previewKind: "",
      previewRole: "",
      previewAriaLabel: "",
      previewHasPlayPauseButton: false,
      finiteMountAnimations: 2,
    })),
    niwaPreview: {
      hasMenuBarHeader: false,
      stageButtonCount: 0,
      stageChangedOnSelect: false,
    },
    shikiPreview: {
      hasCanvas: false,
      phasesFound: ["Dawn"],
      seasonsFound: ["Spring"],
      minObservedContrast: 4.1,
    },
    framesPreview: {
      bentoStepped: false,
      kakeiboStepped: false,
    },
    dropInDetail: {
      status: 200,
      h1: "Workshop Probe",
      motif: "blueprint",
      currentStep: "Idea",
      previewKind: "",
      previewStepped: false,
      catalogSlugs: ["bento", "niwa", "kakeibo", "shiki", PROBE_SLUG],
    },
    reducedMotion: {
      allPausedOnLoad: false,
      autoAdvancedDuringWait: true,
      manualKeyboardOperable: false,
    },
    noJs: {
      allStaticFramesRendered: false,
    },
    unknownSlugStatus: 404,
    desktopOverflow: false,
    mobileOverflow: false,
    pageErrors: [],
  };
  verifyBrowserObservation(brokenObservation);
  console.error("ERROR: verifyBrowserObservation failed to reject negative control observation");
  process.exit(0);
} else {
  const observation = await collectBrowserObservation();
  verifyBrowserObservation(observation);
  console.log(
    JSON.stringify({
      ok: true,
      case: "t1883-build-and-browser-preview-journey",
      appsIndexStatus: observation.appsIndexStatus,
      cards: observation.cards.map((c) => c.slug),
      details: observation.details.map((d) => ({
        slug: d.slug,
        status: d.status,
        previewKind: d.previewKind,
      })),
      niwaPreview: observation.niwaPreview,
      shikiPreview: observation.shikiPreview,
      framesPreview: observation.framesPreview,
      reducedMotion: observation.reducedMotion,
      noJs: observation.noJs,
      dropInDetail: observation.dropInDetail,
      unknownSlugStatus: observation.unknownSlugStatus,
      pageErrorCount: observation.pageErrors.length,
    }),
  );
  process.exit(0);
}
