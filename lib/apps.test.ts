import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import {
  APP_STATUSES,
  AppManifestValidationError,
  appSealChoice,
  availablePlatforms,
  filterApps,
  hashAppSlug,
  isValidIsoCalendarDate,
  resolveFollowAction,
  sortApps,
  STATUS_META,
  validateAppManifest,
  validateSafeUrl,
  WORKSHOP_SOCIAL_FOLLOW,
} from "./apps.ts";
import { appBySlug, DEFAULT_APPS_DIR, loadApps } from "./apps-server.ts";
import { sealModel } from "./hanko.ts";

const ROOT = resolve(import.meta.dirname, "..");

function validBaseManifest(): Record<string, unknown> {
  return {
    $schema: "./_schema.json",
    slug: "sample-tool",
    order: 10,
    featured: false,
    name: "Sample Tool",
    tagline: "A minimal fixture manifest for schema validation checks.",
    description: ["Sample Tool exercises every required field in the app manifest validator."],
    platforms: ["cli"],
    status: "planned",
    swatch: "mint",
    techStack: ["TypeScript"],
    features: [
      { title: "Typed schema", detail: "Validates every manifest field at build and test time." },
      { title: "Zero code", detail: "Drops straight into content/apps without touching routes." },
    ],
    install: {
      label: "Preview CLI",
      command: "sample-tool --help",
    },
    links: {},
    illustration: {
      kind: "ink",
      alt: "Isometric workshop blueprint sheet with three stacked blocks.",
    },
    milestones: [
      { title: "Draft specification", state: "done", target: "2026-Q3" },
      { title: "Build prototype", state: "active", target: "2026-Q4" },
    ],
    changelog: [
      {
        version: "0.1.0-dev",
        date: "2026-10-15",
        summary: "Initial manifest validation fixture.",
      },
    ],
  };
}

test("lib/apps.ts stays pure and free of node:fs or browser DOM globals", () => {
  const src = readFileSync(resolve(import.meta.dirname, "apps.ts"), "utf8");
  assert.doesNotMatch(src, /node:fs|node:path|\b(window|document|localStorage|navigator|matchMedia)\b/);
});

test("loadApps discovers and validates the four workshop manifests in order", () => {
  const apps = loadApps();
  assert.deepEqual(
    apps.map((app) => app.slug),
    ["bento", "niwa", "kakeibo", "shiki"],
  );
  assert.deepEqual(
    apps.map((app) => app.order),
    [1, 2, 3, 4],
  );

  for (const app of apps) {
    assert.equal(app.status, "building");
    assert.equal(app.featured, true);
    assert.ok(app.features.length >= 2);
    assert.ok(app.milestones.length >= 2);
    assert.ok(app.changelog.length >= 1);
  }

  const bento = appBySlug("bento");
  assert.ok(bento);
  assert.equal(bento.name, "Bento");
  assert.deepEqual(bento.platforms, ["macos", "cli"]);
  assert.equal(bento.links.repo, "https://github.com/quiinthieu/bento");
  assert.equal(bento.links.homebrew?.cask, "agent-bento");
  assert.match(bento.install.command, /agent-bento|bentoctx/);
  assert.equal(bento.preview?.kind, "frames");

  const niwa = appBySlug("niwa");
  assert.ok(niwa);
  assert.equal(niwa.name, "Niwa");
  assert.deepEqual(niwa.platforms, ["macos", "cli", "tui"]);
  assert.equal(niwa.preview?.kind, "niwa-garden");

  const kakeibo = appBySlug("kakeibo");
  assert.ok(kakeibo);
  assert.equal(kakeibo.name, "Kakeibo");
  assert.deepEqual(kakeibo.platforms, ["cli"]);
  assert.equal(kakeibo.preview?.kind, "frames");

  const shiki = appBySlug("shiki");
  assert.ok(shiki);
  assert.equal(shiki.name, "Shiki");
  assert.deepEqual(shiki.platforms, ["cli"]);
  assert.match(shiki.install.command, /shiki-term/);
  assert.equal(shiki.preview?.kind, "shiki-drift");

  assert.equal(appBySlug("nonexistent-app"), null);
  assert.equal(appBySlug("_schema"), null);
  assert.equal(appBySlug("../bento"), null);
  assert.equal(appBySlug("Bento"), null);
  assert.equal(appBySlug(""), null);
});

