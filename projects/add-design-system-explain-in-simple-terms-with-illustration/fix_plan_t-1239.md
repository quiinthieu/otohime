# Fix plan: pm-216 / t-1239 (run-7125)

Cause: **code**. The board paints its spot and body fills into rough.js stroke-only paths, so a fill shows as slivers. Spot coral leaves the Send button paper-coloured, and the arrowhead, the note's bar, the caret and the card's underline hollow. See `qa_report_t-1239.md`. Failing sha: 1b165f3 (deployed).

## Changes

1. **`app/(design-system)/_lib/stamps.ts:84-89` (`draw`)**: give each stamp a closed fill shape, separate from its rough stroke.
   - Body: keep the rough stroke `inkPath(boxPath(w, h, r), { seed })` for the outline. Add `fill: boxPath(w, h, radiusOf(part, corner))`, the exact closed path (one subpath ending `Z`), as the shape the body colour goes on. Extend `Stamp` to `{ id; part; corner; fill: string; outline: string[]; accent: string[] }`, where `outline[0]` is still the per-corner rough body stroke.
   - Spot marks (lines 53–80): add a closed fill to each. Either pass rough.js `{ fill: <any colour>, fillStyle: "solid" }`, so `toPaths` emits a fill path before the stroke, or add the exact closed shape (`boxPath` for rects, an SVG circle path for dots, the triangle `M… L… L… Z` for the arrowhead). Keep the accent split as `accentFill: string[]` (filled with `--part-accent`, no stroke) and `accentStroke: string[]`.
2. **`app/(design-system)/_components/board.tsx:21-31` (`kit`)**: send per corner `bodies: { id, fill, d }`, where `d` is the rough body stroke (it differs by corner, so it cannot sit in the shared `details`). Keep the "a corner changed more than the body" guard over `details` and the accents only.
3. **`app/(design-system)/_components/board-app.tsx:137-149`** (the `<defs>`):
   - in each `<symbol>`, first `<path d={b.fill} fill="currentColor" stroke="none"/>`, then `<path d={b.d} fill="none" strokeWidth={2.2} …/>`, then the marks;
   - in `marks-<part>`, the accent fill as `<path d={accentFill} stroke="none"/>` (it takes `fill` = `--part-accent` from the `<use>`), then the accent stroke with `fill="none"`.
4. **The button's word must follow the paper** (`board-app.tsx:89-100`): once the button is solid spot, "Send" in ink on blue is 2.5:1 and illegible. It also leaves the Paper knob cream → white with nothing to move on the button. Paint the button's word in `var(--board-paper)` with the system on, and in DRIFT's own paper with it off. Then Paper moves the button's label and every knob still moves all nine parts.
5. **Tests that would have caught it**:
   - `app/(design-system)/_lib/stamps.test.ts`: every stamp has a `fill` that is one closed subpath (exactly one `M`, ends in `Z`); every accent fill path ends in `Z`; a part's fill sits inside its `STAMP_SIZE` + 4.
   - `app/(design-system)/_lib/isolation.test.ts` or a new `board-app` text test: no `<path>` in the island's `<defs>` has both a fill and a rough stroke `d`.
   - `scripts/probe-design-system.mjs:120-130`: after Spot coral, take a screenshot of `use[data-part="button"]` and check that the pixel at its centre-left (between the frame and the word) is within 20 of `rgb(239, 106, 76)`. Also check that at least 2% of `use[data-part="note"]`'s pixels are coral. Do the same for Paper night with Spot yellow on the button. Add a check that after Paper white the button's word computes `fill` `rgb(255, 255, 255)`.
6. **README**: none; the Design system section's wording still holds.

## Verify

The contract's list unchanged (`npm ci && npm run lint && npm run typecheck && npm test`, walk, dead-port walk, probe, motion probe, one client file, wiring, identity). Then look at the board at 1366×768 at the default (a solid blue Send button with a paper-coloured "Send", a filled blue arrowhead and note bar) and after Spot coral (all of them coral). Commit as `Otohime <quiinthieu@gmail.com>`, subject `pm-216/t-1239: …`, and push to main. Vercel deploys owner-authored commits; check `<meta name="build-sha">` on `https://otohime.dev/design-system`.

## Pipeline

Nothing to repair. The deploy works: production serves 1b165f3. The next push redeploys.
