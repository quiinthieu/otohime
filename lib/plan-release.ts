// Offline evidence for a split part's release from its after_plan predecessor (pm-260/t-1578).
// Reads decoded plan_manager_get_plan, explain_schedule, get_timeline and list_runs payloads and
// says, check by check, whether the part has left the hold, sits queued/startable, has started
// executing, carries the predecessor's abandonment note, and has a durable software_engineer
// dispatch for its task. Pure: no clock, no network, no board writes. A dispatch is never delivery.

export type Expected = {
  plan_id: string;
  predecessor_id: string;
  task_id: string;
  // Decision ids of the predecessor's abandonment (e.g. dec-55805, dec-55807). When given, every
  // decision id the release receipt cites must be one of them, compared field by field.
  abandon_decision_ids?: string[];
};

export type Snapshots = { plan: unknown; schedule: unknown; timeline: unknown; runs: unknown };

export const CHECKS = [
  "hold_released",
  "queued_startable",
  "execution_started",
  "release_recorded",
  "dispatch_proven",
] as const;
export type Check = (typeof CHECKS)[number];

export type DispatchRun = {
  run_id: string;
  tm_task_id: string;
  status: string;
  outcome: "submitted" | "running" | "finished";
  failed: boolean;
};

export type Evaluation = {
  expected: Expected;
  input_errors: string[];
  hold_released: boolean;
  queued_startable: boolean;
  execution_started: boolean;
  release_recorded: boolean;
  dispatch_proven: boolean;
  // A dispatch shows a SWE job was submitted, never that t-1557's output shipped.
  delivery_proven: false;
  reasons: Record<Check, string[]>;
  evidence: {
    plan_status: string | null;
    after_plan_id: string | null;
    execution_started_at: string | null;
    progress: { state: string; reason: string | null; holders: string[] } | null;
    release_decision_id: string | null;
    dispatch_runs: DispatchRun[];
    failed_attempts: string[];
    ignored_runs: { run_id: string | null; why: string; status?: string }[];
  };
};

export const PROGRESS_STATES = ["live", "startable", "finishing_only", "waiting"] as const;
export const RELEASED_STATES = ["live", "startable", "finishing_only"];
export const EXECUTING_STATUSES = ["executing", "finishing", "done"];
// Run statuses after task-manager accepted the job. "scheduled" is the board's own pre-submission
// state; every other status, known or not, is not a dispatch. A Map, so inherited Object keys
// such as "constructor" or "__proto__" never resolve to an outcome.
const RUN_OUTCOME = new Map<string, DispatchRun["outcome"]>([
  ["pending", "submitted"],
  ["running", "running"],
  ["succeeded", "finished"],
  ["failed", "finished"],
]);
const NON_DISPATCH_STATUSES = ["scheduled", "cancelled", "superseded"];

// The only release receipt shape this probe accepts: the administrative repair's decision as the
// pm-260 playbook specifies it (plan.md, "Immediate pm-255 recovery playbook", step 3). Every field
// is checked by identity; summary and reason prose is never read. Any other kind is not a release.
export const RELEASE_KINDS = ["after_plan_released"];
const DECISION_ID_FIELDS = ["abandon_decision_id", "note_decision_id"] as const;

