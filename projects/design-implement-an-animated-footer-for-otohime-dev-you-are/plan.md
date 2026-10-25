# Internet Save Point

Execution plan for **pm-241**, product-owner run **run-8305**.
Plan folder: `projects/design-implement-an-animated-footer-for-otohime-dev-you-are/`.
Research: [research.md](research.md), restored verbatim from **rep-4794 / run-8297**.
Repository audit: **8b0d3fd**, based on research at **ad778f1**.
This document defines delivery work; the footer is not implemented by this planning commit.

## Product outcome

At the bottom of otohime.dev, visitors discover a small paper world at the edge
of the internet. The pocket console that welcomes them on the homepage has
become a friendly save point. Its LCD looks back, a lamp breathes, paper clouds
drift and a few data parcels slip over the edge. Nearby, ordinary HTML links
offer the next destination. Curiosity earns a small achievement.

The primary copy is **“You've reached the end of the internet.”**
The secondary copy is **“Thanks for stopping by. See you on the next level.”**
Keep both in `site.end`. Use a small honest status such as `SAVE POINT`;
do not claim the visitor saw all pages or that an authenticated site uses no cookies.

Success means the footer feels deliberately drawn for this website, works as
navigation without JavaScript, and remains enjoyable on keyboard and touch.
Motion supports the scene; links and copy carry its purpose.

## Audit and concept selection

The installed stack is Next.js **16.4.2**, React **19.3.0**, TypeScript,
Tailwind v4 in `app/(site)/globals.css`, system mono type and no animation
library. The code uses `Inked`, isometric `box` geometry, five swatches,
per-figure `--fig`, a 0–7 wobble slider and pure machine reducers stepping
at 12 fps. Light/dark paper and ink come from CSS variables and `data-theme`.

The product owner re-read the actual home/app layouts, homepage, handheld,
machine controls, figures, route list, site content, motion rules and CI.
Next's installed layout, caching and `cacheLife` guides were also read.
The research contains the fuller page and live-site audit.

| Concept | Originality and continuity | Usability | Complexity | Choice |
| --- | --- | --- | --- | --- |
| End of the Internet / console save point | Returns the entrance console as a character; strongest story and existing ink vocabulary | Links remain beside the drawing | Medium: SVG, small reducer, one client island | Selected |
| Save dialog | Familiar game-ending trope with a parcel mascot | Clearest compact text layout | Low | Less distinctive |
| Night shift at the rack | Strong data-engineering reference but repeats Work and favors a dark scene | Scene could overwhelm links | Medium | Less balanced across themes |

No image generation, new font, animation library or asset download is needed.
Draw the original environment in SVG/CSS with existing utilities.

## Composition and behavior

### Scene and typography

Use a restrained paper-edge divider and a max-width inner aligned with the
site's `max-w-5xl px-5 sm:px-8` rhythm. At desktop, put the miniature
scene beside the headline and link groups. On tablet/mobile, stack them with
a smaller scene and two readable link groups. Keep the headline near
`clamp(1.5rem, 4vw, 2.25rem)` in the existing mono face; captions use the
house uppercase style. Keep the footer in normal document flow, below main.

The illustration contains a small irregular ground slab, signpost, the familiar
isometric handheld with LCD eyes, a few stars/clouds and a sparse packet trail.
The signpost is decorative; the six destinations are normal text links.
Use the existing `fig-*` classes and swatch colors instead of a new palette.
Dark mode uses the site's existing paper/ink variables and the same scene.

Keep static line work in `Inked`. Put ambient clouds, stars, lamp, packet
and eye layers in a second aligned SVG or sibling layer outside its filtered
group; do not change the shared `Inked` API just to accommodate the footer.
If a static ink layer enters, animate its outer wrapper instead of repeatedly
painting the SVG turbulence filter. Decorative SVG is hidden from assistive
technology; the mascot has a native HTML button with a clear accessible name.