test("validateAppManifest rejects malformed slugs, enums, calendar dates, URLs, and screenshot paths", () => {
  assert.throws(() => validateAppManifest(null), AppManifestValidationError);
  assert.throws(() => validateAppManifest([]), AppManifestValidationError);

  assert.throws(
    () => validateAppManifest(validBaseManifest(), "different-filename"),
    /must match filename "different-filename\.json"/,
  );

  for (const badSlug of ["Bad_Slug", "UPPER", "space slug", "-leading", "trailing-", "constructor", "__proto__"]) {
    assert.throws(
      () => validateAppManifest({ ...validBaseManifest(), slug: badSlug }),
      AppManifestValidationError,
      `expected slug "${badSlug}" to fail`,
    );
  }

  assert.throws(
    () => validateAppManifest({ ...validBaseManifest(), status: "shipping-soon" }),
    /invalid status/,
  );
  assert.throws(
    () => validateAppManifest({ ...validBaseManifest(), swatch: "ultraviolet" }),
    /invalid swatch/,
  );
  assert.throws(
    () => validateAppManifest({ ...validBaseManifest(), platforms: ["windows"] }),
    /invalid platform/,
  );
  assert.throws(
    () => validateAppManifest({ ...validBaseManifest(), platforms: ["cli", "cli"] }),
    /duplicate platform/,
  );
  assert.throws(
    () => validateAppManifest({ ...validBaseManifest(), features: [{ title: "Only one", detail: "Too few" }] }),
    /at least 2 features/,
  );
  assert.throws(
    () => validateAppManifest({ ...validBaseManifest(), milestones: [{ title: "Only one", state: "done" }] }),
    /at least 2 milestones/,
  );
  assert.throws(
    () => validateAppManifest({ ...validBaseManifest(), changelog: [] }),
    /at least 1 changelog entry/,
  );

  assert.equal(isValidIsoCalendarDate("2028-02-29"), true);
  assert.equal(isValidIsoCalendarDate("2026-02-29"), false);
  assert.equal(isValidIsoCalendarDate("2026-02-30"), false);
  assert.equal(isValidIsoCalendarDate("2026-13-01"), false);
  assert.equal(isValidIsoCalendarDate("2026/10/15"), false);

  assert.throws(
    () =>
      validateAppManifest({
        ...validBaseManifest(),
        changelog: [{ version: "0.1.0", date: "2026-02-30", summary: "Impossible calendar date" }],
      }),
    /valid YYYY-MM-DD calendar date/,
  );

  for (const unsafeUrl of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "http://github.com/quiinthieu/bento",
    "ftp://files.example.com/app.tar.gz",
    "https://github.com/with space",
  ]) {
    assert.throws(
      () => validateSafeUrl(unsafeUrl, "links.repo", "sample-tool"),
      AppManifestValidationError,
      `expected URL "${unsafeUrl}" to fail`,
    );
  }

  assert.throws(
    () => validateSafeUrl("mailto:hello@otohime.dev", "links.repo", "sample-tool", { allowMailto: false }),
    /disallowed scheme/,
  );
  assert.throws(
    () => validateSafeUrl("mailto:not-an-email", "links.follow.href", "sample-tool", { allowMailto: true }),
    /valid recipient address/,
  );
  assert.equal(
    validateSafeUrl("mailto:hello@otohime.dev?subject=Notify%20me", "links.follow.href", "sample-tool", {
      allowMailto: true,
    }),
    "mailto:hello@otohime.dev?subject=Notify%20me",
  );

  for (const badSrc of [
    "https://evil.example/shot.png",
    "//evil.example/shot.png",
    "/../secret.png",
    "/apps/../../etc/passwd",
    "apps/relative.png",
  ]) {
    assert.throws(
      () =>
        validateAppManifest({
          ...validBaseManifest(),
          illustration: { kind: "screenshot", src: badSrc, alt: "Bad screenshot", width: 800, height: 600 },
        }),
      /local root-relative path/,
      `expected screenshot src "${badSrc}" to fail`,
    );
  }

  const validScreenshot = validateAppManifest({
    ...validBaseManifest(),
    illustration: {
      kind: "screenshot",
      src: "/apps/sample-tool.png",
      alt: "Sample Tool window on warm paper",
      width: 1200,
      height: 800,
      caption: "Local static screenshot",
    },
  });
  assert.equal(validScreenshot.illustration.kind, "screenshot");
  assert.equal(validScreenshot.illustration.src, "/apps/sample-tool.png");
});

