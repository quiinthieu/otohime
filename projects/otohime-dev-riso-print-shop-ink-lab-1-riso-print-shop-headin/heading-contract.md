# Riso heading contract

Task: pm-268/t-1601. The shared string renderer supplies the main site's heading plates and the future Ink Lab proof sheet. Exhibit typography remains in its own root layouts.

```tsx
// Own a new semantic heading (h2 by default).
<RisoHeading as="h1" id="proof-title">Ink Lab</RisoHeading>
// Keep an existing heading, link, prefix or rich-text structure.
<h2 id="sample"><RisoText plates={2}>A printed sample</RisoText></h2>
```

`RisoHeadingProps` and `RisoTextProps` live in `lib/riso-heading.ts`. Children are strings; never flatten rich React children into a string. `FigTitle` enhances string children and preserves rich children as supplied. For a rich heading, put `RisoText` around its string portions and retain links, emphasis and other semantic owners. Neither component adds a heading inside an existing heading. Existing ids, heading levels and `aria-labelledby` targets stay on the original h1/h2. Decorative Fig. prefixes remain `aria-hidden`.

Every text instance has one uninterrupted `.riso-source` string. It supplies the accessible heading name. It is transparent, positioned in the text box and excluded from selection; opacity retains its accessible name and Range geometry. The visible `.riso-visual` is `aria-hidden`. Its grapheme anchors alone are selectable. Ghost plates are unselectable, pointer-transparent CSS pseudo-elements, so copying the heading yields one string. Do not read a heading's combined `textContent` for a source value; use its `.riso-source` or the original prop.

`Intl.Segmenter` splits graphemes, preserving combining accents, flags, skin tones and joined emoji. Whitespace stays as text. Words retain their usual wrap opportunities; an oversized word can break across graphemes. Empty strings create no plates. Pure offsets depend only on the full source and grapheme index: each ghost axis settles at signed 1–2px, without random numbers, timestamps, DOM ids or measurements. Stagger caps at 240ms regardless of title length.

The anchor inherits readable current ink. Ghosts use `--ap-plate-2` and `--ap-plate-3`; `--ap-plate-count` controls the third plate's visibility (2 or 3). Optional `plates` scopes the count to a preview without changing the site. The runtime supplies these tokens for presets and applied Lab settings; house fallbacks are pink and mint. A visitor-selected decorative plate color never replaces the readable anchor. Blending is normal, including on dark paper.

Server markup is visible and settled, with no animation attribute. After hydration a single shared IntersectionObserver registers mounted text instances and starts each once on intersection. Entry affects transform/opacity only, using `--ap-transition` for duration. Leaving and reentering the viewport does not replay it. Reduced motion, forced colors and print remove ghosts and movement and keep the readable anchors. Entering a static mode settles mounted text permanently; leaving it does not replay entry. The final unmount disconnects the observer and removes media/print listeners. No seed clock or animation frame loop is introduced.

`TitleMorph` continues to wrap exactly the outer h1. Console `title-*` transition names and page transitions are unchanged; character spans have no transition names. Cached hidden routes can contain non-rendered named elements, so browser duplicate checks inspect rendered boxes. Page and console errors remain a separate guard.

`StampHeading` uses `sourceClassName="stamp-text"` on the plain semantic source. Its first child stays one text node, preserving StampBoard's existing Range measurement and four Play blocks. Ghost content never enters `.stamp-text`. While stamped, the visual layer hides with the heading's existing `data-stamped` state; the accessible name stays present. Long press, pointer cancellation, Stamp it, keyboard drop, Tidy and focus return continue through the existing island and board.

Verification covers helper edge cases, the full project unit suite, typecheck, lint, and production-browser accessible names, copying, actual ghost transforms/counts, one-shot intersection, static media, no JavaScript, mobile headings, console A → Work and Play stamp/drop/tidy. The empty/Unicode/long preview fixture renders the actual shared TSX component through React server rendering and uses its actual CSS; it proves SSR layout, while public-route tests separately exercise real hydration and the observer. It is not an independent deployed QA result.

Run the browser contract through `node --experimental-strip-types scripts/e2e.mjs --test e2e/riso-headings.test.ts` after `npm ci` (including dependency lifecycle scripts). Fresh runs remove `.next` before compiling, preventing stale Turbopack font import maps from entering the build. `SKIP_BUILD=1` deliberately preserves an existing build and must only be used when its executable identity is known. `scripts/e2e-build.test.mjs`, included in `npm test`, executes the actual runner in a temporary fixture: a stale-output compiler control fails if cleanup is removed, while build reuse preserves the existing output and executes the suite. Its database/compiler/server stand-ins prove lifecycle orchestration only; the real production-browser command proves Next, embedded Postgres, assets and Chrome execution.

