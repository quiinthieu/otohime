#!/usr/bin/env node
// Offline release/dispatch probe for a split part (pm-260/t-1578). Reads four locally saved
// plan-manager payloads (get_plan, explain_schedule, get_timeline, list_runs) and an optional
// manifest, prints one JSON verdict, and never touches the network or the board.
//
//   node --experimental-strip-types scripts/probe-plan-release.mjs \
//     --plan plan.json --schedule schedule.json --timeline timeline.json --runs runs.json \
//     --plan-id pm-255 --predecessor-id pm-248 --task-id t-1557 \
//     [--abandon-decision dec-55805,dec-55807] [--manifest manifest.json] [--require released|dispatched]
//
// Exit 0: the --require mode holds and a --manifest verified every snapshot's completeness and
// bytes. Exit 1: inputs are readable but the evidence falls short, or no manifest was given (the
// output is then diagnostic only). Exit 2: bad arguments or unsupported, unreadable, mismatched or
// incomplete inputs.
// See projects/fix-for-slow-plan-pm-255-task-duration-spell-slow-pm-255-tas/release-walkthrough.md.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { checkManifest, evaluateRelease, MODES, verdict } from "../lib/plan-release.ts";

const SNAPSHOTS = ["plan", "schedule", "timeline", "runs"];

function out(body, code) {
  process.stdout.write(JSON.stringify(body, null, 2) + "\n");
  process.exit(code);
}

let args;
try {
  ({ values: args } = parseArgs({
    options: {
      plan: { type: "string" },
      schedule: { type: "string" },
      timeline: { type: "string" },
      runs: { type: "string" },
      manifest: { type: "string" },
      "plan-id": { type: "string" },
      "predecessor-id": { type: "string" },
      "task-id": { type: "string" },
      "abandon-decision": { type: "string", multiple: true },
      require: { type: "string", default: "dispatched" },
    },
    strict: true,
    allowPositionals: false,
  }));
} catch (err) {
  out({ ok: false, input_errors: ["arguments_unsupported"], detail: String(err.message ?? err) }, 2);
}

const argErrors = [];
for (const k of [...SNAPSHOTS, "plan-id", "predecessor-id", "task-id"]) {
  if (!args[k]) argErrors.push(`argument_${k}_missing`);
}
if (!MODES.includes(args.require)) argErrors.push("argument_require_unsupported");
if (argErrors.length) out({ ok: false, input_errors: argErrors }, 2);

const inputErrors = [];
const snaps = {};
const digests = {};
for (const k of SNAPSHOTS) {
  let bytes;
  try {
    bytes = readFileSync(args[k]);
  } catch {
    inputErrors.push(`${k}_unreadable`);
    continue;
  }
  digests[k] = createHash("sha256").update(bytes).digest("hex");
  try {
    snaps[k] = JSON.parse(bytes.toString("utf8"));
  } catch {
    // A cut-off payload (truncated copy, tool output limit) is not evidence.
    inputErrors.push(`${k}_json_invalid`);
  }
}

let manifest = { provided: false, completeness: "unverified" };
if (args.manifest) {
  let doc;
  try {
    doc = JSON.parse(readFileSync(args.manifest, "utf8"));
  } catch {
    inputErrors.push("manifest_unreadable");
    manifest = { provided: true, completeness: "failed" };
  }
  if (doc !== undefined && Object.keys(digests).length === SNAPSHOTS.length) {
    const errs = checkManifest(doc, digests, args["plan-id"]);
    inputErrors.push(...errs);
    manifest = { provided: true, completeness: errs.length ? "failed" : "verified", captured_at: doc?.captured_at ?? null };
  }
}

const expected = {
  plan_id: args["plan-id"],
  predecessor_id: args["predecessor-id"],
  task_id: args["task-id"],
  abandon_decision_ids: (args["abandon-decision"] ?? []).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean),
};

if (inputErrors.length) {
  out({ ok: false, mode: args.require, expected, input_errors: inputErrors, manifest, sha256: digests }, 2);
}

const evaluation = evaluateRelease(snaps, expected);
const v = verdict(evaluation, args.require);
// Without a verified manifest the evaluation is diagnostic only: it never exits 0.
const unmet = manifest.completeness === "verified" ? v.unmet : [...v.unmet, "completeness_verified"];
out(
  { ok: unmet.length === 0, mode: v.mode, unmet, ...evaluation, manifest, sha256: digests },
  evaluation.input_errors.length ? 2 : unmet.length === 0 ? 0 : 1,
);