Use the existing swatch picker and labeled wobble range (default 3.5).
On small screens these controls remain available in a compact native disclosure.
The five accents recolor the figure; this is per-figure customization, not
an invented global accent setting. Do not modify other machines' state.

### Navigation, credits and boundaries

| Element | Required source / behavior |
| --- | --- |
| Work, Play, Notes, Music, Projects, Sketches | Map `CONSOLE_MENU` directly, in that order; no duplicate route array |
| Telegram, X, Spotify, Email | Map `site.lines`; preserve the switchboard's non-mail target/rel semantics; do not retype or fix owner handles |
| Credits | Small Otohime signature and concise website credit using existing type |
| Year | Async server helper/component with `"use cache"`, `cacheLife("days")` and UTC year; no bare clock read in an uncached prerender |
| Back to top | Real in-page anchor fallback plus focus on existing `main#main`; enhanced click scrolls to page start, smooth only when motion is permitted |
| Achievement | Hidden code reveals a polite message and small reserved-space badge; it is not a prerequisite to any link |

The daily year cache is request-revalidated, not a scheduled job. Around
New Year it may briefly serve the prior cached year until revalidation; the
`days` profile does not promise a five-minute upper bound. Check the
installed guide rather than copying the research's stale-window statement.

Add one `EndFooter` in each of:
- `app/(site)/(home)/layout.tsx`: after `</main>`, inside the existing
  `ViewTransition`.
- `app/(site)/(app)/layout.tsx`: after the sidebar/main grid, inside the
  existing `ViewTransition`.

This covers all seven public pages and the existing signed-in rooms without
touching their authorization. Preserve the masthead outside the wrapper and the
bare site root. Do not add the footer to auth, the global 404 or the eleven
independent project root documents. A “footer consistency” check refers to
these site pages, not to rewriting those intentionally isolated experiences.
The footer nav must have a distinct label, never `aria-label="Main"`;
the homepage's existing landmark expectation remains unchanged.

### Entrance and ambient motion

Render the complete resting scene and text by default. An IntersectionObserver
sets a once-per-mount `data-seen` marker when the stage enters view
(threshold around 0.2; observe a small enough target on mobile).
Keep current visibility separate from “has been seen” for keyboard and motion.

| Approximate moment | Visible effect |
| --- | --- |
| 0–400 ms | Ground and sign settle from a few pixels using the house easing |
| 80–480 ms | Console ink reveals with a short stepped/draw effect |
| 200–900 ms | Heading reveals through stepped clipping; no changing text or width |
| 300–600 ms | Supporting copy and links rise gently |
| After entry, while visible | Slow clouds, subtle lamp breath, sparse stars/packets |

These timings are an art direction, not an excuse to exceed the existing
400 ms non-drawing motion rule. Keep the whole entrance restrained; the text
remains accessible during it. Use transform/opacity for movement and reuse
`rise`, `print`, `blink`, `breathe` where suitable. No parallax.
Keep the reduced-motion reset last in the stylesheet and add no new
`view-transition-name` that would split the existing theme transition.

Pause ambient layers outside the viewport and when the document is hidden.
Below 40rem, suppress clouds/packet motion and pointer following while keeping
the mascot response, stars and essential content. Avoid a permanent JavaScript
animation loop: a busy press uses the existing short 12 fps clock and pointer
tracking schedules at most one pending rAF for actual pointer events.

Subscribe to reduced-motion preference changes. With reduced motion, show the
complete still scene immediately, skip entrances, settle presses and reset eyes;
the full mascot/readout/achievement interactions remain functional.

### Mascot and Easter egg

The console's native button reacts to hover, click, tap, Enter and Space.
Desktop eyes may look toward the pointer by at most a few SVG units, only
with fine/hover input and motion allowed. Reset on leave. Pokes show a two-tick
button press and cycle witty short messages, with an extra tenth-poke line.
Use an `aria-live="polite"` HTML readout in reserved space for full sentences.

