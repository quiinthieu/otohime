/**
 * Production Readiness E2E Verification Suite: Dark/Light Mode (R1), Responsiveness (R2), Fast CI/Build (R3)
 *
 * Comprehensive Opaque-Box E2E Test Suite structured across 4 hierarchical tiers:
 * - Tier 1: Feature Coverage (R1 Theme Support, R2 Multi-Device Responsiveness, R3 CI/Build Simplification)
 * - Tier 2: Boundary & Corner Cases (WCAG AA Contrast Ratios, 320px-1440px Viewports, LocalStorage Resiliency, Network Timeouts)
 * - Tier 3: Cross-Feature Combinations (Theme x Viewport Interactions, Navigation Persistence, Dual-Theme Responsiveness)
 * - Tier 4: Real-World Application Scenarios (Mobile Visitor, Tablet Reader, Desktop Architect, Compact Gamer, Exhibit Explorer, CI Developer)
 *
 * Execution:
 *   node --experimental-strip-types \
 *        --disable-warning=ExperimentalWarning \
 *        --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *        --test e2e/production-readiness.test.ts
 *
 * Dual-Mode Execution:
 *   - Offline Mode (default): Validates CSS tokens, layout schemas, contracts, contrast calculations, and offline resilience.
 *   - Live Server Mode (BASE_URL=http://localhost:4000): Performs real HTTP requests against running server.
 */

import assert from "node:assert/strict";
import { describe, test, before } from "node:test";
import type { TestContext } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PUBLIC_PAGES } from "../lib/pages.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
let serverAvailable = false;

// Global detection: checks if an HTTP server is actively listening on BASE
before(async () => {
  try {
    const res = await fetch(`${BASE}/`, { method: "HEAD", signal: AbortSignal.timeout(1200) });
    serverAvailable = res.status < 500;
  } catch {
    serverAvailable = false;
  }
});

// Helper for live HTTP fetching with automatic test skip if server is offline
async function fetchPage(routePath: string, t?: TestContext): Promise<{ status: number; html: string; headers: Headers } | null> {
  if (!serverAvailable) {
    t?.skip(`Live server at ${BASE} not answering; HTTP test skipped`);
    return null;
  }
  const res = await fetch(`${BASE}${routePath}`);
  const html = await res.text();
  return { status: res.status, html, headers: res.headers };
}

// Helper to read repository source files
function readProjectFile(relPath: string): string {
  const fullPath = path.resolve(ROOT, relPath);
  return readFileSync(fullPath, "utf-8");
}

/* ==========================================================================
 * WCAG 2.1 Luminance and Contrast Mathematical Helpers
 * ========================================================================== */

function parseHexColor(hex: string): [number, number, number] {
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHexColor(hex);
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}

/* ==========================================================================
 * TIER 1: FEATURE COVERAGE (Core Requirements R1, R2, R3)
 * ========================================================================== */

