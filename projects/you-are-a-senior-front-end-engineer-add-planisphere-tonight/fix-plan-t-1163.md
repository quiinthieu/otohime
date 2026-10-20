# Fix plan: pm-203 / t-1163, a finger cannot turn the disc (run-6833)

**Cause: code.** The delivery at 6997065 is deployed and runs as built. The
environment is fine: CI is green, production serves 6997065, and the walk and
the gate pass.

## 1. Touch drag on the disc (blocking)

**Defect.** On a phone, a finger that drags the disc pans the page. Chrome
fires `pointercancel` after about 8 moves, so a quarter turn gives 1 h, not
6 h, and the page scrolls (scrollY 120→79).
`app/(planisphere)/planisphere.css:153` puts `touch-action: none` on
`.wheel [data-disc]`, an SVG `<g>`, and Chromium ignores `touch-action` inside
an `<svg>`. React's `onTouchStart` is passive, so it cannot help either.

**Change.** Use Vinyl's pattern (`app/(vinyl)/_components/turntable.tsx:17-19, 81-85`).
In `app/(planisphere)/_components/planisphere-app.tsx`, add a
`useEffect` next to the one at line 165. It finds `[data-disc]` under
`root.current` and adds a `touchstart` listener with `{ passive: false }`
that calls `e.preventDefault()` when `e.cancelable`. The effect's cleanup
calls `removeEventListener("touchstart", …)`. Keep the CSS rule. Put a
comment in the file header saying why the listener is there.

- The no-JS page does not change.
- Only touches that start on the disc stop panning, so the frame and the
  rest of the page still scroll by touch.
- This is proven in the page: with the listener added, the same drag gives
  21:00→15:00, scrollY unchanged, 45 pointermoves and a pointerup.

**Checks to add.**

- `scripts/walk-planisphere.sh`: a check like Vinyl's `arm_touch_listener`
  (`scripts/walk-vinyl.sh:252-258, 324`). In `planisphere-app.tsx` it
  greps for `addEventListener("touchstart"`, `passive: false` and
  `removeEventListener("touchstart"`. Name it "the disc stops a finger's pan
  with a non-passive touchstart".
- README: Planisphere's walk sentence names that check. The island sentence
  says that a finger on the disc turns it.

## 2. axe `nested-interactive` on the chart (fix in the same cycle)

**Defect.** `app/(planisphere)/_components/wheel.tsx:140` gives
`<svg class="wheel">` the role `img`, and the focusable `role="slider"` disc
is inside it. axe reports `nested-interactive` (serious, WCAG 4.1.2), and
assistive technology may treat an `img`'s children as presentational. Task
2's page had 0 axe violations. Lighthouse accessibility is still 100.

**Change.** In `wheel.tsx:140`, change `role="img"` to `role="group"` and
keep `aria-labelledby="wheel-title wheel-desc"`. In the page, this gives axe
0 violations, and Chrome's accessibility tree keeps the group "Star wheel
for Tokyo, …" and the slider "Hour". The no-JS output changes by that one
attribute only.

**Check to add.** In `scripts/walk-planisphere.sh`, check that the served
page has no `role="img"` on `svg.wheel` (`count_eq planisphere 'class="wheel"[^>]*role="img"' 0`
or the walk's equivalent). If the walk greps for `role="img"`, update that
line too.

## How to run it again

The usual gate and walk run on the fix sha. CI's `checks`, then
`production`, deploys it. Then QA runs these:

```
npm ci && npm run lint && npm run typecheck && npm test
bash scripts/walk-planisphere.sh
BASE_URL=https://otohime.dev EXPECT_SHA=<fix sha> bash scripts/walk-planisphere.sh
# in a scratch dir with playwright: must print "ok - touch quarter turn: 21:00 → 15:00 …" and exit 0
BASE=https://otohime.dev node projects/you-are-a-senior-front-end-engineer-add-planisphere-tonight/qa-t-1163-touch-probe.mjs
```

QA then repeats this report's mouse, keyboard, Now, location and
reduced-motion rows, and the JS-off comparison. The JS-off screenshots must
still match task 2's.
