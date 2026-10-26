---
plan_id: pm-248
run_id: run-8660
kind: acceptance_report
verdict: fail
cycle: 1
---

| starting state | action | observable result | evidence |
| --- | --- | --- | --- |
| Live https://otohime.dev, no session, headless Chromium, 1366x768 and 390x844 | `BASE_URL=https://otohime.dev bash scripts/probe-seasons.sh` | Exit 0. Joint checks 28/28 at both widths, with the layer drawn, reduced motion showing one rule and no transition, and masthead over the layer. No console errors | /tmp/acc-seasons.log (run-8660) |
| Live site, same | `BASE_URL=https://otohime.dev bash scripts/probe-lost.sh` | Exit 0, 34 ok, 0 failed. Covers the torn sheet, rub, plain links and the 390x844 overflow check | /tmp/acc-probe-lost.log (run-8660) |
| Live site | `GET https://otohime.dev/nope-acc-8660` | HTTP 404. Links to `/`, `/work`, `/projects`, `/notes`, `/play` present in the HTML | curl (run-8660) |
| Live site | `GET https://otohime.dev/api/ask` | HTTP 404, `x-matched-path: /api/ask`. The model tier is off in production (`ASK_LLM` unset or the route is not enabled) | curl (run-8660) |
| Live site | `POST https://otohime.dev/api/ask` with `origin` and JSON `{question}` | HTTP 404 | curl (run-8660) |
| Live site, both widths | `BASE_URL=https://otohime.dev bash scripts/probe-ask.sh` | Exit 1, 63 ok, 23 failed. Every failure is an Ask-console check that depends on the model tier: 0 `GET /api/ask` on the first open, 0 `POST /api/ask` on a question, and the fake model's lines, citations and aria-live never appear. Tier-off checks also fail on the GET (0 GETs) | /tmp/acc-probe-ask.log (run-8660) |
| Live site, deployed bundle | Fetch the 17 `/_next/static` chunks linked from `/` and search for `api/ask` | No chunk contains `api/ask`. The source on main has it: `components/ask-console.tsx` and `lib/ask-tier.ts:10` (`ASK_API = "/api/ask"`), added in `8e02b8d`, which is an ancestor of origin/main. So the deployed build predates `8e02b8d`, or that code did not ship. This scan covers only the chunks linked from `/` | chunk scan (run-8660) |
| Live site | Walk the Ask console as a visitor, asking "What is your work?" | The console answers from the offline canned text, with no request to `/api/ask`. Same at both widths | probe-ask log above |
| Vercel and CI | Read runtime logs for web, and the deploy for the sha | Not read. There is no Vercel CLI and `gh` is not installed or authenticated in this pod, so the logs and the deployed sha are inconclusive | none |
| Local source | `git merge-base --is-ancestor 8e02b8d origin/main` | Ancestor: true. Main HEAD is `9b85540`, which contains t-1540 and t-1541 | git (run-8660) |

## Verdict: fail

Seasons and the torn-sheet 404 pass live at 1366x768 and 390x844. Ask the Ink
does not deliver what the idea asked for. A visitor cannot get an answer from
the model tier on https://otohime.dev, and the console never calls `/api/ask`
there.

Two causes stack. They are separate, and only the second is a person's chore:

1. **Production does not serve the console code that calls the model tier.**
   No deployed chunk contains `api/ask`, though main has the call since
   `8e02b8d`. The probe's tier-off GET check fails on production for this reason.
   Cause not established from here: no CI or deploy access.
2. **The model tier is off in production.** `GET` and `POST /api/ask` return 404.
   Setting `ASK_LLM=1` and a server-only `ANTHROPIC_API_KEY` in Production is
   operator action `set-env:ask-llm-production` (esc-381). Acceptance cannot
   set it. Even with it set, cause 1 means the console would still not call the
   route.

The local fake-model probe (t-1541, rep-5030) proves the path with fakes. It is
not production evidence.

## Cited sha

- Main HEAD evaluated: `9b85540` (contains `8e02b8d` for t-1540 and `5d54e31`
  for t-1541).
- Deployed sha or build id of the web app: **not observed.** The bundle does
  not expose it, and there is no Vercel access here. The Ask findings are about
  the deployed bundle as observed, not about `9b85540`.
- Seasons and 404 deployed sha: not observed either. Their pass is on the
  bundle served at the walk time.

## Real and fake boundaries

- Real: the live production URL, headless Chromium (Playwright pinned by the
  probe scripts), real HTTP requests and the real chunks.
- Fake: the probe's tier-on checks are `page.route` fakes. They prove the
  console's own handling, not the server. No live model call. No
  `ANTHROPIC_API_KEY` in this pod.
- Not checked: Vercel runtime logs, CI for the deployed sha, Safari, real
  devices, assistive technology.

## History and completeness

- Chunks scanned: 17, all those linked from `/`. Other chunks loaded only by
  other pages were not scanned, so the scan does not prove absence on those pages.
- No CI or task-manager job history was read. The green gates for t-1540 and
  t-1541 are supplied in the prior reports, not observed here.

## Deferred checks

- `set-env:ask-llm-production`: owner, the Vercel account holder. Operator
  action raised. Ready when `GET https://otohime.dev/api/ask` returns 200 with
  `"enabled":true`. Failure condition: still 404.
- Production redeploy from main at or after `8e02b8d`: owner, the product owner
  through the change request (the deploy pipeline is not visible from here).
  Failure condition: no `api/ask` string in the chunks linked from `/`, or the
  console sends no GET `/api/ask` on production.
- Vercel runtime logs for web during the walk: owner, acceptance, next run with
  CLI or authenticated `gh`. Failure condition: any 5xx from `/api/ask` or the
  404 route.
- Live Haiku answer quality: unproven until a key exists. Owner: the operator
  who sets the key.
