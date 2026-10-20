# QA report: pm-195 / t-1129 (run-6644)

**Verdict: fail, cause=code.**

- Delivery: `9911e40` (the links) and `81ae9af` (walk-vinyl port remap). Both are authored by `Otohime <quiinthieu@gmail.com>` with no Co-Authored-By trailer. There was no author.txt to cite; the authors come from `git log`.
- Deployed: `ec39dad200b7aa6442125d9f22612a0d992bc5c7`. All six pages have this `build-sha` on https://otohime.dev. `git merge-base --is-ancestor` passes for both 9911e40 and 81ae9af against ec39dad.
- Green gate: the platform's gate for 81ae9af is green. On main, production deploys only after the CI `checks` job passes, and that job includes `npm run test:e2e`. So the live ec39dad means CI ran the five new `href="/projects"` rbac asserts and they passed.

## What passes

| Check | Result |
|---|---|
| `npm ci && npm test` | exit 0, 316/316 |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `PORT=4041 bash scripts/walk-shore.sh` | exit 0, 23 ok |
| `SKIP_BUILD=1 PORT=4042 bash scripts/walk-capsule.sh` | exit 0, 29 ok |
| `SKIP_BUILD=1 PORT=4043 bash scripts/walk-sun.sh` | exit 0, 39 ok |
| `SKIP_BUILD=1 PORT=4044 bash scripts/walk-elements.sh` | exit 0, 49 ok |
| `SKIP_BUILD=1 PORT=4045 bash scripts/walk-vinyl.sh` | exit 0, 47 ok (it notes that it served on 4055) |
| `BASE_URL=https://otohime.dev EXPECT_SHA=ec39dad… bash scripts/walk-<x>.sh` ×5 | all exit 0, every "links the project list" line ok |
| Diff against contract | nav `aria-label="Site"`, home link kept, plain `<a>` plus eslint comment, walk lines, rbac asserts, README line: all present. No shared component; nothing on /elements/<symbol> |
| Clicking "← All projects" (live, 10 page×width combinations) | lands on /projects every time |
| Horizontal overflow at 390 and 1366 | none (scrollWidth ≤ innerWidth everywhere) |

## What fails (live site, `topbar-probe.mjs` in this folder)

Command: `BASE=https://otohime.dev node topbar-probe.mjs`, using Playwright chromium-headless-shell 156 with scrollbars shown.

```
not ok - /shore at 390px: / outside the viewport (top -1); / spills out of the top bar (-1-35 vs 0-79)
not ok - /capsule at 390px: / outside the viewport (top -5); / spills out of the top bar (-5-31 vs 0-72); /projects spills out of the top bar (39-75 vs 0-72)
ok - /sun at 390px
not ok - /elements at 390px: no space after the arrow (0px)
not ok - /vinyl at 390px: no space after the arrow (0px)
ok - /shore at 1366px
ok - /capsule at 1366px
ok - /sun at 1366px
not ok - /elements at 1366px: no space after the arrow (0px)
not ok - /vinyl at 1366px: no space after the arrow (0px)
probe: 4 ok, 6 failed
```

1. **Capsule at 390px (main defect).** Under 480px the bar is a fixed `height: 72px` (`app/(capsule)/capsule.css:224`). The new nav wraps to two 36px pills plus an 8px gap, which is 80px, and is centred in the bar. The result: the `otohime.dev` pill starts 5px above the top of the page and cannot be scrolled into view, and the bar's 2px bottom rule runs through the `← All projects` pill. The acceptance line asks for both links to be visible at 390px; at that exact width one is clipped and the other is cut by the rule. Shore does the same by 1px (`app/(shore)/shore.css:191`, `height: 79px`).
2. **Elements and Vinyl label.** `.home-link` is `display: inline-flex` in both groups, so the leading space of " All projects" is dropped. The link reads "←All projects" on screen, while the contract says "← All projects". The DOM text is correct, so curl walks cannot see this.

Not failed:
- Sun's new pill is 24px tall, and Shore/Capsule pills are 36px. These are the sizes their bars already had at 3e01a0a (36/36/30px); only Elements and Vinyl had 44px pills, and they keep them.
- The brand stays left on Shore/Capsule, and the heading stays right of the pills on Vinyl.

## The fix, checked

I injected the CSS from fix_plan.md into the live pages with `page.addStyleTag`; the probe then reports **10 ok, 0 failed**. I did not edit application source.
