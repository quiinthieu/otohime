# Paper Almanac Bits: the seasons joint check passes with the tier off (pm-255, run-9055)

Product owner plan for the cycle-6 change request (`change_request_6.md`, acceptance
`acceptance_report_6.md`, run-8942). Option 1 is chosen: the seasons probe accepts the
tier-off `GET /api/ask` 404 when it checks for console errors. Visitor behaviour does not
change. The console and the route stay as they are.

## Verified state (read before planning)

- Main at plan time: `1e039a3` (acceptance cycle 6 record). The delivered code is `6bb062c`;
  production reports `9bb1dae…` through `/api/health`. Both contain the seasons layer, dial,
  torn-sheet 404 and the Ask console canned fallback.
- `scripts/probe-seasons.mjs` joint block (`jointChecks`, around line 604) collects every
  console error with `page.on("console")` and fails `motion welcome: no console or page
  errors` (line 779) when any is present. The only one at 390px and 1366px is the
  `404 GET https://otohime.dev/api/ask` that `components/ask-console.tsx` triggers on open
  through `lib/ask-tier.ts` (`tierEnabled`). With `ASK_LLM` unset the route answers 404, which
  is the designed `enabled:false` state.
- The same probe passed on production in cycle 4, before the console began the GET on open.
  The 404 page probe (`scripts/probe-lost.sh`, 34/34) and the fake-model Ask probe
  (`scripts/probe-ask-llm-fake.sh`) are not affected.

## Decision

Option 1 from the change request. Reasons:

- It is a change to a probe script only. The visitor page, the route and the console are
  unchanged, so nothing a person sees moves.
- It is reversible: one revert of one file.
- Option 2 would change the route or the console, need its own review, and risk the
  `set-env:ask-llm-production` ready probe, which reads `GET /api/ask` for 200 with
  `enabled:true`.

The allowance must be narrow. It covers only a `GET` to `/api/ask` answered 404. Any other
console error, any other 4xx, and any POST to `/api/ask` still fails the check. The allowance
is for the tier-off state only. With the tier on, the GET is 200 and nothing is allowed or
needed.

## Scope of this part

One software-engineer task (sequence 1): narrow the joint check's console-error filter in
`scripts/probe-seasons.mjs` so that the single tier-off `GET /api/ask` 404 is not counted,
and prove it with a negative control in the same probe run. Nothing else changes.

## Undelivered assumptions (expected from pm-248, not delivered by this part)

- Ask the Ink production reach stays unmet. `GET /api/ask` returns 404 on production, and no
  `POST /api/ask` has run there. Causes: stale deploy (esc-384) and `ASK_LLM` and
  `ANTHROPIC_API_KEY` unset (esc-383, esc-413). Owner: the Vercel-account holder. This part
  does not set the env, redeploy, or make a paid call.
- The `probe-ask-tier.sh` production check (`set-env:ask-llm-production`) is not run here. It
  POSTs a paid answer to production.
- Production runtime logs are not read here. There is no Vercel CLI and no authenticated
  `gh`. Owner: acceptance.

## Tasks

| seq | title | role | qa | depends_on |
| --- | --- | --- | --- | --- |
| 1 | Seasons joint check accepts the tier-off Ask 404 | software_engineer | skip | none |

Already done and not re-proposed: t-1557 (Ask deploy bundle probe) and t-1558 (Ask tier
production probe).

## Verification (task 1)

- `npm test` and `npm run typecheck` pass.
- `bash scripts/probe-seasons.sh` (local build) reports joint 28/28, exit 0.
- `BASE_URL=https://otohime.dev bash scripts/probe-seasons.sh` (post-deploy probe item; read
  only, no POST) reports joint 28/28, exit 0, with the tier off.
- `bash scripts/probe-ask-llm-fake.sh` still exits 0, so the Ask fallback checks pass.
- The negative control is inside the probe: an injected console error that is not the tier-off
  GET still fails the joint check.

## Not part of this plan

- The live model tier (esc-413): not delivered, owned by the Vercel-account holder.
- Option 2 (changing the console or the GET's behaviour): not chosen.
- Acceptance re-run: owned by the acceptance role after the task is done.
