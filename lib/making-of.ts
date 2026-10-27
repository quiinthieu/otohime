// Making-of Emaki handscroll data model, public-field sanitizer, scene builder,
// canonical JSON validator/serializer, and scroll-scrubbed parallax math.
// Pure functions only: no filesystem, no child_process, no network, no clock.

export const ROLE_KEYS = ["research", "product_owner", "software_engineer", "quality_engineer"] as const;
export type AgentRoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_LABELS: Record<AgentRoleKey, string> = {
  research: "Researcher",
  product_owner: "Product Owner",
  software_engineer: "Software Engineer",
  quality_engineer: "Quality Engineer",
};

export type PlanStatus = "done" | "executing" | "paused" | "abandoned" | "rejected";
export type PlanRoleModels = Record<AgentRoleKey, string | null>;
export type PlanRunRecord = {
  title: string;
  summary: string;
  status: PlanStatus;
  shipped: boolean;
  roles: PlanRoleModels;
};

export const SHA_LENGTH = 10;
export const TITLE_MAX = 90;
export const SUMMARY_MAX = 160;
export const SUBJECT_MAX = 100;
export const AREAS_MAX = 3;
export const MAX_SCENES = 200;
export const MAX_COMMITS_PER_SCENE = 100_000;
export const GITHUB_REPO_URL = "https://github.com/quiinthieu/otohime";

export type MakingOfRole = {
  role: AgentRoleKey;
  label: string;
  modelId: string;
};

export type MakingOfScene = {
  planId: string;
  title: string;
  date: string; // YYYY-MM-DD in UTC
  sha: string; // 10-char lowercase hex SHA
  commitUrl: string; // https://github.com/quiinthieu/otohime/commit/<sha>
  commitCount: number;
  areas: string[];
  roles: MakingOfRole[];
  summary: string;
};

export type MakingOfSnapshot = {
  version: 1;
  head: string | null; // 40-char lowercase hex SHA of newest indexed non-merge commit, or null when empty
  scenes: MakingOfScene[];
};

export type MakingOfCommitInput = {
  sha: string;
  date: string;
  plan?: string | null;
  task?: string | null;
  subject: string;
  areas?: readonly string[];
  paths?: readonly string[];
};

export type PlanMetadataInput = {
  planId?: string;
  title?: string;
  summary?: string;
  status?: PlanStatus;
  shipped?: boolean;
  roles?: Partial<Record<AgentRoleKey, string | null>> | readonly Partial<MakingOfRole>[];
};

export type BuildMakingOfInput = {
  head?: string | null;
  commits?: readonly MakingOfCommitInput[];
  plans?: Readonly<Record<string, PlanMetadataInput>> | readonly PlanMetadataInput[];
  fallback?: MakingOfSnapshot | null;
};

export type EmakiParallaxState = {
  progress: number; // clamped 0..1
  translateXPx: number; // <= 0 horizontal track translation in px (0 when reducedMotion is true)
  cloudOffsetPx: number; // background sumi cloud layer translation in px (0 when reducedMotion is true)
  pineWaveOffsetPx: number; // midground pine/wave layer translation in px (0 when reducedMotion is true)
  figurePassPhase: number; // 0..1 scroll handoff phase across the 4 figures (0 when reducedMotion is true)
  activeSceneIndex: number; // 0..max(0, sceneCount - 1)
  activeRoleIndex: number; // 0..3 index into ROLE_KEYS
};

export const EMPTY_MAKING_OF: MakingOfSnapshot = {
  version: 1,
  head: null,
  scenes: [],
};

const PREFIX = /^(pm-\d+)\/([A-Za-z0-9_-]+):\s*/;
const PLAN_ID_RE = /^pm-\d+$/;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const FULL_SHA_RE = /^[0-9a-f]{40}$/;
const SHORT_SHA_RE = new RegExp(`^[0-9a-f]{${SHA_LENGTH}}$`);
const HEX_SHA_RE = new RegExp(`^[0-9a-f]{${SHA_LENGTH},40}$`);
const COMMIT_URL_RE = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/commit\/([0-9a-f]{10,40})$/;
const MODEL_ID_RE = /^[a-z0-9][a-z0-9._-]{1,47}$/;

// Patterns that must never appear in public fields (emails, tokens, credentials, local workstation/log paths).
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const ANGLE_EMAIL_RE = /<[^>\s]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}>/g;
const TRAILER_RE = /\bCo-Authored-By:[^\n]*/gi;
const TOKEN_RE =
  /\b(?:gh[pousr]_[A-Za-z0-9_]{6,}|github_pat_[A-Za-z0-9_]{6,}|sk-(?:ant-|proj-)?[A-Za-z0-9_-]{6,}|xox[baprs]-[A-Za-z0-9-]{6,}|Bearer\s+[A-Za-z0-9._~+/=-]{6,}|(?:api[_-]?key|access[_-]?token|auth[_-]?token|token|secret|password)\s*[:=]\s*\S+)/gi;
