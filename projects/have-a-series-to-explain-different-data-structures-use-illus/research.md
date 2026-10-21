# Research: Structures, a drawn series on data structures at `/structures` (pm-214, run-7054)

Submitted as rep-4042 by the research run; committed unchanged by the product
owner (run-7055). Where the plan departs from it, [plan.md](plan.md) says so
and the decision is recorded.

**Idea.** "Have a series to explain different data structures. Use illustration, infography to make the concept easy to understand. Interactive if possible."

**Short answer.** Build **Structures**, the tenth row on the Projects bench, as its own route group `app/(structures)/` serving `/structures` (the series index) and `/structures/<slug>` (one page per structure), in the house recipe every project since Shore follows: own root layout and stylesheet, no Tailwind, pure data and pure drawing code under `_lib/` proven by `node --test`, an isolation test, a walk script, a row in `content/site.ts`. Eight pages in the first series: **array, linked list, stack, queue, hash table, binary search tree, heap, graph**.

Each page is one spread on squared notebook paper, in the Orrery hand lettering, with three drawings and a short text:

1. **In life**: an everyday object inked by rough.js on the server (a chest of drawers, a treasure hunt, a pile of plates, a line at a counter, a coat check, a guessing game, a tournament ladder, a metro map).
2. **The machine**: the structure itself, drawn in the same ink, that the reader works with buttons and a number box. Every move (push 7, find 6, remove the front) is a **pure reducer** that returns the new state **and a trace**: a list of (picture, sentence) beats such as "6 is less than 8, so go left". The island plays the trace on twos at 12 fps, narrates each beat in a live line, and **counts the looks**: finding 6 took 3 looks. With JavaScript off the page still shows the worked example's final picture and its trace as a numbered list, so the explanation is complete without a script.
3. **The costs**: an infographic drawn from the same reducers: for eight things, how many looks a find, an add and a remove take (1, 3 or 8), as bars of boxes, so the Big-O table is a picture whose numbers the machine reproduces.

The text is held to the Gazette's measured caps (180 to 350 words, Flesch-Kincaid grade 8 or under, no sentence over 35 words) and every page links its Wikipedia entry and one place the reader meets the structure (MDN or the Python docs). The whole project is about 2,500 lines, one plan, three build tasks plus QA and acceptance, in the shape of the Gazette and Rotor plans.

## 1. The repo today (34c0e43, 2026-10-21)

