import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import {
  DEFAULT_PROMPTS_REL_PATH,
  parsePromptPack,
  REQUIRED_MASTER_FILENAMES,
  validatePortraitManifest,
} from "./sketches.ts";
import {
  buildHandoffKit,
  createPortraitHandoff,
  HANDOFF_REVIEW_CHECKLIST,
  type HandoffManifest,
  parseConceptPromptMarkdown,
  renderConceptPromptMarkdown,
  validateHandoffKit,
} from "./sketches-handoff.ts";
import {
  checkHandoffDirectory,
  exportHandoffDirectory,
  runHandoffCli,
} from "../scripts/sketches-handoff.ts";

const ROOT = resolve(import.meta.dirname, "..");
const PROMPTS_PATH = resolve(ROOT, DEFAULT_PROMPTS_REL_PATH);

function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

test("valid ten-concept round trip exports and checks complete prompts and deterministic manifest", () => {
  const work = mkdtempSync(join(tmpdir(), "sketches-handoff-roundtrip-"));
  try {
    const outDir = join(work, "production-kit");
    const exportLogs: string[] = [];
    const exportErrors: string[] = [];

    const exportCode = runHandoffCli(["export", "--output-dir", outDir], {
      cwd: ROOT,
      stdout: (msg) => exportLogs.push(msg),
      stderr: (msg) => exportErrors.push(msg),
    });
    assert.equal(exportCode, 0, `export failed: ${exportErrors.join("\n")}`);
    assert.equal(exportErrors.length, 0);

    const exportSummary = JSON.parse(exportLogs.join("\n")) as Record<string, unknown>;
    assert.equal(exportSummary.ok, true);
    assert.equal(exportSummary.command, "export");
    assert.equal(exportSummary.status, "production_required");
    assert.equal(exportSummary.conceptCount, 10);
    assert.equal(exportSummary.paintingsDelivered, 0);
    assert.equal(exportSummary.galleryPortraitsActivated, 0);

    const promptPack = parsePromptPack(readFileSync(PROMPTS_PATH, "utf8"));
    const manifestPath = join(outDir, "manifest.json");
    assert.ok(existsSync(manifestPath), "manifest.json must exist");

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as HandoffManifest;
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.status, "production_required");
    assert.equal(manifest.sourcePromptsPath, DEFAULT_PROMPTS_REL_PATH);
    assert.equal(manifest.promptPackSha256, promptPack.promptPackSha256);
    assert.equal(manifest.styleReferenceUrl, promptPack.styleReferenceUrl);
    assert.equal(manifest.referenceUrl, promptPack.originalImageUrl);
    assert.equal(manifest.referenceUrlSha256, promptPack.referenceSha256);
    assert.equal(manifest.deliveryStatus.paintingsDelivered, 0);
    assert.equal(manifest.deliveryStatus.paintingsRequired, 10);
    assert.equal(manifest.deliveryStatus.galleryPortraitsActivated, 0);
    assert.equal(manifest.generationSettings.status, "unverified_guidance");
    assert.equal(manifest.generationSettings.executed, false);
    assert.equal(manifest.artifactRequirements.derivative.width, 1152);
    assert.equal(manifest.artifactRequirements.derivative.height, 1536);
    assert.equal(manifest.artifactRequirements.derivative.maxBytes, 600_000);
    assert.equal(manifest.reviewChecklist.length, 10);
    assert.deepEqual(manifest.reviewChecklist, [...HANDOFF_REVIEW_CHECKLIST]);
    assert.equal(manifest.concepts.length, 10);

    for (let i = 0; i < promptPack.concepts.length; i++) {
      const expected = promptPack.concepts[i];
      const row = manifest.concepts[i];
      const expectedPromptFile = expected.masterFilename.replace(/\.png$/, ".md");
      assert.equal(row.index, i + 1);
      assert.equal(row.conceptId, expected.conceptId);
      assert.equal(row.title, expected.title);
      assert.equal(row.caption, expected.caption);
      assert.equal(row.masterFilename, expected.masterFilename);
      assert.equal(row.derivativeFilename, expected.derivativeFilename);
      assert.equal(row.promptFile, expectedPromptFile);
      assert.equal(row.fullPromptSha256, expected.promptSha256);

      const promptFilePath = join(outDir, row.promptFile);
      assert.ok(existsSync(promptFilePath), `missing prompt file ${row.promptFile}`);
      const rawPromptMd = readFileSync(promptFilePath, "utf8");
      const actualBytes = Buffer.byteLength(rawPromptMd, "utf8");
      const actualSha = sha256Hex(Buffer.from(rawPromptMd, "utf8"));
      assert.equal(row.promptFileByteLength, actualBytes);
      assert.equal(row.promptFileSha256, actualSha);

      const parsedMd = parseConceptPromptMarkdown(rawPromptMd);
      assert.equal(parsedMd.conceptId, expected.conceptId);
      assert.equal(parsedMd.title, expected.title);
      assert.equal(parsedMd.caption, expected.caption);
      assert.equal(parsedMd.masterFilename, expected.masterFilename);
      assert.equal(parsedMd.derivativeFilename, expected.derivativeFilename);
      assert.equal(parsedMd.fullPrompt, expected.fullPrompt);
      assert.equal(parsedMd.sharedStyle, promptPack.sharedStyle);
      assert.equal(parsedMd.composition, expected.composition);
      assert.match(rawPromptMd, /3:4/);
      assert.match(rawPromptMd, />=1536x2048/);
      assert.match(rawPromptMd, /never upscale/i);
      assert.match(rawPromptMd, /report.*lower native.*honestly/i);
    }

    // Check Reader originality note in 01_Quiet_Reader.md
    const readerMd = readFileSync(join(outDir, "01_Quiet_Reader.md"), "utf8");
    assert.match(readerMd, /Seated, three-quarter view from the front/);

    // Run check CLI on the exported directory
    const checkLogs: string[] = [];
    const checkErrors: string[] = [];
    const checkCode = runHandoffCli(["check", "--input-dir", outDir], {
      cwd: ROOT,
      stdout: (msg) => checkLogs.push(msg),
      stderr: (msg) => checkErrors.push(msg),
    });
    assert.equal(checkCode, 0, `check failed: ${checkErrors.join("\n")}`);
    const checkSummary = JSON.parse(checkLogs.join("\n")) as Record<string, unknown>;
    assert.equal(checkSummary.ok, true);
    assert.equal(checkSummary.command, "check");
    assert.equal(checkSummary.status, "production_required");
    assert.equal(checkSummary.verifiedPromptFiles, 10);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("deterministic repeated exports produce byte-identical manifest.json and prompt files", () => {
  const work = mkdtempSync(join(tmpdir(), "sketches-handoff-deterministic-"));
  try {
    const dirA = join(work, "kit-a");
    const dirB = join(work, "kit-b");
    const resA = exportHandoffDirectory({ outputDir: dirA, promptsPath: PROMPTS_PATH });
    const resB = exportHandoffDirectory({ outputDir: dirB, promptsPath: PROMPTS_PATH });
    assert.equal(resA.ok, true);
    assert.equal(resB.ok, true);

    const filesToCompare = [
      "manifest.json",
      ...REQUIRED_MASTER_FILENAMES.map((fn) => fn.replace(/\.png$/, ".md")),
    ];
    for (const filename of filesToCompare) {
      const bytesA = readFileSync(join(dirA, filename));
      const bytesB = readFileSync(join(dirB, filename));
      assert.equal(Buffer.compare(bytesA, bytesB), 0, `${filename} differed across repeated exports`);
      const textA = bytesA.toString("utf8");
      assert.doesNotMatch(textA, new RegExp(work.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("Unicode captions and multi-byte UTF-8 characters record exact Buffer.byteLength rather than UTF-16 length", () => {
  const work = mkdtempSync(join(tmpdir(), "sketches-handoff-unicode-"));
  try {
    const rawPrompts = readFileSync(PROMPTS_PATH, "utf8");
    const unicodePrompts = rawPrompts.replace(
      "| 04_Cafe_Dreamer.png | 16-cafe.jpg | Café | The cup went cold while she was elsewhere. |",
      "| 04_Cafe_Dreamer.png | 16-cafe.jpg | Café | L’après-midi au café — 珈琲と静かな時間。 |",
    );
    const customPromptsPath = join(work, "prompts-unicode.md");
    writeFileSync(customPromptsPath, unicodePrompts, "utf8");

    const kitDir = join(work, "kit");
    const exported = exportHandoffDirectory({ outputDir: kitDir, promptsPath: customPromptsPath });
    assert.equal(exported.ok, true);

    const cafeMd = readFileSync(join(kitDir, "04_Cafe_Dreamer.md"), "utf8");
    const utf8ByteLength = Buffer.byteLength(cafeMd, "utf8");
    const utf16CodeUnits = cafeMd.length;
    assert.ok(utf8ByteLength > utf16CodeUnits, "multi-byte UTF-8 content must have byteLength > string.length");

    const manifest = JSON.parse(readFileSync(join(kitDir, "manifest.json"), "utf8")) as HandoffManifest;
    const cafeRow = manifest.concepts[3];
    assert.equal(cafeRow.caption, "L’après-midi au café — 珈琲と静かな時間。");
    assert.equal(cafeRow.promptFileByteLength, utf8ByteLength);

    const validRes = checkHandoffDirectory({ inputDir: kitDir, promptsPath: customPromptsPath });
    assert.equal(validRes.ok, true);

    // Setting promptFileByteLength to UTF-16 string.length must fail with prompt_mismatch
    manifest.concepts[3].promptFileByteLength = utf16CodeUnits;
    writeFileSync(join(kitDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const badByteLenRes = checkHandoffDirectory({ inputDir: kitDir, promptsPath: customPromptsPath });
    assert.equal(badByteLenRes.ok, false);
    if (!badByteLenRes.ok) {
      assert.equal(badByteLenRes.reason, "prompt_mismatch");
      assert.equal(badByteLenRes.offendingConcept, "04-cafe-dreamer");
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("one-file tamper and coordinated prompt+hash tamper both fail check with prompt_mismatch", () => {
  const work = mkdtempSync(join(tmpdir(), "sketches-handoff-tamper-"));
  try {
    const kitDir = join(work, "kit");
    exportHandoffDirectory({ outputDir: kitDir, promptsPath: PROMPTS_PATH });

    // 1. Tamper 01_Quiet_Reader.md without updating manifest.json
    const readerPath = join(kitDir, "01_Quiet_Reader.md");
    const originalReaderMd = readFileSync(readerPath, "utf8");
    const tamperedReaderMd = originalReaderMd.replace("warm ochre scarf", "neon purple hoodie");
    writeFileSync(readerPath, tamperedReaderMd, "utf8");

    const res1 = checkHandoffDirectory({ inputDir: kitDir, promptsPath: PROMPTS_PATH });
    assert.equal(res1.ok, false);
    if (!res1.ok) {
      assert.equal(res1.reason, "prompt_mismatch");
      assert.equal(res1.offendingConcept, "01-quiet-reader");
      assert.match(res1.offendingPath ?? "", /01_Quiet_Reader\.md/);
    }

    // 2. Coordinated tamper: also recompute promptFileByteLength, promptFileSha256 and fullPromptSha256 in manifest.json
    const manifestPath = join(kitDir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as HandoffManifest;
    manifest.concepts[0].promptFileByteLength = Buffer.byteLength(tamperedReaderMd, "utf8");
    manifest.concepts[0].promptFileSha256 = sha256Hex(Buffer.from(tamperedReaderMd, "utf8"));
    const parsedTampered = parseConceptPromptMarkdown(tamperedReaderMd);
    manifest.concepts[0].fullPromptSha256 = sha256Hex(parsedTampered.fullPrompt);
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const res2 = checkHandoffDirectory({ inputDir: kitDir, promptsPath: PROMPTS_PATH });
    assert.equal(res2.ok, false);
    if (!res2.ok) {
      assert.equal(res2.reason, "prompt_mismatch");
      assert.equal(res2.offendingConcept, "01-quiet-reader");
      assert.match(res2.offendingPath ?? "", /01_Quiet_Reader\.md/);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("missing file and extra file fail check with stable missing_file and extra_file reasons", () => {
  const work = mkdtempSync(join(tmpdir(), "sketches-handoff-files-"));
  try {
    const kitDir = join(work, "kit");
    exportHandoffDirectory({ outputDir: kitDir, promptsPath: PROMPTS_PATH });

    // Extra file in kit directory
    const extraPath = join(kitDir, "11_Extra_Portrait.md");
    writeFileSync(extraPath, "# Extra file\n", "utf8");
    const extraRes = checkHandoffDirectory({ inputDir: kitDir, promptsPath: PROMPTS_PATH });
    assert.equal(extraRes.ok, false);
    if (!extraRes.ok) {
      assert.equal(extraRes.reason, "extra_file");
      assert.match(extraRes.offendingPath ?? "", /11_Extra_Portrait\.md/);
    }
    unlinkSync(extraPath);

    // Missing prompt file
    const rainPath = join(kitDir, "03_Rainy_Afternoon.md");
    unlinkSync(rainPath);
    const missingRes = checkHandoffDirectory({ inputDir: kitDir, promptsPath: PROMPTS_PATH });
    assert.equal(missingRes.ok, false);
    if (!missingRes.ok) {
      assert.equal(missingRes.reason, "missing_file");
      assert.equal(missingRes.offendingConcept, "03-rainy-afternoon");
      assert.match(missingRes.offendingPath ?? "", /03_Rainy_Afternoon\.md/);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("duplicate mapping, metadata mismatch, and changed source pack fail with their exact stable reasons", () => {
  const work = mkdtempSync(join(tmpdir(), "sketches-handoff-meta-"));
  try {
    const kitDir = join(work, "kit");
    exportHandoffDirectory({ outputDir: kitDir, promptsPath: PROMPTS_PATH });
    const manifestPath = join(kitDir, "manifest.json");
    const baseManifestText = readFileSync(manifestPath, "utf8");

    // 1. Duplicate filename mapping
    const dupManifest = JSON.parse(baseManifestText) as HandoffManifest;
    dupManifest.concepts[1].masterFilename = "01_Quiet_Reader.png";
    writeFileSync(manifestPath, `${JSON.stringify(dupManifest, null, 2)}\n`, "utf8");
    const dupRes = checkHandoffDirectory({ inputDir: kitDir, promptsPath: PROMPTS_PATH });
    assert.equal(dupRes.ok, false);
    if (!dupRes.ok) {
      assert.equal(dupRes.reason, "duplicate_mapping");
      assert.equal(dupRes.offendingConcept, "02-flower-girl");
    }

    // 2. Metadata mismatch (altered caption in manifest.json)
    const metaManifest = JSON.parse(baseManifestText) as HandoffManifest;
    metaManifest.concepts[5].caption = "Wrong caption not in prompts.md";
    writeFileSync(manifestPath, `${JSON.stringify(metaManifest, null, 2)}\n`, "utf8");
    const metaRes = checkHandoffDirectory({ inputDir: kitDir, promptsPath: PROMPTS_PATH });
    assert.equal(metaRes.ok, false);
    if (!metaRes.ok) {
      assert.equal(metaRes.reason, "metadata_mismatch");
      assert.equal(metaRes.offendingConcept, "06-violinist");
    }

    // Restore valid manifest and test changed source pack
    writeFileSync(manifestPath, baseManifestText, "utf8");
    const changedPromptsPath = join(work, "prompts-changed.md");
    writeFileSync(
      changedPromptsPath,
      readFileSync(PROMPTS_PATH, "utf8").replace("Three lines in, and already a second sheet.", "Four lines in."),
      "utf8",
    );
    const sourceRes = checkHandoffDirectory({ inputDir: kitDir, promptsPath: changedPromptsPath });
    assert.equal(sourceRes.ok, false);
    if (!sourceRes.ok) {
      assert.equal(sourceRes.reason, "source_mismatch");
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("path escape, symlinks, false completion status, and invalid CLI usage are rejected", () => {
  const work = mkdtempSync(join(tmpdir(), "sketches-handoff-security-"));
  try {
    const kitDir = join(work, "kit");
    exportHandoffDirectory({ outputDir: kitDir, promptsPath: PROMPTS_PATH });
    const manifestPath = join(kitDir, "manifest.json");
    const baseManifestText = readFileSync(manifestPath, "utf8");

    // 1. Path traversal in manifest promptFile
    const escapeManifest = JSON.parse(baseManifestText) as HandoffManifest;
    escapeManifest.concepts[0].promptFile = "../outside.md";
    writeFileSync(manifestPath, `${JSON.stringify(escapeManifest, null, 2)}\n`, "utf8");
    const escapeRes = checkHandoffDirectory({ inputDir: kitDir, promptsPath: PROMPTS_PATH });
    assert.equal(escapeRes.ok, false);
    if (!escapeRes.ok) {
      assert.equal(escapeRes.reason, "invalid_path");
      assert.equal(escapeRes.offendingConcept, "01-quiet-reader");
    }
    writeFileSync(manifestPath, baseManifestText, "utf8");

    // 2. Symlink inside kit directory
    const outsideFile = join(work, "outside-target.md");
    writeFileSync(outsideFile, readFileSync(join(kitDir, "05_Autumn_Wanderer.md"), "utf8"), "utf8");
    const wandererPath = join(kitDir, "05_Autumn_Wanderer.md");
    unlinkSync(wandererPath);
    symlinkSync(outsideFile, wandererPath);
    assert.equal(lstatSync(wandererPath).isSymbolicLink(), true);

    const symlinkRes = checkHandoffDirectory({ inputDir: kitDir, promptsPath: PROMPTS_PATH });
    assert.equal(symlinkRes.ok, false);
    if (!symlinkRes.ok) {
      assert.equal(symlinkRes.reason, "invalid_path");
      assert.match(symlinkRes.offendingPath ?? "", /05_Autumn_Wanderer\.md/);
    }

    // Restore regular file
    unlinkSync(wandererPath);
    writeFileSync(wandererPath, readFileSync(outsideFile, "utf8"), "utf8");

    // 3. False completion status
    const completedManifest = JSON.parse(baseManifestText) as Record<string, unknown>;
    completedManifest.status = "completed";
    writeFileSync(manifestPath, `${JSON.stringify(completedManifest, null, 2)}\n`, "utf8");
    const statusRes = checkHandoffDirectory({ inputDir: kitDir, promptsPath: PROMPTS_PATH });
    assert.equal(statusRes.ok, false);
    if (!statusRes.ok) {
      assert.equal(statusRes.reason, "invalid_status");
    }

    // 4. Refuses to export over production content/ directory
    const prodOverwriteRes = exportHandoffDirectory({
      outputDir: resolve(ROOT, "content"),
      promptsPath: PROMPTS_PATH,
    });
    assert.equal(prodOverwriteRes.ok, false);
    if (!prodOverwriteRes.ok) {
      assert.equal(prodOverwriteRes.reason, "invalid_path");
    }

    // 5. Invalid CLI usage returns exit code 2 with invalid_cli
    for (const badArgs of [
      ["unknown"],
      ["export", "--input-dir", kitDir],
      ["check", "--output-dir", kitDir],
      ["export", "--output-dir"],
      ["check", "--unknown-flag"],
    ]) {
      const errs: string[] = [];
      const code = runHandoffCli(badArgs, {
        cwd: ROOT,
        stdout: () => undefined,
        stderr: (msg) => errs.push(msg),
      });
      assert.equal(code, 2, `expected exit 2 for args ${JSON.stringify(badArgs)}, got ${code}`);
      const errObj = JSON.parse(errs.join("\n")) as Record<string, unknown>;
      assert.equal(errObj.reason, "invalid_cli");
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("export and check never resolve credentials or call network and existing delivery gate still rejects 0 portraits", () => {
  const work = mkdtempSync(join(tmpdir(), "sketches-handoff-hermetic-"));
  const savedKey = process.env.XAI_API_KEY;
  const savedSettings = process.env.XAI_SETTINGS_PATH;
  const savedFetch = globalThis.fetch;
  try {
    process.env.XAI_API_KEY = "xai-unusable-key-must-never-be-read";
    process.env.XAI_SETTINGS_PATH = join(work, "nonexistent-grok-settings.json");
    globalThis.fetch = (() => {
      throw new Error("Network access is strictly forbidden during handoff export/check");
    }) as typeof fetch;

    const kitDir = join(work, "kit");
    const exportCode = runHandoffCli(["export", "--output-dir", kitDir], {
      cwd: ROOT,
      stdout: () => undefined,
      stderr: () => undefined,
    });
    assert.equal(exportCode, 0);

    const checkCode = runHandoffCli(["check", "--input-dir", kitDir], {
      cwd: ROOT,
      stdout: () => undefined,
      stderr: () => undefined,
    });
    assert.equal(checkCode, 0);

    // Pure interface check
    const promptPack = parsePromptPack(readFileSync(PROMPTS_PATH, "utf8"));
    const handoff = createPortraitHandoff();
    const built = handoff.buildKit(promptPack);
    const filesMap = new Map<string, string>([
      ["manifest.json", built.manifestJson],
      ...built.promptFiles.map((f): [string, string] => [f.filename, f.content]),
    ]);
    const validated = validateHandoffKit({ manifestRaw: built.manifestJson, files: filesMap }, promptPack);
    assert.equal(validated.ok, true);
    assert.equal(buildHandoffKit(promptPack).promptFiles.length, 10);
    assert.ok(renderConceptPromptMarkdown(promptPack.concepts[0], promptPack).includes(promptPack.concepts[0].fullPrompt));

    // Negative control: production content/portraits.json remains [] and requirePeople still fails
    const rawPortraits = JSON.parse(readFileSync(resolve(ROOT, "content/portraits.json"), "utf8"));
    assert.deepEqual(rawPortraits, []);
    const deliveryCheck = validatePortraitManifest(rawPortraits, { requirePeople: true, promptPack });
    assert.equal(deliveryCheck.valid, false);
    assert.ok(deliveryCheck.errors.some((e) => /manifest contains 0 records/i.test(e)));

    // Verify content/site.ts and lib/sketches.ts do not import sketches-handoff
    const siteSource = readFileSync(resolve(ROOT, "content/site.ts"), "utf8");
    const sketchesSource = readFileSync(resolve(ROOT, "lib/sketches.ts"), "utf8");
    assert.doesNotMatch(siteSource, /sketches-handoff/);
    assert.doesNotMatch(sketchesSource, /sketches-handoff/);
  } finally {
    globalThis.fetch = savedFetch;
    if (savedKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = savedKey;
    if (savedSettings === undefined) delete process.env.XAI_SETTINGS_PATH;
    else process.env.XAI_SETTINGS_PATH = savedSettings;
    rmSync(work, { recursive: true, force: true });
  }
});

test("committed production-kit passes read-only check without modifying files and CLI subprocess enforces exit codes 0, 1, 2", () => {
  const committedKitDir = resolve(
    ROOT,
    "projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/production-kit",
  );
  const manifestPath = join(committedKitDir, "manifest.json");
  const mtimeBefore = statSync(manifestPath).mtimeMs;
  const bytesBefore = readFileSync(manifestPath);

  const checkRes = checkHandoffDirectory({ inputDir: committedKitDir, promptsPath: PROMPTS_PATH });
  assert.equal(checkRes.ok, true);
  assert.equal(statSync(manifestPath).mtimeMs, mtimeBefore);
  assert.equal(Buffer.compare(readFileSync(manifestPath), bytesBefore), 0);

  const cliScript = resolve(ROOT, "scripts/sketches-handoff.ts");
  const okRun = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", cliScript, "check"],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(okRun.status, 0, okRun.stderr);

  const badCliRun = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", cliScript, "check", "--bad-flag"],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(badCliRun.status, 2);

  const missingDirRun = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      cliScript,
      "check",
      "--input-dir",
      join(committedKitDir, "does-not-exist"),
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(missingDirRun.status, 1);
});

