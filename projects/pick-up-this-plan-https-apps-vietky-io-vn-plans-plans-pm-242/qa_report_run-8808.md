# pm-258 / t-1564 QA — fail, cause=code

Delivery: **15fd171ac7d54027fd1c13a715efe1de13110a6b**. Observed production: **c38f72a6e927800b363769a1de57ee2ceed69470**. `git merge-base --is-ancestor 15fd171 c38f72a` exits **1**. Production does not contain the delivery. Evidence is in [qa-run-8808](qa-run-8808/); no application source was changed by QA.

## Verdict and independent CI evidence

The local repair is executable and its seven contract commands pass. The deployment gate is **not restored**: [delivery run 40295803050](https://github.com/quiinthieu/otohime/actions/runs/40295803050), checks job **121481439046**, failed **E2E against next start**; production job **121484004029** was skipped. A later independent [run 40296784613](https://github.com/quiinthieu/otohime/actions/runs/40296784613/job/121484664977) at **4059b63f5a43d7184a5f6029ebee654c5e7840bf** also records that E2E step as failed. Only another project's QA documents differ between 15fd171 and 4059b63: application code, runner, lockfile and workflow fingerprints match. A later SHA or a local green result does not close these failures.

The exact CI assertion remains **inconclusive**. Its raw API log request returned HTTP 403 (shared unauthenticated rate limit); the GitHub step-log HTML endpoint returned 404. Public job HTML independently exposes the failed step and exit-code-1 annotation, not the failing assertion. No claim is made that the CI failure is definitely the engineer's reported transition exception.

The last green workflow is **40263545741 / c38f72a**, independently confirmed by public run HTML and the live build marker. Both `git log c38f72a..15fd171 -- .github/workflows/ci.yml` and that file's diff are empty. There is no evidence supporting an environment cause. Because actual CI checks fail, this is not an authority-only precondition. Under the role contract an unattributed delivery failure is **cause=code**. This report does not spend time waiting for another run or waive a defect through a watch.

## Exact delivery verification

Installed with `npm ci` in a detached worktree at 15fd171, using Node **22.23.3**, Linux x64, locked Next **16.4.2**, embedded-postgres **17.10.0-beta.17**, and playwright-core/Playwright **1.64.0**. Build used `CI=true`, the full delivery `GITHUB_SHA`, and the public CI Better Auth placeholder. [fingerprint.json](qa-run-8808/fingerprint.json) records source/lock/config hashes, real Postgres binary hashes, the build ID and built/public asset manifest hashes. No model artifacts apply to this application.

| Contract check | Result | Saved evidence |
| --- | --- | --- |
| `npm test` | 2,078 pass; zero failed, skipped or cancelled | [unit summary](qa-run-8808/delivery-unit-summary.log) |
| `npm run lint` | exit 0; 10 existing warnings, zero errors | [lint](qa-run-8808/delivery-lint.log) |
| `npm run typecheck` | exit 0 | [typecheck](qa-run-8808/delivery-typecheck.log) |
| `npm run build` | exit 0 | [build](qa-run-8808/delivery-build.log) |
| `SKIP_BUILD=1 bash scripts/walk-end.sh` | 67 ok / 0 failed, exact delivery marker | [HTTP walk](qa-run-8808/delivery-walk.log) |
| `SKIP_BUILD=1 bash scripts/probe-end.sh` | 171 ok / 0 failed | [Chromium matrix](qa-run-8808/delivery-probe.log) |
| `SKIP_BUILD=1 npm run test:e2e` | 91 pass; zero failed, skipped or cancelled | [E2E](qa-run-8808/delivery-e2e.log) |

The matrix ran again with `DOCKER_HOST=unix:///tmp/pm258-run8808-no-docker.sock`, forcing real Docker discovery to fail and the delivered embedded Postgres fallback to run: **171/0**. This is an unavailable-daemon fixture, not a fake database. [Fallback matrix](qa-run-8808/delivery-probe-embedded.log). The unit lifecycle test actually imports and constructs the locked database adapter, runs migrations, queries the `user` table, sends SIGTERM, confirms files are removed, and proves a new connection is refused. The build constructs the actual application dependencies; real browsers execute its shipped chunks and WebGL path. Walk/probe logs report no runtime errors and their owned services are cleaned up.

Before saving the evidence branch, its own `npm test` also passed 2,078/2,078 and lint passed with the same 10 warnings. QA's new browser executable was exercised against both the exact production build and the real public site. Initial QA-harness attempts needed a short Chromium TMPDIR and scrolling the lazy press heading into view; those setup errors were corrected in the QA script, without touching the application.

## Independent visitor checks and negative controls

[independent.mjs](qa-run-8808/independent.mjs) was written for this QA run, outside the delivered scripts. It uses real Chrome **154.0.8037.57**, HTTP and the rendered DOM; it imports none of the application's assertion helpers. Its [delivery output](qa-run-8808/independent-delivery.json) proves:

- Health and the no-store presence API answer 200; DOM build marker equals the full delivery SHA.
- Real keyboard Tab navigation visits all **seven** page links, the zine/contact links, Back to top and the final `/ryugu` waterline. The waterline is the footer's last child.
- A canonical Play href corrupted only in the browser DOM makes the independent assertion reject; restoring it passes. No production persistence is mutated.
- There are **two** real status regions on `/play`. The old page-wide status lookup throws a strict-mode violation, while the delivered press-scoped lookup resolves exactly one. This independently detects the repaired locator assumption.
- Twelve explicitly driven Home/Work → typed `urashima` → `/ryugu` navigations reach the actual palace with zero page errors. This is a bounded on-demand reproduction attempt, not a soak or proof that an intermittent defect is absent.

The original matrix retains its rAF overlap negative control (two pending frames when scroll overlaps pointer work), badge-opacity, canonical-link and network-attribution controls. The unit scheduling regression executes two synthetic timing files through the real runner: default serial spans do not overlap; `--test-concurrency=2` makes them overlap. **Those timing files are synthetic**, proving orchestration only; they do not replace the real production/browser/database checks above. No fake runtime, provider feed, browser or database was used to claim visitor execution.

The independent [live probe](qa-run-8808/independent-live.json) observed healthy APIs, zero page errors on the audited public page, the old six-page footer and build marker **c38f72a**. Presence returned Spotify/Steam off with null track/game; no personalized keyless-presence delivery is claimed. Vercel function-log access is unavailable; public API success does not prove its unread logs are clean.

## Defects and delivery state

1. **Blocking: E2E still fails in CI on the delivery executable.** IDs above; exact assertion unread. Owner **pm-258/t-1564 software engineer**. Local green runs do not satisfy the deployment-gate outcome.
2. **Unresolved previously observed intermittent exception:** `InvalidStateError: Transition was aborted because of invalid state. Page already revealed`, reported by run-8744 for the real urashima/root-layout path, with repeated failures in its own reproduction history. Relevant unchanged files include `components/urashima-keys.tsx` and `app/(ryugu)/layout.tsx`; the delivery contains no repair to those files. A site-layout guard changed since the earlier baseline, so the complete historical fingerprints must not be collapsed into one. This QA observed 0/12 errors and one 91/91 suite; the prior defect is not declared fixed or reattributed to a different failure. Owner **pm-256/t-1559**, coordinated by **pm-258/t-1564** because it can break this gate. Failure condition: the existing `e2e/ryugu.test.ts:138` zero-page-error assertion or an equivalent independently captured page error.

Integration deployed: **no**. Waiting for runtime capacity: **no**. Local real execution demonstrated: **yes**. Required restored gate and production delivery: **not delivered**. There is no queued job substituted for output.

## History bounds, callback ingestion and identity

- GitHub: **two pages × 50**, **100/374** advertised run summaries read; older pages unread. The inclusive c38f72a → initial current-main interval contains **59** runs: **38 failures, 19 cancellations, 1 success, 1 in progress**. Job-list reads succeeded for **12 runs / 47 jobs**; **28** additional run job-list requests were denied by quota. Historical completeness is limited to these summaries; exact failed assertions are unread. [ci-history.json](qa-run-8808/ci-history.json) maps each interval SHA to relevant code/lock/config Git blobs.
- The two original failures were independently opened through public job HTML despite API exhaustion: **40277024423 / job 121421820314** failed E2E; **40275822192 / job 121418580863** failed Footer Chromium probe. [original-jobs.json](qa-run-8808/original-jobs.json) records steps. Raw assertions remain unavailable. The historical single footer failure at **40277523350 / 2a58479** remains inconclusive; the current footer assertions pass, not a retroactive diagnosis of that job.
- Task-manager: global FAILED and COMPLETED lists read at offsets **0,50**, limit **50** each: **100/1,115 FAILED**, **100/6,009 COMPLETED**; filtered to **18 failed / 16 completed** otohime records. A project-id filter `otohime` initially returned empty because these tasks belong to project `plan-manager`; it was not treated as proof of no failures. Older records and unrelated executables are not adjudicated. [task-history.json](qa-run-8808/task-history.json).
- Read bounded raw tails for delivery task **8d0933c1-50c4-40e6-8c5f-e4b07a2934fd**, verifier **b960bf5e-5e8e-42a7-acbf-32fa823169da**, and failed comparison **b3128d45-07a7-4e69-94c1-b964d173900e**. That last run ended at model capacity and is not evidence of an application repair. No claim of complete historical logs. [runner tail](qa-run-8808/runner-tail.json), [verification/callback evidence](qa-run-8808/callback-ingestion.json).
- Delivery and verifier callbacks both have persisted **delivered**, one attempt; board timeline events **ev:11333** and **ev:11343** show **applied**. Board report **rep-5120** and green verification **ver-3521**, run **run-8802**, persist at **15fd171**. Timeline read: **50 entries**, older entries unread. Callback ingestion is demonstrated; it is not deployment. The registered otohime repo has `deploy_detection=none`.
- Recorded SWE run **run-8744**: profile **claude-opus-high**, model **claude-opus-5-5**, effort **high**, fleet worker **avietidol-mac-mini**, attempt **2**. QA **run-8808**: profile **codex-sol-6-1-high**, model **gpt-6.1-sol**, effort **high**, worker **avietidol-z490**, attempt **1**. These are recorded run flags, not current defaults. [board.json](qa-run-8808/board.json).
- Independently read delivery Git author and committer: **Otohime <quiinthieu@gmail.com>**, with **zero Co-Authored-By trailers**. The delivery manifest also lists **author.txt**, 44 bytes, SHA-256 **7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada**. Its contents could not be fetched (task-manager artifact routes returned 401/403); **artifact-content identity is unverified**, not asserted to match merely from its filename/hash. [independent-evidence.json](qa-run-8808/independent-evidence.json).

Deferred checks: **t-1564 / runs 40295803050 and 40296784613**, owner its software engineer, must resolve the failed E2E assertion and obtain a successful checks job; **t-1559 transition exception**, owner pm-256's engineer coordinated by t-1564, must be reproduced/closed with an error-detecting regression; **delivery 15fd171 production ancestry**, owner t-1564 and subsequent QA, fails while live SHA does not contain the repaired delivery. Raw CI logs, original 2a58479 assertion, delivery author.txt contents and Vercel logs remain explicitly unread. These evidence limits do not authorize a pass or a capacity deferral. No operator-only chore or future calendar event is needed to issue this verdict.

The requested extraction document and `docs/claude/software-development.md` are absent in this checkout; their rules were not invented. AGENTS.md and the explicit role/build contract govern. Installed Next testing guidance was read. Decisions, including the lesson about verification versus deployment, were recorded on the board.
