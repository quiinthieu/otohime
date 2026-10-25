import { createHash } from "node:crypto";
import {
  DEFAULT_PROMPTS_REL_PATH,
  REQUIRED_MASTER_FILENAMES,
  type PortraitConcept,
  type PromptPack,
  type RequiredMasterFilename,
} from "./sketches.ts";

export const DEFAULT_HANDOFF_DIR_REL_PATH =
  "projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/production-kit";
export const HANDOFF_MANIFEST_FILENAME = "manifest.json";

export type HandoffErrorReason =
  | "missing_file"
  | "extra_file"
  | "prompt_mismatch"
  | "source_mismatch"
  | "metadata_mismatch"
  | "duplicate_mapping"
  | "invalid_path"
  | "invalid_status"
  | "invalid_cli";

export const HANDOFF_REVIEW_CHECKLIST = [
  "one adult subject: feature exactly one original young adult woman (age 20-30) as the primary subject",
  "natural face/proportions: delicate facial features drawn with minimal confident strokes and unified facial anatomy",
  "plausible visible hands (occlusion allowed): visible anatomical landmarks guide convincing hands; partially occluded fingers need not all be shown",
  "varied expressive ink: spontaneous black ink contours of varying weight, overlapping/overshooting lines, scribbles and unfinished passages",
  "organic loose washes: transparent watercolour washes mixed with concentrated pigment, hard irregular wet edges, granulation, bleeding and small splatters",
  "three-to-five-colour palette: restrained palette of 3-5 dominant colours per illustration with saturated accents against pale washes and deep ink black",
  "sparse off-white paper: large areas left as bare off-white paper (#faf8f3) with contours dissolving toward the bottom and no detailed background",
  "original distinct pose: asymmetrical 3:4 portrait composition with distinct pose, palette and focal point (seated frontal three-quarter Reader without headscarf)",
  "absence of digital polish/anime/photorealism: no clean uniform outlines, polished digital rendering, conventional anime, photorealism, or photographic paper grain overlay",
  "absence of text, frame, signature and watermark: no decorative border, text, caption, signature or watermark in the artwork",
] as const;

export type HandoffConceptRecord = {
  index: number;
  conceptId: string;
  title: string;
  caption: string;
  masterFilename: RequiredMasterFilename;
  derivativeFilename: string;
  promptFile: string;
  fullPromptSha256: string;
  promptFileByteLength: number;
  promptFileSha256: string;
};

export type HandoffManifest = {
  schemaVersion: 1;
  status: "production_required";
  sourcePromptsPath: string;
  promptPackSha256: string;
  styleReferenceUrl: string;
  referenceUrl: string;
  referenceUrlSha256: string;
  referenceHashNote: string;
  deliveryStatus: {
    paintingsDelivered: 0;
    paintingsRequired: 10;
    galleryPortraitsActivated: 0;
  };
  generationSettings: {
    status: "unverified_guidance";
    executed: false;
    source: "prompts.md";
    planningBaselineModel: "grok-imagine-image-2.0";
    aspectRatio: "3:4";
    preferredResolution: "2k";
    preferredMinNativeWidth: 1536;
    preferredMinNativeHeight: 2048;
    upscalingAllowed: false;
    lowerNativeResolutionPolicy: string;
    maxAttemptsPerConcept: 4;
    maxTotalCandidates: 40;
    seedPolicy: string;
    note: string;
  };
  artifactRequirements: {
    master: {
      format: "image/png";
      aspectRatio: "3:4";
      preferredMinWidth: 1536;
      preferredMinHeight: 2048;
      allowUpscale: false;
      lowerResolutionRule: string;
    };
    derivative: {
      format: "image/jpeg";
      width: 1152;
      height: 1536;
      maxBytes: 600000;
      croppingAllowed: false;
    };
    publication: {
      allowedHost: "files-cdn.x.ai";
      requireHttps: true;
      fileExpiresAt: null;
      publicUrlExpiresAt: null;
      requireAnonymousHttp200: true;
      commitBinariesToGit: false;
    };
  };
  reviewChecklist: string[];
  concepts: HandoffConceptRecord[];
};

