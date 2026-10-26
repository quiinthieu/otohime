# Fix: Fetch back reachable past an open Peek — pm-259/t-1583, run-8911

Fix plan: [run-8896](../fix_plan_t-1583_run-8896.md). QA failure: [run-8896](../qa_report_t-1583_run-8896.md). Cause: **code**.

## Defect and change

Each project cartridge's title link stretches over the whole card. Resting the mouse on the card for 250ms opens that link's Peek fan, which is fixed at z-index 60, 12px below the pointer. The card's hover-revealed actions sit just below the card (`top:100%`), so a normal approach to Fetch back ended on `.peek-blurb`. The card then lost `:hover`, the actions went transparent, and the click created no proxy. Keyboard activation and the grip still worked, so the existing suite missed it.

- `lib/tactile.ts` adds the pure `actionsSide(fan, actions, current)` policy. It returns `above` only when an open fan's box overlaps the actions. Touching edges and non-finite boxes change nothing, and an `above` side stays `above`.
- `components/tactile/paper-layer.tsx` adds no new owner or global listener. The existing MutationObserver (now also watching `data-side`) and each card's own `pointerenter` measure the open `.peek-layer` against each hovered card's actions. On overlap the card gets `data-paper-actions="above"`, which is cleared on `pointerleave` and at teardown. The fan opens only while the pointer is on the link, so the move never pulls a button out from under the pointer. Leaving the link for the actions closes Peek through its own leave timer.
- `app/(site)/tactile.css` adds one rule: `[data-paper-actions="above"] > .paper-tools > .paper-actions { top:auto; bottom:100% }`. The default placement, margin note order, touch visibility and Peek itself are unchanged.
- `e2e/kame-fetch.test.ts` adds a continuous real-mouse test. The pointer rests on the first project until the real fan opens, visits the fan and returns, and checks Fetch back's box is clear of the fan. It samples `elementFromPoint` over 12 steps (never Peek, ending on Fetch back), checks the actions' opacity is 1, then presses and releases. It measures actual turtle arrival and return within 5s, the unchanged href and the source geometry within 1px. The reduced-motion and unreachable-turtle negative controls are kept.

## Red → green

- **Red before the fix**, with only the e2e test added (`artifacts/red-browser.log`): 11 fetch tests passed and the new one failed. The open fan `{x:194,y:267,w:456,h:183}` covered Fetch back `{x:484,y:327,w:90,h:44}`. The new unit test first failed on the missing `actionsSide` export.
- **Green on the final tree** (`artifacts/`), all four exact contract commands:
  - fetch policy and foundation 21/21
  - `npm test` 2169/2169, no skips
  - `npm run lint && npm run typecheck`: exit 0, the 10 existing warnings, 0 errors
  - production fetch/Kame/tear browser 28/28, production build `UKDMn8-27c236KGBtjdur`
- An intermediate iteration also passed all four. I then added the `pointerenter` re-measure for a pointer returning from the fan, and reran everything on the final source.
- **Footer Chromium probe, local**: **171 ok, 0 failed** on production build `F4PUG5DPaZ8CLJgdxieGM` (`artifacts/footer-probe.log`), including its canonical-href and unexpected-request negative controls. The first attempt with `CI=true` stopped before any assertion: on Linux that adds `playwright install --with-deps`, which needs sudo, and this lease has none (`artifacts/footer-probe-ci-true.log`). The rerun left `CI` unset and changed nothing else. Recorded as a decision.

## The red GitHub Footer Chromium probe (run 40315924641, job 121549479127)

- **Unreadable:** its raw log returned HTTP 403 without a token, and the check-run output is null. The only annotation is "Process completed with exit code 1" at `.github` line 188, so the failing assertion is **unread and inconclusive**.
- **Did not recur:** main run 40319672622 at `bca260a`, a descendant of `2992401`, is green. Its checks job 121564758332 passed the Footer Chromium probe (12:21:52–12:22:45Z) and production job 121569349661 succeeded.
- **Same probe and feature sources:** between `2992401` and `bca260a`, `scripts/probe-end.sh`, the footer, tactile/Kame sources and the lock are byte-identical.
- **Bounded history read:** one anonymous API page of 15 main runs (12:28Z): 1 in progress, 1 success, 1 failure (40315924641), 12 cancelled by concurrency. Older pages were not re-read, so this is not a complete history.
- **No change:** I did not edit `probe-end.sh` or the gate, because I could not name an assertion.

## Identity and boundaries

- **Run:** `run-8911`, profile `claude-opus-high`, model `claude-opus-5-5`, effort high, fleet worker `avietidol-z490`, Linux, Node v22.23.3, Next 16.4.2.
- **Hashes:** lock SHA-256 `2d0ec0be…791a8b`; per-file hashes in `artifacts/identity-sha256.txt`. `lib/kame-fetch.ts`, `components/tactile/fetch.ts`, the probe script and the lock are unchanged from the live fetch build.
- **Real:** Next production build and server, embedded PostgreSQL migrations, Chromium mouse/keyboard/CDP touch, the real Peek layer and `/peeks.json`.
- **Synthetic** (already in the suites): clock, lifecycle and preference fixtures, and the immobilised turtle.
- **Not applicable:** no queued runtime, capacity deferral or callback ingestion applies to this browser-only change.

## Push and rebases

- **Delivery:** `591c28e1758bb95605b93e1cc8f7d1225cc2d2dc` on main, pushed normally (`c0a40c2..591c28e`, no force). See `artifacts/commits.txt`.
- **First push rejected:** non-fast-forward. `git pull --rebase` brought in code changes, including fd99b92, which carries print runs through the root layouts. All four contract commands passed again on rebased `b51b063` (`artifacts/rebase1/`): foundation 21/21, `npm test` 2207/2207, lint/typecheck exit 0, browser 28/28 on production build `pR1QYv6JtUGePPA87LzyG`.
- **Second push rejected:** only report-only `c0a40c2` (pm-260 board record, `projects/**`) arrived. `git diff b51b063 591c28e -- . ':!projects'` is empty, so the four contract runs above cover the exact code tree that was pushed. The foundation suite was rerun on the final HEAD (21/21) before the third, successful push.
- **Footer probe run:** the 171/171 Footer probe ran on the pre-rebase tree (same feature code, older upstream). It was not repeated after the rebase.
- **Follow-up commit:** the commit carrying this addendum and `commits.txt` touches only `projects/**`, so it starts no CI. It is not the delivery SHA.

## Status

- **Execution demonstrated:** locally, on the production build above.
- **Integration deployed:** pending. The pushed SHA `591c28e` must go through main CI checks (including the Footer probe) and production.
- **Product delivered:** pending independent QA, which must repeat the live continuous pointer path, keyboard path and reduced-motion path at a deployed descendant of the pushed SHA.
- **Failure conditions:** a red or skipped checks or production job; live `/api/health` or the route `build-sha` not descending from the pushed SHA; Fetch back intercepted by `.peek-blurb` or transparent on a normal mouse path; arrival or return over 5 active seconds; source geometry or hrefs changed.
- **Owner:** plan-manager CI gate, then QA for t-1583.
- Engineering ends at the push.
