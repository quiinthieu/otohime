// Deploy only the latest green commit on main. A later passed check, or a later
// check still running when the wait ends, skips this upload. A later failed check
// leaves this commit to ship. The live sha is checked first so an older job cannot
// promote over a newer deployment.
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function decideShip({ descendants, live }) {
  if (live === "diverged") return { action: "fail", reason: "the live sha is not on this commit's history" };
  if (live === "same" || live === "contains") return { action: "skip", reason: "production already serves this commit" };
  if (descendants.includes("success")) return { action: "skip", reason: "a later commit on main has passed checks" };
  if (descendants.includes("running")) return { action: "wait", reason: "a later commit on main is still in checks" };
  return { action: "ship", reason: "this is the latest green commit on main" };
}

export function classifyLive(head, live, known, isAncestor) {
  if (typeof head !== "string" || !/^[0-9a-f]{40}$/.test(head)) return "unknown";
  if (typeof live !== "string" || !/^[0-9a-f]{40}$/.test(live)) return "unknown";
  if (live === head) return "same";
  if (!known(head) || !known(live)) return "unknown";
  if (isAncestor(head, live)) return "contains";
  if (isAncestor(live, head)) return "behind";
  return "diverged";
}

function gitOut(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }).trim();
}

function known(sha) {
  return spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], { stdio: "ignore" }).status === 0;
}

function isAncestor(ancestor, descendant) {
  return spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], { stdio: "ignore" }).status === 0;
}

function descendantsOfHead() {
  const head = process.env.GITHUB_SHA ?? "";
  if (!/^[0-9a-f]{40}$/.test(head)) throw new Error("GITHUB_SHA must be the full commit being deployed");
  gitOut(["fetch", "--quiet", "--no-tags", "origin", "+refs/heads/main:refs/remotes/origin/main"]);
  const tip = gitOut(["rev-parse", "refs/remotes/origin/main"]);
  if (head === tip) return [];
  if (!isAncestor(head, tip)) throw new Error(`checked-out commit ${head} is not on origin/main (${tip})`);
  const list = gitOut(["rev-list", "--reverse", `${head}..${tip}`]);
  return list ? list.split("\n") : [];
}

function gh(path) {
  return JSON.parse(execFileSync("gh", ["api", path], { encoding: "utf8", timeout: 30_000 }));
}

const settled = new Map();

function checksState(sha) {
  if (settled.has(sha)) return settled.get(sha);
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error("GITHUB_REPOSITORY is required");
  const allRuns = gh(`repos/${repo}/actions/workflows/ci.yml/runs?head_sha=${sha}&per_page=20`).workflow_runs ?? [];
  const runs = allRuns.filter(
    (run) => (run.event === "push" || run.event === "workflow_dispatch") && (!run.head_branch || run.head_branch === "main"),
  );
  if (runs.length === 0) return "none";
  runs.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const run = runs[0];
  const jobs = gh(`repos/${repo}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`).jobs ?? [];
  const checks = jobs.filter((job) => job.name === "checks");
  if (checks.length === 0) return run.status === "completed" ? "none" : "running";
  checks.sort((a, b) => Date.parse(b.started_at ?? b.completed_at ?? 0) - Date.parse(a.started_at ?? a.completed_at ?? 0));
  const job = checks[0];
  if (job.status !== "completed") return "running";
  const state = job.conclusion === "success" ? "success" : job.conclusion === "skipped" ? "none" : "failure";
  settled.set(sha, state);
  return state;
}

async function liveSha() {
  const url = process.env.HEALTH_URL ?? "https://otohime.dev/api/health";
  try {
    const body = url.startsWith("file://")
      ? JSON.parse(readFileSync(new URL(url), "utf8"))
      : await fetch(url, { signal: AbortSignal.timeout(20_000) }).then((r) => (r.ok ? r.json() : null));
    return body?.ok === true && typeof body.sha === "string" ? body.sha : null;
  } catch {
    return null;
  }
}

function relation(head, live) {
  if (live && /^[0-9a-f]{40}$/.test(live) && !known(live)) {
    spawnSync("git", ["fetch", "--quiet", "--no-tags", "origin", live], {
      stdio: "ignore",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  }
  return classifyLive(head, live, known, isAncestor);
}

function finish(action, reason) {
  console.log(`production ship: ${action}: ${reason}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Production ship: ${action}. ${reason}\n`);
  }
  if (action === "fail") process.exit(1);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `ship=${action === "ship" ? "true" : "false"}\n`);
  }
}

async function main() {
  const waitMs = Number(process.env.SHIP_WAIT_SECONDS ?? 480) * 1000;
  const pollMs = Number(process.env.SHIP_POLL_SECONDS ?? 20) * 1000;
  const deadline = Date.now() + waitMs;
  for (;;) {
    const descendantShas = descendantsOfHead();
    const live = relation(process.env.GITHUB_SHA, await liveSha());
    const descendants =
      live === "diverged" || live === "same" || live === "contains" ? [] : descendantShas.map(checksState);
    const decision = decideShip({ descendants, live });
    if (decision.action !== "wait") return finish(decision.action, decision.reason);
    if (Date.now() >= deadline) {
      // A later check still running after SHIP_WAIT_SECONDS is treated as going to ship;
      // if it later fails, its successor or workflow_dispatch ships the latest green commit.
      return finish("skip", "a later commit was still in checks when the wait ended");
    }
    console.log(`production ship: waiting: ${decision.reason}`);
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) await main();
