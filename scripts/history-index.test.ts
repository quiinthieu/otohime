// The Tamatebako's history index (scripts/history-index.ts). The pure parts are tested on fixed text; the git parts
// run against throwaway repositories whose author and committer dates are pinned, so every run indexes the same
// bytes. Shallow clones come from `git clone --depth` over file://, and "no git" is a missing binary and a plain
// directory.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import {
  AREAS_MAX,
  areaOf,
  checkHistory,
  cleanSubject,
  EMPTY_INDEX,
  gitRunner,
  gitState,
  indexAt,
  MAX_ENTRIES,
  parseHistory,
  parseLog,
  resolveHistory,
  serializeHistory,
  splitPrefix,
  SUBJECT_MAX,
  summarize,
  validateIndex,
  type HistoryIndex,
} from "./history-index.ts";

const ROOT = join(import.meta.dirname, "..");
const SCRIPT = join(import.meta.dirname, "history-index.ts");
const TMP = mkdtempSync(join(tmpdir(), "history-index-"));
after(() => rmSync(TMP, { recursive: true, force: true }));

// Fixtures make hundreds of quick commits, and git's detached auto-maintenance (gc --auto, maintenance run --auto)
// would repack and prune their objects under a running test ("bad tree object HEAD"). It is turned off through the
// environment, and on process.env too, because the code under test runs git with the inherited environment.
Object.assign(process.env, { GIT_CONFIG_COUNT: "2", GIT_CONFIG_KEY_0: "gc.auto", GIT_CONFIG_VALUE_0: "0", GIT_CONFIG_KEY_1: "maintenance.auto", GIT_CONFIG_VALUE_1: "false" });
delete process.env.GITHUB_SHA;
// No user or system config, so a signing hook or a log.* setting on the machine cannot change the fixtures.
const GIT_ENV = { ...process.env, GITHUB_SHA: "", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.test", GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.test" };
const sh = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

let repos = 0;
type Commit = { subject: string; files: Record<string, string> };

// A repository with the given commits, the n-th dated n hours after a fixed instant. The whole history is one
// `git fast-import` stream, not two subprocesses per commit. Built commit by commit, the 205-commit fixture ran
// for seconds and a macOS gate still lost HEAD's tree partway through it ("bad tree object HEAD" at commit 180)
// with auto-maintenance already off; the cause was never observed. One process writing one pack leaves far less
// room for it. The work tree and index are then checked out, so later commits, checkouts and merges start
// from a clean tree.
function fixtureRepo(commits: readonly Commit[]): string {
  const dir = join(TMP, `repo-${repos++}`);
  mkdirSync(dir);
  sh(dir, "init", "--quiet", "--initial-branch=main");
  const parts: Buffer[] = [];
  const data = (body: string | Buffer) => {
    const bytes = Buffer.from(body);
    parts.push(Buffer.from(`data ${bytes.length}\n`), bytes, Buffer.from("\n"));
  };
  commits.forEach((c, i) => {
    const when = `${Date.UTC(2026, 8, 1) / 1000 + i * 3600} +0000`;
    parts.push(Buffer.from(`commit refs/heads/main\nauthor Fixture <fixture@example.test> ${when}\ncommitter Fixture <fixture@example.test> ${when}\n`));
    data(`${c.subject}\n`);
    for (const [path, body] of Object.entries(c.files)) {
      parts.push(Buffer.from(`M 100644 inline ${path}\n`));
      data(body);
    }
  });
  if (commits.length > 0) {
    execFileSync("git", ["fast-import", "--quiet", "--done"], { cwd: dir, env: GIT_ENV, input: Buffer.concat([...parts, Buffer.from("done\n")]), stdio: ["pipe", "pipe", "pipe"] });
    sh(dir, "reset", "--quiet", "--hard", "main");
  }
  return dir;
}

