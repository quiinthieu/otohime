// Portable portrait production kit CLI (offline, credential-free, deterministic).
//   node --experimental-strip-types scripts/sketches-handoff.ts export [--output-dir <dir>] [--prompts <path>]
//   node --experimental-strip-types scripts/sketches-handoff.ts check [--input-dir <dir>] [--prompts <path>]
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_PROMPTS_REL_PATH, parsePromptPack, type PromptPack } from "../lib/sketches.ts";
import {
  createPortraitHandoff,
  DEFAULT_HANDOFF_DIR_REL_PATH,
  HANDOFF_MANIFEST_FILENAME,
  type HandoffErrorReason,
  type HandoffManifest,
  isSafeSimpleFilename,
} from "../lib/sketches-handoff.ts";

const REPO_ROOT = resolve(import.meta.dirname, "..");

export type HandoffExportResult =
  | {
      ok: true;
      command: "export";
      status: "production_required";
      outputDir: string;
      promptPackSha256: string;
      referenceUrlSha256: string;
      conceptCount: number;
      filesWritten: string[];
      paintingsDelivered: 0;
      galleryPortraitsActivated: 0;
      manifest: HandoffManifest;
    }
  | {
      ok: false;
      command: "export";
      reason: HandoffErrorReason;
      offendingConcept: string | null;
      offendingPath: string | null;
      message: string;
    };

export type HandoffCheckResult =
  | {
      ok: true;
      command: "check";
      status: "production_required";
      inputDir: string;
      promptPackSha256: string;
      referenceUrlSha256: string;
      conceptCount: number;
      verifiedPromptFiles: number;
      paintingsDelivered: 0;
      galleryPortraitsActivated: 0;
      manifest: HandoffManifest;
    }
  | {
      ok: false;
      command: "check";
      reason: HandoffErrorReason;
      offendingConcept: string | null;
      offendingPath: string | null;
      message: string;
    };

function safeLstat(targetPath: string) {
  try {
    return lstatSync(targetPath);
  } catch {
    return null;
  }
}

function safeRealpath(targetPath: string): string {
  try {
    return realpathSync(targetPath);
  } catch {
    return resolve(targetPath);
  }
}

