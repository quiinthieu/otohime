---
plan_id: pm-248
run_id: run-8581
kind: acceptance_report
verdict: fail
cycle: 2
cited_sha: d8a9be17b0cc16d26c8f774d83ce118de874cdf2
---

# Acceptance report: Paper Almanac Bits (pm-248, run-8581, cycle 2)

Verdict: **fail**. Seasons and the torn-sheet 404 work for a visitor on
https://otohime.dev at both widths. Ask the Ink does not give the AI answers the
idea asked for: the console never calls the model endpoint, and `/api/ask`
returns 404 in production for both GET and POST. A change request is filed
beside this report: `change_request_2.md`.

Deployed identity: https://otohime.dev (Vercel). `<meta name="build-sha">` is
`d8a9be17b0cc16d26c8f774d83ce118de874cdf2` on `/`, `/work`, `/notes`,
`/projects` and `/play`. Repo HEAD `c0dbca8` has no diff under `app/`,
`components/`, `lib/` or `public/` since `d8a9be1`; the only later commits
change `projects/` record files. So the walked code is HEAD's app code. The
commit `d8a9be1` is authored by Otohime <quiinthieu@gmail.com> with no trailer.

## Walkthrough

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| Anonymous visitor, TZ Australia/Sydney, 26 Oct 2026, 1366x768 | Open `/` | 200. build-sha `d8a9be1`. `data-season="spring"` (Sydney is south, so October is spring). | `acceptance_walk_run-8581.log` |
| Same, 390x844 | Open `/` | 200. build-sha `d8a9be1`. `data-season="spring"`. | same |
| Same, both widths | Read the ambient layer | `svg.season-layer`, aria-hidden true, pointer-events none, z -1, 16 `.almanac-bit`, 19 elements in total (limit 40). | same |
| Same, 1366x768 | Click the Winter stop of the 5-stop dial | `data-season="winter"`. Reload keeps it; localStorage `season=winter`. | same |
| Same, 390x844 | The dial is folded; tap the visible stop until it reads Winter | `data-season="winter"`. Reload keeps it; localStorage `season=winter`. | same |
| Same, both widths | Open "> Ask the console", ask "what is your work" | The answer types out and begins `WORK:` with stock text. One citation link `-> Work` to `/work`. | same |
| Same, both widths | Count requests to `/api/ask` while the console answers | **0 requests.** The console answers from `/ask-index.json` only. | same |
| Same, both widths | `fetch('/api/ask', POST {question})` from the origin | **404.** The endpoint is off in production, as is GET (curl, 404). | same; `curl -i https://otohime.dev/api/ask` |
| Unknown path, both widths | GET `/acc-lost-probe-8581` | **404**, with links to Home, Work, Projects, Notes and Play (the five links resolve). | same |
| Same, JS on | Press "Smooth it out" until it finishes | 20%, 40%, 60%, 80%, then "Flat again. Pick a way back." | same |
| Same, JS off | GET `/`, `/work`, `/projects`, `/notes`, `/play` | 200 each. The plain links work without JavaScript. | same |
| Reduced motion, both widths | Open the 404 and `/` | No "Smooth it out" button. 0 `.almanac-bit` in the layer. | same |
| Both widths | Check horizontal overflow on `/` | scrollWidth - clientWidth = 0. | same |
| Both widths | Read browser console and HTTP responses >= 400 | The only error is `POST /api/ask` 404, which my own origin probe made. No site error. | same |

Walk result: **32 of 38 checks pass** (`acceptance_walk_run-8581.log`, `SUMMARY 32/38 pass`).
The six failures are:

- Four are the Ask defect at both widths: `model endpoint /api/ask called by console`
  (0 requests) and `POST /api/ask from origin` (404).
- Two are `console/page errors`, which fail only because my origin POST probe is
  logged as a console error. The site itself logged no error.

No other check failed.

## Real and fake boundaries

- Real: the live production site, in headless Chromium (playwright-core 1.64.0,
  Chrome Headless Shell 156) at 1366x768 and 390x844. The timezone is
  Australia/Sydney on the real date. Reduced motion is a browser context option.
  No fixture changes the page.
- Not fake: the 0-request count. The request listener records `/api/ask`
  traffic, as the origin POST's logged 404 shows.
- Not checked: other touched components. The 404 and the seasons come from
  the same build, `d8a9be1`.

## Logs and services

- Read: the browser console, page errors and HTTP responses >= 400 during the
  walk, at both widths.
- Not read: Vercel runtime logs (no Vercel CLI or credentials in this pod) and
  the CI runs for `d8a9be1` (`gh` is unauthenticated: `gh auth login` is
  required). Server-side errors during the walk are therefore **unread**, and
  that part of the evidence is inconclusive.

## Negative control

- The request listener does see `/api/ask` traffic: the origin POST is logged
  as `http 404 POST https://otohime.dev/api/ask`. So the 0-request count is not
  a blind listener.
- The source at HEAD agrees. `git grep` finds no `fetch("/api/ask")` in
  `components/ask-console*.tsx`. `components/ask-console-loader.tsx:15` fetches
  only `/ask-index.json`. `app/api/ask/route.ts` returns 404 unless `ASK_LLM=1`
  and `ANTHROPIC_API_KEY` are set (`lib/ask-llm.ts:48`).

## Defects

1. **Ask the Ink never reaches the model, and the model endpoint is off in production.**
   A visitor gets the offline canned answer every time. See `change_request_2.md`.

## Deferred and unproven checks

| Check | Owner | Failure condition |
| --- | --- | --- |
| Live Haiku answer quality | product owner, with the change request | A production `POST /api/ask` returns 200 with a model-written answer and citations that match the passages returned. Not exercised here: no key in the pod, and `ASK_LLM` is off. |
| Server logs and CI for `d8a9be1` | plan-manager | Any non-success CI conclusion, or any server error logged in the walk window. Unread here. |
| Safari, real devices, assistive technology | not assigned | Not checked in this run. |

## Prior runs (context, not evidence)

Run-8575 (cycle 1) failed on the same Ask defect at `3604c82`. At `d8a9be1` the
defect is unchanged. This run walked the live site only; it did not build the
checkout. The code comparison above is a `git diff` of the repo.
