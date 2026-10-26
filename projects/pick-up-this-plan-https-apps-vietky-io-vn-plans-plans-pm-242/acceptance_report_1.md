---
plan_id: pm-258
run_id: run-9086
kind: acceptance_report
verdict: pass
cycle: 1
---

# pm-258 Keyless Pocket Presence: acceptance, cycle 1

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| Fresh `git clone` of delivery `cfd9714ec9e6813e21085284443ceb46a96b5889` at `/tmp/acc-9086` (space-free), `npm ci` exit 0, Node v22.23.3, darwin arm64, 12 CPUs | `node scripts/check-gate-closure.mjs` | Exit 0 in 3 s. One `otohime.gate-closure.v1` JSON document: `runner=real`, `certified=true`, `local_controls=pass`, `external_evidence=inconclusive`, eight `not_proven` items, `git_sha` = cfd9714, `dirty=false`. Preflight: playwright-core 1.64.0, pg 8.23.1, embedded-postgres and @embedded-postgres/darwin-arm64 17.10.0-beta.17, each locked = installed = imported; postgres, initdb and pg_ctl `--version` report 17.10. e2e-runner 4/4, end 12/12, urashima 10/10; all seven named required regressions pass | `healthy.json`, below |
| Same JSON | I recomputed SHA-256 for all 24 `FINGERPRINT_PATHS` with `shasum`, and the `db/migrations` directory hash with my own Python walk | 0/24 mismatches. `combined` recomputes to `e4767b0725bbf6092663f70a6888e0d55689f2d63ead0ae1b516095db9cfd73b`. All 24 hashes match the table in gate-closure.md. The fingerprint is platform independent: the SWE's linux x64 run gives the same `combined` | independent hash script |
| Isolated clone `/tmp/acc-9086-serial` | Remove `"--test-concurrency=1", ` from `scripts/e2e.mjs` (hash becomes `8d81865f…6237`) and run the CLI | **Exit 1**, `certified=false`. Failures: `e2e-runner: exit 1`, `1 failed`, `3/4 passed`, `serial_vs_parallel: fail`. `dirty_paths` names `scripts/e2e.mjs` | `neg-serial.json` |
| Same copy | `git checkout scripts/e2e.mjs` (hash back to `c34edb6b…0f96`) and rerun | Exit 0, `certified=true` | `neg-serial-restored.json` |
| Isolated clone `/tmp/acc-9086-missing` | Rename the required waterline test title in `lib/urashima.test.ts` (the test still passes under its new name) | **Exit 1**, failure `urashima: waterline_structure: missing`. A green child does not certify when a required regression is absent | `neg-missing.json` |
| `git archive` copy with no `.git` | Run the CLI | **Exit 1**, `checkout: no git identity`. `git_sha=null`; the enclosing repo's commit is not borrowed | `neg-nogit.json` |
| Isolated clone `/tmp/acc-9086-hang` | Append a test to `lib/urashima.test.ts` that never settles and holds an interval | **Exit 1 after 180 s** (`duration_ms` 180012, `timed_out=true`, `timeout_ms=180000`). Failures: `timed out`, `exit 1`, `malformed TAP: no complete summary`. Afterwards, anchored `pgrep` finds no leftover node closure child and no postgres | `neg-hang.json` |
| Delivery clone | `npm test`; `npm run lint`; `npm run typecheck`; `npm run build` | 2363/2363 pass, 0 fail/skip. Lint exit 0 (0 errors, 10 existing warnings). Typecheck exit 0. Build exit 0, BUILD_ID `nifKd6yJ64SOX0T-9RFms`. `lib/gate-closure.test.ts` run alone with TAP: 8/8, including test 8 (the serial mutation, not skipped on 12 CPUs) | `npm-test.log`, `lint.log`, `typecheck.log`, `build.log` |
| Post-build tree (`content/history.json` regenerated) | Rerun the CLI | Exit 0, `dirty=true`, `dirty_paths=[content/history.json]`, the same `combined`. The dirty tree is reported, as documented | `post-build.json` |
| Current main `98ff28cd58389fa912dbe0e4e2dde95eddb9e3c4` (adds the pm-269/t-1588 Kame fixture change) | Rerun the CLI on HEAD | Exit 0, `certified=true`, the same `combined`. Kame is not in the fingerprint because it is outside this tool's scope | `head.json` |
| GitHub Actions, public API | Read run 40397362917 (cfd9714) once | Checks job 121833825732: npm ci, lint, typecheck, **npm test (includes lib/gate-closure.test.ts on ubuntu)**, build, camera verifier and migrations succeed. E2E was in progress at 20:47:40Z; footer steps pending. Not observed to completion | API capture |
| Production | GET https://otohime.dev/api/health and `/`, 20:44:40Z | 200 `{"ok":true,"sha":"01dfe6b0e79fb286927057cccadfe29da83214cb"}`. The rendered `<meta name="build-sha">` matches. `merge-base --is-ancestor`: 841ca69, 15fd171, 3351f78 and 9ddd084 → live all exit 0. **cfd9714 → live exits 1** (live is 10 commits behind). `/api/now-playing` → spotify-off/steam-off, null track/game | curl capture |

