# Capsule, printed: a sophisticated card set and a draw you cannot read early (pm-196)

**Idea.** Page https://otohime.dev/capsule. "Redesign the art style (more
sophisticated), make the spinning process more intriguing because right now
users can already guess what the cards are."

**Product.** `otohime.dev/capsule` keeps its coin, crank and twelve-card album,
but every card is redrawn as a **printed trading card**. The outlines are thin
rough-inked lines, shade is hatched, the palette is muted, the paper is
grained, and each card has a numbered double-rule frame with a serif name
plate. The machine is redrawn in the same ink. The draw stops giving itself
away. Every capsule is the same shell, the crank turns for a seeded, varying
length, and one capsule visibly falls out of the dome. Opening is staged:
shake, part, the card back rises, the tier edge draws on, then the card flips.
The tier is the **last** thing you learn. Unfound album slots are numbered card
backs, not silhouettes, and the album does not fill in until the card is
revealed. You can grab the crank and pull it round by hand; the Turn button
still works.

Research: [research.md](research.md) (run-6624, rep-3759), checked against the
repo at 9911e40. The plan document named in the run prompt
(`projects/20260921222547_plan_manager_chief_of_staff_extraction.md`) and
`docs/claude/` are not in the repo; this plan follows `AGENTS.md`, `README.md`
and the pm-184 (Capsule) and pm-189 (Sun) plans.

## Why the draw is guessable today (five leaks)

| # | Leak | Where | Fixed in |
| --- | --- | --- | --- |
| 1 | The capsule's top half is coloured by tier (`CAPSULE[tier]`) from turning frame 8 through `ready`, in the same colours as the enlarge dialog's tier badges | `_components/machine.tsx` | Task 2 |
| 2 | An unowned album slot shows the card's exact grey silhouette and its tier name; the grid is grouped by tier | `_lib/art/svg.ts` `cardFaceSvg(…, ghost)`, `album.tsx` | Task 1 |
| 3 | The served HTML names every slot (`data-slot="totoro"`), and the ghost's `aria-label` says "a legend card" | `album.tsx`, `card.tsx` | Task 1 |
| 4 | Turn commits the draw and saves the ledger at once, so the album slot, its `×n` and the tally change **while the crank is still turning** | `capsule-app.tsx` `crank()` + `Album ledger={ledger}` | Task 3 |
| 5 | Turn is always 12 frames and Open always 8, the dropping capsule appears from nowhere, and the card pops in face-up with name, film and year at once | `_lib/machine.ts`, `machine.tsx`, `capsule-app.tsx` | Task 3 |

Leak 4 was not in the research. It is the most direct giveaway of the five,
because the album already shows the card before Open is pressed.

## Decisions

