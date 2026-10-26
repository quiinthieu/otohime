import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkManifest, evaluateRelease, verdict, type Expected, type Snapshots } from "./plan-release.ts";

// Synthetic payloads shaped like the live plan-manager tools' output for pm-255 (read 2026-10-26).
// They are fake board evidence: they prove the probe's rules, not the live release.
const TRACE = "d2b6a7810c26edc93b8d9f448c842a38";
const EXPECTED: Expected = { plan_id: "pm-255", predecessor_id: "pm-248", task_id: "t-1557" };
const NOTE = "acceptance_exhausted: two acceptance cycles failed on the Ask model tier; abandoning pm-248.";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixtures mutate nested API-shaped JSON freely
type Json = Record<string, any>;
const clone = <T>(v: T): T => structuredClone(v);

function heldBoard(): { plan: Json; schedule: Json; timeline: Json; runs: Json } {
  const progress = { state: "waiting", reason: "after_plan", holders: [{ plan_id: "pm-248" }], yield_count: 0, never_parks: true };
  return {
    plan: {
      escalations: [{ id: "esc-389", plan_id: "pm-255", task_id: "t-1557", reason: "slow_plan", blocking: true }],
      plan: {
        id: "pm-255",
        kind: "project",
        title: "Paper Almanac Bits · part 2",
        repo_id: "otohime",
        status: "paused",
        trace_id: TRACE,
        queue_rank_at: null,
        execution_started_at: null,
        after_plan_id: "pm-248",
        created_at: "2026-10-26T04:28:31.028078Z",
      },
      progress: clone(progress),
      reports: [],
      tasks: [
        { id: "t-1557", plan_id: "pm-255", title: "Ask deploy bundle probe", role: "software_engineer", status: "ready", started_at: "2026-10-26T04:27:53.975898Z" },
        { id: "t-1558", plan_id: "pm-255", title: "Ask tier production probe", role: "software_engineer", status: "backlog", depends_on: ["t-1557"] },
      ],
    },
    schedule: {
      plan_id: "pm-255",
      status: "paused",
      scheduled: false,
      progress: clone(progress),
      yield_due: false,
      inputs: {
        now: "2026-10-26T08:42:13.638147296Z",
        slots: { used: 5, max: 2, max_per_repo: 0, free: 0 },
        tasks: [
          { task_id: "t-1557", status: "ready", paths_from: "interfaces", paths: ["scripts/probe-ask-deploy.mjs"] },
          { task_id: "t-1558", status: "backlog", paths_from: "interfaces", paths: ["scripts/probe-ask-tier.mjs"] },
        ],
      },
      tasks: [
        { task_id: "t-1557", status: "ready", paths_from: "interfaces", paths: ["scripts/probe-ask-deploy.mjs"] },
        { task_id: "t-1558", status: "backlog", paths_from: "interfaces", paths: ["scripts/probe-ask-tier.mjs"] },
      ],
      own_runs: [],
      open_escalations: ["esc-389"],
      terms: [],
    },
    timeline: {
      cursor: "idea:idea-248",
      entries: [
        {
          id: "dec-56482",
          at: "2026-10-26T08:18:09.596611Z",
          type: "decision",
          actor: "investigator-agent",
          task_id: "t-1557",
          kind: "slow_verdict",
          summary: "slowness verdict fix_plan by run-8771: pm-255 is held by an orphaned after_plan edge · fix plan pm-260",
          reason: "slow:pm-255:task_duration:t-1557:2026-10-26T04:27:53.975898Z",
          evidence: {
            note: "",
            cause: "The parent pm-248 was abandoned at 04:49:13; a split part whose parent is abandoned must be released.",
            verdict: "fix_plan",
          },
          trace_id: TRACE,
        },
        {
          id: "dec-55931",
          at: "2026-10-26T05:12:21.039373Z",
          type: "decision",
          actor: "orchestrator",
          kind: "promotion_skipped",
          summary: "skipped for a free slot: waiting for after_plan held by pm-248; keeps its place in line",
          reason: "after_plan",
          evidence: { reason: "after_plan", holders: [{ plan_id: "pm-248" }] },
          trace_id: TRACE,
        },
        {
          id: "dec-55726",
          at: "2026-10-26T04:28:37.823737Z",
          type: "decision",
          actor: "orchestrator",
          kind: "plan_split_from",
          summary: "part of pm-248: 2 tasks moved here; waits until pm-248 is done",
          reason: "split:pm-248",
          evidence: { plan_id: "pm-248", child_plan_id: "pm-255", moved: ["t-1557", "t-1558"] },
          trace_id: TRACE,
        },
        { id: "idea:idea-248", at: "2026-10-25T21:08:35.350983Z", type: "idea", actor: "avietidol@vietky.io.vn", kind: "console", summary: "otohime.dev three new bits", refs: {} },
      ],
    },
    runs: { runs: [] },
  };
}

