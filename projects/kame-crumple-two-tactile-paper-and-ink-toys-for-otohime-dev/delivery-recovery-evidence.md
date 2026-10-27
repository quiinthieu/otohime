# Production diagnostic recovery — pm-259/t-1626, run-9142

Local execution is demonstrated. This delivery does **not** establish production deployment or product delivery. Engineering ends at push; the platform owns the pushed commit's CI and independent acceptance owns live ancestry. No deployed endpoint was queried in this run.

Fresh `main` and `origin/main` initially matched `20035357a972dbc94c7fbc08b45753cc3f8e1b78`. Read `AGENTS.md`, this plan, installed Next 16.4.2 deployment/self-hosting guides, pm-275/t-1617 and pm-270's landed deployment policy. The referenced `docs/claude/software-development.md` and `projects/20260921222547_plan_manager_chief_of_staff_extraction.md` are absent. t-1617 has no delivered rewrite; retain the current asynchronous adapter, upload/inspect bounds, one fast no-URL retry, main-only checks-before-production and all landed feature fixes. CI wiring belongs to t-1624 and is unchanged here.

The explicit assigned fail-closed contract overrides the earlier health-fallback policy: any unsuccessful inspect, including transport failure or timeout, fails before health. A labelled Error/Canceled/Cancelled also fails if the CLI exits zero. A generic `Error: request failed` means **unknown state**, not a labelled deployment Error. One bounded state re-read provides diagnostics, never a rescue. Both original command exits, stderr, ANSI-stripped state and readyStateReason survive in one escaped public annotation. Each CLI diagnostic contributes its last 4,000 bytes; complete output remains in the job log. Upload failures also retain bounded stderr. Existing upload/ready/re-read defaults remain 300/420/60 seconds with process-group cleanup; no retries are added after a timeout or printed URL.

Both adapters previously accepted invalid health identity: substring/regex searches could match malformed JSON, `ok:false` or a nested previous SHA. They now require valid JSON with top-level `ok:true` and a top-level SHA. Deployment requires the exact requested SHA; the read-only verifier preserves existing exact/descendant/report-only ancestry semantics. Stale code and off-branch commits remain rejected before browser execution. No verification command deploys remotely.

## Verification and negative controls

