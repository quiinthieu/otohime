# Fix plan: t-1076 (pm-188, run-6336)

**Cause: code.** The pipeline and deploy are fine. CI deployed 9f2c2e5 to
otohime.dev, and the remote walk passes with 31 ok and 0 failed. The delivered
CSS is wrong at 390 px.

## Defect

At 390×844, `/sun` has `document.documentElement.scrollWidth` = 403 against a
`clientWidth` of 390, with and without reduced motion. The cause is
`.visually-hidden` in `app/(sun)/sun.css` (lines 27-35): it has no
`overflow: hidden`, so the nowrap text of `<h1 class="visually-hidden">`
(`app/(sun)/sun/page.tsx:28`) counts as scrollable overflow even though
`clip-path` hides it.

## Change

1. `app/(sun)/sun.css`, in the `.visually-hidden` rule (lines 27-35): add
   `overflow: hidden;` after `padding: 0;` (line 32). The rule becomes the
   standard visually-hidden pattern. The `<h1>` is not a parent of the SVG, so
   the "no overflow: hidden on a parent of the wobble-filtered SVG" rule still holds.
2. `app/(sun)/_lib/scenes.test.ts`: add a test that reads `sun.css` (already
   loaded as `css`), matches the `.visually-hidden { … }` block and asserts it
   contains `overflow: hidden`. This guards the regression without a browser.
3. Commit as `Otohime <quiinthieu@gmail.com>` with subject
   `pm-188/t-1076: clip the visually hidden heading so /sun does not scroll sideways at 390px`
   and push to main. CI's `checks` then `production` jobs redeploy as before.

## Verification

- `npm ci && npm run lint && npm run typecheck && npm test` → exit 0 (the new scenes test passes)
- `grep -A9 '^\.visually-hidden' 'app/(sun)/sun.css' | grep -q 'overflow: hidden'`
- `bash scripts/walk-sun.sh` → exit 0, then no server on :4027
- `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`
- QA: once otohime.dev serves the fix sha, headless Chrome at 390×844 shows
  `scrollWidth === clientWidth`, with reduce and no-preference both. Run
  `BASE_URL=https://otohime.dev EXPECT_SHA=<fix sha> bash scripts/walk-sun.sh`.
