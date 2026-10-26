// Independent QA reproductions. Synthetic board evidence; never writes to the board.
// node --experimental-strip-types projects/.../qa-adversarial.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { evaluateRelease, verdict } from '../../lib/plan-release.ts';

const expected = { plan_id: 'pm-255', predecessor_id: 'pm-248', task_id: 't-1557' };
const progress = { state: 'live', holders: [] };
const baseline = {
  plan: { plan: { id: 'pm-255', status: 'executing', after_plan_id: 'pm-248',
    trace_id: 'qa-trace', execution_started_at: '2026-10-26T08:00:00Z' },
    tasks: [{ id: 't-1557', plan_id: 'pm-255' }], progress },
  schedule: { plan_id: 'pm-255', status: 'executing', tasks: [{ task_id: 't-1557' }], progress },
  timeline: { entries: [{ id: 'qa-release', type: 'decision', kind: 'after_plan_released',
    trace_id: 'qa-trace', summary: 'Released pm-255 from abandoned pm-248',
    evidence: { plan_id: 'pm-255', predecessor_id: 'pm-248', predecessor_status: 'abandoned',
      parent_note: 'The predecessor was abandoned after acceptance exhaustion.' } }], cursor: 'idea:qa' },
  runs: { runs: [{ id: 'qa-swe', plan_id: 'pm-255', task_id: 't-1557',
    role: 'software_engineer', status: 'running', tm_task_id: 'qa-durable-id' }] },
};
const root = fileURLToPath(new URL('../../', import.meta.url));
const script = join(root, 'scripts/probe-plan-release.mjs');
const dir = mkdtempSync(join(tmpdir(), 'pm260-qa-'));
const tools = { plan: 'get_plan', schedule: 'explain_schedule', timeline: 'get_timeline', runs: 'list_runs' };
const cases = [
  ['valid-baseline', () => {}, 0],
  ['held-negative-control', b => {
    for (const k of ['plan', 'schedule']) b[k].progress = { state: 'waiting', reason: 'after_plan', holders: [{ plan_id: 'pm-248' }] };
  }, 1],
  ['scheduled-negative-control', b => { b.runs.runs[0].status = 'scheduled'; b.runs.runs[0].tm_task_id = ''; }, 1],
  ['unknown-status-constructor', b => { b.runs.runs[0].status = 'constructor'; }, 'nonzero'],
  ['unrelated-negative-release-note', b => {
    const e = b.timeline.entries[0];
    e.kind = 'other';
    e.summary = 'Do not release pm-255: pm-248 was abandoned; release has NOT occurred.';
    e.evidence = { plan_id: 'pm-255', note: 'Review this proposal tomorrow.' };
  }, 'nonzero'],
  ['foreign-release-with-one-local-trace', b => {
    b.timeline.entries[0].trace_id = 'foreign-trace';
    delete b.timeline.entries[0].evidence.plan_id;
    b.timeline.entries.push({ id: 'local-split', type: 'decision', kind: 'plan_split_from', trace_id: 'qa-trace' });
  }, 'nonzero'],
  ['missing-source-run-id', b => { delete b.runs.runs[0].id; }, 'nonzero'],
  ['explicit-incomplete-without-manifest', b => { b.runs.complete = false; b.runs.has_more = true; b.runs.next_cursor = 'unread'; }, 'nonzero', false],
];
const results = [];
try {
  for (const [name, mutate, wanted, manifest = true] of cases) {
    const board = structuredClone(baseline);
    mutate(board);
    const snapshots = {};
    const argv = [];
    for (const [k, tool] of Object.entries(tools)) {
      const text = JSON.stringify(board[k]);
      const path = join(dir, `${k}.json`);
      writeFileSync(path, text);
      snapshots[k] = { tool: `plan_manager_${tool}`, args: { plan_id: 'pm-255' },
        captured_at: '2026-10-26T09:00:00Z', complete: true,
        sha256: createHash('sha256').update(text).digest('hex') };
      argv.push(`--${k}`, path);
    }
    const mp = join(dir, 'manifest.json');
    writeFileSync(mp, JSON.stringify({ captured_at: '2026-10-26T09:00:00Z', snapshots }));
    const args = ['--experimental-strip-types', '--disable-warning=ExperimentalWarning',
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script, ...argv,
      '--plan-id', 'pm-255', '--predecessor-id', 'pm-248', '--task-id', 't-1557',
      ...(manifest ? ['--manifest', mp] : [])];
    const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
    const body = JSON.parse(r.stdout);
    const direct = evaluateRelease(board, expected);
    results.push({ name, expected_exit: wanted, actual_exit: r.status,
      contract_met: wanted === 'nonzero' ? r.status !== 0 : r.status === wanted,
      direct_ok: verdict(direct, 'dispatched').ok, ok: body.ok,
      input_errors: body.input_errors, release_recorded: body.release_recorded,
      dispatch_proven: body.dispatch_proven, dispatch_runs: body.evidence?.dispatch_runs,
      completeness: body.manifest?.completeness, delivery_proven: body.delivery_proven });
  }
  console.log(JSON.stringify({ synthetic: true, results }, null, 2));
} finally { rmSync(dir, { recursive: true, force: true }); }
// Diagnostic evidence generator; contract_met is the verdict, not this process exit code.
