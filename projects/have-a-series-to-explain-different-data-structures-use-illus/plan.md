# Structures: a drawn, poke-able series on data structures at /structures (pm-214)

**Idea.** "Have a series to explain different data structures. Use
illustration, infography to make the concept easy to understand. Interactive
if possible."

**Product.** `otohime.dev/structures` is **Structures**, the tenth row on the
Projects bench. It is a series of eight pages on squared notebook paper in
hand lettering, in teaching order: **the array, the linked list, the stack,
the queue, the hash table, the search tree, the heap, the graph**. Each page
`/structures/<slug>` has three drawings and a short text:

1. **In life**: an everyday object inked by hand (a chest of drawers, a
   treasure hunt, a pile of plates, a bakery line, a coat check, a guessing
   game, a tournament ladder, a metro map), with a one-sentence caption that
   states the rule.
2. **The machine**: the structure itself, drawn in the same ink, which the
   reader works with buttons and a value box. Each move (push 9, find 6, take
   the smallest) plays as a short animation of beats, each beat one picture
   and one sentence ("6 is less than 8, so go left"), with a live narration
   line and a step count at the end ("Found 6 in 3 steps"). With JavaScript
   off, the page shows the worked example's end state and its steps as a
   numbered list, so the explanation still works.
3. **The costs**: an infographic of how many steps a find, an add and a
   remove take when 8 things are inside, drawn as rows of small boxes. The
   numbers come from running the same machine, so the card and the machine
   always agree.

Then 180 to 350 plain words (*What it is*, *How a move works*, *Where you
meet it*, *Watch out for*) at a Flesch-Kincaid grade of 8 or under, a sources
box, and Previous / Next. The index `/structures` lists the eight in order
with a thumbnail and the three costs as dots.

Research: [research.md](research.md) (run-7054, rep-4042), checked against the
repo at 34c0e43 by the product owner (run-7055). §3 is the look, §4 the eight
pages, §5 the engine, §6 the files, walk and probe. This plan repeats what the
contracts need and records where it departs.

## Decisions

