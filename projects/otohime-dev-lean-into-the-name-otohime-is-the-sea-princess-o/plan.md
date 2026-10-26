# Otohime's Undersea Palace

Plan id: `pm-256`  
Run: `run-8686`  
Product: Otohime's Undersea Palace  
Idea: make otohime.dev lean into Otohime, the sea-princess of the Urashima Taro legend.

## Outcome

Deliver Ryugu-jo as a hidden, static experience on otohime.dev. Visitors can enter the undersea palace by typing `urashima`, using a Pocket link, or reaching the below-waterline footer sentinel. Its isolated layout sinks the paper site into an ink sea with water caustics, fleeing ink fish, and an opt-in ambient sound toggle. A Tamatebako time box replays the site's real git changelog as the paper yellows with age. This is an honest changelog replay, not a reconstruction of historic site snapshots.

The experience is usable by keyboard and touch, has a static fallback when WebGL is unavailable, pauses expensive animation when hidden, and respects reduced motion. Sound is off until explicitly enabled and is controlled in Pocket.

## Delivery parts

This plan delivers Part 1 only: Ryugu-jo, history indexing, Tamatebako, and sound. The estimate is four one-hour SWE tasks (the default p50 is one hour without 20 finished role samples), below the configured six-hour maximum. The one-hour tasks are sequenced by their dependencies; no task requires an operator or a dated event.

Part 2 is Ink ghosts, submitted as a successor idea with `after_plan_id=pm-256`, and will be drafted only after this plan is done. It will add an anonymous, ephemeral Cloudflare Durable Object fan-out behind a feature flag, with no persistence or PII, capped/throttled updates, a graceful offline fallback, reduced-motion behavior, and a Pocket hide toggle. It will be independently sized and contracted against the code that lands in Part 1.

## Task contracts — Part 1

### 1. Enter Ryugu-jo

- **Role:** software engineer
- **Problem:** the site has no hidden undersea destination, and the existing cartridge styling must not leak into the new scene.
- **Action items:** create an isolated palace route and layout; add keyboard, Pocket, and below-waterline entry points; implement water caustics with a static fallback; animate ink fish that flee pointer/tap input; pause when hidden and honor reduced motion; add focused unit/e2e coverage for all entry and fallback behaviors.
- **Interfaces:** `app/(ryugu)/`; `components/ryugu/`; `components/handheld.tsx`; `components/end-footer.tsx`.
- **Non-goals:** history replay, sound, realtime visitors, historical snapshots, new runtime services.
- **Verification:** `npm test`; `npm run lint`; `npm run build`.
- **Acceptance:** the palace is reachable through all three entry points, remains isolated from cartridge CSS, and its motion degrades safely without WebGL or under reduced motion.

### 2. Build the static history index

- **Role:** software engineer
- **Problem:** Tamatebako needs accurate, bounded git-history data without runtime git access.
- **Action items:** add a build-time history indexer that emits a compact, capped list of dated commits with subject, plan/task prefix, and changed-file summary; add deterministic tests and a `--check` mode; make shallow-clone or git-unavailable builds use the committed JSON fallback without failing.
- **Interfaces:** `scripts/history-index.ts`; `scripts/history-index.test.ts`; `content/history.json`; `package.json`.
- **Non-goals:** rendering snapshots from historical builds, runtime git access, unbounded history output.
- **Verification:** `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/history-index.test.ts`; `npm run build`.
- **Acceptance:** indexing is deterministic and bounded, `--check` detects stale data, and a shallow or unavailable git history still builds from the committed fallback.

### 3. Open Tamatebako

- **Role:** software engineer
- **Problem:** the palace has no time artifact connecting Otohime's legend to the actual history of otohime.dev.
- **Action items:** add a lacquered box interaction with a brief smoke reveal; build an accessible scrubber over the static history index; show real commit dates and subjects; map scrubber age to a faded yellow-paper treatment; cover keyboard, touch, reduced-motion, and empty-history behavior.
- **Interfaces:** `components/ryugu/tamatebako.tsx`; `app/(ryugu)/`; `content/history.json`.
- **Non-goals:** reconstructing old source trees or taking snapshots of prior builds.
- **Verification:** `npm test`; `npm run lint`; `npm run build`.
- **Acceptance:** opening the box reveals a scrubber whose positions show actual changelog entries and progressively aged paper, without claiming to render old site versions.

### 4. Add opt-in palace sound

- **Role:** software engineer
- **Problem:** ambient sound must be explicit, user-controlled, and compatible with browser autoplay rules.
- **Action items:** generate a quiet filtered-water ambience with Web Audio after a user gesture; keep it off by default; add a Pocket toggle and persisted preference; stop audio when disabled or the route is left; cover unsupported AudioContext and reduced-motion/accessibility expectations.
- **Interfaces:** `components/ryugu/ambience.tsx`; `components/handheld.tsx`; `app/(ryugu)/`.
- **Non-goals:** bundled audio assets, autoplay, sound on other routes, telemetry.
- **Verification:** `npm test`; `npm run lint`; `npm run build`.
- **Acceptance:** audio remains silent until enabled by the visitor, can be disabled from Pocket, and degrades without errors when Web Audio is unavailable.

## Product and privacy boundaries

- History is generated at build time and shipped as static JSON. Retain a committed fallback for shallow clones and source archives.
- The replay displays changelog entries and a stylized age treatment. It does not imply complete historical visual fidelity.
- Sound is generated locally, opt-in, and contains no network request.
- Ink ghosts are explicitly outside Part 1. Part 2 must not persist visitor positions or collect identity data.

## Verification and acceptance

Each SWE task has runnable verification commands in its build contract. User-visible tasks receive QA and plan acceptance; no task uses `qa: skip`. Acceptance checks the entry points on keyboard and touch, the no-WebGL/reduced-motion fallback, keyboard operation of the history scrubber, sound opt-in and Pocket disable behavior, plus a static production build. A live realtime backend check belongs only to the successor plan.

## Decisions

- **Stylized replay:** real historical builds are out of scope; the scrubber presents real commit metadata over an aged-paper treatment.
- **Entry points:** keyboard `urashima`, the Pocket menu, and a below-waterline footer sentinel make the secret discoverable across input modes.
- **Water and fish:** use an isolated route with an SVG/filter or shader treatment and a static fallback; keep fish animation local to the palace.
- **Sound:** generate ambience with Web Audio after a gesture, default off, and expose the preference in Pocket.
- **Plan split:** deliver the static experience first and file Ink ghosts as a chained project part; Cloudflare credentials are not needed in this part.

## Sources

- Research report `rep-5048`, preserved in [research.md](research.md).
- Inspiration links from the idea brief: [undersea portfolio](https://x.com/0xSagar_/status/2114562411520762337), [personal website discussion](https://x.com/zarazhangrui/status/2113148949842534482), [live cursors](https://x.com/Lucidly_so/status/2105395505408684076).
