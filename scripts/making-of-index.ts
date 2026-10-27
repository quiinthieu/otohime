// Builds content/making-of.json, the validated public snapshot of shipped plans
// grouped by pm-NNN prefix for the /making-of Emaki handscroll.
//
// In default (permissive) mode, without git, outside a work tree, or in a shallow clone,
// the committed content/making-of.json is the fallback and is left as it is (or spliced
// when the shallow clone still holds the fallback's head commit).
//   npm run making-of:index               write content/making-of.json (permissive fallback outside full git)
//   npm run making-of:index -- --strict   write from full git history and verify strictly
//   npm run making-of:check               exit 1 if malformed, non-canonical, tampered, or lagging HEAD > MAX_LAG
//   npm run making-of:check -- --strict   exit 1 unless full git history is present and matches HEAD
// --file=<path> reads or writes another file, --repo=<dir> indexes another checkout, --rev=<sha> pins the build SHA.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  AREAS_MAX,
  areaOf,
  buildMakingOf,
  buildMakingOfLog,
  cleanSubject,
  commitUrlFor,
  computeEmakiParallax,
  computeScrollProgress,
  containsPrivateData,
  DEFAULT_PLAN_CATALOG,
  EMPTY_MAKING_OF,
  GITHUB_REPO_URL,
  isShippedPlan,
  isoSecond,
  MAX_COMMITS_PER_SCENE,
  MAX_SCENES,
  mergeAreas,
  normalizeRoles,
  PLAN_RUN_HISTORY,
  parseMakingOf,
  parsePlanMarkdown,
  ROLE_KEYS,
  ROLE_LABELS,
  readMakingOf,
  SHIPPED_PLAN_IDS,
  SHIPPED_PLAN_REGISTRY,
  sanitizeModelId,
  sanitizePublicText,
  sceneProgressForIndex,
  serializeMakingOf,
  SHA_LENGTH,
  SUBJECT_MAX,
  SUMMARY_MAX,
  splitPrefix,
  stepSceneIndex,
  summarizeAreas,
  TITLE_MAX,
  UNSHIPPED_PLAN_IDS,
  utcDayOf,
  validateMakingOf,
  validateMakingOfLog,
  type AgentRoleKey,
  type BuildMakingOfInput,
  type EmakiParallaxState,
  type MakingOfCommitInput,
  type MakingOfRole,
  type MakingOfScene,
  type MakingOfSnapshot,
  type PlanMetadataInput,
  type PlanRoleModels,
  type PlanRunRecord,
  type PlanStatus,
} from "../lib/making-of.ts";

export {
  AREAS_MAX,
  areaOf,
  buildMakingOf,
  buildMakingOfLog,
  cleanSubject,
  commitUrlFor,
  computeEmakiParallax,
  computeScrollProgress,
  containsPrivateData,
  DEFAULT_PLAN_CATALOG,
  EMPTY_MAKING_OF,
  GITHUB_REPO_URL,
  isShippedPlan,
  isoSecond,
  MAX_COMMITS_PER_SCENE,
  MAX_SCENES,
  mergeAreas,
  normalizeRoles,
  PLAN_RUN_HISTORY,
  parseMakingOf,
  parsePlanMarkdown,
  ROLE_KEYS,
  ROLE_LABELS,
  readMakingOf,
  SHIPPED_PLAN_IDS,
  SHIPPED_PLAN_REGISTRY,
  sanitizeModelId,
  sanitizePublicText,
  sceneProgressForIndex,
  serializeMakingOf,
  SHA_LENGTH,
  SUBJECT_MAX,
  SUMMARY_MAX,
  splitPrefix,
  stepSceneIndex,
  summarizeAreas,
  TITLE_MAX,
  UNSHIPPED_PLAN_IDS,
  utcDayOf,
  validateMakingOf,
  validateMakingOfLog,
  type AgentRoleKey,
  type BuildMakingOfInput,
  type EmakiParallaxState,
  type MakingOfCommitInput,
  type MakingOfRole,
  type MakingOfScene,
  type MakingOfSnapshot,
  type PlanMetadataInput,
  type PlanRoleModels,
  type PlanRunRecord,
  type PlanStatus,
};

const ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_FILE = join(ROOT, "content/making-of.json");

// How many commits the committed fallback may trail HEAD by before --check calls it stale.
export const MAX_LAG = 50;

export type Git = (args: string[]) => string | null;

