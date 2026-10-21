# Design system: a drawn page with knobs at /design-system (pm-216)

**Idea.** "Add Design System. Explain in simple terms, with illustration and
infography to make the idea easier to grab."

**Product.** `otohime.dev/design-system` is **Design system**, the eleventh
row on the Projects bench. It is one page on squared notebook paper in hand
lettering, the same look as Structures, so the two explainers read as one
series. The page explains the idea in one picture you can play with:

> A design system is a box of decisions made once (colours, gaps, corners,
> sizes, a speed, a face), each with a name. Parts are built only from those
> decisions, patterns are built from parts, and a rulebook says what is
> allowed. Change one decision and everything built from it follows.

Four drawings carry it:

1. **The box** (infographic): a painter's box. The top shelf holds **8 pots**
   (paper, ink, spot, corner, gap, size, speed, face), the middle shelf **9
   parts** (card, bar, field, ring, button, ghost, tag, note, switch), the
   bottom shelf **3 patterns** (a form, a list, a dialog), and on the lid the
   **rulebook** (words, keys, contrast). One spot-coloured arrow runs from a
   pot through a part into a pattern: "change a pot and everything below it
   follows".
2. **The board** (the one interactive island): the nine parts drawn in ink
   on a small sample screen, with knobs for the pots under it. Turn *Spot*
   from blue to coral and all nine parts change in the same beat, because
   none of them owns a colour. A counter says what happened: "1 knob turned.
   9 parts followed." A **No system** switch gives every part its own private
   values (three different blues and a stray coral, mixed corners, gaps that
   don't match); now a knob moves nothing and the counter says "1 knob
   turned. 0 parts followed. 9 to fix by hand." A **rule line** reads the
   contrast of ink on paper and spot on paper as WCAG ratios and says
   *passes* or *fails*, so the reader can break the rulebook (coral on cream
   fails: 2.8 to 1). A **Dress as** row re-paints the board in the real
   paper, ink, spot, corner and face of six sister projects.
3. **One knob, nine parts** (infographic): two columns built from the same
   engine as the board. With a system, one pot fans out to nine parts;
   without one, nine pots and nine hands.
4. **Right here** (infographic): the honest example. This site has eleven
   other stylesheets; ten name a `--paper`, all eleven an `--ink`, and
   between them they choose eight different creams. Eleven paper scraps with
   their hex and a row of small boxes for each sheet's count of named
   decisions. Caption: "Otohime has no design system, on purpose: every
   project is its own object. A system is the tool for when pages must feel
   like one thing."

Then 180 to 350 plain words (*What it is*, *Turn a knob*, *Where you meet
it*, *Watch out for*) at Flesch-Kincaid grade 8 or under, a sources box and
a colophon. With JavaScript off the board is a finished drawing at the
default pots with greyed knobs and the default sentences.

Research: [research.md](research.md) (run-7079, rep-4059), checked against the
repo at 988e07c by the product owner (run-7084). §1 is the repo, §3 the
look and the page, §4 the engine, §5 the files, walk and probe. This plan
repeats what the contracts need and records where it departs.

## Decisions

| Decision | Why |
| --- | --- |
| An **explainer project**, route group **`app/(design-system)/`** serving one page `/design-system`, own root layout, hand-written `design-system.css`, no Tailwind. Not a shared site stylesheet. | The idea asks to make the *idea* easy to grab. A shared token file would void eleven isolation tests and the "a group owes nothing to another" rule; research §9 costs it. `lib/motion.test.ts` reads the group name with `[\w-]+`, so the hyphen is fine and the `h1` name is `project-design-system`. |
| Row in `content/site.ts`, last: `{ title: "Design system", note: "A box of decisions made once, drawn so you can turn the knobs.", href: "/design-system", status: "live", colour: "coral" }`. | House recipe. Coral is the board's first-turn colour; the row before is mint. |
| **One count of each thing, read by everyone.** `POTS` (8 keys), `PARTS` (9) and `PATTERNS` (3) are constants in `board.ts`; the box figure, the board, the counter, the follow card and the prose all read them. | Research said "twelve pots, five parts" in the box but "9 parts followed" on the board: two numbers for one idea. Departure recorded. |
| **Every part draws with every pot** (an ink outline, a paper or spot fill, one spot mark, a corner, its gap, a label in the size and face, a transition at the speed). So with the system on, any knob moves all nine parts. | Makes "1 knob, 9 parts" literally true for every knob; the test asserts it per knob. |
| **Pots are values, knobs are presets.** `Pots = { paper: hex; ink: hex; spot: hex; corner: "sharp" \| "soft" \| "round"; gap: number; size: number; speed: number; face: "cursive" \| "serif" \| "sans-serif" \| "monospace" }`. Knobs: *Paper* cream `#f6f3ea` / white `#ffffff` / night `#161513` (each sets its partner ink: `#1d1b17`, `#1d1b17`, `#ebe5d6`); *Spot* (below); *Corner* sharp / soft / round; *Gap* tight 8 / even 14 / airy 20; *Size* small 17 / large 21; *Speed* still 0 / quick 150 (ms); *Face* the four families. | A dress carries a sibling's own hex (`#f3eee3`), which no preset has, so pots must hold values. A dress maps the sibling's corner px to the nearest inked corner (0–3 sharp, 4–9 soft, 10+ round). Departure recorded. |
| **Spot presets:** blue `#2456b3` (default), coral `#ef6a4c`, mint `#93d3b0`, yellow `#f4b829`, pink `#f3a6bb`, shade `#3f4e93`. The site's pale blue `#76a0e2` is not offered. | Research typed Spot as the six site swatches but pinned the default rule at 6.2:1, which only `#2456b3` gives. Recomputed on cream `#f6f3ea`: blue 6.19, shade 6.95, coral 2.77, pink 1.72, yellow 1.61, mint 1.55. Most site swatches fail as a spot on cream; the rule line saying so is the lesson. Departure recorded. |
| **The rule line** (`contrast.ts`, pure WCAG 2): ink on paper must be ≥ 4.5, spot on paper ≥ 3. Sentence: "Ink on paper 15.5 to 1, passes. Spot on paper 6.2 to 1, passes." (one decimal). With the system off: "No system, so no rule to check: 9 parts pick their own colours." | The rulebook is a layer of the system; it only exists while the system does. |
| **The counter's sentences** (`turn()`'s `say`): default and no-JS "Turn a knob and watch what follows."; knob, system on "1 knob turned. 9 parts followed."; knob, system off "1 knob turned. 0 parts followed. 9 to fix by hand."; switch off "System off: every part keeps its own values."; switch on "System on: 9 parts follow the pots again."; dress "Dressed as <name>: 9 parts followed."; reset "Back to the start." Every `9` is `PARTS.length`. | One pure source for words and picture; tests assert the sentences without a browser. |
| **No system** freezes the board on `DRIFT`: every part's private values (spots `#2456b3`, `#3b7bd6`, `#1a3f8a` and one `#ef6a4c`; corners mixed; gaps 8 / 12 / 20 mixed; sizes 17 / 19 / 21 mixed; two parts in serif) and the screen paper stays cream. Knobs still move the pots (the radios show the choice) but nothing reads them. | Coarse drift reads at 390 px; "nothing matches", not "find the difference". |
| **Exactly one `"use client"` file** (`_components/board-app.tsx`); **rough.js never reaches the client.** The server inks **27 stamps** (9 parts × 3 corners, `part-<name>-<corner>`, each split into `outline` and `accent` paths) and passes path strings as props; the island draws them once in `<defs>` and places nine `<use>`. Colours are CSS custom properties on the `<svg>` root (`--board-paper`, `--board-ink`, `--board-spot`, `--board-speed`), filled with `var(...)`; a corner change swaps `href`; a gap change is a `translate` on the `<use>`. | Structures' and Rotor's one-island rule. The custom properties *are* the mechanism a design system uses on the web, so the code teaches the idea too. |
| **"Right here" audits the eleven other top-level stylesheets** (site + ten projects), not `design-system.css`. `siblings.ts` pins per sheet: group, file, light paper hex (first hex of `--paper`, `null` for Vinyl), first ink hex, count of distinct custom property names declared, `--paper` / `--ink` declared, and for six of them a dress (paper, ink, spot, corner, face). `siblings.test.ts` reads the files as text, asserts every pin, and fails if a group stylesheet exists that is neither pinned nor this group's own. | Task 1 lands before this group's own sheet exists. A stale "eleven" would be a false claim on the page, so a new project re-pins one row: the same cost `motion.test.ts`'s project count already puts on every new project. Departure recorded. |
| **Dresses:** Shore, Capsule, Orrery, Elements, Gazette (`articles`), Structures. Faces are generic families, never the siblings' webfonts. | Research §3; no font downloads for a preview. |
| Static page, `export const ensureStatic = "navigation"`. The server renders the board at `DEFAULT` with the system on, both `<output>`s with the default sentences, and the knobs in `<fieldset disabled data-knobs>` that the island enables with a `useSyncExternalStore` hydration flag. | Reads fully with JavaScript off; no dead buttons. |
| Motion: the box, follow and here figures draw on once at load (`pathLength="1"`, 600 ms, pots → parts → patterns). A turn marks the followed parts `data-hot` for 500 ms (filled `--hot`, lifted 2 px); `use { transition: fill, stroke, transform; transition-duration: var(--board-speed); transform-box: fill-box; }`. *Speed* still sets `--board-speed: 0ms`. The stylesheet's last block is `prefers-reduced-motion: reduce` and zeroes every transition and animation. | The house grammar (pm-206). The Speed knob shows that motion is a decision too. |
| The probe proves timing by **computed `transition-duration`** (0.15s with motion on and Speed quick; 0s with Speed still; 0s under reduced motion), not by sampling frames. | Deterministic on a shared runner; proves the same claim. |
| Text is typed data in `_lib/copy.ts`, held to the Gazette's caps: body 180–350 words, FK ≤ 8, mean sentence ≤ 20, longest ≤ 35, deck one sentence ≤ 30 words; no `<`, `>`, `http` in prose; every digit in prose is one of the engine's numbers (1, 0, `POTS.length`, `PARTS.length`, `PATTERNS.length`, the sibling count, the `--paper` count, the `--ink` count, the distinct creams); ≥ 3 sources, `https` on the allowlist `en.wikipedia.org`, `design-system.service.gov.uk`, `m3.material.io`, `developer.apple.com`, `developer.mozilla.org`, `www.w3.org`. Prose says "part", "pot", "face", "the gap", "the spot colour", not "component", "token", "typography". `readability.ts`, `words.ts` (`WORD_CAP = 700`), `ink.ts` (`SEED = 216`), `paper.ts`, `kit.ts`, `roughjs.d.ts` are **copied** from Structures, never imported. | "Simple terms" is a number CI checks. A group owes nothing to another. |
| Look: Structures' tokens. `--paper #f6f3ea` with a 24 px grid (two `linear-gradient`s in `--grid #dcd6c6`), `--ink #1d1b17`, `--spot #2456b3`, `--hot #c8402f`; dark `#161513` / `#2a2722` / `#ebe5d6` / `#7aa2ff` / `#ff8a73` from `prefers-color-scheme` or the pinned `[data-theme]`. Titles Caveat, body Patrick Hand 19 px/1.5 via `next/font/google` (literal options, `cursive` fallbacks). themeColor light `#f6f3ea`, dark `#161513`. Article max 760 px. | Research §3. The board's own paper is a pot and independent of the page's theme. |
| Walk port **4075**, dead-port check **4077**, browser probe **4079**. | 4019–4073 are taken (checked in `scripts/`); none is on Next's reserved list. |
| All tests flat in `app/(design-system)/_lib/*.test.ts` except `figures.test.ts`'s targets in `_lib/figures/`; `npm test` gains one glob. | Matches every other group. |
| Commits are authored and committed as `Otohime <quiinthieu@gmail.com>`; subjects start `pm-216/t-NNNN:`. | Vercel Hobby deploys only the owner's commits. |
| Shared lines (`content/site.ts`, `package.json`, `e2e/rbac.test.ts`, `lib/build-stamp.test.ts`, `lib/motion.test.ts`, `scripts/probe-motion.mjs`, `README.md`): on a rebase conflict keep both sides. | Lesson iss-9. No other otohime plan is active today. |
| Three build tasks (engine `qa: skip`, ink `qa: skip`, page with QA). No operator action, no throwaway build, no new dependency. | Nothing needs a person, key, account or device. A static group with one island, Google fonts at build and pre-inked props into an island already ship on this config (Structures). |