function shallowClone(src: string, depth: number): string {
  const dir = join(TMP, `clone-${repos++}`);
  sh(TMP, "clone", "--quiet", `--depth=${depth}`, `file://${src}`, dir);
  return dir;
}

const commitsN = (n: number): Commit[] =>
  Array.from({ length: n }, (_, i) => ({ subject: `pm-9/t-${i}: Step ${i}`, files: { [`lib/step-${i}.ts`]: `export const n = ${i};\n` } }));

function runScript(...args: string[]) {
  return spawnSync(process.execPath, ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", SCRIPT, ...args], {
    encoding: "utf8",
    env: GIT_ENV,
  });
}

const SAMPLE: Commit[] = [
  { subject: "Initial commit", files: { "README.md": "hi\n", "package.json": "{}\n" } },
  { subject: "pm-256/t-1559: Enter Ryugu-jo", files: { "app/(ryugu)/layout.tsx": "a\nb\n", "app/(ryugu)/_lib/scene.ts": "c\n", "components/handheld.tsx": "d\n" } },
  { subject: "pm-256/plan: Draft Ryugu Palace plan", files: { "projects/ryugu/plan.md": "plan\n" } },
  { subject: "feat: tidy    the\tsubject", files: { "README.md": "hello\nworld\n", "public/fish.png": "\x00\x01\x02binary" } },
];

// --- pure parts ------------------------------------------------------------------------------------------------

test("a plan/task prefix is split off the subject, and anything else is left as written", () => {
  assert.deepEqual(splitPrefix("pm-256/t-1560: Build static history index"), { plan: "pm-256", task: "t-1560", subject: "Build static history index" });
  assert.deepEqual(splitPrefix("pm-249/acceptance: Acceptance report"), { plan: "pm-249", task: "acceptance", subject: "Acceptance report" });
  assert.deepEqual(splitPrefix("feat: add pond"), { plan: null, task: null, subject: "feat: add pond" });
  assert.deepEqual(splitPrefix("pm-256 t-1: no slash"), { plan: null, task: null, subject: "pm-256 t-1: no slash" });
});

test("subjects lose control characters and runs of space, and are capped with an ellipsis", () => {
  assert.equal(cleanSubject("  a\tb\u0007  c  "), "a b c");
  const long = cleanSubject("x".repeat(500));
  assert.equal([...long].length, SUBJECT_MAX);
  assert.ok(long.endsWith("…"));
  assert.equal(cleanSubject("y".repeat(SUBJECT_MAX)), "y".repeat(SUBJECT_MAX));
});

test("changed paths summarize into at most AREAS_MAX areas, most files first, ties by name", () => {
  assert.equal(areaOf("app/(ryugu)/_lib/scene.ts"), "app/(ryugu)");
  assert.equal(areaOf("app/layout.tsx"), "app");
  assert.equal(areaOf("lib/peeks.ts"), "lib");
  assert.equal(areaOf("package.json"), "package.json");
  assert.equal(areaOf('"lib/odd\\tname.ts"'), "lib");
  assert.deepEqual(summarize(["lib/a.ts", "components/b.tsx", "lib/c.ts", "e2e/d.ts", "app/(x)/e.tsx", "app/(x)/f.tsx"]), ["app/(x)", "lib", "components"]);
  assert.equal(summarize(["a/1", "b/1", "c/1", "d/1", "e/1"]).length, AREAS_MAX);
  assert.deepEqual(summarize([]), []);
});

