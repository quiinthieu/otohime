# Research: a coin-operated card gacha of Ghibli characters (pm-184)

Submitted by research run-6262 as a report body. The product owner commits it as
`projects/add-a-new-project-input-some-coins-to-draw-cards-cards-are-c/research.md`.

Idea: "Add a new project. Input some coins to draw cards. Cards are collectibles characters
from the Ghibli studio movies. The artstyle is hand-drawn. Here is the art style reference:
https://www.pinterest.com/pin/711709547410982905/"

## Recommendation

Build **Capsule**, a capsule-toy machine at `otohime.dev/capsule`. You drop a coin in, turn
the crank, a capsule rolls out, and you open it to find a card: a chibi, hand-drawn portrait
of a Studio Ghibli character. Coins are free (a small daily allowance), the collection lives
in `localStorage`, and the next card is decided by a stored seed so a reload never re-rolls.
It follows Shore (pm-181) exactly: its own route group `app/(capsule)/` with its own root
layout and stylesheet, no Tailwind, no table, no migration, no auth, no API, a pure reducer
under `_lib/` that the unit tests can play without a browser, and a second row on the
Projects bench.

Two things decide the shape of the work:

1. **Rights.** The characters belong to Studio Ghibli, Inc.; "Studio Ghibli" and the Totoro
   silhouette are registered trademarks. Non-commercial fan art is tolerated in practice but
   is not licensed. So the art must be original hand-drawn work in a chibi style (no film
   stills, no logos, no "Ghibli" in the project's name or URL), nothing is ever for sale, a
   footer says so, and the character set is **data** (`cards.ts`), so swapping to original
   characters after a takedown is a content change, not a rewrite.
2. **Coins are never bought.** Paid loot boxes are gambling in Belgium and the Netherlands,
   and Japan bans set-completion ("kompu") gacha. With free coins and no cash path, none of
   that applies. The page still shows the drop rates and a pity rule, which is the
   Japanese industry's own good-practice line (JOGA 2012, CESA 2016).

Three software-engineer tasks are enough (machine and economy; the twelve cards; polish and
the album). No build spike was needed: pm-181's spike on Next 16.4.2 already proved a second
root layout, and this project is structurally identical to Shore.

## What the reference actually shows

The pin (`711709547410982905`, created 27 Jun 2026) is titled "Cartoon images for ppt
presentation | Cute animated characters for presentation, Dibujos de personas, Chibi
drawings", source "Uploaded by user" (no artist credit), image 736×635. It is a chibi girl
in a red sweater, arms flung wide, eyes closed, laughing. It is **not** a Ghibli still and
not a Ghibli character. So the pin sets the **style**, and the idea sets the **subject**.

The style brief, read off the image:

- **Line.** One heavy ink outline in warm near-black (`#3a2a28`-ish), uniform weight,
  rounded joins and caps, every shape closed. A few stray strands of hair poke out as
  single lines.
- **Fill.** Flat colour, no gradients: red sweater, dark brown hair, warm skin, black skirt,
  white ground. Each shape gets at most one darker flat shade shape (the inner sleeve, the
  hair's underside), never a soft shadow.
- **Face.** Closed eyes as two arcs with a tiny lash, a D-shaped open mouth filled in,
  pink blush ovals under the eyes, a dot of a nose. Big head, small hands (chibi
  proportions, roughly 1 : 2 head to body).
- **Mood.** Joyful, simple, slightly wobbly. Nothing is perfectly straight.

This is drawable as SVG line work, which is how the whole site already draws its figures.
The reference image itself must not be copied (unknown artist, no licence).

## What the repo gives us

- **A project pattern.** Shore (`app/(shore)/`, pm-181): own root layout and CSS, pure
  `_lib/*.ts` with `node --test` tests, `localStorage` ledger read through a `normalize`
  function, light/dark scene, reduced motion, `build-sha` meta, an `isolation.test.ts`
  that forbids imports across the boundary, an e2e check that `/shore` has no sidebar,
  and a row in `site.projectList`. `README.md` already states the rule: "A page with its
  own design gets its own route group with a `layout.tsx`".
- **A machine pattern.** `lib/machines.ts` drives every operable figure as
  `(state, action) => state` with `"tick"` and `"settle"` frames at 12 fps ("on twos"),
  and `components/claw-machine.tsx` already has a coin slot, a prize door and a capsule
  shape. Capsule cannot import these (isolation), but it copies the idea: a reducer the
  tests can play, a `useTick`, and a `press()` that settles under reduced motion.
- **A hand-drawn look.** `components/figures.tsx` `Inked` wobbles line work with
  `feTurbulence` + `feDisplacementMap` and speckles it. The same ten-line filter, written
  again inside `app/(capsule)/`, gives the cards their hand-drawn edge.
- **Delivery rules.** Delivery commits must be authored as `Otohime <quiinthieu@gmail.com>`
  via `GIT_AUTHOR_*`/`GIT_COMMITTER_*` env (Vercel Hobby only deploys the owner's commits);
  the plan already carries that `commit_identity`. Public pages serve with no database.
  CI's Next cache key hashes only `*.ts/tsx/js/jsx`, and the job rules say no binaries, so
  **cards are SVG in code, not PNGs**.

## Rights and rules in detail

**Copyright and trademark.** Studio Ghibli owns the characters; "Studio Ghibli" and the
Totoro silhouette are registered marks in Japan, the US and the EU. Fan art that
reproduces recognisable characters is a derivative work. Rights holders tolerate
non-commercial fan art and act on commercial use, logos and stills. Style itself cannot be
copyrighted, which is why "in the style of" is safe and specific characters are the only
exposure. Ghibli's own gesture, 400+ film stills released in 2020 "to be used freely within
the bounds of common sense", is for stills, which we do not want anyway.

Mitigations, all cheap:

- Original drawings in the chibi brief above, not traced from frames; no film stills; no
  Ghibli logo; no "Ghibli" in the project name, route or `<title>`.
- Footer: "Fan art, drawn by hand. The characters belong to Studio Ghibli. Not affiliated;
  nothing here is for sale."
- `cards.ts` holds the set; the drawing components are keyed by card id. A swap to original
  characters is a data-and-art change with the machine untouched.
- No AI-generated images: the 2025 "Ghibli-style" image wave is exactly the controversy to
  stay out of, and it would also put binaries in the repo.

**Gacha law.** Paid loot boxes are regulated as gambling in Belgium (2018 ruling, even for
untradeable prizes) and the Netherlands; Japan's Consumer Affairs Agency banned kompu gacha
in 2012 and the industry self-regulates rates and spend caps. Capsule has **no cash path**:
coins are a free allowance, cannot be bought, and cannot be traded. That keeps every one of
those regimes out of scope. Still show the rates and the pity rule under the machine; it
costs one line and is the honest thing.

## Product proposal: Capsule

**Loop.** Open `/capsule`. The tray shows your coins. Press **Insert coin** (the coin drops,
the crank unlocks), press **Turn** (the crank spins on twos, a capsule tumbles into the
chute), press **Open** (the capsule halves part, the card rises and flips face-up with its
name, film and year). The card joins the album below. Come back tomorrow for more coins.

**Coins.** 5 to start, 3 more every local day (the same `dayNumber` idea as Shore's
pebbles), held to a cap of 9 unspent so the daily visit stays the loop. Never purchasable.

**Draws.** The ledger stores a random `seed` minted on first visit and a `draws` count. The
n-th draw's outcome is `pick(prng(seed, n))`, so a reload or a cleared tab never re-rolls
the next capsule, and a test can replay a thousand draws against the rate table.

**Rarities.** Three tiers: *common* 70 %, *rare* 25 %, *legend* 5 %. Pity: if 19 draws
pass without a legend, the 20th is one. Duplicates stay in the album as a `×n` count
(nothing to grind, no dust economy, no set-completion reward: that is the kompu line).

**Card set (v1, twelve).** The owner picks; a starting list that draws simply:

| Tier | Card | Film (year) |
| --- | --- | --- |
| common | Soot sprite | My Neighbor Totoro (1988) |
| common | Kodama | Princess Mononoke (1997) |
| common | Jiji | Kiki's Delivery Service (1989) |
| common | Heen | Howl's Moving Castle (2004) |
| common | Teto | Nausicaä of the Valley of the Wind (1984) |
| common | Ponyo | Ponyo (2008) |
| rare | Totoro | My Neighbor Totoro (1988) |
| rare | Catbus | My Neighbor Totoro (1988) |
| rare | Calcifer | Howl's Moving Castle (2004) |
| rare | Kiki | Kiki's Delivery Service (1989) |
| legend | No-Face | Spirited Away (2001) |
| legend | Robot soldier | Castle in the Sky (1986) |

Each entry: `{ id, name, film, year, tier, colour, note }` plus a drawing component.
Film titles and character names are facts about the works and can be stated; the
exposure is only the likeness, covered above.

**Art.** Every card is an SVG in `app/(capsule)/_cards/<id>.tsx` on a `0 0 120 160`
viewBox: outline stroke 3.5, round joins, flat fills, one flat shade shape, blush ovals,
closed-arc eyes, a D mouth where it fits. A shared `<Card>` frame adds the paper, a rarity
band (plain, a thin foil line, a full foil border) and the wobble filter. The site's five
swatches are not reused; Capsule has its own small palette (paper `#f6f1e7`, ink `#3a2a28`,
blush `#f3a6bb`, plus one flat colour per card). Dark scene optional; the reference is a
white-ground style, so v1 can be light-only.

**Album.** A grid of twelve slots under the machine: unowned slots show a grey silhouette
and the tier; owned show the card and `×n`. Tapping a card enlarges it with its note.
A tally line: "7 of 12 · 23 draws".

**Motion.** The crank, capsule and flip run on twos via `setInterval(1000/12)`, and
`prefers-reduced-motion` settles each press. The readout is an `aria-live="polite"`
status ("A soot sprite. Common."). Buttons are real buttons; the crank is not a drag.

**Persistence.** `localStorage["capsule-v1"]` = `{ seed, draws, coins, lastDay, owned:
{ [id]: count } , pity }`, read only through `normalizeLedger()` that clamps and drops
junk, as Shore does. "Reset album", confirmed inline, is the only destructive action.

**Isolation.** `app/(capsule)/layout.tsx` with its own `<html>`, `<body>`,
`import "./capsule.css"`, title template `%s · Capsule`, `build-sha` meta and a theme
colour. The page's metadata uses `title: { absolute: "Capsule" }` (pm-181's lesson). The
top bar links home with a plain `<a href="/">` (another root layout is a full page load).
Generalise `isolation.test.ts` to scan every `app/(…)` group other than `(site)` so Shore
and Capsule share one checker; Shore's copy moves to `lib/` or stays and Capsule gets its
own, whichever the PO prefers (sharing is less code).

**Site touch points.** `content/site.ts` gets `{ title: "Capsule", note: "A coin, a crank,
a hand-drawn Ghibli card.", href: "/capsule", status: "live", colour: "coral" }`;
`e2e/rbac.test.ts` expects `/projects` to link to `/capsule` and `/capsule` to answer 200
without `aria-label="Main"`; `package.json` `test` adds `'app/(capsule)/_lib/*.test.ts'`;
README's layout block adds the line; `lib/build-stamp.test.ts` asserts Capsule's layout
publishes `build-sha`.

## Proposed tasks (for the product owner)

1. **Machine and economy.** `app/(capsule)/` layout, CSS, `_lib/gacha.ts` (prng, rate
   table, pity, reducer with tick/settle), `_lib/ledger.ts` (normalize, daily coins),
   tests for both (rates over 1 000 seeded draws within ±3 points, pity fires at 20,
   reload keeps the next outcome, coins refill once per day and cap at 9), the machine
   component with Insert / Turn / Open, the card frame, **four** cards (one legend, one
   rare, two common), the album, footer disclaimer, the projects row, e2e and README.
   Verification: lint, typecheck, unit tests, a `next start` walk on a free port
   (`/capsule` 200, title "Capsule", no sidebar, one stylesheet with no `--tw-`,
   `/projects` links to `/capsule` once, site pages and 404 unchanged), owner-authored commit.
2. **The other eight cards.** Pure art: eight `_cards/*.tsx` in the brief, registered in
   `cards.ts`. Verification: a unit test that every card id in `cards.ts` has a drawing and
   every drawing stays inside the viewBox (parse the SVG's numeric coordinates), plus the
   walk. Can run in parallel with 3 once 1 lands.
3. **Polish.** Card enlarge view, `×n` badges, "Reset album", reduced-motion check,
   light/dark scene if wanted, screenshots for QA.

QA for each: rerun the task's verification on the delivery sha; a headless-browser click
through Insert → Turn → Open → reload → the card is still in the album. Acceptance walks
production if `build-sha` has caught up, else a local `next start` with a watch on
`https://otohime.dev/capsule`, as pm-181 did.

## Risks

- **Takedown.** Low for non-commercial fan art, but not zero. The data-only card set is the
  rollback; the plan should say so in one line.
- **Art effort.** Twelve hand-coded SVGs is the bulk of the work and the thing most likely
  to look wrong. Four first, then eight, so the frame and the brief are settled before
  the volume.
- **Rates and pity.** Keep them in one table in `gacha.ts` and print them on the page from
  that table, so the page never lies.
- **The daily clock.** Local-midnight refills copy Shore's `dayNumber`; a travelling
  visitor can get a refill early. Acceptable; note it.
- **Stopping servers in verification.** `pkill -x next-server`, never `pkill -f "next
  start"` (pm-181's lesson).

## Decisions recorded in this run

- Own route group and localStorage, like Shore; no table, auth or API.
- Coins are free and never purchasable; rates and pity shown on the page.
- Ghibli characters as original hand-drawn chibi SVG fan art with a disclaimer; the set is
  data so it can be swapped; no stills, logos, AI images or "Ghibli" in the name.
- No build spike: pm-181's spike covers the same structure.
- Lesson: the Pinterest reference is a generic chibi drawing, not Ghibli; fetch pins with
  curl and a browser UA (WebFetch returns nothing usable) and read the `og:image`.

## Sources

- Pin metadata and image: https://www.pinterest.com/pin/711709547410982905/ (og:image
  `i.pinimg.com/originals/1a/11/67/1a1167231227788b49dd631c3dbb26ed.jpg`)
- Ghibli marks and fan art practice: https://flagproof.com/trademarks/studio-ghibli ;
  https://www.fdotstokes.com/2022/10/29/does-studio-ghibli-allow-fan-art/
- Style is not copyrightable: https://marksgray.com/intellectual-property-law/studio-ghibli-ai-images-you-cant-copyright-a-style/ ;
  https://omnialawchambers.com.sg/2025/04/01/can-you-copyright-a-style-studio-ghibli-ai-art-the-law-behind-the-headlines/
- Loot boxes and gacha: https://en.wikipedia.org/wiki/Loot_box ;
  https://www.lexology.com/library/detail.aspx?g=9207df10-a8a2-4f67-81c3-6a148a6100e2 ;
  https://gamblingclub.be/en/are-loot-boxes-legal-in-belgium/ ;
  https://gachawiki.com/wiki/gacha-regulation
- Repo: `README.md`, `app/(shore)/`, `lib/machines.ts`, `components/claw-machine.tsx`,
  `components/figures.tsx`, `projects/create-a-project-that-utilize-this-repo-ui-design-https-gith/plan.md`