## File tree

```
app/(design-system)/
  layout.tsx                  own <html lang="en">, design-system.css, Caveat + Patrick_Hand, build-sha meta,
                              inline @view-transition style, pinTheme script
  design-system.css           tokens, squared paper, article, figures, knobs, <use> fills from --board-*,
                              transitions at --board-speed, hot lift, draw-on, hop block,
                              h1 { view-transition-name: project-design-system; }, reduced-motion block last
  design-system/page.tsx      the page; ensureStatic = "navigation"; generateMetadata
  _components/chrome.tsx      top bar (plain <a> to / and /projects), head, colophon
  _components/figure.tsx      a Figure as <figure data-figure> + <svg role="img" aria-label> (Structures', copied)
  _components/board.tsx       server: inks the 27 stamps, renders <BoardApp> and the no-JS outputs
  _components/board-app.tsx   the one "use client" file
  _lib/ board.ts contrast.ts siblings.ts copy.ts readability.ts words.ts                       (task 1)
        ink.ts roughjs.d.ts paper.ts kit.ts stamps.ts scenes.ts figures/{box,follow,here}.ts (task 2)
        *.test.ts (flat)                                                                   (tasks 1–3)
scripts/walk-design-system.sh · scripts/probe-design-system.sh · scripts/probe-design-system.mjs
content/site.ts · lib/build-stamp.test.ts · lib/motion.test.ts · scripts/probe-motion.mjs · e2e/rbac.test.ts
package.json · README.md
```

