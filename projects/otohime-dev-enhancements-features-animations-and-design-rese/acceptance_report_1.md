---
plan_id: pm-242
run_id: run-8530
kind: acceptance_report
verdict: pending
cycle: 1
---

# Acceptance: Pocket Console Encore (pm-242), cycle 1

Walked on the live product https://otohime.dev, `<meta name="build-sha">` = **cb2c417c273d05f87dcd96b813087d9d7d31d20a**. That build deployed through GitHub Actions run 40243310213 (checks success, production success). Browser: own Playwright 1.64.0 script, Chromium headless shell 156.0.8078.4, at 1366x768 (mouse) and 390x844 (touch, isMobile), plus reduced-motion and no-JS contexts. Two full runs: **87 ok / 0 not ok** each, 0 page errors and 0 console errors. The walk was read-only: no sign-in and no form posts. External contact hosts were never opened.

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| New browser session on `/` (both sizes) | Load, wait 3.5 s, reload | Boot animates once (5 boot animations, no `data-booted`), then `data-booted` and `console:booted=1`. Reload: `data-booted` at DOMContentLoaded, 0 running boot animations | walk rows "boot first visit", "boot reload skip" |
| Negative control: a second new context | Load `/` | Boots again (`data-booted` absent) | "boot negative control" |
| sessionStorage and localStorage throw | Load `/` | Menu visible, 10 links, h1 present | "boot denied storage" |
| Sound off (default) | Arrow moves, then tap speaker, move, reload, mute, move | Before the gesture: 0 AudioContext, 0 oscillators. After enable: 1 context and 3 oscillators, `sound=on`. Reload keeps aria-pressed=true with no cold-load context. Muted move: 0 oscillators. Masthead box identical (64 px) | "sound …", "masthead stable" |
| Pointer over the console (1366) | Move to the corner, then away | Tilt 4.24° (≤6°), transform `none` after leaving. Touch tap and reduced motion: `none` | "tilt …" |
| Console menu (both sizes) | Down + Enter / tap A | URL `/play`, h1 "Fig. 03 — Play". startViewTransition called once, with `::view-transition-group(title-play)` and the zoom pseudo-animations captured. Back returns to `/`. No duplicate visible VT names. Reduced motion: navigates with 0 VT animations | "console A morphs …", "reduced motion navigates with no zoom" |
| Console B (both sizes) | B, A, wait; A; steer to food; reload | ready → playing → over; A restarts. Score 1, `pocket:high=1`, `data-best=1` after reload. Reduced motion: 0 idle steps, +1 per Down | "B opens snake …", "eating food scores", "reduced motion snake is turn-based" |
| Game open (1366) | Wrong-order code (negative control), then the correct ↑↑↓↓←→←→BA | Wrong: no wrap, no achievement. Correct: `data-wrap=true`, `pocket:achievement=1`, footer `end:achievement` unset | "Konami …" |
| Switchboard on `/` (mouse and CDP touch) | Drag the plug ~110 px off a jack (negative control), then onto Telegram's jack | Miss: idle readout, URL unchanged. Hit: "@otohime73 picked up on Telegram.", URL unchanged. t.me/x.com/spotify links remain plain anchors | "switchboard …" |
| `/work` pipeline at rest (both sizes) | Pause + Backfill, wait, then Resume | Rest: all counters 0, no `data-busy`. Paused: Queue 8, Lag 8, not busy. Resumed: drains to 8 stored/shown, then not busy. Labelled "illustrative simulation" | "pipeline …"; screenshot work-d viewed |
| First machine on `/work` | Pick pencil/crayon/watercolour/ink, Re-roll, Boil, Boil again | 4 distinct filter bodies; ink restores the default exactly. Seed 0→37. 17 seed changes in 3 s (~5.7 Hz), then stops. Reduced motion: Boil aria-disabled | "four distinct hands", "boil ~6 Hz then stops" |
| `/projects` | Count, hover, click (1366); layout (390) | 11 cartridge links (/shore, /capsule, /orrery…). 3 columns at desktop, 2 at 390, 0 px overflow. Hover lifts 6 px. Click opens /shore with `::view-transition-group(project-shore)` | "projects …", "hover lifts", "click opens" |
| `/sketches` | Scroll to the end; reduced motion | 12 frames, 24 view-timeline animations. Last frame dashoffset 1px→0 and wash leaves. Reduced motion: 0 view-timeline animations, 12 images | "sketch frame draws …" |
| `/music` (both sizes, no-JS) | Load; GET /api/now-playing; POST; injected `?host=` | Readable cassette "Side A · Spotify · Quiet" and cartridge "Steam · Quiet, Hades II" with "Not read live" credit. TV channel controls present. API 200 no-store `spotify-off`/`steam-off`, query ignored, POST 405. No secret names in the HTML | screenshot music-m viewed; curl |
| Theme toggle (both sizes) | Click; reduced motion | Theme flips to dark through startViewTransition (root group). Reduced motion: flips with 0 VT animations | "ink-wipe theme toggle" |
| JavaScript disabled (390) | Load `/`, `/music`, `/sketches` | 6 console menu links, the cassette text and 12 images in the server HTML | "no-JS" |
| **Live provider (idea 9)** | GET https://otohime.dev/api/now-playing | **`spotify-off`, `steam-off`: no live track or game.** Production has no SPOTIFY_*/STEAM_* configured | curl, 2026-10-26T00:41Z |