Installed the unchanged lock with `npm ci --no-audit --no-fund` on Node 22.23.3 (522 packages). Real Bash 5.2.21, GNU timeout 9.4, curl 8.5.0, Git 2.43.0, npm 10.9.9 and Node subprocesses execute the scripts. Actual run profile: `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, fleet `avietidol-z490` (run metadata, not today's default).

| Command | Observed assertion evidence |
| --- | --- |
| `bash scripts/vercel-deploy.test.sh` | 47 named assertions, zero failures; positive ready/exact-health command and flag checks, no error annotation on success |
| `bash scripts/verify-deploy.sh --self-test` | 22 named assertions, zero failures; real temporary Git history and marker checks prove rejection skips E2E |
| `npm test` | 2,408 passed, zero failed/skipped/cancelled; 2 suites, 2,390 top-level tests |
| `bash -n scripts/vercel-deploy.sh scripts/vercel-deploy.test.sh scripts/verify-deploy.sh` | exit 0; syntax evidence only. Adapter suite separately asserts these parse and deliberately malformed Bash is rejected |

The adapter test first ran against the original implementation and failed nine assertions, including `failed inspect cannot be rescued by matching health`, `failed inspect never reaches matching health`, zero-exit labelled Error, cancellation and timeout. The final suite retains upload/inspect bounds, child cleanup, exact upload/inspect flags, no retry after URL, alias transition on the second/fifth read, unreachable/wrong health, missing SHA, escaped percent/CR/LF and distinct inspect exits 1/7/124. An oversized real child output control confirms one bounded annotation retaining both diagnostic tails. These are assertions about actual subprocess results and HTTP request counts, not an exit-zero wrapper.

The new invalid-health controls reject unhealthy, nested-SHA and malformed bodies; valid formatted JSON passes. An isolated temporary copy of the verifier with its **old regex restored** reports `self-test: 19 ok, 3 failed`: all three new negative controls incorrectly reached the E2E marker. The repaired verifier reports `22 ok, 0 failed`. Existing negative controls reject stale executable changes and off-branch report-only SHA, and preserve browser failure and missing-import failure. Fixtures never change the host's Chrome or Git configuration.

`npm test` already executes the named workflow assertions `manual recovery runs the same checks and production gates as a main push` and `only production deploys serialize after successful checks, without cancelling the running deploy`. Those require `needs: checks`, main-only dispatch and the unchanged push-main trigger. They are local workflow construction proof that red checks cannot authorize production; GitHub scheduler execution remains an independent CI obligation. No duplicate workflow tests or wiring changes were added.

The board's `expect=exit0` metadata cannot itself express the named-output assertions and cannot turn `bash -n` into a behavioral test. This limitation was recorded as a decision. Evidence above names actual assertions/counts; both shell harnesses also refuse a zero-assertion pass.

## Real CLI construction

With Vercel credential/project variables unset and telemetry disabled, these real npm-resolved commands all exited zero:

```sh
npx --yes vercel@64 --version
npx vercel@64 deploy --prebuilt --prod --archive=tgz --no-wait --help
npx vercel@64 inspect https://fixture.vercel.app --wait --timeout 6m --logs --help
```

Resolved Vercel CLI **64.7.0**, running on Node 22.23.3; Next is the locked **16.4.2**. This exercises real CLI package loading/command construction. Help lists `--wait`, `--timeout`, and `--logs` (logs replace the deployment summary, hence the separate state re-read). Help is not an authenticated deploy/inspect or a production migration. The npm lock is unchanged; Vercel is a CI-pinned major resolved outside that lock. No model artifacts or application assets changed.

Fake boundary: npx/Vercel deployment and inspect responses are fixtures; health payloads come from local Node HTTP servers and E2E is a marker command in the verifier self-test. Bash, timeouts, child cleanup, curl, JSON parsing, imports and temporary Git ancestry are real. Those fixtures establish adapter policy only. No authenticated provider call, production database migration, live feature test or served-identity claim follows from them.

## Bounded history read (2026-10-27 UTC, before push)

All listing/metadata requests below returned HTTP 200. Failure and completed listings are two pages each, `per_page=20`; their `Link` headers advertise additional unread pages. Records can overlap between failure and completed listings. Current listings were read once, not polled.

| Endpoint/scope | Read / advertised | Completeness |
| --- | --- | --- |
| GitHub Actions `status=failure`, pages 1–2 | 40 / 128 runs | incomplete; pages 3–7 unread |
| `status=completed`, pages 1–2 | 40 / 490 runs | incomplete; pages 3–25 unread |
| `status=in_progress`, page 1 | 1 / 1 at 03:58:53Z | complete snapshot: run 40445352898, a7da8e8 |
| `status=queued`, page 1 | 0 / 0 | complete snapshot |
| Selected runs' jobs, page 1, `per_page=100` | 4 / 4 each; no next link | complete for these three runs only |

Read every returned history entry and each selected job/step result. Selected run 40439524623 at a958913 has successful checks (121976229834) and **failed production** (121981152892); run 40441825381 at 79f7813 has successful checks (121983711144) and production (121988544431). The formerly current 40445352898 at a7da8e8 already had successful checks (121995203938) and production (122000364994) when its jobs were read at 04:02:15Z. This is a one-shot metadata observation of older executables, not this delivery's CI or live acceptance. No repeated status watch occurred.

Historical production job [121600218178](https://github.com/quiinthieu/otohime/actions/runs/40328273755/job/121600218178) is failure at `5577ec5c917811277bef59f126d11b58160aa6a6`; setup, install, pull, build and migrate succeeded, and `Deploy and verify the served sha` failed. Historical green production [121590440426](https://github.com/quiinthieu/otohime/actions/runs/40325669520/job/121590440426) is success at `542c62068564fafaf7045560135064cbdb866f91`; it used direct Vercel deploy plus a bare health curl and contained neither repository adapter nor ancestry verifier. Their lock hashes match, but executable/workflow identities differ. That green job does not certify the failing adapter or this repaired executable.

Requested `/actions/jobs/121600218178/logs`, `/actions/jobs/121590440426/logs` and recent failure `/actions/jobs/121981152892/logs`: all **HTTP 403**, JSON message `Must have admin rights to Repository.` No raw failure/runner tail was read. Historical inspect cause remains **unknown**; unread historical logs and unvisited history are explicitly inconclusive. CLI fixture reasons are invented controls, never an explanation of the provider failure. No admin sign-in is necessary for repository-only work; no operator action was requested.

## One-shot read-only acceptance procedure (owner: independent acceptance)

Obtain exact pushed delivery SHAs for t-1624, t-1625 and t-1626 from their authoritative summary reports; do not substitute unrelated green commits. Let those full 40-hex SHAs be `DELIVERY_1624`, `DELIVERY_1625`, `DELIVERY_1626`. Set `RUN_ID` to the existing main CI run that claims to include all four required commits, including `17bca22`. Use current job metadata and health directly, independently of this report:

```sh
set -euo pipefail
: "${RUN_ID:?}" "${DELIVERY_1624:?}" "${DELIVERY_1625:?}" "${DELIVERY_1626:?}"
repo=quiinthieu/otohime
git fetch origin main
gh api "repos/$repo/actions/runs/$RUN_ID" > run.json
jq -e '.head_branch == "main" and .status == "completed" and .conclusion == "success" and (.event == "push" or .event == "workflow_dispatch")' run.json
run_sha=$(jq -er .head_sha run.json)
gh api --paginate "repos/$repo/actions/runs/$RUN_ID/jobs?filter=latest&per_page=100" | jq -s '[.[].jobs[]]' > jobs.json
jq -e --arg sha "$run_sha" '
  [.[] | select(.name == "checks" or .name == "production")] as $jobs |
  ($jobs | length == 2) and all(["checks", "production"][]; . as $name |
    any($jobs[]; .name == $name and .head_sha == $sha and .status == "completed" and .conclusion == "success"))
