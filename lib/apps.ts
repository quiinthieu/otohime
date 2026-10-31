import { type SealChoice, type SealShape } from "./hanko.ts";

export const APP_STATUSES = ["idea", "planned", "building", "beta", "released"] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

export const APP_PLATFORMS = ["macos", "cli", "tui", "web", "linux", "ios"] as const;
export type AppPlatform = (typeof APP_PLATFORMS)[number];

export const APP_SWATCHES = ["yellow", "coral", "mint", "blue", "pink"] as const;
export type AppSwatch = (typeof APP_SWATCHES)[number];

export const APP_MOTIFS = ["bento-box", "bonsai-garden", "ledger-book", "sun-dial", "blueprint"] as const;
export type AppMotif = (typeof APP_MOTIFS)[number];

export const MILESTONE_STATES = ["done", "active", "next"] as const;
export type AppMilestoneState = (typeof MILESTONE_STATES)[number];

export const STATUS_META: Record<
  AppStatus,
  { label: string; shortLabel: string; seal: string; shape: SealShape; step: number }
> = {
  idea: { label: "Idea", shortLabel: "Idea", seal: "構想", shape: "round", step: 0 },
  planned: { label: "Planned", shortLabel: "Planned", seal: "計画", shape: "round", step: 1 },
  building: { label: "In development", shortLabel: "Building", seal: "開発", shape: "square", step: 2 },
  beta: { label: "Beta", shortLabel: "Beta", seal: "試作", shape: "square", step: 3 },
  released: { label: "Released", shortLabel: "Released", seal: "公開", shape: "square", step: 4 },
};

export const PLATFORM_META: Record<AppPlatform, { label: string; shortLabel: string }> = {
  macos: { label: "macOS", shortLabel: "macOS" },
  cli: { label: "CLI", shortLabel: "CLI" },
  tui: { label: "TUI", shortLabel: "TUI" },
  web: { label: "Web", shortLabel: "Web" },
  linux: { label: "Linux", shortLabel: "Linux" },
  ios: { label: "iOS", shortLabel: "iOS" },
};

export type AppFeature = {
  title: string;
  detail: string;
};

export type AppInstall = {
  label: string;
  command: string;
  note?: string;
};

export type AppHomebrew = {
  cask?: string;
  formula?: string;
  command: string;
  url?: string;
};

export type AppFollowLink = {
  label: string;
  href: string;
};

export type AppLinks = {
  repo?: string;
  homebrew?: AppHomebrew;
  docs?: string;
  follow?: AppFollowLink;
};

export type AppMilestone = {
  title: string;
  state: AppMilestoneState;
  target?: string;
  note?: string;
};

export type AppChangelogEntry = {
  version: string;
  date: string;
  summary: string;
  highlights?: string[];
};

export type AppIllustration =
  | { kind: "ink"; motif?: AppMotif; alt: string; caption?: string }
  | { kind: "screenshot"; src: string; alt: string; width: number; height: number; caption?: string };

export type AppTerminalFrame = {
  label: string;
  lines: string[];
};

export type AppTerminalPreview =
  | { kind: "niwa-garden"; title: string; command: string; alt: string }
  | { kind: "shiki-drift"; title: string; command: string; alt: string }
  | {
      kind: "frames";
      title: string;
      command: string;
      alt: string;
      intervalMs?: number;
      frames: AppTerminalFrame[];
    };

export type AppManifest = {
  slug: string;
  order?: number;
  featured?: boolean;
  name: string;
  tagline: string;
  description: string[];
  platforms: AppPlatform[];
  status: AppStatus;
  swatch: AppSwatch;
  seal?: { text?: string; shape?: SealShape };
  techStack: string[];
  features: AppFeature[];
  install: AppInstall;
  links: AppLinks;
  illustration: AppIllustration;
  preview?: AppTerminalPreview;
  milestones: AppMilestone[];
  changelog: AppChangelogEntry[];
};

export class AppManifestValidationError extends Error {
  readonly slug?: string;
  readonly field?: string;

