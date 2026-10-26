# pm-275 research: why otohime's main CI is red since 5dcfe98, and how to fix it (run-8990)

## Summary

Both halves of the idea are confirmed, with one correction on the second half.

1. checks job, `npm test` on ubuntu-24.04. Reproduced on this lease (Linux, /usr/bin/google-chrome present): `CI=true npm test` fails exactly one test out of 2268, lib/end.test.ts test 11, at `probe-end.sh BASE_URL (unset TMPDIR) should stop at stubbed npm` with `130 !== 1`. Without CI set, or with google-chrome off PATH, the same file passes. Runs 452 (9d65d9c), 453 (c0368d1) and the newest 454 (40337993898, 9ada4e1) all show the checks job red at the step after typecheck. No other test exercises probe-end.sh or probe-motion-signed-in.sh executably, so this one assertion block is the whole red.
2. production job, scripts/vercel-deploy.sh. Runs 445 (40328273755, 5577ec5) and 449 (40330477897, 0740594) both fail the "Deploy and verify the served sha" step with the annotation `Error (inspect exited 1) https://otohime-<id>-otohime.vercel.app`; the verify step is skipped. https://otohime.dev/api/health serves 0740594 now, so run 449's upload went live. The failure is in the readiness gate, not the deploy. Vercel's Git integration is documented as disconnected (README, Deploying), so nothing else could have deployed 0740594.

Delivery state: `git merge-base --is-ancestor 9d65d9c 0740594` exits 1. Code commits on main after the live sha: 9ada4e1, c0368d1, 9d65d9c, d476bd9, 5dcfe98. All need a green checks job and a green production job to ship.

## 1. Mechanism of the runner-only npm test failure

lib/end.test.ts:319-339 runs scripts/probe-end.sh in BASE_URL mode against a local HTTP server that answers 200, with a stub `npm` first on PATH, inheriting process.env (so CI=true on the runner), under execFile(..., { timeout: 10_000 }).

scripts/probe-end.sh:211 (added by 5dcfe98) branches: if CI is non-empty and google-chrome is on PATH, it unsets PW_PREFIX, prints `# browser: runner ...` and installs nothing; otherwise it runs `npm i playwright@1.64.0` (the stub npm). On the runner, and on this lease, the first branch runs, the stub npm is never called, and the script continues into `node scripts/probe-end.mjs`, which launches real Chrome against the busy stub server. After 10 s execFile sends SIGTERM; the script's `trap 'exit 130' INT TERM` turns that into exit 130, so the first case fails with 130 !== 1 (10.8 s per case). macOS leases and node:22 containers have no google-chrome, take the else branch, and pass: that is why QA saw 2261/2261 green locally.

Direct runs of the script with the stub npm against a live local server:
- CI=true, google-chrome on PATH: runner branch, killed by the bound (130 under execFile), prints `# browser: runner ...` then runs probe-end.mjs.
- CI unset, google-chrome on PATH: installer branch, exit 1, `RESOLVED_TMPDIR=/tmp`.
- CI=true, PATH without google-chrome: installer branch, exit 1, `RESOLVED_TMPDIR=/tmp`.

### Fix (test only; keep 5dcfe98's no-installer behaviour in CI)

Change lib/end.test.ts only, two parts, both proven here:

- In the stub-npm loop add `delete ciEnv.CI;` next to `delete ciEnv.PORT;`. The installer branch is then taken on every host, the stub npm prints RESOLVED_TMPDIR=... and exits 1, exactly what the assertions expect. TMPDIR resolution (the thing under test) happens at probe-end.sh:36-39, before the branch, so nothing is lost. Update the comment to say why CI is unset.
- After the loop, inside the same try, add one deterministic runner-branch case: write a fake `google-chrome` (`#!/usr/bin/env bash` + `echo "Google Chrome 999.0.0.0"`) and a fake `node` (`echo "STUB_NODE $*"; exit 7`) into the same binDir, run probe-end.sh with `{ ...baseEnv, CI: "true", BASE_URL: http://127.0.0.1:<busyPort>, PATH: binDir first }`, and assert: exit code 7; stdout matches `^# browser: runner Google Chrome 999\.0\.0\.0 with the repo's playwright-core; nothing installed$` (multiline); stdout does not match `RESOLVED_TMPDIR|npm i playwright`; stdout matches `^STUB_NODE .*scripts\/probe-end\.mjs$`. In BASE_URL mode the script's only `node` call is that final hand-off (pgq is local-mode only) and readiness uses real curl, so the fake node is safe.