- Nine projects follow the house recipe (Shore, Capsule, Orrery, Elements, Vinyl, Rotor, Planisphere, Barometer, Gazette). Each has its own root layout, a hand-written stylesheet, `_lib/*.test.ts` under `npm test`, an `isolation.test.ts` that reads the other route groups from `app/`, a `scripts/walk-<name>.sh`, a row in `site.projectList`, a line in `e2e/rbac.test.ts` (`href="/articles"` at line 95, a 200 at line 171) and `lib/build-stamp.test.ts` (line 72), and a README block. Baseline this run: `npm ci` then `npm test` passes **859** tests in 14 s.
- The motion rules (pm-206) are read from the tree by `lib/motion.test.ts`: the stylesheet carries the hop rule, the typed root fade, `fade-in`/`fade-out`, `h1 { view-transition-name: project-<group>; }` and a last `prefers-reduced-motion` block that zeroes `::view-transition-group(*)`; the root layout repeats `@view-transition{navigation:auto;types:hop}` in an inline `<style>`; and **the route-group directory name equals the URL slug** (the test derives the `h1` name and the `/projects` row from it). So the group is `app/(structures)/` at `/structures`.
- `lib/motion.test.ts:69` asserts `PROJECTS.length === 9` and `scripts/probe-motion.mjs` hard-codes the nine slugs (line 30) and "9 row rise animations" (line 504). The new project edits both to ten; the probe then hops `/projects` → `/structures` on its own.
- The one-island rule is the house pattern for an interactive project: Rotor, Planisphere and Barometer each assert **exactly one `"use client"` file** and **no rough.js in any client chunk** (`app/(rotor)/_lib/isolation.test.ts:91,113`, `scripts/walk-rotor.sh:237`). Rotor's island gets the pre-inked box as props from the server (`box.tsx`) and draws only the moving parts itself. Structures follows this: the ink is stamped on the server, the island places stamps.
- Machines are pure reducers played on twos (`lib/machines.ts`, Rotor's `machine.ts`, Capsule's `reveal.ts`): `(state, action) => state`, `tick` advances a frame, reduced motion jumps to the last pose. The trace design in §3 is this pattern with the frames made explicit.
- The Gazette (pm-213, landed today) gives the text engine to copy: `readability.ts` (`syllables`, `sentences`, `fkGrade`, `longestSentence`, `meanSentence`, `readingMinutes`), `words.ts`, `ink.ts` and `figures/kit.ts` (`Figure = { viewBox, paths, spot, labels }`, labels 17 or 18 at a 480 viewBox so they stay 12 px or more on a 390 px phone). Copied, never imported: a group owes nothing to another.
- The Gazette is not the home for this series: its contract is **zero** client code (`app/(articles)/_lib/isolation.test.ts`), and the idea asks for interaction. A link from the index page's colophon to the Gazette is enough ("More reading: The Otohime Gazette").
- No other otohime plan is active (pm-209 is mono-v2), so the shared lines (`content/site.ts`, `package.json`, `e2e/rbac.test.ts`, `lib/build-stamp.test.ts`, `lib/motion.test.ts`, `scripts/probe-motion.mjs`, `README.md`) have no competing editor today. On a rebase conflict keep both sides (lesson iss-9).
- Walk and probe ports in use: 4019 to 4065 and 4067 (the Gazette's dead-port check). Structures' walk takes **4069**, 4071 for its "nothing listens" negative check, and its browser probe **4073**.
- The brief names `projects/20260921222547_plan_manager_chief_of_staff_extraction.md` and `docs/claude/software-development.md`; neither exists in this checkout, and `AGENTS.md` holds only the `next dev` block. The Gazette and Rotor plans are the rules (decision recorded).
- A fresh checkout has no `node_modules`; every task starts with `npm ci` (20 s). `fonts.googleapis.com` answers from the pod, so `next/font/google` can fetch Caveat and Patrick Hand at build as Orrery, Rotor, Planisphere and Barometer do.

## 2. What was checked, and what was not built

| Question | Answer | How |
| --- | --- | --- |
| Can a static `[slug]` route prerender eight pages and 404 the rest while one of its children is a client island? | Yes: Elements does exactly this (`elements/[symbol]/page.tsx` is static, `table.tsx` and `element-dialog.tsx` are islands). `ensureStatic = "navigation"` + `generateStaticParams` + `notFound()` is the Orrery and Gazette shape. | Read the three pages; not rebuilt. |
| Can rough.js stay off the client while the picture changes with every move? | Yes. The server inks a fixed **kit of stamps** (box, plate, node, arrow, pointer hand, bucket, each in three seeds) once and passes them as props; the island renders them in `<defs>` and places `<use href="#box-1" transform="translate(x y)">` per element. Rotor already hands pre-inked paths to its island. A unit arrow of length 100 scaled by `transform` keeps the hand look at the lengths the layouts need (40 to 180). | Read `rotor-app.tsx`'s props and `box.tsx`; the stamp idea is a design, checked against the one-island and no-rough rules. |
| Are the worked examples sound and small enough to draw? | Yes. Computed this run (`/tmp/ex.mjs`): BST insert 8, 3, 10, 1, 6, 14 gives a tree of height 3; find 6 is 3 looks, find 7 is 3 looks then "not here"; inserting 1, 2, 3, 4, 5 in order costs 1, 2, 3, 4, 5 looks (the list in disguise). Min-heap insert 5, 3, 8, 1, 4 is `1,3,8,5,4` with 1 sifting up twice; pop gives 3 with one swap. Letter-sum hash into 8 buckets: cat → 0, dog → 2, **act → 0** (an anagram collides, the teaching point), fox → 5, bee → 4, ant → 3, cow → 1, hen → 3 (collides with ant). | `/tmp/ex.mjs`, this run. |
| Is the readability cap reachable for computing prose? | The Gazette's six bodies pass FK ≤ 8 on harder topics (tides, GPS). Structures text avoids "O(n)" in the body (it goes in the costs card as "8 looks for 8 things") and says "look", "box", "arrow", "pile", "line". | Judgement from the Gazette's pinned numbers; the test enforces it. |
| Is any dependency needed? | No. Reducers, layouts and traces are plain TypeScript; ink is rough.js (already a dependency); the island is React; motion is CSS and a 12 fps tick. `package.json` changes only in the `test` glob. | — |
| Throwaway `next build` | **Skipped.** Static `[slug]` with an island (Elements), Google fonts at build (Orrery), cross-group isolation (every project) and pre-inked props into an island (Rotor) each already ship on this config; a build would only repeat them (decision recorded). | — |

## 3. The product

**The look.** A page of squared notebook paper: `--paper #f6f3ea` with a 24 px grid drawn by two CSS linear gradients in `--grid #dcd6c6` (no fetch, no image), ink `--ink #1d1b17`, one spot colour `--spot #2456b3` (a fountain-pen blue, so it reads as the thing being pointed at, not a warning), a second accent `--hot #c8402f` only for the beat the machine is on now. Dark from the OS or the pinned `localStorage.theme` (Barometer's script and CSS shape): paper `#161513`, grid `#2a2722`, ink `#ebe5d6`, spot `#7aa2ff`, hot `#ff8a73`. Titles in Caveat, everything else in Patrick Hand at 19 px/1.5 (Orrery's two faces via `next/font/google` with literal options and `cursive` fallbacks). Each structure's page is one `<article>` at 760 px max, with the three figures full width on a phone and the machine's controls under it.

**The index, `/structures`.** Top bar as every project (`otohime.dev`, `← All projects`, plain `<a>` since they cross root layouts). The `h1` "Structures" (the row title on `/projects` morphs into it on the hop), a one-line deck ("Eight ways to keep things, drawn so you can poke them."), then the eight pages as a ruled list in series order: a 160 px thumbnail of each **In life** drawing, the title, the one-sentence promise, the three costs as tiny dots (1, 3 or 8 looks). A colophon with the sources line and a link to the Gazette.

**A page, `/structures/<slug>`.** Top bar, `← All pages`, then:

- **Head:** `n of 8` in small hand caps, the `h1` (e.g. "The stack"), the deck (one sentence, ≤ 30 words), reading time.
- **In life** (`<figure data-figure="life">`): the everyday object, inked on the server from `_lib/life/<slug>.ts` (a `Figure` in the Gazette's kit shape), with a caption that names the rule in one sentence ("The last plate on is the first plate off.").
- **The machine** (`<figure data-figure="machine">`): the island. Above the drawing, the **narration line** (`<output aria-live="polite">`), which reads the current beat ("6 is less than 8, so go left") and, when a move finishes, its cost ("Found 6 in 3 looks"). The drawing: an SVG `role="img"` whose `aria-label` the island keeps current ("A stack of 3 plates, 1, 7, 4; 4 is on top"). Under it, the **controls**: real `<button>`s for the structure's moves and one `<input type="number" inputmode="numeric">` (or `type="text" pattern="[a-z]{1,5}"` for the hash table and graph) where a move takes a value; a **Reset** that replays the worked example; a **Speed** toggle (beats at 12 fps on twos: 6 ticks a beat, or "step" mode where each press advances one beat, which is also what the keyboard user gets with Space). The trace of the last move is printed under the controls as an `<ol data-trace>` of sentences, so a reader can review it. Each structure has a **cap** (7 plates, 8 slots, 15 tree nodes, 8 buckets × 3, 8 stations) and a full machine refuses the move with a sentence ("The pile is full. A real one would say stack overflow.").
- **The costs** (`<figure data-figure="costs">`): three rows, find, add, remove, each a bar of 1, 3 or 8 small boxes drawn by the kit, labelled "1 look", "3 looks", "8 looks" and the plain reason ("walk from the front"). The numbers come from running the reducer on an eight-thing worked example at build, so a cost in the card is a cost the machine shows.
- **The words**: 180 to 350 words in four short parts: *What it is* (the picture in a sentence), *How a move works* (the worked example in prose), *Where you meet it* (two or three everyday places: the back button, the print queue, your phone's contacts), *Watch out for* (the one trap: sorted input bends a search tree into a list; anagrams collide; an array insert at the front moves everything). A boxed **Sources** list (`https` on the allowlist), then `← Previous` and `Next →` in series order.

**Motion.** The house grammar: the In life ink draws itself on at load (`pathLength="1"`, 600 ms), nothing else moves until a button is pressed. A move plays its trace at 12 fps on twos: a beat is 6 ticks; on the beat's first tick the hot element is marked `data-hot` (the CSS fills the stamp with `--hot` and lifts it 2 px), a moving element travels to its new place over the beat with a CSS `transition: transform 150ms` on the `<use>` (a transform transition, so no reflow, and pure CSS so the still is the whole drawing), the narration line changes text. Under reduced motion every beat lands at once, the narration shows the last sentence and the `<ol data-trace>` carries the rest; `motion.test.ts` (Orrery's shape) proves the stylesheet's last block zeroes every transition and animation.

**No JavaScript, on purpose, still a page.** The server renders the machine at the worked example's end state (the stamps are placed by the same pure `layout`), the narration line holds the example's last sentence, and the trace list is complete. The controls are inside a `<fieldset disabled data-controls>` that the island enables on hydration (Elements' `useSyncExternalStore` hydration flag), so a reader without a script sees greyed buttons, not dead ones. The walk checks each page's server HTML holds the end state's labels and a trace of at least two `<li>`.

**Keyboard and screen readers.** Buttons are buttons; the number box submits on Enter to the structure's default move (push, append, insert, add). Arrow keys are not captured (nothing here is a grid). The narration is `aria-live="polite"`, the drawing's `aria-label` restates the state, every stamp label is real `<text>`. The probe runs axe on two pages.

**What is not here, on purpose:** a code panel, pseudocode, Big-O notation in the body, a quiz, progress saving, a share URL, MDX, a CMS. A structure is a TypeScript file each; adding one is a commit. Second-series candidates in the same shape: trie, set, deque, LRU cache, union-find, Bloom filter, B-tree, skip list.

## 4. The first series: eight pages

Series order is teaching order (each page uses only pictures from earlier ones). The sources allowlist: `https` on `en.wikipedia.org`, `developer.mozilla.org`, `docs.python.org`, `en.cppreference.com`.

| # | Slug · title | In life | The machine: moves (cap) | Worked example (Reset replays it) | Costs for 8 things: find · add · remove | Watch out for | Sources |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `array` · The array | A chest of eight numbered drawers | `read i`, `set i`, `insert at i`, `remove at i`, `find x` (8 slots) | set 0..4 to 4, 8, 15, 16, 23; insert 7 at 1 (4 moves); find 16 (4 looks) | 8 looks (walk) · 8 looks at the front, 1 at the end · 8 looks at the front | Putting one thing at the front moves everything behind it | Wikipedia: Array (data structure); MDN: Array |
| 2 | `linked-list` · The linked list | A treasure hunt: each note says where the next one is | `push front`, `append`, `find x`, `remove x` (7 nodes) | push front 3, 9, 4; append 7 (3 hops); find 9 (2 looks); remove 4 (3 looks + relink) | 8 looks · 1 look at the front, 8 at the back · 8 looks (find it first) | There is no drawer 5: to reach the fifth note you read four | Wikipedia: Linked list; Python docs: collections.deque |
| 3 | `stack` · The stack | A pile of plates by the sink | `push x`, `pop`, `peek` (7 plates) | push 1, 7, 4; peek (1 look); pop → 4; push 2 | 1 look (the top) · 1 · 1 | A full pile overflows; a pop on an empty pile is a mistake | Wikipedia: Stack (abstract data type); MDN: Array.prototype.push |
| 4 | `queue` · The queue | A line at a bakery counter, with a ring of 8 tiles under it | `enqueue x`, `dequeue`, `peek` (8 tiles, head and tail hands on the ring) | enqueue 5, 2, 9; dequeue → 5; enqueue 6, 1, 8, 3, 7 (the tail wraps to tile 0) | 1 (the front) · 1 · 1 | A queue in a plain array must wrap round, or it walks off the end | Wikipedia: Queue (abstract data type); Wikipedia: Circular buffer |
| 5 | `hash-table` · The hash table | A coat check: the ticket number is worked out from the coat | `put word`, `get word`, `remove word` (8 buckets, chains of 3); hash = sum of letter positions mod 8, shown as a sum on the beat | put cat (24 → 0), dog (26 → 2), fox (45 → 5), **act (24 → 0, lands behind cat)**; get act (2 looks) | 1 look, 2 on a collision · 1 · 1 | Anagrams collide here; a real hash mixes the letters' order in | Wikipedia: Hash table; MDN: Map |
| 6 | `binary-search-tree` · The search tree | A guessing game: higher or lower | `insert x`, `find x`, `remove x`, `insert 1, 2, 3, 4, 5` (a one-button demo of the trap) (15 nodes, 4 levels) | insert 8, 3, 10, 1, 6, 14; find 6 (3 looks); find 7 (3 looks, not here) | 3 looks · 3 · 3 (and 8 when the tree is a list) | Sorted input makes a list, and a find costs 8 again | Wikipedia: Binary search tree; Wikipedia: Binary search |
| 7 | `heap` · The heap | A tournament ladder where the smallest number wins every match, with the same numbers in a row of boxes underneath | `add x`, `take smallest` (15 nodes, shown as a tree and the array it really is) | add 5, 3, 8, 1, 4 (1 climbs twice); take smallest → 1, 4 sinks once | 1 look for the smallest · 3 · 3 | The row of boxes is the tree: a child of box i is box 2i+1 and 2i+2 | Wikipedia: Binary heap; Python docs: heapq |
| 8 | `graph` · The graph | A metro map of eight stations | `connect a b`, `cut a b`, `ripple from a` (breadth first: stations light up by hops), `path a b` (8 fixed stations, 12 edges max) | the starter map (8 stations, 9 lines); ripple from A (levels 1, 2, 3); path A → H (3 hops) | a ripple touches every station once: 8 looks · 1 (draw a line) · 1 | A map is not a tree: two routes can reach the same station, so remember where you have been | Wikipedia: Graph (abstract data type); Wikipedia: Breadth-first search |

## 5. The engine (`_lib/`, pure, no React)

```ts
// app/(structures)/_lib/machine.ts: what every structure provides.
export type Beat = { say: string; hot?: string[]; move?: Record<string, string> }; // one picture and one sentence
export type Move<S, A> = { state: S; trace: Beat[]; looks: number; refused?: string };
export type Structure<S, A> = {
  slug: string;
  cap: number;
  empty: S;
  moves: readonly { id: string; label: string; takes: "none" | "number" | "word" | "index" }[];
  reduce: (s: S, a: A) => Move<S, A>;     // pure; a refused move returns the same state and one beat
  layout: (s: S) => Scene;                 // where every stamp, arrow and pointer goes, in a 480-wide viewBox
  describe: (s: S) => string;              // the drawing's aria-label
  example: readonly A[];                   // the worked example Reset replays
  costs: (n: number) => { find: Cost; add: Cost; remove: Cost }; // from running reduce on n things
};
export type Scene = { height: number; stamps: Placed[]; arrows: Arrow[]; pointers: Pointer[]; labels: Label[] };
export type Placed = { id: string; stamp: "box" | "plate" | "node" | "bucket" | "tile" | "station"; x: number; y: number; text: string; hot?: boolean; spot?: boolean };
export type Cost = { looks: number; why: string };
```

- `structures/{array,linked-list,stack,queue,hash-table,binary-search-tree,heap,graph}.ts`: one `Structure` each. The trace is produced by the reducer itself (it is the explanation, not a replay), so a test can assert a trace's sentences without a browser.
- `play.ts`: the island's clock, pure: `(play, "tick") => play` steps through a move's beats six ticks apiece; `settle` lands on the last beat (reduced motion, tests). `FPS = 12`, `TICKS_PER_BEAT = 6`, `step` mode advances a beat per press.
- `stamps.ts`: inks the kit on the server, `SEED = 214`, roughness 0.9: `box` 44×44, `plate` 64×14, `node` r 20, `bucket` 44×30, `tile` 36×36, `station` r 14, a unit `arrow` of length 100 and a `hand` pointer, three seeds each; returns `{ id, paths: InkPath[] }[]`. Sizes are constants the layouts share.
- `life/<slug>.ts` ×8 and `costs.ts`: pure `Figure`s in the Gazette kit shape (`viewBox`, `paths`, `spot`, `labels`), `costs.ts` built from `Structure.costs(8)`.
- `copy.ts`: the eight pages' words as data (`title`, `deck`, `parts: { what, how, where, trap }` as plain paragraphs, `sources`, `captions`), with the Gazette's `Fact` idea kept where a number appears in prose (the costs and the example's counts).
- `readability.ts`, `words.ts` (`WORD_CAP = 700` for a page), `ink.ts`, `roughjs.d.ts`: the Gazette's copies.
- Tests (`*.test.ts`): `structures.test.ts` (for each of the eight: the worked example replays to a pinned end state and pinned trace sentences; the cap refuses with one beat; every `looks` equals the trace's number of look beats; `costs(8)` is pinned to §4's table; BST `insert 1..5` ends at height 5; hash `act` lands in bucket 0 behind `cat`; heap's array after the example is `1,3,8,5,4` and every parent ≤ its children after every move; the graph's ripple from A lists levels; `describe` names every element), `play.test.ts`, `layout.test.ts` (every scene of every state reached by the example stays inside the viewBox with a 2-unit margin, no two stamps overlap, every arrow joins two placed stamps, label size ≥ 17), `stamps.test.ts` (eight kinds × three seeds, paths inside their boxes, same bytes on two calls), `life.test.ts` and `costs.test.ts` (in frame, labels ≥ 17, every cost in the card is `costs(8)`'s number), `copy.test.ts` (eight entries in series order, slugs `/^[a-z-]+$/`, title ≤ 4 words, deck ≤ 30, body 180 to 350 words, FK ≤ 8, mean sentence ≤ 20, longest ≤ 35, no `O(`, every source `https` on the allowlist, ≥ 2 sources, no `<`, `>` or `http` in prose), `readability.test.ts`, `words.test.ts`, `ink.test.ts`, `motion.test.ts`, `isolation.test.ts` (Rotor's shape: no import of the site, Tailwind or another group; `_lib/` imports no React or `next`; only `ink.ts` and `stamps.ts` import roughjs; **exactly one** `"use client"` file and it imports no ink, stamps or roughjs; no `fetch(`; no `process.env` outside `layout.tsx`).

## 6. The page files

```
app/(structures)/
  layout.tsx                    own <html lang="en">, structures.css, Caveat + Patrick_Hand via next/font/google (literal options,
                                cursive fallbacks), build-sha meta, the inline @view-transition style, the theme-pin script,
                                themeColor light #f6f3ea / dark #161513
  structures.css                tokens (light/dark), the squared paper, the spread, figures, controls, the hot and spot fills on <use>,
                                the transform transition, draw-on, the hop block, h1 { view-transition-name: project-structures; },
                                the reduced-motion block last
  structures/page.tsx           the index, server only; ensureStatic = "navigation"
  structures/[slug]/page.tsx    one page; generateStaticParams over the eight; notFound() for the rest; generateMetadata
  not-found.tsx                 "Not in this series." with a link to the index
  _components/chrome.tsx        top bar (plain <a> home and /projects), the page head, Previous / Next, the colophon
  _components/figure.tsx        <figure role="img"> for a Figure (the Gazette's, copied)
  _components/machine.tsx       server: inks the stamps, runs the example to its end state, renders <MachineApp> with
                                { slug, stamps, initial state, example } and the no-JS trace list
  _components/machine-app.tsx   the one "use client" file: useReducer over play.ts, the controls, the narration <output>,
                                the SVG of <defs> + <use>, the hydration flag that enables the fieldset
  _lib/ machine.ts play.ts stamps.ts copy.ts readability.ts words.ts ink.ts roughjs.d.ts costs.ts
        structures/{array,linked-list,stack,queue,hash-table,binary-search-tree,heap,graph}.ts life/<slug>.ts ×8  *.test.ts
scripts/walk-structures.sh      port 4069 (4071 dead-port check)
scripts/probe-structures.sh     port 4073, Playwright + axe into a temp prefix (probe-planisphere-touch's shape)
content/site.ts · lib/build-stamp.test.ts · lib/motion.test.ts (9 → 10) · scripts/probe-motion.mjs (slugs, 9 → 10) · e2e/rbac.test.ts · package.json · README.md
```

Row in `content/site.ts`: `{ title: "Structures", note: "Eight ways to keep things, drawn by hand so you can poke them.", href: "/structures", status: "live", colour: "mint" }` (mint is used once, by Shore; every swatch is taken at least once).

**Walk, `scripts/walk-structures.sh`** (port 4069, Rotor's style, `grep -c`, servers killed by process group): `/structures` is 200 with the build-sha meta, no `aria-label="Main"`, a `/projects` link, one `<h1` naming Structures, exactly eight `data-page="` rows and eight links, no `$RC` and no `<template id="B:`, only its own stylesheet; each of the eight `/structures/<slug>` is 200 with one `<h1`, three `data-figure="` (`life`, `machine`, `costs`), one `<fieldset disabled`, an `<output`, an `<ol data-trace` with at least two `<li`, the example's end-state labels (the stack page shows `1`, `7`, `2`; the hash page shows `act` and `cat`), a Sources box of at least two `https://` links on the allowlist, Previous / Next in series order, at most 700 visible words, under 200 KB; `/structures/nope` is a 404 saying "Not in this series"; `/projects` links `/structures` once; at source, exactly one `"use client"` file under `app/(structures)`, and no client chunk the page references contains rough.js (Rotor's `no_rough_in_chunks`); `structures.css` is the only stylesheet. Negative: `BASE_URL=http://127.0.0.1:4071 bash scripts/walk-structures.sh` exits non-zero.

**Probe, `scripts/probe-structures.sh`** (port 4073, 390×844 and 1366×768, motion on and reduced): on `/structures/stack` the fieldset is enabled after hydration; pressing Push with 9 makes the narration say "9 goes on top" and the drawing's `aria-label` list 9 last; Pop removes it and the trace list has one `<li>`; a seventh push then an eighth makes the narration say the pile is full and the state does not change; on `/structures/binary-search-tree` Find 6 ends with "Found 6 in 3 looks" and, with motion on, the beat lands at 500 ms ± 100 (6 ticks at 12 fps), while under reduced motion it lands within one frame; the `1, 2, 3, 4, 5` button draws five nodes in one column; Reset restores the worked example; no console or page error; axe finds nothing serious. The probe scopes to the visible root (lesson: soft navigations keep hidden roots).

## 7. Plan shape (for the product owner)

Three build tasks, in order, each with `verification[]`, in the Gazette plan's form:

1. **The structures and their words** (software_engineer, `qa: skip`; `_lib/` only, no route): `machine.ts`, `play.ts`, the eight `structures/*.ts` with their traces and costs, `copy.ts` with the eight pages written in full to §4 and §5's caps, `readability.ts`, `words.ts`, their tests, the `npm test` glob, the README test line. (`lib/motion.test.ts` skips a group without `layout.tsx` since pm-213, so an engine-only task is safe.)
2. **The ink: stamps, scenes, In life and the costs** (software_engineer, `qa: skip`; depends on 1): `ink.ts`, `stamps.ts`, the eight `layout`s filled in, `life/*.ts`, `costs.ts`, their geometry tests.
3. **The pages: the island, the hop, the walk and the probe** (software_engineer, QA required; depends on 2): layout, CSS, both pages, `not-found.tsx`, the components, the `content/site.ts` row, `lib/build-stamp.test.ts`, `lib/motion.test.ts` and `scripts/probe-motion.mjs` to ten, `e2e/rbac.test.ts`, the walk, the probe, the README block.

QA for task 3 reads two pages at 390 px and 1366 px (no sideways scroll, the three figures legible, the controls reachable, light and dark), plays the stack and the search tree by mouse and by keyboard, checks the costs card against the machine's counts, reads one page with JavaScript off, and runs the walk, the probe and the motion probe. Acceptance walks `/projects` → Structures → the stack → Push, Pop → Next → the queue → the index on the deployed site, with JavaScript off once.

**Decisions this research made (recorded):** the series is a new project `(structures)` at `/structures`, not a Gazette section, because the Gazette's contract is zero client code and the idea asks for interaction; the machine's explanation is the reducer's own trace (picture + sentence per beat), so the narration, the look count and the costs card come from one pure source; rough.js stays on the server as a kit of stamps the island places with `<use>`; static pages with one island and a no-JS still (the worked example and its trace), not Rotor's per-request query; eight structures in teaching order; the Gazette's readability caps apply; no throwaway build; three build tasks.

## 8. Risks

- **Scene overlap on small screens.** The BST at 15 nodes and the graph at 8 stations are the densest scenes; the layout tests check no overlap at the 480 viewBox and the caps keep them bounded. If a 4-level tree is tight at 390 px, drop the cap to 3 levels (7 nodes); the worked example fits either.
- **A `<use>` with a transform transition.** Chromium, Firefox and Safari all transition `transform` on `<use>` when `transform-box: fill-box` is set; the probe measures the beat. If one engine stutters, the fallback is to re-place without a transition (the still is unchanged).
- **The hash's teaching point depends on the word box.** Limit it to 1 to 5 lowercase letters (`pattern`), and the reducer refuses anything else with a sentence, so the sum stays small and the beat can show it.
- **Text caps and computing words.** "Dequeue" and "algorithm" are heavy syllables; the writer keeps them in the labels and uses "join the line" and "leave the line" in prose. The FK test says when a paragraph needs another pass.
