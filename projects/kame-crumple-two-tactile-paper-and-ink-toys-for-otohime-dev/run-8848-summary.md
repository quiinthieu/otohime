# CI budget recovery — pm-259/t-1583, run-8848

The [environment fix plan](fix_plan_t-1583_run-8839.md) raises the GitHub Actions `checks` job budget from 20 to 35 minutes. This patch changes that setting and its explanatory comment. The parsed workflow otherwise remains identical: every test, motion/footer gate, permission, concurrency rule and production dependency is preserved. The fetch implementation, dependency lock and signed-in probe remain unchanged from delivery `9ddd0840d22564330e6c2554a52591b178909a4c`.

## Direct failure evidence

An existing authenticated GitHub reader retrieved complete raw logs for cancelled checks job `121521479367` (878,593 bytes), last green job `121516259788` (943,073 bytes), and the newest completed failed checks job `121530268639` (884,321 bytes). No credential was copied into the repository or evidence. Raw captures are in this run's `artifacts/` directory.

In delivery run `40307460821`, the motion step reports database readiness at `10:35:59.9019403Z`, its first browser assertion at `10:50:06.8192201Z`, 35 passing assertions and zero failing motion assertions, then cancellation at `10:50:25.2873306Z`. There is no completed probe summary. Its 14m07s pre-assertion interval covers silent npm/Playwright/browser setup and startup; the raw log cannot identify which installer consumed it. This is not evidence that browser assertions took fourteen minutes. The last green run `40306337481` takes about 19s from database readiness to its first assertion and completes `356 ok, 0 failed`. Workflow and probe source are identical between that green SHA `ae4607d` and fetch delivery `9ddd084`.

Main CI history was independently captured before push through four 100-item pages, with an eight-page bound, exhausting pagination: 396 runs, comprising 220 completed-success, 90 completed-failure, 84 completed-cancelled, one in progress and one pending. Counts describe that snapshot, not later pipeline state. Job lists were read for the named cancelled and green runs and failed run `40310239199`. Raw logs for other historical failures were not exhaustively audited. The cancelled delivery has skipped production job `121530267824`; the green comparison has successful production job `121520661524`.

The distinct failed run `40310239199` at `841ca69` reports a desk swipe assertion at `e2e/desk.test.ts:597`: music x=0.3 instead of 0.425. That historical failure remains recorded independently of the timeout fix; a passing local reproduction cannot erase the CI observation. It prompted the full local browser check below.

## Locked local execution

Run identity from plan-manager: profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, attempt 3, fleet worker `avietidol-mac-mini`. Environment: macOS arm64, Node `v22.23.3`, Next `16.4.2`, React `19.3.0`, Playwright `1.64.0`, embedded PostgreSQL `17.10.0-beta.17`. The installed Next production/Playwright guides and the recovered standing policy documents were read. No dependency or binary asset was added.

After refreshing from `5ef9b8a` onto `28d4542`, all four exact task commands passed again:

- Pure fetch/foundation: 20/20.
- `npm test`: 2,133/2,133.
- Lint and type checking: exit 0; ten existing lint warnings, no errors.
- Named production fetch/Kame/tear browser command: 27/27, with fresh real database migrations, production build and server.

The complete production browser suite also passed 110/110 on the same build (`SKIP_BUILD=1 npm run test:e2e`), including the exact desktop swipe case that failed in GitHub. These browser checks used system Google Chrome `156.0.8078.48`. The real signed-in motion script then passed 356/356 using its pinned Playwright Chromium shell, fresh real PostgreSQL and the same production build. It detected the deliberately removed pagereveal guard, exercised desktop/mobile and reduced-motion navigation, and deleted its probe accounts. Its installer and dependency construction ran without a fake. Captures: `artifacts/browser-full.log` and `artifacts/motion-probe.log`.

Production build ID: `byB3DsrmKVsV_8fctpfyM`. Lock SHA-256: `2d0ec0bea389a532592da1c7a96f8eb6452a90f055fa37cebb8a39d771791a8b`. Changed workflow SHA-256: `119c94747aec5b260651d388993c165cf8f698896e5a33ad8e95118e9145e636`. Unchanged signed-in probe shell SHA-256: `4ee8c36e27371885066edf60191162c904d4a86cd075f2da5d1dbe365178a3d0`. Relevant application/configuration/lock fingerprint: `792580ee7b3f7a7189ce9429db1fbcf21c7a55af2bd061c2f5983bafb83b80c7`; per-file hashes are in `artifacts/identity.json`.

The first normal push was rejected because main advanced. After `git pull --rebase` onto `45129f9`, all four exact contract checks passed again: 20 pure, 2,133 repository, lint/typecheck and 27 production browser tests. That named-command build is `5_Nt05l75I-dgPDOqWzBo`. Upstream changed the history test fixture, generated history and planning records; application, fetch/probe, lock and workflow sources did not change. The 110-browser and 356-motion results above remain evidence from the earlier explicitly identified build. The initial pre-existing generated-history modification is preserved in artifacts and a retained stash; its restoration conflicted with upstream's new snapshot, so upstream was retained rather than overwritten. It is outside this focused commit.

A second normal push was rejected after another report-only upstream push. Rebasing onto `4a87fc4` and rerunning all four exact contract commands passed again: 20 pure, 2,133 repository, lint/typecheck and 27 production browser tests. Final named-command build: `dYSO4Ktlw4Y1ZIym4-VEE`. No application, dependency or workflow change arrived in this second rebase.

The actual renderer, SVG geometry, native browser inputs, PostgreSQL and Next imports execute here. Synthetic controls deliberately freeze clocks, emulate preferences/Save-Data, inject lifecycle events and immobilize the turtle. In particular, the immobile-turtle negative control cancels rather than claiming return; real CDP card-body scrolling remains native. Local execution proves those paths, not deployment. No asynchronous runtime queue, capacity deferral, processor model or callback-ingestion history applies.

## Preservation and infrastructure boundary

**classification=infra: main integration is incomplete.** Three normal pushes were rejected as non-fast-forward (`04e6e09`, `27b28e5`, `ec95660`) despite all required checks passing initially and after both rebases. The standing retry limit requires preserving the tested work on `task-rescue/pm-259-t-1583-run-8848`. The single commit carrying this report is that preservation commit; `artifacts/commits.txt` records its full pushed SHA. It is not a main delivery. This branch does not match the workflow's main-only push trigger, so no CI recovery is claimed. Engineering ends at that push; no pipeline or deployed-system observation follows it.

Integration deployed: unproven; the patch still needs main integration. Waiting for runtime capacity: not applicable. Execution demonstrated: local production tests above. Product delivered: pending main integration, repository CI/production and independent deployed QA.

Owner: plan-manager's successor software engineer for `t-1583`, then CI/QA. Cherry-pick the preservation SHA from `commits.txt` onto fresh main, rerun the four contract checks and push normally. Once integrated, find that main SHA's Actions run, require successful checks and production, then verify live health and both page meta SHAs contain `9ddd084` and repeat the live fetch/native-input path. Failure conditions include another timeout/cancellation, a failing assertion (including the historical desk swipe), skipped/red production, a live build without fetch ancestry, missing Fetch back controls, arrival/return beyond five active seconds, changed source geometry/hrefs or broken native input. The old skipped production and pending replacement runs do not establish recovery.