export function gitRunner(repo: string, bin = "git"): Git {
  return (args) => {
    try {
      return execFileSync(bin, ["-C", repo, "-c", "core.quotepath=off", "-c", "log.showSignature=false", ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch {
      return null;
    }
  };
}

// --- parsing git log -------------------------------------------------------------------------------------------

const RS = "\x1e";
const US = "\x1f";
const LOG_FORMAT = "--format=%x1e%H%x1f%P%x1f%cI%x1f%s";
const NUMSTAT = /^(\d+|-)\t(\d+|-)\t(.+)$/;

export type ParsedCommit = {
  sha: string;
  parents: number;
  entry: MakingOfCommitInput;
};

export function parseLog(text: string): ParsedCommit[] {
  const out: ParsedCommit[] = [];
  for (const record of text.split(RS)) {
    if (!record.trim()) continue;
    const [header, ...rest] = record.split("\n");
    const fields = header.split(US);
    if (fields.length !== 4 || !/^[0-9a-f]{40}$/.test(fields[0])) {
      throw new Error(`making-of: unexpected git log record ${JSON.stringify(header)}`);
    }
    const [sha, parents, rawDate, rawSubject] = fields;
    const date = isoSecond(rawDate);
    if (!date) throw new Error(`making-of: unexpected commit date ${JSON.stringify(rawDate)} on ${sha}`);
    const paths: string[] = [];
    for (const line of rest) {
      if (!line) continue;
      const m = NUMSTAT.exec(line);
      if (!m) throw new Error(`making-of: unexpected numstat line ${JSON.stringify(line)} on ${sha}`);
      paths.push(m[3]);
    }
    const { plan, task, subject } = splitPrefix(cleanSubject(rawSubject));
    out.push({
      sha,
      parents: parents ? parents.split(" ").length : 0,
      entry: {
        sha,
        date,
        plan,
        task,
        subject: sanitizePublicText(subject, SUBJECT_MAX),
        areas: summarizeAreas(paths),
      },
    });
  }
  return out;
}

// --- reading public plan metadata from projects/*/plan.md ------------------------------------------------------

export function readRepoPlans(repo: string): Record<string, PlanMetadataInput> {
  let isRootRepo = false;
  try {
    isRootRepo = realpathSync(repo) === realpathSync(ROOT);
  } catch {
    isRootRepo = false;
  }

  const out: Record<string, PlanMetadataInput> = isRootRepo ? { ...DEFAULT_PLAN_CATALOG } : {};
  const projectsDir = join(repo, "projects");
  if (!existsSync(projectsDir)) return out;

  try {
    const entries = readdirSync(projectsDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const planPath = join(projectsDir, entry.name, "plan.md");
      if (!existsSync(planPath)) continue;
      try {
        const text = readFileSync(planPath, "utf8");
        const parsed = parsePlanMarkdown(text);
        if (!parsed) continue;
        const recorded = PLAN_RUN_HISTORY[parsed.planId];
        if (recorded && !recorded.shipped) continue;
        const existing = out[parsed.planId];
        out[parsed.planId] = {
          planId: parsed.planId,
          title: parsed.title || existing?.title || recorded?.title,
          summary: existing?.summary ?? recorded?.summary ?? parsed.summary,
          status: recorded?.status ?? existing?.status,
          shipped: recorded ? recorded.shipped : (existing?.shipped ?? true),
          roles: recorded?.roles ?? existing?.roles ?? parsed.roles,
        };
      } catch {
        // Ignore unreadable plan files and keep existing/default metadata.
      }
    }
  } catch {
    return out;
  }

  return out;
}

// --- reading git -----------------------------------------------------------------------------------------------

export type GitState = "full" | "shallow" | "none";

export function gitState(git: Git, repo: string): GitState {
  const top = git(["rev-parse", "--show-toplevel"])?.trim();
  if (!top) return "none";
  try {
    if (realpathSync(top) !== realpathSync(repo)) return "none";
  } catch {
    return "none";
  }
  if (git(["rev-parse", "--verify", "--quiet", "HEAD^{commit}"]) === null) return "none";
  const shallow = git(["rev-parse", "--is-shallow-repository"])?.trim();
  return shallow === "false" ? "full" : shallow === "true" ? "shallow" : "none";
}

function log(git: Git, range: string): ParsedCommit[] | null {
  const text = git([
    "log",
    "--no-merges",
    "--no-renames",
    "--no-color",
    "--root",
    LOG_FORMAT,
    "--numstat",
    range,
    "--",
  ]);
  return text === null ? null : parseLog(text);
}

export function count(git: Git, range: string): number | null {
  const n = Number(git(["rev-list", "--count", range, "--"])?.trim());
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

export function countNonMerges(git: Git, range: string): number | null {
  const n = Number(git(["rev-list", "--count", "--no-merges", range, "--"])?.trim());
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

const fullSha = (git: Git, rev: string) => {
  const sha = git(["rev-parse", "--verify", "--quiet", `${rev}^{commit}`])?.trim();
  return sha && /^[0-9a-f]{40}$/.test(sha) ? sha : null;
};

const isAncestor = (git: Git, older: string, newer: string) =>
  git(["merge-base", "--is-ancestor", older, newer]) !== null;

export function indexAt(
  git: Git,
  rev = "HEAD",
  plans: Readonly<Record<string, PlanMetadataInput>> = {},
): MakingOfSnapshot | null {
  const commits = log(git, rev);
  const total = count(git, rev);
  if (!commits || total === null) return null;
  if (commits.length === 0 && total > 0) return null;
  return buildMakingOf({
    head: commits[0]?.sha ?? null,
    commits: commits.map((c) => c.entry),
    plans,
  });
}

// In a shallow clone: extends the fallback with the commits since fallback.head when fallback.head is reachable
// and none of the newer commits sits on the parentless shallow boundary.
export function splice(
  git: Git,
  fallback: MakingOfSnapshot,
  rev = "HEAD",
  plans: Readonly<Record<string, PlanMetadataInput>> = {},
): MakingOfSnapshot | null {
  if (!fallback.head || !isAncestor(git, fallback.head, rev)) return null;
  const range = `${fallback.head}..${rev}`;
  const newer = log(git, range);
  const nonMergeAdded = countNonMerges(git, range);
  const totalAdded = count(git, range);
  if (!newer || nonMergeAdded === null || totalAdded === null || newer.length !== nonMergeAdded) return null;
  if (newer.some((c) => c.parents === 0)) return null;
  if (totalAdded === 0 || newer.length === 0) return fallback;

  const fallbackByPlan = new Map<string, MakingOfScene>();
  for (const s of fallback.scenes) fallbackByPlan.set(s.planId, s);

  const newerByPlan = new Map<string, ParsedCommit[]>();
  for (const c of newer) {
    const planId = c.entry.plan;
    if (!planId) continue;
    let bucket = newerByPlan.get(planId);
    if (!bucket) {
      bucket = [];
      newerByPlan.set(planId, bucket);
    }
    bucket.push(c);
  }

  const scenes: MakingOfScene[] = [];
  const seenPlans = new Set<string>();

  for (const [planId, group] of newerByPlan) {
    if (scenes.length >= MAX_SCENES) break;
    const meta = plans[planId];
    if (!isShippedPlan(planId, meta)) continue;
    seenPlans.add(planId);
    const newest = group[0];
    const prev = fallbackByPlan.get(planId);
    const recorded = SHIPPED_PLAN_REGISTRY[planId] ?? PLAN_RUN_HISTORY[planId];
    const sha = newest.sha.slice(0, SHA_LENGTH);
    const date = newest.entry.date.slice(0, 10);
    const title = sanitizePublicText(meta?.title ?? recorded?.title ?? newest.entry.subject, TITLE_MAX) || planId;
    const summary = sanitizePublicText(meta?.summary ?? recorded?.summary ?? newest.entry.subject, SUMMARY_MAX) || title;
    const roles = normalizeRoles(meta?.roles ?? recorded?.roles ?? prev?.roles);
    if (roles.length === 0) continue;
    const areas = mergeAreas([
      ...group.map((c) => c.entry.areas ?? []),
      ...(prev ? [prev.areas] : []),
    ]);
    const commitCount = Math.min(MAX_COMMITS_PER_SCENE, (prev?.commitCount ?? 0) + group.length);

    scenes.push({
      planId,
      title,
      date,
      sha,
      commitUrl: commitUrlFor(sha),
      commitCount,
      areas,
      roles,
      summary,
    });
  }

  for (const prev of fallback.scenes) {
    if (scenes.length >= MAX_SCENES) break;
    if (seenPlans.has(prev.planId)) continue;
    if (!isShippedPlan(prev.planId, plans[prev.planId])) continue;
    seenPlans.add(prev.planId);
    scenes.push({
      ...prev,
      areas: [...prev.areas],
      roles: prev.roles.map((r) => ({ ...r })),
    });
  }

  return {
    version: 1,
    head: newer[0].sha,
    scenes,
  };
}

export type Resolution = {
  snapshot: MakingOfSnapshot;
  source: "git" | "spliced" | "fallback" | "empty";
  reason: string;
};

export function resolveMakingOf(
  git: Git,
  repo: string,
  fallback: MakingOfSnapshot | null,
  plans?: Readonly<Record<string, PlanMetadataInput>>,
): Resolution {
  const repoPlans = plans ?? readRepoPlans(repo);
  const state = gitState(git, repo);
  let failure = "";
  try {
    if (state === "full") {
      const built = indexAt(git, "HEAD", repoPlans);
      if (built) return { snapshot: built, source: "git", reason: "full history" };
    }
    if (state === "shallow" && fallback) {
      const spliced = splice(git, fallback, "HEAD", repoPlans);
      if (spliced) return { snapshot: spliced, source: "spliced", reason: "shallow clone holding the fallback's head" };
    }
  } catch (err) {
    failure = `: ${err instanceof Error ? err.message : String(err)}`;
  }
  const reason =
    (state === "none" ? "git history unavailable" : state === "shallow" ? "shallow clone" : "git log failed") +
    failure;
  if (fallback) {
    return { snapshot: fallback, source: "fallback", reason };
  }
  return { snapshot: EMPTY_MAKING_OF, source: "empty", reason: `${reason}, no valid fallback` };
}

export type CheckResult = { ok: boolean; message: string };
export type CheckOptions = {
  maxLag?: number;
  strict?: boolean;
  rev?: string | null;
  plans?: Readonly<Record<string, PlanMetadataInput>>;
};

export function checkMakingOf(
  git: Git,
  repo: string,
  text: string | null,
  maxLagOrOptions: number | CheckOptions = MAX_LAG,
): CheckResult {
  const opts: CheckOptions =
    typeof maxLagOrOptions === "number" ? { maxLag: maxLagOrOptions } : maxLagOrOptions;
  const maxLag = opts.maxLag ?? MAX_LAG;
  const strict = opts.strict === true;
  const expectedRev = opts.rev?.trim() || null;

  if (text === null) return { ok: false, message: "is missing; run npm run making-of:index" };
  const committed = parseMakingOf(text);
  if (!committed) return { ok: false, message: "is malformed or over its bounds; run npm run making-of:index" };
  if (serializeMakingOf(committed) !== text) {
    return { ok: false, message: "is not in canonical form; run npm run making-of:index" };
  }

  const state = gitState(git, repo);
  if (state !== "full") {
    if (strict) {
      return {
        ok: false,
        message: `strict check requires full git history (${state === "shallow" ? "shallow clone; use fetch-depth: 0" : "no git history"})`,
      };
    }
    return {
      ok: true,
      message: `is well-formed (${state === "shallow" ? "shallow clone" : "no git history"}: not compared with git)`,
    };
  }

  const head = fullSha(git, "HEAD");
  if (!head) return { ok: false, message: "cannot be checked: HEAD did not resolve" };
  if (expectedRev) {
    const want = fullSha(git, expectedRev);
    if (!want || want !== head) {
      return { ok: false, message: `build revision ${expectedRev} does not match checked-out HEAD ${head}` };
    }
  }

  const repoPlans = opts.plans ?? readRepoPlans(repo);

  if (committed.head === null) {
    const rebuiltAtHead = indexAt(git, "HEAD", repoPlans);
    if (!strict && rebuiltAtHead && rebuiltAtHead.scenes.length === 0) {
      return { ok: true, message: "is empty, as is the plan history" };
    }
    return {
      ok: false,
      message: `is empty but HEAD has ${rebuiltAtHead?.scenes.length ?? "unknown"} plans; run npm run making-of:index`,
    };
  }

  if (!fullSha(git, committed.head) || !isAncestor(git, committed.head, head)) {
    return {
      ok: false,
      message: `names head ${committed.head}, which is not in HEAD's history; run npm run making-of:index`,
    };
  }

  const rebuiltAtLeaf = indexAt(git, committed.head, repoPlans);
  if (!rebuiltAtLeaf) {
    return {
      ok: false,
      message: `does not match git at its own head ${committed.head.slice(0, SHA_LENGTH)}; run npm run making-of:index`,
    };
  }

  if (serializeMakingOf(rebuiltAtLeaf) !== text) {
    // If HEAD moved forward and a file under projects/ changed in a commit after committed.head,
    // verify the git history at committed.head against the committed plan metadata snapshot.
    const changedPlans =
      committed.head !== head &&
      (git(["diff", "--name-only", `${committed.head}..${head}`, "--", "projects"])?.trim() ?? "") !== "";
    if (!changedPlans) {
      return {
        ok: false,
        message: `does not match git at its own head ${committed.head.slice(0, SHA_LENGTH)}; run npm run making-of:index`,
      };
    }
    const committedMeta: Record<string, PlanMetadataInput> = {};
    for (const s of committed.scenes) {
      committedMeta[s.planId] = {
        planId: s.planId,
        title: s.title,
        summary: s.summary,
        roles: s.roles,
      };
    }
    const gitOnlyAtLeaf = indexAt(git, committed.head, committedMeta);
    if (!gitOnlyAtLeaf || serializeMakingOf(gitOnlyAtLeaf) !== text) {
      return {
        ok: false,
        message: `does not match git at its own head ${committed.head.slice(0, SHA_LENGTH)}; run npm run making-of:index`,
      };
    }
  }

  const lag = count(git, `${committed.head}..${head}`);
  if (lag === null || lag > maxLag) {
    return {
      ok: false,
      message: `is stale: ${lag ?? "unknown"} commits behind HEAD (at most ${maxLag}); run npm run making-of:index and commit it`,
    };
  }

  const nonMergeLag = countNonMerges(git, `${committed.head}..${head}`);
  if (nonMergeLag === null) {
    return { ok: false, message: "cannot count commits reachable from HEAD" };
  }

  if (strict && nonMergeLag > 0) {
    return {
      ok: false,
      message: `is stale for strict build: newest leaf ${committed.head.slice(0, SHA_LENGTH)} misses ${nonMergeLag} non-merge commit${nonMergeLag === 1 ? "" : "s"} at HEAD; run npm run making-of:index -- --strict`,
    };
  }

  return { ok: true, message: `matches git and trails HEAD by ${lag} commit${lag === 1 ? "" : "s"}` };
}

// --- command line ----------------------------------------------------------------------------------------------

const readText = (file: string) => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
};

export function main(argv: string[], git?: Git): number {
  const arg = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const file = resolve(arg("file") ?? DEFAULT_FILE);
  const repo = resolve(arg("repo") ?? ROOT);
  const strict = argv.includes("--strict");
  const rev = arg("rev") ?? (strict ? process.env.GITHUB_SHA : undefined);
  const run = git ?? gitRunner(repo);
  const text = readText(file);

  if (argv.includes("--check")) {
    const { ok, message } = checkMakingOf(run, repo, text, { strict, rev });
    (ok ? console.log : console.error)(`making-of:check: ${file} ${message}`);
    return ok ? 0 : 1;
  }

  const repoPlans = readRepoPlans(repo);

  if (strict) {
    const state = gitState(run, repo);
    if (state !== "full") {
      console.error(
        `making-of:index: strict generation requires full git history (${state === "shallow" ? "shallow clone; use fetch-depth: 0" : "git history unavailable"})`,
      );
      return 1;
    }
    const head = fullSha(run, "HEAD");
    if (!head) {
      console.error("making-of:index: strict generation failed: HEAD did not resolve");
      return 1;
    }
    if (rev?.trim()) {
      const want = fullSha(run, rev.trim());
      if (!want || want !== head) {
        console.error(
          `making-of:index: strict generation failed: build revision ${rev.trim()} does not match checked-out HEAD ${head}`,
        );
        return 1;
      }
    }
    let built: MakingOfSnapshot | null = null;
    try {
      built = indexAt(run, head, repoPlans);
    } catch (err) {
      console.error(`making-of:index: strict generation failed: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }
    if (!built || built.head === null) {
      console.error("making-of:index: strict generation failed: repository has no indexable plan commits");
      return 1;
    }
    const fresh = serializeMakingOf(built);
    if (fresh !== text) writeFileSync(file, fresh);
    const verified = checkMakingOf(run, repo, readText(file), { strict: true, rev, plans: repoPlans });
    if (!verified.ok) {
      console.error(`making-of:index: strict post-write check failed for ${file}: ${verified.message}`);
      return 1;
    }
    const totalCommits = built.scenes.reduce((sum, s) => sum + s.commitCount, 0);
    console.log(
      `making-of:index: git (strict full history at ${head.slice(0, SHA_LENGTH)}): ${built.scenes.length} scenes, ${totalCommits} commits in ${file}${fresh === text ? ", unchanged" : ""}`,
    );
    return 0;
  }

  const { snapshot: resolved, source, reason } = resolveMakingOf(
    run,
    repo,
    text === null ? null : parseMakingOf(text),
    repoPlans,
  );
  const fresh = serializeMakingOf(resolved);
  if (fresh !== text) writeFileSync(file, fresh);
  const totalCommits = resolved.scenes.reduce((sum, s) => sum + s.commitCount, 0);
  console.log(
    `making-of:index: ${source} (${reason}): ${resolved.scenes.length} scenes, ${totalCommits} commits in ${file}${fresh === text ? ", unchanged" : ""}`,
  );
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  process.exitCode = main(process.argv.slice(2));
}