test("git log text parses into entries with dates in UTC, line counts and binary files counted as files", () => {
  const sha = "0123456789abcdef0123456789abcdef01234567";
  const text = `\x1e${sha}\x1fparent1 parent2\x1f2026-10-26T12:30:05+02:00\x1fpm-1/t-2: Do it\n\n3\t1\tlib/a.ts\n-\t-\tpublic/b.png\n\x1e${"f".repeat(40)}\x1f\x1f2026-01-01T00:00:00Z\x1fRoot\n`;
  const [first, root] = parseLog(text);
  assert.equal(first.parents, 2);
  assert.deepEqual(first.entry, { sha: "0123456789", date: "2026-10-26T10:30:05Z", plan: "pm-1", task: "t-2", subject: "Do it", files: 2, added: 3, removed: 1, areas: ["lib", "public"] });
  assert.equal(root.parents, 0);
  assert.equal(root.entry.files, 0);
  assert.throws(() => parseLog("\x1enot a record\n"), /unexpected git log record/);
  assert.throws(() => parseLog(`\x1e${sha}\x1f\x1fnot a date\x1fx\n`), /unexpected commit date/);
  assert.throws(() => parseLog(`\x1e${sha}\x1f\x1f2026-01-01T00:00:00Z\x1fx\n\ngarbage line\n`), /unexpected numstat/);
});

test("validation rejects every malformed field, including optional-looking ones, and over-long lists", () => {
  const good: HistoryIndex = {
    version: 1,
    head: "0123456789abcdef0123456789abcdef01234567",
    total: 1,
    entries: [{ sha: "0123456789", date: "2026-10-26T10:30:05Z", plan: "pm-1", task: "t-2", subject: "Do it", files: 1, added: 1, removed: 0, areas: ["lib"] }],
  };
  assert.deepEqual(validateIndex(good), good);
  assert.deepEqual(validateIndex(EMPTY_INDEX), EMPTY_INDEX);
  const entry = good.entries[0];
  const bad: unknown[] = [
    null,
    [],
    { ...good, version: 2 },
    { ...good, extra: 1 },
    { ...good, head: "nothex" },
    { ...good, head: "f".repeat(40) }, // head does not start with the newest entry's sha
    { ...good, head: null }, // null head with entries
    { ...good, total: 0 },
    { ...good, total: 5 }, // fewer than MAX_ENTRIES entries must be the whole history
    { ...good, total: 1.5 },
    { ...good, entries: "x" },
    { ...good, entries: [{ ...entry, sha: "ABC" }] },
    { ...good, entries: [{ ...entry, date: "2026-10-26" }] },
    { ...good, entries: [{ ...entry, date: "2026-10-26T10:30:05.123Z" }] },
    { ...good, entries: [{ ...entry, plan: undefined }] },
    { ...good, entries: [{ ...entry, plan: "PM-1" }] },
    { ...good, entries: [{ ...entry, task: null }] }, // plan without task
    { ...good, entries: [{ ...entry, task: 7 }] },
    { ...good, entries: [{ ...entry, subject: "x".repeat(SUBJECT_MAX + 1) }] },
    { ...good, entries: [{ ...entry, subject: "two  spaces" }] },
    { ...good, entries: [{ ...entry, files: -1 }] },
    { ...good, entries: [{ ...entry, added: "1" }] },
    { ...good, entries: [{ ...entry, areas: ["a", "b"] }] }, // more areas than files
    { ...good, entries: [{ ...entry, areas: [""] }] },
    { ...good, entries: [{ ...entry, author: "someone" }] },
    { ...good, total: MAX_ENTRIES + 1, entries: Array.from({ length: MAX_ENTRIES + 1 }, () => entry) },
  ];
  bad.forEach((v, i) => assert.equal(validateIndex(v), null, `case ${i} should be rejected`));
  assert.equal(parseHistory("{not json"), null);
});

test("serialization is canonical: one entry per line, stable bytes, and it round-trips", () => {
  const index = parseHistory(serializeHistory(EMPTY_INDEX));
  assert.deepEqual(index, EMPTY_INDEX);
  const repo = fixtureRepo(SAMPLE);
  const built = indexAt(gitRunner(repo))!;
  const text = serializeHistory(built);
  assert.equal(serializeHistory(parseHistory(text)!), text);
  assert.equal(text.split("\n").filter((l) => l.startsWith("    {")).length, built.entries.length);
});

