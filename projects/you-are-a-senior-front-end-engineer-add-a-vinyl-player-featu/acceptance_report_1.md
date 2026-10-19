---
plan_id: pm-191
run_id: run-6475
kind: acceptance_report
verdict: pass
cycle: 1
cited_sha: f5040bf3fc7cde31acf59874db02ea628e03878b
---

# Acceptance: Vinyl Crate Turntable (pm-191)

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| 1366×768 mouse · /projects | look for Vinyl | 1 link(s) to /vinyl: ["Vinyl"] | walk.mjs desktop: pass |
| 1366×768 mouse · /projects | click Vinyl | "Vinyl", build-sha f5040bf, 12 sleeves, 0 iframes, 0 iframe_api requests, player box reserved 506×284, screen says "Pick a record to load the player" | walk.mjs desktop: pass |
| 1366×768 mouse · /vinyl fresh | read the layout | crate 16,85, turntable 326,85, monitor 816,85 (x,y); horizontal overflow false | walk.mjs desktop: pass |
| 1366×768 mouse · crate, 12 sleeves | search "zzzz", then "willow"; genre Jazz | "No records match": true; "willow" → willow-road; Jazz → harbour-lights,blue-hour-sessions | walk.mjs desktop: pass |
| 1366×768 mouse · crate | hover a sleeve | transform matrix(1, 0, 0, 1, 0, -6) | walk.mjs desktop: pass |
| 1366×768 mouse · /vinyl | count Watch on YouTube links | 24 links to youtube.com/watch | walk.mjs desktop: pass |
| 1366×768 mouse · no record | press "Place on turntable" on Harbour Lights | phase loaded; 1 iframe_api request; Turntable: Harbour Lights by The Tidewater Quartet on the platter at 33 rpm; the tonearm is at rest.; LED true; host box 506×284 at the same place as before: true | walk.mjs desktop: pass |
| 1366×768 mouse · record loaded | measure the iframe; elementFromPoint at 4 corners (inset 2 px) and centre | 1 iframe, 506×284, first at 5/5 points, visible, opacity 1 | walk.mjs desktop: pass |
| 1366×768 mouse · record loaded | read the iframe src | /embed/?playsinline,rel,origin,enablejsapi,widgetid,forigin,aoriginsup,gporigin,vf; origin=https://otohime.dev | walk.mjs desktop: pass |
| 1366×768 mouse · record loaded | wait 1.5 s without pressing Play | YouTube video paused=true at 0s (no autoplay) | walk.mjs desktop: pass |
| 1366×768 mouse · record loaded | press Play | phases loaded/rest → starting/hover → buffering/hover → playing/down; platter 0.48 → 65.88 in 600 ms; YouTube video playing=true t=2.1s; LCD "HARBOUR LIGHTS The Tidewater Quartet Playing 0:02 / 3:01" | walk.mjs desktop: pass |
| 1366×768 mouse · playing | measure the iframe; elementFromPoint at 4 corners (inset 2 px) and centre | 1 iframe, 506×284, first at 5/5 points, visible, opacity 1 | walk.mjs desktop: pass |
| 1366×768 mouse · playing | press Space | phase paused, arm lifted; platter 14.1 → 72.0 → 92.5 → 94.8 → 94.8 → 94.8 → 94.8; still from about 2091 ms; YouTube paused=true | walk.mjs desktop: pass |
| 1366×768 mouse · paused | set the seek bar to half, the volume to 30 | YouTube t=91s, seek shows "1:31 / 3:02"; YouTube volume 30 | walk.mjs desktop: pass |
| 1366×768 mouse · paused, Harbour Lights | Next, then Previous | Turntable: Velvet Morning by Rosa Delaney; then Turntable: Harbour Lights by The Tidewater Quartet; phase loaded | walk.mjs desktop: pass |
| 1366×768 mouse · record loaded | ArrowRight, ArrowLeft, Escape on the turntable | → "Velvet Morning by Rosa Delane…"; Escape → "Turntable: the platter is empty.", phase empty, 1 iframe | walk.mjs desktop: pass |
| 1366×768 mouse · empty platter | drag the Paper Satellites sleeve onto the platter with the mouse | data-drop="over" over the platter; flight visible true; Turntable: Paper Satellites by Northbound Static on the plat…; phase loaded | walk.mjs desktop: pass |
| 1366×768 mouse · loaded, arm at rest | drag the tonearm from 0° onto the record (31°) | phase playing, arm down; YouTube playing=true t=1.5s | walk.mjs desktop: pass |
| 1366×768 mouse · arm on the record | measure the iframe; elementFromPoint at 4 corners (inset 2 px) and centre | 1 iframe, 506×284, first at 5/5 points, visible, opacity 1 | walk.mjs desktop: pass |
| 1366×768 mouse · playing | drag the arm from 27.2° to 40° | YouTube t 1.5s → 106.6s; LCD "PAPER SATELLITES Northbound Static Playing 1:46 / 2:26 Side A Paper Satellites Low Orbit Side B Re-entry" | walk.mjs desktop: pass |
| 1366×768 mouse · playing | drag the arm back to rest (2°) | phase paused, arm lifted; YouTube paused=true | walk.mjs desktop: pass |
| 1366×768 mouse · paused, arm focused | Enter, PageUp, Enter | "1:49 of 2:26, lifted" → Enter: playing → PageUp: "slider 2:20 of 2:26, playing" → Enter: paused | walk.mjs desktop: pass |
| 1366×768 mouse · playing | the tab becomes hidden (visibilitychange) | phase paused; YouTube paused=true | walk.mjs desktop: pass |
| 1366×768 mouse · end of walk | read the console | 0 console errors in total, 0 from the site | walk.mjs desktop: pass |
| 1366×768 mouse · record loaded | pagehide (leaving the page) | 0 iframes remain | walk.mjs desktop: pass |
| 390×844 touch · /projects | look for Vinyl | 1 link(s) to /vinyl: ["Vinyl"] | walk.mjs phone: pass |
| 390×844 touch · /projects | click Vinyl | "Vinyl", build-sha f5040bf, 12 sleeves, 0 iframes, 0 iframe_api requests, player box reserved 330×219, screen says "Pick a record to load the player" | walk.mjs phone: pass |
| 390×844 touch · /vinyl fresh | read the layout | crate 16,85, turntable 16,571, monitor 16,953 (x,y); horizontal overflow false | walk.mjs phone: pass |
| 390×844 touch · crate, 12 sleeves | search "zzzz", then "willow"; genre Jazz | "No records match": true; "willow" → willow-road; Jazz → harbour-lights,blue-hour-sessions | walk.mjs phone: pass |
| 390×844 touch · /vinyl | count Watch on YouTube links | 24 links to youtube.com/watch | walk.mjs phone: pass |
| 390×844 touch · no record | press "Place on turntable" on Harbour Lights | phase loaded; 1 iframe_api request; Turntable: Harbour Lights by The Tidewater Quartet on the platter at 33 rpm; the tonearm is at rest.; LED true; host box 330×219 at the same place as before: true | walk.mjs phone: pass |
| 390×844 touch · record loaded | measure the iframe; elementFromPoint at 4 corners (inset 2 px) and centre | 1 iframe, 330×219, first at 5/5 points, visible, opacity 1 | walk.mjs phone: pass |
| 390×844 touch · record loaded | read the iframe src | /embed/?playsinline,rel,origin,enablejsapi,widgetid,forigin,aoriginsup,gporigin,vf; origin=https://otohime.dev | walk.mjs phone: pass |
| 390×844 touch · record loaded | wait 1.5 s without pressing Play | YouTube video paused=true at 0s (no autoplay) | walk.mjs phone: pass |
| 390×844 touch · record loaded | press Play | phases starting/hover → buffering/hover → playing/down → playing/down; platter 0.14 → 74.35 in 600 ms; YouTube video playing=true t=2.1s; LCD "HARBOUR LIGHTS The Tidewater Quartet Playing 0:01 / 3:01" | walk.mjs phone: pass |
| 390×844 touch · playing | measure the iframe; elementFromPoint at 4 corners (inset 2 px) and centre | 1 iframe, 330×219, first at 5/5 points, visible, opacity 1 | walk.mjs phone: pass |
| 390×844 touch · playing | tap Pause | phase paused, arm lifted; platter 103.9 → 162.8 → 182.6 → 184.6 → 184.6 → 184.6 → 184.6; still from about 2083 ms; YouTube paused=true | walk.mjs phone: pass |
| 390×844 touch · paused | set the seek bar to half, the volume to 30 | YouTube t=91s, seek shows "1:31 / 3:02"; YouTube volume 30 | walk.mjs phone: pass |
| 390×844 touch · paused, Harbour Lights | Next, then Previous | Turntable: Velvet Morning by Rosa Delaney; then Turntable: Harbour Lights by The Tidewater Quartet; phase loaded | walk.mjs phone: pass |
| 390×844 touch · loaded, arm at rest | finger drags the tonearm from 0° onto the record | phase playing, arm down; YouTube playing=true; pointercancel 0; scrollY 332 → 332 | walk.mjs phone: pass |
| 390×844 touch · phone, playing after the arm drop | measure the iframe; elementFromPoint at 4 corners (inset 2 px) and centre | 1 iframe, 330×219, first at 5/5 points, visible, opacity 1 | walk.mjs phone: pass |
| 390×844 touch · playing | finger scrubs the arm from 27.2° to 40° | YouTube t 1.6s → 132.3s; pointercancel 0 | walk.mjs phone: pass |
| 390×844 touch · playing | finger lifts the arm back to rest | phase paused, YouTube paused=true | walk.mjs phone: pass |
| 390×844 touch · Harbour Lights paused | long-press the Willow Road sleeve and drag it to the platter with a finger | platter on screen: true; Turntable: Willow Road by Ada Fenwick on the platt…; phase loaded | walk.mjs phone: pass |
| 390×844 touch · crate | swipe up on a sleeve | scrollY 0 → 165 | walk.mjs phone: pass |
| 390×844 touch · playing | the tab becomes hidden (visibilitychange) | phase paused; YouTube paused=true | walk.mjs phone: pass |
| 390×844 touch · end of walk | read the console | 0 console errors in total, 0 from the site | walk.mjs phone: pass |
| 390×844 touch · record loaded | pagehide (leaving the page) | 0 iframes remain | walk.mjs phone: pass |
| 1366×768 reduced motion · no record | press "Place on turntable" on Harbour Lights | phase loaded; 1 iframe_api request; Turntable: Harbour Lights by The Tidewater Quartet on the platter at 33 rpm; the tonearm is at rest.; LED true; host box 506×284 at the same place as before: true | walk.mjs reduced: pass |
| 1366×768 reduced motion · record loaded | measure the iframe; elementFromPoint at 4 corners (inset 2 px) and centre | 1 iframe, 506×284, first at 5/5 points, visible, opacity 1 | walk.mjs reduced: pass |
| 1366×768 reduced motion · record loaded | press Play | phases starting/hover → buffering/hover → playing/down → playing/down; platter none → none in 600 ms; YouTube video playing=true t=2.1s; LCD "HARBOUR LIGHTS The Tidewater Quartet Playing 0:02 / 3:01" | walk.mjs reduced: pass |
| 1366×768 reduced motion · reduced motion, playing | watch the platter 1 s | platter transform none (still); PLAYING lamp data-on=true | walk.mjs reduced: pass |
| 1366×768 reduced motion · playing | measure the iframe; elementFromPoint at 4 corners (inset 2 px) and centre | 1 iframe, 506×284, first at 5/5 points, visible, opacity 1 | walk.mjs reduced: pass |
| 1366×768 reduced motion · playing | the tab becomes hidden (visibilitychange) | phase paused; YouTube paused=true | walk.mjs reduced: pass |
| 1366×768 reduced motion · end of walk | read the console | 0 console errors in total, 0 from the site | walk.mjs reduced: pass |
| 1366×768 reduced motion · record loaded | pagehide (leaving the page) | 0 iframes remain | walk.mjs reduced: pass |
| 1366×768 bad id · error shown | measure the iframe; elementFromPoint at 4 corners (inset 2 px) and centre | 1 iframe, 506×284, first at 5/5 points, visible, opacity 1 | walk.mjs error: pass |
| 1366×768 bad id · record loaded | measure the iframe; elementFromPoint at 4 corners (inset 2 px) and centre | 1 iframe, 506×284, first at 5/5 points, visible, opacity 1 | walk.mjs error: pass |
| 1366×768 bad id · no record; Harbour Lights' id swapped for the missing aaaaaaaaaaa | Place on turntable | phase error after 834 ms; beside the player the chin says "The owner doesn't allow playing it here Skip Watch on YouTube"; LCD "HARBOUR LIGHTS The Tidewater Quartet The owner doesn't allow playing it here 0:00 / 0:00"; Skip button true; link https://www.youtube.com/watch?v=aaaaaaaaaaa | walk.mjs error: pass |
| 1366×768 bad id · Velvet Morning cued | Previous (back to the bad record), then press Skip | phase error; Skip → loaded in 47 ms, Turntable: Velvet Morning by Rosa Delaney on … | walk.mjs error: pass |
| 1366×768 bad id · error | wait about 4 s | phase loaded; Turntable: Velvet Morning by Rosa Delaney on the p…; YouTube paused=true (cued, not played) | walk.mjs error: pass |
| 1366×768 bad id · end of walk | read the console | 0 console errors in total, 0 from the site | walk.mjs error: pass |
| 1366×768 bad id · record loaded | pagehide (leaving the page) | 0 iframes remain | walk.mjs error: pass |
| 1366×768 · 1 record placed | Switch records 24 times (ArrowRight ×12, twice) | 1 iframe, 1 `iframe_api` request; JS heap after a forced GC 4687 → 4875 → 4905 KB (+4.0 % on the first pass, +0.6 % on the second) | leak.mjs |
| Production `/vinyl` | Lighthouse desktop, 2 runs | Performance 100, Accessibility 100, Best practices 100, SEO 100; FCP 0.3 s, LCP 0.4–0.5 s, TBT 0 ms, CLS 0 | lh.mjs (lighthouse 12 on a playwright Chrome) |
| Production, f5040bf | `BASE_URL=https://otohime.dev bash scripts/walk-vinyl.sh` | exit 0, 45 ok, 0 failed (the manifest check runs only locally) | repo walk |
| Lease checkout at f5040bf | `npm ci && npm test` | 316 tests, 316 pass | repo tests |
| Lease, network on | `npm run vinyl:check` | 12 records, 0 errors, 9 duplicate-id warnings (expected for the placeholders); 3 distinct videos, all oEmbed 200 `embeddable`; exit 0 | validator |

