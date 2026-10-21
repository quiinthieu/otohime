# QA report: pm-216 / t-1239 (run-7138)

Verdict: **pass**. Cited sha: `84ec6ed885923be71ef68d2b863824c382305c80` (both the delivery sha and deployed commit).

All scripted checks pass locally and against deployed production at `https://otohime.dev`. The defect reported in run-7125 (where rough stroke paths caused spot and body fills to render as slivers) has been completely resolved: closed SVG fills (`rectPath`, `circlePath`, `boxPath`) are now used in stamps, separate fill and stroke paths are painted in `<symbol>` / `<defs>`, button text is wired to paper color, and pixel verification in `probe-design-system.mjs` confirms solid fills for all parts.

## Deployed commit

| Check | Result |
| --- | --- |
| `<meta name="build-sha">` on `https://otohime.dev/`, `/projects`, `/design-system` | `84ec6ed885923be71ef68d2b863824c382305c80` on all three; `/design-system` 200 |
| origin/main HEAD | `84ec6ed885923be71ef68d2b863824c382305c80`, so `git merge-base --is-ancestor 84ec6ed 84ec6ed` holds |
| Green gate for 84ec6ed | pass (`gate=green sha=84ec6ed status=pass`, all nine items) |
| Author of 84ec6ed | `Otohime <quiinthieu@gmail.com>`, no Co-Authored-By trailer; matches plan commit identity |

## The contract's verification list (Node v22.12.0, darwin lease, clean tree at 84ec6ed)

| Item | Result |
| --- | --- |
| `npm ci && npm run lint && npm run typecheck && npm test` | exit 0; 1417/1417 pass |
| scripts parse: `bash -n scripts/walk-design-system.sh && bash -n scripts/probe-design-system.sh && ! grep -nE 'wc +-l' scripts/walk-design-system.sh` | exit 0 |
| `bash scripts/walk-design-system.sh` | exit 0; 52 ok, 0 failed |
| walk with nothing on :4077 (`if BASE_URL=http://127.0.0.1:4077 bash scripts/walk-design-system.sh; then exit 1; fi`) | exit 0 (fails as expected: "nothing answered ... after 5 tries") |
| `bash scripts/probe-design-system.sh` | exit 0; 94 ok, 0 failed |
| `bash scripts/probe-motion.sh` | exit 0; 510 ok, 0 failed (eleven rows, 0.8 s stagger) |
| one client file, `ensureStatic = "navigation"` | exit 0 |
| shared wiring greps | exit 0 |
| owner identity (`test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`) | exit 0 |
| production walk: `BASE_URL=https://otohime.dev bash scripts/walk-design-system.sh` | exit 0; 52 ok, 0 failed |
| production probe: `BASE_URL=https://otohime.dev bash scripts/probe-design-system.sh` | exit 0; 94 ok, 0 failed |

## Verification of the fixed defect

| Check | Result |
| --- | --- |
| Send button body center-left pixel after Spot coral | Coral: `rgb(239, 106, 76)` (matches within tolerance) |
| Note spot bar after Spot coral | Solid coral: >= 0.2% of pixels are coral |
| Send button body center-left pixel after Paper night + Spot yellow | Yellow: `rgb(244, 184, 41)` (matches within tolerance) |
| Send button word fill after Paper white | Computes to `rgb(255, 255, 255)` (legible against spot blue) |
| `isolation.test.ts` defs check | No `<path>` in the island's `<defs>` combines a fill with a rough stroke |
| `stamps.test.ts` closed path check | All 27 stamps have closed `fill` ending in `Z` and closed `accentFill` ending in `Z` |

## Acceptance criteria

| Criteria | Result |
| --- | --- |
| `/projects` lists Design system with a coral dot and title hops into `/design-system` h1 | pass |
| `/design-system` shows the box, board, follow card, and Right here card with short words and allowlisted sources | pass (4 figures, 11 sheets, <= 700 words, FK <= 8, allowlisted https sources) |
| Turning any knob moves all nine parts and counter says "1 knob turned. 9 parts followed." | pass |
| With No system on, a knob moves nothing and counter says "9 to fix by hand" | pass |
| Rule line passes and fails with real WCAG numbers | pass |
| Dress as re-paints board in sister project's colours (Shore, Capsule, Orrery, Elements, Gazette, Structures) | pass |
| Reset restores start values | pass |
| JavaScript off: finished drawing with greyed knobs in disabled fieldset | pass |
| Fits 320 px without sideways scroll | pass |
| Works in light and dark, by keyboard (Tab / ArrowRight) and with reduced motion (0s transitions, no draw-on) | pass |
| Axe accessibility checks (wcag2a, wcag2aa, wcag21aa) | 0 violations (serious or critical) in light and dark |
| Console and page errors | 0 errors |