const PRIVATE_PATH_RE =
  /(?:\/(?:home|Users|var\/log|data\/build-worker|tmp|private\/var)\/[^\s,;)"']+|(?:postgres(?:ql)?|redis|mysql):\/\/[^\s,;)"']+)/gi;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isCount = (v: unknown, min = 0, max = MAX_COMMITS_PER_SCENE): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
const hasKeys = (v: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(v).length === keys.length && keys.every((k) => k in v);

export function isAgentRoleKey(v: unknown): v is AgentRoleKey {
  return typeof v === "string" && (ROLE_KEYS as readonly string[]).includes(v);
}

export function isoSecond(date: string): string | null {
  if (typeof date !== "string" || DAY_RE.test(date.trim())) return null;
  const ms = Date.parse(date);
  return Number.isFinite(ms) ? new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z") : null;
}

export function utcDayOf(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  const m = DAY_RE.exec(trimmed);
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return d.toISOString().slice(0, 10) === trimmed ? trimmed : null;
  }
  const iso = isoSecond(trimmed);
  return iso ? iso.slice(0, 10) : null;
}

export function splitPrefix(raw: string): { plan: string | null; task: string | null; subject: string } {
  const m = PREFIX.exec(raw);
  return m ? { plan: m[1], task: m[2], subject: raw.slice(m[0].length) } : { plan: null, task: null, subject: raw };
}

export function cleanSubject(raw: string, max = SUBJECT_MAX): string {
  const s = raw.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim();
  const chars = [...s];
  return chars.length <= max ? s : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

export function containsPrivateData(text: string): boolean {
  if (typeof text !== "string" || !text) return false;
  EMAIL_RE.lastIndex = 0;
  ANGLE_EMAIL_RE.lastIndex = 0;
  TRAILER_RE.lastIndex = 0;
  TOKEN_RE.lastIndex = 0;
  PRIVATE_PATH_RE.lastIndex = 0;
  return (
    EMAIL_RE.test(text) ||
    ANGLE_EMAIL_RE.test(text) ||
    TRAILER_RE.test(text) ||
    TOKEN_RE.test(text) ||
    PRIVATE_PATH_RE.test(text)
  );
}

// Strips emails, Co-Authored-By trailers, secret tokens, and private workstation/log paths,
// then normalizes whitespace and caps length at `max`.
export function sanitizePublicText(raw: unknown, max = SUBJECT_MAX): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw
    .replace(TRAILER_RE, " ")
    .replace(ANGLE_EMAIL_RE, " ")
    .replace(EMAIL_RE, " ")
    .replace(TOKEN_RE, " ")
    .replace(PRIVATE_PATH_RE, " ")
    .replace(/\(\s*\)/g, " ");
  return cleanSubject(cleaned, max);
}

// Normalizes a model identifier to a safe public slug; returns `fallbackModel` (null by default) when empty or unsafe.
// Never defaults to an invented model identifier unless the caller explicitly provides a string fallback.
export function sanitizeModelId(raw: unknown): string | null;
export function sanitizeModelId(raw: unknown, fallbackModel: string): string;
export function sanitizeModelId(raw: unknown, fallbackModel: string | null): string | null;
export function sanitizeModelId(raw: unknown, fallbackModel: string | null = null): string | null {
  if (typeof raw !== "string") return fallbackModel;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || containsPrivateData(trimmed)) return fallbackModel;
  const normalized = trimmed
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^-+|-+$/g, "");
  if (!MODEL_ID_RE.test(normalized)) return fallbackModel;
  return normalized;
}

// Normalizes recorded per-role models into canonical ROLE_KEYS order.
// Roles with null, undefined, or invalid model IDs are omitted rather than filled from static defaults.
export function normalizeRoles(
  input?: Partial<Record<AgentRoleKey, string | null | undefined>> | readonly Partial<MakingOfRole>[] | null,
): MakingOfRole[] {
  const byRole = new Map<AgentRoleKey, { label?: string; modelId?: string }>();
  if (Array.isArray(input)) {
    for (const item of input) {
      if (!isRecord(item) || !isAgentRoleKey(item.role)) continue;
      if (typeof item.modelId !== "string") continue;
      byRole.set(item.role, {
        label: typeof item.label === "string" ? item.label : undefined,
        modelId: item.modelId,
      });
    }
  } else if (isRecord(input)) {
    for (const key of ROLE_KEYS) {
      const val = input[key];
      if (typeof val === "string") {
        byRole.set(key, { modelId: val });
      }
    }
  }

  const out: MakingOfRole[] = [];
  for (const role of ROLE_KEYS) {
    const custom = byRole.get(role);
    if (!custom) continue;
    const modelId = sanitizeModelId(custom.modelId);
    if (!modelId) continue;
    const defaultLabel = ROLE_LABELS[role];
    const cleanLabel = custom.label ? sanitizePublicText(custom.label, 32) : "";
    out.push({
      role,
      label: cleanLabel || defaultLabel,
      modelId,
    });
  }
  return out;
}

export function commitUrlFor(sha: string): string {
  const short = sha.trim().toLowerCase().slice(0, SHA_LENGTH);
  return `${GITHUB_REPO_URL}/commit/${short}`;
}

export function areaOf(path: string): string {
  const p = path.replace(/^"|"$/g, "").trim();
  const parts = p.split("/").filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts[0] === "app" && parts.length > 2) return `app/${parts[1]}`;
  return parts[0];
}

export function summarizeAreas(paths: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const p of paths) {
    const area = areaOf(p);
    if (!area || area === ".agent-artifacts" || containsPrivateData(area)) continue;
    counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, AREAS_MAX)
    .map(([area]) => area);
}

// Associative area merge across newest-to-oldest commits in a plan: preserves first-seen order up to AREAS_MAX.
export function mergeAreas(areaLists: readonly (readonly string[])[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of areaLists) {
    for (const raw of list) {
      if (typeof raw !== "string") continue;
      const area = raw.trim();
      if (!area || area === ".agent-artifacts" || containsPrivateData(area) || seen.has(area)) continue;
      seen.add(area);
      out.push(area);
      if (out.length === AREAS_MAX) return out;
    }
  }
  return out;
}

