# QA report: pm-216 / t-1239 (run-7125)

Verdict: **fail**, cause=**code**. Cited sha: 1b165f32338ae129c7a00d397cccab250b3fe35d (the delivery and the deployed commit).

Every scripted check passes, locally and against production. One acceptance line fails when you look at the pixels: the board's spot fills are never painted. Turn Spot to coral, and the Send button stays paper-coloured with coral slivers at its corners, its arrowhead stays hollow, and the note's spot bar stays hollow. The note changes by 28 pixels and the card by 81. A reader cannot "watch nine parts follow".

## Deployed commit

| Check | Result |
| --- | --- |
| `<meta name="build-sha">` on `https://otohime.dev/`, `/projects`, `/design-system` | `1b165f32338ae129c7a00d397cccab250b3fe35d` on all three; `/design-system` 200, 160,735 bytes |
| origin/main HEAD | 1b165f3, so `git merge-base --is-ancestor 1b165f3 1b165f3` holds |
| Green gate for 1b165f3 | pass (gate=green sha=1b165f3, all nine items) |
| GitHub Actions | not readable: the repo is private and `gh` is not authenticated on this lease. The build-sha served by production is the deploy evidence. |
| Author of 1b165f3 | `Otohime <quiinthieu@gmail.com>`, no Co-Authored-By trailer; matches plan.commit_identity |

## The contract's verification list (Node v22.12.0, darwin lease, clean tree at 1b165f3)

| Item | Result |
| --- | --- |
| `npm ci && npm run lint && npm run typecheck && npm test` | exit 0; 1416/1416 pass |
| scripts parse, no `wc -l` | exit 0 |
| `bash scripts/walk-design-system.sh` | exit 0; 52 ok, 0 failed |
| walk with nothing on :4077 | fails as it should ("nothing answered ... after 5 tries"); item exit 0 |
| `bash scripts/probe-design-system.sh` | exit 0; 86 ok, 0 failed |
| `bash scripts/probe-motion.sh` | exit 0; 510 ok, 0 failed (eleven rows, 0.8 s stagger) |
| one client file, `ensureStatic = "navigation"` | exit 0 |
| shared wiring greps | exit 0 |
| owner identity | exit 0 |
| production: `BASE_URL=https://otohime.dev EXPECT_SHA=1b165f3… bash scripts/walk-design-system.sh` | exit 0; 52 ok |
| production: `BASE_URL=https://otohime.dev bash scripts/probe-design-system.sh` | exit 0; 86 ok |

## My own checks against production (headless Chromium, Playwright 1.64 in a scratch prefix)

| Check | Result |
| --- | --- |
| `/projects` links `/design-system` once, last row, titled "Design system" | pass |
| the row's dot computes to `rgb(239, 106, 76)` (coral) | pass |
| the row title's `view-transition-name` is `project-design-system`; clicking it lands on `/design-system` with the h1 named the same; `← All projects` returns | pass |
| every preset of all seven knobs, by mouse, light and dark: the counter says "1 knob turned. 9 parts followed." and nine `<use>` change computed style | pass, with one exception: Paper cream → white changes 8 of 9 computed styles. Pixels do change around the button, because its body shows the paper (see the defect below) |
| No system, then Spot coral and Corner round: no part changes; counter "1 knob turned. 0 parts followed. 9 to fix by hand."; switching back: nine change, "System on: 9 parts follow the pots again." | pass |
| rule line vs my own WCAG computation (Python): coral on cream 2.77 → "2.8, fails"; shade on cream 6.95 → "7.0, passes"; blue on night 2.66 → "2.7, fails"; yellow on night 10.20 → "10.2, passes"; ink on night 14.52 → "14.5"; default "15.5 … 6.2, passes" | pass |
| Dress as Gazette / Orrery: the board's paper equals `/articles`' and `/orrery`'s computed `--paper` (rgb(243, 238, 227), rgb(246, 241, 231)); ink matches after the 500 ms hot mark ends | pass |
| Right here pins vs the sheets (my own grep of each `app/*/*.css`): paper, first ink and custom property count match all eleven rows; 10 `--paper`, 11 `--ink`, 8 distinct creams | pass |
| 43 figure labels render at ≥ 12 px at 390 px | pass |
| 595 visible words in the article (≤ 700) | pass |
| JavaScript off: nine parts, the fieldset disabled at opacity 0.55, the default counter and rule sentences, four part headings | pass |
| no console or page errors across all of the above | pass |
| Lighthouse accessibility ≥ 95 | not run (Lighthouse is not installed and the plan forbids new dependencies); axe wcag2a/aa/21aa reports nothing serious or critical, light and dark, at both sizes (repo probe) |

## The defect: the spot fills are slivers, not fills

Seen in screenshots of the board at 1366×768 at the default and after Spot coral (`/tmp/qa7125/board-default.png`, `board-coral.png`, `button-coral-3x.png` on the lease). Coral pixels per part after Spot coral, screenshot at deviceScaleFactor 3:

| part | coral px | of |
| --- | --- | --- |
| card | 81 | 551,988 |
| bar | 1,153 | 271,152 |
| field | 129 | 215,208 |
| ring | 1,223 | 49,680 |
| button | 173 | 134,028 |
| ghost | 449 | 131,274 |
| tag | 704 | 65,052 |
| note | 28 | 397,044 |
| switch | 3,741 | 41,454 |

The Send button is meant to be filled with the spot colour: `board-app.tsx` sets its `--part-body` to `var(--board-spot)`, and the stamps.ts header says the body is "the closed shape its fill goes on". On screen it renders as paper, with coral slivers in its four corners. Its arrowhead, the note's bar, the field's caret and the card's underline read as hollow ink outlines.

Cause: `app/(design-system)/_lib/stamps.ts:87` inks the body as `inkPath(boxPath(…), { seed })`, and the spot marks (lines 53–80) as `inkRect`/`inkPath`/`inkCircle` with no `fill`. So rough.js's `toPaths` returns only its sketchy stroke: two open, wobbly passes per edge (`M… C… M… C…`). `board-app.tsx:146` (`fill="currentColor"`) and `:140` (fill from `--part-accent`) fill those open subpaths. Each subpath closes on itself, so only the slivers between the two strokes get painted. Circles look nearly right because rough's ellipse passes are almost closed.

Why every check passed: the repo probe reads the computed `fill` on the `<use>` element ("the button's spot computes to rgb(239, 106, 76)"). That is true even when almost nothing is painted. `stamps.test.ts` checks bounds, ids and that the accent is not empty, but never that a body or accent is a closed, fillable shape.

It fails these acceptance lines: "turning any knob moves all nine parts" (Spot changes the note and the card by a few pixels), and the board as a picture of "nine parts follow". The knobs that move geometry or text (corner, gap, size, face, speed) and the ink stroke (paper night) do visibly move all nine.

No application source was edited. The fix plan is `fix_plan_t-1239.md`.
