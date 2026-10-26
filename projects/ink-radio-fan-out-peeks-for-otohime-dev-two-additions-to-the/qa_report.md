# QA report: t-1507 Ship Fan-out Peeks

**Verdict: fail. Cause: code.** The peeks UI is deployed and most browser paths execute, but the delivered mobile browser probe repeatedly times out before it can verify the positive long-press path. The failure reproduces locally against the current production build and remotely against production, so the required probe is not green.

## Identities and deployment

- Plan/task/run: `pm-247` / `t-1507` / `run-8560`. This QA run used profile `codex-luna-6-medium` (`gpt-6-luna`, medium effort). The software-engineer fix run was recorded as `claude-opus-5-5`, high effort; the successful final checkout verification was run by `shell` on worker `avietidol-z490`.
- Delivery SHA: `4942e75e220844c4e61ca00df8c762fb6e96f561`, author `Otohime <quiinthieu@gmail.com>`, subject `pm-247/t-1507: Unblock main's footer CI step: follow the lost-sheet 404 and split walk from probe`; no co-author trailer. The delivery adds no changes to the peek UI or peek probe relative to `593d699`.
- Board green gate `ver-3415` is pass at `4942e75` (run `run-8557`). The required checkout command passed on this lease too. GitHub Actions status itself was not independently observed.
- Independent production checks: `/api/health` returned 200; `/`, `/projects`, `/music`, and `/peeks.json` returned 200. The three pages report build SHA `6832601ae6ef4bcfe7df162ab378e817264575a4`; `git merge-base --is-ancestor 4942e75 6832601` passed. The deployed build therefore contains the delivery commit.
- `author.txt` was listed in the earlier coding task's artifacts (run `run-8542`, SHA `18ef637`); the current delivery's Git metadata independently matches the required author identity. The successful final gate run `run-8557` lists `commits.txt` and verification artifacts, with no uncommitted files.

## Verification

- Fresh `npm ci` from `package-lock.json`, then the contract chain `npm test && npm run test:e2e && npm run lint && npm run typecheck && npm run build`: exit 0. Unit tests: 1,723 passed. E2E: 37 passed, including the peeks suite. Lint: 0 errors and 10 warnings. Typecheck and production build passed. E2E used the real embedded PostgreSQL 17 package, migrations, production `next start`, and real Chromium where exercised; it did not use a fake DB/server.
- Independent local browser probe: `SKIP_BUILD=1 PORT=4177 bash scripts/probe-peeks.sh` against this checkout's production build: **58 passed, 1 failed**. Desktop hover, keyboard navigation, card navigation and view transitions, marker negative controls, edge handling, reduced motion, and the moving-touch negative control passed. The phone path then timed out at `scripts/probe-peeks.mjs:412`, the second `shore.scrollIntoViewIfNeeded()`, immediately after the moving-touch negative control; it never reached the positive long-press assertions.
- Independent production browser probe: `BASE_URL=https://otohime.dev bash scripts/probe-peeks.sh`: **57 passed, 2 failed**. It had the same phone timeout at line 412 and reported three `net::ERR_NETWORK_CHANGED` resource errors on `/projects`. The remote result is additionally affected by network instability; the local reproduction establishes that the phone timeout is not solely a production network failure.
- Relevant negative controls: local and remote probes confirmed that a short pass-through hover, an unmarked navigation link, and a stale marker do not open the fan; the stale marker still follows its ordinary link. The local probe's reduced-motion checks passed. The moved-touch control also passed, but the subsequent timeout prevents treating the required positive mobile long-press behavior as verified.
- Runtime boundaries: the browser probes used real Playwright 1.64.0 and Chromium headless shell, not a fake browser. Remote browser execution exercised the deployed site. No supported Vercel runtime-log source is available in this checkout; runtime logs are not claimed clean.

## Executable fingerprint and task history