Patched file results (whole lib/end.test.ts): 11/11 pass with CI=true and real google-chrome on PATH (runner shape); 11/11 with CI unset and PATH without google-chrome (macOS lease shape); 11/11 with CI=true and PATH without google-chrome (node:22 container shape). `npm run lint` on the patched tree: 0 errors, warnings identical to the clean tree. No change to probe-end.sh, probe-browser.mjs or probe-motion-signed-in.sh: no unit test runs probe-motion-signed-in.sh (lib/motion.test.ts only reads it), and `CI=true npm test` had no other failure.

## 2. Mechanism of the production job's red inspect step

scripts/vercel-deploy.sh:85 runs `npx vercel@64 inspect "$url" --wait --timeout 6m --logs` under a 420 s bound; on non-zero it re-reads `npx vercel@64 inspect "$url"` and takes the first word matching (ready|building|queued|initializing|error|canceled|cancelled) as the state (line 92). Both runs reported `Error (inspect exited 1)`.

From the vercel@64.7.0 bundle in this lease's npx cache (commands-bulk.js, inspect handler):
- Exit code is `timedOut ? 1 : exitCode(readyState)` with `exitCode(state) = state === "ERROR" || state === "CANCELED" ? 1 : 0`. The wait loop polls the deployment every 250 ms until the state leaves QUEUED/BUILDING/INITIALIZING (upstream is-deploying.ts). Any thrown error (auth, 404, 429, network) also exits 1 and prints `Error: ...`.
- With --logs, a successful inspect prints only `status ● Ready`. Without --logs it prints "Fetched deployment ... in <scope>", General, id, name, target, then `status ● Ready`. For a READY deployment nothing before the status line contains the word "error", so the re-read's first match being `Error` means the re-read failed too (an `Error: ...` line) or the state really was ERROR.
- The deployment's own URL is behind Vercel Authentication (both otohime-rcix516b1-otohime.vercel.app and otohime-8vfgwc6u4-otohime.vercel.app answer 302 to vercel.com/sso-api), job logs need sign-in, and the anonymous REST API answers 403, so the exact message cannot be read from this lease.

Failure classes that fit "both inspect calls fail at once, the deploy itself succeeded, the deployment goes live":
- A token/scope error in inspect's context lookup: inspect calls getContextName (user and team lookup) before fetching the deployment, which `deploy --prebuilt` with VERCEL_ORG_ID/VERCEL_PROJECT_ID does not depend on the same way. A public repo (axolotl-logic/project-buddy PR 152, October 2026) hit exactly this: `vercel inspect --wait` failed with `User not found` right after a successful `vercel deploy` with the workflow's VERCEL_TOKEN, and replaced it with `GET /v13/deployments/<host>?teamId=...` polling.
- API errors during the 250 ms polling loop (CLI 429s in CI are documented in Vercel community thread 14173) or a brief 404 for a just-created host.

A real ERROR state is excluded in practice: the production alias moved to the uploaded deployment (0740594 is live) and Vercel does not alias an errored deployment. The re-read parser at line 92 compounds the problem by reporting a CLI `Error:` line as a confident deployment state.

### Fix (recommended): stop gating on vercel inspect