test("filterApps, availablePlatforms, sortApps, resolveFollowAction, and hanko seal helpers behave deterministically", () => {
  const apps = loadApps();
  assert.deepEqual(availablePlatforms(apps), ["macos", "cli", "tui"]);

  assert.deepEqual(
    filterApps(apps, { platform: "tui" }).map((a) => a.slug),
    ["niwa"],
  );
  assert.deepEqual(
    filterApps(apps, { platform: "macos" }).map((a) => a.slug),
    ["bento", "niwa"],
  );
  assert.deepEqual(
    filterApps(apps, { platform: "cli", status: "building" }).map((a) => a.slug),
    ["bento", "niwa", "kakeibo", "shiki"],
  );
  assert.deepEqual(filterApps(apps, { status: "released" }), []);
  assert.equal(filterApps(apps, { platform: "all", status: "all" }).length, 4);

  const unorderedA = validateAppManifest({ ...validBaseManifest(), slug: "zeta", name: "Zeta", order: undefined });
  const unorderedB = validateAppManifest({ ...validBaseManifest(), slug: "alpha", name: "Alpha", order: undefined });
  const ordered = validateAppManifest({ ...validBaseManifest(), slug: "first", name: "First", order: 1 });
  assert.deepEqual(
    sortApps([unorderedA, ordered, unorderedB]).map((a) => a.slug),
    ["first", "alpha", "zeta"],
  );

  const bento = appBySlug("bento")!;
  const bentoFollow = resolveFollowAction(bento);
  assert.deepEqual(bentoFollow, {
    primary: {
      label: "Watch on GitHub",
      href: "https://github.com/quiinthieu/bento",
      kind: "repo",
    },
  });

  const niwa = appBySlug("niwa")!;
  const niwaFollow = resolveFollowAction(niwa);
  assert.equal(niwaFollow.primary.kind, "mailto");
  assert.match(niwaFollow.primary.href, /^mailto:hello@otohime\.dev\?subject=/);
  assert.deepEqual(niwaFollow.secondary, WORKSHOP_SOCIAL_FOLLOW);

  const fallbackFollow = resolveFollowAction({ name: "Bare Tool", links: {} });
  assert.equal(fallbackFollow.primary.kind, "mailto");
  assert.equal(
    fallbackFollow.primary.href,
    "mailto:hello@otohime.dev?subject=Notify%20me%3A%20Bare%20Tool",
  );
  assert.deepEqual(fallbackFollow.secondary, WORKSHOP_SOCIAL_FOLLOW);

  for (const status of APP_STATUSES) {
    const choice = appSealChoice({ status });
    assert.equal(choice.name, STATUS_META[status].seal);
    assert.equal(choice.shape, STATUS_META[status].shape);
    const model = sealModel(choice);
    assert.ok(model.edge.startsWith("M"));
    assert.ok(model.glyphs.length >= 1);
  }

  const customSeal = appSealChoice({ status: "building", seal: { text: "庭", shape: "round" } });
  assert.deepEqual(customSeal, { name: "庭", shape: "round" });

  assert.equal(hashAppSlug("bento"), hashAppSlug("bento"));
  assert.notEqual(hashAppSlug("bento"), hashAppSlug("niwa"));
});

test("dropping a fifth JSON manifest into an apps directory populates loadApps and appBySlug without code changes", () => {
  const tmpDir = mkdtempSync("/tmp/otohime-apps-ext-");
  try {
    cpSync(DEFAULT_APPS_DIR, tmpDir, { recursive: true });
    const fifth = {
      ...validBaseManifest(),
      slug: "zzzz-probe",
      order: undefined,
      name: "Probe Desk",
      platforms: ["web", "cli"],
      status: "beta",
    };
    writeFileSync(join(tmpDir, "zzzz-probe.json"), JSON.stringify(fifth, null, 2), "utf8");

    const loaded = loadApps(tmpDir);
    assert.deepEqual(
      loaded.map((app) => app.slug),
      ["bento", "niwa", "kakeibo", "shiki", "zzzz-probe"],
    );
    assert.equal(appBySlug("zzzz-probe", tmpDir)?.name, "Probe Desk");
    assert.deepEqual(availablePlatforms(loaded), ["macos", "cli", "tui", "web"]);
    assert.deepEqual(
      filterApps(loaded, { platform: "web", status: "beta" }).map((a) => a.slug),
      ["zzzz-probe"],
    );

    // Duplicate slug across distinct filenames is rejected deterministically.
    writeFileSync(
      join(tmpDir, "another-file.json"),
      JSON.stringify({ ...fifth, slug: "bento" }, null, 2),
      "utf8",
    );
    assert.throws(() => loadApps(tmpDir), /Duplicate app slug "bento"/);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("next.config.ts traces content/apps JSON files and apps.css keeps reduced-motion last without finite animations", () => {
  const nextConfig = readFileSync(join(ROOT, "next.config.ts"), "utf8");
  assert.match(nextConfig, /outputFileTracingIncludes/);
  assert.match(nextConfig, /"\/apps":\s*\["\.\/content\/apps\/\*\*\/\*\.json"\]/);
  assert.match(nextConfig, /"\/apps\/\[slug\]":\s*\["\.\/content\/apps\/\*\*\/\*\.json"\]/);

  const css = readFileSync(join(ROOT, "app/(site)/(app)/apps/apps.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(css, /\banimation\s*:/);
  assert.match(css.trimEnd(), /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*\}\s*$/);
});