// --- against git -----------------------------------------------------------------------------------------------

test("fixture and inherited git runners suppress auto-maintenance, with a real enabled control", () => {
  const repo = fixtureRepo(SAMPLE);
  // Force the machine-independent control to launch maintenance, but prohibit repacking/pruning.
  sh(repo, "config", "maintenance.auto", "true");
  sh(repo, "config", "gc.auto", "0");
  const children = (trace: string) => readFileSync(trace, "utf8").trim().split("\n")
    .map(line => JSON.parse(line) as { event: string; argv?: string[] })
    .filter(event => event.event === "child_start" && event.argv?.includes("maintenance"));
  const args = ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "--quiet", "--allow-empty", "-m", "maintenance control"];
  const enabled = join(TMP, "maintenance-enabled.jsonl");
  execFileSync("git", args, { cwd: repo, env: { ...GIT_ENV, GIT_CONFIG_COUNT: "0", GIT_TRACE2_EVENT: enabled } });
  assert.ok(children(enabled).length > 0, "negative control really launches Git maintenance");

  const fixture = join(TMP, "maintenance-fixture.jsonl");
  execFileSync("git", args, { cwd: repo, env: { ...GIT_ENV, GIT_TRACE2_EVENT: fixture } });
  assert.deepEqual(children(fixture), [], "fixture commands override repository maintenance settings");

  const inherited = join(TMP, "maintenance-inherited.jsonl");
  const previous = process.env.GIT_TRACE2_EVENT;
  try {
    process.env.GIT_TRACE2_EVENT = inherited;
    assert.notEqual(gitRunner(repo)(args), null);
  } finally {
    if (previous === undefined) delete process.env.GIT_TRACE2_EVENT;
    else process.env.GIT_TRACE2_EVENT = previous;
  }
  assert.deepEqual(children(inherited), [], "code-under-test subprocesses inherit the same isolation");
});

test("a full clone is indexed newest first with dates, prefixes and file summaries, and the same bytes every run", () => {
  const repo = fixtureRepo(SAMPLE);
  const git = gitRunner(repo);
  assert.equal(gitState(git, repo), "full");
  const index = indexAt(git)!;
  assert.equal(index.total, 4);
  assert.equal(index.head, sh(repo, "rev-parse", "HEAD").trim());
  assert.deepEqual(
    index.entries.map((e) => [e.date, e.plan, e.task, e.subject, e.files, e.areas]),
    [
      ["2026-09-01T03:00:00Z", null, null, "feat: tidy the subject", 2, ["README.md", "public"]],
      ["2026-09-01T02:00:00Z", "pm-256", "plan", "Draft Ryugu Palace plan", 1, ["projects"]],
      ["2026-09-01T01:00:00Z", "pm-256", "t-1559", "Enter Ryugu-jo", 3, ["app/(ryugu)", "components"]],
      ["2026-09-01T00:00:00Z", null, null, "Initial commit", 2, ["README.md", "package.json"]],
    ],
  );
  assert.deepEqual([index.entries[2].added, index.entries[2].removed], [4, 0]);
  assert.equal(index.entries[0].removed, 1); // README "hi" replaced
  assert.equal(serializeHistory(indexAt(git)!), serializeHistory(index));
  // An identical history built in another directory indexes to identical bytes.
  assert.equal(serializeHistory(indexAt(gitRunner(fixtureRepo(SAMPLE)))!), serializeHistory(index));
});