The existing LCD's content is only 64 units wide. Do not assume the research's
18-character/8.5px estimate fits. Measure actual SVG text bounds in the browser;
use short rows or wrapped short phrases, and leave the full achievement/message
in HTML. Never squeeze long copy into tiny unreadable text. Do not present
“7/7 pages” as tracked progress; any page count must be derived from
`PUBLIC_PAGES.length` and honestly labeled.

While the footer is visible, the sequence
`↑ ↑ ↓ ↓ ← → ← → B A` unlocks “Reached the end”.
The reducer handles case normalization, correct prefix overlap and wrong keys.
Ignore editable targets (including contenteditable descendants), modifier
shortcuts, repeated/handled events. Do not prevent normal browser key defaults.
Reset partial progress on leaving, and detach inactive listeners. No A-to-home
shortcut: it conflicts with the final code key and adds accidental navigation.

Store only `end:achievement = "1"` after hydration. Use a hydration-safe
external-store pattern or equivalent; never read localStorage during server
render. Treat storage read/write failures as an ephemeral achievement, with
no error or broken interaction. Reserve the badge footprint so restoration
cannot shift layout. No analytics, sound, confetti storm or network call.

## Contract DAG

Two software-engineer tasks: **1 → 2**. Both require independent QA because
both can change the visible footer. Task 1 ships a complete feature with
structural/HTTP evidence. Task 2 adds actual-browser regression proof, final
visual refinement, documentation and CI coverage. Neither depends on a
person-only prerequisite. The platform handles task scheduling after proposal;
this product-owner run does not claim or implement SWE tasks.

Every judgment call is recorded through `plan_manager_record_decision`;
record surprises as `kind=lesson`. Commit subjects start
`pm-241/<actual task_id>:`. Product-owner commits use
`pm-241/product_owner:`. Author and committer are
`Otohime <quiinthieu@gmail.com>`. Run checks, commit, then
`git push origin HEAD`; on non-fast-forward, rebase, rerun checks and push,
without force. Engineers stop at the push; QA/acceptance obtain deployed evidence.


### 1. Build the console save-point footer

- **Role:** software_engineer; **QA:** required.
- **Depends on:** none.

**Problem.** The seven site pages end without a footer, navigation recap or memorable closing interaction. Build a complete miniature console save point that extends the existing ink-and-paper world while preserving site navigation, layout transitions, accessibility and isolated project roots.

**Action items**