' jobs.json
# Inspect production steps too: deployment, database migration and final served-SHA verifier must all succeed.
jq -e 'map(select(.name == "production")) | length == 1' jobs.json
jq -e '[.[] | select(.name == "production") | .steps[]] as $s |
  all(["Run npm run db:migrate", "Deploy and verify the served sha", "Verify the deployed sha, terminal and press"][];
    . as $name | any($s[]; .name == $name and .status == "completed" and .conclusion == "success"))' jobs.json
curl -fsS --max-time 20 -H 'Cache-Control: no-cache' https://otohime.dev/api/health > health.json
live_sha=$(jq -er 'select(.ok == true) | .sha | select(test("^[0-9a-f]{40}$"))' health.json)
for observed in "$run_sha" "$live_sha"; do
  git cat-file -e "$observed^{commit}" 2>/dev/null || git fetch origin "$observed"
  git merge-base --is-ancestor "$observed" origin/main
  for required in 17bca22 "$DELIVERY_1624" "$DELIVERY_1625" "$DELIVERY_1626"; do
    git merge-base --is-ancestor "$required" "$observed"
  done
done
git merge-base --is-ancestor "$run_sha" "$live_sha"
# Any newer served code needs its own green run. Only report-only differences may share this proof.
test -z "$(git diff --name-only "$run_sha" "$live_sha" -- . ':!projects/**' ':!*.md')"
```

Save HTTP responses/statuses, pagination completeness, job/step conclusions and SHA/config/lock hashes. Inspect the run's actual source/workflow and all production steps rather than relying on run-level green. Any missing, red, cancelled or skipped checks/production fails acceptance. An unrelated green SHA or stale/off-branch live source fails ancestry; reproduce those rejection controls using temporary Git/local health fixtures, never a remote deploy. If a report-only commit is proposed as equivalent, independently compare all executable/config/lock paths and require ancestry of the actual code deliveries; a new SHA alone is not a new executable. The strict procedure above deliberately makes no report-only waiver.

The documented job predicate was executed locally against captured successful job metadata and intentional red-production, skipped-production and foreign-source mutations: four assertions passed. This validates the read-only procedure's rejection logic, not current production acceptance.

If a code run was replaced, platform CI owns recovery via the existing main production path or on-demand workflow_dispatch. Engineering does not wait, dispatch a remote deploy, or watch CI. Deferred owners/failure conditions: platform green gate owns the **pushed t-1626 delivery SHA**, failing on red/skipped checks or production; acceptance owns live ancestry of **17bca22 and all three replacement delivery SHAs**, failing on missing/off-branch/stale source; acceptance owns unread historical jobs **121600218178 / 121590440426**, retaining unknown cause while inaccessible; independent QA owns real feature behavior. No capacity queue or runtime callback is involved. Pending replacement runs never erase an observed defect. Required live output stays unproven until observed.

Full local command logs, HTTP bodies/status/header metadata, old-parser negative control, CLI help and identity manifest are saved in the lease's `shared/artifacts/run-9142`; `shared/artifacts/commits.txt` records the pushed delivery. The reproducible source hashes below bind evidence to executable content rather than an unrelated report SHA.

## Executable identity (SHA-256)

Aggregate fingerprint: `eca7e93c8a38b9c3f98efaa97b1f4e79d035d70315df37e0ceb30fd31d60e98c` (SHA-256 of the sorted compact JSON path/hash map). Documentation is excluded to avoid a self-referential fingerprint.

| Current tested path | SHA-256 |
| --- | --- |
| `scripts/vercel-deploy.sh` | `ab8202af540d0544830e155707a9fa4a39cb366f6b622de559a7054377dc4798` |
| `scripts/vercel-deploy.test.sh` | `13cd2b04b1c08a258568f0ffd1e111b9efc22343ca0db835dcb6474fbfe67322` |
| `scripts/verify-deploy.sh` | `7cd0751ea5ff2482921fc73b8da8f18e2a1cb512cdefa56b498803e8644d9d0a` |
| `package-lock.json` | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` |
| `package.json` | `b43340c2d2ad12c024f0d3cb0b71688e895a6715e494706be759b6323ff20112` |
| `.github/workflows/ci.yml` | `b08a5728f75ab97b52106052ed52d5edce37b1028ea799c0fecefd84d0800b6a` |
| `next.config.ts` | `e2ab6eeb96755f02796a76a876f4d617db0d9d4b9cf8124156cd7e08814ab83e` |

Historical comparison, read with `git show <sha>:<path>`:

| Path | Green 542c620 | Failed 5577ec5 |
| --- | --- | --- |
| `scripts/vercel-deploy.sh` | absent | `28072ba03df0d218b02ec1b2c4f4c56cb77a30b90405d3fb92170ea2c15c03ab` |
| `scripts/verify-deploy.sh` | absent | absent |
| `package-lock.json` | `2d0ec0bea389a532592da1c7a96f8eb6452a90f055fa37cebb8a39d771791a8b` | `2d0ec0bea389a532592da1c7a96f8eb6452a90f055fa37cebb8a39d771791a8b` |
| `.github/workflows/ci.yml` | `2b1ae8c894c8f44805724b5d3efc73a52256c96407c4bdbe614a61cde2e0def4` | `d6b478eaef383a6894cd2a31bbd3ac54ee5ac2fa85a82c4b788955fc1f462905` |
