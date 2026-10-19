# Capsule: a coin-and-crank card machine (pm-184)

**Idea.** "Add a new project. Input some coins to draw cards. Cards are
collectibles characters from the Glibli studio movies. The artstyle is
hand-drawn. Here is the art style reference:
https://www.pinterest.com/pin/711709547410982905/"

**Product.** Capsule is a capsule-toy machine at `otohime.dev/capsule`. You
press **Insert coin**, **Turn** the crank and **Open** the capsule that rolls
out. Inside is a card: a chibi, hand-drawn portrait of a character from a Studio
Ghibli film. The card joins your album, and a duplicate counts up as `×n`.
Coins are free: 5 to start and 3 more each local day, up to 9. They can never be
bought. The album lives in `localStorage`, and a stored seed decides every draw,
so a reload never re-rolls. Capsule is the second row on the Projects bench
(`/projects`), after Shore.

**Isolation.** Capsule copies Shore (pm-181). It has its own root layout
`app/(capsule)/layout.tsx` with its own `<html>`, `<body>` and `capsule.css`. It
uses no Tailwind and imports nothing from `@/components`, `@/content`, `@/lib`,
`app/(site)` or `app/(shore)`. A unit test enforces the boundary both ways. The
top bar's link home is a plain `<a href="/">`, because moving between root
layouts is a full page load. See
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`,
and read the Next 16 docs before writing code (`AGENTS.md`).

Research: [research.md](research.md) (run-6262). The pin is a generic chibi
drawing, not a Ghibli image, so it sets the **style** and the idea sets the
**subject**.

## Decisions

| Decision | Why |
| --- | --- |
| Capsule is a localStorage page in its own route group: no table, migration, auth or API. | Shore proved this structure on Next 16.4.2 and in production. It is cheap and reversible, and no person has to act. |
| Coins are a free daily allowance and can never be bought or traded. The page prints the rates and the pity rule from the same table the code uses. | With no cash path, loot-box and kompu-gacha rules (BE, NL, JP) do not apply. Showing the rates is the honest default. |
| The characters are original hand-drawn chibi fan art in SVG. There are no stills, logos or AI images, and "Ghibli" is not in the name, route, `<title>` or Projects row. The `/capsule` footer carries the disclaimer. | Studio Ghibli owns the characters and marks, and non-commercial fan art is tolerated, not licensed. Keeping the mark out of our own copy keeps exposure low, while the footer still credits the owner. |
| The card set is data (`_lib/cards.ts`), and each drawing is data too (`_lib/art/<id>.ts`). | A takedown is a content swap with the machine untouched. `npm test` (node strip-types) cannot import `.tsx`, but it can check `.ts` art: every card drawn, and every coordinate inside the viewBox. |
| **Turn** commits the draw: one coin spent, `draws + 1`, owned card `+1`, pity updated. **Insert coin** is UI state only. | A reload mid-animation keeps the card, and a reload after Insert gives the coin back. Nothing is lost or re-rolled. |
| Rates are common 70 %, rare 25 %, legend 5 %. If 19 draws in a row miss a legend, the 20th is one. Within a tier the card is uniform. Duplicates count up and earn nothing. | This is a simple, published rule. With no set-completion reward, the kompu line never applies. |
| Light scene only in v1. | The reference is a white-ground style. |
| Capsule has its own isolation test and its own `scripts/walk-capsule.sh`, and does not edit Shore's files. | pm-181's t-1059 and t-1060 are editing Shore now. A shared checker would make the two plans wait on each other. |
| The click path is proven by unit tests over pure `_lib/actions.ts` and `_lib/machine.ts`, plus server-rendered markers in the walk. A real browser pass is advisory QA. | Headless Chrome cannot navigate in these leases (pm-181, t-1052). The buttons call the same pure functions the tests drive. |
| The walk is a checked-in script built on pm-181 revision 3's lessons: one `ok -`/`not ok -` line per check, `grep -c` with numeric `-eq`, never `wc -l`, and a server in its own process group. | t-1052 failed three gates on BSD `wc -l` padding inside an inline walk that no SWE could fix. |
| Each delivery commit is authored and committed as `Otohime <quiinthieu@gmail.com>`. Set the four `GIT_AUTHOR_*`/`GIT_COMMITTER_*` variables on `git commit` **and** on `git push`. | Vercel Hobby deploys only the owner's commits. The lease exports `Claude Code`, and the push helper's auto-rebase resets the committer. |

## Features (v1)

1. **Machine.** A hand-drawn SVG capsule machine: a glass dome of capsules, a
   coin slot, a crank and a chute. **Insert coin** (disabled with 0 coins) drops
   a coin. **Turn** spins the crank on twos (12 fps) and a capsule tumbles out.
   **Open** parts the capsule halves, and the card rises face-up with its name,
   film and year. An `aria-live="polite"` status reads, for example, "Soot
   sprite. Common." With `prefers-reduced-motion`, each press settles at once.
2. **Coins.** A tray shows the coins left and the next refill ("3 more
   tomorrow").
3. **Cards.** There are twelve cards (table below), each on a `0 0 120 160`
   card face. The frame has paper, a tier band (common: plain; rare: a thin
   foil line; legend: a full foil border) and a `feTurbulence` +
   `feDisplacementMap` wobble filter for the hand-drawn edge.
4. **Album.** Twelve slots under the machine. An unowned slot shows a grey
   silhouette and the tier. An owned slot shows the card and `×n`. A tally line
   reads "7 of 12 · 23 draws". Tapping an owned card opens it large, with its
   note (task 4).
5. **Rates.** One line under the machine, generated from `RATES` and `PITY`:
   "Common 70% · Rare 25% · Legend 5% · a legend at least every 20 draws ·
   coins are free and can't be bought".
6. **Footer.** "Fan art, drawn by hand. The characters belong to Studio Ghibli.
   Not affiliated; nothing here is for sale."
7. **Reset album.** Confirmed inline, it is the only destructive action
   (task 4). It keeps the seed, coins and day, so it cannot mint coins.

Not in v1: accounts or sync, trading, buying coins, a dark scene, sounds,
set-completion rewards, sharing, and any change to how `app/(site)/` or
`app/(shore)/` look.

### Card set

| id | Card | Film (year) | Tier | Task |
| --- | --- | --- | --- | --- |
| `soot-sprite` | Soot sprite | My Neighbor Totoro (1988) | common | 2 |
| `jiji` | Jiji | Kiki's Delivery Service (1989) | common | 2 |
| `kodama` | Kodama | Princess Mononoke (1997) | common | 3 |
| `heen` | Heen | Howl's Moving Castle (2004) | common | 3 |
| `teto` | Teto | Nausicaä of the Valley of the Wind (1984) | common | 3 |
| `ponyo` | Ponyo | Ponyo (2008) | common | 3 |
| `totoro` | Totoro | My Neighbor Totoro (1988) | rare | 2 |
| `catbus` | Catbus | My Neighbor Totoro (1988) | rare | 3 |
| `calcifer` | Calcifer | Howl's Moving Castle (2004) | rare | 3 |
| `kiki` | Kiki | Kiki's Delivery Service (1989) | rare | 3 |
| `no-face` | No-Face | Spirited Away (2001) | legend | 2 |
| `robot-soldier` | Robot soldier | Castle in the Sky (1986) | legend | 3 |

### Art brief (from the reference's style, not its subject)

- **Line:** one ink outline, `#3a2a28`, stroke 3.5, round joins and caps,
  closed shapes. A stray hair or whisker may be a single open line.
