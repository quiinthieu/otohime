# Hop and Settle: motion across the whole app (pm-206)

**Idea.** "Add motion to the app."

**Product.** Moving between the site and a project stops being a hard cut.
Click Shore on `/projects`: the list fades out in 150 ms, the word "Shore"
travels from its row to the project's heading, and the sea-glass page fades in.
Going back, or from Orrery's "Next door" to Planisphere, works the same way.
Inside the site, the signed-in rooms, the sign-in pages, the 404 and the
loading skeleton hand over the way `/work` and `/projects` already do, and the
rows on `/projects` rise one after another. Three projects that sat still now
settle into place when they load: all four of Barometer's instruments swing or
fill, Planisphere's constellations draw themselves on in ink before the stars
fade up, and Rotor's windows roll one letter at a time as you type. Under
`prefers-reduced-motion` all of it stops, and with JavaScript off, or in a
browser without View Transitions, every page is the same still drawing it is
today.

Research: [research.md](research.md) (run-6860, rep-3925), measured against
the repo at 65a91b2 with a throwaway build in headless Chromium. It holds the
house motion grammar (§1), the proof that the cross-document rule fires only
when both documents opt in (§2), the full design (§3) and the decisions (§5).
This plan repeats only what the contracts need, and records where it departs
from the research.

## Decisions

| Decision | Why |
| --- | --- |
| One plan, three build tasks, all with QA, run in order 1 → 2 → 3. | Tasks 1 and 2 both edit `globals.css` and `projects/page.tsx`, and tasks 1 and 3 both edit three project stylesheets. Running them in order means no rebase conflicts between them. On a conflict with another plan, keep both sides' lines (lesson iss-9). |
| CSS, React 19.3's `<ViewTransition>` and the browser's `@view-transition` only. No motion library, and nothing is added to `package.json`. | The house grammar (research §1) covers every case. Four earlier researches declined Framer Motion, GSAP and Lottie. |
| The cross-document rule is **copied** into all nine stylesheets. It is never imported. | The isolation tests forbid imports across route groups. `lib/motion.test.ts` and the probe check that the copies match. |
| Each project's reduced-motion block gains a rule for the `::view-transition-group/old/new(*)` pseudo-elements. | A project's `* { animation: none !important }` does not match pseudo-elements, so without this rule a reduced-motion visitor would still get the crossfade. |
| **Change from the research:** the row title on `/projects` gets its name through an inline custom property (`style={{ "--vt": "project-shore" }}`) and a `.project-title { view-transition-name: var(--vt); }` rule. `:root.theming .project-title { view-transition-name: none; }` sits next to the masthead's rule. | An inline `view-transition-name` would override the `:root.theming` reset. The theme's ink spread would then capture eight extra groups. The custom property keeps `content/site.ts` unchanged, as the research intended. |
| Each project's stylesheet names its `h1` `project-<slug>` (the slug is the href without the leading `/`). Today every project page renders exactly one `h1`. The probe asserts that each document has at most one element with that name. | A duplicate `view-transition-name` makes Chromium skip the whole transition, so a second `h1` added later must fail a check, not degrade quietly. |
| The title morph is kept. If QA finds it jitters between Inter and the hand fonts, task 1's fix is to remove the `.project-title` rule and the eight `h1` lines. The crossfade stays either way. | Research §6. Only a person looking can judge how it reads, and QA is that look. No task waits on it. |
| The masthead cuts and the nav pill fades out alone when you hop to a project. No transition `types` are used. | It reads as the chrome leaving first. Support for `types` on `@view-transition` outside Chromium is not proved. |
| **Change from the research:** `app/(site)/[...rest]/page.tsx` is exempt from "every site `page.tsx` has `<ViewTransition`". | It only calls `notFound()`. `app/(site)/not-found.tsx`, which it renders, carries the wrapper. |
| Planisphere's stars fade in as one group. Only the constellation lines draw on. | 900 per-star delays would add about 20 KB against the walk's 400 KB page budget, and would look no better. |
| Shore, Capsule, Orrery, Elements and Vinyl get only the hop rule and the `h1` name. | Their motion is in the hand (crank, platter, drag). A draw-on at load would fight it. |
| Reduced-motion checks assert that each animation's duration is ≤ 1 ms or that it has finished. They do not assert a count of zero. | Measured: the site shortens animations to 0.01 ms rather than removing them. |
| Probe port **4061**. Stop servers by process group, as the walks do. Never use `pkill -f "next start"`. The probe's negative check strips the rule from one stylesheet with Playwright's `page.route`, so it needs no second server. | Ports up to 4057 are taken by existing scripts. That `pkill` pattern kills the agent's own shell (lesson). |
| Commits are authored and committed as `Otohime <quiinthieu@gmail.com>`. | Vercel Hobby deploys only the owner's commits. |
| The standing-rules files named in the brief are not in this repo. `AGENTS.md` and the Rotor plan are the rules. | Checked at ed38914. Decision recorded. |