## Tasks

### 1. The engine and the words: pots, parts, turns, the contrast rule, the sibling pins and the copy

- **Role:** software_engineer, `qa: skip`. Only `app/(design-system)/_lib/`,
  the `npm test` glob and the README test sentence. No route, no layout:
  visitors see no change (`lib/motion.test.ts` skips a group without
  `layout.tsx`).
- **Problem:** The page needs a board that explains itself: every knob turn
  must say which parts followed and why, a switch must show what happens
  without a system, a rule must judge contrast, the "Right here" facts must
  be true of this repo's real stylesheets, and the words must be simple. None
  of it exists, and "simple terms" is a wish until a test measures it.
- **Action items:**
  1. `npm ci`. Read `AGENTS.md`, research §3–§4, this plan's Decisions,
     `app/(structures)/_lib/machine.ts`, `copy.ts`, `copy.test.ts`,
     `readability.ts`, `words.ts`, `isolation.test.ts`, and
     `lib/motion.test.ts` (how it reads the groups and stylesheets).
  2. `board.ts`: `POTS` (the 8 keys of `Pots`), `PARTS = ["card", "bar", "field", "ring", "button", "ghost", "tag", "note", "switch"] as const`,
     `PATTERNS = ["form", "list", "dialog"] as const`, the knob presets
     (`PAPERS`, `SPOTS`, `CORNERS`, `GAPS`, `SIZES`, `SPEEDS`, `FACES`) per
     the Decisions table, `Board = { pots: Pots; system: boolean; dress?: string }`,
     `Turn = { knob: Knob; to: string } | { knob: "system"; to: boolean } | { knob: "dress"; to: string } | { knob: "reset" }`
     where `Knob` is `"paper" | "spot" | "corner" | "gap" | "size" | "speed" | "face"`
     and `to` names a preset, `DEFAULT` (cream, blue, soft, even, small,
     quick, cursive, system on), `DRIFT: Record<Part, PartValues>`,
     `values(b) → Record<Part, PartValues>` (system on: every part from the
     pots; off: `DRIFT`), `turn(b, t) → { board; say; followed: Part[]; hot: Part[] }`
     with the sentences in the Decisions table, and `describe(b)` (the
     drawing's `aria-label`: names the paper, the spot, the corner and the
     gap by preset name, or "no system" when off). All pure; an unknown
     preset or sibling throws.
  3. `contrast.ts`: `luminance(hex)`, `contrast(a, b)` (WCAG 2, symmetric),
     `rule(b) → { ink: number; spot: number; passes: boolean; say: string }`
     (ink ≥ 4.5, spot ≥ 3; the system-off sentence when `b.system` is false).
  4. `siblings.ts`: `SIBLINGS` per the Decisions row, pinned from the files
     (start from research §1's numbers and pin what the files say), and the
     derived counts `PAPER_COUNT`, `INK_COUNT`, `CREAMS` (distinct light
     paper hexes) used by the figure and the prose; `DRESSES` (the six) and
     `dress(name) → Pots` partials.
  5. `copy.ts`: `title` "Design system", `deck` "A box of decisions made
     once, drawn so you can turn the knobs.", `parts: { what: string[]; turn: string[]; where: string[]; trap: string[] }`
     written in full (research §3 "The words": a box of decisions made once;
     parts from pots, patterns from parts, a rulebook; the board in prose;
     GOV.UK, Material and Apple, and this site, which has none on purpose;
     drift, too tight, never finished), `captions` for the four figures,
     `sources: { label; url }[]`, the colophon links ("Next door:
     Structures" → `/structures`, the Gazette → `/articles`).
  6. Copy `readability.ts` and `words.ts` (`WORD_CAP = 700`) from Structures
     with their tests adapted.
  7. Tests (`node:test`, flat in `_lib/`):
     - `board.test.ts`: `POTS.length` 8, `PARTS.length` 9, `PATTERNS.length`
       3; for every knob and every preset different from the default, a turn
       with the system on lists all nine parts in `followed` and `hot` and
       says "1 knob turned. 9 parts followed."; the same turn with the system
       off lists none, says "1 knob turned. 0 parts followed. 9 to fix by
       hand." and leaves `values` deep-equal to `DRIFT`; Paper night sets ink
       `#ebe5d6`; every dress sets exactly paper, ink, spot, corner and face
       to the sibling's pins; reset returns `DEFAULT`; `describe(DEFAULT)`
       names cream, blue, soft and even; `values` with the system on never
       deep-equals `DRIFT`; `DRIFT` has at least three distinct spots, three
       corners and three gaps; `turn` is pure (input deep-equal before and
       after).
     - `contrast.test.ts`: `#000000` on `#ffffff` is 21; `#2456b3` on
       `#f6f3ea` 6.2 ± 0.05; `#ef6a4c` on `#f6f3ea` 2.8 ± 0.05; `#2456b3` on
       `#161513` 2.7 ± 0.05; `#f4b829` on `#161513` 10.2 ± 0.05; `#1d1b17` on
       `#f6f3ea` 15.5 ± 0.05; symmetric; `rule(DEFAULT).say` is "Ink on paper
       15.5 to 1, passes. Spot on paper 6.2 to 1, passes."; spot coral on
       cream fails; spot yellow on night passes; the system-off sentence.
     - `siblings.test.ts`: reads each pinned file as text and asserts its
       paper, ink, decision count and flags; eleven rows; every top-level
       group stylesheet under `app/` other than `(design-system)` is pinned;
       the six dresses name pinned groups; `PAPER_COUNT`, `INK_COUNT`,
       `CREAMS` equal what the files give. On a mismatch the message prints
       the new value to re-pin.
     - `copy.test.ts`: title ≤ 4 words; deck one sentence ≤ 30 words; body
       180–350 words (`textWords`), FK ≤ 8, mean ≤ 20, longest ≤ 35; no `<`,
       `>`, `http` in prose; every digit run in prose is in the engine's set;
       the words "component", "token" and "typography" do not appear in
       prose; ≥ 3 sources, each `https:` on the allowlist; four captions.
       Print words and grade in the test names.
     - `readability.test.ts`, `words.test.ts`: Structures' vectors
       (`fkGrade("The cat sat on the mat.")` = −1.45 ± 0.01).
     - `isolation.test.ts` (Structures' shape): nothing imports another
       group, the site (`@/`) or Tailwind; `_lib/` imports no React and
       nothing from `next`; no `fetch(`, `localStorage`, `Math.random` or
       `Date` in `_lib/` outside tests (`siblings.test.ts` may read files;
       `siblings.ts` may not); at most `ink.ts` and `stamps.ts` import
       `roughjs`; at most one client file and, if present, it imports no
       `ink`, `stamps`, `kit`, `figures` or `roughjs` (task 3 tightens to
       exactly one). Spell the directive without its quotes in comments.
  8. Add `'app/(design-system)/_lib/*.test.ts'` to the `npm test` glob;
     name Design system's tests in the README's `npm test` sentence.
- **Interfaces:** `app/(design-system)/_lib/board.ts`, `board.test.ts`,
  `contrast.ts`, `contrast.test.ts`, `siblings.ts`, `siblings.test.ts`,
  `copy.ts`, `copy.test.ts`, `readability.ts`, `readability.test.ts`,
  `words.ts`, `words.test.ts`, `isolation.test.ts`; `package.json`;
  `README.md`.
- **Non-goals:** geometry, ink, stamps or figures (task 2); any route,
  layout, CSS or component (task 3); a shared site stylesheet or any edit to
  another group; a colour picker, a token export, a code panel.
- **Acceptance:** `npm test` runs Design system's engine tests and they pass:
  every knob moves nine parts with the system on and none with it off, the
  contrast rule gives WCAG's numbers, the "Right here" pins match the real
  stylesheets, and the page's words sit at grade 8 or under with sources on
  the allowlist.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(design-system)/_lib/*.test.ts'`
  - `grep -q '9 to fix by hand' 'app/(design-system)/_lib/board.test.ts' && grep -q 'fkGrade' 'app/(design-system)/_lib/copy.test.ts' && grep -q '#f3eee3' 'app/(design-system)/_lib/siblings.ts'`
  - `grep -q "app/(design-system)/_lib/\*.test.ts" package.json && ! test -e 'app/(design-system)/layout.tsx'`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 2. The ink: 27 stamps, the board's scenes and the three figures

- **Role:** software_engineer, `qa: skip`. Depends on 1. Only
  `app/(design-system)/_lib/` and one README sentence. No route: visitors see
  no change.
- **Problem:** The board and the figures have no pictures. Each board needs
  a sample screen that fits a phone without overlaps, drawn in hand ink that
  must stay on the server, plus three infographics whose numbers are the
  engine's.
- **Action items:**
  1. Read `app/(structures)/_lib/ink.ts`, `paper.ts`, `kit.ts`, `stamps.ts`,
     `scenes.ts`, `costs.ts` and their tests, and research §3–§4.
  2. Copy `ink.ts` (`SEED = 216`, roughness 0.9), `roughjs.d.ts`,
     `paper.ts` and `kit.ts` (`Figure = { viewBox; paths; spot; labels }`,
     `figureProblems`).
  3. `stamps.ts`: `STAMP_SIZE` per part and `inkStamps() → { id: string; part: Part; corner: Corner; outline: string[]; accent: string[] }[]`:
     27 stamps, ids `part-<part>-<corner>`, each drawn about its own origin;
     the corner radius is the only difference between a part's three.
  4. `scenes.ts` (no rough.js): `Scene = { width: 480; height: number; paper: string; parts: Placed[]; labels: Label[] }`,
     `Placed = { part; stamp: string; x; y; fill; stroke; accent; label: { text; size; face } }`,
     `scene(b: Board)`: the nine parts stacked as a small screen (a card
     holding a bar, a field with its ring, a button and a ghost, a tag, a
     note and a switch), spaced by each part's gap, drawn from `values(b)`.
     A part's `x`/`y` change only with its gap; its `stamp` only with its
     corner.
  5. `figures/box.ts` (the painter's box: `POTS.length` pots, `PARTS.length`
     parts, `PATTERNS.length` patterns, the rulebook on the lid, one spot
     arrow; ≤ 12 labels), `figures/follow.ts` (two columns built from
     `turn(DEFAULT, spot coral)` with the system on and off: one pot with
     `followed.length` lines out, and `PARTS.length` pots each with a hand),
     `figures/here.ts` (one scrap per `SIBLINGS` row with its hex as a
     label and `data-sheet`, a row of small boxes per sheet's decision
     count, the `--paper` and `--ink` counts in spot). Each returns a
     `Figure`.
  6. Tests: `stamps.test.ts` (27 stamps, ids unique, every coordinate
     inside its size + 4, accent non-empty, same output on two calls);
     `scenes.test.ts` (for `DEFAULT`, every board one turn away from it,
     every dress and the system-off board: every part and label inside
     `0..480 × 0..height` with a 2-unit margin, no two part boxes overlap,
     label size ≥ 17; the three corners place every part identically; the
     three gaps change positions; system off places from `DRIFT`);
     `figures.test.ts` (the three figures pass `figureProblems`, labels ≥
     17, at least one spot; the box names 8, 9 and 3 from the constants;
     the follow card's columns equal `PARTS.length` and 0 from `turn`; the
     here card has `SIBLINGS.length` scraps; same output twice);
     `ink.test.ts` as Structures' with `SEED = 216`. `isolation.test.ts`:
     only `ink.ts` and `stamps.ts` import `roughjs`, and `scenes.ts` reaches
     neither, even through another file.
  7. README: extend the Design system sentence in the `npm test` paragraph
     to name the ink, stamp, scene and figure tests.
- **Interfaces:** `app/(design-system)/_lib/ink.ts`, `ink.test.ts`,
  `roughjs.d.ts`, `paper.ts`, `kit.ts`, `stamps.ts`, `stamps.test.ts`,
  `scenes.ts`, `scenes.test.ts`, `figures/box.ts`, `figures/follow.ts`,
  `figures/here.ts`, `figures.test.ts`, `isolation.test.ts`; `README.md`.
- **Non-goals:** the route, the island and the CSS (task 3); animation;
  changing the engine's behaviour (a layout need that would is recorded as a
  decision, not done).
- **Acceptance:** `npm test` passes with every reachable board in frame and
  free of overlaps at 390 px, 27 stamps inked on the server only, and three
  figures in frame with legible labels whose numbers are the engine's.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(design-system)/_lib/*.test.ts'`
  - `test "$(ls 'app/(design-system)/_lib/figures/'*.ts | grep -c .)" -eq 3`
  - `grep -q 'SEED = 216' 'app/(design-system)/_lib/ink.ts' && test "$(grep -l 'roughjs' 'app/(design-system)/_lib/'*.ts | grep -v test | grep -v roughjs.d.ts | grep -vc -e '/ink.ts' -e '/stamps.ts')" -eq 0`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 3. Design system at /design-system: the page, the board, the hop, the walk and the probe

- **Role:** software_engineer. Depends on 2. QA is required.
- **Problem:** The explainer is invisible. Readers need `/design-system`,
  listed on `/projects` and joined to the site's hop, that they can read
  with JavaScript off and play with it on: turn a knob and watch nine parts
  follow, switch the system off and watch nothing follow, break the
  contrast rule, dress the board as a sister project.
- **Action items:**
  1. Read `node_modules/next/dist/docs/` on `ensureStatic` and metadata;
     `app/(structures)/layout.tsx`, `structures/page.tsx`, `structures.css`,
     `_components/machine.tsx`, `machine-app.tsx`; `lib/motion.test.ts`;
     `scripts/walk-structures.sh` (`no_rough_in_chunks`),
     `probe-structures.sh`/`.mjs`.
  2. `_lib/motion.test.ts` (Structures' shape): the stylesheet's last block
     is `prefers-reduced-motion: reduce` and zeroes transitions and
     animations for `use`, the draw-on and `::view-transition-group(*)`;
     `use` transitions `fill`, `stroke` and `transform` at
     `var(--board-speed)`. `isolation.test.ts`: now **exactly one** client
     file, `_components/board-app.tsx`, importing only React, `board.ts`,
     `contrast.ts`, `scenes.ts` and `siblings.ts` (no `ink`, `stamps`,
     `kit`, `figures` or `roughjs`); no `process.env` outside `layout.tsx`.
  3. `layout.tsx`: `<html lang="en">`, `design-system.css`, the two font
     calls, `metadata.title` "Design system", description, `other: { "build-sha": process.env.BUILD_SHA ?? "dev" }`,
     `viewport.themeColor`, the inline `@view-transition` style and the
     pinTheme script with `suppressHydrationWarning`.
  4. `design-system/page.tsx`: `ensureStatic = "navigation"`,
     `generateMetadata`. Top bar, `<h1>` "Design system", deck, reading
     time; `<figure data-figure="box">`; `<figure data-figure="board">`
     (`board.tsx`); `<figure data-figure="follow">`; `<figure data-figure="here">`
     with eleven `data-sheet="<group>"` scraps; the four parts with `<h2>`s;
     `<aside data-sources>` with an `<ol>` of links; the colophon.
  5. `_components/board.tsx` (server): `inkStamps()`, `scene(DEFAULT)`,
     `rule(DEFAULT)`; renders `<BoardApp stamps initial>` plus the no-JS
     outputs. `_components/board-app.tsx` (`"use client"`): `useReducer`
     over `turn`; `<svg role="img" aria-label={describe(board)}>` with the
     `--board-*` properties on its root, `<defs>` of 27 `<symbol id="part-…">`
     (outline paths stroked with `--board-ink`, accent paths filled with
     `--board-spot`) and nine `<use data-part href transform>`, `data-hot`
     on followed parts for 500 ms; `<output aria-live="polite" data-counter>`
     and `<output data-rule>`; `<fieldset data-knobs>` (disabled until
     hydrated) with seven radio groups `data-knob="<knob>"` (the spot
     presets as inked dots with text names), the No system
     `<input type="checkbox" role="switch">`, six `<button data-dress="<group>">`,
     and Reset.
  6. `_components/chrome.tsx`, `_components/figure.tsx`.
  7. `design-system.css` per the Decisions rows: tokens and dark scheme, the
     squared paper, the 760 px article, figures full width under 640 px,
     knobs wrapping in two columns with 44 px tap targets and a visible
     focus ring, the dress row scrolling inside its own box if it must,
     `use[data-hot]` fill and lift, the `<use>` transitions, the draw-on,
     nothing wider than 100vw at 320 px; the hop rule, the typed root fade,
     `fade-in` / `fade-out`, `h1 { view-transition-name: project-design-system; }`
     and, last, the reduced-motion block.
  8. Shared edits: `content/site.ts` the plan's row, last;
     `lib/motion.test.ts` 10 → 11 (and the test name);
     `scripts/probe-motion.mjs` `PROJECTS` gets `"design-system"`, every "10
     row"/"ten" becomes 11/"eleven"; `lib/build-stamp.test.ts` "Design
     system's root layout publishes BUILD_SHA as <meta name=build-sha>
     too"; `e2e/rbac.test.ts`: `/projects` links `/design-system`, and
     "Design system is its own page, without the site's sidebar" (200, no
     `aria-label="Main"`, a `/projects` link, four `data-figure="`).
  9. `scripts/walk-design-system.sh` in `walk-structures.sh`'s style (port
     4075, local build+start or `BASE_URL`, `EXPECT_SHA`, process-group
     cleanup, `grep -c`, no `wc -l`, no `set -e`, a failure summary).
     `/design-system`: 200, build-sha meta, no `aria-label="Main"`,
     `href="/projects"`, one `<h1` containing "Design system", the four
     `data-figure=` values once each, 27 `<symbol id="part-`, nine
     `data-part="`, one `<fieldset disabled`, seven `data-knob="`, six
     `data-dress="`, eleven `data-sheet="`, two `<output`, "Turn a knob and
     watch what follows." and "Spot on paper 6.2 to 1, passes.",
     `data-sources` with ≥ 3 allowlisted `https://` links, ≤ 700 visible
     words, under 200 KB, no `$RC`, no `<template id="B:`, no `--tw-`, only
     its own stylesheet. `/projects` links `/design-system` exactly once. No
     script chunk `/design-system` loads contains rough.js. Source: exactly
     one file in `app/(design-system)` starting with the client directive.
  10. `scripts/probe-design-system.sh` + `.mjs` in `probe-structures`' shape
      (port 4079, Playwright and axe-core into a temp prefix, local build or
      `BASE_URL`, `ok -` / `not ok -` lines). At 390×844 and 1366×768: the
      fieldset is enabled after hydration (read `fieldset.disabled` with
      `evaluate`); Spot coral → counter "1 knob turned. 9 parts followed.",
      the button's accent computed fill `rgb(239, 106, 76)`, the
      `aria-label` names coral, the rule line says "fails"; No system on,
      then Spot mint → counter says "0 parts followed" and the button's fill
      is unchanged; No system off → Corner round → all nine `<use>` hrefs
      end `-round`; Paper night with Spot blue → the rule line says "fails",
      then Spot yellow → "passes"; Dress as Gazette → the board's paper
      computes to `rgb(243, 238, 227)`; Reset → the default counter and
      `aria-label`; the `<use>` `transition-duration` is `0.15s` with
      motion on and Speed quick, `0s` with Speed still, and `0s` under
      `reducedMotion: "reduce"`; keyboard only: Tab into the Spot group,
      ArrowRight checks the next spot and the counter updates. At 320×640
      nothing scrolls sideways. No console or page error; axe
      (wcag2a/aa/21aa) finds nothing serious or critical, light and dark.
  11. README: the route-group line, the walk and probe lines, and a
      `## Design system` section (what the page shows, the one-island rule,
      and how to re-pin `siblings.ts` when a sister stylesheet changes or a
      new project lands).
- **Interfaces:** `app/(design-system)/layout.tsx`;
  `app/(design-system)/design-system.css`;
  `app/(design-system)/design-system/page.tsx`;
  `app/(design-system)/_components/chrome.tsx`;
  `app/(design-system)/_components/figure.tsx`;
  `app/(design-system)/_components/board.tsx`;
  `app/(design-system)/_components/board-app.tsx`;
  `app/(design-system)/_lib/motion.test.ts`;
  `app/(design-system)/_lib/isolation.test.ts`;
  `scripts/walk-design-system.sh`; `scripts/probe-design-system.sh`;
  `scripts/probe-design-system.mjs`; `content/site.ts`;
  `lib/build-stamp.test.ts`; `lib/motion.test.ts`; `scripts/probe-motion.mjs`;
  `e2e/rbac.test.ts`; `README.md`.
- **Non-goals:** a shared site stylesheet or any change to another project's
  look; a colour picker, a code panel, a token export, saving the board,
  share URLs; the siblings' webfonts; a sidebar entry; second-chapter pages
  (*The type scale*, *The spacing scale*, *Dark mode as one decision*); any
  new dependency in `package.json`.
- **Acceptance:** `/projects` lists Design system with a coral dot; the
  title hops into the page's `h1`; the page shows the box, the board, the
  follow card and the Right here card with short words and sources; turning
  any knob moves all nine parts and the counter says so; with No system on a
  knob moves nothing and the counter says "9 to fix by hand"; the rule line
  passes and fails with real contrast numbers; Dress as re-paints the board
  in a sister project's colours; Reset restores the start; with JavaScript
  off the board is a finished drawing with greyed knobs; it fits 320 px,
  works in light and dark, by keyboard and with reduced motion.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `bash -n scripts/walk-design-system.sh && bash -n scripts/probe-design-system.sh && ! grep -nE 'wc +-l' scripts/walk-design-system.sh`
  - `bash scripts/walk-design-system.sh`
  - `if BASE_URL=http://127.0.0.1:4077 bash scripts/walk-design-system.sh; then exit 1; fi`
  - `bash scripts/probe-design-system.sh`
  - `bash scripts/probe-motion.sh`
  - `test "$(grep -rlE '^.use client.;?$' 'app/(design-system)' | grep -c .)" -eq 1 && grep -q 'ensureStatic = "navigation"' 'app/(design-system)/design-system/page.tsx'`
  - `grep -q 'href: "/design-system"' content/site.ts && grep -q '/design-system' e2e/rbac.test.ts && grep -q 'design-system' lib/build-stamp.test.ts && grep -q '"design-system"' scripts/probe-motion.mjs && grep -q 'project-design-system' 'app/(design-system)/design-system.css'`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

## QA (task 3)

Headless Chrome (playwright-core in a scratch directory) at 1366×768, 390×844
and 320×640, light and dark, motion on and reduced, against a local
`next start` at the delivery sha or the deployed site.

- The page reads as a notebook page in the Structures series; nothing
  scrolls sideways at 320 px; the four figures and their labels are legible
  at 390 px (≥ 12 px measured); the knobs are reachable without hunting.
- Turn every knob by mouse and by keyboard only: all nine parts follow, the
  counter and the `aria-label` match the picture; flip No system and turn
  two knobs: nothing follows and the counter says so; flip it back: nine
  follow again.
- Break the rule (Spot coral on cream, Spot blue on night) and mend it
  (Spot shade on cream, Spot yellow on night); the numbers match a
  contrast checker.
- Dress the board as the Gazette and as Orrery and compare with
  `/articles` and `/orrery`: paper, ink and spot read as those pages.
- Check the Right here card's numbers against the stylesheets (`grep` the
  `--paper` lines).
- JavaScript off: the page reads, the board shows the default drawing, the
  default sentences and greyed knobs.
- Reduced motion: the figures show complete and turns land at once.
- `bash scripts/walk-design-system.sh`, `bash scripts/probe-design-system.sh`
  and `bash scripts/probe-motion.sh` pass; no console errors; Lighthouse
  accessibility ≥ 95.

## Acceptance

After CI deploys: `BASE_URL=https://otohime.dev bash scripts/walk-design-system.sh`
(with `EXPECT_SHA` the delivery sha), `BASE_URL=https://otohime.dev bash scripts/probe-design-system.sh`
and `BASE_URL=https://otohime.dev bash scripts/probe-motion.sh` exit 0. On
otohime.dev: `/projects` → Design system (the title hops into the `h1`) →
Spot coral (nine parts follow, the rule line fails) → No system → Spot mint
(nothing follows, "9 to fix by hand") → No system off → Dress as Gazette →
Reset → `← All projects`; then the page once with JavaScript off;
`/projects` lists Design system once with a coral dot.

## Risks

- **The board at 390 px.** Nine parts, two outputs, seven knob groups and a
  dress row is the densest panel on the site. The scene test fails on
  overlap; if the airy gap with large labels cannot fit 480 units, lower
  airy to 18 and record it. The probe's 320 px check catches page overflow.
- **`fill` transitions on `<use>` from a custom property on the root.** If
  a browser does not animate the inherited change, the change lands without
  a transition; the still is the same and the probe checks the declared
  duration, not the glide.
- **The pins go stale.** A sister project that edits its sheet, or a new
  project, fails `siblings.test.ts` with the value to re-pin; the README's
  Design system section says how. If the prose then quotes a changed count,
  `copy.test.ts` fails too and the sentence is fixed with it.
- **Words vs grade 8.** "Consistent", "component" and "guideline" are heavy;
  the copy uses "the same", "part" and "rule". If the body fails the FK cap,
  split sentences, never loosen the cap.
- **Fonts at build.** If Google Fonts fails during a build, Structures'
  build fails too: the cause is the environment, not this change.
- **The motion probe's eleventh row.** Eleven rows keep the 40 ms rule; if
  its reduced-motion check catches the draw-on, fix the CSS, not the probe.
