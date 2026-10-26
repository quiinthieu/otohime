---
plan_id: pm-256
run_id: run-8929
kind: acceptance_report
verdict: pass
cycle: 0
---

# pm-256 Ryugu Palace Experience: acceptance (run-8929)

**Verdict: pass.** Cited sha: live production `fd99b92fedd82b7953df5b6c414c9bfa339fc974` (`https://otohime.dev/api/health`, read at 12:52:57Z). It contains every product commit of the kept tasks: t-1559 `5cd6ee0` and `9d0fba4`; t-1560 `b0befb6`, `543ba68` and `9420077` (`git merge-base --is-ancestor`, all true). Scope: t-1559 and t-1560 only. Tamatebako (t-1561) and sound (t-1562) moved to pm-271 at the split. Ink ghosts belongs to pm-257.

## Walkthrough (production otohime.dev @ fd99b92, real Google Chrome via playwright-core; `acceptance_run-8929/walk.mjs`, output `walk.log`, 24/24)

| starting state | action | observable result | evidence |
|---|---|---|---|
| `/` at 1366×768 | type `urashimx` (negative control) | stays on `/` | walk.log line 1 |
| `/` at 1366×768 | type `urashima` | lands on `/ryugu` | walk.log line 2 |
| `/` at 1366×768 and 390×844 (touch) | click/tap the Pocket chip `▽ Dive` | lands on `/ryugu` | lines 3 and 14; shots/desk-pocket.png, phone-pocket.png |
| `/notes` scrolled to the bottom, both viewports | click/tap `Below the waterline: Ryugu-jo ↓` under the footer bar | lands on `/ryugu` | lines 4 and 15; shots/phone-waterline.png |
| `/ryugu` with WebGL (SwiftShader), both viewports | load, then move the pointer (desk) or tap the water (phone) | 200, `data-water=live`, 1 GL context, 126 / 49 frames, 9 of 9 fish transforms changed | lines 5–6 and 16–17; shots/*-palace-live.png show the caustic sea, the palace and the ink fish |
| `/ryugu`, both viewports | inspect stylesheets and markup | 2 sheets: the palace's own sheet plus pm-268's print-run sheet (only `:root` variables, no class rules). 0 Tailwind, `.chip`, `.btn`, `.machine` or `.cartridge` rules; no site footer, no Pocket; `noindex, nofollow`; no horizontal overflow | lines 7–8 and 18–19 |
| `/ryugu` live | set the page hidden, then visible again | 0 frames while hidden; 73 / 32 frames after it is visible again | lines 9 and 20 |
| `/ryugu` live | watch for page errors, console errors and same-origin 4xx/5xx | none | lines 10 and 21 |
| Chrome with `--disable-webgl --disable-3d-apis`, both viewports | load `/ryugu` | `data-water=static`, 9 fish drawn, 0 frames, no errors | lines 11 and 22; shots/*-palace-nowebgl.png |
| `prefers-reduced-motion: reduce`, both viewports | load `/ryugu` | `data-water=still`, 0 WebGL context requests, 0 frames, fish drawn | lines 12 and 23; shots/*-palace-reduced.png |
| `/ryugu`, keyboard only | Tab, then Enter | focus lands on `↑ Back to the surface`, which returns to `/` | lines 13 and 24 |
| real depth-1 clone at fd99b92 (as production builds it) | run the prebuild indexer | `fallback (shallow clone): 200 of 414 … unchanged`, exit 0, byte-identical to the committed `content/history.json`; `--check` exit 0 (shape only) | this run, temporary clone |
| real full clone at fd99b92 | index twice | `git (full history): 200 of 442`, the same sha256 `74882660…` both times, 42,625 bytes; first entry `fd99b92fed 2026-10-26T12:27:48Z pm-268/t-1599 …`; `--check` exit 0, lag 0 | this run |
| same full clone | tamper the first entry's subject, then run `--check` (negative control) | exit 1, `does not match git at its own head fd99b92fed` | this run |

## Deployment identity

- CI run 439, id 40322791706, `fd99b92`, success. Checks job 121571723005 (12:28:27–12:40:28Z): `npm test` and `E2E against next start` green. Production job 121577051485 (12:40:31–12:42:26Z): `vercel pull`, `vercel build --prod` (runs the prebuild indexer), `vercel deploy --prebuilt` and the health curl all green. Read from the GitHub REST API in this run.
- History scan: page 1 (`per_page=30`), runs 415–444 of `total_count` 425. Counts: 3 success (422, 438, 439), 1 failure (428, the footer Chromium probe, owned by pm-270), 24 cancelled by main concurrency, 1 in progress (440, `9cb3833`), 1 pending (444, `542c620`). Older pages unread.
- Delivery shas: t-1559 `9d0fba4` (in live), t-1560 `2cd4aef`. 2cd4aef is report-only, kept out of CI by `paths-ignore`, so it is not an ancestor of live. Its only diff against fd99b92 is in `projects/**` plus another plan's probe files. The indexer, its test, `package.json` and `content/history.json` are identical.

## Commit identity

All 19 `pm-256/` commits on main are authored by `Otohime <quiinthieu@gmail.com>`. `%(trailers:key=Co-Authored-By)` is empty on all of them except `8955310`. That one is a report-only t-1560 summary commit, superseded by `2cd4aef` in fix cycle run-8916; main cannot be rewritten without a force-push. Every product commit and both delivery shas are trailer-free. No author.txt was supplied.

## Real/fake boundary, limits, deferred

- Real: the production server, the CDN assets, Google Chrome, git clones of this repo, and the repo's indexer under node 22.12.0 after `npm ci` (macOS lease, Apple Git 2.54.0). Simulated: the hidden page (a `document.hidden` override plus `visibilitychange`), no-WebGL (Chrome flags), and WebGL itself, which ran as software SwiftShader rather than a real mobile GPU. The 390×844 context is Chrome mobile emulation, not Safari.
- Not read: Vercel runtime logs (this lease has no token). The palace is a static prerender, and the browser saw no errors.
- Expected and not a defect here: no page renders `content/history.json` yet. Its consumer, Tamatebako, is pm-271's. Production builds on a depth-1 checkout and ships the committed fallback (head fe0dd82, 200 of 414), which trails live by about 28 commits. Owner: pm-271 (Tamatebako) or the product owner. Failure condition: when Tamatebako ships, its newest entry is older than the product accepts. A `history:check` step or `fetch-depth: 0` on the deploy checkout would close this.
- Run profile: acceptance_engineer on claude-opus-5-5 (plan pin claude-opus-medium).