No task needs a person or a runtime. Every claim is proved inside the checkout
with a production build and a headless Chromium shell that the probe installs
into a temp prefix. Nothing waits on a clock.

## File tree

```
app/(site)/globals.css                 @view-transition, root fade, .project-title name (task 1); row stagger (task 2)
app/(name)/name.css  × 8               @view-transition, root fade, h1 name, pseudo-element reduced-motion rule (task 1)
app/(site)/(app)/projects/page.tsx     .project-title + --vt (task 1); --i stagger (task 2)
lib/motion.test.ts                     nine stylesheets opt in (task 1); every site page wraps (task 2)
scripts/probe-motion.sh · .mjs         hops, reduced motion, unique names (task 1); site pages (task 2); instruments (task 3)
README.md                              Motion section, probe line (task 1)
app/(site)/(app)/{dashboard,account,admin,admin/users,admin/users/[id],admin/roles}/page.tsx   (task 2)
app/(site)/(auth)/{sign-in,forgot-password,reset-password}/page.tsx                          (task 2)
app/(site)/not-found.tsx · app/(site)/(app)/forbidden.tsx · app/(site)/(app)/loading.tsx      (task 2)
app/(barometer)/barometer.css · _components/station.tsx · _lib/motion.test.ts                (task 3)
app/(planisphere)/planisphere.css · _components/wheel.tsx · _lib/motion.test.ts              (task 3)
app/(rotor)/rotor.css · _components/rotor-app.tsx · _lib/motion.test.ts                      (task 3)
```

## The rule every stylesheet carries

```css
/* The hop to or from another root layout (a project, the site) crossfades
   instead of cutting. Both documents must carry this rule. */
@view-transition { navigation: auto; }
::view-transition { pointer-events: none; }
::view-transition-old(root) { animation: 150ms ease-in both fade-out; }
::view-transition-new(root) { animation: 210ms ease-out 150ms both fade-in; }
@keyframes fade-out { to { opacity: 0; } }
@keyframes fade-in { from { opacity: 0; } }
h1 { view-transition-name: project-<slug>; }          /* projects only */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) {
    animation-duration: 0s !important; animation-delay: 0s !important;
  }
}
```

The site already has `::view-transition`, both keyframes and the reduced-motion
pseudo-element rule. It adds only `@view-transition`, the two `root` rules
(outside the `:root.theming` block, after it in the cascade but with lower
specificity, so the ink spread still wins while `.theming` is set) and the
`.project-title` rules. If a project already has a keyframe named `fade-in` or
`fade-out`, it keeps its own and uses `vt-fade-in` / `vt-fade-out` for this
rule.

## Tasks

### 1. Every hop between the site and a project crossfades, and a probe proves it

- **Role:** software_engineer. QA is required.
- **Problem:** The site and the eight projects are nine root layouts joined by
  plain `<a>` links. Every hop between them is a full document load, so the
  site's `<ViewTransition>` never runs and the page cuts. Nothing in the repo
  proves that any transition fires, or that reduced motion stops it.
