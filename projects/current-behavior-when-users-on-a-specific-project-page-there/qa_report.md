# QA report: pm-195 / t-1129 (run-6653)

**Verdict: pass.**

- Delivery: `9911e40` (the links), `81ae9af` (walk-vinyl port remap) and `9c7810d` (fix plan rep-3772: top bars stay inside the phone viewport, space after the arrow). All three are authored by `Otohime <quiinthieu@gmail.com>` with no Co-Authored-By trailer. There was no author.txt to cite; the authors come from `git log`.
- Deployed: `6298cd6`. All five project pages carry this `build-sha` on https://otohime.dev. `git merge-base --is-ancestor 9c7810d 6298cd6` passes, and so do the two earlier delivery commits.
- Green gate: the platform's gate for `9c7810d` is green: tests, lint, typecheck and all five walks. In `.github/workflows/ci.yml`, `production` has `needs: checks`, and `checks` runs `npm run test:e2e`. So the live `6298cd6` means CI ran the five `href="/projects"` rbac asserts (`e2e/rbac.test.ts:98,106,114,122,130`) and they passed.
- The failing report from run-6644 is in git history at `b223dd3`.

## Contract verification (local, HEAD 6298cd6 after `npm ci`)

| Command | Result |
|---|---|
| `npm ci && npm test` | exit 0, 325/325 |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `PORT=4041 bash scripts/walk-shore.sh` | exit 0, 23 ok |
| `SKIP_BUILD=1 PORT=4042 bash scripts/walk-capsule.sh` | exit 0, 37 ok |
| `SKIP_BUILD=1 PORT=4043 bash scripts/walk-sun.sh` | exit 0, 39 ok |
| `SKIP_BUILD=1 PORT=4044 bash scripts/walk-elements.sh` | exit 0, 49 ok |
| `SKIP_BUILD=1 PORT=4045 bash scripts/walk-vinyl.sh` | exit 0, 49 ok (served on 4055) |

Every walk has `ok - /<x> links home` and `ok - /<x> links the project list`.

## Live site (https://otohime.dev, build-sha 6298cd6)

| Check | Result |
|---|---|
| `BASE_URL=https://otohime.dev bash scripts/walk-<x>.sh` ×5 | all exit 0: shore 22, capsule 36, sun 38, elements 47, vinyl 48 ok, 0 failed |
| `BASE=https://otohime.dev node topbar-probe.mjs` (Playwright chromium-headless-shell, scrollbars shown) | **10 ok, 0 failed** (run-6644 got 4/10) |
| Shore dark scene at 390 and 1366 (engineer's request for the new `overflow-x: clip`) | toggled on (`aria-pressed=true`, `.dark-scene`). scrollWidth stays below innerWidth (375 < 390, 1351 < 1366). Three glass canvases are drawn, and both pills sit inside the bar (screenshot checked) |
| Non-goal: `/elements/fe` | no `href="/projects"` (count 0) |
| README | line 72: "Every project's top bar links home and to `/projects`, both plain `<a>` because they cross root layouts." |

For each of the five pages at both widths, the probe checks:
- the links are `/` then `/projects`, and the label is `← All projects`;
- the page has no horizontal overflow;
- both pills sit inside the viewport and inside the top bar;
- the pill heights are not below what they were before the change;
- there are at least 2px of space after the arrow;
- clicking the link lands on `/projects`.

## Note

A first live Vinyl walk failed 9 stylesheet checks because it ran during the `0a40dc2 → 6298cd6` rollout. An old pod's HTML pointed at `0tfp7-umg4kdh.css`, and the new pod returned that file as 404. The HEAD walk also checks pm-198's picker CSS, which `0a40dc2` does not have. Once every page served `6298cd6`, the walk passed 48/48. This failure has nothing to do with t-1129.
