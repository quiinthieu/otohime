# t-1558 Ask tier production probe: summary (run-8909)

Role: software_engineer. Model claude-opus-5-5, macOS lease. Base: origin/main b742a04.

## Operator chore

Before any code: `plan_manager_ask_user` kind=operator_action with fingerprint `set-env:ask-llm-production`
and ready_probe `GET https://otohime.dev/api/ask` expect 200, body_contains `"enabled":true`. The platform
recorded it as **esc-413**, not the esc-381 the plan names. Exactly one was raised. The chore is for a person
with the Vercel account: set `ASK_LLM=1` and a server-only `ANTHROPIC_API_KEY`, then redeploy. The tool
reply asked to end the run. I continued, as the contract says, because this task's verification does not
depend on production env. Recorded as a decision.

## What changed

- `lib/ask-deploy.ts`: `checkTierGet` (200 with `enabled:true`), `checkTierPost` (200, mode `llm`, non-blank
  lines, not `(OFFLINE)`, at least one citation, every href in `/work`, `/projects` or `/notes`),
  `inTierScope`, `tierOrigin` (the Origin the route compares to `BETTER_AUTH_URL`) and `TIER_QUESTION`.
  `lib/ask-deploy.test.ts` adds 4 tests with the negative cases: offline reply, 429, 403, 404, non-JSON,
  blank lines, no citation, and `/shore`, `/workshop`, absolute and protocol-relative links.
- `scripts/probe-ask-tier.mjs` / `.sh`: read-only, takes `BASE_URL`. GET, then (only if GET passes) one POST
  with the fixed question and the site's Origin. It prints `model lines` and `citations` counts and GETs each
  cited page. In Chromium at 1366x768 and 390x844 touch, page.route fixtures force three failures: the tier
  off (GET 404), a 429 with the server's (OFFLINE) reply, and a 429 with no reply. Each must print the
  canned answer from `lib/ask.ts` with no visible error element and no console errors. Control: a fixture
  model reply fails the canned check. Exits 1 on any miss. Against production, only the one POST reaches
  the tier.
- `scripts/probe-ask-llm-fake.sh` runs the tier probe in both phases:
  - on: the probe passes, and its POST reached the fake exactly once.
  - on, negative control: with the fake answering non-JSON, the probe exits 1 on the POST check (`mode "offline"`).
  - off: the probe exits 1 on `GET 404`, sends no POST, the fake saw 0 requests, and every forced failure still prints the canned answer.

The route, `lib/ask-llm.ts`, the model pin and the rate limits are unchanged. No deploy and no env change.

## Verification (local, this lease)

- `npm test`: exit 0, 2172 tests passed, 0 failed (2168 before, plus 4 new).
- `npm run typecheck`: exit 0. eslint on the touched files: exit 0.
- `bash scripts/probe-ask-llm-fake.sh` (docker Postgres, fake Anthropic, local `next start`): exit 0.
  - on: 42 ok, then 4 tier lines ok; the tier probe itself gave 30 ok, 0 failed.
  - off: 11 ok, then 3 tier lines ok; the tier probe itself gave 27 ok and the 2 expected misses.

## Real/fake boundary and deferred check

Everything above is fake: the fake Anthropic server, a throwaway Postgres and a local build. Production is
not exercised here, and execution against the real tier is unproven.

Deferred: `BASE_URL=https://otohime.dev bash scripts/probe-ask-tier.sh`.
- Owner: acceptance, after esc-413's ready_probe passes.
- Failure condition: any `not ok`, which includes GET 404/503, `enabled` false, a POST that is not mode `llm`
  with in-scope citations, or a forced failure that shows an error instead of the canned answer.
- The live run spends one site-wide daily answer.
