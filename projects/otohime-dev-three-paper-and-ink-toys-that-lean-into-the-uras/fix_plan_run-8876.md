# Fix plan · pm-264/t-1590 · run-8876

**Cause: code.** Delivered SHA `28d4542dccb1173b5052306464ddf0fa6372ba99` has a green gate, but earlier raw QA execution on the same Peep-box source/lock/config/chunk fingerprint failed the native touch-scroll control and the analytic mobile/desktop displacement assertion. Later passing local and live probes do not erase those failures. The live site now serves descendant `0abec76d8145fb16f1a5e31cfe78898ff61819ff`, whose ancestry contains the delivery; deployment is demonstrated.

## Repair the delivered verifier

Owner: `t-1590` software engineer. In `e2e/peep-box.test.ts:595-636`, finish sibling Ink Press lazy layout before the touch gesture. Capture `scrollY`, `scrollHeight - innerHeight`, aperture bounds and the chosen direction. Establish at least 30px of scrollable room in that direction, use a bounded condition on the measured change, and include the before/after/max values in the assertion. Preserve the real CDP touch event and `pan-y` check. This fixes a verifier that sometimes reports failure while native scrolling works; it must not mask a product failure by changing the expected behavior.

At `e2e/peep-box.test.ts:191-230`, capture neutral/right screen CTMs, expected and actual displacement, SVG and aperture bounds, scroll position and active source in the failure text. Stabilize the existing Play toy layout and ensure the controller owns keyboard input before sampling. If those diagnostics show the ray intersection itself is wrong, change `components/peep-box/active.tsx` in its paint path or `lib/peep-box.ts:projectLayer` and add a pure regression case. Keep the 0.1px analytic tolerance. Failure condition: unchanged executable inputs still yield a mismatched layer displacement at 390×844 or 1366×768, or the touch control fails in a valid scroll state.

Run all four declared verification commands and the full serial browser suite in the locked environment. Obtain a new green gate for the fixed SHA; do not use this run's green result to close prior intermittent failures.

## Prevent future pipeline cancellation

Owner: otohime CI maintainer, tracked by plan-manager `pm-264/t-1590`. Last green Actions run visible in the bounded history snapshot, `40306337481` at `ae4607d`, passed checks and production; failed checks run `40310239199` at pre-delivery `841ca69` reached the Desk E2E assertion. The only workflow change between last green and delivery is commit `841ca69`, adding E2E failure diagnostics; the shared workflow concurrency rule stayed in place. Delivery run `40311568102` was later cancelled before checks or production. A descendant deployment now exists, so this is a systemic CI risk, not a blocker to the current product's deployment.

In `.github/workflows/ci.yml:11-13`, remove the workflow-level `concurrency` group that replaces pending main runs. Add job-level production concurrency in the existing `production` job at `.github/workflows/ci.yml:190-194`, retaining `needs: checks`, so checks can finish for each SHA while deploys serialize. Push the fixed verifier descendant to main; let its checks and production jobs complete. Read any failed job's annotation and raw runner tail, then fix that named step. The earlier Desk failure remains a separate concern if it recurs. Failure condition: the fixed SHA has no successful deployed descendant or live Peep-box assertions fail. The current deployed SHA `0abec76d` has already passed the delivery ancestry check.

This run does not edit application or CI source. Its QA documents and probe are the only changes.