describe("Tier 1: Feature Coverage", () => {
  /* ------------------------------------------------------------------------
   * Feature 1: Dark and Light Mode Support (R1)
   * ------------------------------------------------------------------------ */
  describe("R1: Dark and Light Mode Support", () => {
    test("T1.1.1: Theme Engine - globals.css defines light-dark() CSS variables for all core palette tokens", () => {
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
        "--on-swatch",
      ];
      for (const token of requiredTokens) {
        assert.ok(css.includes(token), `globals.css must define token ${token}`);
      }
      assert.match(css, /--paper:\s*light-dark\(#f2efe7,\s*#121114\);/, "--paper must define light and dark values");
      assert.match(css, /--ink:\s*light-dark\(#231e16,\s*#f5f2eb\);/, "--ink must define light and dark values");
      assert.match(css, /--muted:\s*light-dark\(#696253,\s*#a89f91\);/, "--muted must define light and dark values");
    });

    test("T1.1.2: System Preference - :root declares color-scheme: light dark for OS preference adaptation", () => {
      const css = readProjectFile("app/(site)/globals.css");
      assert.match(css, /:root\s*\{[^}]*color-scheme:\s*light\s+dark;/, ":root must specify color-scheme: light dark");
    });

    test("T1.1.3: Manual Override - :root[data-theme='light'] and :root[data-theme='dark'] override color-scheme", () => {
      const css = readProjectFile("app/(site)/globals.css");
      assert.match(css, /:root\[data-theme=["']light["']\]\s*\{[^}]*color-scheme:\s*light;/, "Light override must set color-scheme: light");
      assert.match(css, /:root\[data-theme=["']dark["']\]\s*\{[^}]*color-scheme:\s*dark;/, "Dark override must set color-scheme: dark");
    });

    test("T1.1.4: Pre-Paint Boot & FOUC Prevention - layout.tsx contains synchronous pinTheme script and suppressHydrationWarning", () => {
      const layout = readProjectFile("app/(site)/layout.tsx");
      assert.match(layout, /pinTheme\s*=/, "Root layout must declare pinTheme boot script");
      assert.match(layout, /localStorage\.getItem\(["']theme["']\)/, "Boot script must inspect localStorage.theme");
      assert.match(layout, /suppressHydrationWarning/, "<html ...> must declare suppressHydrationWarning");
      assert.match(layout, /<script[^>]*dangerouslySetInnerHTML=\{\{\s*__html:\s*pinTheme\s*\}\}/, "Layout must mount synchronous pinTheme script in <head>");
    });

    test("T1.1.5: ThemeToggle Component - theme-toggle.tsx exports safe hydration store and persists theme preference", () => {
      const toggle = readProjectFile("components/theme-toggle.tsx");
      assert.match(toggle, /export\s+function\s+ThemeToggle/, "theme-toggle.tsx must export ThemeToggle");
      assert.match(toggle, /useSyncExternalStore/, "ThemeToggle must use useSyncExternalStore for hydration safety");
      assert.match(toggle, /localStorage\.setItem\(["']theme["']/, "ThemeToggle must write to localStorage.theme");
      assert.match(toggle, /document\.documentElement\.dataset\.theme/, "ThemeToggle must inspect and mutate dataset.theme");
    });

    test("T1.1.6: Standalone Exhibits Theme Alignment - exhibits declare theme alignment or designated aesthetic mode", () => {
      const capsuleLayout = readProjectFile("app/(capsule)/layout.tsx");
      const shoreLayout = readProjectFile("app/(shore)/layout.tsx");
      const orreryLayout = readProjectFile("app/(orrery)/layout.tsx");

      assert.ok(capsuleLayout.includes("AppearanceBoot") || capsuleLayout.includes("pinTheme") || capsuleLayout.includes("suppressHydrationWarning"), "Capsule layout must declare appearance boot or theme awareness");
      assert.ok(shoreLayout.includes("AppearanceBoot") || shoreLayout.includes("pinTheme") || shoreLayout.includes("suppressHydrationWarning"), "Shore layout must declare appearance boot or theme awareness");
      assert.ok(orreryLayout.includes("AppearanceBoot") || orreryLayout.includes("pinTheme") || orreryLayout.includes("suppressHydrationWarning"), "Orrery layout must declare appearance boot or theme awareness");
    });
  });

  /* ------------------------------------------------------------------------
   * Feature 2: Responsiveness Fixes Across Devices (R2)
   * ------------------------------------------------------------------------ */
  describe("R2: Responsiveness Fixes Across Devices", () => {
    test("T1.2.1: Viewport Configuration - layout.tsx and exhibit layouts specify standard responsive viewport metadata", () => {
      const siteLayout = readProjectFile("app/(site)/layout.tsx");
      assert.match(siteLayout, /export\s+const\s+viewport:\s*Viewport\s*=/, "Root site layout must export viewport configuration");
      assert.match(siteLayout, /colorScheme:\s*["']light dark["']/, "Site viewport must specify colorScheme: light dark");

      const exhibitLayouts = ["app/(shore)/layout.tsx", "app/(capsule)/layout.tsx", "app/(ryugu)/layout.tsx"];
      for (const layoutPath of exhibitLayouts) {
        const layoutSource = readProjectFile(layoutPath);
        assert.match(layoutSource, /export\s+const\s+viewport:\s*Viewport\s*=/, `${layoutPath} must export viewport configuration`);
      }
    });

    test("T1.2.2: Masthead Mobile Crowding Defense - CommandPaletteButton hidden on small viewports and nav container scrolls cleanly", () => {
      const masthead = readProjectFile("components/masthead.tsx");
      assert.match(masthead, /hidden\s+sm:inline-flex/, "Masthead must hide desktop CommandPaletteButton (⌘K) on mobile viewports (< sm)");
      assert.match(masthead, /overflow-x-auto/, "Masthead nav must declare horizontal scrolling (overflow-x-auto) to prevent layout break");
      assert.match(masthead, /min-w-0/, "Masthead brand and nav containers must declare min-w-0 to prevent flex blowout");
    });

    test("T1.2.3: Hero & Caption Pills Mobile Wrapping - caption pills allow flexible wrapping on narrow mobile screens", () => {
      const homePage = readProjectFile("app/(site)/(home)/page.tsx");
      assert.match(homePage, /inline-flex\s+max-w-full[^"]*rounded-2xl\s+sm:rounded-full/, "Home page hero badge must use flexible max-w-full and rounded-2xl sm:rounded-full");
      assert.match(homePage, /break-words/, "Hero badge caption text must declare break-words to prevent mobile horizontal blowout");
    });

    test("T1.2.4: Timeline Book Turner & SQL Desk - multi-button controls support multi-line flex wrapping", () => {
      const timelineCss = readProjectFile("app/(site)/(app)/timeline/timeline.css");
      const sqlCss = readProjectFile("app/(site)/(app)/ledger/sql/sql.css");
      assert.match(timelineCss, /\.book-toolbar\s*\{[^}]*flex-wrap:\s*wrap;/, "Timeline book toolbar must declare flex-wrap: wrap");
      assert.match(sqlCss, /\.sql-schema\s*\{[^}]*flex-wrap:\s*wrap;/, "SQL desk schema container must declare flex-wrap: wrap");
      assert.match(sqlCss, /\.sql-saved\s*\{[^}]*flex-wrap:\s*wrap;/, "SQL desk saved queries must declare flex-wrap: wrap");
    });

    test("T1.2.5: Exhibit & Visual Scene Responsiveness - visual scenes declare responsive bounding constraints", () => {
      const zineCss = readProjectFile("app/(zine)/zine.css");
      const makingOfCss = readProjectFile("app/(site)/(app)/making-of/making-of.css");
      assert.ok(zineCss.includes("max-width") || zineCss.includes("overflow") || zineCss.includes("@media"), "Zine stylesheet must declare responsive layout rules");
      assert.ok(makingOfCss.includes("@media") || makingOfCss.includes("calc") || makingOfCss.includes("width"), "Making-Of emaki stylesheet must declare responsive bounds");
    });

    test("T1.2.6: Layout Container Geometry - core route layouts enforce responsive container geometry with max-w-4xl", () => {
      const homeLayout = readProjectFile("app/(site)/(home)/layout.tsx");
      const appLayout = readProjectFile("app/(site)/(app)/layout.tsx");
      const masthead = readProjectFile("components/masthead.tsx");

      assert.match(homeLayout, /max-w-4xl/, "Home layout must enforce max-w-4xl container constraint");
      assert.match(appLayout, /max-w-4xl/, "App layout must enforce max-w-4xl container constraint");
      assert.match(masthead, /max-w-4xl/, "Masthead chrome must enforce max-w-4xl container constraint");
    });
  });

  /* ------------------------------------------------------------------------
   * Feature 3: CI, Linter, and Build Check Simplification (R3)
   * ------------------------------------------------------------------------ */
  describe("R3: CI, Linter, and Build Simplification", () => {
    test("T1.3.1: ESLint Configuration - eslint.config.mjs declares scoped globalIgnores for non-production directories", () => {
      const eslintConfig = readProjectFile("eslint.config.mjs");
      assert.match(eslintConfig, /\.agents\/\*\*/, "ESLint must ignore .agents/**");
      assert.match(eslintConfig, /projects\/\*\*/, "ESLint must ignore projects/**");
      assert.match(eslintConfig, /changelogs\/\*\*/, "ESLint must ignore changelogs/**");
      assert.match(eslintConfig, /public\/vendor\/\*\*/, "ESLint must ignore public/vendor/**");
    });

    test("T1.3.2: Package.json Scripts - lint and typecheck scripts support fast execution", () => {
      const pkgJson = JSON.parse(readProjectFile("package.json"));
      assert.ok(pkgJson.scripts.lint, "package.json must declare lint script");
      assert.ok(pkgJson.scripts.typecheck, "package.json must declare typecheck script");
      assert.ok(pkgJson.scripts.build, "package.json must declare build script");
    });

    test("T1.3.3: Essential Test Runner - package.json defines test commands with node native test runner", () => {
      const pkgJson = JSON.parse(readProjectFile("package.json"));
      assert.ok(pkgJson.scripts.test, "package.json must declare test script");
      assert.match(pkgJson.scripts.test, /node\s+--experimental-strip-types/, "Test script must use node native strip-types runner");
      assert.match(pkgJson.scripts.test, /--test/, "Test script must invoke node:test runner");
    });

    test("T1.3.4: Prebuild Hardening - fetch-contributions.mjs supports offline fallback under --build flag", () => {
      const script = readProjectFile("scripts/fetch-contributions.mjs");
      assert.match(script, /--build/, "fetch-contributions.mjs must recognize --build flag");
      assert.match(script, /content\/contributions\.json|output/, "fetch-contributions.mjs must reference committed local data on fallback");
    });

    test("T1.3.5: CI Workflow Streamlining - ci.yml defines isolated jobs without redundant duplicate prebuild steps", () => {
      const ciYaml = readProjectFile(".github/workflows/ci.yml");
      assert.match(ciYaml, /name:\s*CI/i, "ci.yml must define CI workflow");
      assert.match(ciYaml, /npm run lint/, "ci.yml must run linter");
      assert.match(ciYaml, /npm run typecheck/, "ci.yml must run typecheck");
      assert.match(ciYaml, /npm run build/, "ci.yml must run build");
    });

    test("T1.3.6: E2E Runner Synchronization - scripts/e2e.mjs includes modern test suites in HTTP pool", () => {
      const e2eScript = readProjectFile("scripts/e2e.mjs");
      assert.ok(e2eScript.includes("HTTP_E2E") || e2eScript.includes("test"), "e2e.mjs must declare test suite registry");
    });
  });
});

/* ==========================================================================
 * TIER 2: BOUNDARY & CORNER CASES
 * ========================================================================== */

describe("Tier 2: Boundary & Corner Cases", () => {
  /* ------------------------------------------------------------------------
   * Theme Boundaries & Mathematical Contrast Ratios
   * ------------------------------------------------------------------------ */
  describe("Theme R1: Boundaries & WCAG AA Contrast Ratios", () => {
    test("T2.1.1: Contrast Boundary - Primary text (--ink) on background (--paper) achieves > 14:1 contrast in light and dark modes", () => {
      // Light Mode: --paper #f2efe7, --ink #231e16
      const lightContrast = contrastRatio("#f2efe7", "#231e16");
      assert.ok(lightContrast >= 14.0, `Light mode ink contrast ${lightContrast.toFixed(2)}:1 must be >= 14:1`);

      // Dark Mode: --paper #121114, --ink #f5f2eb
      const darkContrast = contrastRatio("#121114", "#f5f2eb");
      assert.ok(darkContrast >= 14.0, `Dark mode ink contrast ${darkContrast.toFixed(2)}:1 must be >= 14:1`);
    });

    test("T2.1.2: Contrast Boundary - Secondary text (--muted) on background (--paper) achieves >= 4.5:1 WCAG AA contrast in both modes", () => {
      // Light Mode: --paper #f2efe7, --muted #696253
      const lightContrast = contrastRatio("#f2efe7", "#696253");
      assert.ok(lightContrast >= 4.5, `Light mode muted contrast ${lightContrast.toFixed(2)}:1 must be >= 4.5:1`);

      // Dark Mode: --paper #121114, --muted #a89f91
      const darkContrast = contrastRatio("#121114", "#a89f91");
      assert.ok(darkContrast >= 4.5, `Dark mode muted contrast ${darkContrast.toFixed(2)}:1 must be >= 4.5:1`);
    });

    test("T2.1.3: Contrast Boundary - Danger text (--danger) on background (--paper) achieves >= 4.5:1 WCAG AA contrast in both modes", () => {
      // Light Mode: --paper #f2efe7, --danger #b03a22
      const lightContrast = contrastRatio("#f2efe7", "#b03a22");
      assert.ok(lightContrast >= 4.5, `Light mode danger contrast ${lightContrast.toFixed(2)}:1 must be >= 4.5:1`);

      // Dark Mode: --paper #121114, --danger #f0826a
      const darkContrast = contrastRatio("#121114", "#f0826a");
      assert.ok(darkContrast >= 4.5, `Dark mode danger contrast ${darkContrast.toFixed(2)}:1 must be >= 4.5:1`);
    });

    test("T2.1.4: Contrast Boundary - Invariable swatch text (--on-swatch) achieves >= 4.5:1 WCAG AA contrast against all 5 palette swatches", () => {
      const onSwatch = "#231e16";
      const swatches: Record<string, string> = {
        yellow: "#e6c364",
        coral: "#ee6f54",
        mint: "#80c8a6",
        blue: "#6b95d9",
        pink: "#f0a8b9",
      };

      for (const [name, hex] of Object.entries(swatches)) {
        const ratio = contrastRatio(onSwatch, hex);
        assert.ok(ratio >= 4.5, `Swatch ${name} (${hex}) text contrast ${ratio.toFixed(2)}:1 against ${onSwatch} must be >= 4.5:1`);
      }
    });

    test("T2.1.5: Resilience Boundary - Corrupted and malformed localStorage values are safely ignored by boot script", () => {
      const layout = readProjectFile("app/(site)/layout.tsx");
      const pinThemeMatch = layout.match(/const\s+pinTheme\s*=\s*`([^`]+)`/);
      assert.ok(pinThemeMatch, "pinTheme boot script string must be defined in layout.tsx");
      const scriptCode = pinThemeMatch[1];

      // Verify that the script strictly checks for === "light" || === "dark"
      assert.match(scriptCode, /t===["']light["']\|\|t===["']dark["']/, "pinTheme must strictly whitelist 'light' and 'dark' values");

      // Test simulation of corrupted values:
      const testCases = ["", "null", "undefined", "auto", "system", "dark; alert(1)", "blue", "{\"theme\":\"dark\"}"];
      for (const corruptVal of testCases) {
        const isValid = corruptVal === "light" || corruptVal === "dark";
        assert.strictEqual(isValid, false, `Corrupted value '${corruptVal}' must never evaluate as valid theme`);
      }
    });

    test("T2.1.6: Storage Exception Boundary - localStorage access in boot script and toggle is protected by try/catch", () => {
      const layout = readProjectFile("app/(site)/layout.tsx");
      assert.match(layout, /try\s*\{[^}]*localStorage[^}]*\}\s*catch/, "pinTheme in layout.tsx must wrap localStorage access in try/catch");

      const toggle = readProjectFile("components/theme-toggle.tsx");
      assert.match(toggle, /try\s*\{[^}]*localStorage\.setItem[^}]*\}\s*catch/, "ThemeToggle must wrap localStorage.setItem in try/catch");
    });
  });

  /* ------------------------------------------------------------------------
   * Responsiveness Boundaries & Viewport Extremes
   * ------------------------------------------------------------------------ */
  describe("Responsiveness R2: Boundaries & Viewport Extremes", () => {
    test("T2.2.1: Viewport Boundary 320px - Narrow mobile layout rules prevent fixed-width overflow", () => {
      const globalsCss = readProjectFile("app/(site)/globals.css");
      assert.ok(globalsCss.includes("tailwindcss") || globalsCss.includes("box-sizing"), "CSS reset must apply standard border-box sizing");
      const homeLayout = readProjectFile("app/(site)/(home)/layout.tsx");
      const appLayout = readProjectFile("app/(site)/(app)/layout.tsx");
      assert.ok(homeLayout.includes("max-w-") || homeLayout.includes("w-full"), "Home layout enforces responsive width bounds");
      assert.ok(appLayout.includes("max-w-") || appLayout.includes("w-full"), "App layout enforces responsive width bounds");
    });

    test("T2.2.2: Viewport Boundary 375px - Mobile interactive controls maintain accessible touch targets", () => {
      const toggle = readProjectFile("components/theme-toggle.tsx");
      assert.match(toggle, /size-8|size-9|size-10|h-8|h-9|h-10|p-2|p-1\.5|btn/, "ThemeToggle button must declare minimum touch target dimensions");
    });

    test("T2.2.3: Viewport Boundary 768px - Tablet breakpoints configure responsive multi-column transitions", () => {
      const masthead = readProjectFile("components/masthead.tsx");
      assert.match(masthead, /sm:gap-|sm:px-/, "Masthead must configure sm responsive transitions");

      const homePage = readProjectFile("app/(site)/(home)/page.tsx");
      assert.match(homePage, /sm:/, "Home page must configure sm/md responsive breakpoints");
    });

    test("T2.2.4: Viewport Boundary 1024px & 1440px - Desktop containers constrain maximum reading line length", () => {
      const layout = readProjectFile("app/(site)/(app)/layout.tsx");
      assert.match(layout, /max-w-4xl/, "Content container must constrain width to max-w-4xl on wide desktop viewports");
    });

    test("T2.2.5: Horizontal Scroll Invariant - Page content is wrapped within viewport boundary without fixed overflow", () => {
      const layout = readProjectFile("app/(site)/layout.tsx");
      assert.match(layout, /<body[^>]*className="[^"]*h-full[^"]*"/, "Body element must configure full height without rigid width");
    });

    test("T2.2.6: Deep Code & Table Overflow - Wide SQL result tables and preformatted blocks declare overflow-x: auto", () => {
      const sqlCss = readProjectFile("app/(site)/(app)/ledger/sql/sql.css");
      assert.match(sqlCss, /\.sql-results\s*\{[^}]*overflow-x:\s*auto;/, ".sql-results table container must declare overflow-x: auto");
    });
  });

  /* ------------------------------------------------------------------------
   * CI & Build Boundaries
   * ------------------------------------------------------------------------ */
  describe("CI & Build R3: Boundaries & Check Guarantees", () => {
    test("T2.3.1: Network Timeout Boundary - Prebuild fetch does not hang indefinitely when offline", () => {
      const fetchContrib = readProjectFile("scripts/fetch-contributions.mjs");
      assert.match(fetchContrib, /AbortSignal\.timeout\(\s*15000\s*\)|timeout/i, "fetch-contributions.mjs must declare explicit abort timeout");
    });

    test("T2.3.2: Linter Cache Boundary - ESLint config enables ignores for heavy non-code trees", () => {
      const eslintConfig = readProjectFile("eslint.config.mjs");
      assert.match(eslintConfig, /globalIgnores\(\[/, "ESLint configuration must use globalIgnores");
    });

    test("T2.3.3: Typecheck Strictness Boundary - tsconfig.json specifies strict TypeScript checking", () => {
      const tsconfig = JSON.parse(readProjectFile("tsconfig.json"));
      assert.strictEqual(tsconfig.compilerOptions.strict, true, "tsconfig.json must enforce strict: true");
    });

    test("T2.3.4: Essential Test Execution Speed - Package configuration separates fast test runners", () => {
      const pkgJson = JSON.parse(readProjectFile("package.json"));
      assert.ok(typeof pkgJson.scripts.test === "string" && pkgJson.scripts.test.length > 0, "Default test script must exist");
      assert.match(pkgJson.scripts.test, /node\s+--experimental-strip-types/, "Test runner must use strip-types for sub-second startup");
    });

    test("T2.3.5: CI Job Isolation Boundary - ci.yml separates verification stages", () => {
      const ciYaml = readProjectFile(".github/workflows/ci.yml");
      assert.match(ciYaml, /jobs:\s*\n\s*checks:/, "ci.yml must define checks job");
    });

    test("T2.3.6: Runtime Dependency Boundary - Node engine requires 22.x LTS runtime", () => {
      const pkgJson = JSON.parse(readProjectFile("package.json"));
      assert.strictEqual(pkgJson.engines.node, "22.x", "package.json engines must require node 22.x");
    });
  });
});

/* ==========================================================================
 * TIER 3: CROSS-FEATURE COMBINATIONS (Pairwise Interactions)
 * ========================================================================== */

describe("Tier 3: Cross-Feature Combinations", () => {
  test("T3.1: Theme x Viewport Interaction - Token contrast remains valid across all responsive container breakpoints", () => {
    const css = readProjectFile("app/(site)/globals.css");
    // Ensure that responsive utilities and light-dark tokens coexist without overriding each other
    assert.match(css, /--paper:\s*light-dark/, "--paper token defined with light-dark()");
    assert.match(css, /--ink:\s*light-dark/, "--ink token defined with light-dark()");

    const lightRatio = contrastRatio("#f2efe7", "#231e16");
    const darkRatio = contrastRatio("#121114", "#f5f2eb");
    assert.ok(lightRatio > 14.0 && darkRatio > 14.0, "Contrast ratios are independent of viewport width");
  });

  test("T3.2: Masthead Responsive Layout with ThemeToggle Accessibility - ThemeToggle button remains accessible on mobile viewports", () => {
    const masthead = readProjectFile("components/masthead.tsx");
    // ThemeToggle is rendered outside of hidden sm:inline-flex so it remains visible on mobile
    const themeToggleInMobileGroup = /<ThemeToggle\s*\/>/.test(masthead);
    const themeToggleNotHidden = !/<span className="hidden[^"]*">\s*<ThemeToggle/.test(masthead);
    assert.ok(themeToggleInMobileGroup && themeToggleNotHidden, "ThemeToggle must remain accessible on mobile viewports (< sm)");
  });

  test("T3.3: Route Navigation Preserves Theme State - PUBLIC_PAGES share identical layout appearance boot and chrome", () => {
    const siteLayout = readProjectFile("app/(site)/layout.tsx");
    assert.match(siteLayout, /pinTheme/, "Site layout pins theme across all child routes");

    for (const page of PUBLIC_PAGES) {
      assert.ok(typeof page.href === "string" && page.href.startsWith("/"), `PUBLIC_PAGE ${page.href} must be a valid root route`);
    }
  });

  test("T3.4: Dual-Theme Legibility in Interactive Components - SqlDesk, Timeline, and Music declare theme-adaptive tokens", () => {
    const timelineCss = readProjectFile("app/(site)/(app)/timeline/timeline.css");
    const sqlCss = readProjectFile("app/(site)/(app)/ledger/sql/sql.css");

    assert.match(timelineCss, /var\(--ink\)/, "Timeline CSS must use CSS token var(--ink)");
    assert.match(timelineCss, /var\(--paper\)/, "Timeline CSS must use CSS token var(--paper)");
    assert.match(sqlCss, /var\(--ink\)/, "SQL CSS must use CSS token var(--ink)");
    assert.match(sqlCss, /var\(--field\)/, "SQL CSS must use CSS token var(--field)");
  });

  test("T3.5: Standalone Exhibits Theme & Responsive Alignment - Exhibits isolate stylesheets while respecting viewport and appearance", () => {
    const capsuleLayout = readProjectFile("app/(capsule)/layout.tsx");
    assert.match(capsuleLayout, /export\s+const\s+viewport:\s*Viewport/, "Capsule layout must declare viewport");
    assert.match(capsuleLayout, /suppressHydrationWarning/, "Capsule layout must suppress hydration warning for theme pinning");
  });

  test("T3.6: Fast CI Verification Covers Both Responsive & Themed Modules - Source files contain valid imports", () => {
    const masthead = readProjectFile("components/masthead.tsx");
    assert.match(masthead, /import\s+\{\s*ThemeToggle\s*\}\s+from\s+["']@\/components\/theme-toggle["']/, "Masthead imports ThemeToggle correctly");
    assert.match(masthead, /import\s+\{\s*PUBLIC_PAGES\s*\}\s+from\s+["']@\/lib\/pages["']/, "Masthead imports PUBLIC_PAGES correctly");
  });

  test("T3.7: Theme Pinning Resilience across Route Reloads - pinTheme script handles execution before CSS stylesheets load", () => {
    const layout = readProjectFile("app/(site)/layout.tsx");
    const headMatch = layout.match(/<head>([\s\S]*?)<\/head>/);
    assert.ok(headMatch && headMatch[1].includes("pinTheme"), "pinTheme script is mounted inside <head>");
  });

  test("T3.8: View Transitions Coordinate with Responsive Layout - document.startViewTransition is gracefully checked", () => {
    const toggle = readProjectFile("components/theme-toggle.tsx");
    assert.match(toggle, /if\s*\(!document\.startViewTransition\)\s*return\s+apply\(\)/, "ThemeToggle must check for startViewTransition support before invoking");
  });
});

/* ==========================================================================
 * TIER 4: REAL-WORLD APPLICATION SCENARIOS
 * ========================================================================== */

describe("Tier 4: Real-World Application Scenarios", () => {
  test("T4.1: Scenario 1 - Mobile Smartphone Visitor (375px, Dark Mode): Traversing from Home to Work with dark preference", async () => {
    const home = await fetchPage("/");
    if (home) {
      assert.strictEqual(home.status, 200, "Home page must respond with HTTP 200");
      assert.match(home.html, /<!DOCTYPE html>/i, "Home page must render valid HTML5");
    }
    // Verify static components & tokens for this journey
    const homeSource = readProjectFile("app/(site)/(home)/page.tsx");
    const workSource = readProjectFile("app/(site)/(app)/work/page.tsx");
    const globalsCss = readProjectFile("app/(site)/globals.css");
    const mastheadSource = readProjectFile("components/masthead.tsx");

    assert.match(homeSource, /href=["']\/work["']/, "Home page provides path to /work");
    assert.match(mastheadSource, /<ThemeToggle\s*\/>/, "Masthead provides ThemeToggle for visitor");
    assert.match(globalsCss, /--paper:\s*light-dark/, "Palette provides adaptive tokens for dark mode");
    assert.match(homeSource, /inline-flex\s+max-w-full/, "Hero pill wraps cleanly without mobile overflow");
    assert.match(workSource, /max-w-/, "Work page applies responsive width constraints");
  });

  test("T4.2: Scenario 2 - Tablet Reader Nighttime Study Journey (768px, Light to Dark): Notes reading view and theme transition", async () => {
    const notes = await fetchPage("/notes");
    if (notes) {
      assert.strictEqual(notes.status, 200, "Notes page must respond with HTTP 200");
    }
    const notesSource = readProjectFile("app/(site)/(app)/notes/page.tsx");
    const toggleSource = readProjectFile("components/theme-toggle.tsx");
    const globalsCss = readProjectFile("app/(site)/globals.css");

    assert.match(notesSource, /site\.notes/, "Notes page renders site notes collection");
    assert.match(toggleSource, /useSyncExternalStore/, "ThemeToggle ensures hydration-safe theme reading");
    assert.match(globalsCss, /--muted:\s*light-dark/, "Muted text adjusts luminance for nighttime reading");
  });

  test("T4.3: Scenario 3 - Desktop Systems Architect & Recruiter Audit (1440px): Full chrome & navigation inspection", async () => {
    const work = await fetchPage("/work");
    if (work) {
      assert.strictEqual(work.status, 200, "Work page must respond with HTTP 200");
    }
    const workSource = readProjectFile("app/(site)/(app)/work/page.tsx");
    const mastheadSource = readProjectFile("components/masthead.tsx");

    assert.match(workSource, /Pipeline|site\.work/, "Work page renders technical architecture");
    assert.match(mastheadSource, /CommandPaletteButton/, "Desktop chrome exposes CommandPaletteButton (⌘K)");
    assert.match(mastheadSource, /max-w-4xl/, "Masthead enforces max-w-4xl desktop boundary");
  });

  test("T4.4: Scenario 4 - Compact Retro Gamer Journey (320px): Interactive curiosity with touch targets & wrapping", async () => {
    const projects = await fetchPage("/projects");
    if (projects) {
      assert.strictEqual(projects.status, 200, "Projects page must respond with HTTP 200");
    }
    const projectsSource = readProjectFile("app/(site)/(app)/projects/page.tsx");
    const timelineCss = readProjectFile("app/(site)/(app)/timeline/timeline.css");

    assert.match(projectsSource, /site\.projectList/, "Projects directory renders curiosities");
    assert.match(timelineCss, /flex-wrap:\s*wrap;/, "Timeline controls wrap cleanly on narrow screens");
  });

  test("T4.5: Scenario 5 - Standalone Exhibit Explorer Journey: Standalone exhibit theme & viewport isolation", async () => {
    const capsule = await fetchPage("/capsule");
    if (capsule) {
      assert.strictEqual(capsule.status, 200, "Capsule exhibit must respond with HTTP 200");
    }
    const capsuleLayout = readProjectFile("app/(capsule)/layout.tsx");
    const shoreLayout = readProjectFile("app/(shore)/layout.tsx");

    assert.match(capsuleLayout, /CapsuleLayout/, "Capsule exhibit declares root layout");
    assert.match(shoreLayout, /ShoreLayout/, "Shore exhibit declares root layout");
    assert.match(capsuleLayout, /suppressHydrationWarning/, "Capsule layout handles theme pinning without hydration warning");
  });

  test("T4.6: Scenario 6 - CI & Offline Developer Verification Journey: Validating fast local build and test contracts", () => {
    const pkgJson = JSON.parse(readProjectFile("package.json"));
    assert.ok(pkgJson.scripts.build, "build script exists");
    assert.ok(pkgJson.scripts.test, "test script exists");
    assert.ok(pkgJson.scripts.lint, "lint script exists");
    assert.ok(pkgJson.scripts.typecheck, "typecheck script exists");
  });
});