- **Fill:** flat colour with no gradients. A shape gets at most one darker flat
  shade shape and never a soft shadow.
- **Face:** closed eyes as two arcs (or simple dots where the character has
  them), pink blush ovals `#f3a6bb`, and a filled D mouth where it fits.
- **Proportion:** a big head and a small body (about 1 : 2), joyful and a
  little wobbly. Nothing is ruler-straight.
- **Palette roles:** `ink` `#3a2a28`, `paper` `#f6f1e7`, `blush` `#f3a6bb`,
  `white` `#fffdf8`, `main` (the card's own colour), `shade` (the card's darker
  flat), `none`.
- **Never:** traced frames, film stills, logos, raster images, `<image>`,
  gradients or AI output.

### Data shapes

```ts
// _lib/cards.ts
type Tier = "common" | "rare" | "legend";
type Card = { id: CardId; name: string; film: string; year: number; tier: Tier;
              colour: string; shade: string; note: string };
export const CARDS: readonly Card[];            // the twelve above, in album order
export const RATES: Record<Tier, number>;       // { common: 0.70, rare: 0.25, legend: 0.05 }
export const PITY = 20;

// _lib/art/types.ts
type Role = "ink" | "paper" | "blush" | "white" | "main" | "shade" | "none";
type Shape = { d: string; fill: Role; stroke?: boolean }; // stroke defaults to true (ink, 3.5)
type Drawing = { shapes: Shape[] };
// d uses absolute commands only: M L H V C S Q T Z (no arcs, no lowercase)

// _lib/ledger.ts — localStorage["capsule-v1"]
type Ledger = { v: 1; seed: number; draws: number; coins: number; lastDay: number;
                sinceLegend: number; owned: Partial<Record<CardId, number>> };
```

