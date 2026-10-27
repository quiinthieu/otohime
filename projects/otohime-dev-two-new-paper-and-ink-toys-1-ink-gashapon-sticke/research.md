# pm-286 research: Ink Gashapon & Sticker Book, Shodo Practice Desk

Note: /shared is a read-only filesystem in this lease, so /shared/artifacts/answer.md could not be written. This body is the answer. I did not browse the reference URLs; the findings below come from the repo and general knowledge. Nothing was pushed, per instructions. The plan doc named in the prompt (projects/20260921222547_...) is not in the checkout.

## Repo fit (verified)
- Routes live under `app/(site)/(app)`. `/play` exists (`play/page.tsx`: ClawMachine, pond, peep box, ink press). Add `/play/gashapon` and `/play/shodo` below it and link from Play. Per the pm-285 research, do NOT add nav entries: `lib/pages.ts` pins the labels.
- Audio: one shared context in `lib/sound-client.ts`, gated by `localStorage.sound`, starts off, and created only on a user gesture. Pure cues are data in `lib/sound.ts` (`CueName`, capped at `MAX_DB=-18`). Add cues `crank`, `drop`, `crack` and `brush` there, with envelope tests, and reuse the switch.
- Pure-logic-plus-thin-component pattern (`lib/stamps.ts` with `components/stamp-board.tsx`, `lib/ink-press.ts`, `lib/kame.ts`). Follow it: all rules in `lib/*.ts` with Vitest, and components only draw.
- Headings: `RisoText` (components/riso-heading.tsx) wraps the text in spans and adds an aria-hidden copy. Tests must use `getByRole(..., {name, exact:true})` (earlier lesson).
- Hanko Press (pm-285): the research proposes a deterministic NFKC-normalised seal from a name (SVG and PNG, canvas glyphs). Shodo should import its pure generator once pm-285 has landed. Its code is not in the tree yet (only the projects/ docs exist). Fallback: a static red `印` seal with the visitor's name, behind the same interface, so Shodo does not block on pm-285.
- Build gotchas: run `npm ci` on a fresh lease. A stale `.next` breaks the Turbopack font build, so move it aside. AGENTS.md says this Next has breaking changes: read `node_modules/next/dist/docs/` before writing routes.

## Toy 1: Ink Gashapon & Sticker Book

### Design
- **Data (`content/stickers.ts`):** about 40 stickers, each with id, name, category (project, tool, music, mascot, secret), rarity, and an SVG path set. Tools include Spark, Airflow, DuckDB. Hand-drawn look via roughjs, which is already a dependency per the lessons. Rarities: common, uncommon, rare and secret.
- **Kuji board (`lib/gashapon.ts`, pure):**
  - `STOCK`: a fixed per-tier count, e.g. 60 common, 25 uncommon, 12 rare, 3 secret per "batch".
  - The draw samples WITHOUT replacement from the remaining stock, and the board shows odds as remaining/total. This gives honest odds and remaining stock exactly like a kuji board, and a small bounded batch.
  - When a batch empties, a new batch starts, with a counter.
  - Seeded PRNG for tests. Draw order is persisted, so reloads cannot re-roll.
  - Duplicates give a "duplicate" counter, not a new sticker.
- **Coins:** earned by visiting pages (one coin per distinct route per day, max N per day) and by hidden finds, with no purchase path. Persisted as `{coins, visitedByDay}` in localStorage. A pure `earn(state, route, now)` is unit-tested. The sticker shelf is client-only, so it never needs a server or auth.
- **Machine UI (`components/gashapon.tsx`):** SVG machine. Pointer-drag rotates the knob (atan2 around the centre, accumulate angle, a click every 30° plays the `crank` cue, a full turn triggers a draw). Keyboard: Space/Enter turns the knob, so it works without a pointer. Capsule roll animation (CSS transform), then a crack-open reveal. `prefers-reduced-motion` skips the roll and shows the result at once.
- **Holo foil secret rare:** a WebGL or CSS-only shader. Preferred: CSS `conic-gradient` plus `mix-blend-mode` driven by pointer position (cheap, no GL context). Optional upgrade to a small fragment shader behind a feature check. Static foil is shown when reduced-motion is set or WebGL is unavailable.
- **Album page (`/play/gashapon/album`, or a tab):** drag stickers onto a page (pointer events, positions stored as normalised 0–1 coordinates), saved in localStorage (versioned key, Zod-style validation on load, with corrupt data falling back to empty). Share: render the album to a canvas, then `toBlob` and download as PNG (draw SVG stickers onto the canvas directly, as pm-285 does for Hanko, since fonts may not load inside an SVG image). No server upload, so no privacy concern.
- **Scavenger hunt:** `data-sticker-hunt` spots in Notes, Sketches and 404, plus a Konami-sequence listener (a pure `konami(seq)` matcher). Each hidden sticker is claimed once, grants a sticker directly, and shows a small toast. The listener must not fire while the user types in inputs.
- **Honest-odds panel:** a table showing each tier's remaining/total and percentage, computed from the same state the draw uses (so the display cannot drift from the draw).

