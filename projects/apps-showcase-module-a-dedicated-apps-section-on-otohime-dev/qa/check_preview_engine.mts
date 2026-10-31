import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadApps } from "../../../lib/apps-server.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const PREVIEW_MODULE_PATH = path.join(REPO_ROOT, "lib", "apps-preview.ts");
const PREVIEW_TEST_PATH = path.join(REPO_ROOT, "lib", "apps-preview.test.ts");
const APPS_CSS_PATH = path.join(REPO_ROOT, "app", "(site)", "(app)", "apps", "apps.css");
const PLAN_BASE_SHA = "48043c85457bbd93ed81de44d4e588f9734130fb";

interface PreviewEngineObservation {
  moduleExists: boolean;
  moduleLoaded: boolean;
  moduleHasNoDomOrReactImports: boolean;
  niwaStageCount: number;
  niwaStaticStage: number;
  niwaAllStagesHaveArtAndMenuBar: boolean;
  niwaClampingWorks: boolean;
  shikiSeasons: string[];
  shikiPhaseNames: string[];
  shikiStaticProgress: number;
  blackWhiteContrastRatio: number;
  identicalContrastRatio: number;
  shikiSampleCount: number;
  shikiMinReportedContrast: number;
  shikiMinIndependentContrast: number;
  shikiBoundaryClampingWorks: boolean;
  framesResolvedBento: boolean;
  framesResolvedKakeibo: boolean;
  framesResolvedCustomSingle: boolean;
  unitTestFileExists: boolean;
  unitTestExitCode: number;
  appsCssEndsWithReducedMotion: boolean;
  forbiddenFilesUnmodified: boolean;
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return null;
}

