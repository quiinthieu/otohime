import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { inspect } from "node:util";
import sharp from "sharp";
import {
  BASE_SKETCHES,
  DEFAULT_PROMPTS_REL_PATH,
  isAllowedCdnUrl,
  parsePromptPack,
  type PortraitAssetArtifact,
  type PortraitConcept,
  type PortraitRecord,
  type PromptPack,
  type RequiredMasterFilename,
  validatePortraitManifest,
} from "./sketches.ts";

export const DEFAULT_PROMPTS_PATH = resolve(import.meta.dirname, "..", DEFAULT_PROMPTS_REL_PATH);

export function loadPromptPack(filePath: string = DEFAULT_PROMPTS_PATH): PromptPack {
  const markdown = readFileSync(filePath, "utf8");
  return parsePromptPack(markdown);
}

export const DEFAULT_XAI_BASE_URL = "https://api.x.ai/v1";
export const DEFAULT_XAI_MODEL = "grok-imagine-image-2.0";
export const DEFAULT_ASPECT_RATIO = "3:4" as const;
export const DEFAULT_RESOLUTION = "2k" as const;
export const MAX_ATTEMPTS_PER_CONCEPT = 4;
export const MAX_DERIVATIVE_BYTES = 600_000;
export const DERIVATIVE_WIDTH = 1152;
export const DERIVATIVE_HEIGHT = 1536;

function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function redactSecrets(input: string, extraSecrets: string[] = []): string {
  let out = input
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/\bxai-[A-Za-z0-9_-]{6,}\b/g, "[REDACTED_XAI_KEY]");
  for (const secret of extraSecrets) {
    if (secret && secret.trim().length >= 4) {
      out = out.split(secret.trim()).join("[REDACTED]");
    }
  }
  return out;
}

export type CredentialResolution = {
  readonly available: boolean;
  readonly source: "env:XAI_API_KEY" | "file:.grok/user-settings.json" | "none";
  getAuthorizationHeader(): string;
  redact(text: string): string;
};

const DEFAULT_SETTINGS_PATHS = [
  resolve(process.cwd(), ".grok/user-settings.json"),
  join(homedir(), ".grok/user-settings.json"),
  join(homedir(), ".config/grok/user-settings.json"),
];

export function resolveXaiCredential(
  env: Record<string, string | undefined> = process.env,
  options: { settingsPaths?: string[] } = {},
): CredentialResolution {
  let secret = "";
  let source: CredentialResolution["source"] = "none";

  const envKey = env.XAI_API_KEY?.trim();
  if (envKey) {
    secret = envKey;
    source = "env:XAI_API_KEY";
  } else {
    const candidates = options.settingsPaths ?? (env.XAI_SETTINGS_PATH ? [env.XAI_SETTINGS_PATH] : DEFAULT_SETTINGS_PATHS);
    for (const filePath of candidates) {
      if (!filePath || !existsSync(filePath)) continue;
      try {
        const raw = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
        const found =
          (typeof raw.apiKey === "string" && raw.apiKey.trim()) ||
          (typeof raw.api_key === "string" && raw.api_key.trim()) ||
          (typeof raw.xai_api_key === "string" && raw.xai_api_key.trim()) ||
          (typeof raw.XAI_API_KEY === "string" && raw.XAI_API_KEY.trim()) ||
          "";
        if (found) {
          secret = found;
          source = "file:.grok/user-settings.json";
          break;
        }
      } catch {
        // Ignore unreadable settings file and continue
      }
    }
  }

  const available = secret.length > 0;
  const safeView = { available, source };

  const obj: CredentialResolution = {
    available,
    source,
    getAuthorizationHeader() {
      if (!secret) {
        throw new Error("No xAI API key is available in XAI_API_KEY or .grok/user-settings.json");
      }
      return `Bearer ${secret}`;
    },
    redact(text: string) {
      return redactSecrets(text, secret ? [secret] : []);
    },
  };

  Object.defineProperty(obj, "toJSON", {
    value: () => safeView,
    enumerable: false,
  });
  Object.defineProperty(obj, "toString", {
    value: () => `CredentialResolution(available=${available}, source=${source})`,
    enumerable: false,
  });
  Object.defineProperty(obj, inspect.custom, {
    value: () => `CredentialResolution(available=${available}, source=${source})`,
    enumerable: false,
  });

  return obj;
}

const HERMETIC_SCRUB_KEYS = [
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "XAI_API_KEY",
  "XAI_BASE_URL",
  "XAI_SETTINGS_PATH",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "TASK_MANAGER_MCP_TOKEN",
  "PLAN_MANAGER_MCP_TOKEN",
] as const;

export async function withScrubbedHermeticEnv<T>(fn: () => Promise<T>): Promise<T> {
  const saved = new Map<string, string | undefined>();
  for (const key of HERMETIC_SCRUB_KEYS) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
  try {
    return await fn();
  } finally {
    for (const [key, val] of saved.entries()) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  }
}

export type GenerateImageRequest = {
  conceptId: string;
  prompt: string;
  model?: string;
  aspectRatio?: "3:4";
  resolution?: "1k" | "2k";
  quality?: "low" | "medium" | "auto";
  responseFormat?: "url" | "b64_json";
  referenceImageUrl?: string;
};

export type GenerateImageResponse = {
  requestId: string;
  endpoint: "/v1/images/generations" | "/v1/images/edits";
  model: string;
  createdAt: string;
  ephemeralUrl?: string;
  b64Json?: string;
  revisedPrompt?: string;
  seed: "not supported" | string;
};

export type PublishArtifactRequest = {
  filename: string;
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg";
};

