---
plan_id: pm-294
run_id: run-9303
kind: acceptance_report
verdict: fail
cycle: 0
cited_sha: 68dd79dba309c7713122e08b02ebb4e6844de749
---

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| otohime.dev, 2026-10-28 05:10 UTC | `GET /api/health`, `GET /play`, `/play/booth`, `/play/pachinko` | `{"ok":true,"sha":"22a88f0c7b4d…"}`; `/play` 200, `/play/booth` 200 with `permissions-policy: camera=(self), microphone=()`, **`/play/pachinko` 404**. Still the same at 05:23 UTC | curl |
| GitHub Actions, main | public runs list and run pages | `f50d7aa` run 40633395018 **failure**: "E2E against next start has timed out after 12 minutes", plus `e2e/bottle-ui.test.ts:185` footer-geometry assertion. `68dd79d` run 40635091133 **failure**: "Gate: Footer Chromium probe; exit 1 … not ok - network: zero unexpected external network requests from footer pages: /music → youtube.com/embed" (175 ok, 1 failed). The production job is skipped, so nothing after `22a88f0` is deployed | GitHub API (until quota ran out) + public run-page annotations |
| production, 1366×768, Chrome 155 with Chrome's synthetic camera device (`--use-fake-device-for-media-stream`, real `getUserMedia`) | open `/play/booth` | privacy line "Your camera stays in this tab. Nothing is uploaded."; camera state `idle`; **0** `getUserMedia` calls before opt-in | prod/results.json |
| same | click **Open camera** | state `streaming`, "LIVE CAMERA (LOCAL)"; constraints `{"video":{"facingMode":"user","width":{"ideal":960}},"audio":false}` | prod/results.json |
| same | pick Sumi-e, Riso, Newsprint | badge changes "Sumi-e Wash" → "Riso Two-Tone" → "Newsprint 45°"; renderer `webgl2`; viewfinder shows two-colour halftone dots in riso | prod/1366x768-booth-viewfinder-*.png |
| same, Sound On | click **Take 4 photos** | countdown overlay showed 3, 2, 1; log `3,2,1,shutter ×4`; 4 shutters, 4 ink flashes; 1 AudioContext, 26 oscillators (shutter clack); finished in 2.5 s; then `data-stream-active=false`, state `completed` (camera tracks stopped after frame 4) | prod/results.json |
| same | read the strip canvas | 600×1800, 4.7 % transparent (torn edge), luma σ 89; hanko `2026.10.28` = today; footer `otohime.dev`. Picture: four tilted riso frames on torn paper, red round date stamp, `otohime.dev` | prod/1366x768-otohime-booth-20261028.png |
| same | pen stroke (vermilion) + heart sticker, then Undo | strokes 1, stickers 1, strip pixels change; Undo removes the sticker | prod/results.json |
| same | **Download** | `otohime-booth-20261028.png`, 818,726 B, PNG signature `89504e47…`, IHDR 600×1800 | downloaded file |
| same | emulate `print` media | strip prints 5.00 × 15.00 cm; status bar, viewfinder and site header hidden | prod/results.json |
| same | audit every request of the walk | 60 requests, all GET to otohime.dev; 0 non-GET, 0 bodies, 0 third-party hosts (no image upload) | prod/results.json |
| production, 1366×768, Chrome **without** a camera device (negative control) | Open camera, then Take 4 photos | real `NotFoundError` → state `sample`, "SAMPLE PAPER PORTRAIT"; 4-frame strip still made; status "Captured 4 of 4 frames … Camera tracks stopped." 0 page errors | prod/1366x768-booth-nocamera.png |
| production, 1366×768, `prefers-reduced-motion: reduce` | sample portrait, Take 4 photos | countdown `3,2,1,shutter ×4` kept; ink flash `animation-name: none`, opacity 0 while active; indicator "SHUTTER · 4 CLACKS" | prod/results.json |
| production, **390×844** (mobile, touch, DPR 2) | the same 16 booth steps | all 16 pass: camera, film stocks, 4 shots in 1.9 s, strip, doodle/undo, PNG 600×1800, print 5×15 cm, 0 uploads, no-camera fallback, reduced motion | prod/results.json (32/32 booth steps) |
| local production build of origin/main `4614484` (app code = `68dd79d`; Next 16.4.2 `next start`, BUILD_ID `xU0PITRaFh3iWdFKELywB`, embedded Postgres via `scripts/e2e.mjs`), 1366×768 and 390×844 | `/play` → teaser links → click | `play-booth-link` "Open Ink Purikura Photobooth →" and `play-pachinko-link` "Play Pipeline Pachinko →" both inside the viewport; clicks reach `/play/booth` and `/play/pachinko`; 0 console errors | local/results.json |
| local, both viewports | plunger drag-and-release; Launch record; Space | `touch-action: none`; pull 1.00; launched 1 → 3 | local/results.json |
| local, Sound On | **Backfill (60 records)**, sampled every 2.5 s for 60 s | IN-FLIGHT 60 → 40 → 15 → 8 → **7 and stays 7 to 60 s**; settled 30 (25 partitioned + 5 DLQ), 23 joins; records/sec peaks 5.2 then decays to 0; late arrivals 83.3 %. The 7 lodged records sit on the join funnel's slanted arms against the blue pegs | probe/1366x768-probe-board-60.7s.png, probe.json |
| local, other seeds (`?seed=777`, `424242`, `20261028`) | Backfill, read after 40 s | IN-FLIGHT stuck at **10**, **8**, **7** | seeds run log |
| local | bar chart, peg clicks, nudge, tilt | p0..p5 bars 13–67 px track the counts; 1 AudioContext, 451 oscillators; ArrowLeft + "Nudge right" → `Nudges: 2 (right)`; tilt via Chrome DevTools `DeviceOrientation.setDeviceOrientationOverride` (gamma 22) → "Tilt active (22°)" | local/results.json |
| local (negative control) | 2 × "Inject DLQ spill", then 1 normal record | streak 2 → 0; no pager | local/results.json |
| local | 3 × "Inject DLQ spill" in a row | `role="dialog"` "SEV-2 · PAGER ALERT … On-Call Pager: 3 Consecutive Dead-Letter Queue Spills"; focus on `pachinko-pager-dismiss`; rect inside 1366×768 and 390×844; Enter dismisses, streak resets to 0 | local/results.json |
| local, look at the pager | screenshot | **Not a paper card.** It has no background or border: its text is printed over the board and the bucket labels (1366×768), and over "Back to Play" and the Bottle widget (390×844). It reads as overlapping text, not a dialog | local/1366x768-pachinko-pager.png, local/390x844-pachinko-pager.png |
| local, look at the machine | screenshots + `getComputedStyle` | root frame, sticky status bar, every `.pachinko-btn`, plunger track and knob: `border: 0px none`, `background: transparent`. There is **no visible plunger** to pull, just the vertical word "PLUNGER ↓". Buttons are bare bold text. When scrolled, the transparent sticky status bar ("IN-FLIGHT: 7 SETTLED: 30 …", "Peg clicks", "Enable tilt") overprints the site header's logo, Sign in and theme controls | local/*-pachinko-initial.png, probe/390x844-probe-view.png, probe.json |
| local | root cause check | `getComputedStyle(documentElement)`: `--fg=""`, `--bg=""`, `--accent=""` (site tokens are `--ink #2b1a12`, `--paper #f2e9de`). `pachinko.css` uses `var(--fg)` 41×, `var(--bg)` 22×, `var(--accent)` 14×. Those declarations are invalid at computed-value time and drop out. booth.css uses `--ink`/`--paper` and renders correctly | grep + computed style |
| local `next start` log | read after the walk | clean: start banner only, 0 errors | local-server.log, server2.log |
| local, reduced motion | load `/play/pachinko`, Backfill | batch 12; 0 AudioContexts with sound at its default Off (negative control) | local/results.json |

