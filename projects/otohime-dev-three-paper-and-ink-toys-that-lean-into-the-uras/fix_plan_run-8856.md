# Fix plan · pm-264/t-1590 · run-8856

**Cause: code, delivered browser verifier and possibly mobile projection.** Delivery `28d4542dccb1173b5052306464ddf0fa6372ba99` passed green gate `ver-3536`, but focused production browser contract reruns on the same executable fingerprint failed at `e2e/peep-box.test.ts:636` (touch scroll) and `:225` (390px layer geometry). These observed failures are not waived by a pending workflow or later passes. Separately, GitHub cancelled its CI run `40311568102` before checks or production; live `/api/health` still reports pre-delivery `ae4607d`.

## Code fix to make the touch control deterministic

Owner: `t-1590` software engineer. Change `e2e/peep-box.test.ts:595-636` only after reproducing the recorded failure and the independent native-scroll control. At lines 602-636, finish Ink Press's lazy layout before measuring the scroll baseline, as the geometry cases already do; read `scrollY` and `document.documentElement.scrollHeight - innerHeight` before the gesture; choose an upward or downward CDP pan according to which direction has at least 30px of available document scroll; wait for the expected scroll delta with a bounded event-driven assertion; and include before/after/max values in the failure message. Keep the `touch-action: pan-y` check and the real CDP touch event. Do not change the product's pointer listener, turn the negative control into a CSS-only assertion, or silently lower its threshold.

The QA rerun failed 7/8 at “touch negative control really scrolls the document.” A separate production-browser CDP pan recorded `touch-action: pan-y`, scrollY 2064 → 2184 after an upward pan and 2184 → 2073 after a downward pan. Max scroll changed 3904 → 4089 while sibling content loaded. Earlier focused and full suites passed on the same Peep-box/lock/config fingerprint `6d4b115e33cfb82bdae3c9ded455c7817f7d92746fab693b7896e20f876e73c3`; that mixed result is why the fixture must establish a stable, scrollable starting state. Run the four declared contract commands and the full serial browser suite, then obtain a new green gate for the fixed delivery SHA. Failure condition: the native-scroll control still fails in any valid viewport/layout state, or any declared check fails.

At `e2e/peep-box.test.ts:191-230`, the 390px right-pose analytic fixture also failed once after a docs-only rebase; 1366px passed and the prior independent 390px browser probe showed four distinct displacements. Add measured and expected neutral/right screen coordinates, `getScreenCTM`, SVG/aperture bounds, scroll position and `data-source` to the assertion failure, then stabilize the scene and verify the pointer/keyboard source before sampling. If the captured layer positions still violate the ray-intersection fixture, correct the projection in `components/peep-box/active.tsx:paint` or `lib/peep-box.ts:projectLayer` and add a regression case. Do not loosen the 0.1px assertion to hide a product error. Failure condition: identical executable inputs can still produce a mismatched mobile layer displacement.

## Separate pipeline repair

**Environment issue:** GitHub's run annotation says a higher-priority pending request for `ci-refs/heads/main` displaced `40311568102`. The live SHA does not contain the delivery. Do not mark the Peep-box product delivered from a green gate or queued replacement.

## Concrete pipeline repair

Owner: otohime CI maintainer, with plan-manager tracking `t-1590`.

1. In `.github/workflows/ci.yml:11-13`, remove the **workflow-level** `concurrency` block that groups every main push into the same pending slot. GitHub cancelled #415 despite `cancel-in-progress: false`; that setting protects a running job, not each pending commit's entire workflow.
2. In `.github/workflows/ci.yml:190-194`, add **job-level** production concurrency:

   ```yaml
   production:
     needs: checks
     if: github.event_name == 'push'
     runs-on: ubuntu-latest
     concurrency:
       group: otohime-production-main
       cancel-in-progress: false
   ```

   Keep the existing `needs: checks`. Each pushed SHA can finish its own checks; only production deploys serialize. A newer production request may supersede an older pending production job, but the latest deployed SHA must contain the delivery. Preserve the current PR cancellation policy with a PR-specific job group if desired; do not restore a shared main workflow group.
3. Commit that CI change with its own plan/task prefix and `Otohime <quiinthieu@gmail.com>` identity, push main with the fixed browser fixture, and let the new push trigger the workflow. Run the CI checks, production deploy and final `curl /api/health` step for that SHA. If the new run fails, read its annotations and raw runner tail; fix the named failing step, then rerun. The older #411 `e2e/desk.test.ts:576` failure is an observed sibling CI failure on pre-delivery SHA `841ca69`, so a repeated Desk failure in the new run needs a separate source or fixture fix, not a capacity explanation.
4. Return to QA with the successful descendant run id, its checks and production job ids, live health SHA, and a live user-path probe. Acceptance requires `git merge-base --is-ancestor 28d4542 <live-sha>` to exit 0 and the Peep-box at both 390×844 and 1366×768 to open, shift distinct layers, reset on Disable, preserve native scrolling, and make no camera/model request. Failure condition: no successful descendant deploy, stale live SHA, or any of those live checks failing.

Last green comparison: Actions run `40306337481` at `ae4607d` completed checks job `121516259788` and production. The later failed run `40310239199` at `841ca69` had checks job `121530268639` fail in E2E Desk; its public annotation gives the assertion. The only `.github/workflows/ci.yml` change between last green and delivery is commit `841ca69`, adding failure diagnostics; shared concurrency at line 12 remained. Raw job logs are sign-in gated. Public history was scanned with two bounded pages for each FAILED and COMPLETED filter, covering 50/90 and 50/395 respectively; the last-green-to-current interval was fully visible in the latest page. Do not infer results from unread pages or logs.

Current queued/running CI ids `40311256064` and `40312088029` may independently deploy a descendant. Observe their terminal checks/production result and live health when available; do not poll for capacity or pass QA from pending state. A persistent observed executable failure still blocks delivery even if another job is queued.