### Risks
- localStorage may be unavailable (private mode): wrap in try/catch and keep memory-only state with a notice.
- Hidden spots add client code to several pages: keep a tiny shared `<StickerSpot id>` component and lazy-load the machine.
- Sound is off by default, and the cues need the existing gate.
- Shader cost on low-end phones: static fallback.

## Toy 2: Shodo Practice Desk (/play/shodo)

### Design
- **Brush engine (`lib/brush.ts`, pure, deterministic):**
  - A brush has about 30–60 bristles in a disc. Each bristle carries its own ink load, offset and wear.
  - Per pointer sample (x, y, pressure, t): speed = distance/dt. Width = f(pressure, speed), where faster means thinner (taper). Pointers with no pressure (mouse and touch report constant or 0.5) use a speed-only model, with a documented fallback.
  - Each bristle deposits ink and drains its load, so the brush runs dry and shows "kasure" streaks (the dry-brush effect) when load is low. A reload happens when the brush is dipped (button, or a new stroke after the ink well).
  - Bleed along paper fibres: a precomputed fibre-noise field (seeded value noise, anisotropic) modulates the diffusion of the deposited ink. Do one small blur pass per stroke on an offscreen canvas, not per frame.
  - Render to a canvas at devicePixelRatio, capped (e.g. 2). Use a washi texture generated procedurally (no binary assets).
  - Run it in an OffscreenCanvas worker later if frame time suffers. Start on the main thread with budgets.
- **Ghost and scoring (`lib/shodo.ts`):**
  - Source data: KanjiVG (CC BY-SA 3.0). Licensing: it requires attribution and share-alike for the data. Ship a SMALL curated subset (about 60 kyōiku-grade kanji, derived to compact polyline JSON in `content/kanji.ts`) with an attribution line on the page and in the README. Do not fetch at runtime from a third-party host.
  - Daily kanji: `index = dayNumber(local date) mod N`, deterministic and testable.
  - Scoring is gentle: resample the user's stroke and the template stroke to 32 points, normalise to the glyph box, then use mean point distance. Stroke order is correct if the k-th drawn stroke best matches template stroke k. Show stars, never fail. Tolerance is generous, and scoring is tested with fixtures (a perfect trace, wrong order, a far-off stroke).
- **Seal and export:** sign with the Hanko seal (see above), placed bottom-right with a stamp animation and the existing `stamp` cue. Export PNG by compositing paper, ink canvas and seal into one canvas, then `toBlob` and download. A Web Share API button is shown when available.
- **Bonus site-wide use:**
  - A `brush-reveal` heading variant: a mask animated by the brush engine, applied via a wrapper that keeps the real text in the DOM (accessibility, plus RisoText compatibility).
  - An ensō loader: a single circular stroke drawn by the engine, or a plain SVG `stroke-dashoffset` fallback so the loader is cheap.
  - Reduced motion shows the final state instantly (ensō static, headings revealed). Test with `emulateMedia({reducedMotion})`.
  - Ship the toy first, and the bonus as a separate task so it cannot block the toy.

### Risks
- Mouse and trackpad give no pressure, so the speed model has to carry the feel. Tune by fixture, but the feel needs a human check on a device.
- Performance: per-bristle splatting on every sample. Budget about 60 bristles by about 120 samples per second, and use a pooled typed array.
- Touch scrolling conflict: set `touch-action: none` on the canvas only.
- KanjiVG licence/attribution (above).
- The e2e canvas pixel tests are brittle: assert on pure-lib outputs and use coarse pixel checks (non-blank after stroke).

## Suggested task split (for the product owner)
1. `lib/gashapon.ts` plus `content/stickers.ts`: stock, draw without replacement, odds, coin earning and Konami matcher, with unit tests.
2. Gashapon machine UI, sound cues and the `/play/gashapon` route, with the Play link, e2e, and reduced-motion.
3. Album page: drag and place, localStorage persistence, PNG share, holo foil.
4. Hidden stickers in Notes, Sketches and 404 (small, depends on 1).
5. `lib/brush.ts` plus tests.
6. Kanji subset, the ghost, daily pick and scoring (`lib/shodo.ts`), with the attribution.
7. `/play/shodo` UI: canvas, washi, seal (Hanko import or fallback), PNG export, e2e.
8. Bonus: brush-reveal headings and the ensō loader, with reduced-motion.
Tasks 1–4 and 5–8 are independent chains and can run in parallel. Each SWE task needs `verification[]` with `npm test` and a Playwright smoke test.

## Judgement calls
- Draw without replacement from bounded stock, so the displayed odds are true by construction.
- Everything stays client-side (no accounts, DB or server), keeping the toys simple and reversible.
- Hanko is a soft dependency with a fallback.
- Bundle a small KanjiVG subset, not the full dataset.
