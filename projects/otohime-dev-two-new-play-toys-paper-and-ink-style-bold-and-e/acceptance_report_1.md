---
plan_id: pm-294
run_id: run-9357
kind: acceptance_report
verdict: pass
cycle: 1
cited_sha: c532e4edbc259902b41c457bda0a77557d03b291
---

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| otohime.dev, 2026-10-28 ~08:00 UTC | `GET /api/health`, `/play`, `/play/booth`, `/play/pachinko` | `{"ok":true,"sha":"c532e4edbc25…"}`; all three routes 200 (Vercel, `x-vercel-id hkg1::…`); `/play/booth` sends `permissions-policy: camera=(self), microphone=()`. In cycle 0, `/play/pachinko` returned 404 | curl |
| GitHub Actions, main | public workflow index and run page | Run #544 `40649996558` on `c532e4e`: `checks` succeeded, `production` succeeded, `preview` and `cleanup` skipped (normal for a push). #545–#549 (other plans' later commits) are still running or queued; none touch pm-294 files | public run-page HTML (the API quota was exhausted) |
| production `/play`, 1366×768 and 390×844 | read the teasers and click "Play Pipeline Pachinko →" | `play-booth-link` → `/play/booth` "Open Ink Purikura Photobooth →", `play-pachinko-link` → `/play/pachinko`; the click lands on `/play/pachinko` | pachinko-results.json |
| production `/play/booth`, Chrome with a synthetic camera device (`--use-fake-device-for-media-stream`, real `getUserMedia`) | load the page | "Your camera stays in this tab. Nothing is uploaded."; **0** `getUserMedia` calls before opt-in | booth-results.json |
| same | click **Open camera** | `streaming`, "LIVE CAMERA (LOCAL)", constraints `{video:{facingMode:"user",width:{ideal:960}},audio:false}` | booth-results.json |
| same | pick Sumi-e, Riso, Newsprint | badges "Sumi-e Wash", "Riso Two-Tone", "Newsprint 45°"; viewfinder mean/saturation 62.8/9.7, 81.4/50.6, 66.3/8.2 (three distinct looks); renderer `webgl2` | 1366x768-booth-vf-*.png |
| same, Sound On | **Take 4 photos** | countdown log `3,2,1,shutter` ×4; 4 shutters, 4 ink flashes; 1 AudioContext, 26 oscillators (clack); done in 2.0–2.4 s; camera stream stopped after frame 4 | booth-results.json |
| same | read the strip | 600×1800, 4.72 % transparent torn edge, hanko "2026.10.28" (today), footer `otohime.dev`; picture shows four tilted riso frames on torn paper, a red round stamp with `2026 / 10.28` stacked inside the ring, and `otohime.dev` | 1366x768-booth-strip-doodled.png |
| same | **Download** (before doodling), decode the PNG | `otohime-booth-20261028.png`, 819,888 B, signature `89504e47…`, 600×1800. Hanko pixels: 1,064 red inside r ≤ 0.72R (max d 40.31 px ≤ 40.32), **0** in the ring gap, **0** outside the stamp. In cycle 0 the date spilled past the ring | out/1366x768-otohime-booth-20261028.png |
| negative control for that detector | run the same pixel test on the strip composer from `68dd79d` (cycle 0) and from `c532e4e` | old: **636** red pixels in the ring gap and 18 outside the stamp; new: 0 and 0. The detector does catch the old spill | hanko-nc.mts |
| same | vermilion pen stroke + heart sticker, Undo, star sticker, Download again | strokes 1, stickers 1; Undo removes the sticker; second PNG differs from the first | booth-results.json |
| same | emulate `print` media | strip prints 5.00 × 15.00 cm; masthead, status bar and viewfinder hidden | booth-results.json |
| same | audit every request | 60 requests, all GET to otohime.dev; 0 non-GET, 0 request bodies, 0 third-party hosts (nothing uploaded); 0 page or console errors | booth-results.json |
| production, Chrome with **no** camera device (negative control) | Open camera → Take 4 photos → Download | real `NotFoundError` → `sample`, "SAMPLE PAPER PORTRAIT"; full 4-frame strip, PNG and print still work; 0 errors | booth-results.json |
| production, `prefers-reduced-motion: reduce` | sample portrait, Take 4 photos | ink flash `animation-name: none`, opacity 0 throughout; countdown kept; "SHUTTER · 4 CLACKS" | booth-results.json |
| production, **390×844** (touch, DPR 2) | the same booth steps | all pass. My first pen attempt aimed at an off-screen point (my script's error). A real finger drag (CDP touch) gives pointerdown + 20 pointermove + pointerup, 0 pointercancel, no page scroll, stroke 0 → 1 | pen-scroll.mjs, 390x844-pen-swipe.png |
| production `/play/pachinko`, 1366×768 and 390×844, light; 390×844 dark | `getComputedStyle(documentElement)` for every `var()` in `pachinko.css` | 12/12 tokens resolve (in cycle 0, `--fg`, `--bg` and `--accent` were empty) | pachinko-results.json |
| same | computed style of frame, status bar, panels, plunger track and knob, buttons; screenshot | all have 2 px solid ink borders and opaque paper fills (light `rgb(242,233,222)`/`rgb(238,227,213)`, dark `rgb(30,23,18)`/`rgb(42,32,25)`). The picture shows a framed washi board, a visible plunger with a red knob, and boxed buttons | *-pachinko-initial.png |
| same | drag the plunger down and release (mouse at 1366, finger at 390); Space; **Launch record** | pull 1.00; launched 0 → 1 → 3 | pachinko-results.json |
| same, sound at its default Off (negative control) | the launches above | 0 AudioContexts, 0 oscillators | pachinko-results.json |
| same, Peg clicks ON | **Backfill (60 records)**, read IN-FLIGHT every 250 ms | drains to **IN-FLIGHT: 0** in 3.4–3.8 s (trace 60 → 55 → 28 → 2 → 0); 35 settled + 28 joined; DLQ 5; 51–63 oscillators on 1 AudioContext | *-pachinko-after-backfill.png |
| same | a second Backfill straight after | drains to 0 again in 3.7–4.1 s; settled 68, joined 55, DLQ 10. In cycle 0, 7–10 records stayed lodged forever | pachinko-results.json |
| other seeds | `?seed=99` (1366), `?seed=42` (390 dark), `?seed=777` (both) | every Backfill drains to 0 in < 4.1 s | pachinko-results.json, tilt.mjs |
| same | read the bar chart and readouts | p0..p5 bars 13–65 px tracking counts; records/sec 5.6–6.4, late-arrival 80–88 %, DLQ count | pachinko-results.json |
| same | ArrowLeft + "Nudge right →" | "Nudges: 2 (right)" | pachinko-results.json |
| same, seed 777 | Enable tilt, then Chrome DevTools `DeviceOrientation` override γ = +35 / −35, Backfill | "Tilt active (35°)" / "(-35°)"; buckets `[7,3,3,7,3,5]` / `[7,3,7,5,1,5]` against `[2,4,4,6,7,5]` with tilt off (control): tilt steers the records | tilt.mjs |
| same | scroll to y = 420 | status bar top 72 px, below the masthead's bottom (64 px); opaque; z-index 15; header logo and Sign in stay readable | *-pachinko-scrolled.png |
| negative control | 2 × "Inject DLQ spill", then 1 normal record | streak 2 → 0, no pager | pachinko-results.json |
| same | 3 × "Inject DLQ spill" in a row | `role="dialog"` "SEV-2 · PAGER ALERT · 呼出 … On-Call Pager: 3 Consecutive Dead-Letter Queue Spills"; paper fill and 2 px ink border, vermilion offset shadow; inside both viewports; focus on dismiss. The picture shows a paper card, not overlapping text | *-pachinko-pager.png |
| same | Enter | pager closes, streak 0 | pachinko-results.json |
| production, `prefers-reduced-motion` | Backfill | button "Backfill (12 records)"; drains to 0 in 2.4 s | pachinko-results.json |
| all pachinko walks | page errors, console errors, HTTP ≥ 400, third-party requests | 0, 0, 0, 0 | pachinko-results.json |

# Acceptance: Ink Booth & Pipeline Pachinko (pm-294), cycle 1

**Verdict: pass.** Both toys are live on otohime.dev at `c532e4e`, and a visitor can do everything the idea asks at 1366×768 and 390×844. All five things cycle 0 said a visitor could not do now work in production:

- Pachinko is deployed.
- Its plunger, buttons and frame are visible paper-and-ink.
- The on-call pager is a paper card.
- The status bar stays under the site header.
- Every Backfill drains to zero. I checked 4 seeds, back-to-back floods and reduced motion.

The optional hanko polish is also fixed, and a negative control confirms it.

## Identities

| Component | Identity |
| --- | --- |
| Production (Vercel, otohime.dev) | `/api/health` sha `c532e4edbc259902b41c457bda0a77557d03b291` = t-1688 delivery; contains t-1683 `5fd54a7`, t-1684 `995279a`, t-1685 `2f40534`, t-1686 `f50d7aa`/`68dd79d`, t-1687 `770acf8`, t-1688 `c532e4e` |
| CI / deploy | GitHub Actions CI run #544 `40649996558` on `c532e4e`: `checks` ✓, `production` ✓ |
| Re-deploy during this run | After my walk, `/api/health` moved to `f4b3de8ee23f…` (pm-273, descends from `c532e4e`). `git diff c532e4e f4b3de8` touches only `lib/end.test.ts` and `lib/fortune*`, no pm-294 file. A re-smoke on `f4b3de8` gave identical results: three routes 200; Backfill drains to IN-FLIGHT 0 in 3.1–3.9 s ×6 at both viewports; tilt ±35° gives the same bucket outcomes as on `c532e4e` |
| main at walk time | `b5fa423` (+ later pm-273 commits); `git diff c532e4e origin/main` touches only `lib/fortune*` and docs, so none of the files below |
| File fingerprints (sha256/16; identical at `c532e4e` and HEAD; match the t-1687/t-1688 evidence and QA) | `pachinko.css` `0def8d569e9981ae`, `pachinko-machine.tsx` `0773b915e740d4de`, `pachinko/page.tsx` `3382097720e4e1a5`, `play/page.tsx` `0c05b131e770beb0`, `booth-studio.tsx` `04ef99affa3ae4b3`, `booth.css` `46ea204976b04b1b`, `lib/pachinko/sim.ts` `a757f580ba3055b8`, `lib/booth/strip.ts` `c12e0796f1bbe8ed`, `lib/booth/film-stock.ts` `2ab8d83e2d23733c`, `next.config.ts` `321b992409329951`, `package-lock.json` `9d0bded9b7c00b1d` |
| Walk toolchain | Node v22.23.3, `playwright-core` 1.64.0 from the locked `package-lock.json` (`npm ci`), Google Chrome channel, headless |
| Commit identity | Every `pm-294/*` commit on main (a552b83 … b5fa423, 14 commits): author and committer `Otohime <quiinthieu@gmail.com>`, 0 `Co-Authored-By` trailers. `scripts/setup-owner-git.sh --check` → `Otohime <quiinthieu@gmail.com>`. Task-manager `c66c9264…` (run-9331) lists `author.txt` sha256 `7694250f32f87a6f…` (44 B), the same hash QA cites. I did not download the artifact and could not reproduce its exact byte format, so the git metadata above is my own identity check |

## Delivery classification

- **Integration deployed:** yes, production `c532e4e` via CI #544 `production` job.
- **Waiting for capacity:** none.
- **Execution demonstrated:** yes, in production, by my own browser walk at both viewports.
- **Product delivered:** yes, both toys.

## Real / fake boundaries

Real:

- the production Vercel site
- real Chrome
- real `getUserMedia` (Chrome's synthetic camera device for the positive path; no device at all for the negative control)
- real WebGL2, Canvas 2D and WebAudio
- real downloads, decoded byte-for-byte
- print-media emulation
- DevTools touch input and the device-orientation sensor override (headless has no hardware sensor)

Instrumentation only: init scripts that count `getUserMedia` calls and wrap `AudioContext` to count contexts and oscillators. Both delegate to the real APIs. No stubs.

I did not reuse `e2e/booth.test.ts`, `e2e/pachinko.test.ts` or QA's probe. The walk scripts are my own (`/tmp/acc9357/{booth,pachinko,tilt,pen-mobile,pen-scroll}.mjs`, `hanko-nc.mts`), and they and their screenshots are not committed. The hanko negative control runs the real `composeStripBuffer` from `git archive 68dd79d` and from `git archive c532e4e`.

## Script corrections (not product defects)

Two first-pass failures were faults in my walk scripts, and I re-ran both correctly:

- The 390×844 pen stroke aimed at a point scrolled off-screen. On-screen touch and mouse strokes both draw.
- The tilt step set the orientation override before tilt was enabled, so no event arrived after the listener attached. Overriding after enabling shows the angle and changes the outcome.

## History read

- `plan_manager_list_runs(pm-294)`: **22/22** runs read (complete). All succeeded; this run is the only one running.
  - Profiles: SWE `agy-argon-high` (gemini-4-argon, high), QA and PO `agy-argon-medium`, research `claude-sonnet-medium`, acceptance (this run) `claude-opus-high` (claude-opus-5-5, high).
  - t-1688: SWE run-9331 (tm `c66c9264…`, COMPLETED, exit 0, `callbackState=delivered`); green gate run-9341 (tm `b74faf2b…`, COMPLETED, exit 0, delivered, both verify items); QA run-9343.
- task-manager:
  - PENDING: 0 (complete).
  - FAILED: page 1, 20 of 1,253. 0 belong to pm-294; they are `build_failed` jobs and other plans' `push_not_on_main` failures.
  - COMPLETED: page 1, 20 of 5,019. 0 belong to pm-294.
  - Both FAILED and COMPLETED are partial pages. The plan's run list is complete and shows no failed pm-294 run, so I rely on that.
- GitHub Actions: workflow index #526–#549 read from public HTML.
  - Earlier pm-294 failures were #532 (t-1683), #536/#537 (t-1686) and #542 (t-1687). The current delivery, #544, is green and deployed, which supersedes them.
  - The unauthenticated API quota was exhausted, so I read no job logs.
- Service logs: I have no Vercel runtime-log access from this lease (no CLI or token), so server-side logs are **unread**. Browser side, all walks saw 0 page errors, 0 console errors and 0 HTTP ≥ 400 responses.

## Defects

None observed.

## Not a defect, noted

- The DLQ Easter egg is announced in a visible "Fault Injection & Stage Probes" panel ("Inject DLQ spill", "Trigger 3× DLQ streak"). Natural play also reaches the DLQ (5 per 60-record Backfill), so a visitor can hit it either way.
- Partition buckets are hash-routed. Tilt changes which bucket a record lands in, but every record still settles.

## Deferred checks

None. The verdict does not depend on anything scheduled or pending. The CI runs #545–#549 still in progress belong to other plans' commits and do not change any pm-294 file.
