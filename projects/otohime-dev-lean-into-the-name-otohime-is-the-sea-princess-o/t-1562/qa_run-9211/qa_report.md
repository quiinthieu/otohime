# QA report — pm-271/t-1562 Add opt-in palace sound (run-9211)

Verdict: **pass**. Cited (deployed) sha: `b4e142ad37c76abdc496c14afb4ac18b2b5c03ba`, which contains the delivery cf9e3e5.

QA agent: claude-opus-5-5 (Opus 5.5), quality_engineer role, effort as set by the run profile. The lease is macOS arm64.
Gates and probes ran on Node v22.23.4 (official darwin-arm64 tarball, SHA256 verified), because the lease's
`/usr/local/bin/node` is 22.12.0. They ran in a space-free clone `/tmp/oto-9211` at `b4e142a`, after `npm ci` against the
committed lock.

## Identities

| what | value |
| --- | --- |
| delivery | `cf9e3e5c2a09ba2f1552d525730ba357026ac791` (run-9207, code), plus `b4e142ad37c76abdc496c14afb4ac18b2b5c03ba` (report only: author.txt, commits.txt). The earlier delivery `9d65d9c` (run-8964) is already in 103f0c5. |
| author | cf9e3e5 and b4e142a are both authored and committed by `Otohime <quiinthieu@gmail.com>`, and `git log -1 --format=%B` has 0 `Co-Authored-By` lines. `t-1562/author.txt` names cf9e3e5 with the same identity and "(no trailers)", which matches plan.commit_identity. |
| green gate | `gate=green sha=b4e142a status=pass` (npm test 2507/2507, lint exit 0, build exit 0) |
| code between production and delivery | `git diff 103f0c5 b4e142a` outside `projects/` touches exactly `app/(ryugu)/_components/ambience.tsx`, `app/(ryugu)/_lib/ambience.ts` and `app/(ryugu)/_lib/ambience.test.ts` (cf9e3e5) |
| production before deploy | `https://otohime.dev/api/health` → `103f0c5…` (`health-before.json`). `git merge-base --is-ancestor cf9e3e5 103f0c5` exits 1: the bfcache fix was not live at QA start. |
| deploying CI | GitHub Actions CI run #507 `40485335471` at b4e142a (push 10:01Z), **completed successfully** at about 10:25Z. Job `checks` 122125584886 succeeded. Job `production` 122133865717 succeeded: every step is `success`, including "Deploy and verify the served sha" and "Verify the deployed sha, terminal and press". Jobs `preview` 122125586828 and `cleanup` 122125586968 were skipped, as they are on a push. |
| production after deploy | `https://otohime.dev/api/health` → `{"ok":true,"sha":"b4e142ad37c76abdc496c14afb4ac18b2b5c03ba"}` at 10:23Z (`health-after.json`). `git merge-base --is-ancestor cf9e3e5 b4e142a` exits 0. |

## Contract verification (this lease, tree b4e142a)

| check | result |
| --- | --- |
| `npm test` | exit 0: 2507 tests, 2507 pass, 0 fail (`npm-test.tail.log`). The sound's tests are among them: ambience ok 840–854 (including 849, the new bfcache test), Pocket chip ok 2048, and `sound` switch ok 2332. |
| `npm run lint` | exit 0: 0 errors and the 10 warnings that were already there, none in t-1562 files (`lint.tail.log`) |
| `npm run build` | exit 0 after `rm -rf .next`. `/ryugu` is static (○). `history:index` gave 200 of 627 commits; the rewritten `content/history.json` was restored and is not committed (`build.excerpt.log`). |
| determinism | `ambience.test.ts` and `palace-sound.test.ts` ran alone 5 times, with 22/22 every time (`determinism.log`) |

## Independent user-path probe in real Chrome

`qa_run-9211/probe.mjs` is new for this run. It is not the SWE's `probe-sound.mjs` or `probe-bfcache.mjs`, and not
`qa_run-8975/probe-signal.mjs`.
- It drives Google Chrome (`/Applications/Google Chrome.app`, channel `chrome`) through the repo's locked
  playwright-core, with `--autoplay-policy=user-gesture-required`.
- It measures the real Web Audio output: every `connect()` to a destination is mirrored into an `AnalyserNode`, so
  "silent" and "playing" are RMS readings, not status attributes.
- It drops Playwright's default `--disable-back-forward-cache`. That is why this probe, unlike the SWE's, sees a real
  bfcache restore (`pageshow persisted=true`). Back after a restore fires no `load`, so it waits on `commit`.

Local `next start` of the b4e142a build, with CI's `BETTER_AUTH_SECRET` placeholder from `ci.yml`
(`probe-local-b4e142a.log`): **PASS, 26/26**.