**Verdict: pass.** At the deployed build, a user can do what the idea asked for. They can find Vinyl on the Projects bench and dig a crate of 12 records with search and a genre filter. They can place a record by button or by drag (mouse, or a long press with a finger) and play it on a turntable whose arm, platter and lamps follow YouTube's real state. They can pause, seek, set the volume, change record, stop and eject, from the buttons, the keyboard and the tonearm itself. The YouTube player stays visible, at least 200×200 (506×284 on desktop), and nothing is ever drawn over it. Playback starts only from a gesture and stops when the tab hides or the page goes away. A dead video gets a friendly message, a Skip button and Watch on YouTube.

## Deployed build

- Production `https://otohime.dev/vinyl` serves `<meta name="build-sha" content="f5040bf3fc7cde31acf59874db02ea628e03878b">`. It switched from `ca4f455` (the t-1088 delivery) to `f5040bf` during this run. `git diff --stat ca4f455 f5040bf` shows one markdown file (`qa-t-1088-ca4f455.md`), so the application code is the same. The first desktop run was on ca4f455. Every walk in the table (desktop re-run 3 times, phone, reduced motion, bad id), the leak run and Lighthouse ran on f5040bf.
- The tasks' delivery shas are all ancestors of the deployed sha: t-1086 `0692aac`, t-1087 `e216769`, t-1088 `ca4f455`.
- **Identity.** No author.txt was in the delivery evidence. All 8 `pm-191/` commits on main are authored and committed by `Otohime <quiinthieu@gmail.com>`, and none has a Co-Authored-By trailer (`git log --grep='^pm-191/'`).
- **Logs.** The only touched service is the Next.js site on Vercel. This lease has no Vercel token, no `vercel` CLI and no `gh` (the private repo's Actions API answers 404), so server logs could not be read. `/vinyl` is a static page (`x-vercel-cache: HIT`) with no API route of its own. I captured the browser console in every walk: 0 errors from the site. `/api/health` answers 200 `{"ok":true}`.

## How I walked it

- I drove system Chrome (headless) with playwright-core from the scratch directory `/tmp/acc6475`; nothing was added to the repo. The default autoplay policy was in force, so every play came from a real click, tap, drag or key press.
- 1366×768 used the mouse and keyboard. 390×844 was a mobile context with touch, driven by real Chrome touch input (CDP `Input.dispatchTouchEvent`).
- I read YouTube's own state inside the embed frame: `<video>.paused`/`currentTime` and `movie_player.getVolume()`. I read the deck's state from `.deck[data-phase]` and `.turntable[data-arm]`.
- The bad-id walk served the real production HTML with `IXA6bQsVNjs` replaced by `aaaaaaaaaaa` through a Playwright route. The tab hide set `document.hidden`/`visibilityState` and dispatched `visibilitychange`. Leaving the page dispatched `pagehide`.

## Against the brief

| Brief | Seen |
| --- | --- |
| Crate: browse, hover/focus lift, keyboard, search, genre filter | 12 sleeves; "willow" → 1; Jazz → 2; "zzzz" → "No records match"; hover lifts by 6 px |
| Place by click/tap and by drag-and-drop, label art on the platter | Button at both sizes; mouse drag with the drop ring `over` and a flight; finger long-press drag at 390. The turntable's label names the record |
| Turntable: platter, strobe, LED, 33/45, tonearm | LED lights on placement; arm moves `rest` → `hover` (starting/buffering) → `down` (playing) → `lifted` (paused) |
| Rotation follows the player's state with inertia | The platter starts turning only when YouTube reports playing. After pause it eases 14° → 72° → 93° → 95° (desktop) and is still about 2.1 s later |
| Controls: play/pause, stop, prev/next, volume, seek, eject; tonearm scrub | Seek to half → YouTube 91 s; volume 30 → `getVolume()` 30; Next/Previous; Escape ejects. The arm dragged to 40° → 106–132 s; the arm back to rest pauses; the arm slider: Enter, PageUp, Enter |
| Keyboard: Space, arrows, Esc | Space pauses; ArrowRight/ArrowLeft change record; Escape empties the platter |
| LCD with aria-live | The LCD shows title, artist, status and time; `aria-live="polite"` (repo walk) |
| Reduced motion | Platter transform stays `none` while playing; PLAYING lamp on |
| Lazy player, no layout shift | 0 `iframe_api` requests and no iframe before a choice; the host box is the same (506×284 / 330×219) before and after; Lighthouse CLS 0 |
| YouTube 1–2: visible ≥ 200×200, nothing in front | 1 iframe, 506×284 desktop, 330×219 phone; `elementFromPoint` returns the iframe at 5/5 points when loaded, playing, during an arm drop and with the error showing |
| YouTube 3–4: no audio isolation, documented params only | The video is always shown. The iframe src has only `playsinline`, `rel` and `origin` from us; there is no `autoplay`. Art is procedural |
| YouTube 5: play only from a gesture; one player | Paused at 0 s after loading; auto-skip and auto-advance cue but don't play; 1 iframe and 1 API request after 24 switches |
| YouTube 6: no background play | Hidden tab → paused (deck and YouTube); `pagehide` → 0 iframes |
| YouTube 7: Referer and `origin` | `origin=https://otohime.dev`; no Referrer-Policy header (curl, repo walk) |
| YouTube 8: Watch link; graceful errors | 24 watch links (a sleeve link and the no-JS list). A bad id → "The owner doesn't allow playing it here" beside the player with Skip and Watch on YouTube (`watch?v=aaaaaaaaaaa`); Skip cues the next record at once; without it, the next record is cued after about 4 s and not played |
| Data and validator | `records.json` validates (12 records); `npm run vinyl:check` reports every id's oEmbed verdict |
| README: records, validation, compliance checklist, licensing | "Vinyl records" section: placeholder table (12 rows), `vinyl:check` and its exit codes, the 8-rule compliance checklist, licensing notes, the crackle flag |
| Lighthouse ≥ 90 desktop | 100 (2 runs) |

## Notes (not failures)

- **Harness fixes.** Four first-run red rows were faults in my harness and I fixed the probes; the product behaved correctly each time:
  - `<video>.volume` follows YouTube's perceptual curve (setVolume 30 → 0.185), so I switched to `movie_player.getVolume()`.
  - A 400 ms sampling interval was too coarse to see the platter stop.
  - Stop is correctly disabled in `loaded`.
  - The bad id errors within about 0.3 s and auto-skips after 4 s, so the probe now reads the monitor as soon as the phase is `error`.
- **Console.** One of four desktop runs logged six "Permissions policy violation: compute-pressure is not allowed in this document". The site sets no Permissions-Policy and no Vinyl code mentions compute-pressure, so the message comes from YouTube's embed script. It did not come back in three more runs, and the site's own console stayed clean.
- **"Tap the video to play".** Desktop Chrome never refuses a real gesture, so I could not produce this state here. qa-t-1087 proved it with a shim. It matters on iOS Safari.
- **The crackle flag** (`NEXT_PUBLIC_VINYL_CRACKLE=1`) is off in production by design. I did not build a flagged copy; qa-t-1088 verified it at 0d3ac28, and that code is unchanged in f5040bf.
- **Placeholder ids.** The 12 records reuse three placeholder ids. The README lists them for the owner to replace.
- **Advisory questions.** The plan has no open escalations.