## Verdict

**Pass, limited to the kept scope (t-1623, local gate-closure tooling).** After the 2026-10-26T12:54:21Z split, pm-258 keeps only t-1623; superseded t-1564 is not judged. On the built artifact (repository at cfd9714), I demonstrated that an agent can run one command that:

- executes the real local repair regressions,
- emits fingerprinted v1 JSON that leaves external evidence inconclusive,
- exits nonzero on every failure mode I injected.

**Integration deployed:** no. The CLI is a developer tool and cfd9714 is not in production. That is acceptable for this scope: the deployed site does not ship the CLI, and the tool never claims deployment. **Execution demonstrated:** yes, locally, plus unit/lint/types/build in GitHub CI. **Waiting for capacity:** none. **Product delivered for the idea's keyless presence:** no. That scope moved to pm-272 (t-1565 ListenBrainz is ready; t-1566 Lanyard comes after it). Live presence still reads spotify-off/steam-off, so personalized presence remains undelivered and owned by pm-272.

## Identities

- Delivery commit: `cfd9714ec9e6813e21085284443ceb46a96b5889`. Author and committer: Otohime <quiinthieu@gmail.com>. No Co-Authored-By trailer.
- Board: green gate `ver-3611` (run-9085, cfd9714, 5/5 pass). Red gate `ver-3610` at be2ce22 failed as expected (CLI missing; its build also hit the known stale Turbopack font cache).
- Delivery task `7537a7d9-7ce8-462b-b351-1e2e751da9e4`: COMPLETED, exit 0, `callbackState=delivered`, 1 attempt. run-9080 `callback_apply_failures=0`.
- author.txt: manifest only, 44 bytes, SHA-256 `7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada` (the same hash as earlier Otohime deliveries). The bytes are unread and stay **inconclusive**; Git identity was checked separately.
- Delivery run profile: run-9080 `claude-opus-high`, model `claude-opus-5-5`, effort `high`, account `claude-kqviet`, worker `avietidol-z490`.
- Acceptance: run-9086, Claude Opus 5.5 (`claude-opus-5-5`), effort high, macOS arm64 lease.

## Real/fake boundary

- **Real:** nested Node test children, real embedded Postgres 17.10 started by the e2e-runner lifecycle regression, locked modules and binaries, and real git.
- **Fake:** the fake child-runner port in tests 1–5 of `lib/gate-closure.test.ts` (it reports `certified=false` by design), and my injected test-file mutations.
- **Not covered:** no browser, no CI history read by the tool, no deployment.

My negative controls are my own edits on independent copies; they did not rerun the SWE's test-8 script.

## History and limits

- **Task-manager:** FAILED page 25/1128 and COMPLETED page 25/6376 (bounded, incomplete). PENDING 1/1, an unrelated maintenance self_update. The FAILED sample has no pm-258 t-1623 entry; the pm-258 failures it does contain are older push_not_on_main rows (run-8808, run-8712).
- **GitHub:** 15/457 main runs read. After cfd9714's parent: e21f832 failed E2E (`e2e/bottle-ui.test.ts:104`, Bottle pointer area) and 45c8d92 failed E2E (`e2e/kame.test.ts:100`, flowing clock `'swim' !== 'pet'`). Earlier history is unread.

## Retained defects and deferred checks (not waived, outside the kept scope)

| Item | Evidence | Owner / failure condition |
| --- | --- | --- |
| Kame flowing-clock fixture | 40388684010/121803631622 at 45c8d92 `e2e/kame.test.ts:100`; also 40378894466/121769441639 | pm-269/t-1588 (98ff28c now on main), coordinated by pm-270/t-1606. Fails if line 100 reds again on sources that contain 98ff28c |
| Bottle E2E | 40395335524/121826753100 at e21f832 `e2e/bottle-ui.test.ts:104` | pm-269 Bottle owner (latest Bottle commit 45c8d92 is pm-269/t-1588). Fails while it reproduces |
| cfd9714 CI E2E/footer | 40397362917/121833825732 in progress | Shared-lane owners pm-275/t-1617 and pm-270/t-1604. Not observed; the tool's scope does not depend on it |
| Production carries cfd9714 | live 01dfe6b, ancestry exit 1 | pm-275/t-1617 deploy recovery. Not required for this tooling |
| Riso footer integration, Vercel, historical unit reds, footer 40277523350, navigation/hydration | as listed in gate-closure.md | Owners unchanged, per plan revision 2 |
| author.txt bytes | manifest above | Platform artifact owner. Inconclusive |
| Personalized keyless music/game | `/api/now-playing` spotify-off/steam-off | pm-272 (t-1565, t-1566). Undelivered until observed live |

No application source was edited, nothing was deployed and no workload was mutated. Temp copies live only under `/tmp/acc-9086*`.
