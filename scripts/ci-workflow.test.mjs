// Guards the main lane in .github/workflows/ci.yml: report-only pushes stay out of the queue,
// pull requests keep running on every change, and the jobs that ship run on a pinned runner.
// Dependency-free (no npm ci needed): reads the YAML by indentation, which is all this file uses.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const lines = workflow.split("\n");
const indent = (line) => line.length - line.trimStart().length;
const significant = (line) => line.trim() !== "" && !line.trim().startsWith("#");

// Lines of the mapping under `path` (e.g. ["on", "push"]), or null when the key is absent.
// Only direct children of the enclosing key are matched, so a nested key of the same name is not.
function block(path, from = 0, to = lines.length) {
  const [key, ...rest] = path;
  const first = lines.slice(from, to).find(significant);
  if (first === undefined) return null;
  const own = indent(first);
  for (let i = from; i < to; i++) {
    const line = lines[i];
    if (!significant(line) || indent(line) !== own) continue;
    if (line.trim().split(":")[0].replace(/["']/g, "") !== key) continue;
    let end = i + 1;
    while (end < to && (!significant(lines[end]) || indent(lines[end]) > own)) end++;
    return rest.length ? block(rest, i + 1, end) : { start: i, end, value: line.slice(line.indexOf(":") + 1).trim() };
  }
  return null;
}

// Scalar list under a key, block (`- "x"`) or flow (`[x, y]`) style.
function list(path) {
  const found = block(path);
  if (!found) return null;
  const unquote = (s) => s.trim().replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "");
  if (found.value.startsWith("[")) return found.value.slice(1, found.value.lastIndexOf("]")).split(",").map(unquote).filter(Boolean);
  return lines.slice(found.start + 1, found.end).filter(significant).map((l) => unquote(l.trim().replace(/^-\s*/, "")));
}

const scalar = (path) => block(path)?.value.replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "");

// GitHub's filter glob: `**` crosses directories, `*` does not.
const globRe = (glob) =>
  new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\/?|\*/g, (m) => (m === "*" ? "[^/]*" : ".*"))}$`);
// A push runs unless every changed file matches an ignore pattern.
const pushRuns = (ignore, files) => files.some((f) => !ignore.some((g) => globRe(g).test(f)));

test("push to main ignores report-only paths", () => {
  assert.deepEqual(list(["on", "push", "branches"]), ["main"]);
  const ignore = list(["on", "push", "paths-ignore"]);
  assert.ok(ignore, "on.push.paths-ignore is missing");
  assert.ok(ignore.includes("projects/**"), `paths-ignore lacks projects/**: ${ignore}`);
  assert.ok(ignore.includes("**.md"), `paths-ignore lacks **.md: ${ignore}`);
  assert.equal(block(["on", "push", "paths"]), null, "push must not also set paths (GitHub rejects paths with paths-ignore)");
});

test("report-only pushes skip, code pushes still run", () => {
  const ignore = list(["on", "push", "paths-ignore"]);
  // Negative controls: a report commit and a README edit create no run.
  assert.equal(pushRuns(ignore, ["projects/fix-x/qa_run-1.md", "projects/fix-x/artifacts/run.log"]), false);
  assert.equal(pushRuns(ignore, ["README.md", "agent/skills/neon/references/x.md"]), false);
  // Code, generated content and the workflow itself still run, alone or beside a report.
  assert.equal(pushRuns(ignore, ["app/page.tsx"]), true);
  assert.equal(pushRuns(ignore, ["projects/fix-x/plan.md", "lib/motion.ts"]), true);
  assert.equal(pushRuns(ignore, ["content/history.json"]), true);
  assert.equal(pushRuns(ignore, [".github/workflows/ci.yml"]), true);
  // The ignore must not reach app routes that merely contain "projects".
  assert.equal(pushRuns(ignore, ["app/(site)/(app)/projects/page.tsx"]), true);
});

test("pull_request has no path filter", () => {
  const pr = block(["on", "pull_request"]);
  assert.ok(pr, "on.pull_request is missing");
  assert.equal(block(["on", "pull_request", "paths-ignore"]), null);
  assert.equal(block(["on", "pull_request", "paths"]), null);
});

test("manual recovery runs the same checks and production gates as a main push", () => {
  assert.ok(block(["on", "workflow_dispatch"]), "queue replacement recovery needs workflow_dispatch");
  assert.equal(block(["jobs", "checks", "if"]).value, "github.event.action != 'closed'");
  assert.equal(scalar(["jobs", "production", "needs"]), "checks");
  assert.equal(scalar(["jobs", "production", "if"]), "github.event_name == 'push' || (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main')");
});

test("checks and production run on ubuntu-24.04", () => {
  for (const job of ["checks", "production"]) {
    assert.equal(scalar(["jobs", job, "runs-on"]), "ubuntu-24.04", `jobs.${job}.runs-on`);
  }
});

test("main keeps cancel-in-progress off and no queue: max", () => {
  assert.equal(scalar(["concurrency", "cancel-in-progress"]), "${{ github.event_name == 'pull_request' }}");
  assert.equal(block(["concurrency", "queue"]), null);
});

// Lines of a job's `steps:` list, joined, comments dropped.
const steps = (job) => {
  const found = block(["jobs", job, "steps"]);
  assert.ok(found, `jobs.${job}.steps is missing`);
  return lines.slice(found.start + 1, found.end).filter(significant).join("\n");
};

test("production proves the deployed sha, terminal and press after the deploy", () => {
  const prod = steps("production");
  const verify = prod.indexOf('EXPECT_SHA="$GITHUB_SHA" bash scripts/verify-deploy.sh https://otohime.dev');
  assert.notEqual(verify, -1, "production must run scripts/verify-deploy.sh with EXPECT_SHA=$GITHUB_SHA against otohime.dev");
  const deploy = prod.indexOf("bash scripts/vercel-deploy.sh");
  assert.ok(deploy !== -1 && deploy < verify, "verify-deploy must run after the deploy step");
  // Negative control: a bare 200-only health curl is not proof of the served commit.
  assert.doesNotMatch(prod, /curl\b[^\n]*otohime\.dev\/api\/health/, "production must not smoke-test with a bare health curl");
  assert.match(steps("checks"), /bash scripts\/verify-deploy\.sh --self-test/, "checks must run the verify-deploy self-test");
});

test("verify-deploy treats exactly the push paths-ignore as report-only", () => {
  // A report-only lead passes verify-deploy because CI never deploys it; the two lists must not drift apart.
  const script = readFileSync(new URL("./verify-deploy.sh", import.meta.url), "utf8");
  assert.deepEqual(list(["on", "push", "paths-ignore"]), ["projects/**", "**.md"]);
  assert.match(script, /^\s*"" \| projects\/\* \| \*\.md\) ;;$/m, "verify-deploy.sh must ignore projects/* and *.md only");
});

test("the author gate precedes production migrations and main checks", () => {
  const prod = steps("production");
  const author = prod.indexOf("node scripts/check-deploy-author.mjs");
  assert.ok(author > prod.indexOf("actions/checkout@"), "inspect the checked-out commit");
  assert.ok(author < prod.indexOf("npm ci"), "fail before setup, build and migrations");
  assert.ok(author < prod.indexOf("npm run db:migrate"), "never migrate an undeployable author");
  assert.match(prod, /DEPLOY_AUTHOR_EMAIL: quiinthieu@gmail\.com/);
  assert.match(steps("checks"), /if: github.event_name != 'pull_request'[\s\S]*?node scripts\/check-deploy-author\.mjs/);
});
