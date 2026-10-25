# Fix plan — pm-241 / t-1474 / run-8422

**Cause: code.** Delivery `96120648889ec448fe0ebe380093bff29e9d3593` has green gate `ver-3353` and green delivery/deployment CI, but its full deployed browser probe repeats two failures. Correct the verification executable; QA changed no application source. The earlier React #419 defect is resolved: signed-in probe 356/0 and independent six-denial reproduction both pass.

## D1: Attribute requests to the existing television correctly

**Change:** `scripts/probe-end.mjs:156–172`, especially line **171**, and its network assertion at **1838–1841**.

The request listener attributes every external request on `/music` to the footer unless its entire URL matches a substring regex. Real YouTube child frames also request `googleads.g.doubleclick.net` and `static.doubleclick.net`; both deployed runs fail this assertion. Independent request-frame evidence shows those requests originate inside `https://www.youtube.com/embed/`. A fresh control keeping the footer present emits three ad requests with the player enabled and zero when only the iframe API is aborted. This is an attribution defect in the delivered probe, not a new footer network request or third-party outage.

Use parsed origins/hostnames and request-frame ancestry to identify the existing television boundary. Explicitly allow the existing player API/bootstrap and resources belonging to its verified embed frame; continue rejecting unexpected requests from the site's main frame and every footer interaction. Avoid a blanket doubleclick/domain exception or whole-URL substring matching. Do not change `components/television.tsx`, production songs, shared infrastructure, or runtime dependencies to silence the check.

Add a meaningful browser attribution control: known player child-frame traffic must be classified separately, while an unrelated main-frame/footerside external request still makes the same assertion fail. A URL with `youtube.com` only in a path/query or an attacker hostname must not bypass classification. Keep any synthetic request interception and failure control local to the browser; remote mode must not write to deployed services.

## D2: Wait for the badge's observable state

**Change:** `scripts/probe-end.mjs:1359–1390`; audit the equivalent fixed restore delay at **1396**. Keep the original visibility/opacity, route, defaults, copy, storage and state assertions.

Replace the fixed `waitForTimeout(250)` with a bounded wait for the visible footer's unlocked badge and computed `visibility=visible`, `opacity>=0.99`, then run the existing assertion. A suitable short deadline must still fail an invisible/stuck badge. Capture computed styles, transition currentTime/duration, document visibility, actual SHA and visible footer count on timeout. Do not remove `badgeVisible`, lower opacity thresholds, or suppress the failure.

Independent three-context evidence confirms the timing mechanism: on cycle 3, after 250 ms wall time, the 150 ms transition had advanced only **66.735 ms** and opacity was **0.741712**; bounded waiting subsequently reached **0.992904** and passed the unchanged threshold. Both complete deployed probe runs reported correct unlocked/readout/LCD/storage but false badge visibility. Add an isolated negative control holding badge opacity at zero and prove the bounded assertion still fails before restoring/reloading. If a real badge fails to settle within the deadline, diagnose that as a product defect; do not weaken the contract.

## Verification and delivery

1. Read installed Next guides before any component/layout change; none appears necessary for these two probe fixes. Inspect current executable/lock/config fingerprints and preserve concurrent work.
2. Run all eight contract commands from `plan.md`: unit, lint, typecheck, production build, HTTP walk, footer Chromium matrix, existing motion probe and isolated RBAC/session E2E. Also run signed-in motion and the independent QA drivers. Use real locked imports/constructors, pinned Playwright and disposable migrated Postgres. Retain unset-TMPDIR coverage and the canonical-href negative control.
3. Exercise the full probe against a stable deployed SHA, with the real Music television enabled, all responsive/theme/accent checks, and the new attribution/visibility negatives. Independent QA must obtain observations beyond rerunning the author script. All failures remain explicit; a green subset does not waive D1/D2.
4. Commit as `Otohime <quiinthieu@gmail.com>` with no coauthor trailer, subject starting `pm-241/t-1474:`. Push `git push origin HEAD`; no CI repair is needed to run the existing pipeline again: push the corrected delivery to the delivery branch merged into main through the existing workflow. If push is rejected, pull/rebase, rerun tests and push without force. Preserve deploy/migration semantics.
5. Cite new delivery SHA, green gate, exact GitHub jobs, deployed `build-sha` and successful ancestry check. Read bounded failed/completed history and raw logs when accessible; record access failures rather than claiming them clean.

Owner: t-1474 software engineer, then independent quality engineer. Failure condition: either D1/D2 remains reproducible, any required suite exits nonzero, negative controls stop detecting failures, or deployed identity/green gate does not cover the corrected delivery. No operator chore, capacity wait, soak or natural-run polling is required.

Evidence: `qa_report-t-1474-run-8422.md`, `qa-t-1474-run-8422-evidence.json`, bounded-history JSON, and independent walkthrough/403/network/badge `.mjs` drivers in this folder. Raw GitHub logs and author.txt bytes remain 403-limited as documented in the report.
