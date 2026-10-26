# t-1562 · Add opt-in palace sound · QA report · run-8975

Plan pm-271. Role: quality engineer. Run profile: Claude Opus 5.5 (`claude-opus-5-5`). The SWE delivery run-8964 was recorded as Claude Opus 5.5, effort low.

**Verdict: fail, cause=code.** The sound itself works in a real browser. But the delivery is not deployed, and its own CI run is red at `npm test`.

## Identities

| What | Value |
|---|---|
| Delivery sha | `9d65d9c6f6aecb8946ae71741f27f76568569c2a` (code). `239a4e6` is report-only. |
| Green-gate sha | `239a4e6`: gate=green, tests/lint/build exit 0 on the plan-manager gate |
| Deployed sha | `074059495faf4bee48e8f655584dfd4487089b41` (otohime.dev/api/health at 2026-10-26T13:59Z) |
| Ancestry | `git merge-base --is-ancestor 9d65d9c 0740594` exits **1**, so the delivery is **not deployed** |
| Delivery CI | Run #452 `40334420077`, push of 9d65d9c at 13:52Z, **Failure** after 5m37s. Job `checks` `121613911206` failed at step 9 `Run npm test`. Steps 1-8 (npm ci, lint, typecheck) passed. Steps 10-19 (build, e2e, probes) were skipped, so there was no production deploy. |
| Last green checks | Run #449 `40330477897` at 0740594. Job `121601102988` passed every step, including `npm test`. Its production job failed with `vercel deploy Error (inspect exited 1)`, yet 0740594 is live. This is the same defect as run #445. |
| Commit identity | Both 9d65d9c and 239a4e6 are authored `Otohime <quiinthieu@gmail.com>`, but each carries `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. That violates plan.commit_identity. There was no author.txt in the evidence. |

## Checks this run (lease checkout after `npm ci`, node v22.23.3, darwin)

| Check | Result |
|---|---|
| `npm test` at main ff955b2 (which differs from 239a4e6 only by projects/**) | exit 0, 2261/2261 (`npm-test.tail.log`) |
| `npm run lint` | exit 0: 0 errors, the same 10 pre-existing warnings (`lint.tail.log`) |
| `npm run build` at 239a4e6, APFS clone `/tmp/oto-8975`, `.next` removed | exit 0, `/ryugu` static (`build.excerpt.log`) |
| CI reproduction of `npm test` at 9d65d9c: fresh `--depth 1` clone, `node:22` container, non-root, CI env from ci.yml | linux/arm64: 2261/2261. linux/amd64 (the runner's arch): 2261/2261. **Not reproduced.** |

## User path: independent real-Chrome probe (`probe-signal.mjs`, `probe-signal.log`)

Boundary: real Google Chrome through the locked playwright-core, `--autoplay-policy=user-gesture-required`, and a real Web Audio graph. It ran against `next start` of the 239a4e6 build at localhost:4075 with placeholder auth env, **not** otohime.dev, because the delivery is not deployed. The probe is my own. It measures the **output signal**: each `connect()` to the destination is mirrored into an AnalyserNode. It does not reuse the SWE's status-attribute probe.

| # | Starting state | Action | Observed |
|---|---|---|---|
| A | Fresh visit to /ryugu | Click the page, press `a`, press Enter | 0 AudioContexts, status off, `aria-pressed=false` |
| B | A | Press "Sea sound" | 1 context, `running`, output RMS 2.71e-3 (quiet, non-zero), `ryugu-sound=on` |
| C | B, Home open in a second tab | Pocket chip (`aria-pressed=true`), then press it | Palace RMS 0.00 after the release, status off. Home made 0 AudioContexts. |
| D | C | Chip on, then ArrowUp in the palace, then "Back to the surface" | waiting, then RMS 2.98e-3, then a full navigation destroys the document and its context. The handle was invalidated (`page-replaced`), so this probe did not observe `close()` itself. The SWE probe and the unit test cover `close()`. |
| E | `AudioContext` and `webkitAudioContext` deleted | Click the button (forced) and press a key | `unsupported`, `aria-disabled=true`, nothing stored, 0 page errors |

Negative control: in the clone I removed `if (!enabled) stopVoice();` from `app/(ryugu)/_lib/ambience.ts`. `ambience.test.ts` then failed test 7, "Pocket switching it off…", with 15 pass and 1 fail. Restored, it passes 16/16. In the browser, A versus B is the control: the same tap reads no context before the opt-in and a non-zero RMS after.

The acceptance criteria hold on the local production build: silent until enabled, disabled from Pocket, stops when the route is left, and no error without Web Audio. They are **not** observed on otohime.dev.

## Defects

1. **D1, CI red at the delivery (blocking).** Run #452 job `121613911206`, step 9 `npm test`, exit 1. The failing test is unidentified: the raw log needs a signed-in GitHub session (`/checks/121613911206/logs/9` returns 404 anonymously, and the API was rate-limited at 403). The suspects are the commits between the green #449 and #452: 5dcfe98 (pm-270/t-1604: `scripts/probe-browser.test.mjs`, probe scripts, ci.yml timeouts), d476bd9 (pm-249/t-1569: `scripts/verify-deploy.sh`) and 9d65d9c (this delivery). It does not reproduce on Linux arm64 or amd64, so a runner-specific or flaky cause is possible. It is still unattributed, so cause=code.
2. **D2, not delivered.** The live 0740594 lacks 9d65d9c. This follows from D1.
3. **D3, commit identity.** Co-Authored-By trailers on 9d65d9c and 239a4e6.
4. **Known, not this task's:** the production job's `scripts/vercel-deploy.sh` `inspect exited 1` failed in run #445 and again in #449, while the deploy still landed. That is pm-270's.

## History read (completeness)

- I read the Actions list page 1 (runs #428-#452, 25 runs, newest first). Runs #451, #450, #448, #447, #446, #443, #442, #441, #437 and #436 were cancelled (concurrency replacement). #449 and #445 failed in production. #444, #440, #439 and #438 succeeded. #452 failed in checks.
- For #452, #449, #450, #448 and #447 I read the run summaries, and for #452 and #449 the job step tables. I could not read raw logs, so the cause of D1 is **inconclusive**. Pages after page 1 were not read.

## Deferred / owners

- Identify the failing test (D1). Owner: the fix-cycle SWE. It fails if `gh run view 40334420077 --log-failed` names a test that fails on rerun.
- Deployed check: owner is the next QA after the fix. It fails if otohime.dev/api/health's sha does not contain the new delivery sha, or if `/ryugu` there does not serve `Sea sound: off`.
