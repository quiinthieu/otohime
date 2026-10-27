// Builds content/history.json, the Tamatebako's changelog: the newest MAX_ENTRIES non-merge commits of this
// repository, each with its commit date, subject, plan/task prefix and a summary of the files it changed. It runs at
// build time (the prebuild step in package.json); the palace imports the JSON and never runs git. No author names
// or emails are read.
//
// In default (permissive) mode, without git, outside a work tree, or in a shallow clone, the committed
// content/history.json is the fallback and is left as it is. A shallow clone that still holds the fallback's head
// commit gets the newer commits spliced on top, so the result matches a full clone.
// In strict delivery mode (--strict), full git history at the build revision is required; shallow clones, missing git,
// mismatched build SHAs, stale leaves (> MAX_LAG) or total mismatches exit 1.
//   npm run history:index                 write the index (permissive fallback outside full git)
//   npm run history:index -- --strict     write the index from full git history and verify it strictly
//   npm run history:check                 exit 1 if the index is malformed, differs from git, or lags HEAD > MAX_LAG
//   npm run history:check -- --strict     exit 1 unless full git history is present and the file matches HEAD and total
// --file=<path> reads or writes another file, --repo=<dir> indexes another checkout, --rev=<sha> pins the build SHA.
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_FILE = join(ROOT, "content/history.json");

export const MAX_ENTRIES = 200;
export const SUBJECT_MAX = 100;
export const AREAS_MAX = 3;
export const SHA_LENGTH = 10;
// How many commits the committed fallback may trail HEAD by before --check calls it stale. The commit that
// refreshes the file can never list itself, so a freshly committed index already trails by one.
export const MAX_LAG = 20;

export type HistoryEntry = {
  sha: string; // the first SHA_LENGTH hex digits
  date: string; // committer date, ISO 8601 in UTC to the second
  plan: string | null; // "pm-256" from "pm-256/t-1560: …"
  task: string | null; // "t-1560", or the role tag ("plan", "acceptance") after the plan id
  subject: string; // the subject line without its prefix, at most SUBJECT_MAX characters
  files: number;
  added: number; // lines; binary files count as files only
  removed: number;
  areas: string[]; // the AREAS_MAX areas with the most changed files (lib, components, app/(ryugu), …)
};

export type HistoryIndex = {
  version: 1;
  head: string | null; // full SHA of the newest indexed non-merge commit, null when empty
  total: number; // all commits reachable from the indexed revision (git rev-list --count), of which entries holds the newest MAX_ENTRIES non-merge leaves
  entries: HistoryEntry[];
};

export const EMPTY_INDEX: HistoryIndex = { version: 1, head: null, total: 0, entries: [] };

// Runs git with the given arguments and returns its stdout, or null on any failure (no binary, not a repository,
// unknown revision, non-zero exit).
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

// --- parsing ---------------------------------------------------------------------------------------------------

const RS = "\x1e";
const US = "\x1f";
const LOG_FORMAT = "--format=%x1e%H%x1f%P%x1f%cI%x1f%s";
const PREFIX = /^(pm-\d+)\/([A-Za-z0-9_-]+):\s*/;
const NUMSTAT = /^(\d+|-)\t(\d+|-)\t(.+)$/;

export function splitPrefix(raw: string): { plan: string | null; task: string | null; subject: string } {
  const m = PREFIX.exec(raw);
  return m ? { plan: m[1], task: m[2], subject: raw.slice(m[0].length) } : { plan: null, task: null, subject: raw };
}

export function cleanSubject(raw: string): string {
  const s = raw.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim();
  const chars = [...s];
  return chars.length <= SUBJECT_MAX ? s : `${chars.slice(0, SUBJECT_MAX - 1).join("").trimEnd()}…`;
}

// The area a changed path belongs to: its top-level directory, the route group under app/, or a root file's name.
export function areaOf(path: string): string {
  const p = path.replace(/^"|"$/g, "");
  const parts = p.split("/");
  if (parts.length === 1) return p;
  if (parts[0] === "app" && parts.length > 2) return `app/${parts[1]}`;
  return parts[0];
}

export function summarize(paths: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const p of paths) counts.set(areaOf(p), (counts.get(areaOf(p)) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, AREAS_MAX)
    .map(([area]) => area);
}

export function isoSecond(date: string): string | null {
  const ms = Date.parse(date);
  return Number.isFinite(ms) ? new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z") : null;
}

export type ParsedCommit = { sha: string; parents: number; entry: HistoryEntry };