// Extracts public plan metadata (planId, title, summary, role model IDs) from a `projects/*/plan.md` document.
export function parsePlanMarkdown(markdown: string): (PlanMetadataInput & { planId: string }) | null {
  if (typeof markdown !== "string" || !markdown.trim()) return null;
  const h1Match = /^#\s+(.+)$/m.exec(markdown);
  if (!h1Match) return null;
  const rawH1 = h1Match[1].trim();

  const headerSlice = markdown.slice(0, 2000);
  const h1EndPm =
    /\((pm-\d+)(?:\s*·[^)]*)?\)\s*$/.exec(rawH1)?.[1] ??
    /^Plan\s+(pm-\d+):/i.exec(rawH1)?.[1] ??
    /[—–-]\s*(pm-\d+)\s*$/.exec(rawH1)?.[1];
  const bodyPm =
    /(?:^|\n)Plan(?:\s+id)?\s*:?\s*[`*]*?(pm-\d+)\b/i.exec(headerSlice)?.[1] ??
    /Execution plan for\s+\*\*(pm-\d+)\*\*/i.exec(headerSlice)?.[1] ??
    /subjects\s+start\s+`?(pm-\d+)\//i.exec(headerSlice)?.[1];
  const planId = (h1EndPm ?? bodyPm)?.toLowerCase();
  if (!planId || !PLAN_ID_RE.test(planId)) return null;

  const rawTitle = rawH1
    .replace(/^Plan\s+pm-\d+:\s*/i, "")
    .replace(/\s*\(pm-\d+(?:\s*·[^)]*)?\)\s*$/i, "")
    .replace(/\s*[—–-]\s*pm-\d+\s*$/i, "")
    .trim();
  const title = sanitizePublicText(rawTitle, TITLE_MAX);
  if (!title) return null;

  // Extract a concise public summary from **Product.**, ## Outcome, or the first descriptive paragraph.
  let summary = "";
  const productMatch = /\*\*Product\.\*\*\s*([^\n]+(?:\n(?![#\n*])[^\n]+)*)/.exec(markdown);
  if (productMatch) {
    const firstSentence = productMatch[1].replace(/[`*]/g, "").split(/(?<=[.!?])\s+/)[0] ?? productMatch[1];
    summary = sanitizePublicText(firstSentence, SUMMARY_MAX);
  }
  if (!summary) {
    const outcomeSection = /##\s+Outcome[^\n]*\n+([\s\S]{1,800}?)(?:\n##\s|$)/i.exec(markdown);
    if (outcomeSection) {
      const lines = outcomeSection[1]
        .split("\n")
        .map((l) => l.replace(/^[-*0-9.)\s]+/, "").replace(/[`*]/g, "").trim())
        .filter((l) => l.length > 20 && !l.startsWith("|"));
      if (lines[0]) {
        const firstSentence = lines[0].split(/(?<=[.!?])\s+/)[0] ?? lines[0];
        summary = sanitizePublicText(firstSentence, SUMMARY_MAX);
      }
    }
  }

  const roles: Partial<Record<AgentRoleKey, string>> = {};
  const poModelMatch =
    /\b(claude-(?:opus|sonnet|haiku|fable)-\d-\d|gpt-\d(?:\.\d)?-(?:sol|luna)|gemini-\d(?:\.\d)?-[a-z0-9-]+)\b/i.exec(
      markdown.slice(0, 600),
    );
  if (poModelMatch) {
    const poModel = sanitizeModelId(poModelMatch[1]);
    if (poModel) roles.product_owner = poModel;
  }

  return {
    planId,
    title,
    ...(summary ? { summary } : {}),
    ...(Object.keys(roles).length > 0 ? { roles } : {}),
  };
}

// Authoritative plan-manager run history for otohime.dev (`plans` + `runs.profile_flags --model`).
// A plan is shipped when its status is `done`, or when it is the active plan `pm-293` shipping `/making-of`.
// Roles that did not execute on a plan have `null` and are omitted from `scene.roles` rather than defaulted.
export const PLAN_RUN_HISTORY: Readonly<Record<string, PlanRunRecord>> = {
  // --- 34 shipped plans (`pm-293` + 33 `done` plans) ---
  "pm-293": {
    title: "Washi Daruma, Emaki, and Hanafuda",
    summary:
      "Three paper-and-ink experiments backed by a shared 12-month shipped digest: Daruma Kuyo shelf, Making-of Emaki handscroll, and Hanafuda Koi-Koi.",
    status: "executing",
    shipped: true,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gemini-4-argon-medium",
      software_engineer: "gemini-4-argon-high",
      quality_engineer: "gemini-4-argon-medium",
    },
  },
  "pm-272": {
    title: "ListenBrainz & Lanyard Pocket Presence",
    summary: "Live ListenBrainz cassette rotation and optional Lanyard presence in the Pocket console.",
    status: "done",
    shipped: true,
    roles: {
      research: null,
      product_owner: null,
      software_engineer: "gpt-6.1-sol",
      quality_engineer: "gpt-6.1-sol",
    },
  },
  "pm-270": {
    title: "Main Lane Throughput",
    summary: "Authenticated deployment readiness probes, callback-flushed gate output, and TMPDIR socket normalization.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "gemini-4-argon-high",
      software_engineer: "gpt-6.1-sol",
      quality_engineer: "claude-sonnet-5-5",
    },
  },
  "pm-264": {
    title: "Peep-box Karinszoki Diorama",
    summary: "Layered paper peep-box stage driven by pointer tilt, device orientation, and opt-in head tracking.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gpt-6.1-sol",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "gpt-6-sol",
    },
  },
  "pm-259": {
    title: "Kame Fetch Recovery",
    summary: "Paper turtle companion walking the margin and crumpled-paper 404 toss game.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gpt-6.1-sol",
      software_engineer: "gpt-6.1-sol",
      quality_engineer: "gpt-6-sol",
    },
  },
  "pm-258": {
    title: "Keyless Pocket Presence",
    summary: "Zero-key public presence fallbacks and gate closure verification CLI.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "gpt-6.1-sol",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "gpt-6.1-sol",
    },
  },
  "pm-256": {
    title: "Otohime's Undersea Palace",
    summary: "Hidden Ryugu-jo undersea palace with ink-wash water caustics, fleeing fish, and the Tamatebako time box.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gpt-6-luna",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-255": {
    title: "Ask Console Tier Probe",
    summary: "Read-only verification probes and rate-tier checks for the Pocket Ask route.",
    status: "done",
    shipped: true,
    roles: {
      research: null,
      product_owner: "claude-haiku-5-5",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-sonnet-5-5",
    },
  },
  "pm-251": {
    title: "Paper Toys Trio (Suminagashi Pond, Letterpress Keys, Fold-a-Zine)",
    summary: "Marbled suminagashi ink pond on /play, tactile letterpress keycaps, and printable 8-page fold-a-zine.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-opus-5-5",
      product_owner: "claude-sonnet-5-5",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-sonnet-5-5",
    },
  },
  "pm-250": {
    title: "Ink Desk + Stamp Ledger",
    summary: "Interactive isometric Ink Desk cartridge at /desk and a 365-day rubber-stamp activity ledger at /ledger.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "claude-sonnet-5-5",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-sonnet-5-5",
    },
  },
  "pm-249": {
    title: "Ink Poster Press, Postcard Mailroom, Pocket Terminal",
    summary: "Two-colour Riso poster press, stamped postcard mailroom, and keyboard-driven Pocket terminal shell.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "claude-sonnet-5-5",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-sonnet-5-5",
    },
  },
  "pm-247": {
    title: "Ink Radio & Fan-Out Peeks",
    summary: "Lo-fi procedural WebAudio ink radio and three-card fan-out peek previews across site links.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gpt-6-sol",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "gpt-6-luna",
    },
  },
  "pm-243": {
    title: "Ask the Ink Offline Index & LLM Route",
    summary: "Build-time passage index from site content and Gazette articles with cited answers in Pocket.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-opus-5-5",
      product_owner: "claude-haiku-5-5",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-sonnet-5-5",
    },
  },
  "pm-241": {
    title: "Internet Save Point",
    summary: "Animated paper-and-ink footer with campfire save point, waterline sentinel, and room hops.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "gpt-6.1-sol",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-216": {
    title: "Design system: a drawn page with knobs at /design-system",
    summary: "Interactive notebook-paper explainer with 8 token pots, 9 UI parts, and live propagation controls.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-opus-5-5",
      software_engineer: "gemini-3.8-flash-high",
      quality_engineer: "gemini-3.8-flash-high",
    },
  },
  "pm-214": {
    title: "Structures: a drawn, poke-able series on data structures at /structures",
    summary: "Six interactive hand-drawn data-structure explainers on squared notebook paper.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-opus-5-5",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-213": {
    title: "Gazette: a small newspaper of short, illustrated explainers at /articles",
    summary: "Broadsheet science newspaper with blackletter masthead, ruled columns, and six illustrated articles.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-opus-5-5",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-206": {
    title: "Hop and Settle: motion across the whole app",
    summary: "Cross-document View Transitions morphing project titles and settling instrument animations.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-opus-5-5",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-204": {
    title: "Barometer: a brass weather station for your city, drawn by hand",
    summary: "Hand-drawn brass weather dial, mercury thermometer, anemometer, and barograph driven by Open-Meteo.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-opus-5-5",
      software_engineer: "claude-sonnet-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-203": {
    title: "Planisphere: tonight's sky on a star wheel drawn in ink",
    summary: "Rotatable ink star wheel projecting 88 constellations and visible planets for any latitude and hour.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-opus-5-5",
      software_engineer: "claude-sonnet-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-202": {
    title: "Rotor: a hand-drawn Enigma, and room for the next projects",
    summary: "Playable 3-rotor Wehrmacht Enigma I cipher machine drawn in ink with lampboard and plugboard.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-opus-5-5",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-199": {
    title: "Orrery: the Sun, the planets and five stars, drawn by hand",
    summary: "Interactive hand-drawn solar system orrery and stellar scale comparator at /orrery.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-opus-5-5",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-198": {
    title: "Page-styled dropdowns: the open picker wears the page",
    summary: "Custom accessible listbox pickers styled to match each room's paper and ink palette.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-opus-5-5",
      software_engineer: "claude-sonnet-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-197": {
    title: "Still table: the Elements grid stops jiggling when the dialog closes",
    summary: "Stabilized periodic table layout and focus restoration when closing element detail modals.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-opus-5-5",
      software_engineer: "claude-sonnet-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-196": {
    title: "Capsule, printed: a sophisticated card set and a draw you cannot read early",
    summary: "Halftone-printed collectible Ghibli character cards with sealed capsule draw mechanics.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-opus-5-5",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-195": {
    title: "All projects link: a way back to /projects",
    summary: "Consistent back-to-bench navigation header across every isolated project route group.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-sonnet-5-5",
      software_engineer: "claude-sonnet-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-191": {
    title: "Vinyl: a crate, a turntable and a visible YouTube monitor",
    summary: "Record crate browser, spinning tonearm turntable, and CRT monitor at /vinyl.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-opus-5-5",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-190": {
    title: "Elements: a periodic table with a 3D atom per element",
    summary: "118-element periodic table with interactive Bohr shells and 3D orbital views at /elements.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-sonnet-5-5",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-189": {
    title: "Sun, redrawn: a one-page hand-drawn poster",
    summary: "Hand-lettered cutaway poster of solar layers, fusion core, and coronal loops.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-sonnet-5-5",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-188": {
    title: "Sun: an animated cutaway of our star",
    summary: "Interactive tour of the Sun's interior zones, granulation, and solar prominences.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-opus-5-5",
      software_engineer: "claude-sonnet-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-186": {
    title: "Owner Channels: owners add songs to the /music television",
    summary: "Authenticated song channel curation and database persistence for the /music television.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-opus-5-5",
      software_engineer: "claude-sonnet-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-184": {
    title: "Capsule: a coin-and-crank card machine",
    summary: "Hand-drawn Studio Ghibli capsule-toy machine with daily coins and persistent collection album.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-opus-5-5",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-181": {
    title: "Shore: a sea-glass focus timer",
    summary: "Tactile sea-glass Pomodoro timer with lapping tide waves and chime cues at /shore.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-opus-5-5",
      software_engineer: "claude-sonnet-5-5",
      quality_engineer: "claude-sonnet-5-5",
    },
  },
  "pm-180": {
    title: "Ship The Bench — verify pm-171, complete it, deploy it",
    summary: "Build-SHA metadata verification and production deployment of the Projects bench.",
    status: "done",
    shipped: true,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-sonnet-5-5",
      software_engineer: "claude-sonnet-5-5",
      quality_engineer: "claude-sonnet-5-5",
    },
  },

  // --- Unshipped plans (`paused`, `abandoned`, `executing`, `rejected`) excluded from `/making-of` scenes ---
  "pm-294": {
    title: "Paper & Ink Experiments Batch",
    summary: "Queued paper-and-ink experiment exploration.",
    status: "executing",
    shipped: false,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: null,
      software_engineer: null,
      quality_engineer: null,
    },
  },
  "pm-292": {
    title: "Rejected Experiment Study",
    summary: "Rejected study.",
    status: "rejected",
    shipped: false,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gemini-4-argon-medium",
      software_engineer: null,
      quality_engineer: null,
    },
  },
  "pm-291": {
    title: "Paused Experiment Study",
    summary: "Paused study.",
    status: "paused",
    shipped: false,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gpt-6-sol",
      software_engineer: null,
      quality_engineer: null,
    },
  },
  "pm-288": {
    title: "Golden Seams and Ink Traces",
    summary: "Kintsugi fracture-and-mend stoneware canvas and ink trace experiments on washi paper.",
    status: "paused",
    shipped: false,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gpt-6-sol",
      software_engineer: null,
      quality_engineer: null,
    },
  },
  "pm-287": {
    title: "Ink Bonsai Shadow Theatre",
    summary: "Prunable procedural ink bonsai with paper-lantern shadow projection and seasonal foliage.",
    status: "paused",
    shipped: false,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gpt-6-sol",
      software_engineer: null,
      quality_engineer: null,
    },
  },
  "pm-286": {
    title: "Ink Gashapon and Shodo Desk",
    summary: "Tactile capsule sticker dispenser and brush-pressure calligraphy desk studies.",
    status: "paused",
    shipped: false,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gpt-6-sol",
      software_engineer: null,
      quality_engineer: null,
    },
  },
  "pm-285": {
    title: "Ink Loom and Hanko Press",
    summary: "Paper-strip weaving loom and carved vermilion hanko seal press experiments.",
    status: "paused",
    shipped: false,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gpt-6-sol",
      software_engineer: null,
      quality_engineer: null,
    },
  },
  "pm-284": {
    title: "Paused Ink Study 284",
    summary: "Paused study.",
    status: "paused",
    shipped: false,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gpt-6-sol",
      software_engineer: null,
      quality_engineer: null,
    },
  },
  "pm-283": {
    title: "Paused Ink Study 283",
    summary: "Paused study.",
    status: "paused",
    shipped: false,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gpt-6-sol",
      software_engineer: null,
      quality_engineer: null,
    },
  },
  "pm-282": {
    title: "Paper Experiments: Pen Plotter Mode",
    summary: "Single-line vector plotter pass and pop-up timeline studies across the paper site.",
    status: "paused",
    shipped: false,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gpt-6-sol",
      software_engineer: null,
      quality_engineer: null,
    },
  },
  "pm-281": {
    title: "Paused Ink Study 281",
    summary: "Paused study.",
    status: "paused",
    shipped: false,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gpt-6-sol",
      software_engineer: null,
      quality_engineer: null,
    },
  },
  "pm-280": {
    title: "Paused Ink Study 280",
    summary: "Paused study.",
    status: "paused",
    shipped: false,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gpt-6-sol",
      software_engineer: null,
      quality_engineer: null,
    },
  },
  "pm-279": {
    title: "Paper Star Chart",
    summary: "Ink assembly-line conveyor on Work and astrolabe star chart planning.",
    status: "paused",
    shipped: false,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gpt-6-sol",
      software_engineer: null,
      quality_engineer: null,
    },
  },
  "pm-277": {
    title: "Riso Delivery Recovery",
    summary: "Consolidated Riso print-run ownership and clean browser verification builds.",
    status: "abandoned",
    shipped: false,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "gpt-6.1-sol",
      software_engineer: null,
      quality_engineer: null,
    },
  },
  "pm-276": {
    title: "Delivery Signal Guardrails",
    summary: "Deterministic gate diagnostics and deployment verification guardrails.",
    status: "paused",
    shipped: false,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "gpt-6.1-sol",
      software_engineer: null,
      quality_engineer: null,
    },
  },
  "pm-275": {
    title: "Reliable Plan Delivery",
    summary: "Restored GitHub Actions checks and production verification path on Ubuntu Chrome.",
    status: "paused",
    shipped: false,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "gpt-6.1-sol",
      software_engineer: null,
      quality_engineer: null,
    },
  },
  "pm-274": {
    title: "Paper & Ink Exploration 274",
    summary: "Paused exploration with research only.",
    status: "paused",
    shipped: false,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: null,
      software_engineer: null,
      quality_engineer: null,
    },
  },
  "pm-273": {
    title: "Ink and Folds",
    summary: "Moderated vector doodle guestbook wall at /guestbook and folded-paper fortune teller at /fortune.",
    status: "paused",
    shipped: false,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gpt-6.1-sol",
      software_engineer: "gpt-6-sol",
      quality_engineer: "gpt-6-sol",
    },
  },
  "pm-271": {
    title: "Tamatebako Changelog & Palace Sound",
    summary: "Current git history indexing for the Ryugu-jo Tamatebako box and bfcache-safe ambient palace sound.",
    status: "paused",
    shipped: false,
    roles: {
      research: null,
      product_owner: "gpt-6.1-sol",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-269": {
    title: "Ryugu Paper Toys II",
    summary: "Message in a Bottle shore drift, Kamishibai project theatre, and Peep-box parallax diorama.",
    status: "paused",
    shipped: false,
    roles: {
      research: null,
      product_owner: "gemini-4-argon-high",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "gpt-6-sol",
    },
  },
  "pm-268": {
    title: "Riso Ink Studio",
    summary: "Misregistered two-drum Risograph headings and interactive material tuning studio at /lab.",
    status: "executing",
    shipped: false,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "gpt-6.1-sol",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "gpt-6-sol",
    },
  },
  "pm-260": {
    title: "Split Part Recovery",
    summary: "Reconciled multi-part plan handoffs and verified Ask console probe behavior.",
    status: "abandoned",
    shipped: false,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-sonnet-5-5",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "gpt-6.1-sol",
    },
  },
  "pm-257": {
    title: "Ink Ghosts",
    summary: "Anonymous live ink cursors and click ripples across Home and Ryugu-jo with a Pocket privacy switch.",
    status: "paused",
    shipped: false,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "gpt-6.1-sol",
      software_engineer: "gpt-6.1-sol",
      quality_engineer: "gpt-6.1-sol",
    },
  },
  "pm-248": {
    title: "Paper Almanac Bits",
    summary: "Seasonal paper-and-ink almanac tints, solar term dial, and grounded Ask the Ink search.",
    status: "abandoned",
    shipped: false,
    roles: {
      research: "claude-sonnet-5-5",
      product_owner: "claude-haiku-5-5",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-sonnet-5-5",
    },
  },
  "pm-242": {
    title: "Pocket Console Encore",
    summary: "Handheld console cartridge menu, sound effects toggle, and live now-playing tape deck.",
    status: "abandoned",
    shipped: false,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "gpt-6.1-sol",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-sonnet-5-5",
    },
  },
  "pm-240": {
    title: "Ink & Watercolour Portraits",
    summary: "Hand-inked portrait gallery and handoff pipeline on /sketches.",
    status: "abandoned",
    shipped: false,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "gpt-6.1-sol",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
  "pm-171": {
    title: "Projects Bench — a public Projects page",
    summary: "Initial Cartridge bench at /projects showcasing independent interactive experiments.",
    status: "abandoned",
    shipped: false,
    roles: {
      research: "claude-fable-5-1",
      product_owner: "claude-opus-5-5",
      software_engineer: "claude-opus-5-5",
      quality_engineer: "claude-opus-5-5",
    },
  },
};

