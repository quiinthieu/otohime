# t-1524 Ink Poster Press: summary (run-8711, claude-opus-5-5)

## Delivered
- `lib/ink-press.ts` (pure, no imports): `mulberry32`; a 32-bit seed that sets the whole poster. The layout is
  `LAYOUTS[seed % 3]` (stamp, riso, brush). Tilt, inks, riso misregistration and its block, wobble, bleed and the
  grain offset come from `mulberry32(seed)`. Also here: `withLayout` (the nearest seed with a given layout, which is
  what the layout chips do), `shuffleSeed` (never returns the current seed), `cleanPhrase` (24 code points max,
  strips controls and bidi characters, never splits a surrogate pair), `fitText` (cuts the phrase on spaces into
  1 to 3 lines at the largest size that fits the box), `typeBox`/`stampFrame`, `posterFilename`
  (`ink-press-<ascii slug>-<layout>-<seed>.png`), `posterQuery`/`readQuery` (`?s=<8 hex>&t=<phrase>`), `wetness`
  (drying over 2.6 s) and `displaySize` (4:5, DPR capped at 2).
- `components/ink-press.tsx`, a lazy chunk of 7,225 B gzipped (limit 12 kB). It imports only react,
  `lib/ink-press` and `lib/ink-modes`, so there is no three. Canvas2D paints a mask texture (type, the stamp's
  frame and the brush's swash in R, riso's block in G). A single WebGL2 fragment shader then applies an fbm warp,
  a blur plus a falling threshold so the ink bleeds while wet, paper grain, and each layout's texture: patchy
  stamp pressure, two riso drums overprinted out of register, dry-brush streaks.
  - rAF runs only while the ink is wet, the tab is visible and the poster is on screen (IntersectionObserver).
  - `webglcontextlost` hands over to the SVG fallback.
  - Under reduced motion it draws one dried frame and never calls rAF.
  - Export draws the dried frame at 1080x1350 and calls `canvas.toBlob` in the same task, then puts the canvas
    back to display size.
  - Without WebGL2 it shows SVG under `inkFilter` and exports through Canvas2D.
  - The URL is only rewritten (`history.replaceState`) after the visitor changes something.
- `components/ink-press-loader.tsx`: `next/dynamic(..., { ssr: false })`, mounted when the slot comes within
  400px of the viewport. Until then it shows a blank 4:5 sheet. It imports only `next/dynamic` and react.
- `app/(site)/(app)/play/page.tsx`: a new "Ink poster press (experimental)" section.
- `lib/ink-press.test.ts` (17 tests) and `e2e/ink-press.test.ts` (6 browser tests).

## Evidence (macOS 27.0.1 build-worker lease, Node 22.23.3, Next 16.4.2 Turbopack, Google Chrome 156.0.8078.48)
| check | result |
| --- | --- |
| `npm ci && npm test` | exit 0, 1968/1968 pass (1951 before, plus 17 in `lib/ink-press.test.ts`) |
| `npm run typecheck && npm run lint` | exit 0, 0 errors, the same 10 pre-existing warnings, none in touched files |
| `npm run build` | exit 0; `/play` still ◐ |
| `SKIP_BUILD=1 npm run test:e2e` (embedded Postgres 17, `next start`) | exit 0, 64/64 pass, 6 of them in `e2e/ink-press.test.ts` |
| press chunk (`.next/static/chunks/*`, found by the `// ink-press poster` marker) | 16,394 B raw, 7,225 B gzip; the e2e also gzips the fetched body and checks it is ≤ 12,288 B |

What the e2e asserts, in real Chrome with SwiftShader and real WebGL2 (no fakes):
- The press chunk is absent from `/play`'s first load and arrives on scroll.
- `data-renderer=webgl2`, and the buffer is 4:5 at the canvas's CSS width.
- Screenshot pixel sampling through sharp: more than 1% ink and more than 15% paper for every layout, the
  reduced-motion poster, the SVG fallback and both exports.
- A dried poster asks for no more rAF.
- The field caps the phrase at 24 characters. The chips set the layout and `aria-pressed`. Shuffle changes the
  seed, `?s=` follows it, and reopening `?s=&t=` gives the same seed, layout and phrase.
- The export download is `ink-press-the-broken-dag-<layout>-<seed>.png` at 1080x1350.
- With a faked hidden tab the ink stays wet with no frames, then dries once the tab is shown again.

Negative controls:
- Reduced motion vs normal motion: the e2e counts rAF calls whose stack is in the press chunk. Under normal motion
  it is more than 1; under `reducedMotion: "reduce"` it is 0 and `data-frames=0`.
- Unit gate: removing `!reduced.matches` from `running()` fails `lib/ink-press.test.ts` test 16 (16 pass, 1 fail);
  restored afterwards.
- WebGL gone: `getContext("webgl2")` patched to return null gives `data-renderer=svg` with `feTurbulence` filters
  and a non-blank Canvas2D export. `WEBGL_lose_context.loseContext()` switches a live poster to SVG.

Boundaries:
- Real: Chrome, WebGL2 through SwiftShader (not a GPU), the production build, `next start` and embedded Postgres.
- Not exercised: a real GPU, Safari and Firefox, and the deployed environment (QA owns that).
