// CLI for portrait preflight, generation, import, and durable xAI Files publication.
//   node --experimental-strip-types scripts/sketches-paint.ts preflight --offline
//   node --experimental-strip-types scripts/sketches-paint.ts generate [--out-dir <dir>] [--ledger <path>]
//   node --experimental-strip-types scripts/sketches-paint.ts import --input-dir <dir> [--out-dir <dir>] [--ledger <path>]
//   node --experimental-strip-types scripts/sketches-paint.ts publish [--ledger <path>] [--manifest <path>]
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  redactSecrets,
  resolveXaiCredential,
  runGenerationWorkflow,
  runImportWorkflow,
  runPreflightCheck,
  runPublishWorkflow,
  XaiImagePublisher,
} from "../lib/sketches-generation.ts";

function getArgValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx >= 0 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const subcommand = args.find((a) => !a.startsWith("--")) ?? "preflight";
  const defaultScratch = join(tmpdir(), "otohime-sketches-paint");
  const outDir = resolve(getArgValue(args, "--out-dir") ?? join(defaultScratch, "candidates"));
  const ledgerPath = resolve(getArgValue(args, "--ledger") ?? join(defaultScratch, "attempt-ledger.json"));
  const promptsPath = getArgValue(args, "--prompts")
    ? resolve(getArgValue(args, "--prompts")!)
    : undefined;
  const baseUrl = getArgValue(args, "--base-url");

  try {
    if (subcommand === "preflight") {
      const summary = await runPreflightCheck({ promptsPath });
      console.log(redactSecrets(JSON.stringify(summary, null, 2)));
      return 0;
    }

    if (subcommand === "generate") {
      const credential = resolveXaiCredential();
      if (!credential.available) {
        console.error("error: XAI_API_KEY or mounted .grok/user-settings.json credential is not available");
        return 1;
      }
      const publisher = new XaiImagePublisher({ baseUrl, credential });
      const conceptArg = getArgValue(args, "--concept");
      const qualityArg = getArgValue(args, "--quality") as "low" | "medium" | "auto" | undefined;
      const referenceImageUrl = getArgValue(args, "--reference-url");
      const acceptAll = args.includes("--accept-all");

      const result = await runGenerationWorkflow({
        publisher,
        ledgerPath,
        outDir,
        promptsPath,
        conceptIds: conceptArg ? [conceptArg] : undefined,
        quality: qualityArg,
        referenceImageUrl,
        acceptAllForTest: acceptAll,
      });
      console.log(
        JSON.stringify({
          command: "generate",
          ledgerPath,
          outDir,
          decodedCandidates: result.ledger.decodedCandidates.length,
          failedRequests: result.ledger.failedRequests.length,
        }),
      );
      return 0;
    }

    if (subcommand === "import") {
      const inputDirArg = getArgValue(args, "--input-dir");
      if (!inputDirArg) {
        console.error("error: --input-dir <dir> is required for import");
        return 1;
      }
      const reviewer = getArgValue(args, "--reviewer") ?? "operator-import";
      const accept = args.includes("--accept");
      const result = await runImportWorkflow({
        inputDir: resolve(inputDirArg),
        outDir,
        ledgerPath,
        promptsPath,
        reviewer,
        accept,
      });
      console.log(
        JSON.stringify({
          command: "import",
          ledgerPath,
          outDir,
          decodedCandidates: result.ledger.decodedCandidates.length,
        }),
      );
      return 0;
    }

    if (subcommand === "publish") {
      const credential = resolveXaiCredential();
      if (!credential.available) {
        console.error("error: XAI_API_KEY or mounted .grok/user-settings.json credential is not available");
        return 1;
      }
      const publisher = new XaiImagePublisher({ baseUrl, credential });
      const manifestArg = getArgValue(args, "--manifest");
      const writeDefaultManifest = args.includes("--write-manifest");
      const manifestPath = manifestArg
        ? resolve(manifestArg)
        : writeDefaultManifest
          ? resolve(import.meta.dirname, "../content/portraits.json")
          : undefined;

      const result = await runPublishWorkflow({
        publisher,
        ledgerPath,
        manifestPath,
        promptsPath,
      });
      console.log(
        JSON.stringify({
          command: "publish",
          ledgerPath,
          manifestPath: manifestPath ?? null,
          publishedRecords: result.records.length,
        }),
      );
      return 0;
    }

    console.error(`error: unknown command "${subcommand}" (expected preflight, generate, import, or publish)`);
    return 1;
  } catch (err) {
    const msg = redactSecrets(err instanceof Error ? err.message : String(err));
    console.error(`error: ${msg}`);
    return 1;
  }
}

process.exitCode = await main();