| Decision | Why |
| --- | --- |
| Keep the engine (`cards.ts`, `rng.ts`, `ledger.ts`, the draw in `gacha.ts`, rates, pity, coins, `capsule-v1` storage) and every drawing's path data. Change the renderer, the frame, the machine, the staging and the album view. | The draw is honest and tested. The guessability is in the presentation leaks above, not in the seeded draw. |
| **Printed ink.** Copy Sun's `app/(sun)/_lib/ink.ts` and `roughjs.d.ts` into `app/(capsule)/_lib/art/` (they are copies, not imports: Sun's isolation test forbids importing Capsule, and Capsule must not reach into Sun either). rough.js `generator.path` per stroked shape: `roughness 0.55`, `bowing 0.6`, `disableMultiStroke: true`, `strokeWidth 1.9` (`weight: "fine"` 1.2), ink `#2b2320`, seeded by FNV-1a of `"<card id>:<shape index>"`. | The research spike on five real cards found this reads as an illustrated card with clear faces; the full multi-stroke sketch made the faces unreadable. Per-shape seeds mean a retouch of one shape never redraws the others. |
| rough.js runs **on the client** (`roughjs` is already pinned at 4.6.6). Faces are memoised per card id at module level. The fixed seed makes the server prerender and the client render byte-identical, so hydration matches. | rough.js costs about 9 KB gzipped once. Pre-rendering twelve faces into the HTML and flight data would cost about 180 KB. |
| A new role `hatch` replaces `shade` (removed from `Role`). Hatch is a rough hachure in the card's `shade` colour darkened 25 %, `hachureGap 2.4`, `hachureAngle -48`, with no outline. `blush` stays a flat fill for things that are not cheeks; cheek blush is dropped on Totoro, No-Face and Calcifer and becomes a light hatch (`#d98a9a`) elsewhere. | Hatching gives the "printed" depth that flat saturated fills lacked, and removing the role makes the type checker find every leftover. |
| Palette: paper `#f3ecdd`, ink `#2b2320`, card `colour` mixed 12 % toward paper, machine coral `#c9684f`, slate `#6b7f9e`, legend gold `#b8862b`. No gradients and no raster. One shared feTurbulence **grain** overlay at about 7 % opacity on the reveal card, the enlarge card and the machine, never on album thumbnails. The old `feDisplacementMap` wobble goes. | Muted and printed rather than candy. The grain is the texture, and keeping it off the twelve thumbnails keeps phones fast. |
| Frame: double rule (outer 1.6, inner 0.8), `No. 07` top right (album index), a name plate rule, film and year in small text. The tier edge is the inner rule: common in ink, rare in slate, legend in gold at 2.2 with hatched gold corner ornaments. One **card back** for every card: a small crank-and-capsule device on a hatched field. | It says "trading card" at a glance, and the back is what the album and the reveal show before the face. |
| The reveal's card back carries **no number** and no tier until the edge stage. Album backs carry only their slot number. | A number on the rising back would identify the card. |
| Type: **Fraunces** via `next/font/google` (`variable: "--font-display"`, `display: "swap"`, `fallback: ["Iowan Old Style", "Georgia", "serif"]`) for the title, name plates, buttons and status; a system UI sans for small labels. In SVG, plate text has `class="plate"` (styled with the variable in `capsule.css`) plus a `font-family="Fraunces, Georgia, serif"` attribute so the standalone sheet still reads. If `npm run build` cannot fetch the font on a lease, apply the same stack without `next/font` in `layout.tsx`, record a decision, and never vendor a `.woff2`. | The cursive stack fell back to Comic Sans or the default sans (pm-184 QA). Sun (pm-189) built `next/font` on Vercel with a single stylesheet, which the walk requires. |
| The staged draw is **pure state** in `_lib/machine.ts` plus a pure `_lib/reveal.ts`. Turn carries `{ frames, drop, tier }`. The open stages are shake 6, part 4, rise 6, edge 6, hold 6 (legend only), flip 6. `revealView(machine)` is the only thing components read, and it returns `edge: null` and `card !== "face"` for every frame before the edge stage. | The test runner is plain `node --experimental-strip-types` with no DOM, so "no tier before the edge stage" must be provable over every frame of a pure function. |
| Turn still **commits** the draw (a reload mid-round keeps the card). A pure `albumView(ledger, pending)` hides the pending copy (one copy, one draw) from the album and tally until `revealed`. | This closes leak 4 without touching the ledger or its tests. |
| Seeded lengths: `turnFrames(seed, n)` gives 16 to 28 frames (1.3 to 2.3 s at 12 fps) and `dropIndex(seed, n)` gives 0 to 7. Both use new prng streams, with `n` being the same draw index `draw()` uses. | The variation is deterministic and testable, and it says nothing about the tier (a test checks that the length is drawn from a stream independent of the tier). |
| **No fake near-misses**: nothing pretends a common was almost a legend, and the rates line stays as published. | The tension comes from staging the real outcome later and in steps. |
| A slot is `data-slot="<n>"` (1 to 12), an owned slot adds `data-card="<id>"`, and an unfound one adds `data-unfound` and `aria-label="Slot 7, not found yet"`. | The walk keeps counting exactly 12 `data-slot="`, and view-source names no card. |
| Crank by hand (task 4): drag the handle clockwise; once it passes 90° it fires the **same** `crank()` as Turn, then the seeded turn plays. The Turn button stays for keyboards and the walk. The pointer maths is a pure `_lib/crank.ts`. | The request is about the spin itself, and pulling the handle is the most direct way to make it feel like yours. |
| Four tasks run as a chain (1 → 2 → 3 → 4). Every task changes what a person sees, so every task has QA. | The tasks share `machine.tsx`, `capsule.css` and `capsule-app.tsx`. |
| Each delivery commit is authored and committed as `Otohime <quiinthieu@gmail.com>`; set the four `GIT_AUTHOR_*`/`GIT_COMMITTER_*` variables on `git commit` **and** `git push`. | Vercel Hobby deploys only the owner's commits. |