  constructor(message: string, options?: { slug?: string; field?: string }) {
    super(message);
    this.name = "AppManifestValidationError";
    this.slug = options?.slug;
    this.field = options?.field;
  }
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set(["constructor", "prototype", "__proto__", "tostring", "valueof"]);
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAILTO_RE = /^mailto:[^\s@?]+@[^\s@?]+\.[^\s@?]+(?:\?[^\s]*)?$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function fail(message: string, slug?: string, field?: string): never {
  const prefix = slug ? `[app:${slug}] ` : "";
  const where = field ? `${field}: ` : "";
  throw new AppManifestValidationError(`${prefix}${where}${message}`, { slug, field });
}

function requireNonEmptyString(
  value: unknown,
  field: string,
  slug?: string,
  opts?: { maxLen?: number; singleLine?: boolean },
): string {
  if (typeof value !== "string") fail("must be a string", slug, field);
  const trimmed = value.trim();
  if (trimmed.length === 0) fail("must be a non-empty string", slug, field);
  if (opts?.singleLine && /[\r\n]/.test(trimmed)) fail("must be a single line", slug, field);
  if (opts?.maxLen && trimmed.length > opts.maxLen) {
    fail(`must be at most ${opts.maxLen} characters (got ${trimmed.length})`, slug, field);
  }
  return trimmed;
}

function optionalNonEmptyString(
  value: unknown,
  field: string,
  slug?: string,
  opts?: { maxLen?: number; singleLine?: boolean },
): string | undefined {
  if (value === undefined) return undefined;
  return requireNonEmptyString(value, field, slug, opts);
}

export function isValidIsoCalendarDate(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1970 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  return day <= daysInMonth;
}

export function validateSafeUrl(
  value: unknown,
  field: string,
  slug?: string,
  opts?: { allowMailto?: boolean },
): string {
  const text = requireNonEmptyString(value, field, slug, { singleLine: true });
  if (/\s/.test(text)) fail("URL must not contain whitespace", slug, field);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    fail(`invalid URL "${text}"`, slug, field);
  }
  if (parsed.protocol === "https:") {
    if (!text.toLowerCase().startsWith("https://") || !parsed.hostname) {
      fail(`URL "${text}" must be a valid https:// address`, slug, field);
    }
    return text;
  }
  if (opts?.allowMailto && parsed.protocol === "mailto:") {
    if (!MAILTO_RE.test(text)) {
      fail(`mailto URL "${text}" must specify a valid recipient address`, slug, field);
    }
    return text;
  }
  const allowed = opts?.allowMailto ? "https:// or mailto:" : "https://";
  fail(`URL "${text}" uses disallowed scheme "${parsed.protocol}" (expected ${allowed})`, slug, field);
}

export function isAppStatus(value: unknown): value is AppStatus {
  return typeof value === "string" && (APP_STATUSES as readonly string[]).includes(value);
}

export function isAppPlatform(value: unknown): value is AppPlatform {
  return typeof value === "string" && (APP_PLATFORMS as readonly string[]).includes(value);
}

export function isAppSwatch(value: unknown): value is AppSwatch {
  return typeof value === "string" && (APP_SWATCHES as readonly string[]).includes(value);
}

export function isAppMotif(value: unknown): value is AppMotif {
  return typeof value === "string" && (APP_MOTIFS as readonly string[]).includes(value);
}

