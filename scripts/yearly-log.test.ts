import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import {
  checkYearlyLog,
  EMPTY_YEARLY_LOG,
  gitRunner,
  gitState,
  indexAt,
  MAX_HIGHLIGHTS_PER_MONTH,
  MAX_LAG,
  MONTH_KEYS,
  MONTHLY_FLOWERS,
  parseLog,
  parseSiteSource,
  parseYearlyLog,
  readRepoContent,
  resolveYearlyLog,
  serializeYearlyLog,
  validateYearlyLog,
} from "./yearly-log.ts";

const ROOT = join(import.meta.dirname, "..");
const SCRIPT = join(import.meta.dirname, "yearly-log.ts");
const TMP = mkdtempSync(join(tmpdir(), "yearly-log-"));
after(() => rmSync(TMP, { recursive: true, force: true }));

Object.assign(process.env, {
  GIT_CONFIG_COUNT: "2",
  GIT_CONFIG_KEY_0: "gc.auto",
  GIT_CONFIG_VALUE_0: "0",
  GIT_CONFIG_KEY_1: "maintenance.auto",
  GIT_CONFIG_VALUE_1: "false",
});
delete process.env.GITHUB_SHA;

const GIT_ENV = {
  ...process.env,
  GITHUB_SHA: "",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.test",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.test",
};

const sh = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

let repos = 0;
type Commit = {
  subject: string;
  whenUtc?: number; // epoch seconds
  files: Record<string, string>;
};

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
    const sec = c.whenUtc ?? Date.UTC(2026, 9, 1) / 1000 + i * 3600;
    const when = `${sec} +0000`;
    parts.push(
      Buffer.from(
        `commit refs/heads/main\nauthor Fixture <fixture@example.test> ${when}\ncommitter Fixture <fixture@example.test> ${when}\n`,
      ),
    );
    data(`${c.subject}\n`);
    for (const [path, body] of Object.entries(c.files)) {
      parts.push(Buffer.from(`M 100644 inline ${path}\n`));
      data(body);
    }
  });
  if (commits.length > 0) {
    execFileSync("git", ["fast-import", "--quiet", "--done"], {
      cwd: dir,
      env: GIT_ENV,
      input: Buffer.concat([...parts, Buffer.from("done\n")]),
      stdio: ["pipe", "pipe", "pipe"],
    });
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
  Array.from({ length: n }, (_, i) => ({
    subject: `pm-293/t-${i}: Step ${i}`,
    whenUtc: Date.UTC(2026, 9, 1) / 1000 + i * 3600,
    files: { [`lib/step-${i}.ts`]: `export const n = ${i};\n` },
  }));

function runScript(...args: string[]) {
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      SCRIPT,
      ...args,
    ],
    {
      encoding: "utf8",
      env: GIT_ENV,
    },
  );
}

const SAMPLE_SITE = `export const site = {
  notes: [
    { date: "2026-10-12", title: "Backfills are a feature", body: "..." },
    { date: "2026-09-28", title: "On twos", body: "..." },
  ],
  projectList: [
    { title: "Shore", note: "Timer", href: "/shore", status: "live", shipped: "2026-10-19", colour: "mint" },
    { title: "Draft Doll", note: "Unfinished", status: "building", started: "2026-10-01", colour: "coral" },
  ],
};
`;

const SAMPLE_LEDGER = JSON.stringify(
  {
    generated: "2026-10-26T00:00:00.000Z",
    days: {
      "2026-03-14": { commits: 3, notes: 0, sketches: 0, releases: [] },
      "2026-09-28": { commits: 0, notes: 1, sketches: 0, releases: [] },
    },
  },
  null,
  2,
);

const SAMPLE_COMMITS: Commit[] = [
  {
    subject: "Initial commit",
    whenUtc: Date.UTC(2026, 0, 15, 8, 0, 0) / 1000, // Jan
    files: { "README.md": "hi\n", "content/site.ts": SAMPLE_SITE, "content/ledger.json": SAMPLE_LEDGER },
  },
  {
    subject: "pm-181/t-1052: add Shore focus timer",
    whenUtc: Date.UTC(2026, 9, 19, 10, 0, 0) / 1000, // Oct
    files: { "app/(shore)/page.tsx": "export default function Page() { return null; }\n" },
  },
  {
    subject: "pm-293/t-1673: Build yearly shipped digest",
    whenUtc: Date.UTC(2026, 9, 27, 14, 0, 0) / 1000, // Oct
    files: { "lib/yearly-log.ts": "export const ok = true;\n" },
  },
];