test("the index is capped at MAX_ENTRIES while total counts all reachable commits (including merges); merges are left out of entries", () => {
  const repo = fixtureRepo(commitsN(MAX_ENTRIES + 5));
  sh(repo, "checkout", "--quiet", "-b", "side");
  sh(repo, "commit", "--quiet", "--allow-empty", "-m", "side work");
  sh(repo, "checkout", "--quiet", "main");
  sh(repo, "merge", "--quiet", "--no-ff", "-m", "Merge side", "side");
  const git = gitRunner(repo);
  const index = indexAt(git)!;
  const unfilteredTotal = Number(sh(repo, "rev-list", "--count", "HEAD").trim());
  assert.equal(index.entries.length, MAX_ENTRIES);
  assert.equal(index.total, MAX_ENTRIES + 7);
  assert.equal(index.total, unfilteredTotal);
  assert.ok(index.entries.every((e) => !e.subject.startsWith("Merge")));
  assert.ok(validateIndex(index));
  assert.equal(checkHistory(git, repo, serializeHistory(index), { strict: true }).ok, true);

  // Interleaved merge: add a non-merge commit after the merge and prove total still equals unfiltered rev-list.
  sh(repo, "commit", "--quiet", "--allow-empty", "-m", "post-merge leaf");
  const afterMerge = indexAt(git)!;
  assert.equal(afterMerge.total, Number(sh(repo, "rev-list", "--count", "HEAD").trim()));
  assert.equal(afterMerge.total, MAX_ENTRIES + 8);
  assert.equal(afterMerge.entries[0].subject, "post-merge leaf");
  assert.equal(checkHistory(git, repo, serializeHistory(afterMerge), { strict: true }).ok, true);
});

test("strict history accepts both sides of a divergent PR merge", () => {
  const repo = fixtureRepo(SAMPLE);
  sh(repo, "checkout", "--quiet", "-b", "side");
  sh(repo, "commit", "--quiet", "--allow-empty", "-m", "side leaf");
  sh(repo, "checkout", "--quiet", "main");
  sh(repo, "commit", "--quiet", "--allow-empty", "-m", "main leaf");
  sh(repo, "merge", "--quiet", "--no-ff", "-m", "Merge side", "side");

  const git = gitRunner(repo);
  const index = indexAt(git)!;
  assert.equal(index.total, 7);
  assert.equal(index.entries.length, 6);
  assert.equal(indexAt(git, index.head!)!.entries.length, 5);
  assert.equal(checkHistory(git, repo, serializeHistory(index), { strict: true }).ok, true);
  const otherLeaf = index.entries[0].subject === "side leaf" ? "main leaf" : "side leaf";
  const incomplete = { ...index, entries: index.entries.filter((entry) => entry.subject !== otherLeaf) };
  assert.equal(checkHistory(git, repo, serializeHistory(incomplete), { strict: true }).ok, false);

  const file = join(TMP, `merged-${repos++}.json`);
  const head = sh(repo, "rev-parse", "HEAD").trim();
  const result = runScript(`--repo=${repo}`, `--file=${file}`, "--strict", `--rev=${head}`);
  assert.equal(result.status, 0, result.stderr);
});

test("without git, outside a repository, or in an empty one, the committed fallback is used as it is", () => {
  const repo = fixtureRepo(SAMPLE);
  const fallback = indexAt(gitRunner(repo))!;
  const plain = join(TMP, "plain");
  mkdirSync(plain, { recursive: true });
  const empty = join(TMP, `empty-${repos++}`);
  mkdirSync(empty);
  sh(empty, "init", "--quiet");
  const nested = join(repo, "unpacked");
  mkdirSync(nested);
  for (const [git, dir] of [
    [gitRunner(repo, join(TMP, "no-such-git")), repo],
    [gitRunner(plain), plain],
    [gitRunner(empty), empty],
    [gitRunner(nested), nested], // a source archive unpacked inside another checkout
  ] as const) {
    assert.equal(gitState(git, dir), "none", dir);
    assert.deepEqual(resolveHistory(git, dir, fallback), { index: fallback, source: "fallback", reason: "git history unavailable" });
    assert.equal(resolveHistory(git, dir, null).source, "empty");
  }
});