function independentRelativeLuminance(hex: string): number {
  const rgb = parseHexRgb(hex);
  if (!rgb) return NaN;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function independentWcagContrast(fgHex: string, bgHex: string): number {
  const l1 = independentRelativeLuminance(fgHex);
  const l2 = independentRelativeLuminance(bgHex);
  if (Number.isNaN(l1) || Number.isNaN(l2)) return 0;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function checkAppsCssFinalBlockReducedMotion(): boolean {
  if (!fs.existsSync(APPS_CSS_PATH)) return false;
  const css = fs.readFileSync(APPS_CSS_PATH, "utf8").trim();
  const lastMediaIdx = css.lastIndexOf("@media");
  if (lastMediaIdx === -1) return false;
  const tail = css.slice(lastMediaIdx);
  return tail.startsWith("@media (prefers-reduced-motion: reduce)") && tail.endsWith("}");
}

function checkForbiddenFilesUnmodified(): boolean {
  const res = spawnSync(
    "git",
    ["diff", "--name-only", PLAN_BASE_SHA, "--", "app/(site)/globals.css", "package.json"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  return res.status === 0 && res.stdout.trim() === "";
}

async function collectPreviewEngineObservation(): Promise<PreviewEngineObservation> {
  const moduleExists = fs.existsSync(PREVIEW_MODULE_PATH);
  const unitTestFileExists = fs.existsSync(PREVIEW_TEST_PATH);
  const appsCssEndsWithReducedMotion = checkAppsCssFinalBlockReducedMotion();
  const forbiddenFilesUnmodified = checkForbiddenFilesUnmodified();

  let unitTestExitCode = 1;
  if (unitTestFileExists) {
    const res = spawnSync(
      "node",
      [
        "--experimental-strip-types",
        "--disable-warning=ExperimentalWarning",
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "--test",
        "lib/apps-preview.test.ts",
      ],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, TMPDIR: "/tmp" },
        encoding: "utf8",
      },
    );
    unitTestExitCode = res.status ?? 1;
  }

  if (!moduleExists) {
    return {
      moduleExists: false,
      moduleLoaded: false,
      moduleHasNoDomOrReactImports: false,
      niwaStageCount: 0,
      niwaStaticStage: -1,
      niwaAllStagesHaveArtAndMenuBar: false,
      niwaClampingWorks: false,
      shikiSeasons: [],
      shikiPhaseNames: [],
      shikiStaticProgress: -1,
      blackWhiteContrastRatio: 0,
      identicalContrastRatio: 0,
      shikiSampleCount: 0,
      shikiMinReportedContrast: 0,
      shikiMinIndependentContrast: 0,
      shikiBoundaryClampingWorks: false,
      framesResolvedBento: false,
      framesResolvedKakeibo: false,
      framesResolvedCustomSingle: false,
      unitTestFileExists,
      unitTestExitCode,
      appsCssEndsWithReducedMotion,
      forbiddenFilesUnmodified,
    };
  }

  const rawSource = fs.readFileSync(PREVIEW_MODULE_PATH, "utf8");
  const moduleHasNoDomOrReactImports =
    !/from\s+["']react["']/.test(rawSource) &&
    !/\bwindow\./.test(rawSource) &&
    !/\bdocument\./.test(rawSource);

  const mod = (await import(pathToFileURL(PREVIEW_MODULE_PATH).href)) as Record<string, unknown>;

  const niwaStages = Array.isArray(mod.NIWA_STAGES) ? mod.NIWA_STAGES : [];
  const niwaStaticStage = typeof mod.NIWA_STATIC_STAGE === "number" ? mod.NIWA_STATIC_STAGE : -1;
  const niwaStageAt =
    typeof mod.niwaStageAt === "function"
      ? (mod.niwaStageAt as (index: number) => Record<string, unknown>)
      : null;

  const niwaAllStagesHaveArtAndMenuBar =
    niwaStages.length === 5 &&
    niwaStages.every((stage: Record<string, unknown>) => {
      const lines = Array.isArray(stage?.lines) ? stage.lines : [];
      const menuBar = String(
        stage?.menuBar ?? stage?.menuBarText ?? stage?.status ?? stage?.header ?? "",
      );
      return (
        lines.length >= 4 &&
        lines.every((l) => typeof l === "string" && l.length > 0) &&
        menuBar.toLowerCase().includes("niwa")
      );
    });

  let niwaClampingWorks = false;
  if (niwaStageAt && niwaStages.length === 5) {
    const first = niwaStageAt(-5);
    const last = niwaStageAt(99);
    const staticStage = niwaStageAt(niwaStaticStage);
    niwaClampingWorks =
      Boolean(first) &&
      Boolean(last) &&
      Boolean(staticStage) &&
      first === niwaStages[0] &&
      last === niwaStages[4];
  }

  const shikiSeasons = Array.isArray(mod.SHIKI_SEASONS) ? mod.SHIKI_SEASONS.map(String) : [];
  const rawPhases = Array.isArray(mod.SHIKI_PHASES) ? mod.SHIKI_PHASES : [];
  const shikiPhaseNames = rawPhases.map((p: unknown) =>
    typeof p === "string"
      ? p
      : typeof p === "object" && p !== null
        ? String((p as Record<string, unknown>).label ?? (p as Record<string, unknown>).name ?? (p as Record<string, unknown>).id ?? "")
        : "",
  );
  const shikiStaticProgress =
    typeof mod.SHIKI_STATIC_PROGRESS === "number" ? mod.SHIKI_STATIC_PROGRESS : -1;

  const wcagContrastRatio =
    typeof mod.wcagContrastRatio === "function"
      ? (mod.wcagContrastRatio as (fg: string, bg: string) => number)
      : null;
  const shikiPaletteAt =
    typeof mod.shikiPaletteAt === "function"
      ? (mod.shikiPaletteAt as (progress01: number, season: string) => Record<string, unknown>)
      : null;

  const blackWhiteContrastRatio = wcagContrastRatio ? wcagContrastRatio("#000000", "#ffffff") : 0;
  const identicalContrastRatio = wcagContrastRatio ? wcagContrastRatio("#231e16", "#231e16") : 0;

  let shikiSampleCount = 0;
  let shikiMinReportedContrast = Infinity;
  let shikiMinIndependentContrast = Infinity;
  let shikiBoundaryClampingWorks = false;

  if (shikiPaletteAt && shikiSeasons.length === 4) {
    for (const season of shikiSeasons) {
      for (let i = 0; i <= 200; i += 1) {
        const t = i / 200;
        const pal = shikiPaletteAt(t, season);
        const reported = Number(pal?.contrastRatio ?? 0);
        const fg = String(pal?.fg ?? pal?.foreground ?? pal?.text ?? "");
        const bg = String(pal?.bg ?? pal?.background ?? pal?.paper ?? "");
        const indep = independentWcagContrast(fg, bg);
        shikiSampleCount += 1;
        if (reported < shikiMinReportedContrast) shikiMinReportedContrast = reported;
        if (indep < shikiMinIndependentContrast) shikiMinIndependentContrast = indep;
      }
    }

    const neg = shikiPaletteAt(-0.5, "spring");
    const zero = shikiPaletteAt(0, "spring");
    const over = shikiPaletteAt(1.5, "winter");
    const one = shikiPaletteAt(1, "winter");
    shikiBoundaryClampingWorks =
      Number(neg?.contrastRatio ?? 0) >= 7.0 &&
      Number(over?.contrastRatio ?? 0) >= 7.0 &&
      String(neg?.bg ?? neg?.background ?? "") === String(zero?.bg ?? zero?.background ?? "") &&
      String(over?.bg ?? over?.background ?? "") === String(one?.bg ?? one?.background ?? "");
  }
  if (!Number.isFinite(shikiMinReportedContrast)) shikiMinReportedContrast = 0;
  if (!Number.isFinite(shikiMinIndependentContrast)) shikiMinIndependentContrast = 0;

  const resolveFramePreview =
    typeof mod.resolveFramePreview === "function"
      ? (mod.resolveFramePreview as (
          preview: unknown,
          frameIndex?: number,
        ) => Record<string, unknown>)
      : null;

  let framesResolvedBento = false;
  let framesResolvedKakeibo = false;
  let framesResolvedCustomSingle = false;

  if (resolveFramePreview) {
    const apps = loadApps();
    const bentoPreview = apps.find((a) => a.slug === "bento")?.preview;
    const kakeiboPreview = apps.find((a) => a.slug === "kakeibo")?.preview;

    if (bentoPreview && bentoPreview.kind === "frames") {
      const f0 = resolveFramePreview(bentoPreview, 0);
      const fClamp = resolveFramePreview(bentoPreview, 99);
      const lines0 = Array.isArray(f0?.lines)
        ? f0.lines
        : Array.isArray((f0?.frame as Record<string, unknown>)?.lines)
          ? ((f0.frame as Record<string, unknown>).lines as unknown[])
          : [];
      const linesClamp = Array.isArray(fClamp?.lines)
        ? fClamp.lines
        : Array.isArray((fClamp?.frame as Record<string, unknown>)?.lines)
          ? ((fClamp.frame as Record<string, unknown>).lines as unknown[])
          : [];
      framesResolvedBento = lines0.length >= 3 && linesClamp.length >= 3;
    }

    if (kakeiboPreview && kakeiboPreview.kind === "frames") {
      const f0 = resolveFramePreview(kakeiboPreview, 0);
      const lines0 = Array.isArray(f0?.lines)
        ? f0.lines
        : Array.isArray((f0?.frame as Record<string, unknown>)?.lines)
          ? ((f0.frame as Record<string, unknown>).lines as unknown[])
          : [];
      framesResolvedKakeibo = lines0.length >= 3;
    }

    const customPreview = {
      kind: "frames" as const,
      title: "custom tool",
      command: "custom-cli --status",
      alt: "Custom CLI output",
      frames: [{ label: "Single frame", lines: ["custom-cli: ready", "0 warnings"] }],
    };
    const customResolved = resolveFramePreview(customPreview, -3);
    const customLines = Array.isArray(customResolved?.lines)
      ? customResolved.lines
      : Array.isArray((customResolved?.frame as Record<string, unknown>)?.lines)
        ? ((customResolved.frame as Record<string, unknown>).lines as unknown[])
        : [];
    framesResolvedCustomSingle = customLines.length === 2;
  }

  return {
    moduleExists,
    moduleLoaded: true,
    moduleHasNoDomOrReactImports,
    niwaStageCount: niwaStages.length,
    niwaStaticStage,
    niwaAllStagesHaveArtAndMenuBar,
    niwaClampingWorks,
    shikiSeasons,
    shikiPhaseNames,
    shikiStaticProgress,
    blackWhiteContrastRatio,
    identicalContrastRatio,
    shikiSampleCount,
    shikiMinReportedContrast,
    shikiMinIndependentContrast,
    shikiBoundaryClampingWorks,
    framesResolvedBento,
    framesResolvedKakeibo,
    framesResolvedCustomSingle,
    unitTestFileExists,
    unitTestExitCode,
    appsCssEndsWithReducedMotion,
    forbiddenFilesUnmodified,
  };
}

function verifyPreviewEngineContract(obs: PreviewEngineObservation): void {
  assert.equal(obs.moduleExists, true, "lib/apps-preview.ts must exist");
  assert.equal(obs.moduleLoaded, true, "lib/apps-preview.ts must load cleanly");
  assert.equal(
    obs.moduleHasNoDomOrReactImports,
    true,
    "lib/apps-preview.ts must be pure with zero DOM/React imports",
  );

  // Niwa 5-stage ASCII garden + macOS menu bar header + static stage 3
  assert.equal(obs.niwaStageCount, 5, "NIWA_STAGES must define exactly 5 growth stages");
  assert.equal(obs.niwaStaticStage, 3, "NIWA_STATIC_STAGE must equal 3 for SSR/reduced-motion");
  assert.equal(
    obs.niwaAllStagesHaveArtAndMenuBar,
    true,
    "Every Niwa stage must include multi-line ASCII art and a simulated macOS menu bar header",
  );
  assert.equal(obs.niwaClampingWorks, true, "niwaStageAt(index) must clamp out-of-range indices");

  // Shiki 4 seasons, 4 solar phases, static progress 0.68, and WCAG >= 7.0 across [0, 1]
  assert.deepEqual(
    obs.shikiSeasons,
    ["spring", "summer", "autumn", "winter"],
    "SHIKI_SEASONS must cover spring, summer, autumn, winter",
  );
  for (const expectedPhase of ["Dawn", "Noon", "Sunset", "Midnight"]) {
    assert.ok(
      obs.shikiPhaseNames.some((p) => p.toLowerCase() === expectedPhase.toLowerCase()),
      `SHIKI_PHASES must include ${expectedPhase}`,
    );
  }
  assert.equal(
    obs.shikiStaticProgress,
    0.68,
    "SHIKI_STATIC_PROGRESS must equal 0.68 Sunset pose for SSR/reduced-motion",
  );
  assert.ok(
    obs.blackWhiteContrastRatio >= 20.9 && obs.blackWhiteContrastRatio <= 21.1,
    `wcagContrastRatio('#000000', '#ffffff') must be ~21:1 (got ${obs.blackWhiteContrastRatio})`,
  );
  assert.equal(
    obs.identicalContrastRatio,
    1,
    `wcagContrastRatio on identical colours must equal 1:1 (got ${obs.identicalContrastRatio})`,
  );
  assert.ok(
    obs.shikiSampleCount >= 800,
    "shikiPaletteAt must be sampled across >= 200 points x 4 seasons",
  );
  assert.ok(
    obs.shikiMinReportedContrast >= 7.0,
    `shikiPaletteAt reported contrastRatio must stay >= 7.0 across [0, 1] x 4 seasons (min=${obs.shikiMinReportedContrast})`,
  );
  assert.ok(
    obs.shikiMinIndependentContrast >= 7.0,
    `Independent WCAG luminance check on shikiPaletteAt(t, season) fg/bg must stay >= 7.0 across [0, 1] x 4 seasons (min=${obs.shikiMinIndependentContrast})`,
  );
  assert.equal(
    obs.shikiBoundaryClampingWorks,
    true,
    "shikiPaletteAt must clamp out-of-range progress values (< 0 and > 1) safely with contrast >= 7.0",
  );

  // Declarative frames stepper for Bento, Kakeibo, and custom JSON manifests
  assert.equal(
    obs.framesResolvedBento,
    true,
    "resolveFramePreview must resolve Bento frames and clamp out-of-bounds indices",
  );
  assert.equal(
    obs.framesResolvedKakeibo,
    true,
    "resolveFramePreview must resolve Kakeibo frames",
  );
  assert.equal(
    obs.framesResolvedCustomSingle,
    true,
    "resolveFramePreview must handle custom single-frame JSON manifests",
  );

  // Unit tests & stylesheet/repo hygiene invariants
  assert.equal(obs.unitTestFileExists, true, "lib/apps-preview.test.ts must exist");
  assert.equal(obs.unitTestExitCode, 0, "lib/apps-preview.test.ts must pass (exit 0)");
  assert.equal(
    obs.appsCssEndsWithReducedMotion,
    true,
    "app/(site)/(app)/apps/apps.css must keep @media (prefers-reduced-motion: reduce) as its final block",
  );
  assert.equal(
    obs.forbiddenFilesUnmodified,
    true,
    "app/(site)/globals.css and package.json must remain unmodified",
  );
}

const isNegativeControl = process.argv.includes("--negative-control");
const liveObservation = await collectPreviewEngineObservation();

if (isNegativeControl) {
  const baselineValid: PreviewEngineObservation = liveObservation.moduleLoaded
    ? liveObservation
    : {
        moduleExists: true,
        moduleLoaded: true,
        moduleHasNoDomOrReactImports: true,
        niwaStageCount: 5,
        niwaStaticStage: 3,
        niwaAllStagesHaveArtAndMenuBar: true,
        niwaClampingWorks: true,
        shikiSeasons: ["spring", "summer", "autumn", "winter"],
        shikiPhaseNames: ["Dawn", "Noon", "Sunset", "Midnight"],
        shikiStaticProgress: 0.68,
        blackWhiteContrastRatio: 21,
        identicalContrastRatio: 1,
        shikiSampleCount: 804,
        shikiMinReportedContrast: 9.4,
        shikiMinIndependentContrast: 9.4,
        shikiBoundaryClampingWorks: true,
        framesResolvedBento: true,
        framesResolvedKakeibo: true,
        framesResolvedCustomSingle: true,
        unitTestFileExists: true,
        unitTestExitCode: 0,
        appsCssEndsWithReducedMotion: true,
        forbiddenFilesUnmodified: true,
      };

  // Mutate concrete preview contrast and stage invariants and verify the same oracle rejects them
  const mutated: PreviewEngineObservation = {
    ...baselineValid,
    shikiMinReportedContrast: 4.2,
    shikiMinIndependentContrast: 4.2,
    niwaStageCount: 3,
    identicalContrastRatio: 8.5,
  };
  verifyPreviewEngineContract(mutated);
  console.error("ERROR: verifyPreviewEngineContract failed to reject mutated negative control");
  process.exit(0);
} else {
  verifyPreviewEngineContract(liveObservation);
  console.log(
    JSON.stringify({
      ok: true,
      case: "t1883-preview-engine-and-contrast-contract",
      niwaStageCount: liveObservation.niwaStageCount,
      shikiSampleCount: liveObservation.shikiSampleCount,
      shikiMinReportedContrast: liveObservation.shikiMinReportedContrast,
      shikiMinIndependentContrast: liveObservation.shikiMinIndependentContrast,
    }),
  );
}
