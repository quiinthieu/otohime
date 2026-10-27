// Builds content/yearly-log.json, the shared 12-month digest of git commit history,
// content/site.ts projects/notes, and content/ledger.json activity counts.
//
// In default (permissive) mode, without git, outside a work tree, or in a shallow clone,
// the committed content/yearly-log.json is the fallback and is left as it is (or spliced
// when the shallow clone still holds the fallback's head commit).
//   npm run yearly-log:index               write content/yearly-log.json (permissive fallback outside full git)
//   npm run yearly-log:index -- --strict   write from full git history and verify strictly
//   npm run yearly-log:check               exit 1 if malformed, non-canonical, or lagging HEAD > MAX_LAG
//   npm run yearly-log:check -- --strict   exit 1 unless full git history is present and matches HEAD
// --file=<path> reads or writes another file, --repo=<dir> indexes another checkout, --rev=<sha> pins the build SHA.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { site } from "../content/site.ts";
import { EMPTY_LEDGER, parseLedger } from "../lib/ledger-data.ts";
import {
  buildYearlyLog,
  cleanSubject,
  DEFAULT_YEAR,
  EMPTY_YEARLY_LOG,
  emptyMonths,
  emptyYearlyLog,
  flowerForMonth,
  isMonthKey,
  isoSecond,
  MAX_COMMITS_PER_MONTH,
  MAX_HIGHLIGHTS,
  MAX_HIGHLIGHTS_PER_MONTH,
  MAX_NOTES_PER_MONTH,
  MAX_PROJECTS_PER_MONTH,
  MONTH_KEYS,
  MONTHLY_FLOWERS,
  monthKeyOf,
  monthLog,
  parseYearlyLog,
  readYearlyLog,
  serializeYearlyLog,
  SHA_LENGTH,
  SUBJECT_MAX,
  splitPrefix,
  utcDayOf,
  validateYearlyLog,
  type BuildYearlyLogInput,
  type CommitInput,
  type MonthKey,
  type MonthlyHighlight,
  type MonthlyLog,
  type MonthlyNoteEntry,
  type NoteInput,
  type ProjectInput,
  type ShippedProjectEntry,
  type YearlyLog,
} from "../lib/yearly-log.ts";

export {
  buildYearlyLog,
  cleanSubject,
  DEFAULT_YEAR,
  EMPTY_YEARLY_LOG,
  emptyMonths,
  emptyYearlyLog,
  flowerForMonth,
  isMonthKey,
  isoSecond,
  MAX_COMMITS_PER_MONTH,
  MAX_HIGHLIGHTS,
  MAX_HIGHLIGHTS_PER_MONTH,
  MAX_NOTES_PER_MONTH,
  MAX_PROJECTS_PER_MONTH,
  MONTH_KEYS,
  MONTHLY_FLOWERS,
  monthKeyOf,
  monthLog,
  parseYearlyLog,
  readYearlyLog,
  serializeYearlyLog,
  SHA_LENGTH,
  SUBJECT_MAX,
  splitPrefix,
  utcDayOf,
  validateYearlyLog,
  type BuildYearlyLogInput,
  type CommitInput,
  type MonthKey,
  type MonthlyHighlight,
  type MonthlyLog,
  type MonthlyNoteEntry,
  type NoteInput,
  type ProjectInput,
  type ShippedProjectEntry,
  type YearlyLog,
};

const ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_FILE = join(ROOT, "content/yearly-log.json");

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

export type ParsedCommit = {
  sha: string;
  parents: number;
  entry: CommitInput;
};

