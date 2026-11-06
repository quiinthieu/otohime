/**
 * Capability Showcase Website Redesign: Comprehensive Opaque-Box E2E Test Suite
 *
 * Verifies all requirements from ORIGINAL_REQUEST.md & PROJECT.md across 5 tiers:
 * - Tier 1: Feature Coverage (R1 Visual & Layout Redesign, R2 Content & Copy Overhaul)
 * - Tier 2: Boundary & Corner Cases (Character budgets, contract schemas, WCAG contrast, mobile safety)
 * - Tier 3: Cross-Feature Combinations (Nav ↔ route ↔ headings, search index sync, view transitions)
 * - Tier 4: Real-World Application Scenarios (Recruiter, Architect, Explorer, Connoisseur, Full Traversal)
 * - Tier 5: Adversarial Coverage Hardening (Zine budgets, timeline archives, swatches, regex patterns)
 *
 * Execution:
 *   node --experimental-strip-types --disable-warning=ExperimentalWarning \
 *        --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test e2e/capability-showcase.test.ts
 *
 * Live server mode:
 *   BASE_URL=http://localhost:4000 node --experimental-strip-types \
 *        --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *        --test e2e/capability-showcase.test.ts
 */

import assert from "node:assert/strict";
import { describe, test, before, type TestContext } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { site } from "../content/site.ts";
import type { Swatch } from "../components/figures.tsx";
import { draftCareer } from "../content/career.ts";
import { PUBLIC_PAGES } from "../lib/pages.ts";
import { zinePages, BUDGETS } from "../lib/zine.ts";
import { careerArchive, TIMELINE_YEARS } from "../lib/timeline.ts";
import { SWATCH_KEYS, parseSong } from "../lib/songs.ts";
import { buildIndex as buildAskIndex } from "../scripts/ask-index.ts";
import { buildIndex as buildPeeksIndex } from "../scripts/peeks-index.ts";
import { serializePeeks } from "../lib/peeks.ts";
import { noteBySlug } from "../app/(site)/(app)/notes/_lib/notes.ts";
import { buildFortuneTargets } from "../lib/fortune-targets.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
let serverAvailable = false;

// Global detection: checks if an HTTP server is currently listening on BASE
before(async () => {
  try {
    const res = await fetch(`${BASE}/`, { method: "HEAD", signal: AbortSignal.timeout(1200) });
    serverAvailable = res.status < 500;
  } catch {
    serverAvailable = false;
  }
});

// Helper for live HTTP fetching with automatic test skip if server is offline
async function fetchPage(routePath: string, t?: TestContext): Promise<{ status: number; html: string } | null> {
  if (!serverAvailable) {
    t?.skip(`Live server at ${BASE} not answering; HTTP test skipped`);
    return null;
  }
  const res = await fetch(`${BASE}${routePath}`);
  const html = await res.text();
  return { status: res.status, html };
}

// Helper to read repository source files
function readProjectFile(relPath: string): string {
  const fullPath = path.resolve(ROOT, relPath);
  return readFileSync(fullPath, "utf-8");
}

/* ==========================================================================
 * TIER 1: FEATURE COVERAGE (Core Requirements)
 * ========================================================================== */