export type ExportedPromptFile = {
  conceptId: string;
  filename: string;
  content: string;
  byteLength: number;
  sha256: string;
};

export type ExportedHandoffKit = {
  manifest: HandoffManifest;
  manifestJson: string;
  promptFiles: ExportedPromptFile[];
};

export type HandoffKitInput = {
  manifestRaw: string | undefined;
  files: ReadonlyMap<string, string> | Record<string, string>;
  invalidPaths?: Array<{ path: string; conceptId?: string; message?: string }>;
};

export type HandoffValidationResult =
  | {
      ok: true;
      status: "production_required";
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
      reason: HandoffErrorReason;
      offendingConcept: string | null;
      offendingPath: string | null;
      message: string;
    };

export interface PortraitHandoff {
  buildKit(promptPack: PromptPack): ExportedHandoffKit;
  validateKit(input: HandoffKitInput, promptPack: PromptPack): HandoffValidationResult;
}

const SHA256_RE = /^[0-9a-f]{64}$/;
const SECRET_LEAK_RE = /\b(xai-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,})\b/;
const SIMPLE_FILENAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toPromptFilename(masterFilename: string): string {
  return masterFilename.replace(/\.png$/, ".md");
}

export function isSafeSimpleFilename(name: string, expectedExt?: ".md" | ".png" | ".jpg"): boolean {
  if (!name || typeof name !== "string") return false;
  if (
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("..") ||
    name.includes(":") ||
    name.includes("\0") ||
    !SIMPLE_FILENAME_RE.test(name)
  ) {
    return false;
  }
  if (expectedExt && !name.endsWith(expectedExt)) {
    return false;
  }
  return true;
}

export function renderConceptPromptMarkdown(concept: PortraitConcept, promptPack: PromptPack): string {
  const indexLabel = String(concept.index).padStart(2, "0");
  return [
    `# ${indexLabel} — ${concept.title} (\`${concept.masterFilename}\`)`,
    "",
    `- **Concept ID**: \`${concept.conceptId}\``,
    `- **Gallery Title**: ${concept.title}`,
    `- **Caption**: ${concept.caption}`,
    `- **Master Filename**: \`${concept.masterFilename}\``,
    `- **Derivative Filename**: \`${concept.derivativeFilename}\``,
    `- **Orientation / Aspect Ratio**: \`3:4\` portrait`,
    `- **Preferred Native Resolution**: \`>=1536x2048\` lossless PNG (preserve exact native 3:4 pixel dimensions; never upscale — report any lower native 3:4 size honestly)`,
    `- **Gallery Derivative Requirement**: \`1152x1536\` JPEG under \`600000\` bytes without cropping`,
    `- **Subject & Originality Rule**: Exactly one original adult woman (age 20–30); no text, border, signature, or watermark`,
    `- **Full Prompt SHA-256**: \`${concept.promptSha256}\``,
    "",
    "## Copyable Prompt",
    "",
    "```text",
    concept.fullPrompt,
    "```",
    "",
    "## Shared Style (`prompts.md`)",
    "",
    `> ${promptPack.sharedStyle}`,
    "",
    "## Concept Composition (`prompts.md`)",
    "",
    concept.composition,
    "",
    "## Production & Review Notes",
    "",
    "- Keep native output in scratch, encode the selected master losslessly as PNG at its exact native `3:4` resolution (`>=1536x2048` preferred), and report any lower native resolution honestly rather than upscaling.",
    "- Encode the gallery derivative at `1152x1536` JPEG (`<600000` bytes) without cropping the figure.",
    "- Inspect full-size before publication against all ten review checklist criteria in `manifest.json`.",
    "",
  ].join("\n");
}

export type ParsedConceptPromptMarkdown = {
  conceptId: string;
  title: string;
  caption: string;
  masterFilename: string;
  derivativeFilename: string;
  fullPromptSha256: string;
  fullPrompt: string;
  sharedStyle: string;
  composition: string;
};

