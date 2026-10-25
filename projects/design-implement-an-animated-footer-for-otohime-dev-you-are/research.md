# Research: an animated footer for otohime.dev, "The End of the Internet" (pm-241, run-8297)

**Idea.** Design and implement a memorable, interactive animated footer for otohime.dev in the spirit of a cozy indie game's ending scene: a miniature world, a mascot, ambient animation, an Easter egg, the six page links, the four contact lines, back to top, credits and the year. No generic SaaS footer, no new animation library, reduced motion respected, no layout shift.

**Short answer.** Build the footer **inside `app/(site)` only**, as one semantic `<footer className="end">` placed in the `(home)` and `(app)` group layouts, inside each layout's `<ViewTransition>` wrapper right after `<main>` / the sidebar grid (a hard rule from `lib/motion.test.ts`). The scene is the site's own isometric ink: `Inked`, `box`, `swatches` and the LCD classes from `components/figures.tsx` and `globals.css`, with **the pocket console as the mascot**: the console that boots on the front page and is "the way in" is found again at the bottom of every page, powered down to a save screen, its LCD a face whose pixels are eyes. One pure reducer in `lib/` (Konami progress, pokes, LCD lines, press frames on twos) tested with `node --test`, one small client island for the observer, the eyes and the keys, copy in `content/site.ts`, routes from `lib/pages.ts` (`CONSOLE_MENU` is exactly Work, Play, Notes, Music, Projects, Sketches) and `site.lines` (Telegram, X, Spotify, Email). No new dependency, no font download, no new network request. The eleven projects are separate root layouts with isolation tests and get **no** footer. Everything below was checked against the repo at **ad778f1** (the sha the live site reports in `<meta name="build-sha">` on 2026-10-25) and the live HTML, which has no `<footer>` on any page today.

## 1. The repo today (ad778f1, 2026-10-25)