1. Read AGENTS.md, this plan and research.md, plus the installed Next.js layout, caching and cacheLife guides before writing code. Inspect current homepage, Work, Music, Projects and Sketches components and existing machine controls; use the current repo as the source of truth.
2. Add footer copy under site.end and a pure lib/end.ts reducer with focused node:test coverage for poke cycles, two-tick press/settle, Konami prefix overlap, wrong keys, upper/lowercase B/A, restoration and repeated unlock. Pass copy/line counts into the engine as needed; do not import browser APIs into it.
3. Create components/end-footer.tsx (server semantic footer, heading, ordinary links, credits and cached UTC year) and components/end-stage.tsx (small client interaction island). Compose an original miniature paper edge, signpost and familiar console mascot using existing box/Inked/LCD utilities; keep all ambient and eye animation layers outside the SVG filter.
4. Integrate exactly one footer after main in the home layout and after the sidebar/main grid in the app layout, inside each existing ViewTransition. Keep the masthead and root wrapper conventions, separate projects, auth, global 404 and gated-page authorization intact. Extend lib/motion.test.ts to pin this placement.
5. Render the six links directly from CONSOLE_MENU and the four contact destinations from site.lines with the switchboard's external-link semantics. Keep the heading, essential links, credits, year and still scene available in server HTML without JavaScript.
6. Implement once-per-mount scroll entrance with IntersectionObserver, short transform/opacity reveals and stepped title reveal. Animate only living ambient details; pause ambient motion while offscreen or the document is hidden. Reserve geometry so revealing, readout updates and achievement restoration do not shift layout.
7. Implement an accessible native mascot button with hover/tap response, bounded desktop pointer-follow eyes and polite fixed-size HTML readout. Use the existing 12-fps-on-twos approach only while a press is busy; use event-driven bounded rAF only for pointer movement. Respect reduced motion on initial load and preference changes; reset eyes and settle active presses immediately.
8. Implement the in-view Konami achievement without preventing normal key defaults or navigating on A. Ignore editable fields, modifiers, repeats and already-handled events; clear incomplete progress on leaving. Persist only a harmless achievement flag after hydration, tolerate blocked storage, and keep the complete message outside the small LCD. Provide the mascot's normal interaction on touch.
9. Reuse all five swatches and the wobble range (0-7, default 3.5) with labels and unique IDs. Use a compact accessible disclosure for mobile controls; simplify clouds/packet decoration below 40rem. Give all links and buttons visible keyboard focus and usable touch targets. Use theme variables and existing system typefaces without new assets, network requests or runtime dependencies.
10. Make Back to top both scroll to the page start and focus the existing main landmark, with smooth motion only when permitted and a working anchor fallback. Confirm the actual anchor geometry; #main alone may start below the masthead.
11. Add scripts/walk-end.sh using the existing local-build/BASE_URL/SKIP_BUILD/PORT/EXPECT_SHA conventions, default local port 4081, cleanup and bounded readiness. Check actual HTML structure/counts and source-derived hrefs, not repeated RSC text. Exercise all seven public pages, auth and global 404, plus isolation of the eleven independent project roots. Validate local page errors and exact build identity when EXPECT_SHA is supplied.
12. Run the contract verification, review a desktop and mobile rendering for obvious clipping and spacing, fix failures, then commit and push with the owner identity and pm-241/<task_id>: imperative subject. Record judgment calls and any surprises; delivery stops at the push.

**Interfaces (repository paths)**

- `content/site.ts`
- `lib/end.ts`
- `lib/end.test.ts`
- `components/end-footer.tsx`
- `components/end-stage.tsx`
- `app/(site)/(home)/layout.tsx`
- `app/(site)/(app)/layout.tsx`
- `app/(site)/globals.css`
- `lib/motion.test.ts`
- `scripts/walk-end.sh`
- `components/switchboard.tsx`

**Non-goals**

- Changing the site's route destinations, owner handles, authorization, project-root layouts, authentication pages or global 404 composition.
- Adding a motion library, custom font, image generation, analytics, real visited-page tracking, network service or scheduled job.
- Changing the public API of Inked, box, Machine or the homepage handheld; a switchboard helper export is optional.
- The optional A-to-home shortcut or hiding essential navigation inside SVG.

**Acceptance criteria.** Every public site page and app-layout room ends with one semantic footer after main, inside the existing group transition. It presents the two requested sentences, six canonical page links, four canonical contact links, credits, cached current UTC year and working Back to top. The original console save-point scene visibly matches the site's ink style, responds to mascot activation, supports all swatches and wobble on desktop/mobile, reveals on entry and rewards the in-view Konami sequence. Keyboard, no-JS, blocked storage, both themes and reduced motion retain readable content and normal navigation. No footer appears in separate project roots, auth or global 404. Production build, unit/structural checks and HTTP walk pass with no new runtime dependency.

**Verification** (each runs inside the delivery checkout; `cwd=.`; all expect exit 0)

| Name | Command | Timeout |
| --- | --- | --- |
| Unit and layout invariants | `npm test` | 300s |
| Lint | `npm run lint` | 300s |
| Next-generated types | `npm run typecheck` | 300s |
| Production prerender including cached year | `npm run build` | 900s |
| Local footer HTML and route isolation | `SKIP_BUILD=1 PORT=4081 bash scripts/walk-end.sh` | 300s |