// Parses `git log --numstat` output written with LOG_FORMAT. A record that does not parse throws rather than ship a
// guess; resolveHistory turns that into the fallback and names the error.
export function parseLog(text: string): ParsedCommit[] {
  const out: ParsedCommit[] = [];
  for (const record of text.split(RS)) {
    if (!record.trim()) continue;
    const [header, ...rest] = record.split("\n");
    const fields = header.split(US);
    if (fields.length !== 4 || !/^[0-9a-f]{40}$/.test(fields[0])) throw new Error(`history: unexpected git log record ${JSON.stringify(header)}`);
    const [sha, parents, rawDate, rawSubject] = fields;
    const date = isoSecond(rawDate);
    if (!date) throw new Error(`history: unexpected commit date ${JSON.stringify(rawDate)} on ${sha}`);
    const paths: string[] = [];
    let added = 0;
    let removed = 0;
    for (const line of rest) {
      if (!line) continue;
      const m = NUMSTAT.exec(line);
      if (!m) throw new Error(`history: unexpected numstat line ${JSON.stringify(line)} on ${sha}`);
      if (m[1] !== "-") added += Number(m[1]);
      if (m[2] !== "-") removed += Number(m[2]);
      paths.push(m[3]);
    }
    const { plan, task, subject } = splitPrefix(cleanSubject(rawSubject));
    out.push({
      sha,
      parents: parents ? parents.split(" ").length : 0,
      entry: { sha: sha.slice(0, SHA_LENGTH), date, plan, task, subject, files: paths.length, added, removed, areas: summarize(paths) },
    });
  }
  return out;
}

// --- validation and serialization ------------------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const hasKeys = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).length === keys.length && keys.every((k) => k in v);
const ENTRY_KEYS = ["sha", "date", "plan", "task", "subject", "files", "added", "removed", "areas"] as const;
const INDEX_KEYS = ["version", "head", "total", "entries"] as const;

function validEntry(v: unknown): v is HistoryEntry {
  if (!isRecord(v) || !hasKeys(v, ENTRY_KEYS)) return false;
  if (typeof v.sha !== "string" || !new RegExp(`^[0-9a-f]{${SHA_LENGTH}}$`).test(v.sha)) return false;
  if (typeof v.date !== "string" || isoSecond(v.date) !== v.date) return false;
  if (v.plan !== null && (typeof v.plan !== "string" || !/^pm-\d+$/.test(v.plan))) return false;
  if (v.task !== null && (typeof v.task !== "string" || !/^[A-Za-z0-9_-]+$/.test(v.task))) return false;
  if ((v.plan === null) !== (v.task === null)) return false;
  if (typeof v.subject !== "string" || cleanSubject(v.subject) !== v.subject) return false;
  if (!isCount(v.files) || !isCount(v.added) || !isCount(v.removed)) return false;
  if (!Array.isArray(v.areas) || v.areas.length > Math.min(AREAS_MAX, v.files)) return false;
  return v.areas.every((a) => typeof a === "string" && a.length > 0);
}

// The index if `v` is a well-formed, bounded HistoryIndex, otherwise null. Every field is checked, including the
// optional-looking ones, so a hand-edited fallback cannot slip a malformed entry into the palace.
export function validateIndex(v: unknown): HistoryIndex | null {
  if (!isRecord(v) || !hasKeys(v, INDEX_KEYS) || v.version !== 1) return null;
  if (!Array.isArray(v.entries) || v.entries.length > MAX_ENTRIES || !v.entries.every(validEntry)) return null;
  if (!isCount(v.total) || v.total < v.entries.length) return null;
  if (v.head === null) return v.entries.length === 0 && v.total === 0 ? (v as HistoryIndex) : null;
  if (typeof v.head !== "string" || !/^[0-9a-f]{40}$/.test(v.head)) return null;
  if (v.entries.length === 0 || !v.head.startsWith(v.entries[0].sha)) return null;
  if (v.entries.length === 1 && v.total !== 1) return null;
  return v as HistoryIndex;
}

// One entry per line, keys in a fixed order: the same index always serializes to the same bytes, and a refresh
// diffs as the handful of lines it added.
export function serializeHistory(index: HistoryIndex): string {
  const entry = (e: HistoryEntry) =>
    JSON.stringify({ sha: e.sha, date: e.date, plan: e.plan, task: e.task, subject: e.subject, files: e.files, added: e.added, removed: e.removed, areas: e.areas });
  const entries = index.entries.length ? `[\n${index.entries.map((e) => `    ${entry(e)}`).join(",\n")}\n  ]` : "[]";
  return `{\n  "version": 1,\n  "head": ${JSON.stringify(index.head)},\n  "total": ${index.total},\n  "entries": ${entries}\n}\n`;
}