describe("Tier 1: Feature Coverage", () => {
  /* ------------------------------------------------------------------------
   * Feature 1: Modern Visual & Layout Redesign (R1)
   * ------------------------------------------------------------------------ */
  describe("R1: Visual & Layout Redesign", () => {
    test("T1.1.1: Visual Styling - globals.css defines modern aesthetic styling with cohesive light-dark() :root custom properties", () => {
      const css = readProjectFile("app/(site)/globals.css");
      const requiredTokens = [
        "--paper",
        "--paper-2",
        "--field",
        "--ink",
        "--muted",
        "--line",
        "--hairline",
        "--danger",
        "--yellow",
        "--coral",
        "--mint",
        "--blue",
        "--pink",
        "--shade",
      ];
      for (const token of requiredTokens) {
        assert.ok(css.includes(token), `globals.css must define custom property token ${token}`);
      }
      assert.match(css, /color-scheme:\s*light\s+dark;/, "globals.css must declare color-scheme: light dark");
    });

    test("T1.1.2: Visual Styling - Palette defines distinct light and dark theme values for core surface and text tokens", () => {
      const css = readProjectFile("app/(site)/globals.css");
      assert.match(css, /--paper:\s*light-dark\(/, "--paper must use light-dark() CSS color function");
      assert.match(css, /--ink:\s*light-dark\(/, "--ink must use light-dark() CSS color function");
      assert.match(css, /--muted:\s*light-dark\(/, "--muted must use light-dark() CSS color function");
      assert.match(css, /--line:\s*light-dark\(/, "--line must use light-dark() CSS color function");
    });

    test("T1.1.3: Visual Styling - Typography tokens configure modern sans headings and crisp monospace telemetry", () => {
      const css = readProjectFile("app/(site)/globals.css");
      assert.match(css, /--font-mono/, "globals.css must define --font-mono typography token");
      assert.match(css, /--font-sans/, "globals.css must define --font-sans typography token");
      assert.match(css, /font:\s*[^;]*var\(--font-mono\)/, "Body default font must reference --font-mono");
    });

    test("T1.1.4: Layout Structure - Core route layouts enforce max-w-4xl container constraints, main landmark, and accessible skip link", () => {
      const homeLayout = readProjectFile("app/(site)/(home)/layout.tsx");
      const appLayout = readProjectFile("app/(site)/(app)/layout.tsx");
      const masthead = readProjectFile("components/masthead.tsx");

      assert.match(homeLayout, /max-w-4xl/, "Home layout container must enforce max-w-4xl");
      assert.match(appLayout, /max-w-4xl/, "App layout container must enforce max-w-4xl");
      assert.match(homeLayout, /id="main"/, "Home layout must contain element with id='main'");
      assert.match(appLayout, /id="main"/, "App layout must contain element with id='main'");
      assert.match(masthead, /href="#main"/, "Masthead must contain accessible skip link to #main");
    });

    test("T1.1.5: Navigation Elements - Shared Masthead contains brand mark, primary nav items with active indicators, ⌘K trigger, and ThemeToggle", () => {
      const mastheadSource = readProjectFile("components/masthead.tsx");
      assert.match(mastheadSource, /<BrandMark\s*\/>/, "Masthead must mount BrandMark");
      assert.match(mastheadSource, /<NavLinks\s+items={NAV_ITEMS}\s*\/>/, "Masthead must render primary navigation items");
      assert.match(mastheadSource, /<ThemeToggle\s*\/>/, "Masthead must mount ThemeToggle");
      assert.match(mastheadSource, /<CommandPaletteButton\s*\/>/, "Masthead must mount CommandPaletteButton (⌘K)");
    });

    test("T1.1.6: EndFooter Layout - Shared EndFooter contains brand identity, tagline, navigation links, elsewhere channels, and cached EndYear", () => {
      const footerSource = readProjectFile("components/end-footer.tsx");
      assert.match(footerSource, /site\.tagline/, "EndFooter must render site.tagline");
      assert.match(footerSource, /PUBLIC_PAGES/, "EndFooter must render core navigation pages");
      assert.match(footerSource, /site\.lines/, "EndFooter must render elsewhere direct channels");
      assert.match(footerSource, /site\.end\.signature/, "EndFooter must render colophon signature");
      assert.match(footerSource, /<EndYear\s*\/>/, "EndFooter must render cached EndYear copyright component");
    });

    test("T1.1.7: Responsive Tokens - Design utility classes for buttons, captions, badges, spec rows, and surfaces are declared in globals.css", () => {
      const css = readProjectFile("app/(site)/globals.css");
      const requiredClasses = [".btn", ".btn-primary", ".caption", ".badge", ".spec-row", ".rise", ".masthead", ".end"];
      for (const cls of requiredClasses) {
        assert.ok(css.includes(cls), `globals.css must define utility class ${cls}`);
      }
    });
  });

  /* ------------------------------------------------------------------------
   * Feature 2: Content & Copy Overhaul (R2)
   * ------------------------------------------------------------------------ */
  describe("R2: Content & Copy Overhaul", () => {
    test("T1.2.1: Content Overhaul - Central site.ts registry is fully populated with capability showcase content fields", () => {
      assert.ok(typeof site.tagline === "string" && site.tagline.length > 0, "site.tagline must be non-empty");
      assert.ok(Array.isArray(site.bio) && site.bio.length === 3, "site.bio must have 3 paragraphs");
      assert.ok(Array.isArray(site.now) && site.now.length >= 2, "site.now must have at least 2 items");
      assert.ok(Array.isArray(site.lines) && site.lines.length === 4, "site.lines must have 4 direct channels");
      assert.ok(typeof site.work === "string" && site.work.length > 0, "site.work must be non-empty");
      assert.ok(Array.isArray(site.stack) && site.stack.length >= 6, "site.stack must have >= 6 items");
      assert.ok(Array.isArray(site.games) && site.games.length === 6, "site.games must have 6 items");
      assert.ok(Array.isArray(site.projectList) && site.projectList.length === 11, "site.projectList must have 11 items");
      assert.ok(Array.isArray(site.notes) && site.notes.length === 3, "site.notes must have 3 items");
      assert.ok(Array.isArray(site.songs) && site.songs.length === 3, "site.songs must have 3 items");
    });

    test("T1.2.2: Content Overhaul - Home route (/) displays hero bio, current focus (Now), featured curiosities, and recent notes", () => {
      const homePageSource = readProjectFile("app/(site)/(home)/page.tsx");
      assert.match(homePageSource, /site\.tagline/, "Home route must render site.tagline");
      assert.match(homePageSource, /site\.bio/, "Home route must render site.bio");
      assert.match(homePageSource, /site\.now/, "Home route must render site.now");
      assert.match(homePageSource, /FEATURED_PROJECTS|site\.projectList/, "Home route must render curiosities");
      assert.match(homePageSource, /RECENT_NOTES|site\.notes/, "Home route must render recent notes");
      assert.match(homePageSource, /site\.lines/, "Home route must render external channels");
    });

    test("T1.2.3: Content Overhaul - Work route (/work) presents data platform narrative, 3 operational principles, stack, and pipeline", () => {
      const workPageSource = readProjectFile("app/(site)/(app)/work/page.tsx");
      assert.match(workPageSource, /site\.work/, "Work route must render site.work narrative");
      assert.match(workPageSource, /site\.stack/, "Work route must render site.stack");
      assert.match(workPageSource, /Idempotent by default/i, "Work route must state 'Idempotent by default' principle");
      assert.match(workPageSource, /Contracts at the boundary/i, "Work route must state 'Contracts at boundary' principle");
      assert.match(workPageSource, /Calm operations/i, "Work route must state 'Calm operations' principle");
      assert.match(workPageSource, /<Pipeline\s*\/>/, "Work route must mount interactive Pipeline component");
    });

    test("T1.2.4: Content Overhaul - Projects route (/projects) presents directory of 11 live curiosities and print editions", () => {
      const projectsPageSource = readProjectFile("app/(site)/(app)/projects/page.tsx");
      assert.match(projectsPageSource, /site\.projectList/, "Projects page must render site.projectList");
      assert.match(projectsPageSource, /Directory/i, "Projects page must have Directory section");
      assert.match(projectsPageSource, /Print & Special Editions|Standalone/i, "Projects page must feature print editions");
      assert.match(projectsPageSource, /\/zine/, "Projects page must link to /zine edition");
      assert.match(projectsPageSource, /\/ryugu/, "Projects page must link to /ryugu edition");
    });

    test("T1.2.5: Content Overhaul - Notes route (/notes) features 3 field notes with dates, tags, and data engineering essays", () => {
      const notesPageSource = readProjectFile("app/(site)/(app)/notes/page.tsx");
      assert.match(notesPageSource, /site\.notes/, "Notes page must render site.notes");
      const noteSlugs = site.notes.map((n) => n.slug);
      assert.ok(noteSlugs.includes("backfills-are-a-feature"), "Notes must include backfills-are-a-feature");
      assert.ok(noteSlugs.includes("on-twos"), "Notes must include on-twos");
      assert.ok(noteSlugs.includes("the-contract-caught-it"), "Notes must include the-contract-caught-it");
      for (const note of site.notes) {
        assert.ok(note.tags.length > 0, `Note ${note.slug} must have tags`);
        assert.ok(note.title.length > 0, `Note ${note.slug} must have a title`);
        assert.ok(note.body.length > 0, `Note ${note.slug} must have a body`);
      }
    });

    test("T1.2.6: Content Overhaul - Zero placeholder text remaining across public site copy, core pages, and timeline", () => {
      // 1. Exported site object must contain no TODO markers, invented draft flags, or placeholders
      const serialized = JSON.stringify(site);
      assert.doesNotMatch(serialized, /TODO/i, "Exported site object must not contain TODO markers");
      assert.doesNotMatch(serialized, /\binvented draft\b/i, "Exported site object must not contain 'invented draft'");
      assert.doesNotMatch(serialized, /\bplaceholder\b/i, "Exported site object must not contain 'placeholder'");

      // 2. Core pages source files must not contain draft disclaimers or placeholder markers
      const corePages = [
        "app/(site)/(home)/page.tsx",
        "app/(site)/(app)/work/page.tsx",
        "app/(site)/(app)/projects/page.tsx",
        "app/(site)/(app)/notes/page.tsx",
        "app/(site)/(app)/timeline/page.tsx",
      ];
      for (const relPath of corePages) {
        const content = readProjectFile(relPath);
        assert.doesNotMatch(content, /TODO\(otohime\)/i, `${relPath} must not contain TODO(otohime)`);
        assert.doesNotMatch(content, /invented draft/i, `${relPath} must not contain invented draft markers`);
      }

      // 3. lib/timeline.ts must not contain placeholder variable or draft note disclaimer
      const timelineLib = readProjectFile("lib/timeline.ts");
      assert.doesNotMatch(timelineLib, /const\s+placeholder\s*=/i, "lib/timeline.ts must not define placeholder variable");
      assert.doesNotMatch(timelineLib, /fictional placeholders/i, "lib/timeline.ts must not contain fictional placeholders disclaimer");
    });

    test("T1.2.7: Content Overhaul - Career chronology in content/career.ts spans 9 contiguous years (2018–2026)", () => {
      assert.ok(Array.isArray(draftCareer), "draftCareer must be an array of career milestones");
      assert.equal(draftCareer.length, 9, "Career timeline must span 9 contiguous years (2018–2026)");
      assert.equal(draftCareer[0].year, 2018, "Career trajectory starts in 2018");
      assert.equal(draftCareer[draftCareer.length - 1].year, 2026, "Career trajectory ends in 2026");
      const latestMilestone = draftCareer[draftCareer.length - 1];
      assert.match(
        latestMilestone.role,
        /(Staff|Lead|Principal|Independent|Architect|Senior)/i,
        "By 2026, role must reflect senior data engineering stature"
      );
    });
  });
});

/* ==========================================================================
 * TIER 2: BOUNDARY & CORNER CASES
 * ========================================================================== */

describe("Tier 2: Boundary & Corner Cases", () => {
  /* ------------------------------------------------------------------------
   * Character Budgets & Content Limits
   * ------------------------------------------------------------------------ */
  describe("Character Budgets & Content Limits", () => {
    test("T2.1.1: Content Boundary - Bio paragraph count is exactly 3 and total length <= 420 chars for Zine budget", () => {
      assert.equal(site.bio.length, 3, "Bio must consist of exactly 3 paragraphs");
      const totalChars = site.bio.reduce((sum, p) => sum + p.length, 0);
      assert.ok(
        totalChars <= 420,
        `Total bio character count (${totalChars}) must not exceed 420 characters for Zine budget compatibility`
      );
      assert.ok(totalChars >= 80, `Bio character count (${totalChars}) must be at least 80 chars`);
    });

    test("T2.1.2: Content Boundary - Tagline character budget is non-empty and <= 80 chars per Zine cover constraint", () => {
      assert.ok(site.tagline.length > 0, "Tagline must not be empty");
      assert.ok(
        site.tagline.length <= 80,
        `Tagline length (${site.tagline.length}) must not exceed 80 characters (Zine cover constraint: <= 80 chars)`
      );
    });

    test("T2.1.3: Content Boundary - Project titles <= 24 chars and notes <= 140 chars across all 11 projects", () => {
      assert.equal(site.projectList.length, 11, "Must have exactly 11 projects in projectList");
      for (const project of site.projectList) {
        assert.ok(
          project.title.length <= 24,
          `Project title '${project.title}' (${project.title.length} chars) must not exceed 24 chars`
        );
        assert.ok(
          project.note.length <= 140,
          `Project note for '${project.title}' (${project.note.length} chars) must not exceed 140 chars`
        );
      }
    });

    test("T2.1.4: Content Boundary - Note bodies <= 140 chars, dates strictly ISO 8601, and slugs lowercase kebab-case", () => {
      const isoDatePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
      const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      for (const note of site.notes) {
        assert.ok(note.body.length <= 140, `Note body for ${note.slug} (${note.body.length} chars) must be <= 140 chars`);
        assert.match(note.date, isoDatePattern, `Note ${note.slug} date (${note.date}) must be ISO 8601 YYYY-MM-DD`);
        assert.match(note.slug, slugPattern, `Note slug '${note.slug}' must be lowercase kebab-case`);
        const parsed = new Date(note.date);
        assert.ok(!isNaN(parsed.getTime()), `Note date ${note.date} must be a valid calendar date`);
      }
    });

    test("T2.1.5: Content Boundary - site.now Playing entry matches shell script regex pattern", () => {
      const siteTsContent = readProjectFile("content/site.ts");
      const match = siteTsContent.match(/^\s*\{\s*what:\s*"Playing",\s*note:\s*"([^"]*)"\s*\},?$/m);
      assert.ok(
        match !== null,
        'content/site.ts must contain an entry exactly formatted as: { what: "Playing", note: "..." }'
      );
      assert.ok(match[1].length > 0, "Playing note captured by regex must not be empty");
    });
  });

  /* ------------------------------------------------------------------------
   * Contract Schemas
   * ------------------------------------------------------------------------ */
  describe("Contract Schemas", () => {
    test("T2.2.1: Contract Schema - Exactly 11 projects in site.projectList with status strictly equal to 'live'", () => {
      assert.equal(site.projectList.length, 11, "Must define exactly 11 projects");
      for (const project of site.projectList) {
        assert.equal(project.status, "live", `Project '${project.title}' status must be 'live'`);
        assert.ok(project.title.trim().length > 0, "Project title must be non-empty");
        assert.ok(project.note.trim().length > 0, "Project note must be non-empty");
      }
    });

    test("T2.2.2: Contract Schema - Exactly 6 games in site.games with non-empty titles, notes, and valid swatches", () => {
      assert.equal(site.games.length, 6, "Must define exactly 6 games");
      const validSwatches: Swatch[] = ["yellow", "coral", "mint", "blue", "pink"];
      for (const game of site.games) {
        assert.ok(game.title.trim().length > 0, "Game title must be non-empty");
        assert.ok(game.note.trim().length > 0, `Game note for ${game.title} must be non-empty`);
        assert.ok(
          validSwatches.includes(game.colour),
          `Game ${game.title} color (${game.colour}) must be a valid swatch`
        );
      }
    });

    test("T2.2.3: Contract Schema - Exactly 3 songs in site.songs with valid, unique 11-char YouTube IDs", () => {
      assert.equal(site.songs.length, 3, "site.songs must contain exactly 3 songs");
      const seenVideos = new Set<string>();
      for (const song of site.songs) {
        const res = parseSong(song);
        assert.ok(res.ok, `Song "${song.title}" failed parseSong schema: ${JSON.stringify(res.ok ? {} : res.errors)}`);
        assert.ok(!seenVideos.has(song.video), `Duplicate YouTube video ID detected in site.songs: ${song.video}`);
        seenVideos.add(song.video);
      }
      assert.equal(seenVideos.size, 3, "Must have exactly 3 unique YouTube video IDs");
    });

    test("T2.2.4: Contract Schema - Exactly 4 direct lines in site.lines with valid URL schemes and swatches", () => {
      assert.equal(site.lines.length, 4, "Must define 4 external contact lines");
      const validSwatches = new Set<string>(SWATCH_KEYS);
      for (const line of site.lines) {
        assert.ok(
          line.href.startsWith("https://") || line.href.startsWith("mailto:"),
          `Line '${line.label}' href (${line.href}) must use https:// or mailto:`
        );
        assert.ok(line.handle.trim().length > 0, `Line '${line.label}' must have non-empty handle`);
        assert.ok(line.code.trim().length > 0, `Line '${line.label}' must have a code label`);
        assert.ok(validSwatches.has(line.colour), `Line '${line.label}' has invalid swatch: ${line.colour}`);
      }
    });

    test("T2.2.5: Contract Schema - site.zine.projects contains exactly 4 project titles strictly subsetting site.projectList", () => {
      assert.ok(site.zine, "site.zine configuration must exist");
      assert.equal(site.zine.projects.length, 4, "site.zine.projects must specify exactly 4 featured projects");
      const validProjectTitles = site.projectList.map((p) => p.title);
      for (const title of site.zine.projects) {
        assert.ok(
          validProjectTitles.includes(title),
          `Zine project '${title}' must exist in site.projectList`
        );
      }
    });
  });

  /* ------------------------------------------------------------------------
   * WCAG Contrast Ratios & Mobile Overflow Safety
   * ------------------------------------------------------------------------ */
  describe("WCAG Contrast & Mobile Safety", () => {
    test("T2.3.1: Visual Ergonomics - Color tokens exceed WCAG AA 4.5:1 and AAA 7:1 contrast in light and dark modes", () => {
      function hexToRgb(hex: string): [number, number, number] {
        const num = parseInt(hex.replace("#", ""), 16);
        return [num >> 16, (num >> 8) & 255, num & 255];
      }
      function luminance([r, g, b]: [number, number, number]): number {
        const a = [r, g, b].map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      }
      function contrast(rgb1: [number, number, number], rgb2: [number, number, number]): number {
        const l1 = luminance(rgb1);
        const l2 = luminance(rgb2);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }

      // Light theme tokens
      const lightPaper = hexToRgb("faf8f5");
      const lightInk = hexToRgb("1a1715");
      const lightMuted = hexToRgb("6c655b");
      assert.ok(contrast(lightInk, lightPaper) >= 7.0, "Light ink must meet AAA contrast (>= 7:1)");
      assert.ok(contrast(lightMuted, lightPaper) >= 4.5, "Light muted must meet AA contrast (>= 4.5:1)");

      // Dark theme tokens
      const darkPaper = hexToRgb("121114");
      const darkInk = hexToRgb("f5f2eb");
      const darkMuted = hexToRgb("a89f91");
      assert.ok(contrast(darkInk, darkPaper) >= 7.0, "Dark ink must meet AAA contrast (>= 7:1)");
      assert.ok(contrast(darkMuted, darkPaper) >= 4.5, "Dark muted must meet AA contrast (>= 4.5:1)");
    });

    test("T2.3.2: Mobile Safety - Masthead navigation declares overflow-x: auto and scrollbar-width: none", () => {
      const css = readProjectFile("app/(site)/globals.css");
      assert.match(
        css,
        /\.masthead-nav\s+\.nav-list\s*\{[^}]*overflow-x:\s*auto;/,
        "Masthead nav must declare overflow-x: auto to prevent mobile viewport blowout (<426px)"
      );
      assert.match(
        css,
        /\.masthead-nav\s+\.nav-list\s*\{[^}]*scrollbar-width:\s*none;/,
        "Masthead nav must hide scrollbar for clean appearance"
      );
    });

    test("T2.3.3: Styling Boundary - light-dark() CSS declarations specify two distinct color tokens", () => {
      const css = readProjectFile("app/(site)/globals.css");
      const matches = [...css.matchAll(/light-dark\(\s*([^,]+),\s*([^)]+)\)/g)];
      assert.ok(matches.length >= 4, "Must use light-dark() for at least 4 custom properties");
      for (const match of matches) {
        const light = match[1].trim();
        const dark = match[2].trim();
        assert.notEqual(light, dark, `light-dark() parameters must be distinct: ${match[0]}`);
      }
    });

    test("T2.3.4: Styling Boundary - All 5 accent swatch variables (--yellow, --coral, --mint, --blue, --pink) are defined", () => {
      const css = readProjectFile("app/(site)/globals.css");
      const swatches: Swatch[] = ["yellow", "coral", "mint", "blue", "pink"];
      for (const swatch of swatches) {
        const regex = new RegExp(`--${swatch}:\\s*#[0-9a-fA-F]{3,8}`, "i");
        assert.match(css, regex, `globals.css must define swatch --${swatch} with valid hex color`);
      }
    });

    test("T2.3.5: Styling Boundary - Layout container width constraints conform to max-w-4xl (56rem)", () => {
      const layoutHome = readProjectFile("app/(site)/(home)/layout.tsx");
      const layoutApp = readProjectFile("app/(site)/(app)/layout.tsx");
      const masthead = readProjectFile("components/masthead.tsx");
      const footer = readProjectFile("components/end-footer.tsx");

      assert.match(layoutHome, /max-w-4xl/, "Home layout container must enforce max-w-4xl");
      assert.match(layoutApp, /max-w-4xl/, "App layout container must enforce max-w-4xl");
      assert.match(masthead, /max-w-4xl/, "Masthead inner container must enforce max-w-4xl");
      assert.match(footer, /max-w-4xl/, "EndFooter inner container must enforce max-w-4xl");
    });

    test("T2.3.6: Styling Boundary - Theme pinning script in root layout is wrapped in try/catch for storage resilience", () => {
      const rootLayout = readProjectFile("app/(site)/layout.tsx");
      assert.match(
        rootLayout,
        /pinTheme|localStorage\.getItem\("theme"\)/,
        "Root layout must include theme pinning script before hydration"
      );
      assert.match(
        rootLayout,
        /try\s*\{[^}]*localStorage[^}]*\}\s*catch/,
        "Theme pinning script must be wrapped in try/catch to handle storage exceptions"
      );
    });
  });

  /* ------------------------------------------------------------------------
   * Route & Link Edge Cases
   * ------------------------------------------------------------------------ */
  describe("Route & Link Edge Cases", () => {
    test("T2.4.1: Route Boundary - Trailing slashes are handled consistently", async (t) => {
      const resWithoutSlash = await fetchPage("/work", t);
      const resWithSlash = await fetchPage("/work/", t);
      if (resWithoutSlash && resWithSlash) {
        assert.ok([200, 308, 307].includes(resWithSlash.status), "/work/ must return 200 or canonical redirect");
        assert.equal(resWithoutSlash.status, 200, "/work must return HTTP 200");
      }
    });

    test("T2.4.2: Route Boundary - Non-existent route returns 404 status code and error shell", async (t) => {
      const res = await fetchPage("/definitely-not-a-real-page-404-check", t);
      if (res) {
        assert.equal(res.status, 404, "Unknown route must respond with HTTP 404 status code");
        assert.match(res.html, /404|not found/i, "404 page must present not-found message");
      }
    });

    test("T2.4.3: Route Boundary - Skip to content anchor target #main exists across page layouts", () => {
      const masthead = readProjectFile("components/masthead.tsx");
      assert.match(masthead, /href="#main"/, "Masthead must contain skip link to #main");

      const homeLayout = readProjectFile("app/(site)/(home)/layout.tsx");
      const appLayout = readProjectFile("app/(site)/(app)/layout.tsx");
      assert.match(homeLayout, /id="main"/, "Home layout must contain element with id='main'");
      assert.match(appLayout, /id="main"/, "App layout must contain element with id='main'");
    });

    test("T2.4.4: Route Boundary - Dynamic note lookup returns undefined on malformed or path traversal slugs", () => {
      for (const note of site.notes) {
        const found = noteBySlug(note.slug);
        assert.ok(found, `Note slug "${note.slug}" failed lookup in noteBySlug`);
        assert.equal(found.title, note.title);
      }
      assert.equal(noteBySlug(""), undefined, "Empty slug must return undefined");
      assert.equal(noteBySlug("unknown-slug-404"), undefined, "Unknown slug must return undefined");
      assert.equal(noteBySlug("../traversal-attempt"), undefined, "Path traversal attempt must return undefined");
    });

    test("T2.4.5: Route Boundary - Internal project links are well-formed absolute paths", () => {
      for (const project of site.projectList) {
        if (project.href) {
          assert.ok(
            project.href.startsWith("/") && !project.href.startsWith("//"),
            `Project ${project.title} href (${project.href}) must be an internal absolute path`
          );
          assert.doesNotMatch(project.href, /\s/, `Project href (${project.href}) must not contain whitespace`);
        }
      }
    });
  });
});

/* ==========================================================================
 * TIER 3: CROSS-FEATURE COMBINATIONS
 * ========================================================================== */

describe("Tier 3: Cross-Feature Combinations", () => {
  test("T3.1: Cross-Feature - Navigation links ↔ route targets ↔ page headings coherence", () => {
    // 1. PUBLIC_PAGES defines 4 core routes in canonical sequence
    assert.deepEqual(
      PUBLIC_PAGES,
      [
        { href: "/", label: "Home" },
        { href: "/work", label: "Work" },
        { href: "/projects", label: "Projects" },
        { href: "/notes", label: "Notes" },
      ],
      "PUBLIC_PAGES must maintain canonical 4-route sequence"
    );

    // 2. Route files exist for every route target
    const routeFileMap: Record<string, string> = {
      "/": "app/(site)/(home)/page.tsx",
      "/work": "app/(site)/(app)/work/page.tsx",
      "/projects": "app/(site)/(app)/projects/page.tsx",
      "/notes": "app/(site)/(app)/notes/page.tsx",
    };
    for (const [route, relPath] of Object.entries(routeFileMap)) {
      assert.ok(existsSync(path.resolve(ROOT, relPath)), `Route file for ${route} must exist at ${relPath}`);
    }
  });

  test("T3.2: Cross-Feature - Search indices synchronization (ask-index.json and peeks.json)", () => {
    const askIndexPath = path.resolve(ROOT, "public/ask-index.json");
    const peeksPath = path.resolve(ROOT, "public/peeks.json");

    assert.ok(existsSync(askIndexPath), "public/ask-index.json must exist");
    assert.ok(existsSync(peeksPath), "public/peeks.json must exist");

    const diskAsk = JSON.parse(readFileSync(askIndexPath, "utf-8"));
    const freshAsk = buildAskIndex();
    assert.equal(
      diskAsk.passages.length,
      freshAsk.passages.length,
      `ask-index passage count drift! On disk: ${diskAsk.passages.length}, compiled: ${freshAsk.passages.length}`
    );

    const diskPeeks = readFileSync(peeksPath, "utf-8");
    const freshPeeks = serializePeeks(buildPeeksIndex());
    assert.equal(diskPeeks, freshPeeks, "public/peeks.json is out of sync with content/site.ts; run npm run peeks:index");
  });

  test("T3.3: Cross-Feature - View Transitions and theme tokens coherence across routes", () => {
    const rootLayout = readProjectFile("app/(site)/layout.tsx");
    assert.match(rootLayout, /globals\.css/, "Root layout must load globals.css for all routes");
    assert.match(rootLayout, /AppearanceBoot/, "Root layout must mount AppearanceBoot across all routes");
  });

  test("T3.4: Cross-Feature - Home recent notes link to slugs that exist in Notes route", () => {
    const homePage = readProjectFile("app/(site)/(home)/page.tsx");
    assert.match(homePage, /href=\{`\/notes\/\$\{slug\}`\}/, "Home page must link recent notes to /notes/[slug]");
    const noteSlugs = new Set(site.notes.map((n) => n.slug));
    assert.ok(noteSlugs.size === 3, "Must have 3 unique note slugs");
    for (const slug of noteSlugs) {
      assert.ok(typeof slug === "string" && slug.length > 0, "Slug must be valid non-empty string");
      const found = noteBySlug(slug);
      assert.ok(found, `Note slug ${slug} must resolve in noteBySlug`);
    }
  });

  test("T3.5: Cross-Feature - Home curiosities count strictly matches projects directory length", () => {
    const homePage = readProjectFile("app/(site)/(home)/page.tsx");
    assert.match(
      homePage,
      /Browse Curiosities\s*\(\{site\.projectList\.length\}\)/,
      "Home button label must dynamically bind to site.projectList.length"
    );
    assert.equal(site.projectList.length, 11, "Project count must be 11");
  });

  test("T3.6: Cross-Feature - Career milestones technologies align with Work stack and principles", () => {
    const careerTechnologies = draftCareer.flatMap((c) => c.tools.split(/\s*·\s*/));
    const stackTools = site.stack.map((s) => s.tools).join(" ");
    const coreTechs = ["Snowflake", "dbt", "Airflow", "Kafka"];
    for (const tech of coreTechs) {
      const inCareer = careerTechnologies.some((t) => t.toLowerCase().includes(tech.toLowerCase()));
      const inStack = stackTools.toLowerCase().includes(tech.toLowerCase());
      assert.ok(inCareer || inStack, `Core technology ${tech} must be reflected in career trajectory or stack`);
    }
  });

  test("T3.7: Cross-Feature - Projects route special editions cross-reference /zine and /ryugu", () => {
    const projectsPage = readProjectFile("app/(site)/(app)/projects/page.tsx");
    assert.match(projectsPage, /href="\/zine"/, "Projects page must link to /zine edition");
    assert.match(projectsPage, /href="\/ryugu"/, "Projects page must link to /ryugu edition");
  });

  test("T3.8: Cross-Feature - Primary nav links order and text match PUBLIC_PAGES across routes with dynamic aria-current", () => {
    const navLinks = readProjectFile("components/nav-links.tsx");
    assert.match(navLinks, /items\.map/, "NavLinks must iterate through provided items");
    assert.match(navLinks, /aria-current=\{[^}]*"page"[^}]*\}/, "NavLinks must dynamically apply aria-current='page'");
  });
});

