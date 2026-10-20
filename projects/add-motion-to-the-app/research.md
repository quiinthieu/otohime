# Research: Add motion to the app (pm-206, run-6860)

**Idea.** "Add motion to the app." One sentence, no page named.

**Short answer.** The app already moves in most places, in a house style worth keeping: figures on twos at 12 fps, ink that draws itself on, CSS keyframes whose base style is the resting pose, one reduced-motion block per stylesheet, no motion library. What is missing was measured against the repo at 65a91b2 on 2026-10-20 with a throwaway build and headless Chromium (§2):

1. **Every hop between the site and a project, and between two projects, is a hard cut.** The site and the eight projects are nine root layouts joined by plain `<a>` links, so each hop is a full document load and React's `<ViewTransition>` (which the site's own pages already use) never runs. The browser's cross-document View Transitions fix this with one CSS rule per stylesheet. Proved on the real build: with the rule in `globals.css` and `shore.css`, `/projects → /shore` and back both fire a transition (`pagereveal.viewTransition` non-null); `/projects → /capsule`, where only one side had the rule, does not. **Both documents must opt in.**
2. **Three projects are still on load and Planisphere is still full stop.** At first paint `/shore`, `/capsule`, `/elements`, `/vinyl`, `/rotor` and `/planisphere` have zero animations (their motion is all in the hand: crank, drag, keys, platter). `/barometer` swings only its needle while the mercury, vane and water just appear. Planisphere's only motion is a 0.4 s ease when the island turns the disc.
3. **Inside the site, the signed-in rooms, the auth pages, the 404 and the loading skeleton do not take part in the page transition** (no `<ViewTransition>` wrapper), and `/projects`, the door to every project, is a static list.
4. **There is no shared proof of motion.** Only Orrery has a motion test; every walk only greps its stylesheet for `prefers-reduced-motion`. Nothing checks that a transition fires, that a draw-on runs, or that reduced motion really stops it.

Recommend **one plan, three build tasks with QA, CSS and React only, no new dependency**: (1) cross-document transitions between every root layout plus a motion probe and a README "Motion" section; (2) the site's own pages; (3) the still instruments move (Barometer, Planisphere, Rotor). About 600 lines in all. Everything below is what the plan should say.

## 1. The repo today (65a91b2, 2026-10-20)

**What moves, and how.** The table is from reading the code and from `document.getAnimations()` at `load` in Chromium 156 (§2).

| Where | At load (motion on) | In the hand | Reduced motion |
| --- | --- | --- | --- |
| Site `/`, `/work`, `/play`, `/notes`, `/music`, `/projects` | `.rise` on the page (0.4 s), figures `print` on twos (`steps(12)`), the console boots and splashes, lamps blink, rack LEDs | the machines tick at 12 fps from pure reducers (`lib/machines.ts`, `components/machine.tsx`), `Stat` bumps, the theme spreads like ink (`startViewTransition`), the nav pill slides (`view-transition-name: nav-current`), pages fade out 150 ms / in 210 ms (`<ViewTransition enter="page-in" exit="page-out">`) | one global rule shortens every animation and transition to 0.01 ms and every `::view-transition-*` to 0 s |
| Shore | nothing | the sea-glass canvas renders on rAF, buttons sink 3 units on press | `* { animation: none; transition: none }` |
| Capsule | nothing | crank, drop and the staged open on twos (`turnFrames`, 16 to 28 frames), the spring-back crank, `settle` under reduced motion | none |
| Orrery | the ink draws on layer by layer (`sun-draw` on `pathLength="1"` paths, `--at` 0.25 s apart), then on the Sun three loops | Previous / Next are `<Link>` inside the group | none |
| Elements | nothing | cells spring on hover, the dialog pops (desktop) or rises (phone), the 3D atom auto-rotates | none, `frameloop="demand"` |
| Vinyl | nothing | sleeve lift, tonearm swing 600 ms, platter on rAF with inertia, the 450 ms FLIP flight, the lamp loop | no spin, no flight |
| Rotor | nothing | key sink 2 frames, lamp glow 3 frames, 12 fps from the reducer | frames jump to their end |
| Planisphere | nothing | the disc turns in 0.4 s on the arrow keys or Now; a drag is live | none |
| Barometer | the needle swings from -135° (1.1 s) | nothing | none |