## Data shapes

```ts
// _lib/art/types.ts
export type Role = "ink" | "paper" | "blush" | "white" | "main" | "hatch" | "none";   // "shade" removed
export type Shape = { d: string; fill: Role; stroke?: boolean; weight?: "fine" };
export const PALETTE = { ink: "#2b2320", paper: "#f3ecdd", blush: "#d98a9a", white: "#fffaf0" } as const;
export const STROKE = { normal: 1.9, fine: 1.2 } as const;

// _lib/art/ink.ts (copy of Sun's, Capsule defaults; the only Capsule file importing roughjs)
export function inkPath(svgPath: string, o?: InkOptions): InkPath[];
export function inkRect(x: number, y: number, w: number, h: number, o?: InkOptions): InkPath[];
export function inkLine(x1: number, y1: number, x2: number, y2: number, o?: InkOptions): InkPath[];
export function inkEllipse(cx: number, cy: number, w: number, h: number, o?: InkOptions): InkPath[];

// _lib/art/svg.ts
export function slotNumber(id: CardId): number;                       // CARDS index + 1
export function cardFaceSvg(card: Card, o?: { grain?: string }): string;   // grain = a unique filter id
export function cardBackSvg(o?: { number?: number; edge?: Tier; grain?: string }): string;
export function sheetSvg(cards: readonly Card[]): string;             // twelve faces + one back

// _lib/gacha.ts (added)
export function turnFrames(seed: number, n: number): number;   // TURN_MIN..TURN_MAX
export function dropIndex(seed: number, n: number): number;    // 0..DOME_SIZE-1

// _lib/actions.ts: turn() also returns { frames, drop } for the draw it committed

// _lib/machine.ts
export const TURN_MIN = 16, TURN_MAX = 28, DROP_FRAMES = 6, DOME_SIZE = 8;
export type OpenStage = "shake" | "part" | "rise" | "edge" | "hold" | "flip";
export type Machine = { phase: Phase; frame: number; length: number; drop: number; tier: Tier | null };
export type MachineAction = "insert" | "open" | "tick" | "settle"
  | { type: "turn"; frames: number; drop: number; tier: Tier };
export function openFrames(tier: Tier): number;               // 28, legend 34
export function openStage(frame: number, tier: Tier): OpenStage;

// _lib/reveal.ts (new)
export type RevealView = {
  stage: "idle" | "loaded" | "turning" | "dropping" | "ready" | OpenStage | "revealed";
  shell: "none" | "dropping" | "closed" | "shake" | "open";
  card: "none" | "back" | "face";
  edge: Tier | null;            // null before the edge stage, always
  flip: number;                 // 0..1 through the flip stage
};
export function revealView(m: Machine): RevealView;
export function albumView(ledger: Ledger, pending: CardId | null): Ledger;
export function isNewCard(ledger: Ledger, id: CardId): boolean;   // first copy, for "New to your album."

// _lib/crank.ts (new, task 4)
export function angleAt(cx: number, cy: number, x: number, y: number): number;   // degrees, 0 at 12 o'clock, clockwise
export function crankDrag(s: { last: number; total: number }, angle: number): { last: number; total: number; fire: boolean };
export const CRANK_FIRE = 90;
```

## Tasks

### 1. Printed-ink cards, card backs and numbered slots

- **Role:** software_engineer. QA required (art review of the sheet and the
  album).
- **Problem:** The cards look like a clip-art sticker pack: a 3.5 px round
  outline on everything, flat candy fills, the same pink blush on every face,
  and a plain rounded frame. Unfound album slots also leak the whole set: each
  shows the card's grey silhouette and tier, and the served HTML names every
  slot by card id.
