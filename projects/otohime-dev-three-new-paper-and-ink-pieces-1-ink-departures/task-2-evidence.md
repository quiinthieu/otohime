# Senko Hanabi interactive island — t-1786

Run `run-9724`, 2026-10-29. Task branch: `pm-301-t-1786-senko`.
Delivery SHA: the enclosing commit, resolved by `run-9724/artifacts/commits.txt`; the submitted summary supplies the immutable SHA.

The server route uses Fig. 03e and the required ViewTransition wrapper. Its lazy Canvas 2D island connects the delivered pure model to pointer/Space/Enter holds, a steady latch, four stage controls, Jolt hand, shared optional crackle, polite status and a field guide. Paper styling, local Satori OG image and `/play` discovery are included. Willow trails use the particles' gravity to draw curved ink strokes. Drops show the detached ember with its current glow and immediately stop the animation loop. Reduced motion halves emission, removes tremor and accidental pointer drops; deliberate Jolt hand remains available.

## Executable and environment

- Actual run record: software_engineer; profile `codex-sol-6-1-high`; model `gpt-6.1-sol`; effort `high`; runner `fleet`; worker `avietidol-mac-mini`.
- Node `v22.23.3`, npm `10.9.9`, macOS arm64. Locked Next `16.4.2`, React `19.3.0`, Playwright Core `1.64.0`.
- Final production build ID: `j1wEGNCbSg-xtNS_g6S7p`.
- Executable fingerprint: `3b53fd43eb9fb75eda4acc30cf477a5d53b2cce701de9de097e09027607008ed`. [Manifest](run-9724/artifacts/executable-fingerprint.json) covers the route, loader, renderer, stylesheet, OG card, shared audio/model, particle RNG, tests, config and lock.
- Lock SHA-256: `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`.
- Dynamic island chunk `13aau37d65-xs.js`: 15,404 bytes, 6,316 bytes gzip. No dependencies or external sparkler assets added.
- Gate closure preflight imported the locked Playwright, pg, embedded-postgres and platform binary package; Postgres/initdb binaries ran. The real E2E runner constructed a migrated throwaway Postgres, built this checkout, started Next and exercised real Chromium Canvas/Web Audio and the actual Satori image response.

## Verification output

`node_modules` was already installed. Commands ran from the repository root with `TMPDIR=/tmp` where required.

```text
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test 'e2e/senko.test.ts'
# tests 7
# pass 7
# fail 0
# cancelled 0
# skipped 0
# duration_ms 34995.686667
exit 0

npm test
# tests 2784
# suites 2
# pass 2784
# fail 0
# cancelled 0
# skipped 0
# duration_ms 54560.794958
exit 0

npm run typecheck
Generating route types...
✓ Types generated successfully
exit 0

npm run lint
13 problems (0 errors, 13 warnings)
exit 0

node scripts/check-gate-closure.mjs
schema=otohime.gate-closure.v1 runner=real certified=true
preflight.ok=true local_controls=pass
preflight/e2e-runner/end/urashima exit_code=0
finished_at=2026-10-29T04:14:34.758Z
exit 0
```

The lint warnings are in existing unrelated files; none are in the new Senko files. Gate closure fingerprint: `fd2f6dc923d00fe140de5785a693efd85ffe2b99e6d571f623c74e8824c28bb5`.

The E2E suite checks navigation at 1280/390px, DPR capped at two, painted pixels, no horizontal overflow, 44px controls, local OG PNG response, pointer holds on paper and button, Enter/Space holds, automatic four-stage progression and announcements, pointer shaking and Jolt drops, steady stage exploration, hidden/blur pause and resume, cancellation, route cleanup and cached return, real shared audio opt-in/muting, and calm mode with fewer sparks and no accidental shaking. Browser errors must be empty. Desktop/mobile screenshots were visually inspected; binaries remain outside Git.

## Boundaries, negative controls and history