test("parseLog and parseSiteSource extract commits, notes, and project fields and reject garbled git records", () => {
  const sha = "0123456789abcdef0123456789abcdef01234567";
  const text = `\x1e${sha}\x1fp1 p2\x1f2026-10-26T12:30:05+02:00\x1fpm-293/t-1673: Build digest\n\x1e${"f".repeat(40)}\x1f\x1f2026-01-01T00:00:00Z\x1fRoot\n`;
  const [first, root] = parseLog(text);
  assert.equal(first.parents, 2);
  assert.deepEqual(first.entry, {
    sha,
    date: "2026-10-26T10:30:05Z",
    plan: "pm-293",
    task: "t-1673",
    subject: "Build digest",
  });
  assert.equal(root.parents, 0);
  assert.throws(() => parseLog("\x1enot a record\n"), /unexpected git log record/);
  assert.throws(() => parseLog(`\x1e${sha}\x1f\x1fbad-date\x1fx\n`), /unexpected commit date/);

  const parsedSite = parseSiteSource(SAMPLE_SITE);
  assert.equal(parsedSite.notes.length, 2);
  assert.equal(parsedSite.projects.length, 2);
  assert.equal(parsedSite.projects[0].shipped, "2026-10-19");
  assert.equal(parsedSite.projects[1].status, "building");
});

test("a full clone aggregates git commits, site.ts projects/notes, and ledger.json across all 12 months", () => {
  const repo = fixtureRepo(SAMPLE_COMMITS);
  const git = gitRunner(repo);
  assert.equal(gitState(git, repo), "full");
  const content = readRepoContent(repo);
  const built = indexAt(git, "HEAD", content)!;
  assert.ok(validateYearlyLog(built));
  assert.equal(built.head, sh(repo, "rev-parse", "HEAD").trim());
  assert.equal(built.generatedYear, 2026);

  // Month 01: 1 commit from git
  assert.equal(built.months["01"].commits, 1);
  assert.equal(built.months["01"].highlights[0].subject, "Initial commit");

  // Month 03: 3 commits from ledger.json
  assert.equal(built.months["03"].commits, 3);
  assert.equal(built.months["03"].flower, "Cherry");

  // Month 09: 1 note from site.ts
  assert.deepEqual(built.months["09"].notes, [{ title: "On twos", date: "2026-09-28" }]);

  // Month 10: 2 git commits, 1 shipped project ("Shore"), 1 note
  assert.equal(built.months["10"].commits, 2);
  assert.equal(built.months["10"].highlights.length, 2);
  assert.deepEqual(built.months["10"].shippedProjects, [
    { title: "Shore", href: "/shore", shipped: "2026-10-19" },
  ]);
  assert.deepEqual(built.months["10"].notes, [{ title: "Backfills are a feature", date: "2026-10-12" }]);
});

test("highlights are capped at MAX_HIGHLIGHTS_PER_MONTH while commits counts all non-merge commits in the month", () => {
  const repo = fixtureRepo(commitsN(MAX_HIGHLIGHTS_PER_MONTH + 4));
  sh(repo, "checkout", "--quiet", "-b", "side");
  sh(repo, "commit", "--quiet", "--allow-empty", "-m", "side work");
  sh(repo, "checkout", "--quiet", "main");
  sh(repo, "merge", "--quiet", "--no-ff", "-m", "Merge side", "side");

  const git = gitRunner(repo);
  const built = indexAt(git, "HEAD", readRepoContent(repo))!;
  assert.equal(built.months["10"].commits, MAX_HIGHLIGHTS_PER_MONTH + 5);
  assert.equal(built.months["10"].highlights.length, MAX_HIGHLIGHTS_PER_MONTH);
  assert.ok(built.months["10"].highlights.every((h) => !h.subject.startsWith("Merge")));
  assert.equal(checkYearlyLog(git, repo, serializeYearlyLog(built), { strict: true }).ok, true);
});