const RELEASE_DECISION = {
  id: "dec-60001",
  at: "2026-10-26T09:05:00Z",
  type: "decision",
  actor: "operator",
  kind: "after_plan_released",
  summary: "released from after_plan pm-248: pm-248 abandoned (dec-55805, acceptance_exhausted); edge cleared by administrative repair for pm-260",
  reason: "release-after-plan:pm-255:pm-248",
  evidence: {
    plan_id: "pm-255",
    predecessor_id: "pm-248",
    predecessor_status: "abandoned",
    abandon_decision_id: "dec-55805",
    note_decision_id: "dec-55807",
    parent_note: NOTE,
    edge_before: "pm-248",
    edge_after: null,
  },
  trace_id: TRACE,
};

function queuedBoard() {
  const b = heldBoard();
  const progress = { state: "startable", holders: [], queue_position: 1, yield_count: 0 };
  b.plan.plan.status = "queued";
  b.plan.plan.after_plan_id = null;
  b.plan.progress = clone(progress);
  b.schedule.status = "queued";
  b.schedule.progress = clone(progress);
  b.timeline.entries.unshift(clone(RELEASE_DECISION));
  return b;
}

const SWE_RUN = {
  id: "run-9001",
  plan_id: "pm-255",
  task_id: "t-1557",
  role: "software_engineer",
  kind: "role",
  template_id: "coding-agent",
  tm_task_id: "6b1f0c2e-1d55-4c0e-9a77-3f0a5d2c9e10",
  repo_id: "otohime",
  agent_profile: "claude-opus-high",
  attempt: 1,
  status: "running",
  started_at: "2026-10-26T09:10:00Z",
  finished_at: "0001-01-01T00:00:00Z",
};

function dispatchedBoard() {
  const b = queuedBoard();
  const progress = { state: "live", holders: [], yield_count: 0 };
  b.plan.plan.status = "executing";
  b.plan.plan.execution_started_at = "2026-10-26T09:10:00Z";
  b.plan.progress = clone(progress);
  b.schedule.status = "executing";
  b.schedule.progress = clone(progress);
  b.schedule.own_runs = [{ run_id: "run-9001", task_id: "t-1557", role: "software_engineer", status: "running" }];
  b.runs.runs.push(clone(SWE_RUN));
  return b;
}

const evalBoard = (b: Snapshots, expected: Expected = EXPECTED) => evaluateRelease(b, expected);

test("held/paused behind abandoned pm-248: nothing is released, recorded or dispatched", () => {
  const e = evalBoard(heldBoard());
  assert.deepEqual(e.input_errors, []);
  assert.equal(e.hold_released, false);
  assert.deepEqual(e.reasons.hold_released, ["hold_after_plan", "held_by_predecessor", "progress_waiting"]);
  assert.equal(e.queued_startable, false);
  assert.equal(e.execution_started, false);
  // dec-56482 (slow_verdict) names pm-248, "abandoned" and "released" but is not a release decision.
  assert.equal(e.release_recorded, false);
  assert.deepEqual(e.reasons.release_recorded, ["release_decision_missing"]);
  assert.equal(e.dispatch_proven, false);
  assert.deepEqual(e.reasons.dispatch_proven, ["swe_run_missing"]);
  assert.equal(verdict(e, "released").ok, false);
  assert.equal(verdict(e, "dispatched").ok, false);
});

