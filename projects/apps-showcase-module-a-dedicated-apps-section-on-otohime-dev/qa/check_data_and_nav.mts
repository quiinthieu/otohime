import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  APP_MOTIFS,
  APP_PLATFORMS,
  APP_STATUSES,
  APP_SWATCHES,
  AppManifestValidationError,
  type AppManifest,
  appSealChoice,
  availablePlatforms,
  filterApps,
  hashAppSlug,
  PLATFORM_META,
  validateAppManifest,
  resolveFollowAction,
  STATUS_META,
  sortApps,
} from "../../../lib/apps.ts";
import { appBySlug, loadApps } from "../../../lib/apps-server.ts";
import { sealModel } from "../../../lib/hanko.ts";
import { CONSOLE_MENU, menuBaseline, PUBLIC_PAGES } from "../../../lib/pages.ts";
import { findPlace, PLACES, run, type TerminalState } from "../../../lib/terminal.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const CONTENT_APPS_DIR = path.join(REPO_ROOT, "content", "apps");

interface DataAndNavObservation {
  schemaExists: boolean;
  apps: AppManifest[];
  dropInApps: AppManifest[];
  dropInLookup: AppManifest | null;
  unknownLookup: AppManifest | null;
  invalidManifestRejected: boolean;
  duplicateSlugRejected: boolean;
  publicPages: ReadonlyArray<{ href: string; label: string }>;
  consoleMenu: ReadonlyArray<{ href: string; label: string }>;
  consoleLastBaseline: number;
  commandNames: readonly string[];
  terminalAppsNav: string | null;
  terminalGoAppsNav: string | null;
}

