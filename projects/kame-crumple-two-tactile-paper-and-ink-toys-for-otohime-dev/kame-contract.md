# Kame companion contract

Task `pm-259/t-1573`. Kame is an optional enhancement on `/`, `/work`, `/play`, `/notes`, `/music`, `/projects` and `/sketches`. Authenticated tools, forms and independent exhibit roots do not mount it. No tactile renderer or gesture code is imported.

## Loading and controls

`components/kame/loader.tsx` renders null on the server. It requests the renderer only after `load` and an idle callback (2s timeout; 200ms timer fallback). Save-Data leaves only an explicit Enable Kame companion button in the footer shell slot. An import failure leaves the same retry control. The reserved slot prevents the optional controls from shifting the footer when they arrive.

The fixed turtle is pointer-transparent and aria-hidden. Its labelled controls live in the footer: Call Kame, Hold to pet, Hide/Restore Kame and Name. Hide and Restore transfer focus to the replacement button. Name commits on blur or Enter; names render as text. The optional unmodified K shortcut ignores editable fields, repeats and modal dialogs. Pocket and other open modal dialogs disable controls, hide the artwork and stop following/audio.

Pet starts at 500ms, using a captured primary pointer or held Space/Enter. Release, pointercancel, lost capture, focus/window blur, Escape, resize, pagehide, visibility loss and unmount cancel the hold and audio. Touch scrolling remains normal outside the Pet button. Route changes remount the companion and clean up listeners, timers, observer, command receiver and animation frames.

## Pure policy and persistence

`lib/kame.ts` accepts separate elapsed (`now`) and local calendar (`calendar`) clocks plus a storage adapter. States are `swim`, `nap`, `follow`, `fetch`, `pet` and `shell`. At exactly 45,000ms without activity, swim/follow naps. Activity wakes a nap; explicit Call follows; pet/fetch are not interrupted by the idle timer. Dismissal takes precedence. Paused/reduced-motion state is always asleep, with a static greeting and usable controls under reduced motion. Live preference changes cancel movement and pet audio immediately; a sleeping companion remains in the viewport corner after resize.

Only `kame:v1` is written: `{name,lastVisit,streak,dismissed}`. Names trim to 24 Unicode code points, with Kame as the empty default. Local `YYYY-MM-DD` visits count once per date, increment on the next date (including month/year/leap-day boundaries), and reset to one after missed, malformed or future dates. Positive safe streaks below 100,000 are accepted. Storage read/write failures retain working in-memory controls. No server tracking or analytics is added.

Local hour mood: 00–05 sleepy, 06–11 bright, 12–18 calm, 19–23 drowsy. Streaks of at least three days add the friendly greeting.

## Fetch port for task 3

Import `commandKame` from `components/kame/commands.ts`. The mounted companion owns one receiver; no window/global event API exists.

```ts
commandKame({ type: "fetch", target: { x: 120, y: 240 } }); // viewport CSS pixels
commandKame({ type: "cancel" });
```

The boolean result means accepted, not arrival/completion. Fetch rejects unavailable mounts, nonfinite targets, petting, dismissal, modal pause or reduced motion. The renderer bounds coordinates to the viewport and approaches the target. Cancel returns to swimming. Task 3 owns drag discovery, proxies, arrival/return orchestration and any additional completion interface; they are not implemented here.

## Sound boundary

`startPurr`/`stopPurr` in `lib/sound-client.ts` reuse the site's single AudioContext and sound preference. Gesture-down unlocks audio only when sound is on; a delayed, bounded triangle cue starts after the hold threshold, at -34dB and under 300ms. There is no loop or media asset. Generation checks prevent asynchronous resume from reviving a cancelled pet. Release/cancel/blur/hide/toggle-off/unmount disconnect scheduled voices. Sound-off and unavailable Web Audio remain silent and usable.

## Verification boundaries

Pure fixtures inject elapsed/calendar/storage; production browser tests use Playwright clock/calendar fixtures rather than waiting 45 seconds. Real Chromium renders the production Next build, dispatches real keyboard/pointer/touch input and constructs real Web Audio nodes (wrapped only to record cancellation). Visibility tests explicitly dispatch visibility changes; they do not claim an operating-system tab lifecycle. Negative controls cover typing K in a field, sound-off oscillator absence, deferred idle loading, no-JavaScript links and ordinary footer navigation. Initial edge/corner placement assertions catch a rescued first-mount defect before the fix. Deployment, independent QA and performance budgets for the combined toys remain owned by the plan's later gates/tasks.