export function validateAppManifest(raw: unknown, expectedSlug?: string): AppManifest {
  if (!isPlainObject(raw)) {
    fail("manifest must be a JSON object", expectedSlug);
  }

  if (raw.$schema !== undefined && typeof raw.$schema !== "string") {
    fail("must be a string when provided", expectedSlug, "$schema");
  }

  const slug = requireNonEmptyString(raw.slug, "slug", expectedSlug, { maxLen: 64, singleLine: true });
  if (!SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) {
    fail(`"${slug}" must be lowercase kebab-case and not a reserved identifier`, expectedSlug ?? slug, "slug");
  }
  if (expectedSlug !== undefined && slug !== expectedSlug) {
    fail(`slug "${slug}" must match filename "${expectedSlug}.json"`, expectedSlug, "slug");
  }

  let order: number | undefined;
  if (raw.order !== undefined) {
    if (typeof raw.order !== "number" || !Number.isFinite(raw.order)) {
      fail("must be a finite number", slug, "order");
    }
    order = raw.order;
  }

  let featured: boolean | undefined;
  if (raw.featured !== undefined) {
    if (typeof raw.featured !== "boolean") fail("must be a boolean", slug, "featured");
    featured = raw.featured;
  }

  const name = requireNonEmptyString(raw.name, "name", slug, { maxLen: 80, singleLine: true });
  const tagline = requireNonEmptyString(raw.tagline, "tagline", slug, { maxLen: 140, singleLine: true });

  if (!Array.isArray(raw.description) || raw.description.length < 1 || raw.description.length > 4) {
    fail("must be an array of 1 to 4 paragraphs", slug, "description");
  }
  const description = raw.description.map((item, i) =>
    requireNonEmptyString(item, `description[${i}]`, slug),
  );

  if (!Array.isArray(raw.platforms) || raw.platforms.length === 0) {
    fail("must be a non-empty array of platforms", slug, "platforms");
  }
  const platforms: AppPlatform[] = [];
  const seenPlatforms = new Set<AppPlatform>();
  raw.platforms.forEach((item, i) => {
    if (!isAppPlatform(item)) {
      fail(`invalid platform "${String(item)}" (expected one of ${APP_PLATFORMS.join(", ")})`, slug, `platforms[${i}]`);
    }
    if (seenPlatforms.has(item)) {
      fail(`duplicate platform "${item}"`, slug, `platforms[${i}]`);
    }
    seenPlatforms.add(item);
    platforms.push(item);
  });

  if (!isAppStatus(raw.status)) {
    fail(`invalid status "${String(raw.status)}" (expected one of ${APP_STATUSES.join(", ")})`, slug, "status");
  }
  const status = raw.status;

  if (!isAppSwatch(raw.swatch)) {
    fail(`invalid swatch "${String(raw.swatch)}" (expected one of ${APP_SWATCHES.join(", ")})`, slug, "swatch");
  }
  const swatch = raw.swatch;

  let seal: AppManifest["seal"];
  if (raw.seal !== undefined) {
    if (!isPlainObject(raw.seal)) fail("must be an object", slug, "seal");
    const text = optionalNonEmptyString(raw.seal.text, "seal.text", slug, { maxLen: 12, singleLine: true });
    let shape: SealShape | undefined;
    if (raw.seal.shape !== undefined) {
      if (raw.seal.shape !== "round" && raw.seal.shape !== "square") {
        fail('must be "round" or "square"', slug, "seal.shape");
      }
      shape = raw.seal.shape;
    }
    seal = { ...(text ? { text } : {}), ...(shape ? { shape } : {}) };
  }

  if (!Array.isArray(raw.techStack) || raw.techStack.length === 0) {
    fail("must be a non-empty array of strings", slug, "techStack");
  }
  const techStack = raw.techStack.map((item, i) =>
    requireNonEmptyString(item, `techStack[${i}]`, slug, { maxLen: 64, singleLine: true }),
  );

  if (!Array.isArray(raw.features) || raw.features.length < 2) {
    fail("must contain at least 2 features", slug, "features");
  }
  const features: AppFeature[] = raw.features.map((item, i) => {
    if (!isPlainObject(item)) fail("must be an object", slug, `features[${i}]`);
    return {
      title: requireNonEmptyString(item.title, `features[${i}].title`, slug, { maxLen: 80, singleLine: true }),
      detail: requireNonEmptyString(item.detail, `features[${i}].detail`, slug),
    };
  });

  if (!isPlainObject(raw.install)) fail("must be an object", slug, "install");
  const installNote = optionalNonEmptyString(raw.install.note, "install.note", slug);
  const install: AppInstall = {
    label: requireNonEmptyString(raw.install.label, "install.label", slug, { maxLen: 64, singleLine: true }),
    command: requireNonEmptyString(raw.install.command, "install.command", slug, { maxLen: 200, singleLine: true }),
    ...(installNote ? { note: installNote } : {}),
  };

  if (!isPlainObject(raw.links)) fail("must be an object", slug, "links");
  const links: AppLinks = {};
  if (raw.links.repo !== undefined) {
    links.repo = validateSafeUrl(raw.links.repo, "links.repo", slug, { allowMailto: false });
  }
  if (raw.links.docs !== undefined) {
    links.docs = validateSafeUrl(raw.links.docs, "links.docs", slug, { allowMailto: false });
  }
  if (raw.links.homebrew !== undefined) {
    if (!isPlainObject(raw.links.homebrew)) fail("must be an object", slug, "links.homebrew");
    const cask = optionalNonEmptyString(raw.links.homebrew.cask, "links.homebrew.cask", slug, {
      maxLen: 80,
      singleLine: true,
    });
    const formula = optionalNonEmptyString(raw.links.homebrew.formula, "links.homebrew.formula", slug, {
      maxLen: 80,
      singleLine: true,
    });
    const command = requireNonEmptyString(raw.links.homebrew.command, "links.homebrew.command", slug, {
      maxLen: 200,
      singleLine: true,
    });
    const url =
      raw.links.homebrew.url !== undefined
        ? validateSafeUrl(raw.links.homebrew.url, "links.homebrew.url", slug, { allowMailto: false })
        : undefined;
    links.homebrew = {
      ...(cask ? { cask } : {}),
      ...(formula ? { formula } : {}),
      command,
      ...(url ? { url } : {}),
    };
  }
  if (raw.links.follow !== undefined) {
    if (!isPlainObject(raw.links.follow)) fail("must be an object", slug, "links.follow");
    links.follow = {
      label: requireNonEmptyString(raw.links.follow.label, "links.follow.label", slug, {
        maxLen: 64,
        singleLine: true,
      }),
      href: validateSafeUrl(raw.links.follow.href, "links.follow.href", slug, { allowMailto: true }),
    };
  }

  if (!isPlainObject(raw.illustration)) fail("must be an object", slug, "illustration");
  let illustration: AppIllustration;
  if (raw.illustration.kind === "ink") {
    let motif: AppMotif | undefined;
    if (raw.illustration.motif !== undefined) {
      if (!isAppMotif(raw.illustration.motif)) {
        fail(
          `invalid motif "${String(raw.illustration.motif)}" (expected one of ${APP_MOTIFS.join(", ")})`,
          slug,
          "illustration.motif",
        );
      }
      motif = raw.illustration.motif;
    }
    const alt = requireNonEmptyString(raw.illustration.alt, "illustration.alt", slug, { singleLine: true });
    const caption = optionalNonEmptyString(raw.illustration.caption, "illustration.caption", slug, {
      singleLine: true,
    });
    illustration = {
      kind: "ink",
      ...(motif ? { motif } : {}),
      alt,
      ...(caption ? { caption } : {}),
    };
  } else if (raw.illustration.kind === "screenshot") {
    const src = requireNonEmptyString(raw.illustration.src, "illustration.src", slug, { singleLine: true });
    if (!src.startsWith("/") || src.startsWith("//") || src.includes("://") || /(?:^|\/)\.\.(?:\/|$)/.test(src)) {
      fail(`screenshot src "${src}" must be a local root-relative path starting with "/"`, slug, "illustration.src");
    }
    const alt = requireNonEmptyString(raw.illustration.alt, "illustration.alt", slug, { singleLine: true });
    const width = raw.illustration.width;
    const height = raw.illustration.height;
    if (typeof width !== "number" || !Number.isInteger(width) || width <= 0) {
      fail("must be a positive integer", slug, "illustration.width");
    }
    if (typeof height !== "number" || !Number.isInteger(height) || height <= 0) {
      fail("must be a positive integer", slug, "illustration.height");
    }
    const caption = optionalNonEmptyString(raw.illustration.caption, "illustration.caption", slug, {
      singleLine: true,
    });
    illustration = {
      kind: "screenshot",
      src,
      alt,
      width,
      height,
      ...(caption ? { caption } : {}),
    };
  } else {
    fail('must have kind "ink" or "screenshot"', slug, "illustration.kind");
  }

  let preview: AppTerminalPreview | undefined;
  if (raw.preview !== undefined) {
    if (!isPlainObject(raw.preview)) fail("must be an object", slug, "preview");
    const title = requireNonEmptyString(raw.preview.title, "preview.title", slug, { maxLen: 100, singleLine: true });
    const command = requireNonEmptyString(raw.preview.command, "preview.command", slug, {
      maxLen: 160,
      singleLine: true,
    });
    const alt = requireNonEmptyString(raw.preview.alt, "preview.alt", slug, { singleLine: true });
    if (raw.preview.kind === "niwa-garden" || raw.preview.kind === "shiki-drift") {
      preview = { kind: raw.preview.kind, title, command, alt };
    } else if (raw.preview.kind === "frames") {
      let intervalMs: number | undefined;
      if (raw.preview.intervalMs !== undefined) {
        if (
          typeof raw.preview.intervalMs !== "number" ||
          !Number.isInteger(raw.preview.intervalMs) ||
          raw.preview.intervalMs < 250 ||
          raw.preview.intervalMs > 60_000
        ) {
          fail("must be an integer between 250 and 60000", slug, "preview.intervalMs");
        }
        intervalMs = raw.preview.intervalMs;
      }
      if (!Array.isArray(raw.preview.frames) || raw.preview.frames.length === 0) {
        fail("must be a non-empty array of terminal frames", slug, "preview.frames");
      }
      const frames: AppTerminalFrame[] = raw.preview.frames.map((frame, i) => {
        if (!isPlainObject(frame)) fail("must be an object", slug, `preview.frames[${i}]`);
        const label = requireNonEmptyString(frame.label, `preview.frames[${i}].label`, slug, {
          maxLen: 80,
          singleLine: true,
        });
        if (!Array.isArray(frame.lines) || frame.lines.length === 0) {
          fail("must be a non-empty array of strings", slug, `preview.frames[${i}].lines`);
        }
        const lines = frame.lines.map((line, j) => {
          if (typeof line !== "string" || /[\r\n]/.test(line)) {
            fail("must be a single-line string", slug, `preview.frames[${i}].lines[${j}]`);
          }
          return line;
        });
        return { label, lines };
      });
      preview = {
        kind: "frames",
        title,
        command,
        alt,
        ...(intervalMs !== undefined ? { intervalMs } : {}),
        frames,
      };
    } else {
      fail('must have kind "niwa-garden", "shiki-drift", or "frames"', slug, "preview.kind");
    }
  }

  if (!Array.isArray(raw.milestones) || raw.milestones.length < 2) {
    fail("must contain at least 2 milestones", slug, "milestones");
  }
  const milestones: AppMilestone[] = raw.milestones.map((item, i) => {
    if (!isPlainObject(item)) fail("must be an object", slug, `milestones[${i}]`);
    const state = item.state;
    if (typeof state !== "string" || !(MILESTONE_STATES as readonly string[]).includes(state)) {
      fail('must be "done", "active", or "next"', slug, `milestones[${i}].state`);
    }
    const target = optionalNonEmptyString(item.target, `milestones[${i}].target`, slug, {
      maxLen: 64,
      singleLine: true,
    });
    const note = optionalNonEmptyString(item.note, `milestones[${i}].note`, slug);
    return {
      title: requireNonEmptyString(item.title, `milestones[${i}].title`, slug, { maxLen: 120, singleLine: true }),
      state: state as AppMilestoneState,
      ...(target ? { target } : {}),
      ...(note ? { note } : {}),
    };
  });

  if (!Array.isArray(raw.changelog) || raw.changelog.length < 1) {
    fail("must contain at least 1 changelog entry", slug, "changelog");
  }
  const changelog: AppChangelogEntry[] = raw.changelog.map((item, i) => {
    if (!isPlainObject(item)) fail("must be an object", slug, `changelog[${i}]`);
    const date = requireNonEmptyString(item.date, `changelog[${i}].date`, slug, { singleLine: true });
    if (!isValidIsoCalendarDate(date)) {
      fail(`"${date}" must be a valid YYYY-MM-DD calendar date`, slug, `changelog[${i}].date`);
    }
    let highlights: string[] | undefined;
    if (item.highlights !== undefined) {
      if (!Array.isArray(item.highlights) || item.highlights.length === 0) {
        fail("must be a non-empty array of strings when provided", slug, `changelog[${i}].highlights`);
      }
      highlights = item.highlights.map((h, j) =>
        requireNonEmptyString(h, `changelog[${i}].highlights[${j}]`, slug),
      );
    }
    return {
      version: requireNonEmptyString(item.version, `changelog[${i}].version`, slug, {
        maxLen: 40,
        singleLine: true,
      }),
      date,
      summary: requireNonEmptyString(item.summary, `changelog[${i}].summary`, slug),
      ...(highlights ? { highlights } : {}),
    };
  });

  return {
    slug,
    ...(order !== undefined ? { order } : {}),
    ...(featured !== undefined ? { featured } : {}),
    name,
    tagline,
    description,
    platforms,
    status,
    swatch,
    ...(seal ? { seal } : {}),
    techStack,
    features,
    install,
    links,
    illustration,
    ...(preview ? { preview } : {}),
    milestones,
    changelog,
  };
}