## Tasks

### 1. Capsule's engine: cards, draws, coins and ledger as pure TS

- **Role:** software_engineer, `qa: skip`. It is pure `_lib/` code plus tests,
  with no page and nothing a person sees, and its verification proves it fully.
- **Problem:** Capsule needs a draw and coin economy that cannot lie, re-roll on
  reload or mint free coins. A page can only be trusted once that logic is pure
  and tested on its own.
- **Action items:**
  1. `app/(capsule)/_lib/cards.ts`: the twelve cards from the card set table
     (original one-line notes), `RATES`, `PITY = 20`, and
     `TIERS = ["common", "rare", "legend"]`.
  2. `app/(capsule)/_lib/rng.ts`: `prng(seed, n): number` in [0, 1), pure and
     deterministic (for example mulberry32 over a 32-bit mix of seed and n).
  3. `app/(capsule)/_lib/gacha.ts`: `tierFor(u)` from the cumulative `RATES`.
     `draw(seed, n, sinceLegend): { id, tier }` forces `legend` when
     `sinceLegend >= PITY - 1`, then picks uniformly within the tier using a
     second prng stream (`prng(seed ^ 0x9e3779b9, n)` or similar).
     `ratesLine()` returns the rates sentence from Features 5, built from
     `RATES` and `PITY`.
  4. `app/(capsule)/_lib/ledger.ts`: `STORAGE_KEY = "capsule-v1"`,
     `dayNumber(ms)` (local day, like Shore's), `START_COINS = 5`,
     `DAILY_COINS = 3`, `MAX_COINS = 9`, `freshLedger(seed, now)`,
     `refill(ledger, now)` (adds `3 × days passed` capped at 9; no refill on
     the same day or when the clock went back; `lastDay` never moves
     backwards), `serialize(ledger)` and
     `normalizeLedger(raw: string | null, now, mintSeed: () => number)`.
     `normalizeLedger` turns bad JSON or a wrong `v` into a fresh ledger,
     drops unknown card ids and non-positive or non-integer counts, clamps
     coins to 0..9, `draws` and `sinceLegend` to non-negative integers, and
     replaces a non-integer seed with `mintSeed()`. It then applies `refill`.
  5. `app/(capsule)/_lib/actions.ts` (what the buttons call):
     `turn(ledger, now): { ledger, card } | null` returns null with 0 coins.
     Otherwise it spends a coin, draws `draw(seed, draws, sinceLegend)`,
     increments `owned[id]` and `draws`, and resets or increments
     `sinceLegend`. `resetAlbum(ledger)` clears `owned`, `draws` and
     `sinceLegend` and keeps `seed`, `coins` and `lastDay`.
     `tally(ledger)` returns `{ owned: distinct, total: 12, draws }`.
  6. `app/(capsule)/_lib/machine.ts`: the UI reducer in the style of
     `lib/machines.ts` (copied, not imported).
     `type Phase = "idle" | "loaded" | "turning" | "ready" | "opening" | "revealed"`.
     `step(m, action)` handles `insert`, `turn`, `open`, `tick` and `settle`.
     `turning` and `opening` advance one frame per `tick` and finish after a
     fixed frame count. `settle` jumps to the end of the current phase.
     `insert` from `revealed` starts the next round. Illegal presses are no-ops.
  7. Tests (node:test), one file per module, under `app/(capsule)/_lib/`:
     - `rng.test.ts`: same `(seed, n)` gives the same value; values stay in
       [0, 1).
     - `gacha.test.ts`: over 10 000 draws for each of 3 seeds, the
       `tierFor(prng(seed, n))` shares are within ±2 points of 70/25/5.
       `draw(_, _, 19)` is always a legend. Playing 2 000 draws through
       `turn` with coins topped up never passes 20 in a row without a
       legend. Every id drawn is in `CARDS`, every card is reachable, and
       `ratesLine()` contains "70%", "25%", "5%" and "20".
     - `ledger.test.ts`: a fresh ledger has 5 coins. The next day adds 3, five
       days later the cap of 9 holds, the same day adds nothing and a clock
       moved back adds nothing. Junk input (bad JSON, `v: 2`, unknown ids,
       `-1`, `1.5`, coins 99, a string seed) normalizes as specified.
     - `actions.test.ts` covers the click path. Starting from
       `freshLedger(42, t)`, it runs `step` insert, `turn` (`actions.turn`),
       ticks until `ready`, `open`, then `settle`, ending in `revealed`.
       After `serialize` and `normalizeLedger` (the reload), `owned[card.id]`
       is 1, coins are 4 and draws are 1. The next `turn` after a reload gives
       the same card as the next `turn` without one. Zero coins returns null.
       `resetAlbum` keeps seed, coins and lastDay.
     - `machine.test.ts`: illegal presses are no-ops, `settle` finishes
       turning and opening, and frames only advance on `tick`.
     - `isolation.test.ts` (modelled on `app/(shore)/_lib/isolation.test.ts`):
       nothing under `app/(capsule)/` imports `globals.css`, Tailwind,
       `@/components`, `@/content`, `@/lib`, `app/(site)` or `app/(shore)`
       (by alias or `../`). Nothing under `app/(site)/`, `app/(shore)/`,
       `components/` or `lib/` imports `(capsule)` or `capsule.css`. It
       includes the "checker flags what it should" self-test. The scan must
       find `cards.ts`.
  8. `package.json`: `test` adds `'app/(capsule)/_lib/*.test.ts'` after the
     Shore glob, and the strip-types flags stay before `--test`.
  9. `README.md`: in the layout block, `app/(capsule)/` is Capsule, a
     coin-and-crank card machine with its own root layout and CSS, whose pure
     engine is in `_lib/`. The Tests line says `npm test` also covers
     Capsule's `_lib/*.test.ts`.
  10. Commit and push with the owner identity (Decisions table).
- **Interfaces:** `package.json`; `README.md`; `app/(capsule)/_lib/`
- **Non-goals:** any page, layout, CSS, component or art; changes to
  `app/(shore)/` or `app/(site)/`; a shared isolation checker.
- **Acceptance:** `npm test` runs Capsule's engine tests and they pass. They
  prove the rates, the pity at 20, the daily coins with the cap of 9, junk
  ledger input, a reload that never re-rolls, and the Insert → Turn → Open →
  reload path keeping the card.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(capsule)/_lib/*.test.ts'`
  - `grep -q "app/(capsule)/_lib/\*.test.ts" package.json`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 2. Capsule's page: the machine, the album and the first four cards

- **Role:** software_engineer, depends on 1. QA is required.
- **Problem:** The engine exists but nobody can play it. `/capsule` needs its
  own root layout, the hand-drawn machine, the card frame, the album, the first
  four drawings and a place on the Projects bench. Its proof must be a
  checked-in walk that any SWE can fix.
- **Action items:**
  1. `app/(capsule)/layout.tsx`: its own `<html lang="en">` and `<body>`,
     `import "./capsule.css"`, and metadata with title template
     `%s · Capsule`, description, `other: { "build-sha":
     process.env.BUILD_SHA ?? "dev" }` and theme colour `#f6f1e7`.
     `app/(capsule)/capsule/page.tsx` (server) uses
     `title: { absolute: "Capsule" }`.
  2. `app/(capsule)/capsule.css`, hand-written: tokens from the palette roles,
     a top bar, the stage, the machine, the tray, buttons, the album grid,
     card sizes and a `prefers-reduced-motion` block. No Tailwind. No
     `overflow: hidden` on any parent of the wobble-filtered SVG, so the
     displacement is not clipped.
  3. `app/(capsule)/_lib/art/types.ts` (types and the palette map),
     `art/index.ts` (`ART: Partial<Record<CardId, Drawing>>`) and four
     drawings in the brief: `soot-sprite.ts`, `jiji.ts`, `totoro.ts` and
     `no-face.ts`.
  4. `app/(capsule)/_lib/art/svg.ts`: pure `drawingToSvg(card, drawing)`,
     which returns the card's inner SVG markup as a string, and
     `sheetSvg(cards)`, which returns one standalone SVG with every drawn card
     in a grid. `scripts/capsule-sheet.ts` prints `sheetSvg` to stdout, and
     `package.json` gets `"capsule:sheet"` running it with the strip-types
     flags. QA and owners can then see all the art without playing.
  5. `app/(capsule)/_lib/art.test.ts`: every key of `ART` is a card id, and
     the four ids above are drawn. Every `d` uses only `M L H V C S Q T Z`
     with absolute coordinates, and every x is in [0, 120] and every y in
     [0, 160] (parse the commands and do not regex loose numbers). Every
     `fill` is a known role, and each drawing has at least one stroked shape.
     `sheetSvg(CARDS)` parses as XML-ish (balanced `<svg` / `</svg>`) and
     contains no `<image`, `gradient` or `href=`.
  6. Client components in `app/(capsule)/_components/`:
     - `card.tsx`: the frame (paper, tier band, wobble filter with an id from
       `useId`) and the art renderer driven by `ART`. A card with no drawing
       yet shows its name on the frame.
     - `machine.tsx`: the SVG machine (dome, slot, crank, chute, capsule
       halves) drawn from `machine.ts` state.
     - `capsule-app.tsx`: it holds the ledger. It reads with
       `normalizeLedger(localStorage.getItem(STORAGE_KEY), Date.now(), () =>
       crypto.getRandomValues(new Uint32Array(1))[0])` in an effect and writes
       with `serialize` after `actions.turn`. It also runs the tick loop
       (`setInterval(1000 / 12)` while turning or opening; under
       `prefers-reduced-motion` it dispatches `settle`) and renders the
       buttons **Insert coin**, **Turn** and **Open**, the coin tray, the
       `aria-live` status, the album (twelve `data-slot="<id>"` elements in
       `CARDS` order, `×n`, silhouettes) and the tally. The server render
       (before the effect) shows the empty album and 5 coins, so the HTML
       always has the twelve slots.
     - The page also renders the rates line from `ratesLine()`, the footer
       disclaimer (Features 6) and a top bar with
       `<a href="/">otohime.dev</a>`.
  7. `isolation.test.ts` now also asserts that the scan finds `layout.tsx`
     and `capsule.css`.
  8. `content/site.ts`: append to `projectList` `{ title: "Capsule", note:
     "A coin, a crank, and a hand-drawn card to keep.", href: "/capsule",
     status: "live", colour: "coral" }`. Shore stays first.
  9. `lib/build-stamp.test.ts`: assert that `app/(capsule)/layout.tsx`
     publishes `build-sha` (same regex as Shore's).
     `e2e/rbac.test.ts`: the Projects test also expects `href="/capsule"`, and
     a new test checks `/capsule` returns 200 without `aria-label="Main"`.
  10. `scripts/walk-capsule.sh` (bash, `set -u`, no `set -e` around the
      checks), modelled on pm-181 revision 3's walk spec:
      - **Local mode (default):** set the CI placeholder env if unset:
        `BETTER_AUTH_SECRET=ci-placeholder-not-a-real-secret-0123456789abcdef`,
        `BETTER_AUTH_URL=http://localhost:$PORT`,
        `DATABASE_URL=postgresql://otohime:otohime@localhost:5432/otohime` and
        `GITHUB_SHA=0123456789abcdef0123456789abcdef01234567`. Run
        `npm run build` unless `SKIP_BUILD=1`, with the log in a temp dir that
        is printed on failure. Start `./node_modules/.bin/next start -p
        "$PORT"` (`PORT` defaults to **4021**) in its own process group, and
        have the EXIT trap kill that group. Readiness is a silent loop of at
        most 60 × 1 s `curl -s -o /dev/null`.
      - **Remote mode:** when `BASE_URL` is set, skip build and start.
        `EXPECT_SHA` defaults to `GITHUB_SHA` locally. Remotely, if unset, any
        40-hex `build-sha` counts.
      - **Output:** a `check <name> <command…>` helper prints `ok - <name>` or
        `not ok - <name>: <detail>`. The script ends with `walk: N ok, M
        failed` and exits 1 if M > 0. Count with `grep -c` or `grep -o … |
        grep -c .`, compare with `-eq`/`-ge`, and never use `wc -l`.
      - **Checks:**
        - (local only) `.next/app-path-routes-manifest.json` lists
          `"/capsule"`.
        - `/capsule` returns 200 with `<title>Capsule</title>`, no
          `aria-label="Main"`, a `build-sha` meta equal to `EXPECT_SHA`,
          exactly 12 `data-slot="`, the texts `Insert coin`, `Turn`, `Open`,
          `Legend 5%` and `Not affiliated`, and an `href="/"`.
        - `/capsule` links exactly one stylesheet under `/_next/static/`.
          That stylesheet is fetched with a 200 and a non-empty body and
          contains none of `--tw-`, `tailwind` or `--color-paper`. A missing
          or empty stylesheet fails the check.
        - `/projects` returns 200 with `aria-label="Main"`, exactly one
          `href="/capsule"` and at least one `href="/shore"`.
        - `/shore` returns 200 (Shore is untouched).
        - `/`, `/work`, `/play`, `/notes` and `/music` return 200.
        - `/capsule/nope` and `/nonexistent` return 404 with `Nothing in this
          parcel`.
  11. `README.md`: in the layout block, Capsule's line names `_components/`
      and `_lib/art/`. Add how to walk it (`bash scripts/walk-capsule.sh`;
      `BASE_URL=https://otohime.dev bash scripts/walk-capsule.sh`) and how to
      see the art (`npm run capsule:sheet > /tmp/capsule.svg`).
  12. Run the walk on this lease; it must exit 0. Stop stray servers with
      `pkill -x next-server`, never `pkill -f "next start"`. Commit and push
      with the owner identity.
- **Interfaces:** `app/(capsule)/`; `content/site.ts`; `lib/build-stamp.test.ts`;
  `e2e/rbac.test.ts`; `scripts/walk-capsule.sh`; `scripts/capsule-sheet.ts`;
  `package.json`; `README.md`
- **Non-goals:** the other eight drawings; the enlarge view; Reset album; a dark
  scene; any change to `app/(shore)/` or to how `app/(site)/` looks; a browser
  test harness; CI workflow changes.
- **Acceptance:** `/capsule` serves its own page: title "Capsule", no sidebar,
  one stylesheet with no Tailwind or site tokens, `build-sha`, twelve album
  slots, the three buttons, the rates line and the disclaimer. `/projects`
  links to it once, and Shore and the site pages are unchanged. The four
  drawings pass the art test, and `npm run capsule:sheet` prints them. `bash
  scripts/walk-capsule.sh` exits 0 on the delivery sha.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `bash -n scripts/walk-capsule.sh && ! grep -nE 'wc +-l' scripts/walk-capsule.sh`
  - `npm run --silent capsule:sheet | grep -q '<svg'`
  - `bash scripts/walk-capsule.sh`
  - `if curl -s -o /dev/null --max-time 2 http://localhost:4021/; then exit 1; fi`
    (no server left behind)
  - `if BASE_URL=http://127.0.0.1:4031 bash scripts/walk-capsule.sh; then exit 1; fi`
    (the walk fails when Capsule is not there)
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 3. Draw the other eight cards

- **Role:** software_engineer, depends on 2. Runs in parallel with 4. QA is
  required, because a person sees the art.
- **Problem:** Eight of the twelve cards still show a bare frame with a name.
  The set is not complete until every card is drawn in the brief.
- **Action items:**
  1. Add `app/(capsule)/_lib/art/` drawings for `kodama`, `heen`, `teto`,
     `ponyo`, `catbus`, `calcifer`, `kiki` and `robot-soldier`, following the
     art brief. Register them in `art/index.ts`.
  2. `art.test.ts`: every id in `CARDS` has a drawing (`Object.keys(ART)`
     equals the `CARDS` ids). All existing checks still pass for all twelve.
  3. `README.md`: one short paragraph on adding or swapping a card: an entry
     in `_lib/cards.ts` plus `_lib/art/<id>.ts`, checked by `art.test.ts` and
     previewed with `npm run capsule:sheet`. This is also the takedown
     rollback: replace the set with original characters and leave the machine
     untouched.
  4. Look at the sheet. On macOS, `npm run --silent capsule:sheet >
     /tmp/capsule.svg && qlmanage -t -s 1200 -o /tmp /tmp/capsule.svg`; else
     use any SVG viewer. Fix anything that breaks the brief. Do not commit the
     image.
  5. Commit and push with the owner identity.
- **Interfaces:** `app/(capsule)/_lib/art/`; `app/(capsule)/_lib/art.test.ts`;
  `README.md`
- **Non-goals:** changes to the machine, the economy, the card list or the
  rates; components; CSS; raster or AI images.
- **Acceptance:** all twelve cards are drawn in the hand-drawn chibi brief and
  pass the art test (every card drawn, inside the viewBox, absolute paths,
  known fills), and the sheet shows twelve cards. `bash
  scripts/walk-capsule.sh` still exits 0.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(capsule)/_lib/art.test.ts'`
  - `test "$(ls 'app/(capsule)/_lib/art' | grep -cvE '^(index|types|svg)\.ts$')" -eq 12`
  - `bash scripts/walk-capsule.sh`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 4. The album's enlarge view and Reset album

- **Role:** software_engineer, depends on 2. Runs in parallel with 3. QA is
  required.
- **Problem:** An owned card can only be seen at album size, and there is no
  way to start the album over.
- **Action items:**
  1. Tapping an owned card opens a native `<dialog>` with the card large, its
     name, film and year, tier, `×n` and note. Esc and a Close button close
     it, and focus returns to the card. Unowned slots are not buttons.
  2. Add **Reset album** under the album. The first press turns it into an
     inline "Reset album? This clears your 7 cards. [Reset] [Keep]". Reset
     calls `actions.resetAlbum` and writes the ledger, and Keep restores the
     button. It is never `window.confirm`.
  3. Audit `prefers-reduced-motion`: the crank, capsule, flip and dialog
     transitions have no motion, and the tick loop settles.
  4. `actions.test.ts`: reset then reload (serialize and normalize) keeps
     coins and seed, owns nothing, and the next `turn` still spends one coin.
  5. `scripts/walk-capsule.sh`: add a check that `/capsule` HTML contains
     `Reset album`.
  6. Commit and push with the owner identity.
- **Interfaces:** `app/(capsule)/_components/`; `app/(capsule)/capsule.css`;
  `app/(capsule)/_lib/actions.test.ts`; `scripts/walk-capsule.sh`
- **Non-goals:** art; economy or rate changes; a dark scene; sharing.
- **Acceptance:** an owned card opens large with its note and closes by Esc or
  Close. Reset album asks inline, then empties the album without touching
  coins. Reduced motion has no animation. The walk sees `Reset album` and exits
  0.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `grep -rq '<dialog' 'app/(capsule)/_components' && ! grep -rqE 'window\.confirm|[^A-Za-z_.]confirm\(' 'app/(capsule)/_components'`
  - `grep -q 'Reset album' scripts/walk-capsule.sh && bash scripts/walk-capsule.sh`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

## QA and acceptance

- **QA (tasks 2, 3 and 4):**
  1. Rerun the task's verification on the delivery sha.
  2. Render the art sheet (`npm run --silent capsule:sheet`) to a PNG and
     attach it. Judge it against the brief: a single ink outline, flat fills,
     blush, a chibi head-to-body ratio and a recognisable character. Fail
     (cause=code) only for a clear miss, such as a gradient, a raster image,
     an unrecognisable character or a card outside its frame.
  3. Read `<meta name="build-sha">` on https://otohime.dev/. If it is the
     delivery sha or a descendant, run `BASE_URL=https://otohime.dev
     EXPECT_SHA=<that sha> bash scripts/walk-capsule.sh`.
  4. If a headless browser works, click Insert coin → Turn → Open → reload and
     attach screenshots. The card should still be in the album. A missing
     browser is a note, not a fail.
  5. Do not fail a delivery for a `Co-Authored-By` trailer or for a committer
     the push helper rewrote. The identity check is the author email.
- **Acceptance:** if otohime.dev serves the final sha, run
  `BASE_URL=https://otohime.dev EXPECT_SHA=<final sha> bash
  scripts/walk-capsule.sh`. Then follow `/projects` → the Capsule row →
  `/capsule` → "otohime.dev" → `/`, and attach the art sheet. Otherwise walk a
  local `bash scripts/walk-capsule.sh` of the final sha and pass with a watch on
  https://otohime.dev/capsule: the same remote walk with `EXPECT_SHA` set to
  the final sha or a descendant, `not_before` one hour after the push.

## Risks

- **Takedown.** The risk is low for non-commercial fan art but not zero. The
  rollback is task 3's swap path: new entries in `cards.ts` and `art/`, with
  the machine untouched.
- **Art quality.** Hand-coded SVG is the part most likely to look wrong. Four
  cards come first so the frame and brief settle, the sheet makes every card
  reviewable without playing, and QA judges it.
- **Shared files with pm-181.** `README.md`, `package.json` and
  `e2e/rbac.test.ts` may change under pm-181 too. On a non-fast-forward push,
  `git pull --rebase`, rerun the tests and push again.
- **Daily clock.** Refills follow local midnight, so a traveller can get one
  early. This is accepted.
- **Port clash.** The walk defaults to 4021 (Shore uses 4019) and takes `PORT`.
- **Stopping servers.** Use `pkill -x next-server`, never
  `pkill -f "next start"`.
- **`AGENTS.md` churn.** `next dev` re-adds its block. Leave it alone.