export const SHIPPED_PLAN_REGISTRY: Readonly<Record<string, PlanRunRecord>> = Object.fromEntries(
  Object.entries(PLAN_RUN_HISTORY).filter(([, record]) => record.shipped),
);

export const SHIPPED_PLAN_IDS: readonly string[] = Object.keys(SHIPPED_PLAN_REGISTRY);

export const UNSHIPPED_PLAN_IDS: readonly string[] = Object.keys(PLAN_RUN_HISTORY).filter(
  (planId) => !PLAN_RUN_HISTORY[planId].shipped,
);

// Public metadata catalog for shipped plans only.
export const DEFAULT_PLAN_CATALOG: Readonly<Record<string, PlanMetadataInput>> = Object.fromEntries(
  Object.entries(SHIPPED_PLAN_REGISTRY).map(([planId, record]) => [
    planId,
    {
      planId,
      title: record.title,
      summary: record.summary,
      status: record.status,
      shipped: record.shipped,
      roles: { ...record.roles },
    },
  ]),
);

export function isShippedPlan(
  planId: string,
  meta?: PlanMetadataInput | Readonly<Record<string, PlanMetadataInput>> | null,
): boolean {
  if (typeof planId !== "string") return false;
  const key = planId.trim().toLowerCase();
  if (!PLAN_ID_RE.test(key)) return false;
  let item: PlanMetadataInput | undefined;
  if (meta && isRecord(meta)) {
    const looksLikeMeta =
      "planId" in meta || "title" in meta || "summary" in meta || "roles" in meta || "shipped" in meta || "status" in meta;
    item = looksLikeMeta
      ? (meta as PlanMetadataInput)
      : (meta as Readonly<Record<string, PlanMetadataInput>>)[key];
  }
  if (item && typeof item.shipped === "boolean") return item.shipped;
  if (item?.status) return item.status === "done" || key === "pm-293";
  return key in SHIPPED_PLAN_REGISTRY;
}