export function sortApps(apps: readonly AppManifest[]): AppManifest[] {
  return [...apps].sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    const byName = a.name.localeCompare(b.name, "en-US");
    if (byName !== 0) return byName;
    return a.slug.localeCompare(b.slug, "en-US");
  });
}

export type AppFilterCriteria = {
  platform?: AppPlatform | "all" | null;
  status?: AppStatus | "all" | null;
};

export function filterApps(apps: readonly AppManifest[], criteria: AppFilterCriteria = {}): AppManifest[] {
  const { platform, status } = criteria;
  return apps.filter((app) => {
    if (platform && platform !== "all" && !app.platforms.includes(platform)) return false;
    if (status && status !== "all" && app.status !== status) return false;
    return true;
  });
}

export function availablePlatforms(apps: readonly AppManifest[]): AppPlatform[] {
  const present = new Set<AppPlatform>();
  for (const app of apps) {
    for (const platform of app.platforms) present.add(platform);
  }
  return APP_PLATFORMS.filter((platform) => present.has(platform));
}

export type ResolvedFollowAction = {
  primary: { label: string; href: string; kind: "repo" | "follow" | "mailto" };
  secondary?: { label: string; href: string };
};

export const WORKSHOP_SOCIAL_FOLLOW = {
  label: "Follow @otohime73",
  href: "https://x.com/otohime73",
} as const;