### 2. Prove footer interactions and polish the scene

- **Role:** software_engineer; **QA:** required.
- **Depends on:** 1.

**Problem.** HTTP and reducer checks cannot prove the visible SVG fit, focus behavior, motion, hydration or cross-page scene consistency. Add repeatable browser coverage against the real production build, prove the checks catch a broken footer and refine the finished design from actual desktop/mobile evidence.

**Action items**

1. Inspect task 1's delivered footer, contracts and current test/CI conventions. Read relevant installed Next.js guides before any component/layout change. Reuse rather than duplicate its reducer, copy, routes and scene.
2. Create scripts/probe-end.sh and scripts/probe-end.mjs using a temporary pinned Playwright installation like probe-motion.sh; support local production build, BASE_URL, SKIP_BUILD, PORT and EXPECT_SHA, default local port 4083, bounded readiness and cleanup. Do not add runtime dependencies or write browser artifacts/binaries into git.
3. Exercise the browser verification matrix in plan.md against real rendered DOM at 1366x768, 768x1024 and 390x844 with a touch mobile context. Check all seven public pages for a single footer below main and use /, /work, /music and /projects for detailed layout/interaction checks.
4. Assert source-derived footer hrefs and click internal navigation normally, including footer return links from Work and Projects, to verify group transitions and absence of duplicate footers. Keep /music's television and its existing clear area unobscured. Verify no horizontal overflow and stable reserved scene/readout/badge geometry before and after reveal, poke and persisted restore.
5. Measure LCD text with actual SVG bounds against the LCD content rectangle in every displayed state, including achievement and the tenth poke. Split or shorten display rows instead of squeezing unreadable text; preserve the full HTML readout. Check theme colors/contrast, five accent choices, the actual displacement scale and keyboard access to the mobile customization disclosure.
6. Exercise scroll entry once, after-route visibility, offscreen/document-hidden pause, ambient layers outside filters and reduced-motion activation both initially and during a press. Check the eyes stay still under reduced motion and touch, move only within bounds on desktop, and no endless JS timer/rAF runs while idle.
7. Drive mascot click, tap, Enter and Space; correct Konami, a wrong sequence, editable-target exclusion, modifier/repeat exclusion, inactive-footer exclusion, persistence across reload, blocked localStorage and no hydration error. Verify keys preserve defaults and that the final A does not navigate away.
8. Walk real Tab order for the mascot, customization controls, six links, four contact lines and Back to top with visible focus. Confirm Back to top reaches scrollY near zero and focuses #main. With JavaScript disabled, verify the complete still scene, heading, essential links, credits, year and top anchor.
9. Add a local-only negative control via browser interception or in-memory DOM mutation: make a canonical footer href incorrect and demonstrate the same href assertion fails before restoring/reloading and passing. Do not alter deployed content; remote BASE_URL mode must remain read-only.
10. Review rendered screenshots locally for composition, spacing, easing, ink quality and light/dark legibility, then fix issues within the footer scope. Add README explanation and test commands. Wire the lightweight footer walk and browser probe into the existing checks job against its local production server without changing deploy/migration semantics or relying on a live public site.
11. Run the listed checks including existing motion regressions and isolated RBAC/session e2e. Record exact commit/build identities, browser version, observed results, negative control and remaining limits. Keep visual evidence out of git; commit all source/doc changes and push with pm-241/<task_id>: and the owner identity.

**Interfaces (repository paths)**

- `scripts/probe-end.sh`
- `scripts/probe-end.mjs`
- `scripts/walk-end.sh`
- `.github/workflows/ci.yml`
- `README.md`
- `components/end-footer.tsx`
- `components/end-stage.tsx`
- `content/site.ts`
- `lib/end.ts`
- `lib/end.test.ts`
- `lib/motion.test.ts`
- `app/(site)/globals.css`
- `app/(site)/(home)/layout.tsx`
- `app/(site)/(app)/layout.tsx`

