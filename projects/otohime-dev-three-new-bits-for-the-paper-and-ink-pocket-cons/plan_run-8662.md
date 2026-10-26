# Paper Almanac Bits: Ask the Ink reaches the model tier (pm-248, run-8662)

Product owner plan for the cycle-3 change request (`change_request_3.md`,
acceptance `acceptance_report_3.md`, run-8588). Seasons and the torn-sheet 404
are delivered and stay as they are. This plan covers only what the visitor
still cannot do on https://otohime.dev: get a model answer from Ask the Ink.

## Verified state (read before planning)

- Delivered and ancestor of main: `8e02b8d` (t-1540, console calls the model
  tier), `d51172e` / `5d299a6` (t-1541 fake-model probe). `git merge-base
  --is-ancestor 8e02b8d HEAD` is true at plan time.
- `lib/ask-llm.ts` pins `MODEL = "claude-haiku-5-5"`. The cheap-model switch
  (t-1517) is in main.
- `components/ask-console.tsx` and `lib/ask-tier.ts` call `GET /api/ask` once
  on open and `POST /api/ask` on a question. Fallback to the canned answer is
  covered with page-route fakes in `qa_report_t-1540_run-8641.md`.
- `app/api/ask/route.ts` answers 404 unless `ASK_LLM=1` and a server-only
  `ANTHROPIC_API_KEY` are set. Production has neither, per
  `acceptance_report_3.md`.
- Production chunks linked from `/` contain no `api/ask` string (17 chunks,
  per the change request). The deployed build is stale or does not contain the
  call. Main is ahead of `8e02b8d`, so the next CI deploy of main carries the
  call. Nothing in this plan changes the deploy pipeline.

## What is already done (kept, not re-planned)

t-1511, t-1513 to t-1519, t-1538, t-1539, t-1540, t-1541. Their gates are green.

## Scope of the remaining work

Two software_engineer tasks. No task waits on production.

1. **Ask deploy bundle probe** (`qa: skip`). A pure, tested check that a set of
   built JS chunks carries the console's `api/ask` call, plus a read-only
   script that applies it to a `BASE_URL`. This is the stale-deploy detector
   the change request asks for. It ships without touching the route, the
   console or any env.
2. **Ask tier production probe** (`qa: required`, depends on 1). At the start
   of this task, raise the operator chore `set-env:ask-llm-production` (the
   existing esc-381) with a `ready_probe` on `GET /api/ask`. Then add a
   read-only production probe for the tier (`GET` 200 with `"enabled":true`,
   one `POST` with a cited answer, canned fallback under forced failure). The
   task proves all of it locally against a fake Anthropic endpoint. The live
   check is acceptance's, not a verification item.

## Operator chore (advisory, not a gate)

- Fingerprint `set-env:ask-llm-production`, raised by task 2 at its start.
  Chore: a person with the Vercel account sets `ASK_LLM=1` and a server-only
  `ANTHROPIC_API_KEY`, then redeploys. ready_probe: `GET
  https://otohime.dev/api/ask`, expect 200, body contains `"enabled":true`.
- If esc-381 already exists, task 2 reuses it and does not raise a second one.
- Until the probe passes, the console keeps the canned fallback. That is the
  defined state, not a failure of the task.

## Deferred checks (owner, failure condition)

- Production chunk check (`scripts/probe-ask-deploy.sh` with
  `BASE_URL=https://otohime.dev`). Owner: acceptance, after the CI deploy of the
  task 1 delivery. Failure: no chunk linked from `/` carries `api/ask`. If the
  deploy is stale after CI, that is a redeploy chore, raised as
  `operator_action` with fingerprint `redeploy:otohime-web-production`.
- Production enabled tier (`GET /api/ask` 200, `"enabled":true`; one `POST`
  returns model lines with cited `/work`, `/projects` or `/notes` pages).
  Owner: acceptance, once the operator chore has passed its ready_probe.
  Failure: `GET /api/ask` is 404 or 503, `enabled` is false, the POST makes
  no model call, or a forced tier failure shows a visible error instead of the
  canned answer.
- Acceptance walks production at 1366x768 and 390x844 once the above hold.

## Evidence rules

- Verification items run inside the checkout and never change production,
  Vercel or another system's state.
- Real/fake boundary: the fake Anthropic endpoint and the local `next start`
  build are fakes. Production is real and is judged only by acceptance.
- Negative controls: task 1 has a unit case where a chunk without the call
  must return false. Task 2's fake probe has the tier-off phase, which must
  show the canned fallback and no model lines.

## Non-goals

- Changing the ask route, the model, the rate limits, the offline answerer or
  the console markup.
- Setting env vars, redeploying, or touching the Vercel project.
- Streaming (SSE) or shader bubbles.

## Plan-level notes

- The plan file named in the run brief,
  `projects/20260921222547_plan_manager_chief_of_staff_extraction.md`, is not in
  this checkout, and `docs/claude/software-development.md` does not exist
  here. This plan follows `AGENTS.md`, the existing task contracts and the
  change request. Both gaps are recorded as a decision.