function toPlanMetadataMap(
  plans?: Readonly<Record<string, PlanMetadataInput>> | readonly PlanMetadataInput[],
): Map<string, PlanMetadataInput> {
  const map = new Map<string, PlanMetadataInput>();
  if (!plans) return map;
  if (Array.isArray(plans)) {
    for (const item of plans) {
      if (!isRecord(item) || typeof item.planId !== "string") continue;
      const key = item.planId.trim().toLowerCase();
      if (PLAN_ID_RE.test(key)) map.set(key, item);
    }
  } else if (isRecord(plans)) {
    for (const [rawKey, item] of Object.entries(plans)) {
      if (!isRecord(item)) continue;
      const key = (typeof item.planId === "string" ? item.planId : rawKey).trim().toLowerCase();
      if (PLAN_ID_RE.test(key)) map.set(key, item);
    }
  }
  return map;
}

// Groups commits by `pm-NNN` prefix, filters to shipped plans (`done` + `pm-293`), merges ground-truth
// plan-manager run models, omits roles that did not run, sanitizes all strings to public fields,
// and preserves fallback scenes when git history is partial or absent.
export function buildMakingOf(input: BuildMakingOfInput = {}): MakingOfSnapshot {
  const planMap = toPlanMetadataMap(input.plans);
  const validFallback = input.fallback ? validateMakingOf(input.fallback) : null;
  const fallbackByPlan = new Map<string, MakingOfScene>();
  if (validFallback) {
    for (const s of validFallback.scenes) fallbackByPlan.set(s.planId, s);
  }

  type NormalizedCommit = {
    sha: string;
    shortSha: string;
    day: string;
    plan: string | null;
    task: string | null;
    subject: string;
    areas: string[];
  };

  const normalizedCommits: NormalizedCommit[] = [];
  for (const raw of input.commits ?? []) {
    if (!isRecord(raw) || typeof raw.sha !== "string" || typeof raw.date !== "string" || typeof raw.subject !== "string") {
      continue;
    }
    const sha = raw.sha.trim().toLowerCase();
    if (!HEX_SHA_RE.test(sha)) continue;
    const day = utcDayOf(raw.date);
    if (!day) continue;
    const split = splitPrefix(cleanSubject(raw.subject));
    const plan =
      raw.plan !== undefined
        ? typeof raw.plan === "string" && PLAN_ID_RE.test(raw.plan.trim())
          ? raw.plan.trim()
          : null
        : split.plan;
    const task =
      raw.task !== undefined
        ? typeof raw.task === "string" && /^[A-Za-z0-9_-]+$/.test(raw.task.trim())
          ? raw.task.trim()
          : null
        : split.task;
    const rawBody = raw.plan !== undefined ? raw.subject : split.subject;
    const subject = sanitizePublicText(rawBody, SUBJECT_MAX);
    if (!subject) continue;

    const areas = Array.isArray(raw.areas)
      ? mergeAreas([raw.areas.filter((a): a is string => typeof a === "string")])
      : Array.isArray(raw.paths)
        ? summarizeAreas(raw.paths.filter((p): p is string => typeof p === "string"))
        : [];

    normalizedCommits.push({
      sha,
      shortSha: sha.slice(0, SHA_LENGTH),
      day,
      plan,
      task,
      subject,
      areas,
    });
  }

  const grouped = new Map<string, NormalizedCommit[]>();
  for (const c of normalizedCommits) {
    if (!c.plan) continue;
    let bucket = grouped.get(c.plan);
    if (!bucket) {
      bucket = [];
      grouped.set(c.plan, bucket);
    }
    bucket.push(c);
  }

  const scenes: MakingOfScene[] = [];
  const seenPlans = new Set<string>();

  for (const [planId, group] of grouped) {
    if (scenes.length >= MAX_SCENES) break;
    const meta = planMap.get(planId);
    if (!isShippedPlan(planId, meta)) continue;
    seenPlans.add(planId);
    const newest = group[0];
    const fb = fallbackByPlan.get(planId);
    const recorded = SHIPPED_PLAN_REGISTRY[planId] ?? PLAN_RUN_HISTORY[planId];

    const rawTitle = meta?.title ?? fb?.title ?? recorded?.title ?? newest.subject;
    const title = sanitizePublicText(rawTitle, TITLE_MAX) || planId;

    const rawSummary = meta?.summary ?? fb?.summary ?? recorded?.summary ?? newest.subject;
    const summary = sanitizePublicText(rawSummary, SUMMARY_MAX) || title;

    const roles = normalizeRoles(meta?.roles ?? recorded?.roles ?? fb?.roles);
    if (roles.length === 0) continue;

    const areas = mergeAreas([...group.map((c) => c.areas), ...(fb ? [fb.areas] : [])]);
    const sha = newest.shortSha;
    const commitCount = Math.min(MAX_COMMITS_PER_SCENE, group.length);

    scenes.push({
      planId,
      title,
      date: newest.day,
      sha,
      commitUrl: commitUrlFor(sha),
      commitCount,
      areas,
      roles,
      summary,
    });
  }

  if (validFallback) {
    for (const fb of validFallback.scenes) {
      if (scenes.length >= MAX_SCENES) break;
      if (seenPlans.has(fb.planId)) continue;
      const meta = planMap.get(fb.planId);
      if (!isShippedPlan(fb.planId, meta)) continue;
      seenPlans.add(fb.planId);
      const recorded = SHIPPED_PLAN_REGISTRY[fb.planId] ?? PLAN_RUN_HISTORY[fb.planId];
      const title = sanitizePublicText(meta?.title ?? fb.title ?? recorded?.title, TITLE_MAX) || fb.planId;
      const summary = sanitizePublicText(meta?.summary ?? fb.summary ?? recorded?.summary, SUMMARY_MAX) || title;
      const roles = normalizeRoles(meta?.roles ?? recorded?.roles ?? fb.roles);
      if (roles.length === 0) continue;
      scenes.push({
        planId: fb.planId,
        title,
        date: fb.date,
        sha: fb.sha,
        commitUrl: commitUrlFor(fb.sha),
        commitCount: fb.commitCount,
        areas: mergeAreas([fb.areas]),
        roles,
        summary,
      });
    }
  }

  let head: string | null = null;
  if (scenes.length > 0) {
    if (input.head !== undefined) {
      head = typeof input.head === "string" && FULL_SHA_RE.test(input.head) ? input.head : null;
    } else if (normalizedCommits.length > 0 && FULL_SHA_RE.test(normalizedCommits[0].sha)) {
      head = normalizedCommits[0].sha;
    } else if (validFallback?.head && FULL_SHA_RE.test(validFallback.head)) {
      head = validFallback.head;
    }
  }

  return {
    version: 1,
    head,
    scenes,
  };
}