test("without git, outside a repository, or in an empty one, the committed fallback is preserved untouched", () => {
  const repo = fixtureRepo(SAMPLE_COMMITS);
  const fallback = indexAt(gitRunner(repo), "HEAD", readRepoContent(repo))!;
  const plain = join(TMP, `plain-${repos++}`);
  mkdirSync(plain, { recursive: true });
  const empty = join(TMP, `empty-${repos++}`);
  mkdirSync(empty, { recursive: true });
  sh(empty, "init", "--quiet");
  const nested = join(repo, "unpacked");
  mkdirSync(nested, { recursive: true });

  for (const [git, dir] of [
    [gitRunner(repo, join(TMP, "no-such-git")), repo],
    [gitRunner(plain), plain],
    [gitRunner(empty), empty],
    [gitRunner(nested), nested],
  ] as const) {
    assert.equal(gitState(git, dir), "none", dir);
    assert.deepEqual(resolveYearlyLog(git, dir, fallback), {
      log: fallback,
      source: "fallback",
      reason: "git history unavailable",
    });
    assert.equal(resolveYearlyLog(git, dir, null).source, "empty");
  }
});

test("a shallow clone splices commits since fallback.head, matching a full clone byte for byte", () => {
  const repo = fixtureRepo(commitsN(10));
  const content = readRepoContent(repo);
  const olderFallback = indexAt(gitRunner(repo), "HEAD~3", content)!;
  const clone = shallowClone(repo, 5);
  const git = gitRunner(clone);
  assert.equal(gitState(git, clone), "shallow");

  const spliced = resolveYearlyLog(git, clone, olderFallback, content);
  assert.equal(spliced.source, "spliced");
  assert.equal(
    serializeYearlyLog(spliced.log),
    serializeYearlyLog(indexAt(gitRunner(repo), "HEAD", content)!),
  );
});

test("a shallow clone that no longer holds fallback.head preserves the fallback unchanged", () => {
  const repo = fixtureRepo(commitsN(10));
  const content = readRepoContent(repo);
  const fallback = indexAt(gitRunner(repo), "HEAD~6", content)!;
  const clone = shallowClone(repo, 2);
  const res = resolveYearlyLog(gitRunner(clone), clone, fallback, content);
  assert.deepEqual(res, { log: fallback, source: "fallback", reason: "shallow clone" });
  assert.equal(resolveYearlyLog(gitRunner(clone), clone, null, content).source, "empty");
});

test("a garbled git log falls back cleanly instead of failing the build", () => {
  const repo = fixtureRepo(SAMPLE_COMMITS);
  const fallback = indexAt(gitRunner(repo), "HEAD", readRepoContent(repo))!;
  const real = gitRunner(repo);
  const garbled = (args: string[]) => (args[0] === "log" ? "\x1egarbage\n" : real(args));
  const res = resolveYearlyLog(garbled, repo, fallback);
  assert.equal(res.source, "fallback");
  assert.match(res.reason, /git log failed: yearly-log: unexpected git log record/);
});