export function parseLog(text: string): ParsedCommit[] {
  const out: ParsedCommit[] = [];
  for (const record of text.split(RS)) {
    if (!record.trim()) continue;
    const [header] = record.split("\n");
    const fields = header.split(US);
    if (fields.length !== 4 || !/^[0-9a-f]{40}$/.test(fields[0])) {
      throw new Error(`yearly-log: unexpected git log record ${JSON.stringify(header)}`);
    }
    const [sha, parents, rawDate, rawSubject] = fields;
    const date = isoSecond(rawDate);
    if (!date) throw new Error(`yearly-log: unexpected commit date ${JSON.stringify(rawDate)} on ${sha}`);
    const { plan, task, subject } = splitPrefix(cleanSubject(rawSubject));
    out.push({
      sha,
      parents: parents ? parents.split(" ").length : 0,
      entry: { sha, date, plan, task, subject },
    });
  }
  return out;
}

// --- reading repo content (site.ts + ledger.json) --------------------------------------------------------------

export type RepoContent = {
  projects: readonly ProjectInput[];
  notes: readonly NoteInput[];
  ledger: unknown;
};

function extractBracketBlock(source: string, keyPattern: RegExp): string | null {
  const start = source.search(keyPattern);
  if (start < 0) return null;
  const open = source.indexOf("[", start);
  if (open < 0) return null;
  let depth = 0;
  let quote = "";
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === '"' || c === "'" || c === "`") {
      quote = c;
    } else if (c === "[") {
      depth++;
    } else if (c === "]" && --depth === 0) {
      return source.slice(open + 1, i);
    }
  }
  return null;
}

function parseObjectBlocks(arrayBody: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  let quote = "";
  for (let i = 0; i < arrayBody.length; i++) {
    const c = arrayBody[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === '"' || c === "'" || c === "`") {
      quote = c;
    } else if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        out.push(arrayBody.slice(start + 1, i));
        start = -1;
      }
    }
  }
  return out;
}