export type PublishedArtifactReceipt = {
  fileId: string;
  filename: string;
  publicUrl: string;
  mimeType: "image/png" | "image/jpeg";
  bytes: number;
  sha256: string;
  expiresAt: null;
};

export type FetchedArtifact = {
  url: string;
  status: number;
  mimeType: string;
  bytes: Uint8Array;
  sha256: string;
};

export interface ImagePublisher {
  generate(request: GenerateImageRequest): Promise<GenerateImageResponse>;
  publish(request: PublishArtifactRequest): Promise<PublishedArtifactReceipt>;
  fetchArtifact(url: string, options?: { authenticated?: boolean }): Promise<FetchedArtifact>;
}

export class PublisherHttpError extends Error {
  readonly status: number;
  readonly requestId: string;
  readonly endpoint: string;
  readonly redactedBody: string;

  constructor(params: {
    message: string;
    status: number;
    requestId: string;
    endpoint: string;
    redactedBody: string;
  }) {
    super(params.message);
    this.name = "PublisherHttpError";
    this.status = params.status;
    this.requestId = params.requestId;
    this.endpoint = params.endpoint;
    this.redactedBody = params.redactedBody;
  }
}

export class XaiImagePublisher implements ImagePublisher {
  private readonly baseUrl: string;
  private readonly credential: CredentialResolution;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly cdnRewriteOrigin?: string;