export function parseHistory(text: string): HistoryIndex | null {
  try {
    return validateIndex(JSON.parse(text));
  } catch {
    return null;
  }
}

// --- reading git -----------------------------------------------------------------------------------------------

export type GitState = "full" | "shallow" | "none";

// "full" only for the repository whose top level is `repo` itself, with at least one commit: a source archive
// unpacked inside some other checkout must not index that checkout's history.
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

function log(git: Git, range: string, limit: number): ParsedCommit[] | null {
  const text = git(["log", "--no-merges", "--no-renames", "--no-color", "--root", `--max-count=${limit}`, LOG_FORMAT, "--numstat", range, "--"]);
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

const isAncestor = (git: Git, older: string, newer: string) => git(["merge-base", "--is-ancestor", older, newer]) !== null;

// The index at `rev`, read straight from git: newest MAX_ENTRIES non-merge leaves and total reachable commits; null if git fails.
export function indexAt(git: Git, rev = "HEAD"): HistoryIndex | null {
  const commits = log(git, rev, MAX_ENTRIES);
  const total = count(git, rev);
  if (!commits || total === null) return null;
  if (commits.length === 0) return total === 0 ? EMPTY_INDEX : null;
  return { version: 1, head: commits[0].sha, total, entries: commits.map((c) => c.entry) };
}

// In a shallow clone: the fallback with the commits since its head on top, if the clone still holds that head and
// every commit since it with its parents (a commit at the shallow boundary has none and would list its whole tree
// as changed). Null when the fallback cannot be extended exactly.
export function splice(git: Git, fallback: HistoryIndex, rev = "HEAD"): HistoryIndex | null {
  if (!fallback.head || !isAncestor(git, fallback.head, rev)) return null;
  const range = `${fallback.head}..${rev}`;
  const newer = log(git, range, MAX_ENTRIES);
  const nonMergeAdded = countNonMerges(git, range);
  const totalAdded = count(git, range);
  if (!newer || nonMergeAdded === null || totalAdded === null || newer.length !== Math.min(nonMergeAdded, MAX_ENTRIES)) return null;
  if (newer.some((c) => c.parents === 0)) return null;
  if (totalAdded === 0) return fallback;
  const entries = [...newer.map((c) => c.entry), ...fallback.entries].slice(0, MAX_ENTRIES);
  return { version: 1, head: newer[0]?.sha ?? fallback.head, total: fallback.total + totalAdded, entries };
}

export type Resolution = { index: HistoryIndex; source: "git" | "spliced" | "fallback" | "empty"; reason: string };

// What the build should ship: git's index when the history is complete, else the committed fallback (extended when
// possible), else an empty index. Never throws for a missing or broken git.
export function resolveHistory(git: Git, repo: string, fallback: HistoryIndex | null): Resolution {
  const state = gitState(git, repo);
  let failure = "";
  try {
    if (state === "full") {
      const index = indexAt(git);
      if (index) return { index, source: "git", reason: "full history" };
    }
    if (state === "shallow" && fallback) {
      const index = splice(git, fallback);
      if (index) return { index, source: "spliced", reason: "shallow clone holding the fallback's head" };
    }
  } catch (err) {
    failure = `: ${err instanceof Error ? err.message : String(err)}`;
  }
  const reason = (state === "none" ? "git history unavailable" : state === "shallow" ? "shallow clone" : "git log failed") + failure;
  return fallback ? { index: fallback, source: "fallback", reason } : { index: EMPTY_INDEX, source: "empty", reason: `${reason}, no valid fallback` };
}

export type CheckResult = { ok: boolean; message: string };
export type CheckOptions = {
  maxLag?: number;
  strict?: boolean;
  rev?: string | null;
};

export function checkHistory(
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

  if (text === null) return { ok: false, message: "is missing; run npm run history:index" };
  const committed = parseHistory(text);
  if (!committed) return { ok: false, message: "is malformed or over its bounds; run npm run history:index" };
  if (serializeHistory(committed) !== text) return { ok: false, message: "is not in canonical form; run npm run history:index" };

  const state = gitState(git, repo);
  if (state !== "full") {
    if (strict) {
      return {
        ok: false,
        message: `strict check requires full git history (${state === "shallow" ? "shallow clone; use fetch-depth: 0" : "no git history"})`,
      };
    }
    return { ok: true, message: `is well-formed (${state === "shallow" ? "shallow clone" : "no git history"}: not compared with git)` };
  }

  const head = fullSha(git, "HEAD");
  if (!head) return { ok: false, message: "cannot be checked: HEAD did not resolve" };
  if (expectedRev) {
    const want = fullSha(git, expectedRev);
    if (!want || want !== head) {
      return { ok: false, message: `build revision ${expectedRev} does not match checked-out HEAD ${head}` };
    }
  }

  if (committed.head === null) {
    const n = count(git, "HEAD");
    return !strict && n === 0
      ? { ok: true, message: "is empty, as is the history" }
      : { ok: false, message: `is empty but HEAD has ${n ?? "unknown"} commits; run npm run history:index` };
  }

  if (!fullSha(git, committed.head) || !isAncestor(git, committed.head, head)) {
    return { ok: false, message: `names head ${committed.head}, which is not in HEAD's history; run npm run history:index` };
  }

  const rebuiltAtLeaf = indexAt(git, committed.head);
  if (!rebuiltAtLeaf || serializeHistory({ ...rebuiltAtLeaf, total: committed.total }) !== text) {
    return { ok: false, message: `does not match git at its own head ${committed.head.slice(0, SHA_LENGTH)}; run npm run history:index` };
  }

  const lag = count(git, `${committed.head}..${head}`);
  if (lag === null || lag > maxLag) {
    return { ok: false, message: `is stale: ${lag ?? "unknown"} commits behind HEAD (at most ${maxLag}); run npm run history:index and commit it` };
  }

  const headTotal = count(git, head);
  const nonMergeLag = countNonMerges(git, `${committed.head}..${head}`);
  if (headTotal === null || nonMergeLag === null) {
    return { ok: false, message: "cannot count commits reachable from HEAD" };
  }

  if (strict) {
    if (committed.total !== headTotal) {
      return {
        ok: false,
        message: `does not match git: total ${committed.total} != ${headTotal} (git rev-list --count HEAD); run npm run history:index -- --strict`,
      };
    }
    if (nonMergeLag > 0) {
      return {
        ok: false,
        message: `is stale for strict build: newest leaf ${committed.head.slice(0, SHA_LENGTH)} misses ${nonMergeLag} non-merge commit${nonMergeLag === 1 ? "" : "s"} at HEAD; run npm run history:index -- --strict`,
      };
    }
  } else {
    const validLeafTotal = committed.total === rebuiltAtLeaf.total;
    const validMergeHeadTotal = nonMergeLag === 0 && committed.total === headTotal;
    if (!validLeafTotal && !validMergeHeadTotal) {
      return {
        ok: false,
        message: `does not match git at its own head ${committed.head.slice(0, SHA_LENGTH)}: total ${committed.total} != ${rebuiltAtLeaf.total}; run npm run history:index`,
      };
    }
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
    const { ok, message } = checkHistory(run, repo, text, { strict, rev });
    (ok ? console.log : console.error)(`history:check: ${file} ${message}`);
    return ok ? 0 : 1;
  }
  if (strict) {
    const state = gitState(run, repo);
    if (state !== "full") {
      console.error(
        `history:index: strict generation requires full git history (${state === "shallow" ? "shallow clone; use fetch-depth: 0" : "git history unavailable"})`,
      );
      return 1;
    }
    const head = fullSha(run, "HEAD");
    if (!head) {
      console.error("history:index: strict generation failed: HEAD did not resolve");
      return 1;
    }
    if (rev?.trim()) {
      const want = fullSha(run, rev.trim());
      if (!want || want !== head) {
        console.error(`history:index: strict generation failed: build revision ${rev.trim()} does not match checked-out HEAD ${head}`);
        return 1;
      }
    }
    let index: HistoryIndex | null = null;
    try {
      index = indexAt(run, head);
    } catch (err) {
      console.error(`history:index: strict generation failed: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }
    if (!index || index.head === null) {
      console.error("history:index: strict generation failed: repository has no indexable commits");
      return 1;
    }
    const fresh = serializeHistory(index);
    if (fresh !== text) writeFileSync(file, fresh);
    const verified = checkHistory(run, repo, readText(file), { strict: true, rev });
    if (!verified.ok) {
      console.error(`history:index: strict post-write check failed for ${file}: ${verified.message}`);
      return 1;
    }
    console.log(
      `history:index: git (strict full history at ${head.slice(0, SHA_LENGTH)}): ${index.entries.length} of ${index.total} commits in ${file}${fresh === text ? ", unchanged" : ""}`,
    );
    return 0;
  }
  const { index, source, reason } = resolveHistory(run, repo, text === null ? null : parseHistory(text));
  const fresh = serializeHistory(index);
  if (fresh !== text) writeFileSync(file, fresh);
  console.log(`history:index: ${source} (${reason}): ${index.entries.length} of ${index.total} commits in ${file}${fresh === text ? ", unchanged" : ""}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) process.exitCode = main(process.argv.slice(2));
