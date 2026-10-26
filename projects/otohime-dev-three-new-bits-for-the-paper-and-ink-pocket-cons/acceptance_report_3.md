---
plan_id: pm-248
run_id: run-8588
kind: acceptance_report
verdict: fail
cycle: 3
---

| starting state | action | observable result | evidence |
| --- | --- | --- | --- |
| Live https://otohime.dev, no session, fresh headless Chromium | Open `/` at 1366x768 and 390x844 | HTTP 200, title "Otohime", both widths | acceptance_walk_run-8588.log, browser walk |
| Home page open | Click the Ask control, type "What is your work?", press Enter | Answer types out: "WORK: I build the pipes between where data lands and where people use it…". It is the offline canned answer from `lib/ask.ts`, not a model answer. Same at both widths | browser walk; `components/ask-console.tsx` has no `/api/ask` reference |
| Same walk | Count network requests to `/api/ask` while asking | 0 requests at 1366x768, 0 at 390x844. The console never calls the model tier | browser walk, request listener |
| Production | `POST https://otohime.dev/api/ask` with origin and JSON body | HTTP 404 `Not Found`, `x-matched-path: /api/ask`. The route returns 404 unless `ASK_LLM=1` and a key are set. Neither can be read from the pod, and no key is present here | curl; `app/api/ask/route.ts:10` |
| Production | Probe `probe-ask.sh` with `BASE_URL=https://otohime.dev` | 60 ok, 0 failed, at 1366x768 and 390x844. This covers the offline typewriter only, not the model | ask probe log |
| Production | Probe `probe-seasons.sh` with `BASE_URL=https://otohime.dev` (run 1) | 54/59 layer checks. Winter at 1366px drew 0 bits, stuck in the SSR `still` state. Dial 45/45, joint 28/28, node 19/19 | seasons probe log (run 1) |
| Same site | Rerun `probe-seasons.sh` once, unchanged | 19/19, 59/59, 45/45, 28/28; exit 0. The earlier winter 1366px failure did not repeat. Recorded as a one-off, not a defect | seasons probe log (rerun) |
| Production | Probe `probe-lost.sh` with `BASE_URL=https://otohime.dev` | 34 ok, 0 failed, exit 0. Its overflow check runs at 390x844 | lost probe log |
| Production | `GET /nope-acc-8588` at 1366x768 and 390x844 | HTTP 404. Links to `/`, `/work`, `/projects`, `/notes`, `/play` are present at both widths | browser walk |
| Production | Read the 404 and Ask console console errors | The only error is the 404 resource for the unknown path, which is expected | browser walk |
| Plan record | `plan_manager_get_delivery_readiness` for pm-248 | ready: true, no blockers. t-1511, t-1513 to t-1519 and t-1538 are done with green gates. t-1512 is superseded | plan-manager readiness response |
| Logs | Read the logs of the touched services (web on Vercel) | Not read. There is no Vercel CLI, and `gh` is unauthenticated, so runtime logs are inconclusive | none |

## Verdict: fail

Seasons and the torn-sheet 404 work for a visitor on https://otohime.dev at both
widths. Ask the Ink does not do what the idea asked. A visitor never gets an AI
answer grounded in the site's content. The console only prints the offline
canned answer, and `POST /api/ask` returns 404 in production. This is the same
defect as rep-4979 and rep-4984. It was not fixed since, and no task was
dispatched for it. See `change_request_3.md`.

## Cited sha

- Repo HEAD: `e1454ed` (plan records only).
- App content: `d8a9be1`. `git diff d8a9be1 HEAD -- app components lib scripts public`
  is empty. The live build id is not exposed in the HTML, so the deployed sha is
  not proven. The walk is taken as the walk of `d8a9be1` content.

## Real and fake boundaries

- Real: the live production URL, headless Chromium 1.64.0 with the cached
  browser, and real HTTP requests.
- Not real: no live model call. No `ANTHROPIC_API_KEY` in the pod, and production
  env cannot be read. Assistive technology, Safari and real devices were not
  checked.
- Not checked: Vercel runtime logs, CI for `d8a9be1`, and the production env
  flags for `ASK_LLM`.

## Deferred checks

- Production env flags `ASK_LLM` and the key. Owner: product owner, through the
  change request. Failure condition: the console still shows only the canned
  answer with no `/api/ask` call.
- Vercel runtime and deploy logs. Owner: acceptance (next run with a CLI or an
  authenticated `gh`). Failure condition: any 5xx or error in the Ask or 404
  route during a walk.