test("released and queued/startable passes released mode, not dispatched", () => {
  const e = evalBoard(queuedBoard(), { ...EXPECTED, abandon_decision_ids: ["dec-55805", "dec-55807"] });
  assert.equal(e.hold_released, true);
  assert.equal(e.queued_startable, true);
  assert.equal(e.release_recorded, true);
  assert.equal(e.evidence.release_decision_id, "dec-60001");
  assert.equal(e.execution_started, false);
  assert.equal(e.dispatch_proven, false);
  assert.deepEqual(verdict(e, "released"), { ok: true, mode: "released", unmet: [] });
  assert.deepEqual(verdict(e, "dispatched").unmet, ["execution_started", "dispatch_proven"]);
});

test("the platform fix keeps the edge as provenance: after_plan_id=pm-248 with progress off the hold still releases", () => {
  const b = queuedBoard();
  b.plan.plan.after_plan_id = "pm-248";
  assert.equal(verdict(evalBoard(b), "released").ok, true);
});

test("released with execution and a durable SWE task id passes dispatched mode; delivery is never claimed", () => {
  const e = evalBoard(dispatchedBoard());
  assert.equal(e.hold_released, true);
  assert.equal(e.queued_startable, false);
  assert.equal(e.execution_started, true);
  assert.equal(e.dispatch_proven, true);
  assert.deepEqual(e.evidence.dispatch_runs, [
    { run_id: "run-9001", tm_task_id: SWE_RUN.tm_task_id, status: "running", outcome: "running", failed: false },
  ]);
  assert.equal(e.delivery_proven, false);
  assert.deepEqual(verdict(e, "dispatched"), { ok: true, mode: "dispatched", unmet: [] });
  assert.equal(verdict(e, "released").ok, true);
});

test("pending and succeeded SWE runs with a tm_task_id count as submitted and finished", () => {
  for (const [status, outcome] of [["pending", "submitted"], ["succeeded", "finished"]]) {
    const b = dispatchedBoard();
    b.runs.runs[0].status = status;
    const e = evalBoard(b);
    assert.equal(e.dispatch_proven, true, status);
    assert.equal(e.evidence.dispatch_runs[0].outcome, outcome);
    assert.equal(e.delivery_proven, false);
  }
});

test("missing progress is not a release", () => {
  const b = queuedBoard();
  delete b.plan.progress;
  let e = evalBoard(b);
  assert.equal(e.hold_released, false);
  assert.deepEqual(e.reasons.hold_released, ["plan_progress_missing"]);
  assert.equal(verdict(e, "released").ok, false);

  delete b.schedule.progress;
  e = evalBoard(b);
  assert.deepEqual(e.reasons.hold_released, ["plan_progress_missing", "schedule_progress_missing"]);
  assert.equal(e.queued_startable, false);
});

test("progress that disagrees between get_plan and explain_schedule fails closed", () => {
  const b = queuedBoard();
  b.schedule.progress = { state: "waiting", reason: "after_plan", holders: [{ plan_id: "pm-248" }] };
  const e = evalBoard(b);
  assert.equal(e.hold_released, false);
  assert.ok(e.reasons.hold_released.includes("progress_disagrees"));
  assert.ok(e.reasons.hold_released.includes("hold_after_plan"));
});

test("an unrecognized progress state is unsupported input", () => {
  const b = queuedBoard();
  b.schedule.progress = { state: "released", holders: [] };
  const e = evalBoard(b);
  assert.deepEqual(e.input_errors, ["schedule_progress_state_unrecognized"]);
  assert.equal(e.hold_released, false);
  assert.equal(verdict(e, "released").unmet[0], "input_supported");
});