- **Action items:**
  1. Copy `app/(sun)/_lib/ink.ts` to `app/(capsule)/_lib/art/ink.ts` (header
     comment says it is Capsule's copy). Change its defaults to the
     Decisions values, add `inkEllipse`, and copy `roughjs.d.ts` alongside.
     Nothing in `app/(capsule)/` may import from `app/(sun)/`. Add
     `app/(sun)` to `OUTSIDE` in `app/(capsule)/_lib/isolation.test.ts`.
  2. `art/types.ts` as in Data shapes: `hatch` replaces `shade`, add the
     optional `weight`, and use the new `PALETTE` and `STROKE`.
  3. `art/svg.ts`: rewrite the renderer. Each stroked shape gets one
     `inkPath` outline (single stroke) over its flat fill. `hatch` shapes are
     rough hachure with no outline. Fills are mixed 12 % toward paper. Build
     the frame as in Decisions, plus `cardBackSvg`, `slotNumber`, and an
     optional grain overlay (`<filter>` with feTurbulence, applied as a
     7 %-opacity `<rect>`). Remove the ghost silhouette path entirely. Memoise
     the art part of each face per card id in a module-level `Map`. The plate
     text has `class="plate"` and `font-family="Fraunces, Georgia, serif"`.
     `sheetSvg` adds one back after the twelve faces.
  4. Retouch every `art/<id>.ts` (data only). Each `shade` becomes `hatch`
     (Totoro's belly chevrons become one hatched belly band or stay as hatched
     chevrons). Drop the cheek blush on Totoro, No-Face and Calcifer, and turn
     cheek blush elsewhere into `hatch` or `blush` as the brief says. Whiskers,
     fur and hair lines get `weight: "fine"`. The soot sprite gets one
     hatched underside. Every card ends up with at least one `hatch` shape.
  5. `_components/card.tsx`: `Card` takes `card`, an optional `back`
     (`{ number?: number; edge?: Tier }`) and `grain?: boolean`. It renders
     `cardFaceSvg` or `cardBackSvg`, with the grain filter id from `useId`.
     The face's `aria-label` stays "Name, Film (Year)"; the back's is passed in.
  6. `_components/album.tsx`: each slot is `<li data-slot="<n>">`. An owned
     slot adds `data-card="<id>"` and renders the face (no grain). An unfound
     slot adds `data-unfound`, renders `cardBackSvg({ number })`, and has
     `aria-label="Slot <n>, not found yet"`, with no tier anywhere. The
     enlarge dialog uses `grain`. Also apply `grain` to the reveal card in
     `capsule-app.tsx` (a one-prop change only).
  7. `art.test.ts`: keep the path rules (absolute commands inside 0 0 120 160)
     and the no raster/gradient/link rule on the sheet. Add:
     - `ROLES` has no `shade` and every card has ≥1 `hatch` shape.
     - No Totoro, No-Face or Calcifer shape uses `blush`.
     - `cardFaceSvg` is deterministic (two calls are equal) and has no
       `NaN` or `undefined`.
     - The outline count equals the stroked shape count (single stroke).
     - A pinned SHA-256 of `cardFaceSvg(totoro)` (a changed value means the
       card was redrawn on purpose).
     - `cardBackSvg()` contains no card name, no `No.` and none of the tier
       colours. `cardBackSvg({ number: 7 })` contains `No. 07`, and
       `cardBackSvg({ edge: "legend" })` contains `#b8862b`.
     - `art/ink.ts` contains no `document` or `window`.
  8. `scripts/walk-capsule.sh`, for `/capsule` (the server renders an empty
     album):
     - Exactly 12 `data-slot="` (kept) and exactly 12 `data-unfound`.
     - `has 'No. 12'`.
     - `lacks` each of `data-slot="totoro"`, `Not found yet: a`, `Totoro`,
       `Calcifer`, `No-Face` and `Robot soldier`.
     - Every existing check is kept.
  9. `README.md`: replace "one ink outline" in the art-brief paragraph with
     the printed-ink brief (single rough outline, `hatch` for shade, `weight:
     "fine"`, no gradients, no raster). Point to `art/ink.ts` and say that the
     Totoro hash in `art.test.ts` pins the look.
  10. Render the sheet locally to check it (resvg-js from a scratch dir under
      `/tmp`, see the lessons), and fix any face that reads badly. Do not
      commit PNGs. Run the walk. Commit and push with the owner identity.
- **Interfaces:** `app/(capsule)/_lib/art/`; `app/(capsule)/_lib/art.test.ts`;
  `app/(capsule)/_lib/isolation.test.ts`; `app/(capsule)/_components/card.tsx`;
  `app/(capsule)/_components/album.tsx`;
  `app/(capsule)/_components/capsule-app.tsx`; `scripts/walk-capsule.sh`;
  `README.md`
- **Non-goals:**
  - The machine, fonts, page palette or CSS beyond the slot sizing the new
    frame needs.
  - Staging the draw or hiding the pending card (task 3).
  - New characters or new drawings.
  - Changes to `cards.ts`, `ledger.ts` or the draw.
  - Importing from `app/(sun)/`.
  - A vendored font.
- **Acceptance:** All twelve cards are printed-ink trading cards: a thin
  single rough outline, hatched shade, muted fills, a numbered double-rule
  frame with a name plate, and a tier edge (ink, slate, or gold with corner
  ornaments). Unfound album slots are numbered card backs, so the served
  `/capsule` HTML names no card, shows no silhouette and gives no tier. `npm
  run capsule:sheet` prints the new set plus the back. `bash
  scripts/walk-capsule.sh` exits 0.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(capsule)/_lib/art.test.ts' 'app/(capsule)/_lib/isolation.test.ts'`
  - `npm run --silent capsule:sheet > /tmp/capsule-sheet.svg && test "$(grep -c '<path' /tmp/capsule-sheet.svg)" -ge 1 && ! grep -qE '<image|Gradient|href=' /tmp/capsule-sheet.svg`
  - `! grep -rnE "from ['\"][^'\"]*\(sun\)" 'app/(capsule)'`
  - `bash scripts/walk-capsule.sh`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 2. Page chrome, Fraunces and the machine in ink with uniform shells

- **Role:** software_engineer, depends on 1. QA required (1366×768 and
  390×844).
- **Problem:** The page and the machine are still in the sticker style. The
  headline and buttons use a cursive stack that falls back to Comic Sans or
  the default sans. The capsule that drops is coloured by tier, in the same
  colours as the tier badges, so a visitor knows the tier before Open.
- **Action items:**
  1. Read the font guide under `node_modules/next/dist/docs/` (`grep -rl
     next/font/google node_modules/next/dist/docs | head`) before writing code
     (`AGENTS.md`).
  2. `app/(capsule)/layout.tsx`: load Fraunces with `next/font/google` as in
     Decisions, put `.variable` on `<html lang="en">`, set `themeColor` to
     `#f3ecdd`, and keep the metadata, title template and `build-sha` meta.
     If the build cannot fetch the font, use the documented fallback and
     record a decision.
  3. `app/(capsule)/capsule.css`: new tokens (paper, ink, coral, slate, gold)
     and Fraunces for `h1`, plates, buttons and status. Buttons are
     letterpress-like: an ink rule, a paper fill and a pressed state. Restyle
     the coin tray, the rates line, the album grid and the enlarge dialog,
     with tier badges in ink, slate and gold. Add a `prefers-reduced-motion:
     reduce` block. No text under 12 px at 390 px, and `scrollWidth -
     clientWidth` is 0 at 390 px. No Tailwind.
  4. `_components/machine.tsx`: redraw with `art/ink.ts`. The body is solid
     muted coral with a hatched shade edge; the dome is a thin rough ellipse
     with one hatched reflection; the crank, slot and chute are in ink.
     Generate the ink once at module level or in `useMemo` (poses are
     transforms on groups, so ink never regenerates per frame). Use the
     shared grain overlay and remove the `feDisplacementMap` wobble.
     **Delete the `CAPSULE` tier map.** Every capsule (the eight in the dome
     and the one that drops) is the same shell, paper bottom and coral top,
     in a `<g data-shell>`. `Machine` no longer takes a `tier` prop.
  5. `capsule/page.tsx`: keep the top bar (`href="/"`, `href="/projects"`),
     eyebrow, headline, rates line and footer text, restyled.
  6. `scripts/walk-capsule.sh`:
     - `/capsule` has exactly 8 `data-shell`.
     - It lacks each old tier colour `#8fcbb8`, `#97b4ea` and `#efc64a`.
     - `capsule_stylesheet` also requires `Fraunces` and
       `prefers-reduced-motion` in the stylesheet.
     - Every existing check is kept, including "exactly one stylesheet".
  7. `content/site.ts`: the Capsule row note becomes "A coin, a crank, and a
     printed card to keep." (same href, status and colour).
  8. Run the walk. If a browser runs on the lease, look at both viewports.
     Do not commit screenshots. Commit and push with the owner identity.
- **Interfaces:** `app/(capsule)/layout.tsx`; `app/(capsule)/capsule.css`;
  `app/(capsule)/_components/machine.tsx`;
  `app/(capsule)/_components/capsule-app.tsx`; `app/(capsule)/capsule/page.tsx`;
  `scripts/walk-capsule.sh`; `content/site.ts`
- **Non-goals:**
  - The staged draw, seeded lengths, the drop animation and album
    pending-hide (task 3).
  - The crank drag (task 4).
  - Card art (task 1).
  - Changes to other route groups.
  - A vendored font.
  - CI workflow changes.
- **Acceptance:** `/capsule` is set in Fraunces on grained cream paper. The
  machine is drawn in the same thin ink and hatching as the cards, and every
  capsule in and out of the dome looks the same, so the shell says nothing
  about the tier. There is no sideways scroll at 390 px. `bash
  scripts/walk-capsule.sh` exits 0.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `! grep -nE 'CAPSULE\[|#8fcbb8|#97b4ea|#efc64a' 'app/(capsule)/_components/machine.tsx'`
  - `grep -q 'next/font/google' 'app/(capsule)/layout.tsx' && ! find 'app/(capsule)' -name '*.woff2' | grep -q .`
  - `bash scripts/walk-capsule.sh`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 3. The staged draw: seeded turn, a real drop, and the tier last

- **Role:** software_engineer, depends on 2. QA required (motion on and off;
  DOM inspected stage by stage).
- **Problem:** The spin has no suspense, for three reasons:
  - It is always 12 frames, and a capsule appears in the chute from nowhere.
  - Open pops the face-up card with its name, film and tier in one step.
  - The album slot and its count fill in at Turn, before the capsule is even
    open.
- **Action items:**
  1. `_lib/gacha.ts`: `turnFrames` and `dropIndex` on two new prng streams.
     `_lib/actions.ts`: `turn()` also returns `{ frames, drop }` for the
     same `n` it drew with.
  2. `_lib/machine.ts` as in Data shapes:
     - The turn action carries `{ frames, drop, tier }`, and `turning` lasts
       `length` frames. The last `DROP_FRAMES` frames are the drop.
     - `opening` runs `openFrames(tier)` frames, read by `openStage`.
     - `insert` from `revealed` resets `drop`/`tier`.
     - `tick` and `settle` behave as before (settle finishes any stage at once).
     - Illegal presses stay no-ops.
  3. `_lib/reveal.ts` as in Data shapes:
     - `revealView` maps a machine to what is visible. The shell drops in
       the last turn frames, then `closed` in `ready`, `shake`, then `open`
       from part on.
     - The card is `back` from rise, with `edge` set only from the edge
       stage, and `face` only from the second half of flip.
     - `albumView` subtracts one copy (deleting the key at 0) and one draw.
     - `isNewCard` is true when the committed ledger holds exactly one copy.
  4. Tests:
     - `machine.test.ts` (rewritten for the new action):
       - A full round runs at seeded lengths.
       - `openFrames("legend") === openFrames("common") + 6`.
       - Stage boundaries hold, and settle works from any frame.
       - Illegal presses are no-ops.
     - `gacha.test.ts`:
       - `turnFrames` stays within 16..28 and takes at least 8 distinct
         values over 200 draws.
       - `dropIndex` stays within 0..7.
       - For a fixed seed, `turnFrames` is the same whatever `sinceLegend`
         is (the length cannot encode the tier).
     - New `reveal.test.ts`:
       - For every tier and every frame of `turning`, `ready` and `opening`
         before the edge stage: `edge === null` and `card !== "face"`.
       - At `revealed`: `card === "face"` and `edge === tier`.
       - `albumView` hides a first copy (slot unfound) and an extra copy
         (`×n-1`), and `albumView(l, null) === l`.
  5. `_components/machine.tsx`:
     - While turning, the dome capsules tumble (rotate plus a small bounce,
       posed from the frame).
     - Capsule `drop` leaves the dome over the last 6 frames along a short
       curve through the collar into the chute. The dome shows 7 until the
       next Insert.
     - In `shake` the chute capsule rocks; in `part` its halves split.
     - All poses are pure functions of the machine state, with no tier input.
  6. `_components/capsule-app.tsx`:
     - Read only `revealView(machine)` for the reveal.
     - The `.booth` gets `data-stage="<stage>"`.
     - The "?" placeholder goes. The reveal card is a `Card` back (no number)
       that rises out of the chute from the rise stage. Its tier edge draws on
       in the edge stage (stroke-dashoffset on the edge rule, and gold sparks
       for a legend in `hold`). It flips in `flip` with a CSS 3D rotate driven
       by `--flip`, then settles beside the machine with name, film and year.
     - No tier class, tier colour or face markup is in the DOM before the edge
       stage.
     - Pass `albumView(ledger, pending)` to `Album`, where `pending` is the
       drawn card id in `turning`, `ready` and `opening`.
     - Status copy: "Turning…", "Something rolled out. Open it.", "Opening…".
       At `revealed`: "Jiji. Common." and, when `isNewCard`, " New to your
       album."
     - Reduced motion settles each press at once, as today.
  7. `capsule.css`: stage styles keyed on `[data-stage]`, the edge draw-on,
     legend sparks and the flip, all `none` under reduced motion. The
     resting styles show the final pose, so a still reads complete.
  8. `scripts/walk-capsule.sh`: `/capsule` has `data-stage="idle"`. Every
     existing check is kept.
  9. `README.md`: one paragraph on the round, covering the seeded turn
     length, the drop, the open stages, the rule that the tier shows last
     (proved by `reveal.test.ts`), and the album holding back the pending card.
  10. Run the walk. If a browser runs on the lease, play a common, a rare and
      a legend round (use a seeded ledger in localStorage) with motion on and
      off. Commit and push with the owner identity.
- **Interfaces:** `app/(capsule)/_lib/gacha.ts`; `app/(capsule)/_lib/gacha.test.ts`;
  `app/(capsule)/_lib/actions.ts`; `app/(capsule)/_lib/actions.test.ts`;
  `app/(capsule)/_lib/machine.ts`; `app/(capsule)/_lib/machine.test.ts`;
  `app/(capsule)/_lib/reveal.ts`; `app/(capsule)/_lib/reveal.test.ts`;
  `app/(capsule)/_components/`; `app/(capsule)/capsule.css`;
  `scripts/walk-capsule.sh`; `README.md`
- **Non-goals:**
  - Fake near-misses or teasers that misstate the tier.
  - Changing rates, pity, coins or the ledger format.
  - Hiding the draw from devtools or localStorage.
  - Sound.
  - The crank drag (task 4).
  - JavaScript animation beyond the existing 12 fps tick.
- **Acceptance:** Each round:
  1. The crank turns for a different length, from 1.3 to 2.3 s.
  2. One identical capsule falls out of the dome into the chute.
  3. Open shakes it, splits it, and raises a plain card back.
  4. Only then does the tier edge draw on (ink, slate, or gold with a short
     glow for a legend), and the card flips to its face.

  The album slot and the tally change only at the reveal. Under reduced
  motion each press lands at once. `reveal.test.ts` proves that no frame
  before the edge stage exposes the tier or the face. `bash
  scripts/walk-capsule.sh` exits 0.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(capsule)/_lib/reveal.test.ts' 'app/(capsule)/_lib/machine.test.ts' 'app/(capsule)/_lib/gacha.test.ts' 'app/(capsule)/_lib/actions.test.ts'`
  - `! grep -n 'reveal-empty' 'app/(capsule)/_components/capsule-app.tsx'`
  - `bash scripts/walk-capsule.sh`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 4. Crank by hand

- **Role:** software_engineer, depends on 3. QA required (mouse, and touch
  emulation at 390×844).
- **Problem:** The spin is still a button press. Pulling the crank yourself
  makes the moment feel like yours, and the request is about making the spin
  more intriguing.
- **Action items:**
  1. `_lib/crank.ts` as in Data shapes. `angleAt` measures degrees clockwise
     from 12 o'clock. `crankDrag` accumulates the clockwise delta, wrapping
     across 0/360 and ignoring counter-clockwise moves below zero total, and
     sets `fire` once when `total` first reaches `CRANK_FIRE` (90).
  2. `_lib/crank.test.ts`:
     - A quarter turn clockwise fires once, at 90°.
     - Counter-clockwise never fires.
     - A drag across 12 o'clock (350° → 20°) counts +30.
     - A jittery drag fires at most once.
     - `angleAt` gives 0, 90, 180 and 270 at the four compass points.
  3. `machine.tsx`:
     - The crank handle group gets `data-crank` and `touch-action: none`, and
       becomes grabbable only in `loaded`.
     - Use pointer events with `setPointerCapture`, plus a non-passive
       `touchstart` listener that calls `preventDefault` (the pm-191 tonearm
       pattern).
     - While dragging, the handle follows the pointer; on `fire` it calls the
       same `crank()` as the Turn button, and the seeded turn continues from
       there.
     - Released before 90°, it springs back.
     - Under reduced motion the spring is instant.
  4. The Turn button, keyboard access and every walk marker stay. Status in
     `loaded` reads "Coin in. Pull the crank or press Turn."
  5. `scripts/walk-capsule.sh`: `/capsule` has `data-crank`.
  6. Run the walk. Commit and push with the owner identity.
- **Interfaces:** `app/(capsule)/_lib/crank.ts`; `app/(capsule)/_lib/crank.test.ts`;
  `app/(capsule)/_components/machine.tsx`;
  `app/(capsule)/_components/capsule-app.tsx`; `app/(capsule)/capsule.css`;
  `scripts/walk-capsule.sh`
- **Non-goals:**
  - Haptics or sound.
  - Physics or inertia on the crank.
  - Removing the Turn button.
  - Changing the seeded turn length.
- **Acceptance:** In `loaded`, dragging the crank handle clockwise past a
  quarter turn starts the same seeded turn as pressing Turn, on both mouse and
  touch, without scrolling the page. Letting go early springs it back, and
  Turn still works from the keyboard. `crank.test.ts` covers the angle maths.
  `bash scripts/walk-capsule.sh` exits 0.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(capsule)/_lib/crank.test.ts'`
  - `bash scripts/walk-capsule.sh`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

## QA and acceptance

- **QA on task 1:** render the sheet from `npm run --silent capsule:sheet`
  with resvg-js in a scratch dir under `/tmp` (no browser needed). Judge it
  against the printed-ink brief, not pm-184's chibi brief: thin single
  outline, hatched shade, muted fills, readable faces, a clear tier edge, and
  no cheek blush on Totoro, No-Face or Calcifer. View-source of `/capsule`
  names no card.
- **QA on tasks 2 to 4:** headless Chrome (playwright-core from a scratch dir)
  at 1366×768 and 390×844, with motion on and off. Task 3's QA steps through
  a round and reads the DOM at each `data-stage`: no tier class, tier colour
  or card name before `edge`, and the album slot unchanged until `revealed`.
  A missing browser on a pod is a note, not a fail, and the pure tests stand.
- **Acceptance** walks production: `BASE_URL=https://otohime.dev bash
  scripts/walk-capsule.sh` with `EXPECT_SHA` set to the delivered sha, then
  plays one round in a browser and confirms the five leaks in the table are
  gone.

## Risks

- **Taste.** "Sophisticated" is a judgement call. The spike's printed-ink
  renderer is the evidence, and task 1's QA renders and judges it. If a face
  reads badly, fix that face's data, not the brief.
- **Hydration.** rough.js must produce the same paths on server and client.
  The fixed per-shape seed guarantees it, and the pinned Totoro hash catches a
  library change. Keep `roughjs` exact at 4.6.6.
- **Performance.** There are about a thousand ink paths on the page. Keep the
  grain off the album thumbnails and memoise faces.
- **Google Fonts at build.** If the build cannot fetch the font, use the
  one-line fallback in `layout.tsx` and record a decision.
- **Longer rounds.** A round is about 4 to 5 s, which is the point. Reduced
  motion stays instant.
- **Walk markers.** `Insert coin`, `Turn`, `Open`, `Reset album`, 12
  `data-slot="` and one stylesheet stay. Any change to them updates
  `walk-capsule.sh` in the same commit.
