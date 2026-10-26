# pm-277 research (run-9011): otohime main lane red, pm-268 blocked — one push, one owner

## Answer in brief

Nothing has been fixed yet, and nobody is currently fixing it. Both defects named in the idea are real and still on main at aa14129 (origin/main, 2026-10-26 14:38Z). Nine code commits sit undeployed behind the live sha 0740594: 5dcfe98, d476bd9, 9d65d9c, c0368d1, 9ada4e1, 658f6fc, c1b26f1, c121b20, ae6573a. The newest main run 40340641001 (ae6573a) shows the checks job (121634081296) with nine steps green, the tenth red and twelve skipped; by `.github/workflows/ci.yml` step order the tenth step is `Run npm test`. The production job did not run.

Recommendation: pm-277 proposes **no software-engineer task**. One push, carried by **pm-275** (it already holds the reproduced mechanism and a proven patch in rep-5269), fixes both defects in three files: `lib/end.test.ts`, `scripts/vercel-deploy.sh`, `scripts/vercel-deploy.test.sh`. pm-276 and pm-277 resolve on that push. pm-270/t-1605 is **not** re-run (its decider answer on esc-419 says so); its contract's "on failure print ::error and stop" item is superseded by the policy decision recorded in this run, so pm-270 reconciles rather than reverts. pm-277's own work is board-side: once the live sha contains c121b20, resume pm-268 with t-1600 going straight to QA and t-1601 re-running its green gate on a lease that can reach Google Fonts.

## Board state that matters (read at 14:45Z)

| Who | Status | What it means for this lane |
|---|---|---|
| pm-270/t-1605 | `ready`, delivered 5577ec5, esc-419 answered "do not re-run, do not rewrite the script" | The named owner is told not to touch the file. |
| pm-259/t-1583 | done, c1b26f1 | Added the escaped diagnostic, the status-field-only state parser and `workflow_dispatch`; kept and codified the stop-before-health policy in the fixture `failed inspect stops before health even for a matching sha`. |
| pm-268/t-1600 | `running`, lease run-9005 until 14:51Z, prompt `fix_plan_run-8961.md` | That fix plan tells the Pocket engineer to make `vercel-deploy.sh` continue to the health check. Nothing from run-9005 has landed (last change to the script is c1b26f1). If it lands, it is the same policy as below; rebase on it, do not revert. |
| pm-268/t-1601 | `ready`, c121b20 on main, ver-3582 fail (font fetch), ver-3584 pass on another lease | Blocked only by the lane; see item 3. |
| pm-275 | `drafting`, 0 tasks, research rep-5269 (run-8990) | Reproduced defect 1 on Linux with Chrome, proved the test-only patch, recommended health-gating the deploy. |
| pm-276 | `drafting`, 0 tasks, 0 reports | Same idea, nothing yet. |
| pm-277 | this run | Same idea again. |

## Defect 1: `npm test` red on ubuntu-24.04 only (since 5dcfe98)

Mechanism, confirmed from the code and by pm-275's Linux reproduction (`lib/end.test.ts` test 11, `130 !== 1`, about 10.8 s per case):

- `lib/end.test.ts:319-339` runs `scripts/probe-end.sh` in BASE_URL mode with a stub `npm` first on PATH and `{ ...process.env }`, so `CI=true` is inherited on the runner.
- `scripts/probe-end.sh:211` (added by 5dcfe98) takes the runner-Chrome branch when `CI` is set and `google-chrome` is on PATH: it never calls `npm`, prints `# browser: runner ...` and hands off to `node scripts/probe-end.mjs`, which launches real Chrome against the stub server. `execFile`'s 10 s timeout sends SIGTERM; the script's `trap 'exit 130' INT TERM` makes the exit 130, not the expected 1.
- macOS leases and node:22 containers have no `google-chrome`, so they take the installer branch, hit the stub npm and pass. That is why every local gate was green while the runner was red. `lib/end.test.ts` has not changed since 15fd171; no fix has landed.