test("an old execution timestamp under a current after_plan hold proves neither release nor execution", () => {
  const b = heldBoard();
  b.plan.plan.status = "queued";
  b.schedule.status = "queued";
  b.plan.plan.execution_started_at = "2026-10-25T22:25:13Z";
  b.timeline.entries.unshift(clone(RELEASE_DECISION));
  const e = evalBoard(b);
  assert.equal(e.hold_released, false);
  assert.equal(e.execution_started, false);
  assert.deepEqual(e.reasons.execution_started, ["plan_status_not_executing"]);
  assert.equal(e.release_recorded, true);
  assert.deepEqual(verdict(e, "released").unmet, ["hold_released", "queued_startable|execution_started"]);
});

test("executing status without execution_started_at is not execution", () => {
  const b = dispatchedBoard();
  b.plan.plan.execution_started_at = null;
  const e = evalBoard(b);
  assert.equal(e.execution_started, false);
  assert.deepEqual(e.reasons.execution_started, ["execution_started_at_missing"]);
  assert.equal(verdict(e, "dispatched").ok, false);
});

test("wrong plan, task, predecessor or foreign snapshots are unsupported", () => {
  const cases: [string, (b: ReturnType<typeof dispatchedBoard>) => void, Expected, string][] = [
    ["plan id", () => {}, { ...EXPECTED, plan_id: "pm-256" }, "plan_id_mismatch"],
    ["schedule of another plan", (b) => (b.schedule.plan_id = "pm-258"), EXPECTED, "schedule_plan_id_mismatch"],
    ["task id", () => {}, { ...EXPECTED, task_id: "t-1564" }, "task_missing_from_plan"],
    ["task moved away", (b) => (b.plan.tasks[0].plan_id = "pm-248"), EXPECTED, "task_missing_from_plan"],
    ["task absent from schedule", (b) => b.schedule.tasks.shift(), EXPECTED, "task_missing_from_schedule"],
    ["predecessor", (b) => (b.plan.plan.after_plan_id = "pm-248"), { ...EXPECTED, predecessor_id: "pm-247" }, "predecessor_mismatch"],
    ["timeline of another plan", (b) => b.timeline.entries.forEach((x: Json) => x.trace_id && (x.trace_id = "4156e7859e7efe5c")), EXPECTED, "timeline_plan_mismatch"],
    ["runs of another plan", (b) => (b.runs.runs[0].plan_id = "pm-260"), EXPECTED, "runs_plan_mismatch"],
    ["status disagrees", (b) => (b.schedule.status = "paused"), EXPECTED, "schedule_status_disagrees"],
  ];
  for (const [name, mutate, expected, code] of cases) {
    const b = dispatchedBoard();
    mutate(b);
    const e = evalBoard(b, expected);
    assert.ok(e.input_errors.includes(code), `${name}: ${JSON.stringify(e.input_errors)}`);
    for (const c of ["hold_released", "queued_startable", "execution_started", "release_recorded", "dispatch_proven"] as const) {
      assert.equal(e[c], false, `${name}: ${c}`);
    }
    assert.equal(verdict(e, "dispatched").ok, false);
  }
});

test("unsupported payload shapes are rejected, not read as absent evidence", () => {
  const good = dispatchedBoard();
  const cases: [Partial<Snapshots>, string][] = [
    [{ plan: { id: "pm-255", status: "executing" } }, "plan_shape_unsupported"],
    [{ schedule: { progress: good.schedule.progress } }, "schedule_shape_unsupported"],
    [{ timeline: [] }, "timeline_shape_unsupported"],
    [{ timeline: { entries: [] } }, "timeline_empty"],
    [{ runs: [] }, "runs_shape_unsupported"],
    [{ runs: "Error: result exceeds maximum allowed tokens" }, "runs_shape_unsupported"],
  ];
  for (const [patch, code] of cases) {
    const e = evalBoard({ ...dispatchedBoard(), ...patch });
    assert.deepEqual(e.input_errors, [code]);
    assert.deepEqual(e.reasons.dispatch_proven, ["input_unsupported"]);
  }
  assert.deepEqual(evalBoard(dispatchedBoard(), { plan_id: "", predecessor_id: "pm-248", task_id: "t-1557" }).input_errors.slice(0, 1), [
    "expected_plan_id_missing",
  ]);
});