| Decision | Why |
| --- | --- |
| Route group **`app/(structures)/`** serves `/structures` and `/structures/<slug>`, own root layout, hand-written `structures.css`, no Tailwind. Row `{ title: "Structures", note: "Eight ways to keep things, drawn by hand so you can poke them.", href: "/structures", status: "live", colour: "mint" }`, last. | House recipe. `lib/motion.test.ts` derives the `h1` view-transition name and the `/projects` row from the directory name, so the group name equals the URL slug. Mint is used once (Shore). |
| Not a Gazette section. | The Gazette's contract is zero `"use client"` files; this idea asks for interaction. The index colophon links the Gazette ("More reading: The Otohime Gazette"). |
| **Exactly one `"use client"` file** (`_components/machine-app.tsx`); **rough.js never reaches the client**. The server inks a fixed kit of stamps (box, plate, node, bucket, tile, station, unit arrow, hand; three seeds each) and passes their path strings as props; the island renders them once in `<defs>` and places them with `<use href="#…" transform="translate(x y)">`. | Rotor/Planisphere/Barometer's one-island rule, checked by the isolation test at source and the walk in the built chunks. |
| **The explanation is the reducer's own trace.** Every move is `reduce(state, action) → { state, trace: Beat[], steps, refused? }`, pure. The narration, the `<ol data-trace>`, the step count and the costs card all come from it. | One pure source for words, picture and numbers; tests assert the sentences without a browser. |
| **Unit: "steps"**, not research's "looks". A step is looking at one thing, moving one thing one place, writing the new thing into its place, or relinking/rubbing out one arrow or line. Heap: taking the top is one step, moving the last box to the top one step, each level climbed or sunk one step. Hash: working out the bucket is one step, plus one per word looked at in its chain (a `put` checks the chain for the word, then writes). Graph: a ripple counts one step per station visited. | "Looks" misnames shifts (an array insert moves, it doesn't look). Decision recorded. |
| **Costs are pinned as bands**, not exact numbers: for 8 things inside, each structure's find, add and remove (the moves named in task 1, item 3) falls in **one** (1–3), **few** (4–6) or **all** (7–10), per the table below; the card prints the reducer's exact count and its band's word. | Bands keep the teaching claim (the same whatever the size / a few / every one) testable without off-by-one fights before the code exists. Decision recorded. |
| Structures in the engine (task 1) have **no geometry**; `scenes.ts` (task 2) maps a state to a `Scene`. | Each task ships complete and tested on its own. Decision recorded. |
| Static pages: `[slug]` uses `generateStaticParams` + `export const ensureStatic = "navigation"` + `notFound()` (Orrery/Gazette). The server renders the machine at the worked example's end state, the narration holds its last sentence, `<ol data-trace>` holds every step; the controls sit in `<fieldset disabled data-controls>` that the island enables once hydrated (Elements' `useSyncExternalStore` flag). | Reads fully with JavaScript off; no dead buttons. |
| Motion: the In life ink draws on once at load (600 ms); a move plays its trace at **12 fps on twos: 6 ticks a beat (500 ms)**; the beat's element is marked `data-hot` (filled `--hot`, lifted 2 px); things that move travel with `transition: transform 150ms` on the `<use>` (`transform-box: fill-box`). A **Play / Step** toggle: in Step mode each press of "Next step" (or Space on that button) advances one beat. Under `prefers-reduced-motion: reduce` a move lands at once (the clock `settle`s), and the stylesheet's last block zeroes every transition and animation. | The house grammar (pm-206). |
| Text is typed data in `_lib/copy.ts`, held to the Gazette's caps: body 180–350 words, FK ≤ 8, mean sentence ≤ 20, longest ≤ 35, deck ≤ 30 words, title ≤ 4 words, no `O(`, no `<`, `>`, `http` in prose; ≥ 2 sources per page, `https` on the allowlist `en.wikipedia.org`, `developer.mozilla.org`, `docs.python.org`, `en.cppreference.com`. `readability.ts`, `words.ts` (`WORD_CAP = 700`), `ink.ts` (`SEED = 214`, roughness 0.9) and `roughjs.d.ts` are **copied** from the Gazette, never imported. | "Easy to understand" is a number CI checks. A group owes nothing to another. |
| Look: `--paper #f6f3ea` with a 24 px grid (two `linear-gradient`s in `--grid #dcd6c6`), `--ink #1d1b17`, `--spot #2456b3`, `--hot #c8402f`; dark `#161513` / `#2a2722` / `#ebe5d6` / `#7aa2ff` / `#ff8a73` from `prefers-color-scheme` or the pinned `[data-theme]` (Barometer's shape). Titles Caveat, body Patrick Hand 19 px/1.5 via `next/font/google` (literal options, `cursive` fallbacks). themeColor light `#f6f3ea`, dark `#161513`. Article max 760 px. | Research §3. |
| Corrected worked examples (table below): the array's find 16 is 5 steps (16 is fifth after the insert); the linked list removes **3** (the tail end, 3 looks and a relink), not 4 (the head); the graph's starter map is pinned so its ripple has 3 levels and A → H is 3 hops. | Recomputed by hand; the research's numbers were off or unspecified. Decision recorded. |
| Probe timing is a bound, not a window: with motion on, Find 6's last sentence appears **no sooner than 1,000 ms** after the press (it is 4 beats at 500 ms); under reduced motion **within 250 ms**. | ±100 ms on a shared runner is flaky; this proves "plays in beats" vs "lands at once" all the same. Decision recorded. |
| Walk port **4069**, dead-port check **4071**, browser probe **4073**. | 4019–4067 are taken; none of the three is on Next's reserved list. |
| All tests live in `app/(structures)/_lib/*.test.ts` (flat), so `npm test` gains one glob. | Matches every other group. |
| Commits are authored and committed as `Otohime <quiinthieu@gmail.com>`; subjects start `pm-214/t-NNNN:`. | Vercel Hobby deploys only the owner's commits. |
| Shared lines (`content/site.ts`, `package.json`, `e2e/rbac.test.ts`, `lib/build-stamp.test.ts`, `lib/motion.test.ts`, `scripts/probe-motion.mjs`, `README.md`): on a rebase conflict, keep both sides. | Lesson iss-9. No other otohime plan is active. |
| Three build tasks (engine `qa: skip`, ink `qa: skip`, pages with QA). No operator action, no throwaway build, no new dependency. | Nothing needs a person, key, account or device; static `[slug]` with an island (Elements), Google fonts at build (Orrery) and pre-inked props into an island (Rotor) already ship on this config. |

## The first series

Order is teaching order; each page uses only pictures from earlier ones.
"Cap" is the most the machine holds; a move past it is refused with one beat
and a sentence, and the state does not change. Bands are for 8 things inside
(costs run on a copy with cap 16, so 8 always fits).

| # | Slug · title | In life (caption) | Moves (cap) | Worked example → end state | Find · add · remove (band) | Watch out for | Sources |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `array` · The array | A chest of eight numbered drawers ("Every drawer has a number, so you can open any one at once.") | read *i*, set *i*, insert at *i*, remove at *i*, find *x* (8 slots) | set 0–4 to 4, 8, 15, 16, 23; insert 7 at 1 (moves 23, 16, 15, 8, then writes: 5 steps); find 16 (5 steps) → `4 7 8 15 16 23` | all (walk) · all (insert at the front) · all (remove at the front) | One thing in at the front moves everything behind it | Wikipedia: Array (data structure); MDN: Array |
| 2 | `linked-list` · The linked list | A treasure hunt where each note says where the next one is ("To reach the fifth note you read the four before it.") | push front *x*, append *x*, find *x*, remove *x* (7 nodes) | push front 3, 9, 4 → `4 9 3`; append 7 (walks 3 notes); find 9 (2 steps); remove 3 (3 looks, then the arrow from 9 is moved to 7) → `4 9 7` | all · one (at the front) · all (find it first) | There is no drawer number: reaching the end means walking | Wikipedia: Linked list; Python docs: collections.deque |
| 3 | `stack` · The stack | A pile of plates by the sink ("The last plate on is the first plate off.") | push *x*, pop, peek (7 plates) | push 1, 7, 4; peek (1 step, 4); pop → 4; push 2 → `1 7 2` (2 on top) | one (the top) · one · one | A full pile overflows; a pop on an empty pile is a mistake | Wikipedia: Stack (abstract data type); MDN: Array.prototype.push |
| 4 | `queue` · The queue | A line at a bakery counter, with a ring of 8 tiles under it ("First in line is first served.") | join *x*, leave, peek (8 tiles on a ring, a head hand and a tail hand) | join 5, 2, 9; leave → 5; join 6, 1, 8, 3, 7 (tiles 3–7; the tail hand wraps to tile 0) → front-to-back `2 9 6 1 8 3 7` | one (the front) · one · one | In a plain row the line walks off the end; the ring lets it wrap round | Wikipedia: Queue (abstract data type); Wikipedia: Circular buffer |
| 5 | `hash-table` · The hash table | A coat check where the ticket is worked out from the coat ("Work out the hook from the coat, and go straight there.") | put *word*, get *word*, remove *word* (8 buckets, chains of 3; words 1–5 lowercase letters, else refused); hash = sum of letter positions (a = 1) mod 8, the sum shown on the beat | put cat (24 → 0), dog (26 → 2), fox (45 → 5), **act (24 → 0, behind cat)**; get act (bucket 0, cat, act: 3 steps) | one · one · one (a collision adds one) | Anagrams land in the same bucket here; a real hash mixes the letters' order in | Wikipedia: Hash table; MDN: Map |
| 6 | `binary-search-tree` · The search tree | A guessing game, higher or lower ("Each guess throws away half of what is left.") | insert *x*, find *x*, remove *x*, and a one-button "insert 1, 2, 3, 4, 5" demo on an empty tree (15 nodes, 4 levels) | insert 8, 3, 10, 1, 6, 14; find 6 (8 → 3 → 6: 3 steps); find 7 (8 → 3 → 6, then "7 is not here": 3 steps) → height 3 | few · few · few (all when the tree is a line) | Sorted input grows a line, not a tree, and a find costs every step again | Wikipedia: Binary search tree; Wikipedia: Binary search |
| 7 | `heap` · The heap | A tournament ladder where the smaller number wins each match, with the same numbers in a row of boxes underneath ("The winner is always at the top.") | add *x*, take smallest (15 nodes; drawn as a tree and as the row it really is) | add 5, 3, 8, 1, 4 (1 climbs twice) → row `1 3 8 5 4`; take smallest → 1; 4 goes to the top and sinks once → row `3 4 8 5` | one (peek the top) · few · few | The row is the tree: the children of box *i* are boxes 2*i*+1 and 2*i*+2 | Wikipedia: Binary heap; Python docs: heapq |
| 8 | `graph` · The graph | A metro map of eight stations ("Two routes can reach the same station.") | connect *a b*, cut *a b*, ripple from *a* (stations light up by hops), path *a b* (stations A–H fixed, at most 12 lines) | starter map: A–B, A–C, A–D, B–E, C–E, C–F, D–G, F–H, G–H (9 lines); ripple from A → levels `B C D` · `E F G` · `H`; path A → H → `A C F H` (3 hops; ties broken by letter) | all (a ripple visits each station once) · one (draw a line) · one (rub it out) | A map is not a tree: remember where you have been or you go round in circles | Wikipedia: Graph (abstract data type); Wikipedia: Breadth-first search |

The register for the words: short sentences, one idea a paragraph, the
everyday picture first and the technical word after it ("this is called a
*stack*"); "join the line" and "leave the line" in prose (the labels may say
enqueue and dequeue); no Big-O, no code.

## File tree

```
app/(structures)/
  layout.tsx                    own <html lang="en">, structures.css, Caveat + Patrick_Hand, build-sha meta,
                                inline @view-transition style, pinTheme script, title template "%s · Structures"
  structures.css                tokens, squared paper, spread, figures, controls, hot/spot fills on <use>, transform
                                transition, draw-on, hop block, h1 { view-transition-name: project-structures; },
                                reduced-motion block last
  structures/page.tsx           the index; ensureStatic = "navigation"
  structures/[slug]/page.tsx    one page; generateStaticParams; ensureStatic = "navigation"; notFound(); generateMetadata
  not-found.tsx                 "Not in this series." and a link to /structures
  _components/chrome.tsx        top bar (plain <a> to / and /projects), page head, Previous / Next, colophon
  _components/figure.tsx        a Figure as <figure data-figure> + <svg role="img" aria-label> (the Gazette's, copied)
  _components/machine.tsx       server: inks the stamps, replays the example, renders <MachineApp> and the no-JS trace
  _components/machine-app.tsx   the one "use client" file
  _lib/ machine.ts play.ts copy.ts readability.ts words.ts            (task 1)
        structures/{array,linked-list,stack,queue,hash-table,binary-search-tree,heap,graph}.ts, structures/index.ts
        ink.ts roughjs.d.ts stamps.ts scenes.ts kit.ts costs.ts life/{eight slugs}.ts, life/index.ts   (task 2)
        *.test.ts (flat)                                                (tasks 1–3)
scripts/walk-structures.sh · scripts/probe-structures.sh · content/site.ts · lib/build-stamp.test.ts
lib/motion.test.ts · scripts/probe-motion.mjs · e2e/rbac.test.ts · package.json · README.md
```

## Tasks

### 1. The structures and their words: eight pure machines with traces, costs and copy

- **Role:** software_engineer, `qa: skip`. Only `app/(structures)/_lib/`, the
  `npm test` glob and the README test sentence. No route, no layout: visitors
  see no change (`lib/motion.test.ts` skips a group without `layout.tsx`).
- **Problem:** The series needs eight structures that explain themselves: every
  move must say, beat by beat, what it looks at and why, count its steps, and
  refuse when full, and each page needs words a general reader can follow.
  None of it exists, and "easy to understand" is a wish until a test measures
  it.
- **Action items:**
  1. `npm ci`. Read `AGENTS.md`, research §4–§5, this plan's table,
     `app/(articles)/_lib/readability.ts`, `words.ts`, `articles.test.ts`,
     `isolation.test.ts`, and `app/(rotor)/_lib/machine.ts` and
     `isolation.test.ts`.
  2. `machine.ts`: `Beat = { say: string; hot?: string[]; step?: boolean }`
     (`hot` names element ids lit on that beat; `step` marks a beat that
     counts), `Move<S> = { state: S; trace: Beat[]; steps: number; refused?: string }`,
     `Action = { move: string; value?: number | string; to?: string }`,
     `Structure<S> = { slug; cap; empty(cap?: number): S; moves: readonly { id; label; takes: "none" | "number" | "word" | "index" | "pair" }[]; defaultMove; reduce(s, a): Move<S>; describe(s): string; labels(s): string[]; example: readonly Action[]; costs(): { find: Cost; add: Cost; remove: Cost } }`,
     `Cost = { steps: number; band: "one" | "few" | "all"; why: string }`,
     `band(n)` (1–3 one, 4–6 few, 7–10 all, otherwise throws), and
     `replay(structure, actions) → { state, last: Move }`.
  3. `structures/<slug>.ts` ×8 and `structures/index.ts`
     (`STRUCTURES` in series order, `bySlug`). Each reducer is pure, writes
     its own trace (the sentences say what is compared and which way it goes,
     e.g. "6 is less than 8, so go left"), ends a successful move with a
     summary beat ("Found 6 in 3 steps", "9 goes on top"), sets
     `steps` = number of `step: true` beats, and on a refusal returns the
     same state object, `refused`, and exactly one beat. `costs()` builds an
     8-thing instance with `empty(16)` and measures, by running `reduce`,
     these moves (each `why` names it in plain words): array find the last /
     insert at 0 / remove at 0; list find the last / push front / remove the
     last; stack peek / push / pop; queue peek / join / leave; hash (words
     `cat cow dog ant bee fox eel emu`, buckets 0–7, one each) get `fox` /
     put `pig` (collides with `cat`) / remove `cat`; search tree (insert
     order 8, 4, 12, 2, 6, 10, 14, 1) find 1 / insert 3 / remove 1; heap
     (add 1..8) peek / add 0 / take smallest; graph ripple from A over the
     starter map / connect B C / cut A B. Element ids are stable (`n8`, `slot3`,
     `b0`, `A`) so the island can animate them.
  4. `copy.ts`: per slug `title`, `deck`, `caption` (In life), `parts: { what: string[]; how: string[]; where: string[]; trap: string[] }`
     as plain-text paragraphs, `sources: { label; url }[]`, and
     `neighbours(slug)`; written in full to the table and the register.
     Every number in the *How a move works* prose matches the reducer (the
     test checks the step counts quoted there).
  5. Copy `readability.ts` and `words.ts` (with `WORD_CAP = 700`) from the
     Gazette, with their tests adapted.
  6. Tests (`node:test`, flat in `_lib/`):
     - `structures.test.ts`: eight, in order, slugs `/^[a-z-]+$/`; for each,
       the example replays to the table's end state (`labels(state)`), and
       its last move's trace sentences are pinned; every `steps` equals the
       count of `step` beats; the cap refuses with one beat and the same
       state; every `costs()` value falls in the table's band; `describe`
       names every label. Specific: array find 16 → 5 steps; list end state
       `4 9 7`; stack `1 7 2`; queue front-to-back `2 9 6 1 8 3 7` with the
       tail at tile 0; hash `act` in bucket 0 behind `cat`, a 6-letter or
       capitalised word is refused; BST find 6 and find 7 are 3 steps each,
       the trace of find 6 says "less than 8" then "more than 3"; BST
       insert 1..5 on an empty tree has height 5 and find 5 costs 5 steps;
       heap row `1 3 8 5 4` after the adds, `3 4 8 5` after take smallest,
       and every parent ≤ its children after every move of a 200-move
       seeded random run; graph ripple from A gives `[["B","C","D"],["E","F","G"],["H"]]`,
       path A → H is `A C F H`, connect over 12 lines is refused; every
       reducer is pure (input state deep-equal before and after).
     - `play.test.ts` is task 3's; not here.
     - `copy.test.ts`: eight entries matching `STRUCTURES` order; title ≤ 4
       words; deck one sentence ≤ 30 words; body (all parts) 180–350 words
       (`textWords`), FK ≤ 8, mean sentence ≤ 20, longest ≤ 35; no `O(`,
       `<`, `>`, `http` in prose; ≥ 2 sources, each `https:` on the
       allowlist; `neighbours` of the first has no `prev`, of the last no
       `next`. Print words and grade in each test name.
     - `readability.test.ts`, `words.test.ts`: the Gazette's vectors
       (`fkGrade("The cat sat on the mat.")` = −1.45 ± 0.01).
     - `isolation.test.ts` (Rotor's shape, `GROUPS` from
       `readdirSync(join(ROOT, "app"))`): nothing imports another group, the
       site (`@/`) or Tailwind; `_lib/` imports no React and nothing from
       `next`; no `fetch(`, no `localStorage`, no `Math.random` and no
       `Date` in `_lib/` outside tests; only `ink.ts` and `stamps.ts` may
       import `roughjs` (none do yet: assert "at most those two"); at most
       one `"use client"` file in the group and, if present, it imports no
       `ink`, `stamps` or `roughjs` (task 3 tightens "at most" to
       "exactly").
  7. Add `'app/(structures)/_lib/*.test.ts'` to the `npm test` glob; name
     Structures' tests in the README's `npm test` sentence.
- **Interfaces:** `app/(structures)/_lib/`; `package.json`; `README.md`.
- **Non-goals:** geometry, ink, stamps or figures (task 2); any route,
  layout, CSS or component (task 3); a code panel, pseudocode or Big-O
  notation; second-series structures.
- **Acceptance:** `npm test` runs Structures' engine tests and they pass:
  eight machines whose worked examples end where the plan says, whose traces
  explain every step and count it, which refuse when full, whose costs fall
  in the plan's bands, and eight pages of words at grade 8 or under with
  sources on the allowlist.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(structures)/_lib/*.test.ts'`
  - `test "$(ls 'app/(structures)/_lib/structures/'*.ts | grep -vc index.ts)" -eq 8`
  - `grep -q '1 3 8 5 4\|1, 3, 8, 5, 4' 'app/(structures)/_lib/structures.test.ts' && grep -q 'fkGrade' 'app/(structures)/_lib/copy.test.ts'`
  - `grep -q "app/(structures)/_lib/\*.test.ts" package.json && ! test -e 'app/(structures)/layout.tsx'`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 2. The ink: stamps, scenes, In life drawings and the costs card

- **Role:** software_engineer, `qa: skip`. Depends on 1. Only
  `app/(structures)/_lib/`. No route: visitors see no change.
- **Problem:** The machines have no pictures. Each state needs a drawing
  that fits a phone without overlaps, drawn in hand ink that must stay on the
  server, plus the eight everyday drawings and a costs infographic whose
  numbers are the machine's.
- **Action items:**
  1. Read `app/(articles)/_lib/ink.ts`, `figures/kit.ts`, `figures.test.ts`,
     `app/(rotor)/_components/box.tsx` (pre-inked paths as props) and
     research §5.
  2. Copy `ink.ts` (`SEED = 214`, roughness 0.9) and `roughjs.d.ts`; copy
     `kit.ts` (`Figure = { viewBox: [number, number]; paths: InkPath[]; spot: InkPath[]; labels: Label[] }`).
  3. `stamps.ts`: `STAMP_SIZE` constants (box 44×44, plate 64×14, node
     r 20, bucket 44×30, tile 36×36, station r 14, unit arrow length 100,
     hand) and `inkStamps() → { id: string; kind; paths: string[] }[]`, eight
     kinds × three seeds, each drawn about its own origin.
  4. `scenes.ts`: `Scene = { width: 480; height; stamps: Placed[]; arrows: Arrow[]; pointers: Pointer[]; labels: Label[] }`,
     `Placed = { id; kind; seed: 0 | 1 | 2; x; y; text }`, `Arrow = { from; to }`
     (element ids), `sceneFor(slug, state)` for all eight. The array, queue
     ring and hash buckets are fixed grids; the list wraps onto a second row
     after 4 nodes; the stack grows up from a fixed floor; the tree places
     nodes by level and in-order index; the heap draws the tree above its
     row of 15 boxes; the graph uses eight fixed station positions. A stamp
     keeps its id across states so the island can move it.
  5. `life/<slug>.ts` ×8 and `life/index.ts`: each a `Figure` at viewBox
     `[480, h]` drawing the table's In life picture, one spot element (the
     thing the rule is about), ≤ 10 labels.
  6. `costs.ts`: `costsFigure(slug) → Figure`: three rows (find, add,
     remove), each a bar of `steps` small boxes (spot-coloured for the
     structure's best row), the label "`N` steps" and the band's word
     (`about the same, whatever the size` / `a few` / `every one`), built
     from `bySlug(slug).costs()`.
  7. Tests: `stamps.test.ts` (24 stamps, ids unique, every path coordinate
     inside the stamp's size + 4, same output on two calls);
     `scenes.test.ts` (for every state the example passes through, and for
     each structure at its cap: every stamp, label and pointer inside
     `0..480 × 0..height` with a 2-unit margin; no two stamps' boxes
     overlap; every arrow joins two placed ids; label size ≥ 17 so it is
     ≥ 12 px at 358 CSS px; BST insert 1..5 places five nodes at strictly
     increasing depth); `life.test.ts` and `costs.test.ts` (in frame,
     labels ≥ 17, ≤ 14 labels, at least one spot; every number in the costs
     card equals `costs()`'s; same output twice); `ink.test.ts` as the
     Gazette's with `SEED = 214`. `isolation.test.ts`: only `ink.ts` and
     `stamps.ts` import `roughjs`, and `scenes.ts` imports neither.
- **Interfaces:** `app/(structures)/_lib/`.
- **Non-goals:** the route, the island and the CSS (task 3); animation;
  changing any reducer's behaviour (a layout need that would is raised as a
  decision, not done).
- **Acceptance:** `npm test` passes with every scene of every worked example
  and every full machine in frame and free of overlaps at 390 px, eight In
  life drawings in frame with legible labels, and a costs card per structure
  whose numbers are the machine's.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(structures)/_lib/*.test.ts'`
  - `test "$(ls 'app/(structures)/_lib/life/'*.ts | grep -vc index.ts)" -eq 8`
  - `grep -q 'SEED = 214' 'app/(structures)/_lib/ink.ts' && test "$(grep -l 'roughjs' 'app/(structures)/_lib/'*.ts | grep -v test | grep -v roughjs.d.ts | grep -vc -e '/ink.ts' -e '/stamps.ts')" -eq 0`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 3. Structures at /structures: the pages, the island, the hop, the walk and the probe

- **Role:** software_engineer. Depends on 2. QA is required.
- **Problem:** The series is invisible. Readers need `/structures` and eight
  pages they can read with JavaScript off and play with it on: press a
  button, watch the structure move beat by beat with a sentence each beat,
  see the step count, all listed on `/projects` and joined to the site's hop.
- **Action items:**
  1. Read `node_modules/next/dist/docs/` on `ensureStatic`,
     `generateStaticParams` and `not-found`; `app/(articles)/layout.tsx`,
     `articles/[slug]/page.tsx`, `articles.css`; `app/(elements)/_components/table.tsx`
     (hydration flag); `app/(rotor)/_components/rotor-app.tsx`;
     `lib/motion.test.ts`; `scripts/walk-articles.sh`, `walk-rotor.sh`
     (`no_rough_in_chunks`), `probe-planisphere-touch.sh`/`.mjs`.
  2. `_lib/play.ts` (pure): `FPS = 12`, `TICKS_PER_BEAT = 6`,
     `Play = { state; trace; beat; tick; mode: "play" | "step"; done }`,
     `start(state, move)`, `tick(play)`, `next(play)` (step mode),
     `settle(play)`; `play.test.ts` (a 4-beat trace is done after 24 ticks,
     not after 23; `settle` lands on the last beat; step mode ignores ticks).
     `_lib/motion.test.ts` (Orrery's shape): the stylesheet's last block is
     `prefers-reduced-motion: reduce` and sets transitions and animations to
     none for `use`, the draw-on and `::view-transition-group(*)`.
     `isolation.test.ts`: now **exactly one** `"use client"` file,
     `_components/machine-app.tsx`, and it imports no `ink`, `stamps`,
     `kit`, `life`, `costs` or `roughjs`; no `process.env` outside
     `layout.tsx`.
  3. `layout.tsx`: `<html lang="en">`, `structures.css`, the two font calls,
     `metadata.title { default: "Structures", template: "%s · Structures" }`,
     description, `other: { "build-sha": process.env.BUILD_SHA ?? "dev" }`,
     `viewport.themeColor`, the inline `@view-transition` style and the
     pinTheme script with `suppressHydrationWarning`.
  4. `structures/page.tsx`: top bar; `<h1>` "Structures"; the deck "Eight
     ways to keep things, drawn so you can poke them."; the eight as a ruled
     list, each `<li data-page="<slug>">` with a 160 px In life thumbnail,
     the title linking `/structures/<slug>`, the deck, and three cost dots
     (one / few / all); the colophon (sources line, "More reading: The
     Otohime Gazette" → `/articles`).
  5. `structures/[slug]/page.tsx`: `ensureStatic = "navigation"`,
     `generateStaticParams`, `generateMetadata`, `notFound()`. Top bar,
     `← All pages`, "`n` of 8", `<h1>` title, deck, reading time; `<figure data-figure="life">`;
     `<figure data-figure="machine">` (`machine.tsx`); `<figure data-figure="costs">`;
     the four parts with `<h2>`s; `<aside data-sources>` with an `<ol>` of
     links; `<nav>` Previous / Next.
  6. `_components/machine.tsx` (server): `inkStamps()`, replay the example,
     render the end-state SVG (the same `sceneFor`) and pass
     `{ slug, stamps, initial, exampleTrace }` to `MachineApp`; render
     `<output aria-live="polite">` with the last sentence and
     `<ol data-trace>` with the example's last move's beats.
     `_components/machine-app.tsx` (`"use client"`): imports only React,
     `machine.ts`, `play.ts`, `scenes.ts` and `structures/`; `useReducer`
     over `play.ts`; a 12 fps `setInterval` only while a move plays, cleared
     on done/unmount; `matchMedia("(prefers-reduced-motion: reduce)")` →
     `settle`; `<defs>` of the stamps and `<use>` per placed element with
     `data-hot` on the current beat; the drawing's `aria-label` =
     `describe(state)`; the controls in `<fieldset data-controls>` (disabled
     until hydrated): one `<button>` per move, the value box
     (`type="number" inputmode="numeric"` or `type="text" pattern="[a-z]{1,5}"`;
     `pair` moves take two station letters), Enter runs `defaultMove`,
     Reset replays the example, Play/Step toggle and a "Next step" button in
     step mode; the narration `<output>` and the `<ol data-trace>` follow the
     playing move; buttons are disabled while a move plays in play mode.
  7. `_components/chrome.tsx`, `_components/figure.tsx`, `not-found.tsx`
     ("Not in this series.", link to `/structures`).
  8. `structures.css` per the Decisions row: tokens and dark scheme, the
     squared paper, the 760 px spread, figures full-width under 640 px,
     controls wrapping with 44 px tap targets and a visible focus ring,
     `use[data-hot]` fill and lift, `use { transition: transform 150ms; transform-box: fill-box; }`,
     the In life draw-on (stroke-dashoffset 1 → 0, 600 ms), nothing wider
     than 100vw at 320 px; the hop rule, the typed root fade, `fade-in` /
     `fade-out`, `h1 { view-transition-name: project-structures; }` and,
     last, the reduced-motion block.
  9. Shared edits: `content/site.ts` the plan's row, last;
     `lib/motion.test.ts` 9 → 10 (and the test name);
     `scripts/probe-motion.mjs` `PROJECTS` gets `"structures"`, every "9
     row"/"nine" becomes 10/"ten"; `lib/build-stamp.test.ts` "Structures'
     root layout publishes BUILD_SHA as <meta name=build-sha> too";
     `e2e/rbac.test.ts`: `/projects` links `/structures`, and "Structures is
     its own page, without the site's sidebar" (200, no `aria-label="Main"`,
     a `/projects` link, eight `data-page="`).
  10. `scripts/walk-structures.sh` in `walk-articles.sh`'s style (port 4069,
      local build+start or `BASE_URL`, `EXPECT_SHA`, process-group cleanup,
      `grep -c`, no `wc -l`, no `set -e`, a failure summary). `/structures`:
      200, build-sha meta, no `aria-label="Main"`, `href="/projects"`, one
      `<h1` containing "Structures", exactly eight `data-page="`, eight
      `href="/structures/` page links, no `$RC`, no `<template id="B:`, no
      `--tw-`. Each `/structures/<slug>`: 200, one `<h1`, `data-figure="life"`,
      `"machine"`, `"costs"` once each, `<fieldset disabled`, `<output`,
      `<ol data-trace` with ≥ 2 `<li`, the end-state labels from the table
      (stack `1`, `7`, `2`; hash `act` and `cat`; heap `3 4 8 5` as four
      labels; graph `H`), `data-sources` with ≥ 2 allowlisted `https://`
      links, Previous/Next per order (the array has no Previous, the graph no
      Next), ≤ 700 visible words, under 200 KB. `/structures/nope`: 404 and
      "Not in this series". `/projects` links `/structures` exactly once.
      No script chunk `/structures/stack` loads contains rough.js
      (`no_rough_in_chunks`). Source: exactly one `"use client"` file in
      `app/(structures)`.
  11. `scripts/probe-structures.sh` + `.mjs` in `probe-planisphere-touch`'s
      shape (port 4073, Playwright and axe-core into a temp prefix, local
      build or `BASE_URL`, `ok -` / `not ok -` lines, scoped to the visible
      root). At 390×844 and 1366×768: on `/structures/stack` the fieldset
      enables after hydration; Push 9 → narration "9 goes on top" and the
      `aria-label` ends with 9; Pop → the trace `<ol>` has its beats and the
      label no longer has 9; push until 7 plates, then once more → narration
      says the pile is full and the `aria-label` is unchanged; on
      `/structures/binary-search-tree` Find 6 → "Found 6 in 3 steps"; with
      motion on that sentence appears ≥ 1,000 ms after the press, with
      `reducedMotion: "reduce"` within 250 ms; Step mode: three "Next step"
      presses show three beats in order; "insert 1, 2, 3, 4, 5" → five
      `<use>` nodes with strictly increasing y; Reset restores the example's
      labels; keyboard only: Tab to the value box, type 4, Enter runs the
      default move. No console error or page error; axe (wcag2a/aa/21aa)
      finds nothing serious or critical on `/structures` and
      `/structures/heap`.
  12. README: the route-group line, the walk and probe lines, and a
      `## Structures` section on adding a structure (the `Structure` shape,
      the trace rules, the caps and bands the tests enforce).
- **Interfaces:** `app/(structures)/`; `scripts/walk-structures.sh`;
  `scripts/probe-structures.sh`; `scripts/probe-structures.mjs`;
  `content/site.ts`; `lib/build-stamp.test.ts`; `lib/motion.test.ts`;
  `scripts/probe-motion.mjs`; `e2e/rbac.test.ts`; `README.md`.
- **Non-goals:** a code panel, pseudocode, a quiz, progress saving, share
  URLs; a sidebar entry or a change to `/notes`; second-series structures;
  any change to another project's look; any new dependency in
  `package.json`.
- **Acceptance:** `/projects` lists Structures with a mint dot; the title
  hops into the index; the index lists eight pages in order with drawings
  and cost dots; each page shows its In life drawing, a machine that plays
  each move beat by beat with a narrated sentence and a step count and
  refuses when full, a costs card that agrees with the machine, short words
  and sources, and Previous/Next; with JavaScript off every page shows the
  worked example's end state and its steps; `/structures/nope` is a 404
  saying "Not in this series."; it fits 320 px, works in light and dark, by
  keyboard and with reduced motion.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `bash -n scripts/walk-structures.sh && bash -n scripts/probe-structures.sh && ! grep -nE 'wc +-l' scripts/walk-structures.sh`
  - `bash scripts/walk-structures.sh`
  - `if BASE_URL=http://127.0.0.1:4071 bash scripts/walk-structures.sh; then exit 1; fi`
  - `bash scripts/probe-structures.sh`
  - `bash scripts/probe-motion.sh`
  - `test "$(grep -rl '"use client"' 'app/(structures)' | grep -c .)" -eq 1 && grep -q 'ensureStatic = "navigation"' 'app/(structures)/structures/[slug]/page.tsx'`
  - `grep -q 'href: "/structures"' content/site.ts && grep -q '/structures' e2e/rbac.test.ts && grep -q 'structures' lib/build-stamp.test.ts && grep -q '"structures"' scripts/probe-motion.mjs && grep -q 'project-structures' 'app/(structures)/structures.css'`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

## QA (task 3)

Headless Chrome (playwright-core in a scratch directory) at 1366×768, 390×844
and 320×640, light and dark, motion on and reduced, against a local
`next start` at the delivery sha or the deployed site.

- The index and two pages (stack, search tree) read as a notebook spread;
  nothing scrolls sideways at 320 px; the three figures and their labels are
  legible at 390 px (≥ 12 px measured).
- Play the stack and the search tree by mouse and by keyboard only: each move
  animates in beats, the narration matches the picture, the step count is
  right, a full machine refuses with a sentence, Reset restores the example,
  Step mode advances one beat a press.
- On two pages, compare the costs card with the machine: do the card's worst
  find on the machine and check the count.
- JavaScript off: the index, a page, Next and the index all work; the machine
  shows the example's end state, its steps and greyed controls.
- Reduced motion: moves land at once; the In life drawing shows complete.
- `bash scripts/walk-structures.sh`, `bash scripts/probe-structures.sh` and
  `bash scripts/probe-motion.sh` pass; no console errors; Lighthouse
  accessibility ≥ 95 on both page types.

## Acceptance

After CI deploys: `BASE_URL=https://otohime.dev bash scripts/walk-structures.sh`
(with `EXPECT_SHA` the delivery sha), `BASE_URL=https://otohime.dev bash scripts/probe-structures.sh`
and `BASE_URL=https://otohime.dev bash scripts/probe-motion.sh` exit 0. On
otohime.dev: `/projects` → Structures (the title hops into the `h1`) → the
stack → Push 9, Pop → Next → the queue: Join, Leave → `← All pages`; then the
heap with JavaScript off; `/structures/nope` is a 404 with "Not in this
series."; `/projects` lists Structures once with a mint dot.

## Risks

- **Scene overlap on a phone.** The 4-level tree (15 nodes) and the heap's
  tree-plus-row are the densest. The scene test fails on overlap; if a
  4-level tree cannot fit 480 units with node r 20, drop the BST and heap
  caps to 3 levels (7 nodes) and give the 1..5 trap demo a taller scene
  (its five levels are a diagonal, one node a level, so it never crowds).
  Every worked example fits either way; record the change as a decision.
- **`<use>` transform transitions.** If an engine stutters, re-place without
  the transition; the still is unchanged and the probe's timing check still
  holds (it measures the beats, not the glide).
- **Words vs grade 8.** Computing words are long; the register puts the
  picture first and keeps jargon in labels. If a page fails the FK cap,
  split sentences, never loosen the cap.
- **Fonts at build.** If Google Fonts fails during a build, Orrery's build
  fails too: the cause is the environment, not this change.
- **The motion probe's tenth row.** `probe-motion.mjs` counts rows and
  delays; ten rows keep the same rule. If its reduced-motion check catches
  the draw-on, fix the CSS, not the probe.
