---
plan_id: pm-206
run_id: run-6921
kind: acceptance_report
verdict: fail
cycle: 1
---

# Acceptance: Hop and Settle (pm-206), cycle 1

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| otohime.dev, fresh load of `/projects` (1366×768 and 390×844) | open it | 8 rows rise 40 ms apart (delays 0…280 ms), the last ends at 680 ms | walk: `projects-rise-*-mid.png` shows 3 rows risen and the 4th rising |
| `/projects` | click each of the 8 rows (shore … barometer), both viewports | 16/16 hops crossfade: old root `fade-out` 150 ms, new root `fade-in` 150+210 ms, `::view-transition-group(project-<slug>)` runs (the title morphs) | walk rows; `hop-projects-{shore,planisphere}-*-mid.png` frozen at 260 ms |
| each project | click its "All projects" link, both viewports | 16/16 crossfade back, and the title morphs back into its row | walk rows |
| `/planisphere` | click "Next door: the planets, in Orrery" (the only link between two projects) | crossfade at both viewports; browser Back crossfades too | walk; `hop-planisphere-orrery-*-mid.png` |
| `/work` (site) | click Projects in the nav | `page-out` 150 ms, then `page-in` 210 ms after 150 ms | walk |
| `/sign-in` | click "Forgot password" | the auth page fades out and the next fades in | walk |
| `/sign-in`, `/forgot-password`, `/reset-password`, `/does-not-exist` | open each | 200, 200, 200, 404; no console error (except the 404 document's own load line) | walk |
| `/work` | soft navigation into a missing route | the 404 fades in (`fade-in` 150+210) | investigate2 |
| the 404 | click its link | the 404 fades out. **Home does not fade in** (Home fades in when you come from `/work`) | investigate2 |
| `/barometer?city=tokyo` (reading face) | open it | needle `swing` 0+1100, mercury `rise` 150+1100, vane `vane-swing` 300+1100, water `rise` 450+1100 | walk; `barometer-*-mid.png` |
| `/planisphere` | open it | 150/150 lines draw on, 5 layers fade up | walk; `planisphere-*-mid.png` shows half-drawn lines |
| `/planisphere`, drawn | ArrowRight | wheel 1 → 1.25; 0 lines re-draw; no line remounted | walk |
| `/rotor` reading AAA | press A (desktop) / tap the A key (390×844) | nothing rolls at first paint; AAA → AAB; exactly one window (III, "B") rolls, 170 ms | walk; `rotor-*-roll-mid.png` |
| reduced motion, both viewports | all of the above | every hop and page change completes; every transition and load animation ≤ 1 ms; row delays 0.01 ms; the turn and the key press add nothing | walk (reduced rows) |
| JavaScript off, both viewports | open `/barometer`, `/planisphere`, `/rotor`, `/projects` | finished drawing: 0 running animations, line dashoffset 0, windows AAA, 8 rows at opacity 1 | walk; `nojs-*.png` |
| local stack at 60d0049 (= the 90e4ebe app), owner signed in | Dashboard → Account → Users → a user → Roles → Dashboard | every room fades out and in, both viewports; reduced motion: all ≤ 1 ms | walk-signed-in, 24 rows ok |
| same, RSC delayed 1.5 s (fixture) | click Account | the loading skeleton shows, then fades out as the page fades in | walk-signed-in |
| `/sign-in`, a real account | submit the form | a full load to `/dashboard` that crossfades (pagereveal type `hop`, `fade-out` 150, `fade-in` 150+210). **It also logs an uncaught page error: "Transition was skipped. Navigation transition active"** | investigate, investigate3: 4/4 sign-ins |
| same, with `@view-transition` stripped by `page.route` | submit the form | no page error (0/2) | investigate3 |
| signed in, on `/shore`, `/barometer`, `/planisphere` | hop to `/projects` or `/` | crossfade, no page error | investigate3 |
| a plain user's soft navigation from `/dashboard` to `/admin/roles` | the 403 renders | the 403 fades in | investigate2 |
| the 403 | click Projects or Dashboard in the nav | it fades out and the page fades in | investigate2 |
| the 403 | click its own **"Go home"** button | **cut: no page-out and no page-in**, at both viewports, motion on | walk-signed-in, investigate2 |

## Verdict: fail

The outcome the idea asked for exists. On otohime.dev, every hop between the site and a project
crossfades, and the title travels. The site's pages hand over, the rows rise, and the three still
instruments settle. Reduced motion and JavaScript off show the finished, still drawing. The
mid-transition screenshots look like the plan: the title stays legible through the morph, and the
lines are half drawn before the stars arrive.

Two defects reproduce every time, and each breaks an acceptance line of this plan:

1. **Every sign-in logs an uncaught page error.** On `/dashboard` the error is "Transition was
   skipped. Navigation transition active". Better Auth follows `callbackURL` with a full page load.
   That load now runs the cross-document hop (t-1184), and React's `<ViewTransition>` work on
   `/dashboard` then tries to start a transition while the hop is still active. With the opt-in
   stripped, the error is gone. t-1184's contract says "no console.error and no pageerror on any
   route". `scripts/probe-motion.sh` runs with no database, so it never signs in and cannot see this.
   The visitor still sees the crossfade.
2. **The 403's own "Go home" button cuts.** t-1185 says the forbidden page "fades out and in like
   /work". It fades in, and it fades out by the nav, but its call to action changes the page in one
   frame.

Smaller, not counted on their own:

- Leaving the 404 by its link fades the 404 out, but Home does not fade in.
- 1 of 181 hops (390×844, /projects → /barometer) aborted with "Page already revealed". 120
  repeats all ran. The hop still completes as a cut.

## Deployed build

- Production serves `90e4ebec5573899893bb4322717ab2a0c8ced562`: `<meta name="build-sha">` on `/`,
  `/projects`, `/shore`, `/capsule`, `/orrery`, `/elements`, `/vinyl`, `/rotor`, `/planisphere`,
  `/barometer` and `/sign-in`. That is t-1186's delivery sha, and it contains t-1184 (697a62b) and
  t-1185 (738437f).
- The local stack served `60d00493cdc1548738fb015a696b648671391d63`.
  `git diff 90e4ebe 60d0049` touches only `projects/add-motion-to-the-app/qa-t-1186.md`.

## How I walked it

- My own Playwright 1.64.0 walk, with Chrome Headless Shell 156.0.8078.4. Each viewport ran with
  motion on and with reduced motion, then JavaScript off. 390×844 used isMobile and hasTouch, with
  taps. Listeners on `pageswap` and `pagereveal` sat on every document. Screenshots froze the
  transition at 260 ms. Against otohime.dev: **121 ok, 0 failed** (after fixing my own selector
  for the footer "Next door" link).
- Signed-in walk on the local stack: 28 ok, 5 failed. Re-measuring with listeners on both documents
  showed the two "sign-in does not fade" rows were my sampler's mistake: the sign-in hop crossfades.
  The other three failures are the two defects above.
- Cross-check: `BASE_URL=https://otohime.dev bash scripts/probe-motion.sh` gives **312 ok, 0 failed**.

## Logs

- Local `next start` log over the whole signed-in walk: 5 lines, startup only, no error or warning.
  The local build log has 0 "error" lines.
- The production logs (Vercel) cannot be read from this worker: there is no token. The browser
  console on otohime.dev had 0 errors over the whole walk, apart from the 404 document's own load
  line (4×, expected).

## Commit identity

All 10 plan commits, `01a668e`…`60d0049`, are authored and committed by
`Otohime <quiinthieu@gmail.com>`, with 0 Co-Authored-By trailers. The delivery evidence has no
author.txt.

## Advisory

There are no open questions on the plan. The title morph across the font change looks right to me
in the frozen frames at both viewports.
