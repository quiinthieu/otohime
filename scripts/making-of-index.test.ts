import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import {
  checkMakingOf,
  containsPrivateData,
  EMPTY_MAKING_OF,
  gitRunner,
  gitState,
  indexAt,
  MAX_LAG,
  normalizeRoles,
  parseLog,
  parseMakingOf,
  readRepoPlans,
  resolveMakingOf,
  SHIPPED_PLAN_IDS,
  SHIPPED_PLAN_REGISTRY,
  serializeMakingOf,
  UNSHIPPED_PLAN_IDS,
  validateMakingOf,
} from "./making-of-index.ts";

const ROOT = join(import.meta.dirname, "..");
const SCRIPT = join(import.meta.dirname, "making-of-index.ts");
const TMP = mkdtempSync(join(tmpdir(), "making-of-"));
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

const SAMPLE_SHIPPED_IDS = ["pm-180", "pm-181", "pm-184", "pm-186", "pm-188", "pm-189", "pm-190", "pm-191"] as const;

const commitsN = (n: number): Commit[] =>
  Array.from({ length: n }, (_, i) => ({
    subject: `${SAMPLE_SHIPPED_IDS[Math.floor(i / 2)]}/t-${i}: Step ${i}`,
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

const SAMPLE_SHORE_PLAN = `# Shore: a sea-glass focus timer (pm-181)

**Product.** Shore is a tactile Pomodoro timer at \`otohime.dev/shore\`.
`;

const SAMPLE_EMAKI_PLAN = `# Washi Daruma, Emaki, and Hanafuda

Plan \`pm-293\`, revision 1. Product-owner run \`run-9229\`, model \`claude-opus-5-5\`.

## Outcome

Visitors to otohime.dev gain three new tactile paper-and-ink experiments backed by a shared yearly digest.
`;

const SAMPLE_COMMITS: Commit[] = [
  {
    subject: "Initial commit",
    whenUtc: Date.UTC(2026, 0, 15, 8, 0, 0) / 1000,
    files: { "README.md": "hi\n" },
  },
  {
    subject: "pm-181/t-1052: add Shore focus timer",
    whenUtc: Date.UTC(2026, 9, 19, 10, 0, 0) / 1000,
    files: {
      "projects/shore/plan.md": SAMPLE_SHORE_PLAN,
      "app/(shore)/page.tsx": "export default function Page() { return null; }\n",
    },
  },
  {
    subject: "pm-293/t-1673: Build shared yearly shipped digest",
    whenUtc: Date.UTC(2026, 9, 27, 12, 0, 0) / 1000,
    files: {
      "projects/emaki/plan.md": SAMPLE_EMAKI_PLAN,
      "lib/yearly-log.ts": "export const ok = true;\n",
    },
  },
  {
    subject: "pm-293/t-1675: Build Making-of Emaki handscroll <secret@example.com>",
    whenUtc: Date.UTC(2026, 9, 27, 15, 0, 0) / 1000,
    files: {
      "app/(site)/(app)/making-of/page.tsx": "export default function MakingOf() { return null; }\n",
      "lib/making-of.ts": "export const emaki = true;\n",
      ".agent-artifacts/run-9243/commits.txt": "abc\n",
    },
  },
];

test("parseLog and readRepoPlans extract sanitized commits, numstat areas, and projects/*/plan.md metadata", () => {
  const sha = "0123456789abcdef0123456789abcdef01234567";
  const text = `\x1e${sha}\x1fp1 p2\x1f2026-10-27T12:30:05+02:00\x1fpm-293/t-1675: Build Emaki <user@example.com>\n\n4\t1\tlib/making-of.ts\n-\t-\tpublic/scroll.png\n\x1e${"f".repeat(40)}\x1f\x1f2026-01-01T00:00:00Z\x1fRoot\n`;
  const [first, root] = parseLog(text);
  assert.equal(first.parents, 2);
  assert.deepEqual(first.entry, {
    sha,
    date: "2026-10-27T10:30:05Z",
    plan: "pm-293",
    task: "t-1675",
    subject: "Build Emaki",
    areas: ["lib", "public"],
  });
  assert.equal(root.parents, 0);
  assert.throws(() => parseLog("\x1enot a record\n"), /unexpected git log record/);
  assert.throws(() => parseLog(`\x1e${sha}\x1f\x1fbad-date\x1fx\n`), /unexpected commit date/);
  assert.throws(() => parseLog(`\x1e${sha}\x1f\x1f2026-01-01T00:00:00Z\x1fx\n\ngarbage\n`), /unexpected numstat/);

  const repo = fixtureRepo(SAMPLE_COMMITS);
  const plans = readRepoPlans(repo);
  assert.equal(plans["pm-181"]?.title, "Shore: a sea-glass focus timer");
  assert.equal(plans["pm-293"]?.title, "Washi Daruma, Emaki, and Hanafuda");
  assert.equal(plans["pm-293"]?.roles && "product_owner" in plans["pm-293"].roles, true);
});

test("full clone groups commits by pm-NNN prefix, merges plan.md metadata, and strips private data", () => {
  const repo = fixtureRepo(SAMPLE_COMMITS);
  const git = gitRunner(repo);
  assert.equal(gitState(git, repo), "full");
  const plans = readRepoPlans(repo);
  const built = indexAt(git, "HEAD", plans)!;
  assert.ok(validateMakingOf(built));
  assert.equal(built.head, sh(repo, "rev-parse", "HEAD").trim());
  assert.equal(built.scenes.length, 2);

  const [s0, s1] = built.scenes;
  assert.equal(s0.planId, "pm-293");
  assert.equal(s0.title, "Washi Daruma, Emaki, and Hanafuda");
  assert.equal(s0.commitCount, 2);
  assert.equal(s0.date, "2026-10-27");
  assert.deepEqual(s0.areas, ["app/(site)", "lib", "projects"]);
  assert.equal(s0.roles.length, 4);

  assert.equal(s1.planId, "pm-181");
  assert.equal(s1.title, "Shore: a sea-glass focus timer");
  assert.equal(s1.commitCount, 1);
  assert.equal(s1.date, "2026-10-19");
  assert.deepEqual(s1.areas, ["app/(shore)", "projects"]);
  assert.equal(containsPrivateData(serializeMakingOf(built)), false);
});

test("without git, outside a repository, or in an empty one, the committed fallback is preserved untouched", () => {
  const repo = fixtureRepo(SAMPLE_COMMITS);
  const fallback = indexAt(gitRunner(repo), "HEAD", readRepoPlans(repo))!;
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
    assert.deepEqual(resolveMakingOf(git, dir, fallback), {
      snapshot: fallback,
      source: "fallback",
      reason: "git history unavailable",
    });
    assert.equal(resolveMakingOf(git, dir, null).source, "empty");
  }
});

test("a shallow clone splices commits since fallback.head, matching a full clone byte for byte", () => {
  const repo = fixtureRepo(commitsN(10));
  const plans = readRepoPlans(repo);
  const olderFallback = indexAt(gitRunner(repo), "HEAD~3", plans)!;
  const clone = shallowClone(repo, 5);
  const git = gitRunner(clone);
  assert.equal(gitState(git, clone), "shallow");

  const spliced = resolveMakingOf(git, clone, olderFallback, plans);
  assert.equal(spliced.source, "spliced");
  assert.equal(
    serializeMakingOf(spliced.snapshot),
    serializeMakingOf(indexAt(gitRunner(repo), "HEAD", plans)!),
  );
});

test("a shallow clone that no longer holds fallback.head preserves the fallback unchanged", () => {
  const repo = fixtureRepo(commitsN(10));
  const plans = readRepoPlans(repo);
  const fallback = indexAt(gitRunner(repo), "HEAD~6", plans)!;
  const clone = shallowClone(repo, 2);
  const res = resolveMakingOf(gitRunner(clone), clone, fallback, plans);
  assert.deepEqual(res, { snapshot: fallback, source: "fallback", reason: "shallow clone" });
  assert.equal(resolveMakingOf(gitRunner(clone), clone, null, plans).source, "empty");
});

test("a garbled git log falls back cleanly instead of failing the build", () => {
  const repo = fixtureRepo(SAMPLE_COMMITS);
  const fallback = indexAt(gitRunner(repo), "HEAD", readRepoPlans(repo))!;
  const real = gitRunner(repo);
  const garbled = (args: string[]) => (args[0] === "log" ? "\x1egarbage\n" : real(args));
  const res = resolveMakingOf(garbled, repo, fallback);
  assert.equal(res.source, "fallback");
  assert.match(res.reason, /git log failed: making-of: unexpected git log record/);
});

test("--check passes fresh and shallow fallbacks, tolerates later projects/ edits within MAX_LAG, and catches tampering or staleness", () => {
  const repo = fixtureRepo(SAMPLE_COMMITS);
  const git = gitRunner(repo);
  const fresh = serializeMakingOf(indexAt(git, "HEAD", readRepoPlans(repo))!);
  assert.equal(checkMakingOf(git, repo, fresh).ok, true);
  assert.equal(checkMakingOf(git, repo, null).ok, false);

  // Tampering negative controls: title change, wrong model, fabricated role, non-canonical JSON, bad version, foreign head
  const tamperedTitle = fresh.replace("Washi Daruma, Emaki, and Hanafuda", "Tampered Emaki Title");
  assert.match(checkMakingOf(git, repo, tamperedTitle).message, /does not match git/);
  const tamperedModel = fresh.replace('"modelId":"gemini-4-argon-medium"', '"modelId":"claude-opus-5-5"');
  assert.equal(checkMakingOf(git, repo, tamperedModel).ok, false);
  const tamperedUnshipped = fresh.replace('"planId": "pm-181"', '"planId": "pm-268"');
  assert.equal(checkMakingOf(git, repo, tamperedUnshipped).ok, false);
  assert.match(checkMakingOf(git, repo, fresh.replace(/\n {4}/g, "\n  ")).message, /canonical/);
  assert.match(checkMakingOf(git, repo, fresh.replace('"version": 1', '"version": 2')).message, /malformed/);
  const foreignHead = fresh.replace(
    /"head": "[0-9a-f]{40}"/,
    `"head": "${indexAt(git, "HEAD", readRepoPlans(repo))!.scenes[0].sha}${"0".repeat(30)}"`,
  );
  assert.match(checkMakingOf(git, repo, foreignHead).message, /not in HEAD's history/);

  // Shallow clone accepts well-formed fallback and rejects malformed JSON
  const clone = shallowClone(repo, 1);
  assert.match(checkMakingOf(gitRunner(clone), clone, fresh).message, /well-formed \(shallow clone/);
  assert.equal(checkMakingOf(gitRunner(clone), clone, fresh.replace('"commitCount": 2', '"commitCount": 0')).ok, false);

  // Later commit editing projects/ within MAX_LAG still validates git history at committed.head
  writeFileSync(
    join(repo, "projects/emaki/plan.md"),
    SAMPLE_EMAKI_PLAN.replace("Washi Daruma, Emaki, and Hanafuda", "Updated Plan Heading"),
  );
  sh(repo, "add", "projects/emaki/plan.md");
  sh(repo, "commit", "--quiet", "-m", "pm-293/t-1677: Add follow-up note");
  assert.equal(checkMakingOf(git, repo, fresh).ok, true);
  assert.equal(checkMakingOf(git, repo, fresh, 0).ok, false);
  assert.match(checkMakingOf(git, repo, fresh, 0).message, /stale: 1 commits behind HEAD/);
});

test("CLI writes making-of.json, preserves gitless fallback, and enforces --strict checks", () => {
  const repo = fixtureRepo(commitsN(6));
  const file = join(TMP, `making-of-${repos++}.json`);

  let r = runScript(`--repo=${repo}`, `--file=${file}`);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /making-of:index: git \(full history\): 3 scenes, 6 commits/);
  const written = readFileSync(file, "utf8");
  assert.equal(runScript(`--repo=${repo}`, `--file=${file}`, "--check").status, 0);

  // Gitless directory leaves fallback unchanged
  const plain = join(TMP, `cli-plain-${repos++}`);
  mkdirSync(plain, { recursive: true });
  r = runScript(`--repo=${plain}`, `--file=${file}`);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /fallback \(git history unavailable\).*unchanged/);
  assert.equal(readFileSync(file, "utf8"), written);

  // Missing fallback in gitless directory writes canonical empty snapshot
  const missing = join(TMP, `cli-missing-${repos++}.json`);
  assert.equal(runScript(`--repo=${plain}`, `--file=${missing}`).status, 0);
  assert.equal(readFileSync(missing, "utf8"), serializeMakingOf(EMPTY_MAKING_OF));

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

test("committed content/making-of.json has 34 shipped scenes with ground-truth run models and omits unrun roles", () => {
  const text = readFileSync(join(ROOT, "content/making-of.json"), "utf8");
  const parsed = parseMakingOf(text);
  assert.ok(parsed, "content/making-of.json failed validation");
  assert.equal(serializeMakingOf(parsed), text);
  assert.equal(containsPrivateData(text), false);
  assert.equal(parsed.scenes.length, 34);
  assert.equal(SHIPPED_PLAN_IDS.length, 34);

  const sceneIds = new Set(parsed.scenes.map((s) => s.planId));
  for (const unshipped of UNSHIPPED_PLAN_IDS) {
    assert.equal(sceneIds.has(unshipped), false, `unshipped plan ${unshipped} must not appear in making-of.json`);
  }

  for (const scene of parsed.scenes) {
    assert.match(scene.planId, /^pm-\d+$/);
    assert.match(scene.commitUrl, /^https:\/\/github\.com\/quiinthieu\/otohime\/commit\/[0-9a-f]{10}$/);
    const expectedRoles = normalizeRoles(SHIPPED_PLAN_REGISTRY[scene.planId].roles);
    assert.deepEqual(scene.roles, expectedRoles);
  }

  // Spot-check pm-293, pm-272 (research + PO skipped), and pm-255 (research skipped)
  const pm293 = parsed.scenes.find((s) => s.planId === "pm-293")!;
  assert.deepEqual(
    pm293.roles.map((r) => [r.role, r.modelId]),
    [
      ["research", "claude-sonnet-5-5"],
      ["product_owner", "gemini-4-argon-medium"],
      ["software_engineer", "gemini-4-argon-high"],
      ["quality_engineer", "gemini-4-argon-medium"],
    ],
  );

  const pm272 = parsed.scenes.find((s) => s.planId === "pm-272")!;
  assert.deepEqual(
    pm272.roles.map((r) => [r.role, r.modelId]),
    [
      ["software_engineer", "gpt-6.1-sol"],
      ["quality_engineer", "gpt-6.1-sol"],
    ],
  );

  const pm255 = parsed.scenes.find((s) => s.planId === "pm-255")!;
  assert.deepEqual(
    pm255.roles.map((r) => [r.role, r.modelId]),
    [
      ["product_owner", "claude-haiku-5-5"],
      ["software_engineer", "claude-opus-5-5"],
      ["quality_engineer", "claude-sonnet-5-5"],
    ],
  );

  const { scripts } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  assert.match(scripts["making-of:index"], /scripts\/making-of-index\.ts$/);
  assert.match(scripts["making-of:check"], /scripts\/making-of-index\.ts --check$/);
  assert.match(scripts.test, /'scripts\/making-of-index\.test\.ts'/);
});