function matchStringField(objText: string, field: string): string | undefined {
  const re = new RegExp(`\\b${field}:\\s*(["'])((?:\\\\.|(?!\\1).)*)\\1`);
  const m = re.exec(objText);
  if (!m) return undefined;
  return m[2].replace(/\\(["'\\])/g, "$1");
}

function matchBooleanField(objText: string, field: string): boolean | undefined {
  const re = new RegExp(`\\b${field}:\\s*(true|false)\\b`);
  const m = re.exec(objText);
  if (!m) return undefined;
  return m[1] === "true";
}

export function parseSiteSource(source: string): { projects: ProjectInput[]; notes: NoteInput[] } {
  const notesBlock = extractBracketBlock(source, /(?:^|\n)\s*notes:\s*\[/);
  const notes: NoteInput[] = [];
  if (notesBlock !== null) {
    for (const block of parseObjectBlocks(notesBlock)) {
      const title = matchStringField(block, "title");
      const date = matchStringField(block, "date");
      if (title && date) notes.push({ title, date });
    }
  }

  const projectsBlock = extractBracketBlock(source, /(?:^|\n)\s*projectList:\s*\[/);
  const projects: ProjectInput[] = [];
  if (projectsBlock !== null) {
    for (const block of parseObjectBlocks(projectsBlock)) {
      const title = matchStringField(block, "title");
      if (!title) continue;
      projects.push({
        title,
        href: matchStringField(block, "href"),
        status: matchStringField(block, "status"),
        started: matchStringField(block, "started"),
        shipped: matchStringField(block, "shipped"),
        lastActivityAt: matchStringField(block, "lastActivityAt"),
        abandoned: matchBooleanField(block, "abandoned"),
      });
    }
  }

  return { projects, notes };
}

export function readRepoContent(repo: string): RepoContent {
  let ledger: unknown = EMPTY_LEDGER;
  const ledgerPath = join(repo, "content/ledger.json");
  if (existsSync(ledgerPath)) {
    try {
      ledger = parseLedger(JSON.parse(readFileSync(ledgerPath, "utf8")));
    } catch {
      ledger = EMPTY_LEDGER;
    }
  }

  const sitePath = join(repo, "content/site.ts");
  let isRootRepo = false;
  try {
    isRootRepo = realpathSync(repo) === realpathSync(ROOT);
  } catch {
    isRootRepo = false;
  }

  if (existsSync(sitePath)) {
    try {
      const source = readFileSync(sitePath, "utf8");
      const parsed = parseSiteSource(source);
      return { projects: parsed.projects, notes: parsed.notes, ledger };
    } catch {
      if (isRootRepo) {
        return {
          projects: site.projectList as readonly ProjectInput[],
          notes: site.notes as readonly NoteInput[],
          ledger,
        };
      }
    }
  } else if (isRootRepo) {
    return {
      projects: site.projectList as readonly ProjectInput[],
      notes: site.notes as readonly NoteInput[],
      ledger,
    };
  }

  return { projects: [], notes: [], ledger };
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
  const text = git(["log", "--no-merges", "--no-color", "--root", LOG_FORMAT, range, "--"]);
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

export function indexAt(git: Git, rev = "HEAD", content: RepoContent = { projects: [], notes: [], ledger: EMPTY_LEDGER }): YearlyLog | null {
  const commits = log(git, rev);
  const total = count(git, rev);
  if (!commits || total === null) return null;
  if (commits.length === 0 && total > 0) return null;
  return buildYearlyLog({
    head: commits[0]?.sha ?? null,
    commits: commits.map((c) => c.entry),
    projects: content.projects,
    notes: content.notes,
    ledger: content.ledger,
  });
}

// In a shallow clone: extends the fallback with the commits since fallback.head when fallback.head is reachable
// and none of the newer commits sits on the parentless shallow boundary.
export function splice(git: Git, fallback: YearlyLog, rev = "HEAD"): YearlyLog | null {
  if (!fallback.head || !isAncestor(git, fallback.head, rev)) return null;
  const range = `${fallback.head}..${rev}`;
  const newer = log(git, range);
  const nonMergeAdded = countNonMerges(git, range);
  const totalAdded = count(git, range);
  if (!newer || nonMergeAdded === null || totalAdded === null || newer.length !== nonMergeAdded) return null;
  if (newer.some((c) => c.parents === 0)) return null;
  if (totalAdded === 0 || newer.length === 0) return fallback;

  const months = emptyMonths();
  for (const key of MONTH_KEYS) {
    const prev = fallback.months[key];
    months[key] = {
      month: prev.month,
      flower: prev.flower,
      commits: prev.commits,
      shippedProjects: prev.shippedProjects.map((p) => ({ ...p })),
      notes: prev.notes.map((n) => ({ ...n })),
      highlights: prev.highlights.map((h) => ({ ...h })),
    };
  }

  const newerByMonth = new Map<MonthKey, MonthlyHighlight[]>();
  for (const key of MONTH_KEYS) newerByMonth.set(key, []);

  for (const c of newer) {
    const monthKey = c.entry.date.slice(5, 7) as MonthKey;
    if (!isMonthKey(monthKey)) continue;
    newerByMonth.get(monthKey)!.push({
      sha: c.sha.slice(0, SHA_LENGTH),
      date: c.entry.date,
      plan: c.entry.plan ?? null,
      subject: c.entry.subject,
    });
  }

  for (const key of MONTH_KEYS) {
    const added = newerByMonth.get(key)!;
    if (added.length === 0) continue;
    months[key].commits = Math.min(MAX_COMMITS_PER_MONTH, months[key].commits + added.length);
    months[key].highlights = [...added, ...months[key].highlights].slice(0, MAX_HIGHLIGHTS_PER_MONTH);
  }

  const newestYear = Number(newer[0].entry.date.slice(0, 4));
  return {
    version: 1,
    head: newer[0].sha,
    generatedYear: Number.isSafeInteger(newestYear) ? newestYear : fallback.generatedYear,
    months,
  };
}

export type Resolution = {
  log: YearlyLog;
  source: "git" | "spliced" | "fallback" | "empty";
  reason: string;
};

export function resolveYearlyLog(
  git: Git,
  repo: string,
  fallback: YearlyLog | null,
  content?: RepoContent,
): Resolution {
  const repoContent = content ?? readRepoContent(repo);
  const state = gitState(git, repo);
  let failure = "";
  try {
    if (state === "full") {
      const built = indexAt(git, "HEAD", repoContent);
      if (built) return { log: built, source: "git", reason: "full history" };
    }
    if (state === "shallow" && fallback) {
      const spliced = splice(git, fallback, "HEAD");
      if (spliced) return { log: spliced, source: "spliced", reason: "shallow clone holding the fallback's head" };
    }
  } catch (err) {
    failure = `: ${err instanceof Error ? err.message : String(err)}`;
  }
  const reason =
    (state === "none" ? "git history unavailable" : state === "shallow" ? "shallow clone" : "git log failed") +
    failure;
  if (fallback) {
    return { log: fallback, source: "fallback", reason };
  }
  const empty = buildYearlyLog({
    head: null,
    projects: repoContent.projects,
    notes: repoContent.notes,
    ledger: repoContent.ledger,
  });
  return { log: empty, source: "empty", reason: `${reason}, no valid fallback` };
}

export type CheckResult = { ok: boolean; message: string };
export type CheckOptions = {
  maxLag?: number;
  strict?: boolean;
  rev?: string | null;
  content?: RepoContent;
};

export function checkYearlyLog(
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

  if (text === null) return { ok: false, message: "is missing; run npm run yearly-log:index" };
  const committed = parseYearlyLog(text);
  if (!committed) return { ok: false, message: "is malformed or over its bounds; run npm run yearly-log:index" };
  if (serializeYearlyLog(committed) !== text) {
    return { ok: false, message: "is not in canonical form; run npm run yearly-log:index" };
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

  const repoContent = opts.content ?? readRepoContent(repo);

  if (committed.head === null) {
    const n = count(git, "HEAD");
    if (!strict && n === 0) {
      const rebuiltEmpty = buildYearlyLog({
        head: null,
        year: committed.generatedYear,
        projects: repoContent.projects,
        notes: repoContent.notes,
        ledger: repoContent.ledger,
      });
      if (serializeYearlyLog(rebuiltEmpty) !== text) {
        return { ok: false, message: "does not match content at empty history; run npm run yearly-log:index" };
      }
      return { ok: true, message: "is empty, as is the history" };
    }
    return { ok: false, message: `has null head but HEAD has ${n ?? "unknown"} commits; run npm run yearly-log:index` };
  }

  if (!fullSha(git, committed.head) || !isAncestor(git, committed.head, head)) {
    return {
      ok: false,
      message: `names head ${committed.head}, which is not in HEAD's history; run npm run yearly-log:index`,
    };
  }

  const rebuiltAtLeaf = indexAt(git, committed.head, repoContent);
  if (!rebuiltAtLeaf) {
    return {
      ok: false,
      message: `does not match git at its own head ${committed.head.slice(0, SHA_LENGTH)}; run npm run yearly-log:index`,
    };
  }

  if (serializeYearlyLog(rebuiltAtLeaf) !== text) {
    // If HEAD moved forward and content/site.ts or content/ledger.json changed in a commit after committed.head,
    // verify the git history at committed.head against the committed projects/notes snapshot.
    const changedContent =
      committed.head !== head &&
      (git(["diff", "--name-only", `${committed.head}..${head}`, "--", "content/site.ts", "content/ledger.json"])
        ?.trim() ?? "") !== "";
    if (!changedContent) {
      return {
        ok: false,
        message: `does not match git at its own head ${committed.head.slice(0, SHA_LENGTH)}; run npm run yearly-log:index`,
      };
    }
    const gitOnlyAtLeaf = indexAt(git, committed.head, {
      projects: Object.values(committed.months).flatMap((m) => m.shippedProjects),
      notes: Object.values(committed.months).flatMap((m) => m.notes),
      ledger: repoContent.ledger,
    });
    if (!gitOnlyAtLeaf || serializeYearlyLog(gitOnlyAtLeaf) !== text) {
      return {
        ok: false,
        message: `does not match git at its own head ${committed.head.slice(0, SHA_LENGTH)}; run npm run yearly-log:index`,
      };
    }
  }

  const lag = count(git, `${committed.head}..${head}`);
  if (lag === null || lag > maxLag) {
    return {
      ok: false,
      message: `is stale: ${lag ?? "unknown"} commits behind HEAD (at most ${maxLag}); run npm run yearly-log:index and commit it`,
    };
  }

  const nonMergeLag = countNonMerges(git, `${committed.head}..${head}`);
  if (nonMergeLag === null) {
    return { ok: false, message: "cannot count commits reachable from HEAD" };
  }

  if (strict && nonMergeLag > 0) {
    return {
      ok: false,
      message: `is stale for strict build: newest leaf ${committed.head.slice(0, SHA_LENGTH)} misses ${nonMergeLag} non-merge commit${nonMergeLag === 1 ? "" : "s"} at HEAD; run npm run yearly-log:index -- --strict`,
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
    const { ok, message } = checkYearlyLog(run, repo, text, { strict, rev });
    (ok ? console.log : console.error)(`yearly-log:check: ${file} ${message}`);
    return ok ? 0 : 1;
  }

  const repoContent = readRepoContent(repo);

  if (strict) {
    const state = gitState(run, repo);
    if (state !== "full") {
      console.error(
        `yearly-log:index: strict generation requires full git history (${state === "shallow" ? "shallow clone; use fetch-depth: 0" : "git history unavailable"})`,
      );
      return 1;
    }
    const head = fullSha(run, "HEAD");
    if (!head) {
      console.error("yearly-log:index: strict generation failed: HEAD did not resolve");
      return 1;
    }
    if (rev?.trim()) {
      const want = fullSha(run, rev.trim());
      if (!want || want !== head) {
        console.error(
          `yearly-log:index: strict generation failed: build revision ${rev.trim()} does not match checked-out HEAD ${head}`,
        );
        return 1;
      }
    }
    let built: YearlyLog | null = null;
    try {
      built = indexAt(run, head, repoContent);
    } catch (err) {
      console.error(`yearly-log:index: strict generation failed: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }
    if (!built || built.head === null) {
      console.error("yearly-log:index: strict generation failed: repository has no indexable commits");
      return 1;
    }
    const fresh = serializeYearlyLog(built);
    if (fresh !== text) writeFileSync(file, fresh);
    const verified = checkYearlyLog(run, repo, readText(file), { strict: true, rev, content: repoContent });
    if (!verified.ok) {
      console.error(`yearly-log:index: strict post-write check failed for ${file}: ${verified.message}`);
      return 1;
    }
    const totalCommits = MONTH_KEYS.reduce((sum, k) => sum + built.months[k].commits, 0);
    console.log(
      `yearly-log:index: git (strict full history at ${head.slice(0, SHA_LENGTH)}): 12 months, ${totalCommits} commits in ${file}${fresh === text ? ", unchanged" : ""}`,
    );
    return 0;
  }

  const { log: resolved, source, reason } = resolveYearlyLog(
    run,
    repo,
    text === null ? null : parseYearlyLog(text),
    repoContent,
  );
  const fresh = serializeYearlyLog(resolved);
  if (fresh !== text) writeFileSync(file, fresh);
  const totalCommits = MONTH_KEYS.reduce((sum, k) => sum + resolved.months[k].commits, 0);
  console.log(
    `yearly-log:index: ${source} (${reason}): 12 months, ${totalCommits} commits in ${file}${fresh === text ? ", unchanged" : ""}`,
  );
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  process.exitCode = main(process.argv.slice(2));
}