- **Silent until enabled.**
  - The palace is served off (`aria-pressed=false`).
  - A click and a key elsewhere make 0 AudioContexts.
  - With "on" stored from an earlier visit, a reload shows `waiting` with 0 contexts on load.
- **Enabled.**
  - The button gives one running context with quiet output (RMS 2.64e-3) and stores `on`.
  - With "on" stored, a palace click starts it (RMS 2.98e-3).
- **Pocket.**
  - The Home tab's chip shows the stored on.
  - Pressing it silences the palace tab (RMS 0, status off) and stores `off`.
  - Home never makes an AudioContext, so there is no sound on other routes.
  - A palace click afterwards brings nothing back.
- **Leaving.**
  - After "Back to the surface", the surface makes no context.
  - On return, the context made before leaving is `closed`.
- **bfcache (cf9e3e5).** Back restores the palace from the bfcache (`persisted=true`).
  - The restored button rereads the stored on (`waiting`), and no new context appears before a gesture.
  - A key press plays again (RMS 2.85e-3), and the restored button switches it off.
  - There are 0 page or console errors.
- **No Web Audio** (`AudioContext` and `webkitAudioContext` deleted).
  - The status is `unsupported`, with `aria-disabled=true`.
  - A forced click and a key store nothing, and there are 0 errors.

Production `https://otohime.dev` at **b4e142a**, right after #507 deployed it (`probe-production-b4e142a.log`):
**PASS, 26/26**. Every leg above passed on the live site:
- 0 contexts before opt-in
- RMS 2.64e-3 after the button
- Pocket silences the palace (RMS 0)
- the context is `closed` after leaving
- a real bfcache restore rereads the preference, waits for a gesture, then plays (RMS 2.84e-3)
- no-Web-Audio shows `unsupported` with 0 errors
- 0 page or console errors

## Negative controls

| control | expected | observed |
| --- | --- | --- |
| The same probe against production at **103f0c5**, which is b4e142a without cf9e3e5's 3 code files | the bfcache legs fail, and every other leg passes | exit 1, **FAIL 2** (`probe-production-103f0c5-negative-control.log`). After a real bfcache restore the button stays `off`, and a key press leaves RMS 0, which is the dead button cf9e3e5 fixes. All 24 other checks pass, including Pocket and no-Web-Audio on production. |
| Unit mutation: `ambienceSession.show()` returns at once and never reopens | the bfcache unit test fails | `not ok 11 - back to a palace the browser kept (bfcache)…`, pass 15 and fail 1 (`mutation-control.log`). The source was restored, and `git status` is clean apart from this folder. |

## CI history read (bounded)

- I read the public workflow index HTML (`ci-index-page1.txt`): runs #484–#508, which is page 1 and complete for that
  range. The REST API quota for this IP was 0 until 10:42Z, so per-run API detail was not read.
- I read job and step detail for #507 from its public run and job pages, and #506's total duration (19m48s) for
  comparison.
- #492–#504 failed. They belong to other plans (pm-269 t-1647/t-1648, pm-270 t-1671, pm-257 t-1609, pm-259,
  pm-255), and none touch `app/(ryugu)`. Since #505 and #506 the chain is green, and #507 (this delivery) is green. I
  did not read the failure causes of #492–#504; that is inconclusive and not owned here.
- The delivery's earlier red, #452 (9d65d9c), was attributed by run-9207 to `lib/end.test.ts` `130 !== 1`, fixed on main
  by 17bca22. That is now moot: the delivery's own run #507 passed `checks`, which runs npm test.
- #508 "fix(ci): standardize deployment authors" was in progress at 10:24Z. It is not on origin/main (still b4e142a)
  and not this task's.
- Job logs need sign-in (`gh` is not authenticated on this lease), so pass/fail is read from step conclusions, not raw
  logs.

## Boundaries

- **Real:**
  - Google Chrome's Web Audio graph (RMS from a real AnalyserNode)
  - real bfcache
  - localStorage and cross-tab storage events
  - the locked Next/React build
  - production otohime.dev
- **Fake:**
  - The no-Web-Audio leg deletes the constructors with an init script, which simulates an unsupported browser.
  - The local server uses CI's placeholder auth secret. Without it, local Home throws BetterAuthError and React #441.
    That is a lease artefact, since production Home renders Pocket.
  - The unit tests use the SWE's fake AudioContext. They are supporting evidence only.

## Defects and deferred checks

- Defects in t-1562: none. The bfcache dead-button defect that cf9e3e5 fixes is reproduced on 103f0c5 and absent at
  b4e142a, both locally and on production.
- Deferred: none for this task. Production serves the delivery, and the probe ran on it.
- Noted but not owned here:
  - The lease's Node 22.12.0 cannot run `npm test` (no `stripTypeScriptTypes`). CI uses a current 22.x.
  - The 10 pre-existing lint warnings remain.
  - The causes of #492–#504 are unread.