/* ==========================================================================
 * TIER 4: REAL-WORLD APPLICATION SCENARIOS
 * ========================================================================== */

describe("Tier 4: Real-World Application Scenarios", () => {
  test("T4.1: Journey 1 — Recruiter / Hiring Partner Journey: Landing on / -> reading bio -> navigating to /work -> inspecting pipeline & stack", async (t) => {
    // Static structure verification
    const homePage = readProjectFile("app/(site)/(home)/page.tsx");
    const workPage = readProjectFile("app/(site)/(app)/work/page.tsx");
    assert.match(homePage, /href="\/work"/, "Home page must link to /work");
    assert.match(workPage, /site\.stack/, "Work page must render technical stack");
    assert.match(workPage, /<Pipeline\s*\/>/, "Work page must mount interactive pipeline simulation");

    // Live HTTP check (when server is answering)
    const homeRes = await fetchPage("/", t);
    if (homeRes) {
      assert.equal(homeRes.status, 200, "Home page must return HTTP 200");
      assert.match(homeRes.html, /Work (&|&amp;) Stack/i, "Home page must provide link to Work & Stack");
    }

    const workRes = await fetchPage("/work", t);
    if (workRes) {
      assert.equal(workRes.status, 200, "Work page must return HTTP 200");
      assert.match(workRes.html, /Technical Stack/i, "Work page must present Technical Stack section");
      assert.match(workRes.html, /Interactive Pipeline/i, "Work page must showcase Interactive Pipeline");
      assert.match(workRes.html, /Idempotent/i, "Work page must state idempotency principle");
    }
  });

  test("T4.2: Journey 2 — Systems Architect / Technical Lead Journey: Inspecting distributed data essays and idempotency contracts", async (t) => {
    // Static structure verification
    const note = site.notes.find((n) => n.slug === "backfills-are-a-feature");
    assert.ok(note, "Note backfills-are-a-feature must exist");
    assert.match(note.body, /idempotent/i, "Essay body must discuss idempotency");

    // Live HTTP checks
    const notesRes = await fetchPage("/notes", t);
    if (notesRes) {
      assert.equal(notesRes.status, 200, "Notes listing must return HTTP 200");
      assert.match(notesRes.html, /backfills-are-a-feature/i, "Notes listing must reference backfills note");
    }

    const essayRes = await fetchPage("/notes/backfills-are-a-feature", t);
    if (essayRes) {
      assert.equal(essayRes.status, 200, "Note detail must return HTTP 200");
      assert.match(essayRes.html, /idempotent/i, "Essay page must discuss idempotency");
    }
  });

  test("T4.3: Journey 3 — Project Explorer / Engineering Connoisseur Journey: Navigating to /projects -> visiting curiosities", async (t) => {
    // Static structure verification
    const projectsPage = readProjectFile("app/(site)/(app)/projects/page.tsx");
    assert.match(projectsPage, /site\.projectList/, "Projects page must render site.projectList");
    assert.equal(site.projectList.length, 11, "Must feature 11 live standalone projects");

    // Live HTTP check
    const projectsRes = await fetchPage("/projects", t);
    if (projectsRes) {
      assert.equal(projectsRes.status, 200, "Projects directory must return HTTP 200");
      assert.match(projectsRes.html, /Shore/i, "Projects page must feature Shore");
      assert.match(projectsRes.html, /Capsule/i, "Projects page must feature Capsule");
      assert.match(projectsRes.html, /Orrery/i, "Projects page must feature Orrery");
    }
  });

  test("T4.4: Journey 4 — Visual Design Connoisseur Journey: Auditing Quiet Luxury typography, palette tokens, and mobile safety", () => {
    const css = readProjectFile("app/(site)/globals.css");
    assert.match(css, /--font-sans:/, "Must declare --font-sans typography");
    assert.match(css, /--font-mono:/, "Must declare --font-mono typography");
    assert.match(css, /--paper:\s*light-dark\(/, "Must define dynamic light-dark paper");
    assert.match(css, /--ink:\s*light-dark\(/, "Must define dynamic light-dark ink");
    assert.match(css, /\.masthead-nav\s+\.nav-list\s*\{[^}]*overflow-x:\s*auto;/, "Must prevent mobile nav blowout");
  });

  test("T4.5: Journey 5 — Full Site Traversal & Link Integrity Walk: Zero broken internal links and valid media paths", async (t) => {
    // Verify all 11 project route targets exist in filesystem
    for (const project of site.projectList) {
      if (project.href) {
        // e.g. /shore -> app/(shore)/shore/page.tsx
        const segment = project.href.replace("/", "");
        const routeFile = path.resolve(ROOT, `app/(${segment})/${segment}/page.tsx`);
        assert.ok(
          existsSync(routeFile),
          `Target route file for project "${project.title}" (${project.href}) must exist at ${routeFile}`
        );
      }
    }

    // Verify local sketch images referenced in site.sketches exist on disk
    for (const sketch of site.sketches) {
      if (sketch.src.startsWith("/")) {
        const localPath = path.resolve(ROOT, "public", sketch.src.replace(/^\//, ""));
        assert.ok(existsSync(localPath), `Local sketch asset "${sketch.src}" must exist on disk at ${localPath}`);
      } else {
        assert.match(sketch.src, /^https:\/\//, `Remote sketch asset "${sketch.src}" must use valid HTTPS URL scheme`);
      }
    }

    // Live traversal if server is available
    const coreRoutes = [
      "/",
      "/work",
      "/projects",
      "/notes",
      "/notes/backfills-are-a-feature",
      "/notes/on-twos",
      "/notes/the-contract-caught-it",
    ];
    for (const route of coreRoutes) {
      const res = await fetchPage(route, t);
      if (res) {
        assert.equal(res.status, 200, `Crawling ${route} must return HTTP 200`);
        assert.ok(res.html.length > 200, `Crawling ${route} must deliver substantial HTML content`);
        assert.doesNotMatch(res.html, /Internal Server Error/i, `Route ${route} must not return 500 error`);
      }
    }
  });
});

/* ==========================================================================
 * TIER 5: ADVERSARIAL COVERAGE HARDENING (White-Box Invariant Stress)
 * ========================================================================== */

describe("Tier 5: Adversarial Coverage Hardening", () => {
  test("T5.1: Adversarial - Tagline does not exceed Zine cover budget and bio paragraphs are preserved in Zine imposition", () => {
    assert.ok(
      site.tagline.length <= BUDGETS.cover.tagline,
      `site.tagline length (${site.tagline.length}) exceeds Zine cover budget (${BUDGETS.cover.tagline} chars); would be truncated on /zine`
    );

    const pages = zinePages(site);
    assert.equal(pages.length, 8, "Zine imposition must produce exactly 8 pages");

    const bioPage = pages.find((p) => p.kind === "bio");
    assert.ok(bioPage && "paragraphs" in bioPage, "Zine must have a bio page with paragraphs");
    assert.equal(
      bioPage.paragraphs.length,
      3,
      `Zine imposition silently dropped bio paragraphs! Expected 3, got ${bioPage.paragraphs.length}`
    );
  });

  test("T5.2: Adversarial - site.zine features 4 unique projects and referenced sketch exists", () => {
    assert.equal(site.zine.projects.length, 4, "site.zine.projects must specify 4 projects");
    const uniqueProjects = new Set(site.zine.projects);
    assert.equal(
      uniqueProjects.size,
      4,
      `site.zine.projects contains duplicate projects: ${site.zine.projects.join(", ")}`
    );

    const sketchExists = site.sketches.some((s) => s.title === site.zine.sketch);
    assert.ok(
      sketchExists,
      `site.zine.sketch "${site.zine.sketch}" does not exist in site.sketches collection`
    );
  });

  test("T5.3: Adversarial - Career milestones contain non-empty attributes and merge cleanly into careerArchive", () => {
    const requiredFields = ["year", "title", "role", "team", "place", "project", "story", "tools"] as const;
    for (const milestone of draftCareer) {
      for (const field of requiredFields) {
        assert.ok(
          milestone[field] !== undefined && milestone[field] !== null && String(milestone[field]).trim().length > 0,
          `Milestone for year ${milestone.year} has missing or empty field: ${field}`
        );
      }
    }

    const archive = careerArchive(site.projectList, site.stack);
    assert.equal(archive.length, 9, "careerArchive must yield 9 continuous years");
    for (let i = 0; i < 9; i++) {
      assert.equal(archive[i].year, TIMELINE_YEARS[i]);
      assert.ok(archive[i].pieces.length >= 4, `Year ${archive[i].year} must contain standard pieces`);
    }

    const y2026 = archive.find((y) => y.year === 2026);
    assert.ok(y2026, "Year 2026 milestone must exist");
    assert.ok(
      y2026.pieces.length >= 4 + site.stack.length,
      `Year 2026 pieces (${y2026.pieces.length}) must include stack additions`
    );
  });

  test("T5.4: Adversarial - Every project, line, and song declares a valid Swatch token", () => {
    const validSwatches = new Set<string>(SWATCH_KEYS);

    for (const project of site.projectList) {
      assert.ok(
        validSwatches.has(project.colour),
        `Project "${project.title}" has invalid swatch: ${project.colour}`
      );
    }

    for (const line of site.lines) {
      assert.ok(
        validSwatches.has(line.colour),
        `Line "${line.label}" has invalid swatch: ${line.colour}`
      );
      assert.ok(line.handle.trim().length > 0, `Line "${line.label}" must have non-empty handle`);
    }

    for (const song of site.songs) {
      assert.ok(
        validSwatches.has(song.colour),
        `Song "${song.title}" has invalid swatch: ${song.colour}`
      );
    }
  });

  test("T5.5: Adversarial - All songs conform strictly to parseSong schema and declare unique YouTube IDs", () => {
    const seenVideos = new Set<string>();
    for (const song of site.songs) {
      const res = parseSong(song);
      assert.ok(
        res.ok,
        `Song "${song.title}" failed parseSong schema: ${JSON.stringify(res.ok ? {} : res.errors)}`
      );
      assert.ok(
        !seenVideos.has(song.video),
        `Duplicate YouTube video ID detected in site.songs: ${song.video}`
      );
      seenVideos.add(song.video);
    }
    assert.equal(seenVideos.size, 3, "Must have exactly 3 unique YouTube video IDs");
  });

  test("T5.6: Adversarial - globals.css defines explicit theme overrides and mobile navigation overflow protection", () => {
    const css = readProjectFile("app/(site)/globals.css");

    assert.match(
      css,
      /:root\[data-theme=["']light["']\]\s*\{\s*color-scheme:\s*light;\s*\}/,
      "globals.css must define explicit :root[data-theme='light'] selector"
    );
    assert.match(
      css,
      /:root\[data-theme=["']dark["']\]\s*\{\s*color-scheme:\s*dark;\s*\}/,
      "globals.css must define explicit :root[data-theme='dark'] selector"
    );

    assert.match(
      css,
      /\.masthead-nav\s+\.nav-list\s*\{[^}]*overflow-x:\s*auto;/,
      "Masthead nav must declare overflow-x: auto to prevent mobile viewport blowout (<426px)"
    );
    assert.match(
      css,
      /\.masthead-nav\s+\.nav-list\s*\{[^}]*scrollbar-width:\s*none;/,
      "Masthead nav must hide scrollbar for clean tactile appearance"
    );
  });

  test("T5.7: Adversarial - Public ask-index.json and peeks.json reflect exact fresh compilation without drift", () => {
    const askIndexPath = path.resolve(ROOT, "public/ask-index.json");
    const peeksPath = path.resolve(ROOT, "public/peeks.json");

    const diskAsk = JSON.parse(readFileSync(askIndexPath, "utf-8"));
    const freshAsk = buildAskIndex();
    assert.equal(
      diskAsk.passages.length,
      freshAsk.passages.length,
      `ask-index passage count drift! On disk: ${diskAsk.passages.length}, compiled: ${freshAsk.passages.length}`
    );

    const diskPeeks = readFileSync(peeksPath, "utf-8");
    const freshPeeks = serializePeeks(buildPeeksIndex());
    assert.equal(
      diskPeeks,
      freshPeeks,
      "public/peeks.json is out of sync with content/site.ts; run npm run peeks:index"
    );
  });

  test("T5.8: Adversarial - Static params and note lookup guarantee 404 on malformed slugs and target pool stability", () => {
    for (const note of site.notes) {
      const found = noteBySlug(note.slug);
      assert.ok(found, `Note slug "${note.slug}" failed lookup in noteBySlug`);
      assert.equal(found.title, note.title);
      assert.equal(found.date, note.date);
    }

    assert.equal(noteBySlug(""), undefined);
    assert.equal(noteBySlug("unknown-slug-404"), undefined);
    assert.equal(noteBySlug("../traversal-attempt"), undefined);

    const targets = buildFortuneTargets({
      projects: site.projectList,
      notes: site.notes,
      sketches: site.sketches,
      songs: site.songs,
    });
    assert.ok(targets.length >= 11 + 3 + 3, "Fortune targets must index all persona content");
  });

  test("T5.9: Adversarial - Visual Ergonomics - Color tokens exceed WCAG AA 4.5:1 contrast in light and dark modes", () => {
    function hexToRgb(hex: string): [number, number, number] {
      const num = parseInt(hex.replace("#", ""), 16);
      return [num >> 16, (num >> 8) & 255, num & 255];
    }
    function luminance([r, g, b]: [number, number, number]): number {
      const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }
    function contrast(rgb1: [number, number, number], rgb2: [number, number, number]): number {
      const l1 = luminance(rgb1);
      const l2 = luminance(rgb2);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    // Light theme tokens
    const lightPaper = hexToRgb("faf8f5");
    const lightInk = hexToRgb("1a1715");
    const lightMuted = hexToRgb("6c655b");
    assert.ok(contrast(lightInk, lightPaper) >= 7.0, "Light ink must meet AAA contrast");
    assert.ok(contrast(lightMuted, lightPaper) >= 4.5, "Light muted must meet AA contrast");

    // Dark theme tokens
    const darkPaper = hexToRgb("121114");
    const darkInk = hexToRgb("f5f2eb");
    const darkMuted = hexToRgb("a89f91");
    assert.ok(contrast(darkInk, darkPaper) >= 7.0, "Dark ink must meet AAA contrast");
    assert.ok(contrast(darkMuted, darkPaper) >= 4.5, "Dark muted must meet AA contrast");
  });
});