export function resolveFollowAction(app: Pick<AppManifest, "name" | "links">): ResolvedFollowAction {
  if (app.links.repo) {
    return {
      primary: { label: "Watch on GitHub", href: app.links.repo, kind: "repo" },
      ...(app.links.follow && app.links.follow.href !== app.links.repo
        ? { secondary: { label: app.links.follow.label, href: app.links.follow.href } }
        : {}),
    };
  }
  if (app.links.follow) {
    const isMailto = app.links.follow.href.toLowerCase().startsWith("mailto:");
    return {
      primary: {
        label: app.links.follow.label,
        href: app.links.follow.href,
        kind: isMailto ? "mailto" : "follow",
      },
      ...(app.links.follow.href !== WORKSHOP_SOCIAL_FOLLOW.href ? { secondary: WORKSHOP_SOCIAL_FOLLOW } : {}),
    };
  }
  return {
    primary: {
      label: "Notify me by email",
      href: `mailto:hello@otohime.dev?subject=${encodeURIComponent(`Notify me: ${app.name}`)}`,
      kind: "mailto",
    },
    secondary: WORKSHOP_SOCIAL_FOLLOW,
  };
}

export function appSealChoice(app: Pick<AppManifest, "status" | "seal">): SealChoice {
  const meta = STATUS_META[app.status];
  return {
    name: app.seal?.text?.trim() ? app.seal.text.trim() : meta.seal,
    shape: app.seal?.shape ?? meta.shape,
  };
}

export function hashAppSlug(slug: string): number {
  let hash = 2166136261;
  for (const ch of slug) {
    hash ^= ch.codePointAt(0)!;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}
