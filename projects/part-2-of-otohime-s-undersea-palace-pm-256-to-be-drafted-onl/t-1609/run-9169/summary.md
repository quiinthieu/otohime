# t-1609 delivery evidence

Run: run-9169 · profile: codex-sol-6-1-high · model: gpt-6.1-sol · effort: high.
Profile verified from this run's persisted `profile_flags`, not current defaults.

Implemented the shared pure preference store, React external-store adapter, Home's menu-only Ghosts on/off chip
and preference gating in both neutral loaders. Hiding synchronously closes transport, aborts configuration,
clears ink and cancels frames/retries. The mounted session retains its three-attempt budget. Generation guards
reject cancelled callbacks even after reconnection. Dive/Sea sound adjacency, game controls, Print run, Bottle
and the palace's separate root remain intact; Tamatebako and sound implementation files were untouched.

| Verification | Observed result |
|---|---|
| Contract preference command (`ghosts/pref.test.ts ghosts/client.test.ts`) | 19 named tests pass; no failures/skips |
| `npm test` | 2,454 tests pass; no failures/skips |
| `npm run lint` | Exit 0; zero errors, ten existing warnings |
| `npm run build` | Exit 0; compiled, TypeScript passed, 206 static pages; Home, Ryugu and API compiled artifacts exist |
| `TMPDIR=/tmp npm run test:ghosts-pref` | Four named production-browser tests pass; no failures/skips |
| Final focused ESLint and `tsc --noEmit` | Exit 0 after browser-test refinements |

The browser walkthrough starts on configured Home, draws actual ink pixels, hides through the chip and observes
socket close plus canvas clear before the click returns. It drives Enter, Space and touch, reloads after opt-out,
proves hydration and an idle turn, then observes zero config/socket work. Dive carries the hidden choice into
hydrated Ryugu. A same-origin Home/Ryugu tab pair proves storage propagation, clearing and fresh anonymous
reconnection. Initial/dynamic motion, visibility, offline and preference changes prove zero suppressed work and
exhaustion after three attempts. Corrupt/denied storage stays usable. The same pixel assertion rejects an
instrumented disabled-paint negative control, so data counters alone cannot pass the rendering evidence.

Real boundary: locked Node v22.12.0, Next 16.4.2, React/ReactDOM 19.3.0, playwright-core 1.64.0 and Chrome
156.0.8078.48. The actual compiled route, dynamic canvas, session construction, browser WebSockets and 2D context
ran. Fan-out is the repository's local fake, with no Cloudflare deployment. Motion uses Chrome media emulation;
visibility/offline properties and events are injected. Storage propagation uses real browser localStorage events.
Blocked storage can preserve only the current JavaScript page's memory choice, as documented.

Executable fingerprint: `d7bbae901950edee02d9867e05698478d46de73f7ab073be1921ff41b253fb15`.
Next BUILD_ID: `Jlutf60q7l40JynYZTUgy`. [preflight.json](artifacts/preflight.json) records exact per-file code,
lock/config/test and compiled-route hashes. [verification.json](artifacts/verification.json) records positive
assertion names/counts; all final command logs are retained in full beside it. The pushed commit is recorded
in the runner's `shared/artifacts/commits.txt` and the Plan Manager summary's `git_sha`.

Local failure history: initial preference import failed because the implementation was absent; a new lifecycle
assertion then exposed retained ripple counters and stale callbacks, which were fixed. The first full suite
failed its existing Dive/Sea sound adjacency assertion; preserving the ordering fixed it. An initial type check
caught an inferred `never[]` in browser instrumentation; its explicit Probe type fixed it. All final evidence
is green and complete. No known application defect remains from these checks.

Execution is demonstrated locally for t-1609. Integration deployed and product delivered are unproven. No hosted
workflow/deploy FAILED/COMPLETED/current history was read, so external history completeness is inconclusive.
This run stops at push, as required. Plan Manager owns CI/green gate and independent deployed QA for this delivery;
failure is any red job or independent acceptance regression. t-1610 owns broader two-browser/CI/deploy automation;
t-1611 owns production activation and any credential/deploy operator chore. No operator dependency was reached,
no pending runtime queue is involved, and no production activation or hosted fan-out is claimed here.

The first push was rejected as non-fast-forward. `git pull --rebase` integrated upstream `e9b32bfecc8c09b90cf31949127a6c0a2254a4d2`
with no conflicts; only another plan's four documents changed. All contract checks and the Chrome suite were
rerun after the rebase. The relevant executable fingerprint remains unchanged; the build identity above is refreshed.

The first retry also raced main. A second clean rebase integrated `f08f670eb8bd5c699463062c4d00f08c4d486cfa`, including Bottle
verification/deployment scripts and their evidence; no ghost/Pocket paths overlapped. All required checks and
the Chrome suite were rerun again. The application executable fingerprint is unchanged.