// Envelope markers that declare a payload partial. Their presence fails the input; they are never
// silently ignored. (get_timeline's own `cursor` names its oldest entry and is not a marker.)
function envelopeErrors(name: string, doc: Obj): string[] {
  const errs: string[] = [];
  if ("complete" in doc && doc.complete !== true) errs.push(`${name}_incomplete`);
  if ("has_more" in doc && doc.has_more !== false) errs.push(`${name}_has_more`);
  if ("truncated" in doc && doc.truncated !== false) errs.push(`${name}_truncated`);
  if ("next_cursor" in doc && doc.next_cursor !== null && doc.next_cursor !== "") errs.push(`${name}_has_more`);
  return [...new Set(errs)];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

function readProgress(v: unknown, where: string, errs: string[]) {
  if (v === undefined || v === null) return null;
  if (!isObj(v) || typeof v.state !== "string") {
    errs.push(`${where}_progress_unsupported`);
    return null;
  }
  if (!(PROGRESS_STATES as readonly string[]).includes(v.state)) {
    errs.push(`${where}_progress_state_unrecognized`);
    return null;
  }
  const holders = Array.isArray(v.holders)
    ? v.holders.map((h) => (isObj(h) ? str(h.plan_id) : null)).filter((h): h is string => h !== null)
    : [];
  return { state: v.state, reason: str(v.reason), holders };
}

// What a release receipt still lacks; empty means it is one.
function releaseGaps(ev: Obj | null, expected: Expected, refs: string[]): string[] {
  if (!ev) return ["release_evidence_missing"];
  const gaps: string[] = [];
  if (str(ev.plan_id) === null) gaps.push("release_plan_id_missing");
  else if (ev.plan_id !== expected.plan_id) gaps.push("release_plan_id_mismatch");
  if (str(ev.predecessor_id) === null) gaps.push("release_predecessor_missing");
  else if (ev.predecessor_id !== expected.predecessor_id) gaps.push("release_predecessor_mismatch");
  if (ev.predecessor_status !== "abandoned") gaps.push("release_predecessor_not_abandoned");
  if (str(ev.parent_note) === null) gaps.push("release_note_missing");
  if (refs.length) {
    const cited = DECISION_ID_FIELDS.filter((f) => ev[f] !== undefined && ev[f] !== null);
    if (cited.length === 0) gaps.push("abandon_decision_ref_missing");
    else if (cited.some((f) => typeof ev[f] !== "string" || !refs.includes(ev[f] as string))) {
      gaps.push("abandon_decision_ref_mismatch");
    }
  }
  return gaps;
}

export function evaluateRelease(snap: Snapshots, expected: Expected): Evaluation {
  const errs: string[] = [];
  const reasons = Object.fromEntries(CHECKS.map((c) => [c, [] as string[]])) as Record<Check, string[]>;
  const result: Evaluation = {
    expected,
    input_errors: errs,
    hold_released: false,
    queued_startable: false,
    execution_started: false,
    release_recorded: false,
    dispatch_proven: false,
    delivery_proven: false,
    reasons,
    evidence: {
      plan_status: null,
      after_plan_id: null,
      execution_started_at: null,
      progress: null,
      release_decision_id: null,
      dispatch_runs: [],
      failed_attempts: [],
      ignored_runs: [],
    },
  };
  for (const k of ["plan_id", "predecessor_id", "task_id"] as const) {
    if (str(expected[k]) === null) errs.push(`expected_${k}_missing`);
  }

  // Shapes: every payload must be the tool's own top-level object. explain_schedule lists the
  // plan's tasks under inputs.tasks; there is no top-level task list.
  const planDoc = snap.plan;
  const plan = isObj(planDoc) && isObj(planDoc.plan) ? planDoc.plan : null;
  if (!plan || !isObj(planDoc) || !Array.isArray(planDoc.tasks)) errs.push("plan_shape_unsupported");
  const sched = isObj(snap.schedule) && typeof snap.schedule.plan_id === "string" ? snap.schedule : null;
  const schedTasks = sched && isObj(sched.inputs) && Array.isArray(sched.inputs.tasks) ? sched.inputs.tasks : null;
  if (!schedTasks) errs.push("schedule_shape_unsupported");
  const entries = isObj(snap.timeline) && Array.isArray(snap.timeline.entries) ? snap.timeline.entries : null;
  if (!entries) errs.push("timeline_shape_unsupported");
  else if (entries.length === 0) errs.push("timeline_empty");
  const runs = isObj(snap.runs) && Array.isArray(snap.runs.runs) ? snap.runs.runs : null;
  if (!runs) errs.push("runs_shape_unsupported");
  for (const k of ["plan", "schedule", "timeline", "runs"] as const) {
    const doc = snap[k];
    if (isObj(doc)) errs.push(...envelopeErrors(k, doc));
  }
  if (errs.length || !plan || !isObj(planDoc) || !sched || !schedTasks || !entries || !runs) return finish(result);

  // Identity: all four snapshots describe the expected part and task.
  if (plan.id !== expected.plan_id) errs.push("plan_id_mismatch");
  if (sched.plan_id !== expected.plan_id) errs.push("schedule_plan_id_mismatch");
  const after = plan.after_plan_id === undefined || plan.after_plan_id === null ? null : str(plan.after_plan_id);
  if (after !== null && after !== expected.predecessor_id) errs.push("predecessor_mismatch");
  const tasks = planDoc.tasks as unknown[];
  if (!tasks.some((t) => isObj(t) && t.id === expected.task_id && t.plan_id === expected.plan_id)) {
    errs.push("task_missing_from_plan");
  }
  if (!schedTasks.some((t) => isObj(t) && t.task_id === expected.task_id)) {
    errs.push("task_missing_from_schedule");
  }
  // Timeline entries carry no plan_id; the plan's trace_id on its own decisions ties the snapshot
  // to it. This only identifies the snapshot: a release receipt must name the part itself.
  const trace = str(plan.trace_id);
  if (trace !== null && !entries.some((e) => isObj(e) && e.trace_id === trace)) errs.push("timeline_plan_mismatch");
  if (runs.some((r) => !isObj(r) || r.plan_id !== expected.plan_id)) errs.push("runs_plan_mismatch");
  const status = str(plan.status);
  if (status === null) errs.push("plan_status_missing");
  if (sched.status !== undefined && sched.status !== status) errs.push("schedule_status_disagrees");
  if (errs.length) return finish(result);

  result.evidence.plan_status = status;
  result.evidence.after_plan_id = after;
  const started = str(plan.execution_started_at);
  result.evidence.execution_started_at = started;

  // Progress: both reads must carry it and agree; absent progress is not a release.
  const pPlan = readProgress(planDoc.progress, "plan", errs);
  const pSched = readProgress(sched.progress, "schedule", errs);
  if (errs.length) return finish(result);
  if (!pPlan) reasons.hold_released.push("plan_progress_missing");
  if (!pSched) reasons.hold_released.push("schedule_progress_missing");
  if (pPlan && pSched && (pPlan.state !== pSched.state || pPlan.reason !== pSched.reason)) {
    reasons.hold_released.push("progress_disagrees");
  }
  const progress = pSched ?? pPlan;
  result.evidence.progress = progress;
  for (const p of [pPlan, pSched]) {
    if (!p) continue;
    if (p.reason === "after_plan") reasons.hold_released.push("hold_after_plan");
    if (p.holders.includes(expected.predecessor_id)) reasons.hold_released.push("held_by_predecessor");
    if (!RELEASED_STATES.includes(p.state)) reasons.hold_released.push(`progress_${p.state}`);
  }
  reasons.hold_released = [...new Set(reasons.hold_released)];
  result.hold_released = reasons.hold_released.length === 0;

  if (status !== "queued") reasons.queued_startable.push("plan_not_queued");
  if (progress?.state !== "startable") reasons.queued_startable.push("progress_not_startable");
  result.queued_startable = reasons.queued_startable.length === 0;

  if (started === null) reasons.execution_started.push("execution_started_at_missing");
  else if (Number.isNaN(Date.parse(started))) reasons.execution_started.push("execution_started_at_invalid");
  if (!EXECUTING_STATUSES.includes(status ?? "")) reasons.execution_started.push("plan_status_not_executing");
  result.execution_started = reasons.execution_started.length === 0;

  // The part's timeline must carry a structured release receipt naming the part, the abandoned
  // predecessor and its note. The closest incomplete receipt explains the miss.
  const refs = (expected.abandon_decision_ids ?? []).filter((id) => str(id) !== null);
  let best: string[] | null = null;
  for (const e of entries) {
    if (!isObj(e) || e.type !== "decision" || typeof e.kind !== "string" || !RELEASE_KINDS.includes(e.kind)) continue;
    const gaps = str(e.id) === null ? ["release_decision_id_missing"] : [];
    gaps.push(...releaseGaps(isObj(e.evidence) ? e.evidence : null, expected, refs));
    if (gaps.length === 0) {
      result.release_recorded = true;
      result.evidence.release_decision_id = e.id as string;
      break;
    }
    if (!best || gaps.length < best.length) best = gaps;
  }
  if (!result.release_recorded) reasons.release_recorded.push(...(best ?? ["release_decision_missing"]));

  // Dispatch: a software_engineer run for the task, with its own source id, that task-manager
  // accepted (durable tm_task_id).
  for (const r of runs as Obj[]) {
    if (r.task_id !== expected.task_id) continue;
    const id = str(r.id);
    const ignore = (why: string, extra: { status?: string } = {}) =>
      result.evidence.ignored_runs.push({ run_id: id, why, ...extra });
    if (r.role !== "software_engineer") {
      ignore(`role_${String(r.role)}`);
      continue;
    }
    if (id === null) {
      ignore("run_id_missing");
      continue;
    }
    const st = typeof r.status === "string" ? r.status : "";
    const outcome = RUN_OUTCOME.get(st);
    if (!outcome) {
      if (NON_DISPATCH_STATUSES.includes(st)) ignore(`status_${st}`);
      else ignore("status_unsupported", { status: String(r.status) });
      continue;
    }
    const tm = str(r.tm_task_id);
    if (tm === null) {
      ignore("tm_task_id_missing");
      continue;
    }
    result.evidence.dispatch_runs.push({ run_id: id, tm_task_id: tm, status: st, outcome, failed: st === "failed" });
    if (st === "failed") result.evidence.failed_attempts.push(id);
  }
  result.dispatch_proven = result.evidence.dispatch_runs.length > 0;
  if (!result.dispatch_proven) {
    const why = result.evidence.ignored_runs.map((r) => r.why);
    reasons.dispatch_proven.push(
      why.includes("status_scheduled")
        ? "swe_run_scheduled_only"
        : why.includes("run_id_missing")
          ? "swe_run_id_missing"
          : why.includes("status_unsupported")
            ? "swe_run_status_unsupported"
            : why.length
              ? "swe_run_not_submitted"
              : "swe_run_missing",
    );
  }
  return result;
}

function finish(result: Evaluation): Evaluation {
  for (const c of CHECKS) result.reasons[c].push("input_unsupported");
  return result;
}

export type Mode = "released" | "dispatched";
export const MODES: Mode[] = ["released", "dispatched"];

export type Verdict = { ok: boolean; mode: Mode; unmet: string[] };

// released: off the hold, release noted, and either queued/startable or executing.
// dispatched: released plus started execution and a durable SWE dispatch for the task.
export function verdict(e: Evaluation, mode: Mode): Verdict {
  const unmet: string[] = [];
  if (e.input_errors.length) unmet.push("input_supported");
  if (!e.hold_released) unmet.push("hold_released");
  if (!e.release_recorded) unmet.push("release_recorded");
  if (mode === "released" && !e.queued_startable && !e.execution_started) unmet.push("queued_startable|execution_started");
  if (mode === "dispatched") {
    if (!e.execution_started) unmet.push("execution_started");
    if (!e.dispatch_proven) unmet.push("dispatch_proven");
  }
  return { ok: unmet.length === 0, mode, unmet };
}

// Completeness metadata kept beside the raw payloads, never inside them.
export const SNAPSHOT_TOOLS: Record<keyof Snapshots, string> = {
  plan: "plan_manager_get_plan",
  schedule: "plan_manager_explain_schedule",
  timeline: "plan_manager_get_timeline",
  runs: "plan_manager_list_runs",
};

export function checkManifest(manifest: unknown, digests: Record<keyof Snapshots, string>, planId: string): string[] {
  const errs: string[] = [];
  if (!isObj(manifest) || !isObj(manifest.snapshots)) return ["manifest_shape_unsupported"];
  if (str(manifest.captured_at) === null || Number.isNaN(Date.parse(String(manifest.captured_at)))) {
    errs.push("manifest_captured_at_missing");
  }
  for (const key of Object.keys(SNAPSHOT_TOOLS) as (keyof Snapshots)[]) {
    const s = manifest.snapshots[key];
    if (!isObj(s)) {
      errs.push(`manifest_${key}_missing`);
      continue;
    }
    if (s.tool !== SNAPSHOT_TOOLS[key] && s.tool !== `mcp__plan-manager__${SNAPSHOT_TOOLS[key]}`) {
      errs.push(`manifest_${key}_tool_mismatch`);
    }
    if (!isObj(s.args) || s.args.plan_id !== planId) errs.push(`manifest_${key}_plan_id_mismatch`);
    if (str(s.captured_at) === null || Number.isNaN(Date.parse(String(s.captured_at)))) {
      errs.push(`manifest_${key}_captured_at_missing`);
    }
    if (s.complete !== true) errs.push(`manifest_${key}_incomplete`);
    if (s.sha256 !== digests[key]) errs.push(`manifest_${key}_sha256_mismatch`);
  }
  return errs;
}
