# QA report: t-1474 (Prove footer interactions and polish the scene), run-8449

**Verdict: PASS.** Run profile: Claude Agent SDK, model `claude-opus-5-5`, quality_engineer role.

## Identities

| Item | Value |
| --- | --- |
| Delivery sha | `791f08d36a0f836b1104289b7d114a74e6cbfe91` (fix cycle 2; t-1474 commits a750f28, 6b31607, 9612064, 791f08d) |
| Green gate | ver-3365 (run-8444), status pass, git_sha 791f08d |
| GitHub Actions | run 40236091838 for 791f08d: `checks` success (includes "Footer walk and Chromium probe" and "Motion probe, signed in"), `production` success |
| Deployed | otohime.dev `build-sha` was 791f08d at the start of this run. During the run it moved to c885936, then to 84dc823 (CI 40237298830 success). `git merge-base --is-ancestor 791f08d 84dc823` → yes. 791f08d..84dc823 only adds pm-240/pm-242/pm-247 commits |
| Lockfile | package-lock.json sha256 `e7aa5d85635862f956400a2d67338cd661d01d0dcab8cf959ea1d6d58be96877`, `npm ci` in a detached worktree at 791f08d |
| Runtime | Node v22.23.3; Playwright 1.64.0, Chromium headless shell 156.0.8078.4 (Linux lease) |
| Author | All four t-1474 commits are authored and committed by `Otohime <quiinthieu@gmail.com>` with 0 Co-Authored-By trailers. No author.txt was supplied |

## Contract verification (exact commands, worktree at 791f08d)

| Check | Result |
| --- | --- |
| `npm test` | exit 0, 1615/1615 |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `SKIP_BUILD=1 PORT=4081 bash scripts/walk-end.sh` | exit 0, 67 ok / 0 failed |
| `SKIP_BUILD=1 PORT=4083 bash scripts/probe-end.sh` | exit 0, 170 ok / 0 failed, including the href negative control (fails on `/broken-play`, passes after reload), the network-attribution controls and the held-badge control |
| `SKIP_BUILD=1 bash scripts/probe-motion.sh` | exit 0, 510 ok / 0 failed |
| `SKIP_BUILD=1 APP_PORT=4085 bash scripts/e2e-local.sh` | exit 0, 33/33 |
| Build rebuilt with `GITHUB_SHA=791f08d…`, then walk and probe with `EXPECT_SHA` set | 67/0 and 170/0 (exact build identity proven) |
| Identity negative control (harness accident) | An unstamped build ('dev') with `EXPECT_SHA=791f08d` made the walk fail 19 checks, so the identity check does reject a mismatch |

## Independent walkthrough (my own script, not probe-end.mjs)

Local `next start` of the stamped 791f08d build with the probe's placeholder auth environment. Format: starting state · action · observable result · evidence.

| Starting state | Action | Result |
| --- | --- | --- |
| fresh `/` desktop 1366×768 | load | 1 footer, not yet seen, sha 791f08d |
| `/` footer offscreen | scroll into view | `data-seen=true` |
| `/` footer visible | click footer **Work** | URL /work, 1 footer (client navigation) |
| /work | scroll, click footer **Projects** | URL /projects, 1 footer |
| /projects footer | click **Back to top** | scrollY=4, activeElement = `main` |
| /projects desktop | overflow | 0 px |
| **Negative control:** fresh storage, footer in view, textarea focused | type the full Konami sequence | unlocked=false, storage null (textarea received "ba") |
| locked, in view | wrong sequence | unlocked=false |
| locked, in view, body focused | correct Konami | unlocked=true, `end:achievement=1`, URL stays /work, readout "Achievement unlocked: Reached the end." |
| unlocked | reload | unlocked restored |
| fresh, footer offscreen | Konami | stays locked |
| 390×844 touch | tap "Customize scene" | details closed → open |
| disclosure open | tap the 5th of 5 swatches | `--fig` #93d3b0 → #f3a6bb |
| mobile mascot | tap | readout cycles; eyes stay at identity |
| 390×844 / | overflow | 0 px |
| light / dark on /music | title vs paper contrast | 14.4:1 / 14.06:1, `data-theme` matches |
| reduced motion | pointer sweep over mascot | 0 running animations > 1 ms, eyes identity |
| reduced motion | Enter, then Space on mascot | readout advances twice |
| desktop | pointer to stage top-left, then bottom-right | pupils translate(-2.2, -1.5) → (2.2, 1.8), within bounds; reset to (0, 0) on leave |
| JS disabled /notes | read footer | heading, 6 hrefs /work…/sketches, "© 2026 Otohime", top=#main, 3 SVGs; anchor click → #main |
| storage throws SecurityError | in-view Konami | unlocks ephemerally, 0 new errors |
| all contexts | page/console errors | none |

Result: 26 ok / 0 failed. Screenshots were reviewed locally and kept out of git: desktop light Home, dark Music, unlocked Work, mobile Home. The composition is coherent, the ink and pastel accents are consistent, there is no clipping, the LCD text ("SAVE POINT", "REACHED THE END", "HI THERE") fits, the badge sits in reserved space, and mobile hides clouds while keeping the stars.

## Live read-only evidence (not a contract item)

`BASE_URL=https://otohime.dev` ran five times with `probe-end.sh` and twice with `walk-end.sh`.

- **Run 1 (probe):** only the 18 build-sha checks failed, because production had moved to c885936.
- **Run 2 (probe):** 165 ok / 2 failed. The run straddled the c885936 → 84dc823 deploy (84dc823 changes handheld.tsx/figures.tsx): the mobile restore delta was 143 px between the two builds and a /projects chunk returned 404. Both are deploy skew.
- **Runs 3–4 (probe):** `page.goto /music` timed out at 30 s waiting for the YouTube `load` event. Run alone, live /music loaded 7/7 times in 0.56–2.2 s.
- **Run 5 (probe, stable 84dc823):** 149 checks ok with no failures, including both layout-stability checks, the badge settle and every Konami check. The run then died with `net::ERR_NETWORK_CHANGED` on the lease.
- **Walk on 84dc823:** 65 ok / 0 failed.

The earlier QA defects (rep-4879: false network attribution, badge timing) did not recur in any live run that reached those checks.

## Limits and deferred checks

- Chromium only; Firefox and Safari were not run.
- The live probe never completed end to end in this run, because of lease network and third-party load timeouts. Owner: acceptance (pm-241). It fails if a stable-deploy live run shows a footer-attributable failure.
- Signed-in rooms are covered by the local e2e (33/33) and the CI signed-in motion probe. No production accounts were used.
- A local `next start` without `BETTER_AUTH_SECRET` throws React #441 and drops the footer. This is a configuration-only artefact: production and every probe set the secret. Recorded as a lesson.
