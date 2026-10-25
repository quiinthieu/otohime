# QA report: t-1507 Ship Fan-out Peeks

**Verdict: fail. Cause: environment.** The peeks UI works in the local locked environment and is present in production, but the task's final delivery/gate SHA has not reached production. The deployment currently exposes an ancestor of the original UI commit, not an ancestor of `18ef637`, the SHA recorded for the task's final delivery and green gate. The GitHub workflow for `18ef637` failed before its production job.

## Identities and evidence

- Task `t-1507`; checkout branch `main`. The software-engineer delivery artifact names `18ef637c4b5e1a4b0def2cc81fe490cdd0126a53`; board green verification `ver-3363` is a pass at `18ef637`.
- Fan-out UI commit: `593d6996ec479bb65043e3a6be91f7bf8a7212b0`. Production HTML on `/`, `/projects` and `/music` reports build SHA `8b54cc439ca5870c3f55970e717b79f2f1008003`. `git merge-base --is-ancestor 593d699 8b54cc4` passes; `git merge-base --is-ancestor 18ef637 8b54cc4` fails. `/api/health` returned HTTP 200 and `/peeks.json` returned HTTP 200.
- GitHub Actions run [40235108426](https://github.com/quiinthieu/otohime/actions/runs/40235108426), checks job `121296336714`, failed at **Footer walk and Chromium probe**. All earlier checks, build, E2E, and signed-in motion probe passed; production was skipped. The last successful matching checks job is run [40232954343](https://github.com/quiinthieu/otohime/actions/runs/40232954343) for `593d699`. `git log 593d699..18ef637 -- .github/workflows/ci.yml` is empty. The failed job's check annotation says only exit 1; its raw logs endpoint returned HTTP 403, so the exact CI assertion remains unread and inconclusive.
- A later main workflow for `c885936355a74539ec786b30b86f21dc5a09afc5` (run `40236130954`) was pending when inspected. It contains `18ef637` as an ancestor. I did not wait for it.

## Verification

- On the current checkout after fast-forwarding to `c885936`, ran `npm ci && npm test && npm run test:e2e && npm run lint && npm run typecheck && npm run build`: exit 0. Unit tests: 1,615 pass; HTTP E2E: 33 pass; lint: 0 errors and 9 existing warnings; typecheck and build pass. `npm ci` installed the locked dependencies. The E2E runner used real embedded PostgreSQL 17 binaries and a real production `next start`; it did not use a fake database or fake server.
- Ran `SKIP_BUILD=1 PORT=4125 bash scripts/probe-peeks.sh` against the local production build: 61 pass, 0 fail. This exercised hover intent, keyboard navigation and Escape, View Transition card navigation, touch long-press/cancel, reduced motion, edge placement, console errors, and negative controls. The unknown/stale marker remained closed and still followed its ordinary link; an unmarked nav link did not open a fan.
- Independently ran the same browser probe against `https://otohime.dev` twice. First run: 59 pass, 2 fail (stale-link navigation and `ERR_NETWORK_CHANGED`); second: 58 pass, 2 fail (a 30-second route navigation timeout and `ERR_NETWORK_CHANGED`). The stale-link control passed on the second run. Other tested hover, keyboard, View Transition, touch and reduced-motion paths passed. These changing failures are consistent with an unstable remote browser/network path, but the hosted probes are not fully green.
- Independently ran the production footer walk: 65 pass, 0 fail. The production footer Chromium probe: 161 pass, 2 fail; both failures involved `net::ERR_NETWORK_CHANGED` resource loads, not hydration or footer assertions. Its output and the focused peeks run provide independent negative controls, but the remote browser evidence remains incomplete.
- Runtime logs: the staging cluster log query for container `otohime` returned `null`. No Vercel runtime-log connector is available here. The GitHub failed-job raw log request returned 403. These unread logs are not treated as proof of clean runtime behavior.

## Execution history and boundaries

- Fingerprint under review: UI commit `593d699`; final task/gate commit `18ef637`; `package.json`, `package-lock.json`, and `scripts/e2e.mjs` define the environment fix. The current branch includes both commits. The local run used `npm ci` from that lockfile and real Postgres/server/browser processes.
- Bounded Task Manager scan: all 56 returned `FAILED` rows (limit 100, offset 0) and 300 `COMPLETED` rows (three pages of 100 at offsets 0, 100, 200). The failed set had one pm-247 item: unrelated t-1508 run `run-8415`, which expired unclaimed with `queue_ttl_exceeded`; callback state was delivered. Its replacement `run-8425` completed on the same `4e8399d` fingerprint with callback delivered. No t-1507 Task Manager execution row was in the failed set. The 300-row completed scan found the t-1507 runs `run-8414`, `run-8429`, and `run-8437`; their Task Manager callbacks were delivered once. No pm-247 items appeared on offsets 100 or 200. Older global completed history beyond this bounded scan was not read; t-1507's board history and all its returned runs were inspected.
- The failed `run-8415` had no worker log because it was never claimed; its persisted task record contains the queue-expiry reason and delivered callback. The red t-1507 verification is in completed run `run-8414`; the final green verification is completed run `run-8437` with callback delivered. There are no pending Task Manager jobs in the inspected queue. A separate run `run-8440` remains active for t-1509 (Ink Radio), owned by that task's software-engineer run; it does not block this t-1507 scope. Its failure condition is its own verification or required product output failing to complete.
- Recorded run profiles: the software-engineer retry was `claude-opus-high` (`claude-opus-5-5`, high effort); this QA run is `codex-luna-6-medium` (`gpt-6-luna`, medium effort). The green gate is platform evidence; my checkout and browser runs are independent evidence.
- No `author.txt` was present in the task-manager delivery artifacts. Git metadata for `18ef637` is `Otohime <quiinthieu@gmail.com>` and has no `Co-Authored-By` trailer.

## Deferred checks

| ID | Owner | Required result / failure condition |
| --- | --- | --- |
| GitHub Actions run `40236130954` (head `c885936`) | GitHub Actions / repository CI | It must finish successfully and run production deploy. Fail acceptance if checks fail, production is skipped, `/api/health` is not 200, or deployed `build-sha` is not a descendant of `18ef637`. Status was pending at the observed snapshot; no waiting or polling was done. |
| Job `121296336714` raw logs | GitHub Actions repository access | Read the raw failure tail when accessible; the current API request returned 403 and the generic check annotation is insufficient to identify the exact failed assertion. |
| Production runtime logs for `otohime` | Vercel/service owner | Obtain logs if a supported source becomes available; current cluster log query returned null. Fail on an uncaught route error or a regression corresponding to the peeks paths. |
| Plan task `t-1509`, run `run-8440` | Its software-engineer run / plan manager | Separate Ink Radio task remains in progress; it is outside t-1507 and must meet its own verification before plan-wide completion. |

The original Fan-out Peeks product commit is deployed and its UI paths execute. The `18ef637` environment-fix delivery is not yet deployed, so this task is not accepted as a final delivery.
