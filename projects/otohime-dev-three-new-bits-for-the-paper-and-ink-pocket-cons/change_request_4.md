---
plan_id: pm-248
run_id: run-8671
kind: change_request
cycle: 4
---

# Change request: Ask the Ink still does not reach the model tier on production

For the product owner. Seasons and the torn-sheet 404 pass on https://otohime.dev at 1366x768 and 390x844 (seasons probe joint 28/28, 404 probe 34/34). The first idea bit, "Ask the Ink", is still not delivered as the idea asked.

## What a visitor still cannot do

- Ask a question and get an answer generated from the site's Work, Projects and Notes. The console answers only with the offline canned text.
- Get an answer through the rate-limited model tier with cited pages. The console makes no `GET /api/ask` and no `POST /api/ask` on https://otohime.dev.

## Evidence

- `GET https://otohime.dev/api/ask` and `POST https://otohime.dev/api/ask` both return HTTP 404 (`x-matched-path: /api/ask`).
- The production bundle linked from `/` has 0 of 17 chunks containing `api/ask`. The console's call landed on main at `8e02b8d`, so the deployed build is older than that commit.
- `BASE_URL=https://otohime.dev bash scripts/probe-ask.sh`: 63 ok, 23 failed at both widths. Every failure is a model-tier check.
- Repo main at `303eaa3`: `npm test` 1909/1909.

## Which service

The Ask the Ink console in the web app (`components/ask-console.tsx`, `lib/ask-tier.ts`) and its route `app/api/ask/route.ts` (model tier in `lib/ask-llm.ts`). Served on https://otohime.dev, hosted on Vercel.

## Two things block this, and they are not code changes

1. **Stale production build.** The deployed bundle has no `api/ask` call. A redeploy of `main` at or after `8e02b8d` is needed. Raised as an operator action with fingerprint `redeploy:otohime-web-production`, with a ready probe on `GET /api/ask`.
2. **Model tier off in production.** `ASK_LLM=1` and a server-only `ANTHROPIC_API_KEY` are not set in the Vercel Production environment. Raised earlier as esc-383 (`set-env:ask-llm-production`), still open. A person with the Vercel account must set them.

Neither is fixed by changing application code. Both are needed before acceptance can judge the Ask bit again.

## Requested outcome

1. https://otohime.dev serves a bundle that calls `/api/ask` (the probe `scripts/probe-ask-deploy.sh` or the chunk grep passes).
2. `GET https://otohime.dev/api/ask` returns 200 with `"enabled":true`.
3. A visitor's question gets a model-generated answer grounded only in Work, Projects and Notes, with cited links, at 1366x768 and 390x844.
4. If the tier is unavailable, the console still falls back to the canned answer with no visible error. That part passes the probe today and must keep passing.