- Current probe fingerprint: `scripts/probe-peeks.mjs` SHA-256 `535e4398b2dd9471e9861dbec34b0d39c0d65b2468059b866080b50ebaed7841`; peek component `components/peek-layer.tsx` `55271c577dbce115e77b5168f41dc2809c311315c71fa0734311d105385bc6a6`; CSS `app/(site)/peeks.css` `4ca5eddad7c086d13906527af46ce148d7c183ba922c1e848b24479e489f961a`; E2E `e2e/peeks.test.ts` `19313a1e3edd4c79e94b3dddd04d2faead17ab2a2cf28ed905135225d6e941d0`; `package-lock.json` `e7aa5d85635862f956400a2d67338cd661d01d0dcab8cf959ea1d6d58be96877`; `package.json` `6b15ad3e9d828275cc6f1556faf3754397758b45ffd146212e3fbbe5ccc69923`; `next.config.ts` `aa42b15d18f6516b2364ebb47ddb18ee918102e3c430feabcaec04bb586a8a4b`. The browser probe failure is tied to these exact files; the later footer CI fix did not change them.
- Bounded Task Manager history read: FAILED page 0, limit 100 (100 of 1,072 rows); COMPLETED pages 0–2, limit 100 each (300 of 5,508 rows); PENDING page 0 (2 rows); RUNNING page 0 (8 rows). This is **not a complete global history scan**; records beyond those offsets were not read. The scans found relevant task `86b79907-7d02-49f1-a1ba-5872a1fdf045`, run `run-8547`, FAILED at the same `4942e75` executable fingerprint because no worker claimed it within 30 minutes (`queue_ttl_exceeded`). Its callback state is `delivered`, attempts 1. The raw list row contains the failure; `task_manager_get_task` returned NotFound for this id, so no worker log exists in the detail API and runner evidence is incomplete. This is a capacity failure, not execution of the browser probe, and the later successful `run-8557` does not erase the separately observed browser defect.
- Other failures in the bounded window were unrelated: task `97a9bbd5-4f02-4178-b6fa-dfbff80648ad` / `run-8541` (t-1509) and `03909aec-b28d-4c6f-a38d-9c952e1c87b4` / `run-8415` (t-1508) both expired unclaimed with `queue_ttl_exceeded`; their task detail records show callbacks delivered once. No deterministic runner failure for the peek executable was found in the scanned pages. The plan board independently records the earlier red gate `ver-3354` at `61bbd2c`, the final green gate `ver-3415` at `4942e75`, and the prior peek verification runs. Older global history and associated raw worker logs remain unread.
- No pm-247 pending task appeared in the pending page. The running page included the current QA task; no queued task is used as product evidence.

## Conclusion and deferred checks

- Integration deployed: **yes**, deployed SHA `6832601` includes `4942e75`.
- Execution demonstrated: **partially**. Production routes and desktop/keyboard/navigation/reduced-motion behavior were observed. The required mobile positive long-press assertion remains unexecuted because the probe times out first.
- Product delivered: the UI is present in production and its tested paths operate, but task acceptance is **not complete** until the positive mobile path is exercised by a passing probe.
- Defect: repeatable phone-path timeout in the shipped browser probe at `scripts/probe-peeks.mjs:412`. Fix plan is in `fix_plan.md`.

| Deferred check | Owner | Failure condition |
| --- | --- | --- |
| Correct the mobile probe setup and re-run the full local probe | t-1507 software-engineer fix run | The probe still times out before positive long-press, the long-press opens/follows incorrectly, or any assertion fails. |
| Re-run the same browser probe on production after the fix | QA / production deploy owner | Any interaction assertion fails; treat `ERR_NETWORK_CHANGED` as an environment issue only if a clean local probe passes and remote evidence isolates to network loads. |
| Remaining Task Manager history and unavailable raw details for task `86b79907-7d02-49f1-a1ba-5872a1fdf045` | Task Manager owner | Read the rest of FAILED/COMPLETED history if investigating other attempts; resolve the task lookup/log gap if runner evidence is needed. The observed queue expiry does not waive the code defect. |
| Production runtime logs | Vercel/service owner | Investigate any uncaught error corresponding to `/projects` or the peek layer when logs become available. No logs were available here. |

## Checkout documentation availability

The requested `projects/20260921222547_plan_manager_chief_of_staff_extraction.md` and `docs/claude/software-development.md` were absent from this checkout and the plan branch. `AGENTS.md` was present. The board task contract and prior plan reports were read through Plan Manager instead; no application source was edited during QA.
