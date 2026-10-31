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
    ["checkout", "--", "content/history.json", "content/contributions.json", "public/sql-index.json"],
    {
      cwd: REPO_ROOT,
      stdio: "ignore",
    },
  );
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

  // 4. Detail pages (/apps/bento, /apps/niwa, /apps/kakeibo, /apps/shiki)
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
      assert.equal(detail.hasHomebrewCask, true, "/apps/bento must render Homebrew caskagent-bento");
      assert.equal(detail.primaryCtaText, "Watch on GitHub");
    } else {
      assert.equal(detail.hasRepoLink, false, `/apps/${detail.slug} must omit unverified repo link`);
      assert.match(detail.primaryCtaHref, /^mailto:hello@otohime\.dev\?subject=/);
      assert.equal(detail.secondaryCtaHref, "https://x.com/otohime73");
    }
  }

  // 5. Dynamic zero-code JSON drop-in on /apps and /apps/<slug>, and HTTP 404 for unknown slug
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
  assert.equal(obs.unknownSlugStatus, 404, "Unknown /apps/<slug> must return HTTP 404");

  // 6. Responsive viewports & console cleanliness
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
  const server = spawn("npx", ["next", "start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      NODE_ENV: "production",
      TMPDIR: "/tmp",
      BETTER_AUTH_URL: baseUrl,
      BETTER_AUTH_SECRET: authSecret,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

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

    // 3. Visit all 4 detail pages
    const details = [];
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
        };
      }, slug);

      details.push({
        status: res?.status() ?? 0,
        ...detailObs,
      });
    }

    // Check mobile viewport overflow on /apps/bento and /apps
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/apps`, { waitUntil: "networkidle" });
    const mobileAppsOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    await page.goto(`${baseUrl}/apps/bento`, { waitUntil: "networkidle" });
    const mobileDetailOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );

    // 4. Dynamically drop a 5th JSON manifest in content/apps/ while server is running
    let dropInDetail = { status: 0, h1: "", motif: "", currentStep: "", catalogSlugs: [] };
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
      }));
      dropInDetail = {
        status: probeRes?.status() ?? 0,
        catalogSlugs,
        ...probeDom,
      };
    } finally {
      if (fs.existsSync(PROBE_FILE)) {
        fs.unlinkSync(PROBE_FILE);
      }
    }

    // 5. Verify unknown slug returns HTTP 404
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
      dropInDetail,
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
    server.kill("SIGTERM");
    fs.rmSync(shortTmp, { recursive: true, force: true });
  }
}

const isNegativeControl = process.argv.includes("--negative-control");

if (isNegativeControl) {
  // Construct a mutated browser observation (missing 4th card, wrong status on unknown slug,
  // and uncarved hanko stamp) and feed into the exact same verifyBrowserObservation() oracle.
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
        hasSvgMask: false,
        hankoGlyph: "作",
        illustrationKind: "ink",
        illustrationMotif: "bento-box",
        polygonCount: 8,
        badges: ["macOS", "CLI"],
        installCmd: "$ brew install --cask otohime73/tap/agent-bento",
      },
    ],
    initialCountText: "Showing 1 of 1 app",
    tuiFilterPressed: "false",
    tuiFilterCountText: "Showing 0 of 1 app",
    tuiFilteredSlugs: [],
    releasedFilterCountText: "Showing 0 of 1 app",
    emptyNoticeVisible: false,
    resetCountText: "Showing 1 of 1 app",
    resetSlugs: ["bento"],
    details: [],
    dropInDetail: { status: 404, h1: "", motif: "", currentStep: "" },
    unknownSlugStatus: 200,
    desktopOverflow: false,
    mobileOverflow: false,
    pageErrors: ["Simulated console error"],
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
      case: "t1882-build-and-browser-user-journey",
      appsIndexStatus: observation.appsIndexStatus,
      cards: observation.cards.map((c) => c.slug),
      details: observation.details.map((d) => ({ slug: d.slug, status: d.status })),
      dropInDetail: observation.dropInDetail,
      unknownSlugStatus: observation.unknownSlugStatus,
      pageErrorCount: observation.pageErrors.length,
    }),
  );
}