export const buildMakingOfLog = buildMakingOf;

// --- validation and canonical serialization --------------------------------------------------------------------

const SNAPSHOT_KEYS = ["version", "head", "scenes"] as const;
const SCENE_KEYS = [
  "planId",
  "title",
  "date",
  "sha",
  "commitUrl",
  "commitCount",
  "areas",
  "roles",
  "summary",
] as const;
const ROLE_ITEM_KEYS = ["role", "label", "modelId"] as const;

function validRoleItem(v: unknown): v is MakingOfRole {
  if (!isRecord(v) || !hasKeys(v, ROLE_ITEM_KEYS)) return false;
  if (!isAgentRoleKey(v.role)) return false;
  if (
    typeof v.label !== "string" ||
    !v.label ||
    v.label.length > 32 ||
    cleanSubject(v.label, 32) !== v.label ||
    containsPrivateData(v.label)
  ) {
    return false;
  }
  if (
    typeof v.modelId !== "string" ||
    !MODEL_ID_RE.test(v.modelId) ||
    containsPrivateData(v.modelId)
  ) {
    return false;
  }
  return true;
}

function validScene(v: unknown): v is MakingOfScene {
  if (!isRecord(v) || !hasKeys(v, SCENE_KEYS)) return false;
  if (typeof v.planId !== "string" || !PLAN_ID_RE.test(v.planId)) return false;
  const shippedRecord = SHIPPED_PLAN_REGISTRY[v.planId];
  if (!shippedRecord || !shippedRecord.shipped) return false;
  if (
    typeof v.title !== "string" ||
    !v.title ||
    cleanSubject(v.title, TITLE_MAX) !== v.title ||
    containsPrivateData(v.title)
  ) {
    return false;
  }
  if (typeof v.date !== "string" || utcDayOf(v.date) !== v.date) return false;
  if (typeof v.sha !== "string" || !SHORT_SHA_RE.test(v.sha)) return false;
  if (typeof v.commitUrl !== "string") return false;
  const urlMatch = COMMIT_URL_RE.exec(v.commitUrl);
  if (!urlMatch || !urlMatch[1].startsWith(v.sha)) return false;
  if (!isCount(v.commitCount, 1, MAX_COMMITS_PER_SCENE)) return false;
  if (
    !Array.isArray(v.areas) ||
    v.areas.length > AREAS_MAX ||
    !v.areas.every((a) => typeof a === "string" && a.length > 0 && !containsPrivateData(a))
  ) {
    return false;
  }
  if (new Set(v.areas).size !== v.areas.length) return false;
  const roles = v.roles;
  if (!Array.isArray(roles) || roles.length === 0 || roles.length > ROLE_KEYS.length) {
    return false;
  }
  let prevRoleIndex = -1;
  for (const item of roles) {
    if (!validRoleItem(item)) return false;
    const roleIndex = ROLE_KEYS.indexOf(item.role);
    if (roleIndex <= prevRoleIndex) return false;
    prevRoleIndex = roleIndex;
  }
  const expectedRoles = normalizeRoles(shippedRecord.roles);
  if (roles.length !== expectedRoles.length) return false;
  for (let i = 0; i < expectedRoles.length; i++) {
    if (roles[i].role !== expectedRoles[i].role || roles[i].modelId !== expectedRoles[i].modelId) {
      return false;
    }
  }
  if (
    typeof v.summary !== "string" ||
    !v.summary ||
    cleanSubject(v.summary, SUMMARY_MAX) !== v.summary ||
    containsPrivateData(v.summary)
  ) {
    return false;
  }
  return true;
}