## Verdict: pending

Eleven of the twelve ideas exist in the running product. Idea 2 (ink wipe), shipped before this plan, also checks out. Idea 9's cassette/cartridge renders and falls back honestly. But the idea's **live Spotify track and current game** do not exist for a visitor yet. The only missing thing is an owner account chore, already named in the plan, which no task can do:

- `esc-377`, operator_action **spotify-app:now-playing** (owner: site owner). Create a Spotify app with Premium, consent to `user-read-currently-playing`, put SPOTIFY_* in Vercel Production and redeploy. Ready probe: `GET https://otohime.dev/api/now-playing` body contains `spotify-live`.
- `esc-378`, operator_action **steam-key:current-game** (optional per the plan). Ready probe: body contains `steam-live`.

Successor acceptance at not_before 2026-10-27T00:45:54Z re-reads `/api/now-playing` and `/music` on the deployed build-sha. Failure condition: `spotify-live` is present but the cassette does not show the sanitized track, or the API/page leaks a secret or errors. If the chore is still not done, the outcome stays undelivered: report it, never pass it.

## Identities and boundaries

- Delivery shas 916f58f, 284429c, f82ea2f, 10b7043, 41a4f3e, 7f7f797, 61bbd2c, 84dc823, 3ac3b21, dea7f76 and ced64c1 are ancestors of deployed cb2c417. f4a360b (t-1479 r2) is not deployed, but it changes only `scripts/probe-ink-modes.*`; t-1479's app code f35c774 is deployed. All 33 `pm-242/` commits are authored by Otohime <quiinthieu@gmail.com> with 0 Co-Authored-By trailers. No author.txt is in the delivery evidence.
- Real: production Vercel build, real Chromium, real Now Playing module with absent credentials. Fake: an AudioContext/startViewTransition spy (counts only). Touch is CDP-emulated. Not run: Safari, Firefox, real devices, audibility by ear. Vercel runtime logs were not readable (no token on this lease); browser console and page errors were read: 0.
- No job runtime or queue applies; no deferred capacity.
- Outside this plan: main CI has been red since pm-248's c06a430 (runs 40243542089 … 40248651427, step "Footer walk and Chromium probe", pm-241's walk-end.sh). Run 40249442711 (7e860a0) was cancelled; 40249139334 (323b528) was failing. So newer commits are not deploying. pm-242's product is unaffected because it shipped in cb2c417. Owner: pm-248.
- Run profile: acceptance_engineer, claude-opus-5-5.
