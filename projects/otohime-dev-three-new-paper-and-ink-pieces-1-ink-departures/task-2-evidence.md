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