# Acceptance: Ink Booth & Pipeline Pachinko (pm-294), cycle 0

**Verdict: fail.** The Ink Purikura Photobooth is live on otohime.dev and does what the idea asked, at both viewports. Pipeline Pachinko does not. It is not deployed: `/play/pachinko` returns 404 and production CI for both pachinko commits is red. Built locally from the same code, it has two defects a visitor sees. Its stylesheet depends on CSS variables this site never defines, so the machine, the plunger, the buttons and the "paper on-call pager" render as unboxed text over the board. And every Backfill jams 7–10 records on the join funnel forever.

## Identities

| Component | Identity |
| --- | --- |
| Production (Vercel, otohime.dev) | `/api/health` sha `22a88f0c7b4d3160c425c2e7877f7d0c05894077`. It contains t-1683 `5fd54a7`, t-1685 `2f40534`, t-1684 `995279a`. It does **not** contain t-1686 `f50d7aa`/`68dd79d`. `git diff 22a88f0 4614484` touches only pachinko, `/play` page, e2e and `projects/` files: the booth code served is the delivered booth code |
| Pachinko build walked | origin/main `461448421f0dc6971bf6bc2b18ebf16eb6c8687c` (app code identical to `68dd79dba309c7713122e08b02ebb4e6844de749`), local `next build` BUILD_ID `xU0PITRaFh3iWdFKELywB`, Node v22.23.3, playwright-core from the locked `package-lock.json` (sha256 `9d0bded9…`), Google Chrome channel |
| File fingerprints (sha256, match QA and evidence files) | `pachinko.css` `2df59b69…`, `pachinko-machine.tsx` `7e4ef0b4…`, `play/page.tsx` `0c05b131…`, `lib/pachinko/sim.ts` `e20b7fb5…`, `booth-studio.tsx` `04ef99af…`, `booth.css` `46ea2049…`, `lib/booth/strip.ts` `9fcd2668…`, `lib/booth/film-stock.ts` `2ab8d83e…`, `next.config.ts` `321b9924…` |
| Commit identity | `5fd54a7`, `2f40534`, `995279a`, `f50d7aa`, `68dd79d`, `b5bbad5`, `4614484`: author and committer `Otohime <quiinthieu@gmail.com>`, no `Co-Authored-By` trailer. QA cites run-9300's `author.txt` sha256 `7694250f…` (44 B). I did not download that artifact; the git metadata above is my own check. `scripts/setup-owner-git.sh --check`: `Otohime <quiinthieu@gmail.com>` |