test("a shallow clone splices the commits since the fallback's head, matching a full clone byte for byte", () => {
  const repo = fixtureRepo(commitsN(12));
  const olderFallback = indexAt(gitRunner(repo), "HEAD~3")!;
  const clone = shallowClone(repo, 5);
  const git = gitRunner(clone);
  assert.equal(gitState(git, clone), "shallow");
  const spliced = resolveHistory(git, clone, olderFallback);
  assert.equal(spliced.source, "spliced");
  assert.equal(serializeHistory(spliced.index), serializeHistory(indexAt(gitRunner(repo))!));
});

test("a shallow clone that no longer holds the fallback's head ships the fallback unchanged, never a cut-off history", () => {
  const repo = fixtureRepo(commitsN(12));
  const fallback = indexAt(gitRunner(repo), "HEAD~6")!;
  const clone = shallowClone(repo, 3);
  const res = resolveHistory(gitRunner(clone), clone, fallback);
  assert.deepEqual(res, { index: fallback, source: "fallback", reason: "shallow clone" });
  // The shallow boundary itself may be the fallback's head (only the commits after it are read); one further back is gone.
  const boundary = indexAt(gitRunner(repo), "HEAD~2")!;
  assert.equal(resolveHistory(gitRunner(clone), clone, boundary).source, "spliced");
  const deeper = indexAt(gitRunner(repo), "HEAD~3")!;
  assert.equal(resolveHistory(gitRunner(clone), clone, deeper).source, "fallback");
  assert.equal(resolveHistory(gitRunner(clone), clone, null).source, "empty");
});

test("a git log that cannot be parsed falls back instead of failing the build", () => {
  const repo = fixtureRepo(SAMPLE);
  const fallback = indexAt(gitRunner(repo))!;
  const real = gitRunner(repo);
  const garbled = (args: string[]) => (args[0] === "log" ? "\x1egarbage\n" : real(args));
  const res = resolveHistory(garbled, repo, fallback);
  assert.equal(res.source, "fallback");
  assert.match(res.reason, /git log failed: history: unexpected git log record/);
});

test("--check passes a fresh index and catches tampering, non-canonical text, rewritten history and staleness", () => {
  const repo = fixtureRepo(commitsN(8));
  const git = gitRunner(repo);
  const fresh = serializeHistory(indexAt(git)!);
  assert.equal(checkHistory(git, repo, fresh).ok, true);
  assert.equal(checkHistory(git, repo, null).ok, false);

  const tampered = fresh.replace("Step 7", "Step 8");
  assert.match(checkHistory(git, repo, tampered).message, /does not match git/);
  assert.match(checkHistory(git, repo, fresh.replace(/\n {4}/g, "\n  ")).message, /canonical/);
  assert.match(checkHistory(git, repo, fresh.replace('"version": 1', '"version": 2')).message, /malformed/);
  const foreign = fresh.replace(/"head": "[0-9a-f]{40}"/, `"head": "${indexAt(git)!.entries[0].sha}${"0".repeat(30)}"`);
  assert.match(checkHistory(git, repo, foreign).message, /not in HEAD's history/);

  const behind = serializeHistory(indexAt(git, "HEAD~3")!);
  assert.match(checkHistory(git, repo, behind).message, /trails HEAD by 3 commits/);
  assert.equal(checkHistory(git, repo, behind, 2).ok, false);
  assert.match(checkHistory(git, repo, behind, 2).message, /stale: 3 commits behind/);
  assert.match(checkHistory(git, repo, serializeHistory(EMPTY_INDEX)).message, /empty but HEAD has 8 commits/);

  // Without full history the shape is all that can be checked; a malformed file still fails.
  const clone = shallowClone(repo, 2);
  assert.match(checkHistory(gitRunner(clone), clone, behind).message, /well-formed \(shallow clone/);
  assert.equal(checkHistory(gitRunner(clone), clone, tampered.replace('"total": 8', '"total": -1')).ok, false);
});

test("the command line writes the index, leaves a fallback alone, and --check exits 1 on a stale file", () => {
  const repo = fixtureRepo(commitsN(6));
  const file = join(TMP, `history-${repos++}.json`);
  let r = runScript(`--repo=${repo}`, `--file=${file}`);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /history:index: git \(full history\): 6 of 6 commits/);
  const written = readFileSync(file, "utf8");
  assert.equal(written, serializeHistory(indexAt(gitRunner(repo))!));
  assert.equal(runScript(`--repo=${repo}`, `--file=${file}`, "--check").status, 0);

  // A git-less checkout: the committed file is the fallback and is not touched.
  const plain = join(TMP, `plain-${repos++}`);
  mkdirSync(plain);
  r = runScript(`--repo=${plain}`, `--file=${file}`);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /fallback \(git history unavailable\).*unchanged/);
  assert.equal(readFileSync(file, "utf8"), written);

  // No fallback at all still builds: an empty index is written for the palace to render as empty.
  const missing = join(TMP, `missing-${repos++}.json`);
  assert.equal(runScript(`--repo=${plain}`, `--file=${missing}`).status, 0);
  assert.equal(readFileSync(missing, "utf8"), serializeHistory(EMPTY_INDEX));

  writeFileSync(file, written.replace("Step 5", "Step five"));
  r = runScript(`--repo=${repo}`, `--file=${file}`, "--check");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /history:check: .* does not match git/);
});

