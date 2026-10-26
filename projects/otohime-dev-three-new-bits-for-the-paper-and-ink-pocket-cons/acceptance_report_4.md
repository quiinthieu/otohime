---
plan_id: pm-248
run_id: run-8671
kind: acceptance_report
verdict: fail
cycle: 4
---

| starting state | action | observable result | evidence |
| --- | --- | --- | --- |
| Live https://otohime.dev, no session, repo main at 303eaa3 | `GET https://otohime.dev/api/ask` | HTTP 404, `x-matched-path: /api/ask`, body `Not Found`. Not `200` with `"enabled":true` | curl, saved in the walk log |
| Same | `POST https://otohime.dev/api/ask` with `origin` and JSON `{"question":"What is your work?"}` | HTTP 404, `x-matched-path: /api/ask` | curl |
| Production deployed bundle | Fetch the 17 `/_next/static/chunks/*.js` linked from `/` and grep for `api/ask` | 0 of 17 chunks contain `api/ask`. The deployed build predates `8e02b8d`, the commit that added the console's model-tier call | curl and grep, 17 chunks |
| Production, 1366x768 and 390x844 | `BASE_URL=https://otohime.dev bash scripts/probe-ask.sh` (pinned Playwright, system Chromium) | `probe: 63 ok, 23 failed`, exit 1. Every failure is a model-tier check: 0 `GET /api/ask` on open at both widths, 0 `POST /api/ask`, no model lines, no cited links. The offline typewriter, reduced motion, focus, Escape, cross-origin and "no POST while ASK_LLM is unset" checks pass at both widths | probe log |
| Production, 1366x768 and 390x844 | Ask "What is your work?" in the console | The answer types out as the offline canned `WORK:` text. The console never reaches the model tier | probe log, transcript from the failing checks |
| Production, 1366x768 and 390x844 | `BASE_URL=https://otohime.dev bash scripts/probe-seasons.sh` | Exit 0. Joint 28/28 at both widths. The seasons layer, dial, reduced motion and paint order pass on production | seasons probe log |
| Production, 1366x768 and 390x844 | `BASE_URL=https://otohime.dev bash scripts/probe-lost.sh` | Exit 0, 34 ok, 0 failed. The 404 sheet, its plain links, the rub to 100 percent and the 390x844 overflow check pass | lost probe log |
| Production | `GET https://otohime.dev/nope-acc-8671` | HTTP 404 with the torn sheet page | curl and probe |
| Production logs | Read Vercel runtime logs for the web service | Not read. No Vercel CLI is installed, and `gh` is not authenticated in this pod. Log evidence is inconclusive | `command -v vercel` empty; `gh auth status` |
| Repo gates on main 303eaa3 | `npm ci`, then `npm test` | Exit 0, 1909 pass, 0 fail | npm test log |

## Verdict: fail

Seasons and the torn-sheet 404 are delivered and walk correctly on https://otohime.dev at 1366x768 and 390x844.

Ask the Ink is not delivered as the idea asked. A visitor asking a question gets only the offline canned answer. The console never calls `GET /api/ask` or `POST /api/ask`, so no model answer is grounded in the site's Work, Projects and Notes, and no model citation appears. Two conditions produce this, and both are still open:

1. The production bundle is stale. None of its 17 chunks carries the console's `api/ask` call, though main has carried it since `8e02b8d`.
2. Production's model tier is off. `GET` and `POST /api/ask` return 404, so `ASK_LLM=1` and the server-only `ANTHROPIC_API_KEY` are not set (open question esc-383, `set-env:ask-llm-production`). The 404 also matches a route that does not exist in the stale build, so the two causes cannot be separated from outside.

The same defect has been reported in rep-4979, rep-4984, rep-4986, rep-5031 and in change_request_3. It has not changed since. A change request is filed with this report (`change_request_4.md`).

## Cited sha

- Repo HEAD checked: `303eaa3aee995e1c0ef95c621544e9b6eee873d1` (main). `git merge-base --is-ancestor 8e02b8d HEAD` holds.
- Deployed build: the sha or build id is not exposed in the HTML or headers. `x-vercel-id` identifies requests, not the build. The deployed sha is therefore not proven. The only deployed evidence is the bundle contents above, which show the build predates `8e02b8d`.

## Real and fake boundaries

- Real: the production URL, real HTTP requests, headless Chromium through the repo's probes, and the real `GET`/`POST` responses from the live route.
- Fake: the Ask probe's "tier on" checks use Playwright `page.route` fakes. They show what the console does when the tier is on, and they fail on the stale bundle because the console never sends the GET.
- Not exercised: a live model call (no key available), Safari, real devices, assistive technology.

## Identities, history and completeness

- Touched services: the web app (Vercel, otohime.dev) only. The route `app/api/ask/route.ts` and the console `components/ask-console.tsx` are the touched components.
- Logs: not read (see table). Runtime error history is inconclusive.
- CI: not observed. `gh` is unauthenticated, so no pipeline history was read for `303eaa3` or the production deploy.
- Author identity: no delivery under review. This run commits only this report and the change request.

## Negative control

- Ask probe: the tier-on checks fail on the stale bundle. That is the negative control: the probe does detect a console that never makes the GET (`0 GETs`).
- Seasons and 404 probes are not affected by the tier and pass.

## Defects

1. **Stale production bundle.** The deployed chunks have no `api/ask` call (0 of 17), though main has it since `8e02b8d`. Owner: deploy pipeline / operator. Failure condition: any chunk linked from `/` contains no `api/ask`.
2. **Model tier off in production.** `GET /api/ask` is 404, not `200` with `"enabled":true`. Owner: operator (esc-383, `set-env:ask-llm-production`). Failure condition: `GET https://otohime.dev/api/ask` is not `200` with `"enabled":true`.

## Deferred checks

- Production Ask walk with the tier on at 1366x768 and 390x844: owner acceptance, after both defects above clear. Failure condition: the console makes no GET on open, or a question makes no POST, or no cited `/work`, `/projects` or `/notes` link appears.
- Vercel runtime logs for the web service: owner acceptance (needs a CLI or an authenticated `gh`). Failure condition: any 5xx or error in the Ask or 404 route during a walk.
- Live Haiku answer quality: unproven. Owner: the operator who sets the key. Failure condition: a model answer cites a page outside Work, Projects or Notes.