function collectObservation(): DataAndNavObservation {
  const schemaPath = path.join(CONTENT_APPS_DIR, "_schema.json");
  const schemaExists = fs.existsSync(schemaPath);
  const apps = loadApps(CONTENT_APPS_DIR);
  const unknownLookup = appBySlug("unknown-nonexistent-app", CONTENT_APPS_DIR);

  // Exercise zero-code drop-in extensibility in an isolated copy of content/apps/
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "otohime-qa-t1882-dropin-"));
  let dropInApps: AppManifest[] = [];
  let dropInLookup: AppManifest | null = null;
  let duplicateSlugRejected = false;
  try {
    for (const entry of fs.readdirSync(CONTENT_APPS_DIR)) {
      fs.copyFileSync(path.join(CONTENT_APPS_DIR, entry), path.join(tmpDir, entry));
    }
    const fifthManifest = {
      $schema: "./_schema.json",
      slug: "suzuri",
      name: "Suzuri",
      tagline: "Inkstone scratchpad for ephemeral prompt drafts and diff notes.",
      status: "planned",
      featured: false,
      order: 99,
      swatch: "pink",
      platforms: ["macos", "cli"],
      techStack: ["Rust", "AppKit"],
      illustration: {
        kind: "ink",
        alt: "Isometric inkstone blueprint diagram",
      },
      description: [
        "Suzuri keeps local scratch prompts and terminal snippets in a plain-text inkstone tray.",
      ],
      features: [
        {
          title: "Scratch tray",
          detail: "Quick keyboard capture without cloud sync.",
        },
        {
          title: "Diff notes",
          detail: "Side-by-side markdown and patch scratchpad.",
        },
      ],
      install: {
        label: "Build from source",
        command: "cargo install --locked suzuri",
      },
      links: {},
      milestones: [
        {
          title: "Core tray capture",
          state: "done",
          target: "2026 Q1",
        },
        {
          title: "Clipboard diff ring",
          state: "active",
          target: "2026 Q2",
        },
      ],
      changelog: [
        {
          version: "0.0.1",
          date: "2026-04-01",
          summary: "Initial inkstone prototype.",
        },
      ],
    };
    fs.writeFileSync(
      path.join(tmpDir, "suzuri.json"),
      JSON.stringify(fifthManifest, null, 2),
      "utf8",
    );

    dropInApps = loadApps(tmpDir);
    dropInLookup = appBySlug("suzuri", tmpDir);

    // Verify duplicate slug detection in directory loader
    const dupDir = fs.mkdtempSync(path.join(os.tmpdir(), "otohime-qa-t1882-dup-"));
    try {
      const bentoRaw = JSON.parse(
        fs.readFileSync(path.join(CONTENT_APPS_DIR, "bento.json"), "utf8"),
      );
      fs.writeFileSync(path.join(dupDir, "bento.json"), JSON.stringify(bentoRaw), "utf8");
      try {
        // parseAppManifest rejects filename/slug mismatch, and loadApps rejects any invalid manifest
        fs.writeFileSync(path.join(dupDir, "other.json"), JSON.stringify(bentoRaw), "utf8");
        loadApps(dupDir);
      } catch (err) {
        if (err instanceof AppManifestValidationError) {
          duplicateSlugRejected = true;
        }
      }
    } finally {
      fs.rmSync(dupDir, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  let invalidManifestRejected = false;
  try {
    validateAppManifest(
      {
        slug: "bad-app",
        name: "Bad",
        tagline: "Bad manifest",
        status: "building",
        platforms: ["macos"],
        techStack: ["Swift"],
        illustration: { kind: "ink", alt: "alt" },
        description: ["desc"],
        features: [{ title: "f", detail: "d" }],
        install: { label: "l", command: "c" },
        links: { repo: "javascript:alert(1)" },
        milestones: [{ title: "m", state: "done" }],
        changelog: [{ version: "0.1.0", date: "2026-04-01", summary: "s" }],
      },
      "bad-app.json",
    );
  } catch (err) {
    if (err instanceof AppManifestValidationError) {
      invalidManifestRejected = true;
    }
  }

  const termState: TerminalState = {
    theme: "light",
    sound: false,
    season: "auto",
    stamps: [],
    appearance: { printRun: "house", lab: null },
  };
  const replyApps = run("apps", termState);
  const replyGoApps = run("go apps", termState);
  const foundPlace = findPlace("apps");
  const terminalAppsNav =
    replyApps.effect?.kind === "go" ? replyApps.effect.href : null;
  const terminalGoAppsNav =
    replyGoApps.effect?.kind === "go" &&
    foundPlace &&
    !Array.isArray(foundPlace) &&
    foundPlace.href === "/apps"
      ? replyGoApps.effect.href
      : null;

  return {
    schemaExists,
    apps,
    dropInApps,
    dropInLookup,
    unknownLookup,
    invalidManifestRejected,
    duplicateSlugRejected,
    publicPages: PUBLIC_PAGES,
    consoleMenu: CONSOLE_MENU,
    consoleLastBaseline: menuBaseline(CONSOLE_MENU.length - 1),
    commandNames: PLACES.map((p) => p.name),
    terminalAppsNav,
    terminalGoAppsNav,
  };
}

function verifyDataAndNavContract(obs: DataAndNavObservation): void {
  assert.equal(obs.schemaExists, true, "content/apps/_schema.json must exist");

  // 1. Four initial app manifests: Bento, Niwa, Kakeibo, Shiki
  assert.deepEqual(
    obs.apps.map((a) => a.slug),
    ["bento", "niwa", "kakeibo", "shiki"],
    "loadApps() must return bento, niwa, kakeibo, shiki in deterministic order",
  );
  assert.deepEqual(
    obs.apps.map((a) => a.name),
    ["Bento", "Niwa", "Kakeibo", "Shiki"],
    "App names must match Bento, Niwa, Kakeibo, Shiki",
  );

  const expectedMeta: Record<
    string,
    {
      platforms: string[];
      motif: string;
      swatch: string;
      hasRepo: boolean;
      hasHomebrewCask?: string;
    }
  > = {
    bento: {
      platforms: ["macos", "cli"],
      motif: "bento-box",
      swatch: "coral",
      hasRepo: true,
      hasHomebrewCask: "agent-bento",
    },
    niwa: {
      platforms: ["macos", "cli", "tui"],
      motif: "bonsai-garden",
      swatch: "mint",
      hasRepo: false,
    },
    kakeibo: {
      platforms: ["cli"],
      motif: "ledger-book",
      swatch: "yellow",
      hasRepo: false,
    },
    shiki: {
      platforms: ["cli"],
      motif: "sun-dial",
      swatch: "blue",
      hasRepo: false,
    },
  };

  for (const app of obs.apps) {
    assert.equal(app.status, "building", `${app.slug} must have status="building"`);
    assert.equal(app.featured, true, `${app.slug} must have featured=true`);
    assert.ok(APP_SWATCHES.includes(app.swatch), `${app.slug} swatch must be valid`);
    assert.ok(APP_STATUSES.includes(app.status), `${app.slug} status must be valid`);
    for (const p of app.platforms) {
      assert.ok(APP_PLATFORMS.includes(p), `${app.slug} platform ${p} must be valid`);
      assert.ok(PLATFORM_META[p].label.length > 0, `PLATFORM_META[${p}] must have label`);
    }

    const exp = expectedMeta[app.slug];
    assert.ok(exp, `Expected metadata configured for ${app.slug}`);
    assert.deepEqual(app.platforms, exp.platforms, `${app.slug} platforms must match contract`);
    assert.equal(app.swatch, exp.swatch, `${app.slug} swatch must match contract`);
    assert.equal(app.illustration.kind, "ink", `${app.slug} illustration kind must be ink`);
    if (app.illustration.kind === "ink") {
      assert.equal(app.illustration.motif, exp.motif, `${app.slug} motif must match contract`);
      assert.ok(
        APP_MOTIFS.includes(app.illustration.motif ?? "blueprint"),
        `${app.slug} motif must be in APP_MOTIFS`,
      );
    }

    // Verify carved hanko seal generation
    const sealChoice = appSealChoice(app);
    assert.equal(sealChoice.name, STATUS_META[app.status].seal, `${app.slug} seal kanji`);
    const model = sealModel(sealChoice);
    assert.ok(model.edge.startsWith("M"), `${app.slug} hanko seal edge path must be valid SVG path`);
    assert.ok(model.glyphs.length >= 1, `${app.slug} hanko seal must produce carved glyphs`);
    assert.ok(model.chips.length >= 1, `${app.slug} hanko seal must produce distress chips`);

    // Verify description, features, install snippet, milestones, dated changelog
    assert.ok(app.description.length >= 2, `${app.slug} must have multi-paragraph description`);
    assert.ok(app.features.length >= 3, `${app.slug} must have at least 3 key features`);
    assert.ok(app.install.command.length > 0, `${app.slug} must have copyable install command`);
    assert.ok(app.milestones.length >= 3, `${app.slug} must have roadmap milestones`);
    assert.ok(app.changelog.length >= 1, `${app.slug} must have dated changelog entries`);
    for (const entry of app.changelog) {
      assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/, `${app.slug} changelog date must be ISO`);
    }

    // Verify repo / Homebrew / zero-backend follow links
    const follow = resolveFollowAction(app);
    if (exp.hasRepo) {
      assert.equal(app.links.repo, "https://github.com/quiinthieu/bento");
      assert.equal(app.links.homebrew?.cask, exp.hasHomebrewCask);
      assert.equal(follow.primary.label, "Watch on GitHub");
      assert.equal(follow.primary.href, "https://github.com/quiinthieu/bento");
    } else {
      assert.equal(app.links.repo, undefined, `${app.slug} must omit unverified repo URL`);
      assert.equal(follow.primary.label, "Notify me by email");
      assert.match(follow.primary.href, /^mailto:hello@otohime\.dev\?subject=/);
      assert.equal(follow.secondary?.href, "https://x.com/otohime73");
    }
  }

  // 2. Filter and sort helpers
  assert.deepEqual(availablePlatforms(obs.apps), ["macos", "cli", "tui"]);
  assert.deepEqual(
    filterApps(obs.apps, { platform: "tui", status: "all" }).map((a) => a.slug),
    ["niwa"],
  );
  assert.deepEqual(
    filterApps(obs.apps, { platform: "all", status: "released" }).map((a) => a.slug),
    [],
  );

  // 3. Zero-code JSON drop-in discovery & validation
  assert.equal(obs.dropInApps.length, 5, "Dropping 5th JSON file must populate loadApps() with 5 apps");
  assert.ok(
    obs.dropInApps.some((a) => a.slug === "suzuri"),
    "Dropped-in suzuri.json must appear in loadApps() without code changes",
  );
  assert.equal(obs.dropInLookup?.slug, "suzuri", "appBySlug('suzuri') must resolve dropped-in manifest");
  assert.ok(hashAppSlug("suzuri") > 0, "hashAppSlug must produce deterministic seed for dropped-in slug");
  assert.equal(obs.unknownLookup, null, "appBySlug must return null for unknown slugs");
  assert.equal(obs.invalidManifestRejected, true, "parseAppManifest must reject unsafe/invalid manifests");
  assert.equal(obs.duplicateSlugRejected, true, "loadApps must reject mismatched/duplicate slugs");

  // 4. Navigation & CONSOLE_MENU 7-item invariant
  const appsPageIndex = obs.publicPages.findIndex((p) => p.href === "/apps" && p.label === "Apps");
  const sketchesPageIndex = obs.publicPages.findIndex((p) => p.href === "/sketches");
  assert.ok(appsPageIndex !== -1, "PUBLIC_PAGES must include { href: '/apps', label: 'Apps' }");
  assert.equal(
    appsPageIndex,
    sketchesPageIndex + 1,
    "PUBLIC_PAGES must place '/apps' immediately after '/sketches'",
  );

  assert.equal(obs.consoleMenu.length, 7, "CONSOLE_MENU must stay at exactly 7 items");
  assert.equal(
    obs.consoleMenu.some((item) => item.href === "/apps"),
    false,
    "CONSOLE_MENU must not include /apps (7-row LCD invariant)",
  );
  assert.equal(obs.consoleLastBaseline, -105, "CONSOLE_MENU index 6 baseline must remain -105");

  // 5. Pocket Terminal commands (`apps` and `go apps`)
  assert.ok(obs.commandNames.includes("apps"), "COMMAND_NAMES must include 'apps'");
  assert.equal(obs.terminalAppsNav, "/apps", "Pocket Terminal 'apps' command must navigate to /apps");
  assert.equal(
    obs.terminalGoAppsNav,
    "/apps",
    "Pocket Terminal 'go apps' command must navigate to /apps",
  );

  // Also ensure sortApps is deterministic
  const reversed = [...obs.apps].reverse();
  assert.deepEqual(
    sortApps(reversed).map((a) => a.slug),
    ["bento", "niwa", "kakeibo", "shiki"],
  );
}

const isNegativeControl = process.argv.includes("--negative-control");
const observation = collectObservation();

if (isNegativeControl) {
  // Mutate concrete observations (add 8th item to CONSOLE_MENU and break drop-in discovery)
  // and pass into the exact same oracle function so it must detect the violation and fail.
  const mutated: DataAndNavObservation = {
    ...observation,
    consoleMenu: [...observation.consoleMenu, { href: "/apps", label: "Apps" }],
    dropInApps: observation.apps,
  };
  verifyDataAndNavContract(mutated);
  console.error("ERROR: oracle failed to detect negative control mutation");
  process.exit(0);
} else {
  verifyDataAndNavContract(observation);
  console.log(
    JSON.stringify({
      ok: true,
      case: "t1882-data-nav-and-dropin-contract",
      apps: observation.apps.map((a) => a.slug),
      dropInCount: observation.dropInApps.length,
      consoleMenuLength: observation.consoleMenu.length,
      terminalAppsNav: observation.terminalAppsNav,
      terminalGoAppsNav: observation.terminalGoAppsNav,
    }),
  );
}