These are SWE integration checks, not independent deployed QA. The browser, Canvas renderer, production build, model, audio nodes and database are real. Playwright controls elapsed time for stage/lifecycle tests. Hidden/blur events and `document.hidden` are injected explicitly; independent draw counters and held-time observations confirm cessation of work. Native background-tab delivery across browsers remains for QA. The runner's unrelated Ghosts backend is its existing fake. No sparkler model or audio context is replaced: the tests wrap real audio constructors to count contexts and scheduled oscillators.

Negative controls observed: a fast pointer move and deliberate Jolt produce `dropped` with the loop stopped; fresh muted sessions create zero audio contexts/voices despite active sparks; muting prevents further voices; hidden/blurred sessions produce no canvas writes or elapsed progression; calm mode ignores an otherwise dropping movement while Jolt still drops. Navigation hides the cached canvas, cleans up its loop and restores a consistent idle/unlatched session on return.

All four local E2E attempts are accounted for: 4/7, 6/7, 7/7, 7/7. Raw failure tails were read. The first two failures were verification assumptions: canonical metadata origin versus the local server, and URL-change/detachment versus React Activity cleanup. The initial canonical-origin OG probe returned 404 and supplies no deployment evidence. The local-origin OG checks now pass. The second attempt's full raw tail identified hidden retained DOM with `data-loop-running=false`; Next's installed preserving-ui-state guide confirmed the behavior. The third attempt passed, then final willow rendering and button/calm-pointer coverage were validated by the fourth complete run. Final TAP summaries have zero missing, cancelled or skipped tests. The repository suite passed on each run (three runs, 2,784 tests each). Current local jobs completed; no persistent runtime queue or callback ingestion applies to this browser-only feature. Platform job history and CI history are outside this SWE run's stop-at-push scope and remain unobserved.

Repository rules and installed Next guides were read. The named extraction/software-development documents are absent. The unrelated pre-existing `content/history.json` edit was backed up before the build and restored byte-for-byte, rather than discarded by the contract's generic checkout cleanup. It is excluded from this commit. Owner identity check passes. Decisions and lessons are recorded in plan-manager.

Execution is demonstrated locally. Source integration is handed off by pushing this commit to the task branch and main. No capacity/operator deferral or known remaining local defect. CI, green gate, deployed independent QA and production product delivery are unproven here and owned by plan-manager for `pm-301/t-1786`; any failing job or deployed acceptance failure returns the task. This run stops after the push and summary without pipeline watching.


## Title readiness repair — run-9754 (2026-10-29)

Fix plan: `fix_plan_run-9741.md`, reports `rep-5817` / `rep-5818`. The existing sparkler is already implemented. This repair adds an observable `document.title` predicate before the existing `/Senko Hanabi/` assertion in both 1280px and 390px navigation tests. URL and canvas readiness can precede the document head update. No sleep, assertion removal, application change, CI change or dependency change is needed.

Branch: `pm-301-t-1786-title-race-run-9754`, created from freshly fetched main `f54f160a9e40284090f0332c2f5dca55d147ecfd`. Delivery is the enclosing commit; see [commits.txt](run-9754/artifacts/commits.txt) and the immutable SHA in the submitted summary. The repository was initially clean. Generated `content/history.json` is restored by the contract command and excluded from delivery.

Actual run record: profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, runner `fleet`, worker `avietidol-z490`, task-manager id `8f916deb-fa59-476f-8bb9-5ee2b9359698`. Environment: Linux x86_64, Node `v22.23.3`, npm `10.9.9`. Fresh `npm ci` installed the existing lock. Next `16.4.2`, React `19.3.0`, Playwright Core `1.64.0`. Lock SHA-256 remains `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`.

The [current fingerprint](run-9754/artifacts/executable-fingerprint.json) covers the original 14 paths plus `scripts/e2e.mjs` and `package.json`; combined SHA-256 `eec472456fc7e8c993091f58d623d7a670a4265a6fbcec0631fadb8ea80ed2a2` (SHA-256 of sorted compact JSON file-hash map). Of the original 14 files, only `e2e/senko.test.ts` differs from the original delivery manifest; all application, model, sound, configuration and lock bytes match. Production-build IDs: `yt5rmH4m-MtNZYHbb65ug` (first successful build) and `Tg7MGSO1ONEkNkLPvUk5g` (repeat).