The required unit suite also runs on the gate's Node 22.12.0. Its main-lane controls compile extracted TypeScript fixtures with the existing locked `typescript` dependency, as the Riso browser preview does. They do not depend on the newer `node:module` stripping API; all clock, layout and disabled-ghost negative controls still execute.

## Route hydration and imperative paper overlays (pm-268/t-1678)

`load`, an idle callback, a frame and a position after `{children}` do not establish React hydration completion. The site root now places KameLoader and TactileLoader after its route children, and both wait for explicit host acknowledgements before arming their existing load/idle policies. Companion and PaperLayer repeat the guard at the actual DOM-consumer boundary, including cached renderer chunks on navigation.

`PaperHost` renders the same native `div` or `li` with its existing attributes and server-rendered children. It adds only `data-paper-host` in SSR. Its effect acknowledges that particular DOM identity in `lib/paper-hydration.ts` and exposes `data-paper-hydrated="true"`; cleanup revokes it. The registry's WeakSet, not a server attribute, grants permission. Cartridge roots inside DarumaBoard, Notes entries, footer Lines wrappers and `#kame-shell` use this host. An unhydrated card therefore blocks early footer portals and sticker insertion too. This is a boundary for these explicit mutation targets, not a claim that unrelated streamed navigation/account content has hydrated.

```mermaid
sequenceDiagram
  participant React
  participant Hosts as Route paper hosts
  participant Gate as Hydration registry
  participant Loaders as Kame/Tactile loaders
  participant Overlays as Companion/PaperLayer
  React->>Hosts: Hydrate and commit owning subtree
  Hosts->>Gate: Effect acknowledges each rendered DOM identity
  Gate->>Loaders: All current rendered hosts committed
  Loaders->>Overlays: Document loaded + idle, or explicit Save-Data enable
  Overlays->>Gate: Recheck before attaching DOM
  Overlays->>Hosts: Portal controls; attach paper tools/sticker
```

Next retains previous routes in hidden Activity trees and disconnects their effects. Readiness and discovery consider hosts with rendered layout boxes; cached hidden hosts cannot deadlock the active route or receive paper mutations. Restoring a hidden route requires its own new effect acknowledgement. When Daruma replaces its cards without changing the URL, PaperLayer waits for the replacement hosts to commit, cancels the previous gestures/listeners and reattaches once using the existing route session. `pagehide` cancels pending work and removes tools; `pageshow` rechecks hosts before restoring them. Navigation/unmount cancels the gate, idle callback, frames and imperative lifecycle.

The Kame browser `ready()` handshake waits for rendered host acknowledgements, initialized Riso text and the actual companion controls before a fake-clock advance, including reloads. It does not substitute elapsed host time for browser time. The original nine Kame cases and their frozen-clock negative control remain. Additional browser cases exercise three `/projects` loads in each of real/fake time, paper peel/reset, Daruma replacement, Notes navigation and a mutation audit. A held real Daruma module deliberately delays hydration while root-loader gate subscriptions are observed: an early synthetic load and 46-second clock jump must produce zero overlays; releasing the module must attach exactly one companion and sticker without any pageerror. No React error is suppressed or filtered.

The dedicated `lib/paper-hydration.test.ts` covers all-host acknowledgement, empty streaming content, revoked/replaced DOM identities, cancellation, one-shot activation and hidden-route reactivation. These use object identities as a unit fake; real React hydration, imports, production assets, Postgres and browser interactions are exercised by E2E. Run both named suites plus the surrounding paper/Daruma regressions:

```sh
node --experimental-strip-types --test lib/riso-heading.test.ts lib/paper-hydration.test.ts
node --experimental-strip-types scripts/e2e.mjs --test e2e/riso-headings.test.ts e2e/kame.test.ts e2e/tactile-tear.test.ts e2e/kame-fetch.test.ts e2e/daruma.test.ts
```

Keep TAP named tests, nonzero pass counts and zero failures/skips as behavioral evidence. Typecheck and lint separately validate static types and rules; their exit status does not prove visitor behavior. The platform still owns exact-delivery CI, deployment and independent QA after the engineer's push.