export function parseConceptPromptMarkdown(markdown: string): ParsedConceptPromptMarkdown {
  const conceptId = markdown.match(/^- \*\*Concept ID\*\*:\s*`([^`\n]+)`$/m)?.[1]?.trim() ?? "";
  const title = markdown.match(/^- \*\*Gallery Title\*\*:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const caption = markdown.match(/^- \*\*Caption\*\*:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const masterFilename = markdown.match(/^- \*\*Master Filename\*\*:\s*`([^`\n]+)`$/m)?.[1]?.trim() ?? "";
  const derivativeFilename = markdown.match(/^- \*\*Derivative Filename\*\*:\s*`([^`\n]+)`$/m)?.[1]?.trim() ?? "";
  const fullPromptSha256 = markdown.match(/^- \*\*Full Prompt SHA-256\*\*:\s*`([^`\n]+)`$/m)?.[1]?.trim() ?? "";
  const fullPrompt =
    markdown.match(/## Copyable Prompt\n\n```text\n([\s\S]*?)\n```/)?.[1] ?? "";
  const sharedStyle =
    markdown.match(/## Shared Style \(`prompts\.md`\)\n\n>\s*([^\n]+)/)?.[1]?.trim() ?? "";
  const composition =
    markdown.match(/## Concept Composition \(`prompts\.md`\)\n\n([^\n]+)/)?.[1]?.trim() ?? "";

  return {
    conceptId,
    title,
    caption,
    masterFilename,
    derivativeFilename,
    fullPromptSha256,
    fullPrompt,
    sharedStyle,
    composition,
  };
}

function buildExpectedManifestBase(promptPack: PromptPack): Omit<HandoffManifest, "concepts"> {
  return {
    schemaVersion: 1,
    status: "production_required",
    sourcePromptsPath: DEFAULT_PROMPTS_REL_PATH,
    promptPackSha256: promptPack.promptPackSha256,
    styleReferenceUrl: promptPack.styleReferenceUrl,
    referenceUrl: promptPack.originalImageUrl,
    referenceUrlSha256: promptPack.referenceSha256,
    referenceHashNote:
      "SHA-256 of the canonical reference image URL string from parsePromptPack(), not downloaded image bytes.",
    deliveryStatus: {
      paintingsDelivered: 0,
      paintingsRequired: 10,
      galleryPortraitsActivated: 0,
    },
    generationSettings: {
      status: "unverified_guidance",
      executed: false,
      source: "prompts.md",
      planningBaselineModel: "grok-imagine-image-2.0",
      aspectRatio: "3:4",
      preferredResolution: "2k",
      preferredMinNativeWidth: 1536,
      preferredMinNativeHeight: 2048,
      upscalingAllowed: false,
      lowerNativeResolutionPolicy:
        "Preserve exact native 3:4 pixel dimensions as lossless PNG and report actual lower dimensions honestly rather than upscaling.",
      maxAttemptsPerConcept: 4,
      maxTotalCandidates: 40,
      seedPolicy:
        "Do not pass an undocumented seed; record seed only if actually supported and returned by the vendor, otherwise write 'not supported'.",
      note: "Unverified planning guidance from prompts.md only; no model execution, seed, candidate, or vendor request has occurred in this kit.",
    },
    artifactRequirements: {
      master: {
        format: "image/png",
        aspectRatio: "3:4",
        preferredMinWidth: 1536,
        preferredMinHeight: 2048,
        allowUpscale: false,
        lowerResolutionRule: "Report lower native 3:4 dimensions honestly; never upscale to fake >=1536x2048.",
      },
      derivative: {
        format: "image/jpeg",
        width: 1152,
        height: 1536,
        maxBytes: 600000,
        croppingAllowed: false,
      },
      publication: {
        allowedHost: "files-cdn.x.ai",
        requireHttps: true,
        fileExpiresAt: null,
        publicUrlExpiresAt: null,
        requireAnonymousHttp200: true,
        commitBinariesToGit: false,
      },
    },
    reviewChecklist: [...HANDOFF_REVIEW_CHECKLIST],
  };
}

export function buildHandoffKit(promptPack: PromptPack): ExportedHandoffKit {
  if (promptPack.concepts.length !== REQUIRED_MASTER_FILENAMES.length) {
    throw new Error(
      `Expected ${REQUIRED_MASTER_FILENAMES.length} concepts in promptPack, found ${promptPack.concepts.length}`,
    );
  }

  const promptFiles: ExportedPromptFile[] = [];
  const conceptRecords: HandoffConceptRecord[] = [];

  for (let i = 0; i < promptPack.concepts.length; i++) {
    const concept = promptPack.concepts[i];
    const expectedMaster = REQUIRED_MASTER_FILENAMES[i];
    if (concept.masterFilename !== expectedMaster) {
      throw new Error(
        `Concept ${i + 1} masterFilename "${concept.masterFilename}" does not match "${expectedMaster}"`,
      );
    }
    const promptFile = toPromptFilename(concept.masterFilename);
    const content = renderConceptPromptMarkdown(concept, promptPack);
    const utf8Bytes = Buffer.from(content, "utf8");
    const byteLength = utf8Bytes.byteLength;
    const sha256 = sha256Hex(utf8Bytes);

    promptFiles.push({
      conceptId: concept.conceptId,
      filename: promptFile,
      content,
      byteLength,
      sha256,
    });

    conceptRecords.push({
      index: concept.index,
      conceptId: concept.conceptId,
      title: concept.title,
      caption: concept.caption,
      masterFilename: concept.masterFilename,
      derivativeFilename: concept.derivativeFilename,
      promptFile,
      fullPromptSha256: concept.promptSha256,
      promptFileByteLength: byteLength,
      promptFileSha256: sha256,
    });
  }

  const manifest: HandoffManifest = {
    ...buildExpectedManifestBase(promptPack),
    concepts: conceptRecords,
  };

  return {
    manifest,
    manifestJson: `${JSON.stringify(manifest, null, 2)}\n`,
    promptFiles,
  };
}

function toFilesMap(files: ReadonlyMap<string, string> | Record<string, string>): Map<string, string> {
  if (files instanceof Map) {
    return new Map(files);
  }
  const map = new Map<string, string>();
  for (const [key, val] of Object.entries(files)) {
    map.set(key, val);
  }
  return map;
}

const FORBIDDEN_COMPLETION_KEYS = [
  "candidateId",
  "candidateSha256",
  "attemptId",
  "fileId",
  "publicUrl",
  "accepted",
  "acceptedReviews",
  "review",
  "master",
  "derivative",
  "records",
] as const;

export function validateHandoffKit(
  input: HandoffKitInput,
  promptPack: PromptPack,
): HandoffValidationResult {
  if (input.invalidPaths && input.invalidPaths.length > 0) {
    const first = input.invalidPaths[0];
    return {
      ok: false,
      reason: "invalid_path",
      offendingConcept: first.conceptId ?? null,
      offendingPath: first.path,
      message: first.message ?? `Unsafe or escaping path rejected: ${first.path}`,
    };
  }

  const files = toFilesMap(input.files);

  if (input.manifestRaw === undefined) {
    return {
      ok: false,
      reason: "missing_file",
      offendingConcept: null,
      offendingPath: HANDOFF_MANIFEST_FILENAME,
      message: `Missing required ${HANDOFF_MANIFEST_FILENAME}`,
    };
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(input.manifestRaw);
  } catch (err) {
    return {
      ok: false,
      reason: "metadata_mismatch",
      offendingConcept: null,
      offendingPath: HANDOFF_MANIFEST_FILENAME,
      message: `Failed to parse ${HANDOFF_MANIFEST_FILENAME}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!isRecordObject(parsedRaw)) {
    return {
      ok: false,
      reason: "metadata_mismatch",
      offendingConcept: null,
      offendingPath: HANDOFF_MANIFEST_FILENAME,
      message: `${HANDOFF_MANIFEST_FILENAME} root must be a JSON object`,
    };
  }

  if (SECRET_LEAK_RE.test(input.manifestRaw)) {
    return {
      ok: false,
      reason: "metadata_mismatch",
      offendingConcept: null,
      offendingPath: HANDOFF_MANIFEST_FILENAME,
      message: `${HANDOFF_MANIFEST_FILENAME} contains a credential or token leak`,
    };
  }

  // 1. Check status and completion claims (invalid_status)
  if (parsedRaw.status !== "production_required") {
    return {
      ok: false,
      reason: "invalid_status",
      offendingConcept: null,
      offendingPath: HANDOFF_MANIFEST_FILENAME,
      message: `manifest.status must be "production_required" (got "${String(parsedRaw.status)}")`,
    };
  }

  for (const forbiddenKey of FORBIDDEN_COMPLETION_KEYS) {
    if (forbiddenKey in parsedRaw) {
      return {
        ok: false,
        reason: "invalid_status",
        offendingConcept: null,
        offendingPath: HANDOFF_MANIFEST_FILENAME,
        message: `manifest contains fabricated completion/publication field "${forbiddenKey}"`,
      };
    }
  }

  if (isRecordObject(parsedRaw.deliveryStatus)) {
    if (
      parsedRaw.deliveryStatus.paintingsDelivered !== 0 ||
      parsedRaw.deliveryStatus.galleryPortraitsActivated !== 0
    ) {
      return {
        ok: false,
        reason: "invalid_status",
        offendingConcept: null,
        offendingPath: HANDOFF_MANIFEST_FILENAME,
        message: "manifest.deliveryStatus claims delivered or activated paintings in a production-kit handoff",
      };
    }
  }

  if (isRecordObject(parsedRaw.generationSettings)) {
    if (
      parsedRaw.generationSettings.status !== "unverified_guidance" ||
      parsedRaw.generationSettings.executed !== false
    ) {
      return {
        ok: false,
        reason: "invalid_status",
        offendingConcept: null,
        offendingPath: HANDOFF_MANIFEST_FILENAME,
        message:
          'manifest.generationSettings must keep status="unverified_guidance" and executed=false',
      };
    }
  }

  // 2. Check source pack hashes & reference URLs (source_mismatch)
  if (
    parsedRaw.promptPackSha256 !== promptPack.promptPackSha256 ||
    parsedRaw.styleReferenceUrl !== promptPack.styleReferenceUrl ||
    parsedRaw.referenceUrl !== promptPack.originalImageUrl ||
    parsedRaw.referenceUrlSha256 !== promptPack.referenceSha256
  ) {
    return {
      ok: false,
      reason: "source_mismatch",
      offendingConcept: null,
      offendingPath: HANDOFF_MANIFEST_FILENAME,
      message:
        "manifest source promptPackSha256 or reference URL/hash does not match canonical prompts.md",
    };
  }

  if (!Array.isArray(parsedRaw.concepts)) {
    return {
      ok: false,
      reason: "metadata_mismatch",
      offendingConcept: null,
      offendingPath: HANDOFF_MANIFEST_FILENAME,
      message: "manifest.concepts must be an array",
    };
  }

  // 3. Check concept rows for path escape (invalid_path), forbidden completion status (invalid_status), and duplicates (duplicate_mapping)
  const seenConceptIds = new Set<string>();
  const seenMasterFilenames = new Set<string>();
  const seenDerivativeFilenames = new Set<string>();
  const seenPromptFiles = new Set<string>();
  const seenTitles = new Set<string>();

  for (let i = 0; i < parsedRaw.concepts.length; i++) {
    const item = parsedRaw.concepts[i];
    const fallbackConcept = promptPack.concepts[i]?.conceptId ?? `index-${i + 1}`;
    if (!isRecordObject(item)) {
      return {
        ok: false,
        reason: "metadata_mismatch",
        offendingConcept: fallbackConcept,
        offendingPath: HANDOFF_MANIFEST_FILENAME,
        message: `manifest.concepts[${i}] must be an object`,
      };
    }

    const conceptId = typeof item.conceptId === "string" ? item.conceptId : fallbackConcept;
    const promptFile = typeof item.promptFile === "string" ? item.promptFile : "";
    const masterFilename = typeof item.masterFilename === "string" ? item.masterFilename : "";
    const derivativeFilename = typeof item.derivativeFilename === "string" ? item.derivativeFilename : "";
    const title = typeof item.title === "string" ? item.title : "";

    if ("status" in item && item.status !== "production_required") {
      return {
        ok: false,
        reason: "invalid_status",
        offendingConcept: conceptId,
        offendingPath: promptFile || HANDOFF_MANIFEST_FILENAME,
        message: `concept "${conceptId}" has invalid status "${String(item.status)}"`,
      };
    }
    for (const forbiddenKey of FORBIDDEN_COMPLETION_KEYS) {
      if (forbiddenKey in item) {
        return {
          ok: false,
          reason: "invalid_status",
          offendingConcept: conceptId,
          offendingPath: promptFile || HANDOFF_MANIFEST_FILENAME,
          message: `concept "${conceptId}" contains fabricated completion field "${forbiddenKey}"`,
        };
      }
    }

    if (!isSafeSimpleFilename(promptFile, ".md")) {
      return {
        ok: false,
        reason: "invalid_path",
        offendingConcept: conceptId,
        offendingPath: promptFile || HANDOFF_MANIFEST_FILENAME,
        message: `concept "${conceptId}" has unsafe or invalid promptFile path "${promptFile}"`,
      };
    }
    if (!isSafeSimpleFilename(masterFilename, ".png")) {
      return {
        ok: false,
        reason: "invalid_path",
        offendingConcept: conceptId,
        offendingPath: masterFilename || HANDOFF_MANIFEST_FILENAME,
        message: `concept "${conceptId}" has unsafe or invalid masterFilename "${masterFilename}"`,
      };
    }
    if (!isSafeSimpleFilename(derivativeFilename, ".jpg")) {
      return {
        ok: false,
        reason: "invalid_path",
        offendingConcept: conceptId,
        offendingPath: derivativeFilename || HANDOFF_MANIFEST_FILENAME,
        message: `concept "${conceptId}" has unsafe or invalid derivativeFilename "${derivativeFilename}"`,
      };
    }

    if (
      seenConceptIds.has(conceptId) ||
      seenMasterFilenames.has(masterFilename) ||
      seenDerivativeFilenames.has(derivativeFilename) ||
      seenPromptFiles.has(promptFile) ||
      (title && seenTitles.has(title))
    ) {
      return {
        ok: false,
        reason: "duplicate_mapping",
        offendingConcept: conceptId,
        offendingPath: promptFile,
        message: `duplicate concept or filename mapping detected at "${conceptId}" (${masterFilename} / ${derivativeFilename} / ${promptFile})`,
      };
    }
    seenConceptIds.add(conceptId);
    seenMasterFilenames.add(masterFilename);
    seenDerivativeFilenames.add(derivativeFilename);
    seenPromptFiles.add(promptFile);
    if (title) seenTitles.add(title);
  }

  // 4. Check file presence and unexpected files (missing_file, extra_file, invalid_path)
  const expectedPromptFiles = promptPack.concepts.map((c) => toPromptFilename(c.masterFilename));
  const allowedFilesSet = new Set<string>([HANDOFF_MANIFEST_FILENAME, ...expectedPromptFiles]);

  for (const fileKey of files.keys()) {
    if (!isSafeSimpleFilename(fileKey)) {
      return {
        ok: false,
        reason: "invalid_path",
        offendingConcept: null,
        offendingPath: fileKey,
        message: `Unsafe file path in handoff directory: "${fileKey}"`,
      };
    }
    if (!allowedFilesSet.has(fileKey)) {
      return {
        ok: false,
        reason: "extra_file",
        offendingConcept: null,
        offendingPath: fileKey,
        message: `Unexpected extra file in handoff kit: "${fileKey}"`,
      };
    }
  }

  if (parsedRaw.concepts.length < promptPack.concepts.length) {
    const missingCanonical =
      promptPack.concepts.find((c) => !seenConceptIds.has(c.conceptId)) ??
      promptPack.concepts[parsedRaw.concepts.length];
    const missingFile = missingCanonical ? toPromptFilename(missingCanonical.masterFilename) : HANDOFF_MANIFEST_FILENAME;
    return {
      ok: false,
      reason: "missing_file",
      offendingConcept: missingCanonical?.conceptId ?? null,
      offendingPath: missingFile,
      message: `manifest.concepts contains ${parsedRaw.concepts.length} rows, expected ${promptPack.concepts.length}`,
    };
  }

  if (parsedRaw.concepts.length > promptPack.concepts.length) {
    const extraRow = parsedRaw.concepts[promptPack.concepts.length] as Record<string, unknown>;
    return {
      ok: false,
      reason: "extra_file",
      offendingConcept: typeof extraRow?.conceptId === "string" ? extraRow.conceptId : null,
      offendingPath: typeof extraRow?.promptFile === "string" ? extraRow.promptFile : HANDOFF_MANIFEST_FILENAME,
      message: `manifest.concepts contains ${parsedRaw.concepts.length} rows, expected ${promptPack.concepts.length}`,
    };
  }

  for (const canonical of promptPack.concepts) {
    const expectedFile = toPromptFilename(canonical.masterFilename);
    if (!files.has(expectedFile)) {
      return {
        ok: false,
        reason: "missing_file",
        offendingConcept: canonical.conceptId,
        offendingPath: expectedFile,
        message: `Missing required prompt file "${expectedFile}" for concept "${canonical.conceptId}"`,
      };
    }
  }

  // 5. Check top-level manifest metadata (metadata_mismatch)
  const expectedBase = buildExpectedManifestBase(promptPack);
  const expectedTopKeys = [...Object.keys(expectedBase), "concepts"].sort();
  const actualTopKeys = Object.keys(parsedRaw).sort();
  if (
    JSON.stringify(actualTopKeys) !== JSON.stringify(expectedTopKeys) ||
    parsedRaw.schemaVersion !== expectedBase.schemaVersion ||
    parsedRaw.sourcePromptsPath !== expectedBase.sourcePromptsPath ||
    parsedRaw.referenceHashNote !== expectedBase.referenceHashNote ||
    JSON.stringify(parsedRaw.deliveryStatus) !== JSON.stringify(expectedBase.deliveryStatus) ||
    JSON.stringify(parsedRaw.generationSettings) !== JSON.stringify(expectedBase.generationSettings) ||
    JSON.stringify(parsedRaw.artifactRequirements) !== JSON.stringify(expectedBase.artifactRequirements) ||
    JSON.stringify(parsedRaw.reviewChecklist) !== JSON.stringify(expectedBase.reviewChecklist)
  ) {
    return {
      ok: false,
      reason: "metadata_mismatch",
      offendingConcept: null,
      offendingPath: HANDOFF_MANIFEST_FILENAME,
      message: "manifest top-level metadata, generationSettings, artifactRequirements, or reviewChecklist mismatch",
    };
  }

  // 6. Check per-concept metadata and prompt files (metadata_mismatch & prompt_mismatch)
  const expectedRowKeys = [
    "caption",
    "conceptId",
    "derivativeFilename",
    "fullPromptSha256",
    "index",
    "masterFilename",
    "promptFile",
    "promptFileByteLength",
    "promptFileSha256",
    "title",
  ];

  const validatedConcepts: HandoffConceptRecord[] = [];

  for (let i = 0; i < promptPack.concepts.length; i++) {
    const canonical = promptPack.concepts[i];
    const expectedFile = toPromptFilename(canonical.masterFilename);
    const row = parsedRaw.concepts[i] as Record<string, unknown>;

    const rowKeys = Object.keys(row).sort();
    if (
      JSON.stringify(rowKeys) !== JSON.stringify(expectedRowKeys) ||
      row.index !== canonical.index ||
      row.conceptId !== canonical.conceptId ||
      row.title !== canonical.title ||
      row.caption !== canonical.caption ||
      row.masterFilename !== canonical.masterFilename ||
      row.derivativeFilename !== canonical.derivativeFilename ||
      row.promptFile !== expectedFile
    ) {
      return {
        ok: false,
        reason: "metadata_mismatch",
        offendingConcept: canonical.conceptId,
        offendingPath: HANDOFF_MANIFEST_FILENAME,
        message: `manifest.concepts[${i}] metadata does not match canonical "${canonical.conceptId}" in prompts.md`,
      };
    }

    const fullPromptSha256 = typeof row.fullPromptSha256 === "string" ? row.fullPromptSha256 : "";
    const promptFileByteLength = typeof row.promptFileByteLength === "number" ? row.promptFileByteLength : -1;
    const promptFileSha256 = typeof row.promptFileSha256 === "string" ? row.promptFileSha256 : "";

    if (
      !SHA256_RE.test(fullPromptSha256) ||
      !SHA256_RE.test(promptFileSha256) ||
      !Number.isInteger(promptFileByteLength) ||
      promptFileByteLength <= 0
    ) {
      return {
        ok: false,
        reason: "prompt_mismatch",
        offendingConcept: canonical.conceptId,
        offendingPath: expectedFile,
        message: `Invalid hash or byteLength in manifest for "${canonical.conceptId}"`,
      };
    }

    const rawMd = files.get(expectedFile)!;
    if (SECRET_LEAK_RE.test(rawMd)) {
      return {
        ok: false,
        reason: "prompt_mismatch",
        offendingConcept: canonical.conceptId,
        offendingPath: expectedFile,
        message: `Prompt file "${expectedFile}" contains a credential leak`,
      };
    }

    const actualUtf8Bytes = Buffer.from(rawMd, "utf8");
    const actualByteLength = actualUtf8Bytes.byteLength;
    const actualFileSha256 = sha256Hex(actualUtf8Bytes);
    const expectedMd = renderConceptPromptMarkdown(canonical, promptPack);
    const parsedMd = parseConceptPromptMarkdown(rawMd);

    if (
      fullPromptSha256 !== canonical.promptSha256 ||
      promptFileByteLength !== actualByteLength ||
      promptFileSha256 !== actualFileSha256 ||
      parsedMd.conceptId !== canonical.conceptId ||
      parsedMd.title !== canonical.title ||
      parsedMd.caption !== canonical.caption ||
      parsedMd.masterFilename !== canonical.masterFilename ||
      parsedMd.derivativeFilename !== canonical.derivativeFilename ||
      parsedMd.fullPromptSha256 !== canonical.promptSha256 ||
      parsedMd.fullPrompt !== canonical.fullPrompt ||
      parsedMd.sharedStyle !== promptPack.sharedStyle ||
      parsedMd.composition !== canonical.composition ||
      rawMd !== expectedMd
    ) {
      return {
        ok: false,
        reason: "prompt_mismatch",
        offendingConcept: canonical.conceptId,
        offendingPath: expectedFile,
        message: `Prompt file "${expectedFile}" content, byteLength, or SHA-256 does not match canonical prompts.md`,
      };
    }

    validatedConcepts.push({
      index: canonical.index,
      conceptId: canonical.conceptId,
      title: canonical.title,
      caption: canonical.caption,
      masterFilename: canonical.masterFilename,
      derivativeFilename: canonical.derivativeFilename,
      promptFile: expectedFile,
      fullPromptSha256,
      promptFileByteLength,
      promptFileSha256,
    });
  }

  return {
    ok: true,
    status: "production_required",
    promptPackSha256: promptPack.promptPackSha256,
    referenceUrlSha256: promptPack.referenceSha256,
    conceptCount: validatedConcepts.length,
    verifiedPromptFiles: validatedConcepts.length,
    paintingsDelivered: 0,
    galleryPortraitsActivated: 0,
    manifest: {
      ...expectedBase,
      concepts: validatedConcepts,
    },
  };
}

export function createPortraitHandoff(): PortraitHandoff {
  return {
    buildKit: buildHandoffKit,
    validateKit: validateHandoffKit,
  };
}
