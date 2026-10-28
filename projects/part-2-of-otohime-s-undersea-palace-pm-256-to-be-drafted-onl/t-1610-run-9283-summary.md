# t-1610 green-gate repair — run-9283

Software engineer; observed profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, fleet worker `avietidol-mac-mini`.

The camera lifecycle fixture now paints continuing canvas frames and cancels its timer when its track stops. Each case closes the previous browser context, and afterEach verifies that none remain. A real decoded-video regression requires three requestVideoFrameCallback deliveries and checks context ownership. Production camera/ghost behavior and all existing browser expectations are preserved. Unit tests cap concurrent files at four to bound fixture contention on small runners.

The new decoded-frame assertion failed deterministically against the original one-paint fixture, then passed after the fix. This proves a fixture defect; it does not establish the complete cause of the remote camera timeouts. The original isolated camera file passed even before the repair, illustrating why that pass was insufficient evidence.

The complete regression run exposed an Ink Lab input defect: the browser can withhold rAF for over 100ms even though event dispatch and the actual commit each take under a millisecond. A bounded commit queue now races the next frame against a 16ms timer, publishes only the latest burst, and cancels both paths on reset/navigation/unmount. Four injected-clock tests cover frame/deadline winners, cancellation, stale callbacks and reentrant scheduling. A real browser control withholds frame delivery and checks one actual SVG update and URL within the unchanged 100ms input bound. The old compiled app fails that control. A 50ms fallback was insufficient once (100.1ms); the 16ms version passes the original case at 30.4ms and all 19 Ink Lab/Print-run cases on a fresh production build. The final full suite passes all 224 tests, including the unchanged Ink Lab input test at 22.4ms, both new browser controls, the real camera/model checks and the previously timed-out Pocket resize case.

## Verification

Final commands run sequentially with Node `v22.23.3`, the unchanged root lock, Next `16.4.2` and real Chrome `156.0.8078.48`. Complete output and exit/duration receipts are in run artifacts, especially `verification-local.json`.

| Required command | Result |
| --- | --- |
| Workflow fixture command from the contract | 59 passed |
| `npm test` | 2,593 passed |
| `npm run lint` | Exit 0; 10 existing warnings |
| `npm run build` | Exit 0 |
| `TMPDIR=/tmp npm run test:ghosts` | 8 passed |
| `TMPDIR=/tmp npm run test:e2e` | 224 passed; command exit 0 in 517s |

Earlier exact npm test runs with default TMPDIR, short TMPDIR and CI=true all passed 2,589 cases. The first capped-concurrency run exposed an existing registration guard requiring --test adjacent to the lib glob; moving the concurrency option earlier preserved that guard and passed. Its failing log is retained. An exploratory full run was 222/223: Ink Lab measured 112.5ms against its existing 100ms limit while independent verification work overlapped the browser; the same SVG committed within its first coalescing frame. That failure is retained in `e2e-initial.log`; no latency assertion was relaxed. A second full run reproduced Ink Lab at 107.2ms and also hit one Print-run resize selection timeout (221/223). The unchanged Print-run case passed in targeted runs. Neither full failure is treated as fixed merely by an isolated pass. The final browser run has no overlapping verification processes.

## Executable identity and boundaries

`artifacts/executable-identity.json` inventories 1,974 tracked source/configuration/manifest files, excluding generated history. Fingerprint: `db2e61076bd3dcf736ff08fb7b1e3b561da442f0f8ff1c07ab0e070c58232c66`. Relative to f2e1adf, `components/ink-lab.tsx`, both changed browser files, `package.json` and the two new preview-commit files differ in that inventory. The Worker code/lock/configuration fingerprint remains `aa87b9e3b4328f59801de5028120046f3c244f4f55e7e26d661b16d02b6a7115`. No Worker version/deployment id was created. Final local app marker: `dev`; Next BUILD_ID: `Pcz1INQQ0-v7mg6VraPHr`. These are local identities, not hosted delivery claims.

The harness uses real migrated embedded Postgres, production Next, native WebSockets, Chrome canvas pixels and decoded video. Ghost fan-out is the bounded local fake. Visibility/online events and disabled configuration are injected. Camera hardware is a canvas stream; the production worker, locked SDK/Wasm/model and real capture adapter are exercised by the existing model test. Its evidence includes portrait/model/asset and worker hashes. The ghost negative control still disables real paint while a positive data counter remains; the independent pixel assertion rejects it. Workflow fixtures use explicit deploy-command stand-ins and make no external deployment. No credentials or operator prerequisite was reached.

## History and handoff

Inspected coding-task history: FAILED offsets 0/3 (6 of 106), COMPLETED offsets 0/3 (6 of 1,320), and RUNNING offset 0 (2 of 2). The global historical scan is partial. The plan's ten software-engineer runs were returned; the prior failed runner log is a bounded 1,063-line tail, not complete execution history. `attempt-history.json` preserves these reads. Gate task `0eb5d871-8b7a-4284-9d37-19acd9185794` delivered its callback in one attempt; Plan Manager persisted `ver-3687` / `run-9280` at f2e1adf as timeout. Its raw runner log confirms project exit 1 and browser exit 124 at 910s. The returned project tail lacks the failing assertion. Full artifact access returned HTTP 403 and internal service DNS is unavailable from this fleet lease. That original assertion remains unidentified; unread evidence is inconclusive. Exact local reruns provide the stand-in, not a claim that the remote gate already passed.

Integration deployed: unproven. Waiting for capacity: no. Local execution demonstrated: yes, within the explicit fake/real boundaries above. Hosted product delivered: unproven. No product job queue or persistent ingestion callback exists for anonymous ghost presence; task-manager callback ingestion was inspected separately.

Task branch `pm-257-t-1610-run-9283`; delivery is the verified task-branch commit fast-forwarded to `main`. The pushed SHA is recorded in Plan Manager's git_sha and `artifacts/commits.txt`. Generated history is excluded. CI/green-gate follow-up belongs to Plan Manager for `pm-257/t-1610/run-9283`; its new ids are assigned after push and any failed declared check returns this task. No CI watch or deployed-system check is performed by this SWE run. Hosted activation and independent live acceptance remain with `t-1611`, its operator/SWE and QA roles; failure conditions include missing activation, identity mismatch, accepted denied Origin, missing peer ink/clearing or broken opt-out controls. No hosted check is reported as passed.