test("--check passes fresh and shallow fallbacks, tolerates later site.ts edits within MAX_LAG, and catches tampering or staleness", () => {
  const repo = fixtureRepo(SAMPLE_COMMITS);
  const git = gitRunner(repo);
  const fresh = serializeYearlyLog(indexAt(git, "HEAD", readRepoContent(repo))!);
  assert.equal(checkYearlyLog(git, repo, fresh).ok, true);
  assert.equal(checkYearlyLog(git, repo, null).ok, false);

  // Tampering negative controls
  const tamperedSubject = fresh.replace("Build yearly shipped digest", "Tampered digest");
  assert.match(checkYearlyLog(git, repo, tamperedSubject).message, /does not match git/);
  assert.match(checkYearlyLog(git, repo, fresh.replace(/\n {4}/g, "\n  ")).message, /canonical/);
  assert.match(checkYearlyLog(git, repo, fresh.replace('"version": 1', '"version": 2')).message, /malformed/);
  const foreignHead = fresh.replace(
    /"head": "[0-9a-f]{40}"/,
    `"head": "${indexAt(git)!.months["10"].highlights[0].sha}${"0".repeat(30)}"`,
  );
  assert.match(checkYearlyLog(git, repo, foreignHead).message, /not in HEAD's history/);

  // Shallow clone accepts well-formed fallback and rejects malformed JSON
  const clone = shallowClone(repo, 1);
  assert.match(checkYearlyLog(gitRunner(clone), clone, fresh).message, /well-formed \(shallow clone/);
  assert.equal(checkYearlyLog(gitRunner(clone), clone, fresh.replace('"commits": 2', '"commits": -1')).ok, false);

  // Later commit editing content/site.ts within MAX_LAG still validates git history at committed.head
  writeFileSync(
    join(repo, "content/site.ts"),
    SAMPLE_SITE.replace('shipped: "2026-10-19"', 'shipped: "2026-08-19"'),
  );
  sh(repo, "add", "content/site.ts");
  sh(repo, "commit", "--quiet", "-m", "pm-293/t-1674: Update project lifecycle dates");
  assert.equal(checkYearlyLog(git, repo, fresh).ok, true);
  assert.equal(checkYearlyLog(git, repo, fresh, 0).ok, false);
  assert.match(checkYearlyLog(git, repo, fresh, 0).message, /stale: 1 commits behind HEAD/);
});

test("CLI writes the yearly log, preserves gitless fallback, and enforces --strict checks", () => {
  const repo = fixtureRepo(commitsN(6));
  const file = join(TMP, `yearly-${repos++}.json`);

  let r = runScript(`--repo=${repo}`, `--file=${file}`);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /yearly-log:index: git \(full history\): 12 months, 6 commits/);
  const written = readFileSync(file, "utf8");
  assert.equal(runScript(`--repo=${repo}`, `--file=${file}`, "--check").status, 0);

  // Gitless directory leaves fallback unchanged
  const plain = join(TMP, `cli-plain-${repos++}`);
  mkdirSync(plain, { recursive: true });
  r = runScript(`--repo=${plain}`, `--file=${file}`);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /fallback \(git history unavailable\).*unchanged/);
  assert.equal(readFileSync(file, "utf8"), written);

  // Missing fallback in gitless directory writes canonical empty log
  const missing = join(TMP, `cli-missing-${repos++}.json`);
  assert.equal(runScript(`--repo=${plain}`, `--file=${missing}`).status, 0);
  assert.equal(readFileSync(missing, "utf8"), serializeYearlyLog(EMPTY_YEARLY_LOG));

  // Strict mode rejects shallow clone and wrong --rev, and passes on full clone at HEAD
  const depth1 = shallowClone(repo, 1);
  assert.equal(runScript(`--repo=${depth1}`, `--file=${file}`, "--check", "--strict").status, 1);
  assert.equal(runScript(`--repo=${depth1}`, `--file=${file}`, "--strict").status, 1);

  const headSha = sh(repo, "rev-parse", "HEAD").trim();
  const olderSha = sh(repo, "rev-parse", "HEAD~1").trim();
  assert.equal(runScript(`--repo=${repo}`, `--file=${file}`, "--check", "--strict", `--rev=${olderSha}`).status, 1);
  assert.equal(runScript(`--repo=${repo}`, `--file=${file}`, "--strict", `--rev=${headSha}`).status, 0);
  assert.equal(runScript(`--repo=${repo}`, `--file=${file}`, "--check", "--strict", `--rev=${headSha}`).status, 0);
  assert.ok(MAX_LAG >= 20);
});

test("committed content/yearly-log.json is valid, canonical, and package.json wires yearly-log scripts", () => {
  const text = readFileSync(join(ROOT, "content/yearly-log.json"), "utf8");
  const parsed = parseYearlyLog(text);
  assert.ok(parsed, "content/yearly-log.json failed validation");
  assert.equal(serializeYearlyLog(parsed), text);
  for (const key of MONTH_KEYS) {
    assert.equal(parsed.months[key].flower, MONTHLY_FLOWERS[key]);
  }
  assert.ok(parsed.months["10"].commits > 0);
  assert.ok(parsed.months["10"].shippedProjects.length > 0);
  assert.ok(parsed.months["10"].notes.length > 0);
  assert.ok(parsed.months["10"].highlights.length > 0);

  const { scripts } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  assert.match(scripts["yearly-log:index"], /scripts\/yearly-log\.ts$/);
  assert.match(scripts["yearly-log:check"], /scripts\/yearly-log\.ts --check$/);
  assert.match(scripts.test, /'scripts\/yearly-log\.test\.ts'/);
});