Keep 5577ec5's bounded structure and `fail` annotations, drop the inspect gate, and let the served sha be the gate:
1. Upload synchronously under the bound: `bounded "$UPLOAD_TIMEOUT" npx vercel@64 deploy --prebuilt --prod --archive=tgz` (run 444's command, which waits for READY through the CLI's own deploy path and was green for weeks). UPLOAD_TIMEOUT about 540 s. Keep the one retry only on a fast failure with no URL; a timeout or non-zero exit that printed a URL is logged, not fatal.
2. Then poll $HEALTH_URL for `"sha":"$GITHUB_SHA"` long enough to cover alias propagation: about 18 attempts 10 s apart instead of 3. This loop already exists at lines 100-109; only the budget changes. Green means the sha is served; red names the last body.
3. Optional diagnostics after a non-zero deploy: `npx vercel@64 inspect "$url" >&2 || true`; if a state line is wanted, read only `grep -E '^\s*status'`. Never derive the verdict from it.
4. scripts/vercel-deploy.test.sh: "healthy deploy" expects `deploy --prebuilt --prod --archive=tgz` and no inspect call; "hanging deploy" now continues to the health check (hang + healthy body exits 0 inside the bound, hang + other sha exits non-zero with `::error ... does not report`); drop or repurpose the hang-inspect and error-inspect cases; keep fail-once, fail-twice, fail-with-url, other-sha, unreachable and missing-GITHUB_SHA. It runs in the checks job, so the runner's GNU timeout is exercised.
5. ci.yml needs no change: the production job already runs verify-deploy.sh afterwards with the ancestry rules, and its 18-minute timeout covers about 2 min setup, 9 min deploy bound, 3 min health poll and the verify step.

Second choice, if the gate must know the deployment state: poll https://api.vercel.com/v13/deployments/<host>?teamId=$VERCEL_ORG_ID with `Authorization: Bearer $VERCEL_TOKEN` every 10 s (jq .readyState) until READY/ERROR/CANCELED, bounded at 7 min, with a VERCEL_API base-URL override so the test can point it at a local fake server. It avoids getContextName and the 250 ms loop but is more code and still needs the health gate.

## 3. Proposed tasks (build contracts)

Task A (checks job): apply the lib/end.test.ts change in section 1. Verification: `CI=true npm test` with google-chrome on PATH passes 2268/2268; `npm test` with PATH stripped of google-chrome passes; `npm run lint` 0 errors. Commit as Otohime <quiinthieu@gmail.com> by exporting GIT_AUTHOR_NAME/EMAIL and GIT_COMMITTER_NAME/EMAIL (the lease exports Claude Code values that beat `git -c`), no Co-Authored-By trailer, subject `pm-275/<task>: ...`.

Task B (production job): rewrite scripts/vercel-deploy.sh and scripts/vercel-deploy.test.sh per section 2, items 1-4. Verification: `bash scripts/vercel-deploy.test.sh` prints `# all checks passed`; ci.yml unchanged.

Both can land in one push (one CI run), since the production job only runs after a green checks job. Done: that run's checks job green through npm test, the production job green, and /api/health serving a sha for which `git merge-base --is-ancestor 9d65d9c <sha>` exits 0. Judge the deploy by ancestry, never by an exact sha: a newer push replaces the pending run.

QA note: a run can be read without auth from https://github.com/quiinthieu/otohime/actions/runs/<id> (annotations in the page) and .../job/<id> (data-conclusion per step, in step order). Step logs need sign-in.

## 4. Evidence index

- Reproduction on this lease: `CI=true node --test lib/end.test.ts` gives `not ok 11 ... 130 !== 1`, 10791 ms. `CI=true npm test`: 2268 tests, 2267 pass, 1 fail (the same test).
- Live: curl https://otohime.dev/api/health = {"ok":true,"sha":"074059495faf4bee48e8f655584dfd4487089b41"}.
- Run pages: 40328273755 (445, 5577ec5) and 40330477897 (449, 0740594) carry the annotation `inspect exited 1) https://otohime-rcix516b1-otohime.vercel.app` and `...-8vfgwc6u4-...`; production job step 8 failure, verify skipped. 40334420077 (452), 40335459968 (453), 40337993898 (454, 9ada4e1): checks job, 8 steps success then failure at npm test.
- vercel@64.7.0: `inspect --help` says --logs "Prints the build logs instead of the deployment summary" and --wait "exits 1 if --timeout is reached first"; the bundle shows exitCode(state) and the 250 ms poll.
- Sources: https://github.com/axolotl-logic/project-buddy/pull/152 , https://community.vercel.com/t/vercel-cli-error-too-many-requests/14173 , https://raw.githubusercontent.com/vercel/vercel/main/packages/cli/src/util/deploy/is-deploying.ts

Artifact: the same text is at $HOME/shared/artifacts/answer.md on the lease (/shared is not writable here); the verified test diff is at /tmp/end-test.patch on the lease only.