**The house grammar, read off the code.** (a) Figures and machines run on twos: 12 fps, `setInterval(1000 / 12)` on a pure reducer with `tick` and `settle`; the notes page says why ("Smoother looked worse"). (b) Ink draws on: `stroke-dashoffset` 1 to 0 over `pathLength="1"`, then parts fade up; every base style is the resting pose, so a still (reduced motion, CSS that never loads, JavaScript off) is the whole drawing. (c) UI eases: the exit is fast (150 ms), the enter gentle (210 ms, delayed), nothing over 400 ms except a draw-on; loops only on things that loop in life (a lamp, convection, a platter). (d) Each stylesheet ends with its own reduced-motion block. (e) No motion library: four earlier researches (Sun, Elements, Vinyl, Capsule) declined Framer Motion, GSAP and Lottie, and React 19.3's `<ViewTransition>` plus CSS has covered every case since. (f) Nothing is ever drawn over the YouTube player (Vinyl).

**Structure that decides the design.** `app/(site)` and the eight `app/(name)` groups each have their own root layout and stylesheet (no Tailwind outside the site). The isolation tests forbid imports across groups, so a shared rule is **copied** into each stylesheet, never imported. Project pages link `/` and `/projects` with plain `<a>` (Orrery's chrome, Planisphere's "Next door: Orrery"); Next does a full document load across root layouts even for `<Link>`, which is why the site's same-document transition cannot reach them. The site pages are static and the newest project pages are dynamic (`cacheComponents`); the probe showed this makes no difference to a cross-document transition.

**Browser support.** React's integration needs Chromium 125+ (Next's own guide, `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`). Cross-document transitions ship in Chromium 126+ and Safari 18.2+; anywhere else the hop stays the hard cut it is today, which is the correct fallback.

**Standing rules.** The brief names `projects/20260921222547_plan_manager_chief_of_staff_extraction.md` and `docs/claude/software-development.md`; neither exists here and `AGENTS.md` holds only the `next dev` block (decision recorded; pm-204 found the same). The Rotor plan (`projects/research-and-design-more-projects-into-the-app/plan.md`) is the template.

## 2. What was proved (throwaway build, reverted; tree clean)

`@view-transition { navigation: auto; }` was appended to `app/(site)/globals.css` and `app/(shore)/shore.css`, `npm run build` ran with the repo's real `next.config.ts` (Next 16.4.2, Cache Components), `next start` served on :4061 and a Playwright 1.64 script drove the headless Chromium shell (Chrome/156.0.8078.4) at 1366×768. `pageswap` and `pagereveal` listeners report whether `event.viewTransition` is set.

| Hop (a click on the real link) | `pageswap` (old page) | `pagereveal` (new page) |
| --- | --- | --- |
| `/projects` → `/shore` (both opted in) | transition | **transition** |
| `/shore` → `/projects` (both opted in) | transition | **transition** |
| `/projects` → `/capsule` (only the site opted in) | transition | **none** |

So the rule is per document, the old page's opt-in alone buys nothing, and the hop works through a prerendered page and a dynamic one alike. Server log: no errors.

Animations at `load`, per route, motion on versus `emulateMedia({ reducedMotion: "reduce" })`:

| Route | Motion on | Reduced |
| --- | --- | --- |
| `/` | 14 (5 loops): rise, print, boot, splash, blink, bump | 7, none running (0.01 ms each) |
| `/projects` | 1: rise | 1, finished |
| `/work` | 24 (10 loops), including the UA root crossfade: a same-document transition already runs at first load when the masthead's `Account` Suspense boundary resolves | 17 |
| `/orrery/sun` | 68 (7 loops): sun-draw, sun-ink-fade, the three loops | 0 |
| `/orrery/saturn` | 25: sun-draw, sun-ink-fade | 0 |
| `/barometer` | 1: swing | 0 |
| `/shore`, `/capsule`, `/elements`, `/vinyl`, `/rotor`, `/planisphere` | **0** | 0 |