- **Action items:**
  1. Read `AGENTS.md`, `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`
     and research §2–§3.1. Read `scripts/probe-planisphere-touch.sh` and
     `.mjs` for the probe's shape.
  2. Add the rule above to `app/(shore)/shore.css`, `app/(capsule)/capsule.css`,
     `app/(orrery)/orrery.css`, `app/(elements)/elements.css`,
     `app/(vinyl)/vinyl.css`, `app/(rotor)/rotor.css`,
     `app/(planisphere)/planisphere.css` and `app/(barometer)/barometer.css`.
     Each gets `h1 { view-transition-name: project-<slug>; }` and the
     pseudo-element rule inside (or next to) its existing reduced-motion
     block, which stays last in the file.
  3. In `app/(site)/globals.css`, add `@view-transition { navigation: auto; }`,
     the two `root` rules outside `:root.theming`,
     `.project-title { view-transition-name: var(--vt, none); }` and
     `:root.theming .project-title { view-transition-name: none; }`.
  4. In `app/(site)/(app)/projects/page.tsx`, give each linked row title
     `className="project-title"` and `style={{ "--vt": \`project-${href.slice(1)}\` }}`
     (typed as `CSSProperties`). Rows stay plain `<a>`. `content/site.ts` is
     unchanged.
  5. `lib/motion.test.ts` (it runs under the existing `lib/**/*.test.ts`
     glob). It finds the route groups with
     `readdirSync(join(ROOT, "app"))`, the way the isolation tests do, and
     reads each group's top-level stylesheet. It asserts: each of the nine
     contains `@view-transition` with `navigation: auto`. Each has a
     `prefers-reduced-motion` block that names `::view-transition-group(*)`.
     Each project names its `h1` `project-<slug>`, matching a `/projects`
     href in `content/site.ts`, and there are as many named groups as
     projects. The site's `::view-transition-old(root)` rule is not inside a
     `:root.theming` selector. It also asserts `fade-out` / `fade-in` (or
     their `vt-` names) are defined in the same file that uses them.
  6. `scripts/probe-motion.sh` and `scripts/probe-motion.mjs`, in the shape of
     the Planisphere touch probe. By default they build and start on port 4061.
     `SKIP_BUILD=1` reuses `.next`, and `BASE_URL` probes a deployed site.
     Playwright is installed into a temp prefix, `package.json` stays
     unchanged, the probe prints one `ok -` / `not ok -` line per check, and
     it exits non-zero if any check fails. The checks:
     - At 1366×768 and at 390×844 (isMobile, hasTouch), click the real link
       for `/projects` → each of the eight project hrefs, `/shore` →
       `/projects`, and `/orrery/sun` → `/planisphere` (the "Next door" link).
       `pageswap` and `pagereveal` listeners, added with `addInitScript`,
       must both report `event.viewTransition !== null`.
     - On each of these documents, at most one element has a computed
       `view-transition-name` that starts with `project-`.
     - With `emulateMedia({ reducedMotion: "reduce" })`, the same hops
       complete. Every `::view-transition` animation, and every animation the
       page has at `load`, has a duration ≤ 1 ms or has finished. Filter out
       UA names starting with `-ua-`, or wait for `getAnimations()` to settle
       (research §2).
     - No `console.error` and no `pageerror` on any route.
     - Negative check: in a fresh context, `page.route` rewrites the CSS
       chunks that `/shore` loads, removing `@view-transition { … }`. The
       `/projects` → `/shore` hop must then report
       `pagereveal.viewTransition === null`. This shows the probe can fail.
  7. README: add a short **Motion** section. It states the grammar from
     research §1 (twos at 12 fps, ink that draws on, the base style is the
     resting pose, the exit is fast and the enter gentle, one reduced-motion
     block per stylesheet, no library) and the rule that every new project's
     stylesheet copies the hop rule and names its `h1`. Add the probe's line
     next to the walks.