**Non-goals**

- Replacing existing motion/RBAC probes or rewriting unrelated site components.
- Changing production content or shared infrastructure from verification commands.
- Adding generic browser tooling to package.json or checking screenshots/video/binaries into git.
- Claiming browser coverage on Firefox/Safari without actually running them.

**Acceptance criteria.** Checkout-local production build, unit/lint/type checks, footer HTTP walk, footer Chromium matrix with a demonstrated failing negative control, existing motion probe and isolated e2e all pass. The checks job runs the new footer checks on its local production server. Desktop, tablet and touch mobile show a coherent, unclipped footer in both themes and every accent; keyboard focus, no-JS links, LCD text fit, reduced motion, blocked storage, mascot and Konami persistence behave as specified. Motion uses bounded event-driven work, ambient animations stay outside the SVG filter and pause when inactive, and no reveal or readout shifts layout. README documents the concept and repeatable checks; final visual polish is delivered in source and independently reviewed by QA.

**Verification** (each runs inside the delivery checkout; `cwd=.`; all expect exit 0)

| Name | Command | Timeout |
| --- | --- | --- |
| Unit and layout regressions | `npm test` | 300s |
| Lint | `npm run lint` | 300s |
| Typecheck | `npm run typecheck` | 300s |
| Production build | `npm run build` | 900s |
| Footer HTML and isolation | `SKIP_BUILD=1 PORT=4081 bash scripts/walk-end.sh` | 300s |
| Footer Chromium matrix and negative control | `SKIP_BUILD=1 PORT=4083 bash scripts/probe-end.sh` | 900s |
| Existing motion and project hops | `SKIP_BUILD=1 bash scripts/probe-motion.sh` | 900s |
| Isolated RBAC and session e2e | `SKIP_BUILD=1 APP_PORT=4085 bash scripts/e2e-local.sh` | 900s |

## Browser verification and independent review

The new probe must test real production-rendered DOM. It may use isolated
browser contexts and DOM/interception negative controls locally, but cannot
mutate a deployed application or shared infrastructure. Existing project hops,
session/RBAC checks and motion probes remain required regression evidence.

| Area | On-demand proof |
| --- | --- |
| All routes | Every public site route has one footer after main; canonical hrefs and exact build stamp; auth/404 and each separate project remain footer-free |
| Responsive scene | 1366×768 desktop, 768×1024 tablet, 390×844 touch; no overflow, clipping or overlap on Home/Work/Music/Projects; Music television clear area survives |
| Layout stability | Compare reserved footer/stage/readout/badge geometry before entry, after reveal, after poke and after persisted restore; tolerate ≤1 CSS pixel rounding |
| Readability | Both themes, five accents, visible focus; LCD `getBBox` / `getComputedTextLength` bounds for every message; no truncated heading or essential text |
| Entrance | Scroll scene into view, see one short entrance, leave/reenter without replay; route group changes still transition correctly |
| Mascot | Pointer, tap, Enter and Space change LCD and live readout; press settles; desktop eyes remain bounded and touch eyes stay still |
| Achievement | Fresh storage, wrong sequence, then correct sequence; result/readout, badge and storage; reload restoration and denied-storage fallback |
| Key exclusions | Code sent into editable fields, with modifiers/repeats, or with footer inactive does not unlock; normal page scrolling/navigation survives |
| Reduced motion | Initial reduced-motion context and preference toggled mid-press show still scene, settled press and stationary eyes; CSS animations ≤1 ms or finished |
| Efficiency | Ambient animated targets have no SVG-filter ancestor; idle has no active JS animation loop, offscreen/hidden loops are paused |
| Keyboard | Actual Tab progression reaches all footer controls/links with visible focus and no trap; top action gives `main#main` focus and scrollY near 0 |
| No JavaScript | Heading, normal links, credits, cached year, complete still illustration and anchor fallback work |
| Errors | No hydration, page or console error attributable to the footer; no new footer network request |
| Harness negative control | Locally corrupt one canonical href and demonstrate the same assertion fails, then restore/reload and pass; explicitly report detection |

