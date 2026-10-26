import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkManifest, evaluateRelease, verdict, type DispatchRun, type Expected, type Snapshots } from "./plan-release.ts";

// Synthetic payloads shaped like the live plan-manager tools' output for pm-255 (QA capture
// qa-evidence/*.json, 2026-10-26T08:57Z): explain_schedule lists tasks under inputs.tasks, and
// get_plan of the paused part carries no progress. They are fake board evidence: they prove the
// probe's rules, not the live release.
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
        own_runs: [],
        open_escalations: ["esc-389"],
      },
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
  b.schedule.inputs.own_runs = [{ run_id: "run-9001", task_id: "t-1557", role: "software_engineer", status: "running" }];
  b.runs.runs.push(clone(SWE_RUN));
  return b;
}

const evalBoard = (b: Snapshots, expected: Expected = EXPECTED) => evaluateRelease(b, expected);

test("held/paused behind abandoned pm-248: nothing is released, recorded or dispatched", () => {
  const e = evalBoard(heldBoard());
  assert.deepEqual(e.input_errors, []);
  assert.equal(e.hold_released, false);
  assert.deepEqual(e.reasons.hold_released, ["plan_progress_missing", "hold_after_plan", "held_by_predecessor", "progress_waiting"]);
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

// QA run-8812 D6: a present after_plan_id of any type but a non-empty string is not a cleared edge.
test("an unsupported after_plan_id is input error, never a cleared edge (QA D6)", () => {
  for (const value of [248, 0, false, true, {}, { plan_id: "pm-248" }, ["pm-248"], "", "  "]) {
    const b = dispatchedBoard();
    b.plan.plan.after_plan_id = value;
    const e = evalBoard(b);
    assert.deepEqual(e.input_errors, ["plan_after_plan_id_unsupported"], JSON.stringify(value));
    assert.equal(e.hold_released, false);
    assert.equal(e.evidence.after_plan_id, null);
    assert.equal(verdict(e, "dispatched").ok, false);
    assert.equal(verdict(e, "released").ok, false);
  }
  // The documented forms stay supported: absent, null (cleared) and the exact predecessor string.
  for (const value of [undefined, null, "pm-248"]) {
    const b = dispatchedBoard();
    if (value === undefined) delete b.plan.plan.after_plan_id;
    else b.plan.plan.after_plan_id = value;
    const e = evalBoard(b);
    assert.deepEqual(e.input_errors, [], String(value));
    assert.equal(e.evidence.after_plan_id, value ?? null);
    assert.equal(verdict(e, "dispatched").ok, true, String(value));
  }
});

test("unsupported trace_id or execution_started_at values are input errors", () => {
  for (const [field, value, code] of [
    ["trace_id", 42, "plan_trace_id_unsupported"],
    ["trace_id", "", "plan_trace_id_unsupported"],
    ["execution_started_at", 1761469800, "plan_execution_started_at_unsupported"],
    ["execution_started_at", { at: "2026-10-26T09:10:00Z" }, "plan_execution_started_at_unsupported"],
  ] as const) {
    const b = dispatchedBoard();
    b.plan.plan[field] = value;
    const e = evalBoard(b);
    assert.deepEqual(e.input_errors, [code], `${field}=${JSON.stringify(value)}`);
    assert.equal(verdict(e, "dispatched").ok, false);
  }
});

// QA run-8812 D7-D9: malformed reason, holders or holder identities, in either source alone.
const BAD_PROGRESS: [string, Json, string][] = [
  ["object reason (D7)", { state: "live", reason: { after_plan: "pm-248" }, holders: [] }, "progress_reason_unsupported"],
  ["array reason", { state: "live", reason: ["after_plan"], holders: [] }, "progress_reason_unsupported"],
  ["numeric reason", { state: "live", reason: 0, holders: [] }, "progress_reason_unsupported"],
  ["blank reason", { state: "live", reason: "", holders: [] }, "progress_reason_unsupported"],
  ["string holders (D8)", { state: "live", holders: "pm-248" }, "progress_holders_unsupported"],
  ["object holders", { state: "live", holders: { plan_id: "pm-248" } }, "progress_holders_unsupported"],
  ["numeric holder identity (D9)", { state: "live", holders: [{ plan_id: 248 }] }, "progress_holder_unsupported"],
  ["string holder item", { state: "live", holders: ["pm-248"] }, "progress_holder_unsupported"],
  ["null holder item", { state: "live", holders: [null] }, "progress_holder_unsupported"],
  ["holder without plan_id", { state: "live", holders: [{ task_id: "t-1" }] }, "progress_holder_unsupported"],
  ["blank holder plan_id", { state: "live", holders: [{ plan_id: "" }] }, "progress_holder_unsupported"],
  ["numeric holder task_id", { state: "live", holders: [{ plan_id: "pm-248", task_id: 7 }] }, "progress_holder_unsupported"],
  ["string holder paths", { state: "live", holders: [{ plan_id: "pm-248", paths: "lib/" }] }, "progress_holder_unsupported"],
  ["valid holder beside a bad one", { state: "live", holders: [{ plan_id: "pm-249" }, { plan_id: 248 }] }, "progress_holder_unsupported"],
];

test("malformed progress reason, holders or holder identity is input error in each source (QA D7-D9)", () => {
  for (const [name, bad, code] of BAD_PROGRESS) {
    for (const where of ["plan", "schedule"] as const) {
      const b = dispatchedBoard();
      b[where].progress = clone(bad);
      const e = evalBoard(b);
      assert.deepEqual(e.input_errors, [`${where}_${code}`], `${where}: ${name}`);
      assert.equal(e.hold_released, false, `${where}: ${name}`);
      assert.equal(verdict(e, "dispatched").ok, false, `${where}: ${name}`);
      assert.equal(verdict(e, "released").ok, false, `${where}: ${name}`);
    }
    // Both sources malformed at once are each named.
    const both = dispatchedBoard();
    both.plan.progress = clone(bad);
    both.schedule.progress = clone(bad);
    assert.deepEqual(evalBoard(both).input_errors, [`plan_${code}`, `schedule_${code}`], name);
  }
});

test("documented progress forms stay supported: omitted or null reason and holders, full holder objects", () => {
  for (const progress of [
    { state: "live" },
    { state: "live", reason: null, holders: null },
    { state: "live", holders: [] },
    { state: "live", reason: "paths", holders: [{ plan_id: "pm-249", task_id: "t-1", run_id: "run-1", paths: ["lib/a.ts"] }] },
    { state: "live", holders: [{ plan_id: "pm-249", task_id: null, run_id: null, paths: null }] },
  ]) {
    const b = dispatchedBoard();
    b.plan.progress = clone(progress);
    b.schedule.progress = clone(progress);
    const e = evalBoard(b);
    assert.deepEqual(e.input_errors, [], JSON.stringify(progress));
    assert.equal(e.hold_released, true, JSON.stringify(progress));
    assert.equal(verdict(e, "dispatched").ok, true, JSON.stringify(progress));
  }
  // A well-formed holder that is the predecessor still holds the part.
  const b = dispatchedBoard();
  b.plan.progress = b.schedule.progress = { state: "live", holders: [{ plan_id: "pm-248" }] };
  assert.deepEqual(evalBoard(b).reasons.hold_released, ["held_by_predecessor"]);
});

test("progress whose holders differ between get_plan and explain_schedule fails closed", () => {
  const b = dispatchedBoard();
  b.schedule.progress = { state: "live", holders: [{ plan_id: "pm-249" }] };
  const e = evalBoard(b);
  assert.deepEqual(e.input_errors, []);
  assert.deepEqual(e.reasons.hold_released, ["progress_disagrees"]);
  assert.equal(verdict(e, "dispatched").ok, false);
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
    ["task absent from schedule", (b) => b.schedule.inputs.tasks.shift(), EXPECTED, "task_missing_from_schedule"],
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
    // An undocumented top-level task list is not a substitute for inputs.tasks.
    [{ schedule: { ...good.schedule, inputs: undefined, tasks: good.schedule.inputs.tasks } }, "schedule_shape_unsupported"],
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

test("a release receipt without the parent note, or citing other abandon decisions, is not recorded", () => {
  const b = queuedBoard();
  delete b.timeline.entries[0].evidence.parent_note;
  let e = evalBoard(b);
  assert.equal(e.release_recorded, false);
  assert.deepEqual(e.reasons.release_recorded, ["release_note_missing"]);
  assert.equal(verdict(e, "released").ok, false);

  const blank = queuedBoard();
  blank.timeline.entries[0].evidence.parent_note = "   ";
  assert.deepEqual(evalBoard(blank).reasons.release_recorded, ["release_note_missing"]);

  // Without --abandon-decision ids the decision id fields are not required; with them they are.
  const c = queuedBoard();
  delete c.timeline.entries[0].evidence.abandon_decision_id;
  delete c.timeline.entries[0].evidence.note_decision_id;
  assert.equal(evalBoard(c).release_recorded, true);
  // The summary still names dec-55805; prose never stands in for the field.
  e = evalBoard(c, { ...EXPECTED, abandon_decision_ids: ["dec-55805"] });
  assert.deepEqual(e.reasons.release_recorded, ["abandon_decision_ref_missing"]);

  // Exact identity, not substring: dec-558050 contains dec-55805.
  const d = queuedBoard();
  d.timeline.entries[0].evidence.note_decision_id = "dec-558050";
  e = evalBoard(d, { ...EXPECTED, abandon_decision_ids: ["dec-55805", "dec-55807"] });
  assert.deepEqual(e.reasons.release_recorded, ["abandon_decision_ref_mismatch"]);
  assert.equal(evalBoard(queuedBoard(), { ...EXPECTED, abandon_decision_ids: ["dec-55805", "dec-55807"] }).release_recorded, true);
});

test("a release receipt must name the part, the predecessor and its abandoned status by field", () => {
  const cases: [string, (ev: Json) => void, string[]][] = [
    ["part of another plan", (ev) => (ev.plan_id = "pm-248"), ["release_plan_id_mismatch"]],
    ["no part id", (ev) => delete ev.plan_id, ["release_plan_id_missing"]],
    ["other predecessor", (ev) => (ev.predecessor_id = "pm-247"), ["release_predecessor_mismatch"]],
    ["no predecessor", (ev) => delete ev.predecessor_id, ["release_predecessor_missing"]],
    ["predecessor done, not abandoned", (ev) => (ev.predecessor_status = "done"), ["release_predecessor_not_abandoned"]],
    ["no predecessor status", (ev) => delete ev.predecessor_status, ["release_predecessor_not_abandoned"]],
  ];
  for (const [name, mutate, want] of cases) {
    const b = queuedBoard();
    mutate(b.timeline.entries[0].evidence);
    const e = evalBoard(b);
    assert.equal(e.release_recorded, false, name);
    assert.deepEqual(e.reasons.release_recorded, want, name);
  }
  const noId = queuedBoard();
  delete noId.timeline.entries[0].id;
  assert.deepEqual(evalBoard(noId).reasons.release_recorded, ["release_decision_id_missing"]);
  const noEvidence = queuedBoard();
  delete noEvidence.timeline.entries[0].evidence;
  assert.deepEqual(evalBoard(noEvidence).reasons.release_recorded, ["release_evidence_missing"]);
});

test("only the structured release kind counts: orphan lines, slow verdicts and negated prose do not", () => {
  const f = queuedBoard();
  f.timeline.entries[0].kind = "after_plan_orphaned";
  assert.deepEqual(evalBoard(f).reasons.release_recorded, ["release_decision_missing"]);

  // QA D3a: a negated, prospective decision of another kind with an unrelated note.
  const n = queuedBoard();
  Object.assign(n.timeline.entries[0], {
    kind: "other",
    summary: "Do not release pm-255: pm-248 was abandoned; release has NOT occurred.",
    evidence: { plan_id: "pm-255", note: "Review this proposal tomorrow." },
  });
  let e = evalBoard(n);
  assert.equal(e.release_recorded, false);
  assert.deepEqual(e.reasons.release_recorded, ["release_decision_missing"]);
  assert.equal(verdict(e, "released").ok, false);

  // QA D3b: a foreign release receipt without the part's id, next to one local-trace entry.
  const g = queuedBoard();
  g.timeline.entries[0].trace_id = "foreign-trace";
  delete g.timeline.entries[0].evidence.plan_id;
  e = evalBoard(g);
  assert.deepEqual(e.input_errors, []);
  assert.equal(e.release_recorded, false);
  assert.deepEqual(e.reasons.release_recorded, ["release_plan_id_missing"]);
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

test("inherited Object keys and unknown statuses are not run outcomes", () => {
  for (const status of ["constructor", "toString", "__proto__", "hasOwnProperty", "queued", ""]) {
    const b = dispatchedBoard();
    b.runs.runs[0].status = status;
    const e = evalBoard(b);
    assert.equal(e.dispatch_proven, false, status);
    assert.deepEqual(e.evidence.dispatch_runs, [], status);
    assert.deepEqual(e.evidence.ignored_runs, [{ run_id: "run-9001", why: "status_unsupported", status }], status);
    assert.deepEqual(e.reasons.dispatch_proven, ["swe_run_status_unsupported"], status);
    assert.equal(verdict(e, "dispatched").ok, false, status);
  }
  const odd = dispatchedBoard();
  odd.runs.runs[0].status = { running: true };
  assert.equal(evalBoard(odd).dispatch_proven, false);
});

test("accepted runs carry exactly submitted, running or finished", () => {
  for (const [status, outcome] of [["pending", "submitted"], ["running", "running"], ["succeeded", "finished"], ["failed", "finished"]]) {
    const b = dispatchedBoard();
    b.runs.runs[0].status = status;
    assert.equal(evalBoard(b).evidence.dispatch_runs[0].outcome, outcome);
  }
});

test("a matching SWE run without its own source id is not dispatch evidence", () => {
  for (const id of [undefined, "", "  ", 9001]) {
    const b = dispatchedBoard();
    if (id === undefined) delete b.runs.runs[0].id;
    else b.runs.runs[0].id = id;
    const e = evalBoard(b);
    assert.equal(e.dispatch_proven, false, String(id));
    assert.deepEqual(e.evidence.ignored_runs, [{ run_id: null, why: "run_id_missing" }]);
    assert.deepEqual(e.reasons.dispatch_proven, ["swe_run_id_missing"]);
    assert.ok(!JSON.stringify(e).includes('"?"'));
  }
  // A second, identified run still proves dispatch, under its own id.
  const b = dispatchedBoard();
  delete b.runs.runs[0].id;
  b.runs.runs.push({ ...SWE_RUN, id: "run-9005", status: "failed" });
  const e = evalBoard(b);
  assert.equal(e.dispatch_proven, true);
  assert.deepEqual(e.evidence.dispatch_runs.map((r: DispatchRun) => r.run_id), ["run-9005"]);
  assert.deepEqual(e.evidence.failed_attempts, ["run-9005"]);
});

test("payloads that declare themselves partial are unsupported input", () => {
  const b = dispatchedBoard();
  Object.assign(b.runs, { complete: false, has_more: true, next_cursor: "unread" });
  let e = evalBoard(b);
  assert.deepEqual(e.input_errors, ["runs_incomplete", "runs_has_more"]);
  assert.equal(e.dispatch_proven, false);
  assert.equal(verdict(e, "dispatched").ok, false);

  const t = dispatchedBoard();
  t.timeline.truncated = true;
  assert.deepEqual(evalBoard(t).input_errors, ["timeline_truncated"]);

  // Explicit completeness markers that say "complete" are accepted; get_timeline's cursor is not a marker.
  const ok = dispatchedBoard();
  Object.assign(ok.runs, { complete: true, has_more: false, next_cursor: null });
  e = evalBoard(ok);
  assert.deepEqual(e.input_errors, []);
  assert.equal(verdict(e, "dispatched").ok, true);
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

// Snapshot files plus a manifest that verifies them: the only input on which the CLI may exit 0.
function verified(dir: string, board: Record<string, unknown>) {
  const { files, digests } = write(dir, board);
  const m = join(dir, "manifest.json");
  writeFileSync(m, JSON.stringify(manifestFor(digests)));
  return { files, manifest: ["--manifest", m] };
}

test("CLI: queued/startable board passes --require released and fails the default dispatched mode", () => {
  withDir((dir) => {
    const { files, manifest } = verified(dir, queuedBoard());
    const released = runCli(files, [...IDS, "--require", "released", ...manifest]);
    assert.equal(released.code, 0, JSON.stringify(released.body));
    assert.equal(released.body.manifest.completeness, "verified");
    const dispatched = runCli(files, [...IDS, ...manifest]);
    assert.equal(dispatched.code, 1);
    assert.equal(dispatched.body.mode, "dispatched");
    assert.deepEqual(dispatched.body.unmet, ["execution_started", "dispatch_proven"]);
  });
});

test("CLI: without a manifest the evaluation is diagnostic only and never exits 0", () => {
  withDir((dir) => {
    const { files } = write(dir, queuedBoard());
    const released = runCli(files, [...IDS, "--require", "released"]);
    assert.equal(released.code, 1);
    assert.equal(released.body.ok, false);
    assert.equal(released.body.manifest.completeness, "unverified");
    assert.deepEqual(released.body.unmet, ["completeness_verified"]);
    // The checks themselves are still reported for diagnosis.
    assert.equal(released.body.hold_released, true);

    const d = runCli(write(dir, dispatchedBoard()).files, IDS);
    assert.equal(d.code, 1);
    assert.deepEqual(d.body.unmet, ["completeness_verified"]);
  });
});

test("CLI: a runs payload declaring itself partial exits 2 with or without a manifest (QA D5)", () => {
  withDir((dir) => {
    const b = dispatchedBoard();
    Object.assign(b.runs, { complete: false, has_more: true, next_cursor: "unread" });
    const bare = runCli(write(dir, b).files, IDS);
    assert.equal(bare.code, 2);
    assert.deepEqual(bare.body.input_errors, ["runs_incomplete", "runs_has_more"]);
    const { files, manifest } = verified(dir, b);
    const withManifest = runCli(files, [...IDS, ...manifest]);
    assert.equal(withManifest.code, 2);
    assert.equal(withManifest.body.ok, false);
  });
});

test("CLI: held board, scheduled-only run and failed attempt exit 1 or 0 as the evidence says", () => {
  withDir((dir) => {
    const h = verified(dir, heldBoard());
    const held = runCli(h.files, [...IDS, "--require", "released", ...h.manifest]);
    assert.equal(held.code, 1);
    assert.ok(held.body.reasons.hold_released.includes("hold_after_plan"));

    const sched = dispatchedBoard();
    sched.runs.runs[0] = { ...SWE_RUN, status: "scheduled", tm_task_id: "" };
    const sv = verified(dir, sched);
    const s = runCli(sv.files, [...IDS, ...sv.manifest]);
    assert.equal(s.code, 1);
    assert.deepEqual(s.body.reasons.dispatch_proven, ["swe_run_scheduled_only"]);

    const failed = dispatchedBoard();
    failed.runs.runs[0].status = "failed";
    const fv = verified(dir, failed);
    const f = runCli(fv.files, [...IDS, ...fv.manifest]);
    assert.equal(f.code, 0);
    assert.deepEqual(f.body.evidence.dispatch_runs, [
      { run_id: "run-9001", tm_task_id: SWE_RUN.tm_task_id, status: "failed", outcome: "finished", failed: true },
    ]);
    assert.deepEqual(f.body.evidence.failed_attempts, ["run-9001"]);
    assert.equal(f.body.delivery_proven, false);
  });
});

test("CLI: inherited-key statuses and a missing run id exit 1 with no dispatch outcome (QA D2, D4)", () => {
  withDir((dir) => {
    for (const status of ["constructor", "toString", "__proto__"]) {
      const b = dispatchedBoard();
      b.runs.runs[0].status = status;
      const v = verified(dir, b);
      const r = runCli(v.files, [...IDS, ...v.manifest]);
      assert.equal(r.code, 1, status);
      assert.equal(r.body.dispatch_proven, false, status);
      assert.deepEqual(r.body.evidence.dispatch_runs, [], status);
      assert.deepEqual(r.body.reasons.dispatch_proven, ["swe_run_status_unsupported"], status);
    }
    const b = dispatchedBoard();
    delete b.runs.runs[0].id;
    const v = verified(dir, b);
    const r = runCli(v.files, [...IDS, ...v.manifest]);
    assert.equal(r.code, 1);
    assert.deepEqual(r.body.reasons.dispatch_proven, ["swe_run_id_missing"]);
    assert.deepEqual(r.body.evidence.dispatch_runs, []);
  });
});

test("CLI: negated prose and a foreign release receipt exit 1 with release unrecorded (QA D3)", () => {
  withDir((dir) => {
    const n = dispatchedBoard();
    Object.assign(n.timeline.entries[0], {
      kind: "other",
      summary: "Do not release pm-255: pm-248 was abandoned; release has NOT occurred.",
      evidence: { plan_id: "pm-255", note: "Review this proposal tomorrow." },
    });
    const nv = verified(dir, n);
    const a = runCli(nv.files, [...IDS, ...nv.manifest]);
    assert.equal(a.code, 1);
    assert.deepEqual(a.body.reasons.release_recorded, ["release_decision_missing"]);

    const g = dispatchedBoard();
    g.timeline.entries[0].trace_id = "foreign-trace";
    delete g.timeline.entries[0].evidence.plan_id;
    const gv = verified(dir, g);
    const b = runCli(gv.files, [...IDS, ...gv.manifest]);
    assert.equal(b.code, 1);
    assert.deepEqual(b.body.reasons.release_recorded, ["release_plan_id_missing"]);
  });
});

// QA's independently captured live snapshots (run-8800, 08:57Z) with their manifest, unmodified.
// pm-255 was still held, so this is a negative result: exit 1 in both modes, never exit 2.
const LIVE = join(ROOT, "projects/fix-for-slow-plan-pm-255-task-duration-spell-slow-pm-255-tas/qa-evidence");

test("CLI: the unmodified live held snapshot set is decoded and reports the hold (QA D1)", () => {
  const files = Object.fromEntries(["plan", "schedule", "timeline", "runs"].map((k) => [k, join(LIVE, `${k}.json`)]));
  const extra = [...IDS, "--abandon-decision", "dec-55805,dec-55807", "--manifest", join(LIVE, "manifest.json")];
  for (const mode of ["released", "dispatched"]) {
    const { code, body } = runCli(files, [...extra, "--require", mode]);
    assert.equal(code, 1, `${mode}: ${JSON.stringify(body.input_errors)}`);
    assert.deepEqual(body.input_errors, []);
    assert.equal(body.manifest.completeness, "verified");
    assert.deepEqual(body.reasons.hold_released, ["plan_progress_missing", "hold_after_plan", "held_by_predecessor", "progress_waiting"]);
    assert.equal(body.hold_released, false);
    assert.equal(body.queued_startable, false);
    assert.equal(body.execution_started, false);
    assert.deepEqual(body.reasons.release_recorded, ["release_decision_missing"]);
    // run-8771 is the investigator, not a t-1557 dispatch.
    assert.deepEqual(body.reasons.dispatch_proven, ["swe_run_missing"]);
    assert.equal(body.delivery_proven, false);
  }
});

// QA's second live capture (run-8812, 09:18Z): pm-255 queued, both reads carry waiting/after_plan.
const LIVE_8812 = join(ROOT, "projects/fix-for-slow-plan-pm-255-task-duration-spell-slow-pm-255-tas/qa-evidence-run-8812");

test("CLI: the unmodified run-8812 live capture, with progress in both reads, still exits 1 on the hold", () => {
  const files = Object.fromEntries(["plan", "schedule", "timeline", "runs"].map((k) => [k, join(LIVE_8812, `${k}.json`)]));
  const extra = [...IDS, "--abandon-decision", "dec-55805,dec-55807", "--manifest", join(LIVE_8812, "manifest.json")];
  for (const mode of ["released", "dispatched"]) {
    const { code, body } = runCli(files, [...extra, "--require", mode]);
    assert.equal(code, 1, `${mode}: ${JSON.stringify(body.input_errors)}`);
    assert.deepEqual(body.input_errors, []);
    assert.equal(body.manifest.completeness, "verified");
    assert.equal(body.evidence.plan_status, "queued");
    assert.deepEqual(body.reasons.hold_released, ["hold_after_plan", "held_by_predecessor", "progress_waiting"]);
    assert.equal(body.queued_startable, false);
    assert.deepEqual(body.reasons.release_recorded, ["release_decision_missing"]);
    assert.deepEqual(body.reasons.dispatch_proven, ["swe_run_missing"]);
    assert.equal(body.delivery_proven, false);
  }
});

// QA's third live capture (run-8833, 10:13Z), the historical hold negative named by plan.md
// revision 3: unmodified it exits 1; a copy edited without rehashing is tampered evidence, exit 2.
const LIVE_8833 = join(ROOT, "projects/fix-for-slow-plan-pm-255-task-duration-spell-slow-pm-255-tas/qa-evidence-run-8833");
const LIVE_8833_FILES = Object.fromEntries(["plan", "schedule", "timeline", "runs"].map((k) => [k, join(LIVE_8833, `${k}.json`)]));
const LIVE_8833_ARGS = [...IDS, "--abandon-decision", "dec-55805,dec-55807", "--manifest", join(LIVE_8833, "manifest.json")];

test("CLI: the unmodified run-8833 live capture is held evidence and exits 1 in both modes", () => {
  for (const mode of ["released", "dispatched"]) {
    const { code, body } = runCli(LIVE_8833_FILES, [...LIVE_8833_ARGS, "--require", mode]);
    assert.equal(code, 1, `${mode}: ${JSON.stringify(body.input_errors)}`);
    assert.equal(body.ok, false);
    assert.deepEqual(body.input_errors, []);
    assert.equal(body.manifest.completeness, "verified");
    assert.equal(body.evidence.plan_status, "queued");
    assert.deepEqual(body.reasons.hold_released, ["hold_after_plan", "held_by_predecessor", "progress_waiting"]);
    assert.deepEqual(body.reasons.queued_startable, ["progress_not_startable"]);
    assert.deepEqual(body.reasons.execution_started, ["execution_started_at_missing", "plan_status_not_executing"]);
    assert.deepEqual(body.reasons.release_recorded, ["release_decision_missing"]);
    assert.deepEqual(body.reasons.dispatch_proven, ["swe_run_missing"]);
    assert.equal(body.dispatch_proven, false);
    assert.equal(body.delivery_proven, false);
  }
});

test("CLI: a run-8833 copy changed without rehashing is tampered evidence and exits 2", () => {
  withDir((dir) => {
    const plan = JSON.parse(readFileSync(LIVE_8833_FILES.plan, "utf8"));
    plan.plan.status = "executing";
    plan.plan.execution_started_at = "2026-10-26T10:30:00Z";
    const files = { ...LIVE_8833_FILES, plan: join(dir, "plan.json") };
    writeFileSync(files.plan, JSON.stringify(plan));
    for (const mode of ["released", "dispatched"]) {
      const { code, body } = runCli(files, [...LIVE_8833_ARGS, "--require", mode]);
      assert.equal(code, 2, `${mode}: ${JSON.stringify(body.input_errors)}`);
      assert.equal(body.ok, false);
      assert.ok(body.input_errors.includes("manifest_plan_sha256_mismatch"), JSON.stringify(body.input_errors));
      assert.equal(body.manifest.completeness, "failed");
      assert.equal(body.delivery_proven, false);
    }
  });
});

// The 20 independent QA controls, run as the real subprocess the verification command runs.
const ADVERSARIAL = join(ROOT, "projects/fix-for-slow-plan-pm-255-task-duration-spell-slow-pm-255-tas/qa-adversarial.mjs");
const CONTROLS: Record<string, number> = {
  "valid-baseline": 0,
  "held-negative-control": 1,
  "scheduled-negative-control": 1,
  "unknown-status-constructor": 1,
  "unrelated-negative-release-note": 1,
  "foreign-release-with-one-local-trace": 1,
  "missing-source-run-id": 1,
  "explicit-incomplete-without-manifest": 2,
  "missing-progress": 1,
  "wrong-task": 1,
  "wrong-plan": 2,
  "missing-parent-note": 1,
  "valid-without-manifest": 1,
  "failed-attempt-is-dispatch-only": 0,
  "queued-startable-release": 0,
  "queued-is-not-dispatch": 1,
  "unsupported-predecessor-type": 2,
  "unsupported-progress-reason": 2,
  "unsupported-progress-holders": 2,
  "unsupported-holder-identity": 2,
};

test("the 20 adversarial controls all run and meet their contract through the real CLI", () => {
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", ADVERSARIAL],
    { cwd: ROOT, encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } },
  );
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.synthetic, true);
  assert.equal(out.count, 20);
  assert.equal(out.complete, true);
  const byName = Object.fromEntries(out.results.map((c: Json) => [c.name, c]));
  assert.deepEqual(Object.keys(byName).sort(), Object.keys(CONTROLS).sort());
  for (const [name, exit] of Object.entries(CONTROLS)) {
    const c = byName[name];
    assert.equal(c.actual_exit, exit, `${name}: ${JSON.stringify(c.input_errors)}`);
    assert.equal(c.contract_met, true, name);
    assert.equal(c.delivery_proven, false, name);
    assert.equal(c.ok, exit === 0, name);
    if (exit === 2) assert.ok(c.input_errors.length > 0, name);
  }
  // Held evidence fails on the hold itself, not on some unrelated input.
  assert.deepEqual(byName["held-negative-control"].reasons.hold_released, ["hold_after_plan", "held_by_predecessor", "progress_waiting"]);
  // Scheduled-only submission never proves dispatch.
  assert.equal(byName["scheduled-negative-control"].dispatch_proven, false);
  assert.ok(byName["scheduled-negative-control"].reasons.dispatch_proven.includes("swe_run_scheduled_only"));
  // A failed submitted run proves dispatch only; delivery stays unproven.
  const failed = byName["failed-attempt-is-dispatch-only"];
  assert.equal(failed.dispatch_proven, true);
  assert.deepEqual(failed.dispatch_runs.map((d: Json) => [d.run_id, d.outcome]), [["qa-swe", "finished"]]);
  // A queued/startable release is a release, never a dispatch.
  assert.equal(byName["queued-startable-release"].mode, "released");
  assert.equal(byName["queued-is-not-dispatch"].dispatch_proven, false);
});

test("npm test and typecheck cover the evaluator, CLI tests and adversarial controls", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.match(pkg.scripts.test, /--test '?lib\/\*\*\/\*\.test\.ts'?/);
  assert.equal(pkg.scripts.typecheck, "next typegen && tsc --noEmit");
  const tsconfig = JSON.parse(readFileSync(join(ROOT, "tsconfig.json"), "utf8"));
  assert.equal(tsconfig.compilerOptions.strict, true);
  assert.ok(tsconfig.include.includes("**/*.ts"));
  assert.deepEqual(tsconfig.exclude, ["node_modules"]);
  for (const f of ["lib/plan-release.ts", "lib/plan-release.test.ts"]) {
    assert.doesNotMatch(readFileSync(join(ROOT, f), "utf8"), /@ts-(nocheck|ignore|expect-error)/, f);
  }
  assert.doesNotMatch(readFileSync(fileURLToPath(import.meta.url), "utf8"), new RegExp(["test", "skip"].join("\\.") + "|\\{ ?skip|\\.only\\("));
});

test("CLI: malformed predecessor or progress evidence exits 2 under a verified manifest (QA D6-D9)", () => {
  withDir((dir) => {
    // Baselines first: the same boards, unmutated, pass.
    const base = verified(dir, dispatchedBoard());
    assert.equal(runCli(base.files, [...IDS, ...base.manifest]).code, 0);
    const q = verified(dir, queuedBoard());
    assert.equal(runCli(q.files, [...IDS, "--require", "released", ...q.manifest]).code, 0);

    const cases: [string, (b: Json) => void, string[]][] = [
      ["D6 numeric predecessor", (b) => (b.plan.plan.after_plan_id = 248), ["plan_after_plan_id_unsupported"]],
    ];
    for (const [name, bad, code] of BAD_PROGRESS) {
      if (!/D[789]/.test(name)) continue;
      cases.push([`${name} in get_plan`, (b) => (b.plan.progress = clone(bad)), [`plan_${code}`]]);
      cases.push([`${name} in explain_schedule`, (b) => (b.schedule.progress = clone(bad)), [`schedule_${code}`]]);
    }
    for (const [name, mutate, errors] of cases) {
      for (const [board, mode] of [[dispatchedBoard(), "dispatched"], [queuedBoard(), "released"]] as const) {
        mutate(board);
        const v = verified(dir, board);
        const r = runCli(v.files, [...IDS, "--require", mode, ...v.manifest]);
        assert.equal(r.code, 2, `${name} (${mode}): ${JSON.stringify(r.body)}`);
        assert.equal(r.body.ok, false);
        assert.equal(r.body.manifest.completeness, "verified");
        assert.deepEqual(r.body.input_errors, errors, name);
        assert.equal(r.body.hold_released, false, name);
        assert.equal(r.body.delivery_proven, false);
      }
    }
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
    // Early exits still state that delivery is unproven.
    for (const early of [noRuns, runCli(files, [...IDS, "--live"]), runCli({ ...files, plan: join(dir, "absent.json") }, IDS)]) {
      assert.equal(early.code, 2);
      assert.equal(early.body.delivery_proven, false);
    }
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
