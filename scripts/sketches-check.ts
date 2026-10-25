// Validates the existing 12 sketches in public/sketches/ and the portrait manifest in content/portraits.json.
//   npm run sketches:check                           offline validation (0 or 10 portraits)
//   npm run sketches:check -- --require-people       requires 10 complete real portrait records
//   npm run sketches:check -- --live                 also downloads, hashes, and decodes all public URLs
//   npm run sketches:check -- --manifest <path>      validate a specific manifest file
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import {
  BASE_SKETCHES,
  getSketchDimensions,
  type PortraitAssetArtifact,
  validatePortraitManifest,
} from "../lib/sketches.ts";
import { DEFAULT_PROMPTS_PATH, loadPromptPack } from "../lib/sketches-generation.ts";

function getArgValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx >= 0 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function verifyBaseSketches(publicDir: string): Promise<string[]> {
  const errors: string[] = [];
  const seenHashes = new Set<string>();

  for (const sketch of BASE_SKETCHES) {
    const filePath = join(publicDir, sketch.src);
    if (!existsSync(filePath)) {
      errors.push(`${sketch.src}: missing file under public/`);
      continue;
    }
    const bytes = readFileSync(filePath);
    if (bytes.byteLength === 0) {
      errors.push(`${sketch.src}: file is empty`);
      continue;
    }
    const hash = sha256Hex(bytes);
    if (seenHashes.has(hash)) {
      errors.push(`${sketch.src}: duplicate sha256 (${hash})`);
    }
    seenHashes.add(hash);

    try {
      const meta = await sharp(bytes).metadata();
      const expected = getSketchDimensions(sketch.kind);
      if (meta.format !== "jpeg") {
        errors.push(`${sketch.src}: expected JPEG, got ${String(meta.format)}`);
      }
      if (meta.width !== expected.width || meta.height !== expected.height) {
        errors.push(
          `${sketch.src}: expected ${expected.width}x${expected.height}, got ${String(meta.width)}x${String(meta.height)}`,
        );
      }
    } catch (err) {
      errors.push(`${sketch.src}: failed to decode (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  return errors;
}

async function verifyLiveArtifact(
  label: string,
  artifact: PortraitAssetArtifact,
  expectedFormat: "png" | "jpeg",
): Promise<string[]> {
  const errors: string[] = [];
  try {
    const res = await fetch(artifact.publicUrl, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      errors.push(`${label} (${artifact.filename}): HTTP ${res.status} from ${artifact.publicUrl}`);
      return errors;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength !== artifact.bytes) {
      errors.push(`${label} (${artifact.filename}): downloaded ${bytes.byteLength} bytes, manifest states ${artifact.bytes}`);
    }
    const actualSha = sha256Hex(bytes);
    if (actualSha !== artifact.sha256) {
      errors.push(`${label} (${artifact.filename}): sha256 mismatch (got ${actualSha}, expected ${artifact.sha256})`);
    }
    const meta = await sharp(bytes).metadata();
    if (meta.format !== expectedFormat) {
      errors.push(`${label} (${artifact.filename}): decoded format "${String(meta.format)}", expected "${expectedFormat}"`);
    }
    if (meta.width !== artifact.width || meta.height !== artifact.height) {
      errors.push(
        `${label} (${artifact.filename}): decoded dimensions ${String(meta.width)}x${String(meta.height)}, expected ${artifact.width}x${artifact.height}`,
      );
    }
  } catch (err) {
    errors.push(`${label} (${artifact.filename}): live download failed (${err instanceof Error ? err.message : String(err)})`);
  }
  return errors;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const live = args.includes("--live");
  const requirePeople = args.includes("--require-people");
  const manifestPath = resolve(
    getArgValue(args, "--manifest") ?? resolve(import.meta.dirname, "../content/portraits.json"),
  );
  const promptsPath = resolve(getArgValue(args, "--prompts") ?? DEFAULT_PROMPTS_PATH);
  const publicDir = resolve(import.meta.dirname, "../public");

  const errors: string[] = [];

  let promptPack;
  try {
    promptPack = loadPromptPack(promptsPath);
  } catch (err) {
    errors.push(`prompts.md: ${err instanceof Error ? err.message : String(err)}`);
  }

  const baseErrors = await verifyBaseSketches(publicDir);
  errors.push(...baseErrors);

  if (!existsSync(manifestPath)) {
    errors.push(`manifest file not found: ${manifestPath}`);
  } else {
    let rawManifest: unknown;
    try {
      rawManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch (err) {
      errors.push(`manifest JSON parse error: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (rawManifest !== undefined) {
      const validation = validatePortraitManifest(rawManifest, {
        requirePeople,
        allowFixtures: false,
        promptPack,
      });
      errors.push(...validation.errors);

      if (live && validation.valid && validation.records.length > 0) {
        for (const record of validation.records) {
          const masterErrs = await verifyLiveArtifact(`${record.conceptId} master`, record.master, "png");
          const derivErrs = await verifyLiveArtifact(`${record.conceptId} derivative`, record.derivative, "jpeg");
          errors.push(...masterErrs, ...derivErrs);
        }
      }

      for (const e of errors) {
        console.log(`error: ${e}`);
      }
      console.log(
        `${BASE_SKETCHES.length} base sketches, ${validation.records.length} portraits, ${errors.length} errors (${live ? "live" : "offline"}${requirePeople ? ", require-people" : ""})`,
      );
      return errors.length === 0 ? 0 : 1;
    }
  }

  for (const e of errors) {
    console.log(`error: ${e}`);
  }
  console.log(`${BASE_SKETCHES.length} base sketches, 0 portraits, ${errors.length} errors`);
  return errors.length === 0 ? 0 : 1;
}

process.exitCode = await main();