- **Interfaces:** `app/(site)/globals.css`; `app/(shore)/shore.css`;
  `app/(capsule)/capsule.css`; `app/(orrery)/orrery.css`;
  `app/(elements)/elements.css`; `app/(vinyl)/vinyl.css`; `app/(rotor)/rotor.css`;
  `app/(planisphere)/planisphere.css`; `app/(barometer)/barometer.css`;
  `app/(site)/(app)/projects/page.tsx`; `lib/motion.test.ts`;
  `scripts/probe-motion.sh`; `scripts/probe-motion.mjs`; `README.md`.
- **Non-goals:** wrapping more site pages (task 2); load-time motion in any
  project (task 3); directional slides; transition `types`; a shared motion
  file across groups; changing any link, route or `next.config.ts`; any new
  dependency.
- **Acceptance:** Every hop between `/projects` and a project, and between two
  projects, crossfades in Chromium with the title moving from its row to the
  heading. Under reduced motion the hop completes with no animation. The
  probe proves both, and fails when a stylesheet drops the rule.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `test "$(grep -l '@view-transition' 'app/(site)/globals.css' app/\(*\)/*.css | sort -u | grep -c .)" -eq 9`
  - `npm run build && SKIP_BUILD=1 bash scripts/probe-motion.sh`
  - `for w in shore capsule orrery elements vinyl rotor planisphere barometer; do SKIP_BUILD=1 bash scripts/walk-$w.sh || exit 1; done` (after the build)
  - `! grep -nE '"(framer-motion|gsap|lottie-web|motion)"' package.json`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 2. The rest of the site hands over, and /projects rises row by row

- **Role:** software_engineer. Depends on 1. QA is required.
- **Problem:** The signed-in rooms, the three auth pages, the 404, the
  forbidden page and the loading skeleton have no `<ViewTransition>`. Moving
  to or from them pops while the rest of the site fades, and the skeleton
  swaps to its page in a single frame. `/projects`, the door to every
  project, shows all its rows at once.
- **Action items:**
  1. Wrap the returned tree of each of these in
     `<ViewTransition enter="page-in" exit="page-out" default="none">`,
     imported from `react` the way `app/(site)/(app)/work/page.tsx` does:
     `app/(site)/(app)/dashboard/page.tsx`, `account/page.tsx`,
     `admin/page.tsx`, `admin/users/page.tsx`, `admin/users/[id]/page.tsx`,
     `admin/roles/page.tsx`, `app/(site)/(auth)/sign-in/page.tsx`,
     `forgot-password/page.tsx`, `reset-password/page.tsx`,
     `app/(site)/not-found.tsx` and `app/(site)/(app)/forbidden.tsx`. The
     wrapper goes in the page, never in a layout. A page that redirects or
     returns early keeps doing so before the wrapper.
  2. Wrap the skeleton in `app/(site)/(app)/loading.tsx` in
     `<ViewTransition exit="page-out" default="none">`. Leave the nav's
     `Suspense` fallback alone.
  3. On `/projects`, give each `<li>` the class `rise` with `style={{ "--i": index }}`.
     In `globals.css`, add `.rise[style*="--i"] { animation-delay: calc(var(--i) * 40ms); }`
     (or a dedicated `.rise-row` class), so that eight rows finish within
     0.4 s plus 7 × 40 ms. Keep task 1's `.project-title` and `--vt`, and keep
     the rows as `<a>`. The site's global reduced-motion rule already
     shortens the delay. Assert that in the probe, and add
     `animation-delay: 0s` to the rule if it does not.
  4. Extend `lib/motion.test.ts`: every `page.tsx` under `app/(site)`, and
     `not-found.tsx`, `forbidden.tsx` and `loading.tsx`, contains
     `<ViewTransition`, except `app/(site)/[...rest]/page.tsx` (it only calls
     `notFound()`; assert that it still does). No `layout.tsx` under
     `app/(site)` contains `<ViewTransition`.
  5. Extend `scripts/probe-motion.mjs`. A same-document click from `/work`
     to `/projects` runs the `page-out` and `page-in` animations (the
     `::view-transition-old(.page-out)` group shows up in `getAnimations()`).
     `/projects` at `load` has 8 row `rise` animations with increasing
     delays. `/sign-in` and `/does-not-exist` (404) load with no console
     error. Under reduced motion, every animation on `/projects`, `/sign-in`
     and `/does-not-exist` has a duration ≤ 1 ms or has finished, and the
     effective delay of every row is ≤ 1 ms.