Fix (test only, no change to `probe-end.sh`, `probe-browser.mjs` or `probe-motion-signed-in.sh`): in the stub-npm loop add `delete ciEnv.CI;` beside `delete ciEnv.PORT;` (TMPDIR resolution, the thing under test, happens at `probe-end.sh:36-39` before the branch), and add one deterministic runner-branch case with a fake `google-chrome` and a fake `node` in the same bin dir asserting the `# browser: runner ...` line, no `RESOLVED_TMPDIR`, and the hand-off to `probe-end.mjs`. pm-275 proved this 11/11 in all three host shapes; `CI=true npm test` had no other failure. Verification for the build contract: `CI=true npm test` with google-chrome on PATH exits 0 on a Linux lease; `npm test` with PATH stripped of google-chrome exits 0; `npm run lint` 0 errors.

## Defect 2: production job fails at `Deploy and verify the served sha` even when the sha is live

What the Vercel CLI actually does (read from `packages/cli/src/commands/inspect/index.ts` on vercel/vercel main): the exit code is `exitCode(deployment.readyState)`, which is 1 only for `ERROR` or `CANCELED`; argument errors, `NOT_AUTHORIZED`/`TEAM_DELETED` scope errors return 1; any other thrown error (user/team lookup, 404 for a fresh host, 429, network) is rethrown and the CLI exits 1 with an `Error: ...` line. On `--wait` timeout it warns and returns the current state's code, so a still-building deployment exits 0. A READY deployment never produces exit 1 by itself.

Runs 40328273755 (5577ec5) and 40330477897 (0740594) failed both inspect calls seconds apart and still went live and aliased (0740594 serves now; `git merge-base --is-ancestor 0740594 c121b20` exits 0). So the exit was a repeated CLI error, most consistent with `inspect`'s scope lookup (user and team) failing for the workflow token while `deploy --prebuilt` with the pulled `.vercel/project.json` succeeds; a public precedent is axolotl-logic/project-buddy#152 (`User not found` from `vercel inspect --wait` right after a successful deploy). 5577ec5's word-grep parser then reported the `Error:` line as the deployment state "Error". The exact message is unreadable from a lease (step logs need sign-in, anonymous API 403); c1b26f1's escaped diagnostic will publish it on the next production run, which only happens after defect 1 is fixed.

Policy decision (recorded): **the served sha is the gate; inspect is diagnostic.** Reasons: it is what the acceptance criterion already says, it is the smallest diff on top of c1b26f1, and it stays correct even if the CLI error is later understood. Concretely in `scripts/vercel-deploy.sh`:

1. Keep the bounded upload, the single no-URL retry, `inspect --wait` under `READY_TIMEOUT`, the state re-read and the escaped `diagnostic` text from c1b26f1.
2. On nonzero inspect, `log` the diagnostic (and keep it in a variable) instead of calling `fail`, then fall through to the health poll.
3. Raise the health budget to cover alias propagation after a slow ready: `HEALTH_ATTEMPTS` default 18, `HEALTH_POLL_DELAY` 10 (about 3 min), still overridable.
4. On health failure, `fail` with the inspect state (or `unknown`), the inspect exit code, the URL, the last body **and** the retained diagnostic, so the annotation still names the phase.

`scripts/vercel-deploy.test.sh` changes to match: invert `failed inspect stops before health even for a matching sha` to `failed inspect with a healthy exact-sha body exits 0 and keeps the diagnostic in the log`; add `failed inspect with another sha fails with the inspect state and the last body`; the hang-inspect (`Building after 2s`) and `unavailable-inspect` cases assert the annotation on an other-sha body instead of a healthy one; `error-inspect` with another sha still prints `Error (inspect exited 1)`. Everything else (upload cases, healthy, other-sha, unreachable, missing GITHUB_SHA) is unchanged. `ci.yml` needs no edit: the production job already runs `verify-deploy.sh` afterwards and its 18-minute budget covers about 2 min setup, 5 min upload bound, 7 min ready bound, 3 min health and the verify step.

