# t-1518 Ask typewriter — summary (run-8502)

Role: software_engineer. Model: claude-opus-5-5. Plan pm-248, sequence 8.

## Delivered

- `lib/typewriter.ts` (new): a pure stepper.
  - `step(text, index, reduced, chars = 1)` returns `{ index, shown, done }`.
  - The index is clamped to the text, and NaN, negative and fractional input
    is safe.
  - With `reduced` it always returns the whole text.
  - It never stops between the two halves of a surrogate pair.
  - `due(elapsedMs)` gives the characters owed at 40 a second
    (`CHAR_MS = 25`), with the first one on the first frame.
- `components/ask-console.tsx`:
  - The receipt keeps its 32-column paper rows. Their text is now typed by a
    `requestAnimationFrame` loop that calls `step` with `due(now - start)`.
  - A row mounts when its first character prints. It reserves its final
    width (`min-width: <n>ch`), and the receipt is sized to its widest row,
    so the paper does not widen as it types.
  - The receipt is keyed per question, so a new question remounts it. The
    effect cleanup `cancelAnimationFrame`s on that remount and on unmount.
  - `prefers-reduced-motion: reduce` is read with `matchMedia` when the
    question is asked. Under it, the stepper's first step is the whole text,
    so all of it shows on the first render.
  - The typed receipt is no longer live. A sibling screen-reader-only
    `aria-live="polite" aria-atomic="true"` region is empty while typing. On
    completion it gets the answer lines plus `Sources: <titles>.`
  - Each citation is a `next/link` anchor (`<a href="/shore">`) that appears
    when its row prints.
- `app/(site)/globals.css`:
  - The CSS `steps()` clip-mask typewriter (`ask-type`, `--n`/`--at` delays)
    is removed.
  - Rows keep only the 120 ms `ask-feed` on mount. The existing
    reduced-motion block still drops it.
- `scripts/probe-ask.mjs` and `.sh`: the old "whole answer in the DOM at once"
  check contradicted the new contract and was replaced. The probe reads row
  text from the DOM against `data-total` and now asserts:
  - right after Enter the text is partial, 400 ms later there is more, and
    the live region is empty;
  - then every row is complete and none is cut off;
  - the live region, outside the receipt, holds the whole `/shore` passage;
  - every citation link is in `/ask-index.json` and includes `/shore`;
  - a second question starts a fresh receipt with the live region cleared,
    and types its own answer in full (`> now`);
  - under reduced motion the full text, the live region and the links are
    all there on the first read, with no animation running.
- `lib/typewriter.test.ts` (new, 10 tests):
  - stepping, the multi-char and zero step, the full run as prefixes, and
    reduced versus not (with a control);
  - clamping, empty text, surrogate pairs, `due` monotonicity, and about 5 s
    for 200 characters at 60 Hz;
  - a source pin on the console wiring (rAF and cancel, matchMedia,
    aria-live on done, keyed receipt, Link citations) and on the CSS (no
    `ask-type`, feed plus reduce guard).

## Verification (local, node v22, linux, this checkout)

- `npm test`: 1722 tests, 1722 pass, 0 fail. There were 1712 before; the 10
  new tests are named above.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0. `/api/ask` is still ƒ.
- `bash scripts/probe-ask.sh` (fresh build plus `next start`, Playwright
  1.64.0 Chromium headless shell): `probe: 60 ok, 0 failed` (50 before).
- `npm run lint`: 0 errors. The 10 warnings were already there, in files this
  task does not touch.
- Negative control (browser): hard-wiring `reduced = false` in the console
  and rerunning the probe gives `54 ok, 6 failed`, exit 1. All 6 failures are
  reduced-motion checks (rows 0, live "", links []). The file was restored,
  and the final build and probe ran on the restored code.
- Negative control (unit): `step(TEXT, 0, false, 0)` and
  `step(TEXT, 7, false, 1)` stop short of the text. The same calls with
  `reduced` return the whole text.

## Boundaries

- Real: the built Next app served by `next start`, real Chromium, the real
  `/ask-index.json` and the offline answerer `lib/ask.ts`.
- Not exercised: `/api/ask`. The console has never called it. It is 404
  without `ASK_LLM=1` and a key, and this task keeps it as it is (decision
  recorded). The stepper takes plain text, so wiring the POST later types the
  same way.
- Live Haiku output stays unproven, as in t-1517. No key is in the pod.
- Screen-reader announcement timing is inferred from the aria-live DOM
  contents. No assistive-technology run was made.
