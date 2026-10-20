# QA report: pm-198 / t-1135 (run-6658)

Verdict: **pass**. Cited sha: c2660b7fd54bfbac480254dcaf24da664528ba85 (deployed). Delivery sha: 6298cd646f1ed7128d377b26c41495934d51f028.

Green gate for 6298cd6: pass (`gate=green sha=6298cd6 status=pass`, all four contract lines). `git merge-base --is-ancestor 6298cd6 c2660b7` holds, and so does `… 6298cd6 91f1f8b`. Production served 91f1f8b when the run started and c2660b7 later in the run. All production results below were re-run after `/`, `/vinyl`, `/projects` and `/music` all reported build-sha c2660b7. Between 6298cd6 and c2660b7, the delivery's CSS, probe and walk scripts are unchanged; the only change under `scripts/` is `walk-capsule.sh`.

Author: `Otohime <quiinthieu@gmail.com>`, Co-Authored-By trailers 0. This matches plan.commit_identity.

## Contract verification (local, darwin lease, Node v22.23.3, tree at c2660b7)

| Line | Result |
| --- | --- |
| `npm ci && npm run lint && npm run typecheck && npm test` | exit 0; 325/325 tests pass |
| `bash scripts/walk-vinyl.sh` | exit 0; 49 ok, 0 failed. Includes `/vinyl stylesheet styles the select picker` and `/vinyl stylesheet keeps base-select inside @supports` |
| `PORT=4035 bash scripts/walk-music.sh` | exit 0; 12 ok, 0 failed. Includes `/music stylesheets load`, `… styles the select picker` and `… keeps base-select inside @supports` |
| `PORT=4037 bash scripts/probe-selects.sh` | exit 0; 21 ok, 0 failed |

## Production (https://otohime.dev, build-sha c2660b7)

| Check | Result |
| --- | --- |
| `BASE_URL=https://otohime.dev bash scripts/walk-vinyl.sh` | walk: 48 ok, 0 failed (both picker lines ok) |
| `BASE_URL=https://otohime.dev bash scripts/walk-music.sh` | walk: 11 ok, 0 failed (all three stylesheet lines ok) |
| `BASE_URL=https://otohime.dev bash scripts/probe-selects.sh` | probe: 21 ok, 0 failed |
| WebKit 27.2 (Playwright 1.64), `/vinyl` genre | `CSS.supports('appearance','base-select')` true; computed `appearance: base-select`; closed height 40 = search 40; `selectOption` sets "Electronic" |

## The user path (probe in headless Chromium, 420×600)

- **/vinyl genre**: opens on click (`:open`). The picker is `rgb(42, 35, 30)` (`--card`) with a line border and an 8px radius, and the checked "All" is bold accent orange. ArrowDown+Enter moves the value off "" and closes the picker. Closed height is 40 = search 40.
- **/projects injected `select.field` (SWATCH_KEYS), light**: the picker is paper `rgb(242, 239, 231)` with an ink border and the hard 2px ink shadow. The checked option is yellow `rgb(244, 184, 41)` with ink text. Keyboard advances the value and closes the picker. Height is 36.39 = input 36.39. The gradient chevron stays and there is no `::picker-icon` or checkmark.
- **Dark**: the picker is `rgb(28, 25, 21)` with a light ink border and shadow, and the checked option is the same yellow. Keyboard and height are the same as light.

I viewed the screenshots (`select-vinyl.png`, `select-site-light.png`, `select-site-dark.png`) and each matches the plan's description of its page.

## Not run, and why

- **Live Firefox**: Playwright's Firefox exits with "Could not find profile folder" on this macOS lease, even with HOME and TMPDIR set to paths without spaces. The fallback is still proved by the contract's brace-walk (`base_select_guarded`, ok locally and in production): no `base-select` or `::picker(` appears outside `@supports (appearance: base-select)`.
- **Signed-in /music Colour and /admin/users/[id] Role**: these need Postgres and an owner/admin session. As the plan specifies, they are covered by the injected `select.field` on the served `/projects`, which uses the same built stylesheet and tokens.
- **GitHub Actions status**: the check-runs API returns 404 without auth on this private repo, so the platform's green gate above is cited instead.

No application source was edited.