Two lessons for the contracts: the site's reduced-motion rule shortens animations instead of removing them, so `getAnimations()` still lists them and a probe must assert `effect.getTiming().duration <= 1` (or finished), not a count of zero; and on the site a transition can already be in flight at `load`, so the probe filters `-ua-` names or waits for `document.getAnimations()` to settle before counting the page's own.

## 3. The design

### 3.1 Cross-document transitions between every root layout (task 1)

**Rule, copied into all nine stylesheets** (`app/(site)/globals.css` and the eight `app/(name)/name.css`), with the site's timing so the hop feels like the site's own page change:

```css
/* The hop to or from another root layout (a project, the site) crossfades
   instead of cutting. Both documents must carry this rule. */
@view-transition { navigation: auto; }
::view-transition { pointer-events: none; }
::view-transition-old(root) { animation: 150ms ease-in both fade-out; }
::view-transition-new(root) { animation: 210ms ease-out 150ms both fade-in; }
@keyframes fade-out { to { opacity: 0; } }
@keyframes fade-in { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) {
    animation-duration: 0s !important; animation-delay: 0s !important;
  }
}
```

Details the engineer must get right:

- The site already has `::view-transition`, `fade-out`, `fade-in` and the reduced-motion pseudo-element rule; it adds only `@view-transition` and the two `root` rules, placed **outside** the `:root.theming` block (the theme switch keeps its ink-spread, which overrides `root` only while `.theming` is set).
- The project stylesheets' reduced-motion blocks are `* { animation: none !important }`. `*` never matches `::view-transition-*` pseudo-elements, so each project adds the pseudo-element rule above; without it a reduced-motion visitor would still get the crossfade.
- The site's masthead is named `masthead` with `::view-transition-old(masthead) { display: none }`, and the current nav pill is `nav-current`. On a hop to a project (no masthead there) the masthead cuts at once while the page crossfades; the pill fades as an old-only group. Decision: accept it, it reads as the chrome leaving first. Do not add transition types to scope the site's rules (Firefox and Safari handling of `types` on `@view-transition` is not proved here).
- **Title morph, one line per project**: the row title on `/projects` gets `view-transition-name: project-<slug>` (an inline style from `project.href`, so `content/site.ts` needs no new field) and each project's `h1` gets the same name in its own stylesheet (`h1 { view-transition-name: project-shore; }`). Across documents the browser then moves the title from the row to the heading. Keep it: it is the "same thing, going deeper" pattern from Next's guide and costs nine lines. If QA finds the morph ugly between Inter and Caveat, the fallback is to drop the nine lines, not the task.
- Project-to-project hops (Orrery's "Next door" link to Planisphere, and back) get the same fade for free once every stylesheet carries the rule. Add the rule to the house recipe: a new project's stylesheet copies it, and the motion test (below) fails until it does.
- Nothing changes in markup, routing, `next.config.ts` or the `<a>` links. Pages still work with JavaScript off (the transition is the browser's).

**Proof, in the task:**

- `lib/motion.test.ts` (runs under the existing `lib/**/*.test.ts` glob, no package.json change): reads the nine stylesheets from `app/`, discovering the `(name)` groups with `readdirSync` as the isolation tests do, and asserts each contains `@view-transition { navigation: auto` and a `prefers-reduced-motion` block that names `::view-transition-group(*)`. It also asserts the site's `root` rules sit outside `:root.theming`.
- `scripts/probe-motion.mjs` and `probe-motion.sh`, the shape of `scripts/probe-planisphere-touch.*` (Playwright and the Chromium shell installed into a temp prefix at run time, `BASE_URL` for production, port **4061**, 4071 for its negative check): for `/projects` → each of the eight project hrefs, and for `/shore` → `/projects` and `/orrery/sun` → `/planisphere`, clicks the real link and asserts `pagereveal.viewTransition` is non-null and `pageswap.viewTransition` is non-null; under reduced motion, asserts the hop still completes and every animation at `load` has duration ≤ 1 ms or is finished; no console errors; the probe runs at 1366×768 and 390×844.
- `README.md` gains a short **Motion** section stating the grammar in §1 and the nine-stylesheet rule, and the probe gets a line next to the walks.

### 3.2 The site's own pages (task 2)

- Wrap the pages that lack it in the same `<ViewTransition enter="page-in" exit="page-out" default="none">`: `dashboard`, `account`, `admin`, `admin/users`, `admin/users/[id]`, `admin/roles`, the three `(auth)` pages, `not-found.tsx`, `forbidden.tsx`. The wrapper goes in each `page.tsx`, never a layout (layouts persist, so enter and exit never fire there, per Next's guide).
- `app/(site)/(app)/loading.tsx`: wrap the skeleton in `<ViewTransition exit="page-out" default="none">` so the skeleton-to-page swap is the same handoff as a page change instead of a pop. Leave the nav's `Suspense` fallback alone: `NavList` and `NavLinks` render the same markup, so there is nothing to animate.
- `/projects`: the rows rise in turn (`.rise` with `animation-delay: calc(var(--i) * 40ms)`, `--i` inline, eight rows, under 0.4 s total) and carry the `view-transition-name` from §3.1. Keep the rows as `<a>`; they must stay full loads.
- The pocket console already waits 180 ms for the press to show before `router.push`; nothing to add there.
- Proof: `lib/motion.test.ts` gains a check that every `page.tsx` under `app/(site)` contains `<ViewTransition`, and the probe adds `/sign-in` and `/does-not-exist` to its reduced-motion routes.

### 3.3 The still instruments move (task 3)

All CSS, `from` keyframes only, the base style stays the resting pose, each project's reduced-motion block already switches it off (and the walks already grep for that block).

- **Barometer**: the needle's `swing` is extended to the other three instruments, staggered 0.15 s apart: the mercury column grows from the bulb (`transform: scaleY(0)` with `transform-origin` at `TUBE.bottom`, on the `rect.mercury[data-mercury]`), the vane swings from north (`.arrow` from `rotate(0)`), the water rises from empty (`scaleY(0)` from the cup's floor). 1.1 s ease-out, like the needle. The quiet face has every part at rest already, so its `from` equals its resting pose and nothing visibly moves; `[data-face="quiet"] .needle { animation: none }` keeps the needle from swinging to nowhere.
- **Planisphere**: the sky draws on once, in Orrery's grammar: the constellation lines (`[data-line]`, at least 80 polylines served) get `pathLength="1"` in `wheel.tsx` and draw with `stroke-dashoffset` 1 to 0 over 0.9 s; the stars (`[data-star]`, 400 to 932 circles) fade up as **one group** 0.4 s later (no per-star delay: 900 inline styles would cost about 20 KB against the walk's 400 KB page budget for nothing); names, the ecliptic, the Sun and the Moon fade up at 1.3 s. The disc's 0.4 s turn stays as it is. The draw-on runs once per document; the island repaints in place and never remounts the disc, so turning the wheel does not replay it (QA asserts that: `getAnimations()` on the disc after an ArrowRight shows only the `transform` transition). A city change navigates, so the new sky draws on under the crossfade from §3.1.
- **Rotor**: a stepped rotor window rolls: the window's `<text data-window>` is keyed on its letter so React remounts it, and `@keyframes roll { from { transform: translateY(0.35em); opacity: 0; } }` plays over 2 frames (`170ms steps(2)`), on twos like the key and the lamp. Under reduced motion the existing block stops it.
- Shore, Capsule, Orrery, Elements and Vinyl change nothing (Shore's glass is a live renderer; the others have their motion in the hand and a draw-on would fight it).
- Proof: a `motion.test.ts` in each of the three `_lib/` directories in the shape of Orrery's (reads the stylesheet and component as text: the keyframes exist, every rule is a `from`-only keyframe or a `transform` transition, the reduced-motion block is last and names `::view-transition-group(*)`); the probe adds the three routes with motion on (expects `swing` ×4, the Planisphere draw names, and after typing `A` on Rotor one `roll`) and off (0 running).

## 4. Plan shape

| Task | Role, QA | Touches | Interfaces (files, for the contract) |
| --- | --- | --- | --- |
| 1. Cross-document transitions, the motion probe, README Motion | software_engineer, QA required (the probe at 1366×768 and 390×844, motion on and off, one hop in each direction, the title morph looked at) | all nine stylesheets, `lib/motion.test.ts`, `scripts/probe-motion.mjs`, `scripts/probe-motion.sh`, `README.md`, `app/(site)/(app)/projects/page.tsx` (row names) | `app/(site)/globals.css`; `app/(shore)/shore.css`; `app/(capsule)/capsule.css`; `app/(orrery)/orrery.css`; `app/(elements)/elements.css`; `app/(vinyl)/vinyl.css`; `app/(rotor)/rotor.css`; `app/(planisphere)/planisphere.css`; `app/(barometer)/barometer.css`; `lib/motion.test.ts`; `scripts/probe-motion.mjs`; `scripts/probe-motion.sh` |
| 2. The site's pages | software_engineer, QA required (headless Chrome, signed-in and signed-out, the 404, the skeleton handoff, reduced motion) | eleven `page.tsx`, `loading.tsx`, `not-found.tsx`, `forbidden.tsx`, `projects/page.tsx`, `globals.css` (row stagger), `lib/motion.test.ts` | the files named |
| 3. The still instruments | software_engineer, QA required (motion on and off, JavaScript off, the walks still pass, Planisphere's turn does not replay the draw-on) | `barometer.css`, `station.tsx`, `planisphere.css`, `wheel.tsx`, `rotor.css`, `rotor-app.tsx`, three `motion.test.ts` | the files named |

Tasks 1 and 2 both edit `globals.css` and `projects/page.tsx`; tasks 1 and 3 both edit three project stylesheets; run them in order 1, 2, 3 or keep both sides on a rebase conflict (lesson iss-9). Sibling plans pm-203 and pm-204 may still land Planisphere and Barometer fixes on main. Verification lines per task, in the Rotor plan's form: `npm ci && npm run lint && npm run typecheck && npm test`, `npm run build`, `bash scripts/probe-motion.sh` (task 1, and extended in 2 and 3), the existing `walk-*.sh` for each stylesheet touched, `test "$(grep -l '@view-transition' app/\(site\)/globals.css app/\(*\)/*.css | grep -c .)" -eq 9` (task 1), `! grep -rn "framer-motion\|gsap\|lottie" package.json`, and `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`. Acceptance walks production: `BASE_URL=https://otohime.dev bash scripts/probe-motion.sh` plus the eight existing walks.

## 5. Decisions and non-goals

| Decision | Why |
| --- | --- |
| No motion library, no Vercel "view transitions" agent skill. CSS, React 19.3's `<ViewTransition>` and the browser's `@view-transition` only. | The house grammar covers every case here; four earlier researches declined libraries; the skill's patterns are the ones in Next's guide, which is in `node_modules`. |
| Cross-document crossfade with a title morph, not directional slides. | The site is flat (six pages, one sidebar) and a project is a different document; "forward / back" has no meaning across a full load. Slides are also the motion most likely to trouble a motion-sensitive visitor. |
| The rule is copied into nine stylesheets. | The isolation rule forbids a shared file across groups; the probe and `lib/motion.test.ts` keep the copies honest. |
| Planisphere's stars fade as one group. | Per-star delays cost about 20 KB of inline styles against the walk's 400 KB budget and read no better than a group fade after the lines. |
| Shore, Capsule, Orrery, Elements and Vinyl are untouched beyond the hop rule. | Their motion is already their point; a load-time draw-on would fight the hand-driven motion (Capsule's crank, Vinyl's platter). |
| Reduced-motion proof asserts durations, not counts. | Measured: the site shortens animations to 0.01 ms rather than removing them, so `getAnimations()` is non-empty under reduced motion on `/`. |
| Non-goals: a motion token file shared across groups; scroll-driven animations; Lottie or video; changing any project's existing timing; `transitionTypes` on the sidebar links. | Each is either forbidden by isolation, out of the idea's scope, or unproved in this run. |

## 6. Open points for the product owner

- The title morph (§3.1) is the one judgement call a human eye should make at QA: keep it if it reads as the row becoming the heading, drop the nine `view-transition-name` lines if it jitters. Either way the crossfade stays.
- If the owner's "motion" meant something specific (a particular page, a logo animation, a loading screen), the plan's task 2 is the place to add it; nothing in tasks 1 and 3 depends on it.