### Verification and boundaries

Required commands ran from the repository root, with `TMPDIR=/tmp`:

```sh
(test -d node_modules || npm ci) && TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test 'e2e/senko.test.ts' && git checkout -- content/history.json
TMPDIR=/tmp npm test
npm run typecheck
npm run lint
TMPDIR=/tmp node scripts/check-gate-closure.mjs
```

All three local E2E attempts are accounted for: attempt 1 exited 1 before browser execution because the fresh Next build reported eight Caveat font import-map errors (`next/font/google queries have exactly one entry`); the raw error output was inspected. No application/configuration/lock change was made for that failure. Attempts 2 and 3 each rebuilt from scratch and passed all 7 tests, with zero failures/cancellations/skips, exit 0. Durations: 50,998.484772ms and 39419.862681ms. Both desktop/mobile title predicates passed on each successful attempt. This bounded repetition supports the readiness repair; it does not assert that every possible scheduling race is impossible.

Repository tests: 2,792 passed, zero failed/cancelled/skipped, exit 0. Typecheck: exit 0. Lint: exit 0, 13 existing warnings, zero errors. Gate closure: exit 0, `certified=true`, `preflight.ok=true`, `local_controls=pass`, no failures; fingerprint `505721db5c609c5fc7e17a9268c5eb8400e7ab30e2e06596e39b5b58da065ad0`. Locked imports of Playwright, pg, embedded-postgres and linux-x64 binary package passed; actual Postgres/initdb/pg_ctl binaries ran. Each successful E2E attempt constructed/migrated real Postgres, built and served Next, then exercised real Chrome Canvas/Web Audio and the Satori PNG route. No external sparkler asset/model is required.

Negative controls remain intact: pointer shake/Jolt drop the bead and stop the loop; muted active sessions produce zero audio contexts/voices; remuting stops future voices; hidden/blur events stop actual draws and elapsed progression; calm mode suppresses accidental shaking while deliberate Jolt still drops. Selected tests control elapsed time and inject lifecycle inputs; audio instrumentation wraps real constructors, and unrelated Ghosts backend remains the runner's fake. These are SWE local integration checks, not independent deployed QA.

### History and handoff

Bounded task-manager history snapshot: FAILED offsets 0 and 10, 10 rows each of 162 total (142 unread); COMPLETED offsets 0 and 10, 10 each of 1,127 total (1,107 unread); RUNNING 5/5 and PENDING 2/2. Global history is incomplete. Available raw tails for `8a0ce780-20f1-44a3-83f1-9dcaa57ab43a` and `f06bc62d-4150-4c31-9f65-b224c1ad968d` were read. The former ends with the main-publication guard failure for `75e318e`; its callback is delivered and persisted `run-9736.status=failed`, `callback_apply_failures=0`. The latter ends with successful agent execution/publication, yet its delivered callback persists `run-9741.status=succeeded` alongside failing QA reports `rep-5813`, `rep-5815`, `rep-5817`; callback application failures are zero. Completed agent execution does not imply successful QA. The earlier raw empty-title assertion lies outside the available tail, so its details are attributed to the committed QA report. Unread historical output remains inconclusive. No durable Senko runtime queue or ingestion callback applies to this browser feature.

The absent extraction/software-development documents were checked; `AGENTS.md` and installed Next testing/navigation guides were read. No codebase knowledge graph tool was available. Decisions and lessons are recorded in plan-manager. Owner identity check passes.

Source publication to branch and main is authorized. Local execution is demonstrated; current CI, integration deployment and production product delivery are unobserved. No capacity/operator prerequisite is pending. Deferred checks `pm-301/t-1786/CI-green-gate` and `pm-301/t-1786/deployed-QA` belong to plan-manager/repository CI: fail on any required check failure, loss of delivery ancestry, non-200/missing discovery link, title failure, or desktop/audio/lifecycle/negative-control interaction failure. The SWE stop-at-push contract overrides the fix plan's live QA request; no pipeline watching or deployed-system probe is performed in this run.