export function validateMakingOf(v: unknown): MakingOfSnapshot | null {
  if (!isRecord(v) || !hasKeys(v, SNAPSHOT_KEYS) || v.version !== 1) return null;
  if (!Array.isArray(v.scenes) || v.scenes.length > MAX_SCENES || !v.scenes.every(validScene)) {
    return null;
  }
  const seenPlans = new Set<string>();
  for (const s of v.scenes) {
    if (seenPlans.has(s.planId)) return null;
    seenPlans.add(s.planId);
  }
  if (v.head === null) {
    return v.scenes.length === 0 ? (v as MakingOfSnapshot) : null;
  }
  if (typeof v.head !== "string" || !FULL_SHA_RE.test(v.head)) return null;
  if (v.scenes.length === 0) return null;
  return v as MakingOfSnapshot;
}

export const validateMakingOfLog = validateMakingOf;

export function parseMakingOf(text: string): MakingOfSnapshot | null {
  try {
    return validateMakingOf(JSON.parse(text));
  } catch {
    return null;
  }
}

export function readMakingOf(v: unknown): MakingOfSnapshot {
  return validateMakingOf(v) ?? EMPTY_MAKING_OF;
}

function serializeRole(r: MakingOfRole): string {
  return JSON.stringify({ role: r.role, label: r.label, modelId: r.modelId });
}

