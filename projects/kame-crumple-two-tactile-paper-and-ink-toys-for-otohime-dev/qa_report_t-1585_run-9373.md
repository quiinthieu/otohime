# pm-274/t-1585 independent QA · run-9373

## Verdict

Pending final CI and served-identity observation at report time. Delivery implementation `f7f55edfe4d10062cdb25704aa95d83f03b4ef83` is an ancestor of main delivery `fb17af777a5b43f748542c4bba4643b321de4957`. Board green gate `ver-3723` passed for `fb17af7`. Both commits are by Otohime <quiinthieu@gmail.com> with no Co-Authored-By trailer; no `author.txt` accompanies the delivery. This QA checkout began clean on `fb17af7` and was branched from freshly fetched `origin/main`.

## Independent execution

- Locked Node 22.23.3, Next 16.4.2, Playwright 1.64.0, Chromium 156.0.8078.48, actual embedded PostgreSQL 17 migrations, production Next build/start, Canvas2D and native browser input constructed locally. Build ID `QXAZNcR8Wg4p9ylDd7Gb`; the two task chunk hashes and all 20 delivery source/lock/config hashes match `run-9370/artifacts/fingerprints.json` byte for byte. No model, generated artifact, remote compute queue, callback or ingestion path belongs to this browser executable.
- Required physics/shared lifecycle: 20/20 pass. `npm test`: 2640/2640 pass. Lint has zero errors and ten pre-existing warnings; typegen and TypeScript pass. Required production browser subset: 39/39 pass. No failures, skips or cancellations in those final runs. The build-generated `content/history.json` rewrite was restored from HEAD after testing.
- Separate QA browser probe `run-9373/independent-browser.test.ts`: 3/3 pass in the same real production server and locked browser. It starts Crumple with a native click, measures `elementFromPoint` over the first ball grip, places the ball by reduced-motion keyboard-equivalent Toss, verifies original anchor identities and card width after Iron, and returns by real browser Back with one paper mount. A 390px mobile viewport verifies defined ink/paper tokens and non-overlapping basket, Iron and shell boxes. The bfcache disabling Chrome flag was removed, but the persisted pageshow marker was absent, so actual bfcache restoration remains unproven. The delivery's synthetic pagehide/pageshow test proves its adapter path only.
- Independent direct import of `lib/crumple.ts` in a 390×844 world: an x=195 downward shot entered the basket at 760ms; the same launch at x=130 struck the rim 185 times and settled outside at 5000ms. This is a relevant negative control with different inputs from the supplied test. Visual inspection of `/tmp/t1585-basket.png` showed the paper ball inside the visible ink basket and distinct Iron, shell and footer controls. The screenshot is not committed.
- Fake boundaries: the existing E2E harness supplies unrelated Ghosts network fixture content. Browser fake time drives physics elapsed time in the required suite; the separate QA native-click check used real browser time. Synthetic hidden/modal/pagehide and injected clock controls do not prove an actual browser bfcache restore.

## Live and historical evidence

- Production `/api/health` initially returned `4a1c8487fe46c254a92dad2b7f2699b5410023f9`, later `7ba2e804a9f9ecc9d490c4cbbae1eb27a6a3c75e`. Both are ancestors of `fb17af7`, while `git merge-base --is-ancestor fb17af7 <served-sha>` returned 1 for each. The live `/notes` server HTML at the first SHA lacked `data-paper-basket`. This is an independent stale-deployment rejection control, not a test of the delivered runtime.
- Exact delivery GitHub run `40658669258`, checks job `122715901437`, entered `E2E against next start` at 2026-10-28T08:47:23Z and was still in progress at the last interim check. The prior green run `40656021869` had successful checks job `122707137459` and production job `122715313603` at older SHA `4a1c848`; its application code and workflow differ from the delivery. A green gate on `fb17af7` is recorded separately from this main CI run.
- Bounded public GitHub API scan: FAILED pages 1–2 read 20/155; COMPLETED pages 1–2 read 20/557. Filters overlap, older pages are unread, and full-history conclusions are inconclusive. Current snapshot showed IN_PROGRESS 3/3, QUEUED 0/0; one in-progress run is the delivery. Historical failed run `40646398062`/checks job `122676106582` failed `E2E against next start`; production job `122682402401` was skipped. Its public annotation names `e2e/crumple.test.ts:80`, accessible-link assertion `0 !== 1`, and a bounded 80-line tail. Raw job logs returned HTTP 403 (admin required), so the full failure is unread. That run uses SHA `770acf8`, pre-basket crumple code and older CI configuration, although its npm lock hash matches the delivery; it is not a repeat of the delivery executable fingerprint. No delivered deterministic failure was observed locally.
- The cited plan path currently contains a pm-259 recovery document; its supplied commit `cdfdd9de...` is a pm-259 edit that includes this t-1585 build contract. The referenced extraction and software-development documents are absent in this checkout. Supplied task/AGENTS instructions and installed Next lazy-loading/client guides governed the QA work.

Actual QA run profile is `codex-sol-medium`, model `gpt-6-sol`, effort `medium`, fleet worker `avietidol-mac-mini`, from `plan_manager_get_run run-9373` profile_flags. The engineering run's separate recorded profile was `codex-sol-6-1-high` / `gpt-6.1-sol` / `high`; no behavior in this report is attributed to an inferred default.

## Delivery boundary and deferred checks

Local executable construction and execution are demonstrated. Main integration code is pushed. Served product delivery remains unproven until `/api/health` cites a commit containing `fb17af7` and that build passes the actual user path. The exact CI job is executing, not waiting for runtime capacity; no operator chore or callback ingestion applies.

| Check | Owner | Failure condition |
| --- | --- | --- |
| `40658669258` checks `122715901437` and subsequent production job | GitHub Actions / plan green gate | Red/skipped checks or production, missing exact delivery ancestry, or absent production job |
| Served `/api/health` and `/notes`/`/projects` basket, native hit/miss, keyboard/reduced Toss and Iron | Independent QA / acceptance | Served SHA lacks `fb17af7` ancestry, basket absent, hit/miss/Reset wrong, source content or Kame/footer controls regress |
| Actual bfcache restore | Acceptance browser check | A persisted pageshow occurs and creates duplicate mounts or loses original source paint; current local browser did not enter bfcache |

There is no basis to call the old `770acf8` CI failure a current deterministic defect. A pending CI run or a stale served build cannot establish product delivery.