test("strict mode rejects shallow clones, missing git, build SHA mismatch, wrong-total-only, and >MAX_LAG stale fallbacks before refreshing", () => {
  const repo = fixtureRepo(commitsN(6));
  const git = gitRunner(repo);
  const file = join(TMP, `strict-${repos++}.json`);
  const initialIndex = indexAt(git)!;
  const initialText = serializeHistory(initialIndex);
  writeFileSync(file, initialText);

  // 1. Add >20 commits without modifying the fallback file: observe negative controls BEFORE refreshing.
  for (let i = 6; i < 30; i++) {
    writeFileSync(join(repo, `lib/step-${i}.ts`), `export const n = ${i};\n`);
    sh(repo, "add", `lib/step-${i}.ts`);
    sh(repo, "commit", "--quiet", "-m", `pm-9/t-${i}: Step ${i}`);
  }
  const staleCheck = runScript(`--repo=${repo}`, `--file=${file}`, "--check");
  assert.equal(staleCheck.status, 1);
  assert.match(staleCheck.stderr, /stale: 24 commits behind HEAD/);
  const strictStaleCheck = runScript(`--repo=${repo}`, `--file=${file}`, "--check", "--strict");
  assert.equal(strictStaleCheck.status, 1);
  assert.match(strictStaleCheck.stderr, /stale: 24 commits behind HEAD/);

  // 2. Depth-1 shallow clone holding the historical fallback cannot pass strict check or strict generation.
  const depth1 = shallowClone(repo, 1);
  const depth1File = join(TMP, `depth1-${repos++}.json`);
  writeFileSync(depth1File, initialText);
  // Permissive check still accepts a well-formed fallback in a shallow clone.
  assert.equal(runScript(`--repo=${depth1}`, `--file=${depth1File}`, "--check").status, 0);
  // Strict check and strict generation must fail nonzero in a depth-1 clone.
  const strictShallowCheck = runScript(`--repo=${depth1}`, `--file=${depth1File}`, "--check", "--strict");
  assert.equal(strictShallowCheck.status, 1);
  assert.match(strictShallowCheck.stderr, /strict check requires full git history \(shallow clone/);
  const strictShallowGen = runScript(`--repo=${depth1}`, `--file=${depth1File}`, "--strict");
  assert.equal(strictShallowGen.status, 1);
  assert.match(strictShallowGen.stderr, /strict generation requires full git history \(shallow clone/);
  assert.equal(readFileSync(depth1File, "utf8"), initialText, "failed strict generation leaves fallback untouched");

  // 3. Git-unavailable directory fails strict generation and strict check, while permissive fallback still works.
  const plain = join(TMP, `strict-plain-${repos++}`);
  mkdirSync(plain);
  assert.equal(runScript(`--repo=${plain}`, `--file=${depth1File}`, "--check", "--strict").status, 1);
  assert.equal(runScript(`--repo=${plain}`, `--file=${depth1File}`, "--strict").status, 1);
  assert.equal(runScript(`--repo=${plain}`, `--file=${depth1File}`, "--check").status, 0);

  // 4. Complete clone automatically refreshes >20-commit stale fallback and passes strict check, deterministically on rerun.
  const headSha = sh(repo, "rev-parse", "HEAD").trim();
  const gen1 = runScript(`--repo=${repo}`, `--file=${file}`, "--strict", `--rev=${headSha}`);
  assert.equal(gen1.status, 0, gen1.stderr);
  assert.match(gen1.stdout, /strict full history.*30 of 30 commits/);
  const refreshed = readFileSync(file, "utf8");
  const gen2 = runScript(`--repo=${repo}`, `--file=${file}`, "--strict", `--rev=${headSha}`);
  assert.equal(gen2.status, 0, gen2.stderr);
  assert.match(gen2.stdout, /unchanged/);
  assert.equal(readFileSync(file, "utf8"), refreshed);
  assert.equal(runScript(`--repo=${repo}`, `--file=${file}`, "--check", "--strict", `--rev=${headSha}`).status, 0);

  // 5. Build identity mismatch (--rev != HEAD) fails both strict generation and strict check.
  const olderSha = sh(repo, "rev-parse", "HEAD~1").trim();
  const wrongRevCheck = runScript(`--repo=${repo}`, `--file=${file}`, "--check", "--strict", `--rev=${olderSha}`);
  assert.equal(wrongRevCheck.status, 1);
  assert.match(wrongRevCheck.stderr, /build revision .* does not match checked-out HEAD/);
  const wrongRevGen = runScript(`--repo=${repo}`, `--file=${file}`, "--strict", `--rev=${olderSha}`);
  assert.equal(wrongRevGen.status, 1);
  assert.match(wrongRevGen.stderr, /build revision .* does not match checked-out HEAD/);

  // 6. Mutating ONLY total while keeping a current head fails both permissive and strict checks.
  const wrongTotalFile = join(TMP, `wrong-total-${repos++}.json`);
  writeFileSync(wrongTotalFile, refreshed.replace('"total": 30,', '"total": 31,'));
  const permissiveWrongTotal = runScript(`--repo=${repo}`, `--file=${wrongTotalFile}`, "--check");
  assert.equal(permissiveWrongTotal.status, 1);
  assert.match(permissiveWrongTotal.stderr, /total 31 != 30/);
  const strictWrongTotal = runScript(`--repo=${repo}`, `--file=${wrongTotalFile}`, "--check", "--strict");
  assert.equal(strictWrongTotal.status, 1);
  assert.match(strictWrongTotal.stderr, /total 31 != 30/);
});

test("the committed content/history.json is a well-formed, bounded, canonical index", () => {
  const text = readFileSync(join(ROOT, "content/history.json"), "utf8");
  const index = parseHistory(text);
  assert.ok(index, "content/history.json does not validate");
  assert.equal(serializeHistory(index), text);
  assert.ok(index.entries.length > 0 && index.entries.length <= MAX_ENTRIES);
});

test("package.json builds the index before next build and exposes history:index and history:check", () => {
  const { scripts } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
  assert.match(scripts.prebuild, /scripts\/history-index\.ts/);
  assert.match(scripts["history:index"], /scripts\/history-index\.ts$/);
  assert.match(scripts["history:check"], /scripts\/history-index\.ts --check$/);
  assert.match(scripts.test, /'scripts\/history-index\.test\.ts'/);
});