Rejected alternative: pm-275's "drop inspect, synchronous deploy" is also sound but is a larger rewrite of both files and loses c1b26f1's diagnostics; the engineer may take it if the health-gated form proves awkward, but one of the two must be chosen before the push, and both satisfy the same fixture semantics (health decides).

## Item 3: t-1601's false red on lease ebf2c141

ver-3582 (c121b20, Linux lease ebf2c141, 14:32Z) passed unit (2274), typecheck and lint and failed only the real-browser item, whose `next build` died in Turbopack's `NextFontGoogleFontFileReplacer` with `Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'` and `next/font/google queries have exactly one entry` for `caveat_b717df3e.module.css` imported by `app/(structures)/layout.tsx`. ver-3584 on lease 8d5dc6ca built the same tree three minutes later and passed, as did the macOS gate. That signature is what Turbopack emits when the build cannot download the font file from fonts.gstatic.com; ten root layouts import `next/font/google`, so any gate lease without that egress fails the same way. Treat it as cause=environment and re-run on another lease; a platform-side readiness probe (`curl -fsS https://fonts.gstatic.com` on the lease before a gate) would stop the false fix cycle. Self-hosting the ten faces with `next/font/local` would remove the dependency but adds font binaries to the repo, which is outside this lane and the no-binaries rule; not recommended here. Recorded as a global lesson.

## Done condition and how to judge it

One push on main (by pm-275) whose CI run shows the checks job green through `Run npm test` and `bash scripts/vercel-deploy.test.sh` on ubuntu-24.04, and the production job green. Then https://otohime.dev/api/health reports a sha for which both `git merge-base --is-ancestor 074059495faf4bee48e8f655584dfd4487089b41 <sha>` and `git merge-base --is-ancestor c121b20 <sha>` exit 0 (any descendant of the fix commit satisfies both). Judge by ancestry, never by the exact fix sha: a newer push replaces the pending run and report-only pushes never run. Runs can be read without auth at `github.com/quiinthieu/otohime/actions/runs/<id>` and `.../job/<id>` (step `data-conclusion` in order).

Then pm-268 resumes: t-1600 skips the software engineer and goes to QA (its product is already live and QA'd at 0740594; the only failed item was the pipeline); t-1601 re-runs its green gate on a lease with Google Fonts egress, then QA.

## Non-goals honoured

No Pocket console or Riso heading code changes, no history rewrite, no deploy from an agent, no git push from this research run.

## Evidence index

- Live: `curl https://otohime.dev/api/health` → `{"ok":true,"sha":"074059495faf4bee48e8f655584dfd4487089b41"}` at 14:43Z.
- `git log 0740594..origin/main -- . ':!projects' ':!*.md'`: the nine undeployed code commits above.
- Run page 40340641001 / job 121634081296: 9 success, 1 failure, 12 skipped, 3 post-steps success.
- `scripts/vercel-deploy.sh` (c1b26f1): `fail` at the inspect branch before the health loop; `scripts/vercel-deploy.test.sh`: the opposing fixture.
- pm-259 run-8968 artifacts `deploy-red.log` / `deploy-green.log` and `failed_annotations.txt` (`Error (inspect exited 1) https://otohime-rcix516b1-otohime.vercel.app`).
- ver-3582 stderr_tail (font error) and ver-3584 pass; rep-5269 (pm-275 research); esc-419 answer on t-1605.
- Vercel CLI source: https://raw.githubusercontent.com/vercel/vercel/main/packages/cli/src/commands/inspect/index.ts ; precedent https://github.com/axolotl-logic/project-buddy/pull/152 ; Turbopack font reports https://github.com/vercel/next.js/discussions/81721

Artifact: the same text is at $HOME/shared/artifacts/answer.md on lease 67fa7310 (/shared is a read-only filesystem on this macOS lease).