function serializeScene(s: MakingOfScene): string {
  const roles = `[\n${s.roles.map((r) => `        ${serializeRole(r)}`).join(",\n")}\n      ]`;
  return [
    "    {",
    `      "planId": ${JSON.stringify(s.planId)},`,
    `      "title": ${JSON.stringify(s.title)},`,
    `      "date": ${JSON.stringify(s.date)},`,
    `      "sha": ${JSON.stringify(s.sha)},`,
    `      "commitUrl": ${JSON.stringify(s.commitUrl)},`,
    `      "commitCount": ${s.commitCount},`,
    `      "areas": ${JSON.stringify(s.areas)},`,
    `      "roles": ${roles},`,
    `      "summary": ${JSON.stringify(s.summary)}`,
    "    }",
  ].join("\n");
}

export function serializeMakingOf(snapshot: MakingOfSnapshot): string {
  const scenes =
    snapshot.scenes.length > 0
      ? `[\n${snapshot.scenes.map(serializeScene).join(",\n")}\n  ]`
      : "[]";
  return [
    "{",
    `  "version": 1,`,
    `  "head": ${JSON.stringify(snapshot.head)},`,
    `  "scenes": ${scenes}`,
    "}",
    "",
  ].join("\n");
}

// --- scroll-scrubbed parallax and keyboard navigation math -----------------------------------------------------

export function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function computeScrollProgress(metrics: {
  scrollY: number;
  containerTop: number;
  containerHeight: number;
  viewportHeight: number;
}): number {
  const scrollable = metrics.containerHeight - metrics.viewportHeight;
  if (!Number.isFinite(scrollable) || scrollable <= 0) return 0;
  const scrolled = metrics.scrollY - metrics.containerTop;
  return clamp01(scrolled / scrollable);
}

const normalizeZero = (n: number): number => (Object.is(n, -0) || n === 0 ? 0 : n);

export function computeEmakiParallax(input: {
  progress: number;
  trackOverflowPx: number;
  sceneCount: number;
  reducedMotion?: boolean;
}): EmakiParallaxState {
  const progress = clamp01(input.progress);
  const count = Math.max(1, Math.trunc(Number.isFinite(input.sceneCount) ? input.sceneCount : 1));
  const activeSceneIndex =
    count <= 1 ? 0 : Math.min(count - 1, Math.max(0, Math.round(progress * (count - 1))));

  if (input.reducedMotion) {
    return {
      progress,
      translateXPx: 0,
      cloudOffsetPx: 0,
      pineWaveOffsetPx: 0,
      figurePassPhase: 0,
      activeSceneIndex,
      activeRoleIndex: 0,
    };
  }

  const overflow = Math.max(0, Number.isFinite(input.trackOverflowPx) ? input.trackOverflowPx : 0);
  const translateXPx = normalizeZero(-Math.round(progress * overflow * 100) / 100);
  const cloudOffsetPx = normalizeZero(-Math.round(progress * overflow * 0.25 * 100) / 100);
  const pineWaveOffsetPx = normalizeZero(-Math.round(progress * overflow * 0.55 * 100) / 100);

  const scaled = progress * count;
  const figurePassPhase =
    progress >= 1 ? 1 : Math.round((scaled - Math.floor(scaled)) * 1000) / 1000;
  const activeRoleIndex = Math.min(
    ROLE_KEYS.length - 1,
    Math.max(0, Math.floor(figurePassPhase * ROLE_KEYS.length)),
  );

  return {
    progress,
    translateXPx,
    cloudOffsetPx,
    pineWaveOffsetPx,
    figurePassPhase,
    activeSceneIndex,
    activeRoleIndex,
  };
}

export function sceneProgressForIndex(index: number, sceneCount: number): number {
  const count = Math.trunc(Number.isFinite(sceneCount) ? sceneCount : 0);
  if (count <= 1) return 0;
  const clampedIdx = Math.min(count - 1, Math.max(0, Math.trunc(Number.isFinite(index) ? index : 0)));
  return clamp01(clampedIdx / (count - 1));
}

export function stepSceneIndex(currentIndex: number, key: string, sceneCount: number): number | null {
  const count = Math.trunc(Number.isFinite(sceneCount) ? sceneCount : 0);
  if (count <= 0) return null;
  const current = Math.min(count - 1, Math.max(0, Math.trunc(Number.isFinite(currentIndex) ? currentIndex : 0)));
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return Math.min(count - 1, current + 1);
    case "ArrowLeft":
    case "ArrowUp":
      return Math.max(0, current - 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
