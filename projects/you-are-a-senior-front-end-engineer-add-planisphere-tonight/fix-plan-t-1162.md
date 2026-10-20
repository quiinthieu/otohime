# Fix plan: t-1162, the hour ring and the date rim are inked off-centre (run-6802)

Cause: **code**. Delivery b0d9518 is deployed (production serves 1ea3e22,
which contains it) and every gate line passes. The chart draws three of its
inked circles at the SVG's bottom-right corner instead of around the wheel.
See [qa-t-1162.md](qa-t-1162.md).

## What is wrong

`app/(planisphere)/_components/wheel.tsx`:

- lines 110-112:
  ```ts
  const ringOuter = inkCircle(CX, CY, RING_OUT, …);
  const ringInner = inkCircle(CX, CY, RING_IN, …);
  const rimOuter = inkCircle(CX, CY, R + RIM, …);
  ```
- `rimOuter` is drawn at line 184, inside `<g transform={`translate(${CX} ${CY})`}>` (line 160).
- `ringOuter` and `ringInner` are drawn at lines 244-245, inside `<g transform={`translate(${CX} ${CY})`}>` (line 241).

The centre (360,380) is applied twice, so the circles are centred at (720,760).

## Change

1. In `app/(planisphere)/_components/wheel.tsx`, lines 110-112, change
   `inkCircle(CX, CY, ` to `inkCircle(0, 0, ` in all three calls. Leave the
   seeds, radii and stroke widths as they are. A scratch build with exactly
   this change draws the circles in the right place.
2. Add a walk check so this cannot come back unseen. Rendered ink is path
   data, so check the served HTML for it. In `scripts/walk-planisphere.sh`,
   pull the `d="M…"` path data from Tokyo's body and fail if any coordinate
   is past the viewBox (x > 730 or y > 770, allowing for rough.js wobble).
   An alternative is a unit test next to `_lib/ink.test.ts` that renders
   `Wheel` to static markup and checks the same bound. Either is fine.
   Choose one and record the decision.
3. Commit as `Otohime <quiinthieu@gmail.com>` with no trailer, subject
   `pm-203/t-1162: ink the hour ring and date rim around the wheel's centre`,
   and push to main. The production job (`needs: checks`) redeploys.

## Verification

- `npm ci && npm run lint && npm run typecheck && npm test`: exit 0
- `! grep -n 'inkCircle(CX, CY' 'app/(planisphere)/_components/wheel.tsx'`
- `bash scripts/walk-planisphere.sh`: exit 0, including the new
  ink-in-bounds check
- the remaining t-1162 verification lines, unchanged
- QA re-run: screenshots of Tokyo 2026-12-15 22:00 and Sydney 2026-10-20
  21:00 show both hour-ring circles and the rim circle concentric with the
  wheel, and no ink crosses the caption