| Fact | Where | Consequence for the footer |
| --- | --- | --- |
| Next.js 16.4.2 App Router, React 19.3 (exports `Activity`, `ViewTransition`, `useEffectEvent`), TypeScript 5, Node 22, Turbopack, Tailwind v4 **only** inside `app/(site)/globals.css` (1,123 lines) | `package.json`, `app/(site)/globals.css` | The footer is Tailwind utilities plus `@layer components` rules in `globals.css`, like every site component |
| `cacheComponents: true`, `partialPrefetching: true` | `next.config.ts` | A bare `new Date()` in a server component **fails the prerender** (`node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` §"Random values and timestamps"). The year must be read inside `"use cache"` with `cacheLife("days")` (an async component; the static shell carries it, no Suspense needed) or via `await io()` behind Suspense. Decision: `"use cache"` + `cacheLife("days")` |
| The site has three group layouts under one bare root: `(home)` = Masthead + `<ViewTransition enter="page-in" exit="page-out" default="none"><main/></ViewTransition>`; `(app)` = Masthead + the same wrapper around `div.lg:grid-cols-[220px_1fr]` (sticky `nav.appnav` + `<main id="main">`); `(auth)` = masthead + wrapper around `<main>` with the lock figure | `app/(site)/(home|app|auth)/layout.tsx` | `lib/motion.test.ts` asserts, per group layout: exactly one wrapper, the masthead above it, and **"nothing but the closing fragment follows the wrapper"**, and the root layout stays bare. So the footer goes **inside** the wrapper, after `</main>` (home) and after the grid `</div>` (app). It then stays put on in-group page changes (`default="none"`) and fades with everything else on a group swap |
| Every page wraps itself in `<ViewTransition>` and starts with `div.rise` + `FigTitle n="0n"`; `main` is `mx-auto max-w-5xl px-5 py-6 sm:px-8 lg:py-8` | `app/(site)/(app)/*/page.tsx` | The footer is full width below the grid, with its own `mx-auto max-w-5xl px-5 sm:px-8` inner so it aligns with the pages on `(home)`; on `(app)` at ≥ 64rem it runs under both the sidebar and the main column, which reads as "the ground under everything" |
| Tokens: `--paper/--paper-2/--field/--ink/--muted/--line/--hairline/--danger` as `light-dark()`, the five swatches `--yellow #f4b829 --coral #ef6a4c --mint #93d3b0 --blue #76a0e2 --pink #f3a6bb`, `--shade`, `--on-swatch #231e16` (ink that stays dark on both papers); mapped to Tailwind as `text-muted`, `border-line`, `bg-paper-2`, `border-on-swatch` etc. Theme: OS until `data-theme` is pinned on `<html>` by `components/theme-toggle.tsx`; the toggle spreads the new paper with a clip-path view transition | `globals.css` lines 12–57, 1003–1020 | Use only these variables; the footer follows light/dark and the ink spread for free. Nothing in the footer may set a `view-transition-name` (the theme switch resets the named ones; an extra name would fragment the spread) |
| Type: body `13px/1.55 ui-monospace`, `h1–h3` 600 with 0.02em tracking, `.caption` 11px uppercase 0.08em muted, `.btn`, `.btn-primary` (Inter), `.chip` (hover lifts with a 2px ink shadow, tints with `--fig`), `.readout` (aria-live caption), `.log` (muted `white-space: pre` lines with a blinking `▋` cursor), `.stat`. The comment "ponytail: system faces, no font download" | `globals.css` 67–120, 586–640, 727–760 | The headline is the mono face at `clamp(1.5rem,4vw,2.25rem)`; "handwritten" is the wobble of the ink, not a webfont. Projects use Caveat/Patrick Hand via `next/font`, but the site deliberately does not |
| **Accent-colour customisation** is per figure, not site-wide: `Machine` keeps `useState(colour)` and sets `--fig` on its `<section>`; `SwatchPicker` is the five radio swatches (`.swatch`); `.fig-top/.fig-lit/.fig-shaded/.fig-inside/.fig-floor` are `color-mix()`es of `--fig`. **Hand-drawn wobble** is `Machine`'s range input 0–7 (default 3.5) passed to `Inked`'s `feDisplacementMap scale` | `components/machine.tsx`, `components/figure-playground.tsx`, `components/figures.tsx` 142–176 | The scene is drawn inside `Inked` with `--fig`; the footer offers the same `SwatchPicker` and wobble slider in its "knobs" row (`.machine-knobs`), so the knobs the idea names work here too. The picked swatch also recolours the chips (`.chip:hover` uses `--fig`) |
| Isometric drawing kit: `screen()`, `at()`, `box(origin, w, d, h, base, cast)` returning `shadow/top/shaded/lit` polygons and `onLit/onShaded` matrices for flat artwork on a face; LCD classes `.fig-dark .fig-lcd .lcd .lcd-cursor .fig-lamp .bulb`; the console's menu geometry `LCD`, `menuBaseline` | `components/figures.tsx` 16–55, `components/handheld.tsx`, `lib/pages.ts` | The mascot is the handheld's geometry (`box(O, 24, 112, 176)`) lying on its back or standing, drawn with the same calls, so it is unmistakably the same object as the one at the entrance |
| Motion grammar (README §Motion): figures run **on twos at 12 fps from pure reducers** (`lib/machines.ts`, `useTick`, `press` → `settle` under reduced motion); ink draws on; **the base style is the resting pose** (every keyframe animates *from* somewhere, so no-JS, reduced motion and a stylesheet that never loads all show the whole drawing); exits 150 ms, enters 210 ms, nothing over 400 ms except a draw-on; **loops only on things that loop in life**; one global `prefers-reduced-motion` reset, last block of the stylesheet, which also zeroes `::view-transition-*` | README 206–219, `globals.css` 1098–1123, `lib/motion.test.ts` | The entrance is an *addition*: the footer renders complete, and when the observer marks it `data-seen` the parts animate *from* hidden to their resting pose. Clouds drifting, stars twinkling, a lamp breathing and data flowing are things that loop in life; a bouncing headline is not. Spring feel comes from the house curve `cubic-bezier(0.16, 1, 0.3, 1)` (`.rise`), typing from `steps()` (`.print` is `steps(12)`) |
| Existing keyframes: `rise` (opacity + 6px), `breathe` (opacity 0.55), `print` (clip-path inset from the right), `bump`, `bulb`, `blink` (opacity 0.2), `spin`, `boot`, `splash`, `ink-spread`, `fade-in/out`. Stagger: `.rise[style*="--i"] { animation-delay: calc(var(--i) * 40ms) }` | `globals.css` 905–960, 663–668 | Reuse `rise`, `print`, `blink`, `breathe`; add only `drift` (translate across) and `type` (a longer `print` with a `steps(n)` count), both under `@layer components`, with the reduced-motion block kept last |
| The site has **no footer** anywhere: no `<footer`, no `IntersectionObserver` in `app/(site)`, `components/`, `lib/`; the live HTML of `/` and `/work` has none | grep; `curl https://otohime.dev/` | Greenfield; nothing to migrate |
| Routes: `PUBLIC_PAGES` (Home, Work, Play, Notes, Music, Projects, Sketches) and `CONSOLE_MENU = PUBLIC_PAGES` minus Home | `lib/pages.ts` | The footer nav maps `CONSOLE_MENU`: exactly the six the idea lists, in the sidebar's order; `lib/pages.test.ts` already pins the order |
| Contact: `site.lines` = Telegram `https://t.me/otohime73`, X `https://x.com/otohime73`, Spotify `https://open.spotify.com/user/2rjk8knzs0fyfc7oovb2zezqw`, Email `mailto:hello@otohime.dev`, each with `code` (TG, X, SP, @) and a swatch; `Switchboard` opens non-mail lines with `target="_blank" rel="me noreferrer"` (`away()`) | `content/site.ts` 34–47, `components/switchboard.tsx` 22 | The footer lists the same four, with the same `away()` rule (copy it or export it from `components/switchboard.tsx`). The handles carry `TODO(otohime)` notes; the footer must read them from `site.lines`, never retype them |
| Words live in `content/site.ts` (`site.tagline`, `bio`, `now`, `play`, …) | `content/site.ts` | The footer's copy is `site.end` (title, sub, the LCD lines, the signature, the status line, the achievement text) |
| Keyboard: `Handheld` listens to `keydown` on `window` for ArrowUp/Down, `a`/`A`, Enter, **only while `scrollY === 0`**, skipping form fields | `components/handheld.tsx` 36–58 | A footer key listener (the Konami code) runs only while the footer is intersecting, skips form fields and never calls `preventDefault`, so arrows keep scrolling and the two never fire together (the front page's hero is `min-h-[calc(100dvh-8rem)]`, so the footer is off screen at `scrollY 0`) |
| Landmarks and probes already in place: `e2e/rbac.test.ts` asserts the front page has **no** `aria-label="Main"` and `/work` has one; every public page returns 200; the projects' pages link `/projects`. `scripts/probe-motion.mjs` asserts under reduced motion "every animation at load lasts ≤ 1 ms or has finished" (motion on is not checked that way), and that `/projects` has **11 `main li.rise`** row animations | `e2e/rbac.test.ts` 73–85, `scripts/probe-motion.mjs` 108–134, 322–336, 504 | The footer nav is `aria-label="Footer"`-ish, never "Main" (the switchboard uses "Elsewhere", the console "Pages"); the footer sits **outside `<main>`** so its `li`s are not counted; CSS loops are covered by the global reset; **JS-driven motion (eyes, typing, rAF) must gate on `matchMedia("(prefers-reduced-motion: reduce)")`** like `press()` does |
| `Inked` applies one `<filter>` (`feTurbulence` + `feDisplacementMap` + grain) to a `<g>` around all children | `components/figures.tsx` 142–176 | **Anything animated inside the filtered group re-rasterises the filter every frame.** The existing machines get away with it at 12 fps on twos. Ambient loops (clouds, stars, packets, the eyes) go in a sibling `<g>` or a second `<svg>` layer **outside** the filter, animating `transform`/`opacity` only; the filtered group holds the static line work |
| Pod and CI: `npm ci` then `npm test` passes **1,419** tests in 2 s (a stale `node_modules` without `roughjs` failed 16 before `npm ci`); `google-chrome` and `docker` exist on this pod; the probe scripts install Playwright into a temp prefix; CI runs lint, typecheck, test, build, e2e and `probe-motion-signed-in.sh` | `.github/workflows/ci.yml`, `scripts/probe-motion.sh` | A browser probe for the footer can run on the lease and against `BASE_URL=https://otohime.dev`. Walk/probe ports in use: 4000, 4019–4080; free: **4081** (walk), **4083** (probe) |
| Commits to `main` must be authored `Otohime <quiinthieu@gmail.com>` (Vercel Hobby); subjects `pm-241/t-NNNN:`; concurrent pushes to `main` → `git pull --rebase` | README §Deploying, lesson iss-9 | House rule |

## 2. Three concepts

| | A. The End of the Internet (console save point) | B. The save dialog | C. Night shift at the rack |
| --- | --- | --- | --- |
| Picture | A hand-inked isometric slab of paper "ground" that ends in a torn edge; a signpost whose arms are the six pages; **the pocket console** from the front page lying at the edge, LCD glowing, its pixels two eyes; three paper clouds drifting; seven stars blinking on twos; a dotted stream of tiny parcels (data packets) flowing off the edge | A retro game "SAVE?" box drawn in ink rises from the paper with a blinking cursor; options Continue (top), Load (pages), Quit (lines); the 404's parcel as mascot | The server rack from `/work` after hours: lights off, LEDs become stars, the switchboard operator's cord asleep, packets falling like snow |
| Originality | High: bookends the site (the console boots at the entrance, powers down at the end); the eyes-in-the-LCD face is new | Medium: a known trope, mostly typographic | Medium; strong data-engineering theme |
| Visual cohesion | Reuses `box`, `Inked`, LCD classes, swatches; same object as the home page | Good: paper, ink, mono | Duplicates `/work`'s figure; a dark scene fights the light paper |
| Usability | Nav and lines are plain HTML beside the drawing, readable without JS; LCD lines mirrored in an `aria-live` readout | Simplest to read | Links would be buried in a dark picture |
| Complexity | ~450 lines TSX + ~220 lines CSS + ~120 lines reducer + tests; one island | ~250 lines | ~400 lines, plus a second server-rack drawing |
| Mascot | Console with LCD eyes: breathes (power lamp), follows the cursor, blinks, says LCD lines on poke | Parcel: can only wobble | Operator: small, far, hard to make expressive |

**Pick A.** It is the only one that gives the site a story (in at the top, out at the bottom), it needs no new drawing language, and the mascot is already the site's most expressive object.

## 3. Design

### Copy (`site.end` in `content/site.ts`, a first draft the owner can edit)

- Title: **"You've reached the end of the internet."** (kept as asked.)
- Sub: **"Thanks for stopping by. See you on the next level."** Alternative that fits the paper world: "Nothing past this line but paper. See you on the next level."
- LCD idle line: `SAVE POINT`; after the first poke it cycles, on twos: `HI.` · `STILL HERE?` · `NICE SCROLLING.` · `7/7 PAGES. 100%.` · `PRESS A TO GO HOME` · `OK, BYE.` (then back to `SAVE POINT`). `7` is `PUBLIC_PAGES.length`, never typed.
- Status caption (game-inspired, tiny): `SAVE POINT · {Fig. 0n — Page} · 12 FPS · NO COOKIES, JUST PAPER` where the page part reads the current route from `CONSOLE_MENU` (client, `usePathname`) and falls back to `Home`.
- Signature: `Drawn in SVG, built with Next.js, animated on twos.` and `© {year} Otohime`.
- Achievement: `ACHIEVEMENT UNLOCKED · Reached the end` with a `★ 1/1` badge afterwards.

### Composition

- `<footer class="end" aria-labelledby="end-title">` full width, `border-top: 1px solid var(--hairline)`, background `var(--paper)`; inner `mx-auto max-w-5xl px-5 sm:px-8 py-12`; at ≥ 64rem a two-column grid `minmax(0,1fr) minmax(0,26rem)`: the scene left, the words right; below, a hairline and the bottom row.
- **Scene** (`EndStage`, the island): one `Inked viewBox="0 0 520 280"` with the static ink (ground slab via `box([200,190], 300, 150, 18)` with a ragged torn front edge drawn as a jittered polyline, the signpost `box` post with six arms, the console `box([…], 24, 112, 176)` standing at the edge with its cartridge) and a sibling unfiltered `<g class="end-sky">` for clouds (three `fig-paper` rounded blobs, `drift` 42 s / 58 s / 73 s linear infinite, translate only), stars (seven `fig-ink` dots, `blink 1.6s steps(1) infinite`, `animation-delay: calc(var(--i) * -0.23s)`), the packet stream (a dashed path from the slab's edge down and off, `stroke-dashoffset` loop 4 s, with three tiny `fig-top` squares riding it via `offset-path`, or three stepped translates) and the LCD eyes (two 6×8 `fig-dark` rects whose pupils are `lcd` rects translated by `--ex/--ey`).
- **Words** (server HTML): `h2#end-title` the title, `p.text-muted` the sub, then two lists side by side: `nav aria-label="End of the page"` with the six pages as `.nav-item`-styled links each with a `Fig. 0n` `<small aria-hidden>` (mirrors the sidebar), and `ul` "Lines" with four `.chip` anchors `TG Telegram`, `X X`, `SP Spotify`, `@ Email` using `away()`.
- **Bottom row** (`flex flex-wrap justify-between gap-4` under a hairline): left `a.btn.btn-sm href="#main"` "▲ Back to top" (the `#main` landmark exists in every layout, works without JS and moves focus; `html { scroll-behavior: smooth }` inside `@media (prefers-reduced-motion: no-preference)`); middle `.readout`-style status caption; right the signature and `© {year}`; a `.machine-knobs` row with the wobble slider and `SwatchPicker` folds under the scene on ≥ 64rem and is hidden on `< 40rem` (the mascot keeps the default swatch there).
- **Mobile (< 40rem):** single column, scene first at `max-w-[22rem] mx-auto`, clouds and the packet stream `display: none`, stars stay (cheap), eyes do not follow (`@media (hover: hover)` gate in JS), tap = poke.

### Animation timeline (when `data-seen` is set once by an `IntersectionObserver`, `threshold: 0.2`)

| t | What | How |
| --- | --- | --- |
| 0 ms | Ground slab rises | `rise` 0.4 s, house curve |
| 80 ms | Signpost rises and settles from `rotate(-4deg)` | `rise` + a `settle` keyframe, 0.4 s |
| 160 ms | Console prints in from the left | `print` 0.6 s `steps(12)` |
| 400 ms | Title types | `type` 1.1 s `steps(34)` on `clip-path` from `inset(0 100% 0 0)`, with a `::after "▋"` blinking (`blink`) that stops at the end (`animation-fill-mode` on a separate `cursor-out` keyframe) |
| 1.2 s | Sub, nav, lines rise | `.rise` with `--i` stagger (40 ms) |
| 1.6 s | Power lamp starts breathing, stars start blinking, clouds start drifting | `animation-play-state` flips from `paused` to `running` via `[data-seen]` |

Everything above animates **from** somewhere into the resting pose, so without JS or under reduced motion the footer is the whole drawing with all its text. Under reduced motion the global reset collapses every CSS animation to 0.01 ms once; the island reads `matchMedia` once and then skips eye-follow, the typed cursor and the 12 fps LCD press (it dispatches `settle` like `press()`).

### Interaction

- **Mascot** is a `<button type="button" class="end-console" aria-describedby="end-readout">` wrapping the console's hit area over the SVG (a transparent `<rect>` is not focusable; the button is HTML positioned over the console's box). Hover: pupils scale 1.2 (CSS `:hover`). Pointer move over the footer (desktop, `hover: hover`, motion on): the island sets `--ex`/`--ey` on the stage, clamped to ±2 px in the SVG's units, through one `requestAnimationFrame` at a time. Click/tap/Enter/Space: `dispatch("poke")`: the A button lights for two frames (`hold: 2`, like `pad`), the LCD shows the next line, the `#end-readout` `.readout[aria-live=polite]` says the same line in sentence case. Ten pokes in one visit: `STOP POKING ME.` then the cycle resumes.
- **Easter egg:** the Konami code `↑ ↑ ↓ ↓ ← → ← → B A` typed while the footer is intersecting. Pure `konami(progress, key)` in the reducer; on completion `unlocked: true`: the LCD prints `ACHIEVEMENT UNLOCKED` then `REACHED THE END`, the seven stars take the five swatches (`fill: var(--yellow)` …) and keep them, and `localStorage["end:achievement"] = "1"` so later visits show a `★ 1/1` badge next to the signature with `title="You found the end"`. The listener ignores events from `input, textarea, select, [contenteditable]`, never prevents default, and detaches when the footer leaves the viewport (the observer toggles it). Second, smaller egg: with the console focused, typing `A` opens Home like the front page's console (`router.push("/")`), which the LCD's `PRESS A TO GO HOME` line hints at.
- **Back to top** is the anchor above; with motion on the island may additionally `scrollTo({ top: 0, behavior: "smooth" })` on click, but the anchor alone is enough and is what the no-JS path uses.

### Engine (`lib/end.ts`, pure, tested in `lib/end.test.ts` under the existing `lib/**/*.test.ts` glob)

```ts
export const KONAMI = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"] as const;
export type End = { line: number; pokes: number; pressed: boolean; hold: number; progress: number; unlocked: boolean };
export type EndAction = "poke" | { key: string } | "tick" | "settle";
export const newEnd = (unlocked = false): End => ({ line: 0, pokes: 0, pressed: false, hold: 0, progress: 0, unlocked });
export const endBusy = (s: End) => s.pressed;
export function end(s: End, a: EndAction): End;          // poke → line+1 mod LINES, pokes+1, pressed for 2 frames; key → progress, unlock at 10
export function lcdLine(s: End, lines: readonly string[]): string;  // "SAVE POINT" at rest, STOP POKING ME at the 10th poke, ACHIEVEMENT lines when unlocked
```

Tests: the ten keys in order unlock, a wrong key resets progress to 0 (or to 1 if the wrong key is ArrowUp, the standard prefix rule), lowercase and uppercase `b`/`a` both count, `poke` cycles through `site.end.lines` and wraps, the press lasts exactly two ticks and `settle` lands at rest, `lcdLine` never exceeds the LCD's width (≤ 18 characters at `fontSize 8.5` in a 64-unit LCD, the same arithmetic `lib/pages.test.ts` does for the menu), every LCD line is upper case ASCII, `site.end.title` and `.sub` are the two sentences the idea asks for or a one-line alternative, `PUBLIC_PAGES.length` is the only digit in `site.end.lines`.

### Files (draft for the plan; the product owner owns the final tree)

```
content/site.ts                 site.end = { title, sub, lines[], status, signature, achievement }  (+ type End copy)
lib/end.ts · lib/end.test.ts    the reducer, KONAMI, lcdLine, and the LCD width rule
lib/pages.ts                    export const FOOTER_MENU = CONSOLE_MENU (or reuse CONSOLE_MENU directly)
components/end-footer.tsx       server: <footer class="end"> words, nav, lines, bottom row, <Year/> ("use cache", cacheLife("days")), <EndStage/>
components/end-stage.tsx        "use client": the scene SVG (Inked + sky layer), the observer (sets data-seen on closest(".end")),
                                the eyes (rAF, hover-only, motion-only), the poke button + readout, the Konami listener, the knobs
components/switchboard.tsx      export away() (or copy it)
app/(site)/(home)/layout.tsx    <EndFooter/> after </main>, inside the wrapper
app/(site)/(app)/layout.tsx     <EndFooter/> after the grid </div>, inside the wrapper
app/(site)/globals.css          .end … rules under @layer components; @keyframes drift, type, settle, cursor-out; reduced-motion block stays last
lib/motion.test.ts              extend the layout test: the footer sits inside the wrapper and after <main> (home) / the grid (app)
scripts/walk-end.sh             :4081, no database: every public page has exactly one <footer class="end", six footer links in CONSOLE_MENU order,
                                four line hrefs equal site.lines, the title text, © and a 4-digit year, no <footer on /sign-in and the 404,
                                no aria-label="Main" added to /, build-sha; BASE_URL mode against otohime.dev
scripts/probe-end.sh/.mjs       :4083, headless Chromium at 1366×768 and 390×844: footer below main on every public page; no horizontal
                                overflow (scrollWidth ≤ innerWidth); the footer's height before and after data-seen is equal (no layout shift);
                                after scrolling it into view data-seen is set and the title's `type` animation runs then finishes; clouds
                                `drift` running at desktop, none at 390; poke changes the LCD text and the readout; Konami unlocks (LCD text,
                                localStorage key, stars recoloured); Tab reaches the six links, four lines, the console button and Back to top in
                                order with a visible outline; Back to top lands at scrollY 0 with focus on #main; under reduced motion every
                                animation at load lasts ≤ 1 ms or has finished and the eyes do not move; theme toggle keeps the footer legible
                                (computed color of .end text ≠ its background on both papers); no console error, no page error
README.md                       a Footer paragraph under Layout and the walk/probe sentences under Tests
```

## 4. Verification the plan can promise

1. `npm ci && npm test` green with the new `lib/end.test.ts` and the extended `lib/motion.test.ts`; `npm run lint`, `npm run typecheck`, `npm run build` (the build is where a bare `new Date()` would fail; the `"use cache"` year must survive it).
2. `bash scripts/walk-end.sh` locally and `BASE_URL=https://otohime.dev bash scripts/walk-end.sh` after deploy.
3. `bash scripts/probe-end.sh` locally (Chrome and Playwright are available on the lease) and against production; `bash scripts/probe-motion.sh` still green (the eleven `main li.rise` rows, the hops, reduced motion).
4. `npm run test:e2e` unchanged: the front page still has no `aria-label="Main"`, every public page 200.
5. QA walkthrough in the browser: `/`, `/work`, `/music` (the YouTube television above the footer must keep its 200 px clear area: the footer sits below `main`, never over it), `/projects` at 1366 and 390, both themes, reduced motion on, keyboard only.

## 5. Risks and limits

- **Filter cost.** If any ambient loop lands inside `Inked`'s filtered `<g>`, Chromium re-runs `feTurbulence` + `feDisplacementMap` every frame. The sky layer must be a sibling; the probe can read `document.getAnimations()` targets and assert none has an ancestor with a `filter` attribute.
- **The theme spread.** The toggle's `ink-spread` view transition snapshots the root; the footer must not add `view-transition-name`s. Running CSS animations continue under the snapshot; fine.
- **`cacheComponents`.** The year via `"use cache"` + `cacheLife("days")` is captured in the static shell and revalidates daily; the first visitor after midnight on 1 January may see the old year for up to five minutes (the profile's stale window). Acceptable; the alternative (`await io()` + Suspense) would stream the year and risk a flash.
- **Hydration.** The island must not read `localStorage` during render (the achievement badge): read it in `useSyncExternalStore` with a `null` server snapshot, like `ThemeToggle`.
- **Scope.** The projects (Shore … Design system) are separate documents and stay footer-less; the idea's "cross-page consistency" is the seven site pages plus the signed-in rooms, which share the `(app)` layout. The `(auth)` pages and the 404 are deliberately bare (the sign-in form and the parcel are the whole page).
- **Owner copy.** Handles and the email carry `TODO(otohime)` marks in `content/site.ts`; the footer reads them and inherits whatever the owner fixes there.

## 6. Decisions recorded this run

1. Footer in `app/(site)` only, inside each group layout's `<ViewTransition>` wrapper after `<main>`; none in the projects, `(auth)` or the 404.
2. Concept A with the pocket console as mascot; no new dependency, no font download, hand-drawn through `Inked`'s wobble; the same `SwatchPicker` and wobble knob.
3. Copyright year through `"use cache"` + `cacheLife("days")`, because `cacheComponents` rejects a bare `new Date()` at prerender.
4. Ambient loops only for things that loop in life, outside the filtered group; the entrance is an addition over the resting pose; JS motion gated on reduced motion.
5. `/shared/artifacts` is not writable on this lease, so this document lives at `projects/design-implement-an-animated-footer-for-otohime-dev-you-are/research.md` (uncommitted, research does not push) and is submitted as the report body.
6. Lesson: a lease's stale `node_modules` (no `roughjs`) fails 16 unit tests; run `npm ci` before judging the baseline.