## Delivery classification

- **Integration deployed:** booth yes (production `22a88f0`); pachinko and the `/play` teasers **no** (`/play/pachinko` 404, CI runs 40633395018 and 40635091133 failed, production job skipped).
- **Waiting for capacity:** none. Nothing is queued that would change this verdict.
- **Execution demonstrated:** booth in production at both viewports; pachinko only in a local production build.
- **Product delivered:** booth **yes**; Pipeline Pachinko **no**: not reachable by visitors, and broken as built.

## Real / fake boundaries

Real: production Vercel site; local `next build` + `next start`; Chrome 155; real `getUserMedia` (Chrome's synthetic camera device, and no device for the negative control); real WebGL2, Canvas 2D, WebAudio, downloads and print-media emulation; Chrome DevTools sensor override for device orientation. Instrumentation only: an init script counts `getUserMedia` calls and wraps `AudioContext` to count contexts and oscillators, always delegating to the real APIs. No stubs. I did not reuse `e2e/booth.test.ts` or `e2e/pachinko.test.ts`; the walk scripts are my own (kept under `/tmp/acc9303`, not committed).

## History read

- `plan_manager_list_runs(pm-294)`: 15/15 runs read (complete). All succeeded except this run. t-1686 green gate `run-9299` failed on `f50d7aa`, then `run-9301` passed on `68dd79d`. Profiles: SWE `agy-argon-high` (`--model gemini-4-argon-high`), QA `agy-argon-medium` (`gemini-4-argon-medium`), this run `claude-opus-high` (`--model claude-opus-5-5 --effort high`).
- task-manager `a4fb2495…` (run-9301 verify): COMPLETED, exit 0, `callbackState=delivered`.
- task-manager FAILED, page 1 (20 of 1,209): 0 belong to pm-294 or otohime (all `mono-v2` build tasks or pm-platform canaries), back to 03:10 UTC. A second, project-filtered page was too large to read and is **unread**. Partial, so pm-294 failures before 03:10 UTC are inconclusive from task-manager alone. The plan run list (complete) shows none.
- GitHub Actions: the 10 most recent main runs read; then the unauthenticated API quota ran out (reset 05:32 UTC). Failure text comes from public run-page annotations.

## Defects

1. **Pachinko styles do not apply** (`pachinko.css` uses undefined `--fg`/`--bg`/`--accent`). No visible plunger. Buttons look like plain text. The on-call pager is transparent text over the page, not a paper gag. The sticky status bar overprints the site header on scroll. Seen at 1366×768 and 390×844.
2. **Join funnel jams.** 7–10 of ~37 records per Backfill lodge on the funnel arms and stay "in flight" forever (4 seeds). The plan promised that "the funnel never stalls". The machine can't empty, and every later Backfill adds to the jam.
3. **Pachinko is not deployed.** Production CI for `f50d7aa` (E2E step 12-minute timeout; bottle-ui footer geometry) and `68dd79d` (Footer Chromium probe: unexpected YouTube request from `/music`) failed, so production stays on `22a88f0`. Those failing tests are outside pm-294's files, but they block this plan's delivery.
4. Cosmetic, booth: the hanko date text `2026.10.28` is wider than the stamp ring and spills past it at both edges of the exported PNG.

## Not a defect, noted

The "Inject DLQ spill" and "Trigger 3× DLQ streak" buttons sit in a visible "Fault injection & stage probes" panel, so the Easter egg is announced rather than hidden. Natural play also reaches the DLQ (`dlqProbability` 0.1; 4–5 DLQ landings per Backfill).

## Deferred checks

None. The verdict does not depend on anything pending.