  constructor(options: {
    baseUrl?: string;
    credential?: CredentialResolution;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    cdnRewriteOrigin?: string;
  } = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.XAI_BASE_URL ?? DEFAULT_XAI_BASE_URL).replace(/\/+$/, "");
    this.credential = options.credential ?? resolveXaiCredential();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.cdnRewriteOrigin = options.cdnRewriteOrigin?.replace(/\/+$/, "");
  }

  getCredentialSummary(): { available: boolean; source: CredentialResolution["source"] } {
    return {
      available: this.credential.available,
      source: this.credential.source,
    };
  }

  async generate(request: GenerateImageRequest): Promise<GenerateImageResponse> {
    const model = request.model ?? DEFAULT_XAI_MODEL;
    const aspectRatio = request.aspectRatio ?? DEFAULT_ASPECT_RATIO;
    const resolution = request.resolution ?? DEFAULT_RESOLUTION;
    const responseFormat = request.responseFormat ?? "url";
    const isEdit = Boolean(request.referenceImageUrl);
    const endpoint = isEdit ? "/v1/images/edits" : "/v1/images/generations";
    const url = `${this.baseUrl}${ isEdit ? "/images/edits" : "/images/generations"}`;

    // Official JSON contract: never fabricate unsupported seed parameters
    const payload: Record<string, unknown> = {
      model,
      prompt: request.prompt,
      aspect_ratio: aspectRatio,
      resolution,
      response_format: responseFormat,
    };
    if (request.quality) {
      payload.quality = request.quality;
    }
    if (isEdit && request.referenceImageUrl) {
      payload.image = {
        url: request.referenceImageUrl,
        type: "image_url",
      };
    } else {
      payload.n = 1;
    }

    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: this.credential.getAuthorizationHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const requestId = res.headers.get("x-request-id") ?? `req-${Date.now()}`;
    const rawText = await res.text();
    const redactedBody = this.credential.redact(rawText).slice(0, 1000);

    if (!res.ok) {
      throw new PublisherHttpError({
        message: `xAI ${endpoint} failed with HTTP ${res.status} (${requestId}): ${redactedBody}`,
        status: res.status,
        requestId,
        endpoint,
        redactedBody,
      });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      throw new PublisherHttpError({
        message: `xAI ${endpoint} returned malformed JSON (${requestId})`,
        status: res.status,
        requestId,
        endpoint,
        redactedBody,
      });
    }

    const data = Array.isArray(parsed.data) ? parsed.data : [];
    const first = data[0] as Record<string, unknown> | undefined;
    const ephemeralUrl = typeof first?.url === "string" && first.url.trim() ? first.url.trim() : undefined;
    const b64Json = typeof first?.b64_json === "string" && first.b64_json.trim() ? first.b64_json.trim() : undefined;

    if (!first || (!ephemeralUrl && !b64Json)) {
      throw new PublisherHttpError({
        message: `xAI ${endpoint} response missing data[0].url and data[0].b64_json (${requestId})`,
        status: res.status,
        requestId,
        endpoint,
        redactedBody,
      });
    }

    const resolvedModel = typeof parsed.model === "string" && parsed.model.trim() ? parsed.model.trim() : model;
    const rawSeed = first.seed ?? parsed.seed;
    const seed =
      typeof rawSeed === "number" || (typeof rawSeed === "string" && rawSeed.trim())
        ? String(rawSeed)
        : "not supported";

    return {
      requestId,
      endpoint,
      model: resolvedModel,
      createdAt: new Date().toISOString(),
      ephemeralUrl,
      b64Json,
      revisedPrompt: typeof first.revised_prompt === "string" ? first.revised_prompt : undefined,
      seed,
    };
  }

  async publish(request: PublishArtifactRequest): Promise<PublishedArtifactReceipt> {
    const expectedExt = request.mimeType === "image/png" ? ".png" : ".jpg";
    if (!request.filename.endsWith(expectedExt)) {
      throw new Error(`Filename "${request.filename}" does not match MIME type "${request.mimeType}"`);
    }

    // Step 1: Upload to /v1/files with NO expires_after (permanent storage)
    const form = new FormData();
    form.append("purpose", "assistants");
    const copy = new Uint8Array(request.bytes.byteLength);
    copy.set(request.bytes);
    form.append("file", new Blob([copy], { type: request.mimeType }), request.filename);

    const uploadUrl = `${this.baseUrl}/files`;
    const uploadRes = await this.fetchImpl(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: this.credential.getAuthorizationHeader(),
      },
      body: form,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const uploadReqId = uploadRes.headers.get("x-request-id") ?? `req-upload-${Date.now()}`;
    const uploadText = await uploadRes.text();
    const redactedUpload = this.credential.redact(uploadText).slice(0, 1000);

    if (!uploadRes.ok) {
      throw new PublisherHttpError({
        message: `xAI /v1/files upload failed with HTTP ${uploadRes.status} (${uploadReqId}): ${redactedUpload}`,
        status: uploadRes.status,
        requestId: uploadReqId,
        endpoint: "/v1/files",
        redactedBody: redactedUpload,
      });
    }

    let uploadJson: Record<string, unknown>;
    try {
      uploadJson = JSON.parse(uploadText) as Record<string, unknown>;
    } catch {
      throw new PublisherHttpError({
        message: `xAI /v1/files returned malformed JSON (${uploadReqId})`,
        status: uploadRes.status,
        requestId: uploadReqId,
        endpoint: "/v1/files",
        redactedBody: redactedUpload,
      });
    }

    const fileId = typeof uploadJson.id === "string" ? uploadJson.id.trim() : "";
    if (!/^file_[A-Za-z0-9_-]{4,120}$/.test(fileId)) {
      throw new Error(`xAI /v1/files returned invalid file id "${fileId}"`);
    }
    if (uploadJson.expires_at !== undefined && uploadJson.expires_at !== null) {
      throw new Error(`xAI /v1/files returned an expiring file (expires_at=${String(uploadJson.expires_at)}); permanent files are required`);
    }

    // Step 2: Create non-expiring public URL via /v1/files/{file_id}/public-url
    const pubEndpoint = `/v1/files/${encodeURIComponent(fileId)}/public-url`;
    const pubUrl = `${this.baseUrl}/files/${encodeURIComponent(fileId)}/public-url`;
    const pubRes = await this.fetchImpl(pubUrl, {
      method: "POST",
      headers: {
        Authorization: this.credential.getAuthorizationHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const pubReqId = pubRes.headers.get("x-request-id") ?? `req-pub-${Date.now()}`;
    const pubText = await pubRes.text();
    const redactedPub = this.credential.redact(pubText).slice(0, 1000);

    if (!pubRes.ok) {
      throw new PublisherHttpError({
        message: `xAI ${pubEndpoint} failed with HTTP ${pubRes.status} (${pubReqId}): ${redactedPub}`,
        status: pubRes.status,
        requestId: pubReqId,
        endpoint: pubEndpoint,
        redactedBody: redactedPub,
      });
    }

    let pubJson: Record<string, unknown>;
    try {
      pubJson = JSON.parse(pubText) as Record<string, unknown>;
    } catch {
      throw new PublisherHttpError({
        message: `xAI ${pubEndpoint} returned malformed JSON (${pubReqId})`,
        status: pubRes.status,
        requestId: pubReqId,
        endpoint: pubEndpoint,
        redactedBody: redactedPub,
      });
    }

    if (pubJson.expires_at !== undefined && pubJson.expires_at !== null) {
      throw new Error(`xAI ${pubEndpoint} returned an expiring public URL (expires_at=${String(pubJson.expires_at)})`);
    }
    if (pubJson.public_url_expires_at !== undefined && pubJson.public_url_expires_at !== null) {
      throw new Error(`xAI ${pubEndpoint} returned an expiring public URL`);
    }

    const publicUrl = typeof pubJson.public_url === "string" ? pubJson.public_url.trim() : "";
    if (!isAllowedCdnUrl(publicUrl, expectedExt)) {
      throw new Error(
        `xAI ${pubEndpoint} returned URL "${publicUrl}" which is not a permanent https://files-cdn.x.ai/.../*${expectedExt} URL`,
      );
    }

    return {
      fileId,
      filename: request.filename,
      publicUrl,
      mimeType: request.mimeType,
      bytes: request.bytes.byteLength,
      sha256: sha256Hex(request.bytes),
      expiresAt: null,
    };
  }

  async fetchArtifact(url: string, options: { authenticated?: boolean } = {}): Promise<FetchedArtifact> {
    const targetUrl =
      this.cdnRewriteOrigin && url.startsWith("https://files-cdn.x.ai/")
        ? `${this.cdnRewriteOrigin}/${url.slice("https://files-cdn.x.ai/".length)}`
        : url;

    const headers: Record<string, string> = {};
    if (options.authenticated) {
      headers.Authorization = this.credential.getAuthorizationHeader();
    }

    const res = await this.fetchImpl(targetUrl, {
      method: "GET",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) {
      const requestId = res.headers.get("x-request-id") ?? `req-fetch-${Date.now()}`;
      const bodyText = this.credential.redact(await res.text()).slice(0, 500);
      throw new PublisherHttpError({
        message: `Artifact fetch ${url} failed with HTTP ${res.status}: ${bodyText}`,
        status: res.status,
        requestId,
        endpoint: url,
        redactedBody: bodyText,
      });
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    return {
      url,
      status: res.status,
      mimeType: res.headers.get("content-type") ?? "",
      bytes,
      sha256: sha256Hex(bytes),
    };
  }
}

export type ProcessedCandidate = {
  candidateSha256: string;
  nativeWidth: number;
  nativeHeight: number;
  masterBytes: Uint8Array;
  masterSha256: string;
  masterWidth: number;
  masterHeight: number;
  derivativeBytes: Uint8Array;
  derivativeSha256: string;
  derivativeWidth: number;
  derivativeHeight: number;
  resolutionLimitation?: string;
};

export async function processCandidateImage(rawBytes: Uint8Array): Promise<ProcessedCandidate> {
  if (!rawBytes || rawBytes.byteLength === 0) {
    throw new Error("Candidate image bytes are empty");
  }
  const candidateSha256 = sha256Hex(rawBytes);

  const metadata = await sharp(rawBytes).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!metadata.format || !["png", "jpeg", "webp"].includes(metadata.format) || width < 64 || height < 64) {
    throw new Error(`Unsupported or corrupt candidate image format=${String(metadata.format)} (${width}x${height})`);
  }

  // Enforce 3:4 aspect ratio (never crop away hands or clothing or distort aspect)
  if (width * 4 !== height * 3) {
    throw new Error(`Candidate image dimensions ${width}x${height} do not match required 3:4 aspect ratio`);
  }

  // Losslessly encode native master as PNG at exact native resolution (never upscale)
  const masterBuffer = await sharp(rawBytes).png({ compressionLevel: 9 }).toBuffer();
  const masterMeta = await sharp(masterBuffer).metadata();
  if (masterMeta.format !== "png" || masterMeta.width !== width || masterMeta.height !== height) {
    throw new Error("Encoded PNG master failed dimension/format verification");
  }

  // Encode 1152x1536 JPEG derivative under 600,000 bytes without cropping
  let derivativeBuffer: Buffer | null = null;
  for (const quality of [84, 78, 72, 66, 60, 54]) {
    const candidateJpg = await sharp(rawBytes)
      .resize(DERIVATIVE_WIDTH, DERIVATIVE_HEIGHT, { fit: "fill" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (candidateJpg.byteLength < MAX_DERIVATIVE_BYTES) {
      derivativeBuffer = candidateJpg;
      break;
    }
  }
  if (!derivativeBuffer) {
    throw new Error(`Unable to encode 1152x1536 JPEG derivative under ${MAX_DERIVATIVE_BYTES} bytes`);
  }

  const derivMeta = await sharp(derivativeBuffer).metadata();
  if (
    derivMeta.format !== "jpeg" ||
    derivMeta.width !== DERIVATIVE_WIDTH ||
    derivMeta.height !== DERIVATIVE_HEIGHT ||
    derivativeBuffer.byteLength >= MAX_DERIVATIVE_BYTES
  ) {
    throw new Error("Encoded JPEG derivative failed dimension or size verification");
  }

  const resolutionLimitation =
    width < 1536 || height < 2048
      ? `Native output resolution is ${width}x${height} (below preferred 1536x2048; preserved without upscaling)`
      : undefined;

  return {
    candidateSha256,
    nativeWidth: width,
    nativeHeight: height,
    masterBytes: new Uint8Array(masterBuffer),
    masterSha256: sha256Hex(masterBuffer),
    masterWidth: width,
    masterHeight: height,
    derivativeBytes: new Uint8Array(derivativeBuffer),
    derivativeSha256: sha256Hex(derivativeBuffer),
    derivativeWidth: DERIVATIVE_WIDTH,
    derivativeHeight: DERIVATIVE_HEIGHT,
    resolutionLimitation,
  };
}

export async function synthesizeFixturePortraitPng(options: {
  conceptIndex: number;
  width?: number;
  height?: number;
  variant?: number;
}): Promise<Uint8Array> {
  const width = options.width ?? 1536;
  const height = options.height ?? 2048;
  const idx = options.conceptIndex;
  const variant = options.variant ?? 1;
  const palettes = [
    ["#1f6f78", "#d48c2a", "#c84b31"],
    ["#7a2e43", "#f2ead3", "#52734d"],
    ["#4f6348", "#d9a026", "#7a868c"],
    ["#1d2d44", "#f5f1e6", "#8c583a"],
    ["#b3472a", "#3d4045", "#d48c2a"],
    ["#192841", "#8b5a2b", "#2b2d2f"],
    ["#b8a9c9", "#8c9298", "#e8cf7d"],
    ["#1f4e99", "#f7f5f0", "#d96b27"],
    ["#7a9a7e", "#e8b4b8", "#2d3134"],
    ["#7c5238", "#55718c", "#c9964c"],
  ];
  const [c1, c2, c3] = palettes[idx % palettes.length];
  const offset = (idx + 1) * 19 + variant * 13;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#faf8f3"/>
    <ellipse cx="${Math.round(width * 0.48) + (offset % 31)}" cy="${Math.round(height * 0.42)}" rx="${Math.round(width * 0.26)}" ry="${Math.round(height * 0.28)}" fill="${c1}" fill-opacity="0.32"/>
    <ellipse cx="${Math.round(width * 0.54)}" cy="${Math.round(height * 0.62)}" rx="${Math.round(width * 0.22)}" ry="${Math.round(height * 0.22)}" fill="${c2}" fill-opacity="0.38"/>
    <circle cx="${Math.round(width * 0.49)}" cy="${Math.round(height * 0.28)}" r="${Math.round(width * 0.11)}" fill="${c3}" fill-opacity="0.22" stroke="#1b1917" stroke-width="5"/>
    <path d="M ${Math.round(width * 0.32)} ${Math.round(height * 0.78)} Q ${Math.round(width * 0.5)} ${Math.round(height * 0.45 + (offset % 43))} ${Math.round(width * 0.68)} ${Math.round(height * 0.82)}" fill="none" stroke="#1b1917" stroke-width="6"/>
  </svg>`;

  const png = await sharp(Buffer.from(svg, "utf8")).png({ compressionLevel: 9 }).toBuffer();
  return new Uint8Array(png);
}

export type FailedAttemptEntry = {
  attemptId: string;
  conceptId: string;
  attemptNumber: number;
  stage: "generate" | "download" | "decode" | "publish";
  timestamp: string;
  model: string;
  endpoint: string;
  requestId: string;
  status?: number;
  redactedError: string;
};

export type DecodedCandidateEntry = {
  attemptId: string;
  conceptId: string;
  attemptNumber: number;
  createdAt: string;
  model: string;
  endpoint: string;
  requestId: string;
  promptSha256: string;
  promptPackSha256: string;
  settingsSha256: string;
  referenceSha256: string;
  seed: "not supported" | string;
  ephemeralUrl?: string;
  candidateSha256: string;
  masterFilename: RequiredMasterFilename;
  masterPath: string;
  masterSha256: string;
  masterBytes: number;
  nativeWidth: number;
  nativeHeight: number;
  derivativeFilename: string;
  derivativePath: string;
  derivativeSha256: string;
  derivativeBytes: number;
  derivativeWidth: number;
  derivativeHeight: number;
  resolutionLimitation?: string;
  review: {
    disposition: "accepted" | "rejected" | "pending";
    reviewer: string;
    reviewedAt: string;
    notes?: string;
  };
};

export type PublishedAssetEntry = {
  attemptId: string;
  conceptId: string;
  publishedAt: string;
  master: PortraitAssetArtifact & { mimeType: "image/png" };
  derivative: PortraitAssetArtifact & { mimeType: "image/jpeg" };
  verifiedAnonymousDownload: boolean;
};

export type AttemptLedger = {
  version: 1;
  updatedAt: string;
  failedRequests: FailedAttemptEntry[];
  decodedCandidates: DecodedCandidateEntry[];
  publishedAssets: PublishedAssetEntry[];
  activatedRecords: PortraitRecord[];
};

export function createEmptyLedger(): AttemptLedger {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    failedRequests: [],
    decodedCandidates: [],
    publishedAssets: [],
    activatedRecords: [],
  };
}

export function loadLedger(ledgerPath: string): AttemptLedger {
  if (!existsSync(ledgerPath)) {
    return createEmptyLedger();
  }
  const raw = JSON.parse(readFileSync(ledgerPath, "utf8")) as AttemptLedger;
  return {
    version: 1,
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    failedRequests: Array.isArray(raw.failedRequests) ? raw.failedRequests : [],
    decodedCandidates: Array.isArray(raw.decodedCandidates) ? raw.decodedCandidates : [],
    publishedAssets: Array.isArray(raw.publishedAssets) ? raw.publishedAssets : [],
    activatedRecords: Array.isArray(raw.activatedRecords) ? raw.activatedRecords : [],
  };
}

export function saveLedger(ledgerPath: string, ledger: AttemptLedger): void {
  ledger.updatedAt = new Date().toISOString();
  const dir = resolve(ledgerPath, "..");
  mkdirSync(dir, { recursive: true });
  const redactedJson = redactSecrets(JSON.stringify(ledger, null, 2));
  writeFileSync(ledgerPath, `${redactedJson}\n`, "utf8");
}

function countGenerationAttempts(ledger: AttemptLedger, conceptId: string): number {
  const failedGen = ledger.failedRequests.filter(
    (f) => f.conceptId === conceptId && (f.stage === "generate" || f.stage === "download" || f.stage === "decode"),
  ).length;
  const decodedGen = ledger.decodedCandidates.filter(
    (d) => d.conceptId === conceptId && d.endpoint !== "import",
  ).length;
  return failedGen + decodedGen;
}

export async function runGenerationWorkflow(options: {
  publisher: ImagePublisher;
  ledgerPath: string;
  outDir: string;
  promptsPath?: string;
  conceptIds?: string[];
  model?: string;
  quality?: "low" | "medium" | "auto";
  referenceImageUrl?: string;
  acceptAllForTest?: boolean;
}): Promise<{ ledger: AttemptLedger }> {
  const pack = loadPromptPack(options.promptsPath);
  const ledger = loadLedger(options.ledgerPath);
  mkdirSync(options.outDir, { recursive: true });

  const model = options.model ?? DEFAULT_XAI_MODEL;
  const settingsObj = {
    model,
    aspect_ratio: DEFAULT_ASPECT_RATIO,
    resolution: DEFAULT_RESOLUTION,
    quality: options.quality ?? "auto",
    referenceMode: options.referenceImageUrl ? "edit" : "generation",
  };
  const settingsSha256 = sha256Hex(JSON.stringify(settingsObj));
  const referenceSha256 = options.referenceImageUrl ? sha256Hex(options.referenceImageUrl) : "none";

  const selectedConcepts: PortraitConcept[] = options.conceptIds
    ? pack.concepts.filter((c) => options.conceptIds!.includes(c.conceptId))
    : pack.concepts;

  for (const concept of selectedConcepts) {
    // Resume from an existing non-rejected decoded candidate whose files are intact
    const reusable = ledger.decodedCandidates.find(
      (c) =>
        c.conceptId === concept.conceptId &&
        c.review.disposition !== "rejected" &&
        existsSync(c.masterPath) &&
        existsSync(c.derivativePath),
    );
    if (reusable) {
      if (options.acceptAllForTest && reusable.review.disposition !== "accepted") {
        reusable.review = {
          disposition: "accepted",
          reviewer: "automated-test",
          reviewedAt: new Date().toISOString(),
        };
        saveLedger(options.ledgerPath, ledger);
      }
      continue;
    }

    const usedAttempts = countGenerationAttempts(ledger, concept.conceptId);
    if (usedAttempts >= MAX_ATTEMPTS_PER_CONCEPT) {
      throw new Error(
        `Attempt budget exhausted for ${concept.conceptId}: ${usedAttempts}/${MAX_ATTEMPTS_PER_CONCEPT} attempts already recorded`,
      );
    }

    const attemptNumber = usedAttempts + 1;
    const attemptId = `${concept.conceptId}-attempt-${attemptNumber}`;
    let genRes: GenerateImageResponse;

    try {
      genRes = await options.publisher.generate({
        conceptId: concept.conceptId,
        prompt: concept.fullPrompt,
        model,
        aspectRatio: DEFAULT_ASPECT_RATIO,
        resolution: DEFAULT_RESOLUTION,
        quality: options.quality,
        referenceImageUrl: options.referenceImageUrl,
      });
    } catch (err) {
      const httpErr = err instanceof PublisherHttpError ? err : null;
      ledger.failedRequests.push({
        attemptId,
        conceptId: concept.conceptId,
        attemptNumber,
        stage: "generate",
        timestamp: new Date().toISOString(),
        model,
        endpoint: options.referenceImageUrl ? "/v1/images/edits" : "/v1/images/generations",
        requestId: httpErr?.requestId ?? "none",
        status: httpErr?.status,
        redactedError: redactSecrets(err instanceof Error ? err.message : String(err)),
      });
      saveLedger(options.ledgerPath, ledger);
      throw err;
    }

    // Download raw candidate bytes if not inline b64_json
    let rawBytes: Uint8Array;
    try {
      if (genRes.b64Json) {
        const cleanB64 = genRes.b64Json.includes(",") ? genRes.b64Json.split(",", 2)[1] : genRes.b64Json;
        rawBytes = new Uint8Array(Buffer.from(cleanB64, "base64"));
      } else if (genRes.ephemeralUrl) {
        const fetched = await options.publisher.fetchArtifact(genRes.ephemeralUrl);
        rawBytes = fetched.bytes;
      } else {
        throw new Error("Neither b64_json nor ephemeralUrl was returned");
      }
    } catch (err) {
      ledger.failedRequests.push({
        attemptId,
        conceptId: concept.conceptId,
        attemptNumber,
        stage: "download",
        timestamp: new Date().toISOString(),
        model: genRes.model,
        endpoint: genRes.endpoint,
        requestId: genRes.requestId,
        redactedError: redactSecrets(err instanceof Error ? err.message : String(err)),
      });
      saveLedger(options.ledgerPath, ledger);
      throw err;
    }

    // Decode and convert to PNG master + JPEG derivative
    let processed: ProcessedCandidate;
    try {
      processed = await processCandidateImage(rawBytes);
      const duplicate = ledger.decodedCandidates.find(
        (existing) =>
          existing.conceptId !== concept.conceptId &&
          (existing.candidateSha256 === processed.candidateSha256 ||
            existing.masterSha256 === processed.masterSha256 ||
            existing.derivativeSha256 === processed.derivativeSha256),
      );
      if (duplicate) {
        throw new Error(
          `Duplicate candidate/master bytes detected between ${concept.conceptId} and ${duplicate.conceptId} (${processed.candidateSha256})`,
        );
      }
    } catch (err) {
      ledger.failedRequests.push({
        attemptId,
        conceptId: concept.conceptId,
        attemptNumber,
        stage: "decode",
        timestamp: new Date().toISOString(),
        model: genRes.model,
        endpoint: genRes.endpoint,
        requestId: genRes.requestId,
        redactedError: redactSecrets(err instanceof Error ? err.message : String(err)),
      });
      saveLedger(options.ledgerPath, ledger);
      throw err;
    }

    const masterPath = join(options.outDir, concept.masterFilename);
    const derivativePath = join(options.outDir, concept.derivativeFilename);
    writeFileSync(masterPath, processed.masterBytes);
    writeFileSync(derivativePath, processed.derivativeBytes);

    ledger.decodedCandidates.push({
      attemptId,
      conceptId: concept.conceptId,
      attemptNumber,
      createdAt: genRes.createdAt,
      model: genRes.model,
      endpoint: genRes.endpoint,
      requestId: genRes.requestId,
      promptSha256: concept.promptSha256,
      promptPackSha256: pack.promptPackSha256,
      settingsSha256,
      referenceSha256,
      seed: genRes.seed,
      ephemeralUrl: genRes.ephemeralUrl,
      candidateSha256: processed.candidateSha256,
      masterFilename: concept.masterFilename,
      masterPath,
      masterSha256: processed.masterSha256,
      masterBytes: processed.masterBytes.byteLength,
      nativeWidth: processed.nativeWidth,
      nativeHeight: processed.nativeHeight,
      derivativeFilename: concept.derivativeFilename,
      derivativePath,
      derivativeSha256: processed.derivativeSha256,
      derivativeBytes: processed.derivativeBytes.byteLength,
      derivativeWidth: processed.derivativeWidth,
      derivativeHeight: processed.derivativeHeight,
      resolutionLimitation: processed.resolutionLimitation,
      review: {
        disposition: options.acceptAllForTest ? "accepted" : "pending",
        reviewer: options.acceptAllForTest ? "automated-test" : "pending-visual-review",
        reviewedAt: new Date().toISOString(),
      },
    });
    saveLedger(options.ledgerPath, ledger);
  }

  return { ledger };
}

export async function runImportWorkflow(options: {
  inputDir: string;
  outDir: string;
  ledgerPath: string;
  promptsPath?: string;
  model?: string;
  reviewer?: string;
  accept?: boolean;
}): Promise<{ ledger: AttemptLedger }> {
  const pack = loadPromptPack(options.promptsPath);
  const ledger = loadLedger(options.ledgerPath);
  mkdirSync(options.outDir, { recursive: true });

  const model = options.model ?? DEFAULT_XAI_MODEL;
  const settingsSha256 = sha256Hex(
    JSON.stringify({ model, source: "import", aspect_ratio: DEFAULT_ASPECT_RATIO }),
  );

  for (const concept of pack.concepts) {
    const sourcePath = join(options.inputDir, concept.masterFilename);
    if (!existsSync(sourcePath)) {
      throw new Error(`Missing required master file for import: ${sourcePath}`);
    }
    const rawBytes = new Uint8Array(readFileSync(sourcePath));
    const processed = await processCandidateImage(rawBytes);

    const duplicate = ledger.decodedCandidates.find(
      (existing) =>
        existing.conceptId !== concept.conceptId &&
        (existing.candidateSha256 === processed.candidateSha256 ||
          existing.masterSha256 === processed.masterSha256 ||
          existing.derivativeSha256 === processed.derivativeSha256),
    );
    if (duplicate) {
      throw new Error(
        `Duplicate imported bytes detected between ${concept.conceptId} and ${duplicate.conceptId}`,
      );
    }

    const masterPath = join(options.outDir, concept.masterFilename);
    const derivativePath = join(options.outDir, concept.derivativeFilename);
    writeFileSync(masterPath, processed.masterBytes);
    writeFileSync(derivativePath, processed.derivativeBytes);

    const attemptId = `${concept.conceptId}-import-1`;
    ledger.decodedCandidates = ledger.decodedCandidates.filter((c) => c.conceptId !== concept.conceptId);
    ledger.decodedCandidates.push({
      attemptId,
      conceptId: concept.conceptId,
      attemptNumber: 1,
      createdAt: new Date().toISOString(),
      model,
      endpoint: "import",
      requestId: attemptId,
      promptSha256: concept.promptSha256,
      promptPackSha256: pack.promptPackSha256,
      settingsSha256,
      referenceSha256: pack.referenceSha256,
      seed: "not supported",
      candidateSha256: processed.candidateSha256,
      masterFilename: concept.masterFilename,
      masterPath,
      masterSha256: processed.masterSha256,
      masterBytes: processed.masterBytes.byteLength,
      nativeWidth: processed.nativeWidth,
      nativeHeight: processed.nativeHeight,
      derivativeFilename: concept.derivativeFilename,
      derivativePath,
      derivativeSha256: processed.derivativeSha256,
      derivativeBytes: processed.derivativeBytes.byteLength,
      derivativeWidth: processed.derivativeWidth,
      derivativeHeight: processed.derivativeHeight,
      resolutionLimitation: processed.resolutionLimitation,
      review: {
        disposition: options.accept ? "accepted" : "pending",
        reviewer: options.reviewer ?? "importer",
        reviewedAt: new Date().toISOString(),
      },
    });
    saveLedger(options.ledgerPath, ledger);
  }

  return { ledger };
}

export async function runPublishWorkflow(options: {
  publisher: ImagePublisher;
  ledgerPath: string;
  manifestPath?: string;
  promptsPath?: string;
}): Promise<{ ledger: AttemptLedger; records: PortraitRecord[] }> {
  const pack = loadPromptPack(options.promptsPath);
  const ledger = loadLedger(options.ledgerPath);
  const records: PortraitRecord[] = [];

  for (const concept of pack.concepts) {
    const accepted = ledger.decodedCandidates.find(
      (c) => c.conceptId === concept.conceptId && c.review.disposition === "accepted",
    );
    if (!accepted) {
      throw new Error(
        `Cannot publish collection: concept "${concept.conceptId}" (${concept.masterFilename}) does not have an accepted candidate`,
      );
    }

    // Resume from an already published asset if hashes match
    let published = ledger.publishedAssets.find(
      (p) =>
        p.conceptId === concept.conceptId &&
        p.attemptId === accepted.attemptId &&
        p.master.sha256 === accepted.masterSha256 &&
        p.derivative.sha256 === accepted.derivativeSha256,
    );

    if (!published) {
      if (!existsSync(accepted.masterPath) || !existsSync(accepted.derivativePath)) {
        throw new Error(`Missing encoded files on disk for ${concept.conceptId}`);
      }
      const masterBytes = new Uint8Array(readFileSync(accepted.masterPath));
      const derivativeBytes = new Uint8Array(readFileSync(accepted.derivativePath));

      try {
        const masterReceipt = await options.publisher.publish({
          filename: concept.masterFilename,
          bytes: masterBytes,
          mimeType: "image/png",
        });
        const derivativeReceipt = await options.publisher.publish({
          filename: concept.derivativeFilename,
          bytes: derivativeBytes,
          mimeType: "image/jpeg",
        });

        // Anonymous download verification before recording as verified
        const anonMaster = await options.publisher.fetchArtifact(masterReceipt.publicUrl, { authenticated: false });
        if (anonMaster.sha256 !== accepted.masterSha256 || anonMaster.bytes.byteLength !== accepted.masterBytes) {
          throw new Error(`Anonymous download hash mismatch for master ${concept.masterFilename}`);
        }
        const anonDeriv = await options.publisher.fetchArtifact(derivativeReceipt.publicUrl, { authenticated: false });
        if (anonDeriv.sha256 !== accepted.derivativeSha256 || anonDeriv.bytes.byteLength !== accepted.derivativeBytes) {
          throw new Error(`Anonymous download hash mismatch for derivative ${concept.derivativeFilename}`);
        }

        published = {
          attemptId: accepted.attemptId,
          conceptId: concept.conceptId,
          publishedAt: new Date().toISOString(),
          master: {
            ...masterReceipt,
            mimeType: "image/png",
            width: accepted.nativeWidth,
            height: accepted.nativeHeight,
          },
          derivative: {
            ...derivativeReceipt,
            mimeType: "image/jpeg",
            width: accepted.derivativeWidth,
            height: accepted.derivativeHeight,
          },
          verifiedAnonymousDownload: true,
        };
        ledger.publishedAssets = ledger.publishedAssets.filter((p) => p.conceptId !== concept.conceptId);
        ledger.publishedAssets.push(published);
        saveLedger(options.ledgerPath, ledger);
      } catch (err) {
        const httpErr = err instanceof PublisherHttpError ? err : null;
        ledger.failedRequests.push({
          attemptId: accepted.attemptId,
          conceptId: concept.conceptId,
          attemptNumber: accepted.attemptNumber,
          stage: "publish",
          timestamp: new Date().toISOString(),
          model: accepted.model,
          endpoint: httpErr?.endpoint ?? "/v1/files",
          requestId: httpErr?.requestId ?? "none",
          status: httpErr?.status,
          redactedError: redactSecrets(err instanceof Error ? err.message : String(err)),
        });
        saveLedger(options.ledgerPath, ledger);
        throw err;
      }
    }

    records.push({
      conceptId: concept.conceptId,
      filename: concept.masterFilename,
      derivativeFilename: concept.derivativeFilename,
      title: concept.title,
      caption: concept.caption,
      attemptId: accepted.attemptId,
      model: accepted.model,
      nativeWidth: accepted.nativeWidth,
      nativeHeight: accepted.nativeHeight,
      candidateSha256: accepted.candidateSha256,
      promptSha256: accepted.promptSha256,
      promptPackSha256: accepted.promptPackSha256,
      settingsSha256: accepted.settingsSha256,
      referenceSha256: accepted.referenceSha256,
      review: accepted.review,
      provenance: {
        provider: "xai",
        fileExpiresAt: null,
        publicUrlExpiresAt: null,
      },
      master: published.master,
      derivative: published.derivative,
    });
  }

  const validation = validatePortraitManifest(records, { requirePeople: true, promptPack: pack });
  if (!validation.valid) {
    throw new Error(`Published manifest failed validation:\n${validation.errors.join("\n")}`);
  }

  ledger.activatedRecords = records;
  saveLedger(options.ledgerPath, ledger);

  if (options.manifestPath) {
    writeFileSync(options.manifestPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }

  return { ledger, records };
}

export type PreflightSummary = {
  ok: boolean;
  sharpVersion: string;
  processorSmokeTest: {
    nativeWidth: number;
    nativeHeight: number;
    derivativeWidth: number;
    derivativeHeight: number;
    derivativeBytes: number;
  };
  adapterConstructed: boolean;
  credentialAvailable: boolean;
  credentialSource: CredentialResolution["source"];
  promptPackConcepts: number;
  promptPackSha256: string;
  referenceSha256: string;
  existingBaseSketchesVerified: number;
  manifestRecordsCount: number;
};

export async function runPreflightCheck(options: {
  promptsPath?: string;
  manifestPath?: string;
  publicDir?: string;
} = {}): Promise<PreflightSummary> {
  // 1. Exercise real sharp processor in locked environment
  const fixturePng = await synthesizeFixturePortraitPng({
    conceptIndex: 0,
    width: 768,
    height: 1024,
    variant: 1,
  });
  const processed = await processCandidateImage(fixturePng);

  // 2. Construct adapter and check credential resolution without printing secrets
  const credential = resolveXaiCredential();
  const publisher = new XaiImagePublisher({ credential });
  const credSummary = publisher.getCredentialSummary();

  // 3. Parse all ten prompts from prompts.md
  const pack = loadPromptPack(options.promptsPath ?? DEFAULT_PROMPTS_PATH);
  if (pack.concepts.length !== 10) {
    throw new Error(`Expected 10 concepts in prompts.md, found ${pack.concepts.length}`);
  }

  // 4. Validate existing 12 base sketch assets on disk
  const publicDir = options.publicDir ?? resolve(import.meta.dirname, "../public");
  for (const sketch of BASE_SKETCHES) {
    const diskPath = join(publicDir, sketch.src);
    if (!existsSync(diskPath)) {
      throw new Error(`Missing base sketch asset on disk: ${diskPath}`);
    }
    const meta = await sharp(readFileSync(diskPath)).metadata();
    if (meta.format !== "jpeg") {
      throw new Error(`Expected JPEG for ${sketch.src}, found ${String(meta.format)}`);
    }
  }

  // 5. Validate current content/portraits.json manifest in offline mode
  const manifestPath = options.manifestPath ?? resolve(import.meta.dirname, "../content/portraits.json");
  const rawManifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  const manifestValidation = validatePortraitManifest(rawManifest, {
    requirePeople: false,
    promptPack: pack,
  });
  if (!manifestValidation.valid) {
    throw new Error(`Manifest validation failed:\n${manifestValidation.errors.join("\n")}`);
  }

  return {
    ok: true,
    sharpVersion: sharp.versions.sharp,
    processorSmokeTest: {
      nativeWidth: processed.nativeWidth,
      nativeHeight: processed.nativeHeight,
      derivativeWidth: processed.derivativeWidth,
      derivativeHeight: processed.derivativeHeight,
      derivativeBytes: processed.derivativeBytes.byteLength,
    },
    adapterConstructed: Boolean(publisher),
    credentialAvailable: credSummary.available,
    credentialSource: credSummary.source,
    promptPackConcepts: pack.concepts.length,
    promptPackSha256: pack.promptPackSha256,
    referenceSha256: pack.referenceSha256,
    existingBaseSketchesVerified: BASE_SKETCHES.length,
    manifestRecordsCount: manifestValidation.records.length,
  };
}