function isSubpathOrSame(parentDir: string, candidatePath: string): boolean {
  const rel = relative(parentDir, candidatePath);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function isForbiddenExportTarget(resolvedOutDir: string, rootDir: string): boolean {
  const roots = Array.from(new Set([resolve(rootDir), safeRealpath(rootDir)]));
  const candidates = Array.from(
    new Set([
      resolve(resolvedOutDir),
      existsSync(resolvedOutDir) ? safeRealpath(resolvedOutDir) : resolve(resolvedOutDir),
    ]),
  );

  for (const r of roots) {
    for (const c of candidates) {
      if (c === r) return true;
      if (c === resolve(r, "projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt")) {
        return true;
      }
      for (const protectedTree of ["content", "public", "app", "lib", "scripts", ".git", "node_modules"]) {
        if (isSubpathOrSame(resolve(r, protectedTree), c)) {
          return true;
        }
      }
    }
  }
  return false;
}

function loadCanonicalPromptPack(
  promptsPath: string,
): { ok: true; pack: PromptPack } | { ok: false; reason: HandoffErrorReason; message: string } {
  if (!promptsPath || promptsPath.includes("\0")) {
    return {
      ok: false,
      reason: "invalid_path",
      message: "Invalid prompts file path",
    };
  }
  const stat = safeLstat(promptsPath);
  if (!stat) {
    return {
      ok: false,
      reason: "missing_file",
      message: `Prompts pack file not found: ${promptsPath}`,
    };
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    return {
      ok: false,
      reason: "invalid_path",
      message: `Prompts pack path must be a regular file (not a symlink or directory): ${promptsPath}`,
    };
  }
  try {
    const raw = readFileSync(promptsPath, "utf8");
    const pack = parsePromptPack(raw);
    return { ok: true, pack };
  } catch (err) {
    return {
      ok: false,
      reason: "source_mismatch",
      message: `Failed to parse prompts pack (${promptsPath}): ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function exportHandoffDirectory(options: {
  outputDir?: string;
  promptsPath?: string;
  rootDir?: string;
} = {}): HandoffExportResult {
  const rootDir = resolve(options.rootDir ?? REPO_ROOT);
  const outputDir = resolve(rootDir, options.outputDir ?? DEFAULT_HANDOFF_DIR_REL_PATH);
  const promptsPath = resolve(rootDir, options.promptsPath ?? DEFAULT_PROMPTS_REL_PATH);

  if (!outputDir || outputDir.includes("\0") || isForbiddenExportTarget(outputDir, rootDir)) {
    return {
      ok: false,
      command: "export",
      reason: "invalid_path",
      offendingConcept: null,
      offendingPath: outputDir,
      message: `Refusing to export handoff kit into protected or invalid path: ${outputDir}`,
    };
  }

  const existingOutStat = safeLstat(outputDir);
  if (existingOutStat && (existingOutStat.isSymbolicLink() || !existingOutStat.isDirectory())) {
    return {
      ok: false,
      command: "export",
      reason: "invalid_path",
      offendingConcept: null,
      offendingPath: outputDir,
      message: `Export output path must be a directory and not a symlink: ${outputDir}`,
    };
  }

  const loaded = loadCanonicalPromptPack(promptsPath);
  if (!loaded.ok) {
    return {
      ok: false,
      command: "export",
      reason: loaded.reason,
      offendingConcept: null,
      offendingPath: promptsPath,
      message: loaded.message,
    };
  }

  const handoff = createPortraitHandoff();
  const kit = handoff.buildKit(loaded.pack);

  mkdirSync(outputDir, { recursive: true });

  // Verify no existing symlinks exist at target file paths before writing
  const filesToWrite: Array<{ filename: string; content: string }> = [
    { filename: HANDOFF_MANIFEST_FILENAME, content: kit.manifestJson },
    ...kit.promptFiles.map((f) => ({ filename: f.filename, content: f.content })),
  ];

  for (const item of filesToWrite) {
    if (!isSafeSimpleFilename(item.filename)) {
      return {
        ok: false,
        command: "export",
        reason: "invalid_path",
        offendingConcept: null,
        offendingPath: item.filename,
        message: `Unsafe export filename "${item.filename}"`,
      };
    }
    const targetPath = join(outputDir, item.filename);
    const st = safeLstat(targetPath);
    if (st && (st.isSymbolicLink() || !st.isFile())) {
      return {
        ok: false,
        command: "export",
        reason: "invalid_path",
        offendingConcept: null,
        offendingPath: targetPath,
        message: `Refusing to overwrite symlink or non-regular file: ${targetPath}`,
      };
    }
  }

  for (const item of filesToWrite) {
    writeFileSync(join(outputDir, item.filename), item.content, "utf8");
  }

  return {
    ok: true,
    command: "export",
    status: "production_required",
    outputDir,
    promptPackSha256: kit.manifest.promptPackSha256,
    referenceUrlSha256: kit.manifest.referenceUrlSha256,
    conceptCount: kit.promptFiles.length,
    filesWritten: filesToWrite.map((f) => f.filename),
    paintingsDelivered: 0,
    galleryPortraitsActivated: 0,
    manifest: kit.manifest,
  };
}

export function checkHandoffDirectory(options: {
  inputDir?: string;
  promptsPath?: string;
  rootDir?: string;
} = {}): HandoffCheckResult {
  const rootDir = resolve(options.rootDir ?? REPO_ROOT);
  const inputDir = resolve(rootDir, options.inputDir ?? DEFAULT_HANDOFF_DIR_REL_PATH);
  const promptsPath = resolve(rootDir, options.promptsPath ?? DEFAULT_PROMPTS_REL_PATH);

  if (!inputDir || inputDir.includes("\0")) {
    return {
      ok: false,
      command: "check",
      reason: "invalid_path",
      offendingConcept: null,
      offendingPath: inputDir,
      message: "Invalid input directory path",
    };
  }

  const loaded = loadCanonicalPromptPack(promptsPath);
  if (!loaded.ok) {
    return {
      ok: false,
      command: "check",
      reason: loaded.reason,
      offendingConcept: null,
      offendingPath: promptsPath,
      message: loaded.message,
    };
  }

  const dirStat = safeLstat(inputDir);
  if (!dirStat) {
    return {
      ok: false,
      command: "check",
      reason: "missing_file",
      offendingConcept: null,
      offendingPath: inputDir,
      message: `Handoff input directory does not exist: ${inputDir}`,
    };
  }
  if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) {
    return {
      ok: false,
      command: "check",
      reason: "invalid_path",
      offendingConcept: null,
      offendingPath: inputDir,
      message: `Handoff input path must be a real directory (not a symlink or file): ${inputDir}`,
    };
  }

  const entries = readdirSync(inputDir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const filesMap = new Map<string, string>();

  for (const entry of entries) {
    const fullEntryPath = join(inputDir, entry.name);
    if (entry.isSymbolicLink()) {
      return {
        ok: false,
        command: "check",
        reason: "invalid_path",
        offendingConcept: null,
        offendingPath: fullEntryPath,
        message: `Symlink entry rejected in handoff kit: ${fullEntryPath}`,
      };
    }
    if (!entry.isFile()) {
      return {
        ok: false,
        command: "check",
        reason: "extra_file",
        offendingConcept: null,
        offendingPath: fullEntryPath,
        message: `Unexpected non-regular file or subdirectory in handoff kit: ${fullEntryPath}`,
      };
    }
    filesMap.set(entry.name, readFileSync(fullEntryPath, "utf8"));
  }

  const handoff = createPortraitHandoff();
  const validation = handoff.validateKit(
    {
      manifestRaw: filesMap.get(HANDOFF_MANIFEST_FILENAME),
      files: filesMap,
    },
    loaded.pack,
  );

  if (!validation.ok) {
    const resolvedOffendingPath =
      validation.offendingPath && isSafeSimpleFilename(validation.offendingPath)
        ? join(inputDir, validation.offendingPath)
        : validation.offendingPath;
    return {
      ok: false,
      command: "check",
      reason: validation.reason,
      offendingConcept: validation.offendingConcept,
      offendingPath: resolvedOffendingPath,
      message: validation.message,
    };
  }

  return {
    ok: true,
    command: "check",
    status: "production_required",
    inputDir,
    promptPackSha256: validation.promptPackSha256,
    referenceUrlSha256: validation.referenceUrlSha256,
    conceptCount: validation.conceptCount,
    verifiedPromptFiles: validation.verifiedPromptFiles,
    paintingsDelivered: 0,
    galleryPortraitsActivated: 0,
    manifest: validation.manifest,
  };
}

type ParsedCliArgs =
  | {
      ok: true;
      command: "export";
      outputDir?: string;
      promptsPath?: string;
    }
  | {
      ok: true;
      command: "check";
      inputDir?: string;
      promptsPath?: string;
    }
  | {
      ok: false;
      reason: "invalid_cli";
      message: string;
    };

export function parseHandoffCliArgs(args: string[]): ParsedCliArgs {
  if (args.length === 0) {
    return {
      ok: false,
      reason: "invalid_cli",
      message: "Missing required subcommand (expected 'export' or 'check')",
    };
  }

  const [subcommand, ...rest] = args;
  if (subcommand !== "export" && subcommand !== "check") {
    return {
      ok: false,
      reason: "invalid_cli",
      message: `Unknown subcommand "${subcommand}" (expected 'export' or 'check')`,
    };
  }

  let outputDir: string | undefined;
  let inputDir: string | undefined;
  let promptsPath: string | undefined;

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith("--")) {
      return {
        ok: false,
        reason: "invalid_cli",
        message: `Unexpected positional argument "${arg}"`,
      };
    }

    const val = rest[i + 1];
    if (val === undefined || val.startsWith("--") || val.trim() === "") {
      return {
        ok: false,
        reason: "invalid_cli",
        message: `Flag "${arg}" requires a non-empty path argument`,
      };
    }

    if (arg === "--output-dir") {
      if (subcommand !== "export") {
        return {
          ok: false,
          reason: "invalid_cli",
          message: "--output-dir is only valid with the 'export' subcommand",
        };
      }
      if (outputDir !== undefined) {
        return {
          ok: false,
          reason: "invalid_cli",
          message: "Duplicate --output-dir flag",
        };
      }
      outputDir = val;
      i++;
      continue;
    }

    if (arg === "--input-dir") {
      if (subcommand !== "check") {
        return {
          ok: false,
          reason: "invalid_cli",
          message: "--input-dir is only valid with the 'check' subcommand",
        };
      }
      if (inputDir !== undefined) {
        return {
          ok: false,
          reason: "invalid_cli",
          message: "Duplicate --input-dir flag",
        };
      }
      inputDir = val;
      i++;
      continue;
    }

    if (arg === "--prompts") {
      if (promptsPath !== undefined) {
        return {
          ok: false,
          reason: "invalid_cli",
          message: "Duplicate --prompts flag",
        };
      }
      promptsPath = val;
      i++;
      continue;
    }

    return {
      ok: false,
      reason: "invalid_cli",
      message: `Unknown flag "${arg}"`,
    };
  }

  if (subcommand === "export") {
    return { ok: true, command: "export", outputDir, promptsPath };
  }
  return { ok: true, command: "check", inputDir, promptsPath };
}

export function runHandoffCli(
  args: string[],
  io: {
    cwd?: string;
    stdout?: (msg: string) => void;
    stderr?: (msg: string) => void;
  } = {},
): number {
  const out = io.stdout ?? ((msg: string) => console.log(msg));
  const err = io.stderr ?? ((msg: string) => console.error(msg));
  const rootDir = resolve(io.cwd ?? REPO_ROOT);

  const parsed = parseHandoffCliArgs(args);
  if (!parsed.ok) {
    err(
      JSON.stringify({
        ok: false,
        reason: parsed.reason,
        offendingConcept: null,
        offendingPath: null,
        message: parsed.message,
      }),
    );
    return 2;
  }

  if (parsed.command === "export") {
    const res = exportHandoffDirectory({
      outputDir: parsed.outputDir,
      promptsPath: parsed.promptsPath,
      rootDir,
    });
    if (!res.ok) {
      err(
        JSON.stringify({
          ok: false,
          command: "export",
          reason: res.reason,
          offendingConcept: res.offendingConcept,
          offendingPath: res.offendingPath,
          message: res.message,
        }),
      );
      return 1;
    }
    out(
      JSON.stringify({
        ok: true,
        command: "export",
        status: res.status,
        outputDir: res.outputDir,
        promptPackSha256: res.promptPackSha256,
        referenceUrlSha256: res.referenceUrlSha256,
        conceptCount: res.conceptCount,
        filesWritten: res.filesWritten,
        paintingsDelivered: res.paintingsDelivered,
        galleryPortraitsActivated: res.galleryPortraitsActivated,
      }),
    );
    return 0;
  }

  const res = checkHandoffDirectory({
    inputDir: parsed.inputDir,
    promptsPath: parsed.promptsPath,
    rootDir,
  });
  if (!res.ok) {
    err(
      JSON.stringify({
        ok: false,
        command: "check",
        reason: res.reason,
        offendingConcept: res.offendingConcept,
        offendingPath: res.offendingPath,
        message: res.message,
      }),
    );
    return 1;
  }
  out(
    JSON.stringify({
      ok: true,
      command: "check",
      status: res.status,
      inputDir: res.inputDir,
      promptPackSha256: res.promptPackSha256,
      referenceUrlSha256: res.referenceUrlSha256,
      conceptCount: res.conceptCount,
      verifiedPromptFiles: res.verifiedPromptFiles,
      paintingsDelivered: res.paintingsDelivered,
      galleryPortraitsActivated: res.galleryPortraitsActivated,
    }),
  );
  return 0;
}

const isMainModule =
  Boolean(process.argv[1]) &&
  safeRealpath(resolve(process.argv[1])) === safeRealpath(fileURLToPath(import.meta.url));

if (isMainModule) {
  process.exitCode = runHandoffCli(process.argv.slice(2));
}