- **Interfaces:** `app/(site)/(app)/dashboard/page.tsx`;
  `app/(site)/(app)/account/page.tsx`; `app/(site)/(app)/admin/page.tsx`;
  `app/(site)/(app)/admin/users/page.tsx`;
  `app/(site)/(app)/admin/users/[id]/page.tsx`;
  `app/(site)/(app)/admin/roles/page.tsx`;
  `app/(site)/(auth)/sign-in/page.tsx`;
  `app/(site)/(auth)/forgot-password/page.tsx`;
  `app/(site)/(auth)/reset-password/page.tsx`; `app/(site)/not-found.tsx`;
  `app/(site)/(app)/forbidden.tsx`; `app/(site)/(app)/loading.tsx`;
  `app/(site)/(app)/projects/page.tsx`; `app/(site)/globals.css`;
  `lib/motion.test.ts`; `scripts/probe-motion.mjs`.
- **Non-goals:** any change to the projects; the nav `Suspense` fallback; the
  pocket console's timing; new routes; `transitionTypes` on sidebar links;
  any change to what a page renders, apart from the wrapper and the row
  stagger.
- **Acceptance:** Every site page, including the 404, the forbidden page,
  the auth pages and the signed-in rooms, fades out and in like `/work`. The
  skeleton hands over to its page with the same fade. The rows on
  `/projects` rise one after another in under 0.7 s. Under reduced motion
  all of it is still.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `test "$(find 'app/(site)' \( -name page.tsx -o -name not-found.tsx -o -name forbidden.tsx -o -name loading.tsx \) -not -path '*rest]*' -exec grep -L '<ViewTransition' {} + | grep -c .)" -eq 0` (12 today)
  - `! grep -rln '<ViewTransition' --include=layout.tsx 'app/(site)'`
  - `npm run build && SKIP_BUILD=1 bash scripts/probe-motion.sh`
  - `SKIP_BUILD=1 bash scripts/walk-music.sh` (after the build)
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 3. Barometer settles, Planisphere's sky draws on, Rotor's windows roll

- **Role:** software_engineer. Depends on 1 and 2. QA is required.
- **Problem:** Three instruments are still when they load. On Barometer only
  the needle swings, while the mercury, the vane and the rain cup just
  appear. Planisphere has no load motion at all. Rotor's windows change
  letter in a single frame while the key and the lamp around them move on
  twos.
