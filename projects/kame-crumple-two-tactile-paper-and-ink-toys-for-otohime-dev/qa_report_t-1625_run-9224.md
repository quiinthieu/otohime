# QA report — pm-259/t-1625 — run-9224

Verdict: **pass** for the complete production browser recovery. Delivery and deployed SHA are both `739ca990a632e31ca718924346bf6b8e1fc387e1`; `git merge-base --is-ancestor` exited 0. The exact SHA has board green gate `pass` and [GitHub CI run 40499670850](https://github.com/quiinthieu/otohime/actions/runs/40499670850) completed `success`: checks job `122173896509` and production job `122181114192` succeeded, including deploy verification. A fresh `/api/health?qa=run-9224` returned that SHA. The delivery author and committer are Otohime <quiinthieu@gmail.com>, with no `Co-Authored-By` trailer; no `author.txt` accompanies this delivery. The report commit is a documentation descendant and is not substituted for the deployed executable.

## Independent execution and user path

On the clean delivered checkout, `npm ci` installed the unchanged lock under Node 22.23.3/npm 10.9.9. A real preflight launched Chrome 154.0.8037.57 through locked playwright-core 1.64.0, created a browser context and measured a heading rectangle, converted SVG to PNG with native sharp, and constructed `pg.Client` and `EmbeddedPostgres`. Next is 16.4.2. The full production runner started native PostgreSQL, applied migrations, built Next (local browser build ID `1peS3d_MB931a3wq8V79T2`), and served real HTTP/auth/browser paths. This is local execution evidence, separate from the deployed SHA and CI result.

| Contract on `739ca99` | Result |
| --- | --- |
| full serial production browser suite, `CI=true TMPDIR=/tmp` | 187/187, zero failed or skipped |
| isolated footer walk | 67/67 |
| isolated footer Chrome probe | 173/173 |
| isolated signed-in motion | 356/356 |
| foundation command plus fetch policy file | 16/16 + 5/5 = 21/21 |
| `CI=true npm test` | 2523/2523, zero failed or skipped |
| lint and typecheck | exit 0; zero errors, 10 pre-existing lint warnings |

The full suite observed actual turtle/proxy arrival and return within 4 px, continuous native pointer approach past Peek, CDP touch grip versus body scrolling, exact-once click suppression, normal link navigation, intact source content and geometry, reduced motion, Save-Data, dismissal, keyboard/sound controls, lifecycle cancellation, and desk/stamp exclusions. Its immobilized real-turtle control cancelled rather than claiming return. The footer probe accepted a real Chrome request after a player's initially blank iframe acquired its embed URL and **rejected the same embed URL from a footer iframe**, the defect-specific negative control. No browser tests were skipped.

Separately from the supplied proof scripts, I drove live Chrome on `/projects` and `/notes`. Keyboard Fetch back reached a measured turtle/proxy return gap of **0 px** on each route, then removed the proxy. Card text, hrefs and all four rectangle fields stayed unchanged within 1 px, with zero page errors. The accessible `Fetch back` button was found by role and name. Native click navigation from the project title reached `/shore` (HTTP 200). A 390 px reduced-motion Chrome context was the independent negative control: keyboard Fetch back created **zero** proxies and Kame reported `data-motion=still`. This proves served user behavior at `739ca99`; browser preference emulation is the only synthetic part of that control.

## Identity, history and limits

SHA-256 fingerprint anchors: `package-lock.json` `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`; `.github/workflows/ci.yml` `ef6d19d53cf3b6a1499559549776ceaf50866a35fe99dfb995637b6be825788a`; `scripts/e2e.mjs` `5144b88ea2938181307b1eb735bb5467879c37f8d87c1236a5e8b061a4c966f9`; `scripts/probe-end.mjs` `3c6a63d7f105f51133b8a9c1e7ca5b463ca5a622c1f8d236d42b0f7e0e2b16a1`; `components/tactile/fetch.ts` `495892d59bf67dd9be7259886c4cce7b31ab197eaafb2577b2bf292097ac17b6`; `components/kame/companion.tsx` `014d7cf8b87c9b45c6178b72ee5f65373755d0c644fea4742295759ccf1f10fc`. Kame uses inline SVG, with no separate runtime model/artifact hash. Older green run `40493667124` served ancestor `85de500`, a different browser/probe executable; the exact delivery's green run is `40499670850`.

Bounded GitHub history read FAILED pages 1–2: **50/144**, and COMPLETED pages 1–2: **50/514**; filters overlap. Initial current state was one in-progress delivery run and zero queued; it later completed successfully. Older pages remain unread, so historical completeness is **inconclusive**. Historical jobs `121649860247` and `121654087754` in runs `40345114517` and `40346324813` are recorded failures; metadata is readable, but their raw log endpoints return HTTP 403. The prior public annotation identifies the already repaired ink-radio assertion for the former; the latter exposes only Footer walk exit 1. Their exact raw tails remain unread. The current delivery's full checks and production success supersede those different executable fingerprints, without inventing their missing assertions.

Real boundaries: the current browser, production Next, PostgreSQL, native input and live site were exercised. Existing explicitly fake inference/WebSocket and adapter fixtures prove only their own controls; the footer frame fixture does not prove YouTube service availability. This task has no async model/runtime job, durable capacity queue, callback or persisted ingestion output to trace, and no capacity deferral. No observed defect remains at the delivered browser fingerprint. Overall pm-259 acceptance still owns its independent product walkthrough and any other plan tasks; it fails if the served SHA loses delivery ancestry or live native input, content, accessibility or geometry regresses. No calendar wait is required.

Recorded run profiles: engineering run-9221 `codex-sol-6-1-high` / `gpt-6.1-sol` / high on `avietidol-mac-mini`; this QA run-9224 `codex-sol-medium` / `gpt-6-sol` / medium on `avietidol-z490`.
