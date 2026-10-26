---
plan_id: pm-255
run_id: run-8937
kind: acceptance_report
verdict: pending
cycle: 5
cited_sha: 9cb3833903055754efe1164d3edd17649d9183e1
---

# Acceptance report pm-255 cycle 5 (run-8937): pending

Outcome under test: "Ask the Ink" answers visitors from the model tier (grounded, streamed, cited), with a canned offline fallback. Deployed sha on https://otohime.dev: `9cb3833` (from `GET /api/health`), which is an ancestor of origin/main `fc1542c`. The later probe-only commit `6bb062c` is also an ancestor of main and has no runtime change.

## Walkthrough (production, headless Chrome 1366x768 and 390x844, run from /tmp/pm255-walk/walk.mjs)

| starting state | action | observable result | evidence |
|---|---|---|---|
| Visitor on / at 1366x768 | open https://otohime.dev/ | HTTP 200, title "Otohime" | walk output; /tmp/pm255-walk/home-1366x768.png |
| Pocket console on / | click chip "Ask the console" | dialog.ask-console opens | walk output |
| Dialog open, tier off | type "shore", Enter, wait 8 s | answer `FOUND: Shore: A focus timer that leaves sea glass behind.` with link `/shore`; 0 visible error elements | ask-1366x768.png; `GET /api/ask` 404, no POST |
| Visitor on / at 390x844 (touch) | tap chip, ask "shore" | same canned answer, link `/shore`, 0 visible errors | walk output; `GET /api/ask` 404, no POST |
| Visitor on /work, /projects, /notes | navigate | all HTTP 200 | walk output |
| Unknown URL | open /no-such-page-pm255 | HTTP 404 | walk output |
| Production chunks | `BASE_URL=https://otohime.dev bash scripts/probe-ask-deploy.sh` | 17 linked, 22 checked, 1 carries `api/ask`; exit 0 | probe output |
| Model tier | `BASE_URL=https://otohime.dev bash scripts/probe-ask-tier.sh` not run (POST would spend a daily answer) | `GET /api/ask` returns 404 "Not Found" (tier off) | curl, 2026-10-26T13:02Z |

Console errors during the walk were only the two expected 404s (the off-switch GET and the unknown-page request). Server logs: no Vercel or service log access from this run; inconclusive.

## What is delivered and what is not

- Delivered and visible: the Ask console, canned grounded answers with page citations, the offline fallback, and no visible error in tier-off state.
- Not delivered: live model answers. Visitors get canned answers only. This is the defined tier-off state, waiting on operator chore `set-env:ask-llm-production` (esc-413): set `ASK_LLM=1` and a server-only `ANTHROPIC_API_KEY`, then redeploy. Ready probe: `GET https://otohime.dev/api/ask` returns 200 with `"enabled":true`.
- Not re-walked in this run: the seasons layer and the torn-sheet 404 mini-game. Earlier acceptance reports cover them (acceptance_report_3, acceptance_report_4). Only the 404 status was checked here.

## Real/fake boundary

Real: production https://otohime.dev, read through headless Chrome and curl. Fake: none. No production POST was made, and nothing was deployed, changed or set.

## Deferred checks

- Live model tier: `BASE_URL=https://otohime.dev bash scripts/probe-ask-tier.sh`. Owner: person with the Vercel account (chore `set-env:ask-llm-production`), then acceptance. Failure: any `not ok`, or `GET /api/ask` not 200 with `enabled:true`.
- Visible log scan of the touched service: owner acceptance, needs Vercel log access. Failure: any error logged during the walk.

## Why pending and not fail

The missing piece needs a person to set env and redeploy. It is not a product defect, and no date is set. The canned fallback behaves as specified. The operator chore is parked with the platform, and one acceptance successor run is scheduled as a fallback.