- **Action items:**
  1. Read research §3.3 and `app/(orrery)/_lib/motion.test.ts` (the shape of
     the three new tests: copy it, do not import it). Every new animation is a
     `from`-only keyframe, so the base style stays the resting pose.
  2. **Barometer** (`barometer.css`, `_components/station.tsx` only if a
     transform origin needs an attribute or class). Three animations at
     1.1 s ease-out, like the needle, staggered 0.15 s apart: the mercury
     column (`rect.mercury`) grows from the bulb (`scaleY(0)`,
     `transform-box: fill-box; transform-origin: bottom`), the vane's
     `.arrow` swings from `rotate(0)`, and the cup's water rises from
     `scaleY(0)` from the floor. Add
     `[data-face="quiet"] .needle, [data-face="quiet"] .mercury, … { animation: none; }`
     so the quiet face does not animate to nowhere.
  3. **Planisphere** (`planisphere.css`, `_components/wheel.tsx`). Give the
     constellation lines (`[data-line]`) `pathLength="1"`. They draw from
     `stroke-dasharray: 1; stroke-dashoffset: 1` to 0 over 0.9 s. The stars'
     group (`[data-star]`'s parent `<g>`) fades up from `opacity: 0` 0.4 s
     later. Names, the ecliptic, the Sun and the Moon fade up from 1.3 s. No
     per-star inline style. The disc's existing 0.4 s `transform` transition
     is unchanged. The draw-on must not replay when the wheel turns: the disc
     and its children are never remounted by the island (do not change keys).
  4. **Rotor** (`rotor.css`, `_components/rotor-app.tsx`). Key each
     `<text data-window>` on `${i}-${letter}` so React remounts it when the
     letter changes. Add
     `@keyframes roll { from { transform: translateY(0.35em); opacity: 0; } }`
     on `.window-letter`, `170ms steps(2)`, with `transform-box: fill-box`.
     The server render and the first paint must not roll (only a key press
     does): put the animation on `[data-rolled] .window-letter` and set
     `data-rolled` on `<g data-windows>` after the first press.
  5. Add `_lib/motion.test.ts` to `app/(barometer)/`, `app/(planisphere)/` and
     `app/(rotor)/`, each reading its own stylesheet and component as text.
     Each asserts: the new keyframes exist and every one of them has only a
     `from` step. The `prefers-reduced-motion` block is the last block in the
     file and names `::view-transition-group(*)` (from task 1) and
     `animation: none`. For Planisphere, `pathLength="1"` is on the line
     element and the star elements carry no `style=` with a delay. For Rotor,
     the window key includes the letter and `data-rolled` gates the
     animation. Each test stays self-contained (isolation rule).
  6. Extend `scripts/probe-motion.mjs`. With motion on, `/barometer` (Tokyo
     via its query) has 4 running animations named `swing` or the new names
     at `load`. `/planisphere` has the line draw and the star fade running.
     After an `ArrowRight` on the wheel, the disc's own animations are only
     the `transform` transition, and the line draw's `currentTime` did not
     restart. On `/rotor`, nothing named `roll` runs at `load`, and after
     pressing `A` exactly one `roll` runs. With reduced motion, none of these
     runs longer than 1 ms. With JavaScript disabled, each page still renders
     its resting pose: the mercury's computed transform at the end equals the
     transform with no animation, and the lines' `stroke-dashoffset` ends
     at 0.
- **Interfaces:** `app/(barometer)/barometer.css`;
  `app/(barometer)/_components/station.tsx`;
  `app/(barometer)/_lib/motion.test.ts`; `app/(planisphere)/planisphere.css`;
  `app/(planisphere)/_components/wheel.tsx`;
  `app/(planisphere)/_lib/motion.test.ts`; `app/(rotor)/rotor.css`;
  `app/(rotor)/_components/rotor-app.tsx`; `app/(rotor)/_lib/motion.test.ts`;
  `scripts/probe-motion.mjs`.
- **Non-goals:** Shore, Capsule, Orrery, Elements and Vinyl; per-star
  delays; changing the disc's turn, the needle's swing timing or Rotor's
  key and lamp frames; sound; any new client island or dependency.
- **Acceptance:** On load, Barometer's four instruments settle in turn,
  Planisphere's constellations draw on and the stars fade up, and Rotor's
  windows roll on twos as you type. Turning the wheel does not replay the
  draw-on. Reduced motion and JavaScript-off both show the finished drawing.
  The three walks still pass.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(barometer)/_lib/motion.test.ts' 'app/(planisphere)/_lib/motion.test.ts' 'app/(rotor)/_lib/motion.test.ts' lib/motion.test.ts`
  - `npm run build && SKIP_BUILD=1 bash scripts/probe-motion.sh`
  - `for w in barometer planisphere rotor; do SKIP_BUILD=1 bash scripts/walk-$w.sh || exit 1; done` (after the build)
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

## Acceptance (production)

`BASE_URL=https://otohime.dev bash scripts/probe-motion.sh` passes at the
delivered sha, and the nine existing walks pass with `BASE_URL` set. A person
at QA looks at the title morph once at each viewport. It is advisory: if it
looks wrong, the fallback in Decisions is applied, and nothing waits on that
look.