QA must obtain independent evidence beyond these author-supplied scripts:
inspect the delivered source at the green-gate SHA and directly drive a fresh
browser walkthrough of Home → footer → Work → footer → Projects, mobile
customization, both themes, reduced motion and Back to top. Exercise a relevant
negative control independently (for example a fresh context typing the code
into an editable field must keep the achievement locked, followed by a real
in-view sequence that unlocks). Capture observable before/action/after
evidence, not merely screenshots of test output.

Acceptance independently visits the deployed build after CI, reads the
`build-sha` meta and correlates it to the exact delivered code/lock/config
fingerprint. Run read-only public route and browser checks against that URL
and directly inspect the small-world visual quality on Home, Work, Music and
Projects. For signed-in rooms, use the existing isolated test accounts and
local auth e2e/CI evidence; do not require a human sign-in or mutate production
accounts. Independently confirm footer layout inheritance in the delivered app
layout.

Record the matrix as **starting state · action · observable result · evidence**.
Report checked SHA/build/browser, source/CI/live evidence and limits. Distinguish
“implementation pushed,” “CI passed,” “deployed integration observed” and
“product walkthrough passed.” A production meta stamp alone does not prove
interactions. This feature needs no capacity queue, model execution, scheduled
digest or soak; do not add waiting-based acceptance.

If a CI/deploy is not ready, inspect its actual state once and report exact run
URL/id and missing evidence through the platform's pending mechanism. Do not
create a polling task, natural-run criterion or speculative operator gate.
A person-only chore, if actually encountered, is raised at the start of the
task needing it via stable-fingerprint `operator_action`, and that run ends.
Use current platform rules for pending/watch, not a task step saying to wait.

## Delivery and evidence inventory

Expected production source:
- `components/end-footer.tsx`, `components/end-stage.tsx`,
  `lib/end.ts`, `lib/end.test.ts`.
- `content/site.ts`, the two site group layouts,
  `app/(site)/globals.css`, `lib/motion.test.ts`.
- `scripts/walk-end.sh`, `scripts/probe-end.sh`,
  `scripts/probe-end.mjs`, `README.md`,
  `.github/workflows/ci.yml`; optional tiny export in
  `components/switchboard.tsx`.

No binary assets, secret material, dependency churn or generated build output
belong in the commits. Browser screenshots can be inspected locally or attached
through supported report artifacts; they are not git deliverables. Preserve
concurrent portrait-plan changes to `content/site.ts` and other shared files
when rebasing.

Planning artifacts are this document and the verbatim research report. The
summary report records the proposal result, commit SHA, branch, test results
and observed CI state. It must not claim that this planning run implemented or
visually verified the footer.

## Known limits and standing-rule gap

- The requested `projects/20260921222547_plan_manager_chief_of_staff_extraction.md`
  and `docs/claude/software-development.md` are absent in this checkout and
  workspace search. This is recorded as a lesson. Do not invent or copy standing
  rules into a new AGENTS file. Follow the supplied role contract, actual
  `AGENTS.md`, README, installed Next docs and CI.
- Research at ad778f1 is evidence for the starting point; later engineers must
  inspect the current checkout and preserve unrelated changes. Its draft LCD
  width, year freshness, mobile-hidden controls, page-completion copy and
  optional A navigation are superseded by this plan.
- Browser automation promises Chromium here. Safari/Firefox support is designed
  through native semantic fallbacks but cannot be called tested without runs.
- Ambient smoothness requires a direct browser/profile inspection; a passing
  reducer or fake cannot prove rendering performance.
- This product-owner run uses the actual run record: profile
  `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`,
  fleet worker `avietidol-z490`. That is planning provenance, not a claim
  about future engineer model choices.