test("a release decision without the abandonment note, or without the named abandon decision, is not recorded", () => {
  const b = queuedBoard();
  delete b.timeline.entries[0].evidence.parent_note;
  let e = evalBoard(b);
  assert.equal(e.release_recorded, false);
  assert.deepEqual(e.reasons.release_recorded, ["release_note_missing"]);
  assert.equal(verdict(e, "released").ok, false);

  const c = queuedBoard();
  c.timeline.entries[0].summary = "released from after_plan pm-248: pm-248 abandoned";
  delete c.timeline.entries[0].evidence.abandon_decision_id;
  delete c.timeline.entries[0].evidence.note_decision_id;
  assert.equal(evalBoard(c).release_recorded, true);
  e = evalBoard(c, { ...EXPECTED, abandon_decision_ids: ["dec-55805"] });
  assert.deepEqual(e.reasons.release_recorded, ["abandon_decision_ref_missing"]);

  const d = queuedBoard();
  d.timeline.entries[0].evidence.plan_id = "pm-248";
  assert.deepEqual(evalBoard(d).reasons.release_recorded, ["release_decision_missing"]);

  const f = queuedBoard();
  f.timeline.entries[0].kind = "after_plan_orphaned";
  assert.equal(evalBoard(f).release_recorded, false);
});

test("a merely scheduled run, an unsubmitted run and unrelated runs do not prove dispatch", () => {
  const b = dispatchedBoard();
  b.runs.runs[0] = { ...SWE_RUN, status: "scheduled", tm_task_id: "" };
  b.runs.runs.push(
    { ...SWE_RUN, id: "run-9002", task_id: "t-1558", status: "running" },
    { ...SWE_RUN, id: "run-9003", role: "quality_engineer", status: "running" },
    { ...SWE_RUN, id: "run-9004", status: "cancelled" },
  );
  let e = evalBoard(b);
  assert.equal(e.dispatch_proven, false);
  assert.deepEqual(e.reasons.dispatch_proven, ["swe_run_scheduled_only"]);
  assert.deepEqual(e.evidence.ignored_runs, [
    { run_id: "run-9001", why: "status_scheduled" },
    { run_id: "run-9003", why: "role_quality_engineer" },
    { run_id: "run-9004", why: "status_cancelled" },
  ]);
  assert.deepEqual(verdict(e, "dispatched").unmet, ["dispatch_proven"]);

  const c = dispatchedBoard();
  c.runs.runs[0].tm_task_id = "";
  e = evalBoard(c);
  assert.deepEqual(e.reasons.dispatch_proven, ["swe_run_not_submitted"]);
});

test("a failed SWE attempt proves dispatch only and is reported as a failed attempt, never delivery", () => {
  const b = dispatchedBoard();
  Object.assign(b.runs.runs[0], { status: "failed", failure_class: "agent_failed", error: "agent_failed: exit 1" });
  const e = evalBoard(b);
  assert.equal(e.dispatch_proven, true);
  assert.deepEqual(e.evidence.failed_attempts, ["run-9001"]);
  assert.equal(e.evidence.dispatch_runs[0].failed, true);
  assert.equal(e.evidence.dispatch_runs[0].outcome, "finished");
  assert.equal(e.delivery_proven, false);
});

test("evaluation does not mutate its inputs", () => {
  const b = dispatchedBoard();
  const before = JSON.stringify(b);
  evalBoard(b);
  assert.equal(JSON.stringify(b), before);
});

// CLI integration: real files in a temporary directory, the real script, no network.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCRIPT = join(ROOT, "scripts/probe-plan-release.mjs");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const TOOLS = { plan: "plan_manager_get_plan", schedule: "plan_manager_explain_schedule", timeline: "plan_manager_get_timeline", runs: "plan_manager_list_runs" };

function write(dir: string, board: Record<string, unknown>, raw: Partial<Record<string, string>> = {}) {
  const files: Record<string, string> = {};
  const digests: Record<string, string> = {};
  for (const k of Object.keys(TOOLS)) {
    const text = raw[k] ?? JSON.stringify(board[k]);
    files[k] = join(dir, `${k}.json`);
    writeFileSync(files[k], text);
    digests[k] = sha(text);
  }
  return { files, digests };
}

