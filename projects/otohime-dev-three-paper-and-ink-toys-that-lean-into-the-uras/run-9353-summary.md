# pm-269/t-1648 · run-9353 · Crumple accessibility gate repair

Latest local result: integrated UI E2E **255/255**, isolated crumple/basket
**19/19**, and all six exact Bottle contracts plus the deployment fixture pass.
The final repository suite passes **2,652/2,652** with zero skips. The original
Notes accessibility fix and the newly exposed footer SVG verifier defects are
repaired; hosted CI/production and independent deployed QA remain unproven.

Follow [run-9332's fix plan](fix_plan_t-1648_run-9332.md), preserving the historical
[QA fail verdict](qa_report_t-1648_run-9332.md). Both prior documents are copied
verbatim from owner-authored `d7d4c53ec7b2246f30c0a0d444c5d89ed9effcb8` so their
previous branch-only publication can reach main. This SWE run submits a summary,
not a QA verdict. [Run-9285's trigger repair](fix_plan_t-1648_run-9285.md) remains
intact; Bottle application code, lazy boundaries and production gates are unchanged.

The crumple test now captures the browser's actual link accessibility snapshot
before folding and compares it after restoration, requiring role-link presence.
Both snapshots use the same focused state; keyboard Peek's asynchronous
`aria-expanded` must settle before reading Projects links. The Notes RisoText
regression demonstrates that the old `innerText` matcher rejects an intact link,
then proves real fold/focus recovery. The identical restored-link helper rejects
a link hidden after folding and a changed accessible name, and passes after
each mutation is removed. The initial stronger oracle exposed the Peek focus
state difference; that failed log is retained and a lesson is recorded.

## First verification, before concurrent-main integration

All checks passed on the first executable fingerprint
`e080ca3fa638d24d64de9ea74ba31b050b4a1985d4d44566702ca32330cec16b`:

| Check | Result |
| --- | --- |
| Isolated crumple production browser | 12/12, no skips |
| Full `npm run test:e2e` | 248/248, no skips, 705.0 seconds |
| Bottle layout/picker | 12/12 |
| `npm test` | 2,627/2,627, no skips |
| Lint/typecheck | Exit 0; 10 existing warnings, zero errors |
| Gate closure | Certified, all eight named controls; actual locked imports and Postgres assets |
| Bottle production browser | 14/14 |
| CI-mode footer walk/Chromium probe | 65/176 assertions |
| Deployment fixture | 63/63 assertions |

The seven Bottle/deployment commands run through `scripts/verify-bottle-contracts.mjs`,
which also rejects silent/missing/skipped evidence. Every receipt negative control
passes. Real geometry at 1366×768, 768×1024 and 390×844 preserves default/24px/32px
labels, settled 200% root growth, 44px targets, border/scene clearance, alignment,
TV clearance and state stability; both historical CSS mutations fail the same
containment helper. Footer/Pocket history, blocked storage, safe Visit, Escape
focus return, legacy Tab order, pending-only Postgres suggestions, offline/429,
reduced motion and no-JS pass. Bootstrap is 1,634 gzip bytes, panel/CSS 4,966, CLS 0.
Initial build `7SxOWZW89w43kj4ZEu6Bp`; Bottle `0QfVxo2qmvlwTzi3mutr7`;
footer `raSaKXF7zf2r4SlzXJGqC`; Chrome 156.0.8078.48.

## Environment and evidence boundaries

Node 22.23.4, darwin arm64, official tarball checksum verified; `npm ci` installs
the lock without changes. Actual imports: Next 16.4.2, React 19.3.0, Playwright
Core 1.64.0, pg 8.23.1, embedded Postgres 17.10.0-beta.17. Installed Next's
lazy-loading guide was read. Production builds/start, browser Canvas/accessibility,
migrated disposable Postgres, local HTTP and real shell/processes execute.
Browser storage/network edge responses and historical CSS are explicit fixtures.
The full E2E additionally runs the locked CPU camera worker/model with 478-landmark
and no-face controls; synthetic media/worker paths separately test lifecycle.
Fake Vercel CLI/vendor API responses prove orchestration, not hosted authorization.
No live suggestion, external Visit, pipeline watch or deployed-system check occurs.

Persisted profile: `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`,
fleet worker `billie-mac`, account `codex-main`. At initial inspection, bounded global coding-task history reads
FAILED offsets 0/3, limit 3 (6/126), COMPLETED offsets 0/3 (6/1327), and RUNNING
offset 0 (3/4); later offset 3 returns 2/5 with a duplicate, so current pagination
is also incomplete. Raw QA run-9332 tail confirms its successful branch-only
`d7d4c53` push followed by `push_not_on_main`; delivered callback/one attempt agrees
with persisted failure and zero callback-application failures. Raw run-9320 tail
confirms branch/main `b76a19d` publication; COMPLETED/delivered/one attempt agrees
with succeeded run/rep-5527 and zero application failures. Sampled completed
run-9352 verifies an unrelated executable and cannot prove Bottle recovery.
Earlier raw bodies, unread pages and callback transport internals are inconclusive.

Logs, named gate receipts, build/chunk/binary identities, per-file hashes, history
observations and `commits.txt` are saved under `shared/artifacts/run-9353/`.
Generated history/build output, binaries, secrets and lock changes are excluded
from this commit. The two platform guide paths in the task are absent from this
standalone repository, as its plan already documents; root AGENTS.md is followed.

## Publication and deferred hosted evidence

The branch began at freshly fetched `f4b3de8`, then fast-forwarded an unrelated
QA document at `b5fa423` without executable changes. A later fetch found main
`94f8dd4`, including concurrent crumple repair `657f047`. The first tested commit
`d9c4b56` rebased onto `78eea45` as `14db2e3`, preserving the incoming folded-source
and focus-loss controls. The combined isolated suite passed 14/14. A second full
run passed 249/250, failing only unchanged Ink Lab's 100ms bound at 124.6ms
(one update, SVG ready before paint). Its separate withheld-frame test passed.
Unmodified isolated Ink Lab then passed 11/11 at 41.1ms. The timing cause remains
unattributed; no application or timing-bound change is claimed as a repair.

Main subsequently added Ghost activation tooling and a schema/migration author
guard (`4a1c848`, `88ac8b2`, `7ba2e80`). A clean rebase preserved those changes
as implementation `6f67f75983a949997276be819de749f77b260982` on base
`7ba2e804a9f9ecc9d490c4cbbae1eb27a6a3c75e`. App, component, library, crumple-test,
E2E-runner and lock bytes are unchanged from `14db2e3`; the broader executable
fingerprint changes with the incoming CI/package/activation files. The latest
isolated crumple suite again passes 14/14. All first, failed and subsequent
receipts remain separate; earlier results are not substituted for final checks.

## Revalidation on `6f67f75`, before the incoming basket feature

The exact combined fingerprint is
`52dcb029c5773b9fcc172adf1f36ee81bfe880b39e99f28388aba583bafce70c`.
Fresh isolated crumple passes 14/14, and full E2E passes 250/250 with no skips
in 725.1 seconds. Ink Lab measures 2.9ms with its unchanged 100ms bound;
the earlier failed sample remains in `revalidated/full-e2e.log`. Its cause is
unproven, and no permanent performance repair is claimed.

All six exact Bottle gates and the deployment fixture pass again, including
their evidence negative controls: layout/picker 12, repository 2,637, lint/types
zero errors/10 existing warnings, certified real closure, browser 14,
footer walk 65/probe 176, deployment 63. Fresh build IDs and complete receipts
are under `shared/artifacts/run-9353/final/`; full E2E uses build
`XYsQMGrIb-OJ9P2YJBn-o` and the Bottle gate uses `n9Ei1M8bQHGX6Kd2lzzzX`.

Main then advanced to `fb17af7`, including basket implementation `f7f55ed`.
That changes the footer, crumple lifecycle and browser coverage, so this passing
pre-basket receipt cannot establish the combined runtime. The landed feature
was preserved and its integration was revalidated below. A second documentation
commit recorded the completed pre-basket observations before rebase; amendments
and force-pushes remain excluded.

## Final integrated verification

After integrating `fb17af7`, a fresh production build `h3E7QbeyzFBHnDB7tTRIf`
passes crumple/basket isolation **19/19** and complete `npm run test:e2e`
**255/255**, no skips, 770.1 seconds. Its runtime fingerprint is
`856ca7f02ada75aad7eff1c18a50f2a92eadd6578858b2a5d1f2f7be51d5ab7d`;
receipts are in `shared/artifacts/run-9353/basket-integration/`. Ink Lab measures
20.7ms without changing the 100ms limit. The earlier single failed sample is
retained, with no deterministic timing cause or performance repair claimed.

The six Bottle gates exposed a separate integration defect: seven SSR routes
counted the new semantic basket as a fourth decorative SVG. Fixing the walk
then exposed the identical assumption in eight Chromium route checks and the
no-JS check. The repair retains exactly three hidden scene layers, requires one
named accessible basket, and retains one hidden final waterline wave. The
actual shell block's VM regression fails against the old checker and passes
after repair. The shared browser helper runs in real Chrome with JS on/off;
the same checker rejects missing/duplicate baskets, missing/extra layers,
unhidden decoration, wrong/hidden basket semantics, missing/duplicate/nonfinal
waterlines and a missing footer. All geometry assertions and thresholds remain
unchanged. Both new named regressions are mandatory in Bottle unit receipts
and the **ten-control** closure; the DOM helper is fingerprinted.

The archived closure still fails validation. Its labelled synthetic parser
fixture now supplies current control groups and rejects a coherent passing
receipt omitting only the new SVG regression. An initial mutation incorrectly
selected a command by index; selecting `end` by ID fixes that test. Failed
walk/probe, unit and parser attempts remain under `delivery/`; synthetic HTML
and TAP demonstrate verifier behavior, while the final real HTTP walk, Chrome
probe and locked-import/binary closure establish execution.

Report-only main advances through `00e48d6` changed no runtime source. Main then
added `c1d4726`'s standalone sky module and unit tests; direct source inspection
finds no existing Notes runtime import. Its unit tests are included in the fresh
repository run. The existing UI/crumple/e2e/lock bytes match the 255-test proof;
only verifier/test files and the unused sky module differ. Per-file hashes
record this boundary instead of substituting an unrelated SHA's evidence.

Final tested source fingerprint:
`cea0b46806fd77108188b774b333a5498c39b37938ab0510bccf1fde3c612adc`, on
`d0711b1fef128c19546cc9eda4ed1725d9c91eb9`, base
`c1d4726e7a4c049ebeb971911f984fbbc0e355d6`. This final documentation update
changes no fingerprinted executable file. All seven commands and their
positive/evidence-negative controls pass in `shared/artifacts/run-9353/publication/`:

| Final contract | Result |
| --- | --- |
| Bottle layout/picker | 12/12 |
| Repository `npm test` | 2,652/2,652; zero skips |
| Lint and types | Exit 0; zero errors, 10 existing warnings |
| Actual locked-import/Postgres-binary closure | Certified; all ten controls |
| Bottle production browser | 14/14 |
| CI-mode footer walk/Chromium probe | 65/176; zero failures |
| Deployment fixture | 63/63 |

Final Bottle build `faYLBZofubcAijGMc76WA`; footer build
`DJXU31YWrE16IBjSSXIwa`; Chrome 156.0.8078.48. All three viewports retain
44px targets, 4px normal scene gap, minimum border clearance 2.40625px,
default target growth 44→45.796875px at settled 200% root size, and both
historical CSS negative controls. All Footer/Pocket interaction, storage,
pending-suggestion, reduced-motion, no-JS, alignment, TV-gap and stability
contracts pass. Bootstrap is 1,634 gzip bytes, panel/CSS 4,966, CLS 0;
JS/CSS hashes remain `e4b166ce41b6aa0e4172bf530d9dd20593d3a6f0fffa02a896fe9b48567ea167`
and `f16c4d552e8f62e4858d07bc747b97b16b181f80512f6f220fc3ceb01a362be2`.

Four focused task-prefixed commits preserve the original fail report and fix
plan, add the crumple regression, record completed verification before a
concurrent runtime change, repair both structural verifiers, and record these
final receipts. The branch is `pm-269-t-1648-run-9353`; the delivery is its
final report commit, recorded in both run-specific and root shared-artifact
`commits.txt`. Publish that tested descendant to the task branch and main with
ordinary forward-only pushes. Commits are created on the task branch.
Generated history, binaries, secrets, stashes, amendments and force-pushes
are excluded.

Local execution is demonstrated. Hosted integration and product delivery remain
unproven; no capacity or operator wait is used. Plan-manager/CI owns t-1648's
push-triggered workflow (new IDs unobserved): require green checks and production,
explicit team/project-bound READY and health serving a descendant containing
`b76a19d` and this delivery. Any red job, non-READY response or ancestry mismatch
fails; the historical hosted E2E defect remains open until these observations.
Independent QA owns fresh served-SHA Footer/Pocket desktop/mobile text/zoom,
lazy/CLS, user-path and unauthenticated admin-API 401 negative-control evidence.
Any identity, geometry or interaction regression fails. Stop at tested push;
do not mark product delivery or QA pass from these local scripts.