function manifestFor(digests: Record<string, string>, over: Record<string, Json> = {}) {
  const at = "2026-10-26T09:20:00Z";
  return {
    captured_at: at,
    board_build_sha: "0000000",
    snapshots: Object.fromEntries(
      Object.entries(TOOLS).map(([k, tool]) => [
        k,
        { tool, args: { plan_id: "pm-255", ...(k === "timeline" ? { limit: 200 } : {}) }, captured_at: at, complete: true, sha256: digests[k], ...over[k] },
      ]),
    ),
  };
}

function runCli(files: Record<string, string>, extra: string[] = []) {
  const args = [
    "--experimental-strip-types",
    "--disable-warning=ExperimentalWarning",
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
    SCRIPT,
    ...["plan", "schedule", "timeline", "runs"].flatMap((k) => (files[k] ? [`--${k}`, files[k]] : [])),
    ...extra,
  ];
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } });
  let body: Json = {};
  try {
    body = JSON.parse(r.stdout);
  } catch {
    assert.fail(`stdout is not JSON (exit ${r.status}): ${r.stdout}\n${r.stderr}`);
  }
  return { code: r.status, body };
}

const IDS = ["--plan-id", "pm-255", "--predecessor-id", "pm-248", "--task-id", "t-1557"];

function withDir(fn: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "plan-release-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("CLI: dispatched board with a verified manifest exits 0 and keeps run ids and outcome", () => {
  withDir((dir) => {
    const { files, digests } = write(dir, dispatchedBoard());
    const m = join(dir, "manifest.json");
    writeFileSync(m, JSON.stringify(manifestFor(digests)));
    const before = Object.values(files).map((f) => readFileSync(f, "utf8"));
    const { code, body } = runCli(files, [...IDS, "--abandon-decision", "dec-55805,dec-55807", "--manifest", m]);
    assert.equal(code, 0, JSON.stringify(body));
    assert.equal(body.ok, true);
    assert.equal(body.mode, "dispatched");
    assert.equal(body.manifest.completeness, "verified");
    assert.equal(body.delivery_proven, false);
    assert.equal(body.evidence.dispatch_runs[0].run_id, "run-9001");
    assert.equal(body.evidence.dispatch_runs[0].tm_task_id, SWE_RUN.tm_task_id);
    assert.equal(body.sha256.plan, digests.plan);
    // Read-only: the snapshots are byte-identical afterwards.
    assert.deepEqual(Object.values(files).map((f) => readFileSync(f, "utf8")), before);
  });
});

test("CLI: queued/startable board passes --require released and fails the default dispatched mode", () => {
  withDir((dir) => {
    const { files } = write(dir, queuedBoard());
    const released = runCli(files, [...IDS, "--require", "released"]);
    assert.equal(released.code, 0, JSON.stringify(released.body));
    assert.equal(released.body.manifest.completeness, "unverified");
    const dispatched = runCli(files, IDS);
    assert.equal(dispatched.code, 1);
    assert.equal(dispatched.body.mode, "dispatched");
    assert.deepEqual(dispatched.body.unmet, ["execution_started", "dispatch_proven"]);
  });
});

test("CLI: held board, scheduled-only run and failed attempt exit 1 or 0 as the evidence says", () => {
  withDir((dir) => {
    const held = runCli(write(dir, heldBoard()).files, [...IDS, "--require", "released"]);
    assert.equal(held.code, 1);
    assert.ok(held.body.reasons.hold_released.includes("hold_after_plan"));

    const sched = dispatchedBoard();
    sched.runs.runs[0] = { ...SWE_RUN, status: "scheduled", tm_task_id: "" };
    const s = runCli(write(dir, sched).files, IDS);
    assert.equal(s.code, 1);
    assert.deepEqual(s.body.reasons.dispatch_proven, ["swe_run_scheduled_only"]);

    const failed = dispatchedBoard();
    failed.runs.runs[0].status = "failed";
    const f = runCli(write(dir, failed).files, IDS);
    assert.equal(f.code, 0);
    assert.deepEqual(f.body.evidence.failed_attempts, ["run-9001"]);
    assert.equal(f.body.delivery_proven, false);
  });
});

test("CLI: truncated payloads and incomplete or mismatched manifests exit 2", () => {
  withDir((dir) => {
    const board = dispatchedBoard();
    const full = JSON.stringify(board.timeline);
    const cut = write(dir, board, { timeline: full.slice(0, Math.floor(full.length / 2)) });
    const t = runCli(cut.files, IDS);
    assert.equal(t.code, 2);
    assert.deepEqual(t.body.input_errors, ["timeline_json_invalid"]);

    const { files, digests } = write(dir, board);
    const m = join(dir, "manifest.json");
    writeFileSync(m, JSON.stringify(manifestFor(digests, { runs: { complete: false } })));
    const inc = runCli(files, [...IDS, "--manifest", m]);
    assert.equal(inc.code, 2);
    assert.deepEqual(inc.body.input_errors, ["manifest_runs_incomplete"]);
    assert.equal(inc.body.manifest.completeness, "failed");

    writeFileSync(m, JSON.stringify(manifestFor(digests, { plan: { sha256: sha("older snapshot") } })));
    assert.deepEqual(runCli(files, [...IDS, "--manifest", m]).body.input_errors, ["manifest_plan_sha256_mismatch"]);

    writeFileSync(m, "{\"captured_at\":");
    assert.deepEqual(runCli(files, [...IDS, "--manifest", m]).body.input_errors, ["manifest_unreadable"]);
  });
});

test("CLI: wrong ids exit 2; missing or unsupported arguments exit 2", () => {
  withDir((dir) => {
    const { files } = write(dir, dispatchedBoard());
    const wrong = runCli(files, ["--plan-id", "pm-255", "--predecessor-id", "pm-248", "--task-id", "t-1558x"]);
    assert.equal(wrong.code, 2);
    assert.deepEqual(wrong.body.input_errors, ["task_missing_from_plan", "task_missing_from_schedule"]);

    const noRuns = runCli({ ...files, runs: "" }, IDS);
    assert.equal(noRuns.code, 2);
    assert.deepEqual(noRuns.body.input_errors, ["argument_runs_missing"]);

    assert.deepEqual(runCli(files, [...IDS, "--require", "delivered"]).body.input_errors, ["argument_require_unsupported"]);
    assert.deepEqual(runCli(files, [...IDS, "--live"]).body.input_errors, ["arguments_unsupported"]);
    assert.deepEqual(runCli({ ...files, plan: join(dir, "absent.json") }, IDS).body.input_errors, ["plan_unreadable"]);
  });
});

test("checkManifest names every missing or mismatched snapshot entry", () => {
  const digests = { plan: "a", schedule: "b", timeline: "c", runs: "d" };
  assert.deepEqual(checkManifest(null, digests, "pm-255"), ["manifest_shape_unsupported"]);
  const m = manifestFor(digests, { schedule: { tool: "plan_manager_get_plan" }, timeline: { args: { plan_id: "pm-248" } } });
  delete (m.snapshots as Json).runs;
  assert.deepEqual(checkManifest(m, digests, "pm-255"), [
    "manifest_schedule_tool_mismatch",
    "manifest_timeline_plan_id_mismatch",
    "manifest_runs_missing",
  ]);
  const prefixed = manifestFor(digests, { plan: { tool: "mcp__plan-manager__plan_manager_get_plan" } });
  assert.deepEqual(checkManifest(prefixed, digests, "pm-255"), []);
});

test("the probe script makes no network call and no board write", () => {
  const src = readFileSync(SCRIPT, "utf8");
  for (const banned of [/\bfetch\(/, /node:https?/, /node:net/, /writeFile/, /plan_manager_(record|ask|resume|set|submit)/]) {
    assert.doesNotMatch(src, banned);
  }
});
